// Solmar Bay round 5 — entry packer (hand-written).
// Copies game/ and screenshots/ into MAKEFUN_OUTPUT_DIR and writes dossier.json
// with the bounty caps. Never deletes the output dir itself: the grader's
// /output is a mount point, so only the entries inside it are cleared.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const repoDir = process.cwd();

mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true });
}

const gameSrc = join(repoDir, 'game');
cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
const shotsSrc = join(repoDir, 'screenshots');
if (existsSync(shotsSrc)) cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes -> ${join(outDir, 'dossier.json')}`);
