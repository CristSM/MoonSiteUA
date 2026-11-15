# MoonSiteUA — 30-Second Photorealistic 3D Pitch Video

Composición cinematográfica interactiva y determinista (**30.00 s · 1920×1080 Full HD · 60 FPS · 1800 frames exactos**) desarrollada para el proyecto **MoonSiteUA**, construida sobre **HyperFrames + Three.js + GLSL + GSAP** con síntesis procedural PBR (**1024×1024**) y post-procesado de 5 pasos.

---

## Arquitectura del Proyecto

| Archivo | Responsabilidad |
| :--- | :--- |
| [`index.html`](index.html) | Lienzo maestro `1920×1080`, tipografías (`Space Grotesk`, `JetBrains Mono`), HUD diegético persistente y tarjetas con *optical glassmorphism* (`backdrop-filter: blur(24px) saturate(180%)`). |
| [`pbrTextures.js`](pbrTextures.js) | PRNG determinista **Mulberry32** (`seed = 20261115`), síntesis offscreen `1024×1024` (**Albedo**, **Sobel Normal Map**, **Roughness Map**, **AO Map**) para 5 materiales heroicos (**Vesicular Volcanic Basalt & Martian Regolith**, **Wet Karstic Cave Limestone**, **Aerospace Brushed Titanium**, **Crinkled Gold Kapton MLI Foil**, **2×2 Carbon Fiber Weave**) y entorno HDRI equirectangular procesado con `THREE.PMREMGenerator`. |
| [`shaders.js`](shaders.js) | `getTerrainHeight(x, z)` / `getTerrainNormal(x, z)`, cielo atmosférico **Rayleigh + Mie**, Tierra orbital con **sombras proyectadas sincronizadas de la capa de nubes** + brillo Fresnel, shader triplanar PBR sobre la malla `240×240` (`320×320` segmentos), vetas minerales fluorescentes (**Olivine, Pyroxene, Hematite**), anillos ascendentes en el haz del beacon y `CinemaPostShader` (`uAbberation`, grano 35mm Kodak Vision3 500T `0.028`, destellos anamórficos `> 0.85`, viñeta y ACES Filmic). |
| [`terrainAndEntities.js`](terrainAndEntities.js) | Escena WebGL (`WebGLRenderer` con `ACESFilmicToneMapping`, `toneMappingExposure = 1.12`, `SRGBColorSpace`, `PCFSoftShadowMap` `4096×4096`), sol golden-hour a `14°`, `3,500` motas de polvo, **5-pass `EffectComposer`** (`RenderPass` → `SSAOPass` determinista → `UnrealBloomPass` → `BokehPass` → `CinemaPostShader`), trípode con antena parabólica rotatoria, caverna kárstica húmeda, colonia geodésica con túneles fuelle-acordeón y emisores de polvo, y **Rover 6×6 Rocker-Bogie articulado por rueda** + drone cuadricóptero de fibra de carbono. |
| [`hudOverlay.js`](hudOverlay.js) | Visualizador determinista de **28 barras** sincronizado al voiceover, líneas guía SVG de `1px` proyectadas en tiempo real desde 3D (`camera.project`), odómetro Acto 1, tarjetas con perspectiva 3D y lectura de composición mineralógica. |
| [`timeline.js`](timeline.js) | Timeline maestro GSAP pausado (`tl.seek`), manejador `hf-seek` bloqueado por frame (`0..1799`) con cero llamadas a `Math.random()`, `Date.now()`, `performance.now()`, `requestAnimationFrame()` o CSS `@keyframes`. |
| [`package.json`](package.json) | Dependencias (`hyperframes`, `three`) y script de renderizado `--crf 19`. |

---

## Requisitos Previos

- **Node.js** `>= 20` (probado en `v26.12.0` / Apple Silicon `arm64`)
- **npm**
- **FFmpeg / FFprobe** instalados en el `PATH`
- **Chromium** para render headless (HyperFrames lo gestiona automáticamente; puede descargarse con `npx hyperframes check`)

---

## Instalación y Cómo Renderizar el Video

1. **Instalar dependencias:**

```bash
npm install
```

2. **Previsualización en vivo (opcional):**

```bash
npx hyperframes preview
```

3. **Auditoría técnica y determinismo (lint + check):**

```bash
npx hyperframes lint --json
npx hyperframes check --json
```

4. **Renderizar el archivo MP4 final (`1920×1080`, `60 FPS`, `30.00 s`):**

```bash
npm run render
```

Este comando ejecuta exactamente lo definido en [`package.json`](package.json):

```bash
hyperframes render --fps 60 --crf 19 --max-bitrate 16M --buffer-size 32M -o moonsiteua-pitch.mp4
```

### Salida verificada del último render

- **Archivo generado:** [`moonsiteua-pitch.mp4`](moonsiteua-pitch.mp4) (`55.0 MB`)
- **Codec / Formato:** `h264` (`yuv420p`) · `1920×1080` · `60/1 fps` · `1800 frames` · `30.000000 s`
- **Bitrate:** `~15.38 Mbps` (`--crf 19 --max-bitrate 16M --buffer-size 32M`)
- **Nota sobre audio (`voiceover.mp3`):** El archivo `voiceover.mp3` no se incluye en el repositorio; el HUD muestra la barra reactiva determinista de 28 bandas preparada para su sincronización. Si deseas añadir pista de audio real en el montaje final, basta con enlazar el archivo `voiceover.mp3` en `index.html` o multiplexarlo con FFmpeg.
