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

async function starte(name, programme, env = {}) {
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
    env: { ...process.env, HOME: home, USERPROFILE: home, MANGO_DATA_DIR: path.join(dir, 'data'), PATH: bin, ANTHROPIC_API_KEY: '', ...env },
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
  const send = async (chatId, text) => {
    const res = await fetch(`${base}/api/chats/${chatId}/messages`, {
      method: 'POST', headers: { 'x-mango-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    });
    if (!res.ok) { const d = await res.json(); throw Object.assign(new Error(d.error), { status: res.status }); }
    const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    return events.find((e) => e.type === 'done');
  };
  return { call, stop, send, home };
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

test('Abgelehntes Modell: Antwort mit der Voreinstellung, Senden wartet auf die Prüfung', { skip: SYSTEMWEIT && 'CLI systemweit installiert' }, async () => {
  const log = path.join(TMP, 'agy-abgelehnt.ndjson');
  const env = { FAKE_AGY_REJECT: 'gemini-3.1-pro-high', FAKE_AGY_VERIFY_DELAY: '1500', FAKE_AGY_LOG: log };
  let srv = await starte('abgelehnt', ['agy'], env);
  // Sofort einrichten und senden, während die Verbindung noch geprüft wird.
  await srv.call('POST', '/api/setup', { workspace: path.join(srv.home, 'Facharbeit'), angaben: {} });
  const chat = await srv.call('POST', '/api/chats');
  const vorher = await srv.call('GET', '/api/settings');
  assert.ok(vorher.pruefung, 'Prüfung läuft noch');
  const done = await srv.send(chat.id, 'Hallo');
  assert.strictEqual(done.message.status, 'fertig', 'wartet auf die Prüfung statt abzubrechen');
  assert.strictEqual(done.message.provider, 'antigravity');
  assert.strictEqual(done.message.modellErsatz, 'gemini-3.1-pro-high');
  assert.ok(done.message.activity.some((a) => /nicht verfügbar – Voreinstellung von Antigravity/.test(a.label)));
  const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l).args).filter((a) => a.includes('stream-json'));
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[0][calls[0].indexOf('--model') + 1], 'gemini-3.1-pro-high');
  assert.ok(!calls[0].includes('--effort'), 'Denkstufe steht schon im Modellnamen');
  assert.ok(!calls[1].includes('--model') && !calls[1].includes('--effort'), 'zweiter Versuch wie im Terminal');
  let s = await srv.call('GET', '/api/settings');
  assert.strictEqual(s.settings.modelle.antigravity, '');
  assert.strictEqual(s.settings.modellAbgelehnt.antigravity, 'gemini-3.1-pro-high');
  assert.ok(!(s.settings.modellGewaehlt || {}).antigravity);

  // Nach einem Neustart bleibt es bei der Voreinstellung.
  await srv.stop();
  srv = await starte('abgelehnt', ['agy'], env);
  s = await fertig(srv.call);
  assert.strictEqual(s.settings.modelle.antigravity, '');
  // Eine eigene Wahl hebt die Sperre auf.
  s = await srv.call('PUT', '/api/settings', { modelle: { antigravity: 'gemini-3.8-flash-high' } });
  assert.ok(!s.settings.modellAbgelehnt.antigravity);
  await srv.stop();
});

// Verhalten der echten CLI (agy 1.3): Abbruch mit „AGY_ERROR“ und Exit-Code 3, verweigerte
// Aktionen ohne Antwort, Antworttext erst am Schrittende.
async function einmalSenden(name, env) {
  const srv = await starte(name, ['agy'], { MANGO_RETRY_DELAY_MS: '50', ...env });
  await fertig(srv.call);
  await srv.call('POST', '/api/setup', { workspace: path.join(srv.home, 'Facharbeit'), angaben: {} });
  const chat = await srv.call('POST', '/api/chats');
  const done = await srv.send(chat.id, 'Hallo');
  const state = await srv.call('GET', '/api/settings');
  await srv.stop();
  return { done, state };
}

test('Antigravity: Verbindungsabbruch wird einmal wiederholt, Dateiänderungen sind freigegeben', { skip: SYSTEMWEIT && 'CLI systemweit installiert' }, async () => {
  const log = path.join(TMP, 'agy-flaky.ndjson');
  const { done, state } = await einmalSenden('flaky', { FAKE_AGY_FLAKY: path.join(TMP, 'flaky-zaehler'), FAKE_AGY_LOG: log });
  assert.strictEqual(done.message.status, 'fertig');
  assert.match(done.message.text, /Hallo von Antigravity/);
  assert.ok(!done.message.text.includes('Ich fange an'), 'abgebrochene Teilantwort verworfen');
  assert.ok(done.message.activity.some((a) => /hat abgebrochen \(stream closed: connection reset by peer\) – neuer Versuch/.test(a.label)));
  assert.strictEqual(state.providers.find((p) => p.id === 'antigravity').status, 'verbunden');
  const runs = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l).args).filter((a) => a.includes('stream-json'));
  assert.strictEqual(runs.length, 2);
  for (const a of runs) assert.strictEqual(a[a.indexOf('--mode') + 1], 'accept-edits');
});

test('Antigravity: verweigerte Aktionen und Text am Schrittende', { skip: SYSTEMWEIT && 'CLI systemweit installiert' }, async () => {
  let r = await einmalSenden('verweigert', { FAKE_AGY_DENIED: '1' });
  assert.strictEqual(r.done.message.status, 'fehler');
  assert.match(r.done.message.error, /durfte nicht alles ausführen.*write_to_file/);
  assert.ok(r.done.message.activity.some((a) => a.label === 'Nicht erlaubt: write_to_file'));
  assert.ok(!r.done.message.activity.some((a) => /neuer Versuch/.test(a.label)), 'kein sinnloser zweiter Versuch');
  r = await einmalSenden('volltext', { FAKE_AGY_FULLTEXT: '1' });
  assert.strictEqual(r.done.message.status, 'fertig');
  assert.strictEqual(r.done.message.text, 'Vollständige Antwort am Schrittende.');
});
