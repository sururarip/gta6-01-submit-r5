// World layout for Solmar Bay: districts, roads, city generation, collisions.
import { mulberry32, randRange } from './rng.js';

export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_W = 64;

export const DISTRICTS = [
  { name: 'Downtown', x: 300, y: 200, w: 1400, h: 800, ground: '#3d4450', accent: '#7fb2ff' },
  { name: 'Harbor', x: 2400, y: 200, w: 1200, h: 800, ground: '#46525a', accent: '#6fd3e0' },
  { name: 'Beach', x: 300, y: 1900, w: 3300, h: 700, ground: '#c9b183', accent: '#ffcf5e' },
  { name: 'Old Town', x: 300, y: 1100, w: 1400, h: 700, ground: '#5a4a3c', accent: '#e0a06f' },
  { name: 'Suburbs', x: 1800, y: 1100, w: 1800, h: 700, ground: '#4a5d43', accent: '#9fd08a' },
  { name: 'Airport', x: 1750, y: 200, w: 600, h: 600, ground: '#4a4d55', accent: '#ffd94a' },
];

export const LANDMARKS = [
  { kind: 'mall', name: 'Solmar Mall', x: 820, y: 520, w: 260, h: 160 },
  { kind: 'stadium', name: 'Bay Stadium', x: 1120, y: 1420, w: 360, h: 220 },
  { kind: 'lighthouse', name: 'Lighthouse', x: 3300, y: 330, w: 120, h: 120 },
  { kind: 'marina', name: 'Marina', x: 2820, y: 620, w: 300, h: 180 },
  { kind: 'terminal', name: 'Terminal', x: 1800, y: 220, w: 240, h: 120 },
  { kind: 'tower', name: 'Control Tower', x: 2280, y: 240, w: 60, h: 60 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[0];
}
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}
export function inWater(x, y) {
  if (x >= 3360 && y >= 180 && y < 1040) return true;
  if (y >= 2400 && x >= 280 && x < 3600) return true;
  return false;
}
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function buildCity(seed) {
  const rng = mulberry32(seed || 7);
  const buildings = [];
  const parks = [];
  const xs = [280, ...ROADS_X, 3400];
  const ys = [180, ...ROADS_Y, 2440];
  const palettes = {
    Downtown: ['#5a6a80', '#6b7c96', '#4d5c74', '#7a8ba8'],
    Harbor: ['#5d6d75', '#6e7f88', '#54636b'],
    Beach: ['#d8c49a', '#e6d3a8', '#cbb27e'],
    'Old Town': ['#7a5f47', '#8a6f55', '#6b5340'],
    Suburbs: ['#6b7d5e', '#7d8f70', '#5d6f52'],
    Airport: ['#565a64'],
  };
  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iy = 0; iy < ys.length - 1; iy++) {
      const cx0 = xs[ix] + 44, cy0 = ys[iy] + 44;
      const cw = xs[ix + 1] - xs[ix] - 88, ch = ys[iy + 1] - ys[iy] - 88;
      if (cw < 90 || ch < 70) continue;
      const cx = cx0 + cw / 2, cy = cy0 + ch / 2;
      const d = districtAt(cx, cy);
      if (inWater(cx, cy)) continue;
      const probe = { x: cx0, y: cy0, w: cw, h: ch };
      if (LANDMARKS.some((l) => overlaps(probe, l))) continue;
      if (d.name === 'Airport') continue; // airport stays open tarmac, only terminal + tower
      if (rng() < 0.16) { parks.push({ x: cx0, y: cy0, w: cw, h: ch, trees: Math.floor(randRange(rng, 3, 7)) }); continue; }
      const w = Math.min(cw, randRange(rng, 90, cw));
      const h = Math.min(ch, randRange(rng, 70, ch));
      const pal = palettes[d.name] || palettes.Downtown;
      buildings.push({
        x: cx - w / 2 + randRange(rng, -8, 8), y: cy - h / 2 + randRange(rng, -8, 8),
        w, h, color: pal[Math.floor(rng() * pal.length)],
        district: d.name, tall: d.name === 'Downtown' && rng() < 0.5,
        seed: Math.floor(rng() * 100000),
      });
    }
  }
  for (const l of LANDMARKS) {
    buildings.push({
      x: l.x, y: l.y, w: l.w, h: l.h, landmark: l.kind, name: l.name,
      color: l.kind === 'stadium' ? '#7d8a96' : l.kind === 'lighthouse' ? '#e8e2d2' : l.kind === 'terminal' ? '#8a94a6' : l.kind === 'tower' ? '#9aa4b5' : '#6d7f88',
      district: districtAt(l.x + l.w / 2, l.y + l.h / 2).name, tall: l.kind === 'tower' || l.kind === 'lighthouse',
      seed: 42,
    });
  }
  return { buildings, parks };
}

export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function pointBlocked(city, x, y, r) {
  if (x < 300 || x > 3400 || y < 180 || y > 2440) return true;
  if (inWater(x, y)) return true;
  return collideBuildings(city, x, y, r) !== null;
}
