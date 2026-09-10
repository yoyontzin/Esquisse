import { chromium } from 'playwright';
import { revisar } from './modo.mjs';
import { tocar, elegir } from './menu.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1440,height:900}});
const c=await ctx.newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
c.on('console',m=>{if(m.type()==='error')errs.push('consola: '+m.text());});
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await revisar(c);

const b=await c.locator('#board').boundingBox();
async function trazo(x0,y0,x1,y1){await c.mouse.move(b.x+x0,b.y+y0);await c.mouse.down();
  for(let i=1;i<=12;i++)await c.mouse.move(b.x+x0+(x1-x0)*i/12,b.y+y0+(y1-y0)*i/12);
  await c.mouse.up();await c.waitForTimeout(45);}

await elegir(c, 'paper', 'gis');
await c.waitForTimeout(1200);

// --- grosor: el punto sigue al deslizador ---
const d1 = await c.evaluate(()=>getComputedStyle(document.getElementById('widthDot')).width);
await c.locator('#width').fill('12');
await c.waitForTimeout(250);
const d2 = await c.evaluate(()=>getComputedStyle(document.getElementById('widthDot')).width);
check('el indicador de grosor crece con el deslizador', parseFloat(d2) > parseFloat(d1), `${d1} -> ${d2}`);
const w = await c.evaluate(()=>ui.width);
check('el grosor de la punta se aplica', w===12, 'ui.width='+w);
await c.locator('#width').fill('4'); await c.waitForTimeout(150);

// --- punteado ---
await trazo(200,220,760,220);                       // continuo
await c.evaluate(()=>document.getElementById('dashBtn').click()); await c.waitForTimeout(250);
check('el botón de punteado queda marcado',
      await c.evaluate(()=>document.getElementById('dashBtn').classList.contains('on')));
await trazo(200,300,760,300);                       // punteado
await c.click('#shapeBtn'); await c.click('#shLine');
await trazo(200,380,760,380);                       // recta punteada
await c.waitForTimeout(400);
const its = await c.evaluate(()=>state.nb.pages[0].items.map(i=>({dash:!!i.dash,w:i.w,t:!!i.t})));
check('el trazo punteado se guarda como tal',
      its.length===3 && its[0].dash===false && its[1].dash===true && its[2].dash===true,
      JSON.stringify(its));
check('los elementos llevan hora, para poder borrar por ráfaga',
      its.every(i=>i.t), JSON.stringify(its.map(i=>i.t)));
await c.click('#penBtn'); await c.evaluate(()=>document.getElementById('dashBtn').click());   // volver a continuo
await c.waitForTimeout(200);
await c.screenshot({path:'./nuevo_punteado.png'});

// --- borrado por ráfaga ---
await c.waitForTimeout(4500);   // deja cerrar la ventana de ráfaga
const antes = await c.evaluate(()=>state.nb.pages[0].items.length);
for (let i=0;i<5;i++) await trazo(250+i*70,470,300+i*70,560);   // una ráfaga seguida
await c.waitForTimeout(300);
const conRafaga = await c.evaluate(()=>state.nb.pages[0].items.length);
await tocar(c, 'undoRafaga'); await c.waitForTimeout(500);
const despues = await c.evaluate(()=>state.nb.pages[0].items.length);
check('borrar lo último quita la ráfaga entera, no un trazo',
      conRafaga===antes+5 && despues===antes, `${antes} -> ${conRafaga} -> ${despues}`);

// --- deshacer sigue quitando de a uno ---
await trazo(900,470,980,560);
const u1 = await c.evaluate(()=>state.nb.pages[0].items.length);
await c.click('#undo'); await c.waitForTimeout(300);
const u2 = await c.evaluate(()=>state.nb.pages[0].items.length);
check('deshacer sigue quitando un solo trazo', u2===u1-1, `${u1} -> ${u2}`);

// --- página intermedia ---
await tocar(c, 'pAdd'); await c.waitForTimeout(500);
const pgs = await c.evaluate(()=>({n:state.nb.pages.length, i:state.pi,
  vacia:state.nb.pages[state.pi].items.length===0}));
check('la página nueva entra después de la actual y llega vacía',
      pgs.n===2 && pgs.i===1 && pgs.vacia, JSON.stringify(pgs));

// --- velocidad de presentación: recorrido largo, escala exponencial ---
await c.locator('#speed').fill('0');   await c.waitForTimeout(150);
const vMin = await c.evaluate(()=>ui.speed);
await c.locator('#speed').fill('100'); await c.waitForTimeout(150);
const vMax = await c.evaluate(()=>ui.speed);
await c.locator('#speed').fill('55');  await c.waitForTimeout(150);
const vMed = await c.evaluate(()=>ui.speed);
check('la velocidad llega de muy lenta a muy rápida',
      vMin <= 0.1 && vMax >= 12, `${vMin}x .. ${vMax}x`);
check('el centro del deslizador deja la velocidad de siempre',
      Math.abs(vMed-1.5) < .2, vMed+'x');
check('la lectura de velocidad se muestra',
      /\d/.test(await c.evaluate(()=>document.getElementById('speedLbl').textContent)),
      await c.evaluate(()=>document.getElementById('speedLbl').textContent));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
const u=[...new Set(errs)]; if(u.length){console.log('=== ERRORES ==='); u.forEach(x=>console.log('  '+x));}
console.log(`\n${ok.length} correctas, ${mal.length} fallidas, ${u.length} errores`);
await nav.close();
