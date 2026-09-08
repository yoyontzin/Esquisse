/* «Editar aquí»: corregir algo ya escrito parándose en un punto viejo de la
   cinta, borrando el trazo de ahí y escribiendo encima, sin que lo nuevo se
   vaya al final ni se pierda lo que sigue después del punto de edición.
   Ejemplo real que motivó esto: escribir «Ti» de más, volver, borrar, y
   seguir escribiendo justo ahí — lo de después de "Ti" debe quedar intacto,
   solo corrido de lugar. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));
const nav=await chromium.launch();
const c=await (await nav.newContext({viewport:{width:1280,height:860}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });

const b=await c.locator('#board').boundingBox();
async function trazo(x0){
  await c.mouse.move(b.x+x0,b.y+200); await c.mouse.down();
  for(let i=1;i<=8;i++) await c.mouse.move(b.x+x0+i*6, b.y+200);
  await c.mouse.up(); await c.waitForTimeout(80);
}
const n = () => c.evaluate(()=>pg().items.length);
const reveal = () => c.evaluate(()=>pg().reveal);
const xs = () => c.evaluate(()=>pg().items.map(it => Math.round(it.pts[0].x)));

// "Tiream" a mano alzada: seis trazos, uno por letra, cada uno con un punto
// de arranque distinto para poder identificarlos luego por posición.
const X = [100, 160, 220, 280, 340, 400];   // T i r e a m
for (const x of X) await trazo(x);
await c.waitForTimeout(300);
check('seis trazos escritos', await n()===6, String(await n()));
check('reveal quedó al final, al ir escribiendo seguido', await reveal()===6, String(await reveal()));

// pone un stop después de "Tiream" completo, para comprobar que la edición
// no lo pierde ni lo deja apuntando a otro trazo
await c.evaluate(()=>{ pg().stops=[6]; });

// se regresa hasta después de "Ti" (reveal=2), como quien arrastra la cinta
await c.evaluate(()=>{ pg().reveal = 2; sync(); });
check('reveal está donde se pidió', await reveal()===2, String(await reveal()));

// sin «Editar aquí» activo, borrar aquí no debe hacer nada
const antesGuard = await n();
await c.evaluate(()=>borrarAnterior());
await c.waitForTimeout(150);
check('«Borrar anterior» no hace nada si el modo edición está apagado',
      await n()===antesGuard, `${await n()} vs ${antesGuard}`);

// se activa el modo y se borra el trazo anterior al punto (la "i")
await c.click('#editarAquiBtn');
const activo = await c.evaluate(()=>ui.editar);
check('«Editar aquí» quedó activo', activo===true);
await c.evaluate(()=>borrarAnterior());
await c.waitForTimeout(200);
check('se borró un trazo', await n()===5, String(await n()));
check('reveal retrocedió con lo borrado', await reveal()===1, String(await reveal()));
check('lo borrado fue la "i", no la última letra del documento',
      (await xs())[0]===100, JSON.stringify(await xs()));

// se escribe "eo" en su lugar
await trazo(150);
await trazo(151);
await c.waitForTimeout(300);
check('ahora hay siete trazos (T + eo + ream)', await n()===7, String(await n()));
check('reveal avanzó con cada trazo insertado', await reveal()===3, String(await reveal()));

const xsFinal = await xs();
check('la "T" original sigue primera', xsFinal[0]===100, JSON.stringify(xsFinal));
check('lo nuevo quedó cosido justo después, no al final',
      xsFinal[1]===150 && xsFinal[2]===151, JSON.stringify(xsFinal));
check('"ream" sigue después, en el mismo orden relativo',
      xsFinal[3]===220 && xsFinal[4]===280 && xsFinal[5]===340 && xsFinal[6]===400,
      JSON.stringify(xsFinal));

// el stop que estaba al final del documento original se corrió con la
// inserción: seguía en 6, ahora en 6 + (2 insertados - 1 borrado) = 7
const stopsTras = await c.evaluate(()=>pg().stops);
check('el stop se corrió con la edición, no se quedó apuntando a otro trazo',
      JSON.stringify(stopsTras)===JSON.stringify([7]), JSON.stringify(stopsTras));

// se apaga el modo: lo siguiente debe irse al final otra vez, no insertarse
await c.click('#editarAquiBtn');
check('«Editar aquí» quedó apagado', await c.evaluate(()=>ui.editar)===false);
await trazo(500);
await c.waitForTimeout(200);
check('con el modo apagado, lo nuevo se agrega al final', await n()===8, String(await n()));
/* Parado a media cinta y con el modo apagado, el trazo se va al final: no se
   mueve el revelado a la fuerza porque en clase destaparía lo que queda por
   explicar. Pero entonces no se ve, así que tiene que avisar. */
check('el revelado no se mueve solo, para no destapar lo que falta por explicar',
      await reveal()===3, String(await reveal()));
check('y avisa de que lo escrito se fue al final, en vez de no dar señal',
      await c.evaluate(()=>avisoFinalDado)===true);

// deshacer cubre la edición: el borrado con «Editar aquí» se revierte igual
// que cualquier otro borrado
await c.evaluate(()=>{ ui.editar=true; pg().reveal=3; borrarAnterior(); });
await c.waitForTimeout(200);
const trasBorrar = await n();
await c.evaluate(()=>deshacer());
await c.waitForTimeout(300);
check('deshacer revierte un borrado hecho con «Editar aquí»',
      await n()===trasBorrar+1, `${await n()} vs ${trasBorrar+1}`);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
process.exit(mal.length ? 1 : 0);
