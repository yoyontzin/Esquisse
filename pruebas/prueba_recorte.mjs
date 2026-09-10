/* La tinta no sale del marco, tampoco mientras se escribe. Antes el trazo en
   vivo se pintaba suelto sobre el lienzo, sin el recorte que `renderTo` aplica
   al componer: se veía sobre la pared y desaparecía al levantar la pluma. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:900}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta(); encuadrar(); sync(); });

/* Un punto de pantalla claramente fuera del marco, y tinta blanca gruesa para
   que destaque sobre la pared oscura. */
const fuera = await c.evaluate(()=>{
  const c0=camB(), M=marcoRect(c0);
  return {x: Math.round(M.x + M.w + 30), y: Math.round(M.y + M.h/2), tope: M.x+M.w};
});
const leer = (x,y) => c.evaluate(([x,y])=>{
  const d = DPR();
  const p = bctx.getImageData(Math.round(x*d), Math.round(y*d), 1, 1).data;
  return [p[0],p[1],p[2]].join(',');
}, [x,y]);

check('el punto de prueba cae fuera del marco', fuera.x > fuera.tope,
      `x=${fuera.x} tope=${Math.round(fuera.tope)}`);
const antes = await leer(fuera.x, fuera.y);

await c.evaluate(()=>{ ui.slot = 1; ui.width = 12; setTool('pen'); });
const b = await c.locator('#board').boundingBox();
for (const modo of ['pen','hl']){
  await c.evaluate(m=>setTool(m==='hl'?'hl':'pen'), modo);
  await c.mouse.move(b.x+fuera.x-60, b.y+fuera.y);
  await c.mouse.down();
  await c.mouse.move(b.x+fuera.x, b.y+fuera.y);
  await c.mouse.move(b.x+fuera.x+20, b.y+fuera.y);
  await c.waitForTimeout(500);                 // con la pluma todavía apoyada
  const durante = await leer(fuera.x, fuera.y);
  check(`con ${modo==='hl'?'el marcador':'la pluma'} apoyada, la pared sigue limpia`,
        durante === antes, `${antes} → ${durante}`);
  await c.mouse.up(); await c.waitForTimeout(400);
}
// y lo de dentro del marco sí se pinta, para no haber recortado de más
await c.evaluate(()=>{ setTool('pen'); ui.slot=1; ui.width=12; });
const dentro = await c.evaluate(()=>{
  const M=marcoRect(camB()); return {x:Math.round(M.x+M.w/2), y:Math.round(M.y+M.h/2)};
});
const antesDentro = await leer(dentro.x, dentro.y);
await c.mouse.move(b.x+dentro.x-60, b.y+dentro.y); await c.mouse.down();
await c.mouse.move(b.x+dentro.x, b.y+dentro.y);
await c.mouse.move(b.x+dentro.x+20, b.y+dentro.y);
await c.waitForTimeout(500);
const durDentro = await leer(dentro.x, dentro.y);
await c.mouse.up(); await c.waitForTimeout(300);
check('dentro del marco sí se pinta mientras se escribe',
      durDentro !== antesDentro, `${antesDentro} → ${durDentro}`);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].slice(0,3).join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
process.exit(mal.length?1:0);
