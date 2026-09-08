import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true});
const c=await ctx.newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto((process.env.BASE||BASE)+'/?rol=control'); await c.waitForTimeout(2500);
const b=await c.locator('#board').boundingBox();

// --- suavizado: un trazo temblón ---
async function tembloroso(){
  await c.mouse.move(b.x+200, b.y+250); await c.mouse.down();
  for(let i=1;i<=30;i++)
    await c.mouse.move(b.x+200+i*12, b.y+250 + (i%2? 7:-7) + Math.sin(i/2)*3);
  await c.mouse.up(); await c.waitForTimeout(200);
}
const rugosidad = async () => c.evaluate(()=>{
  const p = pg().items[pg().items.length-1].pts;
  let s=0;                       // suma de cambios de dirección: el temblor
  for(let i=2;i<p.length;i++){
    const a1=Math.atan2(p[i-1].y-p[i-2].y, p[i-1].x-p[i-2].x);
    const a2=Math.atan2(p[i].y-p[i-1].y, p[i].x-p[i-1].x);
    let d=Math.abs(a2-a1); if(d>Math.PI) d=2*Math.PI-d;
    s+=d;
  }
  return +s.toFixed(2);
});
await tembloroso();
const conSuave = await rugosidad();
const nSuave = await c.evaluate(()=>pg().items[pg().items.length-1].pts.length);
await c.evaluate(()=>document.getElementById('suaveBtn').click()); await c.waitForTimeout(200);
await tembloroso();
const sinSuave = await rugosidad();
const nCrudo = await c.evaluate(()=>pg().items[pg().items.length-1].pts.length);
console.log(`temblor con «Mejorar letra»: ${conSuave}   sin ella: ${sinSuave}`);
check('el suavizado quita temblor', conSuave < sinSuave*0.75, `${conSuave} vs ${sinSuave}`);
check('no se pierden puntos al suavizar', nSuave===nCrudo, `${nSuave} vs ${nCrudo}`);
await c.evaluate(()=>document.getElementById('suaveBtn').click()); await c.waitForTimeout(200);

// --- lazo por pulsación larga con la pluma ---
await c.evaluate(()=>{ const P=pg(); P.items.length=0; P.reveal=0; sync(); });
await c.click('#penBtn'); await c.waitForTimeout(200);
// escribir normal NO debe abrir el lazo
await c.mouse.move(b.x+300, b.y+300); await c.mouse.down();
for(let i=1;i<=12;i++){ await c.mouse.move(b.x+300+i*15, b.y+300+i*8); await c.waitForTimeout(70); }
await c.mouse.up(); await c.waitForTimeout(300);
check('escribir normal no abre el lazo', await c.evaluate(()=>ui.tool)==='pen',
      'herramienta='+await c.evaluate(()=>ui.tool));

// pluma quieta: se simula el evento de tipo pen
await c.evaluate(()=>{
  const bb = board.getBoundingClientRect();
  const ev = t => new PointerEvent(t, {pointerId:9, pointerType:'pen', isPrimary:true,
    clientX:bb.left+400, clientY:bb.top+400, pressure:.6, bubbles:true, cancelable:true});
  board.setPointerCapture = ()=>{};
  board.dispatchEvent(ev('pointerdown'));
});
const nAntes = await c.evaluate(()=>pg().items.length);
await c.waitForTimeout(900);          // más que la espera del lazo
const tras = await c.evaluate(()=>({tool:ui.tool, lazo:lassoing, n:pg().items.length}));
console.log('tras dejar la pluma quieta:', JSON.stringify(tras));
check('la pluma quieta abre el lazo', tras.tool==='lasso' && tras.lazo, JSON.stringify(tras));
check('el punto de apoyo no deja trazo', tras.n===nAntes, `${nAntes} -> ${tras.n}`);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
