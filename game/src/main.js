// Solmar Bay boot: input, loop, title/pause/dead/complete flow, shot mode.
import { createGame, loadGame, saveGame, missionName } from './game.js';
import { update, tryStartRace } from './update.js';
import { render } from './render.js';
import { startMission, completeMission, trySteal, exitVehicle } from './logic.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = 1280, H = 800;

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7) || 7;

const G = createGame(seed);
G.hasSave = false;
try { G.hasSave = !!localStorage.getItem('solmarbay-save-v1'); } catch { G.hasSave = false; }
window.__game = G;

function setStatus(t) { if (statusEl) statusEl.textContent = t; }

function newGame() {
  const fresh = createGame(seed);
  // keep the same object identity for the loop's G reference
  Object.keys(G).forEach((k) => delete G[k]);
  Object.assign(G, fresh);
  G.hasSave = false;
  G.mode = 'play';
  startMission(G, 0);
  setStatus('Mission 1/10 — First Errand');
}
function continueGame() {
  loadGame(G);
  G.mode = 'play';
  startMission(G, G.missionIdx);
  setStatus('Continued — Mission ' + (G.missionIdx + 1) + '/10');
}
function respawn() {
  const p = G.player;
  p.hp = 100; p.armor = 0;
  if (p.inVehicle) { p.inVehicle.driver = null; p.inVehicle = null; p.onFoot = true; }
  p.x = 1100; p.y = 900; p.angle = -Math.PI / 2;
  G.cam.x = p.x; G.cam.y = p.y;
  G.mode = 'play';
  setStatus('Back on the streets');
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  G.keys[e.code] = true;
  G.sfx.ensure();
  if (e.repeat) return;
  if (G.mode === 'title') {
    if (e.code === 'Enter') newGame();
    else if (e.code === 'KeyC' && G.hasSave) continueGame();
    else if (e.code === 'KeyN') newGame();
    return;
  }
  if (G.missionComplete && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
    G.missionComplete = null;
    if (G.pendingMission) { G.pendingMission = false; startMission(G, G.missionIdx); setStatus('Mission ' + (G.missionIdx + 1) + '/10 — ' + missionName(G)); }
    return;
  }
  if (G.mode === 'complete' && e.code === 'Enter') { G.mode = 'play'; return; }
  if (G.mode === 'dead' && e.code === 'Enter') { respawn(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (G.mode === 'play') G.mode = 'pause';
    else if (G.mode === 'pause') G.mode = 'play';
    return;
  }
  if (G.mode !== 'play') return;
  if (e.code === 'KeyE') {
    if (G.player.inVehicle) exitVehicle(G); else trySteal(G);
  }
  if (e.code === 'KeyR') tryStartRace(G);
  if (e.code === 'KeyM') { G.muted = G.sfx.toggleMute(); }
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
canvas.addEventListener('mousedown', (e) => {
  G.sfx.ensure();
  G.mouse.down = true;
  if (G.missionComplete) {
    G.missionComplete = null;
    if (G.pendingMission) { G.pendingMission = false; startMission(G, G.missionIdx); }
    return;
  }
  if (G.mode === 'title') { newGame(); return; }
  if (G.mode === 'complete') { G.mode = 'play'; return; }
  if (G.mode === 'dead') { respawn(); return; }
});
window.addEventListener('mouseup', () => { G.mouse.down = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  G.mouse.x = e.clientX - r.left; G.mouse.y = e.clientY - r.top;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

if (shotName) {
  stageShot(G, shotName);
  if (statusEl) statusEl.style.display = 'none';
} else {
  setStatus('Solmar Bay — press Enter for a new game');
}

let last = performance.now();
let frames = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  try {
    // world mouse coords for aiming
    G.mouse.wx = G.cam.x - W / 2 + G.mouse.x;
    G.mouse.wy = G.cam.y - H / 2 + G.mouse.y;
    if (G.mode === 'play' || G.shotMode) update(G, dt);
    render(ctx, G, W, H);
    frames++;
    if (G.shotMode && frames >= 5) window.__shotReady = true;
  } catch (err) {
    console.error(err);
    setStatus('Error: ' + (err && err.message));
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
