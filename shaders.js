import * as THREE from 'three';
import { createMulberry32 } from './pbrTextures.js';

export { createMulberry32 };

/**
 * Deterministic 2D hash + smooth noise + RidgedFBM for CPU vertex height sampling.
 * Keeps 3D props, rover wheels, habitat struts, and HUD anchors flush with GLSL terrain.
 */
function hash2(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + 20.261115) * 43758.5453123;
  return n - Math.floor(n);
}

export function noise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x, z, octaves = 5) {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * (noise2D(x * freq, z * freq) * 2.0 - 1.0);
    // Domain rotation avoids axial grid artifacts on ridge lines
    const nx = x * 0.8 - z * 0.6;
    const nz = x * 0.6 + z * 0.8;
    x = nx;
    z = nz;
    freq *= 2.04;
    amp *= 0.5;
  }
  return value;
}

export function ridgedFbm2D(x, z, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let weight = 1.0;
  for (let i = 0; i < octaves; i++) {
    const n = 1.0 - Math.abs(noise2D(x * freq, z * freq) * 2.0 - 1.0);
    const signal = n * n * weight;
    weight = Math.min(1.0, Math.max(0.0, signal * 1.8));
    sum += signal * amp;
    const nx = x * 0.8 - z * 0.6;
    const nz = x * 0.6 + z * 0.8;
    x = nx;
    z = nz;
    freq *= 2.12;
    amp *= 0.52;
  }
  return sum;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic geological elevation sampler for the 240x240 planetary analog terrain.
 * Shapes canyons, arid plateaus, the Act 4 karst cove, Act 6 colony terrace, and Act 7 fissure.
 * Exported as both `getTerrainHeight` (spec API) and `sampleTerrainHeight`.
 */
export function getTerrainHeight(x, z) {
  const ridged = ridgedFbm2D(x * 0.032 + 4.2, z * 0.032 - 2.7, 5);
  const macro = fbm2D(x * 0.015 - 1.8, z * 0.015 + 3.1, 4);
  const micro = fbm2D(x * 0.14 + 9.0, z * 0.14 - 5.0, 2) * 0.28;

  // Base volcanic basalt ridges + arid plateau strata
  let h = ridged * 15.5 + macro * 4.5 + micro - 3.6;

  // Main winding canyon valley passing through Act 1-2 vista
  const valleyCurve = Math.sin(z * 0.035) * 18.0 - 12.0;
  const valleyDist = Math.abs(x - valleyCurve);
  const valleyCarve = 1.0 - smoothstep(6.0, 34.0, valleyDist);
  h -= valleyCarve * 5.8;

  // Flatten tactical plateau slightly around Act 3 Survey Beacon (26, 16)
  const dBeacon = Math.hypot(x - 26, z - 16);
  const mBeacon = 1.0 - smoothstep(4.5, 16.0, dBeacon);
  h = h * (1.0 - mBeacon * 0.72) + (1.2 + micro * 0.4) * (mBeacon * 0.72);

  // Carve Act 4 Karst cleft around (44, -6) and sunny security basin around (58, -14)
  const dKarst = Math.hypot((x - 44) * 1.15, z + 6);
  const mKarst = 1.0 - smoothstep(3.0, 12.0, dKarst);
  h -= mKarst * 3.4;

  const dSec = Math.hypot(x - 58, z + 14);
  const mSec = 1.0 - smoothstep(5.0, 17.0, dSec);
  h = h * (1.0 - mSec * 0.78) + (0.6 + micro * 0.35) * (mSec * 0.78);

  // Act 5 Data-Gap outcrop bench (16, -32)
  const dGap = Math.hypot(x - 16, z + 32);
  const mGap = 1.0 - smoothstep(4.0, 15.0, dGap);
  h = h * (1.0 - mGap * 0.7) + (1.8 + micro * 0.5) * (mGap * 0.7);

  // Act 6 Virtual Habitat level terrace (-28, -38)
  const dColony = Math.hypot(x + 28, z + 38);
  const mColony = 1.0 - smoothstep(9.0, 22.0, dColony);
  h = h * (1.0 - mColony * 0.9) + 1.4 * (mColony * 0.9);

  // Act 7 Extreme Hazard volcanic fissure (-60, -8) & sheer basalt cliff (-74, -10)
  // Smooth slope transitions avoid coarse vertex triangles at close camera range
  const dFissure = Math.hypot((x + 60) * 1.25, (z + 8) * 0.65);
  const mFissure = 1.0 - smoothstep(2.5, 13.5, dFissure);
  h -= mFissure * 5.2;

  const dCliff = Math.hypot((x + 74) * 0.78, (z + 10) * 0.6);
  const mCliff = 1.0 - smoothstep(5.0, 21.0, dCliff);
  h += mCliff * 9.8;

  // Deterministic rocky crawl undulations along Act 7 rover path for genuine rocker-bogie wheel articulation
  const dRoverTrack = Math.hypot((x + 60.5) * 0.55, (z + 0.5) * 0.45);
  const mRover = 1.0 - smoothstep(2.5, 11.0, dRoverTrack);
  const rockBumps =
    Math.sin(x * 1.15 + z * 0.85) * 0.24 +
    Math.cos(x * 2.1 - z * 1.4) * 0.16;
  h += rockBumps * mRover;

  return h;
}

export const sampleTerrainHeight = getTerrainHeight;

export function getTerrainNormal(x, z, eps = 0.45) {
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  return new THREE.Vector3(hL - hR, 2.0 * eps, hD - hU).normalize();
}

export const sampleTerrainNormal = getTerrainNormal;

/**
 * Shared GLSL 3D Simplex Noise block used across planetary & post-processing shaders.
 */
export const GLSL_SIMPLEX_NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm3(vec3 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    f += a * snoise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return f;
}
`;

/**
 * Procedural soft circular radial gradient alpha texture for dust motes & sparks.
 */
export function createDustTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.28, 'rgba(255, 240, 210, 0.72)');
  grad.addColorStop(0.65, 'rgba(255, 210, 170, 0.16)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Deterministic procedural tileable multi-octave grain/bump texture via seeded PRNG.
 * Uses smooth linear mipmapped interpolation so close-up cliffs never pixelate.
 */
export function createGrainNormalTexture(rng, size = 256) {
  const gridSize = 32;
  const coarse = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < coarse.length; i++) coarse[i] = rng();
  const sampleCoarse = (u, v) => {
    const gx = ((u % gridSize) + gridSize) % gridSize;
    const gz = ((v % gridSize) + gridSize) % gridSize;
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = (x0 + 1) % gridSize;
    const z1 = (z0 + 1) % gridSize;
    const fx = gx - x0;
    const fz = gz - z0;
    const ux = fx * fx * (3 - 2 * fx);
    const uz = fz * fz * (3 - 2 * fz);
    const a = coarse[z0 * gridSize + x0];
    const b = coarse[z0 * gridSize + x1];
    const c = coarse[z1 * gridSize + x0];
    const d = coarse[z1 * gridSize + x1];
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  };

  const data = new Uint8Array(size * size * 4);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * gridSize;
      const v = (y / size) * gridSize;
      const fbm =
        sampleCoarse(u, v) * 0.55 +
        sampleCoarse(u * 2.0, v * 2.0) * 0.28 +
        sampleCoarse(u * 4.0, v * 4.0) * 0.17;
      heights[y * size + x] = fbm;
    }
  }
  const idx = (x, y) => ((y + size) % size) * size + ((x + size) % size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (heights[idx(x + 1, y)] - heights[idx(x - 1, y)]) * 1.1;
      const dy = (heights[idx(x, y + 1)] - heights[idx(x, y - 1)]) * 1.1;
      const len = Math.hypot(dx, dy, 1.0);
      const offset = (y * size + x) * 4;
      data[offset] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[offset + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[offset + 2] = Math.round((heights[y * size + x] * 0.5 + 0.5) * 255);
      data[offset + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Planetary Earth Surface ShaderMaterial:
 * - Multi-octave Simplex FBM continents & bathymetries
 * - Normal-mapped continental mountain ridges
 * - Specular ocean sun-glint
 * - Warm night-side telemetry/city hubs along twilight terminator
 */
export function createEarthSurfaceMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone().normalize() },
      uNightLightsMix: { value: 1.0 },
      uCloudRotDelta: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObjPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vObjPos = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_SIMPLEX_NOISE}
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uNightLightsMix;
      uniform float uCloudRotDelta;
      varying vec3 vObjPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float earthRelief(vec3 p) {
        return fbm3(p * 2.15 + vec3(1.2, -0.7, 2.4));
      }

      vec3 rotateY(vec3 v, float a) {
        float c = cos(a);
        float s = sin(a);
        return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
      }

      float sampleCloudDensity(vec3 dirObj) {
        vec3 p = normalize(dirObj) * 3.4 + vec3(uTime * 0.04, 0.0, -uTime * 0.02);
        float c = fbm3(p);
        float swirl = fbm3(p * 2.2 + vec3(c * 0.8));
        return smoothstep(0.08, 0.48, c + swirl * 0.35);
      }

      void main() {
        vec3 p = normalize(vObjPos);
        float cont = earthRelief(p);
        float detail = snoise(p * 11.0);
        float landMask = smoothstep(0.03, 0.14, cont);
        float mountain = smoothstep(0.20, 0.52, cont + detail * 0.18);

        // Procedural tangent-free mountain relief normal perturbation (gentle, no coastline halo)
        float e = 0.025;
        vec3 gx = vec3(earthRelief(p + vec3(e,0,0)) - cont,
                       earthRelief(p + vec3(0,e,0)) - cont,
                       earthRelief(p + vec3(0,0,e)) - cont) / e;
        vec3 N = normalize(vWorldNormal - smoothstep(0.14, 0.32, cont) * (gx - vWorldNormal * dot(gx, vWorldNormal)) * 0.09);

        // Realistic NASA Blue Marble oceanic & continental biome palette
        vec3 deepOcean = vec3(0.010, 0.038, 0.105);
        vec3 shelfOcean = vec3(0.022, 0.145, 0.275);
        vec3 oceanCol = mix(deepOcean, shelfOcean, smoothstep(-0.22, 0.04, cont));

        vec3 forestCol = vec3(0.055, 0.155, 0.095);
        vec3 savannaCol = vec3(0.24, 0.21, 0.12);
        vec3 aridCol = vec3(0.42, 0.25, 0.15);
        vec3 peakCol = vec3(0.62, 0.58, 0.55);
        // Organic domain-warped continental biomes
        float biomeField = snoise(p * 4.5 + vec3(cont * 1.4)) * 0.5 + 0.5;
        float lat = abs(p.y);
        float aridMix = smoothstep(0.28, 0.72, biomeField * 0.72 + (1.0 - lat) * 0.28);
        vec3 landCol = mix(forestCol, savannaCol, smoothstep(0.10, 0.48, aridMix));
        landCol = mix(landCol, aridCol, smoothstep(0.48, 0.85, aridMix));
        landCol = mix(landCol, peakCol, smoothstep(0.42, 0.88, mountain));
        // Polar ice caps
        float ice = smoothstep(0.75, 0.90, lat + cont * 0.10);
        landCol = mix(landCol, vec3(0.80, 0.88, 0.94), ice);

        vec3 albedo = mix(oceanCol, landCol, landMask);

        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float NdotL = dot(N, L);
        float day = smoothstep(-0.08, 0.26, NdotL);
        float terminatorBand = exp(-pow((NdotL + 0.03) * 9.0, 2.0));

        // Synchronized Cloud Drop Shadow cast along grazing -sun tangent onto ocean/land below
        vec3 pCloud = rotateY(p, -uCloudRotDelta);
        vec3 sunTangent = normalize(L - vWorldNormal * dot(L, vWorldNormal) + vec3(0.0001));
        vec3 shadowSampleDir = normalize(pCloud + rotateY(sunTangent, -uCloudRotDelta) * 0.022);
        float cloudShadow = sampleCloudDensity(shadowSampleDir) * smoothstep(-0.05, 0.30, NdotL);
        float shadowMul = 1.0 - cloudShadow * 0.58;

        // Ocean sun-glint (attenuated inside cloud shadows)
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 64.0) * (1.0 - landMask) * smoothstep(0.02, 0.35, NdotL) * shadowMul;

        // Pinprick explorer city lights strictly on the dark hemisphere (zero blobs)
        float cityNoise = snoise(p * 34.0) * 0.55 + snoise(p * 68.0) * 0.45;
        float hubs = smoothstep(0.58, 0.82, cityNoise) * smoothstep(0.14, 0.28, cont) * (1.0 - smoothstep(-0.18, 0.06, NdotL)) * uNightLightsMix;
        vec3 nightGlow = vec3(1.0, 0.72, 0.26) * hubs * 0.62 + vec3(0.0, 0.85, 1.0) * smoothstep(0.68, 0.88, cityNoise) * (1.0 - day) * landMask * 0.48;

        // Atmospheric Rayleigh twilight band along terminator
        vec3 scatter = vec3(0.0, 0.75, 1.0) * terminatorBand * 0.18 + vec3(1.0, 0.45, 0.15) * terminatorBand * 0.09;

        vec3 ambient = albedo * vec3(0.025, 0.045, 0.085);
        vec3 direct = albedo * max(NdotL, 0.0) * 1.48 * shadowMul;
        vec3 color = ambient + direct + vec3(0.78, 0.92, 1.0) * spec * 0.85 + nightGlow + scatter;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

/**
 * Animated Earth Cloud Layer ShaderMaterial (rotates independently slightly faster than surface).
 */
export function createEarthCloudMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone().normalize() },
      uOpacity: { value: 0.78 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObjPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vObjPos = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_SIMPLEX_NOISE}
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uOpacity;
      varying vec3 vObjPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec3 p = normalize(vObjPos) * 3.4 + vec3(uTime * 0.04, 0.0, -uTime * 0.02);
        float c = fbm3(p);
        float swirl = fbm3(p * 2.2 + vec3(c * 0.8));
        float alpha = smoothstep(0.08, 0.48, c + swirl * 0.35);
        float NdotL = dot(normalize(vWorldNormal), normalize(uSunDir));
        float lit = smoothstep(-0.18, 0.35, NdotL);
        vec3 col = mix(vec3(0.05, 0.11, 0.22), vec3(0.95, 0.98, 1.0), lit);
        gl_FragColor = vec4(col, alpha * uOpacity * mix(0.22, 1.0, lit));
      }
    `,
  });
}

/**
 * Custom GLSL Fresnel Atmospheric Rim Glow Shader (#00F0FF / #3B82F6).
 */
export function createAtmosphereMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uColorCyan: { value: new THREE.Color('#00F0FF') },
      uColorBlue: { value: new THREE.Color('#3B82F6') },
      uIntensity: { value: 1.45 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uColorCyan;
      uniform vec3 uColorBlue;
      uniform float uIntensity;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        // BackSide normal flips inward, so rim peaking occurs as dot(N, V) approaches ~0.35..0.65
        float rim = pow(clamp(0.72 + dot(N, V), 0.0, 1.0), 3.6);
        float sunWrap = smoothstep(-0.45, 0.65, dot(-N, normalize(uSunDir)));
        vec3 col = mix(uColorBlue, uColorCyan, pow(rim, 1.4));
        gl_FragColor = vec4(col * rim * sunWrap * uIntensity, rim * sunWrap);
      }
    `,
  });
}

/**
 * Procedural Lunar Surface ShaderMaterial (maria + cratered highland regolith).
 */
export function createMoonMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      void main() {
        vObjPos = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_SIMPLEX_NOISE}
      uniform vec3 uSunDir;
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      void main() {
        vec3 p = normalize(vObjPos);
        float maria = smoothstep(-0.15, 0.35, fbm3(p * 2.4 + vec3(3.1)));
        float craters = abs(snoise(p * 14.0)) * 0.5 + abs(snoise(p * 28.0)) * 0.25;
        vec3 base = mix(vec3(0.24, 0.26, 0.30), vec3(0.58, 0.60, 0.64), maria);
        base *= (0.78 + craters * 0.45);
        float NdotL = max(dot(normalize(vWorldNormal), normalize(uSunDir)), 0.02);
        gl_FragColor = vec4(base * NdotL * 1.25, 1.0);
      }
    `,
  });
}

/**
 * Physically inspired Rayleigh + Mie Atmospheric Scattering Sky Dome Shader.
 * Renders deep space zenith (#060B18), horizon dust scattering, 14° golden-hour solar disc
 * with Henyey-Greenstein forward Mie halo, and subtle non-flickering orbital stars.
 */
export function createSkyDomeMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_SIMPLEX_NOISE}
      uniform vec3 uSunDir;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        vec3 sun = normalize(uSunDir);
        float y = clamp(dir.y, -0.25, 1.0);
        float up = clamp(dir.y, 0.0, 1.0);

        // Deep stratospheric zenith (#060B18) transitioning through dusty Martian/analog horizon
        vec3 zenithCol = vec3(0.012, 0.022, 0.052);
        vec3 midSkyCol = vec3(0.042, 0.075, 0.138);
        vec3 horizonCol = vec3(0.165, 0.105, 0.095);
        vec3 nadirCol = vec3(0.018, 0.014, 0.020);

        vec3 sky = mix(horizonCol, midSkyCol, smoothstep(0.0, 0.34, up));
        sky = mix(sky, zenithCol, smoothstep(0.24, 0.85, up));
        if (y < 0.0) {
          sky = mix(horizonCol, nadirCol, smoothstep(0.0, -0.22, y));
        }

        // Rayleigh blue scatter + Henyey-Greenstein Mie forward golden-hour solar halo
        float mu = max(dot(dir, sun), 0.0);
        float g = 0.78;
        float g2 = g * g;
        float mie = (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * mu, 0.02), 1.5);
        float horizonGlow = exp(-abs(dir.y) * 5.2);
        vec3 warmHalo = vec3(1.0, 0.78, 0.56);
        vec3 crispRayleigh = vec3(0.32, 0.62, 1.0);

        sky += crispRayleigh * (0.045 * horizonGlow * (0.4 + 0.6 * mu));
        sky += warmHalo * (pow(mu, 6.0) * 0.32 + mie * 0.032) * (0.35 + 0.65 * horizonGlow);

        // Soft solar core visible only when elevation > -0.02
        float sunCore = smoothstep(0.99925, 0.99975, dot(dir, sun)) * smoothstep(-0.02, 0.05, dir.y);
        sky += vec3(1.0, 0.96, 0.88) * sunCore * 2.8;

        // Deterministic static high-altitude stars fading gently toward the dusty horizon
        float starCell = snoise(dir * 135.0);
        float starFine = snoise(dir * 260.0 + vec3(4.1));
        float stars = smoothstep(0.76, 0.94, starCell) * smoothstep(0.45, 0.82, starFine) * smoothstep(0.14, 0.58, up);
        sky += vec3(0.78, 0.88, 1.0) * stars * 0.55;

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
}

/**
 * Custom Triplanar Geological PBR Material (onBeforeCompile on MeshStandardMaterial).
 * Uses 1024x1024 synthesized PBR map sets (Diffuse, Sobel Normal, Roughness, AO) for:
 *   1. Vesicular Volcanic Basalt (steep cliffs & peaks)
 *   2. Iron-Oxide Martian Regolith + Wind-Rippled Sand (valley floors)
 *   3. Wet Karstic Cave Limestone (Act 4 cavern zone around (44, -6))
 * Plus dynamic Act 2/3/5/7 telemetry overlays and Act 7 mineral veins (Olivine, Pyroxene, Hematite).
 */
export function createTriplanarTerrainMaterial(pbrMaps, fallbackGrainTex = null) {
  const basalt = pbrMaps?.volcanicBasalt;
  const regolith = pbrMaps?.martianRegolith;
  const limestone = pbrMaps?.wetLimestone;

  const uniforms = {
    uTime: { value: 0 },
    uBasaltMap: { value: basalt?.map || fallbackGrainTex },
    uBasaltNorm: { value: basalt?.normalMap || fallbackGrainTex },
    uBasaltRough: { value: basalt?.roughnessMap || fallbackGrainTex },
    uBasaltAO: { value: basalt?.aoMap || fallbackGrainTex },
    uRegolithMap: { value: regolith?.map || fallbackGrainTex },
    uRegolithNorm: { value: regolith?.normalMap || fallbackGrainTex },
    uRegolithRough: { value: regolith?.roughnessMap || fallbackGrainTex },
    uRegolithAO: { value: regolith?.aoMap || fallbackGrainTex },
    uLimeMap: { value: limestone?.map || fallbackGrainTex },
    uLimeNorm: { value: limestone?.normalMap || fallbackGrainTex },
    uLimeRough: { value: limestone?.roughnessMap || fallbackGrainTex },
    uLimeAO: { value: limestone?.aoMap || fallbackGrainTex },
    // Act 2 Orbital radar sweep
    uRadarSweepPos: { value: new THREE.Vector2(-18, 52) },
    uRadarSweepRadius: { value: 0 },
    uRadarSweepAlpha: { value: 0 },
    // Act 3 Beacon ground glow & emerald pulse ring
    uBeaconPos: { value: new THREE.Vector3(26, 0, 16) },
    uBeaconColor: { value: new THREE.Color('#8E9BAE') },
    uBeaconStrength: { value: 0 },
    uBeaconRingRadius: { value: 0 },
    // Act 5 Data-gap grid sweep
    uGapNodePos: { value: new THREE.Vector3(16, 0, -32) },
    uGapScanAlpha: { value: 0 },
    uGapScanPhase: { value: 0 },
    // Act 7 Volcanic magma fissure + multispectral scan beam projection + mineral veins
    uFissurePos: { value: new THREE.Vector3(-60, 0, -8) },
    uFissureGlow: { value: 0 },
    uScanPlaneZ: { value: -8.0 },
    uScanAlpha: { value: 0 },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.04,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        varying vec3 vTriWorldPos;
        varying vec3 vTriWorldNormal;
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vec4 triWp = modelMatrix * vec4(transformed, 1.0);
        vTriWorldPos = triWp.xyz;
        vTriWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uTime;
        uniform sampler2D uBasaltMap;
        uniform sampler2D uBasaltNorm;
        uniform sampler2D uBasaltRough;
        uniform sampler2D uBasaltAO;
        uniform sampler2D uRegolithMap;
        uniform sampler2D uRegolithNorm;
        uniform sampler2D uRegolithRough;
        uniform sampler2D uRegolithAO;
        uniform sampler2D uLimeMap;
        uniform sampler2D uLimeNorm;
        uniform sampler2D uLimeRough;
        uniform sampler2D uLimeAO;
        uniform vec2 uRadarSweepPos;
        uniform float uRadarSweepRadius;
        uniform float uRadarSweepAlpha;
        uniform vec3 uBeaconPos;
        uniform vec3 uBeaconColor;
        uniform float uBeaconStrength;
        uniform float uBeaconRingRadius;
        uniform vec3 uGapNodePos;
        uniform float uGapScanAlpha;
        uniform float uGapScanPhase;
        uniform vec3 uFissurePos;
        uniform float uFissureGlow;
        uniform float uScanPlaneZ;
        uniform float uScanAlpha;
        varying vec3 vTriWorldPos;
        varying vec3 vTriWorldNormal;

        vec3 triWeights(vec3 n) {
          vec3 w = pow(abs(n), vec3(4.5));
          return w / max(dot(w, vec3(1.0)), 0.0001);
        }

        vec3 triplanarColor(sampler2D tex, vec3 p, vec3 w, float scale) {
          vec3 cx = texture2D(tex, p.yz * scale).rgb;
          vec3 cy = texture2D(tex, p.xz * scale).rgb;
          vec3 cz = texture2D(tex, p.xy * scale).rgb;
          return cx * w.x + cy * w.y + cz * w.z;
        }

        float triplanarScalar(sampler2D tex, vec3 p, vec3 w, float scale) {
          float cx = texture2D(tex, p.yz * scale).r;
          float cy = texture2D(tex, p.xz * scale).r;
          float cz = texture2D(tex, p.xy * scale).r;
          return cx * w.x + cy * w.y + cz * w.z;
        }

        vec3 triplanarWorldNormalDelta(sampler2D tex, vec3 p, vec3 w, float scale) {
          vec2 nx = texture2D(tex, p.zy * scale).xy * 2.0 - 1.0;
          vec2 ny = texture2D(tex, p.xz * scale).xy * 2.0 - 1.0;
          vec2 nz = texture2D(tex, p.xy * scale).xy * 2.0 - 1.0;
          vec3 dx = vec3(0.0, nx.y, nx.x);
          vec3 dy = vec3(ny.x, 0.0, ny.y);
          vec3 dz = vec3(nz.x, nz.y, 0.0);
          return dx * w.x + dy * w.y + dz * w.z;
        }
        `
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        vec3 wn = normalize(vTriWorldNormal);
        vec3 tw = triWeights(wn);
        float slope = 1.0 - clamp(wn.y, 0.0, 1.0);
        float cliffMask = smoothstep(0.20, 0.56, slope + smoothstep(3.2, 10.5, vTriWorldPos.y) * 0.36);

        float karstDist = length(vTriWorldPos.xz - vec2(44.0, -6.0));
        float karstMask = 1.0 - smoothstep(4.2, 14.0, karstDist);

        vec3 geoCol = vec3(0.0);
        float geoAO = 1.0;

        if (cliffMask < 0.995) {
          // Dual-scale XZ projection prevents visible macro tiling across canyon flats
          vec3 regMacro = texture2D(uRegolithMap, vTriWorldPos.xz * 0.095).rgb;
          vec3 regDetail = texture2D(uRegolithMap, vTriWorldPos.xz * 0.31 + vec2(0.17, 0.43)).rgb;
          vec3 regCol = mix(regMacro, regDetail, 0.32);
          float regAO = texture2D(uRegolithAO, vTriWorldPos.xz * 0.095).r;
          geoCol += regCol * (1.0 - cliffMask);
          geoAO = mix(geoAO, regAO, 1.0 - cliffMask);
        }
        if (cliffMask > 0.005) {
          vec3 basMacro = triplanarColor(uBasaltMap, vTriWorldPos, tw, 0.125);
          vec3 basStrata = triplanarColor(uBasaltMap, vTriWorldPos * vec3(1.0, 2.2, 1.0), tw, 0.055);
          vec3 basCol = mix(basMacro, basStrata, 0.28);
          float basAO = triplanarScalar(uBasaltAO, vTriWorldPos, tw, 0.125);
          geoCol = mix(geoCol, basCol, cliffMask);
          geoAO = mix(geoAO, basAO, cliffMask);
        }
        if (karstDist < 16.0) {
          vec3 limeCol = triplanarColor(uLimeMap, vTriWorldPos, tw, 0.145);
          float limeAO = triplanarScalar(uLimeAO, vTriWorldPos, tw, 0.145);
          geoCol = mix(geoCol, limeCol, karstMask * 0.92);
          geoAO = mix(geoAO, limeAO, karstMask * 0.92);
        }

        // Convert baked sRGB PBR albedo texture approximation cleanly + crevice AO
        diffuseColor.rgb = geoCol * mix(0.56, 1.0, clamp(geoAO, 0.0, 1.0));
        `
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        vec3 wnR = normalize(vTriWorldNormal);
        vec3 twR = triWeights(wnR);
        float slopeR = 1.0 - clamp(wnR.y, 0.0, 1.0);
        float cliffMaskR = smoothstep(0.20, 0.56, slopeR + smoothstep(3.2, 10.5, vTriWorldPos.y) * 0.36);

        float roughVal = 0.88;
        if (cliffMaskR < 0.995) {
          float regR = texture2D(uRegolithRough, vTriWorldPos.xz * 0.095).r;
          roughVal = mix(roughVal, regR, 1.0 - cliffMaskR);
        }
        if (cliffMaskR > 0.005) {
          float basR = triplanarScalar(uBasaltRough, vTriWorldPos, twR, 0.125);
          roughVal = mix(roughVal, basR, cliffMaskR);
        }
        float karstDistR = length(vTriWorldPos.xz - vec2(44.0, -6.0));
        if (karstDistR < 16.0) {
          float karstMaskR = 1.0 - smoothstep(4.2, 14.0, karstDistR);
          float limeR = triplanarScalar(uLimeRough, vTriWorldPos, twR, 0.145);
          roughVal = mix(roughVal, limeR, karstMaskR * 0.94);
        }
        roughnessFactor = clamp(roughVal, 0.12, 0.98);
        `
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        vec3 wnN = normalize(vTriWorldNormal);
        vec3 twN = triWeights(wnN);
        float slopeN = 1.0 - clamp(wnN.y, 0.0, 1.0);
        float cliffMaskN = smoothstep(0.20, 0.56, slopeN + smoothstep(3.2, 10.5, vTriWorldPos.y) * 0.36);

        vec3 worldDelta = vec3(0.0);
        if (cliffMaskN < 0.995) {
          vec2 regN = texture2D(uRegolithNorm, vTriWorldPos.xz * 0.095).xy * 2.0 - 1.0;
          vec2 regDetailN = texture2D(uRegolithNorm, vTriWorldPos.xz * 0.31 + vec2(0.17, 0.43)).xy * 2.0 - 1.0;
          vec2 rComb = regN * 0.72 + regDetailN * 0.28;
          worldDelta += vec3(rComb.x, 0.0, rComb.y) * (1.0 - cliffMaskN) * 0.65;
        }
        if (cliffMaskN > 0.005) {
          vec3 basDelta = triplanarWorldNormalDelta(uBasaltNorm, vTriWorldPos, twN, 0.125);
          worldDelta += basDelta * cliffMaskN * 0.85;
        }
        float karstDistN = length(vTriWorldPos.xz - vec2(44.0, -6.0));
        if (karstDistN < 16.0) {
          float karstMaskN = 1.0 - smoothstep(4.2, 14.0, karstDistN);
          vec3 limeDelta = triplanarWorldNormalDelta(uLimeNorm, vTriWorldPos, twN, 0.145);
          worldDelta = mix(worldDelta, limeDelta * 0.90, karstMaskN * 0.92);
        }
        normal = normalize(normal + (viewMatrix * vec4(worldDelta, 0.0)).xyz);
        `
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
        #include <emissivemap_fragment>
        // Act 2: Sweeping NASA/ESA cyan orbital radar wave & razor-thin GIS topographic contours
        if (uRadarSweepAlpha > 0.001) {
          float rd = length(vTriWorldPos.xz - uRadarSweepPos);
          float band = exp(-pow((rd - uRadarSweepRadius) * 0.45, 2.0));
          float iso = smoothstep(0.982, 0.999, abs(sin(vTriWorldPos.y * 2.4)));
          float gridLine = max(
            smoothstep(0.991, 1.0, abs(cos(vTriWorldPos.x * 0.32))),
            smoothstep(0.991, 1.0, abs(cos(vTriWorldPos.z * 0.32)))
          );
          float inTrail = smoothstep(uRadarSweepRadius + 2.0, max(0.0, uRadarSweepRadius - 22.0), rd) * step(rd, uRadarSweepRadius + 1.0);
          totalEmissiveRadiance += vec3(0.0, 0.85, 1.0) * (band * 1.25 + (iso * 0.28 + gridLine * 0.22) * inTrail) * uRadarSweepAlpha;
        }

        // Act 3: Consensus Beacon terrain bounce + shockwave ring
        if (uBeaconStrength > 0.001) {
          float bd = length(vTriWorldPos.xz - uBeaconPos.xz);
          float glow = exp(-bd * 0.22) * uBeaconStrength;
          float ring = exp(-pow((bd - uBeaconRingRadius) * 0.7, 2.0)) * step(0.1, uBeaconRingRadius);
          totalEmissiveRadiance += uBeaconColor * (glow * 0.72 + ring * 2.4);
        }

        // Act 5: Data-gap diagnostic scan grid over NODE #ES-08
        if (uGapScanAlpha > 0.001) {
          float gd = length(vTriWorldPos.xz - uGapNodePos.xz);
          float mask = 1.0 - smoothstep(10.0, 22.0, gd);
          float gx = smoothstep(0.96, 1.0, abs(sin(vTriWorldPos.x * 1.15)));
          float gz = smoothstep(0.96, 1.0, abs(sin(vTriWorldPos.z * 1.15)));
          float sweep = exp(-pow((vTriWorldPos.z - (uGapNodePos.z - 12.0 + uGapScanPhase * 24.0)) * 0.85, 2.0));
          totalEmissiveRadiance += vec3(0.72, 0.16, 1.0) * (max(gx, gz) * 0.42 * mask) * uGapScanAlpha;
          totalEmissiveRadiance += vec3(1.0, 0.84, 0.0) * sweep * mask * 0.58 * uGapScanAlpha;
        }

        // Act 7: Volcanic magma fissure heat glow & drone multispectral laser + hidden Mineral Veins
        if (uFissureGlow > 0.001) {
          float fd = length((vTriWorldPos.xz - uFissurePos.xz) * vec2(1.4, 0.75));
          float fissureCore = (1.0 - smoothstep(1.2, 6.2, fd)) * smoothstep(-1.5, -6.5, vTriWorldPos.y);
          totalEmissiveRadiance += vec3(1.0, 0.22, 0.03) * fissureCore * 2.4 * uFissureGlow;
        }
        if (uScanAlpha > 0.001) {
          float cliffRegion = 1.0 - smoothstep(10.0, 30.0, length(vTriWorldPos.xz - vec2(-68.0, -8.5)));
          float lineD = abs(vTriWorldPos.z - uScanPlaneZ);
          float scanLine = exp(-pow(lineD * 2.4, 2.0));
          float scannedPersist = smoothstep(uScanPlaneZ + 3.5, uScanPlaneZ - 1.5, vTriWorldPos.z) * 0.65 + scanLine;
          vec3 spectral = mix(vec3(0.0, 0.95, 1.0), vec3(0.82, 0.18, 1.0), smoothstep(-2.0, 9.0, vTriWorldPos.y));
          totalEmissiveRadiance += spectral * scanLine * cliffRegion * 2.7 * uScanAlpha;

          // Hidden Fluorescent Mineral Seams (organic jagged crystalline veins: Olivine, Pyroxene, Hematite)
          float w1 = sin(vTriWorldPos.x * 1.35 + cos(vTriWorldPos.y * 1.9) * 1.4) + sin(vTriWorldPos.z * 1.65 - vTriWorldPos.y * 1.2) * 0.85;
          float w2 = cos(vTriWorldPos.z * 2.35 + vTriWorldPos.x * 0.95 + w1 * 1.25);
          float veinBaseA = abs(sin(vTriWorldPos.y * 1.85 + w1 * 1.55 + cos(vTriWorldPos.x * 2.8) * 0.45));
          float veinBaseB = abs(sin(vTriWorldPos.x * 1.55 - vTriWorldPos.z * 1.45 + w2 * 1.65));
          float veinBaseC = abs(cos(vTriWorldPos.y * 2.15 - vTriWorldPos.z * 1.25 + w1 * 1.15 - w2 * 0.65));
          float olivineVein = exp(-pow(veinBaseA * 22.0, 2.0)) * smoothstep(0.1, 0.7, sin(vTriWorldPos.x * 0.42 + vTriWorldPos.z * 0.51) * 0.5 + 0.5);
          float pyroxeneVein = exp(-pow(veinBaseB * 24.0, 2.0)) * smoothstep(0.15, 0.75, cos(vTriWorldPos.y * 0.65 - vTriWorldPos.z * 0.48) * 0.5 + 0.5);
          float hematiteVein = exp(-pow(veinBaseC * 20.0, 2.0)) * smoothstep(0.2, 0.8, sin(vTriWorldPos.z * 0.55 + vTriWorldPos.y * 0.5) * 0.5 + 0.5);
          vec3 mineralGlow =
            vec3(0.22, 1.0, 0.42) * olivineVein * 2.1 +
            vec3(0.0, 0.92, 1.0) * pyroxeneVein * 1.95 +
            vec3(1.0, 0.36, 0.12) * hematiteVein * 1.85;
          float revealBoost = clamp(scanLine * 1.5 + scannedPersist * 0.72, 0.0, 1.6);
          totalEmissiveRadiance += mineralGlow * cliffRegion * revealBoost * smoothstep(-2.5, 4.5, vTriWorldPos.y) * uScanAlpha;
        }
        `
      );
  };

  mat.userData.uniforms = uniforms;
  return mat;
}

/**
 * Volumetric Vertical Survey Beacon Beam Shader (Act 3) with Animated Upward Data-Stream Rings.
 */
export function createBeaconBeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#8E9BAE') },
      uOpacity: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec3 N = normalize(vNormalView);
        vec3 V = normalize(vViewPos);
        float edge = pow(abs(dot(N, V)), 1.45);
        float verticalFade = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
        float pulse = 0.65 + 0.35 * sin(vUv.y * 18.0 - uTime * 9.0);
        // Upward rising telemetry data-stream rings & packet segments
        float ringPhase = fract(vUv.y * 5.0 - uTime * 2.2);
        float streamRing = exp(-pow((ringPhase - 0.5) * 9.5, 2.0));
        float packetMask = 0.55 + 0.45 * step(0.28, fract(vUv.x * 8.0 + uTime * 0.75));
        float intensity = edge * verticalFade * (pulse * 0.85 + streamRing * packetMask * 1.15) * uOpacity;
        vec3 col = uColor * (1.15 + pulse * 0.45) + mix(uColor, vec3(1.0), 0.45) * streamRing * 0.95;
        gl_FragColor = vec4(col, intensity);
      }
    `,
  });
}

/**
 * Hexagonal Cyan Anti-Sybil Energy Dome Shader (Act 4).
 */
export function createHexShieldMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#00F0FF') },
      uOpacity: { value: 0.0 },
      uImpactPulse: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObjPos;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vObjPos = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uImpactPulse;
      varying vec3 vObjPos;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;

      float hexDist(vec2 p) {
        p = abs(p);
        return max(dot(p, normalize(vec2(1.0, 1.73205))), p.x);
      }

      float hexGrid(vec2 uv) {
        vec2 r = vec2(1.0, 1.73205);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        float d = 0.5 - hexDist(gv);
        return smoothstep(0.055, 0.012, d);
      }

      void main() {
        vec2 sphUv = vec2(atan(vObjPos.z, vObjPos.x) * 3.8, vObjPos.y * 9.0);
        float hex = hexGrid(sphUv);
        float scan = smoothstep(0.94, 1.0, sin(vObjPos.y * 14.0 - uTime * 3.8));
        float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), normalize(vViewPos))), 2.5);
        float baseCut = smoothstep(-0.08, 0.14, vObjPos.y);
        float glow = clamp(hex * 0.58 + fresnel * 0.62 + scan * 0.25 + uImpactPulse * 0.22, 0.0, 0.92) * baseCut;
        vec3 col = mix(uColor, vec3(1.0, 0.25, 0.35), uImpactPulse * 0.35);
        gl_FragColor = vec4(col * 1.05, glow * uOpacity * 0.72);
      }
    `,
  });
}

/**
 * Architectural Holographic Geofence Curtain Shader (Act 4).
 * Renders crisp thin horizontal laser rails and subtle vertical ribs so the
 * interior rocky plateau & emerald node beacon remain clearly visible inside.
 */
export function createHolographicFenceMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float rails = max(
          smoothstep(0.86, 0.99, abs(sin(vUv.y * 9.42477))),
          smoothstep(0.94, 1.0, sin(vUv.y * 3.14159))
        );
        float posts = smoothstep(0.92, 0.995, abs(sin(vUv.x * 37.699 + uTime * 0.6)));
        float topRim = smoothstep(0.88, 1.0, vUv.y);
        float botRim = smoothstep(0.12, 0.0, vUv.y);
        float pattern = clamp(rails * 0.65 + posts * 0.45 + topRim * 0.9 + botRim * 0.75 + 0.05, 0.0, 1.0);
        vec3 col = mix(vec3(0.0, 1.0, 0.55), vec3(0.0, 0.94, 1.0), topRim * 0.5);
        gl_FragColor = vec4(col * 1.15, pattern * uOpacity * 0.72);
      }
    `,
  });
}

/**
 * Drone Multispectral Laser Scan Curtain Shader (Act 7).
 */
export function createMultispectralScanMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        // Fan cone narrow at top drone emitter (vUv.y = 1), wide at basalt cliff base (vUv.y = 0)
        float halfWidth = mix(0.49, 0.04, vUv.y);
        float xDist = abs(vUv.x - 0.5);
        float inside = 1.0 - smoothstep(halfWidth - 0.03, halfWidth, xDist);
        float beamEdge = exp(-pow((xDist - halfWidth) * 38.0, 2.0));
        float scanStripes = 0.55 + 0.45 * sin(vUv.y * 42.0 + uTime * 14.0);
        vec3 cyan = vec3(0.0, 0.95, 1.0);
        vec3 magenta = vec3(0.85, 0.16, 1.0);
        vec3 gold = vec3(1.0, 0.84, 0.0);
        vec3 col = mix(magenta, cyan, smoothstep(0.15, 0.85, vUv.x));
        col = mix(col, gold, beamEdge * 0.55);
        float alpha = (inside * 0.42 * scanStripes + beamEdge * 0.85) * smoothstep(0.0, 0.12, vUv.y) * uOpacity;
        gl_FragColor = vec4(col * 1.35, alpha);
      }
    `,
  });
}

/**
 * Custom Final Cinema Post-Processing Shader Pass (Pass #5 of EffectComposer):
 * - Horizontal anamorphic lens flare streaks on specular peaks > 0.85
 * - Dynamic RGB Chromatic Aberration (uAbberation: 0.0006 baseline -> 0.008 whip-pan spike)
 * - Deterministic 35mm Kodak Vision3 500T film grain seeded strictly by uFrame (0.028)
 * - Optical lens vignette
 * - ACES Filmic Tone Mapping + Linear-to-sRGB transfer
 */
export const CinemaPostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uAbberation: { value: 0.0006 },
    uGrainIntensity: { value: 0.028 },
    uVignette: { value: 0.34 },
    uAnamorphic: { value: 0.24 },
    uExposure: { value: 1.12 },
    uFrame: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uAbberation;
    uniform float uGrainIntensity;
    uniform float uVignette;
    uniform float uAnamorphic;
    uniform float uExposure;
    uniform float uFrame;
    varying vec2 vUv;

    float hashGrain(vec2 p, float f) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031 + f * 0.0137);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z) - 0.5;
    }

    vec3 acesFilmic(vec3 x) {
      x *= 0.6;
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    vec3 linearToSrgb(vec3 c) {
      vec3 lo = c * 12.92;
      vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
      return mix(lo, hi, step(vec3(0.0031308), c));
    }

    void main() {
      vec2 center = vUv - 0.5;
      float radial = length(center);
      vec2 shiftDir = normalize(center + vec2(0.0001, 0.0001)) * uAbberation * (0.45 + radial * 1.35);

      float r = texture2D(tDiffuse, clamp(vUv + shiftDir, 0.001, 0.999)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, clamp(vUv - shiftDir, 0.001, 0.999)).b;
      vec3 col = vec3(r, g, b);

      // Horizontal anamorphic lens flare streaks on specular peaks > 0.85
      vec3 streak = vec3(0.0);
      float texelX = 1.0 / uResolution.x;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = exp(-abs(fi) * 0.34);
        vec3 s = texture2D(tDiffuse, clamp(vUv + vec2(fi * texelX * 14.0, 0.0), 0.001, 0.999)).rgb;
        float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
        vec3 hi = max(s - vec3(0.85), vec3(0.0)) * smoothstep(0.85, 1.38, lum);
        streak += hi * w;
      }
      col += streak * vec3(0.32, 0.88, 1.0) * (uAnamorphic * 0.088);

      // ACES Filmic Tone Mapping + Linear-to-sRGB calibration
      col = acesFilmic(col * uExposure);
      col = linearToSrgb(col);

      // Optical anamorphic lens vignette
      float vig = 1.0 - smoothstep(0.38, 0.96, radial) * uVignette;
      col *= vig;

      // Deterministic 35mm Kodak Vision3 500T film grain weighted to luminance midtones
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float grainMask = smoothstep(0.03, 0.22, luma) * (1.0 - smoothstep(0.75, 1.0, luma) * 0.6);
      float grain = hashGrain(gl_FragCoord.xy, uFrame);
      col += vec3(grain * uGrainIntensity * grainMask);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
