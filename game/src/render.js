// Rendering for Solmar Bay: world, vehicles, HUD, minimap, panels.
import { VEHICLE_TYPES, MISSIONS, DEBT_TOTAL, currentStep, missionName } from './game.js';
import { DISTRICTS, ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, inWater, districtAt } from './world.js';
import { clamp, dist, TAU } from './rng.js';
import { RACE_GATES, FLAG } from './update.js';

function phaseOf(clockMin) {
  const h = clockMin / 60;
  if (h >= 8 && h < 17) return { name: 'day', tint: null, glyph: '☀' };
  if (h >= 17 && h < 19) return { name: 'dusk', tint: 'rgba(255,120,40,0.14)', glyph: '☀' };
  if (h >= 19 || h < 6) return { name: 'night', tint: 'rgba(10,20,60,0.34)', glyph: '☾' };
  return { name: 'dawn', tint: 'rgba(255,150,180,0.10)', glyph: '☀' };
}
export function clockText(G) {
  const h = Math.floor(G.clockMin / 60), m = Math.floor(G.clockMin % 60);
  const ph = phaseOf(G.clockMin);
  return 'DAY ' + G.day + ' · ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ph.glyph;
}

function drawCar(ctx, x, y, angle, type, color, opts) {
  const t = VEHICLE_TYPES[type];
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  if (type === 'motorcycle') {
    ctx.fillStyle = color; ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h);
    ctx.fillStyle = '#222'; ctx.fillRect(-t.w / 2 - 3, -3, 6, 6); ctx.fillRect(t.w / 2 - 3, -3, 6, 6);
    ctx.fillStyle = '#f2c531'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); // rider dot
  } else if (type === 'boat') {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, t.w / 2, t.h / 2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3f7ea8'; ctx.fillRect(-8, -6, 16, 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(t.w / 2 - 4, -2, 6, 4);
  } else {
    ctx.fillStyle = '#111'; ctx.fillRect(-t.w / 2 + 2, -t.h / 2 - 2, 10, 4); ctx.fillRect(-t.w / 2 + 2, t.h / 2 - 2, 10, 4);
    ctx.fillRect(t.w / 2 - 12, -t.h / 2 - 2, 10, 4); ctx.fillRect(t.w / 2 - 12, t.h / 2 - 2, 10, 4);
    ctx.fillStyle = color; ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h);
    ctx.fillStyle = 'rgba(180,220,255,0.85)'; ctx.fillRect(-4, -t.h / 2 + 3, 14, t.h - 6);
    if (type === 'taxi') { ctx.fillStyle = '#111'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3); }
    if (type === 'police') {
      ctx.fillStyle = '#fff'; ctx.fillRect(-t.w / 2 + 4, -t.h / 2 + 2, t.w - 8, 4);
      ctx.fillStyle = '#e33'; ctx.fillRect(-6, -t.h / 2 - 3, 5, 4); ctx.fillStyle = '#36c'; ctx.fillRect(1, -t.h / 2 - 3, 5, 4);
    }
    if (opts && opts.headlights) {
      ctx.fillStyle = 'rgba(255,240,170,0.20)';
      ctx.beginPath(); ctx.moveTo(t.w / 2, -6); ctx.lineTo(t.w / 2 + 110, -34); ctx.lineTo(t.w / 2 + 110, 34); ctx.lineTo(t.w / 2, 6); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawWorld(ctx, G, cw, ch) {
  const cam = G.cam;
  const vx = cam.x - cw / 2, vy = cam.y - ch / 2;
  ctx.fillStyle = '#2e3440'; ctx.fillRect(0, 0, cw, ch);
  ctx.save(); ctx.translate(-vx, -vy);
  // ground: district colors
  for (const d of DISTRICTS) { ctx.fillStyle = d.ground; ctx.fillRect(d.x, d.y, d.w, d.h); }
  // water
  ctx.fillStyle = '#2a6d8f'; ctx.fillRect(3360, 180, 240, 860); ctx.fillRect(280, 2400, 3320, 200);
  ctx.fillStyle = '#3a8db5';
  for (let i = 0; i < 8; i++) ctx.fillRect(3380 + (i % 2) * 100, 220 + i * 90, 60, 4);
  // parks
  for (const pk of G.city.parks) {
    ctx.fillStyle = '#3d6b35'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#2c5a2c';
    for (let i = 0; i < pk.trees; i++) { ctx.beginPath(); ctx.arc(pk.x + 20 + (i * 37) % pk.w, pk.y + 18 + (i * 53) % pk.h, 9, 0, TAU); ctx.fill(); }
  }
  // roads
  ctx.fillStyle = '#26262b';
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 180, ROAD_W, 2260);
  for (const ry of ROADS_Y) ctx.fillRect(280, ry - ROAD_W / 2, 3120, ROAD_W);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([18, 22]); ctx.lineWidth = 2;
  for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(rx, 200); ctx.lineTo(rx, 2420); ctx.stroke(); }
  for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(300, ry); ctx.lineTo(3380, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  // Airport runway AFTER roads so it reads as tarmac crossing them
  ctx.fillStyle = '#33363d'; ctx.fillRect(1800, 380, 500, 120);
  ctx.fillStyle = '#e8e8e8';
  for (let x = 1820; x < 2280; x += 60) ctx.fillRect(x, 436, 34, 8);
  ctx.fillRect(1800, 384, 500, 4); ctx.fillRect(1800, 492, 500, 4);
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SOLMAR INTL · RWY 09', 1830, 410);
  // parked passenger plane landmark at (2050,440)
  ctx.save(); ctx.translate(2050, 440);
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath(); ctx.ellipse(0, 0, 92, 17, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a9d8f'; ctx.fillRect(-80, -2, 150, 6);
  ctx.fillStyle = '#cfd6dd'; ctx.fillRect(-6, -58, 26, 60); // wing
  ctx.fillStyle = '#cfd6dd'; ctx.fillRect(-6, -2, 26, 60);
  ctx.fillStyle = '#2a9d8f'; ctx.beginPath(); ctx.moveTo(-92, -16); ctx.lineTo(-78, -16); ctx.lineTo(-78, 16); ctx.lineTo(-92, 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a9d8f'; ctx.fillRect(-108, -4, 20, 8); // tail fin
  ctx.fillStyle = '#223'; ctx.fillRect(78, -4, 10, 8); // nose
  ctx.restore();
  // buildings
  const night = phaseOf(G.clockMin).name === 'night';
  for (const b of G.city.buildings) {
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    if (b.landmark === 'lighthouse') {
      ctx.fillStyle = '#e33'; ctx.fillRect(b.x, b.y, b.w, 14);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 10, 0, TAU); ctx.fill();
      // sweeping beam
      const ba = G.time * 0.7;
      ctx.fillStyle = 'rgba(255,240,170,0.16)';
      ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, b.y + b.h / 2);
      ctx.lineTo(b.x + b.w / 2 + Math.cos(ba) * 420, b.y + b.h / 2 + Math.sin(ba) * 420);
      ctx.lineTo(b.x + b.w / 2 + Math.cos(ba + 0.25) * 420, b.y + b.h / 2 + Math.sin(ba + 0.25) * 420);
      ctx.closePath(); ctx.fill();
    }
    if (b.landmark === 'stadium') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 14, b.h / 2 - 14, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#4a8a4a'; ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 26, b.h / 2 - 26, 0, 0, TAU); ctx.fill();
    }
    if (b.landmark === 'marina') {
      ctx.fillStyle = '#6d7f88'; ctx.fillRect(b.x, b.y, b.w, 20);
      ctx.fillStyle = '#8a6f4d';
      for (let i = 0; i < 4; i++) ctx.fillRect(b.x + 20 + i * 70, b.y + 20, 10, 120);
    }
    if (b.landmark === 'terminal') {
      ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TERMINAL', b.x + b.w / 2, b.y + 24);
      ctx.fillStyle = '#223'; ctx.fillRect(b.x + 20, b.y + b.h - 24, 60, 16); ctx.fillRect(b.x + b.w - 80, b.y + b.h - 24, 60, 16);
    }
    if (b.landmark === 'tower') {
      ctx.fillStyle = '#ffd94a'; ctx.fillRect(b.x + b.w / 2 - 4, b.y - 18, 8, 18);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y - 20, 5, 0, TAU); ctx.fill();
    }
    // windows
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const lit = ((b.seed + i * 7 + j * 13) % 5 === 0);
      ctx.fillStyle = night ? (lit ? '#ffd94a' : '#2c3440') : (lit ? '#cfe4ff' : '#3a4556');
      ctx.fillRect(b.x + 7 + i * 26, b.y + 7 + j * 26, 12, 10);
    }
    if (b.landmark) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.name || '', b.x + b.w / 2, b.y - 8); }
  }
  // cooldown spots (payphones / alleys)
  for (const s of G.cooldownSpots) {
    ctx.fillStyle = '#7fb2ff'; ctx.fillRect(s.x - 10, s.y - 14, 20, 28);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('☎', s.x, s.y + 4);
  }
  // coins
  for (const c of G.coins) {
    if (c.taken) continue;
    const bob = Math.sin(G.time * 3 + c.x) * 3;
    ctx.fillStyle = '#ffd94a'; ctx.beginPath(); ctx.arc(c.x, c.y + bob, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8860b'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', c.x, c.y + bob + 4);
  }
  // pickups
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    ctx.fillStyle = pk.kind === 'health' ? '#e33' : '#36c';
    ctx.fillRect(pk.x - 10, pk.y - 10, 20, 20);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : '◈', pk.x, pk.y + 5);
  }
  // race flag + gates
  ctx.fillStyle = '#ff5e5e'; ctx.fillRect(FLAG.x - 3, FLAG.y - 34, 6, 34);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(FLAG.x + 3, FLAG.y - 34); ctx.lineTo(FLAG.x + 26, FLAG.y - 27); ctx.lineTo(FLAG.x + 3, FLAG.y - 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RACE', FLAG.x, FLAG.y + 16);
  if (G.race) {
    RACE_GATES.forEach((g, i) => {
      ctx.strokeStyle = i === G.race.gate ? '#7dff8a' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = i === G.race.gate ? 4 : 2;
      ctx.beginPath(); ctx.arc(g[0], g[1], 34, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(String(i + 1), g[0], g[1] + 5);
    });
  }
  // mission markers (collect points / goto targets)
  const step = currentStep(G);
  if (G.mission && step) {
    const pulse = 1 + Math.sin(G.time * 5) * 0.15;
    const mark = (x, y, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 26 * pulse, 0, TAU); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
    };
    if (step.kind === 'goto') mark(step.x, step.y, '#ffd94a');
    if (step.kind === 'collect') step.points.forEach((pt, i) => { if (!(G.missionData.done && G.missionData.done[i])) mark(pt[0], pt[1], '#7dff8a'); });
    if (step.kind === 'boat') mark(step.x, step.y, '#6fd3e0');
    if (step.kind === 'defeat') mark(step.x, step.y, '#ff5e5e');
  }
  if (G.taxiFare) {
    const f = G.taxiFare;
    ctx.fillStyle = f.stage === 'pickup' ? '#f2c531' : '#7dff8a';
    ctx.beginPath(); ctx.arc(f.x, f.y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', f.x, f.y + 4);
  }
  if (G.delivery) {
    const dl = G.delivery;
    const tx = dl.stage === 'pickup' ? dl.x : dl.dx, ty = dl.stage === 'pickup' ? dl.y : dl.dy;
    ctx.fillStyle = '#ff9f2e'; ctx.fillRect(tx - 9, ty - 9, 18, 18);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▣', tx, ty + 4);
  }
  // roadblocks + spikes
  for (const rb of G.roadblocks) drawCar(ctx, rb.x, rb.y, rb.angle, 'police', '#22282f');
  for (const s of G.spikes) {
    ctx.fillStyle = '#ccc';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(s.x + i * 8, s.y - 6); ctx.lineTo(s.x + i * 8 + 4, s.y + 6); ctx.lineTo(s.x + i * 8 + 8, s.y - 6); ctx.closePath(); ctx.fill(); }
  }
  // traffic + parked vehicles
  const nightNow = phaseOf(G.clockMin).name === 'night' || phaseOf(G.clockMin).name === 'dusk';
  for (const t of G.traffic) drawCar(ctx, t.x, t.y, t.angle, t.type, t.color, { headlights: nightNow });
  for (const v of G.vehicles) {
    if (v.driver === 'player') continue;
    drawCar(ctx, v.x, v.y, v.angle, v.type, v.color, { headlights: nightNow });
    if (v.hp < 100) { ctx.fillStyle = '#e33'; ctx.fillRect(v.x - 20, v.y - 26, 40 * (v.hp / 100), 4); }
  }
  for (const car of G.police) drawCar(ctx, car.x, car.y, car.angle, 'police', '#22282f', { headlights: nightNow });
  // peds
  for (const pd of G.peds) {
    ctx.fillStyle = pd.color; ctx.beginPath(); ctx.arc(pd.x, pd.y, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(pd.x, pd.y - 2, 3, 0, TAU); ctx.fill();
  }
  // player vehicle / player
  const p = G.player;
  if (p.inVehicle) {
    drawCar(ctx, p.inVehicle.x, p.inVehicle.y, p.inVehicle.angle, p.inVehicle.type, p.inVehicle.color, { headlights: nightNow });
  } else {
    ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d43a5c'; ctx.fillRect(p.x - 8, p.y - 4, 16, 8);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 6, p.y + Math.sin(p.angle) * 6, 4, 0, TAU); ctx.fill();
  }
  // heli + searchlight
  if (G.heli) {
    ctx.fillStyle = 'rgba(255,240,170,0.12)';
    ctx.beginPath(); ctx.moveTo(G.heli.x, G.heli.y); ctx.lineTo(p.x - 40, p.y - 40); ctx.lineTo(p.x + 40, p.y + 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(G.heli.x, G.heli.y, 22, 10, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(G.heli.x - 26, G.heli.y); ctx.lineTo(G.heli.x + 26, G.heli.y); ctx.stroke();
  }
  // bullets
  ctx.fillStyle = '#ffe27a';
  for (const b of G.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill(); }
  // particles
  for (const pt of G.particles) {
    ctx.globalAlpha = 1 - pt.t / pt.life;
    ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // floats
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = 1 - f.t / 1.4;
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - f.t * 30);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // day/night tint
  const ph = phaseOf(G.clockMin);
  if (ph.tint) { ctx.fillStyle = ph.tint; ctx.fillRect(0, 0, cw, ch); }
  // crosshair
  if (G.mode === 'play') {
    const mx = G.mouse.x, my = G.mouse.y;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my); ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5); ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13); ctx.stroke();
  }
}

function drawMinimap(ctx, G, cw) {
  const mw = 196, mh = 142, mx = 12, my = 12;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.78)'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#666'; ctx.strokeRect(mx, my, mw, mh);
  for (const d of DISTRICTS) { ctx.fillStyle = d.ground; ctx.fillRect(mx + d.x * sx, my + d.y * sy, d.w * sx, d.h * sy); }
  ctx.fillStyle = '#2a6d8f'; ctx.fillRect(mx + 3360 * sx, my + 180 * sy, 240 * sx, 860 * sy);
  ctx.fillStyle = '#fff'; ctx.font = '8px sans-serif'; ctx.textAlign = 'left';
  for (const d of DISTRICTS) ctx.fillText(d.name, mx + d.x * sx + 3, my + d.y * sy + 10);
  const dot = (x, y, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r || 2.5, 0, TAU); ctx.fill(); };
  const step = currentStep(G);
  if (G.mission && step) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    if (step.kind === 'goto' || step.kind === 'boat' || step.kind === 'defeat') dot(step.x, step.y, '#ffd94a', pulse);
    if (step.kind === 'collect') step.points.forEach((pt) => dot(pt[0], pt[1], '#7dff8a', 3));
  }
  if (G.taxiFare) dot(G.taxiFare.x, G.taxiFare.y, '#7dff8a', 3);
  for (const c of G.police) dot(c.x, c.y, '#ff3b30', 2.5);
  if (G.heli) dot(G.heli.x, G.heli.y, '#ff3b30', 3.5);
  dot(G.player.x, G.player.y, '#fff', 3.5);
  ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + G.player.x * sx, my + G.player.y * sy, 5, 0, TAU); ctx.stroke();
}

export function render(ctx, G, cw, ch) {
  ctx.clearRect(0, 0, cw, ch);
  if (G.mode === 'title') { drawTitle(ctx, G, cw, ch); return; }
  drawWorld(ctx, G, cw, ch);
  drawMinimap(ctx, G, cw);
  // HUD top-right: wanted, cash/debt/cred, clock
  ctx.textAlign = 'right'; ctx.font = 'bold 20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted >= 3 ? '#ff5e5e' : '#ffd94a';
  ctx.fillText(stars, cw - 14, 34);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Cash $' + G.cash, cw - 14, 58);
  ctx.fillStyle = '#ff9f9f'; ctx.fillText('Debt $' + G.debt, cw - 14, 78);
  ctx.fillStyle = '#9fd08a'; ctx.fillText('Cred ' + G.cred, cw - 14, 98);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
  ctx.fillText(clockText(G), cw - 14, 118);
  ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif';
  ctx.fillText(districtAt(G.player.x, G.player.y).name + (G.muted ? ' · MUTED' : ''), cw - 14, 136);
  // objective banner top-center
  if (G.bannerT > 0 && G.banner) {
    ctx.textAlign = 'center'; ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = 'rgba(10,14,20,0.8)'; ctx.fillRect(cw / 2 - 320, 10, 640, 30);
    ctx.fillStyle = '#ffd94a'; ctx.fillText(G.banner, cw / 2, 31);
    const step = currentStep(G);
    if (step) {
      ctx.font = '13px sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText(step.label, cw / 2, 52);
    }
  }
  // race timer
  if (G.race) {
    ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#7dff8a';
    ctx.fillText('RACE ' + Math.ceil(G.race.t) + 's · Gate ' + (G.race.gate + 1) + '/5', cw / 2, 74);
  }
  // HP / armor bottom-left
  ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#fff'; ctx.fillText('HP', 14, ch - 44);
  ctx.fillStyle = '#333'; ctx.fillRect(44, ch - 54, 160, 12);
  ctx.fillStyle = '#e33'; ctx.fillRect(44, ch - 54, 160 * (G.player.hp / 100), 12);
  ctx.fillStyle = '#fff'; ctx.fillText('ARMOR', 14, ch - 24);
  ctx.fillStyle = '#333'; ctx.fillRect(44, ch - 34, 160, 12);
  ctx.fillStyle = '#36c'; ctx.fillRect(44, ch - 34, 160 * (G.player.armor / 100), 12);
  // speed bottom-right
  ctx.textAlign = 'right'; ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#fff';
  const v = G.player.inVehicle;
  ctx.fillText(v ? Math.round(Math.abs(v.speed) * 0.22) + ' mph · ' + VEHICLE_TYPES[v.type].label : Math.round(G.player.speed * 0.22) + ' mph · On foot', cw - 14, ch - 20);
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#aaa';
  ctx.fillText('E enter/exit · R race · P pause · M mute · Space handbrake', cw - 14, ch - 42);
  // toast
  if (G.toastT > 0 && G.toast) {
    ctx.textAlign = 'center'; ctx.font = '14px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(G.toast, cw / 2, ch - 70);
  }
  // dialogue box
  if (G.dialogue && G.dialogueT > 0) {
    ctx.fillStyle = 'rgba(10,14,20,0.85)'; ctx.fillRect(60, ch - 170, cw - 120, 84);
    ctx.strokeStyle = '#ffd94a'; ctx.strokeRect(60, ch - 170, cw - 120, 84);
    ctx.textAlign = 'left'; ctx.font = '14px sans-serif'; ctx.fillStyle = '#fff';
    G.dialogue.forEach((line, i) => ctx.fillText(line, 76, ch - 146 + i * 20));
  }
  if (G.mode === 'pause') drawPanel(ctx, cw, ch, 'PAUSED', ['P / Esc — resume', 'Mission ' + (G.missionIdx + 1) + '/10: ' + missionName(G), 'Cash $' + G.cash + ' · Debt $' + G.debt + ' · Cred ' + G.cred]);
  if (G.mode === 'dead') drawPanel(ctx, cw, ch, 'WASTED', ['You woke up at the Downtown clinic.', 'Lost 10% of your cash. Wanted cleared.', 'Press Enter to get back out there.']);
  if (G.missionComplete && G.mode === 'play') {
    const mc = G.missionComplete;
    drawPanel(ctx, cw, ch, 'MISSION COMPLETE — ' + mc.name, ['Pay $' + mc.pay, 'Remaining debt: $' + mc.debt, 'Press Enter / click to continue']);
  }
  if (G.mode === 'complete') {
    drawPanel(ctx, cw, ch, 'DEBT PAID — SOLMAR BAY IS YOURS', ['Rico Vale owes nothing. The city is yours now.', 'Free roam continues. Press Enter to keep playing.']);
  }
}

function drawPanel(ctx, cw, ch, title, lines) {
  ctx.fillStyle = 'rgba(5,8,14,0.72)'; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = 'rgba(16,22,32,0.95)'; ctx.fillRect(cw / 2 - 300, ch / 2 - 110, 600, 220);
  ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 2; ctx.strokeRect(cw / 2 - 300, ch / 2 - 110, 600, 220);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText(title, cw / 2, ch / 2 - 60);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, cw / 2, ch / 2 - 20 + i * 26));
}

function drawTitle(ctx, G, cw, ch) {
  // city backdrop: simple skyline
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, '#1b2a4a'); grad.addColorStop(0.6, '#3d4450'); grad.addColorStop(1, '#c9b183');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#2c3440';
  for (let i = 0; i < 14; i++) { const w = 60 + (i * 37) % 50, h = 160 + (i * 53) % 220; ctx.fillRect(30 + i * 88, ch - 120 - h, w, h); }
  ctx.fillStyle = '#ffd94a';
  for (let i = 0; i < 40; i++) ctx.fillRect(40 + (i * 97) % (cw - 60), ch - 300 + (i * 61) % 240, 6, 8);
  ctx.fillStyle = '#2a6d8f'; ctx.fillRect(0, ch - 60, cw, 60);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR BAY', cw / 2, ch / 2 - 90);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText('Rico Vale owes $12,000 to fixer Marisol Vega. Ten missions. One way out.', cw / 2, ch / 2 - 50);
  ctx.font = '15px sans-serif'; ctx.fillStyle = '#ddd';
  ctx.fillText('WASD move / drive · Mouse aim · Click shoot · E enter / steal · R race · Space handbrake', cw / 2, ch / 2 + 10);
  ctx.fillText('P pause · M mute · Sun coins +$25 · Taxi fares · Courier deliveries · Street races', cw / 2, ch / 2 + 34);
  const hasSave = G.hasSave;
  ctx.fillStyle = '#ffd94a'; ctx.fillRect(cw / 2 - 130, ch / 2 + 60, 260, 44);
  ctx.fillStyle = '#111'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText(hasSave ? 'CONTINUE (C)' : 'NEW GAME (Enter)', cw / 2, ch / 2 + 89);
  if (hasSave) { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText('or NEW GAME (N) — fresh start', cw / 2, ch / 2 + 130); }
}
