// La captura real usa getDisplayMedia, que en macOS depende del permiso de
// grabación de pantalla del navegador. Aquí se sustituye la fuente por un
// canvas para probar la cadena entera sin depender de ese permiso.
import { chromium } from 'playwright';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
import { tocar, elegir } from './menu.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto((process.env.BASE||BASE)+'/?rol=control'); await c.waitForTimeout(2500);

// una "pantalla" falsa: un canvas 16:9 con una diapositiva dibujada
await c.evaluate(()=>{
  const cv=document.createElement('canvas'); cv.width=1920; cv.height=1080;
  const x=cv.getContext('2d');
  x.fillStyle='#F7F4EC'; x.fillRect(0,0,1920,1080);
  x.fillStyle='#1B3A5C'; x.fillRect(0,0,1920,150);
  x.fillStyle='#fff'; x.font='bold 64px serif';
  x.fillText('Esquemas afines', 70, 100);
  x.fillStyle='#222'; x.font='44px serif';
  x.fillText('Spec A  para A anillo conmutativo', 120, 340);
  x.fillText('Teorema. Spec es un functor contravariante.', 120, 460);
  const s = cv.captureStream(5);
  navigator.mediaDevices.getDisplayMedia = async () => s;
});

const antes = await c.evaluate(()=>state.nb.pages.length);
await tocar(c, 'capturar');
await c.waitForTimeout(2500);
const r = await c.evaluate(()=>({paginas:state.nb.pages.length, i:state.pi,
  bg:!!pg().bgImg, bytes:pg().bgImg?pg().bgImg.src.length:0,
  w:pg().bgImg?Math.round(pg().bgImg.w):0, h:pg().bgImg?Math.round(pg().bgImg.h):0}));
console.log('resultado:', JSON.stringify(r));

// anotar encima
const b=await c.locator('#board').boundingBox();
await c.click('#penBtn');
await c.mouse.move(b.x+300,b.y+430); await c.mouse.down();
for(let i=1;i<=14;i++) await c.mouse.move(b.x+300+i*26, b.y+430+Math.sin(i/2)*16);
await c.mouse.up(); await c.waitForTimeout(600);
const n = await c.evaluate(()=>pg().items.length);
await c.screenshot({path:'./captura_anotada.png'});
check('la diapositiva queda de fondo', r.bg && r.bytes>1000, JSON.stringify(r));
check('se puede anotar encima', n===1, String(n)+' elementos');
check('sin errores de JavaScript', errs.length===0, [...new Set(errs)].join(' | '));
await nav.close();

/* Estas cinco pruebas imprimían su veredicto y salían con código cero pasara
   lo que pasara: `correr.sh` las contaba en verde incluso escribiendo «SE
   PIERDE EL TRABAJO». El 12 % del contrato era decorativo. */
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`captura: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
