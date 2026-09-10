import { chromium } from 'playwright';
import { sembrarLibs, sinCDN } from './libs.mjs';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const nav = await chromium.launch();
const ctx = await nav.newContext({viewport:{width:1280,height:860}});
await sembrarLibs(ctx, ['mathjax']);
/* Nada de red: lo sembrado basta, y bajar del CDN lo que la prueba no usa
   es lo que la volvía intermitente dentro de la corrida completa. */
await sinCDN(ctx);
const c = await ctx.newPage();
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
await c.screenshot({path:'/tmp/formula_visual.png'});
check('la fórmula entra en la página', r.items>=1, String(r.items));
check('y se revela', r.reveal>=1, String(r.reveal));
check('la imagen de la fórmula está lista', r.imagenLista===true);
/* El color de la ranura tiene que aparecer de verdad en el lienzo. Las
   fórmulas salían invisibles porque la caché sellaba la pasada con el hueco
   de la imagen sin decodificar dentro. */
check('sale con el color de su ranura', (()=>{
  /* El color de la ranura llega en hexadecimal, no como r,g,b. */
  const h = String(r.colorEsperado).trim();
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
  const [er,eg,eb] = m ? [1,2,3].map(i=>parseInt(m[i],16))
                       : h.replace(/[^\d,]/g,'').split(',').map(Number);
  if (![er,eg,eb].every(Number.isFinite)) return false;
  return r.coloresEnPantalla.some(([k])=>{
    const [x,y,z] = k.split(',').map(Number);
    return Math.abs(x-er)<60 && Math.abs(y-eg)<60 && Math.abs(z-eb)<60; });
})(), JSON.stringify({esperado:r.colorEsperado, vistos:r.coloresEnPantalla}));
check('sin errores de JavaScript', errs.length===0, JSON.stringify(errs));
await nav.close();

/* Estas cinco pruebas imprimían su veredicto y salían con código cero pasara
   lo que pasara: `correr.sh` las contaba en verde incluso escribiendo «SE
   PIERDE EL TRABAJO». El 12 % del contrato era decorativo. */
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`fórmula: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
