import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const nav = await chromium.launch();
const c = await (await nav.newContext({viewport:{width:1280,height:860}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

// elegir color verde (slot 3) desde la paleta, como haría un usuario
await c.evaluate(()=>{ ui.slot=3; setTool('text'); });
const b = await c.locator('#board').boundingBox();
await c.mouse.click(b.x+300, b.y+300);
await c.waitForTimeout(400);
await c.fill('#texIn', 'x^2+y^2=r^2');
await c.waitForTimeout(800);
await c.click('#texOk');
await c.waitForTimeout(2000);

const r = await c.evaluate(()=>{
  const it = pg().items[0];
  if(!it) return {error:'no hay item'};
  const dark = darkOf(pg());
  const color = PIGMENT[dark?'dark':'light'][it.c];
  const img = textImage(it, color);
  // muestrear el lienzo alrededor de donde se puso la formula
  const d = bctx.getImageData(0,0,board.width,board.height).data;
  const cuenta = {};
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<200) continue;
    const k = `${d[i]},${d[i+1]},${d[i+2]}`;
    cuenta[k]=(cuenta[k]||0)+1;
  }
  const top = Object.entries(cuenta).sort((a,b)=>b[1]-a[1]).slice(0,6);
  return { slot:it.c, colorEsperado:color, imagenLista: !!img,
           reveal:pg().reveal, items:pg().items.length,
           coloresEnPantalla: top };
});
console.log(JSON.stringify(r,null,2));
console.log('errores:', errs);
await c.screenshot({path:'/tmp/formula_visual.png'});
await nav.close();
