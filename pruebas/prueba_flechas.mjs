import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto((process.env.BASE||BASE)+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });
await c.selectOption('#paper','gis'); await c.waitForTimeout(800);
const b=await c.locator('#board').boundingBox();
async function arrastra(x0,y0,x1,y1){
  await c.mouse.move(b.x+x0,b.y+y0); await c.mouse.down();
  for(let i=1;i<=8;i++) await c.mouse.move(b.x+x0+(x1-x0)*i/8, b.y+y0+(y1-y0)*i/8);
  await c.mouse.up(); await c.waitForTimeout(150);
}
const ang = () => c.evaluate(()=>{
  const p = pg().items[pg().items.length-1].pts;
  const a=p[0], z=p[1];
  return +(Math.atan2(z.y-a.y, z.x-a.x)*180/Math.PI).toFixed(2);
});

await c.click('#shapeBtn'); await c.click('#shArrow'); await c.waitForTimeout(200);
await arrastra(200,300,600,302);          // casi horizontal
check('la flecha entra al documento', await c.evaluate(()=>pg().items.length)===1);
check('una recta casi horizontal se endereza', Math.abs(await ang()) < .01, await ang()+'°');
const puntos = await c.evaluate(()=>pg().items[0].pts.length);
check('la flecha lleva punta', puntos===5, puntos+' puntos');

await arrastra(200,400,500,573);           // ~30 grados
check('se ajusta a 30 grados', Math.abs(await ang()-30) < .01, await ang()+'°');

const antesLibre = await c.evaluate(()=>pg().items.length);
await arrastra(200,480,420,300);           // ~-39 grados: lejos de un notable
check('el trazo de ángulo libre se creó',
      await c.evaluate(()=>pg().items.length) === antesLibre+1);
const libre = await ang();
check('un ángulo cualquiera se respeta tal cual',
      Math.abs(libre % 15) > 1, libre+'°');

await c.click('#shLine'); await c.waitForTimeout(200);
await arrastra(700,250,704,600);           // casi vertical
check('la recta también se ajusta', Math.abs(await ang()-90) < .01, await ang()+'°');
check('la recta no lleva punta', await c.evaluate(()=>pg().items[pg().items.length-1].pts.length)===2);

await c.screenshot({path:'./flechas.png'});
console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
