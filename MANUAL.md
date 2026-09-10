# Manual de Esquisse

Para dar clase escribiendo en el iPad y proyectando desde la computadora.

---

## Poner en marcha

**En la Mac.** Doble clic en `Esquisse.app`. Arranca el servidor y abre sola la
ventana de proyección con un código QR.

**En el iPad.** Apunta la cámara al código. Si no abre, en la pantalla vienen
además las direcciones numéricas: escribe una en Safari. La que termina en
`.local` es la buena porque funciona aunque cambie la IP; las numéricas son el
respaldo para redes donde el nombre no resuelve.

**En otra computadora** —Windows, Linux o una Mac sin el paquete—:

```bash
python3 iniciar.py
```

**Sin internet.** Solo hace falta que los dos aparatos estén en la misma red.
De viaje, sirve el punto de acceso del teléfono aunque no tenga datos: basta
con que cree la red. Lo único que necesitó internet fue bajar MathJax, jsPDF y
pdf.js la primera vez, y ya están guardados: el panel lo dice con «Sin
conexión: lista» en verde.

---

## Las tres vistas

| Dirección | Quién | Qué hace |
|---|---|---|
| `?rol=control` | tú, en el iPad | escribes y mandas |
| `?rol=proyeccion` | la Mac | lo que ve la clase; es la ventana que se comparte en Meet o Zoom |
| `?rol=alumno` | cada alumno | lo mismo que la proyección, pero cada quien puede acercarse a lo que no alcanza a leer sin mover nada a nadie |

La dirección para repartir a la clase aparece en tu panel, bajo **Para la
clase**.

En videollamada, comparte **la ventana** de proyección, no la pantalla entera:
el pizarrón es 16:9 y encaja sin franjas.

---

## El pizarrón

Es una superficie **acotada** de proporción 16:9, no un lienzo infinito. La
clase ve siempre ese rectángulo entero, así que lo que escribes no se le mueve
nunca de sitio. Fuera del marco no se puede escribir: eso es la pared.

**Tu zoom es tuyo.** Puedes acercarte con dos dedos para escribir cómodo y a
la clase no le cambia nada. **Encuadrar** te devuelve a ver el pizarrón
completo.

---

## Escribir

**Pluma, Marcador, Borrador.** La goma tiene su propio grosor: no hace falta
reajustarlo cada vez que pasas de escribir a borrar.

**El grosor** se ajusta con el deslizador o con las flechitas `−` y `+`. El
punto que hay al lado enseña cómo va a salir antes de escribir.

**Opciones del trazo** (la barra que aparece sobre el pizarrón):

- **Punteado.** Vale para la pluma y para las formas: rectas auxiliares.
- **Gis.** El trazo sale granulado, como la tiza en el pizarrón.
- **Mejorar letra.** Quita el temblor de la mano al levantar la pluma. Viene
  encendido. Si quieres el trazo tal cual sale, apágalo.

**El Pencil y la palma.** En cuanto aparece un Apple Pencil se activa solo el
rechazo de palma: puedes apoyar la mano. El botón **Solo Pencil** lo controla
a mano.

**Dejar la pluma quieta** un momento sobre el pizarrón abre el **lazo**, sin
tener que ir a la barra.

---

## Formas

Con **Formas** aparece la barra: Recta, Flecha, Rectángulo, Elipse.

Las rectas y las flechas **se enderezan solas** cuando quedan a menos de cinco
grados de un ángulo notable (0, 15, 30, 45, 90…). Un ángulo cualquiera se
respeta tal cual, así que no estorba.

---

## Fórmulas

**Fórmula** abre el editor. Con la casilla **LaTeX** marcada escribes
`\mathcal{O}_X \to \pi_*\mathcal{O}_Y` y ves la vista previa antes de
insertarla. Queda como un elemento más: entra en los stops, en el lazo y en el
PDF.

---

## Mover, girar y escalar

Con el **Lazo** rodeas lo que quieras. Una vez seleccionado:

- **Un dedo** lo arrastra.
- **Dos dedos** lo agrandan, lo giran y lo mueven a la vez.
- Los botones de la barra de selección hacen lo mismo a pasos, y con `⟲` `⟳`
  se gira de quince en quince grados.

---

## Revelar por pasos

Aquí está la idea del programa. El documento es una **lista ordenada** de todo
lo que has escrito, y un **stop** es una marca en esa lista.

Lo cómodo es **escribir la clase entera antes** y marcar después los cortes:
arrastra la **cinta de trazos** de abajo hasta el punto donde quieres parar y
pulsa **Poner stop aquí**. Los stops salen numerados en la cinta.

Durante la clase:

- **Siguiente stop** aparece el tramo entero de golpe.
- **Reproducir** lo escribe como si lo estuvieras escribiendo, y **se detiene
  siempre en el siguiente stop**.
- **Velocidad** va de 0.1× a 12×, con flechitas para afinar. El recorrido fino
  está en lo lento a propósito: ahí se decide si la clase alcanza a copiar.

Lo que aún no has revelado lo ves tú en gris tenue; la clase no lo ve.

---

## Diapositivas y PDF

El flujo del curso: prepara las diapositivas con huecos, expórtalas a PDF y
tráelas con **Importar PDF**. Cada página del PDF entra como una página del
cuaderno, con la diapositiva de fondo. Escribes encima con el Pencil para
completar lo que falta.

El fondo no se borra ni entra en los stops: es el papel.

**Ajustar fondo** sirve cuando la diapositiva es vertical y se ve pequeña:

- **A lo ancho** la agranda hasta ocupar todo el ancho; entonces se arrastra
  para ir viendo cada parte.
- **A lo alto** la devuelve a caber entera.
- **Llenar** cubre el marco completo.
- **A todas** aplica el mismo encaje a todas las páginas de golpe, que con un
  PDF de dieciocho páginas es la diferencia entre un segundo y un rato largo.

**Capturar diapositiva** toma una foto de lo que tengas en pantalla —Keynote,
un PDF, lo que sea— y la deja de fondo en una página nueva para anotar encima.
En macOS el navegador necesita permiso en Ajustes del Sistema › Privacidad y
seguridad › Grabación de pantalla; si falta, la app lo dice.

---

## El puntero

**Puntero** deja una estela que dura unos nueve segundos y se borra sola. Da
tiempo a escribir una ecuación entera de varios trazos, señalar con ella y
dejar que desaparezca. No toca el documento: no entra en los stops ni queda en
el PDF.

---

## Deshacer

**Deshacer** y **Rehacer** cubren todo: trazos, borrados con lazo,
movimientos, giros, cambios de color, stops y encajes de fondo. Guarda los
últimos cuarenta pasos. `Cmd+Z` y `Cmd+Shift+Z`.

**Borrar lo último** quita de un golpe todo lo escrito en los últimos cuatro
segundos, para no dar veinte veces a deshacer delante del grupo.

---

## Guardar

Se guarda solo en el servidor cada pocos segundos; el panel dice la hora y
«servidor». Al abrir la app se recupera el último cuaderno.

Además: **Carpeta** lo sincroniza con una carpeta tuya, **Guardar en Archivos**
descarga el `.json`, y **Exportar** e **Importar** mueven cuadernos entre
máquinas.

---

## Ordenar las páginas

Con **◀ mover** y **mover ▶** la página actual cambia de sitio. Sirve cuando
traes un PDF y quieres intercalar una hoja en blanco donde no estaba.

## Si se cae el enlace

Cuando el iPad se desengancha aparece un aviso rojo abajo, también en modo
clase. Sin él se puede estar escribiendo un rato para nadie.

## Exportar

**PDF** pregunta dos cosas:

- **Qué páginas**: `todas`, o los números (`1-3, 5`).
- **Una hoja por cada stop**, para repasar el desarrollo, o sin marcar, una
  hoja por página ya terminada, que es lo que se suele compartir con la clase.

**Grabar video** graba el pizarrón **con tu voz**: sirve para dejar la clase
grabada.

---

## Modo clase

**Modo clase** (tecla `C`) esconde toda la interfaz y deja una barra flotante
con lo imprescindible. Es para cuando ya no estás preparando nada, solo dando
la clase.

---

## Atajos

| Tecla | Qué hace |
|---|---|
| Espacio o → | siguiente stop |
| ← | stop anterior |
| ↑ ↓ | página anterior y siguiente |
| Enter | reproducir o pausar |
| `S` | poner stop |
| `P` | puntero |
| `M` | marcador |
| `T` | texto y fórmulas |
| `L` | lazo |
| `C` | modo clase |
| `Cmd+Z` / `Cmd+Shift+Z` | deshacer y rehacer |
| `Esc` | cerrar lo que esté abierto |

---

## Si algo no va

**El iPad no se conecta.** Comprueba que la app esté abierta en la Mac (tiene
que haber un servidor). Prueba las direcciones numéricas del código de
emparejamiento: en redes de invitados el nombre `.local` a veces no resuelve.

**Se ve lento.** Suele ser una página con muchísimos elementos. Pásate a una
página nueva; el cuaderno no tiene límite de páginas.

**La captura de pantalla no funciona.** Falta el permiso de grabación de
pantalla del navegador en Ajustes del Sistema.

**Escribe desplazado de donde apoyas la pluma.** No debería: el lienzo se
reajusta solo. Si pasara, cambiar de modo clase y volver lo recoloca.
