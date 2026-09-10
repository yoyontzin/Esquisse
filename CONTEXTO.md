# Esquisse — contexto del proyecto

Documento de traspaso. Si abres este proyecto en Claude Code, lee esto primero.

## Qué es

Sustituto de Doceri (retirado en agosto de 2022) para dar clases de matemáticas:
se escribe en el iPad y se proyecta desde la Mac, con revelado por pasos.

La fecha del retiro sale del propio fabricante y no de terceros, porque acaba
impresa en un depósito con DOI y ahí ya no se corrige. `doceri.com` hoy no
responde; la última copia archivada que sí carga, la del 20 de septiembre de
2024, dice entera: «We regret to inform you that Doceri was retired in August
2022 is no longer supported». Está en
`https://web.archive.org/web/20240920134854/http://doceri.com/`. Las copias de
2022 todavía enseñan la página comercial completa, así que el aviso se puso
entre diciembre de 2022 y 2024, pero la fecha que da la empresa es agosto de
2022.

Autor del uso: J. Rogelio Pérez-Buendía, CIMAT Mérida. Curso en marcha:
Geometría Algebraica IV, Teoría de Esquemas, en línea por Google Meet.

Se llamó «Pizarrón» durante el desarrollo; el nombre pasó a **Esquisse** el
2026-08-24. Los archivos (`pizarron.html`, `pizarron_servidor.py`, el
repositorio, la carpeta del proyecto y la de cuadernos guardados en
`~/Documents/Pizarrón`) se quedaron con el nombre antiguo a propósito: son
identificadores internos, no algo que el usuario vea, y renombrarlos habría
sido tocar rutas de datos reales sin necesidad.

## Archivos

| Archivo | Qué es |
|---|---|
| `pizarron.html` | La aplicación completa. Un solo archivo, sin build. |
| `pizarron_servidor.py` | Servidor local. Solo biblioteca estándar de Python. |
| `crear_app_mac.sh` | Construye `Esquisse.app` para el Dock. |
| `COMO_INSTALAR.md` | Instrucciones para el usuario final. |
| `pruebas/` | Pruebas automatizadas con Playwright. |

## Las cuatro decisiones de diseño que sostienen todo

**0. El pizarrón está acotado, no es un lienzo infinito.**
Mide `MARCO` = 1920 x 1080 en coordenadas de mundo, o sea 16:9, la
proporción del proyector y la del cuadro de Meet y Zoom: al compartir la
ventana de proyección no salen franjas. La clase ve siempre ese rectángulo
entero, así que lo escrito no se le mueve nunca de sitio. Fuera del marco
no hay papel, hay pared, y ni el papel ni la tinta se pintan ahí: el
recorte se aplica al componer, no trazo por trazo, por lo mismo de siempre.
Sustituye al lienzo infinito de la primera versión, que en clase obligaba a
perseguir el encuadre. `camProj` deja de ser una cámara que se pasea y pasa
a ser el marco fijo; «Encuadrar» solo devuelve al profesor a la vista
completa. El zoom privado sobrevive: `camBoard` sigue siendo independiente,
pero `limitarCam` impide perder el pizarrón de vista.

**1. El documento es una lista ordenada de elementos.**
Un elemento es un trazo (`k:'s'`) o un texto (`k:'t'`) o una imagen (`k:'i'`).
Un *stop* es un índice dentro de esa lista; `reveal` es hasta dónde ve la clase.
De ahí salen gratis: reproducción animada, PDF por etapas, y el lazo.
Las formas geométricas se guardan como polilíneas, no como objetos «rectángulo»,
justamente para no crear casos especiales en todo lo demás.

**2. Dos cámaras independientes sobre el mismo documento.**
`camBoard` es la del profesor y `camProj` la de los alumnos. El zoom privado no
es una función: es la consecuencia de no acoplarlas. El puntero y la selección
viven en coordenadas de mundo, así que aparecen en el lugar correcto en ambas.

**3. El trazo guarda una ranura de pigmento, no un color.**
Por eso una página puede pasar de papel blanco a pizarrón verde sin perder nada:
el fondo decide qué pigmento corresponde a cada ranura. El fondo efectivo se
evalúa por luminancia, no por el nombre del papel, para que un color
personalizado también elija bien.

## Fondos con textura

Tres de los fondos son las texturas reales de las diapositivas del curso, en
16:9 y embebidas en el HTML como data URI: `gis` (el `Blackboard-keynote` del
curso de Geometría Algebraica IV), `verdetex` (la `pizarra-bg` del minicurso)
y `vintage` (el papel de Grupos de Galois, recortado de 4:3 a 16:9 para que no
se deforme). Van dentro del archivo, comprimidas a 1280 de ancho, y no como
archivos aparte: así se conserva lo de «un solo archivo, sin build», al precio
de que `pizarron.html` pase de 91 KB a unos 365 KB. Se carga desde localhost,
donde ese peso no se nota. La textura se dibuja sobre el color de fondo y
debajo de todo lo demás; si la página tiene un `bgColor` propio, no se pinta.

## Arquitectura de render

Cuatro capas compuestas una sola vez por cuadro:

    papel → resaltador → resaltador fantasma → tinta → tinta fantasma

«Fantasma» es lo aún no revelado, que el profesor ve al 26% y la clase no ve.
La transparencia se aplica al componer, nunca trazo por trazo: hacerlo por trazo
produce bandas en los solapes. Ese defecto ya ocurrió una vez; no reintroducirlo.

El borrador usa `destination-out` sobre las capas de tinta, no pinta blanco.
Pintar blanco se veía bien en papel y era un desastre sobre pizarrón verde.

La tinta ya rasterizada se reaprovecha entre cuadros. Redibujar los mil
trazos de una clase en cada cuadro es lo que hacía que el iPad se arrastrara:
`strokePath` da un `stroke` por segmento para modular el grosor con la
presión, y son decenas de miles por página. Mientras la cámara, el tamaño y
el reparto entre revelado y fantasma no cambien, lo pintado se queda en su
capa y encima solo va lo recién escrito. Medido con 160 trazos, `sync` pasó de
15.6 ms a 0.07 ms.

`docVer` sube con cualquier cambio que no sea escribir al final —borrar,
mover, recolorear, cambiar de página, abrir otro cuaderno— y va en el sello de
la caché, así que la invalida sin tener que acordarse de limpiar capas. Ojo
con el dibujo en vivo del resaltador y de la goma: empujan un elemento
prestado a la lista para poder repintar, y hay que borrar la entrada de la
caché después, o el trazo definitivo —que además va suavizado— se daría por
puesto y no se pintaría nunca. `prueba_cache.mjs` compara, operación por
operación, lo que se ve contra un rasterizado de cero.

## Red

El control (iPad) empuja por `POST /empujar`; la proyección recibe por
`GET /eventos`, que es un flujo de eventos servidor-enviados. Se eligió sobre
WebSockets porque cabe en la biblioteca estándar de Python: cero instalación en
cualquier máquina.

Las imágenes y los fondos de PDF se mandan **una sola vez** y después se
referencian por identificador. Sin eso, cada trazo reenviaría megas de
diapositiva y el enlace se ahogaría.

Escribir manda **solo lo escrito**, no la página entera. La primera versión
recalculaba una firma que incluía el número de elementos, así que cada trazo
nuevo la cambiaba y disparaba el envío completo: el trazo cincuenta mandaba
los cincuenta. Medido, treinta trazos gastaban 613 KB para una página de 39 KB,
y el trazo veinte pesaba 21 KB. Ahora van en un mensaje `add` con `desde`, el
receptor comprueba que la cuenta cuadre y, si no, pide la página completa con
`pide`, que es el mismo mensaje que usa una proyección al conectarse. Con eso
los mismos treinta trazos gastan 27 KB y el trazo veinte pesa 915 bytes.

Todo lo que no sea añadir al final —borrar, mover con el lazo, cambiar un
color, pegar— llama a `edicion()`, que fuerza el envío completo. Si algún día
se añade otra operación de ese tipo y se olvida la llamada, el receptor lo
nota solo cuando la cuenta no cuadra; lo que no detecta es una edición que
deje el mismo número de elementos, así que la llamada no es opcional.

Los puntos se guardan con dos decimales. El navegador entrega doce, que
duplicaban el tamaño de cada trazo sin que se vea la diferencia en un
pizarrón de 1920 de ancho.

El emparejamiento es por código QR, generado en Python puro y verificado módulo
a módulo contra una implementación de referencia. Codifica el nombre Bonjour
(`equipo.local`), nunca la IP: así el ícono del iPad funciona en cualquier red.

Los fondos —diapositivas, páginas de PDF, imágenes de fondo— se guardan como
archivos en `cuadernos/fondos/` y en el cuaderno queda solo su identificador.
Dentro del JSON, dieciocho páginas de un artículo eran 4.4 MB que se
reescribían enteros cada vez que se levantaba la pluma; fuera, el cuaderno pesa
5 KB. Se suben una vez: el servidor contesta que ya lo tiene y no se reenvía.
Los cuadernos viejos con el fondo dentro se siguen leyendo.

El archivo de cada cuaderno lleva su identificador (`Clase~msvid….json`).
Sin eso, dos cuadernos llamados «Cuaderno sin título» —el nombre de fábrica—
se pisaban uno al otro. Renombrar deja el archivo anterior huérfano; no se
pierde nada, pero se acumula.

El trazo que se está escribiendo pinta **solo el tramo nuevo**. Redibujarlo
entero en cada movimiento costaba 22 ms por evento con seiscientos puntos ya
trazados —el coste crecía con la longitud del trazo, o sea que la línea se
trababa justo al alargarla—. Ahora son 0.09 ms y no depende del largo. Un
repintado se lleva ese trazo por delante, porque vive suelto sobre el lienzo y
no en las capas, así que `drawBoard` lo vuelve a pintar entero y reinicia la
cuenta.

`olvidarTinta()` sube `docVer`, que va en el sello, o sea que invalida TODAS
las claves de render. Para refrescar una miniatura hay que usar
`olvidarClave('mini')`: hacerlo con `olvidarTinta` obligaba a re-trazar la
clase entera del pizarrón, y como las miniaturas se reintentaban en cada
`sync`, con un PDF detrás eso pasaba en cada trazo.

Los segmentos seguidos con grosor parecido se acumulan en un solo trazado.
Un `stroke` por segmento es lo que permite que el grosor siga a la presión,
pero son decenas de miles por página.

Gis y resaltador se pintan en vivo sobre una capa aparte, no prestándolos a la
lista de elementos: prestarlos obligaba a tirar la caché en cada cuadro. La
goma no puede ir por ahí porque borra con `destination-out` y necesita morder
las capas de tinta de verdad.

El rectángulo del lienzo se lee una vez al apoyar la pluma, no en cada evento.
El Pencil muestrea a 240 Hz y cada evento trae varios fusionados; leerlo
dentro del bucle obliga a recalcular la disposición, y como el dibujado
escribe texto en el panel, ese cálculo nunca está en caché. Por lo mismo, los
textos del panel se comparan antes de escribirse.

La vista previa de proyección no se dibuja si el panel está oculto —modo
clase, rol proyección, pantallas por debajo de 980— salvo que esté abierta la
ventana de proyección.

## Interfaz

Las herramientas son iconos, y el nombre se puede encender con «Nombres», que
se recuerda entre sesiones. Con nombres la fila mide 172 px; sin ellos, 95, y
el pizarrón gana 77. Los SVG van dentro del botón junto a un `span.txt`, y los
`id` no cambiaron: `setTool` sigue funcionando por `id` y clase `.on`.

Al cortar o copiar aparece **«Pegar aquí»** abajo, mientras haya algo en el
portapapeles. Antes, cortar vaciaba la selección, con ella se iba su barra, y
«Pegar» solo vivía en la fila de abajo —que en modo clase ni existe—: se
cortaba algo y no había manera de recuperarlo.

La barra de selección se ancla a lo seleccionado, encima o debajo según quepa,
y lo sigue al moverlo. Anclada arriba tapaba la fila de herramientas justo
cuando se querría cambiar de color.

El dock de modo clase lleva goma, deshacer, rehacer, puntero y los ocho
colores: dando clase no hay barra a la que ir.

### El puntero

Señalar tiene tres formas —punto de láser, flecha y mano— y seis colores, y se
elige al tomar el puntero, en `#opcPuntero`. Cada forma sirve para algo
distinto: el punto para un renglón, la flecha para un vértice, la mano para
que se vea desde el fondo del salón. El color importa porque sobre una figura
llena de rectas el rojo se pierde.

La flecha y la mano van como camino de SVG compilado a `Path2D`, y se colocan
**por la punta**, no centradas: centradas señalarían un centímetro más abajo
de lo que uno cree, que a tamaño de pizarrón es media línea.

`ui.ptrVida` es lo que tarda en borrarse lo señalado, de 1 a 20 segundos. La
cabeza se va antes que la estela, a un tercio: si el punto se quedara tanto
como lo escrito, al bajar la mano seguiría marcando un sitio que ya no
interesa. Con los 9 segundos de fábrica sale exactamente lo que había antes de
que esto fuera regulable.

El estilo viaja con la señal —`{t:'ptr', x, y, c, f, v}`—. Sin eso la clase
vería un punto rojo mientras el profesor cree estar señalando con una mano
verde.

## Dónde viven los cuadernos

En `~/Documents/Pizarrón`, **fuera** del paquete de macOS. Vivían dentro, en
`Pizarrón.app/Contents/Resources/cuadernos`, y `crear_app_mac.sh` hace
`rm -rf` del paquete entero para reconstruirlo: cada vez que se regeneraba la
app se borraban las clases guardadas. El servidor lo decide solo —si arranca
desde dentro de un `.app`, guarda en la carpeta del usuario— y el guion
rescata lo que encuentre dentro del paquete antes de borrarlo. Cuando el
servidor se corre suelto desde el repositorio, sigue usando `./cuadernos`.

## Quién está y quién escribe

Cada aparato dice su nombre al conectarse con el mensaje `soy`, y quien lo
recibe contesta una vez para que el recién llegado sepa quién hay. Del nombre
salen las iniciales, que van dentro de cada trazo en el campo `a` y se enseñan
pegadas a la punta mientras se escribe, también en el lado que recibe. Con
varias personas en el mismo pizarrón, ver aparecer un trazo sin saber de quién
es desconcierta.

## Editar a media cinta

Con «Editar aquí» puesto, lo que dibujas se cose en el punto de la cinta donde
estés en vez de irse al final, y «Borrar anterior» quita el trazo justo antes
de ese punto. Sirve para corregir una clase ya dada sin rehacer lo que viene
después: te paras en el error, borras, escribes encima, y sigues.

Los stops posteriores al punto se corren solos con lo insertado o lo borrado.
Sin eso quedarían apuntando a otro trazo y los cortes de la clase se moverían
de sitio.

Insertar en medio **no** es añadir al final, así que llama a `edicion()`: el
mensaje ligero de red da por hecho lo segundo y mandaría lo insertado como si
fuera nuevo, duplicando lo viejo en quien esté mirando.

Va con aviso fuerte —botón morado y borde de color en la cinta— porque mientras
esté puesto cambia dónde aterriza cualquier trazo, y olvidarlo puesto se paga
caro. Con el modo apagado y parado a media cinta, lo que escribas se va al
final y **no lo vas a ver**; ahí sale un aviso, una vez por parada. No se mueve
el revelado a la fuerza porque en clase eso destaparía de golpe lo que queda
por explicar.

## La lupa

Escribes en grande en la banda de abajo y el trazo cae pequeño en el pizarrón,
que no se mueve. Es lo que hace GoodNotes y es la única forma de escribir a
mano con letra legible en una pantalla táctil: con el Pencil, escribir del
tamaño real en un lienzo de 1920 de ancho sale ilegible.

La banda es una segunda ventana sobre el mismo documento, con su propia cámara.
No hay un segundo camino de escritura: `toWorld` mira por qué superficie entró
el evento y traduce con la cámara que toque, y los mismos manejadores están
puestos en las dos. La pluma, el rechazo de palma y la presión son los de
siempre.

`lupa.alto` es el alto del renglón en coordenadas de mundo, y de ahí sale el
aumento: la banda mide lo que mide en pantalla y el renglón tiene que caber
justo. Renglón más chico, más aumento. Con el pizarrón encuadrado y el alto de
fábrica, escribir sale unas cinco veces más grande que en el lienzo.

La ventana se corre **al levantar la pluma**, nunca mientras escribes: la
ventana es el marco de coordenadas del trazo, y moverla a media letra dejaría
la punta donde está pero el trazo saltaría a otro sitio. Se corre media
ventana y no una entera, para que lo último escrito siga a la vista y se pueda
enlazar la palabra siguiente. Al acabarse el ancho salta de renglón.

En el pizarrón se dibuja con línea punteada verde qué trozo está mirando la
lupa. Sin eso escribes a ciegas: sale bien en la banda y no sabes dónde cayó.

La banda le quita alto al lienzo mientras está puesta, no flota encima: tapando
taparía justo la línea que acabas de escribir. El lienzo se encoge con `calc` y
no con `height:auto`, porque un canvas es un elemento reemplazado y con el alto
en auto toma su tamaño intrínseco e ignora el `bottom`.

## Tocar un cuadrito de la cinta

Un toque seco selecciona ese elemento; arrastrar sigue recorriendo la clase. Es
la forma directa de quitar una letra suelta: la ves en la cinta, la tocas, y la
borras desde la barra de selección de siempre, con su color, su tamaño y su
deshacer. La alternativa era pararse justo detrás y usar «Borrar anterior», que
obliga a contar trazos.

Si lo tocado cae fuera de lo que estás mirando, la vista se acerca a ello.
Borrar a ciegas un trazo que no ves es justo lo que no queremos.

## Dónde va la cinta

Abajo, arriba o a un lado, y donde la dejes se queda. Escribiendo en el iPad la
palma descansa en el borde de abajo, que es justo donde estaba: pulsaba sus
botones sola a media clase. En pantalla táctil arranca arriba; con ratón, abajo.

De lado se dibuja de pie. Para no tener dos versiones del mismo dibujo, todo se
traza en coordenadas «a lo largo» (el tiempo de la clase) y «a lo ancho» (el
grosor), y solo al final se decide cuál de las dos es la x.

La disposición es una rejilla, no una columna, porque la cinta cambia de sitio.
Las pistas van con `minmax(0,1fr)` y no `1fr`: el mínimo de una pista `1fr` es
su contenido, y la fila de documento mide unos 2900 px, así que la rejilla se
estiraba a lo ancho de ella y el pizarrón se salía de la pantalla en vez de
dejar que esa fila se desplazara por dentro.

## Escribir y saltar no se parecen

Eran dos triángulos pegados y se confundían. «Escribir hasta el stop» va en
verde con una pluma dejando trazo; «Saltar al stop», en el mismo ámbar que las
marcas de la cinta y con una flecha que llega a un banderín. Van separados y
conservan su nombre aunque el resto de la barra vaya solo con dibujos. Ojo:
`marcarPlay` reescribe el contenido del botón al alternar con la pausa, así
que su icono vive en `SVG_PLAY` y no en el HTML.

## La clave de la sesión

El servidor escucha en `0.0.0.0`, que es lo que permite que el iPad se conecte.
Sin clave eso dejaba el pizarrón abierto a cualquiera en el mismo wifi —el de
una universidad, el de un congreso—: leer los cuadernos, sobrescribirlos,
borrarlos y escribir en la clase mientras se daba, todo sin credencial.

El modelo es **local libre, red con clave**. Desde `127.0.0.1` no se pide: ahí
quien pide es quien arrancó el programa, y además así las pruebas siguen
corriendo sin tocarlas. Todo lo que llega de fuera la necesita.

Se sirven sin clave solo el caparazón de la aplicación y sus adornos —icono,
manifiesto, trabajador de servicio, generador de QR—, que no llevan nada de la
clase dentro. El iPad necesita poder cargarlos para después pedir lo demás con
la clave que trae en el enlace.

La clave viaja **dentro del código QR y del enlace de los alumnos**, así que
enlazar sigue siendo un escaneo. `/info` la entrega solo a peticiones locales:
es la pantalla de proyección quien la mete en el código. A quien pregunta desde
la red no se le dice, aunque ya haya entrado con ella.

Se guarda en `.clave`, junto a los cuadernos, con permisos 600, y **no cambia
entre arranques**: si cambiara, el ícono de la pantalla de inicio del iPad
dejaría de servir cada mañana. `PIZARRON_CLAVE` la fija y `PIZARRON_SIN_CLAVE=1`
la apaga, que es lo que usa el lanzador de pruebas.

Se compara con `secrets.compare_digest`, no con `==`: quien la adivina a ciegas
puede medir cuánto tarda el rechazo.

**El rechazo vacía el cuerpo de la petición antes de responder.** Con conexión
persistente, responder sin leer lo que el cliente ya está enviando deja esos
bytes en el canal y la petición siguiente empieza a leerse a mitad del cuerpo
anterior: se cuelan peticiones que parecen válidas. Costó una prueba que fallaba
un día sí y otro no.

**Lo que la clave no hace:** el tráfico va en claro. Quien pueda ver los
paquetes de esa red puede leer la clase. Para dar clase es suficiente, y es el
mismo modelo de una impresora compartida; no lo es para exponer esto a internet.

## La proyección como ventana compartible

La vista de proyección ya escondía toda la interfaz, pero le faltaba lo que la
hace de verdad compartible en Zoom o Meet: **pantalla completa**, porque sin
ella el público ve las pestañas y la barra de direcciones del navegador. El
botón está abajo a la derecha, junto al de enlazar, y responde también a `F`.

Los dos botones se atenúan a los tres segundos de inactividad, y **siguen
respondiendo mientras están atenuados**. Con `pointer-events:none` quedaban
invisibles y muertos: había que mover el ratón, esperar a que reaparecieran y
entonces pulsar. Así el mismo clic que los despierta también les llega.

El modo existía desde el principio y el usuario no sabía que lo tenía. Eso es
un problema de descubrimiento, no de funcionalidad, y por eso el panel lateral
del control ahora dice en una línea qué abrir y qué compartir.

## Los tres modos

Preparar una clase y darla son dos actividades distintas y necesitan cosas
distintas. Hasta la versión 1 había dos estados: todo a la vista, o modo clase.

| Modo | Qué se ve | Para qué |
|---|---|---|
| **Escribir** (de fábrica) | Pizarrón, barra, y una tira de 18 px que dice por dónde vas | Escribir la clase |
| **Revisar** | Añade la cinta entera y la columna lateral | Marcar stops, reordenar páginas, comprobar el encuadre |
| **Clase** | El dock y nada más | Dar la clase |

Se cambia con la tecla `R`, con «Vista › Revisar», o tocando el asa «Cinta» de
la tira. El modo se recuerda entre sesiones.

Lo que devuelve, medido con emulación táctil, que es lo que dispara la regla de
44 px de tamaño mínimo de toque:

| | Revisar | Escribir |
|---|---|---|
| iPad de 11" | 887×499, 45.7 % | **1128×635, 74 %** |
| iPad de 12.9" | 1090×613, 47.8 % | **1314×739, 69.4 %** |
| portátil | 1236×695, 60.1 % | **1460×821, 83.9 %** |

**Hay que quitar la cinta y la columna a la vez o no quitar ninguna**, y esta
es la parte contraintuitiva. En el iPad de 11 pulgadas el pizarrón está
limitado por el **alto**, así que quitar los 224 px de ancho de la columna no
devuelve un solo píxel; y al quitar la cinta pasa a estar limitado por el
**ancho**, así que tampoco devuelve casi nada. Medido: la columna sola da
+0 %, la cinta sola +4 %, las dos +62 %. En el de 12.9 pulgadas es al revés,
+31 % la columna sola, +0 % la cinta sola, +45 % las dos.

Por eso los menús desplegables, que devolvieron 50 px de alto de barra, no
agrandaron el pizarrón ni un píxel en ninguno de los dos iPad.

Y el reparto es al revés de lo que parece: los 33 controles de la barra cuestan
108 px, los 12 de la cinta cuestan 161, y los dos elementos interactivos de la
columna cuestan 224 de ancho. **El bloque con más controles es el más barato.**
Lo que sobra no son controles, es superficie permanente dedicada a la
reproducción y al estado, que son cosas que no ocurren mientras escribes.

Tres detalles del código:

- Al cambiar de modo hay que rehacer los lienzos y reencuadrar, porque la
  rejilla cambia de tamaño. Sin eso el trazo cae desplazado respecto de donde
  se apoya la pluma. `prueba_modos.mjs` lo comprueba en los dos modos.
- El asa lleva `min-height:0` con `body` delante: la regla táctil de 44 px la
  estiraba hacia arriba, se metía debajo de la barra y la barra se quedaba con
  el toque. Aquí no aplica porque hay otros dos caminos al mismo sitio.
- Los stops se marcan en Revisar, con la tecla `S`, o desde el dock en clase.
  Escribir es para escribir y Revisar para estructurar.

## Toda mutación pasa por `mutar()`

Cada cambio del documento tenía que llamar a mano, y en el orden correcto,
hasta cuatro funciones de contabilidad. `apuntar()` para el historial,
`edicion()` para reenviar por red, `olvidarTinta()` para invalidar la caché y
`touch()` para guardar. Estaban repartidas por unos cincuenta sitios y el
cuarteto literal copiado nueve veces.

Olvidar una no daba error. Daba una clase congelada, o un deshacer que borraba
otra página. Es la causa raíz compartida por cuatro de los defectos de la
auditoría de septiembre.

`mutar(cambio, opciones)` lo hace en el orden bueno y arregla tres cosas de
paso. El historial va antes de tocar nada. La comprobación de «no hay nada que
hacer» va antes de apuntar, porque seis funciones apuntaban primero y
comprobaban después, así que unos toques en vacío empujaban fuera de la pila
pasos de deshacer buenos. Y ya no se llama `olvidarTinta()` detrás de
`edicion()`, que lo hacía por su cuenta, cosa que pasaba en doce sitios.

`alFinal:true` es para el trazo nuevo al final, el único caso en que no hace
falta reenviar la página entera.

## Un solo camino para abrir un cuaderno

Había seis, cada uno con su ritual, y dos consecuencias que se disparaban
siempre. Importar un archivo no olvidaba el historial, así que un «Deshacer»
justo después pegaba el contenido del cuaderno anterior encima del recién
importado. Y ninguno limpiaba las firmas de las miniaturas: al abrir un
cuaderno de tres páginas teniendo abierto otro de tres, la tira solo se
reconstruye si cambia el número de páginas, así que las miniaturas 2 y 3
seguían enseñando el cuaderno viejo hasta visitar cada una.

`abrirCuaderno(nb, pagina)` es ahora el único camino.

## El corte de revelado no entra en el sello de la caché

Esto es lo que hace que revelar la clase sea rápido, y es el cambio de
rendimiento más grande de la versión 2.

En la versión 1 el sello llevaba el corte, así que moverlo tiraba las cuatro
capas y re-rasterizaba la página entera. Medido con cuatrocientos trazos:

| | versión 1 | versión 2 |
|---|---|---|
| Escribiendo, corte al final | 0.05 ms | 0.04 ms |
| Cuadro de «escribir hasta el stop» | 20 ms | **5.5 ms** |
| Sin caché, de referencia | 11.4 ms | 11.4 ms |

Es decir que durante la reproducción la caché **costaba más que no tenerla**,
porque pagaba la contabilidad y re-rasterizaba igual. Y se disparaba en cuatro
sitios: «escribir hasta el stop», arrastrar la cinta, saltar entre stops, y
cada trazo insertado con «Editar aquí».

Ahora hay dos grupos de capas con vidas distintas.

Las de **revelado** guardan `[0, corte)` y crecen por añadido mientras el corte
avance, que es lo que hace la reproducción. Retroceder sí obliga a rehacerlas,
y ocurre mucho menos.

Las de **fantasma** guardan `[corte, n)`. Esas sí hay que rehacerlas cuando el
corte se mueve, porque una capa rasterizada no se puede des-dibujar, y al
empezar la reproducción son la página entera. Pero el fantasma es una vista
previa tenue que **solo ve el profesor**: la proyección se dibuja con
`count = reveal` y sin corte, así que la clase no recibe fantasmas nunca. Por
eso se rehacen como mucho diez veces por segundo.

Entre una puesta al día y la siguiente, la capa de fantasma lleva de más los
elementos que se acaban de revelar. Por eso **el orden de composición pone el
fantasma debajo de lo revelado**: la tinta revelada es opaca y los tapa
exactamente. Antes era al revés. De paso se lee mejor, porque lo ya revelado
deja de quedar por debajo de la previsualización de lo que aún no toca.

Al saltar una puesta al día se pide un repintado a los 110 ms, así que en
cuanto la reproducción para los fantasmas convergen. `prueba_cache.mjs`
comprueba justamente eso, y además compara contra una segunda pestaña que
carga el mismo cuaderno desde cero.

## Cuando se cae el wifi, la conexión no da error

Se queda colgada. El `onerror` no llega nunca, así que hasta la versión 1 el
profesor escribía con el indicador en verde mientras nada salía, y si la que
caía era la proyección, el grupo miraba una pantalla congelada sin que nadie se
enterara.

Hay tres detecciones, porque son tres fallos distintos:

- **El latido** del servidor pasó de comentario de SSE, que el navegador no
  entrega a la aplicación, a mensaje de verdad. Cuarenta segundos sin nada
  quiere decir canal muerto, y entonces el canal se **reemplaza**, no se marca.
  Marcarlo sin reabrirlo fue una regresión que la propia prueba cazó: como la
  conexión colgada nunca da error, el navegador tampoco la reintenta, así que
  al volver la red no se reenviaba nada.
- **Tres empujones fallidos seguidos** avisan. Que lo escrito no salga es tan
  grave como no recibir, y el canal de lectura puede seguir vivo mientras los
  envíos ya no llegan.
- **La proyección caída** la detecta el servidor, que es el único que sabe con
  certeza quién sigue conectado, y avisa por el mensaje `quienes`. El cartel
  sale en el aparato del profesor y **no** en la proyección, que es lo que ve
  el grupo.

De paso: la gente dejaba de aparecer en el panel de «quién está» a los 45
segundos, porque nadie volvía a saludar nunca. Ahora control y proyección
saludan cada cinco.

## Dos claves, no una

Hasta la versión 1 había una sola para todo, y el enlace que se reparte al
grupo la llevaba dentro. El rol vivía **solo en el navegador**: para el
servidor, «alumno» y «control» eran idénticos, y `/empujar` reenviaba cualquier
objeto JSON a todo el mundo.

Comprobado desde la dirección de red, no desde `localhost`, que es donde el
servidor deja pasar sin clave:

```
POST /empujar {"t":"page","page":{"items":[]}}   -> 200
proyección antes:   6 trazos
proyección después: 0 trazos
alumno que llega tarde: 0 trazos
```

Cualquier alumno con las herramientas de desarrollo abiertas podía borrar la
clase, escribir en ella o suplantar a otro, y el servidor guardaba el mensaje
envenenado como último estado, de modo que se lo servía también a quien llegara
después.

Ahora la clave de control vale para todo y la del grupo solo para mirar. La de
control sigue siendo estable porque el ícono de la pantalla de inicio del iPad
la lleva y cambiarla cada arranque obligaría a reemparejar cada mañana.

Y con ella: el filtro que le faltaba al borrado, sin el cual `DELETE
/cuadernos/.clave` borraba el archivo de la clave; tope de 48 MB en el cuerpo
con la cabecera validada, porque un `Content-Length` no numérico daba 500 con
traza y uno negativo hacía leer hasta que el cliente cerrara; y `timeout` de
20 s más tope de 64 conexiones, sin lo cual cualquiera tumbaba el servidor
abriendo sockets mudos, **sin necesidad de clave**, porque el hilo se consume
al aceptar la conexión y antes de comprobar nada.

## El arranque no puede morir a mitad

`boot()` no tenía `try`. Un `index` que no fuera arreglo revienta en `.sort`, y
un cuaderno con un elemento nulo revienta en `fixItem`. Cuando eso pasaba se
llevaba por delante `conectar()`, `fitAll()` y `sync()`: la aplicación abría,
se veía completamente normal, los botones estaban, y el iPad no enlazaba nunca.

Lo importante no es recuperar el cuaderno roto. Es que `conectar()` corra
siempre.

## Trampas conocidas

- **El trabajador de servicio solo debe tocar su propio origen.** Cuando
  interceptaba peticiones al CDN y estas fallaban, devolvía el HTML de la app en
  lugar del JavaScript, y eso quedaba guardado. Falla silenciosa que rompía
  LaTeX y PDF para siempre. Se dispara igual con el wifi cautivo de un hotel.
  Hay además una verificación: si lo descargado empieza con `<`, se descarta.

- **La palma llega como un contacto táctil.** Palma más Pencil eran dos punteros
  y disparaban el gesto de dos dedos. El pellizco solo debe contar punteros de
  tipo `touch`, y nada táctil debe actuar mientras la pluma esté abajo.

- **Safari arrastra el documento** aunque el lienzo tenga `touch-action:none`.
  Requiere `position:fixed` en el cuerpo y `preventDefault` en `touchmove`,
  excepto sobre las barras, que sí se desplazan a lo ancho.

- **Cortar elementos desplaza los índices**, así que los stops se recalculan y
  pueden quedar corridos. Está manejado en `reindexAfterDelete`, pero conviene
  revisar la cinta después de una edición fuerte con el lazo.

- **El lienzo cambia de tamaño sin que la ventana cambie.** La barra gana o
  pierde una fila, se entra o se sale de modo clase, Safari esconde su barra
  de direcciones, cambian los márgenes seguros. Nada de eso dispara `resize`,
  y mientras el mapa de bits conserva la medida vieja el navegador lo estira:
  la pluma escribe desplazada de donde se apoya, y el desfase es justo el que
  midió mal. Se notaba fuera de modo clase y no dentro, porque en modo clase
  el ajuste coincidía por casualidad. Lo cubre un `ResizeObserver` sobre el
  lienzo, más una comprobación en `pointerdown` por si el observador no llega
  a tiempo. No confiar solo en `resize`.

- **El almacenamiento era volátil y nadie lo notó.** La nota original decía
  «nada de `localStorage`: se usa `window.storage` cuando existe y memoria
  volátil como respaldo». El problema es que `window.storage` **no existe en un
  navegador normal**, así que en la práctica siempre se caía a la memoria y
  todo se perdía al recargar: reglas, rótulos, sitio de la cinta, todo volvía
  de fábrica cada vez. Ahora el orden es `window.storage` → `localStorage` →
  memoria. Los cuadernos pasan por ahí también y con un PDF detrás no caben en
  la cuota, pero eso ya está cubierto: si el navegador lanza, se cae a memoria
  y el cuaderno de verdad sigue guardándose en el servidor.

- **Una imagen que aún no ha cargado no se pinta, pero la caché la da por
  pintada.** `loadImg` devuelve `null` mientras decodifica; si la caché se
  sella con ese hueco dentro, el redibujo posterior reaprovecha la capa y el
  elemento no aparece nunca. Por eso `onload` invalida antes de redibujar. Vale
  para fórmulas, imágenes insertadas y fondos.

- **El servidor recuerda el último estado y se lo reenvía a quien se conecte.**
  El control no debe aceptarlo nunca: con el cuaderno recién abierto en blanco,
  bastaba con que entrara la proyección para que una clase vieja se plantara
  encima de la nueva.

## Pruebas

    cd pruebas && npm install && npx playwright install chromium
    ./correr.sh                  # todas
    ./correr.sh prueba_pdf.mjs   # una

**Una prueba que no puede fallar no es una prueba.** Cinco archivos no tenían
ni una sola aserción: imprimían su veredicto en texto y salían con código cero
pasara lo que pasara. `prueba_persistencia.mjs` podía escribir «SE PIERDE EL
TRABAJO» y el corredor decía «todo en verde», y como solo se muestra la última
línea, ese veredicto ni se veía. Era el 12 % del contrato, y justo la parte que
vigila la pregunta más cara. Ahora `correr.sh` falla si una prueba no imprime
línea de resumen, y esa regla cazó dos pruebas nuevas el mismo día en que se
escribió.

**Las bibliotecas de fuera se sirven de disco.** `primeLibs` baja jsPDF,
MathJax y pdf.js de un CDN en cada arranque de página, y como cada archivo abre
un navegador con perfil nuevo, se bajaban cuarenta veces por corrida. Seis
pruebas dependen de que lleguen, y era la causa del fallo intermitente de
`prueba_exportar_fondos.mjs`: sola pasaba, dentro de la suite y con la máquina
cargada, no. `libs.mjs` las guarda en `_bibliotecas/`, que no va al
repositorio, y las siembra en el almacén local antes de abrir la página.

`correr.sh` levanta un servidor de pruebas en el 8778 con carpeta de cuadernos
propia y **lo reinicia entre cada prueba**. Las dos cosas hacen falta: el
servidor recuerda en memoria el último estado que le mandaron y se lo reenvía
a quien se conecte, así que sin reiniciar una prueba hereda lo que escribió la
anterior y falla por algo que no está comprobando. Costó media tarde
descubrirlo, con fallos que aparecían y desaparecían solos.

**Nunca contra el 8777**, que es donde están las clases de verdad. Hubo
veinticuatro pruebas con esa dirección escrita a mano, y dejaron una montonera
de cuadernos de mentira en `~/Documents/Pizarrón`. Ahora la dirección sale de
`BASE`, que apunta al de pruebas si no dices otra cosa.

`hacer_pdf_prueba.py` fabrica el PDF vertical que usan las pruebas de fondo.
Tiene que ser vertical: esas pruebas miran qué pasa al meter una página alta en
un marco apaisado, y con una exportación de la propia app —16:9, encaja
clavada— no comprobaban nada.

`prueba_general.mjs` cubre trazos, resaltador, formas, stops, ida y vuelta,
reproducir y pausar, papel por página, el enlace control-proyección, el QR
reabrible y el guardado. `prueba_pencil.mjs` cubre rechazo de palma y bloqueo
del desplazamiento con toques simulados por CDP.

Ambas dejan capturas en `pruebas/capturas/`. Vale la pena mirarlas: dos defectos
visuales reales (la cinta invisible sobre fondo oscuro, el resaltador a bandas)
solo aparecieron viendo las imágenes, no en las aserciones.

## La barra

Una fila, `#barTools`, con lo que se usa a cada minuto, y **nunca se
desplaza**: cuando llevaba scroll, tomar el marcador empujaba la pluma fuera
de la pantalla y había que ir a buscarla a media clase.

Hubo una segunda fila, `#barDoc`, con los 35 controles de documento. Medía
2314 px de ancho y en un iPad se veían 1158: la otra mitad había que ir a
buscarla rodando la barra con el dedo, justo en el borde donde se apoya la
palma al escribir. Ahora esos 35 viven detrás de cinco menús —Archivo,
Página, Fondo, Insertar, Vista— al final de la fila de herramientas, y la
segunda fila desapareció.

Lo que se ganó, medido a cuatro tamaños:

| pantalla | barra antes | barra ahora | pizarrón antes | pizarrón ahora |
|---|---|---|---|---|
| 1180×820 | 98 px | 88 px | 904×509 | 904×509 |
| 1366×1024 | 98 px | 48 px | 1090×613 | 1090×613 |
| 1512×945 | 98 px | 48 px | 1152×648 | 1236×695 |
| 1920×1080 | 98 px | 48 px | 1392×783 | 1481×833 |

En las dos primeras el pizarrón no crece, y conviene saber por qué: ahí está
limitado por el **ancho**, no por el alto, así que el alto que devuelve la
barra no va a ninguna parte. Lo que lo limita es `#side`, la columna de la
derecha, que se lleva 210 px. Por eso **Vista › Columna** la quita: a 1180×820
el pizarrón pasa de 904×509 a 948×533, **+10 % de área**. No los 210 px
enteros: al quitarla deja de mandar el ancho y pasa a mandar el alto, así que
solo aprovecha 44. Se recuerda entre sesiones.

A 1180 px la fila se parte igual en dos alturas —1358 px de controles no caben
en 1158—, pero ya no hay nada escondido: todo se alcanza de un toque.

Tres detalles del código que no son cosméticos:

- Los menús son **paneles flotantes** como `#opcTrazo` o `#panelFondo` y
  comparten sitio con ellos, así que abrir uno cierra el resto. Sin eso las
  opciones de trazo caen encima del menú y no se puede tocar lo de debajo.
- `.menuDesp` está en `ZONA_INTERFAZ`. Si no, arrastrar sobre el fondo del
  panel no lo desplaza y el toque se cancela a medias.
- El panel lleva `width:max-content`. Colocado en el 50 % un elemento absoluto
  solo dispone de media caja y se partía en cuatro renglones de 302 px, tan
  alto que tapaba el pizarrón entero.

Los `id` de los 35 controles no cambiaron: se movieron los nodos, no se
recrearon, así que cada manejador y cada `getElementById` de otro sitio siguen
encontrando lo suyo.

## Herramientas de clase

- **Mejorar letra**: promedia cada punto con sus vecinos, dos pasadas, al
  levantar la pluma. Quita el temblor de la mano sin perder ningún punto ni
  mover los extremos, que se nota más que el temblor que se quita. Medido
  sobre un trazo tembloroso, la suma de cambios de dirección baja de 49.6 a
  1.5. No se aplica al resaltador ni al borrador, que no son escritura.
- **Lazo con la pluma quieta**: apoyar el Pencil sin moverlo unos 620 ms abre
  el lazo y descarta el punto de apoyo. Moverse más de siete píxeles cancela
  la espera, así que escribir normal no lo dispara nunca.
- **Gis**: salpica granos a lo ancho del trazo con ruido de posición, no
  aleatorio: el mismo punto da siempre el mismo grano, y si fuera aleatorio de
  verdad el gis herviría en cada repintado. Sale más barato que el trazo liso
  —8.4 ms contra 10.4 con ochenta trazos— porque hace un solo `stroke` en vez
  de uno por segmento.
- **Flechas y ajuste de ángulo**: el ajuste solo entra a menos de cinco grados
  de un múltiplo de quince, así que una recta a mano alzada sigue saliendo
  como se traza. La flecha es una polilínea más, sin caso especial: se va
  hasta la punta, se vuelve por una aleta, se regresa y se sale por la otra.
- **Punteado**: un botón aparte, no una herramienta. Vale para la pluma y para
  las formas, que es donde sirve: rectas auxiliares. El trazo punteado se
  dibuja como un solo path continuo, igual que el resaltador; por segmentos el
  patrón se reinicia en cada uno y sale sólido.
- **Grosor**: el deslizador de siempre, ahora con un punto al lado que crece
  para verlo antes de escribir.
- **Borrar lo último**: quita de un golpe todo lo escrito en los últimos cuatro
  segundos. La ventana es fija y corta a propósito. Encadenando por huecos,
  quien escribe sin parar un minuto se borra el minuto entero de un botonazo.
  Cada elemento guarda su hora en `t` para esto.
- **Puntero con estela**: guarda los últimos puntos en `ptr.tr` y cada tramo se
  apaga según su edad. No toca el documento, así que no hay nada que limpiar.
- **Capturar diapositiva**: toma un cuadro de la pantalla con `getDisplayMedia`
  y lo deja como fondo de una página nueva, para escribir encima de lo que
  estés presentando. En macOS el navegador necesita permiso en Ajustes del
  Sistema > Privacidad y seguridad > Grabación de pantalla; sin él la llamada
  falla con `NotReadableError` aunque salga la ventana de elegir pantalla, y la
  app lo dice con todas sus letras en vez de quedarse callada.

## La cinta

Se arrastra, no solo se pica. El flujo pensado es escribir la clase entera y
después recorrerla con el dedo hasta cada punto de corte y marcar el stop ahí.
El arrastre redibuja una vez por cuadro; con el dedo llegan muchos más eventos
que cuadros hay.

## Historial

Pila de estados de la página —items, stops y revelado, sin el fondo, que es
lo único que pesa y no cambia con estas operaciones—, con tope de 40 pasos y
de 15 cuando la página pasa de 800 elementos. `apuntar()` se llama ANTES de
tocar nada, y está cableado en trazo, forma, texto, color, escalado, borrado,
corte, pegado, arrastre del lazo y stops. Antes solo se podía quitar el último
trazo: un borrado con el lazo o un movimiento no tenían vuelta.

## Papeles

Tres: `control`, `proyeccion` y `alumno`. El alumno ve lo mismo que la
proyección pero con su propia cámara, así que puede acercarse a lo que no
alcanza a leer desde su sitio sin mover nada a nadie; no escribe ni empuja.
`SOLO_MIRA` agrupa a los dos que no escriben. La dirección para repartir a la
clase sale en el panel del profesor.

## Pendiente

- El lazo no permite rotar, solo mover y escalar.
- `#barDoc` mide unos 2900 px de contenido en pantallas de 1440: se desplaza
  bien, pero no cabe entero. Si estorba, lo que sobra son los botones de
  archivo, que podrían irse a un menú.
- El reconocimiento de escritura a LaTeX quedó descartado a propósito: en clase,
  adivinar mal es peor que un botón más. Hay editor de texto con LaTeX explícito.

## Qué queda por hacer

Lo que la versión 2 dejó pendiente, con lo que costaría y lo que aporta:

**Dar tres clases con ella antes de llamarla 2.0.** Es la única comprobación
que `correr.sh` no puede hacer, y la más importante. El cambio de modos altera
dónde vive cada control, y el músculo de la mano está entrenado con la
distribución anterior.

**Los arrastres de selección y de fondo no están coalescidos por cuadro.** Cada
`pointermove` invalida la caché entera y repinta las dos vistas, o sea hasta
120 veces por segundo con el Pencil. El camino del resaltador ya resolvió esto
veinte líneas más abajo con `liveDirty` y `requestAnimationFrame`. Además
`refreshSelBar` lee `offsetWidth` entre dos escrituras de posición, que fuerza
recalcular la disposición en cada evento.

**Dos pestañas de control a la vez.** Si el iPad se recarga sin cerrar la Mac,
los dos son control. A recibe de B, la cuenta no cuadra, A pide la página
entera, B la manda, A la descarta por ser control, y vuelve a empezar. Hay que
decidir primero qué debe pasar: que el segundo pase a solo mirar, o que la
aplicación lo nombre.

**El almacén local lleno miente.** `store.set` captura el error de cuota y
devuelve `true` igual, así que la etiqueta de guardado pinta una hora y el
profesor cree que está a salvo cuando solo está en memoria.

**La barra sigue en dos filas en los dos iPad.** Necesita 1679 px con el
tamaño táctil de 44 px y hay 1158 o 1344. Bajarla a una fila devuelve 51 px, o
sea un 4 %, contra el 62 % que devolvió el modo Escribir. Y cuesta quitar
cuatro tintas de acceso directo, los colores de marcador y el control de
grosor. Por eso no se hizo: mal cambio por unidad de riesgo.

**La rotación de la clave.** Es estable a propósito, para que el ícono de la
pantalla de inicio del iPad siga sirviendo. Quien guarde la foto del código QR
de emparejamiento conserva acceso de control. Falta un «cambiar la clave» que
regenere `.clave` sin tener que borrarlo a mano.
