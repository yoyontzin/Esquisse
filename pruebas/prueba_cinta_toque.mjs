/* Tocar un cuadrito de la cinta lo selecciona; arrastrar sigue recorriendo la
   clase. Es la forma directa de quitar una letra suelta sin contar trazos. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:900}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); encuadrar(); sync(); });

const b=await c.locator('#board').boundingBox();
const X=[100,180,260,340,420,500];   // seis trazos identificables por posición
for(const x of X){
  await c.mouse.move(b.x+x,b.y+200); await c.mouse.down();
  for(let i=1;i<=8;i++) await c.mouse.move(b.x+x+i*5, b.y+200);
  await c.mouse.up(); await c.waitForTimeout(70);
}
await c.waitForTimeout(300);
check('seis trazos escritos', await c.evaluate(()=>pg().items.length)===6);

const r = await c.locator('#ribbon').boundingBox();
const enCuadrito = k => r.x + r.width*(k+0.5)/6;   // centro del cuadrito k

// toque seco sobre el tercer cuadrito
await c.mouse.move(enCuadrito(2), r.y+r.height/2);
await c.mouse.down(); await c.mouse.up();
await c.waitForTimeout(400);
const s1 = await c.evaluate(()=>sel.slice());
check('un toque selecciona ese cuadrito y no otro',
      s1.length===1 && s1[0]===2, JSON.stringify(s1));
check('la barra de selección se abre',
      await c.evaluate(()=>document.getElementById('selBar').classList.contains('open')));

// borrarlo desde la barra quita justo ese, no el último
await c.click('#selDel'); await c.waitForTimeout(400);
const xs = await c.evaluate(()=>pg().items.map(it=>Math.round(it.pts[0].x)));
check('queda uno menos', xs.length===5, String(xs.length));
/* Los seis trazos arrancan en pantalla en 100,180,...,500, y el pizarrón está
   encuadrado, así que en mundo van creciendo en el mismo orden. Se borró el
   tercero, o sea el del medio: el hueco tiene que estar ahí y no al final. */
const ordenado = xs.every((v,i)=> i===0 || v > xs[i-1]);
check('lo que queda sigue en orden', ordenado, JSON.stringify(xs));
const huecos = xs.slice(1).map((v,i)=> v - xs[i]);
const mayor = Math.max(...huecos);
check('el hueco quedó en medio, o sea se borró el tercero y no el último',
      huecos.indexOf(mayor) === 1, JSON.stringify(huecos));

// arrastrar sigue recorriendo, sin seleccionar
await c.evaluate(()=>{ sel=[]; refreshSelBar(); });
await c.mouse.move(r.x + r.width*0.9, r.y+r.height/2);
await c.mouse.down();
await c.mouse.move(r.x + r.width*0.3, r.y+r.height/2, {steps:8});
await c.mouse.up(); await c.waitForTimeout(400);
const s2 = await c.evaluate(()=>sel.slice());
const rev = await c.evaluate(()=>pg().reveal);
check('arrastrar no selecciona nada', s2.length===0, JSON.stringify(s2));
check('arrastrar sí mueve el revelado', rev>0 && rev<5, String(rev));

// deshacer devuelve lo borrado
await c.evaluate(()=>deshacer()); await c.waitForTimeout(400);
check('deshacer devuelve el trazo borrado desde la cinta',
      await c.evaluate(()=>pg().items.length)===6,
      String(await c.evaluate(()=>pg().items.length)));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
process.exit(mal.length?1:0);
