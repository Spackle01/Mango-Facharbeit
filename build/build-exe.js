#!/usr/bin/env node
'use strict';
// Baut eine eigenständige EXE von Mango Facharbeit (Node Single Executable Application).
//
//   node build/build-exe.js                 → dist/Mango-Facharbeit-<version>-win-x64.exe
//   node build/build-exe.js --target current → Programm für das aktuelle System (zum Testen)
//
// Ablauf: App-Dateien als SEA-Assets bündeln → Vorbereitungs-Blob erzeugen →
// offizielles node.exe derselben Version laden und per SHA-256 prüfen →
// Symbol und Versionsinfo setzen (resedit) → Blob einfügen (postject).
// Benötigt Netzzugriff auf nodejs.org und die npm-Registry.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WORK = path.join(DIST, 'sea');
const CACHE = path.join(DIST, 'cache');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const target = args.includes('--target') ? args[args.indexOf('--target') + 1] : 'win-x64';
const NODE_VERSION = process.versions.node;
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const INCLUDE = ['package.json', 'server', 'public', 'ressourcen'];

function log(msg) { console.log(`• ${msg}`); }

function listFiles() {
  const out = [];
  const walk = (rel) => {
    const abs = path.join(ROOT, rel);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) {
        if (name.startsWith('.') && name !== '.gitkeep') continue;
        walk(path.posix.join(rel, name));
      }
    } else out.push(rel);
  };
  INCLUDE.forEach(walk);
  return out;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`${url}: HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(cmd, cmdArgs) {
  execFileSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' && cmd === NPX });
}

// Dateiversion für die Windows-Versionsinfo: "0.1.0-alpha" → "0.1.0.0"
function winVersion(v) {
  const nums = (v.match(/\d+/g) || []).slice(0, 3).map(Number);
  while (nums.length < 3) nums.push(0);
  return [...nums, 0].join('.');
}

async function baseBinary() {
  fs.mkdirSync(CACHE, { recursive: true });
  if (target === 'current') return process.execPath;
  if (target !== 'win-x64') throw new Error(`Unbekanntes Ziel: ${target}`);
  const exe = path.join(CACHE, `node-v${NODE_VERSION}-win-x64.exe`);
  if (!fs.existsSync(exe)) {
    log(`Lade node.exe v${NODE_VERSION} (win-x64) von nodejs.org`);
    await download(`https://nodejs.org/dist/v${NODE_VERSION}/win-x64/node.exe`, `${exe}.part`);
    fs.renameSync(`${exe}.part`, exe);
  }
  const sums = path.join(CACHE, `SHASUMS256-v${NODE_VERSION}.txt`);
  if (!fs.existsSync(sums)) await download(`https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`, sums);
  const line = fs.readFileSync(sums, 'utf8').split('\n').find((l) => l.trim().endsWith(' win-x64/node.exe'));
  if (!line || line.split(/\s+/)[0] !== sha256(exe)) {
    fs.rmSync(exe, { force: true });
    throw new Error('Prüfsumme von node.exe stimmt nicht – Download verworfen.');
  }
  log('Prüfsumme von node.exe bestätigt');
  return exe;
}

async function main() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });

  const files = listFiles();
  const hash = crypto.createHash('sha256');
  for (const f of files) hash.update(f).update(fs.readFileSync(path.join(ROOT, f)));
  const buildId = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;
  log(`${files.length} Dateien, Build ${buildId}`);

  const main = fs.readFileSync(path.join(__dirname, 'sea-main.js'), 'utf8')
    .replace("'__VERSION__'", JSON.stringify(pkg.version))
    .replace("'__BUILD_ID__'", JSON.stringify(buildId))
    .replace('const FILES = __FILES__;', `const FILES = ${JSON.stringify(files)};`);
  if (/'__VERSION__'|'__BUILD_ID__'|= __FILES__;/.test(main)) throw new Error('Platzhalter in sea-main.js nicht ersetzt');
  const mainPath = path.join(WORK, 'sea-main.js');
  fs.writeFileSync(mainPath, main);
  const blob = path.join(WORK, 'app.blob');
  const config = {
    main: mainPath,
    output: blob,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false, // ohne Code-Cache ist der Blob plattformunabhängig
    assets: Object.fromEntries(files.map((f) => [f, path.join(ROOT, f)])),
  };
  const configPath = path.join(WORK, 'sea-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  log('Erzeuge SEA-Blob');
  run(process.execPath, ['--experimental-sea-config', configPath]);

  const base = await baseBinary();
  const suffix = target === 'win-x64' ? 'win-x64.exe' : `${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
  const out = path.join(DIST, `Mango-Facharbeit-${pkg.version}-${suffix}`);
  fs.rmSync(out, { force: true });

  if (target === 'win-x64' || process.platform === 'win32') {
    // Symbol und Versionsinfo setzen; die Signatur von node.exe wird dabei entfernt,
    // weil sie nach dem Einfügen der App ohnehin nicht mehr gültig wäre.
    log('Setze Symbol und Versionsinfo');
    const v = winVersion(pkg.version);
    run(NPX, ['--yes', 'resedit-cli@3.1.1', '--in', base, '--out', out, '--ignore-signed',
      '--icon', `1,${path.join(__dirname, 'icon.ico')}`,
      '--product-name', 'Mango Facharbeit', '--file-description', 'Mango Facharbeit',
      '--product-version', v, '--file-version', v, '--company-name', 'Mango Facharbeit',
      '--original-filename', path.basename(out), '--internal-name', 'Mango Facharbeit']);
  } else {
    fs.copyFileSync(base, out);
    fs.chmodSync(out, 0o755);
  }

  log('Füge die App in das Programm ein (postject)');
  const postjectArgs = ['--yes', 'postject@1.0.0-alpha.6', out, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', FUSE];
  if (process.platform === 'darwin' && target === 'current') postjectArgs.push('--macho-segment-name', 'NODE_SEA');
  run(NPX, postjectArgs);

  const sum = sha256(out);
  fs.writeFileSync(`${out}.sha256`, `${sum}  ${path.basename(out)}\n`);
  const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
  log(`Fertig: ${path.relative(ROOT, out)} (${mb} MB)`);
  log(`SHA-256: ${sum}`);
}

main().catch((err) => {
  console.error(`Build fehlgeschlagen: ${err.message}`);
  process.exit(1);
});
