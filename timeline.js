import { createPlanetaryEngine } from './terrainAndEntities.js';
import { createHudOverlay } from './hudOverlay.js';

const TOTAL_DURATION = 30.0;
const FPS = 60;

function boot() {
  const gsap = window.gsap;
  const canvas = document.getElementById('webgl-canvas');
  if (!gsap || !canvas) {
    throw new Error('MoonSiteUA initialization failed: missing GSAP runtime or #webgl-canvas');
  }

  const engine = createPlanetaryEngine(canvas);
  const hud = createHudOverlay();

  const playState = { t: 0 };
  let lastRenderedFrame = -1;

  function renderFrameAt(seconds, force = false) {
    const clamped = Math.max(0, Math.min(TOTAL_DURATION, Number(seconds) || 0));
    const frameIndex = Math.round(clamped * FPS);
    if (!force && frameIndex === lastRenderedFrame) return;
    lastRenderedFrame = frameIndex;

    const exactSeconds = frameIndex / FPS;
    const { projectedAnchors, focusDistance } = engine.updateAtTime(exactSeconds);
    hud.updateHud(exactSeconds, projectedAnchors, focusDistance);
  }

  // Master paused GSAP timeline driven strictly by HyperFrames / scrub clock
  const masterTl = gsap.timeline({
    paused: true,
    onUpdate() {
      renderFrameAt(playState.t, false);
    },
  });

  // Deterministic 0 -> 30.0s progression track
  masterTl.to(
    playState,
    {
      t: TOTAL_DURATION,
      duration: TOTAL_DURATION,
      ease: 'none',
    },
    0
  );

  // Staggered spring-damped HUD micro-choreography synchronized to exact act timestamps
  masterTl.fromTo(
    '#act1-launch',
    { scale: 1.18, y: 24 },
    { scale: 1.0, y: 0, duration: 0.45, ease: 'expo.out' },
    0.02
  );
  masterTl.fromTo(
    '#act2-brand',
    { y: 18 },
    { y: 0, duration: 0.55, ease: 'power3.out' },
    3.52
  );
  masterTl.fromTo(
    '.econ-card',
    { y: 42, rotateY: -18 },
    { y: 0, rotateY: -8, duration: 0.65, stagger: 0.14, ease: 'back.out(1.6)' },
    19.42
  );
  masterTl.fromTo(
    '.finale-pill',
    { y: 16, scale: 0.85 },
    { y: 0, scale: 1.0, duration: 0.45, stagger: 0.08, ease: 'back.out(1.7)' },
    27.78
  );

  // Register on HyperFrames global timeline registry
  window.__timelines = window.__timelines || {};
  window.__timelines.moonsiteua = masterTl;

  // Deterministic seek handler invoked by HyperFrames runtime & parallel render workers
  window.addEventListener('hf-seek', (event) => {
    const t = Number(event?.detail?.time);
    if (Number.isFinite(t)) {
      renderFrameAt(t, true);
    }
  });

  // Render exact Frame 0 synchronously at startup
  renderFrameAt(0, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
