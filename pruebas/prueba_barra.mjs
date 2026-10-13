/* Qué está a la vista mientras se escribe, y qué no.

   La barra eran 32 botones en dos filas y 108 px de alto. Los grupos sumaban
   1372 px de ancho para los 1158 que hay en un iPad de 11 pulgadas, así que la
   segunda fila la ocupaban los cinco menús desplegables ellos solos.

   Se quedan los que se alcanzan cada minuto: colores, grosor, pluma, marcador,
   goma, formas, fórmulas, lupa, lazo y deshacer. Los cinco menús son gestión
   del documento y salen en Revisar, a un toque del asa.

   Lo que de verdad hay que vigilar no es el tamaño, que es fácil de medir,
   sino que nada se quede sin puerta. Quitar un botón de la barra y olvidar
   dónde vivía su función es la manera silenciosa de perder una función. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();

for (const [w,h,nombre] of [[1180,820,'iPad de 11"'],[1366,1024,'iPad de 12.9"']]){
  const ctx = await nav.newContext({viewport:{width:w,height:h}, hasTouch:true});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);
  await p.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta();
                         fitAll(); encuadrar(); sync(); });
  await p.evaluate(()=>ponerModo('escribir')); await p.waitForTimeout(700);

  const barra = await p.evaluate(()=>{
    const bar = document.getElementById('bar').getBoundingClientRect();
    const bt  = document.getElementById('barTools');
    const btns = [...bt.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0);
    /* Una fila se reconoce por que todos los botones caben en la altura de
       uno, no por que compartan el mismo `top`: los botones pequeños van
       centrados y quedan unos píxeles más abajo. Contar tops distintos daba
       dos filas donde la barra mide 57 px y solo cabe una. */
    const arriba = Math.min(...btns.map(b=>b.getBoundingClientRect().top));
    const abajo  = Math.max(...btns.map(b=>b.getBoundingClientRect().bottom));
    const filas = (abajo - arriba) <= 52 ? 1 : 2;
    const disp = bt.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(bt).gap) || 0;
    let suma = 0, n = 0;
    for (const g of bt.children){ const q=g.getBoundingClientRect();
      if (q.height){ suma += q.width; n++; } }
    const chicos = btns.filter(b=>{ const q=b.getBoundingClientRect();
      return q.width < 44 || q.height < 44; }).map(b=>b.id||b.title||'?');
    return {alto:Math.round(bar.height), n:btns.length, filas,
            margen: Math.round(disp - (suma + (n-1)*gap)), chicos,
            menus: document.getElementById('menus').getBoundingClientRect().height > 0};
  });
  check(`${nombre}: escribiendo, la barra es una sola fila`,
        barra.filas === 1, barra.filas + ' filas');
  check(`${nombre}: y no pasa de 60 px de alto`, barra.alto <= 60, barra.alto + ' px');
  /* Margen de verdad y no cero: con 66 px de deslizador la fila necesitaba
     exactamente los 1158 disponibles y envolvía por redondeo. */
  check(`${nombre}: le sobra ancho, no va justa`, barra.margen >= 15, barra.margen + ' px');
  /* Los 44 px de toque no se negocian: con el Pencil no se ve el punto de
     contacto bajo la punta. Encoger la barra no puede pagarse con esto. */
  check(`${nombre}: ningún botón baja de 44 px`,
        barra.chicos.length === 0, barra.chicos.join(', '));
  check(`${nombre}: los menús no salen escribiendo`, !barra.menus);

  await p.evaluate(()=>ponerModo('revisar')); await p.waitForTimeout(800);
  check(`${nombre}: y vuelven en Revisar`,
        await p.evaluate(()=>document.getElementById('menus').getBoundingClientRect().height>0));
  await p.evaluate(()=>ponerModo('escribir')); await p.waitForTimeout(600);
  check(`${nombre}: sin errores de JavaScript`, errs.length===0, errs.join(' | '));
  await ctx.close();
}

/* --- lo que salió de la barra sigue teniendo puerta --- */
{
  const ctx = await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);
  await p.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta();
                         addPage(false); addPage(false); ponerModo('revisar'); sync(); });
  await p.waitForTimeout(800);

  const enLaBarra = id => p.evaluate(x=>{
    const e = document.getElementById(x);
    return !!e && !!e.closest('#barTools');
  }, id);
  for (const id of ['fondoPanelBtn','pointBtn','pPrev','pNext'])
    check(`${id} ya no está en la barra de herramientas`, !(await enLaBarra(id)));
  check('la lupa sí se queda: se usa escribiendo', await enLaBarra('lupaBtn'));

  /* El panel de papeles con miniaturas solo lo abría el botón que se quitó.
     Si se hubiera borrado sin más, el panel quedaba inalcanzable y el <select>
     del menú no es lo mismo. */
  check('el botón de los papeles vive ahora en el menú Fondo',
        await p.evaluate(()=>!!document.getElementById('fondoPanelBtn').closest('#menuFondo')));
  await p.evaluate(()=>abrirMenu('mFondo')); await p.waitForTimeout(400);
  await p.click('#fondoPanelBtn'); await p.waitForTimeout(600);
  const panel = await p.evaluate(()=>{
    const e = document.getElementById('panelFondo').getBoundingClientRect();
    return {abierto: e.height > 0, dentro: e.top >= 0 && e.left >= 0 && e.right <= innerWidth};
  });
  check('y desde ahí el panel de papeles abre', panel.abierto);
  /* Anclado al botón del menú y no al suyo: al elegir en un menú el menú se
     cierra, y un botón escondido mide cero, así que el panel se iba a la
     esquina de arriba a la izquierda. */
  check('y abre donde se ve, no en una esquina', panel.dentro, JSON.stringify(panel));
  await p.evaluate(()=>document.body.classList.remove('conFondoPanel'));

  check('el puntero vive ahora en el menú Vista',
        await p.evaluate(()=>!!document.getElementById('pointBtn').closest('#menuVista')));
  await p.evaluate(()=>abrirMenu('mVista')); await p.waitForTimeout(400);
  await p.click('#pointBtn'); await p.waitForTimeout(500);
  check('y desde ahí el puntero se enciende',
        await p.evaluate(()=>ui.tool === 'point'), await p.evaluate(()=>ui.tool));
  await p.evaluate(()=>setTool('pen'));

  /* Las páginas se fueron a la barra de navegación, que es donde ahora se
     navega. Tienen que seguir cambiando de página de verdad. */
  check('las páginas están en la barra de navegación',
        await p.evaluate(()=>!!document.getElementById('pPrev').closest('#navBar')));
  await p.evaluate(()=>{ ponerModo('escribir'); ponerNav(true); state.pi = 0; sync(); });
  await p.waitForTimeout(700);
  const antes = await p.evaluate(()=>state.pi);
  await p.click('#pNext'); await p.waitForTimeout(500);
  check('y desde ahí se pasa de página', await p.evaluate(()=>state.pi) === antes + 1,
        `de ${antes} a ${await p.evaluate(()=>state.pi)}`);
  check('y el rótulo lo dice',
        /2 \/ 3/.test(await p.evaluate(()=>document.getElementById('pageLbl').textContent)),
        await p.evaluate(()=>document.getElementById('pageLbl').textContent));
  await p.click('#pPrev'); await p.waitForTimeout(500);
  check('y se vuelve', await p.evaluate(()=>state.pi) === antes);

  check('sin errores de JavaScript', errs.length===0, errs.join(' | '));
  await ctx.close();
}

await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`barra: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
