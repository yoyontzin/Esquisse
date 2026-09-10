import { chromium } from 'playwright';
import { revisar } from './modo.mjs';
import { sembrarLibs } from './libs.mjs';
import { tocar, elegir } from './menu.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
import fs from 'fs';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1440,height:900}, acceptDownloads:true});
await sembrarLibs(ctx, ['jspdf']);
const c=await ctx.newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto((process.env.BASE||BASE)+'/?rol=control'); await c.waitForTimeout(4000);
await revisar(c);

// tres páginas con stops
const b=await c.locator('#board').boundingBox();
for (let pg=0; pg<3; pg++){
  for (let k=0;k<6;k++){
    await c.mouse.move(b.x+150+k*110, b.y+220); await c.mouse.down();
    for(let i=1;i<=6;i++) await c.mouse.move(b.x+150+k*110+i*10, b.y+220+i*14);
    await c.mouse.up(); await c.waitForTimeout(30);
  }
  await c.evaluate(()=>{ pg().reveal=3; });
  await c.click('#addStop'); await c.waitForTimeout(100);
  await c.evaluate(()=>{ pg().reveal=6; });
  await c.click('#addStop'); await c.waitForTimeout(100);
  if (pg<2){ await tocar(c, 'pAdd'); await c.waitForTimeout(400); }
}
console.log('páginas:', await c.evaluate(()=>state.nb.pages.length));

// el selector de rangos, sin tocar la interfaz
const rangos = await c.evaluate(()=>({
  todas: paginasPedidas('todas', 3),
  vacio: paginasPedidas('', 3),
  uno:   paginasPedidas('2', 3),
  rango: paginasPedidas('1-2', 3),
  mixto: paginasPedidas('1, 3', 3),
  fuera: paginasPedidas('7-9', 3),
  raro:  paginasPedidas('abc', 3),
}));
console.log('rangos:', JSON.stringify(rangos));
check('«todas» y vacío dan el cuaderno entero',
      rangos.todas.length===3 && rangos.vacio.length===3, JSON.stringify(rangos.todas));
check('un número suelto da esa página', rangos.uno.length===1 && rangos.uno[0]===1, JSON.stringify(rangos.uno));
check('un rango da sus páginas', rangos.rango.join()==='0,1', JSON.stringify(rangos.rango));
check('lista mixta', rangos.mixto.join()==='0,2', JSON.stringify(rangos.mixto));
check('lo que se sale del cuaderno se descarta', rangos.fuera.length===0, JSON.stringify(rangos.fuera));

async function exportar(pags, etapas){
  await tocar(c, 'pdf'); await c.waitForTimeout(400);
  await c.fill('#pdfPags', pags);
  const chk = await c.locator('#pdfEtapas').isChecked();
  if (chk !== etapas) await c.click('#pdfEtapas');
  const [dl] = await Promise.all([c.waitForEvent('download',{timeout:30000}), c.click('#pdfOk')]);
  const ruta = './pdf_'+pags.replace(/\W/g,'')+(etapas?'_etapas':'_final')+'.pdf';
  await dl.saveAs(ruta);
  const buf = fs.readFileSync(ruta);
  const hojas = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  return {hojas, bytes:buf.length, ok:buf.slice(0,5).toString('latin1')==='%PDF-'};
}
const todoEtapas = await exportar('todas', true);
console.log('todas por etapas :', JSON.stringify(todoEtapas));
check('el cuaderno entero por etapas da una hoja por stop',
      todoEtapas.ok && todoEtapas.hojas===6, JSON.stringify(todoEtapas));

const todoFinal = await exportar('todas', false);
console.log('todas terminadas :', JSON.stringify(todoFinal));
check('sin etapas, una hoja por página', todoFinal.ok && todoFinal.hojas===3, JSON.stringify(todoFinal));

const soloDos = await exportar('2', false);
console.log('solo la página 2:', JSON.stringify(soloDos));
check('se puede exportar una sola página', soloDos.ok && soloDos.hojas===1, JSON.stringify(soloDos));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
