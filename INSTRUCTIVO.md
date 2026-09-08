# Esquisse — instructivo

## Qué es

Esquisse es un pizarrón digital para dar clase de matemáticas. Escribes a mano
en una tableta con lápiz y la computadora proyecta lo que la clase debe ver.

Hasta ahí, como cualquier pizarrón. Lo que lo distingue es **cómo aparece el
material**.

### El problema que resuelve

Un pizarrón físico obliga a escribirlo todo en vivo: se pierde tiempo, la letra
empeora conforme avanza la hora, y una demostración larga se copia mal. Unas
diapositivas resuelven eso pero traen el problema contrario: aparecen enteras,
la clase lee el final antes de que llegues a él, y se acabó el suspenso que
sostiene una demostración.

Esquisse busca el punto medio. **Escribes la clase entera de antemano**, con
calma y buena letra. Después la recorres y marcas los **puntos de corte** donde
toca detenerse a hablar. En el aula vas soltando un tramo cada vez.

Y un tramo puede aparecer de dos maneras: de golpe, o **escribiéndose solo**,
como si lo estuvieras haciendo en ese momento. Lo segundo conserva el ritmo de
una clase en pizarrón —la clase ve construirse el argumento— sin el costo de
escribirlo mal y con prisa.

Para una demostración, la secuencia natural queda así:

    enunciado → construcción → lema → cálculo → conclusión

Cada flecha es un punto de corte. La clase nunca ve el paso siguiente antes de
tiempo.

### Lo demás

Compone **fórmulas en LaTeX de verdad**, no imágenes: se escribe
`\int_0^1 f(x)\,dx` y queda compuesto. Tiene una **lupa** que resuelve el
problema real de escribir a mano en una pantalla, donde la letra sale enorme o
ilegible. Importa **PDF** para anotar sobre notas ya hechas. Y exporta la clase
a PDF **por etapas**, una página por punto de corte, de modo que el material
que repartes tiene la misma estructura con la que se explicó.

El alumnado puede seguir la clase **desde su propio dispositivo** y acercarse a
lo que no alcanza a leer, sin tocar nada de lo tuyo.

Los dos aparatos hablan **directo por la red local**. No pasa por internet, no
hay cuenta que crear, y los alumnos no instalan nada. Funciona igual con el
wifi del salón que con el punto de acceso de un teléfono.

Nació como sustituto de Doceri, retirado en 2022, y se usa desde entonces en un
curso de posgrado en teoría de esquemas.

---

## Qué hace falta

- Una computadora con **Python 3**. En macOS y en casi todo Linux ya viene.
  En Windows se baja de [python.org](https://www.python.org/downloads/).
- Una tableta con lápiz. Pensado para iPad con Apple Pencil, funciona con
  cualquiera que tenga navegador.
- Que los dos estén **en la misma red**. Sirve el wifi de casa, el del salón,
  o el punto de acceso del teléfono: no hace falta que el teléfono tenga
  datos, solo que cree la red.

---

## Arrancar

### macOS

```
bash crear_app_mac.sh
```

Deja un **Esquisse.app** en la carpeta. Arrástralo al Dock. La primera vez
ábrelo con **clic derecho › Abrir**: macOS lo pide porque no está firmado con
cuenta de desarrollador de Apple, y solo la primera vez.

Al abrirlo aparece sola la ventana de proyección con un código QR.

### Windows, Linux, o macOS sin el paquete

```
python3 iniciar.py
```

Arranca el servidor y abre la proyección. `Ctrl-C` para parar.

### Enlazar la tableta

Apunta la cámara al **código QR** de la pantalla y abre el enlace. Ya está.

El código lleva dentro la clave de la sesión, así que no hay nada que teclear.
Si prefieres escribir la dirección a mano, aparece bajo el código junto con la
clave.

**Añádelo a la pantalla de inicio** de la tableta (Compartir › Añadir a
pantalla de inicio) y a partir de ahí se abre como una aplicación, a pantalla
completa.

---

## Cómo se usa

### Los tres papeles

| Papel | Dónde | Qué hace |
|---|---|---|
| **Control** | tu tableta | escribes tú; es el único que manda |
| **Proyección** | la computadora | lo que ve la clase; se comparte en Meet o al cañón |
| **Alumno** | el aparato de cada quien | solo mira, y puede acercarse a lo que no alcanza a leer |

El enlace para los alumnos está en el panel lateral del control, en **Para la
clase**. Cada quien lo abre en su tableta y se acerca a lo que quiera sin
mover nada a nadie.

### Escribir

Pluma, marcador, gis y goma, con su grosor propio cada uno. La paleta trae
negro, blanco, rojo, naranja, verde y azul.

Con la pluma apoyada, **la palma no escribe**. Los dos dedos mueven y acercan.

**Mejorar el trazo** suaviza la letra sin quitarle la mano.

### La lupa

El botón de la lupa abre una banda abajo. **Escribes ahí en grande y el trazo
cae pequeño en el pizarrón**, que no se mueve. Sale unas cinco veces más
grande que escribiendo directo, que con lápiz es la diferencia entre legible e
ilegible.

Al levantar la pluma cerca del borde derecho, la ventana **se corre sola**; al
acabarse el ancho **salta de renglón**. En el pizarrón un recuadro punteado
verde te dice dónde está cayendo lo que escribes.

Los **−** y **+** cambian el alto del renglón: renglón más chico, más aumento.

### Los stops y la cinta de trazos

Un **stop** es un punto de corte de la clase. La **cinta de trazos** de abajo
es toda la clase de izquierda a derecha; se arrastra para recorrerla.

El flujo pensado: **escribes la clase entera antes**, después recorres la cinta
hasta cada punto donde toca hablar y pones el stop ahí.

Al dar la clase hay dos botones distintos, y hacen cosas distintas:

- **Escribir hasta el stop** (verde, con una pluma) — el tramo aparece
  escribiéndose, como si lo estuvieras haciendo en ese momento. Se detiene
  siempre en el siguiente stop, nunca sigue de largo.
- **Saltar al stop** (ámbar, con un banderín) — el tramo aparece de golpe.

La velocidad se ajusta con la barra o con los **−** y **+**.

### Corregir algo ya escrito

Dos caminos.

**Toca el cuadrito** en la cinta de trazos: se selecciona ese elemento y se
abre la barra para borrarlo, cambiarle el color o el tamaño. Arrastrar la
cinta sigue recorriendo la clase, así que no pierdes esa forma de moverte.

O enciende **Editar aquí**: mientras esté puesto, lo que dibujes se cose en el
punto de la cinta donde estés parado en vez de irse al final, y **Borrar
anterior** quita el trazo justo antes. Los stops posteriores se corren solos.
Se nota que está puesto porque el botón se pone morado y la cinta se enmarca.

Todo tiene **deshacer y rehacer**, con historial.

### Fórmulas

La herramienta de texto abre un editor con **LaTeX de verdad**. Se escribe
`\frac{a}{b}`, `\int_0^1`, lo que sea, y queda como fórmula compuesta, no como
imagen borrosa. Salen del color de la pluma activa.

### Fondos y PDF

Papel blanco, crema, pizarrón verde, negro, y tres texturas. Cuadrícula,
renglones o puntos por encima.

Se puede **importar un PDF** y quedarse cada página de fondo, para escribir
sobre notas ya hechas. Y **capturar la pantalla** para anotar encima de lo que
estés presentando.

### Guardar y sacar

Se guarda solo mientras escribes. Los cuadernos están en:

- **macOS con la app**: `~/Documents/Pizarrón`
- **en otro caso**: la carpeta `cuadernos/` junto al programa

Se exporta a **PDF**, entero o por etapas —una página por stop, para repartir
la clase como se fue viendo—, y se puede **grabar en video con tu voz**.

Para sincronizar entre máquinas, cambia esa carpeta por un enlace a una
carpeta de Dropbox o iCloud.

---

## La clave de la sesión

El programa escucha en toda la red local: es lo que permite que la tableta se
conecte. Para que eso no deje el pizarrón abierto a cualquiera que esté en el
mismo wifi, **cada sesión tiene una clave**.

- **Desde la propia computadora no se pide.** Ahí quien pide es quien arrancó
  el programa.
- **Desde cualquier otro aparato sí.** Sin ella no se puede leer, escribir ni
  borrar nada, ni asomarse a la clase.
- **Va dentro del código QR y del enlace de los alumnos**, así que enlazar
  sigue siendo un escaneo y repartir el enlace sigue siendo copiar y pegar.
- Se guarda junto a los cuadernos y **no cambia entre arranques**, para que el
  ícono de la pantalla de inicio de la tableta siga sirviendo cada mañana.

Para cambiarla, borra el archivo `.clave` de la carpeta de cuadernos y vuelve
a arrancar. Para fijar una tú mismo, arranca con `PIZARRON_CLAVE=loquesea`.

**Lo que la clave no hace.** El tráfico va en claro por la red local, sin
cifrar: quien pueda ver los paquetes de esa red puede leer lo que pasa. Para
dar clase es suficiente, y es el mismo modelo de una impresora compartida. No
lo uses para nada que no dirías en voz alta en el salón, y no lo publiques en
una dirección accesible desde internet.

---

## Si algo no va

**La tableta no abre la dirección.** El nombre terminado en `.local` depende de
que la red lo resuelva, y hay redes donde no lo hace: wifi de invitados, redes
con los aparatos aislados, hoteles. Bajo el código QR aparecen también las
direcciones numéricas; prueba con esas.

**Dice que falta la clave.** El enlace se copió sin la parte del final. Vuelve
a leer el código QR.

**El enlace se cae a media clase.** Sale un aviso arriba. Se recupera solo en
cuanto vuelva la red; si no, recarga la tableta y sigue donde estaba.

**La letra sale desplazada de donde apoyas.** Recarga. Pasa si el navegador
cambió el tamaño de la ventana sin avisar.

**No aparece la lista de cuadernos.** En macOS, la aplicación necesita permiso
para leer tu carpeta de Documentos: Ajustes del Sistema › Privacidad y
seguridad › Archivos y carpetas.

---

## Documentación para quien toque el código

- `README.md` — instalación y puesta en marcha.
- `CONTEXTO.md` — cómo está hecho y por qué. Las decisiones de diseño, las
  trampas conocidas y las razones detrás de cada una. Leer antes de tocar nada.
- `REVISION.md` — la revisión sistemática de fallos, qué se arregló y qué falta.
- `pruebas/` — batería con Playwright. `cd pruebas && ./correr.sh`.
