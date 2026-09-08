import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:860}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });
await c.selectOption('#paper','gis'); await c.waitForTimeout(700);
await c.click('#pointBtn'); await c.waitForTimeout(200);
const b=await c.locator('#board').boundingBox();

// escribir "x2+1" con el puntero: varios trazos separados por pausas
async function trazoPuntero(pts){
  await c.mouse.move(b.x+pts[0][0], b.y+pts[0][1]); await c.mouse.down();
  for (const [x,y] of pts.slice(1)) await c.mouse.move(b.x+x, b.y+y);
  await c.mouse.up(); await c.waitForTimeout(500);   // pausa entre trazos
}
await trazoPuntero([[300,300],[360,380]]);      // x
await trazoPuntero([[360,300],[300,380]]);
await trazoPuntero([[380,290],[410,285],[415,310],[385,325],[415,325]]);  // 2
await trazoPuntero([[450,340],[510,340]]);      // +
await trazoPuntero([[480,310],[480,370]]);
await trazoPuntero([[550,300],[550,380]]);      // 1
await c.waitForTimeout(300);

const t = await c.evaluate(()=>({trazos:ptr.trazos.length, puntos:ptrPuntos()}));
console.log('estela:', JSON.stringify(t));
check('la estela guarda varios trazos, no uno', t.trazos >= 5, JSON.stringify(t));
check('no se borró lo anterior al levantar la pluma', t.puntos > 10, t.puntos+' puntos');
await c.screenshot({path:'./estela.png', clip:{x:b.x+200, y:b.y+220, width:520, height:260}});

// sigue viva pasados varios segundos
await c.waitForTimeout(4000);
const t4 = await c.evaluate(()=>ptrPuntos());
check('a los cuatro segundos sigue ahí', t4 > 0, t4+' puntos');

// y se borra sola, sin dejar nada en el documento
await c.waitForTimeout(7000);
const t11 = await c.evaluate(()=>({puntos:ptrPuntos(), items:pg().items.length}));
console.log('pasados once segundos:', JSON.stringify(t11));
check('acaba borrándose sola', t11.puntos===0, JSON.stringify(t11));
check('no deja nada escrito en la página', t11.items===0, String(t11.items));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
