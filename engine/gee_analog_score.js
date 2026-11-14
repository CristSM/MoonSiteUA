/******************************************************************************
 * MoonSiteUA · Motor de similitud planetaria (Google Earth Engine)
 *
 * Qué hace:
 *   1. Calcula 9 ejes 0-1 para cada píxel de la Tierra con datos NASA.
 *   2. Los compara con un perfil de la Luna o Marte -> Índice de Analogía
 *      Planetaria (IAP, 0-100) y una capa por eje (dónde se parece y dónde no).
 *   3. Busca automáticamente los mejores candidatos en una región.
 *   4. Exporta las variables de los sitios de la web (sites.json).
 *
 * Cómo usarlo:
 *   - Cuenta gratuita en https://code.earthengine.google.com (uso educativo).
 *   - Pegar este archivo en el Code Editor y pulsar Run.
 *   - Cambiar TARGET_ID y REGION abajo.
 *
 * La fórmula es la misma que engine/analog_score.py y web/index.html.
 ******************************************************************************/

// ------------------------------------------------------------- configuración
var TARGET_ID = 'marte_jezero';  // luna_polo_sur | luna_mares_tubos | marte_jezero | marte_arcadia
var REGION = ee.Geometry.Rectangle([-10, 35.5, 4.5, 44]);  // España peninsular
var START = '2015-01-01', END = '2025-01-01';
var SCALE_SEARCH = 5000;  // m. Subir a 10000 para regiones grandes.

// Perfiles objetivo (copia de engine/targets.json)
var TARGETS = {
  luna_polo_sur: {
    v: {aridez:1, desnudez:1, frio:1, amplitud:0.45, mafico:0.2, relieve:0.8, altitud:1, polvo:0, hielo:1},
    w: {aridez:1, desnudez:1, frio:1.5, amplitud:0.5, mafico:0.7, relieve:1.2, altitud:0.4, polvo:0.6, hielo:1.6}},
  luna_mares_tubos: {
    v: {aridez:1, desnudez:1, frio:0.55, amplitud:1, mafico:1, relieve:0.25, altitud:1, polvo:0, hielo:0},
    w: {aridez:1, desnudez:1, frio:0.5, amplitud:1.3, mafico:1.8, relieve:0.8, altitud:0.3, polvo:0.5, hielo:0.6}},
  marte_jezero: {
    v: {aridez:1, desnudez:1, frio:1, amplitud:1, mafico:0.85, relieve:0.3, altitud:1, polvo:0.8, hielo:0.1},
    w: {aridez:1.3, desnudez:1, frio:0.8, amplitud:1, mafico:1.4, relieve:0.6, altitud:0.6, polvo:1.2, hielo:0.4}},
  marte_arcadia: {
    v: {aridez:1, desnudez:1, frio:1, amplitud:0.8, mafico:0.7, relieve:0.05, altitud:1, polvo:0.6, hielo:0.85},
    w: {aridez:1, desnudez:1, frio:1.2, amplitud:0.6, mafico:0.6, relieve:1.5, altitud:0.5, polvo:0.8, hielo:1.6}}
};
var AXES = ['aridez','desnudez','frio','amplitud','mafico','relieve','altitud','polvo','hielo'];

// ------------------------------------------------------------- datos NASA
// Temperatura de superficie (MODIS Terra, 8 días, 1 km). Escala 0.02 K.
var lst = ee.ImageCollection('MODIS/061/MOD11A2').filterDate(START, END);
var lstDay = lst.select('LST_Day_1km').mean().multiply(0.02).subtract(273.15);
var lstNight = lst.select('LST_Night_1km').mean().multiply(0.02).subtract(273.15);
var lstMedia = lstDay.add(lstNight).divide(2).rename('lst_media_c');
var lstAmp = lstDay.subtract(lstNight).rename('lst_amplitud_c');

// Vegetación (MODIS NDVI 16 días, 1 km). Percentil 90 ~ máximo anual robusto.
var ndvi = ee.ImageCollection('MODIS/061/MOD13A2').filterDate(START, END)
  .select('NDVI').reduce(ee.Reducer.percentile([90])).multiply(0.0001).rename('ndvi_max');

// Precipitación (GPM IMERG mensual V07, mm/h) -> mm/año
var precip = ee.ImageCollection('NASA/GPM_L3/IMERG_MONTHLY_V07').filterDate(START, END)
  .select('precipitation').mean().multiply(24 * 365).rename('precip_mm');

// Relieve: NASADEM (60N-56S) completado con la elevación de ASTER GED fuera de ese rango
var aster = ee.Image('NASA/ASTER_GED/AG100_003');
var dem = ee.Image('NASA/NASADEM_HGT/001').select('elevation')
  .unmask(aster.select('elevation')).rename('altitud_m');
var pendiente = ee.Terrain.slope(dem).rename('pendiente_deg');

// Mineralogía aproximada con la emisividad térmica de ASTER (100 m).
// Las rocas ricas en sílice tienen una caída de emisividad en las bandas 10-12
// (8-9.5 µm); en las basálticas esa caída es pequeña. Cociente alto = máfico.
// Solo es fiable en suelo desnudo: por eso pesa junto con 'desnudez'.
function em(b) { return aster.select('emissivity_band' + b).multiply(0.001); }
var mafico = em(10).add(em(11)).add(em(12)).divide(3)
  .divide(em(13).add(em(14)).divide(2)).rename('mafico_ratio');

// Polvo y aerosoles: MODIS Atmosphere mensual (1°). Escala 0.001.
var aod = ee.ImageCollection('MODIS/061/MOD08_M3').filterDate(START, END)
  .select('Aerosol_Optical_Depth_Land_Ocean_Mean_Mean').mean().multiply(0.001).rename('aod');

// Nieve/hielo: fracción de días despejados con nieve (MODIS diario, 500 m)
var nieve = ee.ImageCollection('MODIS/061/MOD10A1').filterDate('2020-01-01', '2023-01-01')
  .select('NDSI_Snow_Cover').map(function (i) { return i.gte(40); })
  .mean().rename('nieve_frac');

var tierra = aster.select('land_water_map').eq(1);

var fisicas = ee.Image.cat([precip, ndvi, lstMedia, lstAmp, mafico, pendiente, dem, aod, nieve.unmask(0)])
  .updateMask(tierra);

// ------------------------------------------------------------- normalización
function c01(img) { return img.max(0).min(1); }
var ejes = ee.Image.cat([
  c01(ee.Image(1).subtract(fisicas.select('precip_mm').add(1).log10().divide(Math.log(3001) / Math.LN10))).rename('aridez'),
  c01(ee.Image(1).subtract(fisicas.select('ndvi_max').subtract(0.05).divide(0.45))).rename('desnudez'),
  c01(ee.Image(30).subtract(fisicas.select('lst_media_c')).divide(80)).rename('frio'),
  c01(fisicas.select('lst_amplitud_c').divide(40)).rename('amplitud'),
  c01(fisicas.select('mafico_ratio').subtract(0.85).divide(0.13)).rename('mafico'),
  c01(fisicas.select('pendiente_deg').divide(25)).rename('relieve'),
  c01(fisicas.select('altitud_m').divide(5000)).rename('altitud'),
  c01(fisicas.select('aod').divide(0.6)).rename('polvo'),
  c01(fisicas.select('nieve_frac')).rename('hielo')
]);

// ------------------------------------------------------------- índice
function analogia(target) {
  var sumW = 0, acc = ee.Image(0);
  var sims = AXES.map(function (a) {
    var s = ee.Image(1).subtract(ejes.select(a).subtract(target.v[a]).abs()).rename('sim_' + a);
    acc = acc.add(s.multiply(target.w[a]));
    sumW += target.w[a];
    return s;
  });
  return acc.divide(sumW).multiply(100).rename('iap').addBands(ee.Image.cat(sims));
}

var T = TARGETS[TARGET_ID];
var res = analogia(T);

// ------------------------------------------------------------- mapa
var pal = ['0e1320', '2b3a67', '6b5b95', 'c06c84', 'f67280', 'f8b195'];
Map.centerObject(REGION, 6);
Map.addLayer(res.select('iap').clip(REGION), {min: 30, max: 80, palette: pal}, 'IAP · ' + TARGET_ID);
Map.addLayer(res.select('sim_mafico').clip(REGION), {min: 0, max: 1}, 'similitud · mineralogía', false);
Map.addLayer(res.select('sim_frio').clip(REGION), {min: 0, max: 1}, 'similitud · frío', false);
Map.addLayer(ejes.select('desnudez').clip(REGION), {min: 0, max: 1}, 'eje · desnudez', false);

// ------------------------------------------------------------- búsqueda
// Muestrea la región y devuelve los 25 mejores puntos. Son "Zonas de Interés
// no exploradas" para la capa base del mapa de la app.
var muestras = res.select('iap').addBands(ejes)
  .sample({region: REGION, scale: SCALE_SEARCH, numPixels: 20000, geometries: true, tileScale: 4})
  .sort('iap', false).limit(25);
print('Top 25 candidatos en la región', muestras);
Map.addLayer(muestras, {color: 'ffd166'}, 'Top candidatos');
Export.table.toDrive({collection: muestras, description: 'moonsiteua_candidatos_' + TARGET_ID, fileFormat: 'GeoJSON'});

// ------------------------------------------------------------- sitios web
// Variables físicas medias en un radio de 2 km. El GeoJSON exportado sustituye
// a engine/sites_demo.json (mismos nombres de campo).
var SITIOS = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-70.02, -24.08]), {id: 'atacama_yungay'}),
  ee.Feature(ee.Geometry.Point([-89.67, 75.38]), {id: 'haughton'}),
  ee.Feature(ee.Geometry.Point([162.00, -77.50]), {id: 'dry_valleys'}),
  ee.Feature(ee.Geometry.Point([-13.75, 29.00]), {id: 'timanfaya'}),
  ee.Feature(ee.Geometry.Point([-6.60, 37.72]), {id: 'rio_tinto'}),
  ee.Feature(ee.Geometry.Point([59.20, 30.40]), {id: 'dasht_e_lut'}),
  ee.Feature(ee.Geometry.Point([91.80, 38.30]), {id: 'qaidam'}),
  ee.Feature(ee.Geometry.Point([-2.39, 37.05]), {id: 'tabernas'}),
  ee.Feature(ee.Geometry.Point([-1.48, 42.20]), {id: 'bardenas'}),
  ee.Feature(ee.Geometry.Point([-3.85, 38.85]), {id: 'calatrava'}),
  ee.Feature(ee.Geometry.Point([-3.37, 37.05]), {id: 'sierra_nevada'}),
  ee.Feature(ee.Geometry.Point([-2.15, 36.78]), {id: 'cabo_gata'}),
  ee.Feature(ee.Geometry.Point([-16.62, 28.25]), {id: 'teide'})
]).map(function (f) { return f.setGeometry(f.geometry().buffer(2000)); });

var sitios = fisicas.reduceRegions({collection: SITIOS, reducer: ee.Reducer.mean(), scale: 1000, tileScale: 4});
print('Variables de los sitios', sitios);
Export.table.toDrive({collection: sitios, description: 'moonsiteua_sitios', fileFormat: 'GeoJSON'});

/* Nota: Antártida (dry_valleys) queda fuera de NASADEM y ASTER GED (59S).
   Para ese sitio, completar altitud/pendiente con 'COPERNICUS/DEM/GLO30' o REMA. */
