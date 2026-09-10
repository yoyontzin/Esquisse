# Revisión de la aplicación

Lectura completa del código, comparada con Doceri y con lo que hacen hoy
GoodNotes, Notability y Explain Everything. Ordenado por lo que más pesa en
clase, no por dificultad.

Estado al revisar: 2743 líneas de HTML (de las que unas 270 KB son las tres
texturas embebidas), 607 de servidor, 13 archivos de prueba.

---

## Lo que ya está por encima de Doceri

Conviene decirlo antes de la lista de carencias, porque condiciona qué vale
la pena copiar y qué no.

- **Fórmulas LaTeX de verdad.** Doceri nunca las tuvo. Para un curso de
  esquemas esto no es un extra, es la razón de usar esto y no papel.
- **Dos cámaras.** Acercarte sin mover lo que ve la clase no lo hace Doceri
  ni lo hace Explain Everything.
- **Cero instalación en el aparato del alumno.** Se comparte una ventana del
  navegador. Doceri exigía su app y su cuenta.
- **El documento es una lista ordenada**, así que el revelado por pasos, el
  PDF por etapas y el lazo salen del mismo mecanismo. Es mejor arquitectura
  que la de capas de Explain Everything.
- **Funciona sin internet** una vez cacheadas las bibliotecas.

---

## 1. Riesgo de perder trabajo

### 1.1 Deshacer no tiene historial · ~~lo más urgente~~ **HECHO**

`quitarUltimos()` hace `items.length -= n`. No hay pila. Consecuencias:

- Un borrado con lazo **no se puede recuperar**. Ni un movimiento, ni un
  cambio de color, ni un «Borrar lo último» que se llevó de más.
- No hay rehacer.

Cualquier app de notas de los últimos quince años tiene deshacer/rehacer con
historial. Es lo primero que un profesor va a echar de menos el día que borre
algo por error delante del grupo.

**Propuesta.** Pila de estados de la página (no del cuaderno) con un tope de
unos 40 pasos, guardando solo `items` y `stops`. Con el JSON de una página
ronda las decenas de KB por paso; con tope de 40 son unos pocos MB en el peor
caso. Botones Deshacer y Rehacer, y `Cmd/Ctrl+Shift+Z`.

### 1.2 Borrar página y borrar cuaderno usan `confirm()`

Dos sitios (`pizarron.html:1791` y `1952`). En una PWA de iPad el diálogo
nativo aparece descolocado o se lo come el sistema, y si no aparece, la
respuesta por omisión es «no», pero el usuario no sabe por qué no pasó nada.
Además es irreversible: borrar una página con 200 elementos no tiene vuelta.

**Propuesta.** Diálogo propio, del mismo estilo que el de exportar PDF, y que
lo borrado se pueda deshacer con 1.1.

### 1.3 Un solo cuaderno se guarda en el servidor

`guardarEnServidor()` escribe con el nombre del cuaderno. Dos cuadernos con el
mismo nombre —«Cuaderno sin título» es el nombre por omisión— se pisan.

**Propuesta.** Guardar por identificador y llevar el nombre dentro del
archivo, o negarse a guardar si el nombre ya existe con otro id.

---

## 2. Lo que Doceri hacía y aquí falta

### 2.1 Miniaturas de página · **HECHO**

Hoy `#pageStrip` son chips numerados. Con 18 páginas de un PDF importado,
saber cuál es la del diagrama es imposible sin ir una por una. Doceri tenía
miniaturas, y GoodNotes tiene además una vista de cuadrícula de todas.

**Propuesta.** Miniatura de 96×54 por página, rasterizada una vez y
recacheada solo cuando esa página cambie. Encaja bien con la caché de tinta
que ya existe.

### 2.2 Reordenar páginas · **HECHO**

Se hace con los botones de la cinta, en modo Revisar: `moverPagina()` cambia la
página actual por la de al lado. Lo que sigue sin haber es arrastrar una
miniatura a otro sitio, que para mover una página doce lugares es la
diferencia entre un gesto y doce.

### 2.3 Rotar en el lazo · **HECHO**

Ya está anotado como pendiente en CONTEXTO. Mover y escalar sí; rotar no.
Para geometría —rotar una figura auxiliar— se echa en falta.

### 2.4 Regla y figuras asistidas · **HECHO en parte** (ajuste de ángulo)

Doceri tenía regla. Para trazar ejes, tangentes o diagramas conmutativos a
mano alzada en una pantalla, una regla que fije el ángulo (o que ajuste a
0/30/45/90 grados al arrastrar una recta) cambia mucho el resultado.

**Propuesta barata.** Con la herramienta Recta, si mantienes el trazo quieto
medio segundo antes de soltar, que ajuste al ángulo notable más cercano.

### 2.5 Flechas · **HECHO**

Para diagramas conmutativos hacen falta flechas, y hoy hay que dibujarlas a
mano cada vez. Es la figura que más se usa en un curso de esquemas.

---

## 3. Rendimiento y escala

### 3.1 Tope de 60 páginas al importar PDF, silencioso a medias

`pizarron.html:2123` corta en 60 páginas. Avisa con un toast, pero un toast
dura dos segundos y medio. Con un libro de 300 páginas el profesor se queda
con las 60 primeras sin enterarse bien.

### 3.2 Cuadernos con PDF pesan megas · **HECHO**

18 páginas de un artículo son unos 2.7 MB de JPEG dentro del JSON. Ya se
espació el guardado, pero sigue serializándose el cuaderno entero. Con 60
páginas serían ~9 MB por guardado.

**Propuesta.** Guardar los fondos como archivos aparte en el servidor y
referenciarlos por identificador, igual que ya se hace al mandarlos por red
(`stripAssets`). El JSON del cuaderno bajaría a decenas de KB.

### 3.3 La cola del servidor descarta clientes lentos

`pizarron_servidor.py:496` usa `Queue(maxsize=800)`, y al llenarse se
descarta al cliente. Con una proyección en una máquina lenta y una ráfaga de
escritura, la proyección se cae sola y hay que recargarla.

**Propuesta.** Al llenarse la cola, vaciarla y mandar una página completa en
vez de desconectar. El mecanismo de `pide` ya existe.

---

## 4. Aula y alumnos

### 4.1 Que la clase pueda mirar desde su aparato · **HECHO**

Hoy los alumnos ven lo que se comparte en Meet. El servidor ya sirve
`?rol=proyeccion` a cualquiera de la red: bastaría un rol de solo lectura y
un enlace para que cada quien lo abra en su tableta y se acerque a lo que no
alcanza a ver. Es lo que hace Whiteboard.fi y es la ventaja natural de que
esto ya sea un servidor web.

Fuera del aula no sirve —la dirección es local—, salvo que se monte un túnel,
que ya es otra cosa.

### 4.2 Exportar las notas de la clase con las fórmulas como texto

El PDF exporta imágenes. Las fórmulas LaTeX se guardan con su fuente en
`it.src`, así que se podría exportar además un `.tex` o un `.md` con las
fórmulas reales. Para pasar apuntes a los alumnos vale mucho más que un PNG.

### 4.3 Grabar la clase ya existe, pero está escondido

`toggleRec` graba el lienzo **con audio del micrófono**
(`pizarron.html:1856`). Es la función estrella de Doceri —el screencast— y
aquí está como un botón más en la segunda fila, llamado «Grabar video». Ni
avisa de cuánto lleva grabando ni de que va con voz.

---

## 5. Detalles de interfaz

- **`#barDoc` mide ~2900 px** y no cabe entera en 1440. Los botones de
  archivo podrían irse a un menú «Más».
- **El ícono de la app** sangra hasta los bordes, sin el margen tipo
  *squircle* de macOS. Se ve fuera de lugar en el Dock.
- **Sin indicador de grabación** ni de cuántas páginas tiene el cuaderno en
  modo clase.
- **Los atajos existen pero no se descubren**: hay 18 teclas cableadas y solo
  cinco aparecen en el panel.
- **Nada avisa cuando el enlace con el iPad se cae** salvo la palabra «sin
  enlace» en letra pequeña del panel lateral, que en modo clase está oculto.

---

## Rendimiento: medido, no supuesto

Todo esto se midió antes y después, en esta Mac. En un iPad los números son
varias veces peores, con 16 ms de presupuesto por cuadro.

| Qué | Antes | Después |
|---|---|---|
| Escribir 30 trazos, tráfico de red | 613 KB | **27 KB** |
| Peso del trazo número 20 | 21.5 KB | **915 B** |
| Repintar la página (160 trazos) | 15.6 ms | **0.07 ms** |
| Un cuadro del gesto de dos dedos (206 trazos) | repintaba todo | **0.04 ms** |
| Añadir un trazo de gis con la caché puesta | — | **0.26 ms** |
| Alto de la barra en un iPad | 166 px | **129 px** |

Dos cosas salieron al revés de lo esperado y conviene dejarlas escritas: la
textura del fondo no cuesta nada (0.01 ms, el canvas ya cachea la imagen
decodificada), y el trazo de gis es **más barato** que el liso —8.4 ms contra
10.4 con ochenta trazos— porque da un solo `stroke` en vez de uno por
segmento.

## Bugs encontrados y corregidos por el camino

- El marcador metía un hueco en la lista de elementos si se levantaba la pluma
  antes del cuadro pendiente; el repintado reventaba y el pizarrón se apagaba
  entero, sin poder escribir más.
- El trabajo no se guardaba: `window.storage` no existe en un navegador
  normal, el guardado en servidor estaba apagado y el arranque no lo miraba.
  Ocho trazos, recargar, quedaba uno.
- Al reconectar, el servidor le devolvía al control un estado de otra sesión
  que se llevaba por delante lo recuperado.
- La pluma escribía desplazada porque el lienzo solo se reajustaba con el
  `resize` de la ventana, y también cambia de tamaño al entrar en modo clase.
- Punteros huérfanos de la palma disparaban pellizcos que nadie pidió.
- El pellizco dividía por la separación entre dedos y podía dejar la cámara en
  NaN: pantalla en blanco con los datos intactos.
- Los stops no llegaban nunca a la proyección.
- Las miniaturas de las páginas de PDF salían en blanco por rasterizarse antes
  de que su fondo terminara de decodificarse.
- Una regla CSS vieja mantenía visible la barra de formas siempre, tapando la
  de trazo.

## Ya aplicado

Historial de deshacer y rehacer, miniaturas de página, flechas con ajuste a
ángulos notables, rol de solo lectura para la clase, lápiz de gis, **rotar en el
lazo** y **fondos como archivos aparte**.

Lo que queda de esta lista está recogido, con su causa localizada y ordenado por
impacto, en **[PLAN-2.0.md](PLAN-2.0.md)**: reordenar páginas, la cola del
servidor, el tope de 60 páginas, las confirmaciones nativas, guardar por
identificador, exportar fórmulas como texto y el indicador de grabación.

## Lo que yo haría primero

1. **Deshacer con historial y rehacer** (1.1). Es lo único de esta lista que
   puede arruinar una clase.
2. **Miniaturas de página** (2.1). Es lo que más se nota al trabajar con un
   PDF importado, que es justo el flujo de un curso con notas previas.
3. **Fondos como archivos aparte** (3.2). Quita el techo de escala.
4. **Flechas y ajuste de ángulo** (2.5, 2.4). Baratas y se usan a diario en
   un curso de esquemas.
5. **Rol de solo lectura para los alumnos** (4.1). Es la ventaja que Doceri
   no podía tener, y aquí sale casi gratis.
