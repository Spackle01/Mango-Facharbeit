'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readZip, writeZip } = require('../server/zip');
const extract = require('../server/extract');
const ctx = require('../server/context');
const { autoTitle } = require('../server/runs');
const { describeTool, classifyError } = require('../server/providers/activity');
const { markdownToDocx, facharbeitToDocx } = require('../server/docx');
const { AUFGABEN, STATUS_INFO } = require('../server/aufgaben');
const { Project } = require('../server/store');
const { resolveInside, safeFileName } = require('../server/util');

const ROOT = path.join(__dirname, '..');

test('ZIP: schreiben und wieder lesen', () => {
  const buf = writeZip([{ name: 'a.txt', data: 'Hallo Ä' }, { name: 'ordner/b.bin', data: Buffer.alloc(5000, 7) }]);
  const z = readZip(buf);
  assert.deepStrictEqual(z.names().sort(), ['a.txt', 'ordner/b.bin']);
  assert.strictEqual(z.read('a.txt').toString('utf8'), 'Hallo Ä');
  assert.strictEqual(z.read('ordner/b.bin').length, 5000);
});

test('Textauszug aus der Lerntagebuch-Vorlage der Schule', async () => {
  const r = await extract.analyse(path.join(ROOT, 'ressourcen/vorgaben/Lerntagebuch-Vorlage.docx'));
  assert.strictEqual(r.kind, 'word');
  assert.strictEqual(r.lesbar, 'ja');
  assert.match(r.text, /Lerntagebuch/);
  assert.match(r.text, /Festlegen eigener Lernziele/);
});

test('Nicht lesbare und nicht unterstützte Dateien werden erkannt', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-'));
  fs.writeFileSync(path.join(dir, 'kaputt.docx'), 'kein zip');
  fs.writeFileSync(path.join(dir, 'x.exe'), 'MZ');
  fs.writeFileSync(path.join(dir, 'leer.md'), '');
  assert.strictEqual((await extract.analyse(path.join(dir, 'kaputt.docx'))).lesbar, 'nein');
  assert.strictEqual((await extract.analyse(path.join(dir, 'x.exe'))).lesbar, 'nein');
  assert.strictEqual((await extract.analyse(path.join(dir, 'leer.md'))).hinweis, 'Datei ist leer');
  assert.strictEqual((await extract.analyse(path.join(dir, 'fehlt.md'))).hinweis, 'Datei fehlt');
});

test('Arbeitsstand-Block wird erkannt und aus dem Text entfernt', () => {
  const text = 'Fertig.\n\n```arbeitsstand\n{"aufgaben":[{"id":"expose","status":"in_arbeit",}],"merken":"Eins"}\n```';
  const r = ctx.parseUpdate(text);
  assert.strictEqual(r.text, 'Fertig.');
  assert.strictEqual(r.update.aufgaben[0].id, 'expose');
  assert.deepStrictEqual(r.update.merken, ['Eins']);
  assert.strictEqual(ctx.parseUpdate('Nur Text').update, null);
  assert.strictEqual(ctx.parseUpdate('```arbeitsstand\n{kaputt\n```').invalid, true);
});

test('Nachweis-Dateien werden geprüft', () => {
  const files = [{ path: '02_expose_und_zeitplan/expose_v1.md', name: 'expose_v1.md' }];
  assert.ok(ctx.nachweisDateiOk('Datei 02_expose_und_zeitplan/expose_v1.md, 430 Wörter', files));
  assert.ok(!ctx.nachweisDateiOk('02_expose_und_zeitplan/expose_v9.md', files));
  assert.ok(ctx.nachweisDateiOk('Gegen Abschnitt 6 geprüft', files));
});

test('Arbeitsstand-Updates: erledigt nur mit Nachweis, externe Aufgaben nur als Vorschlag', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-ws-'));
  const p = await Project.create(dir, { name: 'Test' });
  fs.writeFileSync(path.join(dir, '02_expose_und_zeitplan', 'expose_v1.md'), '# Exposé');
  const files = [{ path: '02_expose_und_zeitplan/expose_v1.md', name: 'expose_v1.md' }];
  const r = await ctx.applyUpdate(p, {
    aufgaben: [
      { id: 'expose', status: 'erledigt', nachweis: '02_expose_und_zeitplan/expose_v1.md' },
      { id: 'gliederung', status: 'erledigt' },
      { id: 'abgabe', status: 'erledigt', nachweis: 'abgegeben' },
      { id: 'unbekannt', status: 'erledigt' },
      { id: 'zeitplan', status: 'erledigt', nachweis: '02_expose_und_zeitplan/zeitplan_v3.md' },
    ],
    projekt: { forschungsfrage: 'Frage?', abgabedatum: 'morgen', unsinn: 'x' },
    merken: ['Methode: Umfrage'],
  }, files);
  const st = Object.fromEntries(p.aufgaben().map((t) => [t.id, t.status]));
  assert.strictEqual(st.expose, 'erledigt');
  assert.strictEqual(st.gliederung, 'in_arbeit');
  assert.strictEqual(st.abgabe, 'offen');
  assert.strictEqual(st.zeitplan, 'in_arbeit');
  assert.strictEqual(r.vorschlaege[0].id, 'abgabe');
  assert.strictEqual(p.data.angaben.forschungsfrage, 'Frage?');
  assert.strictEqual(p.data.angaben.abgabedatum, '');
  assert.strictEqual(p.data.merken[0].text, 'Methode: Umfrage');
  const overview = fs.readFileSync(path.join(dir, 'FACHARBEIT.md'), 'utf8');
  assert.match(overview, /✓ Erledigt – Exposé schreiben/);
  assert.match(overview, /Methode: Umfrage/);
});

test('Projektkontext enthält Angaben, Arbeitsstand und Fristen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-ws-'));
  const p = await Project.create(dir, { name: 'Alex', titel: 'Testthema', fach: 'Mathematik' });
  const c = await ctx.buildContext(p, [], new Date(2026, 9, 6, 12, 0));
  assert.match(c.text, /Titel: Testthema/);
  assert.match(c.text, /× expose – Exposé schreiben/);
  assert.match(c.text, /Abgabe: 07\.12\.2026, 16:00 Uhr \(in 62 Tagen\)/);
  assert.match(c.text, /Noch fehlende Angaben: Bezugsfach, Lehrkraft|Noch fehlende Angaben: Klasse\/Kurs, Bezugsfach/);
  const c2 = await ctx.buildContext(p, [], new Date(2026, 9, 6, 15, 30));
  assert.strictEqual(c.hash, c2.hash, 'Uhrzeit allein ändert den Kontext nicht');
});

test('Aufgabenliste: drei Status, Quellen vorhanden', () => {
  assert.deepStrictEqual(Object.keys(STATUS_INFO), ['offen', 'in_arbeit', 'erledigt']);
  assert.deepStrictEqual(Object.values(STATUS_INFO).map((s) => s.symbol), ['×', '?', '✓']);
  for (const a of AUFGABEN) assert.ok(a.quelle && a.hilfe && a.titel, a.id);
});

test('Chat-Titel werden kurz und verständlich', () => {
  assert.strictEqual(autoTitle('Hallo! Kannst du mir helfen, ein Exposé zu schreiben?'), 'Exposé schreiben');
  assert.strictEqual(autoTitle('Wie zitiere ich eine Internetquelle richtig?'), 'Wie zitiere ich eine Internetquelle richtig');
  assert.strictEqual(autoTitle('', [{ name: 'notizen.pdf' }]), 'Datei: notizen.pdf');
  assert.ok(autoTitle('a '.repeat(80)).length <= 50);
});

test('Werkzeugaufrufe werden auf Deutsch beschrieben', () => {
  assert.strictEqual(describeTool('Write', { file_path: '/ws/02_x/a.md' }, '/ws').label, 'Schreibt 02_x/a.md');
  assert.match(describeTool('WebSearch', { query: 'Goldener Schnitt' }, '/ws').label, /Sucht im Web/);
  assert.strictEqual(describeTool('read_file', { AbsolutePath: '/ws/b.md' }, '/ws').label, 'Liest b.md');
  assert.strictEqual(classifyError('Not logged in · Please run /login'), 'anmeldung');
  assert.strictEqual(classifyError('Error: authentication required'), 'anmeldung');
  assert.strictEqual(classifyError('No conversation found with session ID'), 'sitzung');
  assert.strictEqual(classifyError('RESOURCE_EXHAUSTED 429'), 'limit');
});

test('Word-Export erzeugt gültiges Paket mit Schulformatierung', () => {
  const buf = markdownToDocx('# Einleitung\n\nText mit **fett**.\n\n- Punkt\n\n| A | B |\n|---|---|\n| 1 | 2 |');
  const z = readZip(buf);
  const doc = z.read('word/document.xml').toString('utf8');
  const styles = z.read('word/styles.xml').toString('utf8');
  assert.match(doc, /<w:pStyle w:val="Heading1"\/>/);
  assert.match(doc, /<w:b\/>/);
  assert.match(doc, /<w:tbl>/);
  assert.match(doc, /w:left="1418"/); // 2,5 cm
  assert.match(doc, /w:top="1134"/); // 2,0 cm
  assert.match(styles, /w:ascii="Arial"/);
  assert.match(styles, /<w:sz w:val="22"\/>/); // 11 pt
  assert.match(styles, /w:line="360"/); // 1,5-zeilig
  const full = readZip(facharbeitToDocx({ angaben: { titel: 'T', name: 'N', fach: 'Mathe' }, teile: [{ markdown: '# 1 Einleitung\n\nText' }], datum: '06.10.2026' }));
  const fdoc = full.read('word/document.xml').toString('utf8');
  assert.match(fdoc, /TOC \\o/);
  assert.match(fdoc, /<w:pgNumType w:start="1"\/>/);
  assert.strictEqual((fdoc.match(/<w:sectPr>/g) || []).length, 3);
});

test('Pfade bleiben im Arbeitsraum', () => {
  assert.strictEqual(resolveInside('/ws', '../etc/passwd'), null);
  assert.strictEqual(resolveInside('/ws', 'a/../../b'), null);
  assert.ok(resolveInside('/ws', 'a/b.md').endsWith(path.join('ws', 'a', 'b.md')));
  assert.strictEqual(safeFileName('a/b:c?.pdf'), 'a_b_c_.pdf');
  assert.strictEqual(safeFileName('CON.txt'), '_CON.txt');
});

test('Markdown-Renderer maskiert HTML und erkennt Dateien', async () => {
  const { renderMarkdown, stripUpdateBlock } = await import('../public/js/markdown.js');
  const html = renderMarkdown('<img src=x onerror=alert(1)> `a/b.md` [x](javascript:alert(1))', { isFile: (p) => p === 'a/b.md' });
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('javascript:'));
  assert.match(html, /class="file-ref" data-path="a\/b\.md"/);
  assert.strictEqual(stripUpdateBlock('Text\n```arbeitsstand\n{"auf'), 'Text');
});

test('Übernahme: Entwurfsstände, Systemdateien und Pfade', () => {
  const importer = require('../server/importer');
  const key = importer.familyKey;
  assert.strictEqual(key('Facharbeit_v2.docx'), 'facharbeit');
  assert.strictEqual(key('Facharbeit final (1) - Kopie.docx'), 'facharbeit');
  assert.strictEqual(key('Facharbeit 2026-10-05.pdf'), 'facharbeit');
  assert.strictEqual(key('Exposé Stand 3.md'), 'exposé');
  assert.strictEqual(key('Lerntagebuch.docx'), 'lerntagebuch');
  assert.notStrictEqual(key('Kapitel 2.docx'), key('Fragebogen.docx'));
  for (const junk of ['a/.DS_Store', 'Thumbs.db', '~$Facharbeit.docx', '__MACOSX/a/b.md', 'x/.git/config', 'datei.tmp', 'a/'])
    assert.ok(importer.isJunk(junk), junk);
  assert.ok(!importer.isJunk('Ordner/Facharbeit.docx'));
  assert.strictEqual(importer.cleanRelPath('..\\..\\Ordner/./Unter:ordner/Datei?.md'), 'Ordner/Unter_ordner/Datei_.md');
  assert.strictEqual(importer.cleanRelPath('/etc/passwd'), 'etc/passwd');
  assert.strictEqual(importer.guessCategory('Mindmap_Thema.png', '').id, 'mindmap');
  assert.deepStrictEqual(importer.guessCategory('scan1.pdf', 'Fragebogen zur Mediennutzung'), { id: 'eigenanteil', label: 'Eigenanteil (Erhebung, Daten)', sicher: false });
});

test('Übernahme: Ergebnis-Block wird gelesen und entfernt', async () => {
  const importer = require('../server/importer');
  const text = 'Einschätzung.\n\n```arbeitsstand\n{"aufgaben":[]}\n```\n\n```uebernahme\n{"zusammenfassung":"Thema X","vorhanden":["A","B",],"fehlt":"Zeitplan","naechsterSchritt":"Zeitplan","versionen":[{"dateien":["a.md","b.md"],"frage":"Welche?"},{"dateien":[]}]}\n```';
  const r = importer.parseResult(ctx.parseUpdate(text).text);
  assert.strictEqual(r.text, 'Einschätzung.');
  assert.strictEqual(r.invalid, false);
  assert.deepStrictEqual(r.result.vorhanden, ['A', 'B']);
  assert.deepStrictEqual(r.result.fehlt, ['Zeitplan'], 'einzelner Text wird zur Liste');
  assert.strictEqual(r.result.versionen.length, 1, 'leere Gruppen fallen weg');
  const bad = importer.parseResult('Text\n```uebernahme\n{kaputt\n```');
  assert.strictEqual(bad.result, null);
  assert.strictEqual(bad.invalid, true);
  assert.strictEqual(bad.text, 'Text');
  const { stripUpdateBlock } = await import('../public/js/markdown.js');
  assert.strictEqual(stripUpdateBlock('Text\n```arbeitsstand\n{}\n```\n```uebernahme\n{"zus'), 'Text');
});

test('Übernahme: vorhandene Projektangaben werden nicht überschrieben', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-ws-'));
  const p = await Project.create(dir, { name: 'Alex', titel: 'Mein Thema' });
  const r = await ctx.applyUpdate(p, { aufgaben: [], projekt: { titel: 'Anderes Thema', fach: 'Kunst', name: 'Alex' }, merken: [] }, [], { nurLeereFelder: true });
  assert.strictEqual(p.data.angaben.titel, 'Mein Thema');
  assert.strictEqual(p.data.angaben.fach, 'Kunst');
  assert.deepStrictEqual(r.konflikte, [{ feld: 'titel', label: 'Titel', bisher: 'Mein Thema', gefunden: 'Anderes Thema' }]);
  const normal = await ctx.applyUpdate(p, { aufgaben: [], projekt: { titel: 'Anderes Thema' }, merken: [] }, []);
  assert.strictEqual(normal.konflikte.length, 0);
  assert.strictEqual(p.data.angaben.titel, 'Anderes Thema');
});
