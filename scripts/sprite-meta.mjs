// scripts/sprite-meta.mjs
// Single source of truth for sprite-sheet dimensions + timing.
// Imported by gen-placeholder-sprites.mjs AND (Plan 03) verify-sprite-dimensions.mjs.
// Per UI-SPEC §5.2 + RESEARCH §Pitfall 5.
export const SCENES = [
  { name: 'scene1-leo-bcn', frames: 6,  fps: 4,  durationMs: 2500 },
  { name: 'scene2-takeoff', frames: 8,  fps: 8,  durationMs: 2500 },
  { name: 'scene3-route',   frames: 12, fps: 6,  durationMs: 2500 },
  { name: 'scene4-reveal',  frames: 10, fps: 5,  durationMs: 3000 },
];
export const FRAME_WIDTH = 320;
export const FRAME_HEIGHT = 180;
export const TOTAL_CYCLE_MS = SCENES.reduce((sum, s) => sum + s.durationMs, 0); // = 10500
