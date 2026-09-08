import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1180,height:820}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto((process.env.BASE||BASE)+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ board.setPointerCapture=()=>{}; board.releasePointerCapture=()=>{}; });

// pluma y marcador levantando la pluma en el mismo tick del movimiento,
// que es cuando el cuadro pendiente llega con el trazo ya cerrado
async function trazoRapido(tool, k){
  await c.click(tool); await c.waitForTimeout(120);
  await c.evaluate((k)=>{
    const bb=board.getBoundingClientRect();
    const ev=(t,x,y)=>board.dispatchEvent(new PointerEvent(t,{pointerId:20+k,pointerType:'pen',
      isPrimary:true,clientX:bb.left+x,clientY:bb.top+y,pressure:.6,bubbles:true,cancelable:true}));
    ev('pointerdown',150,120+k*30);
    for(let i=1;i<=6;i++) ev('pointermove',150+i*60,120+k*30);
    ev('pointerup',510,120+k*30);      // sin esperar al cuadro pendiente
  }, k);
  await c.waitForTimeout(90);
}
for (let k=0;k<10;k++) await trazoRapido(k%2 ? '#hlBtn' : '#penBtn', k);
await c.waitForTimeout(900);

const r = await c.evaluate(()=>{
  const L = pg().items;
  return {n:L.length, nulos:L.filter(x=>!x).length,
          sanos:L.every(x=>x && x.k), reveal:pg().reveal};
});
console.log('tras diez trazos alternando pluma y marcador:', JSON.stringify(r));

// ¿sigue viva la app?
await c.click('#penBtn');
await c.evaluate(()=>{
  const bb=board.getBoundingClientRect();
  const ev=(t,x,y)=>board.dispatchEvent(new PointerEvent(t,{pointerId:99,pointerType:'pen',
    isPrimary:true,clientX:bb.left+x,clientY:bb.top+y,pressure:.6,bubbles:true,cancelable:true}));
  ev('pointerdown',200,500);
  for(let i=1;i<=6;i++) ev('pointermove',200+i*50,500);
  ev('pointerup',500,500);
});
await c.waitForTimeout(500);
const fin = await c.evaluate(()=>pg().items.length);
console.log(`se puede seguir escribiendo: ${fin > r.n ? 'SÍ' : 'NO'} (${r.n} -> ${fin})`);
console.log(r.nulos===0 && r.sanos && fin>r.n ? '\nOK' : '\nFALLA');
if(errs.length) console.log('ERRORES:', [...new Set(errs)].join(' | '));
await nav.close();
