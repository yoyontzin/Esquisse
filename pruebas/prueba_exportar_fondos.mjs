/* El PDF exportado tiene que llevar los fondos. Antes no: el bucle era
   síncrono y las imágenes no habían decodificado, así que con un cuaderno
   abierto desde el servidor —donde los fondos se piden por red— salían los
   trazos flotando sobre blanco, siempre. */
import { chromium } from 'playwright';
import { sembrarLibs } from './libs.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const PDF = process.env.PDF || new URL('./muestra_vertical.pdf', import.meta.url).pathname;
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1280,height:900}, acceptDownloads:true});
await sembrarLibs(ctx, ['pdfjs','pdfworker']);
const c=await ctx.newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

/* Esperar a la condición y no al reloj: pdf.js se descarga del CDN la primera
   vez, y con perfil de navegador limpio eso tarda lo que tarde. Un timeout fijo
   hacía que la prueba fallara según el día. */
await c.setInputFiles('#pdfFile', PDF);
await c.waitForFunction(()=>state.nb.pages.length > 1, null,
                        {timeout: 90000, polling: 500}).catch(()=>{});
await c.waitForTimeout(2000);
const pags = await c.evaluate(()=>state.nb.pages.length);
check('el PDF se importó', pags>=3, String(pags));

// anotar encima, para que el PDF lleve trazos y fondo
const b=await c.locator('#board').boundingBox();
await c.mouse.move(b.x+300,b.y+300); await c.mouse.down();
for(let i=1;i<=10;i++) await c.mouse.move(b.x+300+i*25,b.y+300+i*5);
await c.mouse.up(); await c.waitForTimeout(6000);

/* El caso que fallaba es el del cuaderno que llega con los fondos por
   referencia. Se reproduce vaciando el guardado local y recargando: entonces el
   arranque lo recoge del servidor y los fondos se piden por red. */
await c.evaluate(()=>{ try{ localStorage.clear(); }catch{} });
await c.reload();
await c.waitForFunction(()=>state.nb.pages.length > 1, null,
                        {timeout: 60000, polling: 500}).catch(()=>{});
await c.waitForTimeout(1500);
const trasRecarga = await c.evaluate(()=>({
  paginas: state.nb.pages.length,
  src: (pg().bgImg && pg().bgImg.src || '').slice(0,12),
  porRed: (pg().bgImg && pg().bgImg.src || '').startsWith('/fondos/'),
}));
check('el cuaderno se recupera del servidor', trasRecarga.paginas>=3,
      JSON.stringify(trasRecarga));
/* El cuaderno del servidor guarda el fondo por referencia y `traerFondos` lo
   resuelve pidiéndolo por red al abrirlo. Lo que importa es que llegue con
   imagen de verdad y no vacío, que es como salía antes de importar. */
check('y su fondo se resolvió con imagen de verdad, no vacío',
      trasRecarga.src.startsWith('data:image') || trasRecarga.porRed,
      JSON.stringify(trasRecarga));

/* Sin esperar a nada, se pide el raster de exportación tal cual lo arma
   exportPDF. Lo que se mide es si el fondo está en los píxeles. */
const pixeles = await c.evaluate(async ()=>{
  const quiero = state.nb.pages.map((_,i)=>i).slice(0,2);
  await preparaImagenes(quiero);
  const W=800, H=Math.round(W*proj.height/proj.width);
  const tmp=document.createElement('canvas'); tmp.width=W; tmp.height=H;
  const t=tmp.getContext('2d');
  const P=state.nb.pages[0];
  const cam={x:P.camProj.x, y:P.camProj.y, s:P.camProj.s*(W/proj.width)};
  olvidarTinta();
  renderTo(t, cam, W, H, P.items.length, 0, 'pdf', true, 1, P);
  const d=t.getImageData(0,0,W,H).data;
  // un fondo de PDF trae gris y negro; el blanco solo no basta
  let oscuros=0, claros=0;
  for(let i=0;i<d.length;i+=40){
    if(d[i]<120) oscuros++; else if(d[i]>200) claros++;
  }
  return {oscuros, claros};
});
check('el fondo del PDF aparece en el raster de exportación',
      pixeles.oscuros > 50, JSON.stringify(pixeles));

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].slice(0,3).join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
process.exit(mal.length?1:0);
