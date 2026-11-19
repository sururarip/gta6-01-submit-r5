// Screenshot staging for Solmar Bay: fixed scenes, no title screen.
import { startMission } from './logic.js';
import { VEHICLE_TYPES } from './game.js';

function putPlayerIn(G, type, x, y, angle) {
  const v = G.vehicles.find((vv) => vv.type === type && !vv.driver);
  const p = G.player;
  if (v) {
    v.x = x; v.y = y; v.angle = angle; v.speed = 0; v.parked = false; v.driver = 'player';
    p.inVehicle = v; p.onFoot = false; p.x = x; p.y = y; p.angle = angle;
  } else {
    p.x = x; p.y = y; p.angle = angle;
  }
  G.cam.x = x; G.cam.y = y;
}

export function stageShot(G, name) {
  G.mode = 'play';
  G.shotMode = name;
  G.dialogueT = 10;
  if (name === 'chase') {
    startMission(G, 1); // Wheels Up, mission 2 live
    putPlayerIn(G, 'sports', 1100, 800, -Math.PI / 2);
    G.wanted = 3;
    G.police = [];
    const spots = [[1100, 950, -Math.PI / 2], [1000, 900, -Math.PI / 4], [1200, 920, -Math.PI * 0.75]];
    spots.forEach(([x, y, a], i) => {
      G.police.push({ id: 9100 + i, type: 'police', x, y, angle: a, speed: 300, hp: 80, maxHp: 80, driver: 'police', flatUntil: 0, color: '#22282f' });
    });
    G.clockMin = 600; // 10:00 daytime
    G.cam.x = 1100; G.cam.y = 850;
  } else if (name === 'airport') {
    startMission(G, 8); // Runway Heist, mission 9 live
    putPlayerIn(G, 'motorcycle', 1980, 470, 0);
    G.wanted = 1;
    G.clockMin = 18 * 60 + 20; // 18:20 dusk
    G.police = [{ id: 9101, type: 'police', x: 2150, y: 560, angle: Math.PI, speed: 200, hp: 80, maxHp: 80, driver: 'police', flatUntil: 0, color: '#22282f' }];
    G.cam.x = 2050; G.cam.y = 470;
  } else if (name === 'taxi') {
    startMission(G, 5); // Taxi Nights, mission 6 live
    putPlayerIn(G, 'taxi', 1500, 1000, 0);
    G.taxiFare = { stage: 'drop', x: 2100, y: 1000, pay: 118 };
    G.clockMin = 14 * 60 + 30;
    G.cam.x = 1700; G.cam.y = 1000;
  } else if (name === 'harbor') {
    startMission(G, 6); // Harbor Lights, mission 7 live
    const boat = G.vehicles.find((v) => v.type === 'boat');
    const p = G.player;
    if (boat) {
      boat.x = 3300; boat.y = 620; boat.angle = -Math.PI / 2; boat.parked = false; boat.driver = 'player';
      p.inVehicle = boat; p.onFoot = false; p.x = 3300; p.y = 620;
    }
    G.clockMin = 11 * 60;
    G.cam.x = 3250; G.cam.y = 560;
  }
  G.bannerT = 10;
}
