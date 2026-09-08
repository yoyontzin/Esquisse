import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const B = process.env.BASE || BASE;
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:860}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(3000);

// --- reordenar páginas ---
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });
const b=await c.locator('#board').boundingBox();
for (let k=0;k<3;k++){
  if (k) { await c.click('#pAdd'); await c.waitForTimeout(400); }
  for (let i=0;i<=k;i++){          // k+1 trazos, para reconocer la página
    await c.mouse.move(b.x+200+i*70, b.y+250); await c.mouse.down();
    await c.mouse.move(b.x+260+i*70, b.y+330); await c.mouse.up(); await c.waitForTimeout(60);
  }
}
await c.waitForTimeout(800);
const marcas = () => c.evaluate(()=>state.nb.pages.map(P=>P.items.length).join(','));
check('tres páginas con 1, 2 y 3 trazos', await marcas()==='1,2,3', await marcas());
await c.evaluate(()=>{ state.pi=2; sync(); }); await c.waitForTimeout(400);
await c.click('#pIzq'); await c.waitForTimeout(700);
check('la página se mueve una antes', await marcas()==='1,3,2', await marcas());
check('y se va con ella', await c.evaluate(()=>state.pi)===1);
await c.click('#pIzq'); await c.waitForTimeout(700);
check('y otra vez', await marcas()==='3,1,2', await marcas());
await c.click('#pDer'); await c.waitForTimeout(700);
check('también hacia el otro lado', await marcas()==='1,3,2', await marcas());
await c.evaluate(()=>{ state.pi=0; sync(); }); await c.waitForTimeout(300);
await c.click('#pIzq'); await c.waitForTimeout(400);
check('la primera no se sale por la izquierda', await marcas()==='1,3,2', await marcas());

// --- cada cuaderno su archivo ---
await c.evaluate(()=>{ state.nb.name='Clase'; touch(); }); await c.waitForTimeout(3000);
await c.click('#libBtn'); await c.waitForTimeout(500);
await c.click('#libNew'); await c.waitForTimeout(900);
await c.evaluate(()=>{ state.nb.name='Clase'; touch(); });
await c.mouse.move(b.x+300,b.y+300); await c.mouse.down();
await c.mouse.move(b.x+420,b.y+380); await c.mouse.up();
await c.waitForTimeout(3500);
const lista = await (await fetch(B+'/cuadernos')).json();
console.log('archivos:', lista.map(f=>f.archivo).join(' | '));
check('dos cuadernos con el mismo nombre no se pisan', lista.length>=2, lista.length+' archivos');

// --- aviso de enlace caído ---
const antes = await c.evaluate(()=>getComputedStyle(document.getElementById('avisoEnlace')).display);
await c.evaluate(()=>marcarEnlace(false)); await c.waitForTimeout(300);
const caido = await c.evaluate(()=>getComputedStyle(document.getElementById('avisoEnlace')).display);
await c.evaluate(()=>marcarEnlace(true)); await c.waitForTimeout(300);
const vuelto = await c.evaluate(()=>getComputedStyle(document.getElementById('avisoEnlace')).display);
check('con enlace no se avisa de nada', antes==='none' && vuelto==='none', `${antes} / ${vuelto}`);
check('al caerse el enlace, se avisa', caido!=='none', caido);
// y también en modo clase, que es cuando el panel no se ve
await c.evaluate(()=>{ setClase(true); marcarEnlace(false); }); await c.waitForTimeout(300);
check('el aviso se ve también en modo clase',
      await c.evaluate(()=>getComputedStyle(document.getElementById('avisoEnlace')).display)!=='none');
await c.evaluate(()=>{ setClase(false); marcarEnlace(true); });

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
