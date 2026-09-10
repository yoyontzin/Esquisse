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
  nombresBtn:'mVista', reglasBtn:'mVista', pencilOnly:'mVista',
};
export async function abrirMenuDe(p, id){
  const m = DONDE[id];
  if (!m) return;
  const ya = await p.evaluate(b => {
    const pnl = document.getElementById(MENUS[b]);
    return !!pnl && pnl.classList.contains('abierto');
  }, m).catch(()=>false);
  if (!ya){ await p.click('#'+m); await p.waitForTimeout(140); }
}
export async function tocar(p, id){ await abrirMenuDe(p, id); await p.click('#'+id); }
export async function elegir(p, id, v){ await abrirMenuDe(p, id); await p.selectOption('#'+id, v); }
