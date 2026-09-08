/* Deshacer y rehacer sobre operaciones, no solo sobre el último trazo.
   Lo que se comprueba es lo que antes no tenía vuelta: borrar con el lazo,
   mover, recolorear, borrar de golpe. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:860}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

const b=await c.locator('#board').boundingBox();
async function trazo(k){
  const y=170+k*45;
  await c.mouse.move(b.x+160,b.y+y); await c.mouse.down();
  for(let i=1;i<=8;i++) await c.mouse.move(b.x+160+i*55, b.y+y);
  await c.mouse.up(); await c.waitForTimeout(70);
}
const n = () => c.evaluate(()=>pg().items.length);
const primerPunto = () => c.evaluate(()=>{
  const it = pg().items[0]; return it ? JSON.stringify(it.pts[0]) : null; });
const color0 = () => c.evaluate(()=>pg().items[0] ? pg().items[0].c : null);

for (let k=0;k<6;k++) await trazo(k);
await c.waitForTimeout(400);
check('seis trazos escritos', await n()===6, String(await n()));

// deshacer trazos uno a uno y rehacerlos
await c.click('#undo'); await c.waitForTimeout(350);
check('deshacer quita el último trazo', await n()===5, String(await n()));
await c.click('#undo'); await c.waitForTimeout(350);
check('y el anterior', await n()===4, String(await n()));
await c.click('#rehacer'); await c.waitForTimeout(350);
check('rehacer lo devuelve', await n()===5, String(await n()));
await c.click('#rehacer'); await c.waitForTimeout(350);
check('y el siguiente', await n()===6, String(await n()));

// lo que antes no tenía vuelta: borrar una selección
await c.evaluate(()=>{ sel=[0,1,2]; selDelete(); }); await c.waitForTimeout(400);
check('borrar con el lazo quita tres', await n()===3, String(await n()));
await c.click('#undo'); await c.waitForTimeout(400);
check('se puede deshacer un borrado con el lazo', await n()===6, String(await n()));

// mover
const antesMover = await primerPunto();
await c.evaluate(()=>{ sel=[0]; apuntar(); moveItem(items()[0], 150, 90);
                       edicion(); touch(); sync(); });
await c.waitForTimeout(400);
check('mover cambia la posición', await primerPunto() !== antesMover);
await c.click('#undo'); await c.waitForTimeout(400);
check('se puede deshacer un movimiento', await primerPunto() === antesMover,
      `${antesMover} vs ${await primerPunto()}`);

// recolorear
const antesColor = await color0();
await c.evaluate(()=>{ sel=[0]; ui.slot=4; selApplyColor(); }); await c.waitForTimeout(400);
check('recolorear cambia el color', await color0() !== antesColor);
await c.click('#undo'); await c.waitForTimeout(400);
check('se puede deshacer un recoloreado', await color0() === antesColor,
      `${antesColor} vs ${await color0()}`);

// borrar lo último de golpe
const antesRafaga = await n();
await c.click('#undoRafaga'); await c.waitForTimeout(500);
const trasRafaga = await n();
await c.click('#undo'); await c.waitForTimeout(500);
check('se puede deshacer «borrar lo último»', await n()===antesRafaga,
      `${antesRafaga} -> ${trasRafaga} -> ${await n()}`);

// stops
await c.evaluate(()=>{ pg().reveal=2; }); await c.click('#addStop'); await c.waitForTimeout(300);
const conStop = await c.evaluate(()=>pg().stops.length);
await c.click('#undo'); await c.waitForTimeout(400);
check('se puede deshacer un stop', await c.evaluate(()=>pg().stops.length) === conStop-1,
      `${conStop} -> ${await c.evaluate(()=>pg().stops.length)}`);

// los botones se apagan cuando no hay nada
await c.evaluate(()=>{ olvidarHistorial(); });
await c.waitForTimeout(200);
check('los botones se apagan sin historial',
      await c.evaluate(()=>document.getElementById('undo').disabled &&
                           document.getElementById('rehacer').disabled));

// escribir después de deshacer descarta el futuro
await trazo(9); await c.waitForTimeout(300);
await c.click('#undo'); await c.waitForTimeout(300);
await trazo(9); await c.waitForTimeout(300);
check('escribir tras deshacer cierra el rehacer',
      await c.evaluate(()=>document.getElementById('rehacer').disabled));

// el tope no crece sin fin
const tope = await c.evaluate(async ()=>{
  for (let i=0;i<70;i++){ apuntar(); }
  return hist.length;
});
check('el historial tiene tope', tope <= 40, tope+' pasos');

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
