/* La clave de la sesión. El servidor escucha en toda la red para que el iPad
   pueda conectarse, así que sin clave cualquiera en el mismo wifi podía leer,
   sobrescribir y borrar las clases. Lo que se comprueba es que desde fuera no
   se puede sin ella, que el código QR la lleva, y que desde la propia máquina
   se sigue trabajando sin teclear nada. */
import { chromium } from 'playwright';
import { networkInterfaces } from 'os';
import { spawn } from 'child_process';
import { rmSync, mkdirSync } from 'fs';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const PUERTO = 8779, CLAVE = 'PRUEBA99';
// una IP de esta máquina que no sea 127.0.0.1: así el servidor nos ve como
// si fuéramos otro aparato de la red, que es el caso que importa
let ipRed = null;
for (const lista of Object.values(networkInterfaces()))
  for (const i of lista||[]) if (i.family==='IPv4' && !i.internal) { ipRed = i.address; break; }

/* Servidor propio: esta prueba necesita la clave encendida, y el resto de la
   batería corre con ella apagada. */
const DATOS = '/tmp/pz_clave';
rmSync(DATOS, {recursive:true, force:true}); mkdirSync(DATOS, {recursive:true});
const srv = spawn('/usr/bin/python3', ['-u', '../pizarron_servidor.py'], {
  env: {...process.env, PIZARRON_PUERTO:String(PUERTO),
        PIZARRON_CUADERNOS:DATOS, PIZARRON_CLAVE:CLAVE},
  stdio:'ignore', detached:false});
process.on('exit', ()=>{ try{ srv.kill(); }catch{} });

const local = `http://127.0.0.1:${PUERTO}`;
for (let i=0;i<40;i++){
  try{ await fetch(local+'/'); break; }catch{ await new Promise(r=>setTimeout(r,250)); }
}
const fuera = ipRed ? `http://${ipRed}:${PUERTO}` : null;

const j = async (u,o) => { const r = await fetch(u,o); return {s:r.status, t:await r.text()}; };

// --- desde la propia máquina: sin clave, todo ---
check('en local el caparazón abre', (await j(local+'/')).s===200);
check('en local los cuadernos se leen sin clave', (await j(local+'/cuadernos')).s===200);
const info = JSON.parse((await j(local+'/info')).t);
check('en local /info entrega la clave', info.clave===CLAVE, String(info.clave));

if (!fuera){
  console.log('sin IP de red: se salta la mitad de red');
} else {
  // --- desde la red sin clave: nada de datos ---
  check('desde la red el caparazón abre igual (hace falta para cargar la app)',
        (await j(fuera+'/')).s===200);
  const sinClave = await j(fuera+'/cuadernos');
  check('desde la red NO se listan los cuadernos sin clave', sinClave.s===403,
        String(sinClave.s));
  check('y el rechazo dice qué hacer', /QR/.test(sinClave.t), sinClave.t.slice(0,60));
  check('desde la red NO se lee un cuaderno sin clave',
        (await j(fuera+'/cuadernos/x.json')).s===403);
  check('desde la red NO se escribe sin clave',
        (await j(fuera+'/cuadernos', {method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({nombre:'intruso', datos:{}})})).s===403);
  check('desde la red NO se borra sin clave',
        (await j(fuera+'/cuadernos/x.json', {method:'DELETE'})).s===403);
  check('desde la red NO se empuja a la clase sin clave',
        (await j(fuera+'/empujar', {method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({t:'ptr',x:0,y:0})})).s===403);
  check('desde la red /info NO entrega la clave sin clave',
        (await j(fuera+'/info')).s===403);

  // --- desde la red con la clave: entra ---
  check('con la clave sí se listan los cuadernos',
        (await j(fuera+'/cuadernos?k='+CLAVE)).s===200);
  const conInfo = await j(fuera+'/info?k='+CLAVE);
  check('con la clave /info responde', conInfo.s===200);
  check('pero /info sigue sin soltar la clave a la red',
        !('clave' in JSON.parse(conInfo.t)), conInfo.t);
  check('una clave equivocada no sirve',
        (await j(fuera+'/cuadernos?k=OTRACOSA')).s===403);
}

// --- el navegador: la clave viaja en el enlace y la app funciona ---
const nav = await chromium.launch();
const c = await (await nav.newContext({viewport:{width:1200,height:820}})).newPage();
const errs=[]; c.on('pageerror',e=>errs.push(e.message));
if (fuera){
  await c.goto(fuera+'/?rol=control&k='+CLAVE); await c.waitForTimeout(2500);
  check('la app abre desde la red con la clave en el enlace',
        await c.evaluate(()=>typeof pg==='function'));
  check('y la recoge del enlace', await c.evaluate(()=>CLAVE)===CLAVE);
  const b = await c.locator('#board').boundingBox();
  await c.mouse.move(b.x+200,b.y+200); await c.mouse.down();
  for(let i=1;i<=8;i++) await c.mouse.move(b.x+200+i*20,b.y+200);
  await c.mouse.up(); await c.waitForTimeout(2500);
  check('y se puede escribir y guardar de verdad',
        await c.evaluate(()=>pg().items.length)===1);
  const guardados = JSON.parse((await j(local+'/cuadernos')).t);
  check('lo escrito llegó al servidor', guardados.length>=1, JSON.stringify(guardados.length));
}
// la proyección, que corre en la máquina, mete la clave en el QR sola
const p = await (await nav.newContext({viewport:{width:1200,height:800}})).newPage();
await p.goto(local+'/?rol=proyeccion'); await p.waitForTimeout(2500);
const urlQR = await p.evaluate(()=>document.getElementById('esperaUrl').textContent);
check('el enlace del QR lleva la clave, sin teclear nada',
      urlQR.includes('k='+CLAVE), urlQR);

console.log('=== BIEN ==='); ok.forEach(x=>console.log('  ok    '+x));
if(mal.length){console.log('=== MAL ==='); mal.forEach(x=>console.log('  FALLA '+x));}
if(errs.length) console.log('errores:', [...new Set(errs)].join(' | '));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
await nav.close();
try{ srv.kill(); }catch{}
process.exit(mal.length?1:0);
