# MoonSiteUA · Documentación técnica

> El concepto del proyecto está en el [README principal](../README.md). Este documento explica cómo lo implementa el código de este repositorio. Las rutas son relativas a la raíz del repo.

**NASA Space Apps Challenge 2026 · Reto: _Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars_**

Una plataforma que busca en la Tierra los mejores lugares para ensayar bases en la Luna y misiones a Marte. Combina tres capas:

1. **Satélite (descubre).** Un motor en Google Earth Engine cruza datos abiertos de la NASA y calcula, para cada zona del planeta, un **Índice de Analogía Planetaria (IAP)** frente a cuatro destinos: polo sur lunar (regiones Artemis III), mares basálticos y tubos de lava lunares, cráter Jezero y Arcadia Planitia en Marte.
2. **Campo (verifica).** Exploradores ciudadanos van a los candidatos y suben medidas. Un sistema de balizas por consenso decide cuándo un análogo queda confirmado.
3. **Comunidad (construye).** Cada análogo confirmado se convierte en una base espacial virtual que crece con cada explorador.

---

## 1. Qué cubre del enunciado

| Lo que pide el reto | Cómo lo resuelve MoonSiteUA |
|---|---|
| Usar datos abiertos de la Tierra, la Luna y Marte | 7 productos NASA de la Tierra en el motor; perfiles de la Luna y Marte construidos con LRO (Diviner, LOLA, LEND, Mini-RF), Perseverance MEDA, MRO y SWIM |
| Ir más allá del parecido visual | El IAP compara 9 variables físicas, no imágenes |
| Explicar en qué se parece y en qué no | Similitud **por eje** + radar + lista fija de límites que la Tierra no puede imitar (gravedad, vacío, radiación, temperaturas extremas) |
| Encontrar análogos nuevos | Búsqueda sistemática por región (top 25 candidatos) y filtro «poco estudiados» |
| Pensar en procesos y en la escala | Ejes de polvo, hielo y amplitud térmica (procesos); análisis a 1 km y fichas a radio de 2 km |
| Conectar con la exploración | Cada destino lleva su contexto (aterrizaje humano, hielo, refugio en tubos de lava) |
| Ser creativos (mapa, app, juego, ML…) | Mapa interactivo, juego «¿Cuál es mejor análogo?» y app de ciencia ciudadana |

## 2. Índice de Analogía Planetaria

```
IAP = 100 · Σ wᵢ · (1 − |xᵢ − tᵢ|) / Σ wᵢ
```

`xᵢ` = valor del lugar en el eje i (0-1), `tᵢ` = valor del destino, `wᵢ` = importancia del eje para ese destino.

| Eje | Dato NASA (Earth Engine) | Conversión |
|---|---|---|
| Aridez | GPM IMERG V07 mensual | 0 mm/año → 1, 3000 mm/año → 0 (log) |
| Sin vegetación | MODIS MOD13A2 NDVI (p90) | 0,05 → 1, 0,5 → 0 |
| Frío | MODIS MOD11A2 LST media | +30 °C → 0, −50 °C → 1 |
| Amplitud térmica | MODIS MOD11A2 día − noche | 0 → 0, 40 °C → 1 |
| Roca basáltica | ASTER GED (emisividad b10-12 / b13-14) | 0,85 → 0, 0,98 → 1 |
| Pendiente | NASADEM | 0° → 0, 25° → 1 |
| Altitud | NASADEM | 0 → 0, 5000 m → 1 |
| Polvo | MODIS MOD08_M3 AOD | 0 → 0, 0,6 → 1 |
| Hielo/nieve | MODIS MOD10A1 | fracción de días con nieve |

Los valores reales de la Luna y Marte superan casi siempre el rango terrestre. En ese caso el destino se fija en 1 (el extremo de la Tierra) y se documenta como **límite de la analogía** en `engine/targets.json`.

**Limitaciones conocidas** (se explican en la web): el indicador mineral solo es fiable en suelo desnudo; la química del suelo (sulfatos, percloratos) y las cuevas no se ven desde estos satélites, y por eso existe la capa de campo; Antártida queda fuera de NASADEM/ASTER y necesita otro DEM.

## 3. Validación por consenso (balizas)

| Baliza | Regla |
|---|---|
| Gris · descubrimiento | 1 reporte válido |
| Naranja · en verificación | ≥ 2 exploradores independientes con medidas consistentes |
| Verde · análogo confirmado | ≥ 5 exploradores, ≥ 2 días distintos, consistentes y de acuerdo con el satélite |
| Disputa | Reportes suficientes que se contradicen → misión de desempate |

Cambios respecto a la primera versión y por qué:

- **Qué se puede medir con un móvil.** Los móviles no tienen termómetro ni higrómetro ambiental. Se miden pendiente (inclinómetro), altitud (GPS + barómetro), tipo de suelo (lista cerrada + foto en vivo). Temperatura y humedad solo cuentan con un sensor Bluetooth emparejado.
- **La temperatura cambia con la hora.** No se compara el valor bruto, sino la anomalía frente al satélite del mismo momento.
- **Independencia real.** Un explorador cuenta una vez por nodo; un dispositivo no vale para varias cuentas; se exigen al menos dos días distintos para evitar que un grupo valide en una sola excursión.
- **Estado de disputa** para cuando los datos no coinciden.
- **Acuerdo con el satélite** como requisito para verde.

Implementado y con tests en `backend/verification.py`.

### Nivel 3 · Escalado robótico y análisis multiespectral

Algunas zonas tienen un IAP alto o ya están parcialmente validadas, pero son demasiado peligrosas o inaccesibles para civiles: cuevas profundas, chimeneas volcánicas, acantilados. En esos casos:
- El sistema bloquea el acceso público: no hay misiones ni recompensas para ir allí.
- El nodo se deriva a un programa de **Misiones Automatizadas** con universidades y agencias espaciales.
- Las instituciones despliegan drones o rovers terrestres con cámaras multiespectrales, espectrómetros y LiDAR. Así analizan la composición de rocas y suelo y completan el perfil del análogo sin arriesgar vidas.

Con esto se conecta la ciencia ciudadana con la investigación profesional: los exploradores señalan desde el perímetro seguro y los robots llegan donde las personas no deben ir. Criterio implementado en `escalado_robotico()`: zona restringida + (IAP ≥ 65 o baliza naranja/verde).

## 4. Gamificación

- **Puntos de Exploración** (virtuales): validar, fotografiar, medir. Las medidas que resultan inconsistentes no puntúan.
- **Puntos de Misión** (escasos): expediciones validadas y objetivos de alto valor. Se canjean por pins, parches y camisetas (financiación por patrocinio).
- **Insignias**: por ejemplo, la de Pionero, un título inmutable en el historial del nodo para el primer explorador que documenta un análogo que llega a verde. También hay insignias de expedición offline, de misiones completadas y de especialista por tipo de terreno.
- **Misiones dirigidas**: el sistema detecta huecos de datos en cada nodo y lanza objetivos con multiplicador (×2 medidas con el móvil, ×3 con sensor externo). Nunca en zonas restringidas.
- **Misiones globales** mensuales para la retención a largo plazo, p. ej. «Documenta 3 zonas kársticas este mes». Cuentan nodos distintos, no reportes repetidos.
- **Bases virtuales**: el descubridor funda el Módulo Génesis (dos colores corporativos y decoración); cada explorador que valida en persona acopla su módulo.

## 5. Seguridad, privacidad y ética

Objetivo: evitar ataques Sybil (granjas de bots) y envíos falsos sin pedir datos sensibles como el DNI.

**Autenticación y verificación única (OAuth + OTP).** Registro con Google o Apple y verificación obligatoria por SMS: un número de teléfono único por perfil. Así una misma persona no puede crear varias cuentas de correo para validar sus propios puntos. Se suma la verificación del dispositivo (Play Integrity / App Attest): un dispositivo no vale para varias cuentas.
- El número de teléfono es un dato personal: se guarda solo su hash, nunca se muestra, y se borra si se borra la cuenta.
- El SMS no elimina del todo las granjas de SIM; por eso se combina con la verificación del dispositivo y el consenso entre exploradores.

**Modo Expedición offline.** Los análogos más interesantes (cuevas, cañones, desiertos remotos) no suelen tener cobertura, así que los datos se recogen sin conexión y se suben después.
- El GPS funciona sin cobertura móvil, así que la app guarda la posición y la hora **en el momento de la captura** y firma el paquete con una clave del dispositivo. La foto, las medidas y la posición quedan selladas juntas.
- Al volver a tener conexión, la app pide acceso puntual al GPS para sincronizar y comprueba:
  - que la firma es válida (el paquete no se ha tocado);
  - que no han pasado más de 14 días;
  - que el viaje desde el punto de captura hasta donde se sincroniza es físicamente posible: **geofencing ampliado** que crece con el tiempo (30 km de margen + 120 km/h). Por ejemplo, alguien que «estuvo» en Tabernas no puede sincronizar una hora después desde Buenos Aires.
- La geovalla se aplica a la posición de la **captura**, no a la de la sincronización. Si solo se comprobara al sincronizar, alguien que vive cerca podría subir datos sin haber ido nunca.
- En cuevas, donde no llega el GPS, vale la última posición fiable en la entrada.

**Seguridad física.** No hay misiones en espacios naturales protegidos, propiedad privada, cuevas sin permiso ni zonas peligrosas. Antes de cada expedición offline, la app muestra avisos de calor y aislamiento y una lista de comprobación (agua, avisar a alguien de la ruta).

**RGPD.** No se publican los recorridos de los usuarios; el mapa muestra nodos, no personas. El GPS solo se pide en la captura y en la sincronización, nunca en segundo plano.

**Rendimiento del mapa.** Teselas vectoriales según el zoom (más eficiente que segmentar por países).

## 6. Estructura del repositorio

```
engine/
  gee_analog_score.js   Motor en Google Earth Engine: ejes, IAP, búsqueda de candidatos, exportación
  analog_score.py       Misma fórmula en Python (ranking por consola)
  targets.json          Perfiles de los 4 destinos (valores, pesos, límites, fuentes)
  sites_demo.json       13 sitios de demo con variables ESTIMADAS
  import_gee.py         Convierte la exportación de GEE en engine/sites.json
backend/
  verification.py       Balizas por consenso, OTP, Modo Expedición offline, misiones locales y globales, escalado robótico (nivel 3)
  test_verification.py  Tests (pytest)
web/
  template.html         Web del proyecto (demo, juego, método, validación…)
  build.mjs             Genera web/index.html con los datos y los mapas
  index.html            Web generada, lista para GitHub Pages
docs/
  index.html            Copia de la web para GitHub Pages
documentacion/
  README_TECNICO.md     Este documento
  DATOS.md              Datos y recursos del reto, qué usar y cómo
  GUION_VIDEO.md        Guion del vídeo de 30 s
```

## 7. Cómo ejecutarlo

```bash
# Ranking por consola y tests
python engine/analog_score.py marte_jezero
python -m pytest backend

# Datos reales con Earth Engine
# 1. Abrir https://code.earthengine.google.com, pegar engine/gee_analog_score.js, Run
# 2. En la pestaña Tasks, ejecutar la exportación "moonsiteua_sitios" (GeoJSON a Drive)
python engine/import_gee.py moonsiteua_sitios.geojson   # -> engine/sites.json

# Web
cd web && npm install && node build.mjs ../engine/sites.json   # o sin argumento para la demo
```

Para publicar en GitHub Pages: Settings → Pages → rama `main`, carpeta `/docs` (el build copia ahí la web). El vídeo se pone en la sección «Vídeo» de `web/template.html` (hay un comentario con el código).

> Los valores de `sites_demo.json` son estimaciones para la demo. La web lo indica con un aviso, que desaparece al generarla con `sites.json`.
