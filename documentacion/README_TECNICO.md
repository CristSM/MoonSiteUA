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

## 6. Zona de exploradores: cuentas, fotos, monedas y bases

Es un apartado más de la web (`explorador.html`). Cada explorador tiene su cuenta, sube sus fotos, las compara con los puntos recomendados y construye su base. Los datos se guardan en SQLite a través de una API en FastAPI (carpeta `app/`).

### Arrancar la web completa

```bash
cd app
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Abrir http://localhost:8000. El mismo servidor sirve todas las páginas de la web y la API. La base de datos (`app/moonsite.db`) se crea sola con los datos iniciales. Tests: `python -m pytest app/tests` desde la raíz.

Abriendo los `.html` con doble clic o desde GitHub Pages se ven todos los apartados informativos. La zona de exploradores necesita el servidor y, sin él, lo indica en la propia página.

### Registro

- Campos obligatorios: nombre, apellido, nombre de usuario, correo, teléfono y contraseña.
- La contraseña va oculta (con botón «Mostrar»), con un mínimo de 9 caracteres y al menos una minúscula, una mayúscula y un número. Se guarda con scrypt y sal, nunca en claro.
- **Únicos:** usuario (sin distinguir mayúsculas), correo (sin distinguir mayúsculas) y teléfono (normalizado: `600 123 456`, `+34600123456` y `0034600123456` son el mismo).
- País y provincia son opcionales.

### Base de datos (`app/schema.sql`)

| Tabla | Para qué |
|---|---|
| `regiones` + `region_padres` | Jerarquía provincia → país → unión / estado / continente. Relación N:M: España pertenece a la UE y a Europa. Incluye las 50 provincias españolas, Ceuta y Melilla |
| `usuarios`, `sesiones` | Cuentas con usuario, correo y teléfono `UNIQUE` |
| `movimientos` + vista `saldos` | Libro de Moon y Mars Coins: cada moneda ganada o gastada queda registrada con su motivo |
| `zonas` | Puntos recomendados (motor + datos NASA) y zonas comunitarias |
| `reportes` | Fotos con ubicación, tipo de suelo, vegetación, pendiente, altitud y la comparación |
| `bases` | Una por zona (`zona_id UNIQUE`); dos colores elegidos por el fundador |
| `habitaciones` | Una por usuario y base; número único dentro de la base; planta = (número − 1) / 5 + 1 |
| `muebles`, `inventario`, `habitacion_decoraciones` | Catálogo, lo que tiene cada usuario y una decoración por hueco |
| `objetivos`, `progreso_objetivos` | Objetivos individuales y de base (diarios, semanales, mensuales o únicos) |
| `premios`, `canjes` | Merchandising físico con stock, talla y dirección de envío |
| `aportaciones` | Datos de la demo (foto, temperatura, calidad del aire, humedad, destino, pesos) con fecha; solo se añaden filas, nunca se cambian |

### Monedas

| | Moon Coins (virtuales) | Mars Coins (premium) |
|---|---|---|
| Cómo se ganan | Registro (+100), primer acceso del día (+10), objetivos fáciles (+20 a +60) | Objetivos difíciles: fundar una base (+2), 3 zonas recomendadas (+3), 3 países (+6), 20 fotos al mes en zonas recomendadas (+3), la base llega a planta 2 (+2) o planta 5 (+5) |
| Para qué | Muebles de la habitación (30 a 200) | Premios físicos (4 a 60) |

### Fotos y comparación

Al subir una foto se busca el punto recomendado más cercano y se compara en los ejes que el explorador puede medir: vegetación, tipo de suelo, pendiente, altitud y hielo. El resultado incluye:
- el parecido con ese punto, en %;
- el Índice de Analogía de la foto con los 4 destinos, junto al del punto NASA.

Si la foto está a más de 6 km de cualquier zona, se crea una zona comunitaria nueva.

### Aportar datos desde la demo

En la página Demo, debajo de los pesos, hay un panel «Aportar datos». Necesita el servidor y una sesión iniciada.

- **Al punto seleccionado.** Coordenadas obligatorias, a menos de 3 km del punto, y al menos un dato: foto, temperatura (−90 a 60 °C), calidad del aire (índice 0 a 500) o humedad (0 a 100 %). Se guardan también el destino y los pesos que el usuario tenía configurados.
- **Crear punto nuevo.** Las mismas reglas. Además, el punto se valida antes de crearse:
  - no puede haber otro a menos de 6 km (si lo hay, se propone aportar a ese);
  - como máximo 5 puntos nuevos por usuario al día.
  Si es válido, se crea como punto de la comunidad (rombo en el mapa).
- **Moon Coins:** +10 por datos, +15 por foto y +40 por un punto nuevo válido.
- **Fecha:** cada envío se guarda como una fila nueva en `aportaciones`, con su fecha de subida. Las filas no se pueden modificar (trigger), así que queda el historial completo.
- **Bloqueo de 12 horas:** después de guardar datos de un punto, el mismo usuario no puede volver a cambiarlos hasta que pasen 12 horas. La web muestra hasta cuándo.
- **Datos de la NASA intocables:** los triggers `nasa_no_se_modifica` y `nasa_no_se_borra` impiden cambiar o borrar los puntos recomendados desde la app. Los datos de la comunidad se muestran aparte, en la ficha. Para actualizar los datos NASA hay que volver a ejecutar el motor y regenerar la base de datos (borrar `app/moonsite.db`).

### Bases y habitaciones

- **Una base por zona.** Para fundarla o unirte tienes que haber subido una foto desde esa zona. El fundador elige los dos colores, y pueden repetirse entre bases.
- **Crecimiento:** 5 habitaciones por planta. La base sube de nivel con cada planta. El dibujo cambia en los niveles 1 a 5 y a partir del 5 es siempre el mismo.
- **Habitación de tamaño estándar:** color de paredes y suelo, una cama (4 diseños), un escritorio (4 diseños) y una decoración por hueco (pared izquierda, pared derecha, techo, rincón y alfombra; 13 diseños). Solo su dueño puede editarla.

### Objetivos

- **Individuales:** cada usuario los suyos.
- **De base:** compartidos por todos los miembros; al completarse cobra cada miembro.

Se pagan automáticamente al completarse. Están definidos en `app/seed.py`.

### Premios

Pegatinas, pins (Polo Sur y Jezero), parche de misión, taza, gorra, camiseta y sudadera. Todos son diseños originales en `app/static/disenos.js`. No llevan el logotipo de la NASA, porque su uso en productos requiere autorización de la agencia.

### Pendiente para producción

- OTP por SMS y verificación del dispositivo (descritos en la sección 5; la app de la demo aún no los aplica).
- Límite de intentos de inicio de sesión.
- Borrar los metadatos EXIF de las fotos.
- HTTPS.

## 7. Estructura del repositorio

```
engine/
  gee_analog_score.js   Motor en Google Earth Engine: ejes, IAP, búsqueda de candidatos, exportación
  analog_score.py       Misma fórmula en Python (ranking por consola)
  targets.json          Perfiles de los 4 destinos (valores, pesos, límites, fuentes)
  sites_demo.json       13 sitios de demo con variables ESTIMADAS
  import_gee.py         Convierte la exportación de GEE en engine/sites.json
app/
  main.py               Servidor: sirve la web y la API (FastAPI)
  logic.py              Reglas: cuentas, monedas, objetivos, comparación, bases, tienda, premios
  schema.sql            Esquema de la base de datos
  seed.py               Regiones, zonas, muebles, objetivos y premios iniciales
  static/disenos.js     Diseños SVG: monedas, edificio por niveles, habitación, muebles, merchandising
  tests/test_app.py     Tests de la app
backend/
  verification.py       Balizas por consenso, OTP, Modo Expedición offline, misiones locales y globales, escalado robótico (nivel 3)
  test_verification.py  Tests (pytest)
web/
  template.html         Plantilla de la web, con bloques <!--PAGE id--> por apartado
  build.mjs             Genera una página por apartado (index, demo, juego, recompensas, metodo,
                        validacion, comunidad, seguridad, datos, video, explorador) en web/ y docs/
  explorador.css/.js    Estilos y lógica de la zona de exploradores (se incluyen en el build)
  *.html                Páginas generadas
docs/
  *.html                Copia de las páginas para GitHub Pages
documentacion/
  README_TECNICO.md     Este documento
  DATOS.md              Datos y recursos del reto, qué usar y cómo
  GUION_VIDEO.md        Guion del vídeo de 30 s
```

## 8. Cómo ejecutarlo

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
