// Visor 3D de la flota robótica (página flota.html).
// Los modelos se construyen por código con Three.js: no hay archivos 3D externos.
// Los textos vienen de window.FLOTA (en template.html) para que el build los traduzca.
// build.mjs empaqueta este archivo con esbuild y lo incluye solo en flota.html.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const TXT = window.FLOTA;
const root = document.getElementById('flota3d');
if (root && TXT) {
  const ok = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (!ok) root.querySelector('.visor-load').textContent = TXT.ui.sinWebgl;
  else (document.fonts && document.fonts.load ? document.fonts.load('600 80px "Chakra Petch"').catch(() => {}) : Promise.resolve()).then(init);
}

// ------------------------------------------------------------------ utilidades
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261115);

function tex(w, h, draw, { color = true, rep = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const FONT = '"Chakra Petch", "Segoe UI", system-ui, sans-serif';

// Malla con sombras
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
// Cilindro entre dos puntos
function strut(a, b, r, mat, seg = 12) {
  const d = b.clone().sub(a), L = d.length();
  const m = mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return m;
}
// Viga de sección rectangular redondeada entre dos puntos (eje largo = X local)
function beam(a, b, w, h, mat, up = V(0, 1, 0)) {
  const d = b.clone().sub(a), L = d.length();
  const m = mesh(new RoundedBoxGeometry(L, h, w, 3, Math.min(w, h) * 0.35), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  const x = d.clone().normalize(), z = x.clone().cross(up).normalize(), y = z.clone().cross(x);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return m;
}
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ------------------------------------------------------------------ texturas
function makeTextures() {
  const T = {};
  // Relieve de paneles: juntas hundidas y remaches
  T.panel = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const v = 120 + R() * 16 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * w, R() * h, 2, 2); }
    g.strokeStyle = '#303030'; g.lineWidth = 3;
    const xs = [0.16, 0.5, 0.84], ys = [0.28, 0.72];
    xs.forEach((x) => { g.beginPath(); g.moveTo(x * w, 0); g.lineTo(x * w, h); g.stroke(); });
    ys.forEach((y) => { g.beginPath(); g.moveTo(0, y * h); g.lineTo(w, y * h); g.stroke(); });
    g.fillStyle = '#c4c4c4';
    for (const x of xs) for (let y = 0.06; y < 1; y += 0.1) { g.beginPath(); g.arc(x * w + 10, y * h, 3.4, 0, 7); g.fill(); }
  }, { color: false });
  // Rugosidad con desgaste suave
  T.grime = tex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(105,105,105)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const v = 90 + R() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v},.18)`; g.beginPath(); g.arc(R() * w, R() * h, 4 + R() * 40, 0, 7); g.fill(); }
    for (let i = 0; i < 6000; i++) { const v = 95 + R() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * w, R() * h, 1.5, 1.5); }
  }, { color: false });
  // Fibra de carbono (sarga 2x2)
  T.carbon = tex(128, 128, (g, w) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const hor = (i + j) % 4 < 2;
      const gr = hor ? g.createLinearGradient(0, j * s, 0, j * s + s) : g.createLinearGradient(i * s, 0, i * s + s, 0);
      gr.addColorStop(0, '#0d0e10'); gr.addColorStop(0.5, '#3b3e44'); gr.addColorStop(1, '#0d0e10');
      g.fillStyle = gr; g.fillRect(i * s, j * s, s, s);
    }
  }, { rep: [1, 6] });
  // Franjas de peligro
  T.hazard = tex(256, 64, (g, w, h) => {
    g.fillStyle = '#1b1b1d'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9b313';
    for (let x = -h; x < w + h; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  }, { rep: [2, 1] });
  // Lámina dorada arrugada (aislamiento multicapa)
  T.foil = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 70 + R() * 120 | 0; g.strokeStyle = `rgba(${v},${v},${v},.5)`; g.lineWidth = 1 + R() * 2;
      const x = R() * w, y = R() * h, a = R() * 6.3, l = 6 + R() * 30;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, { color: false, rep: [2, 2] });
  // Cuerda de rápel enrollada
  T.rope = tex(64, 256, (g, w, h) => {
    g.fillStyle = '#d4572a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { g.fillStyle = '#8f3416'; g.fillRect(0, y, w, 2); g.fillStyle = '#f08a5d'; g.fillRect(0, y + 3, w, 1); }
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(w * 0.3, y + 4, 6, 2); }
  }, { rep: [1, 4] });
  // Plataforma de aterrizaje
  T.pad = tex(512, 512, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#2a2f37'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.04})`; g.fillRect(R() * w, R() * w, 2, 2); }
    g.strokeStyle = '#d8612c'; g.lineWidth = 20; g.beginPath(); g.arc(c, c, 196, 0, 7); g.stroke();
    g.strokeStyle = '#e8e4dc'; g.lineWidth = 5; g.beginPath(); g.arc(c, c, 150, 0, 7); g.stroke();
    g.setLineDash([22, 14]); g.beginPath(); g.moveTo(c, 40); g.lineTo(c, w - 40); g.moveTo(40, c); g.lineTo(w - 40, c); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#e8e4dc'; g.font = `600 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('C1', c, c);
    g.font = `500 22px ${FONT}`; g.fillText('DOCK · MSU-D01', c, w - 22);
    g.fillStyle = '#e9b313';
    for (const [x, y, r] of [[30, 30, 0], [w - 30, 30, 1], [w - 30, w - 30, 2], [30, w - 30, 3]]) {
      g.save(); g.translate(x, y); g.rotate(r * Math.PI / 2); g.beginPath(); g.moveTo(-12, -12); g.lineTo(26, -12); g.lineTo(26, -2); g.lineTo(-2, -2); g.lineTo(-2, 26); g.lineTo(-12, 26); g.fill(); g.restore();
    }
  });
  // Suelo volcánico (basalto con picón)
  T.ground = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#5b5049'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const k = R(); g.fillStyle = k < 0.5 ? `rgba(30,24,22,${0.05 + R() * 0.09})` : `rgba(150,120,98,${0.04 + R() * 0.07})`;
      g.beginPath(); g.ellipse(R() * w, R() * h, 6 + R() * 70, 4 + R() * 40, R() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 26000; i++) { const v = R(); g.fillStyle = v < 0.5 ? 'rgba(25,20,18,.55)' : (v < 0.85 ? 'rgba(120,95,80,.5)' : 'rgba(160,82,52,.45)'); const s = 1 + R() * 2.6; g.fillRect(R() * w, R() * h, s, s); }
    for (let i = 0; i < 900; i++) {
      const x = R() * w, y = R() * h, r = 1.5 + R() * 4;
      g.fillStyle = 'rgba(20,16,14,.7)'; g.beginPath(); g.arc(x + 1, y + 1.4, r, 0, 7); g.fill();
      g.fillStyle = R() < 0.3 ? '#7a4a34' : '#4a403b'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,240,220,.18)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.4, 0, 7); g.fill();
    }
  }, { rep: [3, 3] });
  T.groundAlpha = tex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, { color: false });
  // Disco de giro de las hélices
  T.blur = tex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, w * 0.08, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.2, 'rgba(255,255,255,.55)'); gr.addColorStop(0.85, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  return T;
}

// Pegatina: texto sobre fondo transparente
function decalTex(lines, w = 512, h = 128) {
  return tex(w, h, (g) => {
    g.textBaseline = 'middle';
    for (const l of lines) { g.fillStyle = l.c || '#1a1d23'; g.font = `${l.wt || 600} ${l.s}px ${FONT}`; g.textAlign = l.a || 'left'; if (l.ls) g.letterSpacing = l.ls; g.fillText(l.t, l.x, l.y); }
    for (const l of lines) if (l.bar) { g.fillStyle = l.bar; g.fillRect(...l.r); }
  });
}
function decal(texture, w, h, mat = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, ...mat }));
  m.receiveShadow = true; return m;
}

// ------------------------------------------------------------------ materiales
function makeMaterials(T) {
  const phys = (o) => new THREE.MeshPhysicalMaterial(o), std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    paint: phys({ color: 0xe6e2da, roughness: 1, roughnessMap: T.grime, bumpMap: T.panel, bumpScale: 1.4, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    paintPlain: phys({ color: 0xe6e2da, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    orange: phys({ color: 0xd65d29, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    dark: std({ color: 0x2b2f36, roughness: 0.42, metalness: 0.75 }),
    darkMatte: std({ color: 0x24272c, roughness: 0.78, metalness: 0.15 }),
    alu: std({ color: 0xc4c8cd, roughness: 0.26, metalness: 1 }),
    aluDark: std({ color: 0x6d737b, roughness: 0.35, metalness: 1 }),
    copper: std({ color: 0xb8733e, roughness: 0.3, metalness: 1 }),
    carbon: phys({ map: T.carbon, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 }),
    rubber: std({ color: 0x18191b, roughness: 0.93 }),
    glass: phys({ color: 0x04060a, roughness: 0.03, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0 }),
    lens: phys({ color: 0x0b1726, roughness: 0.04, metalness: 0.85, emissive: 0x0d2f52, emissiveIntensity: 0.55, clearcoat: 1 }),
    gold: std({ color: 0xd8ab4c, roughness: 0.3, metalness: 1, bumpMap: T.foil, bumpScale: 3 }),
    hazard: std({ map: T.hazard, roughness: 0.6 }),
    pad: std({ map: T.pad, roughness: 0.75, metalness: 0.2 }),
    rope: std({ map: T.rope, roughness: 0.85 }),
    ropeLine: std({ color: 0xd4572a, roughness: 0.8 }),
    rock: std({ color: 0x4f4641, roughness: 0.95, bumpMap: T.grime, bumpScale: 6 }),
    ledW: std({ color: 0x111111, emissive: 0xfff4e0, emissiveIntensity: 4 }),
    ledR: std({ color: 0x220000, emissive: 0xff2a2a, emissiveIntensity: 4 }),
    ledG: std({ color: 0x002200, emissive: 0x2dff7a, emissiveIntensity: 4 }),
    ledO: std({ color: 0x221100, emissive: 0xff8a3d, emissiveIntensity: 3 }),
    ledB: std({ color: 0x001122, emissive: 0x4fc3ff, emissiveIntensity: 2.5 }),
  };
}

// Hélice: pala extruida con torsión (más ángulo en la raíz que en la punta)
function bladeGeo(len, rootW, tipW, thick, rootPitch, tipPitch) {
  const s = new THREE.Shape();
  s.moveTo(0, -rootW * 0.45);
  s.bezierCurveTo(len * 0.35, -rootW * 0.62, len * 0.78, -tipW * 0.6, len, -tipW * 0.15);
  s.quadraticCurveTo(len * 1.03, tipW * 0.35, len * 0.94, tipW * 0.5);
  s.bezierCurveTo(len * 0.7, tipW * 0.75, len * 0.3, rootW * 0.62, 0, rootW * 0.45);
  s.lineTo(0, -rootW * 0.45);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.45, bevelSize: thick * 0.45, bevelSegments: 2, curveSegments: 18 });
  g.translate(0, 0, -thick / 2); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = tipPitch + (rootPitch - tipPitch) * (1 - Math.min(1, Math.max(0, x / len)));
    p.setY(i, y * Math.cos(a) - z * Math.sin(a)); p.setZ(i, y * Math.sin(a) + z * Math.cos(a));
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ DRON CÉFIRO
function buildDrone(M, T) {
  const d = new THREE.Group(); d.name = 'dron';
  const parts = {}, hot = [];
  const P = (id, ex = [0, 0, 0]) => { const g = new THREE.Group(); g.userData.part = id; g.userData.explode = V(...ex); (parts[id] ||= []).push(g); d.add(g); return g; };
  const H = (id, g, pos, dir, dist) => { const a = new THREE.Object3D(); a.position.set(...pos); g.add(a); hot.push({ id, a, dir: V(...dir).normalize(), dist }); };
  const anim = { props: [], blur: [], lidar: null, probe: null, tether: null, strobe: null, L: 0.42 };

  // Fuselaje: perfil de revolución alargado, con la librea pintada en la textura
  const livery = tex(2048, 512, (g, w, h) => {
    g.fillStyle = '#e6e2da'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.035})`; g.fillRect(R() * w, R() * h, 2, 2); }
    g.fillStyle = '#d65d29'; g.fillRect(0, h * 0.535, w, h * 0.03);
    g.strokeStyle = 'rgba(40,40,40,.45)'; g.lineWidth = 2;
    for (const u of [0.08, 0.42, 0.58, 0.92]) { g.beginPath(); g.moveTo(u * w, h * 0.12); g.lineTo(u * w, h * 0.5); g.stroke(); }
    g.beginPath(); g.moveTo(0, h * 0.2); g.lineTo(w, h * 0.2); g.stroke();
    g.textBaseline = 'middle'; g.textAlign = 'center';
    for (const u of [0.25, 0.75]) {
      g.save(); g.translate(u * w, h * 0.43); g.scale(0.72, 1);
      g.fillStyle = '#1a1d23'; g.font = `600 64px ${FONT}`; g.fillText('CÉFIRO', 0, 0);
      g.font = `500 30px ${FONT}`; g.fillStyle = '#555c68'; g.fillText('MSU-D01 · MoonSiteUA', 0, -50);
      g.restore();
    }
  });
  const prof = [[0, -0.056], [0.09, -0.058], [0.135, -0.046], [0.153, -0.022], [0.158, 0], [0.151, 0.024], [0.124, 0.047], [0.075, 0.061], [0, 0.066]].map(([x, y]) => new THREE.Vector2(x, y));
  const shellMat = new THREE.MeshPhysicalMaterial({ map: livery, roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  const body = new THREE.Group(); d.add(body);
  const shell = mesh(new THREE.LatheGeometry(prof, 72), shellMat); shell.scale.set(1, 1, 1.25); body.add(shell);
  const band = mesh(new THREE.TorusGeometry(0.152, 0.007, 12, 72).rotateX(Math.PI / 2), M.dark, 0, -0.026, 0); band.scale.set(1, 1, 1.25); body.add(band);
  // Visor frontal y foco
  const visor = mesh(new RoundedBoxGeometry(0.11, 0.032, 0.03, 3, 0.012), M.glass, 0, 0.012, 0.183); visor.rotation.x = -0.25; body.add(visor);
  body.add(mesh(new RoundedBoxGeometry(0.07, 0.009, 0.012, 2, 0.004), M.ledW, 0, -0.03, 0.186));
  // Antenas traseras
  for (const s of [-1, 1]) {
    body.add(strut(V(s * 0.06, 0.035, -0.14), V(s * 0.075, 0.1, -0.18), 0.0028, M.darkMatte, 8));
    body.add(mesh(new THREE.SphereGeometry(0.006, 10, 8), M.darkMatte, s * 0.075, 0.1, -0.18));
  }
  // Baliza anticolisión
  anim.strobe = mesh(new THREE.SphereGeometry(0.009, 12, 8, 0, 6.3, 0, 1.6), M.ledW.clone(), 0, 0.058, -0.12); body.add(anim.strobe);

  // LiDAR 360
  const lid = P('lidar', [0, 0.16, 0]);
  lid.add(mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.022, 40), M.dark, 0, 0.072, 0));
  const head = new THREE.Group(); head.position.y = 0.083; lid.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.042, 48), M.darkMatte, 0, 0.021, 0));
  head.add(mesh(new THREE.CylinderGeometry(0.0468, 0.0468, 0.016, 48, 1, true), M.glass, 0, 0.02, 0));
  head.add(mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.009, 48), M.dark, 0, 0.046, 0));
  head.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 24), M.alu, 0, 0.052, 0));
  head.add(mesh(new THREE.BoxGeometry(0.01, 0.006, 0.003), M.ledB, 0, 0.02, 0.0472));
  anim.lidar = head;
  H('lidar', lid, [0, 0.14, 0], [0.4, 1, 0.8], 0.75);

  // Brazos plegables y rotores carenados
  const Ri = 0.106, Ro = 0.12;
  const ductProf = [[Ri, -0.03], [Ri, 0.012], [Ri + 0.001, 0.02], [Ri + 0.004, 0.026], [Ri + 0.009, 0.03], [Ri + 0.014, 0.029], [Ro, 0.022], [Ro, -0.022], [Ro - 0.004, -0.029], [Ri + 0.005, -0.031], [Ri, -0.03]].map(([x, y]) => new THREE.Vector2(x, y));
  const ductGeo = new THREE.LatheGeometry(ductProf, 72);
  const grille = mergeGeometries([
    ...[0.034, 0.064, 0.094].map((r) => new THREE.TorusGeometry(r, 0.0017, 6, 56).rotateX(Math.PI / 2)),
    ...Array.from({ length: 8 }, (_, i) => new THREE.CylinderGeometry(0.0016, 0.0016, Ri, 6).rotateZ(Math.PI / 2).translate(Ri / 2, 0, 0).rotateY(i * Math.PI / 4)),
  ]);
  const blade = bladeGeo(0.08, 0.026, 0.015, 0.0028, 0.5, 0.16);
  const stator = mergeGeometries(Array.from({ length: 3 }, (_, i) => new THREE.BoxGeometry(Ri - 0.024, 0.005, 0.012).translate((Ri + 0.024) / 2, 0, 0).rotateY(i * Math.PI * 2 / 3 + 0.5)));
  const motorR = 0.29;
  [45, 135, 225, 315].forEach((deg, k) => {
    const a = deg * Math.PI / 180, dx = Math.sin(a), dz = Math.cos(a);
    const front = dz > 0, left = dx > 0; // el dron mira a +z; su izquierda es +x
    // brazo
    const arm = P('brazos', [dx * 0.05, 0, dz * 0.05]);
    const a0 = V(dx * 0.12, -0.004, dz * 0.12), a1 = V(dx * (motorR - 0.02), 0.012, dz * (motorR - 0.02));
    arm.add(strut(a0, a1, 0.015, M.carbon, 18));
    arm.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.042, 24), M.dark, dx * 0.165, 0.0, dz * 0.165));
    arm.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.046, 16), M.alu, dx * 0.165, 0.0, dz * 0.165));
    arm.add(mesh(new THREE.TorusGeometry(0.0245, 0.003, 8, 24).rotateX(Math.PI / 2), M.orange, dx * 0.165, 0.012, dz * 0.165));
    if (k === 0) H('brazos', arm, [dx * 0.165, 0.03, dz * 0.165], [0.9, 0.8, 0.5], 0.6);
    // carenado con motor, hélice y rejilla
    const rot = P('rotores', [dx * 0.14, 0.02, dz * 0.14]);
    const duct = new THREE.Group(); duct.position.set(dx * motorR, 0.02, dz * motorR); rot.add(duct);
    duct.add(mesh(ductGeo, M.darkMatte));
    duct.add(mesh(new THREE.TorusGeometry(Ri + 0.009, 0.0035, 8, 72).rotateX(Math.PI / 2), M.orange, 0, 0.03, 0));
    duct.add(mesh(grille, M.aluDark, 0, 0.034, 0));
    duct.add(mesh(stator, M.dark, 0, -0.016, 0));
    duct.add(mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.034, 28), M.dark, 0, -0.004, 0));
    duct.add(mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.006, 28), M.alu, 0, 0.016, 0));
    // arco que une el brazo al anillo
    duct.add(mesh(new RoundedBoxGeometry(0.03, 0.02, 0.03, 2, 0.006), M.dark, -dx * (Ri + 0.006), -0.008, -dz * (Ri + 0.006)));
    const prop = new THREE.Group(); prop.position.y = 0.02; duct.add(prop);
    for (let i = 0; i < 3; i++) { const b = mesh(blade, M.carbon); b.position.x = 0.0; b.rotation.y = i * Math.PI * 2 / 3; const piv = new THREE.Group(); piv.add(b); b.position.x = 0.016; piv.rotation.y = i * Math.PI * 2 / 3; b.rotation.y = 0; prop.add(piv); }
    prop.add(mesh(new THREE.SphereGeometry(0.017, 20, 10, 0, 6.3, 0, 1.6), M.alu));
    const dir = (k % 2 ? 1 : -1);
    anim.props.push({ g: prop, dir });
    const blur = new THREE.Mesh(new THREE.CircleGeometry(Ri - 0.002, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: T.blur, color: 0x8a919c, transparent: true, opacity: 0, depthWrite: false }));
    blur.position.y = 0.021; duct.add(blur); anim.blur.push(blur);
    // luces de navegación: roja a babor (izquierda), verde a estribor; blancas detrás
    const led = front ? (left ? M.ledR : M.ledG) : M.ledW;
    duct.add(mesh(new THREE.SphereGeometry(0.007, 12, 8), led, dx * (Ro + 0.002), 0.0, dz * (Ro + 0.002)));
    if (k === 0) H('rotores', rot, [dx * motorR, 0.06, dz * motorR], [0.6, 1, 0.9], 0.7);
  });

  // Góndola multiespectral y térmica
  const cam = P('camara', [0, -0.07, 0.1]);
  const gim = new THREE.Group(); gim.position.set(0, -0.058, 0.125); cam.add(gim);
  gim.add(mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.014, 28), M.dark, 0, 0, 0));
  gim.add(mesh(new RoundedBoxGeometry(0.112, 0.01, 0.028, 2, 0.004), M.dark, 0, -0.012, 0));
  for (const s of [-1, 1]) gim.add(mesh(new RoundedBoxGeometry(0.009, 0.06, 0.03, 2, 0.004), M.dark, s * 0.052, -0.042, 0));
  const ball = new THREE.Group(); ball.position.y = -0.055; gim.add(ball);
  ball.add(mesh(new THREE.SphereGeometry(0.043, 40, 28), M.paintPlain));
  for (const s of [-1, 1]) ball.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 20).rotateZ(Math.PI / 2), M.alu, s * 0.046, 0, 0));
  const lensAt = (x, y, r, depth = 0.012) => {
    const L = new THREE.Group(); L.position.set(x, y, Math.sqrt(Math.max(0, 0.043 ** 2 - x * x - y * y)) - 0.004);
    L.add(mesh(new THREE.CylinderGeometry(r + 0.003, r + 0.003, depth, 24).rotateX(Math.PI / 2), M.dark, 0, 0, depth / 2));
    L.add(mesh(new THREE.CylinderGeometry(r, r, 0.002, 24).rotateX(Math.PI / 2), M.lens, 0, 0, depth + 0.001));
    ball.add(L);
  };
  lensAt(0.014, 0.004, 0.012, 0.014);
  for (const [x, y] of [[-0.012, 0.013], [-0.024, 0.013], [-0.012, 0.0], [-0.024, 0.0], [-0.018, -0.013]]) lensAt(x, y, 0.0045, 0.008);
  ball.rotation.x = 0.35;
  H('camara', cam, [0, -0.11, 0.17], [0.3, -0.2, 1], 0.55);

  // Patas de posado con garras
  const legs = P('patas', [0, -0.08, 0]);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const a = V(sx * 0.085, -0.045, sz * 0.1), k1 = V(sx * 0.125, -0.15, sz * 0.14), f = V(sx * 0.135, -0.235, sz * 0.15);
    legs.add(mesh(new THREE.SphereGeometry(0.012, 14, 10), M.dark, a.x, a.y, a.z));
    legs.add(strut(a, k1, 0.0075, M.carbon, 12));
    legs.add(mesh(new THREE.SphereGeometry(0.011, 14, 10), M.alu, k1.x, k1.y, k1.z));
    legs.add(strut(k1, f, 0.0065, M.aluDark, 12));
    legs.add(mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.014, 16), M.dark, f.x, f.y - 0.004, f.z));
    for (let i = 0; i < 3; i++) {
      const ang = i * Math.PI * 2 / 3 + (sx > 0 ? 0 : Math.PI / 3);
      const ox = Math.cos(ang), oz = Math.sin(ang);
      const curve = new THREE.QuadraticBezierCurve3(V(f.x + ox * 0.008, f.y - 0.008, f.z + oz * 0.008), V(f.x + ox * 0.03, f.y - 0.014, f.z + oz * 0.03), V(f.x + ox * 0.022, f.y - 0.03, f.z + oz * 0.022));
      legs.add(mesh(new THREE.TubeGeometry(curve, 10, 0.0032, 6), M.darkMatte));
      legs.add(mesh(new THREE.SphereGeometry(0.0034, 8, 6), M.orange, f.x + ox * 0.022, f.y - 0.03, f.z + oz * 0.022));
    }
  }
  H('patas', legs, [0.135, -0.24, 0.15], [1, -0.1, 0.8], 0.55);

  // Sonda colgante con cabrestante
  const son = P('sonda', [0, -0.22, 0]);
  son.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.075, 24).rotateZ(Math.PI / 2), M.dark, 0, -0.07, -0.02));
  son.add(mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.08, 24).rotateZ(Math.PI / 2), M.alu, 0, -0.07, -0.02));
  for (const s of [-1, 1]) son.add(mesh(new RoundedBoxGeometry(0.008, 0.03, 0.05, 2, 0.003), M.dark, s * 0.044, -0.062, -0.02));
  const piv = new THREE.Group(); piv.position.set(0, -0.092, -0.02); son.add(piv);
  const tether = mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6).translate(0, -0.5, 0), M.ropeLine); piv.add(tether);
  const probe = new THREE.Group(); piv.add(probe);
  probe.add(mesh(new THREE.TorusGeometry(0.007, 0.002, 8, 16), M.alu, 0, -0.006, 0));
  probe.add(mesh(new THREE.CapsuleGeometry(0.022, 0.07, 8, 24), M.orange, 0, -0.06, 0));
  probe.add(mesh(new THREE.CylinderGeometry(0.0228, 0.0228, 0.018, 28), M.gold, 0, -0.05, 0));
  for (let i = 0; i < 6; i++) { const s = mesh(new RoundedBoxGeometry(0.004, 0.022, 0.004, 1, 0.0015), M.darkMatte); const a = i * Math.PI / 3; s.position.set(Math.cos(a) * 0.0222, -0.078, Math.sin(a) * 0.0222); probe.add(s); }
  probe.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), M.ledW, 0, -0.104, 0));
  anim.probe = probe; anim.tether = tether; anim.piv = piv;
  H('sonda', probe, [0, -0.06, 0.024], [0.6, 0.1, 1], 0.5);

  // Batería intercambiable
  const bat = P('bateria', [0, 0.0, -0.16]);
  bat.add(mesh(new RoundedBoxGeometry(0.12, 0.044, 0.08, 3, 0.008), M.darkMatte, 0, 0.0, -0.18));
  bat.add(mesh(new RoundedBoxGeometry(0.05, 0.012, 0.012, 2, 0.004), M.orange, 0, 0.002, -0.224));
  for (let i = 0; i < 4; i++) bat.add(mesh(new THREE.BoxGeometry(0.008, 0.003, 0.004), i < 3 ? M.ledG : M.darkMatte, -0.02 + i * 0.013, 0.0235, -0.2));
  const bl = decal(decalTex([{ t: 'Li-ion 22 Ah · 6S', s: 40, x: 256, y: 64, a: 'center', c: '#d7d9de', wt: 500 }]), 0.09, 0.022); bl.position.set(0, -0.012, -0.2205); bl.rotation.y = Math.PI; bat.add(bl);
  H('bateria', bat, [0, 0.01, -0.225], [0.2, 0.4, -1], 0.5);

  d.userData = { parts, hot, anim };
  return d;
}

// ------------------------------------------------------------------ ROBOT TALPA
function buildRobot(M, T) {
  const r = new THREE.Group(); r.name = 'robot';
  const parts = {}, hot = [];
  const P = (id, ex = [0, 0, 0]) => { const g = new THREE.Group(); g.userData.part = id; g.userData.explode = V(...ex); (parts[id] ||= []).push(g); r.add(g); return g; };
  const H = (id, g, pos, dir, dist) => { const a = new THREE.Object3D(); a.position.set(...pos); g.add(a); hot.push({ id, a, dir: V(...dir).normalize(), dist }); };
  const anim = { head: null, padLeds: [], beacons: [] };
  const Y = 0.55; // altura del centro del chasis

  // Chasis: dos módulos y cintura de fuelle
  const ch = P('chasis');
  const front = mesh(new RoundedBoxGeometry(0.56, 0.24, 0.5, 4, 0.045), M.paint, 0, Y, 0.3); ch.add(front);
  const rear = mesh(new RoundedBoxGeometry(0.56, 0.24, 0.57, 4, 0.045), M.paint, 0, Y, -0.335); ch.add(rear);
  ch.add(mesh(new RoundedBoxGeometry(0.5, 0.03, 0.46, 2, 0.01), M.darkMatte, 0, Y - 0.125, 0.3));
  ch.add(mesh(new RoundedBoxGeometry(0.5, 0.03, 0.52, 2, 0.01), M.darkMatte, 0, Y - 0.125, -0.335));
  ch.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 28).rotateX(Math.PI / 2), M.dark, 0, Y, 0));
  for (let i = 0; i < 5; i++) ch.add(mesh(new THREE.TorusGeometry(0.1, 0.018, 12, 36), M.rubber, 0, Y, -0.04 + i * 0.02));
  // franjas naranjas a lo largo
  for (const s of [-1, 1]) {
    ch.add(mesh(new THREE.BoxGeometry(0.004, 0.018, 0.4), M.orange, s * 0.2805, Y + 0.08, 0.3));
    ch.add(mesh(new THREE.BoxGeometry(0.004, 0.018, 0.47), M.orange, s * 0.2805, Y + 0.08, -0.335));
  }
  // radiadores laterales
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) ch.add(mesh(new THREE.BoxGeometry(0.014, 0.1, 0.008), M.dark, s * 0.285, Y - 0.02, 0.1 + i * 0.022));
  // compartimento de instrumentos con aislamiento dorado
  ch.add(mesh(new RoundedBoxGeometry(0.24, 0.045, 0.28, 3, 0.012), M.gold, 0.11, Y + 0.14, 0.27));
  // parachoques, faros y tira de luz
  ch.add(mesh(new RoundedBoxGeometry(0.52, 0.06, 0.05, 3, 0.012), M.hazard, 0, Y - 0.1, 0.56));
  for (const s of [-1, 1]) {
    ch.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 28).rotateX(Math.PI / 2), M.dark, s * 0.19, Y - 0.03, 0.55));
    ch.add(mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.022, 28).rotateX(Math.PI / 2), M.ledW, s * 0.19, Y - 0.03, 0.553));
  }
  ch.add(mesh(new RoundedBoxGeometry(0.2, 0.012, 0.01, 2, 0.004), M.ledO, 0, Y - 0.03, 0.552));
  // rotulación
  const name = decalTex([{ t: 'TALPA', s: 92, x: 18, y: 58, ls: '6px' }, { t: 'MSU-R01 · MoonSiteUA', s: 26, x: 22, y: 112, c: '#555c68', wt: 500 }], 512, 128);
  for (const s of [-1, 1]) {
    const dcl = decal(name, 0.3, 0.075); dcl.position.set(s * 0.2812, Y + 0.0, -0.3); dcl.rotation.y = s * Math.PI / 2; ch.add(dcl);
  }
  const bandera = decalTex([{ t: 'UA · NASA SPACE APPS 2026', s: 30, x: 256, y: 64, a: 'center', c: '#555c68', wt: 500 }], 512, 128);
  for (const s of [-1, 1]) { const dcl = decal(bandera, 0.2, 0.05); dcl.position.set(s * 0.2812, Y + 0.035, 0.36); dcl.rotation.y = s * Math.PI / 2; ch.add(dcl); }
  // antena de látigo
  ch.add(mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.04, 16), M.dark, -0.235, Y + 0.14, 0.1));
  ch.add(mesh(new THREE.CylinderGeometry(0.0035, 0.005, 0.5, 8), M.darkMatte, -0.235, Y + 0.41, 0.1));
  ch.add(mesh(new THREE.SphereGeometry(0.008, 10, 8), M.orange, -0.235, Y + 0.66, 0.1));
  H('chasis', ch, [0.12, Y + 0.02, 0], [1, 0.5, 0.25], 1.2);

  // Seis patas con rueda
  const tireProf = [[0.07, -0.04], [0.088, -0.042], [0.1, -0.039], [0.106, -0.03], [0.108, 0], [0.106, 0.03], [0.1, 0.039], [0.088, 0.042], [0.07, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
  const lugs = [];
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2;
    for (const s of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.014, 0.038, 0.016);
      b.rotateZ(s * 0.42); b.translate(0, s * 0.019, 0.11); // (y = eje de la rueda)
      b.rotateY(a); lugs.push(b);
    }
  }
  // Rueda montada con el eje en Y y luego girada para que el eje quede en X
  const tireGeo = mergeGeometries([new THREE.LatheGeometry(tireProf, 64).toNonIndexed(), ...lugs.map((g) => g.toNonIndexed())]).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.07, 36, 1, true).rotateZ(Math.PI / 2);
  const hubGeo = mergeGeometries([new THREE.CylinderGeometry(0.032, 0.032, 0.05, 24), ...Array.from({ length: 5 }, (_, i) => new THREE.BoxGeometry(0.014, 0.01, 0.07).translate(0, 0, 0.035).rotateY(i * Math.PI * 2 / 5))]).rotateZ(Math.PI / 2);
  const legZ = [0.42, -0.15, -0.52];
  legZ.forEach((z, li) => [-1, 1].forEach((s) => {
    const g = P('patas', [s * 0.2, 0, 0]);
    g.position.set(0, 0, 0);
    const hip = V(s * 0.28, Y - 0.02, z);
    g.add(mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.06, 28).rotateZ(Math.PI / 2), M.dark, hip.x + s * 0.03, hip.y, hip.z));
    g.add(mesh(new THREE.TorusGeometry(0.056, 0.006, 8, 28).rotateY(Math.PI / 2), M.orange, hip.x + s * 0.062, hip.y, hip.z));
    const knee = V(s * 0.47, Y + 0.12, z + (li === 0 ? 0.05 : li === 2 ? -0.05 : 0));
    const axle = V(s * 0.53, 0.12, z + (li === 0 ? 0.09 : li === 2 ? -0.09 : 0));
    g.add(beam(V(hip.x + s * 0.06, hip.y, hip.z), knee, 0.07, 0.085, M.paint));
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 24).rotateX(Math.PI / 2), M.dark, knee.x, knee.y, knee.z));
    for (const e of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 24).rotateX(Math.PI / 2), M.orange, knee.x, knee.y, knee.z + e * 0.047));
    g.add(beam(knee, axle, 0.06, 0.07, M.paint, V(0, 0, 1)));
    // cable flexible del motor de la rueda
    const cab = new THREE.CatmullRomCurve3([V(hip.x + s * 0.05, hip.y - 0.04, hip.z - 0.03), V(knee.x - s * 0.02, knee.y - 0.06, knee.z - 0.05), V(axle.x - s * 0.02, axle.y + 0.08, axle.z - 0.04)]);
    g.add(mesh(new THREE.TubeGeometry(cab, 24, 0.0055, 6), M.darkMatte));
    const wheel = new THREE.Group(); wheel.position.copy(axle).add(V(s * 0.06, 0, 0)); g.add(wheel);
    wheel.add(mesh(tireGeo, M.rubber));
    wheel.add(mesh(rimGeo, M.alu));
    wheel.add(mesh(hubGeo, M.aluDark));
    wheel.add(mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.026, 24).rotateZ(Math.PI / 2), M.orange, s * 0.038, 0, 0));
    wheel.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.016, 24).rotateZ(Math.PI / 2), M.dark, -s * 0.04, 0, 0));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; wheel.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8).rotateZ(Math.PI / 2), M.alu, s * 0.052, Math.cos(a) * 0.022, Math.sin(a) * 0.022)); }
    if (li === 0 && s === 1) H('patas', g, [knee.x, knee.y + 0.05, knee.z], [1, 0.5, 0.9], 0.9);
  }));

  // Mástil: visión estéreo, LIBS y LiDAR
  const ma = P('mastil', [0, 0.28, 0]);
  const mb = V(-0.14, Y + 0.12, 0.4);
  ma.add(mesh(new THREE.CylinderGeometry(0.06, 0.068, 0.05, 32), M.dark, mb.x, mb.y + 0.025, mb.z));
  ma.add(mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.46, 24), M.alu, mb.x, mb.y + 0.27, mb.z));
  const helix = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => V(mb.x + Math.cos(i * 0.9) * 0.032, mb.y + 0.06 + i * 0.0095, mb.z + Math.sin(i * 0.9) * 0.032)));
  ma.add(mesh(new THREE.TubeGeometry(helix, 160, 0.004, 6), M.darkMatte));
  const hd = new THREE.Group(); hd.position.set(mb.x, mb.y + 0.53, mb.z); ma.add(hd); anim.head = hd;
  hd.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 20).rotateZ(Math.PI / 2), M.dark, 0, -0.02, 0));
  hd.add(mesh(new RoundedBoxGeometry(0.32, 0.1, 0.13, 4, 0.025), M.paint, 0, 0.035, 0));
  hd.add(mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.1, 32).rotateX(Math.PI / 2), M.gold, 0, 0.04, 0.06));
  hd.add(mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 32).rotateX(Math.PI / 2), M.dark, 0, 0.04, 0.112));
  hd.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 32).rotateX(Math.PI / 2), M.lens, 0, 0.04, 0.119));
  for (const s of [-1, 1]) {
    hd.add(mesh(new RoundedBoxGeometry(0.06, 0.06, 0.07, 3, 0.01), M.dark, s * 0.12, 0.035, 0.05));
    hd.add(mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.012, 24).rotateX(Math.PI / 2), M.darkMatte, s * 0.12, 0.035, 0.09));
    hd.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 24).rotateX(Math.PI / 2), M.lens, s * 0.12, 0.035, 0.097));
  }
  hd.add(mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.03, 32), M.darkMatte, -0.06, 0.1, -0.02));
  hd.add(mesh(new THREE.CylinderGeometry(0.0305, 0.0305, 0.012, 32, 1, true), M.glass, -0.06, 0.1, -0.02));
  hd.add(mesh(new THREE.SphereGeometry(0.006, 10, 8), M.ledB, 0.08, 0.09, 0.066));
  H('mastil', hd, [0, 0.04, 0.12], [0.3, 0.25, 1], 0.8);

  // Brazo robótico con taladro de testigos
  const ar = P('brazo', [0.05, 0, 0.25]);
  const sh = V(0.15, Y + 0.075, 0.56), el = V(0.17, Y + 0.25, 0.8), wr = V(0.17, Y - 0.1, 0.98);
  ar.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 28).rotateZ(Math.PI / 2), M.dark, sh.x, sh.y, sh.z + 0.02));
  ar.add(mesh(new THREE.TorusGeometry(0.05, 0.005, 8, 28).rotateY(Math.PI / 2), M.orange, sh.x + 0.042, sh.y, sh.z + 0.02));
  ar.add(beam(V(sh.x, sh.y, sh.z + 0.03), el, 0.06, 0.065, M.paint, V(1, 0, 0)));
  ar.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.085, 28).rotateZ(Math.PI / 2), M.dark, el.x, el.y, el.z));
  ar.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.09, 24).rotateZ(Math.PI / 2), M.orange, el.x, el.y, el.z));
  ar.add(beam(el, wr, 0.05, 0.055, M.paint, V(1, 0, 0)));
  ar.add(mesh(new THREE.SphereGeometry(0.036, 24, 16), M.dark, wr.x, wr.y, wr.z));
  ar.add(mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.09, 24), M.darkMatte, wr.x, wr.y - 0.06, wr.z));
  ar.add(mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.13, 16), M.alu, wr.x, wr.y - 0.17, wr.z));
  const flute = new THREE.CatmullRomCurve3(Array.from({ length: 30 }, (_, i) => V(wr.x + Math.cos(i * 1.1) * 0.0135, wr.y - 0.11 - i * 0.0038, wr.z + Math.sin(i * 1.1) * 0.0135)));
  ar.add(mesh(new THREE.TubeGeometry(flute, 120, 0.0028, 5), M.aluDark));
  ar.add(mesh(new THREE.ConeGeometry(0.013, 0.02, 16).rotateX(Math.PI), M.aluDark, wr.x, wr.y - 0.245, wr.z));
  ar.add(mesh(new RoundedBoxGeometry(0.04, 0.035, 0.04, 2, 0.008), M.dark, wr.x - 0.045, wr.y - 0.04, wr.z + 0.01));
  ar.add(mesh(new THREE.TorusGeometry(0.011, 0.003, 8, 20), M.ledW, wr.x - 0.045, wr.y - 0.04, wr.z + 0.031));
  ar.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16).rotateX(Math.PI / 2), M.lens, wr.x - 0.045, wr.y - 0.04, wr.z + 0.031));
  H('brazo', ar, [wr.x, wr.y, wr.z + 0.04], [0.8, 0.2, 1], 0.75);

  // Cabrestante de rápel y cable anclado al suelo
  const rp = P('rapel', [0, 0.05, -0.25]);
  const wz = -0.68;
  for (const s of [-1, 1]) {
    rp.add(mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.014, 32).rotateZ(Math.PI / 2), M.dark, s * 0.105, Y + 0.02, wz));
    rp.add(mesh(new RoundedBoxGeometry(0.02, 0.09, 0.08, 2, 0.006), M.dark, s * 0.105, Y + 0.02, wz + 0.05));
  }
  const drumT = T.rope.clone(); drumT.repeat.set(1, 6); drumT.needsUpdate = true;
  rp.add(mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.196, 40).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ map: drumT, roughness: 0.85 }), 0, Y + 0.02, wz));
  rp.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 20).rotateZ(Math.PI / 2), M.alu, 0, Y + 0.02, wz));
  // guía del cable
  rp.add(mesh(new RoundedBoxGeometry(0.08, 0.03, 0.04, 2, 0.008), M.orange, 0, Y - 0.06, wz - 0.03));
  const rope = new THREE.CatmullRomCurve3([V(0, Y - 0.06, wz - 0.04), V(0, Y - 0.2, wz - 0.12), V(0.02, 0.2, -1.05), V(0.03, 0.07, -1.28), V(0.03, 0.045, -1.33)]);
  rp.add(mesh(new THREE.TubeGeometry(rope, 60, 0.0065, 8), M.ropeLine));
  const anc = new THREE.Group(); anc.position.set(0.03, 0, -1.36); rp.add(anc);
  anc.add(mesh(new THREE.CylinderGeometry(0.012, 0.006, 0.12, 12), M.alu, 0, 0.02, 0));
  anc.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20), M.dark, 0, 0.012, 0));
  anc.add(mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 20), M.orange, 0, 0.045, 0.0));
  H('rapel', rp, [0, Y + 0.08, wz - 0.03], [0.5, 0.45, -1], 0.85);

  // Radar de penetración bajo la panza
  const rd = P('radar', [0, -0.16, 0]);
  rd.add(mesh(new RoundedBoxGeometry(0.42, 0.04, 0.38, 3, 0.01), M.darkMatte, 0, Y - 0.16, 0.28));
  rd.add(mesh(new THREE.BoxGeometry(0.43, 0.006, 0.006), M.orange, 0, Y - 0.16, 0.472));
  for (let i = 0; i < 4; i++) rd.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 10), M.dark, -0.15 + i * 0.1, Y - 0.14, 0.28));
  const gpr = decal(decalTex([{ t: 'GPR 400 MHz', s: 46, x: 256, y: 64, a: 'center', c: '#d7d9de', wt: 500 }]), 0.16, 0.04); gpr.position.set(0, Y - 0.16, 0.4705); rd.add(gpr);
  H('radar', rd, [0.12, Y - 0.17, 0.47], [0.6, -0.35, 1], 0.8);

  // Plataforma del dron
  const pl = P('plataforma', [0, 0.2, 0]);
  const pz = -0.29;
  pl.add(mesh(new RoundedBoxGeometry(0.5, 0.022, 0.5, 2, 0.008), M.dark, 0, Y + 0.13, pz));
  const padTop = mesh(new THREE.PlaneGeometry(0.47, 0.47).rotateX(-Math.PI / 2), M.pad, 0, Y + 0.1415, pz); pl.add(padTop);
  pl.add(mesh(new THREE.TorusGeometry(0.13, 0.005, 8, 48).rotateX(Math.PI / 2), M.copper, 0, Y + 0.143, pz));
  for (const [x, z] of [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) pl.add(mesh(new THREE.ConeGeometry(0.018, 0.04, 16), M.orange, x, Y + 0.16, pz + z));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const l = mesh(new THREE.SphereGeometry(0.0065, 10, 6), M.ledG.clone(), Math.cos(a) * 0.215, Y + 0.145, pz + Math.sin(a) * 0.215); pl.add(l); anim.padLeds.push(l); }
  H('plataforma', pl, [0.0, Y + 0.16, pz], [0.4, 1, -0.5], 0.9);

  // Repetidores de radio
  const bz = P('balizas', [0, 0.12, -0.14]);
  bz.add(mesh(new RoundedBoxGeometry(0.4, 0.02, 0.07, 2, 0.006), M.dark, 0.0, Y + 0.13, -0.59));
  for (let i = 0; i < 4; i++) {
    const x = -0.135 + i * 0.09;
    bz.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 28), M.orange, x, Y + 0.155, -0.59));
    bz.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.035, 8), M.darkMatte, x + 0.018, Y + 0.185, -0.59));
    const led = mesh(new THREE.SphereGeometry(0.005, 8, 6), M.ledG.clone(), x - 0.012, Y + 0.171, -0.575); bz.add(led); anim.beacons.push(led);
  }
  H('balizas', bz, [0.13, Y + 0.18, -0.59], [0.6, 0.7, -1], 0.7);

  r.userData = { parts, hot, anim };
  return r;
}

// Rocas: icosaedros deformados
function rock(M, s) {
  const g0 = new THREE.IcosahedronGeometry(1, 3); g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
  const g = mergeVertices(g0), p = g.attributes.position;
  const k = 0.25 + R() * 0.25;
  for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const n = 1 + (Math.sin(v.x * 3.1 + s) + Math.cos(v.y * 2.7 - s) + Math.sin(v.z * 3.7)) * 0.09 + (Math.sin(v.x * 9 + v.z * 7 + s) * Math.cos(v.y * 8)) * 0.035 + (Math.abs(v.x + v.z) > 1.1 ? -0.08 : 0); p.setXYZ(i, v.x * n, v.y * n * 0.7, v.z * n); }
  g.computeVertexNormals();
  return mesh(g, M.rock);
}

// ------------------------------------------------------------------ escena e interfaz
function init() {
  const stage = root.querySelector('.visor-stage');
  const layer = root.querySelector('.hs-layer');
  const panel = document.getElementById('flotaPanel');
  const U = TXT.ui;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.03, 60);

  const sun = new THREE.DirectionalLight(0xfff1e0, 3.0); sun.position.set(3.5, 6, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 1, far: 15 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x3a2a20, 0.55));
  const rim = new THREE.DirectionalLight(0x9fc0ff, 1.2); rim.position.set(-4, 2.5, -4); scene.add(rim);

  const T = makeTextures(), M = makeMaterials(T);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3.4, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: T.ground, alphaMap: T.groundAlpha, transparent: true, roughness: 1, depthWrite: false }));
  ground.receiveShadow = true; scene.add(ground);
  const rocks = new THREE.Group(); scene.add(rocks);
  for (let i = 0; i < 34; i++) {
    const a = R() * Math.PI * 2, d = 1.05 + R() * 1.7, s = 0.02 + R() * R() * 0.11;
    const m = rock(M, i); m.scale.setScalar(s); m.position.set(Math.cos(a) * d, s * 0.25, Math.sin(a) * d); m.rotation.set(R(), R() * 6, R()); rocks.add(m);
  }
  for (const [x, z, s] of [[-1.7, -1.1, 0.24], [1.9, -0.9, 0.17], [-1.3, 1.6, 0.13]]) { const m = rock(M, x); m.scale.setScalar(s); m.position.set(x, s * 0.2, z); rocks.add(m); }

  const drone = buildDrone(M, T), robot = buildRobot(M, T);
  scene.add(drone, robot);
  // baliza de MoonSiteUA (vista en equipo)
  const beacon = new THREE.Group(); beacon.position.set(-1.05, 0, 0.75); scene.add(beacon);
  beacon.add(mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.42, 10), M.aluDark, 0, 0.21, 0));
  beacon.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.03, 20), M.darkMatte, 0, 0.015, 0));
  const beaconLamp = mesh(new THREE.SphereGeometry(0.04, 20, 14), M.ledO.clone(), 0, 0.45, 0); beacon.add(beaconLamp);

  // Materiales propios por pieza, para poder resaltarla
  for (const model of [drone, robot]) for (const list of Object.values(model.userData.parts)) for (const g of list)
    g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.userData.baseEm = o.material.emissive ? o.material.emissive.clone() : null; o.userData.baseEi = o.material.emissiveIntensity; } });

  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 0.35, maxDistance: 7, maxPolarAngle: Math.PI * 0.86, autoRotateSpeed: 3.2, rotateSpeed: 0.8 });

  // ---------------------------------------------------------------- estado
  const st = { modo: 'dron', sel: null, exp: 0, expT: 0, step: 1, tween: null, hs: [], visible: true };
  const FRAME = {
    dron: { t: V(0, 0.62, 0), d: 1.85, dir: V(0.75, 0.32, 1) },
    robot: { t: V(0, 0.42, -0.1), d: 4.1, dir: V(0.85, 0.42, 1) },
    equipo: { t: V(-0.1, 0.62, -0.15), d: 4.4, dir: V(1, 0.45, 0.9) },
  };
  const STEPS = {
    1: { cam: { t: V(0, 0.55, -0.1), d: 3.6, dir: V(1, 0.4, 1) }, drone: V(0, 0.958, -0.29), fly: false, L: 0.03, lamp: 'o' },
    2: { cam: { t: V(0, 1.1, -0.1), d: 3.4, dir: V(0.9, 0.2, 1) }, drone: V(0.15, 1.72, 0.05), fly: true, L: 0.08, lamp: 'o' },
    3: { cam: { t: V(0.3, 0.6, -0.9), d: 3.4, dir: V(1, 0.45, -0.7) }, drone: V(0.85, 1.3, -1.15), fly: true, L: 0.9, lamp: 'o' },
    4: { cam: { t: V(-0.3, 0.5, 0.1), d: 4.6, dir: V(0.2, 1.2, 1) }, drone: V(0, 0.958, -0.29), fly: false, L: 0.03, lamp: 'g' },
  };
  const droneGoal = { p: V(0, 0.75, 0), L: 0.42, fly: true };

  function frameCam(f, dur = 900) {
    const to = f.t.clone().add(f.dir.clone().normalize().multiplyScalar(f.d));
    flyTo(f.t.clone(), to, dur);
  }
  function flyTo(target, pos, dur = 900) {
    st.tween = { t0: performance.now(), dur, ft: controls.target.clone(), fp: camera.position.clone(), tt: target, tp: pos };
  }
  controls.addEventListener('start', () => { st.tween = null; });

  // ---------------------------------------------------------------- interfaz del panel
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function renderPanel() {
    panel.innerHTML = '';
    if (st.modo === 'equipo') {
      const E = TXT.equipo;
      panel.append(el('p', 'kicker', E.kicker), el('h3', null, E.titulo), el('p', 'muted', E.desc));
      const ol = el('ol', 'pasos');
      E.pasos.forEach((p, i) => {
        const li = el('li'); const b = el('button', 'paso'); b.type = 'button';
        b.innerHTML = `<span class="n mono">${i + 1}</span><span><b>${p.titulo}</b><span class="muted">${p.texto}</span></span>`;
        b.setAttribute('aria-pressed', String(st.step === i + 1));
        b.onclick = () => setStep(i + 1);
        li.append(b); ol.append(li);
      });
      panel.append(ol);
      return;
    }
    const D = TXT[st.modo];
    panel.append(el('p', 'kicker', D.codigo), el('h3', null, D.nombre), el('p', 'sub', D.subtitulo), el('p', 'muted', D.desc));
    const info = el('div', 'parte'); info.id = 'parteInfo'; info.setAttribute('aria-live', 'polite'); panel.append(info);
    renderInfo();
    panel.append(el('h4', null, U.piezas));
    const list = el('div', 'piezas');
    D.partes.forEach((p, i) => {
      const b = el('button', 'pieza'); b.type = 'button'; b.dataset.id = p.id;
      b.innerHTML = `<span class="n mono">${i + 1}</span>${p.titulo}`;
      b.setAttribute('aria-pressed', String(st.sel === p.id));
      b.onclick = () => select(st.sel === p.id ? null : p.id, true);
      list.append(b);
    });
    panel.append(list);
    panel.append(el('h4', null, U.specs));
    const dl = el('dl', 'specs');
    for (const [k, v] of D.specs) dl.append(el('dt', null, k), el('dd', null, v));
    panel.append(dl);
  }
  function renderInfo() {
    const info = document.getElementById('parteInfo'); if (!info) return;
    const D = TXT[st.modo]; const p = D.partes.find((x) => x.id === st.sel);
    if (!p) { info.className = 'parte vacia'; info.innerHTML = `<span class="muted">${U.pista}</span>`; return; }
    const n = D.partes.indexOf(p) + 1;
    info.className = 'parte';
    info.innerHTML = `<div class="ph"><span class="n mono">${n}</span><b>${p.titulo}</b><button type="button" class="x" aria-label="${U.cerrar}">×</button></div><p>${p.texto}</p><div class="curio"><span class="kicker">${U.curiosidad}</span><p>${p.curiosidad}</p></div>`;
    info.querySelector('.x').onclick = () => select(null);
  }

  // ---------------------------------------------------------------- puntos interactivos
  function buildHotspots() {
    layer.innerHTML = ''; st.hs = [];
    if (st.modo === 'equipo') return;
    const model = st.modo === 'dron' ? drone : robot, D = TXT[st.modo];
    D.partes.forEach((p, i) => {
      const h = model.userData.hot.find((x) => x.id === p.id); if (!h) return;
      const b = el('button', 'hs mono', String(i + 1)); b.type = 'button'; b.title = p.titulo; b.setAttribute('aria-label', `${i + 1}. ${p.titulo}`);
      b.onclick = (e) => { e.stopPropagation(); select(st.sel === p.id ? null : p.id, true); };
      layer.append(b); st.hs.push({ b, h, id: p.id });
    });
  }
  const ray = new THREE.Raycaster(), tmp = V(0, 0, 0);
  let occTick = 0;
  function placeHotspots(w, h) {
    const model = st.modo === 'dron' ? drone : robot;
    const check = (occTick++ % 5) === 0;
    for (const s of st.hs) {
      s.h.a.getWorldPosition(tmp);
      const dist = tmp.distanceTo(camera.position);
      const p = tmp.clone().project(camera);
      const vis = p.z < 1;
      s.b.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      s.b.hidden = !vis;
      if (check && vis) {
        ray.set(camera.position, tmp.clone().sub(camera.position).normalize()); ray.far = dist;
        const hit = ray.intersectObject(model, true).find((x) => x.object.visible);
        let oc = false;
        if (hit && hit.distance < dist - 0.03) { let o = hit.object; while (o && !o.userData.part) o = o.parent; oc = !(o && o.userData.part === s.id); }
        s.b.classList.toggle('oc', oc);
      }
      s.b.classList.toggle('on', st.sel === s.id);
    }
  }

  // ---------------------------------------------------------------- selección
  const accent = new THREE.Color(0xffd23f);
  function highlight() {
    for (const model of [drone, robot]) for (const [id, list] of Object.entries(model.userData.parts)) for (const g of list)
      g.traverse((o) => {
        if (!o.isMesh || !o.material.emissive) return;
        const on = model.visible && st.modo !== 'equipo' && id === st.sel && model === (st.modo === 'dron' ? drone : robot);
        if (on) { o.material.emissive.copy(accent); o.material.emissiveIntensity = 0.2; }
        else { o.material.emissive.copy(o.userData.baseEm); o.material.emissiveIntensity = o.userData.baseEi; }
      });
  }
  const cap = root.querySelector('.visor-cap');
  cap.onclick = () => { const i = document.getElementById('parteInfo'); if (i) i.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  function select(id, focus = false) {
    st.sel = id; highlight(); renderInfo();
    const D = TXT[st.modo], p = D && D.partes && D.partes.find((x) => x.id === id);
    cap.hidden = !p;
    if (p) cap.innerHTML = `<b class="mono">${D.partes.indexOf(p) + 1}</b>${p.titulo} <span style="color:var(--accent)">· ${U.verDetalles} ↓</span>`;
    panel.querySelectorAll('.pieza').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
    if (id && focus) {
      const model = st.modo === 'dron' ? drone : robot;
      const h = model.userData.hot.find((x) => x.id === id);
      if (h) {
        const t = h.a.getWorldPosition(V(0, 0, 0));
        setAuto(false);
        flyTo(t, t.clone().add(h.dir.clone().multiplyScalar(h.dist + st.exp * 0.4)));
      }
    }
  }

  // Clic directo sobre una pieza del modelo
  const ndc = new THREE.Vector2();
  let down = null;
  const pick = (e) => {
    const rc = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); ray.far = 100;
    const model = st.modo === 'dron' ? drone : st.modo === 'robot' ? robot : null; if (!model) return null;
    const hit = ray.intersectObject(model, true)[0]; if (!hit) return null;
    let o = hit.object; while (o && !o.userData.part) o = o.parent;
    return o ? o.userData.part : null;
  };
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const id = pick(e); if (id || st.sel) select(id, !!id);
  });
  let hovT = 0;
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons || performance.now() - hovT < 60) return; hovT = performance.now();
    renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab';
  });

  // ---------------------------------------------------------------- modos y barra de herramientas
  const bar = root.querySelector('.visor-bar');
  const btn = (k) => bar.querySelector(`[data-accion="${k}"]`);
  function setAuto(on) { controls.autoRotate = on; btn('auto').setAttribute('aria-pressed', String(on)); }
  function setExp(on) { st.expT = on ? 1 : 0; btn('despiece').setAttribute('aria-pressed', String(on)); }
  function setModo(m) {
    st.modo = m; st.sel = null; cap.hidden = true;
    document.querySelectorAll('#flotaModo button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === m)));
    drone.visible = m !== 'robot'; robot.visible = m !== 'dron'; beacon.visible = m === 'equipo';
    btn('despiece').disabled = m === 'equipo';
    if (m === 'equipo') { setExp(false); st.exp = 0; setStep(st.step, true); }
    else { if (m === 'dron') Object.assign(droneGoal, { p: V(0, 0.75, 0), L: 0.42, fly: true }); frameCam(FRAME[m]); }
    if (m !== 'equipo' && m === 'dron') { drone.position.copy(droneGoal.p); }
    controls.minDistance = m === 'robot' ? 0.6 : 0.35;
    highlight(); renderPanel(); buildHotspots();
    try { history.replaceState(null, '', '#' + m); } catch (e) {}
  }
  function setStep(n, initial = false) {
    st.step = n; const S = STEPS[n];
    Object.assign(droneGoal, { p: S.drone.clone(), L: S.L, fly: S.fly });
    if (initial) drone.position.copy(S.drone);
    beaconLamp.material.emissive.set(S.lamp === 'g' ? 0x2dff7a : 0xff8a3d);
    frameCam(S.cam, 1100);
    panel.querySelectorAll('.paso').forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === n)));
  }
  document.querySelectorAll('#flotaModo button').forEach((b) => b.addEventListener('click', () => setModo(b.dataset.modo)));
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.accion, F = st.modo === 'equipo' ? STEPS[st.step].cam : FRAME[st.modo];
    const vista = (dir) => { setAuto(false); frameCam({ t: F.t, d: F.d * (1 + st.exp * 0.25), dir }); };
    if (a === 'auto') setAuto(!controls.autoRotate);
    else if (a === 'despiece') { setExp(st.expT === 0); frameCam({ ...F, d: F.d * (st.expT ? 1.25 : 1) }); }
    else if (a === 'frontal') vista(V(0, 0.18, 1));
    else if (a === 'lateral') vista(V(1, 0.18, 0));
    else if (a === 'superior') vista(V(0.001, 1, 0.12));
    else if (a === 'trasera') vista(V(0, 0.18, -1));
    else if (a === 'reset') { setAuto(false); setExp(false); select(null); frameCam(F); }
    else if (a === 'full') {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
      } catch (err) {}
    }
  });

  // ---------------------------------------------------------------- bucle
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  if ('IntersectionObserver' in window) new IntersectionObserver((en) => { st.visible = en[0].isIntersecting; }).observe(stage);

  const clock = new THREE.Timer();
  const dA = drone.userData.anim, rA = robot.userData.anim;
  let spin = 1;
  function tick() {
    requestAnimationFrame(tick);
    clock.update();
    if (!st.visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.getElapsed();
    // cámara animada
    if (st.tween) {
      const k = Math.min(1, (performance.now() - st.tween.t0) / st.tween.dur), e = ease(k);
      controls.target.lerpVectors(st.tween.ft, st.tween.tt, e); camera.position.lerpVectors(st.tween.fp, st.tween.tp, e);
      if (k >= 1) st.tween = null;
    }
    controls.update(dt);
    // despiece
    st.exp += (st.expT - st.exp) * Math.min(1, dt * 5);
    for (const model of [drone, robot]) for (const list of Object.values(model.userData.parts)) for (const g of list) g.position.copy(g.userData.explode).multiplyScalar(st.exp);
    // dron
    if (drone.visible) {
      const tgt = droneGoal.p.clone();
      const flying = droneGoal.fly && st.exp < 0.05;
      if (droneGoal.fly) tgt.y += Math.sin(t * 1.7) * 0.012;
      drone.position.lerp(tgt, Math.min(1, dt * (st.modo === 'equipo' ? 1.6 : 6)));
      drone.rotation.z = droneGoal.fly ? Math.sin(t * 1.1) * 0.025 : 0;
      drone.rotation.x = droneGoal.fly ? Math.sin(t * 0.9 + 1) * 0.02 : 0;
      spin += ((flying ? 1 : 0) - spin) * Math.min(1, dt * 2.5);
      for (const p of dA.props) p.g.rotation.y += p.dir * dt * (2 + spin * 26);
      for (const b of dA.blur) b.material.opacity = spin * 0.22;
      dA.lidar.rotation.y += dt * 4;
      dA.L += (droneGoal.L - dA.L) * Math.min(1, dt * 1.5);
      dA.tether.scale.y = dA.L; dA.probe.position.y = -dA.L;
      dA.piv.rotation.x = Math.sin(t * 1.3) * 0.05 * spin; dA.piv.rotation.z = Math.sin(t * 1.05 + 0.6) * 0.04 * spin;
      const f = (t % 1.4) < 0.07 || ((t % 1.4) > 0.16 && (t % 1.4) < 0.21);
      dA.strobe.material.emissiveIntensity = f ? 8 : 0.2;
    }
    if (robot.visible) {
      rA.head.rotation.y = Math.sin(t * 0.45) * 0.55;
      rA.padLeds.forEach((l, i) => { l.material.emissiveIntensity = ((Math.floor(t * 8) - i) % 12 + 12) % 12 < 2 ? 5 : 0.4; });
      rA.beacons.forEach((l, i) => { l.material.emissiveIntensity = Math.sin(t * 3 + i) > 0.6 ? 4 : 0.5; });
    }
    if (beacon.visible) beaconLamp.material.emissiveIntensity = 2 + Math.sin(t * 4) * 1.2;
    renderer.render(scene, camera);
    placeHotspots(stage.clientWidth, stage.clientHeight);
  }

  // inicio
  root.querySelector('.visor-load').hidden = true;
  resize();
  const h0 = location.hash.slice(1);
  const m0 = ['dron', 'robot', 'equipo'].includes(h0) ? h0 : 'dron';
  const F0 = m0 === 'equipo' ? STEPS[2].cam : FRAME[m0];
  if (m0 === 'equipo') st.step = 2;
  controls.target.copy(F0.t); camera.position.copy(F0.t.clone().add(F0.dir.clone().normalize().multiplyScalar(F0.d)));
  setModo(m0);
  st.tween = null;
  if (m0 === 'dron') drone.position.copy(droneGoal.p);
  setAuto(true);
  tick();
  window.__flota = { renderer, scene, camera, controls, setModo, select, st }; // para depurar
}
