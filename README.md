# MoonSiteUA — Video Pitch Renderizado (`1920×1080 @ 60fps`)

Esta rama contiene el vídeo pitch final de **MoonSiteUA** ya renderizado en **`moonsiteua-pitch.mp4`**, junto con la composición fuente (`index.html`) y las instrucciones completas paso a paso para volver a renderizarlo o personalizarlo en local con **HyperFrames + FFmpeg**.

## Especificaciones del vídeo generado (`moonsiteua-pitch.mp4`)

| Propiedad | Valor |
| :--- | :--- |
| Archivo | `moonsiteua-pitch.mp4` |
| Resolución | `1920 × 1080` (Full HD) |
| Frame rate | `60 fps` |
| Duración | `30.0 s` (`1800` frames exactos) |
| Códec / Formato | `H.264` (`yuv420p`, CRF 16) |
| Tamaño | `~37.2 MB` |

---

## Cómo conseguir el vídeo renderizado paso a paso

### 1. Prerrequisitos del sistema

1. **Node.js** (`v18+`, probado en `v26.12.0`) y `npm`.
2. **FFmpeg y FFprobe** (imprescindibles para codificar el MP4; probado con `ffmpeg 9.0.2`):
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
3. **Acceso a internet en la primera ejecución** para descargar `chrome-headless-shell` (gestionado por HyperFrames) y cachear las fuentes de Google Fonts (`Space Grotesk` y `JetBrains Mono`) y `gsap.min.js`.

---

### 2. Clonar esta rama e instalar dependencias

```bash
git clone -b enrique git@github.com:CristSM/MoonSiteUA.git
cd MoonSiteUA
npm install
```

Esto instala localmente `hyperframes` (`0.9.46`) sin depender de instalaciones globales.

---

### 3. Descargar el navegador headless y comprobar el entorno

Descarga `chrome-headless-shell` en la caché de HyperFrames y verifica que `Node.js`, `FFmpeg`, `FFprobe` y el navegador están operativos:

```bash
npx hyperframes browser ensure
npm run doctor
```

Deberías ver en verde (`✓`): `CLI binary`, `Node.js`, `FFmpeg`, `FFprobe` y `Chrome`. *(Los apartados opcionales como `whisper-cpp`, `TTS (Kokoro)` o `BGM (MusicGen)` no son necesarios para renderizar el vídeo.)*

---

### 4. *(Opcional)* Añadir pista de audio / locución (`voiceover.mp3`)

La composición incluye un visualizador de onda de audio en la esquina inferior izquierda sincronizado por código con los 7 bloques del guion (`00.0s – 30.0s`). Para incrustar voz real en el MP4 final:

1. Coloca tu archivo de audio con nombre **`voiceover.mp3`** en la raíz del proyecto, junto a `index.html`.
2. Abre `index.html`, busca el comentario alrededor de la línea `910` y descomenta la etiqueta `<audio>`:
   ```html
   <audio id="voiceover-audio" data-start="0" data-duration="30" data-volume="1" src="voiceover.mp3"></audio>
   ```

---

### 5. Previsualizar y validar antes del render *(Opcional)*

- **Estudio interactivo en el navegador:**
  ```bash
  npm run preview
  ```
- **Validación técnica completa (lint + layout + craft + audio):**
  ```bash
  npm run check
  ```

---

### 6. Renderizar el vídeo final (`1920×1080 @ 60fps`)

Ejecuta el comando de renderizado:

```bash
npm run render
```

*(Equivalente a ejecutar `npx hyperframes render --fps 60 -o moonsiteua-pitch.mp4`.)*

HyperFrames compilará `index.html`, capturará los `1800` frames en paralelo usando Chrome con aceleración GPU y los codificará con `ffmpeg` en **`moonsiteua-pitch.mp4`** en ~1–2 minutos.

#### Otras opciones útiles de exportación
- **Máxima calidad de archivo (`delivery`):**
  ```bash
  npx hyperframes render --fps 60 --quality delivery -o moonsiteua-pitch-master.mp4
  ```
- **Render rápido de borrador (`draft`):**
  ```bash
  npx hyperframes render --fps 30 --quality draft -o preview.mp4
  ```
- **Secuencia de PNGs o WebM:**
  ```bash
  npx hyperframes render --format png-sequence -o renders/frames
  npx hyperframes render --format webm --fps 60 -o moonsiteua-pitch.webm
  ```

---

## Estructura de escenas (`30.0s` / `1800 frames`)

La línea temporal maestra GSAP está registrada en `window.__timelines["moonsiteua"]`:

| Tramo | Tiempo | Escena |
| :---: | :---: | :--- |
| `01` | `00.0s – 03.5s` | The Hook — Lanzamiento de $1.000M vs. Millones de Rovers Humanos |
| `02` | `03.5s – 08.0s` | Motor Dual de Datos NASA/ESA y Mapa Interactivo de Micro-Análogos |
| `03` | `08.0s – 13.0s` | Consenso Científico por Balizas Semafóricas (`01/10` → `03/10` → `10/10`) |
| `04` | `13.0s – 17.5s` | Escudo Anti-Sybil (OAuth + SMS OTP) y Geofencing Offline |
| `05` | `17.5s – 21.5s` | Misiones Data-Gap (`3X`) y Economía Dual (XP + Puntos de Misión Físicos) |
| `06` | `21.5s – 25.5s` | Colonia Espacial Virtual Isométrica Colaborativa (`15 / 15` módulos) |
| `07` | `25.5s – 30.0s` | Escalación Robótica Tier 3 Multiespectral y Cierre Orbital |
