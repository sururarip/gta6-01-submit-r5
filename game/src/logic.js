// Mission flow, vehicles, combat and police for Solmar Bay.
import { MISSIONS, VEHICLE_TYPES, addWanted, payPlayer, saveGame, say, setBanner, toast, addFloat, burst, currentStep, missionName } from './game.js';
import { dist, clamp, randRange } from './rng.js';
import { ROADS_X, ROADS_Y } from './world.js';

export function startMission(G, idx) {
  const m = MISSIONS[idx];
  if (!m) { G.mission = null; return; }
  G.missionIdx = idx; G.missionStep = 0; G.mission = m;
  G.missionData = { collected: 0, copsStart: G.copsDown, faresStart: G.faresDone, raceDone: false };
  setBanner(G, 'MISSION ' + (idx + 1) + '/10 — ' + m.name + '  ·  $' + m.pay);
  say(G, m.dialogue, 10);
  G.sfx.ensure(); G.sfx.missionStart();
}

export function completeMission(G) {
  const m = MISSIONS[G.missionIdx];
  payPlayer(G, m.pay, 'Mission complete: ' + m.name);
  G.cred += 15;
  G.sfx.missionDone();
  G.missionComplete = { name: m.name, pay: m.pay, debt: G.debt };
  G.mission = null; G.missionStep = 0;
  saveGame(G);
  if (G.missionIdx >= MISSIONS.length - 1) {
    G.mode = 'complete';
    return;
  }
  G.missionIdx++;
  // next mission starts when the player presses Enter / clicks continue
  G.pendingMission = true;
}

export function advanceStep(G) {
  G.missionStep++;
  const step = currentStep(G);
  if (!step) { completeMission(G); return; }
  setBanner(G, 'MISSION ' + (G.missionIdx + 1) + '/10 — ' + missionName(G));
  toast(G, step.label);
  G.sfx.pickup();
}

// --- mission step checks, called every frame from update ---
export function checkMission(G) {
  if (!G.mission || G.mode !== 'play') return;
  const step = currentStep(G);
  if (!step) return;
  const p = G.player;
  const near = (x, y, r) => dist(p.x, p.y, x, y) < r;
  switch (step.kind) {
    case 'goto': {
      if (step.needCar && !p.inVehicle) break;
      if (near(step.x, step.y, 70)) advanceStep(G);
      break;
    }
    case 'collect': {
      for (let i = 0; i < step.points.length; i++) {
        const pt = step.points[i];
        if (!G.missionData.done) G.missionData.done = {};
        if (!G.missionData.done[i] && near(pt[0], pt[1], 55)) {
          G.missionData.done[i] = true; G.missionData.collected++;
          addFloat(G, pt[0], pt[1], 'Package ' + G.missionData.collected + '/3', '#7dff8a');
          G.sfx.pickup();
          if (G.missionData.collected >= step.points.length) advanceStep(G);
        }
      }
      break;
    }
    case 'steal': {
      if (G.missionData.stolen) advanceStep(G);
      break;
    }
    case 'race': {
      if (G.missionData.raceDone) advanceStep(G);
      break;
    }
    case 'heat': {
      if (G.wanted >= step.stars) advanceStep(G);
      break;
    }
    case 'cool': {
      if (G.wanted <= 0) advanceStep(G);
      break;
    }
    case 'fares': {
      if (G.faresDone - G.missionData.faresStart >= step.n) advanceStep(G);
      break;
    }
    case 'boat': {
      if (p.inVehicle && p.inVehicle.type === 'boat' && near(step.x, step.y, 80)) advanceStep(G);
      break;
    }
    case 'defeat': {
      if (G.copsDown - G.missionData.copsStart >= step.n) advanceStep(G);
      break;
    }
  }
}

// --- vehicles ---
export function nearestVehicle(G, x, y, maxD) {
  let best = null, bd = maxD || 70;
  for (const v of G.vehicles) {
    if (v.driver) continue;
    const d = dist(x, y, v.x, v.y);
    if (d < bd) { bd = d; best = v; }
  }
  for (const t of G.traffic) {
    const d = dist(x, y, t.x, t.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
export function enterVehicle(G, v) {
  const p = G.player;
  if (!v) return false;
  if (v.type === 'boat' && !nearWaterSpot(p)) { /* boats only boarded at the marina */ }
  p.inVehicle = v; p.onFoot = false; v.driver = 'player'; v.parked = false;
  v.speed = 0;
  if (v.parked === false && v.stolen !== true && G.mission && currentStep(G) && currentStep(G).kind === 'steal' && v.type === 'sports') {
    G.missionData.stolen = true;
  }
  if (v.wasParked) { /* fallthrough */ }
  return true;
}
function nearWaterSpot(p) { return p.x > 3300 || p.y > 2350; }

export function trySteal(G) {
  const p = G.player;
  const v = nearestVehicle(G, p.x, p.y, 75);
  if (!v) { toast(G, 'No vehicle nearby'); G.sfx.denied(); return; }
  const wasParked = v.parked || v.driver === null;
  const wasTraffic = G.traffic.includes(v);
  if (wasTraffic) G.traffic = G.traffic.filter((t) => t !== v);
  enterVehicle(G, v);
  if (wasParked || wasTraffic) {
    G.carsStolen++;
    addWanted(G, 1);
    toast(G, 'Stole a ' + VEHICLE_TYPES[v.type].label + ' — wanted +1 star');
    G.sfx.crash();
    const step = G.mission ? currentStep(G) : null;
    if (step && step.kind === 'steal') G.missionData.stolen = true;
  }
}
export function exitVehicle(G) {
  const p = G.player;
  if (!p.inVehicle) return;
  const v = p.inVehicle;
  v.driver = null; v.speed = 0;
  p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 40;
  p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 40;
  p.angle = v.angle; p.inVehicle = null; p.onFoot = true; p.speed = 0;
}

// --- shooting / damage ---
export function shoot(G, wx, wy) {
  const p = G.player;
  const ox = p.inVehicle ? p.inVehicle.x : p.x;
  const oy = p.inVehicle ? p.inVehicle.y : p.y;
  const a = Math.atan2(wy - oy, wx - ox);
  G.bullets.push({ x: ox + Math.cos(a) * 26, y: oy + Math.sin(a) * 26, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, t: 0, life: 0.8, fromPlayer: true });
  G.sfx.ensure(); G.sfx.shoot();
  addWanted(G, 0); // shooting alone does not add stars; hitting police does
  for (const pd of G.peds) if (dist(pd.x, pd.y, ox, oy) < 260) pd.flee = 3;
}
export function damagePlayer(G, amount) {
  const p = G.player;
  let left = amount;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, left * 0.7); p.armor -= absorbed; left -= absorbed; }
  p.hp -= left;
  if (p.hp <= 0) {
    p.hp = 0;
    G.mode = 'dead';
    G.cash = Math.floor(G.cash * 0.9);
    addWanted(G, -G.wanted);
    toast(G, 'You woke up at the Downtown clinic. Lost 10% cash.');
  }
}
export function destroyVehicle(G, v, byPlayer) {
  burst(G, v.x, v.y, '#ff8a3c', 22);
  burst(G, v.x, v.y, '#555', 12);
  G.sfx.explosion();
  if (byPlayer) { G.cred += 2; addFloat(G, v.x, v.y, '+2 cred', '#ffd94a'); }
  if (v.driver === 'police') {
    G.copsDown++; G.stats.kills++;
    addWanted(G, 1);
    G.police = G.police.filter((c) => c !== v);
  } else if (G.traffic.includes(v)) {
    G.traffic = G.traffic.filter((t) => t !== v);
    addWanted(G, 1);
  } else if (G.vehicles.includes(v)) {
    if (G.player.inVehicle === v) exitVehicle(G);
    G.vehicles = G.vehicles.filter((x) => x !== v);
  }
}

// --- police ---
export function spawnPolice(G) {
  const want = Math.floor(G.wanted);
  const p = G.player;
  while (G.police.length < want) {
    const a = G.rng() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(a) * 700, 350, 3350);
    const y = clamp(p.y + Math.sin(a) * 700, 250, 2350);
    G.police.push({ id: 9000 + G.police.length, type: 'police', x, y, angle: a, speed: 0, hp: 80, maxHp: 80, driver: 'police', flatUntil: 0, color: '#22282f' });
  }
  while (G.police.length > want) G.police.pop();
  if (G.wanted >= 4 && !G.heli) G.heli = { x: p.x, y: p.y - 300, angle: 0 };
  if (G.wanted < 4) G.heli = null;
  if (G.wanted >= 3 && G.roadblocks.length === 0) {
    const rx = ROADS_X[Math.floor(G.rng() * ROADS_X.length)];
    G.roadblocks = [
      { x: rx, y: clamp(p.y - 500, 300, 2300), angle: Math.PI / 2 },
      { x: rx, y: clamp(p.y + 500, 300, 2300), angle: Math.PI / 2 },
    ];
  }
  if (G.wanted < 3) G.roadblocks = [];
  if (G.wanted >= 5 && !G.spikesSpawned) {
    G.spikesSpawned = true;
    G.spikes = [{ x: clamp(p.x + 300, 350, 3350), y: p.y }, { x: p.x, y: clamp(p.y + 300, 250, 2350) }];
  }
  if (G.wanted < 5) { G.spikes = []; G.spikesSpawned = false; }
}
export function policeShoot(G, car, dt) {
  car.shootT = (car.shootT || 0) - dt;
  const p = G.player;
  const d = dist(car.x, car.y, p.x, p.y);
  if (d < 420 && car.shootT <= 0) {
    car.shootT = 1.1 + G.rng() * 0.8;
    const a = Math.atan2(p.y - car.y, p.x - car.x) + (G.rng() - 0.5) * 0.2;
    G.bullets.push({ x: car.x, y: car.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, t: 0, life: 1, fromPlayer: false });
    G.sfx.shoot();
  }
}
