import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const B = process.env.BASE || BASE;
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const errs=[];

// la Mac escribe dos clases
const mac=await (await nav.newContext({viewport:{width:1180,height:820}})).newPage();
mac.on('pageerror',e=>errs.push('mac: '+e.message));
await mac.goto(BASE+'/?rol=control'); await mac.waitForTimeout(3000);
const b=await mac.locator('#board').boundingBox();
for (const nombre of ['Esquemas afines','Haces coherentes']){
  await mac.evaluate(n=>{ state.nb=newNotebook(n); state.pi=0; olvidarTinta(); olvidarHistorial(); sync(); }, nombre);
  for(let k=0;k<3;k++){
    await mac.mouse.move(b.x+200+k*90,b.y+250); await mac.mouse.down();
    await mac.mouse.move(b.x+260+k*90,b.y+340); await mac.mouse.up(); await mac.waitForTimeout(60);
  }
  await mac.waitForTimeout(3000);   // que llegue a guardarse
}
const enDisco = await (await fetch(B+'/cuadernos')).json();
console.log('archivos en la computadora:', enDisco.filter(f=>f.archivo.endsWith('.json')).map(f=>f.archivo).join(' | '));
check('las dos clases quedan guardadas en la computadora',
      enDisco.filter(f=>f.archivo.endsWith('.json')).length>=2);

// el iPad entra de cero: su memoria está vacía
const ipad=await (await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true})).newPage();
ipad.on('pageerror',e=>errs.push('ipad: '+e.message));
await ipad.goto(BASE+'/?rol=control'); await ipad.waitForTimeout(3000);
await ipad.click('#libBtn'); await ipad.waitForTimeout(1200);
const filas = await ipad.evaluate(()=>[...document.querySelectorAll('#libList .nbrow .nm')].map(e=>e.textContent));
console.log('lo que ve el iPad:', JSON.stringify(filas));
check('el iPad ve los cuadernos de la computadora', filas.length>=2, filas.join(', '));
check('y con su nombre de verdad', filas.some(f=>/Esquemas|Haces/.test(f)), filas.join(', '));
check('dice dónde se guardan',
      /carpeta/.test(await ipad.evaluate(()=>document.getElementById('libDonde').textContent)));

// abrir uno desde el iPad
await ipad.evaluate(()=>{ const f=[...document.querySelectorAll('#libList .nbrow')]
  .find(d=>/Esquemas|Haces/.test(d.textContent)); f.click(); });
await ipad.waitForTimeout(1500);
const abierto = await ipad.evaluate(()=>({n:pg().items.length, nombre:state.nb.name}));
console.log('abierto en el iPad:', JSON.stringify(abierto));
check('se abre desde el iPad con su contenido', abierto.n===3, JSON.stringify(abierto));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
