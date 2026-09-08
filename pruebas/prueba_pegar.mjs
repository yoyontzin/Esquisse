import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1180,height:820}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta();
                       clip=null; document.body.classList.remove('hayPortapapeles'); sync(); });
const b=await c.locator('#board').boundingBox();
for(let k=0;k<3;k++){
  await c.mouse.move(b.x+200+k*90,b.y+250); await c.mouse.down();
  await c.mouse.move(b.x+260+k*90,b.y+340); await c.mouse.up(); await c.waitForTimeout(60);
}
await c.waitForTimeout(400);
const n = () => c.evaluate(()=>pg().items.length);
const barra = () => c.evaluate(()=>getComputedStyle(document.getElementById('pegarBar')).display);

check('nada cortado, sin barra de pegar', await barra()==='none', await barra());
await c.evaluate(()=>{ sel=[0,1]; refreshSelBar(); });
await c.evaluate(()=>selCut());
await c.waitForTimeout(700);
check('cortar deja un elemento', await n()===1, String(await n()));
check('tras cortar aparece «Pegar aquí»', await barra()!=='none', await barra());
check('y dice cuántos lleva',
      /2/.test(await c.evaluate(()=>document.getElementById('pegarCnt').textContent)),
      await c.evaluate(()=>document.getElementById('pegarCnt').textContent));

await c.click('#pegarYa'); await c.waitForTimeout(800);
check('pegar devuelve los elementos', await n()===3, String(await n()));

// también en modo clase, que es donde no había ni botón
await c.evaluate(()=>{ sel=[0]; refreshSelBar(); selCut(); });
await c.waitForTimeout(600);
await c.evaluate(()=>setClase(true)); await c.waitForTimeout(500);
check('la barra de pegar se ve en modo clase', await barra()!=='none', await barra());
const dock = await c.evaluate(()=>{
  const v = id => { const e=document.getElementById(id); if(!e) return 'FALTA';
    const r=e.getBoundingClientRect(); return r.width>0 ? 'sí':'no'; };
  return {goma:v('dErase'), deshacer:v('dUndo'), rehacer:v('dRedo'),
          puntero:v('dPoint'), colores:document.querySelectorAll('#dockColors .swatch').length};
});
console.log('en el dock de clase:', JSON.stringify(dock));
check('la goma está en el dock de clase', dock.goma==='sí');
check('deshacer está en el dock de clase', dock.deshacer==='sí');
check('el puntero está en el dock de clase', dock.puntero==='sí');
check('los colores están en el dock de clase', dock.colores>0, dock.colores+' colores');
await c.screenshot({path:'./modo_clase.png'});
await c.evaluate(()=>setClase(false));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
