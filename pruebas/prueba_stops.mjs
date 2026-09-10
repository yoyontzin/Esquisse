/* Saltar y reproducir son cosas distintas.
   «Siguiente stop» aparece el tramo de golpe. «Reproducir» lo escribe y se
   detiene en el stop, nunca sigue de largo hasta el final. */
import { chromium } from 'playwright';
import { revisar } from './modo.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await revisar(c);

const b=await c.locator('#board').boundingBox();
for (let k=0;k<18;k++){
  const x=130+(k%9)*110, y=220+Math.floor(k/9)*150;
  await c.mouse.move(b.x+x,b.y+y); await c.mouse.down();
  for(let i=1;i<=9;i++) await c.mouse.move(b.x+x+i*9, b.y+y+i*11);
  await c.mouse.up(); await c.waitForTimeout(35);
}
await c.waitForTimeout(500);
for (const r of [5,10,15]){
  await c.evaluate(v=>{ pg().reveal=v; }, r);
  await c.click('#addStop'); await c.waitForTimeout(100);
}
await c.evaluate(()=>{ pg().reveal=0; sync(); });
await c.waitForTimeout(300);
const rev = () => c.evaluate(()=>pg().reveal);
const animando = () => c.evaluate(()=>reproduciendo());

// --- saltar: instantáneo ---
const t0 = Date.now();
await c.click('#nextStop');
await c.waitForTimeout(120);            // muy poco para cualquier animación
const trasSalto = await rev();
check('«Siguiente stop» salta de golpe, sin escribir',
      trasSalto===5 && !(await animando()), `reveal=${trasSalto} en ${Date.now()-t0} ms`);

await c.click('#nextStop'); await c.waitForTimeout(120);
check('un salto más llega al segundo stop', await rev()===10, 'reveal='+await rev());
await c.click('#prevStop'); await c.waitForTimeout(120);
check('retroceder también es instantáneo', await rev()===5, 'reveal='+await rev());

// --- reproducir: escribe y se para en el stop ---
await c.evaluate(()=>{ pg().reveal=0; sync(); });
await c.locator('#speed').fill('40');   // lento, para poder observarlo
await c.waitForTimeout(200);
await c.click('#playBtn');
await c.waitForTimeout(250);
const enMedio = await rev();
const animaba = await animando();
check('«Reproducir» va escribiendo, no salta', animaba && enMedio < 5,
      `reveal=${enMedio} animando=${animaba}`);

// esperar a que llegue al stop
for (let i=0;i<80 && await animando(); i++) await c.waitForTimeout(150);
const parada = await rev();
check('se detiene justo en el primer stop, no sigue de largo', parada===5, 'reveal='+parada);

await c.click('#playBtn');
for (let i=0;i<80 && await animando(); i++) await c.waitForTimeout(150);
check('la siguiente reproducción se para en el segundo stop', await rev()===10, 'reveal='+await rev());

// --- sin stops por delante, reproducir llega al final ---
await c.evaluate(()=>{ pg().reveal=15; sync(); });
await c.click('#playBtn');
for (let i=0;i<80 && await animando(); i++) await c.waitForTimeout(150);
const fin = await c.evaluate(()=>({r:pg().reveal, n:pg().items.length}));
check('pasado el último stop sí llega al final', fin.r===fin.n, JSON.stringify(fin));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
