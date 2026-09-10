import { chromium } from 'playwright';
import { revisar } from './modo.mjs';
import { tocar, elegir } from './menu.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[],errs=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1440,height:900}});

// proyección primero, como en la vida real
const p=await ctx.newPage();
p.on('pageerror',e=>errs.push('proyeccion: '+e.message));
await p.goto(BASE+'/?rol=proyeccion'); await p.waitForTimeout(1500);
check('la proyección arranca en la pantalla de emparejamiento',
      await p.evaluate(()=>document.body.classList.contains('vacio')));
const url=await p.evaluate(()=>document.getElementById('esperaUrl').textContent);
check('el código apunta al nombre de red estable', !/localhost|127\.0\.0\.1/.test(url), url);
check('el código QR se dibuja',
      await p.evaluate(()=>{const i=document.getElementById('qr');
        return i.style.display==='block' && i.naturalWidth>100;}));
await p.screenshot({path:'./capturas/s1_emparejar.png'});

const c=await ctx.newPage();
c.on('pageerror',e=>errs.push('control: '+e.message));
c.on('console',m=>{if(m.type()==='error')errs.push('consola: '+m.text());});
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(1500);
await revisar(c);

const b=await c.locator('#board').boundingBox();
async function trazo(x0,y0,x1,y1){await c.mouse.move(b.x+x0,b.y+y0);await c.mouse.down();
  for(let i=1;i<=12;i++)await c.mouse.move(b.x+x0+(x1-x0)*i/12,b.y+y0+(y1-y0)*i/12);
  await c.mouse.up();await c.waitForTimeout(50);}

await elegir(c, 'paper', 'verde'); await elegir(c, 'guide', 'cuadros'); await c.waitForTimeout(200);
for(let i=0;i<4;i++) await trazo(120+i*95,140,190+i*95,290);
await c.click('#addStop');
await c.click('#hlBtn'); await trazo(120,320,480,320);
await c.click('#shapeBtn'); await c.click('#shEll'); await trazo(560,150,760,300);
await c.click('#addStop');
await c.waitForTimeout(900);

const e1=await c.evaluate(()=>({n:state.nb.pages[0].items.length,stops:state.nb.pages[0].stops,
  hl:state.nb.pages[0].items.filter(i=>i.hl).length}));
check('trazos, resaltador y forma entran al documento', e1.n===6 && e1.hl===1, JSON.stringify(e1));
check('los stops quedan colocados', e1.stops.length===2, JSON.stringify(e1.stops));

await c.click('#toStart'); await c.waitForTimeout(300);
check('vuelve al inicio', await c.evaluate(()=>state.nb.pages[0].reveal)===0);
await c.click('#nextStop'); await c.waitForTimeout(1500);
check('avanza al primer stop', await c.evaluate(()=>state.nb.pages[0].reveal)===4);
await c.click('#prevStop'); await c.waitForTimeout(300);
check('retrocede', await c.evaluate(()=>state.nb.pages[0].reveal)===0);
await c.screenshot({path:'./capturas/s2_control_fantasmas.png'});

await c.click('#toEnd'); await c.waitForTimeout(1800);
await c.waitForTimeout(900);
const e2=await p.evaluate(()=>({vacio:document.body.classList.contains('vacio'),
  n:state.nb.pages[0].items.length,reveal:state.nb.pages[0].reveal,paper:state.nb.pages[0].paper}));
check('la proyección recibe todo, con su papel', e2.n===6 && e2.paper==='verde', JSON.stringify(e2));
check('el emparejamiento se retira solo', !e2.vacio);
await p.screenshot({path:'./capturas/s3_proyeccion.png'});

// reabrir el QR a media clase
await p.click('#linkBtn'); await p.waitForTimeout(500);
check('el código se puede reabrir sin perder la clase',
      await p.evaluate(()=>document.body.classList.contains('qr')));
await p.screenshot({path:'./capturas/s4_qr_encima.png'});
await p.click('#espera'); await p.waitForTimeout(300);
check('y se cierra con un toque', await p.evaluate(()=>!document.body.classList.contains('qr')));

// guardado en el servidor
await tocar(c, 'srvSave'); await c.waitForTimeout(1200);
// degradación sin CDN
const libs=await c.evaluate(()=>JSON.parse(JSON.stringify(libState)));
check('la falta de CDN no deja basura guardada',
      await c.evaluate(async()=>{const v=await store.get('lib:jspdf'); return !v || !/^\s*</.test(v);}),
      JSON.stringify(libs));

console.log('\n=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('\n=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
const u=[...new Set(errs)];
if(u.length){console.log('\n=== ERRORES ==='); u.forEach(x=>console.log('  '+x));}
console.log(`\n${ok.length} correctas, ${mal.length} fallidas, ${u.length} errores`);
await nav.close();
