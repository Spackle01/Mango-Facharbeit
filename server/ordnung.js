'use strict';
// Ordnung im Arbeitsraum: erkennt Unordnung, räumt Mechanisches selbst auf (Reste, leere Ordner)
// und führt die Aufräum-Pläne des Assistenten aus (Block ```aufraeumen). Nichts wird gelöscht:
// Aussortiertes wandert in .facharbeit/papierkorb/ und lässt sich zurückholen.
const { fsp, path, ensureDir, exists, toPosix, resolveInside } = require('./util');
const ws = require('./workspace');

const MAX_EINTRAEGE = 100;
const ORDNER = /^(0[1-8]_[^/]+|abgabe)$/;
const ZIELE = /^(0[1-8]_[^/]+|abgabe)\//;
// Originale und Interna rührt das Aufräumen nie an.
const GESCHUETZT = /^(00_vorgaben|uebernommen|anhaenge)\//;
const ABGABE_FORMATE = /\.(docx|pdf|pptx|xlsx|zip)$/i;
const RESTE = /^(~\$.*|.*\.(tmp|bak|swp|crdownload)|\.DS_Store|Thumbs\.db|desktop\.ini)$/i;
const PLATZHALTER = /^(none|tmp|temp|test|neu|new|unbenannt.*|untitled.*|ohne ?titel.*)(\.\w+)?$/i;
const KOPIE = /(^|[ _-])(kopie|copy)( von)?\b|\(\d+\)(\.\w+)?$/i;

const BLOCK_RE = /```[ \t]*aufraeumen[^\n]*\n([\s\S]*?)(?:\n```|$)/gi;

function parsePlan(text) {
  const raw = String(text || '');
  const plan = [];
  let invalid = false;
  for (const m of raw.matchAll(BLOCK_RE)) {
    try {
      const j = JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, '$1'));
      for (const e of Array.isArray(j) ? j : [j]) {
        if (!e || typeof e !== 'object') continue;
        const clean = (v) => String(v || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
        if (e.verschieben && e.nach) plan.push({ aktion: 'verschieben', von: clean(e.verschieben), nach: clean(e.nach) });
        else if (e.archivieren) plan.push({ aktion: 'archivieren', von: clean(e.archivieren) });
      }
    } catch {
      invalid = true;
    }
  }
  return { text: raw.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim(), plan: plan.slice(0, MAX_EINTRAEGE), invalid };
}

// Versionsnummer im Namen: expose_v2.md → { stamm: 'expose', n: 2 }
function fassung(name) {
  const m = /^(.*?)[_ -]v(\d+)(\.\w+)?$/i.exec(name);
  return m ? { stamm: `${m[1]}${m[3] || ''}`.toLowerCase(), n: +m[2], ext: (m[3] || '').toLowerCase(), basis: m[1] } : null;
}

// Fundstellen: [{ path, grund, vorschlag }]. vorschlag: 'verschieben:<Ordner>' | 'archivieren' | 'pruefen'
function erkennen(files, { geschuetzt = [], seit = 0 } = {}) {
  const funde = [];
  const schutz = new Set(geschuetzt);
  const add = (path_, grund, vorschlag) => funde.push({ path: path_, grund, vorschlag });
  const versionen = new Map();
  for (const f of files) {
    if (GESCHUETZT.test(f.path) || f.path === 'FACHARBEIT.md' || schutz.has(f.path)) continue;
    const teile = f.path.split('/');
    const name = teile[teile.length - 1];
    const top = teile.length > 1 ? teile[0] : '';
    // Eigene Dateien, die schon vor dem Projekt im Ordner lagen, fasst die App nicht ungefragt an.
    const vorhanden = seit && f.mtime && f.mtime < seit;
    if (!top) {
      if (!vorhanden) add(f.path, 'liegt lose im Hauptordner', 'verschieben:Arbeitsordner');
      continue;
    }
    if (!ORDNER.test(top)) { if (!vorhanden) add(f.path, `liegt in einem Ordner, der nicht zur Struktur gehört („${top}“)`, 'verschieben:Arbeitsordner'); continue; }
    if (top === 'abgabe' && !ABGABE_FORMATE.test(name)) add(f.path, 'Entwurf oder Notiz in abgabe/ (dort gehören nur die fertigen Dateien hin)', 'verschieben:Arbeitsordner');
    else if (PLATZHALTER.test(name)) add(f.path, 'Platzhalter-Name (unklar, was drin ist)', 'pruefen');
    else if (KOPIE.test(name)) add(f.path, 'sieht nach einer Kopie aus', 'pruefen');
    const v = fassung(name);
    if (v) {
      const key = `${teile.slice(0, -1).join('/')}/${v.stamm}`;
      if (!versionen.has(key)) versionen.set(key, []);
      versionen.get(key).push({ path: f.path, n: v.n });
    }
  }
  for (const list of versionen.values()) {
    // Neuere Fassungen existieren: die älteren zum Archivieren vorschlagen (die erste Fassung ohne _v steht daneben).
    const max = Math.max(...list.map((x) => x.n));
    for (const x of list) if (x.n < max) add(x.path, `ältere Fassung (neuere: _v${max})`, 'archivieren');
  }
  return funde.slice(0, MAX_EINTRAEGE);
}

// Die Datei ohne „_vN“ gehört zu den Fassungen: expose.md neben expose_v2.md ist die älteste.
function aelterOhneNummer(files) {
  const funde = [];
  const set = new Set(files.map((f) => f.path));
  for (const f of files) {
    const v = fassung(f.path.split('/').pop());
    if (!v || GESCHUETZT.test(f.path)) continue;
    const dir = f.path.split('/').slice(0, -1).join('/');
    const urspruenglich = `${dir ? `${dir}/` : ''}${v.basis}${v.ext}`;
    if (set.has(urspruenglich) && !/^abgabe\//.test(urspruenglich)) funde.push({ path: urspruenglich, grund: `ältere Fassung (neuere: ${f.path.split('/').pop()})`, vorschlag: 'archivieren' });
  }
  return funde;
}

async function pruefen(project, files) {
  const stand = project.data.abgabe || {};
  const seit = (Date.parse(project.data.createdAt || '') || 0) - 60000;
  const funde = erkennen(files, { geschuetzt: [stand.lerntagebuch, stand.facharbeit].filter(Boolean), seit });
  for (const f of aelterOhneNummer(files)) if (!funde.some((x) => x.path === f.path)) funde.push(f);
  return funde.slice(0, MAX_EINTRAEGE);
}

function papierkorb(workspace, stamp) {
  return path.join(ws.internalDir(workspace), 'papierkorb', stamp);
}

function zeitstempel(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

async function verschiebe(von, nach) {
  await ensureDir(path.dirname(nach));
  try {
    await fsp.rename(von, nach);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fsp.copyFile(von, nach);
    await fsp.rm(von, { force: true });
  }
}

function schutzGrund(project, rel) {
  const stand = project.data.abgabe || {};
  if (!rel || rel.split('/').includes('..') || path.isAbsolute(rel)) return 'Ungültiger Pfad';
  if (GESCHUETZT.test(rel)) return 'Originale (00_vorgaben, uebernommen, anhaenge) bleiben unverändert';
  if (rel.startsWith('.') || rel === 'FACHARBEIT.md') return 'Interne Datei';
  if ([stand.lerntagebuch, stand.facharbeit].includes(rel)) return 'Das ist eine deiner Abgabe-Dateien';
  return '';
}

// Führt den Plan aus. Ergebnis je Eintrag: { aktion, von, nach?, ok, fehler? }
async function anwenden(project, plan) {
  const workspace = project.workspace;
  const stamp = zeitstempel();
  const out = [];
  for (const e of plan) {
    const r = { aktion: e.aktion, von: e.von, ok: false };
    try {
      const grund = schutzGrund(project, e.von);
      if (grund) throw new Error(grund);
      const abs = resolveInside(workspace, e.von);
      const st = abs ? await fsp.stat(abs).catch(() => null) : null;
      if (!st || !st.isFile()) throw new Error('Datei nicht gefunden');
      if (e.aktion === 'verschieben') {
        const ziel = e.nach.split('/').filter(Boolean).join('/');
        if (!ZIELE.test(ziel) || ziel.split('/').includes('..')) throw new Error('Ziel muss in abgabe/ oder 01_ bis 08_ liegen');
        const zabs = resolveInside(workspace, ziel);
        if (!zabs) throw new Error('Ungültiges Ziel');
        if (await exists(zabs)) throw new Error('Am Ziel liegt schon eine Datei');
        if (path.extname(ziel).toLowerCase() !== path.extname(e.von).toLowerCase()) throw new Error('Die Dateiendung muss gleich bleiben');
        await verschiebe(abs, zabs);
        r.nach = ziel;
      } else {
        const ziel = path.join(papierkorb(workspace, stamp), ...e.von.split('/'));
        await verschiebe(abs, ziel);
        r.nach = toPosix(path.relative(workspace, ziel));
      }
      r.ok = true;
    } catch (err) {
      r.fehler = err.message;
    }
    out.push(r);
  }
  await leereOrdnerEntfernen(workspace);
  return out;
}

// Macht ein Aufräumen rückgängig, soweit der alte Platz noch frei ist.
async function rueckgaengig(project, eintraege) {
  const workspace = project.workspace;
  let zurueck = 0;
  const fehler = [];
  for (const r of eintraege) {
    if (!r.ok || !r.nach) continue;
    try {
      const von = resolveInside(workspace, r.nach);
      const ziel = resolveInside(workspace, r.von);
      if (!von || !ziel || schutzGrund(project, r.von)) throw new Error('Ungültiger Pfad');
      if (!(await exists(von))) throw new Error('Datei nicht mehr am neuen Ort');
      if (await exists(ziel)) throw new Error('Der alte Platz ist belegt');
      await verschiebe(von, ziel);
      zurueck++;
    } catch (err) {
      fehler.push(`${r.von}: ${err.message}`);
    }
  }
  return { zurueck, fehler };
}

// Mechanisches Aufräumen ohne Rückfrage: Reste (Word-Sperrdateien, .tmp, .bak) und leere Ordner.
async function autoAufraeumen(project) {
  const workspace = project.workspace;
  let reste = 0;
  const stamp = zeitstempel();
  async function walk(dir, tief) {
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = toPosix(path.relative(workspace, abs));
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || ['node_modules'].includes(e.name) || GESCHUETZT.test(`${rel}/`)) continue;
        await walk(abs, tief + 1);
      } else if (e.isFile() && RESTE.test(e.name) && !GESCHUETZT.test(rel) && !rel.startsWith('.')) {
        // Gesperrte Dateien (z. B. ~$ von geöffnetem Word) lassen sich nicht verschieben: überspringen.
        try { await verschiebe(abs, path.join(papierkorb(workspace, stamp), ...rel.split('/'))); reste++; } catch { /* gesperrt */ }
      }
    }
  }
  await walk(workspace, 0);
  const leer = await leereOrdnerEntfernen(workspace);
  return { reste, leereOrdner: leer };
}

// Leere Unterordner in Arbeitsordnern entfernen (die Ordner 01_ bis 08_ und abgabe selbst bleiben).
async function leereOrdnerEntfernen(workspace) {
  let n = 0;
  async function walk(dir, tief) {
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return false; }
    let leer = true;
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && !GESCHUETZT.test(`${toPosix(path.relative(workspace, abs))}/`)) {
        if (!(await walk(abs, tief + 1))) leer = false;
      } else leer = false;
    }
    if (!leer || tief < 2) return false;
    try { await fsp.rmdir(dir); n++; return true; } catch { return false; }
  }
  for (const e of await fsp.readdir(workspace, { withFileTypes: true }).catch(() => [])) {
    if (e.isDirectory() && ORDNER.test(e.name)) await walk(path.join(workspace, e.name), 1);
  }
  return n;
}

// Kurzer Hinweis für den Projektkontext (leer, wenn alles in Ordnung ist).
function kontextText(funde) {
  if (!funde.length) return '';
  const L = ['Aufräumen nötig (Block `aufraeumen`, siehe Regeln). Fundstellen:'];
  for (const f of funde.slice(0, 15)) L.push(`- ${f.path}: ${f.grund}${f.vorschlag === 'archivieren' ? ' → archivieren' : f.vorschlag.startsWith('verschieben') ? ' → in den passenden Arbeitsordner verschieben' : ' → prüfen'}`);
  if (funde.length > 15) L.push(`- … und ${funde.length - 15} weitere`);
  return L.join('\n');
}

module.exports = { parsePlan, erkennen, pruefen, anwenden, rueckgaengig, autoAufraeumen, kontextText, fassung };
