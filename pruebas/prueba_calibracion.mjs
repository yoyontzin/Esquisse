import { chromium } from 'playwright';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true})).newPage();
await c.goto((process.env.BASE||BASE)+'/?rol=control'); await c.waitForTimeout(2500);
const d = async () => c.evaluate(()=>{
  const bb=board.getBoundingClientRect();
  return +(bb.height-board._cssH).toFixed(1);
});
console.log('desfase al inicio:', await d());

// cambios de tamaño que NO disparan resize de ventana
for (const [nota, alto] of [['viewport 900',900],['viewport 760',760],['viewport 820',820]]){
  await c.setViewportSize({width:1180, height:alto});
  await c.waitForTimeout(20);          // mucho antes de los 60 ms del refit
  console.log(`${nota.padEnd(16)} desfase inmediato: ${await d()}`);
}
// cambio de altura de barra sin resize
await c.evaluate(()=>{ document.getElementById('bar').style.paddingTop='40px'; });
await c.waitForTimeout(30);
console.log('barra 40px más alta   desfase inmediato:', await d());
await c.evaluate(()=>{ document.getElementById('bar').style.paddingTop=''; });
await c.waitForTimeout(30);
console.log('barra restaurada      desfase inmediato:', await d());

// y que el trazo caiga donde se toca, justo tras un cambio
await c.setViewportSize({width:1180, height:880});
await c.waitForTimeout(15);
const b = await c.locator('#board').boundingBox();
const yT = b.y + 240;
await c.mouse.move(b.x+280, yT); await c.mouse.down();
await c.mouse.move(b.x+520, yT); await c.mouse.up();
await c.waitForTimeout(400);
const r = await c.evaluate(()=>{
  const it=pg().items[pg().items.length-1], cam=camB(), bb=board.getBoundingClientRect();
  const esc = bb.height/board._cssH;
  return +(((it.pts[0].y-cam.y)*cam.s*esc + bb.top)).toFixed(1);
});
console.log(`\ntocado y=${yT.toFixed(1)}  dibujado y=${r}  error=${(r-yT).toFixed(1)} px`);
check('escribe donde apoyas la pluma', Math.abs(r-yT)<2, `error ${(r-yT).toFixed(1)} px`);
await nav.close();

/* Estas cinco pruebas imprimían su veredicto y salían con código cero pasara
   lo que pasara: `correr.sh` las contaba en verde incluso escribiendo «SE
   PIERDE EL TRABAJO». El 12 % del contrato era decorativo. */
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`calibración: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
