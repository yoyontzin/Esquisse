/* El puntero de Doceri no era solo un punto rojo: se podía señalar con una
   flecha o con una mano, de varios colores, y lo señalado se quedaba un rato.
   Aquí se comprueba que las tres formas se dibujan distinto, que el color
   manda, que la duración manda, y que la clase ve lo mismo que el profesor. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

/* Cuenta los píxeles pintados alrededor de un punto del mundo y saca el color
   dominante. Mirar el lienzo es la única manera de saber que se dibujó: el
   estado dice lo que se pidió, no lo que se ve. */
const MIRA = `((mundoX = 600, radio = 70) => {
  const cam = camB(), d = window.devicePixelRatio || 1;
  const b = document.getElementById('board'), g = b.getContext('2d');
  const cx = Math.round((mundoX-cam.x)*cam.s*d), cy = Math.round((400-cam.y)*cam.s*d);
  const R = Math.round(radio*d);
  const im = g.getImageData(cx-R, cy-R, 2*R, 2*R).data;
  let n=0, sr=0, sg=0, sb=0;
  for (let i=0;i<im.length;i+=4){
    const r=im[i],v=im[i+1],a=im[i+2];
    if (r>245 && v>245 && a>245) continue;      // el papel blanco
    n++; sr+=r; sg+=v; sb+=a;
  }
  return {n, r:n?Math.round(sr/n):0, g:n?Math.round(sg/n):0, b:n?Math.round(sb/n):0};
})`;

const nav = await chromium.launch();
const ctxC = await nav.newContext({viewport:{width:1400,height:900}});
const c = await ctxC.newPage();
const errs=[]; c.on('pageerror',e=>errs.push('control: '+e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2200);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta(); encuadrar(); sync(); });

// --- el panel sale al tomar el puntero y se va al escribir ---
await c.click('#pointBtn'); await c.waitForTimeout(150);
check('las opciones salen al tomar el puntero',
  await c.evaluate(()=>document.body.classList.contains('conPuntero')));

// --- las tres formas dibujan cosas distintas ---
const huella = {};
for (const f of ['punto','flecha','mano']){
  huella[f] = await c.evaluate(async ({f,MIRA})=>{
    ui.tool='point'; ui.ptrForma=f; ui.ptrColor=0; ui.ptrVida=20000;
    ptr.trazos.length=0; ptr.on=false;
    drawBoard();
    pokePointer(600,400);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return eval(MIRA)();
  }, {f, MIRA});
}
for (const f of ['punto','flecha','mano'])
  check('la forma «'+f+'» se dibuja', huella[f].n > 60, JSON.stringify(huella[f]));
const dif = (a,b) => Math.abs(a.n-b.n) > Math.max(a.n,b.n)*0.12;
check('el punto y la flecha no son lo mismo', dif(huella.punto, huella.flecha),
  huella.punto.n+' vs '+huella.flecha.n+' px');
check('la flecha y la mano no son lo mismo', dif(huella.flecha, huella.mano),
  huella.flecha.n+' vs '+huella.mano.n+' px');

// --- el color manda ---
const verde = await c.evaluate(async ({MIRA})=>{
  ui.ptrForma='flecha'; ui.ptrColor=2;   // verde
  ptr.trazos.length=0; ptr.on=false; drawBoard();
  pokePointer(600,400);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return eval(MIRA)();
}, {MIRA});
check('el puntero verde sale verde', verde.g > verde.r + 25,
  `r${verde.r} g${verde.g} b${verde.b}`);

/* --- la flecha y la mano no dejan estela ---
   Señalar es señalar: con una cinta arrastrada detrás no se lee ni la flecha
   ni lo que hay debajo. La estela es del punto de láser, que es con el que se
   escribe en el aire. Se mira lejos de la cabeza, sobre el camino recorrido. */
for (const f of ['flecha','mano']){
  const rastro = await c.evaluate(async ({f,MIRA})=>{
    ui.ptrForma=f; ui.ptrColor=0; ui.ptrVida=20000;
    ptr.trazos.length=0; ptr.on=false; drawBoard();
    for (let i=0;i<=20;i++){ pokePointer(500+i*15, 400); await new Promise(r=>setTimeout(r,12)); }
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return {atras: eval(MIRA)(540, 34), guardado: ptr.trazos.length};
  }, {f, MIRA});
  check('la «'+f+'» no deja estela detrás', rastro.atras.n < 20, JSON.stringify(rastro));
  check('y ni siquiera guarda los puntos de la «'+f+'»', rastro.guardado===0,
    rastro.guardado+' trazos');
}
const conPunto = await c.evaluate(async ({MIRA})=>{
  ui.ptrForma='punto'; ui.ptrColor=0; ui.ptrVida=20000;
  ptr.trazos.length=0; ptr.on=false; drawBoard();
  for (let i=0;i<=20;i++){ pokePointer(500+i*15, 400); await new Promise(r=>setTimeout(r,12)); }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return eval(MIRA)(540, 34);
}, {MIRA});
check('el punto de láser sí la deja', conPunto.n > 60, JSON.stringify(conPunto));

// --- la duración manda ---
const corto = await c.evaluate(async ({MIRA})=>{
  ui.ptrForma='punto'; ui.ptrColor=0; ui.ptrVida=1000;
  ptr.trazos.length=0; ptr.on=false; drawBoard();
  for (let i=0;i<12;i++) pokePointer(560+i*7, 400);
  await new Promise(r=>setTimeout(r,1600));
  drawBoard();
  return eval(MIRA)();
}, {MIRA});
check('con un segundo la estela ya se fue', corto.n < 40, corto.n+' px');
const largo = await c.evaluate(async ({MIRA})=>{
  ui.ptrForma='punto'; ui.ptrVida=20000;
  ptr.trazos.length=0; ptr.on=false; drawBoard();
  for (let i=0;i<12;i++) pokePointer(560+i*7, 400);
  await new Promise(r=>setTimeout(r,1600));
  drawBoard();
  return eval(MIRA)();
}, {MIRA});
check('con veinte segundos sigue ahí', largo.n > 200, largo.n+' px');

// --- la clase ve lo mismo que el profesor ---
const ctxP = await nav.newContext({viewport:{width:1280,height:800}});
const proy = await ctxP.newPage();
proy.on('pageerror',e=>errs.push('proyección: '+e.message));
await proy.goto(BASE+'/?rol=proyeccion'); await proy.waitForTimeout(2500);
await c.evaluate(()=>{ ui.tool='point'; ui.ptrForma='mano'; ui.ptrColor=3; ui.ptrVida=15000;
  ptr.trazos.length=0; pokePointer(600,400); });
await proy.waitForFunction(()=>ptr.on === true, null, {timeout:5000}).catch(()=>{});
const alla = await proy.evaluate(()=>({f:ui.ptrForma, c:ui.ptrColor, v:ui.ptrVida, on:ptr.on}));
check('el estilo del puntero viaja a la proyección',
  alla.f==='mano' && alla.c===3 && alla.v===15000, JSON.stringify(alla));

// --- escribir quita el panel de opciones ---
await c.click('#pointBtn'); await c.waitForTimeout(80);
await c.click('#penBtn'); await c.waitForTimeout(80);
await c.click('#pointBtn'); await c.waitForTimeout(120);
const caja = await c.evaluate(()=>{const r=document.getElementById('board').getBoundingClientRect();
  return {x:r.left+r.width/2, y:r.top+r.height*0.7};});
await c.mouse.move(caja.x, caja.y); await c.mouse.down();
await c.mouse.move(caja.x+60, caja.y+10); await c.mouse.up();
await c.waitForTimeout(150);
check('escribir quita las opciones del puntero',
  await c.evaluate(()=>!document.body.classList.contains('conPuntero')));

// --- señalar no toca el documento ---
check('señalar no deja nada escrito en la página',
  await c.evaluate(()=>pg().items.filter(i=>i.k==='s').length) <= 1);

check('sin errores de JavaScript', errs.length===0, errs.join(' | '));
await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`puntero: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
