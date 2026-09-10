# Esquisse

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22654651.svg)](https://doi.org/10.5281/zenodo.22654651)

Pizarrón digital para dar clases de matemáticas: se escribe en el iPad y se
proyecta desde la computadora, con revelado por pasos. Sustituto de Doceri.

Arranca en el modo **Escribir**, que deja el pizarrón, la barra y una tira
delgada con los trazos. La tecla `R` abre **Revisar**, con la cinta entera y la
columna, para marcar stops y ordenar páginas. En un iPad de 11 pulgadas eso es
la diferencia entre el 45.7 % y el 74 % de pantalla para escribir.

Sin instalación en el aparato de los alumnos y sin internet: el iPad y la
computadora hablan directo por la red local, con una clave de sesión que va
dentro del código QR para que nadie más en el wifi pueda asomarse.

Versión de evaluación. Uso libre para dar clase; redistribuir necesita permiso.
Ver [LICENCIA.md](LICENCIA.md).

- **[EVALUACION.md](EVALUACION.md)** — **empieza por aquí si vienes a
  probarlo**: qué se pide exactamente, por dónde empezar y cómo informar.
- **[INSTRUCTIVO.md](INSTRUCTIVO.md)** — cómo se usa, parte por parte.
- **[LICENCIA.md](LICENCIA.md)** — condiciones de la versión de evaluación.
- **[CONTEXTO.md](CONTEXTO.md)** — cómo está hecho y por qué; leer antes de
  tocar el código.
- **[REVISION.md](REVISION.md)** — revisión sistemática de fallos: qué se
  arregló, cómo se comprobó y qué falta.
- **[PLAN-V2.md](PLAN-V2.md)** — el plan de la versión 2, con los números
  medidos y lo que las mediciones desmintieron. **Leer antes de abrir el
  proyecto en un IDE con agente.**
- **[PLAN-2.0.md](PLAN-2.0.md)** — el plan anterior, conservado como bitácora:
  dos de sus cuentas no sobrevivieron a medirlas.
- **[SUGERENCIAS.md](SUGERENCIAS.md)** — comparación frente a Doceri y otras.

---

## Instalar en otra máquina

Hace falta **Python 3**, que ya viene en macOS y en casi todo Linux. En
Windows se baja de [python.org](https://www.python.org/downloads/).

```bash
git clone git@github.com:yoyontzin/Pizarron.git ~/Pizarron
```

Si no tienes claves SSH configuradas en esa máquina, con HTTPS:

```bash
git clone https://github.com/yoyontzin/Pizarron.git ~/Pizarron
```

### macOS

```bash
cd ~/Pizarron && bash crear_app_mac.sh
```

Deja un `Esquisse.app` listo para arrastrar al Dock. La primera vez, ábrelo
con clic derecho › Abrir, porque no está firmado con cuenta de desarrollador.

### Windows, Linux, o macOS sin el paquete

```bash
cd ~/Pizarron && python3 iniciar.py
```

Arranca el servidor y abre la proyección. `Ctrl-C` para parar.

### Traer los cambios después

```bash
cd ~/Pizarron && git pull && bash crear_app_mac.sh
```

En macOS conviene volver a correr el script para que la app del Dock se quede
con la versión nueva. En las demás máquinas basta con el `git pull`.

---

## Los cuadernos

Se guardan solos en `cuadernos/`, junto al programa. Esa carpeta **no va al
repositorio**: son tus clases, no código.

Para llevarlas de una máquina a otra, o **Exportar** e **Importar** desde la
propia app, o apuntar `cuadernos/` a una carpeta sincronizada:

```bash
ln -s ~/Dropbox/Pizarron ~/Pizarron/cuadernos
```

---

## Las pruebas

```bash
cd pruebas && npm install && npx playwright install chromium
./correr.sh
```

`correr.sh` levanta su propio servidor en el 8778, con carpeta de cuadernos
aparte, y lo reinicia entre cada prueba. Las dos cosas hacen falta: el servidor
recuerda en memoria el último estado que le mandaron y se lo reenvía a quien se
conecte, así que sin reiniciar una prueba hereda lo que escribió la anterior.

**Nunca contra el 8777**, que es donde están las clases de verdad.

Cuarenta y cinco archivos con más de 450 comprobaciones: escritura y rechazo de
palma, la lupa, enlace con el iPad y consistencia entre los dos lados, arranque
con el guardado local corrupto, reconexión tras perder el wifi, clave de acceso
y separación entre mirar y escribir, caché de dibujado, historial, stops,
formas, fondos, exportación a PDF, vista de alumno, los tres modos, los menús,
el puntero, y el flujo completo de dar clase con diapositivas.

`correr.sh` **falla si una prueba no imprime línea de resumen**. No es celo:
cinco archivos imprimían su veredicto en texto y salían con código cero pasara
lo que pasara, así que el de persistencia podía escribir «SE PIERDE EL TRABAJO»
y el corredor decía «todo en verde».

Una suelta:

```bash
cd pruebas && ./correr.sh prueba_lupa.mjs
```
