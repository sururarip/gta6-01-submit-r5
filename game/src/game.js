// Solmar Bay core state: missions, vehicles, helpers.
import { mulberry32, randRange, clamp } from './rng.js';
import { buildCity, ROADS_X, ROADS_Y } from './world.js';
import { Sfx } from './audio.js';

export const SAVE_KEY = 'solmarbay-save-v1';
export const DEBT_TOTAL = 12000;

export const VEHICLE_TYPES = {
  sedan: { top: 430, accel: 340, w: 46, h: 22, color: '#4a7dd4', label: 'Sedan' },
  taxi: { top: 420, accel: 330, w: 46, h: 22, color: '#f2c531', label: 'Taxi' },
  pickup: { top: 400, accel: 300, w: 50, h: 24, color: '#a85638', label: 'Pickup' },
  sports: { top: 620, accel: 520, w: 46, h: 20, color: '#d43a5c', label: 'Sports Car' },
  van: { top: 360, accel: 260, w: 52, h: 24, color: '#8a94a0', label: 'Van' },
  bus: { top: 320, accel: 200, w: 64, h: 26, color: '#3f9e6b', label: 'Bus' },
  police: { top: 560, accel: 460, w: 48, h: 22, color: '#22282f', label: 'Police' },
  boat: { top: 420, accel: 300, w: 56, h: 24, color: '#e8e4da', label: 'Boat' },
  motorcycle: { top: 660, accel: 560, w: 34, h: 16, color: '#e8a13c', label: 'Motorcycle' },
};

export const MISSIONS = [
  { name: 'First Errand', pay: 500, dialogue: ['MARISOL: Rico. Twelve grand, remember?', 'MARISOL: Warehouse at the Harbor first, then the drop Downtown.', 'RICO: Yeah yeah. I got it. I always got it.'],
    steps: [{ kind: 'goto', x: 2900, y: 800, label: 'Go to the Harbor warehouse' }, { kind: 'goto', x: 1000, y: 760, label: 'Deliver the package Downtown' }] },
  { name: 'Wheels Up', pay: 700, dialogue: ['MARISOL: I need wheels. Fast ones.', 'MARISOL: Steal the sports car near the Mall, bring it to the Old Town garage.', 'RICO: Stealing cars. My favorite kind of errand.'],
    steps: [{ kind: 'steal', label: 'Steal a sports car (walk up, press E)' }, { kind: 'goto', x: 1450, y: 1250, needCar: true, label: 'Drive it to the Old Town garage' }] },
  { name: 'The Collector', pay: 900, dialogue: ['MARISOL: Three packages washed up on the Beach.', 'MARISOL: Grab all three before the tide takes them.', 'RICO: Beach day. Finally a perk.'],
    steps: [{ kind: 'collect', points: [[700, 2050], [1800, 2100], [2900, 2050]], label: 'Collect the 3 beach packages' }] },
  { name: 'Hot Wheels', pay: 1000, dialogue: ['MARISOL: A street race Downtown. Win it, take the pot.', 'MARISOL: Press R at the flag. Five gates, seventy-five seconds.', 'RICO: I was born for this.'],
    steps: [{ kind: 'race', label: 'Press R at the Downtown flag to start the race' }] },
  { name: 'Heat Wave', pay: 1100, dialogue: ['MARISOL: The cops think they own this city.', 'MARISOL: Get to two stars, then shake them off completely.', 'RICO: Time to make some noise.'],
    steps: [{ kind: 'heat', stars: 2, label: 'Raise your wanted level to 2 stars' }, { kind: 'cool', label: 'Lose the cops — back to 0 stars' }] },
  { name: 'Taxi Nights', pay: 1200, dialogue: ['MARISOL: A cab driver owes me a favor. His cab owes you one too.', 'MARISOL: Two fares. Smile for the customers.', 'RICO: Five stars, please. Tip in cash.'],
    steps: [{ kind: 'fares', n: 2, label: 'Complete 2 taxi fares' }] },
  { name: 'Harbor Lights', pay: 1300, dialogue: ['MARISOL: The boat at the Marina. Take it to the lighthouse buoy.', 'MARISOL: Then sail straight back. No detours, Rico.', 'RICO: A boat? Now we are talking.'],
    steps: [{ kind: 'boat', x: 3420, y: 470, label: 'Sail the boat to the lighthouse buoy' }, { kind: 'boat', x: 2960, y: 700, label: 'Sail back to the Marina' }] },
  { name: 'Stadium Standoff', pay: 1400, dialogue: ['MARISOL: Four cops are guarding a stash at Bay Stadium.', 'MARISOL: Put them down. All four.', 'RICO: Loud it is, then.'],
    steps: [{ kind: 'defeat', n: 4, x: 1300, y: 1530, label: 'Defeat 4 police at Bay Stadium' }] },
  { name: 'Runway Heist', pay: 1700, dialogue: ['MARISOL: I smuggled cargo on a night flight. It is on the plane.', 'MARISOL: Grab it off the runway, then bring it to the Old Town garage.', 'RICO: The Airport? Marisol, you are insane. I love it.'],
    steps: [{ kind: 'goto', x: 2050, y: 440, label: 'Pick up the air cargo at the parked plane' }, { kind: 'goto', x: 1450, y: 1250, label: 'Deliver the cargo to the Old Town garage' }] },
  { name: 'The Getaway', pay: 2200, dialogue: ['MARISOL: Last job, Rico. Make it loud, then make it clean.', 'MARISOL: Three stars, lose them all, then bring me the final payment.', 'RICO: Twelve grand. Tonight this debt dies.'],
    steps: [{ kind: 'heat', stars: 3, label: 'Raise your wanted level to 3 stars' }, { kind: 'cool', label: 'Lose the cops — back to 0 stars' }, { kind: 'goto', x: 1000, y: 760, label: 'Bring the final payment to Marisol Downtown' }] },
];

const PARKED_SPOTS = [
  ['sports', 900, 640], ['motorcycle', 900, 640 + 0], ['sedan', 1100, 560], ['taxi', 1500, 900],
  ['pickup', 700, 1200], ['van', 1900, 1000], ['sedan', 2300, 600], ['sports', 2700, 1000],
  ['motorcycle', 2500, 1440], ['sedan', 3100, 1400], ['taxi', 700, 1800], ['pickup', 1900, 1800],
  ['van', 2700, 1800], ['sedan', 1100, 2200], ['sports', 2300, 2200], ['bus', 1500, 1400],
];
// fix the duplicate motorcycle spot: move it off the sports car
PARKED_SPOTS[1] = ['motorcycle', 860, 700];

const COIN_SPOTS = [[500, 400], [900, 800], [1300, 300], [1700, 900], [2100, 500], [2500, 800], [2900, 400], [3300, 900], [500, 1200], [900, 1600], [1300, 1200], [1700, 1600], [2100, 1300], [2500, 1700], [2900, 1300], [500, 2050], [1100, 2150], [2000, 2250], [2700, 2150], [3200, 2050]];
const PICKUP_SPOTS = [[800, 700], [1200, 900], [1600, 500], [2000, 800], [2400, 1000], [2800, 700], [600, 1400], [1000, 1700], [1600, 1500], [2200, 1200], [2600, 1600], [3000, 1800], [800, 2100], [2400, 2100]];
export const COOLDOWN_SPOTS = [[600, 500], [1400, 1500], [2600, 900], [2000, 2000], [1000, 2200]];

export function createGame(seed) {
  const rng = mulberry32(seed || 7);
  const city = buildCity(seed || 7);
  const vehicles = [];
  let vid = 1;
  for (const [type, x, y] of PARKED_SPOTS) {
    vehicles.push({ id: vid++, type, x, y, angle: (rng() * Math.PI * 2), speed: 0, hp: 100, maxHp: 100, parked: true, driver: null, flatUntil: 0, color: VEHICLE_TYPES[type].color });
  }
  vehicles.push({ id: vid++, type: 'boat', x: 3380, y: 560, angle: Math.PI, speed: 0, hp: 100, maxHp: 100, parked: true, driver: null, flatUntil: 0, color: '#e8e4da' });
  const traffic = [];
  for (let i = 0; i < 18; i++) {
    const vertical = rng() < 0.5;
    const x = vertical ? ROADS_X[Math.floor(rng() * ROADS_X.length)] : randRange(rng, 350, 3350);
    const y = vertical ? randRange(rng, 250, 2350) : ROADS_Y[Math.floor(rng() * ROADS_Y.length)];
    const type = ['sedan', 'sedan', 'taxi', 'pickup', 'van', 'bus'][Math.floor(rng() * 6)];
    traffic.push({ id: vid++, type, x, y, angle: vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI), speed: randRange(rng, 120, 200), hp: 60, maxHp: 60, vertical, dir: rng() < 0.5 ? 1 : -1, driver: 'traffic', flatUntil: 0, color: VEHICLE_TYPES[type].color });
  }
  const peds = [];
  for (let i = 0; i < 30; i++) {
    const x = randRange(rng, 350, 3350), y = randRange(rng, 250, 2350);
    peds.push({ x, y, angle: rng() * Math.PI * 2, speed: randRange(rng, 30, 60), flee: 0, color: ['#e8d44a', '#7fb2ff', '#e07f9a', '#9fd08a', '#e0a06f'][i % 5] });
  }
  const G = {
    seed: seed || 7, rng, city, mode: 'title', time: 0, clockMin: 600, day: 1,
    player: { x: 950, y: 1000, angle: -Math.PI / 2, speed: 0, hp: 100, armor: 0, inVehicle: null, onFoot: true },
    vehicles, traffic, peds, police: [], bullets: [], particles: [], floats: [],
    coins: COIN_SPOTS.map(([x, y]) => ({ x, y, taken: false })),
    pickups: PICKUP_SPOTS.map(([x, y], i) => ({ x, y, kind: i % 2 === 0 ? 'health' : 'armor', taken: false, respawn: 0 })),
    cooldownSpots: COOLDOWN_SPOTS.map(([x, y]) => ({ x, y })),
    cash: 0, debt: DEBT_TOTAL, cred: 0, wanted: 0, wantedTimer: 0,
    missionIdx: 0, missionStep: 0, mission: null, missionData: {},
    copsDown: 0, carsStolen: 0, racesWon: 0, faresDone: 0, deliveriesDone: 0, coinsGot: 0,
    keys: {}, mouse: { x: 0, y: 0, down: false }, cam: { x: 950, y: 1000 },
    banner: '', bannerT: 0, dialogue: null, dialogueT: 0, toast: '', toastT: 0,
    race: null, taxiFare: null, delivery: null, deliveryTimer: 0,
    heli: null, roadblocks: [], spikes: [], spikesSpawned: false,
    sfx: new Sfx(), muted: false, shotMode: null, shotFrames: 0,
    stats: { shots: 0, kills: 0 },
    message: '', messageT: 0,
  };
  return G;
}

export function addFloat(G, x, y, text, color) {
  G.floats.push({ x, y, text, color: color || '#fff', t: 0 });
  if (G.floats.length > 24) G.floats.shift();
}
export function burst(G, x, y, color, n) {
  for (let i = 0; i < (n || 14); i++) {
    const a = G.rng() * Math.PI * 2, s = 60 + G.rng() * 220;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.5 + G.rng() * 0.5, color: color || '#ffcf5e', size: 2 + G.rng() * 3 });
  }
  if (G.particles.length > 300) G.particles.splice(0, G.particles.length - 300);
}
export function say(G, lines, dur) {
  G.dialogue = lines; G.dialogueT = dur || 9;
}
export function setBanner(G, text) { G.banner = text; G.bannerT = 5; }
export function toast(G, text) { G.toast = text; G.toastT = 3; }
export function addWanted(G, n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.wantedTimer = 0;
}
export function payPlayer(G, amount, reason) {
  G.cash += amount; G.debt = Math.max(0, G.debt - amount);
  addFloat(G, G.player.x, G.player.y - 30, '+$' + amount, '#7dff8a');
  if (reason) toast(G, reason + ' +$' + amount);
}
export function saveGame(G) {
  try {
    const data = { cash: G.cash, debt: G.debt, cred: G.cred, missionIdx: G.missionIdx, coinsGot: G.coinsGot, coins: G.coins.map((c) => c.taken), carsStolen: G.carsStolen, racesWon: G.racesWon, faresDone: G.faresDone, deliveriesDone: G.deliveriesDone, copsDown: G.copsDown };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage unavailable */ }
}
export function loadGame(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    G.cash = d.cash || 0; G.debt = d.debt ?? DEBT_TOTAL; G.cred = d.cred || 0;
    G.missionIdx = d.missionIdx || 0; G.coinsGot = d.coinsGot || 0;
    G.carsStolen = d.carsStolen || 0; G.racesWon = d.racesWon || 0;
    G.faresDone = d.faresDone || 0; G.deliveriesDone = d.deliveriesDone || 0; G.copsDown = d.copsDown || 0;
    if (Array.isArray(d.coins)) d.coins.forEach((t, i) => { if (t && G.coins[i]) G.coins[i].taken = true; });
    return true;
  } catch { return false; }
}
export function currentStep(G) {
  if (!G.mission) return null;
  return MISSIONS[G.missionIdx].steps[G.missionStep] || null;
}
export function missionName(G) { return MISSIONS[G.missionIdx] ? MISSIONS[G.missionIdx].name : 'Free Roam'; }
