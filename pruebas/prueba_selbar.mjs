import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta();
                       clip=null; document.body.classList.remove('hayPortapapeles'); sync(); });
const b=await c.locator('#board').boundingBox();
// algo escrito abajo, para forzar que la barra no quepa arriba
for(let k=0;k<3;k++){
  await c.mouse.move(b.x+250+k*80,b.y+420); await c.mouse.down();
  await c.mouse.move(b.x+310+k*80,b.y+500); await c.mouse.up(); await c.waitForTimeout(60);
}
await c.waitForTimeout(400);
// seleccionar con el lazo de verdad
await c.click('#lassoBtn'); await c.waitForTimeout(200);
await c.mouse.move(b.x+200,b.y+380); await c.mouse.down();
for (const [x,y] of [[560,380],[560,540],[200,540],[200,380]]) await c.mouse.move(b.x+x,b.y+y);
await c.mouse.up(); await c.waitForTimeout(600);

const n = await c.evaluate(()=>sel.length);
check('el lazo selecciona', n>0, n+' elementos');
const pos = await c.evaluate(()=>{
  const sb=document.getElementById('selBar').getBoundingClientRect();
  const bar=document.getElementById('bar').getBoundingClientRect();
  const bb=board.getBoundingClientRect();
  return {visible:sb.width>0, tapaBarra: sb.top < bar.bottom,
          dentro: sb.top>=bb.top-1 && sb.bottom<=bb.bottom+1,
          top:Math.round(sb.top)};
});
console.log('barra de selección:', JSON.stringify(pos));
check('aparece al seleccionar', pos.visible);
check('no tapa la fila de herramientas', !pos.tapaBarra);
check('queda dentro del lienzo, junto a lo seleccionado', pos.dentro);

// las opciones que pediste, a mano
const botones = await c.evaluate(()=>['selColor','selBig','selSmall','selGiraI','selGiraD','selCopy','selCut','selDel']
  .map(id=>{const e=document.getElementById(id); return e && e.getBoundingClientRect().width>0;}));
check('color, tamaño, girar, copiar, cortar y borrar están a la vista',
      botones.every(Boolean), JSON.stringify(botones));

// cortar y pegar en dos toques
await c.click('#selCut'); await c.waitForTimeout(700);
check('tras cortar aparece «Pegar aquí»',
      await c.evaluate(()=>getComputedStyle(document.getElementById('pegarBar')).display)!=='none');
await c.click('#pegarYa'); await c.waitForTimeout(800);
check('y se pega', await c.evaluate(()=>pg().items.length)===3, String(await c.evaluate(()=>pg().items.length)));

// mover con el dedo y que la barra siga
const antes = await c.evaluate(()=>document.getElementById('selBar').getBoundingClientRect().top);
await c.evaluate(()=>{ const bb=board.getBoundingClientRect();
  const s=selBounds(); const cam=camB();
  const px = (s.x0+s.x1)/2, py=(s.y0+s.y1)/2;
  sel = sel.length?sel:[0];
  apuntar(); for(const i of sel) moveItem(items()[i], 0, -120);
  edicion(); refreshSelBar(); drawBoard(); });
await c.waitForTimeout(400);
const desp = await c.evaluate(()=>document.getElementById('selBar').getBoundingClientRect().top);
check('la barra sigue a lo seleccionado al moverlo', Math.abs(desp-antes)>10, `${Math.round(antes)} -> ${Math.round(desp)}`);
await c.screenshot({path:'./selbar.png'});

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
