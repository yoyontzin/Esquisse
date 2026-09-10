/* Los tres modos.

   Preparar una clase y darla son dos actividades distintas y necesitan cosas
   distintas. Hasta la versión 1 solo había dos: todo, o modo clase. Con las
   barras de fábrica, en un iPad de 11 pulgadas el pizarrón se llevaba el
   45.7 % de la pantalla y las barras el 45.6 %.

   Y los recortes parciales no devuelven nada, que es el hallazgo que ordena
   todo esto: ahí el pizarrón está limitado por el alto, así que quitar los
   224 px de ancho de la columna no devuelve un solo píxel, y al quitar la
   cinta pasa a estar limitado por el ancho, así que tampoco. Hay que quitar
   el par. En el iPad de 12.9 pulgadas es exactamente al revés. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();

const medir = pag => pag.evaluate(()=>{
  const M = marcoRect(camB());
  const alto = id => { const e=document.getElementById(id); return e?Math.round(e.getBoundingClientRect().height):0; };
  return {
    w: Math.round(M.w), h: Math.round(M.h),
    area: Math.round(M.w*M.h),
    pct: +(100*M.w*M.h/(innerWidth*innerHeight)).toFixed(1),
    modo: modoActual(),
    cinta: alto('ribbonWrap'),
    controles: alto('controls'),
    lado: Math.round(document.getElementById('side').getBoundingClientRect().width),
    asa: (()=>{ const a=document.getElementById('cintaAsa');
                return !!a && a.getBoundingClientRect().height>0; })(),
  };
});

/* Las dos pantallas donde de verdad se usa, con emulación táctil, que es lo
   que dispara la regla de 44 px de tamaño mínimo de toque. Sin ella la barra
   cabe en una línea y las medidas mienten. */
for (const [ancho, alto, nombre, minimo] of [[1180,820,'iPad de 11"',70],[1366,1024,'iPad de 12.9"',65]]){
  const ctx = await nav.newContext({viewport:{width:ancho,height:alto}, hasTouch:true});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);
  /* Cuaderno limpio: el servidor recuerda el último estado y se lo reenvía a
     quien se conecte, así que sin esto la segunda pantalla hereda los trazos
     de la primera. */
  await p.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta();
                         fitAll(); encuadrar(); sync(); });
  await p.waitForTimeout(500);

  const esc = await medir(p);
  check(`${nombre}: arranca en modo escribir`, esc.modo === 'escribir', esc.modo);
  check(`${nombre}: el pizarrón pasa del 65 % de la pantalla`, esc.pct >= minimo,
        `${esc.w}×${esc.h}, ${esc.pct} %`);
  check(`${nombre}: la cinta queda en una tira`, esc.cinta > 0 && esc.cinta <= 24,
        esc.cinta + ' px');
  check(`${nombre}: pero sigue ahí, no desaparece`, esc.cinta > 0);
  check(`${nombre}: y el asa dice cómo abrirla`, esc.asa);
  check(`${nombre}: la columna no ocupa`, esc.lado === 0, esc.lado + ' px');

  // se puede escribir en modo escribir, que es de lo que se trata
  const b = await p.evaluate(()=>{const r=document.getElementById('board').getBoundingClientRect();
    return {x:r.left+r.width/2, y:r.top+r.height/2};});
  await p.mouse.move(b.x, b.y); await p.mouse.down();
  await p.mouse.move(b.x+120, b.y+60); await p.mouse.up();
  await p.waitForTimeout(300);
  check(`${nombre}: se escribe con normalidad`, await p.evaluate(()=>pg().items.length)===1);

  // el asa abre Revisar
  check(`${nombre}: el asa dice qué hace`,
        (await p.evaluate(()=>document.getElementById('cintaAsa').textContent.trim())) === 'Cinta');
  await p.click('#cintaAsa'); await p.waitForTimeout(800);
  const rev = await medir(p);
  check(`${nombre}: el asa abre Revisar`, rev.modo === 'revisar', rev.modo);
  check(`${nombre}: y devuelve la cinta entera y la columna`,
        rev.cinta > 100 && rev.controles > 0 && rev.lado > 100,
        JSON.stringify({cinta:rev.cinta, controles:rev.controles, lado:rev.lado}));
  check(`${nombre}: en Revisar el pizarrón se encoge, que es el precio`,
        rev.area < esc.area, `${rev.pct} % contra ${esc.pct} %`);

  /* Y desde Revisar hay que poder volver SIN teclado. Estuvo un rato siendo
     una puerta de una sola dirección: el asa solo salía en Escribir, así que
     abrías la cinta y no había manera visible de cerrarla, porque la tecla R
     y «Vista › Revisar» no se ven. En un iPad eso es un callejón sin salida. */
  const asa = await p.evaluate(()=>{
    const a = document.getElementById('cintaAsa');
    const q = a.getBoundingClientRect();
    return {visible: q.height > 0 && q.width > 0, texto: a.textContent.trim(),
            dentro: q.top >= 0 && q.bottom <= innerHeight};
  });
  check(`${nombre}: en Revisar el asa sigue a la vista para cerrar`,
        asa.visible && asa.dentro, JSON.stringify(asa));
  check(`${nombre}: y dice que oculta`, asa.texto === 'Ocultar', asa.texto);
  await p.click('#cintaAsa'); await p.waitForTimeout(800);
  check(`${nombre}: el asa cierra Revisar`,
        await p.evaluate(()=>modoActual())==='escribir');
  await p.keyboard.press('r'); await p.waitForTimeout(800);   // vuelve a Revisar
  // la tecla R hace lo mismo, y vuelve
  await p.keyboard.press('r'); await p.waitForTimeout(800);
  const vuelta = await medir(p);
  check(`${nombre}: la tecla R vuelve a Escribir`, vuelta.modo === 'escribir', vuelta.modo);
  check(`${nombre}: y el pizarrón recupera su tamaño exacto`,
        vuelta.w === esc.w && vuelta.h === esc.h,
        `${vuelta.w}×${vuelta.h} contra ${esc.w}×${esc.h}`);

  /* Lo que de verdad importa del cambio: el trazo tiene que caer donde apoyas
     la pluma en los dos modos. La rejilla cambia de tamaño al alternar, y si
     no se rehacen los lienzos el trazo sale desplazado. */
  const caida = async () => {
    const r = await p.evaluate(()=>{const q=document.getElementById('board').getBoundingClientRect();
      return {x:q.left+q.width*0.4, y:q.top+q.height*0.55};});
    await p.mouse.move(r.x, r.y); await p.mouse.down();
    await p.mouse.move(r.x+60, r.y); await p.mouse.up();
    await p.waitForTimeout(250);
    return p.evaluate(({x,y})=>{
      const it = pg().items[pg().items.length-1], cam = camB();
      const bb = document.getElementById('board').getBoundingClientRect();
      const esc2 = bb.height / document.getElementById('board')._cssH;
      const py = (it.pts[0].y - cam.y) * cam.s * esc2 + bb.top;
      return Math.abs(py - y);
    }, r);
  };
  check(`${nombre}: en Escribir el trazo cae donde apoyas`, await caida() < 2);
  await p.keyboard.press('r'); await p.waitForTimeout(800);
  check(`${nombre}: y en Revisar también`, await caida() < 2);

  check(`${nombre}: sin errores de JavaScript`, errs.length===0, errs.join(' | '));
  await ctx.close();
}

/* El modo se recuerda: si el profesor prefiere Revisar, no tiene que volver a
   elegirlo cada mañana. */
{
  const ctx = await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true});
  const p = await ctx.newPage();
  await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);
  await p.keyboard.press('r'); await p.waitForTimeout(700);
  check('cambiar a Revisar queda guardado', await p.evaluate(()=>modoActual())==='revisar');
  await p.reload(); await p.waitForTimeout(2800);
  check('y sigue en Revisar tras recargar', await p.evaluate(()=>modoActual())==='revisar',
        await p.evaluate(()=>modoActual()));
  await p.keyboard.press('r'); await p.waitForTimeout(700);
  await p.reload(); await p.waitForTimeout(2800);
  check('y al revés también', await p.evaluate(()=>modoActual())==='escribir',
        await p.evaluate(()=>modoActual()));
  await ctx.close();
}

/* La proyección y el alumno no tienen modos: enseñan el pizarrón y nada más. */
{
  const ctx = await nav.newContext({viewport:{width:1280,height:800}});
  const p = await ctx.newPage();
  await p.goto(BASE+'/?rol=proyeccion'); await p.waitForTimeout(2600);
  check('la proyección no enseña la tira ni el asa', await p.evaluate(()=>{
    const alto = id => { const e=document.getElementById(id); return e?e.getBoundingClientRect().height:0; };
    return alto('ribbonWrap')===0 && alto('cintaAsa')===0 && alto('bar')===0;
  }));
  await ctx.close();
}

await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`modos: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
