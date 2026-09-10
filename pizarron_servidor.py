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


def _clave_lectura():
    """La clave que se reparte a los alumnos, que solo sirve para mirar.

    Hasta la versión 1 había una sola clave para todo, y el enlace que se le
    daba al grupo la llevaba dentro. El rol vivía solo en el navegador, así
    que cualquier alumno con las herramientas de desarrollo abiertas podía
    mandar un `page` a `/empujar` y reemplazar la clase por una página en
    blanco. Se comprobó: la proyección se vaciaba y el servidor guardaba esa
    página como último estado, de modo que también se la servía a quien
    llegara después.

    Ahora son dos. La de escritura es la de siempre y sigue siendo estable,
    porque el ícono de la pantalla de inicio del iPad la lleva y cambiarla
    cada arranque obligaría a reemparejar cada mañana. La de lectura es la
    única que sale en el enlace del grupo.
    """
    if not CLAVE:
        return ""                       # sin clave configurada, todo abierto
    ruta = os.path.join(CUADERNOS, ".clave-lectura")
    try:
        if os.path.exists(ruta):
            guardada = open(ruta, encoding="utf-8").read().strip()
            if guardada:
                return guardada
    except OSError:
        pass
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    nueva = "".join(secrets.choice(alfabeto) for _ in range(8))
    try:
        os.makedirs(CUADERNOS, exist_ok=True)
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(nueva)
        os.chmod(ruta, 0o600)
    except OSError:
        pass
    return nueva


CLAVE_LECTURA = _clave_lectura()

# Tope del cuerpo de una petición. Un PDF de dieciocho páginas rasterizado no
# llega a esto, y sin tope un cliente con la clave puede llenar la memoria y
# el disco del profesor a media clase mandando cuerpos de varios gigas.
MAX_CUERPO = 48 * 1024 * 1024
# Tope de conexiones a la vez. `ThreadingHTTPServer` lanza un hilo por
# conexión en el momento de aceptarla, antes de leer un byte y antes de
# comprobar la clave, así que sin tope cualquiera en el wifi tumba el
# servidor abriendo sockets que no completa.
MAX_CONEXIONES = 64

# Cada cliente conectado tiene su propia cola de mensajes.
_clientes = {}
_siguiente_id = [0]
_candado = threading.Lock()
# Último estado completo, para que quien llegue tarde no vea una pantalla vacía.
_ultimo_estado = [None]
# Qué papel tiene cada canal abierto, para poder decir quién sigue ahí.
_papeles = {}


def anunciar_quienes():
    """Dice a todos qué papeles siguen conectados.

    Se manda al entrar y al salir cualquiera. Es lo que permite que el iPad del
    profesor avise cuando la proyección se cae, que es el fallo que en clase no
    da ningún síntoma.
    """
    with _candado:
        roles = sorted(set(_papeles.values()))
    difundir({"t": "quienes", "roles": roles})


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
def _png(ancho, alto, pixeles, alfa=False):
    """Escribe un PNG mínimo sin dependencias externas.

    Con `alfa` cada píxel lleva cuatro bytes en vez de tres y el PNG sale en
    color verdadero con transparencia, que es lo que necesita el ícono de
    macOS para dejar el margen alrededor del cuadrado redondeado.
    """
    import struct, zlib

    def trozo(tipo, datos):
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)

    crudo = b"".join(b"\x00" + bytes(fila) for fila in pixeles)
    tipo_color = 6 if alfa else 2
    return (b"\x89PNG\r\n\x1a\n"
            + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, tipo_color, 0, 0, 0))
            + trozo(b"IDAT", zlib.compress(crudo, 9))
            + trozo(b"IEND", b""))


_FONDO_ICONO = (0x25, 0x38, 0x2F)


def _color_icono(u, v):
    """El dibujo, en coordenadas de 0 a 1: pizarrón oscuro con un trazo de gis
    y una marca de stop ámbar. Lo comparten los dos formatos de ícono."""
    gis = (0xF4, 0xF1, 0xE8)
    ambar = (0xE8, 0xB3, 0x3C)
    # trazo diagonal grueso, con un quiebre a media altura
    centro = 0.30 + 0.42 * v if v < 0.55 else 0.52 + 0.10 * (v - 0.55)
    if abs(u - centro) < 0.075 - 0.03 * abs(v - 0.5):
        return gis
    # marca de stop a la derecha
    if 0.78 < u < 0.87 and 0.22 < v < 0.78:
        return ambar
    return _FONDO_ICONO


def icono_png(lado=512):
    """El ícono que sirve el servidor. Sangra a propósito: el manifiesto lo
    declara «maskable» y ahí recorta el sistema operativo, no nosotros."""
    filas = []
    for y in range(lado):
        fila = bytearray()
        for x in range(lado):
            fila += bytes(_color_icono(x / lado, y / lado))
        filas.append(fila)
    return _png(lado, lado, filas)


def icono_mac_png(lado=1024):
    """El ícono de la aplicación de macOS, con su margen y sus esquinas.

    Las proporciones son las de la retícula de Apple: en 1024 px el dibujo
    ocupa 824 y quedan 100 de margen a cada lado, o sea el 9.77 %. La esquina
    no es un arco de círculo sino una superelipse, que es lo que da la forma
    continua de los íconos del sistema; con un arco se nota el punto donde el
    lado recto se convierte en curva.

    El borde se suaviza con la distancia a la curva en vez de por muestreo
    múltiple: a 1024 px son un millón de píxeles y esto se ejecuta en Python
    puro, sin bibliotecas, al construir la aplicación.
    """
    margen = 0.09765625                      # 100 de 1024
    dentro = 1.0 - 2 * margen                # 824 de 1024
    a = dentro / 2                           # medio lado del cuadrado
    radio = 0.225 * dentro                   # 185.4 de 824
    n = 4.0                                  # exponente de la esquina
    filas = []
    for y in range(lado):
        fila = bytearray()
        v = (y + 0.5) / lado
        for x in range(lado):
            u = (x + 0.5) / lado
            dx, dy = abs(u - 0.5), abs(v - 0.5)
            # cuánto se mete el punto dentro de la esquina; cero en los lados
            # rectos, que es lo que distingue esta forma de una superelipse
            # pura y le deja los lados largos que tienen los íconos de macOS
            px, py = max(0.0, dx - (a - radio)), max(0.0, dy - (a - radio))
            if px == 0.0 and py == 0.0:
                d = min(a - dx, a - dy) * lado
            else:
                q = ((px / radio) ** n + (py / radio) ** n) ** (1.0 / n) * radio
                d = (radio - q) * lado
            if d >= 0.5:
                alfa = 255
            elif d <= -0.5:
                fila += b"\x00\x00\x00\x00"
                continue
            else:
                alfa = int(round((d + 0.5) * 255))
            # el dibujo se estira hasta llenar el cuadrado redondeado
            color = _color_icono((u - margen) / dentro, (v - margen) / dentro)
            fila += bytes(color) + bytes((alfa,))
        filas.append(fila)
    return _png(lado, lado, filas, alfa=True)


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

    # Corta a los lectores muertos y al que abre y no manda nada. Sin esto el
    # hilo se queda bloqueado en `readline` para siempre.
    timeout = 20

    def _leer_cuerpo(self):
        """Lee el cuerpo, acotado y validando la cabecera.

        Sin validar, un `Content-Length` no numérico lanza y devuelve un 500
        con traza, y uno negativo hace que `read(-1)` lea hasta que el cliente
        cierre, con el hilo ocupado mientras tanto.
        """
        crudo = self.headers.get("Content-Length", "0")
        try:
            n = int(crudo)
        except (TypeError, ValueError):
            n = -1
        if n < 0 or n > MAX_CUERPO:
            self._cuerpo_rechazado = True
            return b""
        return self.rfile.read(n) if n else b""

    def _cuerpo_o_error(self):
        """Devuelve el cuerpo, o None si ya se respondió con un error."""
        self._cuerpo_rechazado = False
        datos = self._leer_cuerpo()
        if self._cuerpo_rechazado:
            self._responder(413, b"cuerpo demasiado grande",
                            extra={"Connection": "close"})
            self.close_connection = True
            return None
        return datos

    # ---------- acceso ----------
    def _es_local(self):
        ip = (self.client_address or ("",))[0]
        return ip in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def _clave_dada(self):
        from urllib.parse import parse_qs
        q = parse_qs(urlparse(self.path).query)
        return (q.get("k", [""])[0] or self.headers.get("X-Clave", "")).strip()

    def _autorizado(self, escribir=False):
        """Sin clave configurada, o desde la propia máquina, pasa todo.

        Lo de fuera tiene que traerla, y hay dos. La de escritura vale para
        todo. La de lectura, que es la que lleva el enlace del grupo, solo
        deja mirar: sin esta separación cualquier alumno podía sobrescribir
        la clase, porque el rol vivía únicamente en el navegador.

        Se compara en tiempo constante porque el que la adivina a ciegas
        puede medir cuánto tarda el rechazo.
        """
        if not CLAVE or self._es_local():
            return True
        dada = self._clave_dada()
        if secrets.compare_digest(dada, CLAVE):
            return True
        if escribir or not CLAVE_LECTURA:
            return False
        return secrets.compare_digest(dada, CLAVE_LECTURA)

    def _rechazar(self, texto="Falta la clave de esta sesión. Vuelve a leer el código QR de la pantalla."):
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
        self._responder(403, texto.encode("utf-8"),
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
                datos["claveLectura"] = CLAVE_LECTURA
            self._json(datos)
            return

        if ruta == "/qr.png":
            from urllib.parse import parse_qs
            texto = parse_qs(urlparse(self.path).query).get("d", [""])[0]
            if not texto:
                self._responder(400, b"falta el parametro d")
                return
            # el codificador corre en Python puro y está abierto sin clave:
            # sin tope es tiempo de procesador gratis para cualquiera del wifi
            if len(texto) > 512:
                self._responder(400, b"texto demasiado largo")
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
            # Solo cuadernos, y nada que empiece por punto. La clave de la
            # sesión vive en `.clave`, dentro de esta misma carpeta, y sin este
            # filtro cualquiera con el enlace del día podía pedirla y leerla en
            # claro. Como la clave no rota entre arranques, eso le daba acceso
            # permanente a todas las clases siguientes. La escritura ya exigía
            # `.json`; la lectura se había quedado sin la misma comprobación.
            if not nombre.endswith(".json") or nombre.startswith("."):
                self._json({"error": "no existe"}, 404)
                return
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
        """Canal de eventos. Además apunta el papel de quien se conecta.

        El servidor es el único que sabe con certeza quién sigue conectado. Sin
        eso, cuando la proyección perdía la red se quedaba congelada delante
        del grupo y el profesor no tenía forma de enterarse: el aviso de enlace
        caído solo reacciona al error del canal propio, y en la proyección está
        oculto a propósito, porque es lo que ve la clase.
        """
        from urllib.parse import parse_qs
        rol = (parse_qs(urlparse(self.path).query).get("rol", [""])[0] or "?")[:20]
        with _candado:
            _siguiente_id[0] += 1
            cid = _siguiente_id[0]
            q = queue.Queue(maxsize=800)
            _clientes[cid] = q
            _papeles[cid] = rol

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
            anunciar_quienes()
            while True:
                try:
                    dato = q.get(timeout=15)
                    self.wfile.write(f"data: {dato}\n\n".encode("utf-8"))
                except queue.Empty:
                    # Latido como mensaje y no como comentario. Un comentario
                    # de SSE mantiene viva la conexión pero el navegador no lo
                    # entrega a la aplicación, así que el cliente no tenía
                    # forma de distinguir «no ha pasado nada» de «se cayó el
                    # wifi». Cuando la red se va, la conexión no da error: se
                    # queda colgada, y sin este latido nadie se entera.
                    self.wfile.write(b'data: {"t":"latido"}\n\n')
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with _candado:
                _clientes.pop(cid, None)
                _papeles.pop(cid, None)
            anunciar_quienes()

    # ---------- POST / PUT ----------
    NO_ESCRIBEN = ("Esta clave solo sirve para mirar la clase. Escribir en el "
                   "pizarrón es del profesor.")

    def do_POST(self):
        # escritura: solo con la clave de control, nunca con la del grupo
        if not self._autorizado(escribir=True):
            self._rechazar(self.NO_ESCRIBEN); return
        ruta = urlparse(self.path).path

        if ruta == "/empujar":
            try:
                crudo = self._cuerpo_o_error()
                if crudo is None:
                    return
                mensaje = json.loads(crudo or b"{}")
            except json.JSONDecodeError:
                self._json({"error": "json inválido"}, 400)
                return
            if not isinstance(mensaje, dict):
                self._json({"error": "se esperaba un objeto"}, 400)
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
            # Vaciar el cuerpo aunque el fondo ya esté: con conexión
            # persistente, responder sin leer lo que el cliente está enviando
            # deja esos bytes en el canal y la petición siguiente se lee a
            # mitad de este cuerpo. Es el mismo defecto que `_rechazar`
            # documenta y arregla en la ruta gemela.
            cuerpo = self._cuerpo_o_error()
            if cuerpo is None:
                return
            if os.path.exists(destino):        # se manda una vez y ya está
                self._json({"ok": True, "ya": True})
                return
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
            cuerpo = self._cuerpo_o_error()
            if cuerpo is None:
                return
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
        if not self._autorizado(escribir=True):
            self._rechazar(self.NO_ESCRIBEN); return
        ruta = urlparse(self.path).path
        if ruta.startswith("/cuadernos/"):
            nombre = os.path.basename(unquote(ruta[len("/cuadernos/"):]))
            # El mismo filtro que la lectura, que aquí faltaba: sin él,
            # `DELETE /cuadernos/.clave` borraba el archivo de la clave y al
            # siguiente arranque se generaba otra, dejando sin servir el ícono
            # de la pantalla de inicio de todos los aparatos enlazados. Y
            # `DELETE /cuadernos/fondos` intentaba borrar un directorio, o sea
            # 500 con traza.
            if not nombre.endswith(".json") or nombre.startswith("."):
                self._json({"error": "no existe"}, 404)
                return
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


class ServidorAcotado(ThreadingHTTPServer):
    """`ThreadingHTTPServer` con tope de conexiones simultáneas.

    El de serie lanza un hilo por conexión en el momento de aceptarla, antes
    de leer un byte y antes de comprobar la clave. Una conexión que se abre y
    no manda nada deja ese hilo bloqueado para siempre, porque el manejador
    hereda `timeout = None`. Con unos miles de sockets a medio abrir, y sin
    necesidad de clave, cualquiera en el wifi del salón deja al servidor sin
    aceptar al iPad del profesor a media explicación.

    Sesenta y cuatro conexiones sobran para un aula: el iPad, la proyección y
    un aparato por alumno.
    """

    def __init__(self, *args, **kwargs):
        self._sitio = threading.BoundedSemaphore(MAX_CONEXIONES)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self._sitio.acquire(blocking=False):
            # Sin sitio se cierra de inmediato en vez de encolar: encolar es
            # lo que convierte el agotamiento en una caída silenciosa.
            try:
                request.close()
            except OSError:
                pass
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self._sitio.release()
            raise

    def shutdown_request(self, request):
        try:
            super().shutdown_request(request)
        finally:
            self._sitio.release()


def main():
    if not os.path.exists(HTML):
        print("  Aviso: no encuentro pizarron.html junto a este archivo.")
        print("  Ponlos en la misma carpeta y vuelve a arrancar.\n")
    os.makedirs(CUADERNOS, exist_ok=True)
    os.makedirs(FONDOS, exist_ok=True)

    servidor = ServidorAcotado(("0.0.0.0", PUERTO), Manejador)
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
    # La clave no se escribe cuando la salida va a un archivo. El paquete de
    # macOS manda esto a ~/Library/Logs/pizarron.log, que entra en Time
    # Machine y en cualquier respaldo, y como la clave es estable ese registro
    # es una copia permanente de la credencial.
    a_terminal = sys.stdout.isatty()
    k = f"&k={CLAVE}" if (CLAVE and a_terminal) else ""
    print(f"      http://{anfitrion}:{PUERTO}/?rol=control{k}      <- la estable")
    for ip in ips:
        print(f"      http://{ip}:{PUERTO}/?rol=control{k}")
    if CLAVE and a_terminal:
        print(f"\n  Clave de control: {CLAVE}")
        print(f"  Clave del grupo:  {CLAVE_LECTURA}   (solo deja mirar)")
        print("  Van dentro del código QR, así que leyéndolo no hay que teclearlas.")
    elif CLAVE:
        print("\n  Esta sesión pide clave. Está en la pantalla de proyección,")
        print("  dentro del código QR de emparejamiento.")
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
