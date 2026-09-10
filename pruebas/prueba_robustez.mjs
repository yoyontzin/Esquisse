/* Tres fallos que la auditoría encontró y que ninguna prueba veía.
   Los tres se alcanzan con funcionalidad normal, en pocos toques. */
import { chromium } from 'playwright';
import { revisar } from './modo.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:900}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
// `delPage` usa confirm(), que Playwright descarta solo: sin esto la prueba
// no llega a borrar nada. Es el mismo confirm() que F4 del plan quiere quitar.
c.on('dialog', d => d.accept());
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await revisar(c);

const trazos = async (n, y=200) => {
  const b=await c.locator('#board').boundingBox();
  for(let k=0;k<n;k++){
    await c.mouse.move(b.x+100+k*60, b.y+y); await c.mouse.down();
    for(let i=1;i<=6;i++) await c.mouse.move(b.x+100+k*60+i*6, b.y+y);
    await c.mouse.up(); await c.waitForTimeout(60);
  }
};

// ---- A2: una selección obsoleta no puede apagar el pizarrón ----
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });
await trazos(4);
await c.waitForTimeout(300);
// tocar el último cuadrito de la cinta deja sel apuntando al último elemento
await c.evaluate(()=>{ sel=[pg().items.length-1]; refreshSelBar(); });
// y «Borrar anterior» en modo edición lo quita de la lista
await c.evaluate(()=>{ ui.editar=true; pg().reveal=pg().items.length; borrarAnterior(); });
await c.waitForTimeout(400);
check('borrar el elemento seleccionado no lanza', errs.length===0, errs.join(' | '));
// el pizarrón tiene que seguir pintando
const pinta = await c.evaluate(()=>{
  const antes = bctx.getImageData(0,0,board.width,board.height).data.length;
  drawBoard(); sync();
  const d = bctx.getImageData(0,0,board.width,board.height).data;
  let tinta=0; for(let i=0;i<d.length;i+=200) if(d[i]<200) tinta++;
  return {antes, tinta};
});
check('el pizarrón sigue dibujando después', pinta.tinta>0, JSON.stringify(pinta));
check('la selección quedó saneada', await c.evaluate(()=>sel.every(i=>!!items()[i])));

// ---- A3: un hueco en la lista no puede callar la proyección ----
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; sel=[]; ui.editar=false; olvidarTinta(); sync(); });
await trazos(3);
await c.waitForTimeout(300);
const empuja = await c.evaluate(()=>{
  let llamado=false;
  const orig = window.pushSoon;
  window.pushSoon = function(){ llamado=true; return orig.apply(this,arguments); };
  pg().items.splice(1, 0, null);        // el hueco que ya ocurrió una vez
  try{ sync(); }catch(e){ /* sync no debe propagar */ }
  window.pushSoon = orig;
  return llamado;
});
check('con un hueco en la lista, sync SÍ empuja a la proyección', empuja===true);
check('y la cinta no revienta', await c.evaluate(()=>{
  try{ drawRibbon(); return true; }catch(e){ return false; } }));
check('y stripAssets tampoco', await c.evaluate(()=>{
  try{ stripAssets(pg()); return true; }catch(e){ return false; } }));

// ---- A1: deshacer no puede escribir sobre otra página ----
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });
await c.evaluate(()=>{ addPage(); addPage(); addPage(); goPage(0); });
await c.waitForTimeout(300);
// marcar cada página con un número distinto de elementos
await c.evaluate(()=>{
  state.nb.pages.forEach((p,i)=>{
    p.items = Array.from({length:i+1}, (_,k)=>({k:'s',c:0,w:3,
      pts:[{x:10*k,y:10},{x:10*k+5,y:15}]}));
  });
  state.pi = 2; sync();
});
await trazos(1, 300);                    // una edición en la página 2
await c.waitForTimeout(300);
const antes = await c.evaluate(()=>state.nb.pages.map(p=>p.items.length));
await c.evaluate(()=>{ state.pi=1; delPage(); });   // borrar la página 1
await c.waitForTimeout(300);
await c.evaluate(()=>deshacer());
await c.waitForTimeout(400);
const despues = await c.evaluate(()=>state.nb.pages.map(p=>p.items.length));
/* Lo que NO puede pasar: que deshacer aterrice sobre otra página y le cambie
   el contenido. Con el historial olvidado al borrar, deshacer no hace nada y
   las páginas restantes quedan intactas. */
check('borrar una página deja tres', despues.length===3,
      `antes ${JSON.stringify(antes)} → después ${JSON.stringify(despues)}`);
/* Lo que no puede pasar: que deshacer aterrice sobre otra página. Con el
   historial olvidado al borrar, las que quedan conservan su contenido. */
check('y deshacer no destruye el contenido de las que quedan',
      despues.length===3 && despues[0]===antes[0] && despues[2]===antes[3],
      `antes ${JSON.stringify(antes)} → después ${JSON.stringify(despues)}`);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores de página:', [...new Set(errs)].slice(0,3).join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
process.exit(mal.length?1:0);
