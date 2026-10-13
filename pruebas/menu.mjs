/* Los controles de documento ya no están sueltos en una fila: viven detrás de
   cinco menús. Una prueba que quiera tocar «Nueva página» tiene que abrir el
   menú primero, y hacerlo a mano en quince archivos es la clase de detalle que
   se olvida en el dieciséis. Esto lo abre solo. */
const DONDE = {
  libBtn:'mArchivo', nbName:'mArchivo', folder:'mArchivo', toFiles:'mArchivo',
  srvSave:'mArchivo', pdf:'mArchivo', rec:'mArchivo', exp:'mArchivo', imp:'mArchivo',
  pAdd:'mPagina', pDup:'mPagina', pIzq:'mPagina', pDer:'mPagina', pDel:'mPagina',
  undoRafaga:'mPagina',
  paper:'mFondo', guide:'mFondo', gsize:'mFondo', guideMine:'mFondo',
  bgColor:'mFondo', bgClear:'mFondo', fondoBtn:'mFondo',
  imgIns:'mInsertar', imgBg:'mInsertar', pdfIn:'mInsertar', capturar:'mInsertar',
  pasteBtn:'mInsertar',
  openProj:'mVista', full:'mVista', fit:'mVista', ladoBtn:'mVista',
  nombresBtn:'mVista', reglasBtn:'mVista', pencilOnly:'mVista', pointBtn:'mVista',
  fondoPanelBtn:'mFondo',
};
/* Y desde que la barra pasó a una sola fila mientras se escribe, los cinco
   menús solo salen en Revisar: son gestión del documento y ocupaban la
   segunda fila ellos solos, 232 px de los 1158 que hay en un iPad de 11
   pulgadas. Entrar a Revisar antes de abrirlos va aquí, en el mismo sitio
   donde ya se resolvió abrir el menú, y no repartido por ocho archivos. */
async function conMenusALaVista(p){
  await p.evaluate(()=>{
    if (typeof modoActual === 'function' && modoActual() === 'escribir')
      alternarRevisar();
  });
  await p.waitForFunction(()=>{
    const e = document.getElementById('menus');
    return !!e && e.getBoundingClientRect().height > 0;
  }, null, {timeout:8000});
  await p.waitForTimeout(200);          // el reencuadre tras cambiar la rejilla
}

/* Las páginas se fueron a la barra de navegación, que nace cerrada. */
export async function abrirNavegacion(p){
  await p.evaluate(()=>{ if (typeof ponerNav === 'function') ponerNav(true); });
  await p.waitForFunction(()=>{
    const e = document.getElementById('navBar');
    return !!e && e.getBoundingClientRect().height > 0;
  }, null, {timeout:8000});
  await p.waitForTimeout(150);
}

/* Y el puntero pasó al menú Vista: es herramienta de dar clase, no de
   preparar, y en clase vive en el dock. */
export async function elegirPuntero(p){
  await conMenusALaVista(p);
  await p.click('#mVista'); await p.waitForTimeout(160);
  await p.click('#pointBtn'); await p.waitForTimeout(200);
}

export async function abrirMenuDe(p, id){
  const m = DONDE[id];
  if (!m) return;
  await conMenusALaVista(p);
  const ya = await p.evaluate(b => {
    const pnl = document.getElementById(MENUS[b]);
    return !!pnl && pnl.classList.contains('abierto');
  }, m).catch(()=>false);
  if (!ya){ await p.click('#'+m); await p.waitForTimeout(140); }
}
/* Y se devuelve el modo como estaba.

   Entrar a Revisar cambia el tamaño del lienzo, y hay pruebas que comparan dos
   pestañas píxel a píxel: si una usa un menú y se queda en Revisar mientras la
   otra sigue en Escribir, una mide 1056×625 y la otra 1280×753 y la
   comparación falla por algo que no se está comprobando. Las pruebas se
   escribieron cuando los menús se alcanzaban sin cambiar de modo, y esto las
   deja como estaban. */
async function modoDe(p){
  return p.evaluate(()=> typeof modoActual === 'function' ? modoActual() : null);
}
async function volverA(p, modo){
  if (modo !== 'escribir') return;
  if (await modoDe(p) !== 'revisar') return;
  await p.evaluate(()=>alternarRevisar());
  await p.waitForTimeout(250);
}
export async function tocar(p, id){
  const antes = await modoDe(p);
  await abrirMenuDe(p, id);
  await p.click('#'+id);
  await volverA(p, antes);
}
export async function elegir(p, id, v){
  const antes = await modoDe(p);
  await abrirMenuDe(p, id);
  await p.selectOption('#'+id, v);
  await volverA(p, antes);
}
