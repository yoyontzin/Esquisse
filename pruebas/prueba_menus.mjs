/* La fila de documento eran 35 controles en 2314 px de ancho de los que en un
   iPad se veían 1158: el resto había que ir a buscarlo rodando la barra con el
   dedo, justo donde se apoya la palma. Ahora viven detrás de cinco menús.
   Lo que se comprueba aquí es que no se perdió ninguno por el camino, que
   abrir uno cierra los demás, y que la fila cabe de una sola altura. */
import { chromium } from 'playwright';
import { revisar } from './modo.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();
const ctx = await nav.newContext({viewport:{width:1512,height:945}});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2200);

// --- la segunda fila desapareció ---
check('ya no hay segunda fila de documento',
  await p.evaluate(()=>!document.getElementById('barDoc')));
const alto = await p.evaluate(()=>{
  const r=id=>document.getElementById(id).getBoundingClientRect();
  return {bar:Math.round(r('bar').height), tools:Math.round(r('barTools').height)};
});
check('la barra cabe de una sola altura', alto.tools <= 40 && alto.bar <= 55,
  'bar '+alto.bar+', fila '+alto.tools);

// --- no se perdió ningún control ---
const CONTROLES = {
  menuArchivo:['libBtn','nbName','folder','toFiles','srvSave','pdf','rec','exp','imp'],
  menuPagina :['pAdd','pDup','pIzq','pDer','pDel','undoRafaga'],
  menuFondo  :['paper','guide','gsize','gsizeLbl','guideMine','bgColor','bgClear','fondoBtn'],
  menuInsertar:['imgIns','imgBg','pdfIn','capturar','pasteBtn'],
  menuVista  :['openProj','full','fit','ladoBtn','nombresBtn','reglasBtn','pencilOnly'],
};
const faltan = await p.evaluate(C=>{
  const f=[];
  for (const [pnl,ids] of Object.entries(C))
    for (const id of ids){
      const e=document.getElementById(id);
      if (!e) { f.push(id+': no existe'); continue; }
      if (!e.closest('#'+pnl)) f.push(id+': no está en '+pnl);
    }
  return f;
}, CONTROLES);
check('los 35 controles siguen ahí y en su menú', faltan.length===0, faltan.join('; '));

// --- cada menú se abre, se ve entero y cabe en la pantalla ---
const MEN = ['mArchivo','mPagina','mFondo','mInsertar','mVista'];
for (const m of MEN){
  await p.click('#'+m); await p.waitForTimeout(120);
  const r = await p.evaluate(id=>{
    const pnl=document.getElementById(MENUS[id]), q=pnl.getBoundingClientRect();
    const abiertos=Object.values(MENUS).filter(x=>document.getElementById(x).classList.contains('abierto'));
    const chicos=[...pnl.querySelectorAll('button,input,select')]
      .filter(e=>e.getBoundingClientRect().width<1).length;
    return {w:q.width, h:q.height, n:abiertos.length, chicos,
            dentro:q.left>=0 && q.right<=innerWidth && q.bottom<=innerHeight};
  }, m);
  check(m+' se abre y se ve entero', r.w>0 && r.h>0 && r.dentro && r.chicos===0,
    JSON.stringify(r));
  check(m+' cierra los demás', r.n===1, r.n+' abiertos');
}
// --- segundo toque cierra ---
await p.click('#mVista'); await p.waitForTimeout(100);
check('el segundo toque cierra el menú', await p.evaluate(()=>!menuAbierto()));

// --- un toque fuera cierra ---
await p.click('#mFondo'); await p.waitForTimeout(100);
await p.mouse.click(300, 600); await p.waitForTimeout(120);
check('tocar fuera cierra el menú', await p.evaluate(()=>!menuAbierto()));

// --- Escape cierra ---
await p.click('#mArchivo'); await p.waitForTimeout(100);
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
check('Escape cierra el menú', await p.evaluate(()=>!menuAbierto()));

// --- tomar una herramienta cierra ---
await p.click('#mPagina'); await p.waitForTimeout(100);
await p.click('#hlBtn'); await p.waitForTimeout(120);
check('tomar el marcador cierra el menú', await p.evaluate(()=>!menuAbierto()));
await p.click('#penBtn');

// --- el gesto de la interfaz alcanza al panel ---
check('el panel está en la zona de interfaz',
  await p.evaluate(()=>!!document.querySelector('.menuDesp').closest(ZONA_INTERFAZ)));

// --- escribir cierra el menú que estorba ---
await p.click('#mInsertar'); await p.waitForTimeout(100);
const caja = await p.evaluate(()=>{const r=document.getElementById('board').getBoundingClientRect();
  return {x:r.left+r.width/2, y:r.top+r.height*0.75};});
await p.mouse.move(caja.x, caja.y); await p.mouse.down();
await p.mouse.move(caja.x+80, caja.y+20); await p.mouse.up();
await p.waitForTimeout(150);
check('empezar a escribir cierra el menú', await p.evaluate(()=>!menuAbierto()));

/* La columna lateral, medida en un iPad y no en el portátil. A 1512 px el
   pizarrón ya está limitado por el alto y quitarla no gana casi nada: 1236 a
   1241. A 1180 manda el ancho, y ahí es donde el interruptor sirve. */
const ctxT = await nav.newContext({viewport:{width:1180,height:820}});
const t = await ctxT.newPage();
await t.goto(BASE+'/?rol=control'); await t.waitForTimeout(2000);
/* En modo Escribir la columna ya está quitada, así que este interruptor se
   mide en Revisar, que es donde existe. */
await revisar(t);
const area = () => t.evaluate(()=>{const M=marcoRect(camB());
  return {w:Math.round(M.w), h:Math.round(M.h), a:Math.round(M.w*M.h)};});
const antes = await area();
await t.click('#mVista'); await t.waitForTimeout(120);
await t.click('#ladoBtn'); await t.waitForTimeout(600);
const despues = await area();
/* +10 %, no más: al quitar la columna el pizarrón deja de estar limitado por
   el ancho y pasa a estarlo por el alto, así que de los 210 px que devuelve la
   columna solo aprovecha 44. Medido, no supuesto. */
check('quitar la columna agranda el pizarrón en un iPad',
  despues.a > antes.a * 1.08 && despues.w > antes.w + 30,
  `${antes.w}×${antes.h} -> ${despues.w}×${despues.h}, `
  + `${Math.round(100*(despues.a/antes.a-1))}% más de área`);
await t.click('#mVista'); await t.waitForTimeout(120);
await t.click('#ladoBtn'); await t.waitForTimeout(600);
const vuelta = await area();
check('volver a ponerla lo devuelve', Math.abs(vuelta.w - antes.w) < 4,
  vuelta.w+' vs '+antes.w);
check('la columna se va de verdad', await t.evaluate(async ()=>{
  await new Promise(r=>setTimeout(r,50));
  document.getElementById('mVista').click();
  document.getElementById('ladoBtn').click();
  await new Promise(r=>setTimeout(r,300));
  const fuera = document.getElementById('side').getBoundingClientRect().height === 0;
  document.getElementById('mVista').click();
  document.getElementById('ladoBtn').click();
  return fuera;
}));

// --- también cabe de una altura en el iPad grande ---
const ctx2 = await nav.newContext({viewport:{width:1366,height:1024}});
const p2 = await ctx2.newPage();
await p2.goto(BASE+'/?rol=control'); await p2.waitForTimeout(2000);
check('a 1366 px la fila sigue de una sola altura',
  await p2.evaluate(()=>document.getElementById('barTools').getBoundingClientRect().height<=40),
  'alto '+await p2.evaluate(()=>Math.round(document.getElementById('barTools').getBoundingClientRect().height)));

check('sin errores de JavaScript', errs.length===0, errs.join(' | '));
await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`menús: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
