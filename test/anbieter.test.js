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
  // Eindeutiger Port je Server dieser Datei (Zufallsports stießen gelegentlich zusammen und ließen Tests scheitern).
  const port = 5200 + servers.length * 7 + (process.pid % 7);
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
  assert.deepStrictEqual(s.providers.map((p) => p.status), ['nicht_installiert', 'nicht_installiert', 'anmeldung_noetig', 'anmeldung_noetig'], 'DeepSeek und OpenCode Go warten auf den Schlüssel');
  assert.strictEqual(s.settings.provider, 'claude', 'Voreinstellung bleibt');
  const [claude, agy] = s.providers;
  assert.strictEqual(claude.hint.link, 'https://code.claude.com/docs/en/setup');
  assert.match(claude.hint.befehl, /claude\.ai\/install/);
  assert.strictEqual(agy.hint.link, 'https://antigravity.google/docs/getting-started?tab=cli');
  assert.match(agy.hint.befehl, /antigravity\.google\/cli\/install/);
  s = await srv.call('POST', '/api/providers/pruefen');
  assert.strictEqual(s.pruefung, false);
  assert.ok(s.providers.filter((p) => !p.api).every((p) => p.status === 'nicht_installiert'));

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

test('Nur DeepSeek: Ruft die KI den Scan nicht auf, holt die App ihn nach', async () => {
  const fake = await require('./fixtures/fake-deepseek').start({ skript: (req) => {
    const letzte = req.messages[req.messages.length - 1];
    const nachgeholt = req.messages.some((x) => x.role === 'user' && /fehlt noch/.test(x.content));
    if (letzte.role === 'user' && /fehlt noch/.test(letzte.content)) return { tools: [{ name: 'ai_tell_scan', args: { text: 'Meine Notiz zur Umfrage.' } }] };
    // Erste Antwort: schreibt eine Datei und ruft den Scan nicht auf.
    if (letzte.role === 'user') return { tools: [{ name: 'Write', args: { file_path: '01_themenfindung_und_mindmap/dsnotiz2.md', content: 'Meine Notiz zur Umfrage.' } }] };
    return { text: nachgeholt ? 'Überarbeitet.' : 'Notiz angelegt.' };
  } });
  try {
    const srv = await starte('deepseek-nachholen', [], { MANGO_NUR_API: '1', MANGO_DEEPSEEK_URL: fake.url });
    await fertig(srv.call);
    await srv.call('POST', '/api/providers/deepseek/schluessel', { schluessel: fake.key });
    fs.mkdirSync(path.join(srv.home, 'Dokumente'), { recursive: true });
    await srv.call('POST', '/api/setup', { workspace: path.join(srv.home, 'Dokumente', 'DS Nachholen'), angaben: { name: 'Alex Beispiel', titel: 'Test' } });
    const chat = await srv.call('POST', '/api/chats');
    const m = (await srv.send(chat.id, 'Schreib eine Notiz zur Umfrage.')).message;
    assert.strictEqual(m.status, 'fertig');
    assert.strictEqual(m.text, 'Notiz angelegt.', 'der Text der Überarbeitung wird nicht angezeigt');
    assert.deepStrictEqual(m.stil, { scan: true, gefunden: 0, rest: 0, durchlaeufe: 1, offen: [], skills: ['human-voice', 'humanize-rewrite', 'ai-tell-audit', 'ai_tell_scan'], vollstaendig: true, nachgeholt: true });
    assert.ok(m.activity.some((a) => a.label === 'Schreib-Skills nachholen und Text prüfen'));
    assert.ok(m.activity.some((a) => a.werkzeug === 'ai_tell_scan' && a.label === 'Prüft den Text mit dem Scan (ai-tell-audit)'));
    const aufforderung = fake.calls.map((c) => c.messages.filter((x) => x.role === 'user').pop().content).find((x) => /fehlt noch/.test(x));
    assert.match(aufforderung, /fehlt noch: das Werkzeug `ai_tell_scan` mit dem fertigen Text\. Ruf `ai_tell_scan` mit dem fertigen Text auf/);
    assert.ok(!/Skill-Werkzeug/.test(aufforderung), 'die Skills standen im Systemprompt, nur der Scan fehlte');
    await srv.stop();
  } finally {
    fake.close();
  }
});

test('OpenCode Go: Schlüssel verbinden, Modellliste vom Anbieter, Antwort mit Werkzeugen, Schlüssel bleibt geheim', async () => {
  const key = 'ocg-test-0123456789abcdef';
  const fake = await require('./fixtures/fake-deepseek').start({ key, modelle: ['kimi-test', 'glm-test'], verlangeKopf: 'x-opencode-session', skript: (req) => {
    const letzte = req.messages[req.messages.length - 1];
    if (letzte.role === 'user' && /FEHLER402/.test(letzte.content)) return { status: 402, meldung: 'Quota' };
    if (letzte.role === 'user') return { tools: [{ name: 'Write', args: { file_path: '01_themenfindung_und_mindmap/ocgnotiz.md', content: 'Meine Notiz.' } }, { name: 'ai_tell_scan', args: { text: 'Meine Notiz.' } }] };
    return { reasoning: 'Ich denke nach.', text: 'Notiz angelegt.' };
  } });
  try {
    const srv = await starte('opencodego', [], { MANGO_NUR_API: '1', MANGO_OPENCODEGO_URL: fake.url });
    let s = await fertig(srv.call);
    const ocg = () => s.providers.find((p) => p.id === 'opencodego');
    assert.deepStrictEqual(s.providers.map((p) => p.id), ['deepseek', 'opencodego']);
    assert.strictEqual(ocg().name, 'OpenCode Go');
    assert.strictEqual(ocg().status, 'anmeldung_noetig');
    assert.strictEqual(ocg().hint.aktion, 'schluessel');
    assert.deepStrictEqual(ocg().models, [], 'ohne Schlüssel keine Modellliste');
    // Schlüssel prüfen: falsches Format, abgelehnt, richtig
    await assert.rejects(srv.call('POST', '/api/providers/opencodego/schluessel', { schluessel: 'kurz' }), /OpenCode-Go-Schlüssel/);
    await assert.rejects(srv.call('POST', '/api/providers/opencodego/schluessel', { schluessel: 'ocg-falsch-falsch-falsch-0000' }), /lehnt diesen Schlüssel ab/);
    const r = await srv.call('POST', '/api/providers/opencodego/schluessel', { schluessel: key });
    s = { providers: r.providers };
    assert.strictEqual(ocg().status, 'bereit');
    assert.strictEqual(r.settings.provider, 'opencodego', 'wer einen Schlüssel verbindet, will ihn nutzen');
    assert.deepStrictEqual(ocg().models.map((m) => m.id), ['kimi-test', 'glm-test'], 'Modelle kommen vom Anbieter');
    assert.ok(fake.anfragen.every((a) => a.auth === `Bearer ${key}` || a.auth === 'Bearer ocg-falsch-falsch-falsch-0000'));
    // DeepSeek bleibt unberührt
    assert.strictEqual(r.providers.find((p) => p.id === 'deepseek').status, 'anmeldung_noetig');
    // Der Schlüssel taucht nirgends auf
    const alles = JSON.stringify([await srv.call('GET', '/api/state'), await srv.call('GET', '/api/settings'), await srv.call('GET', '/api/providers')]);
    assert.ok(!alles.includes(key), 'kein Schlüssel in Zustand und Einstellungen');
    // Antwort: erstes Modell der Liste, nur Standardfelder, Skills im Systemprompt, Scan-Werkzeug
    fs.mkdirSync(path.join(srv.home, 'Dokumente'), { recursive: true });
    await srv.call('POST', '/api/setup', { workspace: path.join(srv.home, 'Dokumente', 'OCG Test'), angaben: { name: 'Alex Beispiel', titel: 'Test' } });
    const chat = await srv.call('POST', '/api/chats');
    const m = (await srv.send(chat.id, 'Lege bitte eine Notiz an.')).message;
    assert.strictEqual(m.provider, 'opencodego');
    assert.strictEqual(m.status, 'fertig');
    assert.strictEqual(m.text, 'Notiz angelegt.');
    const erste = fake.calls[0];
    assert.strictEqual(erste.model, 'kimi-test', 'ohne eigene Wahl gilt das erste Modell der Liste');
    assert.ok(!('thinking' in erste) && !('reasoning_effort' in erste), 'keine DeepSeek-Sonderfelder');
    assert.strictEqual(erste.temperature, 0.7);
    assert.deepStrictEqual(erste.tools.map((x) => x.function.name), ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'WebFetch', 'ai_tell_scan']);
    const system = erste.messages[0].content;
    assert.ok(system.includes('## Schreib-Skills: Wortlaut (zuerst lesen)') && system.includes('### Skill `ai-tell-audit`') && /startest du mit dem Werkzeug `ai_tell_scan`/.test(system));
    assert.deepStrictEqual(m.stil.skills, ['human-voice', 'humanize-rewrite', 'ai-tell-audit', 'ai_tell_scan']);
    assert.strictEqual(m.stil.vollstaendig, true);
    assert.match(fake.calls[0].messages[1].content, /<menschlich>.*ai-tell-audit/);
    // Denkprotokoll anderer Anbieter wird nicht in den Verlauf zurückgeschickt
    await srv.send(chat.id, 'Danke.');
    const verlauf = fake.calls[fake.calls.length - 1].messages;
    assert.ok(!verlauf.some((x) => 'reasoning_content' in x), 'kein reasoning_content bei OpenCode Go');
    assert.ok(fs.existsSync(path.join(srv.home, 'Dokumente', 'OCG Test', '.facharbeit', 'sitzungen')) && fs.readdirSync(path.join(srv.home, 'Dokumente', 'OCG Test', '.facharbeit', 'sitzungen')).some((f) => f.startsWith('opencodego-')));
    // OpenCode Go verlangt bei jeder Anfrage die Sitzungskennung (x-opencode-session), sonst „missing x-opencode-session“.
    const chatAnfragen = () => fake.anfragen.filter((a) => a.url === '/chat/completions');
    const ersteSitzung = chatAnfragen()[0].sitzung;
    assert.ok(ersteSitzung && /^[0-9a-f-]{36}$/.test(ersteSitzung), 'Kennung der Mango-Sitzung');
    assert.ok(chatAnfragen().length >= 3 && chatAnfragen().every((a) => a.sitzung === ersteSitzung), 'gleiche Kennung in allen Runden und Nachrichten desselben Chats');
    // Eigene Modellwahl (auch mit „/“ in der Kennung)
    await srv.call('PUT', '/api/settings', { modelle: { opencodego: 'glm-test' } });
    await srv.send((await srv.call('POST', '/api/chats')).id, 'Noch eine Notiz.');
    assert.strictEqual(fake.calls[fake.calls.length - 1].model, 'glm-test');
    assert.notStrictEqual(chatAnfragen()[chatAnfragen().length - 1].sitzung, ersteSitzung, 'neuer Chat, neue Sitzung');
    assert.ok(fake.anfragen.filter((a) => a.url === '/models').every((a) => a.sitzung === undefined), 'die Modellliste braucht die Kennung nicht');
    const r2 = await srv.call('PUT', '/api/settings', { modelle: { opencodego: 'opencode-go/kimi-test' } });
    assert.strictEqual(r2.settings.modelle.opencodego, 'opencode-go/kimi-test');
    // Kontingent erreicht: verständliche Meldung
    const c3 = await srv.call('POST', '/api/chats');
    const m3 = (await srv.send(c3.id, 'FEHLER402 bitte')).message;
    assert.strictEqual(m3.status, 'fehler');
    assert.match(m3.error, /OpenCode-Go-Kontingent/);
    assert.strictEqual(m3.errorKind, 'limit');
    // Schlüssel entfernen
    const d = await srv.call('DELETE', '/api/providers/opencodego/schluessel');
    assert.strictEqual(d.providers.find((p) => p.id === 'opencodego').status, 'anmeldung_noetig');
    assert.deepStrictEqual(d.providers.find((p) => p.id === 'opencodego').models, []);
    await srv.stop();
  } finally {
    fake.close();
  }
});

test('Nur DeepSeek: Bei ausgeschaltetem Scan wird das Scan-Werkzeug weder verlangt noch nachgeholt', async () => {
  let nr = 0;
  const fake = await require('./fixtures/fake-deepseek').start({ skript: (req) => {
    const letzte = req.messages[req.messages.length - 1];
    if (letzte.role === 'user' && !/fehlt noch/.test(letzte.content)) nr += 1;
    if (letzte.role === 'user') return { tools: [{ name: 'Write', args: { file_path: `01_themenfindung_und_mindmap/dsnotiz3_${nr}.md`, content: 'Darüber hinaus ist das — wichtig. Gerne!' } }] };
    return { text: 'Notiz angelegt.' };
  } });
  try {
    const srv = await starte('deepseek-scan-aus', [], { MANGO_NUR_API: '1', MANGO_DEEPSEEK_URL: fake.url });
    await fertig(srv.call);
    await srv.call('POST', '/api/providers/deepseek/schluessel', { schluessel: fake.key });
    fs.mkdirSync(path.join(srv.home, 'Dokumente'), { recursive: true });
    await srv.call('POST', '/api/setup', { workspace: path.join(srv.home, 'Dokumente', 'DS Scan aus'), angaben: { name: 'Alex Beispiel', titel: 'Test' } });
    await srv.call('PUT', '/api/settings', { scanAn: false });
    const chat = await srv.call('POST', '/api/chats');
    const m = (await srv.send(chat.id, 'Schreib eine Notiz zur Umfrage.')).message;
    assert.strictEqual(m.status, 'fertig');
    assert.strictEqual(m.text, 'Notiz angelegt.');
    assert.deepStrictEqual(m.stil, { scan: false, gefunden: 0, rest: 0, durchlaeufe: 0, offen: [], skills: ['human-voice', 'humanize-rewrite', 'ai-tell-audit'], vollstaendig: true, nachgeholt: false }, 'weder Prüfung noch Scan-Aufruf nötig, auch bei Chatbot-Resten im Text');
    assert.strictEqual(fake.calls.length, 2, 'Schreiben und Antwort, kein Durchlauf zum Nachholen');
    assert.ok(!fake.calls.some((c) => c.messages.some((x) => x.role === 'user' && /fehlt noch/.test(x.content))));
    assert.match(fake.calls[0].messages[1].content, /<scan>Die Person hat den KI-Scan ausgeschaltet[^<]*rufe `ai_tell_scan` nicht auf/);
    // Wieder an: Der fehlende Scan-Aufruf wird nachgeholt, harte Treffer überarbeitet.
    await srv.call('PUT', '/api/settings', { scanAn: true });
    const chat2 = await srv.call('POST', '/api/chats');
    const m2 = (await srv.send(chat2.id, 'Schreib noch eine Notiz zur Umfrage.')).message;
    assert.strictEqual(m2.stil.scan, true);
    assert.ok(m2.stil.durchlaeufe >= 1, 'mit Scan wird nachgeholt');
    await srv.stop();
  } finally {
    fake.close();
  }
});

test('Nur DeepSeek (Mac): Anbieterliste, Schlüssel verbinden, Antwort mit Werkzeugen, Schlüssel bleibt geheim', async () => {
  const fake = await require('./fixtures/fake-deepseek').start({ skript: (req) => {
    const letzte = req.messages[req.messages.length - 1];
    if (letzte.role === 'user') return { tools: [{ name: 'Write', args: { file_path: '01_themenfindung_und_mindmap/dsnotiz.md', content: 'Meine Notiz.' } }, { name: 'ai_tell_scan', args: { text: 'Meine Notiz.' } }] };
    return { text: 'Notiz angelegt.' };
  } });
  try {
    const srv = await starte('nur-deepseek', [], { MANGO_NUR_API: '1', MANGO_DEEPSEEK_URL: fake.url });
    let s = await fertig(srv.call);
    assert.deepStrictEqual(s.providers.map((p) => p.id), ['deepseek', 'opencodego'], 'auf dem Mac nur die Anbieter mit Schlüssel');
    assert.strictEqual(s.settings.provider, 'deepseek', 'Voreinstellung wechselt von selbst');
    const ds = s.providers[0];
    assert.strictEqual(ds.status, 'anmeldung_noetig');
    assert.strictEqual(ds.hint.aktion, 'schluessel');
    assert.deepStrictEqual(ds.models.map((m) => m.id), ['deepseek-flash', 'deepseek-v4-pro']);
    // Schlüssel prüfen
    await assert.rejects(srv.call('POST', '/api/providers/deepseek/schluessel', { schluessel: 'kein-schluessel' }), /sk-/);
    await assert.rejects(srv.call('POST', '/api/providers/deepseek/schluessel', { schluessel: 'sk-falsch-falsch-falsch-0000' }), /lehnt diesen Schlüssel ab/);
    const r = await srv.call('POST', '/api/providers/deepseek/schluessel', { schluessel: fake.key });
    assert.strictEqual(r.providers[0].status, 'bereit');
    assert.strictEqual(r.settings.provider, 'deepseek');
    // Der Schlüssel taucht nirgends in den Antworten der App auf
    const alles = JSON.stringify([await srv.call('GET', '/api/state'), await srv.call('GET', '/api/settings'), await srv.call('GET', '/api/providers')]);
    assert.ok(!alles.includes(fake.key) && !alles.includes('sk-test'), 'kein Schlüssel in Zustand und Einstellungen');
    // Projekt und Antwort
    fs.mkdirSync(path.join(srv.home, 'Dokumente'), { recursive: true });
    await srv.call('POST', '/api/setup', { workspace: path.join(srv.home, 'Dokumente', 'DS Test'), angaben: { name: 'Alex Beispiel', titel: 'Test' } });
    const chat = await srv.call('POST', '/api/chats');
    const done = await srv.send(chat.id, 'Lege bitte eine Notiz an.');
    const m = done.message;
    assert.strictEqual(m.provider, 'deepseek');
    assert.strictEqual(m.status, 'fertig');
    assert.strictEqual(m.text, 'Notiz angelegt.');
    assert.ok(m.files.some((f) => f.path === '01_themenfindung_und_mindmap/dsnotiz.md' && f.aktion === 'neu'));
    assert.ok(fake.anfragen.every((a) => a.sitzung === undefined), 'DeepSeek bekommt die OpenCode-Kopfzeile nicht');
    // DeepSeek bekommt dieselben Skills im Systemprompt und ruft den Scan als Werkzeug auf; die App zählt, was genutzt wurde.
    assert.deepStrictEqual(m.stil.skills, ['human-voice', 'humanize-rewrite', 'ai-tell-audit', 'ai_tell_scan']);
    assert.strictEqual(m.stil.werkzeuge, undefined);
    assert.strictEqual(m.stil.vollstaendig, true);
    assert.strictEqual(m.stil.nachgeholt, false);
    assert.deepStrictEqual(m.activity.filter((a) => a.werkzeug).map((a) => a.label), ['Prüft den Text mit dem Scan (ai-tell-audit)'], 'das Werkzeug ist im Chat klar beschriftet');
    assert.ok(!m.activity.some((a) => /Schreibt eine Datei/.test(a.label) && !a.path), 'ai_tell_scan erscheint nicht als „Schreibt eine Datei“');
    assert.match(fake.calls[0].messages[0].content, /Arbeitsregeln/, 'Regeln der App gehen als Systemnachricht mit');
    const system = fake.calls[0].messages[0].content;
    // DeepSeek bekommt die drei Skills im Wortlaut vor allen anderen Regeln, wie Claude, dazu den Scan als Werkzeug.
    assert.ok(system.indexOf('## Oberste Regel: Schreib immer wie ein Mensch') < system.indexOf('## Schreib-Skills: Wortlaut (zuerst lesen)'), 'oberste Regel steht ganz oben');
    assert.ok(system.indexOf('## Schreib-Skills: Wortlaut (zuerst lesen)') < system.indexOf('## Kurz und einfach'), 'die Skills stehen vor allen anderen Regeln');
    for (const s of ['human-voice', 'humanize-rewrite', 'ai-tell-audit']) assert.ok(system.includes(`### Skill \`${s}\``), `${s} steht im Wortlaut im Systemprompt`);
    assert.match(system, /startest du mit dem Werkzeug `ai_tell_scan`/);
    assert.deepStrictEqual(fake.calls[0].tools.map((x) => x.function.name), ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'WebFetch', 'ai_tell_scan']);
    assert.ok(!/stimmenprofil|natuerlich-schreiben|voice_profile|humanize_scan/.test(system), 'keine Reste des alten Pakets');
    assert.ok(!/<!--NUR/.test(system), 'keine Reste der Anbieter-Blöcke');
    assert.match(system.slice(-700), /Folge dafür den Schreib-Skills vom Anfang deiner Regeln: human-voice bzw\. humanize-rewrite, dann ai-tell-audit mit dem Werkzeug ai_tell_scan/, 'Erinnerung am Ende des Systemprompts');
    assert.strictEqual(m.activity[0].label, 'Liest die Schreib-Skills (Schreiben, Umschreiben, Prüfen)', 'erster Arbeitsschritt');
    assert.match(fake.calls[0].messages[1].content, /<menschlich>.*Schreib-Skills.*ai-tell-audit/, 'Erinnerung steht bei jeder Nachricht');
    // Zweite Nachricht setzt den Verlauf fort (nur eine neue Nachricht, kein neuer System-Verlauf)
    const done2 = await srv.send(chat.id, 'Danke.');
    assert.strictEqual(done2.message.status, 'fertig');
    assert.ok(fake.calls[fake.calls.length - 1].messages.length > 5, 'Verlauf der ersten Nachricht ist dabei');
    // Schlüssel entfernen
    const d = await srv.call('DELETE', '/api/providers/deepseek/schluessel');
    assert.strictEqual(d.providers[0].status, 'anmeldung_noetig');
    await srv.stop();
  } finally {
    fake.close();
  }
});
