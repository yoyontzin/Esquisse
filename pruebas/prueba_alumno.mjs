import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const B=process.env.BASE||BASE;
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const errs=[];
const prof=await (await nav.newContext({viewport:{width:1280,height:860}})).newPage();
prof.on('pageerror',e=>errs.push('prof: '+e.message));
await prof.goto(BASE+'/?rol=control'); await prof.waitForTimeout(2500);
await prof.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

const al=await (await nav.newContext({viewport:{width:900,height:640}, hasTouch:true})).newPage();
al.on('pageerror',e=>errs.push('alumno: '+e.message));
await al.goto(BASE+'/?rol=alumno'); await al.waitForTimeout(2500);

// el profesor escribe
const b=await prof.locator('#board').boundingBox();
for(let k=0;k<5;k++){
  await prof.mouse.move(b.x+150+k*90,b.y+220); await prof.mouse.down();
  for(let i=1;i<=8;i++) await prof.mouse.move(b.x+150+k*90+i*8, b.y+220+i*14);
  await prof.mouse.up(); await prof.waitForTimeout(60);
}
await prof.waitForTimeout(1500);
check('el alumno recibe lo escrito',
      await al.evaluate(()=>pg().items.length)===5, String(await al.evaluate(()=>pg().items.length)));

// no puede escribir
const ab=await al.locator('#board').boundingBox();
await al.mouse.move(ab.x+200,ab.y+200); await al.mouse.down();
for(let i=1;i<=8;i++) await al.mouse.move(ab.x+200+i*20, ab.y+200+i*10);
await al.mouse.up(); await al.waitForTimeout(600);
check('el alumno no puede escribir', await al.evaluate(()=>pg().items.length)===5,
      String(await al.evaluate(()=>pg().items.length)));
check('y no le llega nada de vuelta al profesor',
      await prof.evaluate(()=>pg().items.length)===5, String(await prof.evaluate(()=>pg().items.length)));

// pero sí puede acercarse, y eso no mueve a nadie
const zoomProfAntes = await prof.evaluate(()=>+camB().s.toFixed(4));
const zoomAlAntes = await al.evaluate(()=>+camB().s.toFixed(4));
await al.evaluate(()=>{
  const bb=board.getBoundingClientRect();
  const mk=(id,x,y)=>({pointerId:id,pointerType:'touch',clientX:bb.left+x,clientY:bb.top+y,_visto:performance.now()});
  pointers.clear();
  pointers.set(1,mk(1,300,300)); pointers.set(2,mk(2,500,300));
  startPinch();
  pointers.set(1,mk(1,200,300)); pointers.set(2,mk(2,600,300));
  movePinch();
  pointers.clear(); pinch=null; drawBoard();
});
await al.waitForTimeout(500);
const zoomAlDespues = await al.evaluate(()=>+camB().s.toFixed(4));
check('el alumno puede acercarse', zoomAlDespues > zoomAlAntes, `${zoomAlAntes} -> ${zoomAlDespues}`);
check('acercarse no mueve la vista del profesor',
      await prof.evaluate(()=>+camB().s.toFixed(4))===zoomProfAntes, String(zoomProfAntes));

// «Ver todo» lo devuelve al pizarrón completo
await al.click('#verTodo'); await al.waitForTimeout(500);
check('«Ver todo» devuelve el encuadre',
      Math.abs(await al.evaluate(()=>camB().s/escalaEncuadre()) - 1) < .02);

// sin QR ni botón de enlazar
check('al alumno no se le enseña el código de emparejar',
      await al.evaluate(()=>getComputedStyle(document.getElementById('espera')).display)==='none');
// el profesor ve la dirección que dar
const u = await prof.evaluate(()=>document.getElementById('urlAlumnos').textContent);
check('el profesor ve la dirección para la clase', /rol=alumno/.test(u), u.slice(0,70));

// el profesor sigue escribiendo y le llega
await prof.mouse.move(b.x+600,b.y+400); await prof.mouse.down();
for(let i=1;i<=8;i++) await prof.mouse.move(b.x+600+i*10, b.y+400+i*10);
await prof.mouse.up(); await prof.waitForTimeout(1500);
check('sigue llegándole lo nuevo', await al.evaluate(()=>pg().items.length)===6,
      String(await al.evaluate(()=>pg().items.length)));
await al.screenshot({path:'./vista_alumno.png'});

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
