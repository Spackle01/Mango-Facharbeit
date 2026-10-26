'use strict';
// Vereinfachte Vorschau von Dateien für die Anzeige in der App: Text, Word, PowerPoint, Excel.
// PDF und Bilder zeigt die Oberfläche direkt. Die Vorschau ersetzt nicht das Öffnen im Programm.
const { fsp } = require('./util');
const { readZip } = require('./zip');
const word = require('./word');
const { folienAlsHtml } = require('./pptxrender');
const { kindOf } = require('./extract');

const MAX_TEXT = 200 * 1024;
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_FOLIEN = 80;
const MAX_ZEILEN = 100;
const MAX_SPALTEN = 15;

const decode = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const paras = (xml) => [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)].map((m) => ({
  text: decode([...m[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join('')),
  ebene: +((/<a:pPr[^>]*\blvl="(\d)"/.exec(m[1]) || [])[1] || 0),
  punkt: /<a:buChar\b/.test(m[1]),
})).filter((p) => p.text.trim());
const relTargets = (xml) => Object.fromEntries([...xml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [(/\bId="([^"]+)"/.exec(m[0]) || [])[1], (/\bTarget="([^"]+)"/.exec(m[0]) || [])[1]]));
const norm = (base, target) => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const p of target.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); }
  return parts.join('/');
};

function pptx(buf) {
  const z = readZip(buf);
  const text = (n) => { const b = z.read(n); return b ? b.toString('utf8') : ''; };
  const pres = text('ppt/presentation.xml');
  const prels = relTargets(text('ppt/_rels/presentation.xml.rels'));
  const ids = [...pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
  const folien = [];
  for (const rid of ids.slice(0, MAX_FOLIEN)) {
    const name = prels[rid] ? norm('ppt/presentation.xml', prels[rid]) : null;
    if (!name) continue;
    const xml = text(name);
    const rels = relTargets(text(name.replace(/([^/]+)$/, '_rels/$1.rels')));
    let titel = '';
    const zeilen = [];
    for (const m of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
      const istTitel = /<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(m[1]);
      const ps = paras(m[1]);
      if (istTitel) titel = ps.map((p) => p.text).join(' ');
      else zeilen.push(...ps);
    }
    const tabellen = [...xml.matchAll(/<a:tbl>([\s\S]*?)<\/a:tbl>/g)].map((t) => [...t[1].matchAll(/<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g)].map((r) => [...r[1].matchAll(/<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g)].map((c) => paras(c[1]).map((p) => p.text).join(' '))));
    const notizRel = Object.values(rels).find((t) => /notesSlide/.test(t));
    const notizen = notizRel ? paras(text(norm(name, notizRel))).map((p) => p.text).join('\n') : '';
    folien.push({ titel, zeilen, tabellen, bilder: (xml.match(/<p:pic>/g) || []).length, notizen });
  }
  return { typ: 'folien', folien, gesamt: ids.length };
}

function xlsx(buf) {
  const z = readZip(buf);
  const text = (n) => { const b = z.read(n); return b ? b.toString('utf8') : ''; };
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode([...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  const wb = text('xl/workbook.xml');
  const rels = relTargets(text('xl/_rels/workbook.xml.rels'));
  const blaetter = [];
  for (const m of [...wb.matchAll(/<sheet\b[^>]*>/g)].slice(0, 10)) {
    const name = decode((/\bname="([^"]*)"/.exec(m[0]) || [])[1] || 'Blatt');
    const target = rels[(/r:id="([^"]+)"/.exec(m[0]) || [])[1]];
    if (!target) continue;
    const xml = text(norm('xl/workbook.xml', target));
    const rows = [];
    for (const r of [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].slice(0, MAX_ZEILEN)) {
      const row = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /\br="([A-Z]+)\d+"/.exec(c[1]);
        if (!ref) continue;
        let col = 0;
        for (const ch of ref[1]) col = col * 26 + ch.charCodeAt(0) - 64;
        if (col > MAX_SPALTEN) continue;
        const t = /\bt="(\w+)"/.exec(c[1]);
        const body = c[2] || '';
        let v = '';
        if (t && t[1] === 's') v = shared[+((/<v>(\d+)<\/v>/.exec(body) || [])[1])] || '';
        else if (t && t[1] === 'inlineStr') v = decode([...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
        else v = decode((/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1] || '');
        row[col - 1] = v;
      }
      rows.push(Array.from(row, (x) => x || ''));
    }
    blaetter.push({ name, rows });
  }
  return { typ: 'tabelle', blaetter };
}

// Liefert { typ, … } oder { typ: 'keine', hinweis }. typ: pdf | bild | text | word | folien | tabelle
async function erzeugen(abs, name) {
  const kind = kindOf(name);
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  const st = await fsp.stat(abs);
  if (kind === 'pdf') return { typ: 'pdf' };
  if (kind === 'image') return { typ: 'bild' };
  if (kind === 'markdown' || kind === 'text' || ext === '.csv' || ext === '.tsv') {
    const fh = await fsp.open(abs, 'r');
    try {
      const buf = Buffer.alloc(Math.min(st.size, MAX_TEXT));
      await fh.read(buf, 0, buf.length, 0);
      return { typ: 'text', text: buf.toString('utf8'), gekuerzt: st.size > MAX_TEXT, markdown: kind === 'markdown' };
    } finally { await fh.close(); }
  }
  if (st.size > MAX_BYTES) return { typ: 'keine', hinweis: 'Die Datei ist zu groß für die Vorschau.' };
  try {
    if (['.docx', '.docm'].includes(ext)) return { typ: 'word', ...word.vorschau(await fsp.readFile(abs)) };
    if (ext === '.pptx') {
      const buf = await fsp.readFile(abs);
      const text = pptx(buf);
      // Gezeichnete Folien (wie in PowerPoint); bei Fehlern bleibt die Textansicht.
      try { text.seiten = folienAlsHtml(buf); } catch { /* Textansicht */ }
      return text;
    }
    if (['.xlsx', '.xlsm'].includes(ext)) return xlsx(await fsp.readFile(abs));
  } catch {
    return { typ: 'keine', hinweis: 'Die Datei lässt sich nicht lesen. Öffne sie im Programm.' };
  }
  return { typ: 'keine', hinweis: 'Für diesen Dateityp gibt es keine Vorschau. Öffne die Datei im Programm.' };
}

module.exports = { erzeugen };
