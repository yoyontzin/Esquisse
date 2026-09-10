/* Los fondos van al servidor como archivos, no dentro del cuaderno. Lo que se
   comprueba es que el cuaderno adelgaza y que, aun así, al recargar sigue
   estando todo: el fondo y lo anotado encima. */
import { chromium } from 'playwright';
import { sembrarLibs } from './libs.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
/* Vertical a propósito: estas pruebas miran qué pasa al meter una página
   alta en un marco apaisado. Los PDF que exporta la app son 16:9 y encajan
   clavados, así que con ellos no comprobarían nada. */
const PDF = process.env.PDF || new URL('./muestra_vertical.pdf', import.meta.url).pathname;
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1280,height:860}});
await sembrarLibs(ctx, ['pdfjs','pdfworker']);
const c=await ctx.newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(4000);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

/* A la condición, no al reloj: pdf.js se baja del CDN la primera vez y con
   perfil limpio tarda lo que tarde. Con timeout fijo la prueba fallaba según
   el día. */
await c.setInputFiles('#pdfFile', PDF);
await c.waitForFunction(()=>state.nb.pages.length > 1, null,
                        {timeout: 90000, polling: 500}).catch(()=>{});
await c.waitForTimeout(2000);
const paginas = await c.evaluate(()=>state.nb.pages.length);
console.log('páginas importadas:', paginas);

// anotar encima, para comprobar que lo escrito viaja junto
const b=await c.locator('#board').boundingBox();
await c.mouse.move(b.x+300,b.y+400); await c.mouse.down();
for(let i=1;i<=10;i++) await c.mouse.move(b.x+300+i*30, b.y+400+i*8);
await c.mouse.up();
await c.waitForTimeout(7000);       // el guardado se espacia con fondos pesados

const enMemoria = await c.evaluate(()=>JSON.stringify(state.nb).length);
const enDisco = await (await fetch(BASE+'/cuadernos')).json();
const archivo = enDisco.find(f=>f.archivo.endsWith('.json'));
console.log('cuaderno en memoria:', Math.round(enMemoria/1024), 'KB');
console.log('cuaderno en disco  :', Math.round(archivo.bytes/1024), 'KB');
check('el cuaderno guardado pesa una fracción de lo que ocupa en memoria',
      archivo.bytes < enMemoria/8, `${Math.round(archivo.bytes/1024)} KB de ${Math.round(enMemoria/1024)} KB`);
check('el cuaderno guardado es pequeño de verdad', archivo.bytes < 300*1024,
      Math.round(archivo.bytes/1024)+' KB');

// los fondos están en el servidor y se sirven
const uno = await c.evaluate(()=>pg().bgImg.id);
const r = await fetch(BASE+'/fondos/'+encodeURIComponent(uno)+'.jpg');
check('los fondos se sirven como archivo', r.ok && (+r.headers.get('content-length'))>10000,
      r.status+' '+r.headers.get('content-length')+' bytes');

// y al recargar sigue todo
await c.reload(); await c.waitForTimeout(6000);
const tras = await c.evaluate(()=>({paginas:state.nb.pages.length,
  fondo:!!pg().bgImg, items:pg().items.length,
  src:(pg().bgImg&&pg().bgImg.src||'').slice(0,10)}));
console.log('tras recargar:', JSON.stringify(tras));
check('al recargar están todas las páginas', tras.paginas===paginas, `${tras.paginas} de ${paginas}`);
check('y el fondo sigue puesto', tras.fondo);
check('y lo anotado encima también', tras.items===1, String(tras.items));

// que el fondo se vea de verdad, no solo que esté la referencia
await c.waitForTimeout(2500);
const pinta = await c.evaluate(()=>{
  const d=bctx.getImageData(0,0,board.width,board.height).data;
  let claros=0; for(let i=0;i<d.length;i+=64) if(d[i]>200) claros++;
  return claros;
});
check('el fondo se dibuja en pantalla', pinta > 500, pinta+' píxeles claros');

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
