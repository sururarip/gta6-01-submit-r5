// Per-frame update for Solmar Bay: movement, missions, traffic, police, economy, clock.
import { VEHICLE_TYPES, addWanted, payPlayer, saveGame, toast, addFloat, burst, currentStep, missionName } from './game.js';
import { checkMission, startMission, completeMission, trySteal, exitVehicle, shoot, damagePlayer, destroyVehicle, spawnPolice, policeShoot } from './logic.js';
import { clamp, dist, angleLerp, randRange, TAU } from './rng.js';
import { ROADS_X, ROADS_Y, collideBuildings, inWater, districtAt, isOnRoad } from './world.js';

const RACE_GATES = [[700, 600], [1500, 600], [1500, 1000], [700, 1000], [1100, 600]];
const FLAG = { x: 1100, y: 1000 };

function moveVehicle(G, v, dt, input) {
  const t = VEHICLE_TYPES[v.type];
  const flat = G.time < (v.flatUntil || 0);
  const top = flat ? 80 : t.top;
  if (input.up) v.speed += t.accel * dt;
  if (input.down) v.speed -= t.accel * 0.9 * dt;
  if (input.handbrake) v.speed *= Math.pow(0.12, dt);
  v.speed -= v.speed * 0.55 * dt; // drag
  v.speed = clamp(v.speed, -top * 0.45, top);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = v.speed >= 0 ? 1 : -1;
  v.angle += steer * 2.4 * dt * clamp(Math.abs(v.speed) / 160, 0, 1) * dir;
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  if (v.type === 'boat') {
    if (!inWater(nx, ny) && dist(nx, ny, 3380, 560) > 120 && dist(nx, ny, 2960, 700) > 120) {
      // boats stay in water except right at the marina dock
      if (inWater(v.x, v.y)) { v.speed *= 0.4; } else { v.x = nx; v.y = ny; }
    } else { v.x = nx; v.y = ny; }
  } else if (!collideBuildings(G.city, nx, ny, 16)) {
    v.x = nx; v.y = ny;
  } else if (Math.abs(v.speed) > 200) { G.sfx.crash(); v.speed *= -0.3; }
  v.x = clamp(v.x, 300, 3400); v.y = clamp(v.y, 180, 2440);
}

export function update(G, dt) {
  G.time += dt;
  // clock: full day = 6 minutes of play
  G.clockMin += dt * 4;
  if (G.clockMin >= 1440) { G.clockMin -= 1440; G.day++; }
  const hour = Math.floor(G.clockMin / 60);
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.dialogueT > 0) G.dialogueT -= dt; else G.dialogue = null;
  if (G.toastT > 0) G.toastT -= dt;
  if (G.messageT > 0) G.messageT -= dt;
  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter((f) => f.t < 1.4);
  for (const pt of G.particles) { pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.98; pt.vy *= 0.98; }
  G.particles = G.particles.filter((p) => p.t < p.life);

  if (G.mode !== 'play') return;
  const k = G.keys;
  const input = {
    up: !!(k.KeyW || k.ArrowUp), down: !!(k.KeyS || k.ArrowDown),
    left: !!(k.KeyA || k.ArrowLeft), right: !!(k.KeyD || k.ArrowRight),
    handbrake: !!k.Space,
  };
  const p = G.player;

  // --- player / vehicle movement ---
  if (p.inVehicle) {
    const v = p.inVehicle;
    moveVehicle(G, v, dt, input);
    p.x = v.x; p.y = v.y; p.angle = v.angle; p.speed = v.speed;
    if (v.type !== 'boat' && isOnRoad(v.x, v.y) && Math.abs(v.speed) > 500 && G.wanted > 0) {
      // speeding past police is already handled by police proximity; nothing extra
    }
    G.sfx.engine(true, Math.abs(v.speed) / VEHICLE_TYPES[v.type].top);
  } else {
    const sp = (input.handbrake ? 330 : 220);
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
      if (!collideBuildings(G.city, nx, ny, 12) && !inWater(nx, ny)) { p.x = nx; p.y = ny; }
      p.speed = sp;
    } else p.speed = 0;
    p.x = clamp(p.x, 300, 3400); p.y = clamp(p.y, 180, 2440);
    G.sfx.engine(false, 0);
  }

  // --- camera ---
  G.cam.x += (p.x - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (p.y - G.cam.y) * Math.min(1, dt * 5);

  // --- flyby whoosh when entering the Airport ---
  const d = districtAt(p.x, p.y);
  if (d.name === 'Airport' && G.time - G.sfx.flybyAt > 20) {
    G.sfx.flybyAt = G.time; G.sfx.ensure(); G.sfx.flyby();
    toast(G, 'A night flight rumbles overhead — Solmar International');
  }

  // --- bullets ---
  for (const b of G.bullets) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (collideBuildings(G.city, b.x, b.y, 2)) b.t = b.life;
    if (b.fromPlayer) {
      for (const car of [...G.police, ...G.traffic]) {
        if (dist(b.x, b.y, car.x, car.y) < 26) {
          car.hp -= 25; b.t = b.life; burst(G, b.x, b.y, '#ffd94a', 5);
          if (car.hp <= 0) destroyVehicle(G, car, true);
          else if (G.police.includes(car)) addWanted(G, 1);
          break;
        }
      }
      for (const v of G.vehicles) {
        if (v.driver) continue;
        if (dist(b.x, b.y, v.x, v.y) < 26) { v.hp -= 25; b.t = b.life; if (v.hp <= 0) destroyVehicle(G, v, true); break; }
      }
    } else if (dist(b.x, b.y, p.x, p.y) < (p.inVehicle ? 26 : 14)) {
      b.t = b.life; damagePlayer(G, 8);
    }
  }
  G.bullets = G.bullets.filter((b) => b.t < b.life);

  // --- mouse shooting (held) ---
  if (G.mouse.down && G.mode === 'play') {
    G.shootCooldown = (G.shootCooldown || 0) - dt;
    if (G.shootCooldown <= 0) { G.shootCooldown = 0.22; shoot(G, G.mouse.wx, G.mouse.wy); }
  }

  // --- coins / pickups ---
  for (const c of G.coins) {
    if (!c.taken && dist(p.x, p.y, c.x, c.y) < 34) {
      c.taken = true; G.coinsGot++; G.cred += 1; payPlayer(G, 25, 'Sun coin');
      G.sfx.coin(); saveGame(G);
    }
  }
  for (const pk of G.pickups) {
    if (pk.taken) { pk.respawn -= dt; if (pk.respawn <= 0) pk.taken = false; continue; }
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true; pk.respawn = 25;
      if (pk.kind === 'health') p.hp = Math.min(100, p.hp + 40); else p.armor = Math.min(100, p.armor + 50);
      G.sfx.pickup(); addFloat(G, pk.x, pk.y, pk.kind === 'health' ? '+40 HP' : '+50 Armor', '#7dff8a');
    }
  }

  // --- police ---
  if (G.wanted > 0) spawnPolice(G);
  else if (G.police.length) G.police = [];
  for (const car of G.police) {
    const a = Math.atan2(p.y - car.y, p.x - car.x);
    car.angle = angleLerp(car.angle, a, dt * 1.6);
    car.speed = clamp(car.speed + 460 * dt, 0, 560);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!collideBuildings(G.city, nx, ny, 16)) { car.x = nx; car.y = ny; } else car.angle += 0.6;
    if (dist(car.x, car.y, p.x, p.y) < 34) {
      car.ramT = (car.ramT || 0) - dt;
      if (car.ramT <= 0) {
        car.ramT = 0.8;
        damagePlayer(G, 8);
        G.sfx.crash();
        if (p.inVehicle) { p.inVehicle.hp -= 10; if (p.inVehicle.hp <= 0) destroyVehicle(G, p.inVehicle, false); }
      }
      car.speed *= 0.5; car.x -= Math.cos(car.angle) * 30 * dt; car.y -= Math.sin(car.angle) * 30 * dt;
    }
    policeShoot(G, car, dt);
  }
  // heli circles the player
  if (G.heli) { G.heli.angle += dt * 0.5; G.heli.x = p.x + Math.cos(G.heli.angle) * 220; G.heli.y = p.y + Math.sin(G.heli.angle) * 220; }
  // spikes flatten tires
  for (const s of G.spikes) {
    if (p.inVehicle && dist(p.x, p.y, s.x, s.y) < 40 && Math.abs(p.inVehicle.speed) > 120) {
      p.inVehicle.flatUntil = G.time + 5; toast(G, 'Spike strip! Flat tires for 5s'); G.sfx.crash();
      G.spikes = G.spikes.filter((x) => x !== s);
    }
  }
  // wanted decay
  const nearCop = G.police.some((c) => dist(c.x, c.y, p.x, p.y) < 400);
  const hiding = G.cooldownSpots.some((s) => dist(p.x, p.y, s.x, s.y) < 90);
  if (!nearCop && G.wanted > 0) {
    G.wantedTimer += dt * (hiding ? 2.5 : 1);
    if (G.wantedTimer > 4) { G.wantedTimer = 0; addWanted(G, -1); if (G.wanted === 0) toast(G, 'You lost the cops.'); }
  } else G.wantedTimer = 0;
  G.sfx.sirenTick(dt, G.wanted > 0 && G.police.some((c) => dist(c.x, c.y, p.x, p.y) < 600));

  // --- traffic ---
  for (const t of G.traffic) {
    let ahead = false;
    for (const o of [...G.traffic, ...G.police]) {
      if (o === t) continue;
      const dx = o.x - t.x, dy = o.y - t.y;
      const fwd = dx * Math.cos(t.angle) + dy * Math.sin(t.angle);
      if (fwd > 0 && fwd < 70 && Math.abs(dx * Math.sin(t.angle) - dy * Math.cos(t.angle)) < 26) { ahead = true; break; }
    }
    if (p.inVehicle && dist(t.x, t.y, p.x, p.y) < 70) ahead = true;
    const target = ahead ? 0 : (t.cruise || 170);
    t.speed += clamp(target - t.speed, -260 * dt, 200 * dt);
    if (G.rng() < 0.0004) { t.dir *= -1; t.angle += Math.PI; }
    const nx = t.x + Math.cos(t.angle) * t.speed * dt;
    const ny = t.y + Math.sin(t.angle) * t.speed * dt;
    if (!collideBuildings(G.city, nx, ny, 16)) { t.x = nx; t.y = ny; }
    // wrap around map edges
    if (t.x < 320) t.x = 3380; if (t.x > 3380) t.x = 320;
    if (t.y < 200) t.y = 2420; if (t.y > 2420) t.y = 200;
    // keep roughly on roads: nudge back toward nearest road line
    if (!isOnRoad(t.x, t.y)) {
      const rx = ROADS_X.reduce((a, b) => Math.abs(b - t.x) < Math.abs(a - t.x) ? b : a);
      const ry = ROADS_Y.reduce((a, b) => Math.abs(b - t.y) < Math.abs(a - t.y) ? b : a);
      if (Math.abs(rx - t.x) < Math.abs(ry - t.y)) t.x += (rx - t.x) * dt * 0.4; else t.y += (ry - t.y) * dt * 0.4;
    }
  }

  // --- peds ---
  for (const pd of G.peds) {
    if (pd.flee > 0) {
      pd.flee -= dt;
      const a = Math.atan2(pd.y - p.y, pd.x - p.x);
      pd.x += Math.cos(a) * 130 * dt; pd.y += Math.sin(a) * 130 * dt;
    } else {
      pd.angle += (G.rng() - 0.5) * dt * 2;
      const nx = pd.x + Math.cos(pd.angle) * pd.speed * dt;
      const ny = pd.y + Math.sin(pd.angle) * pd.speed * dt;
      if (!collideBuildings(G.city, nx, ny, 8) && !inWater(nx, ny)) { pd.x = nx; pd.y = ny; }
      else pd.angle += Math.PI / 2;
    }
    pd.x = clamp(pd.x, 320, 3380); pd.y = clamp(pd.y, 200, 2420);
  }

  // --- taxi fares ---
  if (p.inVehicle && p.inVehicle.type === 'taxi' && !G.taxiFare) {
    if (G.rng() < dt * 0.25) {
      const a = G.rng() * Math.PI * 2, r = 250 + G.rng() * 300;
      const px = clamp(p.x + Math.cos(a) * r, 350, 3350), py = clamp(p.y + Math.sin(a) * r, 250, 2350);
      G.taxiFare = { stage: 'pickup', x: px, y: py, pay: 0 };
      toast(G, 'Taxi fare nearby — pick up the passenger');
    }
  }
  if (G.taxiFare) {
    const f = G.taxiFare;
    if (f.stage === 'pickup' && dist(p.x, p.y, f.x, f.y) < 60 && p.inVehicle && p.inVehicle.type === 'taxi') {
      const a = G.rng() * Math.PI * 2, r = 500 + G.rng() * 700;
      f.stage = 'drop'; f.x = clamp(p.x + Math.cos(a) * r, 350, 3350); f.y = clamp(p.y + Math.sin(a) * r, 250, 2350);
      f.pay = 60 + Math.floor(dist(p.x, p.y, f.x, f.y) / 20);
      toast(G, 'Passenger aboard — drop them off ($' + f.pay + ')');
    } else if (f.stage === 'drop' && dist(p.x, p.y, f.x, f.y) < 60) {
      payPlayer(G, f.pay, 'Taxi fare'); G.faresDone++; G.cred += 3; G.sfx.fare(); G.taxiFare = null;
    }
  }

  // --- courier deliveries ---
  G.deliveryTimer += dt;
  if (!G.delivery && G.deliveryTimer > 14) {
    G.deliveryTimer = 0;
    const a = G.rng() * Math.PI * 2, r = 200 + G.rng() * 400;
    const px = clamp(p.x + Math.cos(a) * r, 350, 3350), py = clamp(p.y + Math.sin(a) * r, 250, 2350);
    const dx = clamp(px + (G.rng() - 0.5) * 1400, 350, 3350), dy = clamp(py + (G.rng() - 0.5) * 1000, 250, 2350);
    G.delivery = { x: px, y: py, dx, dy, stage: 'pickup', pay: 50 + Math.floor(dist(px, py, dx, dy) / 25) };
    toast(G, 'Courier package nearby — pick it up');
  }
  if (G.delivery) {
    const dl = G.delivery;
    if (dl.stage === 'pickup' && dist(p.x, p.y, dl.x, dl.y) < 55) { dl.stage = 'drop'; toast(G, 'Package collected — deliver it ($' + dl.pay + ')'); }
    else if (dl.stage === 'drop' && dist(p.x, p.y, dl.dx, dl.dy) < 55) {
      payPlayer(G, dl.pay, 'Courier delivery'); G.deliveriesDone++; G.cred += 2; G.sfx.fare(); G.delivery = null;
    }
  }

  // --- race ---
  if (G.race) {
    const r = G.race;
    r.t -= dt;
    const gate = RACE_GATES[r.gate];
    if (gate && dist(p.x, p.y, gate[0], gate[1]) < 70) {
      r.gate++; G.sfx.pickup();
      addFloat(G, gate[0], gate[1], 'Gate ' + r.gate + '/5', '#7dff8a');
    }
    if (r.gate >= RACE_GATES.length) {
      const bonus = Math.max(0, Math.floor(r.t)) * 2;
      payPlayer(G, 150 + bonus, 'Race won');
      G.racesWon++; G.cred += 8; G.sfx.missionDone();
      if (G.mission && currentStep(G) && currentStep(G).kind === 'race') G.missionData.raceDone = true;
      toast(G, 'Race won! $' + (150 + bonus));
      G.race = null;
    } else if (r.t <= 0) { toast(G, 'Race failed — out of time'); G.race = null; }
  }

  checkMission(G);
  if (G.pendingMission && G.missionComplete) {
    // mission-complete card is shown by render; Enter/click advances in main.js
  }
  if (G.mode === 'complete') { /* free roam continues after the card */ }
}

// Start a street race at the flag (R key).
export function tryStartRace(G) {
  if (G.race) return;
  const p = G.player;
  if (dist(p.x, p.y, FLAG.x, FLAG.y) > 90) { toast(G, 'Go to the Downtown race flag to start a race'); return; }
  G.race = { gate: 0, t: 75 };
  setBanner(G, 'STREET RACE — 5 gates, 75 seconds');
  G.sfx.missionStart();
}
export { FLAG, RACE_GATES };
