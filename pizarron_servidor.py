#!/usr/bin/env python3
"""
Servidor de Esquisse. Solo biblioteca estándar: no hay nada que instalar.

    python3 pizarron_servidor.py

Deja este archivo en la misma carpeta que pizarron.html. Al arrancar imprime
las direcciones que debes abrir en el iPad y en la computadora.

Cómo funciona: la computadora abre la vista de proyección y se queda a la
escucha; el iPad abre la vista de control y empuja los cambios. La conexión
es local, no pasa por internet. En viaje, conecta ambos aparatos al punto de
acceso de tu teléfono: no hace falta que el teléfono tenga datos, solo que
cree la red.

Los cuadernos se guardan en ./cuadernos junto a este archivo. Si pones esa
carpeta dentro de tu bóveda de Obsidian o de Dropbox, se sincronizan solos.
"""

import json
import os
import queue
import socket
import sys
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

RAIZ = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(RAIZ, "pizarron.html")
def _carpeta_cuadernos():
    """Dónde viven los cuadernos.

    Dentro del paquete de macOS no, porque `crear_app_mac.sh` borra el
    paquete entero para reconstruirlo y se llevaría por delante las clases
    guardadas. Cuando el servidor corre desde dentro de Esquisse.app, los
    cuadernos van a la carpeta del usuario, que además así se ve en el Finder.

    El nombre de la carpeta sigue siendo «Pizarrón» aunque la app ahora se
    llame Esquisse: es donde ya están guardadas las clases y cambiarlo las
    dejaría sin encontrar.

    `PIZARRON_CUADERNOS` la manda a otro sitio. Es para las pruebas: sin eso
    comparten carpeta con el repositorio, arrastran los cuadernos que dejó la
    prueba anterior —la app arranca cargando el último— y fallan por lo que
    escribió otra, no por lo que están comprobando.
    """
    fuera = os.environ.get("PIZARRON_CUADERNOS")
    if fuera:
        return os.path.expanduser(fuera)
    if ".app/Contents/" in RAIZ:
        destino = os.path.expanduser("~/Documents/Pizarrón")
    else:
        destino = os.path.join(RAIZ, "cuadernos")
    return destino


CUADERNOS = _carpeta_cuadernos()
FONDOS = os.path.join(CUADERNOS, "fondos")
PUERTO = int(os.environ.get("PIZARRON_PUERTO", "8777"))


def _clave_acceso():
    """Clave de la sesión, para que el pizarrón no quede abierto a la red.

    El servidor escucha en todas las interfaces, que es lo que permite que el
    iPad se conecte. Sin clave, cualquiera en el mismo wifi —el de una
    universidad, el de un congreso— podía leer, sobrescribir y borrar los
    cuadernos, y escribir en la clase mientras se daba.

    Desde la propia máquina no se pide: ahí el que pide es quien arrancó el
    programa. Se exige a todo lo que llega de fuera, y viaja dentro del código
    QR y del enlace para los alumnos, así que enlazar sigue siendo un escaneo.

    Se guarda junto a los cuadernos para que no cambie en cada arranque: si
    cambiara, el ícono de la pantalla de inicio del iPad dejaría de servir
    cada mañana. `PIZARRON_CLAVE` la fija a mano y `PIZARRON_SIN_CLAVE=1` la
    apaga, que es lo que usan las pruebas.
    """
    if os.environ.get("PIZARRON_SIN_CLAVE") == "1":
        return ""
    fijada = os.environ.get("PIZARRON_CLAVE")
    if fijada:
        return fijada.strip()
    ruta = os.path.join(CUADERNOS, ".clave")
    try:
        if os.path.exists(ruta):
            guardada = open(ruta, encoding="utf-8").read().strip()
            if guardada:
                return guardada
    except OSError:
        pass
    # sin letras que se confundan al dictarla en voz alta: I, O, 0, 1
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    nueva = "".join(secrets.choice(alfabeto) for _ in range(8))
    try:
        os.makedirs(CUADERNOS, exist_ok=True)
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(nueva)
        os.chmod(ruta, 0o600)
    except OSError:
        pass          # sin poder guardarla sirve igual, solo que cambia al reiniciar
    return nueva


CLAVE = _clave_acceso()

# Cada cliente conectado tiene su propia cola de mensajes.
_clientes = {}
_siguiente_id = [0]
_candado = threading.Lock()
# Último estado completo, para que quien llegue tarde no vea una pantalla vacía.
_ultimo_estado = [None]


def difundir(mensaje, excepto=None):
    dato = json.dumps(mensaje, ensure_ascii=False)
    if mensaje.get("t") in ("page", "nav"):
        _ultimo_estado[0] = dato
    with _candado:
        muertos = []
        for cid, q in _clientes.items():
            if cid == excepto:
                continue
            try:
                q.put_nowait(dato)
            except queue.Full:
                muertos.append(cid)
        for cid in muertos:
            _clientes.pop(cid, None)


def ips_locales():
    encontradas = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        encontradas.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in encontradas:
                encontradas.append(ip)
    except OSError:
        pass
    return encontradas or ["127.0.0.1"]


# ---------------------------------------------------------------- icono
def _png(ancho, alto, pixeles):
    """Escribe un PNG mínimo sin dependencias externas."""
    import struct, zlib

    def trozo(tipo, datos):
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)

    crudo = b"".join(b"\x00" + bytes(fila) for fila in pixeles)
    return (b"\x89PNG\r\n\x1a\n"
            + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0))
            + trozo(b"IDAT", zlib.compress(crudo, 9))
            + trozo(b"IEND", b""))


def icono_png(lado=512):
    """Pizarrón oscuro con un trazo de gis y una marca de stop ámbar."""
    fondo = (0x25, 0x38, 0x2F)
    gis = (0xF4, 0xF1, 0xE8)
    ambar = (0xE8, 0xB3, 0x3C)
    filas = []
    for y in range(lado):
        fila = bytearray()
        for x in range(lado):
            u, v = x / lado, y / lado
            color = fondo
            # trazo diagonal grueso, con un quiebre a media altura
            centro = 0.30 + 0.42 * v if v < 0.55 else 0.52 + 0.10 * (v - 0.55)
            if abs(u - centro) < 0.075 - 0.03 * abs(v - 0.5):
                color = gis
            # marca de stop a la derecha
            if 0.78 < u < 0.87 and 0.22 < v < 0.78:
                color = ambar
            fila += bytes(color)
        filas.append(fila)
    return _png(lado, lado, filas)


_ICONO = [None]


def icono_cache():
    if _ICONO[0] is None:
        _ICONO[0] = icono_png()
    return _ICONO[0]


MANIFIESTO = {
    "name": "Esquisse",
    "short_name": "Esquisse",
    "start_url": "/?rol=control",
    "scope": "/",
    "display": "standalone",
    "orientation": "landscape",
    "background_color": "#15171B",
    "theme_color": "#15171B",
    "icons": [{"src": "/icono.png", "sizes": "512x512", "type": "image/png",
               "purpose": "any maskable"}],
}

# Trabajador de servicio: guarda el caparazón para que la app abra aunque el
# servidor esté apagado. Los cuadernos ya viven en el aparato.
SW = """
const CACHE = 'pizarron-v1';
const SHELL = ['/', '/?rol=control', '/?rol=proyeccion', '/icono.png', '/manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Solo el caparazón propio. Interceptar otros dominios haría que las
  // bibliotecas del CDN recibieran esta página en lugar del código.
  if (u.origin !== self.location.origin) return;
  if (u.pathname === '/eventos' || u.pathname.startsWith('/cuadernos')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});
"""


# ------------------------------------------------------- código QR
# Generador en modo byte, solo biblioteca estándar. Verificado módulo a
# módulo contra una implementación de referencia.

_LOG = [0]*256
_EXP = [0]*512
_x = 1
for _i in range(255):
    _EXP[_i] = _x
    _LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    _EXP[_i] = _EXP[_i-255]


def _qr_mul(a, b):
    if a == 0 or b == 0:
        return 0
    return _EXP[_LOG[a] + _LOG[b]]


def _poly_gen(grado):
    p = [1]
    for i in range(grado):
        p = _poly_mul(p, [1, _EXP[i]])
    return p


def _poly_mul(a, b):
    r = [0]*(len(a)+len(b)-1)
    for i, av in enumerate(a):
        for j, bv in enumerate(b):
            r[i+j] ^= _qr_mul(av, bv)
    return r


def _rs(datos, n_ec):
    gen = _poly_gen(n_ec)
    res = list(datos) + [0]*n_ec
    for i in range(len(datos)):
        coef = res[i]
        if coef:
            for j, g in enumerate(gen):
                res[i+j] ^= _qr_mul(g, coef)
    return res[len(datos):]

# (version, ecc) -> (total_codewords, ec_per_block, [(n_bloques, k_datos), ...])
_TABLA = {
    (2, 'L'): (44, 10, [(1, 34)]),
    (3, 'L'): (70, 15, [(1, 55)]),
    (4, 'L'): (100, 20, [(1, 80)]),
    (5, 'L'): (134, 26, [(1, 108)]),
    (6, 'L'): (172, 18, [(2, 68)]),
    (7, 'L'): (196, 20, [(2, 78)]),
    (8, 'L'): (242, 24, [(2, 97)]),
}
_ALINEACION = {2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34], 7:[6,22,38], 8:[6,24,42]}


def _bits_version(datos_len):
    for v in range(2, 9):
        total, ec, bloques = _TABLA[(v, 'L')]
        capacidad = sum(n*k for n, k in bloques)
        # cabecera: 4 bits de modo + 8 o 16 de longitud
        cabecera = 4 + (8 if v < 10 else 16)
        if (capacidad*8) >= cabecera + datos_len*8:
            return v
    raise ValueError('el texto no cabe en un QR de versión 8')


def _codewords(texto):
    datos = texto.encode('utf-8')
    v = _bits_version(len(datos))
    total, n_ec, bloques = _TABLA[(v, 'L')]
    capacidad = sum(n*k for n, k in bloques)

    bits = []
    def push(valor, n):
        for i in range(n-1, -1, -1):
            bits.append((valor >> i) & 1)

    push(0b0100, 4)                  # modo byte
    push(len(datos), 8)
    for b in datos:
        push(b, 8)
    resto = capacidad*8 - len(bits)
    push(0, min(4, resto))           # terminador
    while len(bits) % 8:
        bits.append(0)
    relleno = [0xEC, 0x11]
    i = 0
    cw = [int(''.join(map(str, bits[j:j+8])), 2) for j in range(0, len(bits), 8)]
    while len(cw) < capacidad:
        cw.append(relleno[i % 2]); i += 1

    # partir en bloques y entrelazar
    grupos, pos = [], 0
    for n, k in bloques:
        for _ in range(n):
            grupos.append(cw[pos:pos+k]); pos += k
    ecs = [_rs(g, n_ec) for g in grupos]

    salida = []
    for i in range(max(len(g) for g in grupos)):
        for g in grupos:
            if i < len(g):
                salida.append(g[i])
    for i in range(n_ec):
        for e in ecs:
            salida.append(e[i])
    return v, salida


def _formato(mascara):
    # ECC L = 01, luego 3 bits de máscara
    datos = (0b01 << 3) | mascara
    val = datos << 10
    g = 0b10100110111
    for i in range(4, -1, -1):
        if val & (1 << (i+10)):
            val ^= g << i
    return ((datos << 10) | val) ^ 0b101010000010010


def qr_matriz(texto, mascara=0):
    v, cw = _codewords(texto)
    n = 17 + 4*v
    m = [[None]*n for _ in range(n)]

    def patron_buscador(fx, fy):
        for dy in range(-1, 8):
            for dx in range(-1, 8):
                x, y = fx+dx, fy+dy
                if not (0 <= x < n and 0 <= y < n):
                    continue
                borde = dx in (-1, 7) or dy in (-1, 7)
                anillo = dx in (0, 6) or dy in (0, 6)
                centro = 2 <= dx <= 4 and 2 <= dy <= 4
                m[y][x] = 0 if borde else (1 if (anillo or centro) else 0)

    patron_buscador(0, 0); patron_buscador(n-7, 0); patron_buscador(0, n-7)

    for i in range(8, n-8):                      # patrones de sincronía
        b = 1 - (i % 2)
        if m[6][i] is None: m[6][i] = b
        if m[i][6] is None: m[i][6] = b

    for cy in _ALINEACION.get(v, []):            # patrones de alineación
        for cx in _ALINEACION.get(v, []):
            if (cx < 8 and cy < 8) or (cx < 8 and cy > n-9) or (cx > n-9 and cy < 8):
                continue
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    m[cy+dy][cx+dx] = 1 if (max(abs(dx), abs(dy)) != 1) else 0

    m[n-8][8] = 1                                # módulo oscuro

    reservado = [[False]*n for _ in range(n)]
    for i in range(9):
        reservado[8][i] = reservado[i][8] = True
    for i in range(8):
        reservado[8][n-1-i] = reservado[n-1-i][8] = True

    # colocar datos en zigzag
    bits = [(b >> i) & 1 for b in cw for i in range(7, -1, -1)]
    idx, arriba, col = 0, True, n-1
    while col > 0:
        if col == 6:
            col -= 1
        filas = range(n-1, -1, -1) if arriba else range(n)
        for fila in filas:
            for dx in (0, 1):
                x = col - dx
                if m[fila][x] is not None or reservado[fila][x]:
                    continue
                b = bits[idx] if idx < len(bits) else 0
                idx += 1
                if mascara == 0 and (fila + x) % 2 == 0:
                    b ^= 1
                m[fila][x] = b
        arriba = not arriba
        col -= 2

    # información de formato: dos copias, en coordenadas (columna, fila)
    fmt = _formato(mascara)
    for i in range(15):
        b = (fmt >> i) & 1
        if i < 6:      m[i][8] = b
        elif i == 6:   m[7][8] = b
        elif i == 7:   m[8][8] = b
        elif i == 8:   m[8][7] = b
        else:          m[8][14-i] = b
        if i < 8:      m[8][n-1-i] = b
        else:          m[n-15+i][8] = b

    return [[c or 0 for c in fila] for fila in m]


def qr_png(texto, escala=8, margen=4):
    m = qr_matriz(texto)
    n = len(m)
    lado = (n + 2*margen) * escala
    filas = []
    for y in range(lado):
        fila = bytearray()
        my = y // escala - margen
        for x in range(lado):
            mx = x // escala - margen
            oscuro = 0 <= my < n and 0 <= mx < n and m[my][mx]
            fila += b"\x00\x00\x00" if oscuro else b"\xff\xff\xff"
        filas.append(fila)
    return _png(lado, lado, filas)


class Manejador(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        pass  # silencio: no queremos ruido durante la clase

    # ---------- utilidades ----------
    def _responder(self, codigo, cuerpo=b"", tipo="text/plain; charset=utf-8", extra=None):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if cuerpo:
            self.wfile.write(cuerpo)

    def _json(self, obj, codigo=200):
        self._responder(codigo, json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                        "application/json; charset=utf-8")

    def _leer_cuerpo(self):
        n = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(n) if n else b""

    # ---------- acceso ----------
    def _es_local(self):
        ip = (self.client_address or ("",))[0]
        return ip in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def _clave_dada(self):
        from urllib.parse import parse_qs
        q = parse_qs(urlparse(self.path).query)
        return (q.get("k", [""])[0] or self.headers.get("X-Clave", "")).strip()

    def _autorizado(self):
        """Sin clave configurada, o desde la propia máquina, pasa todo.

        Lo de fuera tiene que traerla. Se compara en tiempo constante porque
        el que la adivina a ciegas puede medir cuánto tarda el rechazo.
        """
        if not CLAVE or self._es_local():
            return True
        return secrets.compare_digest(self._clave_dada(), CLAVE)

    def _rechazar(self):
        """Rechaza, pero vaciando antes el cuerpo de la petición.

        Con conexión persistente, responder sin leer lo que el cliente ya está
        enviando deja esos bytes en el canal, y la petición siguiente empieza a
        leerse a mitad del cuerpo anterior: se cuelan peticiones que parecen
        válidas. Cerrar la conexión además evita reaprovechar un canal que
        acaba de quedar en un estado dudoso.
        """
        try:
            self._leer_cuerpo()
        except OSError:
            pass
        self._responder(403, "Falta la clave de esta sesión. Vuelve a leer el "
                             "código QR de la pantalla.".encode("utf-8"),
                        extra={"Connection": "close"})
        self.close_connection = True

    # ---------- GET ----------
    # Lo único que se sirve sin clave: el caparazón de la aplicación y sus
    # adornos. No llevan nada de la clase dentro, y el iPad necesita poder
    # cargarlos para después pedir lo demás con la clave que trae en el enlace.
    ABIERTAS = ("/", "/index.html", "/control", "/proyeccion",
                "/icono.png", "/manifest.webmanifest", "/sw.js", "/qr.png")

    def do_GET(self):
        ruta = urlparse(self.path).path
        if ruta not in self.ABIERTAS and not self._autorizado():
            self._rechazar(); return

        if ruta in ("/", "/index.html", "/control", "/proyeccion"):
            if not os.path.exists(HTML):
                self._responder(404, b"Falta pizarron.html junto al servidor.")
                return
            with open(HTML, "rb") as f:
                cuerpo = f.read()
            self._responder(200, cuerpo, "text/html; charset=utf-8")
            return

        if ruta == "/info":
            anfitrion = socket.gethostname()
            if not anfitrion.endswith(".local"):
                anfitrion += ".local"
            datos = {"anfitrion": anfitrion, "ips": ips_locales(), "puerto": PUERTO}
            # La clave solo se entrega a quien pregunta desde la propia
            # máquina: es la pantalla de proyección, que es quien la mete en
            # el código QR y en el enlace de los alumnos. A quien pregunta
            # desde la red no se le dice, aunque ya haya entrado con ella.
            if self._es_local():
                datos["clave"] = CLAVE
            self._json(datos)
            return

        if ruta == "/qr.png":
            from urllib.parse import parse_qs
            texto = parse_qs(urlparse(self.path).query).get("d", [""])[0]
            if not texto:
                self._responder(400, b"falta el parametro d")
                return
            try:
                self._responder(200, qr_png(texto), "image/png",
                                {"Cache-Control": "public, max-age=300"})
            except Exception as err:
                self._responder(500, str(err).encode("utf-8"))
            return

        if ruta == "/icono.png":
            self._responder(200, icono_cache(), "image/png",
                            {"Cache-Control": "public, max-age=86400"})
            return

        if ruta == "/manifest.webmanifest":
            self._responder(200, json.dumps(MANIFIESTO).encode("utf-8"),
                            "application/manifest+json; charset=utf-8")
            return

        if ruta == "/sw.js":
            self._responder(200, SW.encode("utf-8"),
                            "application/javascript; charset=utf-8",
                            {"Service-Worker-Allowed": "/"})
            return

        if ruta == "/eventos":
            self._eventos()
            return

        if ruta == "/cuadernos":
            os.makedirs(CUADERNOS, exist_ok=True)
            filas = []
            for nombre in sorted(os.listdir(CUADERNOS)):
                if not nombre.endswith(".json"):
                    continue
                ruta_f = os.path.join(CUADERNOS, nombre)
                filas.append({"archivo": nombre,
                              "bytes": os.path.getsize(ruta_f),
                              "modificado": os.path.getmtime(ruta_f) * 1000})
            self._json(filas)
            return

        if ruta.startswith("/fondos/"):
            nombre = os.path.basename(unquote(ruta[len("/fondos/"):]))
            ruta_f = os.path.join(FONDOS, nombre)
            if not os.path.exists(ruta_f):
                self._responder(404, b"no existe")
                return
            with open(ruta_f, "rb") as f:
                self._responder(200, f.read(), "image/jpeg",
                                {"Cache-Control": "public, max-age=86400"})
            return

        if ruta.startswith("/cuadernos/"):
            nombre = os.path.basename(unquote(ruta[len("/cuadernos/"):]))
            ruta_f = os.path.join(CUADERNOS, nombre)
            if not os.path.exists(ruta_f):
                self._json({"error": "no existe"}, 404)
                return
            with open(ruta_f, "rb") as f:
                self._responder(200, f.read(), "application/json; charset=utf-8")
            return

        self._responder(404, b"no encontrado")

    # ---------- flujo de eventos ----------
    def _eventos(self):
        with _candado:
            _siguiente_id[0] += 1
            cid = _siguiente_id[0]
            q = queue.Queue(maxsize=800)
            _clientes[cid] = q

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        try:
            self.wfile.write(f"retry: 1500\ndata: {json.dumps({'t':'hola','id':cid})}\n\n"
                             .encode("utf-8"))
            self.wfile.flush()
            if _ultimo_estado[0]:
                self.wfile.write(f"data: {_ultimo_estado[0]}\n\n".encode("utf-8"))
                self.wfile.flush()
            while True:
                try:
                    dato = q.get(timeout=15)
                    self.wfile.write(f"data: {dato}\n\n".encode("utf-8"))
                except queue.Empty:
                    self.wfile.write(b": latido\n\n")  # mantiene viva la conexión
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with _candado:
                _clientes.pop(cid, None)

    # ---------- POST / PUT ----------
    def do_POST(self):
        if not self._autorizado():
            self._rechazar(); return
        ruta = urlparse(self.path).path

        if ruta == "/empujar":
            try:
                mensaje = json.loads(self._leer_cuerpo() or b"{}")
            except json.JSONDecodeError:
                self._json({"error": "json inválido"}, 400)
                return
            origen = mensaje.get("de")
            difundir(mensaje, excepto=origen)
            self._json({"ok": True})
            return

        # Los fondos de PDF y las imágenes van aparte, no dentro del cuaderno:
        # metidos en el JSON, dieciocho páginas de un artículo son casi tres
        # megas que se reescriben enteros cada vez que se levanta la pluma.
        if ruta.startswith("/fondos/"):
            nombre = os.path.basename(unquote(ruta[len("/fondos/"):]))
            if not nombre:
                self._responder(400, b"falta el nombre")
                return
            os.makedirs(FONDOS, exist_ok=True)
            destino = os.path.join(FONDOS, nombre)
            if os.path.exists(destino):        # se manda una vez y ya está
                self._json({"ok": True, "ya": True})
                return
            cuerpo = self._leer_cuerpo()
            tmp = destino + ".tmp"
            with open(tmp, "wb") as f:
                f.write(cuerpo)
            os.replace(tmp, destino)
            self._json({"ok": True, "bytes": len(cuerpo)})
            return

        if ruta.startswith("/cuadernos/"):
            nombre = os.path.basename(unquote(ruta[len("/cuadernos/"):]))
            if not nombre.endswith(".json"):
                nombre += ".json"
            os.makedirs(CUADERNOS, exist_ok=True)
            cuerpo = self._leer_cuerpo()
            tmp = os.path.join(CUADERNOS, nombre + ".tmp")
            with open(tmp, "wb") as f:
                f.write(cuerpo)
            os.replace(tmp, os.path.join(CUADERNOS, nombre))  # escritura atómica
            self._json({"ok": True, "archivo": nombre, "bytes": len(cuerpo)})
            return

        self._responder(404, b"no encontrado")

    do_PUT = do_POST

    # ---------- DELETE ----------
    def do_DELETE(self):
        if not self._autorizado():
            self._rechazar(); return
        ruta = urlparse(self.path).path
        if ruta.startswith("/cuadernos/"):
            nombre = os.path.basename(unquote(ruta[len("/cuadernos/"):]))
            ruta_f = os.path.join(CUADERNOS, nombre)
            if os.path.exists(ruta_f):
                os.remove(ruta_f)
                self._json({"ok": True})
            else:
                self._json({"error": "no existe"}, 404)
            return
        self._responder(404, b"no encontrado")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()


def main():
    if not os.path.exists(HTML):
        print("  Aviso: no encuentro pizarron.html junto a este archivo.")
        print("  Ponlos en la misma carpeta y vuelve a arrancar.\n")
    os.makedirs(CUADERNOS, exist_ok=True)
    os.makedirs(FONDOS, exist_ok=True)

    servidor = ThreadingHTTPServer(("0.0.0.0", PUERTO), Manejador)
    servidor.daemon_threads = True

    ips = ips_locales()
    ancho = 62
    print("\n" + "═" * ancho)
    print("  ESQUISSE — servidor local".center(ancho))
    print("═" * ancho)
    print("\n  En esta computadora (proyección):")
    print(f"      http://localhost:{PUERTO}/?rol=proyeccion")
    print("\n  En el iPad (control), escribe una de estas:")
    anfitrion = socket.gethostname()
    if not anfitrion.endswith(".local"):
        anfitrion += ".local"
    k = f"&k={CLAVE}" if CLAVE else ""
    print(f"      http://{anfitrion}:{PUERTO}/?rol=control{k}      <- la estable")
    for ip in ips:
        print(f"      http://{ip}:{PUERTO}/?rol=control{k}")
    if CLAVE:
        print(f"\n  Clave de esta sesión: {CLAVE}")
        print("  Va dentro del código QR, así que leyéndolo no hay que teclearla.")
        print("  Sin ella, nadie más en esta red puede leer ni tocar tus clases.")
    print("\n  Usa la que termina en .local para el ícono de la pantalla de")
    print("  inicio: sirve en cualquier red, aunque la IP cambie.")
    print(f"\n  Cuadernos: {CUADERNOS}")
    print("  (esa carpeta se puede abrir en el Finder)")
    print("\n  De viaje: conecta ambos aparatos al punto de acceso de tu")
    print("  teléfono. No necesita datos, solo que cree la red.")
    print("\n  Ctrl-C para detener.")
    print("═" * ancho + "\n")

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor detenido.\n")
        servidor.shutdown()


if __name__ == "__main__":
    main()
