'use strict';
// Startprogramm der eigenständigen EXE (Node Single Executable Application).
// Die App-Dateien sind als Assets eingebettet. Beim ersten Start werden sie in einen
// Programmordner entpackt; danach startet der normale Server aus diesem Ordner.
// Platzhalter (__VERSION__, __BUILD_ID__, __FILES__) setzt build/build-exe.js ein.
const { getAsset } = require('node:sea');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');

const VERSION = '__VERSION__';
const BUILD_ID = '__BUILD_ID__';
const FILES = __FILES__;

process.title = 'Mango Facharbeit';
process.env.MANGO_EXE = '1';

function programDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Mango-Facharbeit', 'programm');
  }
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'Mango-Facharbeit', 'programm');
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'mango-facharbeit', 'programm');
}

function extract() {
  const base = programDir();
  const dir = path.join(base, BUILD_ID);
  if (fs.existsSync(path.join(dir, '.vollstaendig'))) return dir;
  const tmp = `${dir}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const rel of FILES) {
    const target = path.join(tmp, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(getAsset(rel)));
  }
  fs.writeFileSync(path.join(tmp, '.vollstaendig'), BUILD_ID);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  // Ältere Programmversionen aufräumen (Projektdaten liegen woanders und bleiben unberührt).
  for (const name of fs.readdirSync(base)) {
    if (name !== BUILD_ID && !name.startsWith(`${BUILD_ID}.tmp-`)) fs.rmSync(path.join(base, name), { recursive: true, force: true });
  }
  return dir;
}

function waitAndExit(code) {
  if (!process.stdin.isTTY) process.exit(code);
  console.log('\nZum Schließen Enter drücken.');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(code));
}

try {
  console.log(`Mango Facharbeit ${VERSION}`);
  const dir = extract();
  console.log('Dieses Fenster bitte geöffnet lassen. Zum Beenden einfach schließen.\n');
  createRequire(path.join(dir, 'server', 'index.js'))('./index.js');
} catch (err) {
  console.error(`Mango Facharbeit konnte nicht gestartet werden: ${err && err.message}`);
  waitAndExit(1);
}
