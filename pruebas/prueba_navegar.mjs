/* Moverse entre paradas sin pagar pantalla por ello.

   Para ir de una parada a otra había que estar en Revisar, que cuesta el 28 %
   de la pantalla, o en modo clase, donde los saltos van mezclados con las
   herramientas en el dock. Escribiendo, que es donde se prepara la clase, no
   había ninguna manera.

   La barra vive en el hueco que ya sobraba. Medido: la hoja es 16:9 y está
   limitada por el ANCHO, así que quedan 58 px de alto sin usar en el iPad de
   11 pulgadas y 158 en el de 12.9. Por eso lo que se comprueba aquí no es que
   la barra aparezca, que es fácil, sino que aparezca SIN quitarle superficie a
   la hoja. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();

const preparar = async p => p.evaluate(()=>{
  state.nb=newNotebook(); state.pi=0; olvidarHistorial(); olvidarTinta();
  const P=pg();
  for (let k=0;k<9;k++){ const pts=[];
    for (let j=0;j<18;j++) pts.push({x:200+k*180+j*6, y:350+j*4});
    P.items.push({k:'s',c:0,w:4,pts}); }
  P.stops=[2,4,6]; P.reveal=4;
  fitAll(); encuadrar(); sync();
});

for (const [w,h,nombre] of [[1180,820,'iPad de 11"'],[1366,1024,'iPad de 12.9"']]){
  const ctx = await nav.newContext({viewport:{width:w,height:h}, hasTouch:true});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);
  await preparar(p); await p.waitForTimeout(500);

  /* Cerrada, solo se ve el asa, y el asa es pequeña a propósito. */
  await p.evaluate(()=>ponerNav(false)); await p.waitForTimeout(300);
  const cerrada = await p.evaluate(()=>{
    const a=document.getElementById('navAsa').getBoundingClientRect();
    const b=document.getElementById('navBar').getBoundingClientRect();
    return {asa:a.height>0, altoAsa:Math.round(a.height), barra:b.height>0};
  });
  check(`${nombre}: cerrada solo se ve el asa`, cerrada.asa && !cerrada.barra,
        JSON.stringify(cerrada));
  check(`${nombre}: y el asa es una tira`, cerrada.altoAsa <= 24, cerrada.altoAsa+' px');

  for (const modo of ['escribir','revisar']){
    await p.evaluate(m=>ponerModo(m), modo); await p.waitForTimeout(700);
    await p.click('#navAsa'); await p.waitForTimeout(400);
    const r = await p.evaluate(()=>{
      const b=document.getElementById('navBar').getBoundingClientRect();
      const M=marcoRect(camB());
      const botones=[...document.querySelectorAll('#navBar button')]
        .map(x=>{const q=x.getBoundingClientRect(); return {id:x.id,w:Math.round(q.width),h:Math.round(q.height)};});
      return {visible:b.height>0, tapaHoja:Math.max(0,Math.round((M.y+M.h)-b.top)),
              dentro:b.top>=0 && b.bottom<=innerHeight,
              asa:document.getElementById('navAsa').getBoundingClientRect().height>0,
              botones};
    });
    check(`${nombre}, ${modo}: el asa la abre`, r.visible);
    /* Lo que da sentido a todo esto. */
    check(`${nombre}, ${modo}: NO le quita superficie a la hoja`,
          r.tapaHoja === 0, r.tapaHoja+' px tapados');
    check(`${nombre}, ${modo}: cabe entera en la pantalla`, r.dentro);
    check(`${nombre}, ${modo}: con la barra abierta el asa se retira`, !r.asa);
    /* Se tocan con el lápiz en la mano y con el grupo mirando. */
    const flechas = r.botones.filter(b=>b.id==='navPrev'||b.id==='navNext');
    check(`${nombre}, ${modo}: las flechas son grandes de tocar`,
          flechas.length===2 && flechas.every(b=>b.w>=44 && b.h>=44),
          JSON.stringify(flechas));
    await p.click('#navCerrar'); await p.waitForTimeout(300);
    check(`${nombre}, ${modo}: y «Ocultar» la cierra`,
          !(await p.evaluate(()=>document.body.classList.contains('navegando'))));
  }

  /* En clase no sale: el dock ya lleva sus flechas, y ahí sí taparía hoja. */
  await p.evaluate(()=>{ ponerModo('clase'); ponerNav(true); }); await p.waitForTimeout(700);
  check(`${nombre}: en modo clase no aparece, que el dock ya navega`,
        await p.evaluate(()=>document.getElementById('navBar').getBoundingClientRect().height===0));
  await p.evaluate(()=>ponerModo('escribir')); await p.waitForTimeout(600);
  check(`${nombre}: sin errores de JavaScript`, errs.length===0, errs.join(' | '));
  await ctx.close();
}

/* --- que las flechas hagan lo que dicen --- */
{
  const ctx = await nav.newContext({viewport:{width:1180,height:820}, hasTouch:true});
  const p = await ctx.newPage();
  await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);
  await preparar(p); await p.waitForTimeout(500);
  await p.evaluate(()=>{ ponerModo('escribir'); ponerNav(true); }); await p.waitForTimeout(600);

  const estado = () => p.evaluate(()=>({reveal:pg().reveal,
    txt:document.getElementById('navPos').textContent,
    prevApagada:document.getElementById('navPrev').disabled,
    nextApagada:document.getElementById('navNext').disabled}));

  check('dice por qué parada va', (await estado()).txt === 'parada 2 de 3',
        (await estado()).txt);
  await p.click('#navPrev'); await p.waitForTimeout(350);
  check('la flecha izquierda va a la parada anterior', (await estado()).reveal === 2,
        JSON.stringify(await estado()));
  await p.click('#navNext'); await p.waitForTimeout(350);
  check('y la derecha a la siguiente', (await estado()).reveal === 4,
        JSON.stringify(await estado()));
  /* Hasta el principio y hasta el final, y ahí las flechas se apagan en vez
     de no hacer nada, que es lo que deja al profesor dudando. */
  /* Mientras siga encendida: al llegar al principio se apaga, y pedirle a
     Playwright que apriete un botón apagado lo deja esperando treinta
     segundos por algo que no va a pasar. */
  const aporrear = async id => {
    for (let i=0;i<8;i++){
      if (await p.evaluate(x=>document.getElementById(x).disabled, id)) break;
      await p.click('#'+id); await p.waitForTimeout(160);
    }
  };
  await aporrear('navPrev');
  const alInicio = await estado();
  check('al principio se detiene', alInicio.reveal === 0, JSON.stringify(alInicio));
  check('y la flecha izquierda se apaga', alInicio.prevApagada);
  await aporrear('navNext');
  const alFinal = await estado();
  check('al final se detiene', alFinal.reveal === 9, JSON.stringify(alFinal));
  check('y lo dice', /al final/.test(alFinal.txt), alFinal.txt);
  check('y la flecha derecha se apaga', alFinal.nextApagada);

  /* Se recuerda, como la lupa y el modo. */
  await p.reload(); await p.waitForTimeout(2800);
  check('queda abierta tras recargar',
        await p.evaluate(()=>document.body.classList.contains('navegando')));
  await p.evaluate(()=>ponerNav(false)); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(2800);
  check('y cerrada también',
        !(await p.evaluate(()=>document.body.classList.contains('navegando'))));
  await ctx.close();
}

/* La clase no ve nada de esto: es el mando del profesor. */
for (const rol of ['proyeccion','alumno']){
  const ctx = await nav.newContext({viewport:{width:1280,height:800}});
  const p = await ctx.newPage();
  await p.goto(BASE+'/?rol='+rol); await p.waitForTimeout(2600);
  check(`la vista de ${rol} no la enseña`, await p.evaluate(()=>{
    const alto = id => { const e=document.getElementById(id); return e?e.getBoundingClientRect().height:0; };
    return alto('navAsa')===0 && alto('navBar')===0;
  }));
  await ctx.close();
}

await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`navegar: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
