import { AUDIO_ENVELOPE } from './audioEnvelope.js';

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/**
 * Samples deterministic 60fps audio envelope extracted from mastered voiceover + SFX stems.
 */
function sampleVoiceoverEnvelope(elapsedSeconds) {
  const f = clamp01(elapsedSeconds / 30.0) * 1800.0;
  const i0 = Math.min(1800, Math.floor(f));
  const i1 = Math.min(1800, i0 + 1);
  const frac = f - i0;
  return AUDIO_ENVELOPE[i0] * (1.0 - frac) + AUDIO_ENVELOPE[i1] * frac;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function ensureLeader(svg, id, color) {
  let g = svg.querySelector(`[data-leader="${id}"]`);
  if (!g) {
    g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-leader', id);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '1.0');
    path.setAttribute('stroke-linecap', 'round');
    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.setAttribute('r', '9');
    halo.setAttribute('fill', 'none');
    halo.setAttribute('stroke-width', '1.2');
    halo.setAttribute('opacity', '0.55');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '4');
    g.append(path, halo, dot);
    svg.appendChild(g);
  }
  const path = g.children[0];
  const halo = g.children[1];
  const dot = g.children[2];
  path.setAttribute('stroke', color);
  halo.setAttribute('stroke', color);
  dot.setAttribute('fill', color);
  return { g, path, halo, dot };
}

function setLeaderLine(svg, id, anchor, cardX, cardY, color, opacity, uTime = 0) {
  const { g, path, halo, dot } = ensureLeader(svg, id, color);
  if (!anchor || !anchor.visible || opacity <= 0.02) {
    g.setAttribute('opacity', '0');
    return;
  }
  const ax = Math.max(40, Math.min(1880, anchor.x));
  const ay = Math.max(40, Math.min(1040, anchor.y));
  const midX = ax + (cardX - ax) * 0.45;
  const d = `M ${ax.toFixed(1)} ${ay.toFixed(1)} L ${midX.toFixed(1)} ${cardY.toFixed(1)} L ${cardX.toFixed(1)} ${cardY.toFixed(1)}`;
  path.setAttribute('d', d);
  dot.setAttribute('cx', ax.toFixed(1));
  dot.setAttribute('cy', ay.toFixed(1));
  halo.setAttribute('cx', ax.toFixed(1));
  halo.setAttribute('cy', ay.toFixed(1));
  halo.setAttribute('r', (7.5 + Math.sin(uTime * 6.0) * 2.5).toFixed(1));
  g.setAttribute('opacity', opacity.toFixed(3));
}

function positionCard(el, x, y, originX = 0, originY = 0) {
  if (!el) return;
  const px = Math.max(36, Math.min(1884, x));
  const py = Math.max(76, Math.min(970, y));
  el.style.left = `${px.toFixed(1)}px`;
  el.style.top = `${py.toFixed(1)}px`;
  el.style.transform = `translate(${originX}%, ${originY}%)`;
}

function setAlpha(el, alpha, mode = 'block') {
  if (!el) return;
  if (alpha <= 0.005) {
    el.style.display = 'none';
    el.style.opacity = '0';
  } else {
    el.style.display = mode;
    el.style.opacity = alpha.toFixed(3);
  }
}

export function createHudOverlay() {
  const root = document.getElementById('hud-root');
  const leaderSvg = document.getElementById('hud-leader-svg');
  const waveformEl = document.getElementById('hud-waveform');

  // Build 28 deterministic audio-reactive waveform visualizer bars once
  const waveBars = [];
  waveformEl.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const bar = document.createElement('div');
    bar.className = 'wf-bar';
    waveformEl.appendChild(bar);
    waveBars.push(bar);
  }

  // Persistent HUD readouts
  const frameEl = document.getElementById('hud-frame');
  const clockEl = document.getElementById('hud-clock');
  const dofEl = document.getElementById('hud-dof');
  const actTagEl = document.getElementById('hud-act-tag');
  const liveLedEl = document.getElementById('hud-live-led');
  const progressFillEl = document.getElementById('hud-progress-fill');
  const milestoneEls = Array.from(document.querySelectorAll('.hud-milestone'));

  // Act 1 refs
  const act1LaunchEl = document.getElementById('act1-launch');
  const act1OdoEl = document.getElementById('act1-odo');
  const act1SlashEl = document.getElementById('act1-slash');
  const act1RoversEl = document.getElementById('act1-rovers');

  // Act 2 refs
  const act2BrandEl = document.getElementById('act2-brand');
  const act2MapHudEl = document.getElementById('act2-map-hud');
  const nodeCard01 = document.getElementById('card-node01');
  const nodeCard02 = document.getElementById('card-node02');
  const nodeCard03 = document.getElementById('card-node03');

  // Act 3 refs
  const act3CardEl = document.getElementById('act3-card');
  const act3HeaderEl = document.getElementById('act3-header');
  const act3CountEl = document.getElementById('act3-count');
  const act3MetaEl = document.getElementById('act3-meta');
  const act3StampEl = document.getElementById('act3-stamp');
  const act3Segs = [
    document.getElementById('act3-seg-1'),
    document.getElementById('act3-seg-2'),
    document.getElementById('act3-seg-3'),
  ];

  // Act 4 refs
  const act4ShieldCardEl = document.getElementById('act4-shield-card');
  const act4OfflineEl = document.getElementById('act4-offline-card');
  const act4PushEl = document.getElementById('act4-push-card');
  const act4PushBtnEl = document.getElementById('act4-push-btn');
  const act4CursorEl = document.getElementById('act4-cursor');
  const act4ProxEl = document.getElementById('act4-prox-card');
  const act4SpoofEl = document.getElementById('act4-spoof-card');

  // Act 5 refs
  const act5GapCardEl = document.getElementById('act5-gap-card');
  const act5BountyCardEl = document.getElementById('act5-bounty-card');
  const act5MultiEl = document.getElementById('act5-multiplier');
  const act5EconomyEl = document.getElementById('act5-economy-row');
  const act5XpEl = document.getElementById('act5-xp');

  // Act 6 refs
  const act6GenesisEl = document.getElementById('act6-genesis-card');
  const act6SwatchCyan = document.getElementById('act6-swatch-cyan');
  const act6SwatchGold = document.getElementById('act6-swatch-gold');
  const act6ExpandEl = document.getElementById('act6-expand-card');
  const act6Checkins = [
    document.getElementById('act6-ci-1'),
    document.getElementById('act6-ci-2'),
    document.getElementById('act6-ci-3'),
  ];
  const act6ModCountEl = document.getElementById('act6-mod-count');

  // Act 7 refs
  const act7HazardEl = document.getElementById('act7-hazard-card');
  const act7RelayEl = document.getElementById('act7-relay-badge');
  const act7MineralEl = document.getElementById('act7-mineral-card');
  const act7FinaleEl = document.getElementById('act7-finale');
  const act7TagCursorEl = document.getElementById('act7-tagline-cursor');

  const ACT_LABELS = [
    'ACT 01 // LAUNCH ECONOMICS VS. HUMAN ROVERS',
    'ACT 02 // NASA-ESA DUAL DATA MAP ENGINE',
    'ACT 03 // CROWD-VERIFIED CONSENSUS PROTOCOL',
    'ACT 04 // ANTI-SYBIL & OFFLINE GEOFENCING',
    'ACT 05 // DATA-GAP BOUNTIES & DUAL ECONOMY',
    'ACT 06 // COLLABORATIVE VIRTUAL SPACE BASE',
    'ACT 07 // TIER 3 ROBOTICS & PLANETARY LOCKUP',
  ];

  const ACT_STARTS = [0, 3.5, 8.0, 13.0, 17.5, 21.5, 25.5];

  /**
   * Updates all HUD telemetry, diegetic card positions, leader lines, counters & bars.
   */
  function updateHud(elapsedSeconds, anchors, focusDistance) {
    const f = clamp01(elapsedSeconds / 30.0) * 1800.0;
    const frameIdx = Math.min(1800, Math.round(f));

    // Top HUD Telemetry
    frameEl.textContent = `FRAME ${String(frameIdx).padStart(4, '0')} / 1800`;
    clockEl.textContent = `T+ 00:00:${elapsedSeconds.toFixed(2).padStart(5, '0')}`;
    dofEl.textContent = `DOF FOCUS ${focusDistance.toFixed(1)}m`;

    // Deterministic LED blink (zero CSS @keyframes)
    const ledPulse = 0.45 + 0.55 * (Math.sin(elapsedSeconds * 8.5) * 0.5 + 0.5);
    liveLedEl.style.opacity = ledPulse.toFixed(2);

    // Active act index
    let actIdx = 0;
    for (let i = ACT_STARTS.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= ACT_STARTS[i]) {
        actIdx = i;
        break;
      }
    }
    actTagEl.textContent = ACT_LABELS[actIdx];

    // Timeline bar + milestone highlights
    progressFillEl.style.width = `${(clamp01(elapsedSeconds / 30.0) * 100).toFixed(2)}%`;
    milestoneEls.forEach((mEl, i) => {
      const done = elapsedSeconds >= ACT_STARTS[i];
      mEl.classList.toggle('active', i === actIdx);
      mEl.classList.toggle('passed', done && i !== actIdx);
    });

    // 28-Bar Audio Waveform Visualizer synced deterministically to real voiceover + SFX envelope
    const env = sampleVoiceoverEnvelope(elapsedSeconds);
    for (let i = 0; i < waveBars.length; i++) {
      const harmonic =
        Math.sin(elapsedSeconds * 19.0 + i * 0.65) * 0.45 +
        Math.cos(elapsedSeconds * 11.3 + i * 1.15) * 0.35 +
        0.5;
      const h = 4 + Math.max(0, harmonic) * 24 * (0.14 + env * 0.86);
      waveBars[i].style.height = `${h.toFixed(1)}px`;
      waveBars[i].style.opacity = (0.28 + env * 0.72).toFixed(2);
    }

    // ---------------- ACT 1 HUD ----------------
    // Odometer 0 -> 1,000,000,000 over frames 5..78
    const odoP = smoothstep(5, 78, f);
    const easedOdo = 1 - Math.pow(1 - odoP, 3);
    const val = Math.round(easedOdo * 1000000000);
    act1OdoEl.textContent = `$${val.toLocaleString('en-US')}`;

    const slashP = smoothstep(85, 93, f);
    act1SlashEl.style.transform = `scaleX(${slashP.toFixed(3)}) rotate(-4deg)`;
    act1SlashEl.style.opacity = f >= 84 && f <= 112 ? '1' : '0';

    // Spring slam fade controlled in sync
    setAlpha(act1LaunchEl, smoothstep(0, 12, f) * (1 - smoothstep(96, 114, f)), 'flex');
    const roversAlpha = smoothstep(106, 122, f) * (1 - smoothstep(206, 222, f));
    setAlpha(act1RoversEl, roversAlpha, 'block');
    act1RoversEl.style.transform = `translateY(${((1 - smoothstep(106, 128, f)) * 28).toFixed(1)}px)`;

    // ---------------- ACT 2 HUD ----------------
    const brandA = smoothstep(214, 232, f) * (1 - smoothstep(278, 298, f));
    setAlpha(act2BrandEl, brandA, 'block');
    act2BrandEl.style.transform = `scale(${(0.92 + smoothstep(214, 240, f) * 0.08).toFixed(3)})`;

    const mapHudA = smoothstep(295, 318, f) * (1 - smoothstep(465, 485, f));
    setAlpha(act2MapHudEl, mapHudA, 'flex');

    const n1A = smoothstep(370, 392, f) * (1 - smoothstep(465, 485, f));
    const n2A = smoothstep(388, 410, f) * (1 - smoothstep(465, 485, f));
    const n3A = smoothstep(406, 428, f) * (1 - smoothstep(465, 485, f));

    setAlpha(nodeCard01, n1A);
    setAlpha(nodeCard02, n2A);
    setAlpha(nodeCard03, n3A);

    positionCard(nodeCard01, 130, 520, 0, -50);
    positionCard(nodeCard02, 1320, 290, 0, -50);
    positionCard(nodeCard03, 1360, 620, 0, -50);

    setLeaderLine(leaderSvg, 'node01', anchors.node01, 460, 520, '#00FF88', n1A, elapsedSeconds);
    setLeaderLine(leaderSvg, 'node02', anchors.node02, 1320, 290, '#00F0FF', n2A, elapsedSeconds);
    setLeaderLine(leaderSvg, 'node03', anchors.node03, 1360, 620, '#FF6B00', n3A, elapsedSeconds);

    // ---------------- ACT 3 HUD (Survey Beacon Traffic Light) ----------------
    const act3A = smoothstep(480, 498, f) * (1 - smoothstep(766, 788, f));
    setAlpha(act3CardEl, act3A);
    const beaconX = anchors.beacon?.visible ? anchors.beacon.x : 740;
    const beaconY = anchors.beacon?.visible ? anchors.beacon.y : 520;
    const card3X = 1180;
    const card3Y = Math.max(210, Math.min(620, beaconY - 40));
    positionCard(act3CardEl, card3X, card3Y, 0, -50);

    let act3Color = '#8E9BAE';
    if (f < 570) {
      act3Color = '#8E9BAE';
      act3HeaderEl.textContent = '1. GREY BEACON // DISCOVERY';
      act3CountEl.textContent = 'EXPLORERS: 01 / 10';
      act3MetaEl.textContent = 'TEMP: 39.4°C • HUMIDITY: 11.2% • SOIL: BASALT';
      act3StampEl.textContent = '[UNVERIFIED IN-SITU UPLOAD]';
      act3StampEl.style.borderColor = '#8E9BAE';
      act3StampEl.style.color = '#8E9BAE';
    } else if (f < 675) {
      act3Color = '#FF6B00';
      act3HeaderEl.textContent = '2. ORANGE BEACON // IN VERIFICATION';
      act3CountEl.textContent = 'INDEPENDENT EXPLORERS: 03 / 10';
      act3MetaEl.textContent = 'GPS ERROR MARGIN: ±1.4m • CONSISTENCY: 98.7%';
      act3StampEl.textContent = '[CROSS-CHECKING FIELD READINGS...]';
      act3StampEl.style.borderColor = '#FF6B00';
      act3StampEl.style.color = '#FF6B00';
    } else {
      act3Color = '#00FF88';
      act3HeaderEl.textContent = '3. GREEN BEACON // CONFIRMED ANALOG';
      const cRoll = Math.round(3 + smoothstep(675, 705, f) * 7);
      act3CountEl.textContent = `VALIDATED EXPLORERS: ${String(cRoll).padStart(2, '0')} / 10`;
      act3MetaEl.textContent = 'SCIENTIFIC CONSENSUS ACHIEVED • ERROR: ±0.9m';
      act3StampEl.textContent = '[LEGITIMATE TERRESTRIAL ANALOG LOCKED IN DB]';
      act3StampEl.style.borderColor = '#00FF88';
      act3StampEl.style.color = '#00FF88';
    }
    act3CardEl.style.borderColor = act3Color;
    act3Segs[0].style.opacity = f >= 480 ? '1' : '0.25';
    act3Segs[1].style.opacity = f >= 570 ? '1' : '0.25';
    act3Segs[2].style.opacity = f >= 675 ? '1' : '0.25';
    setLeaderLine(leaderSvg, 'beacon', anchors.beacon, card3X, card3Y, act3Color, act3A, elapsedSeconds);

    // ---------------- ACT 4 HUD ----------------
    const shieldHudA = smoothstep(782, 804, f) * (1 - smoothstep(898, 916, f));
    setAlpha(act4ShieldCardEl, shieldHudA);
    positionCard(act4ShieldCardEl, 96, 360, 0, -50);
    setLeaderLine(leaderSvg, 'shield', anchors.shield, 620, 360, '#00F0FF', shieldHudA, elapsedSeconds);

    const offlineA = smoothstep(908, 922, f) * (1 - smoothstep(954, 968, f));
    setAlpha(act4OfflineEl, offlineA);

    const pushA = smoothstep(940, 954, f) * (1 - smoothstep(1042, 1054, f));
    setAlpha(act4PushEl, pushA);
    const clickP = smoothstep(966, 986, f);
    act4CursorEl.style.left = `${(320 - clickP * 110).toFixed(1)}px`;
    act4CursorEl.style.top = `${(140 - clickP * 32).toFixed(1)}px`;
    const isClicked = f >= 984;
    act4PushBtnEl.classList.toggle('authorized', isClicked);
    act4PushBtnEl.textContent = isClicked ? 'ONE-TIME GPS AUTHORIZED ✓' : 'AUTHORIZE ONE-TIME GPS';

    const proxA = smoothstep(986, 1002, f) * (1 - smoothstep(1042, 1056, f));
    setAlpha(act4ProxEl, proxA);
    positionCard(act4ProxEl, 1280, 290, 0, -50);
    setLeaderLine(leaderSvg, 'geofence', anchors.geofence, 1280, 290, '#00FF88', proxA, elapsedSeconds);

    const spoofA = smoothstep(996, 1012, f) * (1 - smoothstep(1042, 1056, f));
    setAlpha(act4SpoofEl, spoofA);
    positionCard(act4SpoofEl, 1280, 620, 0, -50);
    setLeaderLine(leaderSvg, 'spoof', anchors.spoof, 1280, 620, '#FF1E42', spoofA, elapsedSeconds);

    // ---------------- ACT 5 HUD ----------------
    const gapHudA = smoothstep(1050, 1068, f) * (1 - smoothstep(1158, 1175, f));
    setAlpha(act5GapCardEl, gapHudA);
    positionCard(act5GapCardEl, 96, 330, 0, -50);
    setAlpha(act5BountyCardEl, smoothstep(1058, 1074, f) * (1 - smoothstep(1164, 1180, f)));
    const multScale = 0.96 + Math.sin(elapsedSeconds * 9.0) * 0.05;
    act5MultiEl.style.transform = `scale(${multScale.toFixed(3)})`;
    setLeaderLine(leaderSvg, 'gapNode', anchors.gapNode, 595, 330, '#B829FF', gapHudA, elapsedSeconds);

    const econA = smoothstep(1162, 1180, f) * (1 - smoothstep(1284, 1300, f));
    setAlpha(act5EconomyEl, econA, 'flex');
    const xpVal = Math.round(smoothstep(1168, 1226, f) * 4500);
    act5XpEl.textContent = `+${xpVal.toLocaleString('en-US')} XP`;

    // ---------------- ACT 6 HUD ----------------
    const genHudA = smoothstep(1295, 1315, f) * (1 - smoothstep(1392, 1408, f));
    setAlpha(act6GenesisEl, genHudA);
    positionCard(act6GenesisEl, 96, 340, 0, -50);
    const pickGold = f >= 1352;
    act6SwatchCyan.classList.toggle('selected', !pickGold);
    act6SwatchGold.classList.toggle('selected', pickGold);
    setLeaderLine(leaderSvg, 'genesis', anchors.genesis, 540, 340, pickGold ? '#FFB800' : '#00F0FF', genHudA, elapsedSeconds);

    const expHudA = smoothstep(1396, 1416, f) * (1 - smoothstep(1518, 1534, f));
    setAlpha(act6ExpandEl, expHudA);
    positionCard(act6ExpandEl, 1320, 350, 0, -50);
    act6Checkins.forEach((el, idx) => {
      const vis = smoothstep(1400 + idx * 24, 1418 + idx * 24, f);
      el.style.opacity = vis.toFixed(3);
      el.style.transform = `translateX(${((1 - vis) * 20).toFixed(1)}px)`;
    });
    const modCount = 1 + (f >= 1418 ? 1 : 0) + (f >= 1446 ? 1 : 0) + (f >= 1474 ? 1 : 0);
    act6ModCountEl.textContent = `ONLINE MODULES: 0${modCount} / 04`;
    setLeaderLine(leaderSvg, 'expansion', anchors.expansion, 1320, 350, '#00FF88', expHudA, elapsedSeconds);

    // ---------------- ACT 7 HUD ----------------
    const hazA = smoothstep(1532, 1548, f) * (1 - smoothstep(1668, 1684, f));
    setAlpha(act7HazardEl, hazA);
    positionCard(act7HazardEl, 96, 250, 0, -50);
    setLeaderLine(leaderSvg, 'hazard', anchors.hazard, 560, 250, '#FF1E42', hazA, elapsedSeconds);

    const relayA = smoothstep(1540, 1556, f) * (1 - smoothstep(1668, 1684, f));
    setAlpha(act7RelayEl, relayA);

    const minA = smoothstep(1576, 1594, f) * (1 - smoothstep(1668, 1684, f));
    setAlpha(act7MineralEl, minA);
    positionCard(act7MineralEl, 1340, 300, 0, -50);
    setLeaderLine(leaderSvg, 'drone', anchors.drone, 1340, 300, '#00F0FF', minA, elapsedSeconds);

    // Grand Jury Finale (starts at 1664f for >2.1s authoritative readable hold before 1800f)
    const finA = smoothstep(1664, 1688, f);
    setAlpha(act7FinaleEl, finA, 'flex');
    const finScale = 0.88 + smoothstep(1664, 1704, f) * 0.12;
    act7FinaleEl.style.transform = `scale(${finScale.toFixed(3)})`;
    // Deterministic blinking cyan cursor at 3Hz (no CSS @keyframes)
    const cursorBlink = Math.floor(elapsedSeconds * 4.5) % 2 === 0 ? 1 : 0.15;
    act7TagCursorEl.style.opacity = cursorBlink.toFixed(2);
  }

  return {
    root,
    updateHud,
  };
}
