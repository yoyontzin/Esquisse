/* Los tres modos.

   «Escribir» es el de fábrica y deja el pizarrón con la barra y una tira de
   18 px: en un iPad de 11 pulgadas el área de escritura pasa del 45.7 % de la
   pantalla al 74 %. Los doce controles de la cinta y la columna lateral viven
   en «Revisar», que es donde se marcan stops, se reordenan páginas y se
   comprueba el encuadre.

   Una prueba que quiera tocar «Escribir hasta el stop» o «Poner stop» tiene
   que entrar a Revisar primero. Esto lo hace, y es idempotente. */
export async function revisar(pagina){
  await pagina.evaluate(()=>{ if (typeof modoActual === 'function' && modoActual() !== 'revisar') alternarRevisar(); });
  await pagina.waitForFunction(()=>{
    const e = document.getElementById('controls');
    return !!e && e.getBoundingClientRect().height > 0;
  }, null, {timeout:8000});
  await pagina.waitForTimeout(250);      // el reencuadre tras cambiar la rejilla
}
export async function escribir(pagina){
  await pagina.evaluate(()=>{ if (typeof modoActual === 'function' && modoActual() === 'revisar') alternarRevisar(); });
  await pagina.waitForTimeout(250);
}
