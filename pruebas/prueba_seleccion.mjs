/* Colocar lo seleccionado como en Doceri: con dos dedos se agranda, se gira
   y se mueve a la vez. Vale para trazos y para imágenes. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:860}, hasTouch:true})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

// un trazo y una imagen
const b=await c.locator('#board').boundingBox();
await c.mouse.move(b.x+250,b.y+250); await c.mouse.down();
for(let i=1;i<=10;i++) await c.mouse.move(b.x+250+i*24, b.y+250+i*9);
await c.mouse.up(); await c.waitForTimeout(300);
await c.evaluate(()=>{
  const cv=document.createElement('canvas'); cv.width=200; cv.height=120;
  const x=cv.getContext('2d'); x.fillStyle='#c33'; x.fillRect(0,0,200,120);
  x.fillStyle='#fff'; x.font='28px serif'; x.fillText('fig', 20, 70);
  apuntar();
  pg().items.push({k:'i', id:uid(), src:cv.toDataURL(), x:900, y:300, w:400, h:240});
  pg().reveal = pg().items.length; edicion(); olvidarTinta(); touch(); sync();
});
await c.waitForTimeout(600);
check('hay un trazo y una imagen', await c.evaluate(()=>pg().items.length)===2);

const geo = (i) => c.evaluate((i)=>{
  const it = pg().items[i];
  if (it.k==='i') return {x:Math.round(it.x), y:Math.round(it.y), w:Math.round(it.w), rot:+(it.rot||0).toFixed(3)};
  const b = bounds(it);
  return {w:Math.round(b.x1-b.x0), h:Math.round(b.y1-b.y0),
          cx:Math.round((b.x0+b.x1)/2), cy:Math.round((b.y0+b.y1)/2)};
}, i);

// --- gesto de dos dedos sobre la imagen ---
await c.click('#lassoBtn'); await c.waitForTimeout(200);
await c.evaluate(()=>{ sel=[1]; refreshSelBar(); drawBoard(); });
const antesImg = await geo(1);
await c.evaluate(()=>{
  const bb=board.getBoundingClientRect();
  const mk=(id,x,y)=>({pointerId:id,pointerType:'touch',clientX:bb.left+x,clientY:bb.top+y,_visto:performance.now()});
  pointers.clear();
  pointers.set(1,mk(1,700,400)); pointers.set(2,mk(2,900,400));
  startPinch();
  // separar los dedos y girarlos 45 grados
  pointers.set(1,mk(1,650,330)); pointers.set(2,mk(2,1010,540));
  movePinch();
  pointers.clear();
  const era = pinch && pinch.sobreSel; pinch=null;
  if (era){ touch(); sync(); }
});
await c.waitForTimeout(600);
const trasImg = await geo(1);
console.log('imagen:', JSON.stringify(antesImg), '->', JSON.stringify(trasImg));
check('la imagen se agranda con dos dedos', trasImg.w > antesImg.w, `${antesImg.w} -> ${trasImg.w}`);
check('la imagen gira con dos dedos', Math.abs(trasImg.rot) > .2, trasImg.rot+' rad');
check('y cambia de sitio', trasImg.x !== antesImg.x || trasImg.y !== antesImg.y);

// --- el mismo gesto sobre un trazo ---
await c.evaluate(()=>{ sel=[0]; refreshSelBar(); drawBoard(); });
const antesTr = await geo(0);
await c.evaluate(()=>{
  const bb=board.getBoundingClientRect();
  const mk=(id,x,y)=>({pointerId:id,pointerType:'touch',clientX:bb.left+x,clientY:bb.top+y,_visto:performance.now()});
  pointers.clear();
  pointers.set(1,mk(1,300,300)); pointers.set(2,mk(2,500,300));
  startPinch();
  pointers.set(1,mk(1,250,250)); pointers.set(2,mk(2,560,380));
  movePinch();
  pointers.clear();
  const era = pinch && pinch.sobreSel; pinch=null;
  if (era){ touch(); sync(); }
});
await c.waitForTimeout(600);
const trasTr = await geo(0);
console.log('trazo:', JSON.stringify(antesTr), '->', JSON.stringify(trasTr));
check('el trazo se agranda', trasTr.w > antesTr.w, `${antesTr.w} -> ${trasTr.w}`);

// --- sin selección, dos dedos siguen moviendo la vista ---
await c.evaluate(()=>{ sel=[]; refreshSelBar(); });
const camAntes = await c.evaluate(()=>+camB().s.toFixed(4));
await c.evaluate(()=>{
  const bb=board.getBoundingClientRect();
  const mk=(id,x,y)=>({pointerId:id,pointerType:'touch',clientX:bb.left+x,clientY:bb.top+y,_visto:performance.now()});
  pointers.clear();
  pointers.set(1,mk(1,400,400)); pointers.set(2,mk(2,600,400));
  startPinch();
  pointers.set(1,mk(1,350,400)); pointers.set(2,mk(2,650,400));
  movePinch();
  pointers.clear(); pinch=null; drawBoard();
});
await c.waitForTimeout(400);
check('sin selección, dos dedos siguen acercando la vista',
      await c.evaluate(()=>+camB().s.toFixed(4)) !== camAntes);

// --- botones de girar ---
await c.evaluate(()=>{ sel=[1]; refreshSelBar(); });
const antesGiro = (await geo(1)).rot;
await c.click('#selGiraD'); await c.waitForTimeout(400);
check('el botón de girar a la derecha gira', (await geo(1)).rot > antesGiro,
      `${antesGiro} -> ${(await geo(1)).rot}`);
await c.click('#undo'); await c.waitForTimeout(500);
check('se puede deshacer un giro', Math.abs((await geo(1)).rot - antesGiro) < .001);

await c.screenshot({path:'./seleccion.png'});
console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
