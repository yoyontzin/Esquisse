import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';

const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch(); const errs=[];
const prof=await (await nav.newContext({viewport:{width:1180,height:820}})).newPage();
prof.on('pageerror',e=>errs.push('prof: '+e.message));
await prof.goto(BASE+'/?rol=control'); await prof.waitForTimeout(2500);
await prof.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta(); sync(); });
await prof.fill('#miNombre','Rogelio Pérez-Buendía');
await prof.dispatchEvent('#miNombre','change'); await prof.waitForTimeout(800);
check('las iniciales salen del nombre',
      await prof.evaluate(()=>net.iniciales)==='RP', await prof.evaluate(()=>net.iniciales));

const proy=await (await nav.newContext({viewport:{width:1280,height:720}})).newPage();
proy.on('pageerror',e=>errs.push('proy: '+e.message));
await proy.goto(BASE+'/?rol=proyeccion'); await proy.waitForTimeout(2500);
const al=await (await nav.newContext({viewport:{width:900,height:640}})).newPage();
await al.goto(BASE+'/?rol=alumno'); await al.waitForTimeout(1500);
await al.fill('#miNombre','Ana Ruiz').catch(()=>{});
await al.evaluate(()=>ponerNombre('Ana Ruiz')).catch(()=>{});
await prof.waitForTimeout(2500);

const lista = await prof.evaluate(()=>[...document.querySelectorAll('#gente .quien')].map(d=>d.innerText.replace(/\n/g,' ')));
console.log('en el panel del profesor:', JSON.stringify(lista));
check('se ve quién está conectado', lista.length>=2, lista.join(' | '));
check('con su nombre', lista.some(t=>/Ana/.test(t)), lista.join(' | '));
check('y quién es cada uno', lista.some(t=>/proyección|alumno/.test(t)), lista.join(' | '));

// el trazo guarda de quién es y llega marcado
const b=await prof.locator('#board').boundingBox();
await prof.mouse.move(b.x+300,b.y+300); await prof.mouse.down();
for(let i=1;i<=10;i++) await prof.mouse.move(b.x+300+i*25,b.y+300+i*8);
await prof.mouse.up(); await prof.waitForTimeout(1500);
check('el trazo lleva las iniciales de quien lo hizo',
      await prof.evaluate(()=>pg().items[0].a)==='RP', String(await prof.evaluate(()=>pg().items[0].a)));
check('y llegan al otro lado',
      await proy.evaluate(()=>pg().items[0] && pg().items[0].a)==='RP',
      String(await proy.evaluate(()=>pg().items[0] && pg().items[0].a)));
await prof.screenshot({path:'./gente.png'});

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
