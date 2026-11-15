// Genera web/index.html a partir de web/template.html + datos del motor.
// Uso:  cd web && npm install && node build.mjs [ruta/sites.json]
// Por defecto usa ../engine/sites.json si existe y, si no, ../engine/sites_demo.json. Tras exportar desde Earth Engine:
//   python ../engine/import_gee.py moonsiteua_sitios.geojson  ->  ../engine/sites.json
//   node build.mjs ../engine/sites.json
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { geoNaturalEarth1, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
// Sitios por defecto: los reales (engine/sites.json) si existen; si no, los de demostración
const sitesFile = process.argv[2] ? new URL(process.argv[2], `file://${process.cwd()}/`)
  : existsSync(new URL('../engine/sites.json', here)) ? new URL('../engine/sites.json', here) : new URL('../engine/sites_demo.json', here);

const targets = JSON.parse(read('../engine/targets.json'));
const sites = JSON.parse(readFileSync(sitesFile, 'utf8'));
const land110 = feature(JSON.parse(read('node_modules/world-atlas/land-110m.json')), 'land');
const land50 = feature(JSON.parse(read('node_modules/world-atlas/land-50m.json')), 'land');

function build(land, projection, w, h) {
  const path = geoPath(projection).digits(1);
  const pts = {};
  for (const s of sites.sites) {
    const p = projection([s.lon, s.lat]);
    pts[s.id] = p && p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h ? [+p[0].toFixed(1), +p[1].toFixed(1)] : null;
  }
  return { w, h, d: path(land), pts };
}

const W = 960, H = 480;
// Parámetros de cada proyección, para situar en el navegador puntos que no existen
// al generar la web (los puntos nuevos de la comunidad).
const info = (p, t, clip) => ({ t, k: p.scale(), tx: p.translate()[0], ty: p.translate()[1], clip });
const worldProj = geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' });
const world = { ...build(land110, worldProj, W, H), proj: [info(worldProj, 'ne', [0, 0, W, H])] };

// Mapa regional para la geovalla: suroeste de Norteamérica (El Pinacate, Mojave, Valle de la Muerte, Meteor Crater…).
// Anillos en sentido horario: d3 trabaja con polígonos esféricos.
const box = (w, s, e, n) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[w, s], [w, n], [e, n], [e, s], [w, s]]] } });
const RW = 480, RH = 340;
const regProj = geoMercator().fitExtent([[0, 0], [RW, RH]], box(-121.5, 26.5, -105.5, 42.5)).clipExtent([[0, 0], [RW, RH]]);
const region = { ...build(land50, regProj, RW, RH), proj: [info(regProj, 'merc', [0, 0, RW, RH])] };

// perfiles de Analog Finder para la Demo (si existen)
const perfiles = existsSync(new URL('../engine/analog_profiles.json', here)) ? JSON.parse(read('../engine/analog_profiles.json')) : null;
const data = { targets: targets.targets, axesDoc: targets.axes, sites: sites.sites, map: { world, region }, demo: sites._doc.startsWith('SITIOS DE DEMO'), perfiles };
const html = read('template.html')
  .replace('/*__DATA__*/null', JSON.stringify(data))
  .replace('/*__DISENOS__*/', () => read('../app/static/disenos.js'))
  .replace('/*__EXPLORADOR_CSS__*/', () => read('explorador.css'))
  .replace('/*__EXPLORADOR_JS__*/', () => read('explorador.js'))
  // datos reales del método: solo se inyectan en la página Método (no en el objeto común D)
  .replace('/*__METODO__*/null', () => read('../engine/metodo_data.json'))
  // datos reales del juego: solo en la página Juego
  .replace('/*__JUEGO__*/null', () => read('../engine/juego_data.json'));

// ---------------------------------------------------------------- páginas
// La plantilla marca bloques con <!--PAGE id--> ... <!--/PAGE-->. Cada página
// lleva la cabecera y el pie comunes más sus bloques.
const PAGES = [
  ['inicio', 'index.html', 'Inicio', 'La idea, cómo funciona y la hoja de ruta.'],
  ['demo', 'demo.html', 'Explorar', 'Mapa interactivo: qué lugar de la Tierra se parece más a cada destino.'],
  ['juego', 'juego.html', 'Juego', 'Tres juegos con datos reales: duelo de análogos, encuentra el gemelo y ¿estudiado o por descubrir?'],
  ['app', 'recompensas.html', 'Recompensas', 'Moon y Mars Coins, bases por niveles, habitaciones y premios.'],
  ['metodo', 'metodo.html', 'Método', 'Huellas de terreno, gemelos planetarios, validación y novedad bibliográfica.'],
  ['validacion', 'validacion.html', 'Validación', 'Balizas por consenso y escalado robótico.'],
  ['flota', 'flota.html', 'Flota', 'El dron Céfiro y el robot Talpa en 3D: piezas, datos y curiosidades.'],
  ['comunidad', 'comunidad.html', 'Comunidad', 'Puntos, misiones, insignias y bases virtuales.'],
  ['seguridad', 'seguridad.html', 'Seguridad', 'Una persona, una cuenta; modo expedición offline; privacidad.'],
  ['datos', 'datos.html', 'Datos', 'Las fuentes de la NASA y las agencias socias.'],
  ['video', 'video.html', 'Vídeo', 'MoonSiteUA en 30 segundos.'],
  ['explorador', 'explorador.html', 'Explorador', 'Regístrate, sube fotos, funda tu base y gana monedas.'],
];
// Texto ampliado de cada apartado en el índice de la portada
const MAS = {
  demo: 'Mapa mundial con el índice de cada sitio para los tres perfiles de misión. Cada ficha muestra en qué se parece y en qué no, y lo que la Tierra no puede imitar. Puedes cambiar el peso de cada dimensión y aportar tus propios datos.',
  juego: 'Tres juegos con los datos reales del motor: elige el mejor análogo para cada destino, encuentra el gemelo lunar o marciano de un relieve terrestre y adivina qué lugares ya estudia la ciencia.',
  app: 'Moon Coins para decorar y Mars Coins para premios físicos. Cada zona tiene una base que crece una planta cada cinco exploradores, con habitaciones que cada uno decora a su gusto.',
  metodo: 'Comparamos 7,9 millones de celdas de la Tierra con 1.345 sitios de la Luna y Marte usando las mismas métricas de relieve, puntuamos tres perfiles de misión con pesos explícitos, comprobamos que el método recupera los análogos conocidos y medimos cuánto se ha estudiado ya cada candidata.',
  validacion: 'Nadie confirma un análogo en solitario: hacen falta varios exploradores independientes que coincidan. Las zonas peligrosas se cierran al público y pasan a misiones con robots.',
  flota: 'Dos máquinas diseñadas por el equipo para las zonas a las que no debe ir una persona: un dron que vuela sin GPS y baja una sonda a las simas, y un robot de seis patas que rueda, camina y hace rápel. Gíralos en 3D, despiézalos y pulsa cada pieza.',
  comunidad: 'Misiones que llevan a la gente a los datos que faltan, insignias para quien descubre primero y bases virtuales que crecen con cada explorador que llega.',
  seguridad: 'Una persona, una cuenta; captura de datos sin cobertura móvil; una geovalla que impide enviar datos desde casa; y ninguna misión en zonas peligrosas o protegidas.',
  datos: 'Todo sale de datos abiertos: satélites de la NASA y Copernicus DEM para la Tierra, LRO para la Luna y MGS para Marte, con datos de la ESA, la JAXA y Japón (METI).',
  video: 'La idea completa en medio minuto: del satélite al terreno y del terreno a la comunidad.',
  explorador: 'Crea tu cuenta, aporta fotos y medidas, funda una base o únete a una existente, decora tu habitación y gana monedas.',
};
const first = html.indexOf('<!--PAGE ');
const footer = html.indexOf('<footer>');
const head = html.slice(0, first), tail = html.slice(footer);
const blocks = {};
for (const m of html.slice(first, footer).matchAll(/<!--PAGE (\w+)-->([\s\S]*?)<!--\/PAGE-->/g)) (blocks[m[1]] ||= []).push(m[2]);

// Versión en inglés: web/en/*.html (diccionario en i18n/en.py -> i18n/en.json)
const EN = JSON.parse(read('i18n/en.json'));
const RUN = /(?<=[>"'`}])([^<>"'`${}]*[A-Za-zÁÉÍÓÚÜáéíóúüñÑ¿¡][^<>"'`${}]*)(?=[<"'`$])/g;
// El JSON del método se traduce recorriendo solo sus valores: así ninguna clave cambia aunque coincida con un texto del diccionario
function traducirValores(o) {
  if (typeof o === 'string') { const k = o.trim(); return EN.textos[k] ? o.replace(k, EN.textos[k]) : o; }
  if (Array.isArray(o)) return o.map(traducirValores);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, traducirValores(v)]));
  return o;
}
function traducir(page) {
  // los JSON de datos (método y juego) se apartan, se traducen solo en sus valores y se vuelven a poner
  const apartados = [];
  // METODO y JUEGO van en su propio <script> (hasta «;</script>»); D ocupa una sola línea del script común
  for (const [MK, FIN] of [['window.METODO = ', ';</script>'], ['window.JUEGO = ', ';</script>'], ['const D = ', null]]) {
    const iM = page.indexOf(MK); if (iM < 0) continue;
    let jM;
    if (FIN) jM = page.indexOf(FIN, iM);
    else { const fin = page.indexOf(String.fromCharCode(10), iM); jM = page.lastIndexOf(';', fin < 0 ? page.length : fin); }
    const json = page.slice(iM + MK.length, jM); if (json.trim() === 'null') continue;
    const marca = `__JSON_EN_${apartados.length}__`; apartados.push([marca, JSON.stringify(traducirValores(JSON.parse(json)))]);
    page = page.slice(0, iM + MK.length) + marca + page.slice(jM);
  }
  page = traducirTexto(page);
  for (const [marca, json] of apartados) page = page.replace(marca, () => json);
  return page;
}
function traducirTexto(page) {
  for (const [a, b] of EN.crudo) page = page.split(a).join(b);
  page = page.replace(RUN, (run) => { const k = run.trim(); return EN.textos[k] ? run.replace(k, EN.textos[k]) : run; });
  return page.replace('window.I18N = /*__I18N__*/null;', () => `window.I18N = ${JSON.stringify({ textos: EN.textos, patrones: EN.patrones })};`);
}
// Visor 3D de la flota (Three.js empaquetado con esbuild): solo va en flota.html,
// y se inserta después de traducir para que el diccionario no toque la librería.
const flota3d = buildSync({ entryPoints: [fileURLToPath(new URL('flota3d.js', here))], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' })
  .outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const conVisor = (p) => p.replace('<!--FLOTA3D-->', () => `<script>${flota3d}</script>`);
const out = [new URL('./', here), new URL('../docs/', here)];
for (const dir of out) mkdirSync(new URL('en/', dir), { recursive: true });
for (const [id, file, label] of PAGES) {
  const nav = PAGES.filter(([pid]) => pid !== 'inicio')
    .map(([pid, f, l]) => `<a href="${f}"${pid === id ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  // Índice de la portada: dos columnas de apartados que se despliegan (uno abierto a la vez)
  const items = PAGES.filter(([pid]) => pid !== 'inicio')
    .map(([pid, f, l, d], i) => `<details class="ap" name="apartados"><summary><span class="n">${String(i + 1).padStart(2, '0')}</span><b>${l}</b><span class="muted">${d}</span><span class="mas" aria-hidden="true"></span></summary>`
      + `<div class="ap-body"><div class="ap-fig" data-fig="${pid}"></div><div class="ap-txt"><p>${MAS[pid]}</p><a class="btn primary" href="${f}">Ir al apartado</a></div></div></details>`);
  const mitad = Math.ceil(items.length / 2);
  const apartados = `<div class="ap-col">${items.slice(0, mitad).join('')}</div><div class="ap-col">${items.slice(mitad).join('')}</div>`;
  const page = (head.replace('<!--NAV-->', nav).replace('<title>MoonSiteUA</title>', `<title>${id === 'inicio' ? 'MoonSiteUA' : `MoonSiteUA · ${label}`}</title>`)
    + blocks[id].join('\n') + tail).replace('<!--APARTADOS-->', apartados);
  const es = page.replace('<!--LANG-->', `<a class="lang" href="en/${file}" hreflang="en" lang="en" title="English">EN</a>`);
  const en = traducir(page.replace('<!--LANG-->', `<a class="lang" href="../${file}" hreflang="es" lang="es" title="Español">ES</a>`));
  for (const dir of out) { writeFileSync(new URL(file, dir), conVisor(es)); writeFileSync(new URL('en/' + file, dir), conVisor(en)); }
}
console.log(`${PAGES.length} páginas × 2 idiomas · ${sites.sites.length} sitios · demo=${data.demo}`);
// las imágenes y three.js (web/vendor) no las escribe el build: se copian a la versión de GitHub Pages
cpSync(new URL('img/', here), new URL('../docs/img/', here), {recursive: true});
cpSync(new URL('vendor/', here), new URL('../docs/vendor/', here), {recursive: true});
cpSync(new URL('media/', here), new URL('../docs/media/', here), {recursive: true});
