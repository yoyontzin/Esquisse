/* La ventana de proyección es la que se comparte en Zoom o Meet. Tiene que
   enseñar el pizarrón y nada más, poder ponerse a pantalla completa, y no
   moverse cuando el profesor se acerca en su tableta. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const ctxC=await nav.newContext({viewport:{width:1280,height:900}});
const c=await ctxC.newPage();
const errs=[]; c.on('pageerror',e=>errs.push('control: '+e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta(); encuadrar(); sync(); });

const ctxP=await nav.newContext({viewport:{width:1440,height:810}});
const p=await ctxP.newPage();
p.on('pageerror',e=>errs.push('proy: '+e.message));
await p.goto(BASE+'/?rol=proyeccion'); await p.waitForTimeout(2500);

// --- solo el pizarrón ---
const oculto = await p.evaluate(()=>{
  const ids=['bar','ribbonWrap','side','dock','barPeek','selBar'];
  return ids.filter(id=>{ const e=document.getElementById(id);
    return e && e.getBoundingClientRect().height>0; });
});
check('la proyección no enseña ninguna barra', oculto.length===0, oculto.join(', '));
const b = await p.evaluate(()=>{
  const q=document.getElementById('board').getBoundingClientRect();
  return {w:Math.round(q.width), h:Math.round(q.height), pct:Math.round(100*q.width*q.height/(innerWidth*innerHeight))};
});
check('y el pizarrón ocupa la ventana entera', b.pct>=99, JSON.stringify(b));

// --- se puede poner a pantalla completa ---
check('tiene botón de pantalla completa',
      await p.evaluate(()=>{ const e=document.getElementById('projFull');
        return !!e && e.getBoundingClientRect().height>0; }));
check('y no tapa el de enlazar', await p.evaluate(()=>{
  const a=document.getElementById('projFull').getBoundingClientRect();
  const l=document.getElementById('linkBtn').getBoundingClientRect();
  return a.right <= l.left + 1;
}));

// --- los botones se apartan solos ---
await p.waitForTimeout(3600);
check('los botones se apartan cuando nadie toca nada',
      await p.evaluate(()=>document.body.classList.contains('quieta')));
await p.mouse.move(700,400); await p.waitForTimeout(300);
check('y vuelven al mover el ratón',
      await p.evaluate(()=>!document.body.classList.contains('quieta')));

// --- el zoom del profesor no mueve la proyección ---
await c.evaluate(()=>{ post({t:'pide'}); });
await c.waitForTimeout(1500);
const antes = await p.evaluate(()=>({x:camP().x, y:camP().y, s:camP().s}));
await c.evaluate(()=>{ const k=camB(); k.s*=2.5; k.x+=300; limitarCam(); sync(); });
await c.waitForTimeout(1800);
const despues = await p.evaluate(()=>({x:camP().x, y:camP().y, s:camP().s}));
check('acercarse en la tableta no mueve lo que ve la clase',
      JSON.stringify(antes)===JSON.stringify(despues),
      `${JSON.stringify(antes)} vs ${JSON.stringify(despues)}`);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].slice(0,3).join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
process.exit(mal.length?1:0);
