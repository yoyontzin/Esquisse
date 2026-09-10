/* Ajustar la imagen o el PDF del fondo: encajarlo de las cuatro maneras,
   moverlo, agrandarlo, aplicarlo a todas las páginas y poder deshacerlo.
   Una página vertical dentro de un marco apaisado se lee pequeña si solo
   cabe entera; a lo ancho se lee, y entonces hay que poder desplazarla. */
import { chromium } from 'playwright';
import { sembrarLibs, sinCDN } from './libs.mjs';
import { tocar, elegir } from './menu.mjs';
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
/* Nada de red: lo sembrado basta, y bajar del CDN lo que la prueba no usa
   es lo que la volvía intermitente dentro de la corrida completa. */
await sinCDN(ctx);
const c=await ctx.newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(4000);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });
await c.setInputFiles('#pdfFile', PDF);
await c.waitForTimeout(14000);

const fondo = () => c.evaluate(()=>{ const b=pg().bgImg;
  return b ? {x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.w), h:Math.round(b.h)} : null; });
const M = await c.evaluate(()=>MARCO);
const paginas = await c.evaluate(()=>state.nb.pages.length);
console.log('páginas del PDF:', paginas, '· fondo inicial:', JSON.stringify(await fondo()));

const ini = await fondo();
check('el PDF entra encajado entero', ini.h===M.h && ini.w < M.w, JSON.stringify(ini));

await tocar(c, 'fondoBtn'); await c.waitForTimeout(300);
check('el modo de ajuste se enciende',
      await c.evaluate(()=>ui.tool==='fondo' && document.body.classList.contains('ajustandoFondo')));

await c.click('#bgAncho'); await c.waitForTimeout(500);
const ancho = await fondo();
check('«a lo ancho» ocupa todo el ancho del pizarrón', ancho.w===M.w, JSON.stringify(ancho));
check('y entonces se sale por arriba y por abajo', ancho.h > M.h, ancho.h+' de '+M.h);

// desplazarlo para ver la parte de abajo
const b=await c.locator('#board').boundingBox();
await c.mouse.move(b.x+600, b.y+400); await c.mouse.down();
for(let i=1;i<=10;i++) await c.mouse.move(b.x+600, b.y+400-i*22);
await c.mouse.up(); await c.waitForTimeout(500);
const movido = await fondo();
check('se puede desplazar para ver el resto', movido.y < ancho.y, `${ancho.y} -> ${movido.y}`);

await c.click('#bgMas'); await c.waitForTimeout(400);
const grande = await fondo();
check('se puede agrandar', grande.w > movido.w, `${movido.w} -> ${grande.w}`);
await c.click('#bgMenos'); await c.waitForTimeout(400);
check('y achicar', (await fondo()).w < grande.w);

await c.click('#bgAlto'); await c.waitForTimeout(500);
const alto = await fondo();
check('«a lo alto» lo devuelve a caber de arriba abajo', alto.h===M.h, JSON.stringify(alto));

await c.click('#bgLlenar'); await c.waitForTimeout(500);
const llena = await fondo();
check('«llenar» cubre el marco entero', llena.w>=M.w && llena.h>=M.h, JSON.stringify(llena));

// aplicar a todas
await c.click('#bgAncho'); await c.waitForTimeout(400);
await c.click('#bgTodas'); await c.waitForTimeout(1200);
const todas = await c.evaluate((MW)=>state.nb.pages.filter(P=>P.bgImg && Math.round(P.bgImg.w)===MW).length, M.w);
check('«a todas» encaja todas las páginas igual', todas===paginas, `${todas} de ${paginas}`);

// deshacer
await c.click('#undo'); await c.waitForTimeout(700);
const trasDeshacer = await c.evaluate((MW)=>state.nb.pages.filter(P=>P.bgImg && Math.round(P.bgImg.w)===MW).length, M.w);
check('se puede deshacer el encaje', trasDeshacer < todas, `${todas} -> ${trasDeshacer}`);

await c.click('#bgListo'); await c.waitForTimeout(300);
check('«Listo» devuelve a la pluma', await c.evaluate(()=>ui.tool==='pen'));

// escribir encima sigue funcionando
const antes = await c.evaluate(()=>pg().items.length);
await c.mouse.move(b.x+300,b.y+300); await c.mouse.down();
for(let i=1;i<=8;i++) await c.mouse.move(b.x+300+i*30, b.y+300+i*10);
await c.mouse.up(); await c.waitForTimeout(500);
check('se escribe encima del fondo ajustado', await c.evaluate(()=>pg().items.length)===antes+1);

await c.screenshot({path:'./fondo_ajustado.png'});
console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
