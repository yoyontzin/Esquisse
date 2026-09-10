/* Identificación académica del programa.

   Un programa que no dice de quién es no se puede citar, y uno que no dice en
   qué estado está se usa como si estuviera terminado. Y una copia de
   evaluación que circula sin marca acaba siendo de nadie.

   Lo que se comprueba aquí es que los datos salen donde tienen que salir: en
   el panel, en la cabecera del documento, en la esquina del pizarrón del
   profesor, y en el pie de cada hoja del PDF. Y que NO salen donde estorban,
   que es la proyección: el grupo no tiene por qué mirar un aviso de licencia
   durante la clase. */
import { chromium } from 'playwright';
import { sembrarLibs } from './libs.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8778';
const ok=[],mal=[];
const check=(n,c,e='')=>(c?ok:mal).push(n+(e?' — '+e:''));

const nav = await chromium.launch();
const ctx = await nav.newContext({viewport:{width:1200,height:860},
                                  acceptDownloads:true, deviceScaleFactor:1});
await sembrarLibs(ctx, ['jspdf']);
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/?rol=control'); await p.waitForTimeout(2600);

/* --- los datos, en un solo sitio y con la forma canónica del nombre --- */
const datos = await p.evaluate(()=>({...APP, cita: citaTexto(), marca: marcaCorta()}));
check('el nombre va completo, no en iniciales',
      datos.autor === 'J. Rogelio Pérez-Buendía', datos.autor);
/* Todas las publicaciones del autor usan el nombre completo. Abreviarlo a
   «J. R.» fragmenta el perfil en MathSciNet, zbMATH y Scholar, y Zenodo
   renderiza APA en su caja de «Cite as», que sí abrevia. */
check('y la cita tampoco lo abrevia', !/J\.\s*R\.\s*P/.test(datos.cita), datos.cita);
check('lleva ORCID', /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(datos.orcid), datos.orcid);
check('lleva correo del autor', /@cimat\.mx$/.test(datos.correo), datos.correo);
check('lleva página', /^https:\/\//.test(datos.web), datos.web);
check('lleva el DOI de concepto', datos.doi === '10.5281/zenodo.22654651', datos.doi);
check('la cita lleva el DOI', datos.cita.includes(datos.doi));
check('dice la versión y que no está publicada',
      datos.version === '2.0 rc1' && /sin publicar|candidata/.test(datos.estado),
      `${datos.version} — ${datos.estado}`);
check('la marca corta identifica autor, versión y copia',
      datos.marca.includes(datos.autor) && datos.marca.includes(datos.version)
      && /evaluaci/i.test(datos.marca), datos.marca);
/* Sin número de registro no se inventa uno: el campo queda vacío y la marca
   no lo menciona. */
check('sin número de INDAUTOR, la marca no se lo inventa',
      datos.indautor ? datos.marca.includes(datos.indautor)
                     : !/INDAUTOR/i.test(datos.marca), String(datos.indautor));

/* --- en la cabecera del documento, para quien mire el fuente --- */
const meta = await p.evaluate(()=>{
  const m = n => { const e = document.querySelector(`meta[name="${n}"]`); return e ? e.content : null; };
  return {autor: m('author'), copy: m('copyright'), doi: m('citation_doi'),
          cita: m('citation_author')};
});
check('la cabecera del documento lleva al autor',
      meta.autor === datos.autor, String(meta.autor));
check('y el copyright', /©/.test(meta.copy || ''), String(meta.copy));
check('y el DOI para un gestor de referencias',
      meta.doi === datos.doi, String(meta.doi));

/* --- el panel --- */
await p.evaluate(()=>abrirAcerca()); await p.waitForTimeout(400);
const panel = await p.evaluate(()=>{
  const w = document.getElementById('acercaWrap');
  return {abierto: w.classList.contains('open'),
          texto: document.getElementById('acercaCuerpo').innerText,
          enlaces: [...document.querySelectorAll('#acercaCuerpo a')].map(a=>a.getAttribute('href'))};
});
check('el panel abre', panel.abierto);
for (const [q, re] of [['el autor', /Pérez-Buendía/], ['el ORCID', /0000-0002-7739-4779/],
                       ['la filiación', /CIMAT|Centro de Investigación/],
                       ['la advertencia de evaluación', /evaluación/i],
                       ['la de que no se exponga a internet', /no lo expongas a internet/i],
                       ['el copyright', /©/],
                       ['cómo pedir una evaluación institucional', /evaluación institucional/i]])
  check('el panel dice '+q, re.test(panel.texto), q);
/* El trámite consta en la página institucional del autor y en el comprobante
   de CIMAT, así que el panel lo dice. Lo que no puede hacer es inventarse un
   número que todavía no existe. */
check('el panel dice que el registro está en trámite',
      /en trámite/i.test(panel.texto));
check('y no se inventa un número de registro',
      datos.indautor ? panel.texto.includes(datos.indautor)
                     : !/03-\d{4}-\d+/.test(panel.texto), String(datos.indautor));
check('el panel enlaza el DOI',
      panel.enlaces.some(h=>h && h.includes('doi.org/'+datos.doi)), panel.enlaces.join(' '));
check('y el manual de la versión publicada',
      panel.enlaces.some(h=>h && h.includes(datos.doiVersion)));
check('y el correo para pedir licencia',
      panel.enlaces.some(h=>h && h.startsWith('mailto:'+datos.correo)));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
check('Escape lo cierra',
      !(await p.evaluate(()=>document.getElementById('acercaWrap').classList.contains('open'))));

/* --- la marca en el pizarrón del profesor, y NO en la proyección --- */
await p.evaluate(()=>{ state.nb=newNotebook(); state.pi=0; olvidarTinta(); fitAll(); encuadrar(); sync(); });
await p.waitForTimeout(500);
/* Comparar el mismo rincón con la marca puesta y quitada. Contar píxeles
   oscuros sin más no vale: en la proyección esa esquina son las bandas negras
   del formato 16:9, y salían 17 000 sin que hubiera ninguna marca. */
const diferenciaMarca = pag => pag.evaluate(()=>{
  const b = document.getElementById('board'), g = b.getContext('2d');
  const w = Math.round(b.width*0.45), h = Math.round(34*(window.devicePixelRatio||1));
  const leer = () => {
    const im = g.getImageData(0, b.height-h, w, h).data;
    let suma = 0;
    for (let i=0;i<im.length;i+=4) suma += im[i] + im[i+1] + im[i+2];
    return suma;
  };
  const antes = leer();
  const guardo = APP.evaluacion;
  APP.evaluacion = false; olvidarTinta(); drawBoard(); drawProj();
  const sin = leer();
  APP.evaluacion = guardo; olvidarTinta(); drawBoard(); drawProj();
  return Math.abs(antes - sin);
});
const enElPizarron = await diferenciaMarca(p);
check('el pizarrón del profesor lleva la marca', enElPizarron > 50000, String(enElPizarron));

{
  const pc = await nav.newContext({viewport:{width:1200,height:800}});
  const pr = await pc.newPage();
  await pr.goto(BASE+'/?rol=proyeccion'); await pr.waitForTimeout(2600);
  const enLaClase = await diferenciaMarca(pr);
  /* La proyección es lo que ve el grupo. Un aviso de licencia ahí sería ruido
     para ellos y ninguna protección para él. */
  check('la proyección NO la lleva', enLaClase === 0, String(enLaClase));
  await pc.close();
}

/* --- el pie de cada hoja del PDF, que es lo que circula --- */
await p.evaluate(()=>{ state.nb.name='Clase de prueba';
  const P=pg(); for (let k=0;k<4;k++){ const pts=[];
    for (let j=0;j<20;j++) pts.push({x:300+k*200+j*4, y:400+j*3});
    P.items.push({k:'s',c:0,w:3,pts}); }
  P.reveal=4; P.stops=[2]; olvidarTinta(); sync(); });
await p.waitForTimeout(400);
const [dl] = await Promise.all([
  p.waitForEvent('download', {timeout:45000}),
  p.evaluate(()=>exportPDF({porEtapas:true})),
]);
const ruta = '/tmp/prueba_autoria.pdf';
await dl.saveAs(ruta);
const { readFileSync } = await import('fs');
const crudo = readFileSync(ruta, 'latin1');
check('el PDF se generó', crudo.length > 10000, String(crudo.length));
/* jsPDF escribe el texto de cada hoja sin comprimir, así que se puede buscar
   tal cual. Los acentos van en otra codificación: se busca lo que no la lleva. */
check('cada hoja del PDF lleva el DOI', crudo.includes(datos.doi));
check('y el correo del autor', crudo.includes(datos.correo));
check('y dice que es una copia de evaluación', /evaluaci/i.test(crudo));
check('las propiedades del archivo llevan al autor',
      crudo.includes('Rogelio') || crudo.includes('Author'));

check('sin errores de JavaScript', errs.length===0, errs.join(' | '));
await nav.close();
console.log(ok.map(s=>'  ok  '+s).join('\n'));
if (mal.length) console.log(mal.map(s=>'  MAL '+s).join('\n'));
console.log(`autoría: ${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
