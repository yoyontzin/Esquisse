# Esquisse 2.0 — plan de revisión

Plan de trabajo para la siguiente versión, pensado para ejecutarse dentro de
JetBrains con Codex o Junie. Cubre funcionalidad y apariencia.

Parte de un hecho que conviene tener presente antes de abrir nada: **Esquisse
1.0 ya está publicado, probado y citable**. DOI `10.5281/zenodo.22654651`, 34
archivos de prueba en verde, manual, licencia y paquete de distribución. Esto no
es un rescate, es una mejora sobre algo que funciona y se usa cada semana.

De ahí sale la regla que ordena todo lo demás:

> Ninguna mejora de apariencia o de arquitectura debe romper una clase.

---

## 0. Lo que NO se toca sin decidirlo antes

**Esquisse es deliberadamente un solo archivo HTML.** Hoy son 4375 líneas: 218
KB de código y 270 KB de texturas embebidas. La razón está escrita en
`CONTEXTO.md`, y es que el despliegue consiste en copiar dos archivos y que
funcione en cualquier máquina con Python, sin instalar nada y sin paso de
compilación.

Un agente que no sepa esto va a proponer partirlo en módulos en los primeros
cinco minutos. Es la sugerencia más obvia y la más cara: partirlo obliga a un
empaquetador, y el empaquetador rompe «copiar dos archivos y ya».

Hay una separación intermedia que sí vale la pena estudiar, y es sacar las tres
texturas a archivos aparte que el servidor sirva. Son el 55% del peso y no son
código. Eso solo tiene sentido si se acepta que el HTML ya no viaja solo, lo
cual es una decisión distinta de la de modularizar.

**Antes de escribir un `AGENTS.md`, copiar ahí esta sección entera.**

---

## 1. Fase 0, preparar el terreno

Lo que el plan maestro llama primer día, con lo que ya está hecho descontado.

| Paso | Estado |
|---|---|
| Proyecto local, backup, Git, commit de versión funcional | hecho |
| Pruebas de regresión que congelan el comportamiento | hecho, 34 archivos |
| Documentación de arquitectura y decisiones | hecho, `CONTEXTO.md` |
| `AGENTS.md` | **falta** |
| Mapa de arquitectura pedido al agente | **falta** |

Solo quedan dos cosas, y la primera condiciona a la segunda.

### 1.1 Escribir `AGENTS.md`

Sale casi entero de `CONTEXTO.md`. Lo que tiene que decir, además de la
sección 0 de este documento:

- Las cuatro decisiones de diseño que sostienen todo (marco acotado 16:9, el
  documento como lista ordenada, dos cámaras independientes, ranura de pigmento
  en vez de color literal). Están en `CONTEXTO.md` y **ninguna es negociable**
  sin discutirlo.
- Que `pruebas/correr.sh` es la única forma correcta de correr las pruebas, y
  que **nunca** se corren contra el puerto 8777, que es donde están las clases.
- Que la caché de tinta es la fuente de la mitad de los errores históricos, y
  que cualquier mutación del documento tiene que invalidarla.
- Que el rechazo de palma y la presión del Pencil son comportamiento medido, no
  adivinado, y que romperlos no se nota en pruebas con ratón.

### 1.2 Pedir el mapa, sin tocar archivos

La instrucción literal está en el plan maestro. Añadir una condición: **que el
informe diga, para cada bloque, contra qué archivo de prueba está cubierto**.
Un mapa que no distingue lo probado de lo no probado sirve de poco para decidir
qué se puede refactorizar sin miedo.

---

## 1.3 Lo que encontró la auditoría experta (2026-09-08)

Dos auditorías en paralelo, una de código y otra de presupuesto de píxeles.
Encontraron cosas que ninguna de las 34 pruebas veía. **Lo crítico ya está
arreglado y probado**, con `prueba_robustez.mjs` de regresión. Lo que sigue
pendiente está abajo, mezclado con el resto por prioridad.

### Arreglado en el acto

| | Qué era | Por qué urgía |
|---|---|---|
| **G5** | `GET /cuadernos/.clave` entregaba la clave de sesión en claro a cualquiera con el enlace del día. Como la clave no rota, eso daba acceso permanente a todas las clases siguientes. | Agujero en lo que se acababa de publicar con DOI. |
| **A2** | Tocar un cuadrito de la cinta y después «Borrar anterior» dejaba `sel` fuera de la lista, y el dibujado lanzaba: el pizarrón se quedaba a medio pintar sin recuperarse. Tres toques, con funcionalidad normal. | Regresión de las dos funciones nuevas de septiembre. |
| **A3** | Un hueco en la lista ya no apagaba el pizarrón del profesor, pero mataba `sync()` antes de `pushSoon()`: **la clase se congelaba sin que nadie se enterara**. Ahora se empuja primero y el dibujado va protegido. | La peor forma de fallar: sin síntoma del lado que mira. |
| **A1** | Añadir o borrar una página corre los índices, y el historial guarda el índice. Deshacer después aterrizaba sobre otra página y le borraba el contenido. Reproducido. | Destruye trabajo en silencio. |
| **G2** | `POST /empujar` con JSON válido que no fuera objeto daba 500 con traza. | |
| **I1, I2, I3** | **Los arreglos de 44 px de septiembre estaban muertos.** `button.mini{min-width:26px}` e `input[type=color]{32x30}` ganaban por ir más abajo en el archivo. Los ± de grosor medían 29 px de ancho, no 44. | Regresión invisible de un arreglo que se daba por hecho. |
| **S2** | Abrir el panel de fondo no cerraba el de trazo, y las opciones de trazo caían enteras encima de las miniaturas de papel. La exclusión era de un solo sentido. | Regresión de septiembre. |
| **S5** | El toast caía dentro del rectángulo del dock y tapaba su extremo derecho. Ahora va arriba. | |
| **P3** | El dock flotaba a 14 px del borde y mordía 26 px de marco. | |

### Pendiente y grave, del código

**A4. Tres rutas de guardado, y la recomendación de la auditoría era medio
equivocada.** Es cierto que `guardarEnServidor` escribe 404 bytes por referencia
y las rutas de archivo escriben 1550 con el fondo dentro. Pero **un archivo que
se va a Dropbox o a Archivos tiene que bastarse solo**: si se le quitan los
fondos no hay servidor del que traerlos y el archivo queda inservible. Las dos
formas son correctas para su destino. Lo que sí era un fallo, y está arreglado,
es que `exportFile` duplicaba el cuerpo de `nbJSON` y nombraba el archivo sin el
identificador, así que dos exportaciones seguidas se pisaban en Descargas.

Queda como asunto abierto, sin arreglar: `persist()` llama a `writeToFolder` en
cada autoguardado, y con un PDF detrás eso son megas cada pocos segundos. La
salida no es quitar los fondos sino escribir la copia de carpeta con menos
frecuencia que el guardado normal.

**A5. Importar un cuaderno del servidor perdía todos los fondos. Arreglado.**
`openLib` llamaba a `traerFondos` y el manejador de `#fileIn` no. Copiabas el
JSON al iPad, lo importabas, y salían los trazos flotando sobre blanco sin que
nada lo dijera.

**B1. El trazo en vivo no se recortaba al marco. ARREGLADO.** Se veía sobre la
pared y desaparecía al levantar la pluma, pero quedaba guardado e invisible,
ocupando un cuadrito de la cinta y corriendo los stops. Los tres caminos de
dibujo en vivo pasan ahora por `conRecorte`, que respeta la transformación con
la que llega cada uno. Cubierto por `prueba_recorte.mjs`.

**B3. Importar un PDF rasterizaba cada miniatura veintiuna veces. ARREGLADO.**
Cada imagen que cargaba repintaba todas las páginas sin firmar, así que el
trabajo era triangular: 860 rasterizados con 40 páginas. Ahora la clave que
carga identifica su página y solo se refresca esa.

**B2. Arrastrar el color de fondo tiraba toda la caché de imágenes. ARREGLADO.**
Veinte arrastres del selector eran veinte repintados completos de 45 ms, y el
fondo de PDF parpadeaba. `imgCache.clear()` no hacía falta: la clave de las
fórmulas ya lleva el color dentro.

**G1. Subir un fondo que el servidor ya tiene responde sin vaciar el cuerpo**, y
con conexión persistente el guardado siguiente se lee corrompido y **no se
guarda**. Misma familia que 6.2, viva en un camino de éxito.

**G3, G4. El servidor no tiene tiempo de espera ni tope de hilos**, y no valida
`Content-Length`. Un iPad que se duerme a media subida deja hilos muertos.
Antes del próximo congreso.

### Pendiente, de espacio

Ver la sección 3, reescrita con las mediciones.

---

## 2. Funcionalidad, la deuda ya diagnosticada

No hace falta auditar de nuevo. Estas trece cosas están verificadas, con la
causa localizada, y esperando. Ordenadas por lo que más cuesta en clase.

### Arruinan un entregable

**F1. Exportar a PDF salía sin los fondos. ARREGLADO 2026-09-08.**
El bucle era síncrono y no esperaba a que las imágenes decodificaran, así que
con un cuaderno abierto desde el servidor fallaba siempre, no a veces.
`preparaImagenes()` fuerza la decodificación con `img.decode()` y espera antes
de entrar al bucle. Cubierto por `prueba_exportar_fondos.mjs`.

**F2. Dos cuadernos con el mismo nombre se pisan.** (`SUGERENCIAS.md` 1.3)
Se guarda por nombre, y el nombre de fábrica es el mismo para todos. Dos clases
sin renombrar y una se lleva a la otra por delante.
*Arreglo:* guardar por identificador y llevar el nombre dentro del archivo.

### Molestan cada semana

**F3. Las miniaturas mienten.** (`REVISION.md` 1.5 y 1.6)
Su firma solo cuenta elementos, así que no se enteran de un cambio de color,
posición, tamaño o giro. Y al arrancar se sellan en blanco antes de que las
imágenes decodifiquen, con el rescate saltándoselas justo por estar selladas.
Con un PDF importado, que es el flujo de un curso con notas previas, la tira de
páginas es inútil hasta que edites cada una.

**F4. Borrar página y borrar cuaderno usan `confirm()`.** (`SUGERENCIAS.md` 1.2)
En una PWA de iPad el diálogo nativo aparece descolocado o se lo come el
sistema. Si no aparece, la respuesta por omisión es «no», y no hay forma de
saber por qué no pasó nada. Además es irreversible.
*Arreglo:* diálogo propio, y que lo borrado entre al historial de deshacer.

**F5. No se pueden reordenar las páginas.** (`SUGERENCIAS.md` 2.2)
Con PDF importado y páginas intercaladas, el orden queda como salió.

**F6. El rechazo de palma se enciende solo y su interruptor no existe en modo
clase.** (`REVISION.md` 2.12)
Un alumno no puede escribir con el dedo sin que asomes la barra.

### Trampas preparadas

**F7. El sello de la caché identifica la página actual, no la que se pinta.**
(`REVISION.md` 1.8)
Hoy no muerde porque los dos únicos casos invalidan antes. El día que alguien
añada un tercero, el bug es de los que no dan error y no aparecen en pruebas.
*Arreglo:* meter la identidad de la página en el sello. Es una línea.

**F8. La cola del servidor descarta clientes lentos.** (`SUGERENCIAS.md` 3.3)
Con una proyección en una máquina lenta y una ráfaga de escritura, la proyección
se cae sola y hay que recargarla a media clase.
*Arreglo:* al llenarse la cola, vaciarla y mandar página completa. El mecanismo
de `pide` ya existe.

**F9. Tope de 60 páginas al importar PDF, avisado con un toast de dos
segundos.** (`SUGERENCIAS.md` 3.1)
Con un libro de 300 páginas te quedas con 60 sin enterarte bien.

**F10. Los editores de fórmula y de PDF no se cierran tocando fuera.**
(`REVISION.md` 2.13)
No bloquean, pero rompen la costumbre que sí cumple la biblioteca.

### Valen más de lo que cuestan

**F11. Exportar las fórmulas como texto.** (`SUGERENCIAS.md` 4.2)
El PDF exporta imágenes, pero las fórmulas guardan su fuente LaTeX en `it.src`.
Se podría exportar además un `.tex` o un `.md` con las fórmulas reales. Para
repartir apuntes vale mucho más que un PNG.

**F12. Grabar la clase existe y está escondido.** (`SUGERENCIAS.md` 4.3)
`toggleRec` graba el lienzo **con audio del micrófono**. Es la función estrella
de Doceri y aquí es un botón más en la segunda fila. Ni avisa de cuánto lleva
grabando ni de que va con voz.
*Arreglo:* indicador visible mientras graba, y decir que lleva micrófono.

**F13. Paletas LaTeX por curso.**
Del plan maestro. `\operatorname{Spec}`, `\mathcal O_X`, `\hookrightarrow`,
`\longrightarrow`, y una paleta distinta por curso. Es lo que convierte el
editor de fórmulas en algo que se usa a mitad de clase y no solo al preparar.

---

## 3. Apariencia

El problema no es que sea feo. Es que **hay demasiado a la vista a la vez**, y
que algunas cosas estorban justo cuando se está dando clase.

### El presupuesto, medido

En el iPad apaisado, que es donde da clase:

| | px | % de 820 |
|---|---:|---:|
| Barra de herramientas (dos filas, siempre envuelve) | 165 | 20.1% |
| Cinta y sus controles | 161 | 19.6% |
| **Interfaz** | **326** | **39.8%** |
| Franja negra y panel lateral | | 24.3% |
| **Marco donde se escribe** | **786×442** | **35.9%** |

**Los iconos no son grandes, son demasiados.** Los SVG miden 19 px en todas
partes y los botones 44, que es el mínimo táctil. Lo que sí es enorme son **los
once círculos de color**: son `<button>`, así que `min-width:44px` anula la
regla de 23 px y se pintan a 44. Son 520 px, el **45% del ancho de la fila**,
antes de que aparezca una sola herramienta.

Dos límites que ordenan las propuestas. **En vertical no hay nada que ganar**:
el marco lo limita el ancho y sobran 316 px de holgura, así que ahí las barras
salen gratis. Y en apaisado, **con el panel lateral puesto el marco topa en
904×508**, o sea que recuperar más de 66 px de alto no sirve de nada mientras
el panel siga ahí.

### Qué recuperar, con lo que devuelve cada cosa

| | Propuesta | Devuelve | Marco resultante |
|---|---|---:|---|
| **P1** | Fila de herramientas a una sola línea: los 3 colores de marcador a las opciones de trazo (que ya se abren al elegir Marcador), y el puntero y el fondo fuera, que ya están en otro sitio | −51 px | 877×493, **+25% de área** |
| **P2** | Quitar la cabecera de la cinta. Sus 44 px vienen enteros de «Mover cinta», que cabe entre los controles | −50 px | 904×508, el tope con panel |
| **P5** | Ocultar el panel lateral en pantalla táctil. Vista previa, páginas y quién está son herramientas de preparación, no de clase | destapa el techo | con P1+P2: **965×543, +51%** |
| **P6 HECHO** | La fila de documento a menús desplegables. Eran 35 controles en 2314 px de los que nunca se veía la mitad, y ninguno se usa a media frase | −50 px | ver abajo |
| **P4** | La barra de la lupa dentro de la banda, no como franja de ancho completo para 6 botones | −55 de la banda | tira de 143 a 198, **+38%** |

Con P1, P2, P5 y P6 las barras bajan de 326 a 173 px y **el marco pasa del 36%
al 65% de la pantalla**. En la práctica, lo que escribes se ve un 35% más
grande, que es lo que de verdad importa con lápiz.

Tu intuición del desplegable era la correcta, y P6 es donde más rinde: es el
único sitio donde dos toques no cuestan nada.

### P6, hecho, y lo que enseñó al medirlo

Los 35 controles viven detrás de cinco menús —Archivo, Página, Fondo,
Insertar, Vista— al final de la fila de herramientas, y la segunda fila
desapareció. La barra baja de 98 a 48 px. Medido a cuatro tamaños:

| pantalla | barra | pizarrón antes | pizarrón ahora |
|---|---|---|---|
| 1180×820 | 98 → 88 px | 904×509 | 904×509 |
| 1366×1024 | 98 → 48 px | 1090×613 | 1090×613 |
| 1512×945 | 98 → 48 px | 1152×648 | **1236×695, +15%** |
| 1920×1080 | 98 → 48 px | 1392×783 | **1481×833, +13%** |

**El plan se equivocaba en una cosa y conviene apuntarlo.** Prometía +71% de
marco, y en las dos pantallas donde más importa el marco no creció ni un
píxel. La razón es que ahí el pizarrón está limitado por el **ancho**, no por
el alto: el alto que devuelve la barra no va a ninguna parte. El presupuesto
de píxeles del plan contaba solo alturas.

Lo que sí lo limita es `#side`, la columna de la derecha, 210 px de ancho.
Por eso **Vista › Columna** la quita: a 1180 px el marco pasa de 904×509 a
948×533, **+10 % de área**. Es P5 del plan, hecho como interruptor en vez de
como media query, para que el profesor decida.

Y aquí el presupuesto de píxeles falla por segunda vez, en la dirección
contraria. Yo mismo estimé +52 % sumando los 210 px que devuelve la columna.
Medidos dan +10 %: al quitarla el marco deja de estar limitado por el ancho y
pasa a estarlo por el alto, así que de los 210 solo aprovecha 44. **Ninguna de
las dos cuentas sobrevivió a medirla.** Las propuestas que quedan —P1, P2,
P4— llevan cifras hechas con la misma aritmética de sumar alturas, y hay que
volver a medirlas antes de creerlas.

A 1180 px la fila sigue partiéndose en dos alturas: 1358 px de controles no
caben en 1158, y no hay nada más que quitar sin tocar algo que se usa a media
frase. Lo que cambia es que ya no hay nada escondido detrás de un scroll.

**S6 arreglado de paso.** El botón de la lupa salió de la fila de documento y
está ahora junto a las herramientas, así que en modo clase se alcanza asomando
la barra. Y el rechazo de palma tiene botón propio en el dock (`#dPencil`),
sincronizado con el de Vista.

### Solapamientos que quedan por arreglar

**S7. El dock se recortaba a sí mismo. ARREGLADO.** Medía 1695 px y solo se
veían 1158, con `dNext` («Siguiente stop») fuera de la pantalla: el botón que
conduce la clase entera. Ahora los doce botones de palabra llevan los mismos
iconos que la barra, y el dock **envuelve a una segunda fila en vez de esconder**
lo que no cabe. Medido en los tres tamaños: nada queda fuera de vista, y no
desaparece ningún botón.

**S6. El dock tapaba la banda de la lupa** en modo clase. Medido de nuevo con
los tres modos ya repartidos: **113 de 200 px** en las dos pantallas, o sea más
de la mitad de donde se está escribiendo. **ARREGLADO**: la banda se sube por
encima del dock y el lienzo se encoge otro tanto. Se sube la banda y no se mueve
el dock, porque el dock vive abajo por una razón, que es donde llega el pulgar.
El alto se mide en vivo, que es lo único que funciona: el dock envuelve a dos
filas según el ancho.

**S1. El aviso de «sin enlace» tapaba controles** de la fila de herramientas.
Medido hoy: **siete** —la pluma, el resaltador, el grosor y tres marcadores en
el iPad de 11 pulgadas; la goma y las formas en el de 12.9—. Deja pasar el
toque, pero a ciegas: no se ve qué herramienta ni qué color está puesto, y
aparece justo cuando algo va mal. **ARREGLADO**: baja hasta debajo de la barra,
midiéndola en vivo. Ni arriba del todo ni abajo, que es donde estaba antes y de
donde se subió por caer dentro del dock.

**S3. La barra de selección debajo del dock. Ya no se reproduce.** Medido con
una selección en el borde de abajo de la hoja, en los tres modos y en las dos
pantallas: cero píxeles de solape y ningún botón tapado. Lo arregló el reparto
en tres modos sin que nadie fuera a por ello. Queda comprobado en
`prueba_solapes.mjs` para que no vuelva.

**S4. «Pegar aquí» caía dentro del dock. ARREGLADO.** Eran más de 10 px: la
barra vive a 76 px del borde de abajo y el dock mide 113 cuando envuelve, así
que la barra entera quedaba dentro. Importa más de lo que parece porque es el
único camino de vuelta tras cortar algo en modo clase, donde la fila con
«Pegar» no existe. Ahora se sube con la misma medida en vivo que la lupa.

### A1. Los tres modos

La idea del plan maestro, y es la correcta:

| Modo | Qué lleva |
|---|---|
| **Escritura** | pluma, marcador, gis, goma, formas, LaTeX, lazo, lupa |
| **Clase** | puntero, stop anterior, siguiente, página, proyección, deshacer, colores |
| **Documento** | páginas, cuadernos, importar, exportar, PDF, imágenes, fondos |

Dos advertencias, ganadas a base de romperlo:

- **Nada de lo que ya está en el dock de modo clase puede desaparecer.** Ese
  dock se ganó cada botón por una razón concreta: el de stop se añadió porque
  con Pencil no hay teclado, la goma porque no había con qué borrar.
- **Cambiar de modo no puede cambiar dónde aterriza un trazo.** Ese fue el
  problema de «Editar aquí» y por eso lleva aviso morado y borde de color.

Prototipar antes de implementar. La barra de documento mide unos 2900 px y no
cabe en 1440, así que el reparto en tres modos también resuelve eso.

### A2. El ícono. ARREGLADO

Sangraba hasta los bordes y se veía más grande que sus vecinos en el Dock, con
las esquinas en pico. Ahora el de macOS lleva las proporciones de la retícula de
Apple: en 1024 px el dibujo ocupa 824 y quedan 100 de margen a cada lado, con la
esquina como curva continua y no como arco de círculo, que es lo que hace que no
se note el punto donde el lado recto se vuelve curva.

El del navegador **no cambia y no debe cambiar**: el manifiesto lo declara
`maskable`, y un ícono enmascarable tiene que sangrar porque ahí recorta el
sistema operativo. Son dos formatos para dos sitios, así que el dibujo se sacó a
`_color_icono()` y cada formato lo enmarca a su manera.

### A3. Lo que ya se arregló y conviene no deshacer

La revisión de septiembre dejó resuelto casi todo lo visual que estorbaba de
verdad. Está en `REVISION.md`, familias 2 y 3. Lo importante para no reintroducirlo:

- Los destinos táctiles van a **44 px** en pantalla táctil. Con Pencil no ves el
  punto de contacto bajo la punta.
- El filtro que impide que Safari arrastre el documento pregunta por `button` y
  por los controles genéricos, **no por paneles nombrados uno a uno**. Añadir una
  barra nueva a la lista de nombres es el error que rompió cortar y pegar.
- Los paneles flotantes comparten sitio: abrir uno cierra el de al lado.
- Escribir y saltar al stop son **verde con pluma** y **ámbar con banderín**,
  separados y con su nombre visible. Eran dos triángulos iguales y se confundían.

---

## 4. Arquitectura, la decisión honesta

El plan maestro propone una estructura en `src/canvas`, `src/tools`,
`src/documents`, etc. Es la estructura correcta **si** se acepta el costo de la
sección 0.

Propuesta intermedia, para decidir con datos en vez de por principio:

1. Pedirle al agente el mapa de bloques (§1.2) y ver **cuánto se solapan de
   verdad**. Un archivo de 4375 líneas con fronteras internas limpias es más
   manejable que seis archivos mal cortados.
2. Sacar las texturas a archivos servidos. Baja el HTML de 488 a 218 KB sin
   tocar una línea de lógica y sin necesitar empaquetador, porque el servidor
   ya sirve archivos.
3. Solo entonces decidir si partir el código.

El orden importa: el paso 2 se puede deshacer, el 3 no tanto.

---

## 5. Orden de trabajo

1. `AGENTS.md`, con la sección 0 dentro.
2. Mapa de arquitectura, sin tocar archivos, con cobertura de pruebas por bloque.
3. **F1** (PDF sin fondos) y **F2** (cuadernos que se pisan). Son las dos que
   destruyen trabajo.
4. **F7** (el sello). Una línea, y cierra una trampa.
5. Prototipo de los tres modos, en papel o en HTML aparte, sin tocar la app.
6. **F3** a **F6**, en ese orden.
7. Implementar los tres modos, si el prototipo convence.
8. **F11** a **F13**, que es lo que añade en vez de reparar.
9. Decidir la arquitectura con el mapa del paso 2 en la mano.

Cada paso, con la disciplina del plan maestro: tarea pequeña, `./correr.sh` en
verde, revisar el diff a mano, commit. Nunca aceptar de golpe una modificación
grande hecha por un agente.

---

## 6. Cuándo está terminada la 2.0

- Los trece puntos de funcionalidad, cerrados o descartados **por escrito**.
- Los tres modos, en uso durante un curso completo sin echar de menos nada.
- `correr.sh` en verde, con pruebas nuevas para todo lo que se arregle.
- `CONTEXTO.md` al día, incluida la decisión de arquitectura y su razón.
- Versión nueva en Zenodo bajo el mismo DOI de concepto.

Y una condición que no se negocia: **haber dado al menos tres clases con ella
antes de llamarla 2.0**. Los errores que importan salieron todos dando clase, no
leyendo el código.
