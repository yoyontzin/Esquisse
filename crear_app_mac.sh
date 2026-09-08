#!/bin/bash
# Construye el paquete que macOS reconoce como aplicación: se llama Esquisse
# (así se ve en Finder y el Dock) aunque la carpeta siga siendo Pizarrón.app
# por dentro — ver el porqué junto a la variable APP más abajo. No instala
# nada. Al hacer doble clic arranca el servidor y abre la vista de proyección.
#
#     bash crear_app_mac.sh
#
# Deja pizarron.html y pizarron_servidor.py en esta misma carpeta.

set -e

AQUI="$(cd "$(dirname "$0")" && pwd)"
# El paquete se sigue llamando Pizarrón.app por dentro, aunque la app ahora
# se llame Esquisse (ver CFBundleDisplayName abajo, que es lo que se ve en
# Finder y el Dock): macOS le dio permiso de acceso a ~/Documents a esta ruta
# exacta, sin firma de desarrollador, y un paquete sin firmar con otro nombre
# de carpeta cuenta como una app nueva sin ese permiso — sin diálogo claro
# para volver a concederlo. Cambiar el nombre de la carpeta rompe el acceso
# a los cuadernos.
APP="$AQUI/Pizarrón.app"
PUERTO="${PIZARRON_PUERTO:-8777}"

for archivo in pizarron.html pizarron_servidor.py; do
  if [ ! -f "$AQUI/$archivo" ]; then
    echo "Falta $archivo en esta carpeta. Ponlo aquí y vuelve a correr esto."
    exit 1
  fi
done

# Si alguna versión anterior dejó cuadernos dentro del paquete, se rescatan
# antes de reconstruirlo: reconstruir borra el paquete entero.
VIEJOS="$APP/Contents/Resources/cuadernos"
DESTINO="$HOME/Documents/Pizarrón"
if [ -d "$VIEJOS" ] && [ -n "$(ls -A "$VIEJOS" 2>/dev/null)" ]; then
  mkdir -p "$DESTINO"
  cp -Rn "$VIEJOS/." "$DESTINO/" 2>/dev/null || true
  echo "  Rescatados los cuadernos que había dentro del paquete a $DESTINO"
fi

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Esquisse</string>
  <key>CFBundleDisplayName</key><string>Esquisse</string>
  <!-- El identificador se queda igual aunque el nombre cambió: macOS lo usa
       para recordar el permiso de acceso a ~/Documents, y si cambia, la app
       cuenta como nueva y pierde ese permiso sin avisar con un diálogo. -->
  <key>CFBundleIdentifier</key><string>mx.cimat.pizarron</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>pizarron</string>
  <key>CFBundleIconFile</key><string>pizarron</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# El programa vive dentro del paquete; los cuadernos NO, que reconstruirlo
# borra el paquete entero.
cp "$AQUI/pizarron.html" "$AQUI/pizarron_servidor.py" "$APP/Contents/Resources/"

cat > "$APP/Contents/MacOS/pizarron" <<LANZADOR
#!/bin/bash
RECURSOS="\$(cd "\$(dirname "\$0")/../Resources" && pwd)"
PUERTO=${PUERTO}

# Si ya hay un servidor en ese puerto, solo abrimos la ventana.
if ! curl -s -o /dev/null --max-time 1 "http://127.0.0.1:\$PUERTO/"; then
  cd "\$RECURSOS"
  # -u: sin esto el log se queda vacío por el búfer y un arranque fallido
  # no deja rastro que leer.
  PIZARRON_PUERTO=\$PUERTO /usr/bin/python3 -u pizarron_servidor.py \\
    > "\$HOME/Library/Logs/pizarron.log" 2>&1 &
  for i in \$(seq 1 40); do
    curl -s -o /dev/null --max-time 1 "http://127.0.0.1:\$PUERTO/" && break
    sleep 0.25
  done
fi

open "http://127.0.0.1:\$PUERTO/?rol=proyeccion"

NOMBRE="\$(hostname)"
case "\$NOMBRE" in *.local) ;; *) NOMBRE="\$NOMBRE.local";; esac
# La dirección a secas ya no basta: hace falta la clave de la sesión, y esa
# va dentro del código QR que aparece en la ventana de proyección.
osascript -e "display notification \\"Lee el código QR de la pantalla con la cámara del iPad\\" with title \\"Esquisse listo\\"" 2>/dev/null || true
LANZADOR

chmod +x "$APP/Contents/MacOS/pizarron"

# Ícono: lo genera el propio servidor, así no dependemos de nada más.
if command -v python3 >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  TMP="$(mktemp -d)"
  python3 - "$TMP" "$AQUI" <<'PYICONO'
import sys, os, importlib.util
carpeta, aqui = sys.argv[1], sys.argv[2]
ruta = os.path.join(aqui, "pizarron_servidor.py")
spec = importlib.util.spec_from_file_location("srv", ruta)
srv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(srv)
iconset = os.path.join(carpeta, "pizarron.iconset")
os.makedirs(iconset, exist_ok=True)
# Los únicos nombres que iconutil reconoce. Cualquier otro lo descarta sin
# decir nada. Cada @2x lleva el PNG del doble de lado: icon_16x16@2x mide 32.
# Sin el de 1024 el ícono se ve escalado en Retina a tamaño grande.
tabla = [(16, "icon_16x16"),     (32, "icon_16x16@2x"),
         (32, "icon_32x32"),     (64, "icon_32x32@2x"),
         (128, "icon_128x128"),  (256, "icon_128x128@2x"),
         (256, "icon_256x256"),  (512, "icon_256x256@2x"),
         (512, "icon_512x512"),  (1024, "icon_512x512@2x")]
hecho = {}
for lado, nombre in tabla:
    if lado not in hecho:
        hecho[lado] = srv.icono_png(lado)
    open(os.path.join(iconset, nombre + ".png"), "wb").write(hecho[lado])
PYICONO
  if ! iconutil -c icns "$TMP/pizarron.iconset" -o "$APP/Contents/Resources/pizarron.icns"; then
    echo "Aviso: iconutil falló; la app queda sin ícono."
  fi
  rm -rf "$TMP"
else
  echo "Aviso: falta python3 o iconutil; la app queda sin ícono."
fi

# Copia de doble clic para la próxima vez (macOS abre los .command en Terminal)
cp "$0" "$AQUI/crear_app_mac.command" 2>/dev/null || true
chmod +x "$AQUI/crear_app_mac.command" 2>/dev/null || true

echo
echo "Listo: $APP"
echo
echo "  1. Arrástrala al Dock o a Aplicaciones."
echo "  2. La primera vez, clic derecho > Abrir (macOS pide confirmación"
echo "     porque no está firmada con cuenta de desarrollador)."
echo "  3. Al abrirla, la proyección aparece sola y una notificación te dice"
echo "     qué dirección escribir en el iPad."
echo
echo "  Los cuadernos quedan en:"
echo "     $HOME/Documents/Pizarrón"
echo "  Están fuera del paquete a propósito: reconstruir la app lo borra"
echo "  entero, y ahí dentro se llevaría las clases por delante."
echo "  Para sincronizarlos, cambia esa carpeta por un enlace:"
echo "     mv ~/Documents/Pizarrón ~/Dropbox/Pizarron"
echo "     ln -s ~/Dropbox/Pizarron ~/Documents/Pizarrón"
echo
