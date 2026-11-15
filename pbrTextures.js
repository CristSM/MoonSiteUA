import * as THREE from 'three';

/**
 * Deterministic Mulberry32 Seeded PRNG (seed = 20261115).
 * Strict frame-locked determinism with zero Math.random() calls.
 */
export function createMulberry32(seed = 20261115) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tileable 2D value-noise + fast integer bit-hash table (zero Math.sin allocations).
 */
function buildTileNoiseSampler(seed, period) {
  const rng = createMulberry32(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = rng();
  }
  return function sample(u, v) {
    const x = ((u % 1) + 1) % 1 * period;
    const y = ((v % 1) + 1) % 1 * period;
    const x0 = Math.floor(x) % period;
    const y0 = Math.floor(y) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = grid[y0 * period + x0];
    const b = grid[y0 * period + x1];
    const c = grid[y1 * period + x0];
    const d = grid[y1 * period + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

/**
 * Tileable 2D Voronoi distance-to-center & edge-crest sampler (fast 3x3 cell search).
 */
function buildTileVoronoiSampler(seed, cells) {
  const rng = createMulberry32(seed);
  const ptsX = new Float32Array(cells * cells);
  const ptsY = new Float32Array(cells * cells);
  const cellVal = new Float32Array(cells * cells);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const idx = cy * cells + cx;
      ptsX[idx] = cx + 0.15 + rng() * 0.7;
      ptsY[idx] = cy + 0.15 + rng() * 0.7;
      cellVal[idx] = rng();
    }
  }
  return function sample(u, v) {
    const px = (((u % 1) + 1) % 1) * cells;
    const py = (((v % 1) + 1) % 1) * cells;
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    let d1 = 99.0;
    let d2 = 99.0;
    let idVal = 0.0;
    for (let oy = -1; oy <= 1; oy++) {
      const ny = (iy + oy + cells) % cells;
      const shiftY = iy + oy - ny;
      for (let ox = -1; ox <= 1; ox++) {
        const nx = (ix + ox + cells) % cells;
        const shiftX = ix + ox - nx;
        const idx = ny * cells + nx;
        const dx = ptsX[idx] + shiftX - px;
        const dy = ptsY[idx] + shiftY - py;
        const dist = dx * dx + dy * dy;
        if (dist < d1) {
          d2 = d1;
          d1 = dist;
          idVal = cellVal[idx];
        } else if (dist < d2) {
          d2 = dist;
        }
      }
    }
    const f1 = Math.sqrt(d1);
    const f2 = Math.sqrt(d2);
    return { f1, edge: f2 - f1, idVal };
  };
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function mixNum(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Converts a scalar heightfield Float32Array (size x size) + RGBA Albedo/Roughness/AO buffers
 * into offscreen 1024x1024 <canvas> THREE.CanvasTexture sets (with Sobel Tangent-Space Normal Map).
 */
function buildCanvasTextureSet(size, heightField, albedoRGBA, roughGray, aoGray, normalStrength, isColorSRGB = true) {
  const makeCanvasTex = (rgbaBytes, srgb) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imgData = new ImageData(rgbaBytes, size, size);
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  // Sobel 3x3 Tangent-Space Normal Map + scalar-packed Roughness/AO maps
  const normalRGBA = new Uint8ClampedArray(size * size * 4);
  const roughRGBA = new Uint8ClampedArray(size * size * 4);
  const aoRGBA = new Uint8ClampedArray(size * size * 4);

  const mask = size - 1;
  const h = heightField;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1) & mask;
    const yp = (y + 1) & mask;
    const rowM = ym * size;
    const row0 = y * size;
    const rowP = yp * size;

    for (let x = 0; x < size; x++) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;

      const tl = h[rowM + xm];
      const t = h[rowM + x];
      const tr = h[rowM + xp];
      const l = h[row0 + xm];
      const r = h[row0 + xp];
      const bl = h[rowP + xm];
      const b = h[rowP + x];
      const br = h[rowP + xp];

      const dX = (tr + 2.0 * r + br - (tl + 2.0 * l + bl)) * normalStrength;
      const dY = (bl + 2.0 * b + br - (tl + 2.0 * t + tr)) * normalStrength;
      const invLen = 1.0 / Math.hypot(dX, dY, 1.0);

      const off = (row0 + x) * 4;
      normalRGBA[off] = clampByte(((-dX * invLen) * 0.5 + 0.5) * 255);
      normalRGBA[off + 1] = clampByte(((-dY * invLen) * 0.5 + 0.5) * 255);
      normalRGBA[off + 2] = clampByte(((invLen) * 0.5 + 0.5) * 255);
      normalRGBA[off + 3] = 255;

      const rv = roughGray[row0 + x];
      roughRGBA[off] = rv;
      roughRGBA[off + 1] = rv;
      roughRGBA[off + 2] = rv;
      roughRGBA[off + 3] = 255;

      const av = aoGray[row0 + x];
      aoRGBA[off] = av;
      aoRGBA[off + 1] = av;
      aoRGBA[off + 2] = av;
      aoRGBA[off + 3] = 255;
    }
  }

  return {
    map: makeCanvasTex(albedoRGBA, isColorSRGB),
    normalMap: makeCanvasTex(normalRGBA, false),
    roughnessMap: makeCanvasTex(roughRGBA, false),
    aoMap: makeCanvasTex(aoRGBA, false),
  };
}

/**
 * Generates all 5 1024x1024 procedural PBR texture sets on offscreen <canvas> surfaces:
 * 1. Vesicular Volcanic Basalt & Iron-Oxide Martian Regolith (pair for terrain/rock blending)
 * 2. Wet Karstic Cave Limestone (Act 4 sedimentary strata + specular seepage veins)
 * 3. Aerospace Brushed Titanium (anisotropic streaks, panel seams, rivets)
 * 4. Crinkled Gold Kapton MLI Foil (Voronoi crumpled insulation facets)
 * 5. Carbon Fiber Weave (2x2 diagonal twill)
 */
export function generateAllPBRMaterials(seed = 20261115) {
  const SIZE = 1024;
  const N = SIZE * SIZE;
  const invSize = 1.0 / SIZE;

  // Shared multi-octave tileable samplers (cached grid lookups -> blazing fast 1024^2 synthesis)
  const fbmA = buildTileNoiseSampler(seed + 11, 16);
  const fbmB = buildTileNoiseSampler(seed + 23, 32);
  const fbmC = buildTileNoiseSampler(seed + 47, 64);
  const fbmD = buildTileNoiseSampler(seed + 89, 128);
  const microGrain = buildTileNoiseSampler(seed + 131, 256);

  // =========================================================================
  // 1A. VESICULAR VOLCANIC BASALT (#1E2229, roughness ~0.92, cellular pitting)
  // =========================================================================
  const basaltH = new Float32Array(N);
  const basaltAlbedo = new Uint8ClampedArray(N * 4);
  const basaltRough = new Uint8ClampedArray(N);
  const basaltAO = new Uint8ClampedArray(N);
  const basaltVoro = buildTileVoronoiSampler(seed + 201, 22);
  const basaltPore = buildTileVoronoiSampler(seed + 211, 52);

  for (let y = 0; y < SIZE; y++) {
    const v = y * invSize;
    for (let x = 0; x < SIZE; x++) {
      const u = x * invSize;
      const idx = y * SIZE + x;

      // Domain-warped FBM
      const wX = fbmA(u, v) * 0.08 + fbmB(u * 2, v * 2) * 0.03;
      const wY = fbmA(u + 0.37, v + 0.61) * 0.08 + fbmB(u * 2 + 0.2, v * 2 + 0.5) * 0.03;
      const fbm =
        fbmA(u + wX, v + wY) * 0.45 +
        fbmB(u + wX, v + wY) * 0.28 +
        fbmC(u + wX, v + wY) * 0.17 +
        fbmD(u, v) * 0.10;

      // Vesicular volcanic gas pores
      const macroCell = basaltVoro(u + wX * 0.4, v + wY * 0.4);
      const pore = basaltPore(u + wX * 0.2, v + wY * 0.2);
      const pit = 1.0 - smoothstep(0.05, 0.24, pore.f1);
      const fracRidge = 1.0 - smoothstep(0.0, 0.12, macroCell.edge);

      const heightVal = fbm * 0.65 - pit * 0.48 - fracRidge * 0.16 + microGrain(u * 2, v * 2) * 0.08;
      basaltH[idx] = heightVal;

      const shade = 0.72 + fbm * 0.52 - pit * 0.26;
      const off = idx * 4;
      // #1E2229 -> (30, 34, 41) Linear-inspired base with subtle slate highlight
      basaltAlbedo[off] = clampByte(30 * shade + 10 * (1 - pit));
      basaltAlbedo[off + 1] = clampByte(34 * shade + 12 * (1 - pit));
      basaltAlbedo[off + 2] = clampByte(41 * shade + 15 * (1 - pit));
      basaltAlbedo[off + 3] = 255;

      basaltRough[idx] = clampByte(mixNum(0.86, 0.98, 0.5 + pit * 0.4 + microGrain(u, v) * 0.15) * 255);
      basaltAO[idx] = clampByte(mixNum(0.32, 1.0, (1 - pit * 0.65) * (1 - fracRidge * 0.4) * (0.65 + fbm * 0.35)) * 255);
    }
  }
  const volcanicBasalt = buildCanvasTextureSet(SIZE, basaltH, basaltAlbedo, basaltRough, basaltAO, 2.8, true);

  // =========================================================================
  // 1B. IRON-OXIDE MARTIAN REGOLITH & WIND-RIPPLED VALLEY SAND (#9E422E -> #C97355)
  // =========================================================================
  const regH = new Float32Array(N);
  const regAlbedo = new Uint8ClampedArray(N * 4);
  const regRough = new Uint8ClampedArray(N);
  const regAO = new Uint8ClampedArray(N);

  for (let y = 0; y < SIZE; y++) {
    const v = y * invSize;
    for (let x = 0; x < SIZE; x++) {
      const u = x * invSize;
      const idx = y * SIZE + x;

      const warp = fbmA(u, v) * 0.14 + fbmB(u, v) * 0.05;
      // Aeolian wind-rippled sand wave normal frequency
      const ripple = Math.sin((u * 18.0 + v * 6.0 + warp * 8.0) * Math.PI * 2.0) * 0.5 + 0.5;
      const pebble = fbmD(u * 2, v * 2) * 0.6 + microGrain(u * 2, v * 2) * 0.4;
      const blendFbm = fbmA(u + warp * 0.5, v - warp * 0.5) * 0.6 + fbmC(u, v) * 0.4;

      regH[idx] = ripple * 0.36 + blendFbm * 0.42 + pebble * 0.22;

      const ochreMix = smoothstep(0.25, 0.78, blendFbm * 0.65 + ripple * 0.35);
      // #9E422E (158,66,46) -> #C97355 (201,115,85)
      const rCol = mixNum(158, 201, ochreMix) * (0.86 + ripple * 0.22);
      const gCol = mixNum(66, 115, ochreMix) * (0.86 + ripple * 0.22);
      const bCol = mixNum(46, 85, ochreMix) * (0.86 + ripple * 0.22);

      const off = idx * 4;
      regAlbedo[off] = clampByte(rCol);
      regAlbedo[off + 1] = clampByte(gCol);
      regAlbedo[off + 2] = clampByte(bCol);
      regAlbedo[off + 3] = 255;

      regRough[idx] = clampByte(mixNum(0.80, 0.92, 1.0 - ripple * 0.35 + pebble * 0.2) * 255);
      regAO[idx] = clampByte(mixNum(0.68, 1.0, ripple * 0.5 + blendFbm * 0.5) * 255);
    }
  }
  const martianRegolith = buildCanvasTextureSet(SIZE, regH, regAlbedo, regRough, regAO, 2.2, true);

  // =========================================================================
  // 2. WET KARSTIC CAVE LIMESTONE (Act 4: strata + water-seepage veins R 0.88->0.14)
  // =========================================================================
  const karstH = new Float32Array(N);
  const karstAlbedo = new Uint8ClampedArray(N * 4);
  const karstRough = new Uint8ClampedArray(N);
  const karstAO = new Uint8ClampedArray(N);
  const dripVoro = buildTileVoronoiSampler(seed + 307, 14);

  for (let y = 0; y < SIZE; y++) {
    const v = y * invSize;
    for (let x = 0; x < SIZE; x++) {
      const u = x * invSize;
      const idx = y * SIZE + x;

      const w = fbmA(u, v) * 0.1 + fbmB(u, v) * 0.04;
      const strata = Math.sin((v * 14.0 + w * 4.5) * Math.PI * 2.0) * 0.5 + 0.5;
      const fineNoise = fbmC(u, v) * 0.55 + fbmD(u, v) * 0.3 + microGrain(u, v) * 0.15;

      // Vertical water-seepage mineral drip streaks
      const streakWave = fbmB(u * 2.4 + w * 0.3, v * 0.25) * 0.65 + fbmC(u * 3.0, v * 0.4) * 0.35;
      const cellEdge = dripVoro(u + w * 0.3, v + w * 0.3).edge;
      const wetVein = smoothstep(0.54, 0.74, streakWave + (1.0 - smoothstep(0.0, 0.09, cellEdge)) * 0.25);

      karstH[idx] = strata * 0.42 + fineNoise * 0.45 - wetVein * 0.15;

      // Dark slate wet limestone vs lighter carbonate mineral deposit streaks
      const rockR = mixNum(42, 78, strata * 0.6 + fineNoise * 0.4);
      const rockG = mixNum(48, 84, strata * 0.6 + fineNoise * 0.4);
      const rockB = mixNum(56, 92, strata * 0.6 + fineNoise * 0.4);

      const off = idx * 4;
      // Wet water seepage darkens diffuse albedo cleanly (wet stone physics!)
      const wetDark = 1.0 - wetVein * 0.48;
      karstAlbedo[off] = clampByte(rockR * wetDark + wetVein * 8);
      karstAlbedo[off + 1] = clampByte(rockG * wetDark + wetVein * 14);
      karstAlbedo[off + 2] = clampByte(rockB * wetDark + wetVein * 20);
      karstAlbedo[off + 3] = 255;

      // Specular roughness contrast: 0.88 dry limestone -> 0.14 glossy wet seepage veins
      karstRough[idx] = clampByte(mixNum(0.88, 0.14, wetVein) * 255);
      karstAO[idx] = clampByte(mixNum(0.45, 1.0, 0.4 + strata * 0.4 + fineNoise * 0.2) * 255);
    }
  }
  const wetLimestone = buildCanvasTextureSet(SIZE, karstH, karstAlbedo, karstRough, karstAO, 2.5, true);

  // =========================================================================
  // 3. AEROSPACE BRUSHED TITANIUM (metalness 0.92, roughness 0.26, seams & rivets)
  // =========================================================================
  const tiH = new Float32Array(N);
  const tiAlbedo = new Uint8ClampedArray(N * 4);
  const tiRough = new Uint8ClampedArray(N);
  const tiAO = new Uint8ClampedArray(N);
  const brushLine = buildTileNoiseSampler(seed + 409, 512);

  for (let y = 0; y < SIZE; y++) {
    const v = y * invSize;
    for (let x = 0; x < SIZE; x++) {
      const u = x * invSize;
      const idx = y * SIZE + x;

      // Anisotropic fine horizontal brush scratches
      const brush =
        brushLine(u * 0.08, v * 3.5) * 0.55 +
        fbmD(u * 0.25, v * 6.0) * 0.30 +
        microGrain(u * 0.5, v * 8.0) * 0.15;

      // 4x4 Modular spacecraft hull panel seams
      const pu = (u * 4.0) % 1.0;
      const pv = (v * 4.0) % 1.0;
      const seamDist = Math.min(Math.min(pu, 1.0 - pu), Math.min(pv, 1.0 - pv));
      const seam = 1.0 - smoothstep(0.008, 0.024, seamDist);
      const edgeWear = smoothstep(0.022, 0.055, seamDist) * (1.0 - smoothstep(0.055, 0.09, seamDist));

      // Corner panel rivets around panel seams
      const rU = Math.min(Math.abs(pu - 0.075), Math.abs(pu - 0.925));
      const rV = Math.min(Math.abs(pv - 0.075), Math.abs(pv - 0.925));
      const rivetDist = Math.hypot(rU, rV);
      const rivetHead = 1.0 - smoothstep(0.014, 0.028, rivetDist);
      const rivetRing = (1.0 - smoothstep(0.024, 0.036, rivetDist)) * smoothstep(0.018, 0.026, rivetDist);

      tiH[idx] = brush * 0.18 - seam * 0.55 + rivetHead * 0.42 - rivetRing * 0.25;

      const baseTone = mixNum(178, 214, brush) + edgeWear * 26 - seam * 85 + rivetHead * 18;
      const off = idx * 4;
      tiAlbedo[off] = clampByte(baseTone * 0.95);
      tiAlbedo[off + 1] = clampByte(baseTone * 0.98);
      tiAlbedo[off + 2] = clampByte(baseTone * 1.03);
      tiAlbedo[off + 3] = 255;

      tiRough[idx] = clampByte(mixNum(0.20, 0.34, brush * 0.7 + seam * 0.5 - edgeWear * 0.2) * 255);
      tiAO[idx] = clampByte(mixNum(0.28, 1.0, (1.0 - seam * 0.7) * (1.0 - rivetRing * 0.5)) * 255);
    }
  }
  const brushedTitanium = buildCanvasTextureSet(SIZE, tiH, tiAlbedo, tiRough, tiAO, 2.0, true);

  // =========================================================================
  // 4. CRINKLED GOLD KAPTON MLI FOIL (Voronoi facet normals, #FFB800, M 1.0, R 0.20)
  // =========================================================================
  const kapH = new Float32Array(N);
  const kapAlbedo = new Uint8ClampedArray(N * 4);
  const kapRough = new Uint8ClampedArray(N);
  const kapAO = new Uint8ClampedArray(N);
  const crinkleA = buildTileVoronoiSampler(seed + 503, 18);
  const crinkleB = buildTileVoronoiSampler(seed + 521, 36);

  for (let y = 0; y < SIZE; y++) {
    const v = y * invSize;
    for (let x = 0; x < SIZE; x++) {
      const u = x * invSize;
      const idx = y * SIZE + x;

      const ca = crinkleA(u, v);
      const cb = crinkleB(u + 0.13, v - 0.19);
      const facetSlope = ca.edge * 0.72 + cb.edge * 0.38;
      const crease = 1.0 - smoothstep(0.0, 0.08, Math.min(ca.edge, cb.edge));

      kapH[idx] = facetSlope * 0.78 + Math.sin((u * 12 + v * 9 + ca.idVal * 4.0) * 6.2831) * 0.12 - crease * 0.22;

      const sheen = 0.88 + ca.idVal * 0.20 - crease * 0.18;
      const off = idx * 4;
      // Rich aerospace MLI Kapton Gold (#FFB800 base modulated by facet tilt)
      kapAlbedo[off] = clampByte(255 * sheen);
      kapAlbedo[off + 1] = clampByte(184 * sheen);
      kapAlbedo[off + 2] = clampByte(14 * sheen);
      kapAlbedo[off + 3] = 255;

      kapRough[idx] = clampByte(mixNum(0.14, 0.28, crease * 0.7 + microGrain(u, v) * 0.3) * 255);
      kapAO[idx] = clampByte(mixNum(0.55, 1.0, 1.0 - crease * 0.42) * 255);
    }
  }
  const goldKapton = buildCanvasTextureSet(SIZE, kapH, kapAlbedo, kapRough, kapAO, 3.4, true);

  // =========================================================================
  // 5. CARBON FIBER WEAVE (2x2 Diagonal Twill, M 0.35, R 0.32)
  // =========================================================================
  const cfH = new Float32Array(N);
  const cfAlbedo = new Uint8ClampedArray(N * 4);
  const cfRough = new Uint8ClampedArray(N);
  const cfAO = new Uint8ClampedArray(N);
  const twillFreq = 64.0;

  for (let y = 0; y < SIZE; y++) {
    const v = y * invSize;
    for (let x = 0; x < SIZE; x++) {
      const u = x * invSize;
      const idx = y * SIZE + x;

      const gx = u * twillFreq;
      const gy = v * twillFreq;
      const cellX = Math.floor(gx);
      const cellY = Math.floor(gy);
      const fx = gx - cellX;
      const fy = gy - cellY;

      // 2x2 diagonal twill weave pattern
      const twillIdx = (cellX + cellY) & 3;
      const warpOver = twillIdx < 2;
      const fiberProfile = warpOver ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
      const strandMicro = Math.sin((warpOver ? fy : fx) * Math.PI * 10.0) * 0.12;

      cfH[idx] = fiberProfile * 0.55 + strandMicro;

      const tint = warpOver ? 34 : 20;
      const col = tint + fiberProfile * 22 + strandMicro * 10;
      const off = idx * 4;
      cfAlbedo[off] = clampByte(col);
      cfAlbedo[off + 1] = clampByte(col + 2);
      cfAlbedo[off + 2] = clampByte(col + 5);
      cfAlbedo[off + 3] = 255;

      cfRough[idx] = clampByte(mixNum(0.24, 0.42, (1.0 - fiberProfile) * 0.7 + (warpOver ? 0 : 0.25)) * 255);
      cfAO[idx] = clampByte(mixNum(0.45, 1.0, 0.5 + fiberProfile * 0.5) * 255);
    }
  }
  const carbonFiber = buildCanvasTextureSet(SIZE, cfH, cfAlbedo, cfRough, cfAO, 2.2, true);

  return {
    volcanicBasalt,
    martianRegolith,
    wetLimestone,
    brushedTitanium,
    goldKapton,
    carbonFiber,
  };
}

/**
 * Generates a procedural equirectangular golden-hour Martian / orbital sky HDRI texture
 * and processes it through THREE.PMREMGenerator as scene.environment.
 */
export function createProceduralEnvironment(renderer) {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Sky zenith -> cool scattering blue -> warm golden-hour Martian horizon -> dark basalt ground bounce
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#040814');
  grad.addColorStop(0.32, '#102442');
  grad.addColorStop(0.47, '#3E72A3');
  grad.addColorStop(0.505, '#FFB87A');
  grad.addColorStop(0.56, '#7A3B28');
  grad.addColorStop(0.75, '#261410');
  grad.addColorStop(1.0, '#0B090C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Crisp solar hot-spot specular reflector on horizon
  const sunX = w * 0.72;
  const sunY = h * 0.44;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 72);
  sunGrad.addColorStop(0.0, 'rgba(255, 250, 238, 1.0)');
  sunGrad.addColorStop(0.22, 'rgba(255, 224, 178, 0.72)');
  sunGrad.addColorStop(0.6, 'rgba(255, 148, 86, 0.18)');
  sunGrad.addColorStop(1.0, 'rgba(255, 148, 86, 0.0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, w, h);

  const equirect = new THREE.CanvasTexture(canvas);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.SRGBColorSpace;
  equirect.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(equirect);
  equirect.dispose();
  pmrem.dispose();

  return envRT.texture;
}
