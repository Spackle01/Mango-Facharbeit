'use strict';
// Abgabe-Dateien: Arbeitskopien der Dateien, die am Ende abgegeben werden (Lerntagebuch der
// Schule, Facharbeit als Word-Datei). Die Originale der Schule bleiben in 00_vorgaben/ geschützt;
// gearbeitet wird in abgabe/. Änderungen des Assistenten an Word-Dateien führt die App aus
// (Block ```word), damit die Formatierung der Vorlage erhalten bleibt.
const crypto = require('crypto');
const { fsp, path, ensureDir, exists, toPosix, resolveInside, safeFileName, formatDateDE } = require('./util');
const ws = require('./workspace');
const word = require('./word');
const { facharbeitToDocx, markdownToDocx } = require('./docx');

const ORDNER = 'abgabe';
// Word-Dateien, die der Assistent über die App bearbeiten darf (keine Originale).
const BEARBEITBAR = /^(abgabe|0[1-8]_[^/]+)\/.+\.docx$/i;
const MAX_BILD = 20 * 1024 * 1024;

// „Max Mustermann“ → „Mustermann_Max“ (Dateiname wie von der Schule empfohlen)
function namensteil(name) {
  const teile = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (teile.length < 2) return teile[0] ? safeFileName(teile[0]) : '';
  return safeFileName(`${teile[teile.length - 1]}_${teile.slice(0, -1).join('_')}`);
}

// Deckblatt der Lerntagebuch-Vorlage mit den bekannten Angaben füllen (Platzhalter der Schule).
async function vorausfuellen(buf, a) {
  const d = new word.WordDoc(buf);
  const texte = d.paras.map((p) => word.paraInfo(p.node).text.replace(/\s+/g, ' ').trim());
  const nr = (fn) => { const i = texte.findIndex(fn); return i >= 0 ? i + 1 : null; };
  const ops = [];
  const add = (n, op) => { if (n) ops.push({ ersetzen: n, ...op }); };
  if (a.fach) add(nr((t) => /^im Fach \.\.\.$/.test(t)), { alt: '...', text: a.fach });
  if (a.titel) add(nr((t) => t === 'Thema der Facharbeit'), { text: a.titel });
  if (a.name) add(nr((t) => t === 'Vorname, Nachname'), { text: a.name });
  if (a.klasse) add(nr((t) => /^Klasse: \.\.\.$/.test(t)), { alt: '...', text: a.klasse });
  if (a.lehrkraft) add(nr((t) => /Anrede \(Vorname\) Nachname$/.test(t)), { alt: 'Anrede (Vorname) Nachname', text: a.lehrkraft });
  if (!ops.length) return buf;
  const r = await word.apply(buf, ops);
  return r.buffer || buf;
}

async function sameFile(a, b) {
  const [x, y] = await Promise.all([fsp.readFile(a).catch(() => null), fsp.readFile(b).catch(() => null)]);
  return !!(x && y && x.equals(y));
}

// Teile der Facharbeit: vorhandene Kapitel aus 05_facharbeit_entwurf/ (ältere Arbeitsräume),
// sonst die Kapitelvorlagen der App.
async function facharbeitTeile(project) {
  const { chapterFiles } = require('./export');
  let files = (await chapterFiles(project)).filter((f) => f.prefix !== '00' && f.prefix !== '01');
  if (!files.length) {
    const dir = path.join(ws.RES, 'vorlagen', 'facharbeit');
    files = (await fsp.readdir(dir)).filter((n) => /^\d{2}_.*\.md$/.test(n) && !/^0[01]_/.test(n)).sort()
      .map((name) => ({ name, abs: path.join(dir, name) }));
  }
  const teile = [];
  for (const f of files) teile.push({ name: f.name, markdown: await fsp.readFile(f.abs, 'utf8') });
  return teile;
}

// Legt fehlende Abgabe-Dateien einmalig an. Hat die Person eine davon gelöscht oder umbenannt,
// wird sie nicht erneut erzeugt.
async function ensureAbgabe(project) {
  const workspace = project.workspace;
  const dir = path.join(workspace, ORDNER);
  await ensureDir(dir);
  const stand = project.data.abgabe || {};
  const teil = namensteil(project.data.angaben.name);
  let geaendert = false;

  if (!stand.lerntagebuch) {
    const rel = `${ORDNER}/${teil ? `Lerntagebuch_${teil}` : 'Lerntagebuch'}.docx`;
    const ziel = path.join(workspace, ...rel.split('/'));
    if (!(await exists(ziel))) {
      const vorlage = path.join(ws.RES, 'vorgaben', 'Lerntagebuch-Vorlage.docx');
      // Ältere Arbeitsräume: eine bereits ausgefüllte Kopie in 06_ hat Vorrang.
      const alt = path.join(workspace, '06_lerntagebuch_und_konsultationen', 'Lerntagebuch-Vorlage.docx');
      const quelle = (await exists(alt)) && !(await sameFile(alt, vorlage)) ? alt : vorlage;
      let buf = await fsp.readFile(quelle);
      if (quelle === vorlage) buf = await vorausfuellen(buf, project.data.angaben).catch(() => buf);
      await fsp.writeFile(ziel, buf);
    }
    stand.lerntagebuch = rel;
    geaendert = true;
  }

  if (!stand.facharbeit) {
    const rel = `${ORDNER}/${teil ? `Facharbeit_${teil}` : 'Facharbeit'}.docx`;
    const ziel = path.join(workspace, ...rel.split('/'));
    if (!(await exists(ziel))) {
      const buf = facharbeitToDocx({ angaben: project.data.angaben, teile: await facharbeitTeile(project), datum: formatDateDE(new Date()) });
      await fsp.writeFile(ziel, buf);
    }
    stand.facharbeit = rel;
    geaendert = true;
  }

  if (geaendert) {
    project.data.abgabe = stand;
    await project.saveProject();
  }
  return stand;
}

// Abgabe-Dateien mit aktueller Fassung mit Absatznummern (für den Projektkontext).
async function listeFuerKontext(project, files) {
  const out = [];
  for (const f of files.filter((x) => x.path.startsWith(`${ORDNER}/`)).slice(0, 30)) {
    const e = { path: f.path, mtime: f.mtime };
    if (/\.docx$/i.test(f.path)) {
      const info = await ws.ensureExtract(project.workspace, f.path).catch(() => null);
      if (info && info.extrakt) e.extrakt = info.extrakt;
    }
    out.push(e);
  }
  return out;
}

function gesperrt(err) {
  return ['EBUSY', 'EPERM', 'EACCES'].includes(err && err.code);
}

async function schreiben(abs, buf) {
  const tmp = `${abs}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fsp.writeFile(tmp, buf);
  try {
    await fsp.rename(tmp, abs);
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

// Führt die Word-Änderungen aus einer Antwort aus. Ergebnis je Datei:
// { datei, aktion: 'bearbeitet'|'neu', ok, gesamt, fehler: [{was, fehler}], version?, gesperrt?, hinweis? }
async function anwenden(project, dateien) {
  const workspace = project.workspace;
  const results = [];
  for (const e of dateien) {
    const r = { datei: e.datei, aktion: e.neu ? 'neu' : 'bearbeitet', ok: 0, gesamt: e.neu ? 1 : e.ops.length, fehler: [] };
    try {
      if (e.datei.split('/').includes('..') || !BEARBEITBAR.test(e.datei)) {
        throw new Error('Bearbeitet werden nur Word-Dateien in abgabe/ oder 01_ bis 08_. Originale (00_vorgaben/, uebernommen/, anhaenge/) bleiben unverändert – bei Bedarf erst einsortieren.');
      }
      const abs = resolveInside(workspace, e.datei);
      if (!abs) throw new Error('Ungültiger Pfad');
      if (e.neu) {
        if (await exists(abs)) throw new Error('Die Datei gibt es schon – Änderungen bitte mit Absatznummern angeben');
        if (!e.text.trim()) throw new Error('Kein Text für die neue Datei');
        await ensureDir(path.dirname(abs));
        await schreiben(abs, markdownToDocx(e.text, { title: path.basename(abs, '.docx'), author: project.data.angaben.name || '' }));
        r.ok = 1;
      } else {
        const alt = await fsp.readFile(abs).catch(() => null);
        if (!alt) throw new Error('Datei nicht gefunden');
        if (!e.ops.length) throw new Error('Keine Änderungen angegeben');
        const res = await word.apply(alt, e.ops, {
          bildLaden: async (rel) => {
            const clean = String(rel).replace(/\\/g, '/').replace(/^\.\//, '');
            const b = resolveInside(workspace, clean);
            if (!b || clean.startsWith('.facharbeit/')) throw new Error('Ungültiger Bildpfad');
            const st = await fsp.stat(b).catch(() => null);
            if (!st) throw new Error(`Bild „${clean}“ nicht gefunden`);
            if (st.size > MAX_BILD) throw new Error('Bild ist zu groß (maximal 20 MB)');
            return fsp.readFile(b);
          },
        });
        r.ok = res.ok;
        r.fehler = res.results.filter((x) => x.fehler).map((x) => ({ was: x.was, fehler: x.fehler }));
        if (res.buffer) {
          await schreiben(abs, res.buffer);
          r.version = await ws.saveVersion(workspace, e.datei, alt);
        }
      }
      await ws.ensureExtract(workspace, e.datei).catch(() => {});
    } catch (err) {
      if (gesperrt(err)) {
        r.gesperrt = true;
        r.ok = 0;
        r.hinweis = 'Die Datei ist gerade geöffnet (z. B. in Word). Schließe sie und trage die Änderungen erneut ein.';
      } else {
        r.hinweis = err.message;
      }
    }
    results.push(r);
  }
  return results;
}

module.exports = { ORDNER, BEARBEITBAR, ensureAbgabe, anwenden, listeFuerKontext, namensteil };
