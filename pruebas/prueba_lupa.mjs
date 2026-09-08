/* La lupa: escribes en grande en la banda de abajo y el trazo cae pequeño en
   el pizarrón, que no se mueve. La ventana se corre sola al llegar cerca del
   borde y salta de renglón al acabarse el ancho. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:900}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

// sin lupa, la banda no está
check('la lupa viene apagada', await c.evaluate(()=>enLupa())===false);

await c.click('#lupaBtn'); await c.waitForTimeout(600);
check('se enciende con su botón', await c.evaluate(()=>enLupa())===true);
const visible = await c.evaluate(()=>{
  const r=document.getElementById('lupaCanvas').getBoundingClientRect();
  return {w:Math.round(r.width), h:Math.round(r.height)};
});
check('la banda tiene tamaño usable', visible.w>400 && visible.h>80, JSON.stringify(visible));

// el pizarrón se encoge para dejarle sitio, no se tapa
const encoge = await c.evaluate(()=>{
  const b=document.getElementById('board').getBoundingClientRect();
  const l=document.getElementById('lupa').getBoundingClientRect();
  return {bAbajo:Math.round(b.bottom), lArriba:Math.round(l.top)};
});
check('el pizarrón se encoge en vez de quedar tapado',
      Math.abs(encoge.bAbajo - encoge.lArriba) < 4, JSON.stringify(encoge));

// escribir en la banda: un trazo largo en pantalla debe caer pequeño en mundo
/* Como en clase: el pizarrón encuadrado entero y la lupa con su alto de
   renglón de fábrica. El aumento sale de esa relación, no de un número
   suelto. */
await c.evaluate(()=>{ encuadrar(); lupa.x=100; lupa.y=200; });
await c.waitForTimeout(300);
const antesCam = await c.evaluate(()=>({x:camB().x, y:camB().y, s:camB().s}));
const lb = await c.locator('#lupaCanvas').boundingBox();
await c.mouse.move(lb.x+60, lb.y+lb.height*0.6); await c.mouse.down();
for(let i=1;i<=12;i++) await c.mouse.move(lb.x+60+i*18, lb.y+lb.height*0.6 - Math.sin(i/2)*18);
await c.mouse.up(); await c.waitForTimeout(600);

const t = await c.evaluate(()=>{
  const it = pg().items[0];
  if(!it) return null;
  const xs = it.pts.map(p=>p.x), ys = it.pts.map(p=>p.y);
  return { n: pg().items.length,
           x0:Math.round(Math.min(...xs)), x1:Math.round(Math.max(...xs)),
           y0:Math.round(Math.min(...ys)), y1:Math.round(Math.max(...ys)) };
});
check('escribir en la banda mete un trazo en el documento', t && t.n===1, JSON.stringify(t));
check('el trazo cae dentro de la ventana que se está mirando',
      t && t.x0 >= 90 && t.y0 >= 190 && t.y1 <= 200+90+5, JSON.stringify(t));
/* El aumento de verdad se mide contra el pizarrón: los mismos píxeles de mano
   tienen que dar un trazo varias veces más pequeño escribiendo en la banda que
   escribiendo directamente en el lienzo. Ese cociente es para lo que sirve. */
const aumento = await c.evaluate(()=>lupaEscala()/camB().s);
check('escribir en la banda sale varias veces más grande que en el pizarrón',
      aumento >= 2.5, `${aumento.toFixed(1)} veces`);

const trasCam = await c.evaluate(()=>({x:camB().x, y:camB().y, s:camB().s}));
check('el pizarrón no se movió ni un pixel',
      JSON.stringify(antesCam)===JSON.stringify(trasCam),
      JSON.stringify(antesCam)+' vs '+JSON.stringify(trasCam));

// avance automático: un trazo que termina pasado el 72% corre la ventana
await c.evaluate(()=>{ lupa.x=100; lupa.y=200; dibujarLupa(); });
const xAntes = await c.evaluate(()=>lupa.x);
await c.mouse.move(lb.x+lb.width*0.80, lb.y+lb.height*0.6); await c.mouse.down();
for(let i=1;i<=6;i++) await c.mouse.move(lb.x+lb.width*0.80+i*6, lb.y+lb.height*0.6);
await c.mouse.up(); await c.waitForTimeout(600);
const xTras = await c.evaluate(()=>lupa.x);
check('al terminar cerca del borde la ventana se corre sola', xTras > xAntes,
      `${xAntes} -> ${xTras}`);

// salto de renglón al acabarse el ancho
await c.evaluate(()=>{ const v=lupaVentana(); lupa.x = MARCO.w - v.w; lupa.y = 200; });
const yAntes = await c.evaluate(()=>lupa.y);
await c.evaluate(()=>lupaAvanzar()); await c.waitForTimeout(300);
const fin = await c.evaluate(()=>({x:lupa.x, y:lupa.y}));
check('al acabarse el ancho salta de renglón', fin.y > yAntes && fin.x===0, JSON.stringify(fin));

// el alto del renglón manda sobre el aumento
const e1 = await c.evaluate(()=>lupaEscala());
await c.click('#lupaMas'); await c.waitForTimeout(300);
const e2 = await c.evaluate(()=>lupaEscala());
check('un renglón más grande baja el aumento', e2 < e1, `${e1.toFixed(2)} -> ${e2.toFixed(2)}`);

// se recuerda al recargar
await c.waitForTimeout(400);
await c.reload(); await c.waitForTimeout(3000);
check('la lupa sigue puesta al recargar', await c.evaluate(()=>enLupa())===true);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
process.exit(mal.length?1:0);
