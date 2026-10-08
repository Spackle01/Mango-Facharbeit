'use strict';
// Erster Start mit unterschiedlich eingerichteten Rechnern: Die App wählt Anbieter und Modell
// selbst oder zeigt, wie man einen Anbieter installiert. Jeder Fall läuft in einem eigenen
// Server, der nur die Test-Doubles im eigenen bin-Ordner findet.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures', 'bin');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-anbieter-'));
// Die App sucht zusätzlich in Systemordnern. Liegt dort eine echte CLI, lässt sich „nicht installiert“ nicht nachstellen.
const SYSTEMWEIT = process.platform === 'win32'
  || ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin'].some((d) => ['claude', 'agy'].some((c) => fs.existsSync(path.join(d, c))));

const servers = [];

async function starte(name, programme) {
  const dir = path.join(TMP, name);
  const bin = path.join(dir, 'bin');
  const home = path.join(dir, 'home');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  if (!fs.existsSync(path.join(bin, 'node'))) {
    fs.symlinkSync(process.execPath, path.join(bin, 'node'));
    for (const p of programme) fs.symlinkSync(path.join(FIXTURES, p), path.join(bin, p));
  }
  const port = 5200 + Math.floor(Math.random() * 400);
  const proc = spawn(process.execPath, [path.join(ROOT, 'server/index.js'), '--no-open', '--port', String(port)], {
    env: { ...process.env, HOME: home, USERPROFILE: home, MANGO_DATA_DIR: path.join(dir, 'data'), PATH: bin, ANTHROPIC_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servers.push(proc);
  const base = await new Promise((resolve, reject) => {
    let out = '';
    proc.stdout.on('data', (d) => {
      out += d;
      const m = /läuft: (http:\/\/127\.0\.0\.1:\d+)\//.exec(out);
      if (m) resolve(m[1]);
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('exit', (code) => reject(new Error(`Server beendet (${code})`)));
  });
  const token = /name="mango-token" content="([a-f0-9]+)"/.exec(await (await fetch(`${base}/`)).text())[1];
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'x-mango-token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status });
    return data;
  };
  const stop = async () => { proc.kill(); await new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r))); };
  return { call, stop };
}

// Wartet, bis Erkennung und automatische Auswahl abgeschlossen sind.
async function fertig(call) {
  const end = Date.now() + 15000;
  for (;;) {
    const s = await call('GET', '/api/settings');
    if (!s.pruefung && s.providers.every((p) => p.status !== 'pruefe')) return s;
    if (Date.now() > end) throw new Error('Zeitüberschreitung');
    await new Promise((r) => setTimeout(r, 150));
  }
}

test.after(() => { for (const p of servers) p.kill(); });

test('Nur Antigravity installiert: App wechselt zu Antigravity mit dem besten Gemini-Modell', { skip: SYSTEMWEIT && 'CLI systemweit installiert' }, async () => {
  let srv = await starte('nur-agy', ['agy']);
  let s = await fertig(srv.call);
  const claude = s.providers.find((p) => p.id === 'claude');
  const agy = s.providers.find((p) => p.id === 'antigravity');
  assert.strictEqual(claude.status, 'nicht_installiert');
  assert.strictEqual(s.settings.provider, 'antigravity', 'Anbieter automatisch gewechselt');
  assert.strictEqual(s.settings.modelle.antigravity, 'gemini-3.1-pro-high', 'Pro vor Flash');
  assert.strictEqual(s.settings.modelle.claude, 'sonnet');
  assert.strictEqual(agy.status, 'verbunden', 'Verbindung gleich geprüft');
  assert.strictEqual(agy.usable, true);
  const state = await srv.call('GET', '/api/state');
  assert.strictEqual(state.pruefung, false);

  // Eigene Wahl bleibt nach einem Neustart erhalten.
  const r = await srv.call('PUT', '/api/settings', { modelle: { antigravity: 'gemini-3.8-flash-high' } });
  assert.strictEqual(r.settings.modelle.antigravity, 'gemini-3.8-flash-high');
  await srv.stop();
  srv = await starte('nur-agy', ['agy']);
  s = await fertig(srv.call);
  assert.strictEqual(s.settings.provider, 'antigravity');
  assert.strictEqual(s.settings.modelle.antigravity, 'gemini-3.8-flash-high', 'eigene Modellwahl wird nicht überschrieben');
  await srv.stop();
});

test('Kein Anbieter installiert: Hinweise mit Anleitung und Installationsbefehl', { skip: SYSTEMWEIT && 'CLI systemweit installiert' }, async () => {
  const srv = await starte('keiner', []);
  let s = await fertig(srv.call);
  assert.deepStrictEqual(s.providers.map((p) => p.status), ['nicht_installiert', 'nicht_installiert']);
  assert.strictEqual(s.settings.provider, 'claude', 'Voreinstellung bleibt');
  const [claude, agy] = s.providers;
  assert.strictEqual(claude.hint.link, 'https://code.claude.com/docs/en/setup');
  assert.match(claude.hint.befehl, /claude\.ai\/install/);
  assert.strictEqual(agy.hint.link, 'https://antigravity.google/docs/getting-started?tab=cli');
  assert.match(agy.hint.befehl, /antigravity\.google\/cli\/install/);
  s = await srv.call('POST', '/api/providers/pruefen');
  assert.strictEqual(s.pruefung, false);
  assert.ok(s.providers.every((p) => p.status === 'nicht_installiert'));

  // Danach installiert und „Erneut prüfen“ geklickt: Antigravity wird sofort eingerichtet.
  fs.symlinkSync(path.join(FIXTURES, 'agy'), path.join(TMP, 'keiner', 'bin', 'agy'));
  s = await srv.call('POST', '/api/providers/pruefen');
  assert.strictEqual(s.settings.provider, 'antigravity');
  assert.strictEqual(s.settings.modelle.antigravity, 'gemini-3.1-pro-high');
  assert.strictEqual(s.providers.find((p) => p.id === 'antigravity').status, 'verbunden');
  await srv.stop();
});
