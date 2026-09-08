/* Escribir con la palma apoyada, que es como se escribe de verdad: la pluma
   llega como puntero `pen` y la palma como `touch`, y la palma se apoya y se
   levanta en cualquier orden.
   Regresión vigilada: al proteger la forma de que la palma la cerrara, un
   apunte colgado llegó a bloquear el guardado de TODOS los trazos, que se
   veían al escribir y desaparecían al repintar. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);

// un trazo de pluma con la palma entrando y saliendo alrededor
await c.evaluate(()=>{ board.setPointerCapture = ()=>{}; board.releasePointerCapture = ()=>{}; });
async function trazo(k, palmaPrimero, palmaSueltaAntes){
  await c.evaluate(([k, palmaPrimero, palmaSueltaAntes])=>{
    const bb = board.getBoundingClientRect();
    const y = bb.top + 90 + k*42;
    const ev = (t, id, tipo, x, yy) => board.dispatchEvent(new PointerEvent(t, {
      pointerId:id, pointerType:tipo, isPrimary:tipo==='pen',
      clientX:bb.left+x, clientY:yy, pressure:.6, bubbles:true, cancelable:true}));
    const PLUMA = 100+k*2, PALMA = 500+k*2;
    if (palmaPrimero) ev('pointerdown', PALMA, 'touch', 120, y+130);
    ev('pointerdown', PLUMA, 'pen', 180, y);
    if (!palmaPrimero) ev('pointerdown', PALMA, 'touch', 120, y+130);
    for (let i=1;i<=8;i++){
      ev('pointermove', PLUMA, 'pen', 180+i*45, y);
      ev('pointermove', PALMA, 'touch', 120, y+130);
    }
    if (palmaSueltaAntes){
      ev('pointerup', PALMA, 'touch', 120, y+130);
      ev('pointerup', PLUMA, 'pen', 540, y);
    } else {
      ev('pointerup', PLUMA, 'pen', 540, y);
      ev('pointerup', PALMA, 'touch', 120, y+130);
    }
  }, [k, palmaPrimero, palmaSueltaAntes]);
  await c.waitForTimeout(90);
}

const n = () => c.evaluate(()=>pg().items.length);
// las cuatro combinaciones de orden, repetidas
for (let k=0;k<8;k++) await trazo(k, k%2===0, Math.floor(k/2)%2===0);
await c.waitForTimeout(700);
const tras8 = await n();
console.log('trazos guardados con la palma de por medio:', tras8, 'de 8');
check('todos los trazos se guardan con la palma entrando y saliendo', tras8===8, tras8+' de 8');

for (let k=8;k<14;k++) await trazo(k, true, true);
await c.waitForTimeout(700);
const tras14 = await n();
check('el guardado no se bloquea con el uso', tras14===14, tras14+' de 14');
check('no queda ningún puntero apuntado al terminar',
      await c.evaluate(()=>dibujante===null), 'dibujante='+await c.evaluate(()=>String(dibujante)));

await c.evaluate(()=>sync());
await c.waitForTimeout(300);
check('lo escrito sigue ahí tras repintar', await n()===14, String(await n()));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
