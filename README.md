# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sururarip/gta6-01-submit-r5/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sururarip/gta6-01-submit-r5/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game. Rico Vale owes $12,000 to fixer Marisol Vega.
Ten missions, one way out — then the city is yours.

## How to run

```sh
node serve.ts
```

Open `http://localhost:8080` in a desktop browser. No build step, no libraries,
plain ES modules + canvas, Node 22 stdlib only for the tooling.

## How to play

- **WASD / arrows** — move on foot, drive in a vehicle
- **Mouse + click** — aim and shoot (pistol)
- **E** — enter / steal a nearby vehicle, exit a vehicle
- **R** — start a street race at the Downtown flag
- **Space** — handbrake / sprint
- **P / Esc** — pause, **M** — mute, **Enter** — start / continue

## Systems

- **10-mission story** — payouts sum to exactly $12,000, the debt. Missions: errands,
  car theft, beach pickups, a street race, heat / cool-down, taxi fares, a boat run to
  the lighthouse, a stadium standoff, a runway heist at the new Airport district, and
  the final getaway.
- **Open world** — six districts (Downtown, Harbor, Beach, Old Town, Suburbs, and the
  new Airport with runway, terminal, control tower and a parked passenger plane),
  seeded city generation, traffic that brakes and wraps, pedestrians who flee gunfire.
- **Wanted 0–5 stars** — police chases, roadblocks at 3+, a searchlight helicopter at
  4+, spike strips at 5 stars. Hide at payphones and alleys to cool off faster.
- **Vehicles** — sedan, taxi, pickup, sports car, van, bus, police cruiser, boat, and
  the new motorcycle (fastest in the city, 660 top speed).
- **Day / night cycle** — a full day lasts 6 minutes of play: day, dusk, night with
  glowing windows and headlight cones, dawn. The HUD clock shows day and time.
- **Side activities** — taxi fares, courier deliveries, street races, 20 hidden sun
  coins (+$25 each), health / armor pickups, street cred that grows with everything
  you do.
- **Audio** — fully synthesized WebAudio: shots, crashes, explosions, pickups, sirens,
  engine hum, and a plane flyby whoosh when you enter the Airport.
- **Save / continue** — progress saves on mission completion and coin pickup
  (localStorage).

## Screenshots

1. `1-chase` — a 3-star chase in a stolen sports car
2. `2-airport` — the Runway Heist at dusk, on the motorcycle by the parked plane
3. `3-taxi` — Taxi Nights, fare in the drop-off phase
4. `4-harbor` — Harbor Lights, the boat run past the lighthouse

All art, sound, characters and story are original work made for this entry.
