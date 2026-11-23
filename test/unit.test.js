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
    assert.deepStrictEqual(st.settings.modelle, { claude: 'sonnet', antigravity: '', deepseek: '', opencodego: '' });
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
  assert.deepStrictEqual(p.dateien, [{ datei: 'abgabe/lt.docx', neu: false, ersetzen: false, aus: '', text: '', ops: [{ ersetzen: 3, text: 'x' }] }]);
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

// ---------- Abgabe-Dateien: Schreiben trotz Schreibschutz und kurzer Sperren ----------

test('Abgabe: Schreiben überwindet Schreibschutz und kurze Sperren, echte Sperren bleiben Fehler', async () => {
  const abgabe = require('../server/abgabe');
  const fsp = fs.promises;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-sperre-'));
  const echteUmbenennung = fsp.rename;
  const echtesSchreiben = fsp.writeFile;
  const tmpDateien = () => fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
  const fehler = (code) => Object.assign(new Error(`${code}: simuliert`), { code });
  try {
    const ziel = path.join(dir, 'Lerntagebuch.docx');
    // 1. Schreibgeschützte Zieldatei (z. B. eine Kopie aus uebernommen/): wird freigegeben und überschrieben.
    fs.writeFileSync(ziel, 'alt');
    fs.chmodSync(ziel, 0o444);
    await abgabe.schreiben(ziel, Buffer.from('neu1'));
    assert.strictEqual(fs.readFileSync(ziel, 'utf8'), 'neu1');
    if (process.platform !== 'win32') assert.ok(fs.statSync(ziel).mode & 0o200, 'danach beschreibbar');
    // 2. Kurze Sperre (Virenscanner, OneDrive): zwei Fehlversuche, beim dritten klappt es.
    let aufrufe = 0;
    fsp.rename = async (...a) => { aufrufe += 1; if (aufrufe <= 2) throw fehler('EPERM'); return echteUmbenennung(...a); };
    await abgabe.schreiben(ziel, Buffer.from('neu2'), { pausen: [1, 1, 1] });
    assert.strictEqual(aufrufe, 3);
    assert.strictEqual(fs.readFileSync(ziel, 'utf8'), 'neu2');
    // 3. Umbenennen geht nie, direktes Überschreiben schon.
    fsp.rename = async () => { throw fehler('EBUSY'); };
    await abgabe.schreiben(ziel, Buffer.from('neu3'), { pausen: [1] });
    assert.strictEqual(fs.readFileSync(ziel, 'utf8'), 'neu3');
    assert.deepStrictEqual(tmpDateien(), [], 'keine Reste');
    // 4. Datei wirklich gesperrt (auch das direkte Schreiben scheitert): Der Fehler geht weiter, Inhalt unverändert, nichts bleibt liegen.
    fsp.writeFile = async (p, ...r) => { if (p === ziel) throw fehler('EBUSY'); return echtesSchreiben(p, ...r); };
    await assert.rejects(abgabe.schreiben(ziel, Buffer.from('neu4'), { pausen: [1] }), (e) => e.code === 'EBUSY');
    assert.strictEqual(fs.readFileSync(ziel, 'utf8'), 'neu3');
    assert.deepStrictEqual(tmpDateien(), []);
    // 5. Andere Fehler werden nicht wiederholt.
    fsp.writeFile = echtesSchreiben;
    aufrufe = 0;
    fsp.rename = async () => { aufrufe += 1; throw fehler('ENOENT'); };
    await assert.rejects(abgabe.schreiben(ziel, Buffer.from('neu5'), { pausen: [1, 1, 1] }), (e) => e.code === 'ENOENT');
    assert.strictEqual(aufrufe, 1);
  } finally {
    fsp.rename = echteUmbenennung;
    fsp.writeFile = echtesSchreiben;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Abgabe: „gerade geöffnet“ nur bei Sperrdatei von Word, sonst ehrlicher Hinweis; Sicherung kippt die Meldung nicht', async () => {
  const abgabe = require('../server/abgabe');
  const fsp = fs.promises;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-sperre2-'));
  const echteUmbenennung = fsp.rename;
  const echtesSchreiben = fsp.writeFile;
  const echteSicherung = wsLib.saveVersion;
  try {
    const p = await Project.create(path.join(dir, 'neu'), { name: 'Alex Beispiel' });
    const rel = 'abgabe/Lerntagebuch_Beispiel_Alex.docx';
    const abs = path.join(p.workspace, ...rel.split('/'));
    const ops = () => [{ ersetzen: nummer(word.nummeriert(fs.readFileSync(abs)), 'Alex Beispiel'), text: 'Kim' }];
    const gesperrt = () => { const e = Object.assign(new Error('EPERM: simuliert'), { code: 'EPERM' }); throw e; };
    fsp.rename = async () => gesperrt();
    fsp.writeFile = async (pfad, ...r) => { if (pfad === abs) gesperrt(); return echtesSchreiben(pfad, ...r); };
    // Keine Sperrdatei von Word: Die App behauptet nicht, die Datei sei geöffnet.
    let [r] = await abgabe.anwenden(p, [{ datei: rel, ops: ops() }]);
    assert.strictEqual(r.gesperrt, true);
    assert.strictEqual(r.ok, 0);
    assert.match(r.hinweis, /Windows lässt das Überschreiben der Datei nicht zu \(EPERM\)/);
    assert.ok(!/gerade geöffnet/.test(r.hinweis), 'ohne Sperrdatei kein „geöffnet“');
    assert.match(r.hinweis, /Erneut eintragen/);
    // Mit Sperrdatei (Word hat die Datei offen): die bekannte Meldung. Word nennt sie „~$“ plus Name ab dem dritten Zeichen.
    fs.writeFileSync(path.join(path.dirname(abs), `~$${path.basename(abs).slice(2)}`), '');
    [r] = await abgabe.anwenden(p, [{ datei: rel, ops: ops() }]);
    assert.match(r.hinweis, /^Die Datei ist gerade geöffnet \(z\. B\. in Word\)\. Schließe sie/);
    assert.strictEqual(await abgabe.inWordOffen(abs), true);
    fs.unlinkSync(path.join(path.dirname(abs), `~$${path.basename(abs).slice(2)}`));
    assert.strictEqual(await abgabe.inWordOffen(abs), false);
    // Läuft alles, ist es eingetragen, auch wenn die Sicherung der alten Fassung scheitert.
    fsp.rename = echteUmbenennung;
    fsp.writeFile = echtesSchreiben;
    wsLib.saveVersion = async () => { throw Object.assign(new Error('EACCES: simuliert'), { code: 'EACCES' }); };
    [r] = await abgabe.anwenden(p, [{ datei: rel, ops: ops() }]);
    assert.strictEqual(r.ok, 1);
    assert.ok(!r.gesperrt && !r.hinweis, 'eingetragen, keine Fehlermeldung');
    assert.match(word.nummeriert(fs.readFileSync(abs)), /^\[\d+\] Kim$/m, 'die Änderung steht in der Datei');
  } finally {
    fsp.rename = echteUmbenennung;
    fsp.writeFile = echtesSchreiben;
    wsLib.saveVersion = echteSicherung;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Arbeitsdateien: schreibgeschützte Kopien werden beim Öffnen freigegeben, Originale bleiben geschützt', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-frei-'));
  try {
    await Project.create(dir, { name: 'Test' });
    const lege = (rel) => { const f = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'x'); fs.chmodSync(f, 0o444); return f; };
    const arbeit = [lege('abgabe/Lerntagebuch_Test.docx'), lege('02_expose_und_zeitplan/expose.md'), lege('06_lerntagebuch_und_konsultationen/lt.docx')];
    const original = [lege('uebernommen/2026-01-01_0000/Aufsatz.docx'), lege('00_vorgaben/Handreichung.pdf'), lege('anhaenge/2026-01-01/foto.png')];
    const n = await wsLib.arbeitsdateienFreigeben(dir);
    if (process.platform !== 'win32') {
      assert.ok(n >= 3);
      for (const f of arbeit) assert.ok(fs.statSync(f).mode & 0o200, `${path.relative(dir, f)} ist beschreibbar`);
      for (const f of original) assert.strictEqual(fs.statSync(f).mode & 0o222, 0, `${path.relative(dir, f)} bleibt schreibgeschützt`);
    }
    // Beim Öffnen des Arbeitsraums geschieht das von selbst.
    fs.chmodSync(arbeit[0], 0o444);
    await wsLib.syncManagedFiles(dir);
    if (process.platform !== 'win32') assert.ok(fs.statSync(arbeit[0]).mode & 0o200, 'auch beim Öffnen');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- Sprachprüfung (Schreib-Skills) ----------

const stil = require('../server/stil');

test('Sprachprüfung (Scan von ai-tell-audit): Muster, Form, Rhythmus, Belege', () => {
  const grund = (t) => stil.pruefen(t).map((x) => x.grund).sort();
  assert.deepStrictEqual(grund('In Klasse 11 habe ich eine Projektarbeit geschrieben. Ich habe zu spät angefangen.'), []);
  assert.deepStrictEqual(grund('In der heutigen Zeit spielt Energie eine entscheidende Rolle.'), ['Aufwärm-Einstieg', 'aufgeblähte Bedeutung']);
  assert.deepStrictEqual(grund('Das ist gut — sehr gut.'), ['Geviertstrich (—): Komma, Punkt, Doppelpunkt oder Klammer']);
  assert.deepStrictEqual(grund('Er sagte "ja" dazu.'), ['englische Anführungszeichen statt „…“']);
  assert.deepStrictEqual(grund('Das ist nicht nur schnell, sondern auch billig.'), ['„nicht nur …, sondern auch“']);
  // Ein einzelnes Stilwort ist in Ordnung, gehäuft nicht.
  assert.deepStrictEqual(grund('Die Umfrage ist zudem anonym.'), []);
  assert.deepStrictEqual(grund('Die Umfrage ist zudem anonym. Das ist maßgeblich.'), ['Stilwort „maßgeblich“', 'Stilwort „zudem“']);
  // Direkte Zitate, Überschriften und Kennzeichnungen werden nicht bemängelt.
  assert.deepStrictEqual(grund('Laut Autor ist das „in der heutigen Zeit von zentraler Bedeutung“ (Müller 2020, S. 3).'), []);
  assert.deepStrictEqual(grund('# Darüber hinaus\n\n[KI-Entwurf, 24.10.2026, Claude – selbst überarbeiten]\n\nIch habe gelernt.'), []);
  assert.deepStrictEqual(grund('Studien zeigen, dass Pausen helfen (Vgl. Meyer 2021, S. 4).'), []);
  assert.deepStrictEqual(grund('Studien zeigen, dass Pausen helfen.'), ['vager Beleg ohne Quelle']);
  // Rhythmus betrifft den ganzen Text (Stelle ohne Satz) und braucht mindestens fünf Sätze.
  const flach = stil.pruefen('Der Hund läuft schnell. '.repeat(8));
  assert.ok(flach.some((x) => x.satz === '' && /Satzlängen zu gleichförmig/.test(x.grund)));
  assert.ok(flach.some((x) => x.satz === '' && /8 Sätze beginnen mit „der“/.test(x.grund)));
  assert.deepStrictEqual(stil.pruefen('Der Hund läuft schnell. Der Hund bellt laut.'), []);
  // Lange Sätze sind für sich kein Befund mehr: Entscheidend ist der Wechsel (Skill human-voice).
  assert.deepStrictEqual(grund(`${'Wort '.repeat(30)}Ende.`), []);
  // Auswertung: Überarbeitung lohnt bei harten Treffern, mindestens drei Stellen oder dem Urteil des Scans.
  assert.strictEqual(stil.bewerten('Ich habe gestern gemessen. Das Ergebnis war klar.').schwer, false);
  assert.strictEqual(stil.bewerten('Gerne! Hier ist dein Text.').schwer, true, 'harter Treffer');
  assert.strictEqual(stil.bewerten('Darüber hinaus ist das gut.').schwer, false, 'ein Hinweis allein genügt nicht');
  const ki = stil.bewerten('In der heutigen Welt spielt KI eine entscheidende Rolle. Darüber hinaus ermöglicht sie nahtlose Prozesse. Zusammenfassend lässt sich sagen, dass es ein Meilenstein ist.');
  assert.strictEqual(ki.schwer, true);
  assert.match(ki.urteil, /reads as AI/);
});

test('Sprachprüfung: neuer Text aus Word-Block und Textdateien, Rückmeldung an den Assistenten', () => {
  const t = stil.textAusWord([{ datei: 'abgabe/lt.docx', ops: [{ ersetzen: 3, text: 'A.' }, { ersetzen: 4, alt: '...', text: 'FOS' }, { nach: 5, text: 'B.' }, { zeile: 1, zellen: ['C', 'D'] }] }]);
  assert.deepStrictEqual(t, [{ datei: 'abgabe/lt.docx', text: 'A.\n\nB.\n\nC. D' }]);
  assert.strictEqual(stil.neueZeilen('a\nb', 'a\nb\nc\n\nd'), 'c\nd');
  const p = stil.korrekturPrompt([{ datei: 'abgabe/lt.docx', stellen: [{ satz: 'X.', grund: 'Floskel' }] }], { 'abgabe/lt.docx': '.facharbeit/extrakte/abgabe/lt.docx.txt' });
  assert.match(p, /^Mango hat den Scan von `ai-tell-audit` auf deinen gerade eingetragenen Text angewendet/);
  assert.match(p, /abgabe\/lt\.docx \(Word: Block `word`, aktuelle Absatznummern in \.facharbeit\/extrakte\/abgabe\/lt\.docx\.txt\):\n- „X\.“ – Floskel/);
});

test('Regeln: Schreibregeln der Skills und „kurz und einfach“ werden immer mitgeschickt', () => {
  const regeln = fs.readFileSync(path.join(ROOT, 'ressourcen/regeln.md'), 'utf8');
  assert.match(regeln, /## Kurz und einfach/);
  assert.match(regeln, /## Schreibregeln \(Skills `human-voice`, `humanize-rewrite`, `ai-tell-audit`, gelten immer\)/);
  assert.match(regeln, /\*\*Pflicht:\*\* Für jeden Text, den du schreibst/);
  const p = ctx.buildPrompt({ context: '<projektkontext/>', text: 'Hallo', schreibaufgabe: true });
  assert.match(p, /<schreibregeln>Ablauf bei jedem Text.*human-voice.*humanize-rewrite.*ai-tell-audit/);
  assert.ok(!/<schreibregeln>/.test(ctx.buildPrompt({ context: '', text: 'Hallo' })));
  // Die Erinnerung „wie ein Mensch schreiben“ kommt bei jeder Nachricht, auch wenn keine Schreibaufgabe erkannt wird („im chat“).
  for (const text of ['im chat', 'Hallo', 'Und jetzt?']) assert.match(ctx.buildPrompt({ context: '', text }), /<menschlich>.*Schreib-Skills.*wie ein Mensch.*Erkennungsprogramme/, `bei „${text}“`);
  assert.match(ctx.buildPrompt({ context: '', text: 'Hallo' }), /<antwortstil>.*höchstens drei kurze Sätze/, 'Antwortstil steht bei jeder Nachricht');
  // Die Kürze-Regel gilt für das Gespräch, nicht für bestellte Texte: Sonst schreiben kleine Modelle lauter gleich kurze Sätze.
  const stilHinweis = /<antwortstil>([^<]*)<\/antwortstil>/.exec(ctx.buildPrompt({ context: '', text: 'im chat' }))[1];
  assert.match(stilHinweis, /^Deine Antworten im Gespräch[\s\S]*Das gilt nicht für Texte, die du für die Person schreibst[\s\S]*nicht aus lauter gleich kurzen Sätzen/);
  assert.match(regeln, /Das gilt nicht für Texte, die du für die Person schreibst\*\* \(Entwurf, Absatz, Mail, Lerntagebuch-Eintrag, auch wenn er im Chat steht\)/);
  // Die Facharbeit gehört der Person: Bei jeder Nachricht steht der Auftrag, nichts zu verweigern, außer zwei Dingen.
  for (const text of ['im chat', 'Schreib mir ein Kapitel']) assert.match(ctx.buildPrompt({ context: '', text }), /<auftrag>Die Facharbeit gehört der Person[^<]*ohne Ablehnung, Belehrung[^<]*Nur zwei Dinge tust du nie: Quellen, Zitate oder Zahlen erfinden und schreiben, dass keine KI genutzt wurde\.<\/auftrag>/);
});

// ---------- Schreib-Skills (Paket human-voice, humanize-rewrite, ai-tell-audit) ----------

const schreibskills = require('../server/schreibskills');
const wsLib = require('../server/workspace');
const SKILL_NAMEN = ['human-voice', 'humanize-rewrite', 'ai-tell-audit'];
const PAKET = path.join(ROOT, 'Facharbeit angaben und vorlagen etc', 'Humanize skills');

test('Schreib-Skills: Pflicht = Schreiben oder Umschreiben + Prüfung, bei DeepSeek zusätzlich der Scan', () => {
  const g = (...n) => new Set(n);
  const namen = (set, anbieter) => schreibskills.fehlend(set, anbieter).map((a) => a.id);
  assert.deepStrictEqual(namen(g()), ['schreiben', 'pruefung']);
  assert.deepStrictEqual(namen(g('human-voice', 'ai-tell-audit')), []);
  assert.deepStrictEqual(namen(g('humanize-rewrite', 'ai-tell-audit')), [], 'Umschreiben statt neuem Text genügt');
  assert.deepStrictEqual(namen(g('human-voice', 'humanize-rewrite')), ['pruefung'], 'ohne Prüfung unvollständig');
  assert.deepStrictEqual(namen(g('ai-tell-audit')), ['schreiben'], 'ohne Schreib-Skill unvollständig');
  assert.deepStrictEqual(namen(g('stimmenprofil', 'natuerlich-schreiben', 'stilrevision', 'textpruefung', 'wissenschaftlich-schreiben', 'sprachpruefung')), ['schreiben', 'pruefung'], 'alte Skills zählen nicht mehr');
  // DeepSeek hat kein Terminal: Der Scan läuft über das Werkzeug und muss wirklich aufgerufen werden.
  assert.deepStrictEqual(namen(g(...SKILL_NAMEN), 'deepseek'), ['scan']);
  assert.deepStrictEqual(namen(g(...SKILL_NAMEN, 'ai_tell_scan'), 'deepseek'), []);
  assert.deepStrictEqual(namen(g(...SKILL_NAMEN, 'ai_tell_scan')), [], 'für die anderen Anbieter scannt Mango selbst');
  assert.deepStrictEqual(schreibskills.geladene(g('ai-tell-audit', 'x', 'human-voice', 'ai_tell_scan')), ['human-voice', 'ai-tell-audit'], 'feste Reihenfolge, nur Schreib-Skills');
  assert.deepStrictEqual(schreibskills.geladene(g('ai-tell-audit', 'ai_tell_scan'), 'deepseek'), ['ai-tell-audit', 'ai_tell_scan']);
});

test('Schreib-Skills: Paket ist vollständig, unverändert und ohne Reste der alten Skills in der App', () => {
  for (const name of SKILL_NAMEN) {
    const dir = path.join(ROOT, 'ressourcen', 'skills', name);
    const skill = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`), `${name}: Frontmatter steht am Dateianfang`);
    assert.ok(skill.includes('mango-facharbeit:verwaltet'), `${name}: von der App verwaltet`);
  }
  // Inhalt entspricht den gelieferten Dateien (nur die Verwaltungszeile ist neu).
  const ohneVermerk = (s) => s.replace(/\n<!-- mango-facharbeit:verwaltet[^\n]*-->\n/, '');
  assert.strictEqual(ohneVermerk(fs.readFileSync(path.join(ROOT, 'ressourcen/skills/human-voice/SKILL.md'), 'utf8')), fs.readFileSync(path.join(PAKET, 'SKILL-1.md'), 'utf8'));
  assert.strictEqual(ohneVermerk(fs.readFileSync(path.join(ROOT, 'ressourcen/skills/ai-tell-audit/SKILL.md'), 'utf8')), fs.readFileSync(path.join(PAKET, 'SKILL-3.md'), 'utf8'));
  const py = path.join(ROOT, 'ressourcen/skills/ai-tell-audit/scripts/ai_tell_scan.py');
  assert.strictEqual(fs.readFileSync(py, 'utf8'), fs.readFileSync(path.join(PAKET, 'ai_tell_scan.py'), 'utf8'), 'Skript unverändert');
  // Der Prüf-Skill verweist auf das Umschreiben, der Schreib-Skill auf die Prüfung: Beides gibt es.
  assert.match(fs.readFileSync(path.join(ROOT, 'ressourcen/skills/ai-tell-audit/SKILL.md'), 'utf8'), /humanize-rewrite skill/);
  assert.match(fs.readFileSync(path.join(ROOT, 'ressourcen/skills/humanize-rewrite/SKILL.md'), 'utf8'), /Run the ai-tell-audit skill/);
  // Die Regeln nennen alle drei Skills; alte Namen kommen nirgends in der App vor (außer in der Liste der veralteten).
  const regeln = fs.readFileSync(path.join(ROOT, 'ressourcen/regeln.md'), 'utf8');
  for (const name of SKILL_NAMEN) assert.ok(regeln.includes(`\`${name}\``), `regeln.md nennt ${name}`);
  const dateien = [];
  const sammle = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) sammle(f); else if (/\.(js|md|json|html|yml|py)$/.test(e.name)) dateien.push(f); } };
  for (const d of ['server', 'public', 'ressourcen', 'electron']) sammle(path.join(ROOT, d));
  for (const f of dateien) {
    if (['schreibskills.js', 'HERKUNFT.md'].includes(path.basename(f))) continue; // dürfen den Wechsel nennen
    const inhalt = fs.readFileSync(f, 'utf8');
    for (const alt of schreibskills.VERALTET) assert.ok(!inhalt.includes(alt), `${path.relative(ROOT, f)} nennt noch den alten Skill ${alt}`);
    for (const alt of ['voice_profile', 'voice_import', 'humanize_scan', 'humanize_rewrite', 'voice_score', 'voice_rewrite']) assert.ok(!inhalt.includes(alt), `${path.relative(ROOT, f)} nennt noch das alte Werkzeug ${alt}`);
  }
  for (const alt of schreibskills.VERALTET) assert.ok(!fs.existsSync(path.join(ROOT, 'ressourcen/skills', alt)), alt);
  assert.ok(!fs.existsSync(path.join(ROOT, 'ressourcen/deepseek')) && !fs.existsSync(path.join(ROOT, 'server/stimme.js')), 'die eigene DeepSeek-Anleitung und das Stimmenprofil-Modul sind entfernt');
});

test('Schreib-Skills: bestehende Arbeitsräume bekommen die neuen und verlieren die alten (eigene Dateien bleiben)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-skills-'));
  await Project.create(dir, { name: 'Test' });
  await wsLib.syncManagedFiles(dir);
  // Zustand einer älteren App-Version: verwaltete alte Skills liegen im Arbeitsraum.
  for (const root of ['.agents', '.claude']) {
    for (const alt of schreibskills.VERALTET) {
      fs.mkdirSync(path.join(dir, root, 'skills', alt, 'scripts'), { recursive: true });
      fs.writeFileSync(path.join(dir, root, 'skills', alt, 'SKILL.md'), `---\nname: ${alt}\n---\n<!-- ${wsLib.MARKER} -->\nalt`);
      fs.writeFileSync(path.join(dir, root, 'skills', alt, 'scripts', 'x.py'), 'print(1)');
    }
  }
  // Ein alter Skill, den die Person selbst angelegt hat (ohne Verwaltungsvermerk), bleibt.
  fs.writeFileSync(path.join(dir, '.claude', 'skills', 'sprachpruefung', 'SKILL.md'), '---\nname: sprachpruefung\n---\nMeine eigene Fassung');
  await wsLib.syncManagedFiles(dir);
  for (const root of ['.agents', '.claude']) {
    for (const alt of schreibskills.VERALTET.filter((n) => n !== 'sprachpruefung')) assert.ok(!fs.existsSync(path.join(dir, root, 'skills', alt)), `${root}: verwalteter alter Skill ${alt} entfernt`);
    for (const name of SKILL_NAMEN) assert.ok(fs.existsSync(path.join(dir, root, 'skills', name, 'SKILL.md')), `${root}: ${name} vorhanden`);
    assert.ok(fs.existsSync(path.join(dir, root, 'skills', 'ai-tell-audit', 'scripts', 'ai_tell_scan.py')), `${root}: Scan-Skript liegt beim Prüf-Skill`);
  }
  assert.ok(!fs.existsSync(path.join(dir, '.agents', 'skills', 'sprachpruefung')));
  assert.match(fs.readFileSync(path.join(dir, '.claude', 'skills', 'sprachpruefung', 'SKILL.md'), 'utf8'), /Meine eigene Fassung/, 'Datei der Person bleibt');
  // Die Skill-Datei beginnt mit dem Frontmatter, damit Claude Code sie erkennt.
  assert.match(fs.readFileSync(path.join(dir, '.claude', 'skills', 'human-voice', 'SKILL.md'), 'utf8'), /^---\nname: human-voice\n/);
});

test('Schreib-Skills: Wortlaut steht vollständig und zuerst in den Regeln', async () => {
  const text = await wsLib.regelnText();
  const titel = text.indexOf(schreibskills.BLOCK_TITEL);
  assert.ok(titel > 0, 'Abschnitt mit dem Wortlaut vorhanden');
  assert.ok(titel < text.indexOf('## Kurz und einfach'), 'steht vor allen anderen Regeln');
  // Ganz oben: die oberste Regel „immer wie ein Mensch schreiben“, dann der Wortlaut, erst danach die Rolle.
  const oberste = text.indexOf('## Oberste Regel: Schreib immer wie ein Mensch');
  assert.ok(oberste > 0 && oberste < titel, 'oberste Regel steht vor dem Wortlaut der Skills');
  assert.ok(text.indexOf('## Deine Rolle') > titel, 'die Rolle kommt erst nach den Skills');
  assert.ok(text.slice(0, titel).length < 3800, 'vor dem Wortlaut stehen nur die kurzen obersten Regeln');
  assert.match(text.slice(oberste, titel), /immer[\s\S]*Mensch[\s\S]*Schreib-Skills[\s\S]*Erkennungsprogramme/);
  assert.match(text.slice(-900), /## Zum Schluss: bei jeder Antwort[\s\S]*wie ein Mensch/, 'Erinnerung am Ende der Regeln');
  assert.ok(!text.includes(schreibskills.PLATZHALTER), 'Platzhalter ist ersetzt');
  assert.ok(!text.includes('mango-facharbeit:verwaltet'), 'Verwaltungszeile der Skills steht nicht im Systemprompt');
  // Alle drei Skills in der Reihenfolge Schreiben, Umschreiben, Prüfen, jeweils vollständig und ohne Kopfblock.
  let pos = titel;
  for (const name of schreibskills.REIHENFOLGE) {
    const i = text.indexOf(`### Skill \`${name}\``, pos);
    assert.ok(i > pos, `${name} in der richtigen Reihenfolge`);
    pos = i;
    let original = fs.readFileSync(path.join(ROOT, 'ressourcen/skills', name, 'SKILL.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').replace(/<!--[^>]*-->\n?/, '').trim();
    if (name === 'ai-tell-audit') original = original.replace(/\n## Scan script[\s\S]*$/, '').trim(); // das Skript selbst steht nicht im Prompt
    assert.ok(text.includes(original), `${name}: Wortlaut vollständig und unverändert`);
  }
  assert.ok(!/^name: (human-voice|humanize-rewrite|ai-tell-audit)$/m.test(text), 'kein Kopfblock der Skills');
  assert.ok(!text.includes('import statistics') && !text.includes('PHRASES = ['), 'das Python-Skript steht nicht im Prompt');
  assert.ok(text.length > 30000, 'ist lang genug, um Windows-Kommandozeilen zu sprengen: muss als Datei gehen');
  // Die Datei im Arbeitsraum enthält denselben Text (für Claude als Datei, für Antigravity als always-on-Regel).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-regeln-'));
  await Project.create(dir, { name: 'Test' });
  await wsLib.syncManagedFiles(dir);
  assert.ok(fs.readFileSync(path.join(dir, '.facharbeit', 'regeln.md'), 'utf8').includes(schreibskills.BLOCK_TITEL));
  assert.ok(fs.readFileSync(path.join(dir, '.agents', 'rules', 'mango-facharbeit.md'), 'utf8').includes('### Skill `ai-tell-audit`'));
});

test('Claude-Anbindung: lange Regeln gehen als Datei, kurze als Argument', async () => {
  const claude = require('../server/providers/claude');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-cl-'));
  const log = path.join(dir, 'calls.ndjson');
  const bin = path.join(ROOT, 'test', 'fixtures', 'bin', 'claude');
  const info = { bin, caps: { appendPrompt: true, appendFile: true, partial: true, allowedTools: true } };
  const alt = process.env.FAKE_LOG;
  process.env.FAKE_LOG = log;
  try {
    const lauf = (rulesText) => claude.run(info, { cwd: dir, prompt: 'Hallo', rulesText, rulesFile: path.join(dir, 'regeln.md'), sessionId: 's1', onEvent: () => {} }).done;
    await lauf('x'.repeat(30000));
    await lauf('Kurze Regeln');
  } finally { if (alt === undefined) delete process.env.FAKE_LOG; else process.env.FAKE_LOG = alt; }
  const [lang, kurz] = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l).args);
  assert.ok(lang.includes('--append-system-prompt-file') && lang.includes(path.join(dir, 'regeln.md')), 'lange Regeln als Datei');
  assert.ok(!lang.includes('--append-system-prompt'), 'nicht zusätzlich als Argument');
  assert.ok(!lang.some((a) => a.length > 1000), 'kein langes Argument auf der Kommandozeile');
  assert.strictEqual(kurz[kurz.indexOf('--append-system-prompt') + 1], 'Kurze Regeln', 'kurze Regeln als Argument');
});

// ---------- Scan (Skill ai-tell-audit): Nachbau von ai_tell_scan.py und DeepSeek-Werkzeug ----------

const aitell = require('../server/aitell');
const EIGEN = 'Ich habe am Montag zuerst die Quellen gesammelt. Das war mühsam. In der SLUB fand ich zwei Bücher zum Thema, eins davon war leider ausgeliehen. Danach schrieb ich die Fragen für die Umfrage, weil ich bis Freitag fertig sein will.\n\nIch glaube, die Umfrage wird gut, aber ich bin mir nicht sicher, ob 40 Leute reichen. Frau Meier meinte, das geht. Nächste Woche werte ich aus.';
const KI_TEXT = 'In der heutigen Zeit spielt Nachhaltigkeit eine entscheidende Rolle. Darüber hinaus ist es wichtig zu beachten, dass Unternehmen innovative Lösungen entwickeln. Zudem unterstreicht dies die Bedeutung von Bildung, Forschung und Zusammenarbeit. Somit lässt sich festhalten, dass Nachhaltigkeit ein zentrales Thema ist.\n\nZusammenfassend lässt sich sagen, dass die Zukunft nicht nur Chancen, sondern auch Herausforderungen bringt — und das ist ein Meilenstein. Gerne helfe ich weiter.';

test('Scan: Kennzahlen, Treffer und Bericht entsprechen dem Skript ai_tell_scan.py', () => {
  const r = aitell.scan(KI_TEXT);
  assert.strictEqual(r.lang, 'de');
  assert.ok(r.hits.some((h) => h.label === 'DE significance inflation'));
  assert.ok(r.hits.some((h) => h.label === 'chatbot leftovers' && h.hart));
  assert.strictEqual(r.em, 1);
  assert.match(r.urteil, /reads as AI/);
  const b = aitell.bericht(r);
  assert.match(b, /^Words: \d+ \| sentences: \d+ \| paragraphs: 2 \| language guess: de\n\nRHYTHM\n/);
  assert.match(b, /FORMATTING\n  em dashes: 1 /);
  assert.match(b, /unspaced em dash in German text/);
  assert.match(b, /PATTERN HITS: \d+[\s\S]*VERDICT: reads as AI, rewrite rather than patch$/);
  assert.match(aitell.bericht(aitell.scan(EIGEN)), /VERDICT: reads clean/);
  assert.deepStrictEqual(aitell.scan(KI_TEXT).hits, aitell.scan(KI_TEXT).hits, 'deterministisch');
  // Leere Eingabe bricht nicht ab.
  assert.match(aitell.bericht(aitell.scan('')), /Words: 1 \| sentences: 0/);
  // Satz um eine Fundstelle.
  assert.strictEqual(aitell.satzUm('Eins. Das ist gut — sehr. Drei.', 14), 'Das ist gut — sehr.');
});

test('Scan: JavaScript-Fassung gibt dieselbe Ausgabe wie das Python-Skript (wenn Python vorhanden ist)', () => {
  const { spawnSync } = require('child_process');
  const py = path.join(ROOT, 'ressourcen/skills/ai-tell-audit/scripts/ai_tell_scan.py');
  const probe = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['--version']);
  if (probe.error || probe.status !== 0) return; // ohne Python nichts zu vergleichen
  const bin = process.platform === 'win32' ? 'python' : 'python3';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-scan-'));
  const proben = {
    ki: KI_TEXT,
    eigen: EIGEN,
    en: 'In today\'s fast-paced world, it\'s not just about speed, it\'s about quality. Furthermore, this seamless solution plays a crucial role, highlighting the vibrant landscape. The result? A pivotal moment. Certainly! I hope this helps. [Your Name]',
    format: 'Alles gut — wirklich.\n\n- **Effizienz:** Es geht schneller.\n- **Qualität:** Es wird besser.\n\n## Fazit\n\nDies unterstreicht die Bedeutung. "Englische" Anführungszeichen. 😀',
    flach: 'Der Satz ist kurz. '.repeat(9),
    kurz: 'Hallo Welt.',
    leer: '',
  };
  for (const [name, text] of Object.entries(proben)) {
    const datei = path.join(dir, `${name}.txt`);
    fs.writeFileSync(datei, text, 'utf8');
    const r = spawnSync(bin, ['-I', py, datei], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(aitell.bericht(aitell.scan(text)).trimEnd(), r.stdout.replace(/\r\n/g, '\n').trimEnd(), `Probe „${name}“`);
  }
});

test('DeepSeek-Werkzeug ai_tell_scan: Text oder Datei, Bericht mit Stellen, klare Fehler', async () => {
  const { Werkzeuge, DEFINITIONEN } = require('../server/providers/werkzeuge');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-scanwz-'));
  fs.mkdirSync(path.join(dir, '01_themenfindung_und_mindmap'));
  fs.writeFileSync(path.join(dir, '01_themenfindung_und_mindmap', 'text.md'), KI_TEXT);
  const w = new Werkzeuge(dir);
  const lauf = (args) => w.ausfuehren('ai_tell_scan', args);
  assert.deepStrictEqual(DEFINITIONEN.map((d) => d.name), ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'WebFetch', 'ai_tell_scan'], 'keine Stimmenprofil-Werkzeuge mehr');
  assert.ok(!/human-voice|humanize|ai-tell/.test(DEFINITIONEN.find((d) => d.name === 'Skill').description));
  const a = await lauf({ text: KI_TEXT });
  assert.match(a, /^Words: \d+ \| sentences: \d+[\s\S]*VERDICT: reads as AI[\s\S]*Stellen zum Prüfen[\s\S]*„Gerne helfe ich weiter\.“ – Chatbot-Rest \(ändern\)/);
  assert.strictEqual(await lauf({ datei: '01_themenfindung_und_mindmap/text.md' }), a, 'Datei und Text geben dasselbe');
  assert.match(await lauf({ text: EIGEN }), /VERDICT: reads clean[\s\S]*- keine/);
  assert.match(await lauf({ text: '  ' }), /^Fehler: Der Text fehlt/);
  assert.match(await lauf({ datei: 'gibt-es-nicht.md' }), /^Fehler: Datei „gibt-es-nicht\.md“ nicht gefunden/);
  assert.match(await lauf({ datei: '../draussen.md' }), /^Fehler:/, 'nur im Arbeitsraum');
});

test('Regeln: Die Facharbeit gehört der Person, die KI weicht nicht aus und lehnt nicht ab', async () => {
  for (const variante of ['standard', 'deepseek']) {
    const text = await wsLib.regelnText(variante);
    const gehoert = text.indexOf('## Die Facharbeit gehört der Person');
    const erster = text.indexOf(schreibskills.BLOCK_TITEL);
    assert.ok(text.indexOf('## Oberste Regel') < gehoert && gehoert < erster, `${variante}: steht ganz oben, vor der Schreib-Anleitung`);
    const abschnitt = text.slice(gehoert, erster);
    assert.match(abschnitt, /Es ist nicht deine Facharbeit, sondern die der Person\. Sie entscheidet[\s\S]*trägt die Verantwortung/);
    assert.match(abschnitt, /Mach es direkt und vollständig, auch ganze Kapitel/);
    assert.match(abschnitt, /Lehne nichts ab[\s\S]*kein „schreib das besser selbst“/);
    assert.match(abschnitt, /schreib mit einer Lücke/);
    // Genau zwei Ausnahmen, die der Person schaden würden.
    assert.match(abschnitt, /Nur zwei Dinge tust du auch auf Wunsch nicht[\s\S]*erfindest keine Quellen, Zitate, Zahlen oder Studien[\s\S]*schreibst nie, dass keine KI genutzt wurde/);
    // Die Formulierungen, die zum Ausweichen oder Ablehnen führten, sind weg.
    assert.ok(!text.includes('Schreib nicht ungefragt ganze Kapitel'), `${variante}: kein Ausweichen auf Gliederungen`);
    assert.ok(!text.includes('selbst verteidigen kann und die Schulregeln'), `${variante}: kein Erziehungsauftrag in der Rolle`);
    assert.ok(!text.includes('Fördere den Eigenanteil'));
    assert.match(text, /Schreib, was die Person verlangt, auch ganze Kapitel/);
    assert.match(text, /Verweigere den Eintrag nicht/);
    // Was bleibt: der KI-Vermerk der Schule und das Verbot erfundener Quellen.
    assert.match(text, /Erfinde nie Quellen, Zitate, Seitenzahlen, Studien, Statistiken oder URLs/);
    assert.match(text, /Du schreibst nie, dass keine KI genutzt wurde/);
    assert.match(text, /\[KI-Entwurf, TT\.MM\.JJJJ, Anbieter – selbst überarbeiten\]/);
  }
});

test('Regeln je Anbieter: beide bekommen die drei Skills, nur der Scan läuft verschieden', async () => {
  const std = await wsLib.regelnText('standard');
  const ds = await wsLib.regelnText('deepseek');
  for (const text of [std, ds]) {
    assert.ok(!/<!--\/?NUR/.test(text), 'keine Reste der Anbieter-Blöcke');
    assert.ok(!text.includes(schreibskills.PLATZHALTER));
    assert.ok(text.indexOf('## Oberste Regel: Schreib immer wie ein Mensch') < text.indexOf('## Kurz und einfach'), 'oberste Regel steht vorn');
    assert.ok(text.includes(schreibskills.BLOCK_TITEL) && text.includes('### Skill `human-voice`') && text.includes('### Skill `humanize-rewrite`') && text.includes('### Skill `ai-tell-audit`'));
    assert.ok(text.includes('## Schreibregeln') && text.includes('## Quellen und Recherche') && text.includes('## Word-Dateien bearbeiten'), 'gemeinsame Regeln sind in beiden Varianten');
    assert.ok(!/stimmenprofil|natuerlich-schreiben|stilrevision|textpruefung|voice_profile|humanize_scan/.test(text), 'keine Reste des alten Pakets');
  }
  // Claude und Antigravity haben kein Terminal: Mango führt den Scan selbst aus.
  assert.match(std, /Das Skript `ai_tell_scan\.py` kannst du nicht starten[\s\S]*Mango führt denselben Scan nach dem Schreiben selbst aus/);
  assert.match(std, /Mango führt den Scan des Prüf-Skills nach jedem Text selbst aus/);
  assert.ok(!std.includes('`ai_tell_scan`'), 'das Werkzeug gibt es dort nicht');
  // DeepSeek ruft den Scan als Werkzeug auf.
  assert.match(ds, /startest du mit dem Werkzeug `ai_tell_scan`/);
  assert.match(ds, /Mango prüft, ob du es aufgerufen hast/);
  assert.match(ds, /das Werkzeug `ai_tell_scan` zur Verfügung/);
  assert.ok(!ds.includes('kannst du nicht starten'));
  // Beide Dateien liegen im Arbeitsraum; Antigravity nutzt die Standard-Regeln.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-var-'));
  await Project.create(dir, { name: 'Test' });
  await wsLib.syncManagedFiles(dir);
  assert.ok(fs.readFileSync(path.join(dir, '.facharbeit', 'regeln-deepseek.md'), 'utf8').includes('startest du mit dem Werkzeug `ai_tell_scan`'));
  assert.ok(fs.readFileSync(path.join(dir, '.facharbeit', 'regeln.md'), 'utf8').includes('Mango führt denselben Scan'));
  assert.ok(fs.readFileSync(path.join(dir, '.agents', 'rules', 'mango-facharbeit.md'), 'utf8').includes(schreibskills.BLOCK_TITEL));
});

test('Sprachprüfung: harte Treffer müssen geändert werden, Prüfhinweise entscheidet der Assistent', () => {
  const stellen = stil.pruefen('Gerne! Hier ist dein Text. Darüber hinaus ist das gut — sehr gut.');
  const nach = (g) => stellen.find((x) => x.grund === g);
  assert.strictEqual(nach('Chatbot-Rest').hart, true);
  assert.ok(!nach('Floskel-Übergang').hart, 'Floskel-Übergang ist nur ein Hinweis');
  assert.strictEqual(stellen.find((x) => /^Geviertstrich/.test(x.grund)).hart, true, 'Geviertstrich: der Skill verbietet ihn');
  assert.strictEqual(stil.pruefen('Er sagte "ja" dazu.')[0].hart, true, 'falsche Anführungszeichen sind hart');
  const p = stil.korrekturPrompt([{ datei: 'abgabe/a.md', stellen: [...stellen, { satz: '', grund: 'Satzlängen zu gleichförmig' }] }]);
  assert.match(p, /Suchhilfen, keine Urteile/);
  assert.match(p, /„Gerne!“ – Chatbot-Rest \(ändern\)/);
  assert.match(p, /– Floskel-Übergang\n/, 'Hinweise ohne „(ändern)“');
  assert.match(p, /- Ganzer Text – Satzlängen zu gleichförmig/, 'Stellen ohne Satz betreffen den ganzen Text');
  // Pflichtschritte nachholen.
  const fehlend = schreibskills.fehlend(new Set()).map((a) => a.text);
  const n = stil.korrekturPrompt([], {}, { fehlendeSkills: fehlend, dateien: ['abgabe/a.md'] });
  assert.match(n, /fehlt noch: `human-voice` \(neuer Text\) oder `humanize-rewrite` \(vorhandener Text\), `ai-tell-audit`/);
  assert.match(n, /Lade dafür `human-voice` \(neuer Text\) bzw\. `humanize-rewrite` \(vorhandener Text\) und `ai-tell-audit` mit dem Skill-Werkzeug/);
  // DeepSeek muss zusätzlich den Scan aufrufen.
  const nd = stil.korrekturPrompt([], {}, { fehlendeSkills: schreibskills.fehlend(new Set(), 'deepseek').map((a) => a.text), dateien: ['abgabe/a.md'], anbieter: 'deepseek' });
  assert.match(nd, /fehlt noch: `human-voice`[\s\S]*, das Werkzeug `ai_tell_scan` mit dem fertigen Text\. Lies dafür `human-voice`[\s\S]*mit dem Skill-Werkzeug\. Ruf `ai_tell_scan` mit dem fertigen Text auf/);
  const nur = stil.korrekturPrompt([], {}, { fehlendeSkills: ['das Werkzeug `ai_tell_scan` mit dem fertigen Text'], dateien: ['abgabe/a.md'], anbieter: 'deepseek' });
  assert.match(nur, /fehlt noch: das Werkzeug `ai_tell_scan` mit dem fertigen Text\. Ruf `ai_tell_scan` mit dem fertigen Text auf und behebe die Befunde\. Überarbeite/);
  assert.ok(!/Skill-Werkzeug/.test(nur), 'fehlt nur der Scan, gibt es keine Skill-Anweisung');
  const c = stil.chatNachholenPrompt(fehlend);
  assert.match(c, /^Du hast in deiner Antwort einen Text geschrieben, ohne dass folgendes erfüllt war: /);
  assert.match(c, /ganze Antwort noch einmal aus/);
  // Ohne fehlende Skills, aber mit auffälligem Scan: Fundstellen werden mitgeschickt.
  const c2 = stil.chatNachholenPrompt([], '', [{ satz: 'Gerne!', grund: 'Chatbot-Rest', hart: true }, { satz: '', grund: 'Absätze alle ähnlich lang' }]);
  assert.match(c2, /Der Scan von `ai-tell-audit`[\s\S]*findet darin noch Muster/);
  assert.match(c2, /- „Gerne!“ – Chatbot-Rest \(ändern\)\n- Ganzer Text – Absätze alle ähnlich lang/);
});

test('KI-Scan ein- und ausschalten: Einstellung, Pflichtschritte und Prompt', async () => {
  const { AppStore } = require('../server/store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-scan-an-'));
  const prev = process.env.MANGO_DATA_DIR;
  process.env.MANGO_DATA_DIR = dir;
  try {
    let st = new AppStore();
    await st.load();
    assert.strictEqual(st.settings.scanAn, true, 'standardmäßig an');
    await st.updateSettings({ scanAn: 'nein' });
    assert.strictEqual(st.settings.scanAn, true, 'nur Wahrheitswerte gelten');
    await st.updateSettings({ scanAn: false });
    assert.strictEqual(st.settings.scanAn, false);
    st = new AppStore();
    await st.load();
    assert.strictEqual(st.settings.scanAn, false, 'bleibt gespeichert');
    await st.updateSettings({ scanAn: true });
    assert.strictEqual(st.settings.scanAn, true);
  } finally {
    if (prev === undefined) delete process.env.MANGO_DATA_DIR; else process.env.MANGO_DATA_DIR = prev;
  }
  // Ohne Scan verlangt Mango nur noch das Schreiben bzw. Umschreiben, bei keinem Anbieter die Prüfung oder das Scan-Werkzeug.
  for (const anbieter of ['claude', 'deepseek', 'opencodego']) {
    assert.deepStrictEqual(schreibskills.fehlend(new Set(), anbieter, { scan: false }).map((a) => a.id), ['schreiben'], anbieter);
    assert.deepStrictEqual(schreibskills.fehlend(new Set(['human-voice']), anbieter, { scan: false }), [], anbieter);
    assert.ok(schreibskills.fehlend(new Set(['human-voice']), anbieter).length >= 1, `${anbieter}: mit Scan fehlt die Prüfung weiter`);
  }
  // Prompt: Der Hinweis steht nur bei ausgeschaltetem Scan und geht den Regeln vor.
  const p = (o) => ctx.buildPrompt({ context: '<k/>', text: 'Schreib einen Absatz', schreibaufgabe: true, skillsImKontext: true, ...o });
  assert.ok(!/<scan>/.test(p({ anbieter: 'claude' })), 'bei eingeschaltetem Scan kein Hinweis');
  assert.match(p({ anbieter: 'claude' }), /<schreibregeln>.*2\. `ai-tell-audit`/);
  const aus = p({ anbieter: 'claude', scanAn: false });
  assert.match(aus, /<scan>Die Person hat den KI-Scan ausgeschaltet\. Das geht den Regeln vor: Prüfe Texte in dieser Antwort nicht mit `ai-tell-audit` \(Mango scannt auch nicht\)/);
  assert.ok(!/ai_tell_scan/.test(aus), 'Anbieter ohne Werkzeug: kein Hinweis auf das Werkzeug');
  assert.match(aus, /<schreibregeln>[^<]*Der KI-Scan ist ausgeschaltet: keine Prüfung mit `ai-tell-audit`\./);
  assert.ok(!/<schreibregeln>[^<]*2\. `ai-tell-audit`/.test(aus));
  assert.match(aus, /<menschlich>[^<]*\(human-voice bzw\. humanize-rewrite\) und schreibe wie ein Mensch/, 'Menschlich-Erinnerung ohne Prüfung');
  assert.match(p({ anbieter: 'deepseek', scanAn: false }), /rufe `ai_tell_scan` nicht auf/);
  assert.ok(!/ai_tell_scan/.test(p({ anbieter: 'deepseek', scanAn: false }).match(/<schreibregeln>[\s\S]*?<\/schreibregeln>/)[0]), 'auch die Schreibregeln verlangen das Werkzeug dann nicht');
  assert.match(ctx.buildPrompt({ context: '', text: 'Hallo', scanAn: false }), /<scan>/, 'der Hinweis gilt auch ohne erkannte Schreibaufgabe');
});

test('iPad-App: Das Startskript (nodejs-mobile) startet den Server nur mit API-Anbietern und meldet die Adresse', async () => {
  const { spawn } = require('child_process');
  const net = require('net');
  const frei = await new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-ipad-'));
  const daten = path.join(dir, 'Library', 'Application Support', 'Mango-Facharbeit');
  const heim = path.join(dir, 'home');
  fs.mkdirSync(heim, { recursive: true });
  const env = { ...process.env };
  for (const k of ['MANGO_NUR_API', 'MANGO_IPAD', 'MANGO_DATA_DIR']) delete env[k];
  const proc = spawn(process.execPath, [path.join(ROOT, 'ios', 'nodejs-project', 'main.js'), daten, heim, String(frei)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const datei = path.join(daten, 'laeuft.txt');
    const fehlerDatei = path.join(daten, 'fehler.txt');
    const start = Date.now();
    while (!fs.existsSync(datei) && !fs.existsSync(fehlerDatei) && Date.now() - start < 20000) await new Promise((r) => setTimeout(r, 100));
    assert.ok(!fs.existsSync(fehlerDatei), fs.existsSync(fehlerDatei) ? fs.readFileSync(fehlerDatei, 'utf8') : '');
    const url = fs.readFileSync(datei, 'utf8');
    assert.strictEqual(url, `http://127.0.0.1:${frei}/`);
    const html = await (await fetch(url)).text();
    const token = /name="mango-token" content="([a-f0-9]+)"/.exec(html)[1];
    const get = async (p) => (await fetch(url.replace(/\/$/, '') + p, { headers: { 'x-mango-token': token } })).json();
    const st = await get('/api/state');
    assert.strictEqual(st.ipad, true, 'die Oberfläche weiß, dass sie in der iPad-App läuft');
    const anbieter = await get('/api/providers');
    assert.deepStrictEqual(anbieter.map((p) => p.id), ['deepseek', 'opencodego'], 'keine Kommandozeilen-Anbieter auf dem iPad');
    assert.ok(fs.existsSync(daten), 'Daten liegen im Datenordner der App');
  } finally {
    proc.kill();
    await new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r)));
  }
  // Ohne Argumente: verständliche Fehlerdatei statt Absturz
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-ipad2-'));
  const r = require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'ios', 'nodejs-project', 'main.js'), path.join(dir2, 'daten'), '', '4317'], { encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(dir2, 'daten', 'fehler.txt')));
  assert.match(fs.readFileSync(path.join(dir2, 'daten', 'fehler.txt'), 'utf8'), /Aufruf: main\.js/);
  void r;
});

test('Chat-Liste: Datumsgruppen und Suche nach Titel', async () => {
  const { chatGruppe, gruppiere, GRUPPEN } = await import('../public/js/chatliste.js');
  const jetzt = new Date(2026, 10, 3, 9, 30); // 03.11.2026
  const tag = (zurueck, h = 12) => new Date(2026, 10, 3 - zurueck, h).toISOString();
  assert.strictEqual(chatGruppe(tag(0, 0), jetzt), 'Heute');
  assert.strictEqual(chatGruppe(tag(0, 23), jetzt), 'Heute');
  assert.strictEqual(chatGruppe(tag(1), jetzt), 'Gestern');
  assert.strictEqual(chatGruppe(tag(2), jetzt), 'Letzte 7 Tage');
  assert.strictEqual(chatGruppe(tag(7), jetzt), 'Letzte 7 Tage');
  assert.strictEqual(chatGruppe(tag(8), jetzt), 'Letzte 30 Tage');
  assert.strictEqual(chatGruppe(tag(30), jetzt), 'Letzte 30 Tage');
  assert.strictEqual(chatGruppe(tag(31), jetzt), 'Älter');
  assert.strictEqual(chatGruppe('kein Datum', jetzt), 'Älter');
  assert.strictEqual(chatGruppe(tag(-2), jetzt), 'Heute', 'ein Datum in der Zukunft (Uhr falsch) bleibt oben');

  const chats = [
    { id: 'a', title: 'Exposé schreiben', updatedAt: tag(0) },
    { id: 'b', title: 'Lerntagebuch', updatedAt: tag(1) },
    { id: 'c', title: 'Zeitplan', updatedAt: tag(0, 8) },
    { id: 'd', title: 'Alte Quellen', updatedAt: tag(90) },
    { id: 'e', title: '', updatedAt: tag(3) },
  ];
  const g = gruppiere(chats, '', jetzt);
  assert.deepStrictEqual(g.map((x) => [x.name, x.chats.map((c) => c.id)]), [['Heute', ['a', 'c']], ['Gestern', ['b']], ['Letzte 7 Tage', ['e']], ['Älter', ['d']]], 'feste Reihenfolge, Reihenfolge innerhalb der Gruppe bleibt');
  assert.deepStrictEqual(GRUPPEN, ['Heute', 'Gestern', 'Letzte 7 Tage', 'Letzte 30 Tage', 'Älter']);
  assert.deepStrictEqual(gruppiere(chats, 'EXPOSE', jetzt).flatMap((x) => x.chats.map((c) => c.id)), ['a'], 'ohne Groß-/Kleinschreibung und Akzente');
  assert.deepStrictEqual(gruppiere(chats, '  tage ', jetzt).flatMap((x) => x.chats.map((c) => c.id)), ['b'], 'Leerzeichen am Rand zählen nicht');
  assert.deepStrictEqual(gruppiere(chats, 'neuer', jetzt).flatMap((x) => x.chats.map((c) => c.id)), ['e'], 'ohne Titel gilt „Neuer Chat“');
  assert.deepStrictEqual(gruppiere(chats, 'xyz', jetzt), []);
  assert.deepStrictEqual(gruppiere(undefined, '', jetzt), []);
});

// ---------- Dateien erstellen: PDF, PowerPoint, Excel, Vorschau ----------

const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('PDF: Markdown wird zu einer gültigen Datei mit Umlauten, Seiten und Tabelle', () => {
  const { markdownToPdf } = require('../server/pdf');
  const lang = 'Ein Satz über Käse und Straßen. '.repeat(400);
  const buf = markdownToPdf(`# Größe der Umfrage\n\nText mit **fett** und „Zitat“ – ok.\n\n- Punkt\n1. Eins\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n${lang}`, { title: 'Titel ä', author: 'Max' });
  assert.strictEqual(buf.subarray(0, 5).toString(), '%PDF-');
  assert.match(buf.subarray(-8).toString(), /%%EOF/);
  const text = buf.toString('latin1');
  assert.match(text, /\/Type \/Pages/);
  assert.ok(+/\/Count (\d+)/.exec(text)[1] >= 2, 'lange Texte laufen auf eine zweite Seite');
  // Der Inhalt ist hexcodiert und deflate-komprimiert: Seitenstrom enthält die Wörter in Windows-1252.
  const zlib = require('zlib');
  const streams = [...buf.toString('latin1').matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'));
  const hex = streams.join('\n').match(/<([0-9a-f]+)> Tj/g).map((x) => Buffer.from(/<([0-9a-f]+)>/.exec(x)[1], 'hex').toString('latin1')).join(' ');
  assert.match(hex, /Gr\xf6\xdfe/, 'ö und ß als Windows-1252');
  assert.match(hex, /\x84Zitat\x93/, 'deutsche Anführungszeichen');
});

test('PowerPoint: Folien, Notizen, Tabelle, Bild; Vorschau liest sie wieder', async () => {
  const { markdownToPptx } = require('../server/pptx');
  const vorschau = require('../server/vorschau');
  const buf = await markdownToPptx('# Titel der Arbeit\nMax · Fach\n\n---\n## Frage\n- Erster Punkt\n  - Unterpunkt\n> Das sage ich dazu.\n\n---\n## Ergebnis\n| A | B |\n|---|---|\n| 1 | 2 |\n\n---\n## Bild\n![Skizze](anhaenge/x.png)', {
    title: 'T', author: 'Max', bildLaden: async (rel) => { assert.strictEqual(rel, 'anhaenge/x.png'); return PNG1; },
  });
  const z = readZip(buf);
  for (const n of ['[Content_Types].xml', 'ppt/presentation.xml', 'ppt/slides/slide4.xml', 'ppt/notesSlides/notesSlide2.xml', 'ppt/media/image1.png', 'ppt/notesMasters/notesMaster1.xml']) assert.ok(z.names().includes(n), n);
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mango-pptx-')), 'a.pptx');
  fs.writeFileSync(f, buf);
  const v = await vorschau.erzeugen(f, 'a.pptx');
  assert.strictEqual(v.typ, 'folien');
  assert.strictEqual(v.folien.length, 4);
  assert.strictEqual(v.folien[0].titel, 'Titel der Arbeit');
  assert.strictEqual(v.folien[0].zeilen[0].text, 'Max · Fach');
  assert.deepStrictEqual(v.folien[1].zeilen.map((x) => x.text), ['Erster Punkt', 'Unterpunkt']);
  assert.strictEqual(v.folien[1].notizen, 'Das sage ich dazu.');
  assert.deepStrictEqual(v.folien[2].tabellen[0], [['A', 'B'], ['1', '2']]);
  assert.strictEqual(v.folien[3].bilder, 1);
  await assert.rejects(markdownToPptx('![x](nicht.png)', { bildLaden: async () => { throw new Error('nicht gefunden'); } }), /Bild „nicht\.png“/);
  await assert.rejects(markdownToPptx('   '), /Kein Inhalt/);
});

test('Excel: Tabellen werden Blätter, Zahlen bleiben Zahlen; Vorschau liest sie', async () => {
  const { markdownToXlsx } = require('../server/xlsx');
  const vorschau = require('../server/vorschau');
  const buf = markdownToXlsx('## Auswertung\n\n| Frage | Ja |\n|---|---|\n| Apps? | 30 |\n| Dauer | 5,5 |\n\n## Zweite\n| a |\n|--|\n| x |', { title: 'T' });
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mango-xlsx-')), 'a.xlsx');
  fs.writeFileSync(f, buf);
  const v = await vorschau.erzeugen(f, 'a.xlsx');
  assert.deepStrictEqual(v.blaetter.map((b) => b.name), ['Auswertung', 'Zweite']);
  assert.deepStrictEqual(v.blaetter[0].rows, [['Frage', 'Ja'], ['Apps?', '30'], ['Dauer', '5.5']]);
  assert.match(readZip(buf).read('xl/worksheets/sheet1.xml').toString(), /<c r="B2"[^>]*><v>30<\/v>/);
  assert.throws(() => markdownToXlsx('Nur Text'), /Keine Tabelle/);
});

test('Vorschau: Word, Text und Markdown', async () => {
  const vorschau = require('../server/vorschau');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-vs-'));
  fs.writeFileSync(path.join(dir, 'a.docx'), markdownToDocx('# Titel\n\nAbsatz.\n\n| a | b |\n|--|--|\n| 1 | 2 |', { title: 'x' }));
  fs.writeFileSync(path.join(dir, 'n.md'), '# Notiz\n\nText');
  fs.writeFileSync(path.join(dir, 'x.bin'), 'zzz');
  const w = await vorschau.erzeugen(path.join(dir, 'a.docx'), 'a.docx');
  assert.deepStrictEqual(w.bloecke, [{ t: 'h', n: 1, text: 'Titel' }, { t: 'p', text: 'Absatz.' }, { t: 'tabelle', rows: [['a', 'b'], ['1', '2']] }]);
  const n = await vorschau.erzeugen(path.join(dir, 'n.md'), 'n.md');
  assert.strictEqual(n.typ, 'text');
  assert.strictEqual(n.markdown, true);
  assert.strictEqual((await vorschau.erzeugen(path.join(dir, 'x.bin'), 'x.bin')).typ, 'keine');
  // Word → Markdown (für PDF aus einer vorhandenen Datei)
  assert.strictEqual(word.alsMarkdown(fs.readFileSync(path.join(dir, 'a.docx'))), '# Titel\n\nAbsatz.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |');
});

test('Block erstellen: Datei, Quelle und Ersetzen werden gelesen und entfernt', () => {
  const p = word.parseBlock('Fertig.\n\n```erstellen\n[{"datei":"abgabe/p.pptx","text":"# T"},{"datei":"abgabe/f.pdf","aus":"abgabe/f.docx","ersetzen":true}]\n```');
  assert.strictEqual(p.text, 'Fertig.');
  assert.deepStrictEqual(p.dateien.map((d) => [d.datei, d.neu, d.ersetzen, d.aus, d.text]), [['abgabe/p.pptx', true, false, '', '# T'], ['abgabe/f.pdf', true, true, 'abgabe/f.docx', '']]);
});

test('Abgabe: PDF, PowerPoint und Excel anlegen, ersetzen mit Sicherung, Pfade begrenzt', async () => {
  const abgabeMod = require('../server/abgabe');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-erst-'));
  try {
    const p = await Project.create(path.join(dir, 'neu'), { name: 'Alex Beispiel' });
    const lt = p.data.abgabe.lerntagebuch;
    const r = await abgabeMod.anwenden(p, [
      { datei: 'abgabe/Folien.pptx', neu: true, text: '# T\n\n---\n## F\n- a', ops: [] },
      { datei: 'abgabe/Info.pdf', neu: true, text: '# Info\n\nText', ops: [] },
      { datei: 'abgabe/Info_Lerntagebuch.pdf', neu: true, aus: lt, text: '', ops: [] },
      { datei: 'abgabe/Daten.xlsx', neu: true, text: '| a |\n|---|\n| 1 |', ops: [] },
      { datei: 'abgabe/Folien.pptx', neu: true, text: '# anders', ops: [] },
      { datei: 'abgabe/Folien.pptx', neu: true, ersetzen: true, text: '# Neu', ops: [] },
      { datei: lt, neu: true, ersetzen: true, text: '# x', ops: [] },
      { datei: '00_vorgaben/x.pdf', neu: true, text: '# x', ops: [] },
      { datei: 'abgabe/Quelle.pdf', neu: true, aus: 'abgabe/gibtsnicht.docx', text: '', ops: [] },
    ]);
    assert.deepStrictEqual(r.map((x) => x.ok), [1, 1, 1, 1, 0, 1, 0, 0, 0]);
    assert.match(r[4].hinweis, /gibt es schon/);
    assert.ok(r[5].version, 'alte Fassung gesichert');
    assert.match(r[6].hinweis, /gibt es schon/, 'Word-Abgabe wird nie ersetzt');
    assert.match(r[7].hinweis, /nur in abgabe\//);
    assert.match(r[8].hinweis, /Quelle|nicht gefunden/);
    assert.strictEqual(fs.readFileSync(path.join(p.workspace, 'abgabe', 'Info_Lerntagebuch.pdf')).subarray(0, 5).toString(), '%PDF-');
    assert.strictEqual(fs.existsSync(path.join(p.workspace, 'abgabe', 'Daten.xlsx')), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- Ordnung ----------

test('Ordnung: Unordnung wird erkannt, Aufräum-Plan sicher ausgeführt und rückgängig gemacht', async () => {
  const ordnung = require('../server/ordnung');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-ordnung-'));
  try {
    const p = await Project.create(path.join(dir, 'neu'), { name: 'Alex Beispiel' });
    const w = p.workspace;
    const put = (rel, text = 'x') => { fs.mkdirSync(path.dirname(path.join(w, rel)), { recursive: true }); fs.writeFileSync(path.join(w, rel), text); };
    put('notizen.md');
    put('abgabe/entwurf.md');
    put('02_expose_und_zeitplan/expose.md');
    put('02_expose_und_zeitplan/expose_v2.md');
    put('03_literatur_und_quellen/none.md');
    put('03_literatur_und_quellen/~$lock.docx');
    put('01_themenfindung_und_mindmap/leer/unter/.keep-nicht');
    fs.mkdirSync(path.join(w, '01_themenfindung_und_mindmap', 'wirklich', 'leer'), { recursive: true });
    const ws = require('../server/workspace');
    const funde = await ordnung.pruefen(p, await ws.listFiles(w));
    const nach = (pfad) => funde.find((f) => f.path === pfad);
    assert.match(nach('notizen.md').grund, /lose im Hauptordner/);
    assert.match(nach('abgabe/entwurf.md').grund, /in abgabe\//);
    assert.match(nach('02_expose_und_zeitplan/expose.md').grund, /ältere Fassung/);
    assert.strictEqual(nach('02_expose_und_zeitplan/expose_v2.md'), undefined, 'neueste Fassung bleibt');
    assert.match(nach('03_literatur_und_quellen/none.md').grund, /Platzhalter/);
    assert.ok(!funde.some((f) => f.path.startsWith('00_vorgaben/') || f.path === p.data.abgabe.lerntagebuch), 'Originale und Abgabe-Dateien sind nie dabei');
    assert.match(ordnung.kontextText(funde), /^Aufräumen nötig/);
    // Eigene Dateien, die schon vor dem Projekt da waren, bleiben unberührt.
    put('privat.md');
    const alt = new Date('2020-01-01');
    fs.utimesSync(path.join(w, 'privat.md'), alt, alt);
    assert.ok(!(await ordnung.pruefen(p, await ws.listFiles(w))).some((f) => f.path === 'privat.md'), 'ältere Dateien werden nicht angefasst');
    fs.rmSync(path.join(w, 'privat.md'));
    assert.strictEqual(ordnung.kontextText([]), '');

    // Plan lesen
    const plan = ordnung.parsePlan('Aufgeräumt.\n\n```aufraeumen\n[{"verschieben":"notizen.md","nach":"01_themenfindung_und_mindmap/notizen.md"},{"archivieren":"02_expose_und_zeitplan/expose.md"},{"verschieben":"abgabe/entwurf.md","nach":"../aussen.md"},{"archivieren":"00_vorgaben/anforderungen.md"},{"archivieren":"' + p.data.abgabe.lerntagebuch + '"},{"verschieben":"abgabe/entwurf.md","nach":"01_themenfindung_und_mindmap/entwurf.txt"}]\n```');
    assert.strictEqual(plan.text, 'Aufgeräumt.');
    assert.strictEqual(plan.plan.length, 6);
    const r = await ordnung.anwenden(p, plan.plan);
    assert.deepStrictEqual(r.map((x) => x.ok), [true, true, false, false, false, false]);
    assert.match(r[2].fehler, /Ziel muss/);
    assert.match(r[3].fehler, /Originale/);
    assert.match(r[4].fehler, /Abgabe-Dateien/);
    assert.match(r[5].fehler, /Dateiendung/);
    assert.ok(fs.existsSync(path.join(w, '01_themenfindung_und_mindmap', 'notizen.md')));
    assert.ok(!fs.existsSync(path.join(w, 'notizen.md')));
    assert.ok(fs.existsSync(path.join(w, ...r[1].nach.split('/'))), 'archiviert, nicht gelöscht');
    assert.match(r[1].nach, /^\.facharbeit\/papierkorb\/.+\/02_expose_und_zeitplan\/expose\.md$/);
    // Rückgängig
    const z = await ordnung.rueckgaengig(p, r);
    assert.strictEqual(z.zurueck, 2);
    assert.ok(fs.existsSync(path.join(w, 'notizen.md')));
    assert.ok(fs.existsSync(path.join(w, '02_expose_und_zeitplan', 'expose.md')));
    // Mechanisches Aufräumen: Reste und leere Ordner, nichts anderes
    const auto = await ordnung.autoAufraeumen(p);
    assert.strictEqual(auto.reste, 1);
    assert.ok(!fs.existsSync(path.join(w, '03_literatur_und_quellen', '~$lock.docx')));
    assert.ok(!fs.existsSync(path.join(w, '01_themenfindung_und_mindmap', 'wirklich')));
    assert.ok(fs.existsSync(path.join(w, '01_themenfindung_und_mindmap')), 'Arbeitsordner selbst bleiben');
    assert.ok(fs.existsSync(path.join(w, '00_vorgaben', 'anforderungen.md')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Aktivität: Skills werden erkannt (Skill-Werkzeug und SKILL.md lesen)', () => {
  assert.strictEqual(describeTool('Skill', { skill: 'human-voice' }, '/w').skill, 'human-voice');
  assert.strictEqual(describeTool('Skill', { skill: 'plugin:ai-tell-audit' }, '/w').skill, 'ai-tell-audit');
  assert.strictEqual(describeTool('Read', { file_path: '/w/.agents/skills/humanize-rewrite/SKILL.md' }, '/w').skill, 'humanize-rewrite');
  assert.deepStrictEqual(describeTool('ai_tell_scan', { text: 'x' }, '/w'), { kind: 'skill', werkzeug: 'ai_tell_scan', label: 'Prüft den Text mit dem Scan (ai-tell-audit)' });
  assert.strictEqual(describeTool('Read', { file_path: '/w/notiz.md' }, '/w').skill, undefined);
});

test('Folien zeichnen: Titel, Aufzählung, Tabelle, Bild, Farben, Platzhalter aus dem Layout', async () => {
  const { folienAlsHtml } = require('../server/pptxrender');
  const { markdownToPptx } = require('../server/pptx');
  const buf = await markdownToPptx('# Titel <b>x</b>\nUntertitel\n\n---\n## Frage\n- Punkt A\n  - Unterpunkt\n\n---\n## Tabelle\n| A | B |\n|---|---|\n| 1 | 2 |\n![Bild](x.png)', { bildLaden: async () => PNG1 });
  const o = folienAlsHtml(buf);
  assert.strictEqual(o.folien.length, 3);
  assert.strictEqual(o.breite, 960);
  assert.strictEqual(o.hoehe, 540);
  assert.match(o.folien[0], /Titel &lt;b&gt;x&lt;\/b&gt;/, 'Text ist maskiert');
  assert.ok(!/<b>x/.test(o.folien[0]));
  assert.match(o.folien[0], /background:#5b5fb8/i, 'Akzentfläche');
  assert.match(o.folien[1], /Punkt A/);
  assert.match(o.folien[1], />•<\/span>/, 'Aufzählungszeichen');
  assert.match(o.folien[2], /<table[\s\S]*>A<[\s\S]*>2</);
  assert.match(o.folien[2], /<img[^>]*src="data:image\/png;base64,/);
  // Fremde Datei: Platzhalter erben Lage und Stil vom Layout (python-pptx-Vorlage, falls vorhanden)
  const fremd = process.env.MANGO_TEST_PPTX;
  if (fremd && fs.existsSync(fremd)) assert.ok(folienAlsHtml(fs.readFileSync(fremd)).folien.length > 0);
});

test('Umwandlung in PDF: ohne Office oder LibreOffice kein Ergebnis, mit LibreOffice ein PDF (gespeichert)', async () => {
  const konv = require('../server/konvertieren');
  const { markdownToPptx } = require('../server/pptx');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-konv-'));
  try {
    const p = await Project.create(path.join(dir, 'neu'), { name: 'Alex Beispiel' });
    fs.writeFileSync(path.join(p.workspace, 'abgabe', 'F.pptx'), await markdownToPptx('# T\n\n---\n## A\n- b'));
    process.env.MANGO_OHNE_KONVERTIERUNG = '1';
    assert.strictEqual(await konv.nachPdf(p.workspace, 'abgabe/F.pptx'), null);
    delete process.env.MANGO_OHNE_KONVERTIERUNG;
    const { which } = require('../server/providers/proc');
    if (!which('soffice') && !which('libreoffice')) return; // kein LibreOffice: nichts zu prüfen
    const r = await konv.nachPdf(p.workspace, 'abgabe/F.pptx');
    assert.strictEqual(r.quelle, 'LibreOffice');
    assert.strictEqual(fs.readFileSync(r.pdf).subarray(0, 5).toString(), '%PDF-');
    assert.ok((await konv.vorhanden(p.workspace, 'abgabe/F.pptx')).pdf === r.pdf, 'zweiter Aufruf nutzt den gespeicherten Stand');
    fs.writeFileSync(path.join(p.workspace, 'abgabe', 'F.pptx'), await markdownToPptx('# Neu'));
    assert.strictEqual(await konv.vorhanden(p.workspace, 'abgabe/F.pptx'), null, 'geänderte Datei braucht eine neue Umwandlung');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Streaming: Steuerblöcke und angefangene Blöcke erscheinen nie im Chat', async () => {
  const { stripUpdateBlock } = await import('../public/js/markdown.js');
  assert.strictEqual(stripUpdateBlock('Fertig.\n\n```erstellen\n[{"datei":'), 'Fertig.');
  assert.strictEqual(stripUpdateBlock('Fertig.\n\n```aufraeumen\n[]\n```\n\nDanach.'), 'Fertig.\n\nDanach.');
  for (const teil of ['`', '``', '```', '```e', '```erst', '```erstellen', '```word', '```aufr']) assert.strictEqual(stripUpdateBlock(`Text\n${teil}`), 'Text', teil);
  // normale Codeblöcke bleiben, auch mit schließendem Zaun am Ende
  assert.strictEqual(stripUpdateBlock('Code:\n```js\nx\n```'), 'Code:\n```js\nx\n```');
  assert.strictEqual(stripUpdateBlock('Code:\n```js'), 'Code:\n```js');
});

// ---------- Updates ----------

test('Update: Versionsvergleich und Auswahl der neuesten Veröffentlichung', () => {
  const { vergleiche, parseVersion, neuesteVersion } = require('../server/update');
  assert.deepStrictEqual(parseVersion('v0.2.8-beta'), { nums: [0, 2, 8], pre: 'beta' });
  assert.strictEqual(parseVersion('kaputt'), null);
  assert.ok(vergleiche('0.2.9-beta', '0.2.8-beta') > 0);
  assert.ok(vergleiche('0.10.0-beta', '0.9.9-beta') > 0, 'Zahlen, nicht Text');
  assert.ok(vergleiche('1.0.0', '1.0.0-beta') > 0, 'Fassung ohne Zusatz ist neuer');
  assert.strictEqual(vergleiche('0.2.8-beta', '0.2.8-beta'), 0);
  assert.ok(vergleiche('0.2.7-beta', '0.2.8-beta') < 0);
  const asset = (name, tag) => ({ name, size: 1000, browser_download_url: `https://github.com/Spackle01/Mango-Facharbeit/releases/download/${tag}/${name}` });
  const rel = (tag, extra = {}) => ({ tag_name: tag, draft: false, html_url: `https://github.com/Spackle01/Mango-Facharbeit/releases/tag/${tag}`, body: `Kurztext zu ${tag}\n\n## Mehr`, assets: [asset(`Mango-Facharbeit-Setup-${tag.slice(1)}.exe`, tag), asset(`Mango-Facharbeit-Setup-${tag.slice(1)}.exe.sha256`, tag)], ...extra });
  const n = neuesteVersion([rel('v0.2.7-beta'), rel('v0.2.9-beta'), rel('v0.3.0-beta', { draft: true }), { ...rel('v0.4.0-beta'), assets: [] }]);
  assert.strictEqual(n.version, '0.2.9-beta');
  assert.strictEqual(n.notizen, 'Kurztext zu v0.2.9-beta');
  assert.match(n.shaUrl, /\.exe\.sha256$/);
  // Mac: das Image passend zum Prozessor, nicht das Windows-Setup
  const mac = (tag) => ({ ...rel(tag), assets: ['arm64', 'x64'].map((a) => asset(`Mango-Facharbeit-${tag.slice(1)}-Mac-${a}.dmg`, tag)) });
  assert.strictEqual(neuesteVersion([mac('v0.4.0-beta'), rel('v0.3.0-beta')], { plattform: 'darwin', arch: 'arm64' }).name, 'Mango-Facharbeit-0.4.0-beta-Mac-arm64.dmg');
  assert.strictEqual(neuesteVersion([mac('v0.4.0-beta')], { plattform: 'darwin', arch: 'x64' }).name, 'Mango-Facharbeit-0.4.0-beta-Mac-x64.dmg');
  assert.strictEqual(neuesteVersion([rel('v0.4.0-beta')], { plattform: 'darwin', arch: 'arm64' }), null, 'ohne Mac-Datei kein Update für den Mac');
  assert.strictEqual(neuesteVersion([mac('v0.4.0-beta')], { plattform: 'win32' }), null, 'Windows nimmt kein Mac-Image');
  // Fremde Download-Adressen werden nicht akzeptiert
  const boese = rel('v0.5.0-beta');
  boese.assets[0].browser_download_url = 'https://evil.example/Mango-Facharbeit-Setup-0.5.0-beta.exe';
  assert.strictEqual(neuesteVersion([boese]), null);
});

test('Update: laden, Prüfsumme prüfen, Installer starten', async () => {
  const http = require('http');
  const crypto = require('crypto');
  const { Updater } = require('../server/update');
  const exe = Buffer.alloc(300000, 7);
  const sha = crypto.createHash('sha256').update(exe).digest('hex');
  let falsch = false;
  const srv = http.createServer((req, res) => {
    if (req.url === '/releases') {
      const base = `http://127.0.0.1:${srv.address().port}`;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([{ tag_name: 'v9.0.0-beta', draft: false, html_url: `${base}/seite`, body: 'Neu.', assets: [
        { name: 'Mango-Facharbeit-Setup-9.0.0-beta.exe', size: exe.length, browser_download_url: `${base}/dl/Mango-Facharbeit-Setup-9.0.0-beta.exe` },
        { name: 'Mango-Facharbeit-Setup-9.0.0-beta.exe.sha256', size: 100, browser_download_url: `${base}/dl/Mango-Facharbeit-Setup-9.0.0-beta.exe.sha256` }] }]));
    } else if (req.url.endsWith('.exe')) { res.setHeader('Content-Length', exe.length); res.end(exe); } else res.end(`${falsch ? 'a'.repeat(64) : sha}  Mango-Facharbeit-Setup-9.0.0-beta.exe`);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  process.env.MANGO_UPDATE_API = `http://127.0.0.1:${port}/releases`;
  delete require.cache[require.resolve('../server/update')];
  const { Updater: U } = require('../server/update');
  void Updater;
  try {
    const gestartet = [];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-upd-'));
    const host = { kannAktualisieren: true, updateAnwenden: async (f) => { gestartet.push([f, fs.statSync(f).size]); } };
    const u = new U({ version: '0.2.8-beta', host, dir });
    let st = await u.pruefen();
    assert.strictEqual(st.neu.version, '9.0.0-beta');
    assert.strictEqual(st.direkt, true);
    // Nichts Neueres: kein Knopf
    const gleich = new U({ version: '9.0.0-beta', host, dir });
    assert.strictEqual((await gleich.pruefen()).neu, null);
    // Arbeit läuft: kein Update
    assert.throws(() => u.starten({ laeuftArbeit: () => true }), /arbeitet gerade/);
    // Falsche Prüfsumme: nichts wird gestartet
    falsch = true;
    u.starten();
    for (let i = 0; i < 100 && u.status.phase === 'laedt'; i++) await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(u.status.phase, 'fehler');
    assert.match(u.status.fehler, /Prüfsumme/);
    assert.strictEqual(gestartet.length, 0);
    assert.ok(!fs.existsSync(path.join(dir, 'Mango-Facharbeit-Setup-9.0.0-beta.exe')), 'fehlerhafte Datei wird gelöscht');
    // Richtige Prüfsumme: Setup wird gestartet
    falsch = false;
    u.zuruecksetzen();
    u.starten();
    for (let i = 0; i < 100 && u.status.phase !== 'startet'; i++) await new Promise((r) => setTimeout(r, 50));
    for (let i = 0; i < 20 && !gestartet.length; i++) await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(u.status.phase, 'startet');
    assert.strictEqual(gestartet.length, 1);
    assert.strictEqual(gestartet[0][1], exe.length);
    // Ohne Desktop-App (Browser, Linux, Mac): nur Hinweis auf die Release-Seite
    assert.throws(() => new U({ version: '0.2.8-beta', host: null, dir }).starten(), /installierten Windows-App/);
    // GitHub nicht erreichbar: kein Absturz, Fehler wird gemerkt
    const kaputt = new U({ version: '0.2.8-beta', host, dir, fetchFn: async () => { throw new Error('offline'); } });
    const r = await kaputt.pruefen();
    assert.strictEqual(r.neu, null);
    assert.match(r.fehler, /offline/);
  } finally {
    delete process.env.MANGO_UPDATE_API;
    delete require.cache[require.resolve('../server/update')];
    srv.close();
  }
});

// ---------- DeepSeek: Werkzeuge, Schlüsselspeicher, Agent-Schleife ----------

test('Werkzeuge: lesen, schreiben, bearbeiten, suchen, Skills; Originale und Office-Dateien geschützt', async () => {
  const { Werkzeuge } = require('../server/providers/werkzeuge');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-wz-'));
  try {
    const put = (rel, t) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), t); };
    put('00_vorgaben/regel.md', 'Original');
    put('.claude/skills/textpruefung/SKILL.md', '# Skill\nPrüfen');
    put('02_expose_und_zeitplan/expose.md', 'Zeile eins\nZeile zwei\nZeile drei');
    put('.facharbeit/extrakte/abgabe/x.docx.txt', '[1] Absatz');
    const w = new Werkzeuge(dir);
    const run = (n, a) => w.ausfuehren(n, a);
    assert.match(await run('Read', { file_path: '02_expose_und_zeitplan/expose.md', offset: 2, limit: 1 }), /^\s+2\tZeile zwei/);
    assert.match(await run('Read', { file_path: `${dir}/02_expose_und_zeitplan/expose.md` }), /Zeile drei/, 'absolute Pfade im Arbeitsraum gehen');
    assert.match(await run('Read', { file_path: '../geheim.txt' }), /^Fehler: .*außerhalb/);
    assert.match(await run('Read', { file_path: '.facharbeit/extrakte/abgabe/x.docx.txt' }), /\[1\] Absatz/);
    assert.match(await run('Write', { file_path: '04_forschung_und_eigenanteil/notiz.md', content: 'A\nB' }), /Geschrieben/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '04_forschung_und_eigenanteil', 'notiz.md'), 'utf8'), 'A\nB');
    assert.match(await run('Write', { file_path: '00_vorgaben/neu.md', content: 'x' }), /Originale/);
    assert.match(await run('Write', { file_path: 'abgabe/x.docx', content: 'x' }), /Blöcke `word`/);
    assert.match(await run('Write', { file_path: '.facharbeit/x.md', content: 'x' }), /Interne Dateien/);
    assert.match(await run('Edit', { file_path: '02_expose_und_zeitplan/expose.md', old_string: 'Zeile', new_string: 'Satz' }), /kommt 3-mal vor/);
    assert.match(await run('Edit', { file_path: '02_expose_und_zeitplan/expose.md', old_string: 'Zeile zwei', new_string: 'Satz zwei' }), /Bearbeitet/);
    assert.match(fs.readFileSync(path.join(dir, '02_expose_und_zeitplan', 'expose.md'), 'utf8'), /Satz zwei/);
    assert.match(await run('Edit', { file_path: '00_vorgaben/regel.md', old_string: 'Original', new_string: 'x' }), /Originale/);
    assert.match(await run('Glob', { pattern: '**/*.md' }), /02_expose_und_zeitplan\/expose\.md/);
    assert.match(await run('Glob', { pattern: '0*_*/*.md' }), /04_forschung_und_eigenanteil\/notiz\.md/);
    assert.match(await run('Grep', { pattern: 'satz', '-i': true }), /expose\.md:2: Satz zwei/);
    assert.match(await run('Skill', { skill: 'textpruefung' }), /Skill „textpruefung“ geladen[\s\S]*Prüfen/);
    assert.match(await run('Skill', { skill: '../x' }), /Ungültiger Skill-Name/);
    assert.match(await run('Skill', { skill: 'gibtsnicht' }), /Vorhanden: textpruefung/);
    assert.match(await run('Gibtsnicht', {}), /gibt es nicht/);
    // Webadressen: keine lokalen Ziele
    for (const u of ['http://127.0.0.1/x', 'http://localhost/x', 'http://192.168.1.5/', 'file:///etc/passwd', 'http://[::1]/', 'ftp://example.com/x', 'http://user:pw@example.com/']) {
      assert.match(await run('WebFetch', { url: u }), /^Fehler:/, u);
    }
    const web = new Werkzeuge(dir, { fetchFn: async () => ({ status: 200, ok: true, headers: new Map([['content-type', 'text/html; charset=utf-8']]), arrayBuffer: async () => Buffer.from('<html><head><title>x</title><script>böse()</script></head><body><h1>Titel</h1><p>Text &amp; mehr</p></body></html>') }) });
    web.fetch = web.fetch; // eslint-disable-line no-self-assign
    // Für den Test die DNS-Prüfung mit einer öffentlichen IP umgehen
    assert.match(await web.ausfuehren('WebFetch', { url: 'http://93.184.216.34/' }), /Titel\s+Text & mehr/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Zugangsdaten: Speicher, Verschlüsselung über den Host, nie im Klartext in den Einstellungen', async () => {
  const { Geheim } = require('../server/geheim');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-geheim-'));
  try {
    const g = new Geheim(dir);
    assert.strictEqual(await g.get('deepseek'), '');
    await g.set('deepseek', 'sk-abcdefghijklmnop1234');
    assert.strictEqual(await g.get('deepseek'), 'sk-abcdefghijklmnop1234');
    assert.strictEqual(await g.hinweis('deepseek'), '…1234');
    assert.strictEqual(new Geheim(dir).cache, null);
    assert.strictEqual(await new Geheim(dir).get('deepseek'), 'sk-abcdefghijklmnop1234', 'bleibt nach Neustart erhalten');
    if (process.platform !== 'win32') assert.strictEqual(fs.statSync(path.join(dir, 'zugang.json')).mode & 0o777, 0o600);
    // Mit Schlüsselbund des Systems (hier nachgebaut): in der Datei steht nichts Lesbares
    const host = { verschluesselnMoeglich: () => true, verschluesseln: (t) => Buffer.from(t).reverse().toString('base64'), entschluesseln: (b) => Buffer.from(b, 'base64').reverse().toString() };
    const g2 = new Geheim(path.join(dir, 'sicher'), host);
    await g2.set('deepseek', 'sk-geheimgeheimgeheim99');
    assert.ok(!fs.readFileSync(path.join(dir, 'sicher', 'zugang.json'), 'utf8').includes('sk-geheim'));
    assert.strictEqual(await new Geheim(path.join(dir, 'sicher'), host).get('deepseek'), 'sk-geheimgeheimgeheim99');
    await g.entfernen('deepseek');
    assert.strictEqual(await g.get('deepseek'), '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DeepSeek: Agent-Schleife mit Werkzeugen, Verlauf, Fehler und Abbruch', async () => {
  const fake = require('./fixtures/fake-deepseek');
  const { Geheim } = require('../server/geheim');
  const f = await fake.start({ skript: (req) => {
    const letzte = req.messages[req.messages.length - 1];
    if (/FEHLER401/.test(letzte.content || '')) return { status: 401, meldung: 'Authentication Fails' };
    if (/FEHLER402/.test(letzte.content || '')) return { status: 402, meldung: 'Insufficient Balance' };
    if (/FEHLER500/.test(letzte.content || '')) return { status: 500 };
    if (/DENKEN/.test(JSON.stringify(req.messages.slice(-1)))) return { reasoning: 'Ich überlege.', text: 'Ergebnis nach Nachdenken.' };
    const tools = req.messages.filter((m) => m.role === 'tool').length;
    if (letzte.role === 'user' && /NOTIZ/.test(letzte.content)) return { tools: [{ name: 'Skill', args: { skill: 'natuerlich-schreiben' } }, { name: 'Write', args: { file_path: '01_themenfindung_und_mindmap/notiz.md', content: 'Hallo\nWelt' } }] };
    if (letzte.role === 'tool' && tools === 2) return { text: 'Notiz gespeichert.' };
    return { text: `Antwort ${req.messages.length}` };
  } });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-ds-'));
  process.env.MANGO_DEEPSEEK_URL = f.url;
  delete require.cache[require.resolve('../server/providers/deepseek')];
  const ds = require('../server/providers/deepseek');
  try {
    const g = new Geheim(dir);
    await g.set('deepseek', f.key);
    ds.init({ geheim: g });
    const ws = path.join(dir, 'ws');
    fs.mkdirSync(path.join(ws, '.claude', 'skills', 'natuerlich-schreiben'), { recursive: true });
    fs.mkdirSync(path.join(ws, '01_themenfindung_und_mindmap'), { recursive: true });
    fs.writeFileSync(path.join(ws, '.claude', 'skills', 'natuerlich-schreiben', 'SKILL.md'), '# Skill\nKurz schreiben');
    // Erkennung
    assert.strictEqual((await ds.detect()).status, 'bereit');
    assert.strictEqual((await ds.pruefeSchluessel(f.key)).ok, true);
    assert.strictEqual((await ds.pruefeSchluessel('sk-falsch-falsch-falsch')).ok, false);
    // Lauf mit Werkzeugen
    const ev = [];
    const r = await ds.run({}, { cwd: ws, prompt: 'Mach eine NOTIZ', rulesText: 'Regeln', onEvent: (e) => ev.push(e) }).done;
    assert.strictEqual(r.error, null);
    assert.strictEqual(r.text, 'Notiz gespeichert.');
    assert.deepStrictEqual(ev.filter((e) => e.type === 'activity').map((e) => e.item.kind), ['skill', 'schreiben']);
    assert.strictEqual(ev.find((e) => e.type === 'activity').item.skill, 'natuerlich-schreiben');
    assert.strictEqual(fs.readFileSync(path.join(ws, '01_themenfindung_und_mindmap', 'notiz.md'), 'utf8'), 'Hallo\nWelt');
    assert.deepStrictEqual(f.calls[0].tools.map((t) => t.function.name), ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'WebFetch', 'ai_tell_scan']);
    assert.deepStrictEqual(f.calls[0].thinking, { type: 'disabled' });
    assert.match(f.calls[0].messages[0].content, /^Regeln[\s\S]*Werkzeuge in dieser Umgebung/);
    assert.deepStrictEqual(f.calls[1].messages.map((m) => m.role), ['system', 'user', 'assistant', 'tool', 'tool']);
    assert.strictEqual(f.calls[1].messages[3].tool_call_id, f.calls[1].messages[2].tool_calls[0].id);
    assert.match(f.calls[1].messages[3].content, /Skill „natuerlich-schreiben“ geladen/);
    // Verlauf wird fortgesetzt
    const r2 = await ds.run({}, { cwd: ws, prompt: 'Und weiter', sessionId: r.sessionId, resume: true, rulesText: 'Regeln', onEvent: () => {} }).done;
    assert.strictEqual(r2.text, 'Antwort 7');
    assert.strictEqual(ds.run({}, { cwd: ws, prompt: 'x', sessionId: 'gibtsnicht', resume: true, onEvent: () => {} }) && (await ds.run({}, { cwd: ws, prompt: 'x', sessionId: 'gibtsnicht', resume: true, onEvent: () => {} }).done).errorKind, 'sitzung');
    // Nachdenken (Gründlichkeit hoch) schickt reasoning_effort und gibt reasoning_content mit zurück
    const r3 = await ds.run({}, { cwd: ws, prompt: 'DENKEN', effort: 'high', onEvent: () => {} }).done;
    assert.strictEqual(r3.text, 'Ergebnis nach Nachdenken.');
    const letzte = f.calls[f.calls.length - 1];
    assert.deepStrictEqual([letzte.thinking, letzte.reasoning_effort], [{ type: 'enabled' }, 'high']);
    const r4 = await ds.run({}, { cwd: ws, prompt: 'noch DENKEN', sessionId: r3.sessionId, resume: true, effort: 'high', onEvent: () => {} }).done;
    const vorletzte = f.calls[f.calls.length - 1].messages.find((m) => m.role === 'assistant' && m.reasoning_content);
    assert.strictEqual(vorletzte.reasoning_content, 'Ich überlege.', 'reasoning_content wird zurückgeschickt');
    assert.strictEqual(r4.error, null);
    // Fehler
    const e401 = await ds.run({}, { cwd: ws, prompt: 'FEHLER401', onEvent: () => {} }).done;
    assert.deepStrictEqual([e401.errorKind, e401.retryable], ['anmeldung', false]);
    assert.match(e401.error, /Schlüssel wurde abgelehnt/);
    const e402 = await ds.run({}, { cwd: ws, prompt: 'FEHLER402', onEvent: () => {} }).done;
    assert.deepStrictEqual([e402.errorKind, e402.retryable], ['limit', false]);
    assert.match(e402.error, /Guthaben/);
    const e500 = await ds.run({}, { cwd: ws, prompt: 'FEHLER500', onEvent: () => {} }).done;
    assert.deepStrictEqual([e500.errorKind, e500.retryable], ['netz', true]);
    // Kein Schlüssel
    await g.entfernen('deepseek');
    assert.strictEqual((await ds.run({}, { cwd: ws, prompt: 'x', onEvent: () => {} }).done).errorKind, 'anmeldung');
    assert.strictEqual((await ds.detect()).status, 'anmeldung_noetig');
    assert.strictEqual((await ds.detect()).hint.aktion, 'schluessel');
    // Abbruch
    await g.set('deepseek', f.key);
    const h = ds.run({}, { cwd: ws, prompt: 'lang', onEvent: () => {} });
    h.cancel();
    const rc = await h.done;
    assert.strictEqual(rc.canceled, true);
    assert.strictEqual(rc.error, null);
  } finally {
    delete process.env.MANGO_DEEPSEEK_URL;
    delete require.cache[require.resolve('../server/providers/deepseek')];
    f.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
