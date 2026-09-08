import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav = await chromium.launch();
const ctx = await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.env.BASE||BASE)+'/?rol=control');
await p.waitForTimeout(1200);

const b = await p.locator('#board').boundingBox();
const cdp = await ctx.newCDPSession(p);

// --- simular un Apple Pencil de verdad ---
async function pluma(tipo, x, y, presion=0.6){
  await cdp.send('Input.dispatchTouchEvent', {
    type: tipo,
    touchPoints: tipo === 'touchEnd' ? [] : [{x: b.x+x, y: b.y+y, force: presion,
      id: 1, radiusX: 1, radiusY: 1}],
  });
}
// trazo con el Pencil
await pluma('touchStart', 200, 200);
for (let i=1;i<=10;i++) await pluma('touchMove', 200+i*20, 200+i*12);
await pluma('touchEnd', 400, 320);
await p.waitForTimeout(200);

let n = await p.evaluate(()=>state.nb.pages[0].items.length);
check('el trazo táctil dibuja cuando no hay rechazo activo', n===1, n+' elementos');

// --- activar rechazo de palma y probar que la palma no dibuja ni mueve ---
await p.evaluate(()=>{ ui.pencilOnly = true; });
const zoomAntes = await p.evaluate(()=>pg().camBoard.s);
const posAntes  = await p.evaluate(()=>({x:pg().camBoard.x, y:pg().camBoard.y}));
await pluma('touchStart', 500, 500);
for (let i=1;i<=8;i++) await pluma('touchMove', 500+i*15, 500);
await pluma('touchEnd', 620, 500);
await p.waitForTimeout(200);
const n2 = await p.evaluate(()=>state.nb.pages[0].items.length);
const posDespues = await p.evaluate(()=>({x:pg().camBoard.x, y:pg().camBoard.y}));
check('con rechazo activo, la palma no dibuja', n2===1, n2+' elementos');
check('con rechazo activo, la palma no mueve el pizarrón',
      Math.abs(posDespues.x-posAntes.x)<0.01 && Math.abs(posDespues.y-posAntes.y)<0.01,
      JSON.stringify(posDespues));
check('el zoom no cambió', await p.evaluate(()=>pg().camBoard.s)===zoomAntes);

// --- comprobar que el documento no se desplaza ---
const desplaza = await p.evaluate(()=>{
  const antes = window.scrollY;
  window.scrollBy(0, 300);
  const d = window.scrollY - antes;
  return {d, fija: getComputedStyle(document.body).position,
          ta: getComputedStyle(document.body).touchAction};
});
check('el documento no se puede desplazar', desplaza.d===0 && desplaza.fija==='fixed',
      JSON.stringify(desplaza));

// --- el zoom de dos dedos sigue funcionando ---
await p.evaluate(()=>{ ui.pencilOnly = true; });
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
  {x:b.x+300,y:b.y+300,id:1},{x:b.x+500,y:b.y+300,id:2}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[
  {x:b.x+250,y:b.y+300,id:1},{x:b.x+550,y:b.y+300,id:2}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await p.waitForTimeout(200);
const zoomFinal = await p.evaluate(()=>pg().camBoard.s);
check('dos dedos siguen haciendo zoom aunque el rechazo esté activo',
      Math.abs(zoomFinal-zoomAntes)>0.05, `${zoomAntes.toFixed(2)} -> ${zoomFinal.toFixed(2)}`);

ok.forEach(x=>console.log('  ok    '+x));
mal.forEach(x=>console.log('  FALLA '+x));
if(errs.length) console.log('  errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
