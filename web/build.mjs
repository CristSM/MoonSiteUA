// Genera web/index.html a partir de web/template.html + datos del motor.
// Uso:  cd web && npm install && node build.mjs [ruta/sites.json]
// Por defecto usa ../engine/sites_demo.json. Tras exportar desde Earth Engine:
//   python ../engine/import_gee.py moonsiteua_sitios.geojson  ->  ../engine/sites.json
//   node build.mjs ../engine/sites.json
import { readFileSync, writeFileSync } from 'node:fs';
import { geoNaturalEarth1, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
const sitesFile = process.argv[2] ? new URL(process.argv[2], `file://${process.cwd()}/`) : new URL('../engine/sites_demo.json', here);

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

// Recuadro de España: península a escala grande + Canarias en una caja abajo a la derecha.
// Anillos en sentido horario: d3 trabaja con polígonos esféricos.
const box = (w, s, e, n) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[w, s], [w, n], [e, n], [e, s], [w, s]]] } });
const IW = 480, IH = 340;
const penProj = geoMercator().fitExtent([[0, 0], [IW, IH]], box(-9.6, 35.9, 3.4, 43.9)).clipExtent([[0, 0], [IW, IH]]);
const pen = build(land50, penProj, IW, IH);
const CX = [[IW - 176, IH - 86], [IW - 6, IH - 6]];
const canProj = geoMercator().fitExtent([[CX[0][0] + 6, CX[0][1] + 6], [CX[1][0] - 6, CX[1][1] - 6]], box(-18.3, 27.5, -13.3, 29.5)).clipExtent(CX);
const can = build(land50, canProj, IW, IH);
const iberia = { w: IW, h: IH, d: pen.d, d2: can.d, pts: {},
  proj: [info(canProj, 'merc', [CX[0][0], CX[0][1], CX[1][0], CX[1][1]]), info(penProj, 'merc', [0, 0, IW, IH])], frames: [[CX[0][0], CX[0][1], CX[1][0] - CX[0][0], CX[1][1] - CX[0][1], 'Canarias']] };
for (const s of sites.sites) iberia.pts[s.id] = s.lon < -12 ? can.pts[s.id] : pen.pts[s.id];

const data = { targets: targets.targets, axesDoc: targets.axes, sites: sites.sites, map: { world, iberia }, demo: sites._doc.startsWith('SITIOS DE DEMO') };
const html = read('template.html')
  .replace('/*__DATA__*/null', JSON.stringify(data))
  .replace('/*__DISENOS__*/', () => read('../app/static/disenos.js'))
  .replace('/*__EXPLORADOR_CSS__*/', () => read('explorador.css'))
  .replace('/*__EXPLORADOR_JS__*/', () => read('explorador.js'));

// ---------------------------------------------------------------- páginas
// La plantilla marca bloques con <!--PAGE id--> ... <!--/PAGE-->. Cada página
// lleva la cabecera y el pie comunes más sus bloques.
const PAGES = [
  ['inicio', 'index.html', 'Inicio', 'La idea, cómo funciona y la hoja de ruta.'],
  ['demo', 'demo.html', 'Demo', 'Mapa interactivo: qué lugar de la Tierra se parece más a cada destino.'],
  ['juego', 'juego.html', 'Juego', '¿Cuál es mejor análogo? Pon a prueba tu intuición.'],
  ['app', 'recompensas.html', 'Recompensas', 'Moon y Mars Coins, bases por niveles, habitaciones y premios.'],
  ['metodo', 'metodo.html', 'Método', 'El Índice de Analogía Planetaria y sus 9 ejes.'],
  ['validacion', 'validacion.html', 'Validación', 'Balizas por consenso y escalado robótico.'],
  ['comunidad', 'comunidad.html', 'Comunidad', 'Puntos, misiones, insignias y bases virtuales.'],
  ['seguridad', 'seguridad.html', 'Seguridad', 'Una persona, una cuenta; modo expedición offline; privacidad.'],
  ['datos', 'datos.html', 'Datos', 'Las fuentes de la NASA y las agencias socias.'],
  ['video', 'video.html', 'Vídeo', 'MoonSiteUA en 30 segundos.'],
  ['explorador', 'explorador.html', 'Explorador', 'Regístrate, sube fotos, funda tu base y gana monedas.'],
];
const first = html.indexOf('<!--PAGE ');
const footer = html.indexOf('<footer>');
const head = html.slice(0, first), tail = html.slice(footer);
const blocks = {};
for (const m of html.slice(first, footer).matchAll(/<!--PAGE (\w+)-->([\s\S]*?)<!--\/PAGE-->/g)) (blocks[m[1]] ||= []).push(m[2]);

const out = [new URL('./', here), new URL('../docs/', here)];
for (const [id, file, label] of PAGES) {
  const nav = PAGES.filter(([pid]) => pid !== 'inicio')
    .map(([pid, f, l]) => `<a href="${f}"${pid === id ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  const apartados = PAGES.filter(([pid]) => pid !== 'inicio')
    .map(([, f, l, d], i) => `<a class="card" href="${f}"><span class="n">${String(i + 1).padStart(2, '0')}</span><b>${l}</b><span class="muted">${d}</span></a>`).join('');
  const page = (head.replace('<!--NAV-->', nav).replace('<title>MoonSiteUA</title>', `<title>${id === 'inicio' ? 'MoonSiteUA' : `MoonSiteUA · ${label}`}</title>`)
    + blocks[id].join('\n') + tail).replace('<!--APARTADOS-->', apartados);
  for (const dir of out) writeFileSync(new URL(file, dir), page);
}
console.log(`${PAGES.length} páginas · ${sites.sites.length} sitios · demo=${data.demo}`);
