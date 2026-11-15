# Datos y recursos del reto

Qué ofrece cada recurso de la página del reto, qué usamos y para qué. Los identificadores `ee.*` son los de Google Earth Engine, que evita descargar los datos.

## Tierra (NASA)

### NASA Earthdata Search — https://search.earthdata.nasa.gov
Buscador central de todos los productos de ciencias de la Tierra de la NASA. Sirve para encontrar el nombre exacto de un producto y su DOI. Para el hackathon es más rápido usar los mismos productos ya cargados en Earth Engine:

| Producto | ID en Earth Engine | Resolución | Uso en MoonSiteUA |
|---|---|---|---|
| MODIS Terra LST 8 días (MOD11A2 v6.1) | `MODIS/061/MOD11A2` · `LST_Day_1km`, `LST_Night_1km` (escala 0,02 K) | 1 km | Frío y amplitud térmica |
| MODIS NDVI 16 días (MOD13A2 v6.1) | `MODIS/061/MOD13A2` · `NDVI` (escala 0,0001) | 1 km | Ausencia de vegetación |
| GPM IMERG mensual V07 | `NASA/GPM_L3/IMERG_MONTHLY_V07` · `precipitation` (mm/h) | 0,1° (~11 km) | Aridez |
| NASADEM | `NASA/NASADEM_HGT/001` · `elevation` | 30 m (60N-56S) | Altitud, pendiente |
| ASTER Global Emissivity Dataset | `NASA/ASTER_GED/AG100_003` · `emissivity_band10..14` (escala 0,001), `elevation`, `ndvi`, `land_water_map` | 100 m, 2000-2008 | Indicador de roca basáltica; máscara tierra/agua |
| MODIS Atmosphere mensual (MOD08_M3) | `MODIS/061/MOD08_M3` · `Aerosol_Optical_Depth_Land_Ocean_Mean_Mean` | 1° | Polvo |
| MODIS nieve diaria (MOD10A1) | `MODIS/061/MOD10A1` · `NDSI_Snow_Cover` | 500 m | Hielo/nieve |

Ampliaciones si sobra tiempo: SMAP (humedad del suelo), MODIS MCD12Q1 (cobertura del suelo, clase 16 = suelo desnudo), Landsat (detalle a 30 m), ECOSTRESS (temperatura a 70 m).

### NASA Worldview — https://worldview.earthdata.nasa.gov
Visor de imágenes satelitales casi en tiempo real. No hace falta programar. Úsalo para:
- Capturas para la web y el vídeo (color real MODIS/VIIRS de cada sitio).
- Ver tormentas de polvo (capa de aerosoles) como proceso análogo a Marte.
- Comprobar visualmente que un candidato del motor tiene sentido.

## Luna y Marte

### NASA Planetary Data System (PDS) — https://pds.nasa.gov
Archivo a largo plazo de todas las misiones planetarias. Para Marte, lo más útil está en el nodo de Geociencias (Mars Orbital Data Explorer) y en los productos de MRO (CRISM, HiRISE, SHARAD) y de Perseverance.

### LRO en el nodo de Geociencias — https://pds-geosciences.wustl.edu/missions/lro/
Instrumentos de LRO y dónde está archivado cada uno:

| Instrumento | Qué mide | Dónde |
|---|---|---|
| Diviner | Temperatura de superficie | Este nodo |
| LOLA | Altimetría láser: relieve, pendientes, iluminación | Este nodo |
| LEND | Neutrones: hidrógeno (posible hielo) | Este nodo |
| Mini-RF | Radar: rugosidad y posible hielo | Este nodo |
| LROC | Cámaras (imágenes de simas y tubos de lava) | Nodo de datos de LROC |
| LAMP | Ultravioleta (escarcha superficial) | Nodo de Imágenes |
| CRaTER | Radiación | Nodo PPI |

### LRO Diviner — https://pds-geosciences.wustl.edu/missions/lro/diviner.htm
Productos disponibles (todos en PDS4):
- **EDR / RDR**: datos brutos y calibrados, 2009 a 2026.
- **GDR L2/L3**: mapas globales derivados.
- **PCP (Polar Cumulative Products)**: temperaturas polares acumuladas, 2009-2020. **Es el producto clave para el polo sur.**
- **PRP (Polar Resource Products)**: productos de recursos polares (estabilidad del hielo).
- **RCP, GHRM, EPF**: productos regionales, mosaicos globales de alta resolución y función de fase.
- Ojo: los RDR desde abril de 2019 tienen huecos de temperatura de brillo marcados con −9999.

Cifras útiles para la web (con su fuente):
- En una zona en sombra permanente del cráter Cabeus, donde impactó LCROSS, la temperatura media anual es de unos 37 K (Diviner).
- En Haworth hay zonas cuya temperatura máxima parece no superar nunca ~40 K.

### Otros datos de Marte usados en los perfiles
- **Perseverance MEDA** (Jezero): aire de unos −55 °C de media, con variaciones de 50-60 °C entre el día y la noche; presión de ~7 mbar; muchos remolinos de polvo.
- **SWIM** (https://swim.psi.edu): mapas de probabilidad de hielo subsuperficial combinando radar, térmico, neutrones, altimetría e imágenes. Arcadia Planitia y Deuteronilus Mensae destacan como zonas con hielo accesible.
- **Regiones candidatas de Artemis III** (NASA, octubre 2024): Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2 y Slater Plain.

## Agencias socias

### CSA · RADARSAT Constellation Mission (RCM) y RADARSAT-1
Radar de apertura sintética (SAR): ve de día y de noche y a través de nubes. RADARSAT-1 (1995-2013) tiene el archivo publicado con licencia abierta. Interés para nosotros:
- **Rugosidad del terreno** a escala de metros (la retrodispersión del radar), comparable conceptualmente con Mini-RF en la Luna.
- **Humedad del suelo y hielo**: el radar distingue suelo seco, hielo y agua.
- Tutorial oficial en Python + QGIS: https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial

### ESA · Copernicus Data Space — https://dataspace.copernicus.eu
Datos Sentinel gratuitos: Sentinel-2 (óptico 10 m, minerales de óxido de hierro), Sentinel-1 (radar, también en Earth Engine como `COPERNICUS/S1_GRD`), Sentinel-3 (temperatura) y Sentinel-5P (aerosoles). Copernicus DEM GLO-30 (`COPERNICUS/DEM/GLO30`) cubre la Antártida, donde NASADEM no llega.

### ESA · Open Science Catalog — https://opensciencedata.esa.int
Catálogo de conjuntos de datos y flujos de trabajo de geociencias; útil para buscar productos derivados (permafrost, hielo).

### JAXA · G-Portal — https://gportal.jaxa.jp
Productos de GCOM-C (vegetación, temperatura), GCOM-W (humedad del suelo, nieve) y GSMaP (precipitación). Alternativa o validación cruzada de MODIS y GPM.

## Qué hacer con estos datos en el hackathon (prioridad)

1. Ejecutar `engine/gee_analog_score.js` y exportar los 13 sitios → web con datos reales.
2. Ejecutar la búsqueda en España y presentar 2-3 candidatos nuevos (con captura de Worldview).
3. Citar en la web 2-3 cifras de Diviner y MEDA para justificar los perfiles.
4. Si sobra tiempo: añadir Sentinel-1 (rugosidad radar) como décimo eje.
