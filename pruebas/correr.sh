#!/bin/bash
# Corre las pruebas contra un servidor aislado y lo reinicia entre cada una.
#
#     ./correr.sh                  todas
#     ./correr.sh prueba_pdf.mjs   una suelta
#
# El reinicio no es capricho: el servidor recuerda en memoria el último estado
# que le mandaron y se lo reenvía al siguiente que se conecte, así que sin
# reiniciar una prueba hereda lo que escribió la anterior y falla por algo que
# no está comprobando. Además usa una carpeta de cuadernos propia, para no
# tocar jamás las clases de verdad.
set +m                                    # sin avisos de «Terminated» al matar
cd "$(dirname "$0")"
DATOS=/tmp/pizarron_pruebas
PUERTO=8778
export BASE="http://127.0.0.1:$PUERTO"

parar(){ lsof -ti :$PUERTO 2>/dev/null | xargs kill 2>/dev/null; sleep 0.5; }
arrancar(){
  parar
  rm -rf "$DATOS"; mkdir -p "$DATOS"
  # Las pruebas hablan por 127.0.0.1, donde el servidor no pide clave de todos
  # modos; se apaga explícitamente para que prueba_clave.mjs sea la única que
  # la ejercita, con su propio servidor y su propia clave.
  ( cd .. && PIZARRON_PUERTO=$PUERTO PIZARRON_CUADERNOS="$DATOS" PIZARRON_SIN_CLAVE=1 \
      /usr/bin/python3 -u pizarron_servidor.py > /tmp/pizarron_pruebas.log 2>&1 & )
  for _ in $(seq 1 40); do
    curl -s -o /dev/null --max-time 1 "$BASE/" && return 0
    sleep 0.25
  done
  echo "  el servidor de pruebas no arrancó; mira /tmp/pizarron_pruebas.log"
  return 1
}
trap parar EXIT

archivos=("$@")
[ ${#archivos[@]} -eq 0 ] && archivos=(prueba_*.mjs)

fallos=0
for f in "${archivos[@]}"; do
  arrancar || exit 1
  salida=$(node "$f" 2>&1); codigo=$?
  linea=$(printf '%s\n' "$salida" | tail -1)
  echo "$f: $linea"
  # Falla si node se cayó, si el resumen dice que hubo comprobaciones malas,
  # o si NO HAY resumen. Esto último no es celo: cinco pruebas imprimían su
  # veredicto en texto y salían con código cero pasara lo que pasara, así que
  # `prueba_persistencia.mjs` podía escribir «SE PIERDE EL TRABAJO» y esto
  # decía «todo en verde». Una prueba que no puede fallar no es una prueba.
  mal=0
  [ $codigo -ne 0 ] && mal=1
  case "$salida" in
    *" fallidas"*) case "$linea" in *" 0 fallidas"*) ;; *) mal=1;; esac;;
    *) echo "     ^ sin línea de resumen: esta prueba no puede fallar"; mal=1;;
  esac
  if [ $mal -eq 1 ]; then
    fallos=$((fallos+1))
    # Sin esto, una prueba que falla dentro de la corrida completa deja una
    # línea de resumen y nada más, y no hay manera de saber qué comprobación
    # se cayó. Se enseñan las malas y se guarda la salida entera.
    printf '%s\n' "$salida" | grep '^  MAL' | sed 's/^/   /'
    printf '%s\n' "$salida" > "/tmp/pizarron_falla_${f%.mjs}.log"
    echo "     salida completa en /tmp/pizarron_falla_${f%.mjs}.log"
  fi
done
echo "---"
if [ "$fallos" -eq 0 ]; then echo "todo en verde"; else echo "$fallos con fallos"; fi
exit $((fallos > 0))
