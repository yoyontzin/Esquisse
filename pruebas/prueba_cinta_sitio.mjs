/* La cinta se puede mover de sitio: abajo, arriba o a un lado. Escribiendo
   en el iPad la palma se apoya en el borde de abajo y pulsaba sus botones.
   Lo que se comprueba es que en los tres sitios sigue siendo usable: que se
   dibuja, que arrastrarla mueve el revelado, y que el sitio se recuerda. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1280,height:860}});
const c=await ctx.newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

const b=await c.locator('#board').boundingBox();
for(let k=0;k<8;k++){
  const y=180+k*40;
  await c.mouse.move(b.x+160,b.y+y); await c.mouse.down();
  for(let i=1;i<=6;i++) await c.mouse.move(b.x+160+i*50, b.y+y);
  await c.mouse.up(); await c.waitForTimeout(60);
}
await c.waitForTimeout(300);
check('ocho trazos escritos', await c.evaluate(()=>pg().items.length)===8);

// la cinta pinta algo distinto del fondo en cada sitio
const pintaAlgo = async () => c.evaluate(()=>{
  const d = rctx.getImageData(0,0,ribbon.width,ribbon.height).data;
  let n=0; for(let i=0;i<d.length;i+=4){
    if(d[i+3]>200 && !(d[i]===14&&d[i+1]===16&&d[i+2]===19)) n++;
  }
  return n;
});
const geom = async () => c.evaluate(()=>{
  const r = document.getElementById('ribbon').getBoundingClientRect();
  const bw = document.getElementById('boardWrap').getBoundingClientRect();
  return {rw:Math.round(r.width), rh:Math.round(r.height),
          rTop:Math.round(r.top), bTop:Math.round(bw.top),
          bw:Math.round(bw.width), bh:Math.round(bw.height)};
});

for (const sitio of ['abajo','arriba','lado']){
  await c.evaluate(s=>ponerCinta(s), sitio);
  await c.waitForTimeout(500);
  const g = await geom();
  const px = await pintaAlgo();
  check(`la cinta se dibuja con la cinta ${sitio}`, px > 200, px+' px');
  check(`el pizarrón conserva tamaño usable con la cinta ${sitio}`,
        g.bw > 400 && g.bh > 300, JSON.stringify(g));
  if (sitio==='arriba')
    check('arriba la cinta queda por encima del pizarrón', g.rTop < g.bTop,
          `cinta ${g.rTop} vs pizarrón ${g.bTop}`);
  if (sitio==='lado')
    check('de lado la cinta es más alta que ancha', g.rh > g.rw,
          `${g.rw}x${g.rh}`);
  if (sitio==='abajo')
    check('abajo la cinta queda por debajo del pizarrón', g.rTop > g.bTop,
          `cinta ${g.rTop} vs pizarrón ${g.bTop}`);

  // arrastrarla mueve el revelado, en el eje que toque
  await c.evaluate(()=>{ pg().reveal = 8; sync(); });
  const r = await c.locator('#ribbon').boundingBox();
  const px2 = sitio==='lado' ? r.x + r.width/2 : r.x + r.width*0.25;
  const py2 = sitio==='lado' ? r.y + r.height*0.25 : r.y + r.height/2;
  await c.mouse.move(px2, py2); await c.mouse.down(); await c.mouse.up();
  await c.waitForTimeout(300);
  const rev = await c.evaluate(()=>pg().reveal);
  check(`arrastrar la cinta ${sitio} mueve el revelado`, rev > 0 && rev < 8, String(rev));
}

// el sitio se recuerda al recargar
await c.evaluate(()=>ponerCinta('arriba'));
await c.waitForTimeout(400);
await c.reload(); await c.waitForTimeout(3000);
const recordado = await c.evaluate(()=>ui.cinta);
check('el sitio de la cinta se recuerda al recargar', recordado==='arriba', String(recordado));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
process.exit(mal.length?1:0);
