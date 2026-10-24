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

test('Modelle: IDs, Liste von agy, Fehlererkennung, Anzeigenamen', async () => {
  const models = require('../server/providers/models');
  for (const ok of ['', 'sonnet', 'claude-opus-5-5', 'sonnet[1m]', 'gemini-3.1-pro-high', 'us.anthropic.claude-opus-5-5'])
    assert.ok(models.validModelId(ok), ok);
  for (const bad of ['opus & calc', 'a b', '-p', '"x"', 'x;y', 'x|y', '%PATH%', '$(id)', 'x'.repeat(101)])
    assert.ok(!models.validModelId(bad), bad);
  const list = models.parseAgyModels('\u001b[1mSLUG                      NAME\u001b[0m\ngemini-3.8-flash-high     Gemini 3.8 Flash (High)\n\n* gemini-3.1-pro-high       Gemini 3.1 Pro (High)\nUse --model <slug> to pick one.\n');
  assert.deepStrictEqual(list.map((m) => [m.id, m.name]), [['gemini-3.8-flash-high', 'Gemini 3.8 Flash (High)'], ['gemini-3.1-pro-high', 'Gemini 3.1 Pro (High)']]);
  assert.strictEqual(classifyError("There's an issue with the selected model (claude-x). It may not exist or you may not have access to it."), 'modell');
  assert.strictEqual(classifyError('Error: unknown model "gemini-9"'), 'modell');
  assert.strictEqual(classifyError('API Error: 529 overloaded'), 'limit');
  assert.strictEqual(classifyError('Not logged in · Please run /login'), 'anmeldung');
  const { modelLabel } = await import('../public/js/modelname.js');
  assert.strictEqual(modelLabel(''), 'Standard');
  assert.strictEqual(modelLabel('sonnet'), 'Sonnet');
  assert.strictEqual(modelLabel('claude-sonnet-5-5'), 'Sonnet 5.5');
  assert.strictEqual(modelLabel('claude-haiku-4-5-20251001'), 'Haiku 4.5');
  assert.strictEqual(modelLabel('claude-fable-5'), 'Fable 5');
  assert.strictEqual(modelLabel('opus[1m]'), 'Opus (1M)');
  assert.strictEqual(modelLabel('gemini-3.1-pro-high'), 'Gemini 3.1 Pro (High)');
  assert.strictEqual(modelLabel('x-1', [{ id: 'x-1', name: 'Mein Modell' }]), 'Mein Modell');
  assert.strictEqual(modelLabel('claude-gibtsnicht-9'), 'claude-gibtsnicht-9', 'Unbekanntes bleibt wie eingegeben');
});

test('Bestes Gemini-Modell: Pro vor Flash, neueste Version, höchste Denkstufe', () => {
  const { bestGeminiModel } = require('../server/providers/models');
  const ids = (...l) => l.map((id) => ({ id }));
  assert.strictEqual(bestGeminiModel(ids('gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.7-flash-high', 'gemini-3.1-pro-high')), 'gemini-3.1-pro-high');
  assert.strictEqual(bestGeminiModel(ids('gemini-3.1-pro-low', 'gemini-3.1-pro-high', 'gemini-3.1-pro-medium')), 'gemini-3.1-pro-high');
  assert.strictEqual(bestGeminiModel(ids('gemini-3-pro-high', 'gemini-3.1-pro-high', 'gemini-2.5-pro')), 'gemini-3.1-pro-high');
  assert.strictEqual(bestGeminiModel(ids('gemini-3.8-flash-lite', 'gemini-3.8-flash-medium', 'gemini-3.7-flash-high')), 'gemini-3.8-flash-medium', 'ohne Pro: neuestes Flash');
  assert.strictEqual(bestGeminiModel(ids('gemini-3.1-pro-preview-high', 'gemini-3.1-pro-high')), 'gemini-3.1-pro-high', 'stabil vor Vorschau');
  assert.strictEqual(bestGeminiModel(ids('claude-sonnet-4-6', 'gpt-oss-120b')), '', 'kein Gemini: Voreinstellung der CLI');
  assert.strictEqual(bestGeminiModel([]), '');
  assert.strictEqual(bestGeminiModel(undefined), '');
});

test('Einstellungen: automatische Wahl überschreibt keine eigene Wahl', async () => {
  const { AppStore } = require('../server/store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-settings-'));
  const prev = process.env.MANGO_DATA_DIR;
  process.env.MANGO_DATA_DIR = dir;
  try {
    let st = new AppStore();
    await st.load();
    assert.strictEqual(st.settings.provider, 'claude');
    assert.deepStrictEqual(st.settings.modelle, { claude: 'sonnet', antigravity: '' });
    assert.ok(!st.settings.anbieterGewaehlt && !st.settings.modellGewaehlt);
    await st.updateSettings({ provider: 'antigravity', modelle: { antigravity: 'gemini-3.1-pro-high' } }, { auto: true });
    assert.ok(!st.settings.anbieterGewaehlt && !st.settings.modellGewaehlt, 'automatisch heißt nicht gewählt');
    await st.updateSettings({ modelle: { antigravity: '' } });
    assert.strictEqual(st.settings.modellGewaehlt.antigravity, true);
    await st.updateSettings({ provider: 'claude' });
    assert.strictEqual(st.settings.anbieterGewaehlt, true);

    // Einstellungen aus 0.2.0: Antigravity war damals eine eigene Wahl.
    fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify({ version: 1, settings: { provider: 'antigravity', modelle: { claude: 'sonnet', antigravity: 'gemini-x-1' }, version: 2 }, projects: [] }));
    st = new AppStore();
    await st.load();
    assert.strictEqual(st.settings.anbieterGewaehlt, true);
    assert.strictEqual(st.settings.modellGewaehlt.antigravity, true);
    assert.strictEqual(st.settings.version, 3);
  } finally {
    if (prev === undefined) delete process.env.MANGO_DATA_DIR; else process.env.MANGO_DATA_DIR = prev;
  }
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

test('Word → Markdown: Überschriften, Fett/Kursiv, Listen, Tabellen', () => {
  const p = (inner, style = '', num = false) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${num ? '<w:numPr><w:ilvl w:val="0"/></w:numPr>' : ''}</w:pPr>${inner}</w:p>`;
  const r = (t, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
  const xml = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${[
    p(r('Mein Titel'), 'Title'),
    p(r('Einleitung'), 'berschrift1'),
    p(r('Das ist ') + r('wichtig', '<w:b/>') + r(' und ') + r('betont', '<w:i/>') + r(' – ') + r('nicht fett', '<w:b w:val="0"/>') + r('.')),
    p(r('Punkt A'), '', true),
    '<w:tbl><w:tr><w:tc>' + p(r('Kopf 1')) + '</w:tc><w:tc>' + p(r('Kopf 2')) + '</w:tc></w:tr><w:tr><w:tc>' + p(r('a|b')) + '</w:tc><w:tc>' + p(r('c')) + '</w:tc></w:tr></w:tbl>',
  ].join('')}</w:body></w:document>`;
  const docx = writeZip([{ name: '[Content_Types].xml', data: Buffer.from('<Types/>') }, { name: 'word/document.xml', data: Buffer.from(xml) }]);
  const md = extract.docxToText(docx);
  assert.match(md, /^# Mein Titel$/m);
  assert.match(md, /^# Einleitung$/m);
  assert.match(md, /^Das ist \*\*wichtig\*\* und \*betont\* – nicht fett\.$/m);
  assert.match(md, /^- Punkt A$/m);
  assert.match(md, /^\| Kopf 1 \| Kopf 2 \|\n\| --- \| --- \|\n\| a\\\|b \| c \|$/m);
});

test('Einsortieren: Plan lesen und sicher ausführen', async () => {
  const sortieren = require('../server/sortieren');
  const parsed = sortieren.parsePlan('Fertig.\n\n```einsortieren\n[{"von":"uebernommen/x/a.md","nach":"02_expose_und_zeitplan/expose.md"},{"von":"","nach":"x"},]\n```\n```einsortieren\n{"dateien":[{"quelle":"anhaenge/b.txt","ziel":"01_themenfindung_und_mindmap/b.md","ersetzen":true}]}\n```');
  assert.strictEqual(parsed.text, 'Fertig.');
  assert.deepStrictEqual(parsed.plan, [
    { von: 'uebernommen/x/a.md', nach: '02_expose_und_zeitplan/expose.md', ersetzen: false },
    { von: 'anhaenge/b.txt', nach: '01_themenfindung_und_mindmap/b.md', ersetzen: true },
  ]);
  assert.strictEqual(sortieren.parsePlan('```einsortieren\n[kaputt\n```').invalid, true);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-ws-'));
  const p = await Project.create(dir, { name: 'Test' });
  const src = path.join(dir, 'uebernommen', 'x');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'a.md'), '# A');
  fs.writeFileSync(path.join(src, 'notiz.txt'), 'Idee');
  fs.copyFileSync(path.join(ROOT, 'ressourcen/vorgaben/Lerntagebuch-Vorlage.docx'), path.join(src, 'lt.docx'));
  fs.writeFileSync(path.join(src, 'bild.png'), 'PNG');
  fs.writeFileSync(path.join(dir, '02_expose_und_zeitplan', 'expose.md'), 'alt');
  const res = await sortieren.applyPlan(p, [
    { von: 'uebernommen/x/a.md', nach: '02_expose_und_zeitplan/expose.md' },
    { von: 'uebernommen/x/a.md', nach: '02_expose_und_zeitplan/expose.md', ersetzen: true },
    { von: 'uebernommen/x/lt.docx', nach: '06_lerntagebuch_und_konsultationen/lerntagebuch.md' },
    { von: 'uebernommen/x/notiz.txt', nach: '01_themenfindung_und_mindmap/../../../notiz.md' },
    { von: 'uebernommen/x/bild.png', nach: '01_themenfindung_und_mindmap/bild.jpg' },
    { von: 'uebernommen/x/fehlt.md', nach: '01_themenfindung_und_mindmap/fehlt.md' },
    { von: '02_expose_und_zeitplan/expose.md', nach: '01_themenfindung_und_mindmap/x.md' },
    { von: 'uebernommen/x/a.md', nach: '.facharbeit/x.md' },
  ]);
  assert.strictEqual(res[0].nach, '02_expose_und_zeitplan/expose_v2.md', 'vorhandenes Ziel bleibt, neue Fassung');
  assert.strictEqual(res[1].ersetzt, true, 'ersetzen sichert die alte Fassung');
  assert.strictEqual(fs.readFileSync(path.join(dir, res[1].version), 'utf8'), 'alt');
  assert.strictEqual(fs.readFileSync(path.join(dir, '02_expose_und_zeitplan/expose.md'), 'utf8'), '# A');
  assert.strictEqual(res[2].aktion, 'umgewandelt');
  assert.match(fs.readFileSync(path.join(dir, res[2].nach), 'utf8'), /Arbeitskopie von „lt\.docx“[\s\S]*Ziele des Lerntagebuchs/);
  assert.match(res[3].fehler, /01_ bis 08_/, 'Pfadausbruch abgelehnt');
  assert.match(res[4].fehler, /\.png lässt sich nicht als \.jpg/);
  assert.match(res[5].fehler, /nicht gefunden/);
  assert.match(res[6].fehler, /uebernommen\/ oder anhaenge\//);
  assert.match(res[7].fehler, /01_ bis 08_/);
  assert.ok(!fs.existsSync(path.join(dir, 'notiz.md')));
});

// ---------- Word-Dateien bearbeiten ----------

const word = require('../server/word');
const abgabe = require('../server/abgabe');
const LT = path.join(ROOT, 'ressourcen/vorgaben/Lerntagebuch-Vorlage.docx');

// Kleines PNG (1×1) für Bildtests
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function nummer(text, re) {
  return +(new RegExp(`^\\[(\\d+)\\] ${re}`, 'm').exec(text) || [])[1];
}

test('Word: Vorlage wird unverändert gelesen und geschrieben', () => {
  let xml = readZip(fs.readFileSync(LT)).read('word/document.xml').toString('utf8');
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);
  assert.strictEqual(word.serialize(word.parseXml(xml)), xml);
  const t = word.nummeriert(fs.readFileSync(LT), { datei: 'abgabe/lt.docx' });
  assert.match(t, /^Word-Datei: abgabe\/lt\.docx/);
  assert.match(t, /^\[\d+\] Vorname, Nachname$/m);
  assert.match(t, /^Tabelle 1 \(4 Zeilen × 3 Spalten/m);
  assert.match(t, /^\[\d+\] T1 Z1 S2: Pro$/m);
});

test('Word: ersetzen, Teiltext, einfügen, Tabellenzeile, Bild, löschen', async () => {
  const buf = fs.readFileSync(LT);
  const t = word.nummeriert(buf);
  const name = nummer(t, 'Vorname, Nachname');
  const fach = nummer(t, 'im Fach');
  const erf = nummer(t, 'Meine Erfahrungen');
  const ziele = nummer(t, 'Das sind meine drei');
  const r = await word.apply(buf, [
    { ersetzen: name, text: 'Alex Beispiel' },
    { ersetzen: fach, alt: '...', text: 'Kunst' },
    { ersetzen: erf + 1, text: 'Erster Absatz mit **fett**.\n\nZweiter Absatz.' },
    { nach: ziele, text: '1. Ziel eins\n- Punkt' },
    { zeile: 1, zellen: ['4. Ethik', 'spannend', 'viel Lesen'] },
    { bild: 'bild.png', nach: ziele, breite_cm: 5, unterschrift: 'Abb. 1: Test' },
    { loeschen: erf + 2 },
    { ersetzen: name, alt: 'gibt es nicht', text: 'x' },
    { zeile: 99, zellen: ['x'] },
  ], { bildLaden: async () => PNG });
  assert.strictEqual(r.ok, 7);
  assert.deepStrictEqual(r.results.filter((x) => x.fehler).map((x) => x.was), [`Absatz ${name} ersetzt`, 'Zeile in Tabelle 99']);
  const neu = word.nummeriert(r.buffer);
  assert.match(neu, /^\[\d+\] Alex Beispiel$/m);
  assert.match(neu, /^\[\d+\] im Fach Kunst$/m);
  assert.match(neu, /^\[\d+\] Erster Absatz mit fett\.$/m);
  assert.match(neu, /^\[\d+\] Zweiter Absatz\.$/m);
  assert.match(neu, /^\[\d+\] 1\. Ziel eins$/m);
  assert.match(neu, /^\[\d+\] – Punkt$/m);
  assert.match(neu, /^\[\d+\] T1 Z5 S3: viel Lesen$/m);
  assert.match(neu, /^\[\d+\] Abb\. 1: Test$/m);
  const z = readZip(r.buffer);
  assert.ok(z.names().some((n) => /^word\/media\/mango_bild1\.png$/.test(n)));
  assert.match(z.read('word/_rels/document.xml.rels').toString('utf8'), /Id="rIdMango1"[^>]*Target="media\/mango_bild1\.png"/);
  // Fett bleibt als Formatierung erhalten, die Datei bleibt lesbar.
  assert.match(extract.docxToText(r.buffer), /Erster Absatz mit \*\*fett\*\*\./);
  // Unbekannte Änderung und ungültige Nummern ändern nichts.
  const leer = await word.apply(buf, [{ ersetzen: 0, text: 'x' }, { foo: 1 }]);
  assert.strictEqual(leer.buffer, null);
});

test('Word: Block in der Antwort wird gelesen und entfernt', () => {
  const p = word.parseBlock('Fertig.\n\n```word\n{"datei":"abgabe\\\\lt.docx","aenderungen":[{"ersetzen":3,"text":"x"},]}\n```\n');
  assert.strictEqual(p.text, 'Fertig.');
  assert.deepStrictEqual(p.dateien, [{ datei: 'abgabe/lt.docx', neu: false, text: '', ops: [{ ersetzen: 3, text: 'x' }] }]);
  assert.strictEqual(word.parseBlock('```word\nkaputt\n```').invalid, true);
  assert.deepStrictEqual(word.imageSize(PNG), { ext: 'png', w: 1, h: 1 });
});

test('Abgabe-Dateien: angelegt, vorausgefüllt, ältere Arbeitsräume übernommen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-abgabe-'));
  try {
    const p = await Project.create(path.join(dir, 'neu'), { name: 'Alex Beispiel', klasse: 'FOS 12a', fach: 'Ethik', lehrkraft: 'Herr Lehrer' });
    assert.deepStrictEqual(p.data.abgabe, { lerntagebuch: 'abgabe/Lerntagebuch_Beispiel_Alex.docx', facharbeit: 'abgabe/Facharbeit_Beispiel_Alex.docx' });
    const lt = word.nummeriert(fs.readFileSync(path.join(p.workspace, 'abgabe', 'Lerntagebuch_Beispiel_Alex.docx')));
    assert.match(lt, /^\[\d+\] Alex Beispiel$/m);
    assert.match(lt, /^\[\d+\] Klasse: {2}FOS 12a$/m);
    assert.match(lt, /Betreuende Lehrkraft: {2}Herr Lehrer$/m);
    const fa = word.nummeriert(fs.readFileSync(path.join(p.workspace, 'abgabe', 'Facharbeit_Beispiel_Alex.docx')));
    assert.match(fa, /^\[\d+\] # 1 Einleitung$/m);
    assert.ok(!/\[Hier /.test(fa), 'Platzhalter der Kapitelvorlagen fehlen');
    assert.ok(!fs.existsSync(path.join(p.workspace, '05_facharbeit_entwurf', '02_einleitung.md')));
    // Original der Schule ist schreibgeschützt.
    if (process.platform !== 'win32') assert.strictEqual(fs.statSync(path.join(p.workspace, '00_vorgaben', 'Lerntagebuch-Vorlage.docx')).mode & 0o222, 0);
    // Gelöschte Abgabe-Datei wird nicht erneut angelegt.
    fs.unlinkSync(path.join(p.workspace, 'abgabe', 'Facharbeit_Beispiel_Alex.docx'));
    await Project.open(p.workspace);
    assert.ok(!fs.existsSync(path.join(p.workspace, 'abgabe', 'Facharbeit_Beispiel_Alex.docx')));

    // Älterer Arbeitsraum: ausgefülltes Lerntagebuch in 06_ und Kapitel in 05_ werden übernommen.
    const alt = await Project.create(path.join(dir, 'alt'), { name: 'Kim' });
    delete alt.data.abgabe;
    await alt.saveProject();
    fs.rmSync(path.join(alt.workspace, 'abgabe'), { recursive: true });
    const eigenes = (await word.apply(fs.readFileSync(LT), [{ ersetzen: nummer(word.nummeriert(fs.readFileSync(LT)), 'Vorname, Nachname'), text: 'Kim' }])).buffer;
    fs.writeFileSync(path.join(alt.workspace, '06_lerntagebuch_und_konsultationen', 'Lerntagebuch-Vorlage.docx'), eigenes);
    fs.writeFileSync(path.join(alt.workspace, '05_facharbeit_entwurf', '02_einleitung.md'), '# 1 Einleitung\n\nMein eigener Anfang.');
    const wieder = await Project.open(alt.workspace);
    assert.deepStrictEqual(wieder.data.abgabe, { lerntagebuch: 'abgabe/Lerntagebuch_Kim.docx', facharbeit: 'abgabe/Facharbeit_Kim.docx' });
    assert.ok(fs.readFileSync(path.join(alt.workspace, 'abgabe', 'Lerntagebuch_Kim.docx')).equals(eigenes));
    assert.match(word.nummeriert(fs.readFileSync(path.join(alt.workspace, 'abgabe', 'Facharbeit_Kim.docx'))), /Mein eigener Anfang\./);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Abgabe-Dateien: Namensteil wie von der Schule empfohlen', () => {
  assert.strictEqual(abgabe.namensteil('Max Muster'), 'Muster_Max');
  assert.strictEqual(abgabe.namensteil('Anna Lena Beispiel'), 'Beispiel_Anna_Lena');
  assert.strictEqual(abgabe.namensteil(''), '');
});

// ---------- Sprachprüfung (Schreib-Skills) ----------

const stil = require('../server/stil');

test('Sprachprüfung: Floskeln, Stilwörter, Geviertstrich, lange Sätze', () => {
  const grund = (t) => stil.pruefen(t).map((x) => x.grund);
  assert.deepStrictEqual(grund('In Klasse 11 habe ich eine Projektarbeit geschrieben. Ich habe zu spät angefangen.'), []);
  assert.deepStrictEqual(grund('In der heutigen Zeit spielt Energie eine entscheidende Rolle.'), ['Aufwärm-Einstieg', 'aufgeblähte Bedeutung']);
  assert.deepStrictEqual(grund('Das ist gut — sehr gut.'), ['Geviertstrich (—)']);
  assert.deepStrictEqual(grund('Er sagte "ja" dazu.'), ['englische Anführungszeichen statt „…“']);
  assert.match(grund(`${'Wort '.repeat(30)}Ende.`)[0], /Satz zu lang \(31 Wörter\)/);
  // Ein einzelnes Stilwort ist in Ordnung, gehäuft nicht.
  assert.deepStrictEqual(grund('Die Umfrage ist zudem anonym.'), []);
  assert.deepStrictEqual(grund('Die Umfrage ist zudem anonym. Das ist maßgeblich.'), ['Stilwort „zudem“', 'Stilwort „maßgeblich“']);
  // Direkte Zitate, Überschriften und Kennzeichnungen werden nicht bemängelt.
  assert.deepStrictEqual(grund('Laut Autor ist das „in der heutigen Zeit von zentraler Bedeutung“ (Müller 2020, S. 3).'), []);
  assert.deepStrictEqual(grund('# Darüber hinaus\n\n[KI-Entwurf, 24.10.2026, Claude – selbst überarbeiten]\n\nIch habe gelernt.'), []);
  assert.deepStrictEqual(grund('Studien zeigen, dass Pausen helfen (Vgl. Meyer 2021, S. 4).'), []);
  assert.deepStrictEqual(grund('Studien zeigen, dass Pausen helfen.'), ['vager Beleg ohne Kurzbeleg']);
});

test('Sprachprüfung: neuer Text aus Word-Block und Textdateien, Rückmeldung an den Assistenten', () => {
  const t = stil.textAusWord([{ datei: 'abgabe/lt.docx', ops: [{ ersetzen: 3, text: 'A.' }, { ersetzen: 4, alt: '...', text: 'FOS' }, { nach: 5, text: 'B.' }, { zeile: 1, zellen: ['C', 'D'] }] }]);
  assert.deepStrictEqual(t, [{ datei: 'abgabe/lt.docx', text: 'A.\n\nB.\n\nC. D' }]);
  assert.strictEqual(stil.neueZeilen('a\nb', 'a\nb\nc\n\nd'), 'c\nd');
  const p = stil.korrekturPrompt([{ datei: 'abgabe/lt.docx', stellen: [{ satz: 'X.', grund: 'Floskel' }] }], { 'abgabe/lt.docx': '.facharbeit/extrakte/abgabe/lt.docx.txt' });
  assert.match(p, /^Automatische Sprachprüfung/);
  assert.match(p, /abgabe\/lt\.docx \(Word: Block `word`, aktuelle Absatznummern in \.facharbeit\/extrakte\/abgabe\/lt\.docx\.txt\):\n- „X\.“ – Floskel/);
});

test('Regeln: Schreibregeln der Skills und „kurz und einfach“ werden immer mitgeschickt', () => {
  const regeln = fs.readFileSync(path.join(ROOT, 'ressourcen/regeln.md'), 'utf8');
  assert.match(regeln, /## Kurz und einfach/);
  assert.match(regeln, /## Schreibregeln \(aus den Skills `wissenschaftlich-schreiben` und `sprachpruefung`, gelten immer\)/);
  assert.match(regeln, /\*\*Pflicht:\*\* Bevor du einen Text schreibst/);
  const p = ctx.buildPrompt({ context: '<projektkontext/>', text: 'Hallo', schreibaufgabe: true });
  assert.match(p, /<schreibregeln>Wenn du dafür Text schreibst/);
  assert.ok(!/<schreibregeln>/.test(ctx.buildPrompt({ context: '', text: 'Hallo' })));
});
