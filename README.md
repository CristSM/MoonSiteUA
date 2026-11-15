# MoonSiteUA — Vídeo Pitch 3D Renderizado (`1920×1080 @ 60fps`)

Esta rama contiene el vídeo pitch final de **MoonSiteUA** ya renderizado en **`moonsiteua-pitch.mp4`**, junto con el motor 3D WebGL completo (**Three.js + `EffectComposer` + shaders GLSL + GSAP + HyperFrames**) y la guía paso a paso para volver a compilarlo o integrarle locución (`voiceover.mp3`).

## Especificaciones del vídeo generado (`moonsiteua-pitch.mp4`)

| Propiedad | Valor |
| :--- | :--- |
| Archivo | `moonsiteua-pitch.mp4` |
| Resolución | `1920 × 1080` (Full HD / 16:9) |
| Frame rate | `60 fps` exactos |
| Duración | `30.0 s` (`1800` frames exactos) |
| Códec / Formato | `H.264` (`yuv420p`, CRF 19, `max-bitrate 16M`) |
| Bitrate medio | `~10.7 Mbps` |
| Tamaño | `~38.2 MB` (`40,087,447` bytes) |

---

## Arquitectura modular del proyecto

| Archivo | Función |
| :--- | :--- |
| `index.html` | Documento raíz de HyperFrames (`data-width="1920" data-height="1080" data-duration="30" data-fps="60"`), `importmap` local a `three`, fuentes (`Space Grotesk` y `JetBrains Mono`) y capas HUD en optical glassmorphism. |
| `shaders.js` | PRNG determinista **Mulberry32** (`seed = 202609`), elevación geológica procedural **RidgedFBM**, shader orbital terrestre (continentes, nubosidad y atmósfera Fresnel), shader triplanar PBR de terreno marciano/kárstico, valla holográfica, escudo hexagonal, cortina multiespectral y pase final **`CinemaPostShader`** (aberración cromática dinámica, destellos anamórficos, tono ACES Filmic y grano 35 mm determinista). |
| `terrainAndEntities.js` | Escena Three.js dual (Mundo Orbital Tierra/Luna + Terreno geológico `240×240` a `320×320`), 3000 motas de polvo volumétricas, balizas semafóricas, domo Anti-Sybil + enjambre bot, colonia espacial modular, rover autónomo de 6 ruedas + dron multiespectral, cámaras en spline **`CatmullRomCurve3`**, stack **`EffectComposer`** (`RenderPass` → `UnrealBloomPass` → `BokehPass` → `CinemaPostShader`) y proyecciones 3D→2D para las tarjetas HUD. |
| `hudOverlay.js` | Telemetría en vivo sincronizada por frame, visualizador de forma de onda (24 barras), barra de progreso de 7 hitos, líneas de trazado SVG en tiempo real sobre anclas 3D y contadores (`tabular-nums`). |
| `timeline.js` | Arranque determinista conectado a `window.__timelines["moonsiteua"]` (GSAP pausado + escucha de evento `hf-seek` con renderizado síncrono cuadro a cuadro sin `Math.random()`, `Date.now()` ni `requestAnimationFrame()`). |

---

## Cómo conseguir el vídeo renderizado paso a paso

### 1. Prerrequisitos del sistema

1. **Node.js** (`v18+`) y `npm`.
2. **FFmpeg y FFprobe** instalados en el sistema:
   - **macOS (Homebrew):**
     ```bash
     brew install ffmpeg
     ```
   - **Ubuntu / Debian:**
     ```bash
     sudo apt update && sudo apt install -y ffmpeg
     ```
   - **Windows (winget):**
     ```bash
     winget install Gyan.FFmpeg
     ```
3. **Aceleración gráfica WebGL** (GPU del sistema o soporte Chromium WebGL) para ejecutar los shaders GLSL y `EffectComposer`.
4. **Acceso a internet en el primer uso** para descargar `chrome-headless-shell` (gestionado por HyperFrames) y cachear las fuentes (`Space Grotesk`, `JetBrains Mono`).

---

### 2. Clonar esta rama e instalar dependencias

```bash
git clone -b enrique git@github.com:CristSM/MoonSiteUA.git
cd MoonSiteUA
npm install
```

Esto instala localmente **`hyperframes`** (`0.9.46`) y **`three`** (`^0.187.0`) en `node_modules/`.

---

### 3. Preparar Chromium headless y comprobar el entorno

Descarga `chrome-headless-shell` en la caché de HyperFrames y comprueba `Node.js`, `FFmpeg`, `FFprobe` y Chrome:

```bash
npx hyperframes browser ensure
npm run doctor
```

---

### 4. *(Opcional)* Añadir pista de audio / locución (`voiceover.mp3`)

La composición incorpora un visualizador de onda de audio en la esquina inferior izquierda sincronizado con los 7 tramos del guion (`00.0s – 30.0s`). Para incrustar audio real en el MP4 final:

1. Coloca tu archivo de audio **`voiceover.mp3`** en la raíz del proyecto junto a `index.html`.
2. Abre `index.html` y descomenta la etiqueta `<audio>` en torno a la línea `799`:
   ```html
   <audio id="voiceover-audio" data-start="0" data-duration="30" data-volume="1" src="voiceover.mp3"></audio>
   ```

---

### 5. Previsualizar y validar antes del render *(Opcional)*

- **Estudio interactivo en el navegador:**
  ```bash
  npm run preview
  ```
- **Lint y auditoría automática completa (WebGL, layout, movimiento, contraste, craft):**
  ```bash
  npm run lint
  npm run check
  ```

---

### 6. Renderizar el vídeo final (`1920×1080 @ 60fps`)

Ejecuta el comando configurado en `package.json`:

```bash
npm run render
```

*(Equivale a ejecutar `npx hyperframes render --fps 60 --crf 19 --max-bitrate 16M --buffer-size 32M -o moonsiteua-pitch.mp4`.)*

HyperFrames compilará los módulos ES, capturará los `1800` frames en paralelo usando Chromium con aceleración GPU WebGL y codificará **`moonsiteua-pitch.mp4`** por debajo de ~40 MB (apto para repositorio Git estándar).

#### Otras variantes útiles de exportación
- **Máxima calidad master sin límite de bitrate (`delivery`):**
  ```bash
  npx hyperframes render --fps 60 --quality delivery -o moonsiteua-pitch-master.mp4
  ```
- **Borrador rápido (`draft`):**
  ```bash
  npx hyperframes render --fps 30 --quality draft -o preview.mp4
  ```
- **Secuencia PNG / WebM:**
  ```bash
  npx hyperframes render --format png-sequence -o renders/frames
  npx hyperframes render --format webm --fps 60 -o moonsiteua-pitch.webm
  ```

---

## Estructura de escenas (`30.0s` / `1800 frames`)

| Acto | Tiempo | Frames | Escena 3D |
| :---: | :---: | :---: | :--- |
| `01` | `00.0s – 03.5s` | `0 – 210` | **The Hook** — Órbita terrestre, odómetro `$1,000,000,000`, corte láser carmesí y descenso al cañón marciano poblado de balizas humanas. |
| `02` | `03.5s – 08.0s` | `210 – 480` | **Motor NASA/ESA** — Emblema orbital LiDAR y mapa topográfico GIS dual de micro-análogos terrestres y hotspots sin telemetría. |
| `03` | `08.0s – 13.0s` | `480 – 780` | **Consenso Semafórico** — Baliza de campo evolucionando de descubrimiento (`01/10` gris) → verificación cruzada (`03/10` ámbar) → consenso verificado (`10/10` esmeralda). |
| `04` | `13.0s – 17.5s` | `780 – 1050` | **Anti-Sybil & Geofence** — Escudo hexagonal frente a enjambre de bots (OAuth + SMS OTP), registro offline en cueva kárstica y valla geofence holográfica rechazando spoofing remoto. |
| `05` | `17.5s – 21.5s` | `1050 – 1290` | **Data-Gap & Economía Dual** — Escáner `3X` de huecos de humedad + desglose de XP (`+4,500 XP`), Puntos de Misión físicos (parche, pin, camiseta) e insignia inmutable. |
| `06` | `21.5s – 25.5s` | `1290 – 1530` | **Colonia Espacial Virtual** — Aterrizaje del módulo génesis con personalización de casco + acoplamiento colaborativo por túneles presurizados (`01/04` → `04/04` módulos). |
| `07` | `25.5s – 30.0s` | `1530 – 1800` | **Tier 3 Robótico y Cierre** — Fisura volcánica bloqueada por valla láser roja, rover autónomo de 6 ruedas + dron cuadrirrotor con escaneo multiespectral y retroceso orbital final. |
