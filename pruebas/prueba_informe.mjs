/* Que quien pruebe el programa pueda decir qué se rompió.

   Hasta aquí no había manera. Un error de JavaScript se iba a la consola del
   navegador, que en un iPad no existe, y el programa seguía pintando como si
   nada: quien lo probara no se enteraba hasta perder trabajo, y lo único que
   podía escribir después era «no me funcionó».

   Se comprueba que los errores quedan apuntados aunque no se vean, que el
   informe lleva lo que hace falta para reproducirlos, y que no lleva lo que no
   es de nadie más: ni el nombre del cuaderno ni lo escrito en la clase. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();
const ctx = await nav.newContext({viewport:{width:1200,height:860},
                                  permissions:['clipboard-read','clipboard-write']});
const p = await ctx.newPage();
await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);

/* --- sin errores, el botón no lleva marca y el informe lo dice --- */
{
  const limpio = await p.evaluate(()=>({
    marca: document.getElementById('acercaBtn').classList.contains('conFallos'),
    texto: informeTexto(),
  }));
  check('sin errores, el botón de Acerca no lleva marca', !limpio.marca);
  check('y el informe lo dice', /Sin errores apuntados/.test(limpio.texto));
  check('pero ya trae la versión', limpio.texto.includes(await p.evaluate(()=>APP.version)));
}

/* --- un error de verdad, del tipo que no se ve --- */
await p.evaluate(()=>{
  /* Lanzado desde un temporizador para que salga por window.onerror como lo
     haría un fallo real, y no como una excepción de esta misma llamada. */
  setTimeout(()=>{ null.f(); }, 0);
});
await p.waitForTimeout(400);
{
  const tras = await p.evaluate(()=>({
    marca: document.getElementById('acercaBtn').classList.contains('conFallos'),
    cuenta: document.getElementById('acercaBtn').getAttribute('data-fallos'),
    apuntes: bitacora.length,
    texto: informeTexto(),
  }));
  check('el error queda apuntado aunque no se vea', tras.apuntes === 1, String(tras.apuntes));
  check('y el botón de Acerca lo avisa', tras.marca && tras.cuenta === '1', String(tras.cuenta));
  check('el informe lo lleva', /error:/.test(tras.texto), tras.texto.slice(-200));
}

/* Una promesa rechazada sin atender: el otro camino por el que se pierde
   trabajo en silencio, porque no llega a window.onerror. */
await p.evaluate(()=>{ Promise.reject(new Error('fallo de prueba en promesa')); });
await p.waitForTimeout(400);
check('una promesa rechazada también',
      /promesa: .*fallo de prueba en promesa/.test(await p.evaluate(()=>informeTexto())));

/* El mismo error repetido no llena la bitácora: se cuenta. */
await p.evaluate(()=>{ for (let i=0;i<5;i++) setTimeout(()=>{ null.g(); }, 0); });
await p.waitForTimeout(500);
{
  const r = await p.evaluate(()=>({n: bitacora.length, texto: informeTexto()}));
  check('el mismo error repetido se cuenta, no se acumula', r.n <= 4, r.n + ' apuntes');
  check('y el informe dice cuántas veces', /×\d/.test(r.texto), r.texto.slice(-160));
}

/* --- el informe lleva lo que hace falta para reproducir --- */
{
  const texto = await p.evaluate(()=>informeTexto());
  for (const [q, re] of [['la versión', /Versión\s+\S/], ['el papel', /Papel\s+control/],
                         ['el modo', /Modo\s+(escribir|revisar|clase)/],
                         ['el tamaño de pantalla', /Pantalla\s+\d+×\d+/],
                         ['el navegador', /Navegador\s+Mozilla/],
                         ['cuántas páginas', /Cuaderno\s+\d+ página/],
                         ['si el enlace está en pie', /Enlace\s+(en pie|caído)/],
                         ['si guarda en disco', /Guardado\s+/]])
    check('el informe dice '+q, re.test(texto), q);
}

/* --- y NO lleva lo que no le toca --- */
await p.evaluate(()=>{
  state.nb.name = 'Clase secreta de esquemas';
  const P = pg(); P.items.push({k:'t', x:100, y:100, txt:'x^2 + y^2 = z^2', c:0, s:20});
  olvidarTinta(); sync();
});
await p.waitForTimeout(300);
{
  const texto = await p.evaluate(()=>informeTexto());
  /* El informe se pega en un issue público. Lo que se escribe en clase y cómo
     se llama el cuaderno son del profesor, no del informe. */
  check('el informe no lleva el nombre del cuaderno',
        !texto.includes('Clase secreta'), texto.slice(0,200));
  check('ni lo escrito en la clase', !texto.includes('x^2 + y^2'));
  check('pero sí cuántos elementos hay', /\d+ elemento/.test(texto));
}

/* --- lo que cuenta la persona va dentro del informe --- */
await p.evaluate(()=>abrirAcerca()); await p.waitForTimeout(400);
await p.fill('#acQueHacia', 'Pasé de página y se borró lo anterior.');
await p.waitForTimeout(300);
{
  const visto = await p.evaluate(()=>document.getElementById('acInforme').textContent);
  check('lo que cuenta la persona va dentro del informe',
        visto.includes('Pasé de página y se borró lo anterior.'));
  check('y el informe se ve entero antes de mandarlo, no se manda solo',
        visto.includes('Informe de Esquisse') && visto.length > 300, String(visto.length));
}

/* El aviso de cuántos hubo, porque estos errores no se ven mientras pasan. */
check('el panel avisa de cuántos errores hubo',
      /\d+ errores|un error/.test(await p.evaluate(()=>document.getElementById('acFallosCuantos').innerText)));

/* Copiar deja el informe en el portapapeles: es el camino real, porque el
   texto no cabe en la dirección de un issue. */
await p.click('#acCopiarInforme'); await p.waitForTimeout(500);
{
  const pegado = await p.evaluate(()=>navigator.clipboard.readText());
  check('el botón copia el informe entero',
        pegado.includes('Informe de Esquisse') && pegado.includes('Pasé de página'),
        pegado.slice(0,90));
}

/* --- las caídas del enlace quedan apuntadas --- */
await p.evaluate(()=>{ marcarEnlace(true); marcarEnlace(false); marcarEnlace(true); });
await p.waitForTimeout(200);
{
  const texto = await p.evaluate(()=>informeTexto());
  check('se apunta cuándo se cayó el enlace', /se cayó el enlace/.test(texto));
  check('y cuándo volvió', /el enlace volvió/.test(texto));
}

/* --- la proyección no enseña nada de esto --- */
{
  const pc = await nav.newContext({viewport:{width:1200,height:800}});
  const pr = await pc.newPage();
  await pr.goto(BASE+'/?rol=proyeccion'); await pr.waitForTimeout(2600);
  const enClase = await pr.evaluate(()=>{
    const b = document.getElementById('acercaBtn');
    return b ? b.getBoundingClientRect().height : 0;
  });
  check('la proyección no enseña el botón de Acerca', enClase === 0, String(enClase));
  await pc.close();
}

await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`informe: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
