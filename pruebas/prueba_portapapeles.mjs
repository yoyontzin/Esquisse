import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta();
                       clip=null; document.body.classList.remove('hayPortapapeles'); sync(); });
const b=await c.locator('#board').boundingBox();
for(let k=0;k<3;k++){
  await c.mouse.move(b.x+250+k*80,b.y+300); await c.mouse.down();
  await c.mouse.move(b.x+310+k*80,b.y+380); await c.mouse.up(); await c.waitForTimeout(60); }
await c.waitForTimeout(400);
await c.click('#lassoBtn'); await c.waitForTimeout(300);
await c.mouse.move(b.x+200,b.y+260); await c.mouse.down();
for (const [x,y] of [[560,260],[560,420],[200,420],[200,260]]) await c.mouse.move(b.x+x,b.y+y);
await c.mouse.up(); await c.waitForTimeout(600);
const vis = id => c.evaluate(i=>{const e=document.getElementById(i);
  return !!e && getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0;}, id);

check('con selección, sin nada copiado, no se ofrece pegar', !(await vis('selPegar')));
check('cortar y copiar están a la vista', await vis('selCut') && await vis('selCopy'));

const antes = await c.evaluate(()=>pg().items.length);
await c.click('#selCopy'); await c.waitForTimeout(700);
check('copiar llena el portapapeles', await c.evaluate(()=>clip&&clip.length)===3);
check('y entonces ya se ofrece pegar en la misma barra', await vis('selPegar'));
await c.click('#selCut'); await c.waitForTimeout(800);
check('cortar quita lo seleccionado', await c.evaluate(()=>pg().items.length)===0, String(await c.evaluate(()=>pg().items.length)));

// con el lazo puesto y nada seleccionado, la barra sigue ofreciendo pegar
await c.waitForTimeout(400);
check('sin selección pero con algo copiado, la barra ofrece pegar',
      await vis('selPegar') && await c.evaluate(()=>document.getElementById('selBar').classList.contains('open')));
check('y no enseña cortar, que no tendría sentido', !(await vis('selCut')));
await c.click('#selPegar'); await c.waitForTimeout(900);
check('pegar desde la barra del lazo devuelve los elementos',
      await c.evaluate(()=>pg().items.length)===3, String(await c.evaluate(()=>pg().items.length)));

// y los toques sobre las barras no se cancelan
const zona = await c.evaluate(()=>{
  const t = document.getElementById('pegarYa') || document.getElementById('selPegar');
  return !!(t && t.closest(ZONA_INTERFAZ));
});
check('los botones de las barras cuentan como interfaz y no se les corta el toque', zona);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
