/* El arranque con el guardado local en mal estado.

   `boot()` no tenía `try`. Un `index` que no fuera arreglo reventaba en
   `.sort`, y un cuaderno con un elemento nulo reventaba en `fixItem`. Cuando
   eso pasaba se llevaba por delante el resto del arranque, incluido
   `conectar()`: la aplicación abría, se veía completamente normal, los botones
   estaban, y el iPad no enlazaba nunca. Sin ningún síntoma.

   Las otras cuarenta pruebas arrancan siempre con perfil limpio, así que
   ninguna lo habría visto. */
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const CASOS = {
  'index es un objeto y no un arreglo': s => { s.setItem('index','{"a":1}'); },
  'un cuaderno con un elemento nulo': s => {
    s.setItem('index','[{"id":"x","updated":1}]');
    s.setItem('nb:x','{"id":"x","name":"roto","pages":[{"items":[null],"reveal":0,"stops":[]}]}');
  },
  'JSON cortado a la mitad': s => { s.setItem('index','[{"id":"y","up'); },
  'index con una entrada nula': s => { s.setItem('index','[null]'); },
  'un cuaderno sin páginas': s => {
    s.setItem('index','[{"id":"z","updated":1}]');
    s.setItem('nb:z','{"id":"z","name":"vacio"}');
  },
};

const nav = await chromium.launch();

for (const [nombre, sembrar] of Object.entries(CASOS)){
  const ctx = await nav.newContext({viewport:{width:1200,height:820}});
  const p = await ctx.newPage();
  await p.addInitScript(`(${sembrar.toString()})(localStorage)`);
  await p.goto(BASE+'/?rol=control');
  await p.waitForTimeout(2600);

  const v = await p.evaluate(()=>({
    lienzo: Math.round(document.getElementById('board').getBoundingClientRect().width) > 0,
    enlace: !!net.es,
    paginas: state.nb && state.nb.pages ? state.nb.pages.length : 0,
    herramienta: ui.tool,
  }));
  check(`con ${nombre}, el pizarrón abre`, v.lienzo && v.paginas >= 1, JSON.stringify(v));
  /* Lo que de verdad importa. Que abra ya lo hacía antes: lo que no hacía era
     conectar, y sin enlace no hay clase. */
  check(`con ${nombre}, el enlace se establece`, v.enlace === true, JSON.stringify(v));

  // y se puede trabajar, no solo mirar
  const b = await p.evaluate(()=>{const r=document.getElementById('board').getBoundingClientRect();
    return {x:r.left+r.width/2, y:r.top+r.height/2};});
  await p.mouse.move(b.x, b.y); await p.mouse.down();
  await p.mouse.move(b.x+90, b.y+40); await p.mouse.up();
  await p.waitForTimeout(400);
  check(`con ${nombre}, se puede escribir`,
        await p.evaluate(()=>pg().items.length) >= 1);
  await ctx.close();
}

/* Y el caso sano no puede haberse estropeado al hacerlo tolerante: lo escrito
   antes tiene que seguir volviendo tras recargar. */
{
  const ctx = await nav.newContext({viewport:{width:1200,height:820}});
  const p = await ctx.newPage();
  await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2500);
  await p.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarHistorial(); sync(); });
  const b = await p.evaluate(()=>{const r=document.getElementById('board').getBoundingClientRect();
    return {x:r.left+r.width/2, y:r.top+r.height/2};});
  for (let i=0;i<4;i++){
    await p.mouse.move(b.x+i*30, b.y); await p.mouse.down();
    await p.mouse.move(b.x+i*30+40, b.y+50); await p.mouse.up();
  }
  await p.waitForTimeout(2600);                    // el rebote de guardado
  const antes = await p.evaluate(()=>pg().items.length);
  await p.reload(); await p.waitForTimeout(3000);
  const luego = await p.evaluate(()=>pg().items.length);
  check('con el guardado sano, lo escrito sobrevive a recargar',
        luego === antes && antes >= 4, `${antes} -> ${luego}`);
  await ctx.close();
}

await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`arranque: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
