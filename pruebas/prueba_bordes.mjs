/* Saber dónde se acaba la hoja, y dónde va a saltar la lupa.

   El marco del pizarrón se dibujaba con las esquinas marcadas, y eso sirve
   mientras el borde se ve. Escribiendo al 170 %, que es como se escribe de
   verdad con lápiz, los cuatro bordes quedan fuera de la pantalla: se llega al
   final de la hoja a media derivación y hay que rehacerla.

   En la lupa pasaba lo mismo con el salto automático. Al pasar del 72 % del
   ancho la ventana se corre sola, y sin aviso el salto llega de sorpresa a
   media palabra. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();
const ctx = await nav.newContext({viewport:{width:1200,height:820}});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);
await p.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta(); fitAll(); encuadrar(); sync(); });
await p.waitForTimeout(400);

/* Cuenta los píxeles con tinte cálido en una franja vertical del lienzo. La
   banda de margen es ámbar sobre papel blanco, así que se reconoce por tener
   el rojo bastante por encima del azul. */
const calidos = (desde, hasta) => p.evaluate(({d,h})=>{
  const b = document.getElementById('board'), g = b.getContext('2d');
  const x0 = Math.round(b.width*d), x1 = Math.round(b.width*h);
  const im = g.getImageData(x0, Math.round(b.height*0.35), x1-x0, Math.round(b.height*0.3)).data;
  let n = 0;
  for (let i=0;i<im.length;i+=4)
    if (im[i] > im[i+2] + 8 && im[i] > 200) n++;
  return n;
}, {d:desde, h:hasta});

// --- con la hoja entera a la vista, el borde se ve y no hace falta más ---
{
  const centro = await calidos(0.45, 0.55);
  check('encuadrado, el centro de la hoja está limpio', centro < 40, String(centro));
}

/* --- acercado al borde derecho, que es el caso que no estaba cubierto --- */
const ventana = await p.evaluate(()=>{
  const cam = camB();
  cam.s = 1.7;
  // colocar la vista de modo que el borde derecho de la hoja caiga dentro
  cam.x = MARCO.w - (board._cssW / cam.s) * 0.85;
  cam.y = 400;
  limitarCam(); olvidarTinta(); drawBoard();
  // dónde cae ese borde, en fracción del ancho del lienzo
  const M = marcoRect(camB());
  return {borde: (M.x + M.w) / board._cssW, s: camB().s};
});
await p.waitForTimeout(400);
{
  check('el borde derecho de la hoja queda dentro de la vista',
        ventana.borde > 0.4 && ventana.borde < 1,
        `en el ${Math.round(ventana.borde*100)} % del ancho`);
  const cerca = await calidos(Math.max(0, ventana.borde - 0.10), ventana.borde - 0.005);
  const lejos = await calidos(0.02, 0.15);
  check('acercado, el borde de la hoja avisa antes de llegar', cerca > 2000, String(cerca));
  check('y el interior sigue limpio', lejos < 300, String(lejos));
  check('el aviso está junto al borde y no en el otro lado',
        cerca > lejos * 8 + 100, `${cerca} contra ${lejos}`);
}

/* La clase no recibe la banda: ve el marco lleno y esto sería ruido. */
{
  const proyCtx = await nav.newContext({viewport:{width:1280,height:800}});
  const proy = await proyCtx.newPage();
  await proy.goto(BASE+'/?rol=proyeccion'); await proy.waitForTimeout(2600);
  const enLaClase = await proy.evaluate(()=>{
    const b = document.getElementById('board'), g = b.getContext('2d');
    const im = g.getImageData(Math.round(b.width*0.9), Math.round(b.height*0.35),
                              Math.round(b.width*0.09), Math.round(b.height*0.3)).data;
    let n = 0;
    for (let i=0;i<im.length;i+=4)
      if (im[i] > im[i+2] + 8 && im[i] > 200) n++;
    return n;
  });
  check('la proyección no enseña la banda de margen', enLaClase < 200, String(enLaClase));
  await proyCtx.close();
}

/* --- la lupa --- */
await p.evaluate(()=>{ encuadrar(); ponerLupa(true); });
await p.waitForTimeout(900);

const enLupa = (desde, hasta, filtro) => p.evaluate(({d,h,f})=>{
  const c = document.getElementById('lupaCanvas'), g = c.getContext('2d');
  const x0 = Math.round(c.width*d), x1 = Math.round(c.width*h);
  const im = g.getImageData(x0, 0, x1-x0, c.height).data;
  let n = 0;
  for (let i=0;i<im.length;i+=4){
    const r=im[i], v=im[i+1], b=im[i+2];
    if (f === 'calido'  && r > b + 8 && r > 200) n++;
    if (f === 'azulado' && b > r + 8) n++;
  }
  return n;
}, {d:desde, h:hasta, f:filtro});

{
  const avisoDerecha = await enLupa(0.80, 0.99, 'calido');
  const izquierdaLimpia = await enLupa(0.05, 0.30, 'calido');
  check('la lupa avisa de dónde va a saltar la ventana',
        avisoDerecha > 2000, String(avisoDerecha));
  check('y no lo hace en la parte donde aún hay sitio',
        izquierdaLimpia < 300, String(izquierdaLimpia));

  /* El renglón guía estaba al 14 % de opacidad, o sea invisible: en una
     captura al doble de resolución no se distinguía del papel. */
  const renglon = await enLupa(0.05, 0.60, 'azulado');
  check('el renglón guía se ve de verdad', renglon > 200, String(renglon));
}

check('sin errores de JavaScript', errs.length===0, errs.join(' | '));
await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`bordes: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
