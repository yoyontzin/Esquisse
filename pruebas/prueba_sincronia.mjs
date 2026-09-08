/* Consistencia del enlace control -> proyección.
   Desde que los trazos viajan de a poco (solo lo añadido) y no la página
   entera, hay que comprobar que los dos lados terminan igual también cuando
   se edita: borrar, deshacer, mover con el lazo, cambiar de papel. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();
const errs=[];
const proy = await (await nav.newContext({viewport:{width:1280,height:720}})).newPage();
proy.on('pageerror',e=>errs.push('proy: '+e.message));
await proy.goto(BASE+'/?rol=proyeccion'); await proy.waitForTimeout(2200);

const ctrl = await (await nav.newContext({viewport:{width:1180,height:820}})).newPage();
ctrl.on('pageerror',e=>errs.push('ctrl: '+e.message));
await ctrl.goto(BASE+'/?rol=control'); await ctrl.waitForTimeout(2200);

const b = await ctrl.locator('#board').boundingBox();
async function trazo(x0,y0,x1,y1){
  await ctrl.mouse.move(b.x+x0,b.y+y0); await ctrl.mouse.down();
  for(let i=1;i<=10;i++) await ctrl.mouse.move(b.x+x0+(x1-x0)*i/10, b.y+y0+(y1-y0)*i/10);
  await ctrl.mouse.up(); await ctrl.waitForTimeout(60);
}
const lado = async (p) => p.evaluate(()=>{
  const P = state.nb.pages[state.pi];
  return {n:P.items.length, reveal:P.reveal, paper:P.paper,
          puntos:P.items.reduce((a,i)=>a+(i.pts?i.pts.length:0),0),
          stops:P.stops.join(',')};
});
const iguales = (a,b) => a.n===b.n && a.puntos===b.puntos && a.paper===b.paper;

// 1. escribir muchos trazos seguidos: el camino incremental
for (let k=0;k<12;k++) await trazo(150+k*70,200,200+k*70,340);
await ctrl.waitForTimeout(1200);
let A=await lado(ctrl), B=await lado(proy);
check('doce trazos llegan enteros', iguales(A,B), JSON.stringify({ctrl:A,proy:B}));

// 2. deshacer: es una edición, no un añadido
await ctrl.click('#undo'); await ctrl.waitForTimeout(1200);
A=await lado(ctrl); B=await lado(proy);
check('deshacer se propaga', iguales(A,B) && A.n===11, JSON.stringify({ctrl:A,proy:B}));

// 3. seguir escribiendo después de editar
await trazo(150,420,600,420);
await ctrl.waitForTimeout(1200);
A=await lado(ctrl); B=await lado(proy);
check('se puede seguir escribiendo tras editar', iguales(A,B) && A.n===12, JSON.stringify({ctrl:A,proy:B}));

// 4. borrar lo último: quita varios de golpe
await ctrl.click('#undoRafaga'); await ctrl.waitForTimeout(1300);
A=await lado(ctrl); B=await lado(proy);
check('borrar lo último se propaga', iguales(A,B), JSON.stringify({ctrl:A,proy:B}));

// 5. cambiar el papel
await ctrl.selectOption('#paper','gis'); await ctrl.waitForTimeout(1300);
A=await lado(ctrl); B=await lado(proy);
check('el cambio de papel se propaga', B.paper==='gis' && iguales(A,B), JSON.stringify({ctrl:A,proy:B}));

// 6. stops puestos después de escribir toda la clase
await ctrl.evaluate(()=>{ const P=pg(); P.reveal=3; });
await ctrl.click('#addStop');
await ctrl.evaluate(()=>{ const P=pg(); P.reveal=6; });
await ctrl.click('#addStop');
await ctrl.evaluate(()=>sync());
await ctrl.waitForTimeout(1300);
A=await lado(ctrl); B=await lado(proy);
check('los stops llegan a la proyección', A.stops===B.stops && A.stops.length>0,
      JSON.stringify({ctrl:A.stops, proy:B.stops}));

// 7. una edición que no cambia la cuenta: mover con el lazo
const antes = await proy.evaluate(()=>JSON.stringify(pg().items[0].pts[0]));
await ctrl.evaluate(()=>{ sel=[0]; const it=items()[0]; moveItem(it, 120, 60);
                          edicion(); touch(); sync(); });
await ctrl.waitForTimeout(1300);
const despues = await proy.evaluate(()=>JSON.stringify(pg().items[0].pts[0]));
check('mover un elemento se propaga aunque la cuenta no cambie',
      antes !== despues, `${antes} -> ${despues}`);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
const u=[...new Set(errs)]; if(u.length){console.log('=== ERRORES ==='); u.forEach(x=>console.log('  '+x));}
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
