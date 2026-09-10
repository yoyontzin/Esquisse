/* La tinta ya rasterizada se reaprovecha entre cuadros. Eso es rápido pero
   peligroso: si algo cambia y la caché no se entera, la pantalla enseña
   trazos que ya no están o esconde los nuevos.
   Aquí se compara, tras cada operación, lo que se ve con la caché contra lo
   que se vería rasterizando de cero. Tienen que salir idénticos. */
import { chromium } from 'playwright';
import { tocar, elegir } from './menu.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:820}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await elegir(c, 'paper', 'gis');
await elegir(c, 'guide', 'cuadros');
await c.waitForTimeout(1000);

/* La costura con el interior del programa, a propósito en un solo sitio.
   Las dieciséis comprobaciones de abajo pasan todas por aquí, así que un
   rediseño de la caché toca cuatro líneas y no dieciséis. Lo que se compara
   es lo que se ve ahora contra un redibujado desde cero. */
const coincide = async () => c.evaluate(()=>{
  const conCache = board.toDataURL();
  olvidarTinta(); drawBoard();
  const limpio = board.toDataURL();
  return conCache === limpio;
});

const b = await c.locator('#board').boundingBox();
async function trazo(x0,y0,x1,y1){
  await c.mouse.move(b.x+x0,b.y+y0); await c.mouse.down();
  for(let i=1;i<=8;i++) await c.mouse.move(b.x+x0+(x1-x0)*i/8, b.y+y0+(y1-y0)*i/8);
  await c.mouse.up(); await c.waitForTimeout(60);
}

for (let k=0;k<10;k++) await trazo(140+k*95, 180, 200+k*95, 300);
await c.waitForTimeout(400);
check('al escribir', await coincide());

await c.click('#hlBtn'); await trazo(150, 360, 700, 360); await c.click('#penBtn');
await c.waitForTimeout(300);
check('con resaltador', await coincide());

await c.click('#eraseBtn'); await trazo(200, 200, 400, 260); await c.click('#penBtn');
await c.waitForTimeout(300);
check('tras borrar con la goma', await coincide());

await c.click('#undo'); await c.waitForTimeout(400);
check('tras deshacer', await coincide());

await c.evaluate(()=>{ pg().reveal = 4; sync(); }); await c.waitForTimeout(300);
check('con la clase atrás y trazos fantasma', await coincide());

await c.evaluate(()=>{ pg().reveal = pg().items.length; sync(); }); await c.waitForTimeout(300);
check('al revelarlo todo otra vez', await coincide());

await trazo(180, 460, 520, 500);
await c.waitForTimeout(300);
check('al seguir escribiendo tras mover el revelado', await coincide());

await c.evaluate(()=>{ sel=[0,1,2]; selApplyColor(); }); await c.waitForTimeout(400);
check('tras recolorear una selección', await coincide());

await c.evaluate(()=>{ sel=[0,1]; const it=items()[0]; moveItem(it,90,70);
                       edicion(); touch(); sync(); }); await c.waitForTimeout(400);
check('tras mover elementos', await coincide());

await c.evaluate(()=>{ sel=[3]; selDelete(); }); await c.waitForTimeout(400);
check('tras borrar de en medio', await coincide());

await tocar(c, 'undoRafaga'); await c.waitForTimeout(500);
check('tras borrar lo último', await coincide());

// zoom y desplazamiento
await c.evaluate(()=>{ const cam=camB(); cam.s*=1.6; cam.x+=120; limitarCam(); drawBoard(); });
await c.waitForTimeout(300);
check('tras acercar y desplazar', await coincide());

await tocar(c, 'fit'); await c.waitForTimeout(400);
check('tras encuadrar', await coincide());

// otra página y vuelta
await tocar(c, 'pAdd'); await c.waitForTimeout(500);
await trazo(200, 220, 500, 420); await c.waitForTimeout(300);
check('en la página nueva', await coincide());
await c.click('#pPrev'); await c.waitForTimeout(600);
check('al volver a la página anterior', await coincide());

// cambio de papel
await elegir(c, 'paper', 'vintage'); await c.waitForTimeout(900);
check('tras cambiar el papel', await coincide());

/* ===== la misma garantía, dicha sin nombrar la caché =====
   La comprobación de arriba llama a `olvidarTinta()` y depende de que la
   caché se pueda invalidar de golpe. Si la versión 2 la cambia a capas por
   rango o a un prefijo revelado, esa forma deja de compilar y se pierde el
   invariante justo mientras se toca. Esto dice lo mismo en términos de lo que
   el profesor ve: el pizarrón tiene que enseñar exactamente lo que enseñaría
   si acabaras de abrir ese cuaderno. Una segunda pestaña, el mismo cuaderno,
   la misma cámara, los mismos píxeles. */
{
  const estado = await c.evaluate(()=>({
    nb: JSON.parse(JSON.stringify(state.nb)), pi: state.pi,
    cam: {...pg().camBoard}, w: board.width, h: board.height,
    visto: board.toDataURL(),
  }));
  const c2 = await (await nav.newContext({viewport:{width:1280,height:820}})).newPage();
  await c2.goto(BASE+'/?rol=control'); await c2.waitForTimeout(2500);
  const recien = await c2.evaluate(async (e)=>{
    state.nb = migrate(e.nb); state.pi = e.pi;
    olvidarHistorial(); olvidarTinta();
    Object.assign(pg().camBoard, e.cam);
    fitAll(); drawBoard();
    // las imágenes y las fórmulas tardan en decodificar
    await new Promise(r=>setTimeout(r, 1200));
    olvidarTinta(); drawBoard();
    const b = document.getElementById('board');
    return {img: b.toDataURL(), w: b.width, h: b.height};
  }, estado);
  check('el lienzo mide lo mismo en las dos pestañas',
        recien.w === estado.w && recien.h === estado.h,
        `${estado.w}x${estado.h} vs ${recien.w}x${recien.h}`);
  check('lo que se ve es lo que se vería recién abierto el cuaderno',
        recien.img === estado.visto,
        recien.img === estado.visto ? '' : 'los píxeles no coinciden');
  await c2.close();
}

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
