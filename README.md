# Esquisse

Pizarrón digital para dar clase de matemáticas. Escribes a mano en una tableta
y la computadora proyecta, con la particularidad de que **el material se revela
por pasos**.

Escribes la clase entera de antemano, con calma y buena letra. Después marcas
los puntos de corte donde toca detenerse a hablar. En el aula vas soltando un
tramo cada vez, y cada tramo puede aparecer de golpe o **escribiéndose solo**,
como si lo estuvieras haciendo en ese momento.

Para una demostración, la secuencia queda así:

```
enunciado → construcción → lema → cálculo → conclusión
```

Cada flecha es un punto de corte. La clase nunca ve el paso siguiente antes de
tiempo.

- **Fórmulas en LaTeX de verdad**, compuestas, no imágenes.
- Una **lupa** donde escribes en grande y el trazo cae pequeño en el pizarrón:
  es lo que permite escribir a mano con letra legible en una pantalla.
- Importa **PDF** para anotar sobre notas ya hechas.
- Exporta la clase a PDF **por etapas**, una página por punto de corte.
- El alumnado sigue la clase **desde su propio dispositivo** y se acerca a lo
  que no alcanza a leer.

Los dos aparatos hablan **directo por la red local**: sin internet, sin cuenta,
y sin instalar nada en los dispositivos del alumnado. Cada sesión tiene una
clave que viaja dentro del código QR de emparejamiento.

Nació como sustituto de [Doceri](https://en.wikipedia.org/wiki/Doceri),
retirado en 2022, y se usa en un curso de posgrado en teoría de esquemas.

---

## Empezar

Hace falta **Python 3**, que ya viene en macOS y en casi todo Linux. En Windows
se baja de [python.org](https://www.python.org/downloads/). Nada más: el
servidor usa solo la biblioteca estándar.

**macOS**

```bash
bash crear_app_mac.sh
```

Deja un `Esquisse.app` para el Dock. La primera vez ábrelo con clic derecho ›
Abrir, porque no está firmado con cuenta de desarrollador de Apple.

**Windows, Linux, o macOS sin el paquete**

```bash
python3 iniciar.py
```

Después, apunta la cámara de la tableta al código QR de la pantalla.

**[Manual completo (PDF)](Manual-Esquisse-1.0.pdf)** · o en
[INSTRUCTIVO.md](INSTRUCTIVO.md).

---

## Documentación

| Archivo | Qué trae |
|---|---|
| [`INSTRUCTIVO.md`](INSTRUCTIVO.md) | cómo se usa, parte por parte |
| [`Manual-Esquisse-1.0.pdf`](Manual-Esquisse-1.0.pdf) | lo mismo, compuesto para leer o imprimir |
| [`CONTEXTO.md`](CONTEXTO.md) | cómo está hecho y **por qué**: decisiones de diseño, trampas conocidas y la razón detrás de cada una |
| [`LICENCIA.md`](LICENCIA.md) | condiciones de uso |

`CONTEXTO.md` es el documento a leer antes de tocar el código. No describe solo
la arquitectura: registra los errores que ya se cometieron una vez y por qué no
conviene repetirlos.

---

## Pruebas

```bash
cd pruebas && npm install && npx playwright install chromium
./correr.sh
```

Treinta y cuatro archivos con más de trescientas comprobaciones: escritura y
rechazo de palma, la lupa, el enlace entre los dos aparatos y la consistencia
entre ambos lados, la clave de acceso, la caché de dibujado, historial, stops,
formas, fondos, exportación a PDF, vista de alumno, y el flujo completo de dar
clase con diapositivas.

`correr.sh` levanta su propio servidor con carpeta de datos aparte y lo
reinicia entre cada prueba: el servidor recuerda el último estado y se lo
reenvía a quien se conecte, así que sin reiniciar una prueba hereda lo que
escribió la anterior.

---

## Sobre la seguridad

El servidor escucha en toda la red local, que es lo que permite que la tableta
se conecte. Para que eso no deje el pizarrón abierto a cualquiera en el mismo
wifi, **cada sesión tiene una clave**: desde la propia computadora no se pide,
desde cualquier otro aparato sí, y viaja dentro del código QR para que enlazar
siga siendo un escaneo.

El tráfico va **en claro** por la red local. Para dar clase es suficiente, y es
el mismo modelo de una impresora compartida. No expongas esto a internet.

---

## Licencia

**Versión de evaluación.** El uso para dar clase es libre, incluso en cursos
por los que se cobre matrícula, sin pedir permiso. Redistribuir, vender o
publicar obras derivadas requiere permiso escrito. Ver
[`LICENCIA.md`](LICENCIA.md).

## Cómo citarlo

> Pérez-Buendía, J. Rogelio. *Esquisse: pizarrón digital para docencia
> matemática.* 2026.

Los metadatos completos están en [`CITATION.cff`](CITATION.cff).
