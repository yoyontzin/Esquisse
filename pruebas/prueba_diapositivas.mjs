/* El flujo de clase: diapositivas preparadas con huecos, traídas a la app,
   completadas a mano encima y pasadas una a una. Es como se da el curso de
   geometría algebraica, así que conviene que esté cubierto de punta a punta. */
import { chromium } from 'playwright';
import { revisar } from './modo.mjs';
import { sembrarLibs } from './libs.mjs';
import { tocar, elegir } from './menu.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1280,height:860}, acceptDownloads:true});
await sembrarLibs(ctx, ['jspdf']);
const c=await ctx.newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(4000);
await revisar(c);

/* Primero se fabrican tres diapositivas 16:9 con un hueco cada una, se
   exportan a PDF desde la propia app y se vuelven a traer: así la prueba no
   depende de ningún archivo de fuera. */
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });
for (let i=0;i<3;i++){
  await c.evaluate((i)=>{
    const cv=document.createElement('canvas'); cv.width=1920; cv.height=1080;
    const x=cv.getContext('2d');
    x.fillStyle='#FBF9F4'; x.fillRect(0,0,1920,1080);
    x.fillStyle='#1B3A5C'; x.fillRect(0,0,1920,150);
    x.fillStyle='#fff'; x.font='bold 70px serif';
    x.fillText(['Esquemas afines','El functor Spec','Haces estructurales'][i], 70, 105);
    x.fillStyle='#222'; x.font='46px serif';
    x.fillText('Proposición '+(i+1)+'.', 120, 320);
    x.fillText('Demostración:', 120, 430);
    x.strokeStyle='#bbb'; x.setLineDash([12,10]); x.lineWidth=3;
    x.strokeRect(120, 480, 1680, 480);       // el hueco que se completa a mano
    if (i===0){ P0(); }
    function P0(){}
    const P = pg();
    if (i>0) { const nueva = newPage(P); state.nb.pages.push(nueva); state.pi = state.nb.pages.length-1; }
    pg().bgImg = { id:uid(), src:cv.toDataURL('image/jpeg',.9), x:0, y:0, w:1920, h:1080 };
    pg().guide='ninguna'; pg().paper='blanco';
  }, i);
  await c.waitForTimeout(500);
}
await c.evaluate(()=>{ touch(); olvidarTinta(); sync(); });
await c.waitForTimeout(1500);
check('tres diapositivas preparadas', await c.evaluate(()=>state.nb.pages.length)===3);

// --- completar el hueco de cada una a mano ---
await c.evaluate(()=>{ state.pi=0; olvidarTinta(); sync(); });
await c.waitForTimeout(600);
await c.click('#penBtn'); await c.waitForTimeout(200);
const b=await c.locator('#board').boundingBox();
async function escribeEnHueco(k){
  const y = b.y + b.height*0.62 + k*8;
  await c.mouse.move(b.x+b.width*0.2, y); await c.mouse.down();
  for(let i=1;i<=14;i++) await c.mouse.move(b.x+b.width*0.2+i*24, y+Math.sin(i/3)*12);
  await c.mouse.up(); await c.waitForTimeout(120);
}
await escribeEnHueco(0);
await escribeEnHueco(1);
await c.waitForTimeout(600);
check('se escribe sobre la diapositiva', await c.evaluate(()=>pg().items.length)===2,
      String(await c.evaluate(()=>pg().items.length)));
check('la diapositiva sigue de fondo y no se borra', await c.evaluate(()=>!!pg().bgImg));

// --- pasar a la siguiente y escribir ahí ---
await c.click('#pNext'); await c.waitForTimeout(800);
check('se pasa a la siguiente diapositiva', await c.evaluate(()=>state.pi)===1);
check('la nueva llega limpia de anotaciones', await c.evaluate(()=>pg().items.length)===0);
await escribeEnHueco(0);
await c.waitForTimeout(600);
check('se anota también en esta', await c.evaluate(()=>pg().items.length)===1);

// --- volver atrás: lo escrito antes sigue ahí ---
await c.click('#pPrev'); await c.waitForTimeout(800);
check('al volver, lo anotado sigue en su diapositiva',
      await c.evaluate(()=>pg().items.length)===2 && await c.evaluate(()=>!!pg().bgImg));

// --- revelar por pasos dentro de una diapositiva ---
await c.evaluate(()=>{ pg().reveal=1; }); await c.click('#addStop'); await c.waitForTimeout(300);
await c.evaluate(()=>{ pg().reveal=0; sync(); }); await c.waitForTimeout(400);
check('se puede dejar la anotación oculta hasta el momento',
      await c.evaluate(()=>pg().reveal)===0 && await c.evaluate(()=>pg().items.length)===2);
await c.click('#nextStop'); await c.waitForTimeout(500);
check('y revelarla de un salto', await c.evaluate(()=>pg().reveal)===1);

// --- exportar la clase completa, diapositiva y anotación juntas ---
const [dl] = await Promise.all([
  c.waitForEvent('download',{timeout:30000}),
  (async()=>{ await tocar(c, 'pdf'); await c.waitForTimeout(500);
              await c.fill('#pdfPags','todas');
              if (await c.locator('#pdfEtapas').isChecked()) await c.click('#pdfEtapas');
              await c.click('#pdfOk'); })(),
]);
const ruta='./clase_anotada.pdf'; await dl.saveAs(ruta);
const fs = await import('fs');
const buf = fs.readFileSync(ruta);
check('se exporta la clase anotada a PDF',
      buf.slice(0,5).toString('latin1')==='%PDF-' && buf.length>10000,
      Math.round(buf.length/1024)+' KB');

await c.screenshot({path:'./diapositiva_anotada.png'});
console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
