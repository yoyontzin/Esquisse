import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

// --- velocidad de a poco ---
const vel = () => c.evaluate(()=>ui.speed);
const v0 = await vel();
await c.click('#vMas'); await c.waitForTimeout(150);
const v1 = await vel();
check('«+» sube la velocidad', v1 > v0, `${v0} -> ${v1}`);
check('y sube de a poco, no de golpe', v1/v0 < 1.35, `x${(v1/v0).toFixed(2)}`);
for (let i=0;i<6;i++){ await c.click('#vMenos'); await c.waitForTimeout(60); }
check('«−» la baja', await vel() < v0, `${v0} -> ${await vel()}`);
// no se sale de los topes
for (let i=0;i<40;i++){ await c.click('#vMenos'); await c.waitForTimeout(15); }
check('no baja de su tope', await vel() >= 0.1, String(await vel()));
for (let i=0;i<70;i++){ await c.click('#vMas'); await c.waitForTimeout(15); }
check('ni sube del suyo', await vel() <= 12, String(await vel()));
check('la lectura acompaña',
      /\d/.test(await c.evaluate(()=>document.getElementById('speedLbl').textContent)));

// --- grosor de la pluma ---
await c.click('#penBtn'); await c.waitForTimeout(200);
const w0 = await c.evaluate(()=>ui.width);
await c.click('#wMas'); await c.waitForTimeout(150);
check('«+» engorda la punta', await c.evaluate(()=>ui.width) > w0,
      `${w0} -> ${await c.evaluate(()=>ui.width)}`);
await c.click('#wMenos'); await c.click('#wMenos'); await c.waitForTimeout(200);
check('«−» la afina', await c.evaluate(()=>ui.width) < w0);
const dot1 = await c.evaluate(()=>getComputedStyle(document.getElementById('widthDot')).width);
for(let i=0;i<8;i++){ await c.click('#wMas'); await c.waitForTimeout(40); }
const dot2 = await c.evaluate(()=>getComputedStyle(document.getElementById('widthDot')).width);
check('el punto acompaña al grosor', parseFloat(dot2) > parseFloat(dot1), `${dot1} -> ${dot2}`);

// --- la goma tiene el suyo ---
const plumaW = await c.evaluate(()=>ui.width);
await c.click('#eraseBtn'); await c.waitForTimeout(250);
check('al pasar a la goma el deslizador enseña el suyo',
      await c.evaluate(()=>+document.getElementById('width').value) === await c.evaluate(()=>ui.wErase),
      'goma='+await c.evaluate(()=>ui.wErase));
for(let i=0;i<4;i++){ await c.click('#wMas'); await c.waitForTimeout(50); }
const gomaW = await c.evaluate(()=>ui.wErase);
check('se puede engordar la goma', gomaW > 6, String(gomaW));
check('sin tocar el grosor de la pluma', await c.evaluate(()=>ui.width) === plumaW, String(plumaW));
await c.click('#penBtn'); await c.waitForTimeout(250);
check('y al volver a la pluma vuelve el suyo',
      await c.evaluate(()=>+document.getElementById('width').value) === plumaW, String(plumaW));

// el trazo sale con el grosor de su herramienta
const b=await c.locator('#board').boundingBox();
await c.mouse.move(b.x+200,b.y+250); await c.mouse.down();
await c.mouse.move(b.x+500,b.y+250); await c.mouse.up(); await c.waitForTimeout(300);
await c.click('#eraseBtn'); await c.waitForTimeout(200);
await c.mouse.move(b.x+200,b.y+350); await c.mouse.down();
await c.mouse.move(b.x+500,b.y+350); await c.mouse.up(); await c.waitForTimeout(300);
const ws = await c.evaluate(()=>pg().items.map(i=>({w:i.w, e:!!i.erase})));
console.log('trazos:', JSON.stringify(ws));
check('cada trazo guarda el grosor de su herramienta',
      ws.length===2 && ws[0].w===plumaW && ws[1].w===gomaW, JSON.stringify(ws));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
