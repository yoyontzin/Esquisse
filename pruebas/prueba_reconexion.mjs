/* Perder el wifi a media clase.

   Es el mecanismo más delicado del producto y hasta ahora no tenía una sola
   comprobación. `conectar()` limpia lo enviado y reenvía la página entera al
   reabrir el canal, y el receptor pide la página completa cuando la cuenta no
   le cuadra. Ninguna prueba cortaba el enlace, así que las dos cosas estaban
   escritas y sin ejercitar.

   El caso asimétrico es el que más duele en un aula: si quien pierde la red
   es la tableta y la proyección sigue en pie, la proyección se queda
   congelada delante del grupo sin ningún aviso, porque el aviso solo reacciona
   al error de su propio canal. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();
const ctxC = await nav.newContext({viewport:{width:1280,height:860}});
const ctxP = await nav.newContext({viewport:{width:1280,height:800}});
const c = await ctxC.newPage(), p = await ctxP.newPage();
const errs=[];
c.on('pageerror',e=>errs.push('control: '+e.message));
p.on('pageerror',e=>errs.push('proyección: '+e.message));

await c.goto(BASE+'/?rol=control'); await c.waitForTimeout(2500);
await c.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta(); sync(); });
await p.goto(BASE+'/?rol=proyeccion'); await p.waitForTimeout(2500);

const caja = await c.evaluate(()=>{const r=document.getElementById('board').getBoundingClientRect();
  return {x:r.left, y:r.top, w:r.width, h:r.height};});
async function trazo(i){
  const x = caja.x + 120 + (i%8)*90, y = caja.y + 140 + Math.floor(i/8)*70;
  await c.mouse.move(x, y); await c.mouse.down();
  for (let k=1;k<=6;k++) await c.mouse.move(x+k*10, y+k*7);
  await c.mouse.up(); await c.waitForTimeout(80);
}
const cuentaProy = () => p.evaluate(()=>pg().items.length);
const cuentaCtrl = () => c.evaluate(()=>pg().items.length);

// --- cinco trazos con el enlace en pie ---
for (let i=0;i<5;i++) await trazo(i);
await p.waitForFunction(()=>pg().items.length>=5, null, {timeout:8000}).catch(()=>{});
check('con el enlace en pie, la clase llega', await cuentaProy() === 5,
      `control ${await cuentaCtrl()}, proyección ${await cuentaProy()}`);

// --- se cae la red del CONTROL, que es el iPad del profesor ---
await ctxC.setOffline(true);
const visible = (pag, id) => pag.waitForFunction(i=>{
  const a = document.getElementById(i);
  return !!a && getComputedStyle(a).display !== 'none' && a.getBoundingClientRect().height > 0;
}, id, {timeout:60000}).then(()=>true).catch(()=>false);
/* Con la red caída lo primero que falla son los envíos. El canal de eventos
   puede seguir vivo un rato largo, así que el aviso tiene que venir de que lo
   escrito no sale, no de un error del canal. */
for (let i=0;i<3;i++) await trazo(90+i);      // fuerza tres empujones fallidos
check('el control avisa de que lo que escribe no está saliendo',
      await visible(c, 'avisoEnlace'));

// se sigue escribiendo a oscuras, que es lo que hace el profesor sin enterarse
for (let i=5;i<10;i++) await trazo(i);
check('a oscuras se sigue escribiendo en el control', await cuentaCtrl() === 10,
      String(await cuentaCtrl()));
const enLaProyeccionDurante = await cuentaProy();

// --- vuelve la red ---
await ctxC.setOffline(false);
/* Esperar la condición y no el reloj: la reconexión depende del temporizador
   de reintento del EventSource, que no es un número que esta prueba deba
   conocer. */
await p.waitForFunction(()=>pg().items.length>=10, null, {timeout:30000}).catch(()=>{});
await p.waitForTimeout(800);
const alFinal = await cuentaProy();
check('al volver la red, la proyección recupera todo lo escrito a oscuras',
      alFinal === 10, `durante el corte tenía ${enLaProyeccionDurante}, al final ${alFinal}`);

const firma = pag => pag.evaluate(()=>pg().items.map(i =>
  i.pts ? Math.round(i.pts[0].x)+','+Math.round(i.pts[0].y) : i.k).join(' | '));
check('y en el mismo orden', await firma(p) === await firma(c),
      `control: ${(await firma(c)).slice(0,70)}…  proyección: ${(await firma(p)).slice(0,70)}…`);

check('el aviso de enlace caído desaparece al volver',
      await c.evaluate(()=>{
        const a = document.getElementById('avisoEnlace');
        return !a || getComputedStyle(a).display === 'none' ||
               a.getBoundingClientRect().height === 0;
      }));

// --- el caso asimétrico: se cae la red de la PROYECCIÓN ---
await ctxP.setOffline(true);
await p.waitForTimeout(1500);
for (let i=10;i<13;i++) await trazo(i);
await c.waitForTimeout(600);
check('con la proyección a oscuras, el control sigue escribiendo',
      await cuentaCtrl() === 13, String(await cuentaCtrl()));
/* Esto es lo que hoy no se ve. La proyección está congelada delante del grupo
   y nadie lo sabe. La comprobación no exige una solución concreta, solo que
   la proyección dé alguna señal de que dejó de recibir. */
/* El aviso sale en el aparato del PROFESOR, no en la proyección: la
   proyección es lo que ve el grupo y un cartel ahí sería ruido para ellos y
   ninguna ayuda para él. El servidor es quien sabe quién sigue conectado. */
check('el control avisa de que la proyección se cayó', await visible(c, 'avisoProy'));

await ctxP.setOffline(false);
await p.waitForFunction(()=>pg().items.length>=13, null, {timeout:30000}).catch(()=>{});
await p.waitForTimeout(800);
check('y al volver se pone al día sola', await cuentaProy() === 13,
      String(await cuentaProy()));
check('y el aviso de proyección caída se retira',
      await c.waitForFunction(()=>{
        const a = document.getElementById('avisoProy');
        return !a || !a.classList.contains('visible');
      }, null, {timeout:30000}).then(()=>true).catch(()=>false));

/* El otro modo de caída: la conexión no se rompe, se queda colgada. El wifi
   se va y el socket no da error nunca, así que el navegador tampoco reintenta.
   Es el caso que el vigilante del silencio cubre, y es el único sitio de esta
   prueba donde hay que meter la mano dentro: un navegador no se puede obligar
   a colgar un socket vivo desde fuera. Se envejece la marca de última señal y
   se comprueba que el canal se reemplaza solo. */
{
  const esAntes = await c.evaluate(()=>{ const v = net.es; net.visto = Date.now() - 60000; return !!v; });
  const reemplazado = await c.waitForFunction(()=>net.visto > Date.now() - 20000,
    null, {timeout:30000}).then(()=>true).catch(()=>false);
  check('un canal callado se reemplaza solo', esAntes && reemplazado);
  check('y tras reemplazarlo la clase sigue llegando', await (async()=>{
    await trazo(20);
    return p.waitForFunction(()=>pg().items.length>=14, null, {timeout:20000})
            .then(()=>true).catch(()=>false);
  })());
}

check('sin errores de JavaScript', errs.length===0, [...new Set(errs)].join(' | '));
await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`reconexión: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
