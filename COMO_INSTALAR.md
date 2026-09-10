# Esquisse — instalación

Tres archivos. Ponlos los tres en la misma carpeta antes de empezar.

- `pizarron.html` — la aplicación
- `pizarron_servidor.py` — el conector que corre en la Mac
- `crear_app_mac.sh` — construye el ícono para el Dock

---

## 1. Crear la app de la Mac

Esto se hace **una sola vez**. Después no vuelves a abrir la Terminal nunca.

Abre la Terminal: `⌘ + espacio`, escribe `Terminal`, Enter.

Si guardaste los archivos en Descargas, pega esta línea y da Enter:

```
cd ~/Downloads && bash crear_app_mac.sh
```

Si los guardaste en otra carpeta: escribe `cd ` (con el espacio al final), arrastra
la carpeta desde el Finder hasta la ventana de la Terminal, Enter. Luego:

```
bash crear_app_mac.sh
```

Aparece `Esquisse.app` en esa carpeta. Arrástrala al Dock o a Aplicaciones.

**La primera vez que la abras**: clic derecho sobre el ícono, luego *Abrir*, y
confirma. macOS lo pide porque la app no está firmada con una cuenta de
desarrollador de Apple. Solo ocurre la primera vez.

---

## 2. Instalar la app del iPad

1. Abre `Esquisse.app` en la Mac. Aparece la pantalla con el código QR.
2. Apunta la cámara del iPad al código y toca el aviso que sale.
3. Se abre el pizarrón en Safari. Toca **Compartir**, luego
   **Añadir a pantalla de inicio**.

Queda como aplicación con ícono propio, horizontal y sin barras de Safari.

Ese ícono guarda el nombre de red de tu Mac, no una dirección numérica, así que
**funciona en cualquier red**: tu oficina, un aula prestada, o los dos aparatos
conectados al punto de acceso de tu teléfono.

---

## 3. Uso diario

**En la Mac**: abre `Esquisse.app`. Se abre sola la ventana de proyección — esa
es la que compartes en Meet o mandas al proyector.

**En el iPad**: abre el ícono de Esquisse y escribe.

Si el iPad se desconecta a media clase, en la ventana de la Mac hay un botón
**Enlazar iPad** abajo a la derecha que vuelve a mostrar el código. También con
la tecla `Q`.

---

## Sin conexión

Abre la aplicación conectado a internet una vez y espera unos segundos: en el
panel lateral verás *Sin conexión: lista* en verde. A partir de ahí funciona
completo sin red, incluyendo LaTeX y la importación de PDF.

Escribir, páginas, cuadernos, imágenes, guardado y proyección nunca necesitaron
internet.

---

## Dónde quedan los cuadernos

Fuera de la app, en `~/Documents/Pizarrón`. Ahí a propósito: reconstruir la
app borra el paquete entero, y si los cuadernos vivieran dentro se irían con
él. (El nombre de esa carpeta se quedó como estaba cuando se creó, aunque la
app ahora se llame Esquisse — es donde ya están las clases guardadas.)

Si quieres que se sincronicen con Dropbox o con tu bóveda de Obsidian, sustituye
esa carpeta por un enlace. En la Terminal, una sola vez:

```
mv ~/Documents/Pizarrón ~/Dropbox/Pizarron
ln -s ~/Dropbox/Pizarron ~/Documents/Pizarrón
```

Ajusta la ruta de destino a donde quieras que vivan de verdad.

---

## Si algo falla

**La app no abre**: clic derecho sobre el ícono, *Abrir*. El registro de errores
queda en `~/Library/Logs/pizarron.log`.

**El iPad no encuentra la Mac**: ambos tienen que estar en la misma red. El wifi
de muchos hoteles y universidades aísla a los aparatos entre sí a propósito; en
ese caso usa el punto de acceso de tu teléfono. No necesita datos, solo que cree
la red.

**El código QR muestra `localhost`**: no debería, pero si pasa, en la Terminal
escribe `hostname` y usa ese nombre con `.local` al final y el puerto `8777`.
