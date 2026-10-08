'use strict';
// Übernahme einer bereits begonnenen Facharbeit: Dateien und Ordner unverändert in
// uebernommen/<Zeitpunkt>/ ablegen, ein Inventar erstellen (Lesbarkeit, Duplikate,
// mögliche Entwurfsstände, vermutliche Art) und den Analyseauftrag für den Assistenten bauen.
const crypto = require('crypto');
const {
  fsp, path, ensureDir, exists, toPosix, safeFileName, resolveInside, readJson, writeJsonAtomic,
  writeTextAtomic, formatDateDE, humanSize,
} = require('./util');
const ws = require('./workspace');
const { kindLabel } = require('./extract');

const IMPORT_ROOT = 'uebernommen';
const MAX_FILES = 2000;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

// Systemdateien und Zwischenstände, die nie übernommen werden.
function isJunk(relPath) {
  const parts = relPath.split('/');
  const name = parts[parts.length - 1];
  if (!name) return true;
  if (parts.some((p) => p === '__MACOSX' || p === '.git' || p === 'node_modules' || p === '.facharbeit')) return true;
  if (name.startsWith('.') || name.startsWith('~$') || name.startsWith('._')) return true;
  return /^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(name) || /\.(tmp|crdownload|part)$/i.test(name);
}

// Relativen Pfad aus dem Browser bereinigen: jede Ebene einzeln, keine Pfadausbrüche.
function cleanRelPath(rel) {
  const parts = String(rel || '').replace(/\\/g, '/').split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .map((p) => safeFileName(p));
  return parts.join('/');
}

function stampNow(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function metaDir(project, id) {
  return path.join(project.dir, 'import', id);
}

function validId(id) {
  return /^\d{4}-\d{2}-\d{2}_\d{4}(-\d+)?$/.test(String(id));
}

async function createImport(project) {
  let id = stampNow();
  let n = 2;
  while (await exists(path.join(project.workspace, IMPORT_ROOT, id))) { id = `${stampNow()}-${n}`; n += 1; }
  await ensureDir(path.join(project.workspace, IMPORT_ROOT, id));
  const status = { id, ordner: `${IMPORT_ROOT}/${id}`, erstellt: new Date().toISOString(), dateien: 0, bytes: 0, uebersprungen: [] };
  await writeJsonAtomic(path.join(metaDir(project, id), 'status.json'), status);
  return status;
}

async function loadStatus(project, id) {
  if (!validId(id)) throw Object.assign(new Error('Unbekannter Import'), { status: 404 });
  const st = await readJson(path.join(metaDir(project, id), 'status.json'), null);
  if (!st) throw Object.assign(new Error('Unbekannter Import'), { status: 404 });
  return st;
}

// Eine Datei des Imports speichern. relPath enthält ggf. Ordner (z. B. „Facharbeit/Kapitel/2.docx“).
async function addFile(project, id, relPath, readable, { lastModified } = {}) {
  const st = await loadStatus(project, id);
  const rel = cleanRelPath(relPath);
  const rawRel = String(relPath || '').replace(/\\/g, '/').split('/').filter((p) => p && p !== '.' && p !== '..').join('/');
  if (!rel || isJunk(rawRel) || isJunk(rel)) {
    st.uebersprungen.push({ pfad: String(relPath).slice(0, 200), grund: 'Systemdatei' });
    await writeJsonAtomic(path.join(metaDir(project, id), 'status.json'), st);
    for await (const chunk of readable) void chunk; // Daten verwerfen
    return { uebersprungen: true, grund: 'Systemdatei' };
  }
  if (st.dateien >= MAX_FILES) throw Object.assign(new Error(`Höchstens ${MAX_FILES} Dateien pro Übernahme.`), { status: 413 });
  const base = path.join(project.workspace, IMPORT_ROOT, id);
  let target = resolveInside(base, rel);
  if (!target) throw Object.assign(new Error('Ungültiger Dateipfad'), { status: 400 });
  await ensureDir(path.dirname(target));
  if (await exists(target)) {
    const ext = path.extname(target);
    const stem = target.slice(0, target.length - ext.length);
    let n = 2;
    while (await exists(`${stem} (${n})${ext}`)) n += 1;
    target = `${stem} (${n})${ext}`;
  }
  const handle = await fsp.open(target, 'w');
  let size = 0;
  try {
    for await (const chunk of readable) {
      size += chunk.length;
      if (size > MAX_FILE_BYTES) throw Object.assign(new Error(`${path.basename(target)} ist zu groß (maximal 200 MB).`), { status: 413 });
      if (st.bytes + size > MAX_TOTAL_BYTES) throw Object.assign(new Error('Die Übernahme ist zu groß (maximal 1 GB).'), { status: 413 });
      await handle.write(chunk);
    }
  } catch (err) {
    await handle.close();
    await fsp.rm(target, { force: true });
    throw err;
  }
  await handle.close();
  const mtime = Number(lastModified);
  if (Number.isFinite(mtime) && mtime > 0) {
    const d = new Date(mtime);
    await fsp.utimes(target, d, d).catch(() => {});
  }
  // Original schreibschützen: Arbeitskopien entstehen beim Einsortieren in den Ordnern 01_–08_.
  await fsp.chmod(target, 0o444).catch(() => {});
  st.dateien += 1;
  st.bytes += size;
  await writeJsonAtomic(path.join(metaDir(project, id), 'status.json'), st);
  return { pfad: toPosix(path.relative(project.workspace, target)), groesse: size };
}

// ---------- Inventar ----------

// Ordnervorschlag je vermuteter Art (der Assistent entscheidet endgültig).
const ORDNER = {
  vorgabe: '00_vorgaben/ (meist schon vorhanden)', lerntagebuch: '06_lerntagebuch_und_konsultationen/', expose: '02_expose_und_zeitplan/',
  zeitplan: '02_expose_und_zeitplan/', mindmap: '01_themenfindung_und_mindmap/', gliederung: '05_facharbeit_entwurf/',
  einleitung: '05_facharbeit_entwurf/', fazit: '05_facharbeit_entwurf/', entwurf: '05_facharbeit_entwurf/',
  literatur: '03_literatur_und_quellen/', eigenanteil: '04_forschung_und_eigenanteil/', praesentation: '08_praesentation_verteidigung/',
  ki: '07_ki_prompts_anhang/', notiz: '01_themenfindung_und_mindmap/',
};

const CATEGORIES = [
  ['vorgabe', 'Vorgabe oder Aufgabenstellung der Schule', /handreichung|zeitschiene|bewertungsbogen|arbeitsthemen|ki-unterst[üu]tzung|aufgabe[ _-]?(expos|mindmap)/i],
  ['lerntagebuch', 'Lerntagebuch', /lerntagebuch|lern-tagebuch|nachweisheft|betreuungsheft/i],
  ['expose', 'Exposé', /expos[eé]/i],
  ['mindmap', 'Mindmap', /mind[ _-]?map/i],
  ['gliederung', 'Gliederung', /gliederung|inhaltsverzeichnis|outline/i],
  ['zeitplan', 'Zeitplan', /zeitplan|alpen|arbeitsplan|meilenstein/i],
  ['einleitung', 'Einleitung', /einleitung/i],
  ['fazit', 'Fazit oder Schluss', /fazit|schlussteil|ausblick/i],
  ['literatur', 'Literatur und Quellen', /literatur|quellen|bibliograf|bibliograph|exzerpt|zitat/i],
  ['eigenanteil', 'Eigenanteil (Erhebung, Daten)', /fragebogen|umfrage|interview|transkript|auswertung|messung|messdaten|experiment|beobachtung|statistik/i],
  ['praesentation', 'Präsentation oder Verteidigung', /pr[äa]sentation|folien|verteidigung|kolloquium/i],
  ['ki', 'KI-Protokoll', /prompt|ki[-_ ]?protokoll|chatverlauf|gespr[äa]chsverlauf/i],
  ['entwurf', 'Entwurf der Facharbeit', /facharbeit|entwurf|kapitel|hauptteil|theorie|draft|reinschrift/i],
  ['notiz', 'Notizen oder Ideen', /notiz|ideen|brainstorm|handout|stichpunkt|themenvorschl/i],
];

function guessCategory(name, text) {
  for (const [id, label, re] of CATEGORIES) if (re.test(name)) return { id, label, sicher: true };
  const head = String(text || '').slice(0, 800);
  for (const [id, label, re] of CATEGORIES) if (re.test(head)) return { id, label, sicher: false };
  return null;
}

// Gemeinsamer Stamm für Entwurfsstände: „Facharbeit_v2 (1) - Kopie.docx“ → „facharbeit“.
function familyKey(fileName) {
  let s = fileName.toLowerCase().replace(/\.[a-z0-9]{1,5}$/, '');
  for (let i = 0; i < 6; i++) {
    const before = s;
    s = s.replace(/\s*\(\d+\)$/, '')
      .replace(/[\s_-]*(kopie|copy)(\s*\(?\d+\)?)?$/, '')
      .replace(/[\s_-]*(v|version|stand|fassung)[\s_.-]?\d+$/, '')
      .replace(/[\s_-]*(final|finale?|endg[üu]ltig|neu|alt|entwurf|überarbeitet|ueberarbeitet|korrigiert|korrektur|aktuell)$/, '')
      .replace(/[\s_-]*\d{4}[-_.]\d{1,2}[-_.]\d{1,2}$/, '')
      .replace(/[\s_-]*\d{1,2}[._-]\d{1,2}[._-]\d{2,4}$/, '')
      .replace(/[\s_-]+\d{1,2}$/, '')
      .trim();
    if (s === before) break;
  }
  return s.replace(/[\s_-]+/g, ' ').trim();
}

function countWords(text) {
  return (String(text || '').match(/[A-Za-zÄÖÜäöüß0-9][\wÄÖÜäöüß'’-]*/g) || []).length;
}

async function hashFile(abs) {
  return new Promise((resolve) => {
    const h = crypto.createHash('sha256');
    require('fs').createReadStream(abs).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', () => resolve(null));
  });
}

async function analyse(project, id, onProgress = () => {}, { fehlgeschlagen = [] } = {}) {
  const st = await loadStatus(project, id);
  // Dateien, die der Browser nicht senden konnte (gesperrt, verschoben, keine Berechtigung)
  const nichtUebernommen = (Array.isArray(fehlgeschlagen) ? fehlgeschlagen : []).slice(0, 200).map((f) => ({
    pfad: String((f && (f.rel || f.pfad)) || '').slice(0, 300),
    grund: String((f && (f.error || f.grund)) || 'Unbekannter Fehler').slice(0, 200),
  })).filter((f) => f.pfad);
  const prefix = `${st.ordner}/`;
  const all = await ws.listFiles(project.workspace, { limit: 8000 });
  const files = all.filter((f) => f.path.startsWith(prefix));
  const others = all.filter((f) => !f.path.startsWith(`${IMPORT_ROOT}/`) && f.path !== 'FACHARBEIT.md' && f.size < 60 * 1024 * 1024);

  // Hashes vorhandener Arbeitsraum-Dateien (für „bereits vorhanden“)
  const otherBySize = new Map();
  for (const f of others) {
    if (!otherBySize.has(f.size)) otherBySize.set(f.size, []);
    otherBySize.get(f.size).push(f);
  }

  const items = [];
  let i = 0;
  for (const f of files) {
    i += 1;
    onProgress({ phase: 'pruefen', aktuell: i, gesamt: files.length, datei: f.path.slice(prefix.length) });
    const abs = path.join(project.workspace, ...f.path.split('/'));
    const info = await ws.ensureExtract(project.workspace, f.path);
    let text = '';
    if (info.lesbar === 'ja' && info.extrakt) text = await fsp.readFile(path.join(project.workspace, ...info.extrakt.split('/')), 'utf8').catch(() => '');
    else if (info.lesbar === 'direkt' && ['markdown', 'text', 'tabelle'].includes(info.kind) && f.size < 5 * 1024 * 1024) text = await fsp.readFile(abs, 'utf8').catch(() => '');
    const hash = await hashFile(abs);
    let gleichWie = null;
    for (const o of otherBySize.get(f.size) || []) {
      if (o.hash === undefined) o.hash = await hashFile(path.join(project.workspace, ...o.path.split('/')));
      if (o.hash === hash) { gleichWie = o.path; break; }
    }
    items.push({
      pfad: f.path,
      relativ: f.path.slice(prefix.length),
      name: f.name,
      art: info.kind,
      artLabel: kindLabel(info.kind),
      groesse: f.size,
      geaendert: f.mtime,
      lesbar: info.lesbar,
      hinweis: info.hinweis || '',
      extrakt: info.extrakt || '',
      woerter: text ? countWords(text) : null,
      vermutlich: guessCategory(f.name, text),
      hash,
      familie: familyKey(f.name),
      gleichWie,
    });
  }

  // Exakte Duplikate innerhalb des Imports
  const byHash = new Map();
  for (const it of items) {
    if (!it.hash) continue;
    if (!byHash.has(it.hash)) byHash.set(it.hash, []);
    byHash.get(it.hash).push(it);
  }
  const duplikate = [...byHash.values()].filter((g) => g.length > 1).map((g) => g.map((x) => x.pfad));

  // Mögliche Entwurfsstände: gleicher Namensstamm, unterschiedlicher Inhalt
  const byFamily = new Map();
  for (const it of items) {
    if (!it.familie || it.familie.length < 3 || it.art === 'image') continue;
    if (!byFamily.has(it.familie)) byFamily.set(it.familie, []);
    byFamily.get(it.familie).push(it);
  }
  const versionen = [];
  for (const [familie, group] of byFamily) {
    const distinct = new Set(group.map((g) => g.hash));
    if (group.length < 2 || distinct.size < 2) continue;
    versionen.push({
      familie,
      dateien: group.sort((a, b) => a.geaendert - b.geaendert).map((g) => ({ pfad: g.pfad, geaendert: g.geaendert, woerter: g.woerter, art: g.artLabel })),
    });
  }

  const inventar = {
    id,
    ordner: st.ordner,
    erstellt: new Date().toISOString(),
    anzahl: items.length,
    bytes: items.reduce((s, x) => s + x.groesse, 0),
    ordnerListe: [...new Set(items.map((x) => x.relativ.split('/').slice(0, -1).join('/')).filter(Boolean))].slice(0, 100),
    uebersprungen: st.uebersprungen,
    nichtUebernommen,
    unlesbar: items.filter((x) => x.lesbar === 'nein').map((x) => ({ pfad: x.pfad, hinweis: x.hinweis })),
    duplikate,
    versionen,
    bereitsVorhanden: items.filter((x) => x.gleichWie).map((x) => ({ pfad: x.pfad, gleichWie: x.gleichWie })),
    dateien: items,
  };
  await writeJsonAtomic(path.join(metaDir(project, id), 'inventar.json'), inventar);
  await writeTextAtomic(path.join(metaDir(project, id), 'inventar.md'), inventoryMarkdown(inventar));
  onProgress({ phase: 'fertig', aktuell: items.length, gesamt: items.length });
  return inventar;
}

async function loadInventory(project, id) {
  if (!validId(id)) return null;
  return readJson(path.join(metaDir(project, id), 'inventar.json'), null);
}

function inventoryMarkdown(inv) {
  const L = [];
  L.push(`# Inventar der übernommenen Dateien (Übernahme ${inv.id})`);
  L.push('');
  L.push(`Ordner: \`${inv.ordner}/\` · ${inv.anzahl} Dateien · ${humanSize(inv.bytes)}. Die Dateien sind schreibgeschützte, unveränderte Originale.`);
  L.push('');
  L.push('## Hinweise der App');
  L.push('');
  if (inv.unlesbar.length) {
    L.push(`- Nicht lesbar (${inv.unlesbar.length}):`);
    for (const u of inv.unlesbar) L.push(`  - \`${u.pfad}\` – ${u.hinweis || 'nicht lesbar'}`);
  } else L.push('- Alle Dateien sind lesbar (direkt oder über einen Textauszug).');
  if (inv.duplikate.length) {
    L.push(`- Identische Dateien (Duplikate, ${inv.duplikate.length} Gruppen) – nur eine Datei je Gruppe lesen:`);
    for (const g of inv.duplikate) L.push(`  - ${g.map((p) => `\`${p}\``).join(' = ')}`);
  } else L.push('- Keine identischen Dateien.');
  if (inv.versionen.length) {
    L.push(`- Mögliche Entwurfsstände (${inv.versionen.length} Gruppen, gleicher Namensstamm, unterschiedlicher Inhalt; ältester zuerst):`);
    for (const v of inv.versionen) {
      L.push(`  - „${v.familie}“: ${v.dateien.map((d) => `\`${d.pfad}\` (${formatDateDE(new Date(d.geaendert))}${d.woerter ? `, ${d.woerter} Wörter` : ''})`).join('; ')}`);
    }
  } else L.push('- Keine Hinweise auf mehrere Entwurfsstände anhand der Dateinamen.');
  if (inv.bereitsVorhanden.length) {
    L.push('- Bereits identisch im Arbeitsraum vorhanden (z. B. Schulvorgaben):');
    for (const b of inv.bereitsVorhanden) L.push(`  - \`${b.pfad}\` = \`${b.gleichWie}\``);
  }
  if (inv.nichtUebernommen && inv.nichtUebernommen.length) {
    L.push(`- Nicht übernommen, weil die Datei nicht gesendet werden konnte (${inv.nichtUebernommen.length}) – Inhalt unbekannt:`);
    for (const f of inv.nichtUebernommen) L.push(`  - ${f.pfad} – ${f.grund}`);
  }
  if (inv.uebersprungen.length) L.push(`- Übersprungen (Systemdateien): ${inv.uebersprungen.length}`);
  L.push('');
  L.push('## Dateien');
  L.push('');
  L.push('Spalte „Vermutlich“: Einschätzung der App aus Dateiname bzw. Textanfang (mit ? = nur aus dem Text, unsicher).');
  L.push('');
  L.push('| Datei | Typ | Vermutlich | Ordnervorschlag | Geändert | Umfang | Lesen über |');
  L.push('|---|---|---|---|---|---|---|');
  for (const it of inv.dateien.slice(0, 400)) {
    const lesen = it.lesbar === 'ja' ? `\`${it.extrakt}\`` : it.lesbar === 'direkt' ? 'Datei direkt' : `NICHT LESBAR: ${it.hinweis}`;
    const verm = it.vermutlich ? `${it.vermutlich.label}${it.vermutlich.sicher ? '' : ' ?'}` : '–';
    const umfang = it.woerter != null ? `${it.woerter} Wörter` : humanSize(it.groesse);
    const ordner = it.vermutlich ? ORDNER[it.vermutlich.id] || '–' : '–';
    L.push(`| \`${it.pfad}\` | ${it.artLabel} | ${verm} | ${ordner} | ${formatDateDE(new Date(it.geaendert))} | ${umfang} | ${lesen} |`);
  }
  if (inv.dateien.length > 400) L.push(`| … | weitere ${inv.dateien.length - 400} Dateien | | | | | |`);
  L.push('');
  return L.join('\n');
}

// Auftrag an den Assistenten. Er darf nur lesen; die App speichert die Ergebnisse.
// Auftrag an den Assistenten: einsortieren, aktualisieren, zusammenfassen.
function importPrompt(inv, { bisher = null } = {}) {
  const nachtrag = bisher && bisher.zusammenfassung
    ? `\nEs gibt schon einen übernommenen Stand (Projektkontext, \`.facharbeit/uebernahme.md\`). Das hier ist neues Material: Gleiche es damit ab. \`zusammenfassung\`, \`vorhanden\`, \`fehlt\` und \`naechsterSchritt\` beschreiben danach den gesamten Stand.\n`
    : '';
  return `<einsortieren id="${inv.id}" ordner="${inv.ordner}/">
Die Schülerin bzw. der Schüler hat Material zur Facharbeit hineingezogen: ${inv.anzahl} Dateien${inv.ordnerListe.length ? ` aus ${inv.ordnerListe.length} Ordnern` : ''}. Die Originale liegen schreibgeschützt in \`${inv.ordner}/\` und bleiben unverändert.
Lies zuerst das Inventar der App: \`.facharbeit/import/${inv.id}/inventar.md\` (Art, Datum, Umfang, Lesbarkeit, Textauszug, Duplikate, Entwurfsstände, Ordnervorschlag) und den Skill \`bestehende-arbeit-uebernehmen\`.
${nachtrag}
Auftrag:
1. Lies nur, was du brauchst: Textauszüge statt Binärdateien, von identischen Dateien nur eine. Vorgaben gezielt in \`00_vorgaben/anforderungen.md\` nachschlagen.
2. Einsortieren: Lege im Block \`einsortieren\` für jede brauchbare Datei fest, wohin sie gehört (Ordner 01_ bis 08_, klarer Dateiname). Die App kopiert bzw. wandelt wortgetreu um – schreib die Inhalte dafür nicht selbst ab.
3. Aktualisieren: Ergänze vorhandene Arbeitsdateien nur, wo es nötig ist (z. B. neue Quellen in \`03_literatur_und_quellen/literaturliste.md\`), ohne Texte der Person umzuformulieren. In \`uebernommen/\` nichts ändern.
4. Erkenne Thema, Fragestellung, Gliederung, Texte mit Umfang, Quellen, Eigenanteil und Ergebnisse. Übernimm erkennbare Projektangaben (nur aus den eigenen Dateien, keine Platzhalter oder Beispieldaten aus Vorlagen).
5. Gleiche mit den Vorgaben ab und aktualisiere den Arbeitsstand: erledigt nur, was du geprüft hast; Nachweis ist die einsortierte Datei.
6. Mehrere Fassungen derselben Datei: nur die eindeutig aktuelle einsortieren; ist das unklar, keine davon einsortieren und fragen.
7. Antworte kurz auf Deutsch: zwei bis vier Sätze, danach höchstens drei gezielte Fragen.
8. Hänge ans Ende je genau einen Block \`einsortieren\`, \`arbeitsstand\` und \`uebernahme\` (Formate im Skill).
</einsortieren>`;
}

// ---------- Ergebnis-Block des Assistenten ----------

const BLOCK_RE = /```[ \t]*uebernahme[^\n]*\n([\s\S]*?)(?:\n```|$)/gi;

function asList(v, max = 12) {
  if (!Array.isArray(v)) return typeof v === 'string' && v.trim() ? [v.trim()] : [];
  return v.map((x) => (typeof x === 'string' ? x : x && (x.text || x.punkt || JSON.stringify(x)))).filter(Boolean).map((x) => String(x).slice(0, 400)).slice(0, max);
}

function parseResult(text) {
  const raw = String(text || '');
  let result = null;
  let invalid = false;
  for (const m of raw.matchAll(BLOCK_RE)) {
    try {
      const j = JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, '$1'));
      result = {
        zusammenfassung: String(j.zusammenfassung || '').slice(0, 6000),
        vorhanden: asList(j.vorhanden),
        fehlt: asList(j.fehlt),
        naechsterSchritt: String(j.naechsterSchritt || j.naechster_schritt || '').slice(0, 600),
        unsicher: asList(j.unsicher),
        versionen: (Array.isArray(j.versionen) ? j.versionen : []).slice(0, 10).map((v) => ({
          dateien: asList(v && v.dateien, 8),
          frage: String((v && v.frage) || '').slice(0, 400),
        })).filter((v) => v.dateien.length),
      };
    } catch {
      invalid = true;
    }
  }
  const clean = raw.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text: clean, result, invalid };
}

function summaryMarkdown(u) {
  const L = [];
  L.push('# Übernommener Stand der Facharbeit');
  L.push('');
  const importe = u.importe || [{ ordner: u.ordner, anzahl: u.anzahl, am: u.am }];
  if (importe.length > 1) {
    L.push(`Stand vom ${formatDateDE(u.am, { withTime: true })}, ${u.anzahl} Dateien aus ${importe.length} Übernahmen. Von der App aus der Analyse des Assistenten gespeichert.`);
    L.push('');
    importe.forEach((i) => L.push(`- ${formatDateDE(i.am, { withTime: true })}: \`${i.ordner}/\` (${i.anzahl} Dateien)`));
  } else {
    L.push(`Übernahme vom ${formatDateDE(u.am, { withTime: true })} aus \`${u.ordner}/\` (${u.anzahl} Dateien). Von der App aus der Analyse des Assistenten gespeichert.`);
  }
  L.push('');
  if (u.zusammenfassung) { L.push('## Zusammenfassung'); L.push(''); L.push(u.zusammenfassung); L.push(''); }
  if (u.vorhanden.length) { L.push('## Das ist bereits vorhanden'); L.push(''); u.vorhanden.forEach((x) => L.push(`- ${x}`)); L.push(''); }
  if (u.fehlt.length) { L.push('## Das fehlt noch'); L.push(''); u.fehlt.forEach((x) => L.push(`- ${x}`)); L.push(''); }
  if (u.naechsterSchritt) { L.push('## Nächster Schritt'); L.push(''); L.push(u.naechsterSchritt); L.push(''); }
  if (u.unsicher.length) { L.push('## Unsicher, bitte prüfen'); L.push(''); u.unsicher.forEach((x) => L.push(`- ${x}`)); L.push(''); }
  if (u.versionen.length) {
    L.push('## Offene Fragen zu Entwurfsständen');
    L.push('');
    u.versionen.forEach((v) => L.push(`- ${v.frage || 'Welche Fassung ist aktuell?'} (${v.dateien.map((d) => `\`${d}\``).join(', ')})`));
    L.push('');
  }
  if (u.entscheidungen && u.entscheidungen.length) {
    L.push('## Festgelegte aktuelle Fassungen');
    L.push('');
    u.entscheidungen.forEach((e) => L.push(`- \`${e.gewaehlt}\` (statt ${e.dateien.filter((d) => d !== e.gewaehlt).map((d) => `\`${d}\``).join(', ') || '–'})`));
    L.push('');
  }
  if (u.unlesbar && u.unlesbar.length) { L.push('## Nicht lesbare Dateien'); L.push(''); u.unlesbar.forEach((x) => L.push(`- \`${x.pfad}\`: ${x.hinweis}`)); L.push(''); }
  if (u.nichtUebernommen && u.nichtUebernommen.length) { L.push('## Nicht übernommene Dateien'); L.push(''); u.nichtUebernommen.forEach((x) => L.push(`- ${x.pfad}: ${x.grund}`)); L.push(''); }
  return L.join('\n');
}

function mergeByPath(a, b) {
  const seen = new Set();
  return [...(a || []), ...(b || [])].filter((x) => x && x.pfad && !seen.has(x.pfad) && seen.add(x.pfad));
}

// Speichert den übernommenen Stand. Bei weiteren Übernahmen bleiben frühere
// Übernahmen, getroffene Entscheidungen und Lesbarkeitsbefunde erhalten.
async function saveSummary(project, inv, result) {
  const prev = project.data.uebernahme || null;
  const importe = prev ? (prev.importe || [{ id: prev.importId, ordner: prev.ordner, anzahl: prev.anzahl, am: prev.am }]) : [];
  const now = new Date().toISOString();
  const alle = [...importe.filter((i) => i.id !== inv.id), { id: inv.id, ordner: inv.ordner, anzahl: inv.anzahl, am: now }];
  const entscheidungen = (prev && prev.entscheidungen) || [];
  const key = (arr) => [...arr].sort().join('\n');
  const entschieden = (v) => entscheidungen.some((e) => key(e.dateien) === key(v.dateien) || v.dateien.includes(e.gewaehlt));
  const u = {
    importId: inv.id,
    ordner: inv.ordner,
    anzahl: alle.reduce((s, i) => s + (i.anzahl || 0), 0),
    importe: alle,
    am: now,
    zusammenfassung: result.zusammenfassung,
    vorhanden: result.vorhanden,
    fehlt: result.fehlt,
    naechsterSchritt: result.naechsterSchritt,
    unsicher: result.unsicher,
    versionen: result.versionen.filter((v) => !entschieden(v)),
    entscheidungen,
    unlesbar: mergeByPath(prev && prev.unlesbar, inv.unlesbar),
    nichtUebernommen: mergeByPath(prev && prev.nichtUebernommen, inv.nichtUebernommen),
  };
  project.data.uebernahme = u;
  await project.saveProject();
  await writeTextAtomic(path.join(project.dir, 'uebernahme.md'), summaryMarkdown(u));
  return u;
}

// Die Person hat festgelegt, welche Fassung aktuell ist: offene Frage schließen und merken.
async function chooseVersion(project, dateien, gewaehlt) {
  const u = project.data.uebernahme;
  if (!u) throw Object.assign(new Error('Es gibt keine übernommene Arbeit.'), { status: 404 });
  const liste = asList(dateien, 8);
  if (!liste.includes(gewaehlt)) throw Object.assign(new Error('Diese Datei gehört nicht zur Auswahl.'), { status: 400 });
  const key = (arr) => [...arr].sort().join('\n');
  u.versionen = (u.versionen || []).filter((v) => key(v.dateien) !== key(liste) && !v.dateien.includes(gewaehlt));
  u.entscheidungen = (u.entscheidungen || []).filter((e) => key(e.dateien) !== key(liste));
  u.entscheidungen.push({ dateien: liste, gewaehlt, am: new Date().toISOString() });
  const andere = liste.filter((d) => d !== gewaehlt);
  await project.addMerken([`Aktuelle Fassung: \`${gewaehlt}\`${andere.length ? ` (ältere oder andere Fassungen: ${andere.map((d) => `\`${d}\``).join(', ')})` : ''}`], 'nutzer');
  await project.saveProject();
  await writeTextAtomic(path.join(project.dir, 'uebernahme.md'), summaryMarkdown(u));
  return u;
}

// Für die Anzeige: deterministische Befunde der App, ergänzt um das Ergebnis des Assistenten.
function displayResult(inv, result, einsortiert = []) {
  return {
    einsortiert,
    importId: inv.id,
    ordner: inv.ordner,
    anzahl: inv.anzahl,
    bytes: inv.bytes,
    unlesbar: inv.unlesbar,
    nichtUebernommen: inv.nichtUebernommen || [],
    duplikate: inv.duplikate,
    appVersionen: inv.versionen.map((v) => ({ familie: v.familie, dateien: v.dateien.map((d) => d.pfad) })),
    bereitsVorhanden: inv.bereitsVorhanden,
    ...(result || { zusammenfassung: '', vorhanden: [], fehlt: [], naechsterSchritt: '', unsicher: [], versionen: [] }),
    analysiert: !!result,
  };
}

module.exports = {
  IMPORT_ROOT, isJunk, cleanRelPath, familyKey, guessCategory, countWords, createImport, loadStatus, addFile,
  analyse, loadInventory, inventoryMarkdown, importPrompt, parseResult, saveSummary, chooseVersion, displayResult, validId,
  summaryMarkdown,
};
