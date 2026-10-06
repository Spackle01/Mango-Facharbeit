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

let importId = null;
let importOrdner = null;

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

  await t.test('Übernahme: Dateien und Ordner hochladen und prüfen', async () => {
    const imp = await call('POST', '/api/import');
    assert.match(imp.id, /^\d{4}-\d{2}-\d{2}_\d{4}$/);
    assert.strictEqual(imp.ordner, `uebernommen/${imp.id}`);
    const up = async (rel, body, lastModified) => {
      const res = await fetch(`${base}/api/import/${imp.id}/dateien`, {
        method: 'POST', body,
        headers: { 'x-mango-token': token, 'x-relpath': encodeURIComponent(rel), ...(lastModified ? { 'x-last-modified': String(lastModified) } : {}) },
      });
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status });
      return data;
    };
    const vorlage = fs.readFileSync(path.join(ROOT, 'ressourcen/vorgaben/Lerntagebuch-Vorlage.docx'));
    await up('Meine Facharbeit/Facharbeit/Expose_v1.md', '# Exposé\n\nErste Fassung.', Date.UTC(2026, 8, 1));
    await up('Meine Facharbeit/Facharbeit/Expose_v2.md', '# Exposé\n\nZweite, längere Fassung mit Zeitplan.', Date.UTC(2026, 8, 20));
    await up('Meine Facharbeit/Notizen.md', 'Ideen zum Goldenen Schnitt');
    await up('Meine Facharbeit/Notizen - Kopie.md', 'Ideen zum Goldenen Schnitt');
    const zweite = await up('Meine Facharbeit/Notizen.md', 'Andere Notizen');
    assert.strictEqual(zweite.pfad, `${imp.ordner}/Meine Facharbeit/Notizen (2).md`, 'nichts wird überschrieben');
    await up('Meine Facharbeit/Lerntagebuch.docx', vorlage);
    await up('Meine Facharbeit/alt/kaputt.docx', 'PK kaputt');
    const junk = await up('Meine Facharbeit/.DS_Store', 'x');
    assert.strictEqual(junk.uebersprungen, true);
    const ausbruch = await up('../../ausbruch.md', 'x');
    assert.strictEqual(ausbruch.pfad, `${imp.ordner}/ausbruch.md`);
    const mtime = fs.statSync(path.join(WS, imp.ordner, 'Meine Facharbeit/Facharbeit/Expose_v1.md')).mtimeMs;
    assert.strictEqual(Math.round(mtime), Date.UTC(2026, 8, 1), 'Änderungsdatum bleibt erhalten');

    const res = await call('POST', `/api/import/${imp.id}/analyse`, { fehlgeschlagen: [{ rel: 'Meine Facharbeit/gesperrt.docx', error: 'Datei konnte nicht gelesen werden' }] }, { raw: true });
    const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    assert.ok(events.some((e) => e.type === 'fortschritt' && e.gesamt === 8));
    const inv = events.find((e) => e.type === 'fertig').inventar;
    assert.strictEqual(inv.anzahl, 8);
    assert.strictEqual(inv.ordnerListe.length, 3);
    assert.strictEqual(inv.uebersprungen.length, 1);
    assert.deepStrictEqual(inv.nichtUebernommen, [{ pfad: 'Meine Facharbeit/gesperrt.docx', grund: 'Datei konnte nicht gelesen werden' }]);
    assert.deepStrictEqual(inv.unlesbar.map((u) => u.pfad), [`${imp.ordner}/Meine Facharbeit/alt/kaputt.docx`]);
    assert.deepStrictEqual(inv.duplikate, [[`${imp.ordner}/Meine Facharbeit/Notizen - Kopie.md`, `${imp.ordner}/Meine Facharbeit/Notizen.md`]]);
    const expose = inv.versionen.find((v) => v.familie === 'expose');
    assert.deepStrictEqual(expose.dateien.map((d) => d.pfad.split('/').pop()), ['Expose_v1.md', 'Expose_v2.md'], 'älteste Fassung zuerst');
    assert.ok(inv.versionen.some((v) => v.familie === 'notizen'), 'Notizen (2) ist ein anderer Stand');
    assert.strictEqual(inv.bereitsVorhanden.length, 1);
    assert.match(inv.bereitsVorhanden[0].gleichWie, /^0\d_[a-z_]+\/Lerntagebuch-Vorlage\.docx$/);
    assert.strictEqual(inv.kategorien['Lerntagebuch'], 1);
    assert.strictEqual(inv.kategorien['Exposé'], 2);
    const md = fs.readFileSync(path.join(WS, '.facharbeit', 'import', imp.id, 'inventar.md'), 'utf8');
    assert.match(md, /NICHT LESBAR/);
    assert.match(md, /Nicht übernommen, weil .*\n  - Meine Facharbeit\/gesperrt\.docx/);
    assert.match(md, /Expose_v1\.md/);
    assert.deepStrictEqual(await call('GET', `/api/import/${imp.id}`), inv);
    await assert.rejects(call('GET', '/api/import/..%2F..'), (e) => e.status === 404);
    importId = imp.id;
    importOrdner = imp.ordner;
  });

  await t.test('Übernahme: Analyse durch den Assistenten, nur lesend', async () => {
    const notizenVorher = fs.readFileSync(path.join(WS, importOrdner, 'Meine Facharbeit/Notizen.md'), 'utf8');
    const chat = await call('POST', '/api/chats');
    await assert.rejects(call('POST', `/api/chats/${chat.id}/messages`, { importId: '2020-01-01_0000' }), (e) => e.status === 400);
    const res = await call('POST', `/api/chats/${chat.id}/messages`, { importId }, { raw: true });
    const events = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    const start = events.find((e) => e.type === 'start');
    assert.strictEqual(start.userMessage.import.anzahl, 8);
    assert.strictEqual(start.userMessage.import.unlesbar, 1);
    assert.strictEqual(start.userMessage.import.nichtUebernommen, 1);
    assert.strictEqual(start.message.mode, 'import');
    const { message: m, chat: c } = events.find((e) => e.type === 'done');
    assert.strictEqual(c.title, 'Übernahme der bisherigen Arbeit');
    assert.strictEqual(m.status, 'fertig', m.error);

    const calls = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const last = calls[calls.length - 1];
    assert.strictEqual(last.args[last.args.indexOf('--allowedTools') + 1], 'Read,Glob,Grep,TodoWrite,Skill');
    assert.match(last.args[last.args.indexOf('--disallowedTools') + 1], /Write,Edit/);
    assert.match(last.input, new RegExp(`<uebernahme id="${importId}"`));
    assert.match(last.input, /inventar\.md/);

    // Originale bleiben unverändert, der Versuch wird zurückgesetzt und angezeigt.
    assert.strictEqual(fs.readFileSync(path.join(WS, importOrdner, 'Meine Facharbeit/Notizen.md'), 'utf8'), notizenVorher);
    assert.strictEqual(m.files.find((f) => f.path.endsWith('Meine Facharbeit/Notizen.md')).aktion, 'zurueckgesetzt');

    assert.ok(!/```(uebernahme|arbeitsstand)/.test(m.text));
    assert.match(m.text, /Welches Fach ist dein Bezugsfach\?/);
    const r = m.importErgebnis;
    assert.strictEqual(r.analysiert, true);
    assert.strictEqual(r.anzahl, 8);
    assert.deepStrictEqual(r.fehlt, ['Zeitplan', 'Literaturverzeichnis']);
    assert.strictEqual(r.naechsterSchritt, 'Zeitplan nach Vorgabe ergänzen.');
    assert.strictEqual(r.versionen.length, 1);
    assert.strictEqual(r.unlesbar.length, 1);
    assert.strictEqual(r.nichtUebernommen[0].pfad, 'Meine Facharbeit/gesperrt.docx');
    assert.strictEqual(r.duplikate.length, 1);

    // Projektangaben: leere Felder werden gefüllt, Abweichungen nur angeboten.
    const byId = Object.fromEntries(m.updates.aufgaben.map((a) => [a.id, a]));
    assert.strictEqual(byId.fragestellung.nach, 'erledigt');
    assert.strictEqual(byId.recherche.nach, 'in_arbeit', 'ohne Nachweis nicht erledigt');
    assert.deepStrictEqual(m.updates.projekt.map((x) => x.feld), ['fach']);
    assert.deepStrictEqual(m.updates.konflikte, [{ feld: 'titel', label: 'Titel', bisher: 'Testthema', gefunden: 'Der Goldene Schnitt in der Kunst' }]);
    const s = await call('GET', '/api/state');
    assert.strictEqual(s.project.angaben.titel, 'Testthema');
    assert.strictEqual(s.project.angaben.fach, 'Mathematik');
    assert.match(s.project.uebernahme.zusammenfassung, /Goldener Schnitt/);
    assert.match(fs.readFileSync(path.join(WS, '.facharbeit', 'uebernahme.md'), 'utf8'), /## Das fehlt noch\n\n- Zeitplan/);
    assert.match(fs.readFileSync(path.join(WS, 'FACHARBEIT.md'), 'utf8'), /## Übernommener Stand/);
  });

  await t.test('Übernahme: Zusammenfassung in späteren Chats, Fassung festlegen', async () => {
    const chat = await call('POST', '/api/chats');
    await send(chat.id, 'Wie geht es weiter?');
    let calls = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    let input = calls[calls.length - 1].input;
    assert.match(input, /Übernommener Stand \(mitgebrachte Arbeit/);
    assert.match(input, /Goldener Schnitt/);
    assert.match(input, /Offene Fragen zu Entwurfsständen: Welche Exposé-Fassung ist aktuell\?/);
    const v = (await call('GET', '/api/state')).project.uebernahme.versionen[0];
    await assert.rejects(call('POST', '/api/uebernahme/fassung', { dateien: v.dateien, gewaehlt: 'irgendwas.md' }), (e) => e.status === 400);
    const p = await call('POST', '/api/uebernahme/fassung', { dateien: v.dateien, gewaehlt: v.dateien[1] });
    assert.strictEqual(p.uebernahme.versionen.length, 0);
    assert.strictEqual(p.uebernahme.entscheidungen[0].gewaehlt, v.dateien[1]);
    assert.ok(p.merken.some((x) => x.text.startsWith('Aktuelle Fassung: `') && x.text.includes('Expose_v2.md')));
    const chat2 = await call('POST', '/api/chats');
    await send(chat2.id, 'Und jetzt?');
    calls = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    input = calls[calls.length - 1].input;
    assert.ok(!input.includes('Offene Fragen zu Entwurfsständen'));
    assert.match(input, /Aktuelle Fassung: `uebernommen\//);
  });

  await t.test('Übernahme: weiteres Material ergänzt den Stand', async () => {
    const imp = await call('POST', '/api/import');
    assert.notStrictEqual(imp.id, importId);
    const r1 = await fetch(`${base}/api/import/${imp.id}/dateien`, { method: 'POST', body: '# Gliederung', headers: { 'x-mango-token': token, 'x-relpath': 'Gliederung.md' } });
    assert.ok(r1.ok);
    await (await call('POST', `/api/import/${imp.id}/analyse`, {}, { raw: true })).text();
    const chat = await call('POST', '/api/chats');
    const res = await call('POST', `/api/chats/${chat.id}/messages`, { importId: imp.id }, { raw: true });
    const done = (await res.text()).trim().split('\n').map((l) => JSON.parse(l)).find((e) => e.type === 'done');
    assert.strictEqual(done.chat.title, 'Weiteres Material übernommen');
    const calls = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.match(calls[calls.length - 1].input, /Es gibt bereits einen übernommenen Stand/);
    const u = (await call('GET', '/api/state')).project.uebernahme;
    assert.deepStrictEqual(u.importe.map((i) => i.id), [importId, imp.id]);
    assert.strictEqual(u.anzahl, 9);
    assert.strictEqual(u.entscheidungen.length, 1, 'getroffene Entscheidung bleibt');
    assert.strictEqual(u.unlesbar.length, 1, 'Befunde der ersten Übernahme bleiben');
    const md = fs.readFileSync(path.join(WS, '.facharbeit', 'uebernahme.md'), 'utf8');
    assert.match(md, /9 Dateien aus 2 Übernahmen/);
    assert.match(md, /## Festgelegte aktuelle Fassungen/);
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
  assert.match(s.project.uebernahme.zusammenfassung, /Goldener Schnitt/);
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
