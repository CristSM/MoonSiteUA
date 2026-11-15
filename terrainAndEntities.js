import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import {
  CinemaPostShader,
  createAtmosphereMaterial,
  createBeaconBeamMaterial,
  createDustTexture,
  createEarthCloudMaterial,
  createEarthSurfaceMaterial,
  createGrainNormalTexture,
  createHexShieldMaterial,
  createHolographicFenceMaterial,
  createMoonMaterial,
  createMulberry32,
  createMultispectralScanMaterial,
  createTriplanarTerrainMaterial,
  sampleTerrainHeight,
  sampleTerrainNormal,
} from './shaders.js';

const WIDTH = 1920;
const HEIGHT = 1080;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Helper to create a curved glowing energy arc tube between two 3D points.
 */
function buildArcTube(start, end, apexHeight, radius, material, segments = 36) {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const up = mid.clone().normalize();
  const ctrl = up.multiplyScalar(mid.length() + apexHeight);
  const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
  const geo = new THREE.TubeGeometry(curve, segments, radius, 6, false);
  return new THREE.Mesh(geo, material);
}

/**
 * Builds an elevated terrain-hugging polyline ribbon from 2D [x, z] waypoints.
 */
function buildTerrainBorderLine(pointsXZ, colorHex, yOffset = 0.38) {
  const pts = [];
  for (let i = 0; i < pointsXZ.length - 1; i++) {
    const [x0, z0] = pointsXZ[i];
    const [x1, z1] = pointsXZ[i + 1];
    const sub = 12;
    for (let s = 0; s < (i === pointsXZ.length - 2 ? sub + 1 : sub); s++) {
      const f = s / sub;
      const x = lerp(x0, x1, f);
      const z = lerp(z0, z1, f);
      pts.push(new THREE.Vector3(x, sampleTerrainHeight(x, z) + yOffset, z));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts, false);
  const geo = new THREE.TubeGeometry(curve, pts.length * 2, 0.16, 5, false);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return { mesh: new THREE.Mesh(geo, mat), material: mat };
}

/**
 * Builds the 3D Field Survey Beacon assembly (Act 3).
 */
function createSurveyBeacon(x, z, beamMat) {
  const y = sampleTerrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x263244,
    metalness: 0.78,
    roughness: 0.34,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x8e9bae,
    emissive: 0x8e9bae,
    emissiveIntensity: 2.2,
    metalness: 0.25,
    roughness: 0.2,
  });

  // 3 Tripod legs seated solidly into rock
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8), metalMat);
    leg.position.set(Math.cos(angle) * 0.52, 0.85, Math.sin(angle) * 0.52);
    leg.rotation.z = Math.cos(angle) * 0.32;
    leg.rotation.x = -Math.sin(angle) * 0.32;
    leg.castShadow = true;
    group.add(leg);
  }

  // Central telemetry column & sensor head
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.4, 12), metalMat);
  mast.position.y = 1.5;
  mast.castShadow = true;
  group.add(mast);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 8, 24), coreMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 2.15;
  group.add(collar);

  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 1), coreMat);
  orb.position.y = 2.75;
  group.add(orb);

  // Solar vane wing
  const solarMat = new THREE.MeshStandardMaterial({
    color: 0x0a2548,
    emissive: 0x004466,
    emissiveIntensity: 0.35,
    metalness: 0.65,
    roughness: 0.18,
  });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.46), solarMat);
  panel.position.set(0.7, 1.9, 0);
  panel.rotation.z = -0.3;
  panel.castShadow = true;
  group.add(panel);

  // Volumetric vertical light beam
  const beamGeo = new THREE.CylinderGeometry(0.42, 0.95, 18.0, 24, 1, true);
  beamGeo.translate(0, 9.0, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 2.5;
  group.add(beam);

  // Concentric ground radar ring(s)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff6b00,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const radarRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.65, 48), ringMat);
  radarRing.rotation.x = -Math.PI / 2;
  radarRing.position.y = 0.28;
  group.add(radarRing);

  const beaconLight = new THREE.PointLight(0x8e9bae, 0, 18, 1.8);
  beaconLight.position.set(0, 3.2, 0);
  group.add(beaconLight);

  return { group, coreMat, orb, collar, radarRing, ringMat, beaconLight };
}

/**
 * Builds the 3D Collaborative Virtual Space Colony (Act 6).
 */
function createVirtualColony(x, z) {
  const y = sampleTerrainHeight(x, z);
  const root = new THREE.Group();
  root.position.set(x, y, z);

  // Shared materials (animated trim color in Genesis step)
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.1,
    metalness: 0.45,
    roughness: 0.25,
  });
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xd8e1eb,
    metalness: 0.55,
    roughness: 0.36,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e2836,
    metalness: 0.8,
    roughness: 0.32,
  });
  const domeGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x8ae8ff,
    transparent: true,
    opacity: 0.34,
    roughness: 0.12,
    metalness: 0.1,
    transmission: 0.5,
    depthWrite: false,
  });
  const domeWireMat = new THREE.MeshBasicMaterial({
    color: 0x70f4ff,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
  });

  // ---- Genesis Module ----
  const genesis = new THREE.Group();
  root.add(genesis);

  const basePad = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.2, 0.55, 32), darkMetalMat);
  basePad.position.y = 0.55;
  basePad.castShadow = true;
  basePad.receiveShadow = true;
  genesis.add(basePad);

  // Inner metallic structural deck ring + perimeter bulkhead ribs
  const innerDeckRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 8, 36), hullMat);
  innerDeckRing.rotation.x = Math.PI / 2;
  innerDeckRing.position.y = 0.85;
  genesis.add(innerDeckRing);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.65), hullMat);
    rib.position.set(Math.cos(a) * 3.85, 0.68, Math.sin(a) * 3.85);
    rib.rotation.y = -a + Math.PI / 2;
    genesis.add(rib);
  }

  const trimRing = new THREE.Mesh(new THREE.TorusGeometry(3.82, 0.14, 10, 48), trimMat);
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.y = 0.82;
  genesis.add(trimRing);

  // 4 hydraulic landing struts
  const struts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.35, 8), darkMetalMat);
    leg.position.set(Math.cos(a) * 4.35, 0.45, Math.sin(a) * 4.35);
    leg.rotation.z = Math.cos(a) * 0.45;
    leg.rotation.x = -Math.sin(a) * 0.45;
    leg.castShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.14, 10), trimMat);
    foot.position.set(Math.cos(a) * 4.68, -0.05, Math.sin(a) * 4.68);
    strut.add(leg, foot);
    struts.push(strut);
    genesis.add(strut);
  }

  // Geodesic Glass Dome
  const domeGeo = new THREE.SphereGeometry(3.55, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const domeGlass = new THREE.Mesh(domeGeo, domeGlassMat);
  domeGlass.position.y = 0.78;
  const domeWire = new THREE.Mesh(new THREE.IcosahedronGeometry(3.58, 2), domeWireMat);
  domeWire.position.y = 0.78;
  // Clip lower half conceptually by placing center right at base pad
  domeWire.scale.set(1, 0.75, 1);
  genesis.add(domeGlass, domeWire);

  // Interior glowing workstations & hydroponics visible through dome
  const consoleMat = new THREE.MeshStandardMaterial({
    color: 0x0b1628,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.5,
  });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.5;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.45), consoleMat);
    desk.position.set(Math.cos(a) * 1.4, 1.15, Math.sin(a) * 1.4);
    desk.rotation.y = -a;
    genesis.add(desk);
  }
  const hydroMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 1.35,
  });
  for (let i = 0; i < 4; i++) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.7), hydroMat);
    rack.position.set(-1.3 + i * 0.5, 1.3, -1.2);
    genesis.add(rack);
  }

  // Founder Flag Banner
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), hullMat);
  pole.position.set(1.8, 1.9, 1.6);
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.2,
    side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.52), flagMat);
  flag.position.set(2.3, 2.75, 1.6);
  genesis.add(pole, flag);

  const interiorLight = new THREE.PointLight(0x00f0ff, 2.5, 12, 1.6);
  interiorLight.position.set(0, 2.2, 0);
  genesis.add(interiorLight);

  // Regolith landing dust ring
  const dustRingMat = new THREE.MeshBasicMaterial({
    color: 0xc86d51,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const dustRing = new THREE.Mesh(new THREE.RingGeometry(2.8, 4.4, 48), dustRingMat);
  dustRing.rotation.x = -Math.PI / 2;
  dustRing.position.y = 0.25;
  root.add(dustRing);

  // ---- Collaborative Expansion Modules (Tunnels + Pods + Solar Arrays + Comms Dish) ----
  const expansions = [];
  const podConfigs = [
    { angle: 0.25, dist: 7.4, size: [2.4, 1.6, 2.4], tint: 0x00ff88, type: 'hydro' },
    { angle: 2.35, dist: 7.6, size: [2.8, 1.8, 2.2], tint: 0xb829ff, type: 'lab' },
    { angle: 4.35, dist: 7.2, size: [2.3, 2.2, 2.3], tint: 0xffb800, type: 'hab' },
  ];

  podConfigs.forEach((cfg, idx) => {
    const expGroup = new THREE.Group();
    const dirX = Math.cos(cfg.angle);
    const dirZ = Math.sin(cfg.angle);

    // Airlock tunnel connecting genesis (r=3.6) to pod (dist)
    const tunnelLen = cfg.dist - 3.6;
    const tunnel = new THREE.Group();
    const tubeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, tunnelLen, 16), hullMat);
    tubeMesh.rotation.z = Math.PI / 2;
    tubeMesh.position.x = tunnelLen * 0.5;
    tubeMesh.castShadow = true;

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.0,
    });
    const dockRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.08, 8, 24), ringMat);
    dockRing.rotation.y = Math.PI / 2;
    dockRing.position.x = tunnelLen * 0.92;
    // Ribbed structural bulkheads along pressurized corridor
    for (const frac of [0.28, 0.62]) {
      const bulk = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 6, 20), darkMetalMat);
      bulk.rotation.y = Math.PI / 2;
      bulk.position.x = tunnelLen * frac;
      tunnel.add(bulk);
    }
    tunnel.add(tubeMesh, dockRing);
    tunnel.position.set(dirX * 3.4, 1.05, dirZ * 3.4);
    tunnel.rotation.y = -cfg.angle;
    expGroup.add(tunnel);

    // Satellite Habitat Pod
    const pod = new THREE.Group();
    pod.position.set(dirX * cfg.dist, 0.1, dirZ * cfg.dist);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(cfg.size[0] * 0.52, cfg.size[0] * 0.6, cfg.size[1], 16), hullMat);
    body.position.y = cfg.size[1] * 0.5 + 0.3;
    body.castShadow = true;
    body.receiveShadow = true;

    const accentMat = new THREE.MeshStandardMaterial({
      color: cfg.tint,
      emissive: cfg.tint,
      emissiveIntensity: 1.5,
    });
    const capRing = new THREE.Mesh(new THREE.TorusGeometry(cfg.size[0] * 0.45, 0.09, 8, 24), accentMat);
    capRing.rotation.x = Math.PI / 2;
    capRing.position.y = cfg.size[1] + 0.25;
    pod.add(body, capRing);

    // Glowing habitat cabin viewports around upper circumference
    for (let w = 0; w < 4; w++) {
      const wa = (w / 4) * Math.PI * 2 + 0.35;
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.08), accentMat);
      win.position.set(
        Math.cos(wa) * (cfg.size[0] * 0.54),
        cfg.size[1] * 0.62 + 0.3,
        Math.sin(wa) * (cfg.size[0] * 0.54)
      );
      win.rotation.y = -wa + Math.PI / 2;
      pod.add(win);
    }

    if (idx === 0 || idx === 2) {
      // Solar wing array with metallic structural grid ribs
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0x0c2d5c,
        emissive: 0x0066aa,
        emissiveIntensity: 0.45,
        metalness: 0.72,
        roughness: 0.16,
      });
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 1.45), wingMat);
      wing.position.set(0, cfg.size[1] + 0.65, 0);
      wing.rotation.x = 0.35;
      wing.castShadow = true;
      const wingFrame = new THREE.Mesh(new THREE.BoxGeometry(3.86, 0.03, 0.08), hullMat);
      wingFrame.position.copy(wing.position);
      wingFrame.rotation.copy(wing.rotation);
      pod.add(wing, wingFrame);
    }

    if (idx === 1) {
      // Deep-space telemetry comms dish on Lab pod roof
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.38),
        hullMat
      );
      dish.position.set(0, cfg.size[1] + 1.0, 0);
      dish.rotation.x = Math.PI + 0.6;
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), accentMat);
      needle.position.set(0, cfg.size[1] + 1.25, -0.35);
      needle.rotation.x = -0.6;
      pod.add(dish, needle);
    }

    expGroup.add(pod);
    root.add(expGroup);
    expansions.push({ expGroup, tunnel, pod, cfg });
  });

  return {
    root,
    genesis,
    struts,
    trimMat,
    flagMat,
    interiorLight,
    dustRing,
    dustRingMat,
    expansions,
  };
}

/**
 * Builds the Tier 3 Autonomous University Rover & Quadcopter Drone (Act 7).
 */
function createTier3Robotics(scanMat) {
  // ---- 6-Wheeled Autonomous Rover ----
  const rover = new THREE.Group();
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0xe6ecf5, metalness: 0.55, roughness: 0.32 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x161d28, metalness: 0.85, roughness: 0.38 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.7,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.62, 1.25), chassisMat);
  body.position.y = 0.72;
  body.castShadow = true;
  rover.add(body);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.05), darkMat);
  deck.position.y = 1.08;
  rover.add(deck);

  // Camera mast + dual stereo optical eyes
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.95, 8), chassisMat);
  mast.position.set(-0.55, 1.5, 0);
  mast.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.55), chassisMat);
  head.position.set(-0.62, 1.98, 0);
  const lens1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), accentMat);
  lens1.rotation.z = Math.PI / 2;
  lens1.position.set(-0.78, 1.98, -0.14);
  const lens2 = lens1.clone();
  lens2.position.z = 0.14;
  rover.add(mast, head, lens1, lens2);

  // 6 Rocker-bogie wheels
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14);
  const wheels = [];
  for (const side of [-0.72, 0.72]) {
    for (const wx of [-0.75, 0.0, 0.75]) {
      const wheel = new THREE.Mesh(wheelGeo, darkMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.3, side);
      wheel.castShadow = true;
      rover.add(wheel);
      wheels.push(wheel);
    }
  }

  // ---- Autonomous Quadcopter Research Drone ----
  const drone = new THREE.Group();
  const droneBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 1), darkMat);
  droneBody.scale.set(1.3, 0.52, 1.1);
  droneBody.castShadow = true;
  drone.add(droneBody);

  const lidPod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.26, 12), accentMat);
  lidPod.position.y = -0.25;
  drone.add(lidPod);

  const rotors = [];
  const rotorMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  for (const [ax, az] of [
    [-0.85, -0.85],
    [0.85, -0.85],
    [-0.85, 0.85],
    [0.85, 0.85],
  ]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.22, 6), chassisMat);
    arm.position.set(ax * 0.5, 0.04, az * 0.5);
    arm.rotation.y = Math.atan2(ax, az);
    arm.rotation.x = Math.PI / 2;
    drone.add(arm);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.018, 0.09), rotorMat);
    blade.position.set(ax, 0.14, az);
    drone.add(blade);
    rotors.push(blade);
  }

  // Sweeping Multispectral Laser Scan Curtain hanging below drone toward the basalt cliff
  const scanGeo = new THREE.PlaneGeometry(11.5, 14.5, 1, 1);
  scanGeo.translate(0, -7.25, 0);
  const scanCurtain = new THREE.Mesh(scanGeo, scanMat);
  scanCurtain.rotation.z = -0.32;
  scanCurtain.position.y = -0.35;
  drone.add(scanCurtain);

  return { rover, wheels, drone, rotors, scanCurtain };
}

/**
 * Main Three.js Planetary & Geological Engine + EffectComposer Stack + CatmullRomCurve3 Camera Rig.
 */
export function createPlanetaryEngine(canvas) {
  const rng = createMulberry32(202609);

  // ---- WebGLRenderer Calibration ----
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x05070b, 1);

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2('#070A12', 0.0085);
  scene.fog = fog;

  // 75mm-feel anamorphic telephoto/cinema FOV (~34 deg)
  const camera = new THREE.PerspectiveCamera(34, WIDTH / HEIGHT, 0.25, 2500);

  // ---- Lighting ----
  const hemiLight = new THREE.HemisphereLight(0x4b749f, 0x2c140e, 0.52);
  scene.add(hemiLight);

  const sunDir = new THREE.Vector3(0.74, 0.34, -0.58).normalize();
  const sunLight = new THREE.DirectionalLight(0xffdcb8, 3.2);
  sunLight.position.copy(sunDir).multiplyScalar(120);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 280;
  sunLight.shadow.camera.left = -110;
  sunLight.shadow.camera.right = 110;
  sunLight.shadow.camera.top = 110;
  sunLight.shadow.camera.bottom = -110;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // =========================================================
  // WORLD 1: ORBITAL EARTH & MOON (Act 1 0–104f & Act 7 1680–1800f)
  // Dedicated sunlit 3/4 orbital key light so camera sees sunlit continents, ocean glint & twilight cities
  // =========================================================
  const orbitalGroup = new THREE.Group();
  scene.add(orbitalGroup);

  // Dramatic 60% sunlit / 40% twilight crescent orbital key light + glowing city-light dark side
  const orbitalSunDir = new THREE.Vector3(0.84, 0.28, 0.24).normalize();
  const earthMat = createEarthSurfaceMaterial(orbitalSunDir);
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(32, 128, 128), earthMat);
  earthMesh.position.set(0, -4, 0);
  orbitalGroup.add(earthMesh);

  const cloudMat = createEarthCloudMaterial(orbitalSunDir);
  const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(32.5, 96, 96), cloudMat);
  cloudMesh.position.copy(earthMesh.position);
  orbitalGroup.add(cloudMesh);

  const atmoMat = createAtmosphereMaterial(orbitalSunDir);
  const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(33.8, 96, 96), atmoMat);
  atmoMesh.position.copy(earthMesh.position);
  orbitalGroup.add(atmoMesh);

  const moonMat = createMoonMaterial(orbitalSunDir);
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(5.6, 64, 64), moonMat);
  moonMesh.position.set(-48, 22, -72);
  orbitalGroup.add(moonMesh);

  // Golden orbital launch arc flashing in Act 1
  const launchArcPts = [];
  for (let i = 0; i <= 40; i++) {
    const a = -0.65 + (i / 40) * 1.45;
    const alt = 33.0 + Math.sin((i / 40) * Math.PI) * 9.5;
    launchArcPts.push(new THREE.Vector3(Math.sin(a) * alt, Math.cos(a) * alt * 0.55 - 4 + (i / 40) * 8, Math.cos(a) * alt * 0.85));
  }
  const launchArcMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const launchArcMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(launchArcPts), 64, 0.22, 8, false),
    launchArcMat
  );
  orbitalGroup.add(launchArcMesh);

  // Act 1 Crimson Laser Slash Plane
  const crimsonSlashMat = new THREE.MeshBasicMaterial({
    color: 0xff1e42,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const crimsonSlash = new THREE.Mesh(new THREE.PlaneGeometry(140, 1.4), crimsonSlashMat);
  crimsonSlash.position.set(0, 4, 38);
  crimsonSlash.rotation.z = -0.26;
  orbitalGroup.add(crimsonSlash);

  // Act 7 Global Constellation Pins + Geodesic Arcs around Earth
  const constellationGroup = new THREE.Group();
  constellationGroup.position.copy(earthMesh.position);
  orbitalGroup.add(constellationGroup);
  const constellationPts = [];
  const pinMatCyan = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  const pinMatGold = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  const pinMatPurple = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const pinGeo = new THREE.SphereGeometry(0.42, 8, 8);
  const arcColors = [0x00ff88, 0x00f0ff, 0xffd700];
  const constellationMats = [];

  for (let i = 0; i < 48; i++) {
    const phi = Math.acos(1 - 2 * ((i + 0.5) / 48));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i + rng() * 0.25;
    const pos = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * 32.4,
      Math.cos(phi) * 32.4,
      Math.sin(phi) * Math.sin(theta) * 32.4
    );
    constellationPts.push(pos);
    const mat = i % 3 === 0 ? pinMatCyan : i % 3 === 1 ? pinMatGold : pinMatPurple;
    const pin = new THREE.Mesh(pinGeo, mat);
    pin.position.copy(pos);
    constellationGroup.add(pin);
  }
  for (let i = 0; i < 24; i++) {
    const pA = constellationPts[i];
    const pB = constellationPts[(i * 7 + 5) % constellationPts.length];
    const mat = new THREE.MeshBasicMaterial({
      color: arcColors[i % 3],
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    constellationMats.push(mat);
    constellationGroup.add(buildArcTube(pA, pB, 3.8 + (i % 4) * 1.4, 0.14, mat, 24));
  }

  // Deterministic 2,400 Starfield
  const starCount = 2400;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const rad = 420 + rng() * 480;
    const sq = Math.sqrt(Math.max(0, 1 - u * u));
    starPositions[i * 3] = sq * Math.cos(theta) * rad;
    starPositions[i * 3 + 1] = u * rad;
    starPositions[i * 3 + 2] = sq * Math.sin(theta) * rad;
    const tint = 0.65 + rng() * 0.35;
    starColors[i * 3] = tint * (rng() > 0.7 ? 1.0 : 0.75);
    starColors[i * 3 + 1] = tint * 0.92;
    starColors[i * 3 + 2] = tint;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    fog: false,
    depthWrite: false,
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // =========================================================
  // WORLD 2: PHOTOREALISTIC GEOLOGICAL TERRAIN & ENTITIES
  // =========================================================
  const surfaceGroup = new THREE.Group();
  scene.add(surfaceGroup);

  const grainTex = createGrainNormalTexture(rng, 256);
  const terrainMat = createTriplanarTerrainMaterial(grainTex);
  const terrainUniforms = terrainMat.userData.uniforms;

  const terrainGeo = new THREE.PlaneGeometry(240, 240, 320, 320);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    tPos.setY(i, sampleTerrainHeight(x, z));
  }
  terrainGeo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  surfaceGroup.add(terrainMesh);

  // Scattered Weathered Basalt Outcrops (InstancedMesh, deterministic Mulberry32)
  const boulderGeo = new THREE.DodecahedronGeometry(0.9, 2);
  const bPos = boulderGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const px = bPos.getX(i);
    const py = bPos.getY(i);
    const pz = bPos.getZ(i);
    const n = 0.84 + (Math.sin(px * 3.1 + py * 2.3 + pz * 2.7) * 0.5 + 0.5) * 0.28;
    bPos.setXYZ(i, px * n, py * n * 0.65, pz * n);
  }
  boulderGeo.computeVertexNormals();
  const boulderMat = new THREE.MeshStandardMaterial({
    color: 0x453b38,
    roughness: 0.88,
    metalness: 0.04,
  });
  const boulderCount = 220;
  const boulders = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
  boulders.castShadow = true;
  boulders.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < boulderCount; i++) {
    const bx = (rng() - 0.5) * 195;
    const bz = (rng() - 0.5) * 195;
    // Keep clear of Act 6 colony pad, Act 2 UI top-right zone, and Act 7 robotics corridor
    if (
      Math.hypot(bx + 28, bz + 38) < 12 ||
      Math.hypot(bx + 54, bz + 6) < 14 ||
      Math.hypot(bx - 58, bz + 14) < 10
    ) {
      continue;
    }
    const by = sampleTerrainHeight(bx, bz);
    const sc = 0.45 + rng() * 1.65;
    dummy.position.set(bx, by - sc * 0.15, bz);
    dummy.rotation.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5);
    dummy.scale.set(sc * (0.9 + rng() * 0.5), sc * 0.7, sc * (0.9 + rng() * 0.5));
    dummy.updateMatrix();
    boulders.setMatrixAt(i, dummy.matrix);
  }
  boulders.instanceMatrix.needsUpdate = true;
  surfaceGroup.add(boulders);

  // 3,000 Volumetric Suspended Dust Motes drifting through sunbeams
  const dustCount = 3000;
  const dustBase = new Float32Array(dustCount * 3);
  const dustCurr = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const dx = (rng() - 0.5) * 190;
    const dz = (rng() - 0.5) * 190;
    const dy = sampleTerrainHeight(dx, dz) + 0.5 + rng() * 24;
    dustBase[i * 3] = dx;
    dustBase[i * 3 + 1] = dy;
    dustBase[i * 3 + 2] = dz;
    dustCurr[i * 3] = dx;
    dustCurr[i * 3 + 1] = dy;
    dustCurr[i * 3 + 2] = dz;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustCurr, 3));
  const dustMat = new THREE.PointsMaterial({
    map: createDustTexture(64),
    color: 0xffd7b0,
    size: 0.42,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  surfaceGroup.add(dustPoints);

  // ---- ACT 1 SURFACE: Thousands of Glowing Human Rover Telemetry Pings ----
  const pingCount = 900;
  const pingGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6);
  pingGeo.translate(0, 0.9, 0);
  const pingMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  });
  const pingInst = new THREE.InstancedMesh(pingGeo, pingMat, pingCount);
  const pingData = [];
  for (let i = 0; i < pingCount; i++) {
    const px = -70 + rng() * 140;
    const pz = -10 + rng() * 95;
    const py = sampleTerrainHeight(px, pz);
    const delay = clamp01((Math.hypot(px + 18, pz - 48)) / 78) * 0.72 + rng() * 0.2;
    pingData.push({ x: px, y: py, z: pz, delay, phase: rng() * Math.PI * 2 });
    const c = new THREE.Color(i % 2 === 0 ? 0x00ff88 : 0x00f0ff);
    pingInst.setColorAt(i, c);
  }
  pingInst.instanceColor.needsUpdate = true;
  surfaceGroup.add(pingInst);

  // ---- ACT 2: Converging Lidar Crescent Emblem + Country Mesh + Hotspots + 3D Markers ----
  const lidarCount = 1600;
  const lidarTargets = new Float32Array(lidarCount * 3);
  const lidarStarts = new Float32Array(lidarCount * 3);
  const lidarCurr = new Float32Array(lidarCount * 3);
  const emblemCenter = new THREE.Vector3(-15, sampleTerrainHeight(-15, 42) + 8.5, 42);
  for (let i = 0; i < lidarCount; i++) {
    let tx, ty, tz;
    if (i < 1050) {
      // Crescent body built from outer arc + inner shadow cutout
      const a = -1.75 + (rng() * 3.5);
      const rOuter = 4.6;
      const band = rng();
      const px = Math.cos(a) * rOuter;
      const py = Math.sin(a) * rOuter;
      tx = px - band * 1.45;
      ty = py;
      tz = (rng() - 0.5) * 0.55;
    } else {
      // Inclined orbital ring
      const a = rng() * Math.PI * 2;
      const r = 5.4 + (rng() - 0.5) * 0.35;
      tx = Math.cos(a) * r;
      ty = Math.sin(a) * r * 0.32;
      tz = Math.sin(a) * r * 0.6;
    }
    lidarTargets[i * 3] = emblemCenter.x + tx;
    lidarTargets[i * 3 + 1] = emblemCenter.y + ty;
    lidarTargets[i * 3 + 2] = emblemCenter.z + tz;

    lidarStarts[i * 3] = emblemCenter.x + (rng() - 0.5) * 32;
    lidarStarts[i * 3 + 1] = emblemCenter.y - 6 + rng() * 18;
    lidarStarts[i * 3 + 2] = emblemCenter.z + (rng() - 0.5) * 28;
  }
  const lidarGeo = new THREE.BufferGeometry();
  lidarGeo.setAttribute('position', new THREE.BufferAttribute(lidarCurr, 3));
  const lidarMat = new THREE.PointsMaterial({
    color: 0x00f0ff,
    map: createDustTexture(64),
    size: 0.42,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lidarEmblem = new THREE.Points(lidarGeo, lidarMat);
  surfaceGroup.add(lidarEmblem);

  // Country/Sector Segmented Glowing Polygons (ES-IBERIA style tactical sector grid)
  const sectorBorders = [
    buildTerrainBorderLine(
      [
        [-38, 22], [-18, 16], [8, 19], [28, 30], [21, 50], [-4, 58], [-32, 54], [-42, 38], [-38, 22],
      ],
      0x00f0ff,
      0.42
    ),
    buildTerrainBorderLine(
      [
        [-28, 24], [-14, 38], [6, 36], [19, 26],
      ],
      0x3b82f6,
      0.34
    ),
    buildTerrainBorderLine(
      [
        [-22, 40], [-6, 42], [12, 48],
      ],
      0x3b82f6,
      0.34
    ),
  ];
  sectorBorders.forEach((b) => surfaceGroup.add(b.mesh));

  // Unexplored Thermal-Infrared Hotspot Polygons illuminated after radar sweep
  const hotspotBorder = buildTerrainBorderLine(
    [
      [-20, 26], [-5, 25], [-1, 36], [-15, 39], [-20, 26],
    ],
    0xff1e42,
    0.52
  );
  surfaceGroup.add(hotspotBorder.mesh);

  // 3 Pop-in Micro-Analog Markers (NODE_01, NODE_02, NODE_03)
  const nodeConfigs = [
    { id: 'node01', x: -29, z: 38, color: 0x00ff88 },
    { id: 'node02', x: -3, z: 42, color: 0x00f0ff },
    { id: 'node03', x: 16, z: 33, color: 0xff6b00 },
  ];
  const nodeMarkers = nodeConfigs.map((nc) => {
    const y = sampleTerrainHeight(nc.x, nc.z);
    const g = new THREE.Group();
    g.position.set(nc.x, y, nc.z);
    const mat = new THREE.MeshStandardMaterial({
      color: nc.color,
      emissive: nc.color,
      emissiveIntensity: 2.0,
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), mat);
    stem.position.y = 2.1;
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), mat);
    diamond.position.y = 4.6;
    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.5, 32),
      new THREE.MeshBasicMaterial({ color: nc.color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.3;
    g.add(stem, diamond, baseRing);
    g.scale.set(0.001, 0.001, 0.001);
    surfaceGroup.add(g);
    return { ...nc, y, group: g, diamond, mat };
  });

  // ---- ACT 3: CROWD-VERIFICATION SURVEY BEACON (26, 16) ----
  const beaconBeamMat = createBeaconBeamMaterial();
  const surveyBeacon = createSurveyBeacon(26, 16, beaconBeamMat);
  surfaceGroup.add(surveyBeacon.group);

  // 2 Converging GPS Vector Arcs arriving at Beacon
  const gpsOriginA = new THREE.Vector3(14, sampleTerrainHeight(14, 24) + 3.5, 24);
  const gpsOriginB = new THREE.Vector3(38, sampleTerrainHeight(38, 22) + 4.0, 22);
  const gpsTarget = new THREE.Vector3(26, sampleTerrainHeight(26, 16) + 2.7, 16);
  const gpsArcMatA = new THREE.MeshBasicMaterial({ color: 0xff6b00, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  const gpsArcMatB = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  const gpsArcA = buildArcTube(gpsOriginA, gpsTarget, 4.2, 0.08, gpsArcMatA, 32);
  const gpsArcB = buildArcTube(gpsOriginB, gpsTarget, 4.8, 0.08, gpsArcMatB, 32);
  surfaceGroup.add(gpsArcA, gpsArcB);

  // ---- ACT 4: ANTI-SYBIL HEX DOME (58, -14) + BOT SWARM + GEOFENCE + SPOOF ----
  const secCenter = new THREE.Vector3(58, sampleTerrainHeight(58, -14), -14);
  const hexMat = createHexShieldMaterial();
  const hexDome = new THREE.Mesh(new THREE.SphereGeometry(9.5, 36, 24), hexMat);
  hexDome.position.copy(secCenter);
  hexDome.position.y -= 0.4;
  surfaceGroup.add(hexDome);

  // Bot Swarm Streaking Missiles hitting the shield
  const botCount = 16;
  const botStreaks = [];
  const sparkCount = 180;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xff3b58,
    map: createDustTexture(64),
    size: 0.65,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  surfaceGroup.add(sparkPoints);

  const botGeo = new THREE.OctahedronGeometry(0.42, 0);
  const botWireMat = new THREE.MeshBasicMaterial({ color: 0xff1e42, wireframe: true });
  for (let i = 0; i < botCount; i++) {
    const a = -0.9 + (rng() * 1.8) + (i % 2) * Math.PI * 0.4;
    const h = 1.8 + rng() * 6.2;
    const dir = new THREE.Vector3(Math.cos(a), 0.15 + rng() * 0.3, Math.sin(a)).normalize();
    const hitPt = secCenter.clone().addScaledVector(dir, 9.5);
    const startPt = secCenter.clone().addScaledVector(dir, 27 + rng() * 8);
    startPt.y = secCenter.y + h;
    const mesh = new THREE.Mesh(botGeo, botWireMat);
    surfaceGroup.add(mesh);
    botStreaks.push({ mesh, startPt, hitPt, offset: (i / botCount) * 0.65 });
  }

  // Architectural Holographic Geofence Curtain + Emerald Laser Rails around (58, -14)
  const geoMat = createHolographicFenceMaterial();
  const geofenceCyl = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 2.8, 48, 1, true), geoMat);
  geofenceCyl.position.copy(secCenter);
  geofenceCyl.position.y += 1.4;
  surfaceGroup.add(geofenceCyl);

  const geoRingMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0 });
  const geoTopRing = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.08, 8, 64), geoRingMat);
  geoTopRing.rotation.x = Math.PI / 2;
  geoTopRing.position.copy(secCenter).add(new THREE.Vector3(0, 2.8, 0));
  const geoCenterPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.25, 4.5, 12),
    geoRingMat
  );
  geoCenterPillar.position.copy(secCenter).add(new THREE.Vector3(0, 2.25, 0));
  surfaceGroup.add(geoTopRing, geoCenterPillar);

  // Subtle expedition cave fill light so Karst cleft limestone remains luminous
  const karstFillLight = new THREE.PointLight(0x2898c8, 3.2, 26, 1.4);
  karstFillLight.position.set(44, sampleTerrainHeight(44, -6) + 4.5, -5);
  surfaceGroup.add(karstFillLight);

  // Remote Spoof Vector hitting outside Geofence and rejected
  const spoofMat = new THREE.MeshBasicMaterial({
    color: 0xff1e42,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const spoofOrigin = new THREE.Vector3(78, sampleTerrainHeight(78, -28) + 8, -28);
  const spoofHit = secCenter.clone().add(new THREE.Vector3(7.4, 2.4, -3.2));
  const spoofArc = buildArcTube(spoofOrigin, spoofHit, 2.8, 0.12, spoofMat, 24);
  const spoofXMat = new THREE.MeshBasicMaterial({ color: 0xff1e42, transparent: true, opacity: 0 });
  const spoofMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), spoofXMat);
  spoofMarker.position.copy(spoofHit);
  surfaceGroup.add(spoofArc, spoofMarker);

  // ---- ACT 5: DATA-GAP OUTCROP SCANNER RING (16, -32) ----
  const gapPos = new THREE.Vector3(16, sampleTerrainHeight(16, -32), -32);
  const gapRingMat = new THREE.MeshBasicMaterial({
    color: 0xb829ff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const gapRing = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.65, 48), gapRingMat);
  gapRing.rotation.x = -Math.PI / 2;
  gapRing.position.set(gapPos.x, gapPos.y + 0.35, gapPos.z);
  const gapBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.95, 8.5, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  gapBeam.position.set(gapPos.x, gapPos.y + 4.25, gapPos.z);
  surfaceGroup.add(gapRing, gapBeam);

  // ---- ACT 6: VIRTUAL SPACE COLONY (-28, -38) ----
  const colony = createVirtualColony(-28, -38);
  surfaceGroup.add(colony.root);

  // ---- ACT 7: VOLCANIC FISSURE, HAZARD LASER FENCE & TIER 3 ROBOTICS (-60, -8) ----
  const fissurePos = new THREE.Vector3(-60, sampleTerrainHeight(-60, -8), -8);
  const fissureLight = new THREE.PointLight(0xff4210, 0, 28, 1.5);
  fissureLight.position.set(-60, fissurePos.y + 1.5, -8);
  surfaceGroup.add(fissureLight);

  // Rising Volcanic Smoke Plume Particles
  const smokeCount = 160;
  const smokeCurr = new Float32Array(smokeCount * 3);
  const smokeSeeds = [];
  for (let i = 0; i < smokeCount; i++) {
    smokeSeeds.push({
      ox: (rng() - 0.5) * 4.5,
      oz: (rng() - 0.5) * 9.0,
      phase: rng(),
      speed: 0.4 + rng() * 0.45,
      drift: (rng() - 0.5) * 2.2,
    });
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeCurr, 3));
  const smokeMat = new THREE.PointsMaterial({
    map: createDustTexture(64),
    color: 0xff6b35,
    size: 1.5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  surfaceGroup.add(smokePoints);

  // Volumetric Red Laser Hazard Fence across rim
  const fenceGroup = new THREE.Group();
  const fenceMat = new THREE.MeshBasicMaterial({
    color: 0xff1e42,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x20242c, metalness: 0.8, roughness: 0.3 });
  const fencePylons = [
    [-55, -14],
    [-55, -8],
    [-55, -2],
  ];
  fencePylons.forEach(([fx, fz]) => {
    const fy = sampleTerrainHeight(fx, fz);
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.6, 8), pylonMat);
    pylon.position.set(fx, fy + 1.6, fz);
    fenceGroup.add(pylon);
  });
  for (const hOff of [0.85, 1.55, 2.25, 2.95]) {
    const y0 = sampleTerrainHeight(-55, -14) + hOff;
    const y1 = sampleTerrainHeight(-55, -2) + hOff;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 12.2, 8), fenceMat);
    beam.position.set(-55, (y0 + y1) * 0.5, -8);
    beam.rotation.x = Math.PI / 2;
    fenceGroup.add(beam);
  }
  surfaceGroup.add(fenceGroup);

  const scanMat = createMultispectralScanMaterial();
  const robotics = createTier3Robotics(scanMat);
  surfaceGroup.add(robotics.rover);
  surfaceGroup.add(robotics.drone);

  // =========================================================
  // CINEMA CAMERA SPLINES (CatmullRomCurve3 per Act)
  // =========================================================
  const camOrbitAct1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(34, 15, 76),
    new THREE.Vector3(24, 11, 66),
    new THREE.Vector3(10, 7, 52),
  ]);
  const lookOrbitAct1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4, -3, 0),
    new THREE.Vector3(-6, -2, 2),
    new THREE.Vector3(-8, -2, 4),
  ]);

  const camSurfAct1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-25, sampleTerrainHeight(-25, 76) + 12, 76),
    new THREE.Vector3(-21, sampleTerrainHeight(-21, 66) + 8.5, 66),
    new THREE.Vector3(-17, sampleTerrainHeight(-17, 56) + 7.2, 56),
  ]);
  const lookSurfAct1 = new THREE.Vector3(-14, sampleTerrainHeight(-14, 34) + 2.5, 34);

  const camAct2Map = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-17, sampleTerrainHeight(-17, 56) + 7.2, 56),
    new THREE.Vector3(-14, sampleTerrainHeight(-14, 58) + 13.5, 58),
    new THREE.Vector3(-10, 38, 72),
    new THREE.Vector3(-6, 44, 76),
  ]);
  const lookAct2Map = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-15, emblemCenter.y, 42),
    new THREE.Vector3(-12, 8, 40),
    new THREE.Vector3(-8, 1.5, 34),
    new THREE.Vector3(-6, 1.0, 33),
  ]);

  const bY = sampleTerrainHeight(26, 16);
  const camAct3Beacon = new THREE.CatmullRomCurve3([
    new THREE.Vector3(16.5, bY + 4.4, 29.0),
    new THREE.Vector3(22.5, bY + 3.6, 26.8),
    new THREE.Vector3(31.5, bY + 3.4, 26.2),
  ]);
  const lookAct3Beacon = new THREE.Vector3(26, bY + 2.2, 16);

  const sY = sampleTerrainHeight(58, -14);
  const kY = sampleTerrainHeight(44, -6);
  const camAct4Sec = new THREE.CatmullRomCurve3([
    new THREE.Vector3(44.5, sY + 9.2, 8.0),
    new THREE.Vector3(48.0, sY + 8.4, 5.2),
    new THREE.Vector3(42.5, kY + 5.2, -1.8), // Illuminated Karst canyon rim
    new THREE.Vector3(46.0, kY + 6.4, -3.5), // Rising smoothly over cleft
    new THREE.Vector3(45.5, sY + 9.2, 1.5),  // Clean wide 3/4 view overlooking holographic geofence
  ]);
  const lookAct4Sec = new THREE.CatmullRomCurve3([
    new THREE.Vector3(58, sY + 2.2, -14),
    new THREE.Vector3(58, sY + 2.2, -14),
    new THREE.Vector3(51, kY + 2.0, -9),
    new THREE.Vector3(58, sY + 2.2, -14),
  ]);

  const gY = sampleTerrainHeight(16, -32);
  const camAct5Gap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(23, gY + 8.0, -15.5),
    new THREE.Vector3(16, gY + 7.4, -17.0),
    new THREE.Vector3(10, gY + 7.0, -19.0),
  ]);
  const lookAct5Gap = new THREE.Vector3(14, gY + 2.6, -32);

  const cY = sampleTerrainHeight(-28, -38);
  const camAct6Colony = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-12, cY + 13.5, -20),
    new THREE.Vector3(-25, cY + 15.2, -17),
    new THREE.Vector3(-42, cY + 13.2, -23),
  ]);
  const lookAct6Colony = new THREE.Vector3(-28, cY + 1.8, -38);

  const fY = sampleTerrainHeight(-60, -8);
  const rimY = sampleTerrainHeight(-51, -3.0);
  const camAct7Robot = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-33.5, rimY + 7.6, 11.5),
    new THREE.Vector3(-36.2, rimY + 6.9, 9.6),
    new THREE.Vector3(-38.8, rimY + 6.6, 8.8),
  ]);
  const lookAct7Robot = new THREE.Vector3(-56.5, fY + 4.8, -6.5);

  const camOrbitFinale = new THREE.CatmullRomCurve3([
    new THREE.Vector3(8, 6, 48),
    new THREE.Vector3(22, 10, 68),
    new THREE.Vector3(34, 14, 86),
  ]);
  const lookOrbitFinale = new THREE.Vector3(-2, -4, 0);

  // =========================================================
  // EFFECT COMPOSER POST-PROCESSING PIPELINE (Exact Order)
  // =========================================================
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.48, 0.65, 0.78);
  composer.addPass(bloomPass);

  const bokehPass = new BokehPass(scene, camera, {
    focus: 35.0,
    aperture: 0.000045,
    maxblur: 0.0045,
  });
  composer.addPass(bokehPass);

  const finalCinemaPass = new ShaderPass(CinemaPostShader);
  composer.addPass(finalCinemaPass);

  // Reusable anchor vectors & scratch state (zero per-frame allocations)
  const tmpCamPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const projectedAnchors = {};

  function projectAnchor(id, worldVec) {
    const v = worldVec.clone().project(camera);
    const sx = (v.x * 0.5 + 0.5) * WIDTH;
    const sy = (-v.y * 0.5 + 0.5) * HEIGHT;
    const visible = v.z < 1.0 && sx >= -80 && sx <= WIDTH + 80 && sy >= -80 && sy <= HEIGHT + 80;
    projectedAnchors[id] = { x: sx, y: sy, visible };
  }

  /**
   * Deterministic evaluation at exact frame (0..1800) / elapsedSeconds (0..30).
   */
  function updateAtTime(elapsedSeconds) {
    const f = clamp01(elapsedSeconds / 30.0) * 1800.0;
    const uTime = elapsedSeconds;

    // 1. Update shader clocks
    earthMat.uniforms.uTime.value = uTime;
    cloudMat.uniforms.uTime.value = uTime;
    terrainUniforms.uTime.value = uTime;
    beaconBeamMat.uniforms.uTime.value = uTime;
    hexMat.uniforms.uTime.value = uTime;
    geoMat.uniforms.uTime.value = uTime;
    scanMat.uniforms.uTime.value = uTime;
    finalCinemaPass.uniforms.uFrame.value = Math.floor(f + 0.5);

    // 2. Orbital rotation vs Surface visibility switch
    const isOrbitalAct1 = f < 102;
    const isOrbitalFinale = f >= 1680;
    const showOrbital = isOrbitalAct1 || isOrbitalFinale;
    orbitalGroup.visible = showOrbital;
    surfaceGroup.visible = !showOrbital;

    earthMesh.rotation.y = -0.75 + uTime * 0.045;
    cloudMesh.rotation.y = -0.6 + uTime * 0.068;
    constellationGroup.rotation.y = earthMesh.rotation.y;
    constellationGroup.visible = isOrbitalFinale;
    launchArcMesh.visible = isOrbitalAct1;
    // Keep 3D red slash hidden so the crisp CSS odometer laser beam stays razor-sharp
    crimsonSlash.visible = false;

    if (isOrbitalFinale) {
      const rev = smoothstep(1685, 1735, f);
      constellationMats.forEach((m) => (m.opacity = 0.72 * rev));
    }

    // 3. Dust motes deterministic drift (when surface visible)
    if (surfaceGroup.visible) {
      const posAttr = dustGeo.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        const bx = dustBase[i * 3];
        const by = dustBase[i * 3 + 1];
        const bz = dustBase[i * 3 + 2];
        posAttr.setXYZ(
          i,
          bx + Math.sin(uTime * 0.55 + i * 0.37) * 1.4,
          by + Math.cos(uTime * 0.42 + i * 0.71) * 0.65,
          bz + Math.cos(uTime * 0.48 + i * 0.53) * 1.4
        );
      }
      posAttr.needsUpdate = true;
    }

    // 4. Camera Spline + Dynamic Chromatic Aberration Whip-Pans + Bokeh Depth
    let rgbShift = 0.0008;
    let aperture = 0.000042;
    let focusDist = 32.0;

    if (f < 102) {
      // ACT 1 Orbit
      const u = clamp01(f / 98);
      camOrbitAct1.getPointAt(u, tmpCamPos);
      lookOrbitAct1.getPointAt(u, tmpLook);
      if (f >= 84) {
        const plunge = smoothstep(84, 102, f);
        tmpCamPos.z -= plunge * 20;
        tmpCamPos.y -= plunge * 5;
        // Brief shake + crisp chromatic spike on crimson laser slash
        const shake = Math.sin(f * 3.1) * (1.0 - smoothstep(90, 100, f));
        tmpCamPos.x += shake * 0.55;
        tmpCamPos.y += Math.cos(f * 4.3) * 0.35 * (1.0 - smoothstep(90, 100, f));
        rgbShift = 0.0042;
      }
      aperture = 0.000018;
    } else if (f < 210) {
      // ACT 1 Surface Canyon + Telemetry Pings
      const u = clamp01((f - 102) / 108);
      camSurfAct1.getPointAt(u, tmpCamPos);
      tmpLook.copy(lookSurfAct1);
      if (f < 108) rgbShift = 0.009;
      aperture = 0.000038;
    } else if (f < 480) {
      // ACT 2 Lidar Crescent Emblem -> Dual-Layer Interactive Map
      const u = clamp01((f - 210) / 270);
      camAct2Map.getPointAt(u, tmpCamPos);
      lookAct2Map.getPointAt(u, tmpLook);
      aperture = lerp(0.000048, 0.000024, smoothstep(285, 360, f));
    } else if (f < 780) {
      // ACT 3 Crowd-Verification Survey Beacon
      const u = clamp01((f - 480) / 300);
      camAct3Beacon.getPointAt(u, tmpCamPos);
      tmpLook.copy(lookAct3Beacon);
      if (f < 486) rgbShift = 0.009;
      aperture = 0.000085; // Shallow 75mm bokeh on foreground basalt rocks
    } else if (f < 1050) {
      // ACT 4 Security Dome + Offline Karst Cave Emergence
      const u = clamp01((f - 780) / 270);
      camAct4Sec.getPointAt(u, tmpCamPos);
      lookAct4Sec.getPointAt(u, tmpLook);
      if (f < 785) rgbShift = 0.009;
      aperture = 0.000062;
    } else if (f < 1290) {
      // ACT 5 Targeted Data-Gap Scanner
      const u = clamp01((f - 1050) / 240);
      camAct5Gap.getPointAt(u, tmpCamPos);
      tmpLook.copy(lookAct5Gap);
      if (f < 1055) rgbShift = 0.009;
      aperture = 0.000065;
    } else if (f < 1530) {
      // ACT 6 Virtual Space Colony Isometric Assembly
      const u = clamp01((f - 1290) / 240);
      camAct6Colony.getPointAt(u, tmpCamPos);
      tmpLook.copy(lookAct6Colony);
      if (f < 1295) rgbShift = 0.009;
      aperture = 0.000044;
    } else if (f < 1680) {
      // ACT 7 Tier 3 Volcanic Fissure & Autonomous Robotics
      const u = clamp01((f - 1530) / 150);
      camAct7Robot.getPointAt(u, tmpCamPos);
      tmpLook.copy(lookAct7Robot);
      if (f < 1536) rgbShift = 0.009;
      aperture = 0.00006;
    } else {
      // ACT 7 Jury Finale Orbital Pull-back
      const u = smoothstep(1680, 1800, f);
      camOrbitFinale.getPointAt(u, tmpCamPos);
      tmpLook.copy(lookOrbitFinale);
      if (f < 1686) rgbShift = 0.009;
      aperture = 0.000018;
    }

    // Continuous subtle low-frequency handheld/aerial drone drift (±0.15 units)
    tmpCamPos.x += Math.sin(uTime * 1.15) * 0.14;
    tmpCamPos.y += Math.cos(uTime * 0.92 + 0.8) * 0.11;
    tmpCamPos.z += Math.sin(uTime * 0.78 + 1.9) * 0.12;

    if (surfaceGroup.visible) {
      tmpCamPos.y = Math.max(tmpCamPos.y, sampleTerrainHeight(tmpCamPos.x, tmpCamPos.z) + 2.6);
    }

    camera.position.copy(tmpCamPos);
    camera.lookAt(tmpLook);
    camera.updateMatrixWorld();

    focusDist = camera.position.distanceTo(tmpLook);
    bokehPass.uniforms['focus'].value = focusDist;
    bokehPass.uniforms['aperture'].value = aperture;
    finalCinemaPass.uniforms.uRGBShift.value = rgbShift;

    // 5. Scene-specific entity animations (every frame 0..1800)

    // --- Act 1 Telemetry Pings ---
    const showPings = f >= 100 && f < 290;
    pingInst.visible = showPings;
    if (showPings) {
      const revealP = smoothstep(115, 195, f) * (1.0 - smoothstep(235, 290, f));
      for (let i = 0; i < pingCount; i++) {
        const d = pingData[i];
        const s = clamp01((revealP - d.delay) * 4.5);
        const pulse = 0.85 + 0.35 * Math.sin(uTime * 6.0 + d.phase);
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(s, s * pulse, s);
        dummy.updateMatrix();
        pingInst.setMatrixAt(i, dummy.matrix);
      }
      pingInst.instanceMatrix.needsUpdate = true;
    }

    // --- Act 2 Lidar Emblem + Sector Map + Dual Layer ---
    const lidarFade = smoothstep(210, 232, f) * (1.0 - smoothstep(285, 315, f));
    lidarMat.opacity = lidarFade * 0.9;
    lidarEmblem.visible = lidarFade > 0.005;
    if (lidarEmblem.visible) {
      const formP = easeOutBack(smoothstep(212, 265, f));
      const posAttr = lidarGeo.attributes.position;
      for (let i = 0; i < lidarCount; i++) {
        const swirl = (1.0 - clamp01(formP)) * 4.0;
        posAttr.setXYZ(
          i,
          lerp(lidarStarts[i * 3], lidarTargets[i * 3], clamp01(formP)) + Math.sin(uTime * 3 + i) * swirl * 0.25,
          lerp(lidarStarts[i * 3 + 1], lidarTargets[i * 3 + 1], clamp01(formP)),
          lerp(lidarStarts[i * 3 + 2], lidarTargets[i * 3 + 2], clamp01(formP)) + Math.cos(uTime * 3 + i) * swirl * 0.25
        );
      }
      posAttr.needsUpdate = true;
    }

    const sectorAlpha = smoothstep(290, 325, f) * (1.0 - smoothstep(465, 485, f));
    sectorBorders.forEach((b) => (b.material.opacity = sectorAlpha * 0.88));
    const hotspotAlpha = smoothstep(340, 385, f) * (1.0 - smoothstep(465, 485, f));
    hotspotBorder.material.opacity = hotspotAlpha * (0.65 + 0.35 * Math.sin(uTime * 6.5));

    terrainUniforms.uRadarSweepAlpha.value = smoothstep(300, 330, f) * (1.0 - smoothstep(465, 485, f));
    terrainUniforms.uRadarSweepRadius.value = smoothstep(305, 435, f) * 58.0;

    nodeMarkers.forEach((nm, idx) => {
      const startF = 365 + idx * 18;
      const s = smoothstep(startF, startF + 22, f) * (1.0 - smoothstep(465, 485, f));
      const bounce = s > 0 ? easeOutBack(Math.min(1, s * 1.15)) * (1.0 - smoothstep(465, 485, f)) : 0.001;
      nm.group.scale.setScalar(Math.max(0.001, bounce));
      nm.diamond.rotation.y = uTime * 2.4 + idx;
      projectAnchor(nm.id, new THREE.Vector3(nm.x, nm.y + 4.8, nm.z));
    });

    // --- Act 3 Survey Beacon Traffic Light ---
    const bAlpha = smoothstep(470, 495, f) * (1.0 - smoothstep(765, 795, f));
    beaconBeamMat.uniforms.uOpacity.value = bAlpha * 0.92;
    surveyBeacon.orb.rotation.y = uTime * 2.5;
    surveyBeacon.collar.rotation.z = uTime * 1.4;

    const cGrey = new THREE.Color('#8E9BAE');
    const cOrange = new THREE.Color('#FF6B00');
    const cGreen = new THREE.Color('#00FF88');
    const cBeacon = cGrey.clone();
    if (f >= 570 && f < 675) {
      cBeacon.lerpColors(cGrey, cOrange, smoothstep(570, 595, f));
    } else if (f >= 675) {
      cBeacon.lerpColors(cOrange, cGreen, smoothstep(675, 695, f));
    }
    beaconBeamMat.uniforms.uColor.value.copy(cBeacon);
    surveyBeacon.coreMat.color.copy(cBeacon);
    surveyBeacon.coreMat.emissive.copy(cBeacon);
    surveyBeacon.beaconLight.color.copy(cBeacon);
    surveyBeacon.beaconLight.intensity = f >= 675 ? 9.5 * bAlpha : f >= 570 ? 6.5 * bAlpha : 2.5 * bAlpha;

    terrainUniforms.uBeaconColor.value.copy(cBeacon);
    terrainUniforms.uBeaconStrength.value = bAlpha * (f >= 675 ? 0.95 : 0.68);
    terrainUniforms.uBeaconRingRadius.value = f >= 682 ? smoothstep(682, 748, f) * 28.0 : 0.0;

    // GPS vector arcs in Stage 2 (570–675f)
    const gpsVis = smoothstep(572, 595, f) * (1.0 - smoothstep(675, 705, f));
    gpsArcMatA.opacity = gpsVis * 0.9;
    gpsArcMatB.opacity = gpsVis * 0.9;

    const radarRingP = (uTime * 0.9) % 1.0;
    surveyBeacon.radarRing.scale.setScalar(0.6 + radarRingP * 2.8);
    surveyBeacon.ringMat.color.copy(cBeacon);
    surveyBeacon.ringMat.opacity = gpsVis * (1.0 - radarRingP) * 0.85;

    projectAnchor('beacon', new THREE.Vector3(26, bY + 3.2, 16));

    // --- Act 4 Anti-Sybil Hex Dome + Bot Swarm + Geofence ---
    const shieldVis = smoothstep(778, 815, f) * (1.0 - smoothstep(905, 935, f));
    hexMat.uniforms.uOpacity.value = shieldVis * 0.82;
    const impactPulse = (0.18 + 0.14 * Math.sin(uTime * 3.0)) * shieldVis;
    hexMat.uniforms.uImpactPulse.value = impactPulse;
    sparkPoints.visible = shieldVis > 0.01;
    sparkMat.opacity = shieldVis * 0.95;

    const spAttr = sparkGeo.attributes.position;
    for (let i = 0; i < botCount; i++) {
      const b = botStreaks[i];
      b.mesh.visible = shieldVis > 0.05;
      if (!b.mesh.visible) continue;
      const prog = (clamp01((f - 790) / 110) * 2.2 + b.offset) % 1.0;
      b.mesh.position.lerpVectors(b.startPt, b.hitPt, prog);
      b.mesh.rotation.x += 0.25;
      b.mesh.rotation.y += 0.35;
      // Burst sparks right around impact point
      const sparkBase = i * 10;
      const burstT = Math.max(0, (prog - 0.72) / 0.28);
      for (let k = 0; k < 10; k++) {
        const si = sparkBase + k;
        if (si >= sparkCount) break;
        const angle = (k / 10) * Math.PI * 2 + i;
        spAttr.setXYZ(
          si,
          b.hitPt.x + Math.cos(angle) * burstT * 2.4,
          b.hitPt.y + Math.sin(angle * 1.7) * burstT * 2.4,
          b.hitPt.z + Math.sin(angle) * burstT * 2.4
        );
      }
    }
    spAttr.needsUpdate = true;

    const geoVis = smoothstep(958, 988, f) * (1.0 - smoothstep(1042, 1065, f));
    geoMat.uniforms.uOpacity.value = geoVis;
    geoRingMat.opacity = geoVis * 0.85;
    geofenceCyl.visible = geoVis > 0.01;
    geoTopRing.visible = geoVis > 0.01;
    geoCenterPillar.visible = geoVis > 0.01;
    geofenceCyl.scale.set(1, 0.05 + geoVis * 0.95, 1);
    const spoofVis = smoothstep(988, 1008, f) * (1.0 - smoothstep(1042, 1065, f));
    spoofMat.opacity = spoofVis * 0.88;
    spoofXMat.opacity = spoofVis;
    spoofMarker.rotation.y = uTime * 4.5;

    projectAnchor('shield', new THREE.Vector3(58, sY + 5.2, -14));
    projectAnchor('geofence', new THREE.Vector3(58, sY + 3.6, -14));
    projectAnchor('spoof', spoofHit);

    // --- Act 5 Data-Gap Scanner ---
    const gapVis = smoothstep(1050, 1072, f) * (1.0 - smoothstep(1275, 1300, f));
    terrainUniforms.uGapScanAlpha.value = gapVis;
    terrainUniforms.uGapScanPhase.value = ((f - 1050) * 0.025) % 1.0;
    gapRingMat.opacity = gapVis * 0.82;
    gapBeam.material.opacity = gapVis * 0.22;
    gapRing.scale.setScalar(0.85 + Math.sin(uTime * 4.5) * 0.12);
    projectAnchor('gapNode', new THREE.Vector3(16, gY + 3.2, -32));

    // --- Act 6 Collaborative Virtual Space Colony ---
    const colVis = smoothstep(1285, 1305, f);
    colony.root.visible = colVis > 0.01 && f < 1545;
    if (colony.root.visible) {
      // Step 1: Genesis Module descent & landing dust ring (1290..1395f)
      const descendP = smoothstep(1292, 1338, f);
      const dropY = (1.0 - descendP) * 14.0;
      colony.genesis.position.y = dropY;
      colony.struts.forEach((st) => {
        st.scale.y = 0.25 + smoothstep(1300, 1335, f) * 0.75;
      });

      const dustP = smoothstep(1332, 1372, f);
      colony.dustRing.scale.setScalar(0.75 + dustP * 2.4);
      colony.dustRingMat.opacity = dustP > 0 && dustP < 1 ? Math.sin(dustP * Math.PI) * 0.68 : 0;

      // Color Picker transition: Cyan #00F0FF -> Solar Gold #FFB800 -> Gold+Cyan blend
      const colorShift = smoothstep(1352, 1384, f);
      const trimCol = new THREE.Color('#00F0FF').lerp(new THREE.Color('#FFB800'), colorShift);
      colony.trimMat.color.copy(trimCol);
      colony.trimMat.emissive.copy(trimCol);
      colony.flagMat.color.copy(trimCol);
      colony.flagMat.emissive.copy(trimCol);

      // Step 2: Modular Extensions + Airlock Tunnels (1395..1530f)
      colony.expansions.forEach((exp, idx) => {
        const startF = 1396 + idx * 28;
        const extP = smoothstep(startF, startF + 22, f);
        const dropP = smoothstep(startF + 10, startF + 38, f);
        const recoil = dropP > 0 ? Math.sin(dropP * Math.PI) * 0.22 : 0;
        exp.tunnel.visible = extP > 0.01;
        exp.tunnel.scale.set(extP, 1, 1);
        exp.pod.visible = dropP > 0.01;
        exp.pod.position.y = 0.1 + (1.0 - Math.min(1, easeOutBack(dropP))) * 12.0 - recoil;
      });
    }
    projectAnchor('genesis', new THREE.Vector3(-28, cY + 4.4, -38));
    projectAnchor('expansion', new THREE.Vector3(-22, cY + 3.2, -33));

    // --- Act 7 Volcanic Fissure, Hazard Fence & Tier 3 Robotics ---
    const robVis = f >= 1525 && f < 1685;
    terrainUniforms.uFissureGlow.value = robVis ? 1.0 : 0.0;
    fissureLight.intensity = robVis ? 14.0 + Math.sin(uTime * 11) * 3.0 : 0.0;
    fenceGroup.visible = robVis;
    smokePoints.visible = robVis;
    robotics.rover.visible = robVis;
    robotics.drone.visible = robVis;

    if (robVis) {
      const fenceDrop = smoothstep(1532, 1554, f);
      fenceGroup.position.y = (1.0 - fenceDrop) * 8.0;
      fenceMat.opacity = fenceDrop * (0.72 + 0.28 * Math.sin(uTime * 18));

      // Rover rolling along illuminated basalt rim (centered-right, 100% inside 16:9 safe frame)
      const rovP = smoothstep(1550, 1655, f);
      const rx = lerp(-47.2, -52.5, rovP);
      const rz = lerp(-1.2, -4.0, rovP);
      const ry = sampleTerrainHeight(rx, rz);
      robotics.rover.position.set(rx, ry, rz);
      const norm = sampleTerrainNormal(rx, rz);
      const fwd = new THREE.Vector3(-1, 0, -0.42).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, norm).normalize();
      const orthoFwd = new THREE.Vector3().crossVectors(norm, right).normalize();
      const m = new THREE.Matrix4().makeBasis(orthoFwd, norm, right);
      robotics.rover.quaternion.setFromRotationMatrix(m);
      robotics.wheels.forEach((w) => (w.rotation.z = rovP * 14.0));

      // Drone hovering cleanly inside upper-center frame casting multispectral scan curtain onto basalt cliff
      const drP = smoothstep(1548, 1675, f);
      const dx = -60.2 + Math.sin(drP * Math.PI) * 1.4;
      const dz = lerp(-11.5, -5.8, smoothstep(1575, 1665, f));
      const dy = sampleTerrainHeight(-60, -8) + 8.6 + Math.sin(uTime * 3.2) * 0.25;
      robotics.drone.position.set(dx, dy, dz);
      robotics.rotors.forEach((r, idx) => (r.rotation.y = uTime * (idx % 2 === 0 ? 48 : -48)));

      const scanActive = smoothstep(1578, 1595, f);
      scanMat.uniforms.uOpacity.value = scanActive * 0.85;
      terrainUniforms.uScanAlpha.value = scanActive;
      terrainUniforms.uScanPlaneZ.value = dz;

      // Subtle rising volcanic embers
      smokeMat.opacity = 0.22;
      const smAttr = smokeGeo.attributes.position;
      for (let i = 0; i < smokeCount; i++) {
        const s = smokeSeeds[i];
        const age = (s.phase + uTime * s.speed * 0.25) % 1.0;
        smAttr.setXYZ(
          i,
          -60 + s.ox + Math.sin(age * 6.0 + i) * 0.9 + age * s.drift,
          fY - 3.5 + age * 16.0,
          -8 + s.oz + Math.cos(age * 5.0 + i) * 0.9
        );
      }
      smAttr.needsUpdate = true;

      projectAnchor('hazard', new THREE.Vector3(-55, sampleTerrainHeight(-55, -8) + 3.2, -8));
      projectAnchor('rover', new THREE.Vector3(rx, ry + 1.9, rz));
      projectAnchor('drone', new THREE.Vector3(dx, dy + 0.5, dz));
    }

    // 6. Execute EffectComposer (RenderPass -> UnrealBloomPass -> BokehPass -> CinemaPostShader)
    composer.render();

    return {
      projectedAnchors,
      focusDistance: focusDist,
    };
  }

  return {
    updateAtTime,
    renderer,
    scene,
    camera,
    composer,
  };
}
