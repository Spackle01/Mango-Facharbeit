'use strict';
// Integrationstest der HTTP-API. Statt der echten CLIs laufen Test-Doubles aus
// test/fixtures/bin, damit der Test ohne Konto und ohne Netz reproduzierbar ist.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-api-'));
const HOME = path.join(TMP, 'home');
const WS = path.join(HOME, 'Dokumente', 'Facharbeit Test');
const LOG = path.join(TMP, 'claude-calls.ndjson');
fs.mkdirSync(path.join(HOME, 'Dokumente'), { recursive: true });

let server;
let base;
let token;

function startServer() {
  return new Promise((resolve, reject) => {
    const port = 4800 + Math.floor(Math.random() * 400);
    server = spawn(process.execPath, [path.join(ROOT, 'server/index.js'), '--no-open', '--port', String(port)], {
      env: {
        ...process.env,
        HOME, USERPROFILE: HOME, MANGO_DATA_DIR: path.join(TMP, 'data'), FAKE_LOG: LOG,
        PATH: `${path.join(__dirname, 'fixtures', 'bin')}${path.delimiter}${process.env.PATH}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    server.stdout.on('data', (d) => {
      out += d;
      const m = /läuft: (http:\/\/127\.0\.0\.1:\d+)\//.exec(out);
      if (m && !base) { base = m[1]; resolve(); }
    });
    server.stderr.on('data', (d) => process.stderr.write(d));
    server.on('exit', (code) => { if (!base) reject(new Error(`Server beendet (${code})`)); });
  });
}

async function call(method, url, body, { raw = false } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'x-mango-token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status, data });
  return data;
}

async function send(chatId, text, attachments) {
  const res = await call('POST', `/api/chats/${chatId}/messages`, { text, attachments }, { raw: true });
  if (!res.ok) { const d = await res.json(); throw Object.assign(new Error(d.error), { status: res.status, data: d }); }
  const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  return { events, done: events.find((e) => e.type === 'done') };
}

async function waitFor(fn, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Zeitüberschreitung');
    await new Promise((r) => setTimeout(r, 150));
  }
}

test.before(async () => {
  await startServer();
  const html = await (await fetch(`${base}/`)).text();
  token = /name="mango-token" content="([a-f0-9]+)"/.exec(html)[1];
});

test.after(() => { if (server) server.kill(); });

test('Sicherheit: Token, Host und Ursprung werden geprüft', async () => {
  assert.strictEqual((await fetch(`${base}/api/state`)).status, 403);
  assert.strictEqual((await fetch(`${base}/api/state`, { headers: { 'x-mango-token': token, Origin: 'http://evil.example' } })).status, 403);
  const res = await call('GET', `/api/files/raw?path=${encodeURIComponent('../../etc/passwd')}`, null, { raw: true });
  assert.ok([404, 409].includes(res.status));
});

test('Kompletter Ablauf', async (t) => {
  let state = await call('GET', '/api/state');
  assert.strictEqual(state.project, null);
  assert.strictEqual(state.projectError, null);

  await t.test('Anbieter werden erkannt', async () => {
    state = await waitFor(async () => { const s = await call('GET', '/api/state'); return s.providers.every((p) => p.status !== 'pruefe') && s; });
    const claude = state.providers.find((p) => p.id === 'claude');
    const agy = state.providers.find((p) => p.id === 'antigravity');
    assert.strictEqual(claude.status, 'bereit');
    assert.strictEqual(claude.label, 'Angemeldet');
    assert.strictEqual(agy.status, 'ungeprueft');
  });

  await t.test('Erster Start: Vorschlag und Einrichtung', async () => {
    const s = await call('GET', '/api/suggest-workspace?titel=Test');
    assert.ok(s.path.startsWith(path.join(HOME, 'Dokumente')));
    state = await call('POST', '/api/setup', { workspace: WS, angaben: { name: 'Alex Beispiel', titel: 'Testthema', abgabedatum: '2026-12-07' } });
    assert.strictEqual(state.project.angaben.name, 'Alex Beispiel');
    assert.strictEqual(state.project.aufgaben.length, 27);
    assert.ok(fs.existsSync(path.join(WS, '00_vorgaben', 'anforderungen.md')));
    assert.ok(fs.existsSync(path.join(WS, '.claude', 'skills', 'quellenrecherche', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(WS, '.agents', 'skills', 'sprachpruefung', 'scripts', 'ai_tell_scan.py')));
    assert.ok(fs.existsSync(path.join(WS, '.agents', 'rules', 'mango-facharbeit.md')));
    assert.ok(fs.existsSync(path.join(WS, 'FACHARBEIT.md')));
    assert.strictEqual(state.chats.length, 1);
  });

  await t.test('Projektangaben bearbeiten', async () => {
    const p = await call('PUT', '/api/project', { angaben: { lehrkraft: 'Frau Muster', abgabedatum: 'kein datum' } });
    assert.strictEqual(p.angaben.lehrkraft, 'Frau Muster');
    assert.strictEqual(p.angaben.abgabedatum, '2026-12-07');
  });

  const chatId = state.chats[0].id;
  await t.test('Chatten, Streaming und Sitzung fortsetzen', async () => {
    const r1 = await send(chatId, 'Hallo, hilf mir beim Exposé');
    assert.strictEqual(r1.events[0].type, 'start');
    assert.ok(r1.events.filter((e) => e.type === 'text').length > 1, 'Antwort wird gestreamt');
    assert.strictEqual(r1.done.message.status, 'fertig');
    assert.match(r1.done.message.text, /^Echo: Hallo, hilf mir beim Exposé/);
    assert.strictEqual(r1.done.chat.title, 'Beim Exposé');
    const r2 = await send(chatId, 'Zweite Frage');
    assert.strictEqual(r2.done.message.status, 'fertig');
    const calls = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.ok(calls[0].args.includes('--session-id'));
    assert.ok(calls[0].input.includes('<projektkontext stand='));
    assert.ok(calls[1].args.includes('--resume'));
    assert.ok(calls[1].input.includes('<projektkontext>unverändert'));
    assert.ok(calls[0].args.includes('--append-system-prompt'));
  });

  await t.test('Dateien: neue Datei, gesicherte Fassung, Arbeitsstand-Regeln', async () => {
    const { done } = await send(chatId, 'Bitte DATEI anlegen');
    const m = done.message;
    const neu = m.files.find((f) => f.path === '02_expose_und_zeitplan/expose_v1.md');
    const geaendert = m.files.find((f) => f.path === '02_expose_und_zeitplan/expose_vorlage.md');
    assert.strictEqual(neu.aktion, 'neu');
    assert.strictEqual(geaendert.aktion, 'geaendert');
    assert.ok(geaendert.version.startsWith('.facharbeit/versionen/02_expose_und_zeitplan/expose_vorlage.md/'));
    assert.ok(!fs.readFileSync(path.join(WS, geaendert.version), 'utf8').includes('Geändert vom Test'), 'vorherige Fassung gesichert');
    assert.ok(!m.text.includes('```arbeitsstand'));
    const byId = Object.fromEntries(m.updates.aufgaben.map((a) => [a.id, a]));
    assert.strictEqual(byId.expose.nach, 'erledigt');
    assert.strictEqual(byId.gliederung.nach, 'in_arbeit');
    assert.strictEqual(m.updates.vorschlaege[0].id, 'thema');
    assert.strictEqual(m.updates.projekt[0].feld, 'forschungsfrage');
    const s = await call('GET', '/api/state');
    assert.strictEqual(s.project.aufgaben.find((a) => a.id === 'thema').status, 'offen');
    assert.strictEqual(s.project.merken[0].text, 'Methode: Bildanalyse');
    const info = await call('GET', `/api/files/info?path=${encodeURIComponent('02_expose_und_zeitplan/expose_vorlage.md')}`);
    assert.strictEqual(info.versions.length, 1);
    const restored = await call('POST', '/api/files/restore', { path: '02_expose_und_zeitplan/expose_vorlage.md', version: info.versions[0].path });
    assert.match(restored.path, /expose_vorlage_wiederhergestellt_/);
  });

  await t.test('Arbeitsstand: Status durch den Nutzer ändern', async () => {
    const p = await call('PATCH', '/api/aufgaben/thema', { status: 'erledigt' });
    assert.strictEqual(p.aufgaben.find((a) => a.id === 'thema').status, 'erledigt');
    await assert.rejects(call('PATCH', '/api/aufgaben/thema', { status: 'fertig' }), (e) => e.status === 400);
  });

  await t.test('Anhänge: hochladen, verschieben, Textauszug', async () => {
    const docx = fs.readFileSync(path.join(ROOT, 'ressourcen/vorgaben/Lerntagebuch-Vorlage.docx'));
    const up = await (await fetch(`${base}/api/uploads`, { method: 'POST', headers: { 'x-mango-token': token, 'x-filename': encodeURIComponent('Mein Lerntagebuch.docx') }, body: docx })).json();
    assert.strictEqual(up.lesbar, 'ja');
    assert.strictEqual(up.kindLabel, 'Word');
    const bad = await (await fetch(`${base}/api/uploads`, { method: 'POST', headers: { 'x-mango-token': token, 'x-filename': 'archiv.zip' }, body: 'PK' })).json();
    assert.strictEqual(bad.lesbar, 'nein');
    const { done, events } = await send(chatId, 'Lies den Anhang', [{ staged: up.id }, { staged: bad.id }, { path: '02_expose_und_zeitplan/expose_v1.md' }]);
    const user = events.find((e) => e.type === 'start').userMessage;
    assert.strictEqual(user.attachments.length, 3);
    assert.match(user.attachments[0].path, /^anhaenge\/\d{4}-\d{2}-\d{2}\/Mein Lerntagebuch\.docx$/);
    assert.ok(fs.existsSync(path.join(WS, user.attachments[0].path)));
    assert.ok(fs.existsSync(path.join(WS, user.attachments[0].extrakt)));
    assert.strictEqual(user.attachments[1].lesbar, 'nein');
    assert.strictEqual(done.message.status, 'fertig');
    const calls = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const last = calls[calls.length - 1].input;
    assert.match(last, /<anhaenge/);
    assert.match(last, /Textauszug: \.facharbeit\/extrakte\/anhaenge\//);
    assert.match(last, /archiv\.zip \(Archiv.*NICHT LESBAR/);
    await assert.rejects(send(chatId, 'x', [{ staged: up.id }]), (e) => e.status === 410);
  });

  await t.test('Antwort stoppen', async () => {
    const pending = send(chatId, 'LANGSAM bitte');
    await waitFor(async () => (await call('GET', '/api/state')).running.includes(chatId));
    await call('POST', `/api/chats/${chatId}/stop`);
    const { done } = await pending;
    assert.strictEqual(done.message.status, 'abgebrochen');
  });

  await t.test('Anmeldefehler wird verständlich gemeldet', async () => {
    const { done } = await send(chatId, 'AUTHFEHLER');
    assert.strictEqual(done.message.status, 'fehler');
    assert.strictEqual(done.message.errorKind, 'anmeldung');
    assert.strictEqual(done.message.hinweis.befehl, 'claude auth login');
    const claude = done.providers.find((p) => p.id === 'claude');
    assert.strictEqual(claude.status, 'anmeldung_noetig');
    await assert.rejects(send(chatId, 'Hallo'), (e) => e.status === 409 && e.data.code === 'anbieter');
    const prov = await call('POST', '/api/providers/claude/check');
    assert.strictEqual(prov.find((p) => p.id === 'claude').status, 'bereit');
  });

  await t.test('Anbieterwechsel zu Antigravity erhält den Projektstand', async () => {
    const r = await call('PUT', '/api/settings', { provider: 'antigravity' });
    assert.strictEqual(r.settings.provider, 'antigravity');
    const prov = await call('POST', '/api/providers/antigravity/check');
    assert.strictEqual(prov.find((p) => p.id === 'antigravity').status, 'verbunden');
    const { done, events } = await send(chatId, 'Und jetzt mit Antigravity?');
    assert.strictEqual(done.message.status, 'fertig');
    assert.strictEqual(done.message.provider, 'antigravity');
    assert.strictEqual(done.message.model, 'gemini-test');
    assert.match(done.message.text, /Hallo von Antigravity/);
    assert.match(done.message.activity[0].label, /Liest 00_vorgaben\/anforderungen\.md/);
    assert.ok(events.some((e) => e.type === 'activity'));
    const chat = await call('GET', `/api/chats/${chatId}`);
    assert.strictEqual(chat.sessions.antigravity.id, '055a398f-db14-4c5f-abbb-1bf03f8120a7');
    assert.ok(chat.sessions.claude.id);
    await call('PUT', '/api/settings', { provider: 'claude', theme: 'dark' });
  });

  await t.test('Exporte: Gesprächsverläufe, Word, Gesamtarbeit, Sicherung', async () => {
    const tr = await call('POST', '/api/export/transcripts');
    const md = fs.readFileSync(path.join(WS, tr.path), 'utf8');
    assert.match(md, /# Anlage: Vollständige Verläufe der KI-Gespräche/);
    assert.match(md, /### Prompt 1 /);
    assert.match(md, /Antigravity/);
    assert.ok(fs.existsSync(path.join(WS, tr.docx)));
    const d = await call('POST', '/api/export/docx', { path: '02_expose_und_zeitplan/expose_v1.md' });
    assert.ok(fs.existsSync(path.join(WS, d.path)));
    const fa = await call('POST', '/api/export/facharbeit');
    assert.ok(fa.path.startsWith('exporte/'));
    assert.ok(fa.teile.includes('02_einleitung.md'));
    const zip = await call('GET', '/api/export/backup', null, { raw: true });
    assert.strictEqual(zip.headers.get('content-type'), 'application/zip');
    assert.ok((await zip.arrayBuffer()).byteLength > 1000);
  });

  await t.test('Chats umbenennen, exportieren, löschen', async () => {
    const r = await call('PATCH', `/api/chats/${chatId}`, { title: 'Exposé-Planung' });
    assert.strictEqual(r.title, 'Exposé-Planung');
    const ex = await call('GET', `/api/chats/${chatId}/export`, null, { raw: true });
    assert.match(await ex.text(), /# KI-Gesprächsverlauf: Exposé-Planung/);
    const c2 = await call('POST', '/api/chats');
    const c3 = await call('POST', '/api/chats');
    assert.strictEqual(c2.id, c3.id, 'leerer Chat wird wiederverwendet');
    await call('DELETE', `/api/chats/${c2.id}`);
    const list = await call('GET', '/api/chats');
    assert.ok(!list.some((c) => c.id === c2.id));
  });

  await t.test('Fehlende Dateien werden gemeldet', async () => {
    await assert.rejects(call('POST', '/api/files/open', { path: 'gibt/es/nicht.md' }), (e) => e.status === 404 && /nicht gefunden/.test(e.message));
    const info = await call('GET', `/api/files/info?path=${encodeURIComponent('gibt/es/nicht.md')}`);
    assert.strictEqual(info.exists, false);
  });
});

test('Neustart: Arbeitsstand bleibt erhalten, verschobener Arbeitsraum wird erkannt', async () => {
  server.kill();
  await new Promise((r) => server.once('exit', r));
  base = null;
  await startServer();
  token = /name="mango-token" content="([a-f0-9]+)"/.exec(await (await fetch(`${base}/`)).text())[1];
  let s = await call('GET', '/api/state');
  assert.strictEqual(s.project.angaben.lehrkraft, 'Frau Muster');
  assert.strictEqual(s.settings.theme, 'dark');
  assert.strictEqual(s.project.aufgaben.find((a) => a.id === 'expose').status, 'erledigt');
  assert.ok(s.chats.some((c) => c.title === 'Exposé-Planung'));
  server.kill();
  await new Promise((r) => server.once('exit', r));
  fs.renameSync(WS, `${WS} verschoben`);
  base = null;
  await startServer();
  token = /name="mango-token" content="([a-f0-9]+)"/.exec(await (await fetch(`${base}/`)).text())[1];
  s = await call('GET', '/api/state');
  assert.strictEqual(s.project, null);
  assert.match(s.projectError.message, /nicht gefunden/);
  s = await call('POST', '/api/projects/open', { workspace: `${WS} verschoben` });
  assert.strictEqual(s.project.angaben.name, 'Alex Beispiel');
});
