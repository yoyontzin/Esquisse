/* Las bibliotecas de fuera, servidas desde disco en vez de desde el CDN.

   `primeLibs` baja jsPDF, MathJax y pdf.js de cdnjs en cada arranque de
   página. Como cada archivo de prueba abre un navegador con perfil nuevo, la
   caché de la aplicación está vacía y esas cuatro bibliotecas se rebajan
   cuarenta veces por corrida. Seis pruebas dependen de que lleguen, y
   `prueba_exportar_fondos.mjs` fallaba de forma intermitente por eso: sola
   pasa, dentro de la suite y con la máquina cargada, no.

   `ensureLib` mira primero el almacén local, así que basta con sembrarlo.
   Los archivos se bajan una vez a `_bibliotecas/`, que no va al repositorio.

   El almacén local de un navegador ronda los 5 MB, y las cuatro juntas pasan
   de 2.8: por eso cada prueba siembra solo las que necesita. */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CACHE = join(AQUI, '_bibliotecas');
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
const LIBS = {
  jspdf:     'jspdf/2.5.1/jspdf.umd.min.js',
  mathjax:   'mathjax/3.2.2/es5/tex-svg.js',
  pdfjs:     'pdf.js/3.11.174/pdf.min.js',
  pdfworker: 'pdf.js/3.11.174/pdf.worker.min.js',
};

async function enDisco(nombre){
  const archivo = join(CACHE, nombre + '.js');
  if (existsSync(archivo)) return readFileSync(archivo, 'utf8');
  mkdirSync(CACHE, {recursive: true});
  const r = await fetch(CDN + LIBS[nombre]);
  if (!r.ok) throw new Error(`no se pudo bajar ${nombre}: http ${r.status}`);
  const code = await r.text();
  // un portal cautivo responde HTML a cualquier dirección
  if (/^\s*<(!doctype|html)/i.test(code)) throw new Error(`${nombre} llegó como HTML`);
  writeFileSync(archivo, code);
  return code;
}

/* Siembra las bibliotecas pedidas en el contexto ANTES de abrir la página.
   Devuelve false y no rompe si no hay red y tampoco copia en disco: la prueba
   sigue, y fallará por su propia comprobación en vez de por un vencimiento
   sin explicación. */
/* Corta el CDN para la prueba entera.

   Sembrar las que hacen falta no basta: al arrancar, el programa pide LAS
   CUATRO, así que las no sembradas se bajan igual. `prueba_exportar_fondos`
   fallaba por eso dentro de la corrida completa y pasaba sola: sembraba pdf.js
   y aun así se bajaba MathJax, 2.1 millones de caracteres que van al almacén
   local por el hilo principal mientras el PDF se está renderizando. Noventa
   segundos no llegaban, y el aviso se quedaba en «Leyendo el PDF...».

   Cortándolo, lo sembrado sigue sirviendo, lo demás falla rápido y en limpio,
   y la prueba deja de depender de la red para bibliotecas que no usa. */
export async function sinCDN(contexto){
  await contexto.route('https://cdnjs.cloudflare.com/**', r => r.abort());
}

export async function sembrarLibs(contexto, nombres){
  const guion = [];
  for (const n of nombres){
    try{
      /* Doble codificación a propósito, y no es un descuido: el programa guarda
         en el almacén con `JSON.stringify` y lee con `JSON.parse`, así que el
         VALOR guardado tiene que ser JSON. La de fuera construye el literal de
         JavaScript del guion; la de dentro es el valor.

         Con una sola, la siembra escribía el código en crudo, `JSON.parse`
         reventaba, el programa lo daba por no encontrado y lo bajaba del CDN
         igual. O sea que esto no sirvió nunca desde que se escribió: las
         pruebas siguieron bajando las cuatro bibliotecas en cada página, que
         es justo lo que venía a evitar. Se vio al cortar el CDN, cuando
         `libState` dio `fail` con la biblioteca sentada en el almacén. */
      const codigo = await enDisco(n);
      guion.push(`try{ localStorage.setItem('lib:${n}', ${JSON.stringify(JSON.stringify(codigo))}); }catch{}`);
    }catch(err){
      console.log(`  (aviso: sin ${n} en caché ni red — ${err.message})`);
      return false;
    }
  }
  await contexto.addInitScript(guion.join('\n'));
  return true;
}
