# MoonSiteUA

El concepto: Una plataforma gamificada de ciencia ciudadana que transforma la búsqueda de análogos lunares y marcianos en una exploración colaborativa global. Los usuarios actúan como "rovers humanos", recopilando datos sobre el terreno para validar zonas de interés predefinidas por datos satelitales o descubrir nuevos micro-análogos.

1. El Motor de Datos y el Mapa Interactivo
El núcleo de la plataforma es un mapa interactivo (segmentado por países para optimizar el rendimiento) que se alimenta de dos fuentes:

Capa Base (Datos Oficiales): Zonas "calientes" predefinidas a través de cruces de datos satelitales (NASA, ESA). Estas áreas aparecen en el mapa como "Zonas de Interés no exploradas".

Capa Comunitaria: Puntos de interés generados por los propios usuarios al descubrir entornos con similitudes geológicas o climáticas (formaciones basálticas, zonas kársticas, extremos térmicos).

2. Sistema de Validación Científica por Consenso (Crowd-Verification)
Para garantizar el rigor científico que exige el reto sin depender de verificaciones manuales centralizadas, el mapa utiliza un sistema de balizas semafóricas:

Baliza Gris (Descubrimiento): Un usuario sube los primeros datos in situ (temperatura, humedad, tipo de suelo). El punto existe, pero no tiene validez científica aún.

Baliza Naranja (En Verificación): Entre 2 y 3 usuarios independientes han acudido a las mismas coordenadas (con un margen de error GPS mínimo) y han reportado métricas consistentes.

Baliza Verde (Análogo Confirmado): Cuando de 5 a 10 exploradores validan los datos, la zona se consolida en la base de datos como un análogo terrestre legítimo.

3. Gamificación y Economía de Recompensas
El sistema de incentivos está diseñado para fomentar tanto la calidad de los datos como la retención del usuario a través de una economía dual:

Puntos de Exploración (Virtuales): Se obtienen por acciones comunes (validar un punto, subir fotos, medir temperatura). Sirven como moneda de cambio para cosméticos digitales dentro de la app.

Puntos de Misión (Físicos): Moneda premium muy escasa. Se otorgan al liderar expediciones validadas o completar objetivos de alto valor. Se canjean por merchandising oficial (pins, parches de misión, camisetas).

Insignias: Por ejemplo, el primer usuario en documentar un nuevo análogo validado recibe un título inmutable en el historial de ese nodo.

4. Construcción de Hábitats Virtuales (El Bucle Social)
Esta es la mecánica clave para generar comunidad. Cada análogo confirmado en el mundo real se convierte en una "Base Espacial" en el mundo virtual.

El Módulo Génesis: El descubridor original funda la base, eligiendo los dos colores corporativos de la misma y decorando el primer "módulo de habitabilidad" usando sus puntos virtuales (muebles, estaciones de trabajo, banderas).

Expansión Modular: Cada nuevo explorador que viaja físicamente a esa zona y valida datos, gana el derecho a acoplar su propio módulo a la base matriz, decorándolo a su gusto. Las bases más visitadas se convierten en gigantescas colonias virtuales colaborativas.

5. Sistema de Misiones Dirigidas (Bounties)
Para evitar que los usuarios recopilen datos irrelevantes, el sistema genera misiones dinámicas basadas en los huecos de información (Data Gaps).

Si un análogo en España tiene datos validados de temperatura y suelo, pero falta humedad, el sistema lanza un "Objetivo Local": Se buscan lecturas de higrómetro en las coordenadas X. Recompensa: Triple puntuación virtual.

Misiones globales como "Documenta 3 zonas kársticas este mes" mantienen la retención a largo plazo.

6. Arquitectura de Seguridad
Para evitar ataques Sybil (granjas de bots) y asegurar la trazabilidad sin comprometer datos personales sensibles (como el DNI):

Autenticación y Verificación Única (OAuth + OTP): Registro inicial a través de cuentas sociales (Google, Apple) blindado con una verificación obligatoria por SMS (One-Time Password). Vincular un número de teléfono único e irrepetible a cada perfil impide que un mismo usuario genere múltiples cuentas de correo para falsear validaciones, erradicando los ataques de bots y garantizando que cada explorador que sube datos al mapa es una persona real.

Validación de Proximidad Transparente (Modo Expedición offline): Dado que los análogos más puros (cuevas, cañones, desiertos remotos) suelen carecer de cobertura o señal de satélite, la recolección de datos in situ se realiza de forma asíncrona. Una vez que el usuario regresa a una zona con conexión, la plataforma lanza una notificación explícita solicitando acceso puntual al GPS para sincronizar. El sistema verifica entonces que el dispositivo se encuentra dentro de un radio geográfico lógico (geofencing ampliado) respecto a las coordenadas del análogo antes de autorizar la subida del paquete de datos. Esto evita envíos fraudulentos desde el sofá de casa o desde otros países, garantizando la veracidad científica mientras se respeta de forma absoluta la privacidad del explorador.

7. Escalación Robótica y Análisis Multiespectral (Validación Tier 3):
Para aquellas zonas que alcanzan un alto índice de interés geológico pero son catalogadas como demasiado peligrosas, extremas o inaccesibles para la exploración humana civil (cuevas profundas, chimeneas volcánicas, acantilados), el sistema bloquea el acceso público por seguridad. En su lugar, estas coordenadas excepcionales o altamente verificadas se derivan a un programa de "Misiones Automatizadas" en colaboración con universidades y agencias espaciales. Estas instituciones toman el relevo desplegando drones o rovers terrestres equipados con cámaras multiespectrales y sensores de alta precisión para analizar la composición exacta de rocas y tierra, completando el perfil del análogo sin poner en riesgo vidas humanas y cerrando la brecha entre la ciencia ciudadana y la investigación profesional.

---

8. Resumen del proyecto implementado

MoonSiteUA responde al reto «Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars» del NASA Space Apps Challenge 2026: busca en la Tierra lugares parecidos a las futuras bases lunares y a los lugares de aterrizaje en Marte, explica en qué se parecen y en qué no, y deja que la comunidad los valide y los convierta en bases virtuales. El proyecto tiene tres capas:

- **Satélite (descubre):** un motor calcula el Índice de Analogía Planetaria (IAP) de cada zona de la Tierra frente a cuatro destinos: polo sur lunar (regiones Artemis III), mares basálticos y tubos de lava lunares, cráter Jezero y Arcadia Planitia en Marte.
- **Campo (verifica):** los usuarios suben fotos y datos, o crean puntos nuevos que se validan antes de aceptarse.
- **Comunidad (construye):** cada zona puede tener una base virtual que crece por plantas con los exploradores que se unen.

9. Índice de Analogía Planetaria

`IAP = 100 · Σ wᵢ · (1 − |xᵢ − tᵢ|) / Σ wᵢ`

Compara 9 ejes calculados con datos abiertos de la NASA en Google Earth Engine:

| Eje | Dato NASA |
|---|---|
| Aridez | GPM IMERG V07 (precipitación) |
| Sin vegetación | MODIS MOD13A2 (NDVI) |
| Frío y amplitud térmica | MODIS MOD11A2 (temperatura de superficie día y noche) |
| Roca basáltica | ASTER GED (emisividad térmica) |
| Pendiente y altitud | NASADEM |
| Polvo | MODIS MOD08_M3 (aerosoles) |
| Hielo / nieve | MODIS MOD10A1 |

Los perfiles de la Luna y Marte se basan en LRO (Diviner, LOLA, LEND, Mini-RF, LROC), Perseverance MEDA, MRO y el proyecto SWIM. Cada ficha muestra la similitud por eje, en qué se parece el sitio, en qué se aleja y lo que la Tierra no puede imitar: gravedad, vacío, radiación y temperaturas extremas.

Hay 13 sitios de ejemplo: análogos conocidos (Atacama, Haughton, Valles Secos, Timanfaya, Río Tinto, Teide) y candidatos poco estudiados (Tabernas, Bardenas Reales, Campo de Calatrava, Sierra Nevada, Cabo de Gata, Dasht-e Lut, Qaidam).

**Importante:** sus valores son estimaciones para la demo. Los reales se obtienen ejecutando `engine/gee_analog_score.js` en Earth Engine.

10. La web

La web tiene 11 apartados, cada uno en su página, en español y en inglés (botón ES/EN). Usa un único tema oscuro de estilo «cartel de misión» (negro, hueso y un amarillo de acento; tipografías Big Shoulders Display, Instrument Sans y DM Mono):

| Página | Contenido |
|---|---|
| Inicio | La idea, las tres capas y un índice desplegable de apartados con una figura de cada uno |
| Demo | Mapa mundial y de España con el IAP de cada sitio, ficha con radar, ranking, pesos ajustables y panel «Aportar datos» |
| Juego | «¿Cuál es mejor análogo?»: dos sitios, eliges y se revela el resultado |
| Recompensas | Monedas en 3D y cómo se ganan, diorama de la base por niveles, habitación en 3D y catálogo de premios |
| Método | La fórmula, los 9 ejes y los límites de la analogía |
| Validación | Simulador 3D de balizas por consenso, escalado robótico (nivel 3) en 3D y tolerancias de medida |
| Comunidad | Bucle de la comunidad, monedas, tablón de misiones, insignias y diorama 3D de la colonia que crece con los exploradores |
| Seguridad | Geovalla interactiva sobre el mapa, una persona una cuenta, modo expedición offline, seguridad física y RGPD |
| Datos | Fuentes de la NASA (Tierra, Luna y Marte) y de las agencias socias (ESA, CSA, JAXA) |
| Vídeo | Espacio para la demo de 30 segundos |
| Explorador | Zona con cuenta de usuario |

11. Zona de exploradores (con cuenta)

- **Registro:** nombre, apellido, usuario, correo, teléfono y contraseña, todos obligatorios.
  - La contraseña va oculta y debe tener 9 caracteres o más, con minúscula, mayúscula y número. Se guarda cifrada (scrypt).
  - No se repiten usuario, correo ni teléfono.
- **Aportar datos (desde la Demo):**
  - Coordenadas obligatorias y al menos un dato: foto, temperatura, calidad del aire o humedad.
  - Se guardan con la fecha de subida, el destino y los pesos configurados.
  - Se puede crear un punto nuevo. Se valida antes de crearse: no puede haber otro a menos de 6 km y hay un máximo de 5 al día.
  - Después de guardar datos de un punto hay un bloqueo de 12 horas para volver a cambiarlos.
- **Datos de la NASA intocables:** los puntos recomendados no se pueden modificar ni borrar. Está protegido en la propia base de datos.
- **Zonas:** cualquier usuario puede fundar la base de una zona sin base o unirse a la existente. Cada usuario puede editar solo los puntos que ha creado, con historial y bloqueo de 12 horas.
- **Monedas:**
  - Moon Coins (virtuales, fáciles): registro, primer acceso del día, aportaciones y objetivos sencillos. Se gastan en muebles.
  - Mars Coins (escasas): objetivos difíciles. Se canjean por premios físicos.
  - Corresponden a los Puntos de Exploración y de Misión del concepto.
- **Bases:**
  - Una por zona; el fundador elige dos colores.
  - Cada planta tiene 5 habitaciones y la base sube un nivel por planta. El dibujo cambia hasta el nivel 5.
- **Habitaciones:** se ven en perspectiva, con color de paredes y suelo, una cama (4 diseños), un escritorio (4 diseños) y una decoración por hueco (13 diseños). Solo su dueño puede editarla.
- **Objetivos:** individuales y de base (compartidos; al completarse cobra cada miembro), diarios, semanales, mensuales o únicos.
- **Premios:** pegatinas, pins, parche, taza, gorra, camiseta y sudadera. Son diseños originales: no llevan logotipos de la NASA, porque su uso en productos requiere autorización.

12. Cómo ejecutarlo

```powershell
cd app
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Abrir http://localhost:8000 (en inglés: http://localhost:8000/en/). El servidor sirve toda la web y guarda los datos en SQLite (`app/moonsite.db`, que se crea solo).

Abriendo los `.html` directamente o desde GitHub Pages (carpeta `docs/`) se ven todos los apartados, pero la zona de exploradores y el panel «Aportar datos» necesitan el servidor.

Otros comandos:
- Tests: `python -m pytest app/tests backend` (60 tests).
- Regenerar la web tras cambiar `web/template.html`: `cd web`, `npm install` y `node build.mjs`. Los textos nuevos se traducen en `web/i18n/en.py` (luego `python i18n/en.py`).
- Las escenas 3D (dioramas, monedas, simulador) usan three.js r128, que se descarga de cdnjs solo en las páginas que lo necesitan; sin conexión se muestran dibujos SVG de reserva.
- Datos reales: pegar `engine/gee_analog_score.js` en code.earthengine.google.com, exportar los sitios y ejecutar `python engine/import_gee.py moonsiteua_sitios.geojson`.

13. Estructura del repositorio

```
engine/          Motor de similitud: Earth Engine (gee_analog_score.js), misma fórmula en Python, perfiles de destinos y sitios
backend/         Lógica de balizas por consenso, OTP, modo expedición offline, misiones y escalado robótico (con tests)
app/             Servidor FastAPI + SQLite: cuentas, aportaciones, monedas, bases, habitaciones, objetivos y premios (con tests)
app/static/      disenos.js: monedas, edificio por niveles, habitaciones, muebles y merchandising (SVG)
web/             Plantilla y build de la web; páginas en español (*.html) e inglés (en/*.html); diccionario en i18n/
docs/            Copia de la web para GitHub Pages
documentacion/   README técnico, datos y recursos del reto, guion del vídeo de 30 s
```

Los detalles técnicos están en `documentacion/README_TECNICO.md`. Los datos y recursos del reto, en `documentacion/DATOS.md`.

14. Estado y pendientes

**Hecho:**
- Motor de similitud.
- Web completa en dos idiomas, con escenas 3D interactivas.
- Zona de exploradores con base de datos.
- Validación, monedas, bases, habitaciones, objetivos y premios.
- 60 tests.

**Pendiente para producción:**
- Sustituir los valores de demo por los datos reales de la NASA.
- Hacer presentación.
- Grabar el vídeo de 30 segundos (guion en `documentacion/GUION_VIDEO.md`).
