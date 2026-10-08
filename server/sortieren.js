'use strict';
// Einsortieren mitgebrachter Dateien. Der Assistent entscheidet nur, wohin eine Datei gehört
// (Block ```einsortieren). Kopieren und Umwandeln übernimmt die App: wortgetreu, ohne
// Originale zu verändern und ohne vorhandene Dateien ungesichert zu überschreiben.
const { fsp, path, ensureDir, exists, toPosix, safeFileName, resolveInside, formatDateDE } = require('./util');
const ws = require('./workspace');
const { docxToText, odtToText } = require('./extract');

const MAX_EINTRAEGE = 200;
// Quellen: nur mitgebrachte Originale (Drop-in) und Chat-Anhänge.
const QUELLEN = /^(uebernommen|anhaenge)\//;
// Ziele: die Arbeitsordner 01_ bis 08_ (auch Unterordner).
const ZIELE = /^0[1-8]_[^/]+\//;
const UMWANDELBAR = { '.docx': docxToText, '.docm': docxToText, '.odt': odtToText };
const TEXT = new Set(['.md', '.markdown', '.txt']);

const BLOCK_RE = /```[ \t]*einsortieren[^\n]*\n([\s\S]*?)(?:\n```|$)/gi;

// Liest den Plan aus der Antwort und entfernt den Block aus dem sichtbaren Text.
function parsePlan(text) {
  const raw = String(text || '');
  let plan = [];
  let invalid = false;
  for (const m of raw.matchAll(BLOCK_RE)) {
    try {
      const j = JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, '$1'));
      const list = Array.isArray(j) ? j : Array.isArray(j.dateien) ? j.dateien : [];
      for (const e of list) {
        if (!e || typeof e !== 'object') continue;
        const von = String(e.von || e.quelle || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
        const nach = String(e.nach || e.ziel || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
        if (von && nach) plan.push({ von, nach, ersetzen: e.ersetzen === true });
      }
    } catch {
      invalid = true;
    }
  }
  plan = plan.slice(0, MAX_EINTRAEGE);
  return { text: raw.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim(), plan, invalid };
}

function cleanTarget(rel) {
  if (rel.split('/').includes('..') || path.isAbsolute(rel)) return null; // keine Pfadausbrüche
  const parts = rel.split('/').filter((p) => p && p !== '.');
  if (parts.length < 2) return null;
  const file = parts.pop();
  const ext = path.extname(file);
  const stem = safeFileName(file.slice(0, file.length - ext.length)) || 'datei';
  return [...parts.map((p) => safeFileName(p)), `${stem}${ext.toLowerCase()}`].join('/');
}

// Freier Name für eine neue Fassung: expose.md → expose_v2.md → expose_v3.md
async function nextVersionPath(workspace, rel) {
  const ext = path.extname(rel);
  const stem = rel.slice(0, rel.length - ext.length).replace(/_v\d+$/, '');
  for (let n = 2; n < 100; n++) {
    const cand = `${stem}_v${n}${ext}`;
    if (!(await exists(path.join(workspace, ...cand.split('/'))))) return cand;
  }
  throw new Error('Kein freier Dateiname');
}

async function convert(srcAbs, srcRel, extSrc) {
  const buf = await fsp.readFile(srcAbs);
  const body = TEXT.has(extSrc) ? buf.toString('utf8') : UMWANDELBAR[extSrc](buf);
  if (!body.trim()) throw new Error('Kein Text gefunden');
  const note = `<!-- Arbeitskopie von „${path.basename(srcRel)}“ (${srcRel}), erstellt am ${formatDateDE(new Date())}. Das Original bleibt unverändert. -->`;
  return `${note}\n\n${body.trim()}\n`;
}

// Führt den Plan aus. Ergebnis je Eintrag: { von, nach, aktion, version?, fehler? }
async function applyPlan(project, plan) {
  const workspace = project.workspace;
  const results = [];
  const used = new Set();
  for (const e of plan.slice(0, MAX_EINTRAEGE)) {
    const r = { von: e.von, nach: e.nach };
    try {
      if (!QUELLEN.test(e.von)) throw new Error('Quelle muss in uebernommen/ oder anhaenge/ liegen');
      const srcAbs = resolveInside(workspace, e.von);
      if (!srcAbs || !(await exists(srcAbs))) throw new Error('Quelle nicht gefunden');
      let target = cleanTarget(e.nach);
      if (!target || !ZIELE.test(target)) throw new Error('Ziel muss in einem der Ordner 01_ bis 08_ liegen');
      const extSrc = path.extname(srcAbs).toLowerCase();
      const extDst = path.extname(target).toLowerCase();
      const umwandeln = extDst === '.md' && extSrc !== '.md' && (UMWANDELBAR[extSrc] || TEXT.has(extSrc));
      if (!umwandeln && extSrc !== extDst) throw new Error(`${extSrc || 'ohne Endung'} lässt sich nicht als ${extDst || 'ohne Endung'} ablegen`);
      let abs = resolveInside(workspace, target);
      if (!abs) throw new Error('Ungültiges Ziel');
      let version = null;
      const vorhanden = await exists(abs);
      if (vorhanden && (!e.ersetzen || used.has(target))) {
        target = await nextVersionPath(workspace, target);
        abs = resolveInside(workspace, target);
      } else if (vorhanden) {
        // Bewusst ersetzen: vorherige Fassung sichern wie bei Änderungen des Assistenten.
        version = await ws.saveVersion(workspace, target, await fsp.readFile(abs));
      }
      await ensureDir(path.dirname(abs));
      if (umwandeln) await fsp.writeFile(abs, await convert(srcAbs, e.von, extSrc), 'utf8');
      else await fsp.copyFile(srcAbs, abs);
      used.add(target);
      Object.assign(r, { nach: toPosix(target), aktion: umwandeln ? 'umgewandelt' : 'kopiert' });
      if (version) Object.assign(r, { ersetzt: true, version });
    } catch (err) {
      r.fehler = err.message;
    }
    results.push(r);
  }
  return results;
}

module.exports = { parsePlan, applyPlan, QUELLEN };
