#!/usr/bin/env python3
"""Fabrica un PDF vertical de varias páginas para las pruebas.

Sin dependencias: escribe el PDF a mano. Hace falta uno *vertical* porque las
pruebas de fondo comprueban justo lo que pasa al meter una página alta en un
marco apaisado (franjas a los lados, encajar a lo ancho, salirse por arriba).
Los PDF que exporta la propia app son 16:9 y encajan clavados, así que con
ellos esas comprobaciones no comprueban nada.

    python3 hacer_pdf_prueba.py [salida.pdf] [paginas]
"""
import sys
import zlib

ANCHO, ALTO = 595, 842          # A4 vertical, en puntos


def pagina(n):
    """Un número grande y dos rayas, para distinguir las páginas de un vistazo."""
    return (
        f"BT /F1 240 Tf 1 0 0 1 200 400 Tm 0.15 0.15 0.15 rg ({n}) Tj ET\n"
        f"4 w 0.55 0.35 0.75 RG 60 760 m 535 760 l S\n"
        f"60 80 m 535 80 l S\n"
    ).encode("latin-1")


def construir(paginas):
    objetos = []          # cada uno, ya serializado sin el «N 0 obj»
    # 1 catálogo, 2 árbol de páginas, luego por cada página: página y contenido,
    # y al final la fuente.
    n_font = 3 + paginas * 2
    hijos = " ".join(f"{3 + i * 2} 0 R" for i in range(paginas))
    objetos.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objetos.append(
        f"<< /Type /Pages /Kids [{hijos}] /Count {paginas} >>".encode("latin-1"))
    for i in range(paginas):
        contenido = zlib.compress(pagina(i + 1))
        objetos.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {ANCHO} {ALTO}] "
            f"/Resources << /Font << /F1 {n_font} 0 R >> >> "
            f"/Contents {4 + i * 2} 0 R >>".encode("latin-1"))
        objetos.append(
            b"<< /Length " + str(len(contenido)).encode() +
            b" /Filter /FlateDecode >>\nstream\n" + contenido + b"\nendstream")
    objetos.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    salida = bytearray(b"%PDF-1.4\n")
    posiciones = []
    for i, cuerpo in enumerate(objetos, start=1):
        posiciones.append(len(salida))
        salida += f"{i} 0 obj\n".encode() + cuerpo + b"\nendobj\n"
    inicio_xref = len(salida)
    salida += f"xref\n0 {len(objetos) + 1}\n".encode()
    salida += b"0000000000 65535 f \n"
    for p in posiciones:
        salida += f"{p:010d} 00000 n \n".encode()
    salida += (f"trailer\n<< /Size {len(objetos) + 1} /Root 1 0 R >>\n"
               f"startxref\n{inicio_xref}\n%%EOF\n").encode()
    return bytes(salida)


if __name__ == "__main__":
    destino = sys.argv[1] if len(sys.argv) > 1 else "muestra_vertical.pdf"
    cuantas = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    with open(destino, "wb") as f:
        f.write(construir(cuantas))
    print(f"{destino}: {cuantas} páginas de {ANCHO}x{ALTO} pt")
