/* Lo que flota encima del pizarrón, y a quién tapa.

   Dos piezas del cromo no tienen alto fijo: el dock envuelve a dos filas
   según el ancho de la pantalla, y la barra de herramientas también. Cuando
   una crece, se come a la de al lado sin avisar, y las dos veces que pasó
   fue en el peor momento posible.

   El dock tapaba 113 de los 200 px de la banda de la lupa en modo clase, en
   las dos pantallas: más de la mitad de donde estás escribiendo.

   Y el aviso de «sin enlace» tapaba siete controles de la fila de
   herramientas —la pluma, el grosor, tres marcadores—. Deja pasar el toque,
   así que se puede apretar, pero a ciegas: no ves qué herramienta ni qué
   color tienes puesto. Y aparece justo cuando algo va mal.

   Se mide el área tapada de verdad, no si dos cajas se rozan. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();

/* Las dos pantallas donde se usa, con emulación táctil: es la regla de 44 px
   de tamaño mínimo de toque la que hace que las barras envuelvan, y sin ella
   caben en una línea y las medidas mienten. */
for (const [ancho, alto, nombre] of [[1180,820,'iPad de 11"'],[1366,1024,'iPad de 12.9"']]){
  const ctx = await nav.newContext({viewport:{width:ancho,height:alto}, hasTouch:true});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);
  await p.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta(); fitAll(); encuadrar(); sync(); });
  await p.waitForTimeout(400);

  for (const modo of ['escribir','revisar','clase']){
    await p.evaluate(m=>ponerModo(m), modo);
    await p.waitForTimeout(700);

    /* --- el aviso de «sin enlace» --- */
    const aviso = await p.evaluate(()=>{
      const a = document.getElementById('avisoEnlace');
      a.classList.add('visible');
      const r = a.getBoundingClientRect();
      const pisa = e => { const q = e.getBoundingClientRect();
        return q.width>0 && q.height>0 &&
               q.right>r.left && q.left<r.right && q.bottom>r.top && q.top<r.bottom; };
      const tapados = [...document.querySelectorAll('#bar button, #dock button')]
        .filter(pisa).map(b=>b.id || b.title || b.textContent.trim().slice(0,14));
      a.classList.remove('visible');
      return {visible: r.height > 0, tapados};
    });
    check(`${nombre}, ${modo}: el aviso de sin enlace se ve`, aviso.visible);
    check(`${nombre}, ${modo}: y no tapa ningún control`,
          aviso.tapados.length === 0, aviso.tapados.join(', '));

    /* --- la banda de la lupa contra el dock --- */
    await p.evaluate(()=>ponerLupa(true)); await p.waitForTimeout(800);
    const lupa = await p.evaluate(()=>{
      const caja = id => document.getElementById(id).getBoundingClientRect();
      const l = caja('lupa'), d = caja('dock'), w = caja('boardWrap'), b = caja('board');
      const x = Math.max(0, Math.min(l.right,d.right) - Math.max(l.left,d.left));
      const y = Math.max(0, Math.min(l.bottom,d.bottom) - Math.max(l.top,d.top));
      return {tapado: Math.round(y), altoLupa: Math.round(l.height),
              dockVisible: d.height > 0,
              /* La lupa se sube por encima del dock, y el lienzo tiene que
                 encogerse otro tanto: si no, la banda se le monta encima y
                 tapa justo la línea que acabas de escribir. */
              montada: Math.round(b.bottom - l.top)};
    });
    check(`${nombre}, ${modo}: la banda de la lupa conserva su alto`,
          lupa.altoLupa >= 140, lupa.altoLupa + ' px');
    check(`${nombre}, ${modo}: el dock no tapa la lupa`,
          lupa.tapado === 0, lupa.tapado + ' px tapados');
    /* El lienzo termina donde empieza la banda, con un par de píxeles de
       holgura por el redondeo. La banda no se le monta encima. */
    check(`${nombre}, ${modo}: el lienzo termina donde empieza la banda`,
          lupa.montada <= 2, lupa.montada + ' px montados');
    await p.evaluate(()=>ponerLupa(false)); await p.waitForTimeout(500);

    /* --- la barra de «Pegar aquí» contra el dock ---
       Vivía a 76 px del borde de abajo y el dock mide 113 cuando envuelve a
       dos filas, así que la barra entera caía dentro. Se cortaba algo y el
       botón para recuperarlo estaba debajo del dock. */
    const pegar = await p.evaluate(()=>{
      document.body.classList.add('hayPortapapeles');
      const b = document.getElementById('pegarBar').getBoundingClientRect();
      const d = document.getElementById('dock').getBoundingClientRect();
      const x = Math.max(0, Math.min(b.right,d.right) - Math.max(b.left,d.left));
      const y = Math.max(0, Math.min(b.bottom,d.bottom) - Math.max(b.top,d.top));
      document.body.classList.remove('hayPortapapeles');
      return {visible: b.height > 0, tapado: Math.round(y), area: Math.round(x*y),
              dentro: b.top >= 0 && b.bottom <= innerHeight};
    });
    check(`${nombre}, ${modo}: la barra de pegar se ve`, pegar.visible);
    check(`${nombre}, ${modo}: y entera dentro de la pantalla`, pegar.dentro);
    check(`${nombre}, ${modo}: el dock no la tapa`,
          pegar.tapado === 0, pegar.tapado + ' px tapados');
  }

  /* Con la lupa puesta en modo clase, el trazo tiene que seguir cayendo donde
     apoyas la pluma: subir la banda cambia el alto del lienzo, y si no se
     rehace la rejilla el trazo sale desplazado. Es el mismo fallo que cazó
     prueba_modos al repartir los tres modos. */
  await p.evaluate(()=>ponerModo('clase')); await p.waitForTimeout(600);
  await p.evaluate(()=>ponerLupa(true));    await p.waitForTimeout(900);
  {
    const r = await p.evaluate(()=>{const q=document.getElementById('board').getBoundingClientRect();
      return {x:q.left+q.width*0.4, y:q.top+q.height*0.4};});
    await p.mouse.move(r.x, r.y); await p.mouse.down();
    await p.mouse.move(r.x+70, r.y); await p.mouse.up();
    await p.waitForTimeout(300);
    const desvio = await p.evaluate(({x,y})=>{
      const it = pg().items[pg().items.length-1], cam = camB();
      const b = document.getElementById('board');
      const bb = b.getBoundingClientRect();
      const esc = bb.height / b._cssH;
      return Math.abs((it.pts[0].y - cam.y) * cam.s * esc + bb.top - y);
    }, r);
    check(`${nombre}: con la lupa en clase el trazo cae donde apoyas`,
          desvio < 2, desvio + ' px de desvío');
  }
  await p.evaluate(()=>ponerLupa(false));

  check(`${nombre}: sin errores de JavaScript`, errs.length===0, errs.join(' | '));
  await ctx.close();
}

await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`solapes: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
