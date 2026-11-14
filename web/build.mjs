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
const world = build(land110, geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' }), W, H);

// Recuadro de España: península a escala grande + Canarias en una caja abajo a la derecha.
// Anillos en sentido horario: d3 trabaja con polígonos esféricos.
const box = (w, s, e, n) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[w, s], [w, n], [e, n], [e, s], [w, s]]] } });
const IW = 480, IH = 340;
const pen = build(land50, geoMercator().fitExtent([[0, 0], [IW, IH]], box(-9.6, 35.9, 3.4, 43.9)).clipExtent([[0, 0], [IW, IH]]), IW, IH);
const CX = [[IW - 176, IH - 86], [IW - 6, IH - 6]];
const can = build(land50, geoMercator().fitExtent([[CX[0][0] + 6, CX[0][1] + 6], [CX[1][0] - 6, CX[1][1] - 6]], box(-18.3, 27.5, -13.3, 29.5)).clipExtent(CX), IW, IH);
const iberia = { w: IW, h: IH, d: pen.d, d2: can.d, pts: {}, frames: [[CX[0][0], CX[0][1], CX[1][0] - CX[0][0], CX[1][1] - CX[0][1], 'Canarias']] };
for (const s of sites.sites) iberia.pts[s.id] = s.lon < -12 ? can.pts[s.id] : pen.pts[s.id];

const data = { targets: targets.targets, axesDoc: targets.axes, sites: sites.sites, map: { world, iberia }, demo: sites._doc.startsWith('SITIOS DE DEMO') };
const html = read('template.html').replace('/*__DATA__*/null', JSON.stringify(data));
writeFileSync(new URL('index.html', here), html);
writeFileSync(new URL('../docs/index.html', here), html);  // GitHub Pages sirve /docs
console.log(`index.html: ${(html.length / 1024).toFixed(0)} KB, ${sites.sites.length} sitios, demo=${data.demo}`);
