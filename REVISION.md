# Revisión detallada — plan y estado

Revisión sistemática de Esquisse tras los fallos que aparecieron dando clase:
la fórmula que no se insertaba, el color que no se aplicaba, y la cinta que la
palma pulsaba sola. Al mirarlos de cerca resultó que no eran tres fallos
sueltos: eran tres familias, y cada una tenía más casos escondidos.

Este documento es el plan y el registro. Lo de arriba está hecho y probado; lo
de abajo, no.

---

## Cómo se revisó

No a ojo. Cada familia se auditó leyendo el archivo entero y contrastando
todos los sitios que comparten el patrón, no solo el que dio la cara.

1. **Reproducir** el fallo con Playwright, midiendo (píxeles del lienzo,
   tiempos, contenido del documento), no mirando.
2. **Encontrar la familia**: qué otro código comparte el mismo patrón.
3. **Arreglar** el patrón, no el síntoma.
4. **Prueba de regresión** que falle sin el arreglo.
5. **Suite completa** antes de dar nada por bueno.

---

## Familia 1 — La caché de tinta da por pintado lo que no se pintó

La causa de la fórmula invisible, y la más peligrosa porque no da ningún error:
simplemente no aparece lo que escribiste.

`renderTo()` guarda lo ya rasterizado y solo pinta lo nuevo. Sella cada pasada
con `{sello, n, m}`. Si algo cambia sin subir `docVer`, el sello sigue valiendo
y el redibujo **reaprovecha una capa obsoleta**: pides que se redibuje, se
redibuja, y no cambia nada.

| # | Qué fallaba | Estado |
|---|---|---|
| 1.1 | **Fórmulas e imágenes recién insertadas no aparecían.** `loadImg` devuelve `null` mientras carga; la caché se sellaba con el hueco dentro y el `onload` redibujaba desde esa capa. Invisible hasta que un acercamiento tumbara la caché por otro motivo. | **Hecho** |
| 1.2 | **Arrastrar una selección con el lazo no movía nada.** Solo se movía el rectángulo punteado; los trazos saltaban de golpe al soltar. | **Hecho** |
| 1.3 | **Una imagen no llegaba nunca a la proyección.** La página viaja vacía y pesa poco, la imagen pesa megas: la página gana la carrera y su hueco queda sellado. Con papel liso no había rescate posible. | **Hecho** |
| 1.4 | **Destello de lo que falta por explicar.** Las dos previsualizaciones en vivo (goma y formas) no pasaban la marca de revelado, así que durante el arrastre todo lo reservado saltaba a tinta plena. | **Hecho** |
| 1.5 | Las miniaturas de página no se enteran de un cambio de color, posición, tamaño o giro: su firma solo mira cuántos elementos hay. | Pendiente |
| 1.6 | Las miniaturas se sellan en blanco al arrancar, antes de que las imágenes decodifiquen, y el rescate las salta justo por estar selladas. | Pendiente |
| 1.7 | **Exportar a PDF sin los fondos.** El bucle es síncrono y no espera a que las imágenes decodifiquen; con fondos servidos por red es determinista, no una carrera. | Pendiente |
| 1.8 | El sello identifica la página actual, no la que se está pintando. Hoy no muerde porque los dos únicos casos invalidan antes, pero es una trampa preparada. | Pendiente |
| 1.9 | **Una clase vieja se plantaba encima de la nueva.** El servidor recuerda el último estado y se lo reenvía a quien se conecte; el control lo aceptaba «si aún no hay nada escrito», que es justo cuando más daño hace: cuaderno recién abierto, entra la proyección, y encima aparece la clase anterior. Ahora el control no acepta páginas de nadie. | **Hecho** |
| 1.10 | **La app se salía de la pantalla.** Al pasar la disposición a rejilla para poder mover la cinta, la fila de documento (unos 2900 px) estiraba toda la app en vez de desplazarse por dentro. En un iPad quedaba inservible. | **Hecho** |

---

## Familia 2 — Controles que no responden al toque

El patrón: un filtro global impide que Safari arrastre el documento mientras
escribes, y corta el gesto en todo lo que no reconozca como interfaz. Lo que
queda fuera de esa lista **no se puede pulsar con el Pencil**: el menor temblor
del pulso cancela el toque. Con ratón funciona, y por eso no salía en pruebas.

| # | Qué fallaba | Estado |
|---|---|---|
| 2.1 | Las barras añadidas después (pegar, trazo, formas, fondo) no estaban en la lista. Cortar y pegar no funcionaban en el iPad. | **Hecho** (antes) |
| 2.2 | **Los botones de la cinta, al ponerla de lado, no se podían desplazar** si el dedo arrancaba en un hueco o sobre un rótulo. Lo reintrodujo la funcionalidad nueva. | **Hecho** |
| 2.3 | El QR de la proyección no se cerraba al tocar, si la proyección la lleva otro iPad. | **Hecho** |
| 2.4 | **El botón «Goma» del modo clase no hacía nada**: existía, se encendía, y nunca se le conectó el manejador. Dando clase no había con qué borrar. | **Hecho** |
| 2.5 | **No había manera táctil de poner un stop en modo clase.** Solo la tecla `S`, y con Pencil no hay teclado a mano. | **Hecho** |
| 2.6 | **El aviso de «sin enlace» mataba los botones del centro del dock.** Se pintaba encima y sin dejar pasar el toque, hasta que reconectara solo. | **Hecho** |
| 2.7 | **La barra de herramientas se quedaba flotando** sobre el lienzo al salir de modo clase desde la barra asomada. La franja de arriba se dibujaba pero no se podía tocar. | **Hecho** |
| 2.8 | **Destinos de menos de 44 px** con Pencil: los ± de grosor y velocidad, las casillas de verificación, los desplegables y el selector de color. | **Hecho** |
| 2.9 | **Los paneles flotantes se tapaban unos a otros** y ninguno cerraba al de al lado. | **Hecho** |
| 2.10 | **La barra de pegar no se iba al pegar**: se quedaba sobre el pizarrón el resto de la clase. | **Hecho** |
| 2.11 | Con los rótulos puestos, tocar la *palabra* de «Solo Pencil» activaba el rechazo de palma sin que se viera encendido. | **Hecho** |
| 2.12 | El rechazo de palma se enciende solo al ver el Pencil, y su interruptor no existe en modo clase: un alumno no puede escribir con el dedo. | Pendiente |
| 2.13 | Los editores de fórmula y de PDF no se cierran tocando fuera. No bloquean, pero rompen la costumbre. | Pendiente |

---

## Familia 3 — Estado que se queda colgado

Un gesto interrumpido (una notificación, el Centro de Control, cambiar de app)
deja una bandera puesta, y el gesto siguiente hace otra cosa.

| # | Qué fallaba | Estado |
|---|---|---|
| 3.1 | Un arrastre de fondo interrumpido hacía que **el trazo siguiente moviera el PDF en vez de escribir**. Se perdía el trazo y el fondo quedaba desplazado. | **Hecho** |
| 3.2 | Un arrastre de selección interrumpido **se comía el lazo entero** durante el gesto siguiente. | **Hecho** |
| 3.3 | La cinta podía quedarse «agarrada» y **saltar lo que ve la clase** al pasar el dedo por encima. | **Hecho** |
| 3.4 | Mover la selección no comprobaba índices: si la selección quedara desfasada, el gesto moría a media clase. | **Hecho** |

---

## Familia 4 — Nada se recordaba

| # | Qué fallaba | Estado |
|---|---|---|
| 4.1 | **Ninguna preferencia sobrevivía a recargar.** `window.storage` no existe en un navegador normal, así que todo caía a un objeto en memoria: reglas, rótulos, sitio de la cinta, todo volvía de fábrica en cada recarga. Ahora va a `localStorage`, con vuelta a memoria si no cabe o está bloqueado. | **Hecho** |

---

## Familia 6 — El pizarrón estaba abierto a toda la red

Salió al preparar la versión para publicar, y era lo más grave de todo lo
encontrado.

| # | Qué fallaba | Estado |
|---|---|---|
| 6.1 | **Sin ninguna credencial, cualquiera en el mismo wifi podía leer, sobrescribir y borrar los cuadernos, y escribir en la clase en vivo.** El servidor escucha en `0.0.0.0` —hace falta para que el iPad se conecte— con `Access-Control-Allow-Origin: *` y sin autenticación. Ahora hay clave de sesión: local libre, red con clave, y la clave viaja dentro del código QR. | **Hecho** |
| 6.2 | El rechazo respondía sin vaciar el cuerpo de la petición. Con conexión persistente, esos bytes se leen como si fueran la petición siguiente y se cuelan peticiones que parecen válidas. | **Hecho** |

`prueba_clave.mjs`, 20 comprobaciones, con servidor propio: comprueba desde una
IP de red real que sin clave no se lee, no se escribe, no se borra y no se
empuja; que con ella sí; que una equivocada no; y que `/info` no suelta la clave
a nadie de fuera.

---

## Familia 5 — Las pruebas se mentían entre sí

Esto no lo sufre el usuario, pero es lo que dejaba pasar todo lo demás.

| # | Qué fallaba | Estado |
|---|---|---|
| 5.1 | **El servidor de pruebas compartía carpeta con el repositorio.** Cada prueba heredaba los cuadernos de la anterior —la app arranca cargando el último— y fallaba por lo que escribió otra. Ahora acepta `PIZARRON_CUADERNOS` y las pruebas corren contra una carpeta propia. | **Hecho** |
| 5.2 | El servidor además guarda el último estado en memoria y se lo reenvía al siguiente cliente. `pruebas/correr.sh` lo reinicia entre cada prueba y le da carpeta limpia. | **Hecho** |
| 5.3 | **Veinticuatro pruebas apuntaban al servidor de las clases de verdad**, con la dirección escrita a mano. Además de contaminarse entre sí, escribían en `~/Documents/Pizarrón`. Ahora todas pasan por `BASE`, que apunta al de pruebas por defecto. | **Hecho** |
| 5.4 | Las pruebas de fondo necesitaban un PDF que había que traer de fuera, y con una exportación de la propia app (16:9) no comprobaban nada. `hacer_pdf_prueba.py` fabrica uno vertical de varias páginas, sin dependencias. | **Hecho** |

---

## Lo que falta, por orden

1. **Exportar a PDF esperando a las imágenes** (1.7). Es el único pendiente que
   arruina un entregable: exportas los apuntes y salen sin los fondos.
2. **Miniaturas** (1.5, 1.6). Molesto a diario con un PDF importado, que es
   justo el flujo de un curso con notas previas.
3. **Aislar las pruebas de verdad** (5.2). Mientras no esté, cualquier revisión
   futura vuelve a arrancar dudando de sus propios resultados.
4. **Rechazo de palma alcanzable en modo clase** (2.12).
5. **El sello con la identidad de la página** (1.8). No muerde hoy; es cerrar
   la trampa antes de que alguien la pise.
6. **Cerrar editores tocando fuera** (2.13).

### Fuera de esta revisión, pedido aparte

- **Lupa tipo GoodNotes** — **hecho**. Banda donde escribes en grande y aterriza
  pequeño en el pizarrón; se corre sola al levantar la pluma cerca del borde y
  salta de renglón al acabarse el ancho. Con el pizarrón encuadrado, escribir
  sale unas cinco veces más grande. `prueba_lupa.mjs`, 12 comprobaciones.
- **Tocar un cuadrito de la cinta para borrarlo** — **hecho**. Un toque seco
  selecciona ese elemento y se borra desde la barra de siempre; arrastrar sigue
  recorriendo la clase. `prueba_cinta_toque.mjs`, 9 comprobaciones.

---

## Pruebas

33 archivos. Los nuevos de esta revisión:

- `prueba_editar_aqui.mjs` — 19 comprobaciones. Corregir a media cinta sin
  perder lo que sigue, los stops corriéndose con la edición, y el aviso de que
  lo escrito se fue al final.
- `prueba_cinta_sitio.mjs` — 14 comprobaciones. La cinta en los tres sitios:
  que se dibuja, que arrastrarla mueve el revelado en el eje que toque, y que
  el sitio se recuerda.

Se corren con el lanzador, que levanta el servidor aislado, le da carpeta
limpia y lo reinicia entre cada una:

```
cd pruebas && ./correr.sh
```

Una suelta: `./correr.sh prueba_pdf.mjs`.

**Nunca contra el servidor de las clases.** Ya no puede pasar por descuido: la
dirección sale de `BASE`, que apunta al de pruebas si no dices otra cosa.
