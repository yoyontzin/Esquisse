import { chromium } from 'playwright';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1180,height:820}});
const c=await ctx.newPage();
await c.goto((process.env.BASE||BASE)+'/?rol=control'); await c.waitForTimeout(2500);
console.log('window.storage disponible:', await c.evaluate(()=>!!(window.storage&&window.storage.get)));
console.log('guardado automático en servidor:', await c.evaluate(()=>autoServer));

const b=await c.locator('#board').boundingBox();
for(let k=0;k<8;k++){
  await c.mouse.move(b.x+150+k*100,b.y+250); await c.mouse.down();
  for(let i=1;i<=8;i++) await c.mouse.move(b.x+150+k*100+i*8, b.y+250+i*13);
  await c.mouse.up(); await c.waitForTimeout(50);
}
await c.waitForTimeout(2500);            // más que el guardado diferido
const escrito = await c.evaluate(()=>pg().items.length);
const etiqueta = await c.evaluate(()=>document.getElementById('savedLbl').textContent);
console.log(`escrito: ${escrito} trazos   ·   panel dice: "${etiqueta}"`);

// lo que haría el profesor: recargar, o que se cierre la pestaña
await c.reload(); await c.waitForTimeout(3500);
const tras = await c.evaluate(()=>pg().items.length);
console.log(`tras recargar la página: ${tras} trazos`);

// ¿y en el servidor quedó algo?
const r = await fetch((process.env.BASE||BASE)+'/cuadernos');
console.log('cuadernos guardados en el servidor:', JSON.stringify(await r.json()));
check('lo escrito sobrevive a recargar', tras===escrito, `${escrito} -> ${tras}`);
check('llegó a escribirse algo', escrito >= 1, String(escrito));
check('el panel dice cuándo se guardó', /\d/.test(etiqueta), etiqueta);
await nav.close();

/* Estas cinco pruebas imprimían su veredicto y salían con código cero pasara
   lo que pasara: `correr.sh` las contaba en verde incluso escribiendo «SE
   PIERDE EL TRABAJO». El 12 % del contrato era decorativo. */
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`persistencia: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
