#!/usr/bin/env python3
"""
Arranca Esquisse y abre la ventana de proyección. Sirve en macOS, Windows
y Linux: solo necesita Python 3, que ya viene en macOS y en casi todo Linux.

    python3 iniciar.py

En macOS conviene usar Esquisse.app, que hace lo mismo con doble clic. Este
archivo es para las máquinas donde ese paquete no aplica.
"""

import os
import socket
import subprocess
import sys
import threading
import time
import webbrowser

AQUI = os.path.dirname(os.path.abspath(__file__))
PUERTO = int(os.environ.get("PIZARRON_PUERTO", "8777"))


def ya_hay_servidor():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.6)
        return s.connect_ex(("127.0.0.1", PUERTO)) == 0


def esperar(segundos=15):
    fin = time.time() + segundos
    while time.time() < fin:
        if ya_hay_servidor():
            return True
        time.sleep(0.25)
    return False


def main():
    servidor = os.path.join(AQUI, "pizarron_servidor.py")
    if not os.path.exists(servidor):
        print("Falta pizarron_servidor.py junto a este archivo.")
        return 1

    if ya_hay_servidor():
        print(f"Ya había un servidor en el puerto {PUERTO}. Solo abro la ventana.")
    else:
        entorno = dict(os.environ, PIZARRON_PUERTO=str(PUERTO))
        # -u para que el registro salga sin quedarse en el búfer
        proc = subprocess.Popen([sys.executable, "-u", servidor],
                                cwd=AQUI, env=entorno)
        if not esperar():
            print("El servidor no respondió. Prueba a correrlo a mano para ver el error:")
            print(f"    {sys.executable} -u pizarron_servidor.py")
            proc.terminate()
            return 1

    webbrowser.open(f"http://127.0.0.1:{PUERTO}/?rol=proyeccion")

    anfitrion = socket.gethostname()
    if not anfitrion.endswith(".local"):
        anfitrion += ".local"
    print()
    print("  Proyección abierta en esta computadora.")
    print(f"  En el iPad abre:  http://{anfitrion}:{PUERTO}/?rol=control")
    print("  Ctrl-C para detener.")
    print()
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("\n  Listo.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
