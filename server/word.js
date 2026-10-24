'use strict';
// Bearbeiten vorhandener Word-Dateien (.docx), ohne die Formatierung der Vorlage zu verlieren.
// Der Assistent sieht eine Fassung mit Absatznummern und nennt im Block ```word, was sich
// ändern soll (ersetzen, einfügen, Tabellenzeile, Bild, löschen). Die App führt das aus.
const { readZip, writeZip } = require('./zip');

// ---------- Minimales XML-Modell (Attribute bleiben als Rohtext erhalten) ----------

const TOKEN_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=]+\s*=\s*(?:"[^"]*"|'[^']*'))*)(\s*)(\/?)>|[^<]+/g;

function parseXml(str) {
  const root = { t: 'root', children: [] };
  const stack = [root];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(str))) {
    const top = stack[stack.length - 1];
    if (m[1]) {
      if (top.name !== m[1]) throw new Error(`XML nicht lesbar (</${m[1]}>)`);
      stack.pop();
    } else if (m[2]) {
      const node = { t: 'el', name: m[2], attrs: m[3] || '', ws: m[4] || '', self: !!m[5], children: [], parent: top };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else {
      top.children.push({ t: 'raw', v: m[0], parent: top });
    }
  }
  if (stack.length !== 1) throw new Error('XML nicht lesbar (unvollständig)');
  return root;
}

function serialize(node) {
  if (node.t === 'raw') return node.v;
  if (node.t === 'root') return node.children.map(serialize).join('');
  const ws = node.ws || '';
  if (!node.children.length && node.self !== false) return `<${node.name}${node.attrs}${ws}/>`;
  return `<${node.name}${node.attrs}${ws}>${node.children.map(serialize).join('')}</${node.name}>`;
}

function fragment(xml, parent) {
  const r = parseXml(xml);
  for (const c of r.children) c.parent = parent;
  return r.children;
}

function clone(node, parent = null) {
  const c = { ...node, parent };
  if (node.children) c.children = node.children.map((x) => clone(x, c));
  return c;
}

const kids = (n, name) => (n.children || []).filter((c) => c.t === 'el' && (!name || c.name === name));
const kid = (n, name) => kids(n, name)[0] || null;

function find(n, name) {
  for (const c of n.children || []) {
    if (c.t !== 'el') continue;
    if (c.name === name) return c;
    const f = find(c, name);
    if (f) return f;
  }
  return null;
}

function attr(n, name) {
  const m = new RegExp(`\\s${name.replace(':', '\\:')}\\s*=\\s*"([^"]*)"`).exec(n.attrs || '');
  return m ? m[1] : null;
}

function remove(n) {
  const i = n.parent.children.indexOf(n);
  if (i >= 0) n.parent.children.splice(i, 1);
}

function insertAfter(ref, nodes) {
  const list = ref.parent.children;
  const i = list.indexOf(ref);
  for (const n of nodes) n.parent = ref.parent;
  list.splice(i + 1, 0, ...nodes);
}

function insertBefore(ref, nodes) {
  const list = ref.parent.children;
  const i = list.indexOf(ref);
  for (const n of nodes) n.parent = ref.parent;
  list.splice(i, 0, ...nodes);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

// Kennungen von Word (w14:paraId usw.) müssen eindeutig sein: in Kopien entfernen.
function stripIds(n) {
  if (n.t !== 'el') return n;
  n.attrs = n.attrs.replace(/\s+w14:(paraId|textId)\s*=\s*"[^"]*"/g, '');
  for (const c of n.children) stripIds(c);
  return n;
}

// ---------- Absätze und Tabellen der Reihe nach ----------

// Inhalte von Textfeldern, Grafiken oder gelöschtem Text zählen nicht als eigene Absätze.
const NICHT_BETRETEN = new Set(['w:p', 'w:sectPr', 'w:txbxContent', 'w:drawing', 'w:pict', 'mc:AlternateContent', 'w:del']);

function enumerate(body) {
  const paras = [];
  const tables = [];
  function walk(node, tbl) {
    for (const c of node.children) {
      if (c.t !== 'el') continue;
      if (c.name === 'w:p') {
        paras.push({ node: c, tbl });
        continue;
      }
      if (c.name === 'w:tbl') {
        const t = { node: c, nr: tables.length + 1 };
        tables.push(t);
        kids(c, 'w:tr').forEach((tr, ri) => {
          kids(tr, 'w:tc').forEach((tc, ci) => walk(tc, { nr: t.nr, z: ri + 1, s: ci + 1 }));
          // Inhaltssteuerelemente um Zellen
          for (const sdt of kids(tr, 'w:sdt')) walk(sdt, { nr: t.nr, z: ri + 1, s: 0 });
        });
        continue;
      }
      if (NICHT_BETRETEN.has(c.name)) continue;
      walk(c, tbl);
    }
  }
  walk(body, null);
  return { paras, tables };
}

// Text eines Absatzes (Tabulator → \t, Zeilenumbruch → \n) und ob er eine Grafik enthält.
function paraInfo(p) {
  let text = '';
  let bild = false;
  let feld = false;
  function walk(n) {
    for (const c of n.children) {
      if (c.t !== 'el') continue;
      if (c.name === 'w:pPr' || c.name === 'w:del' || c.name === 'w:rPr') continue;
      if (c.name === 'w:drawing' || c.name === 'w:pict' || c.name === 'mc:AlternateContent' || c.name === 'w:object') { bild = true; continue; }
      if (c.name === 'w:instrText' || c.name === 'w:fldChar') { feld = true; continue; }
      if (c.name === 'w:t') text += decode(c.children.map((x) => (x.t === 'raw' ? x.v : '')).join(''));
      else if (c.name === 'w:tab') text += '\t';
      else if (c.name === 'w:br' || c.name === 'w:cr') text += /w:type="page"/.test(c.attrs) ? '' : '\n';
      else if (c.name === 'w:noBreakHyphen') text += '-';
      else walk(c);
    }
  }
  walk(p);
  return { text, bild, feld };
}

function styleOf(p) {
  const pPr = kid(p, 'w:pPr');
  const st = pPr && kid(pPr, 'w:pStyle');
  return st ? attr(st, 'w:val') : null;
}

// Formatvorlagen: styleId → Name (heading 1, Title, toc 1 …)
function readStyles(xml) {
  const map = new Map();
  if (!xml) return map;
  const re = /<w:style\b[^>]*w:type="paragraph"[^>]*>[\s\S]*?<\/w:style>/g;
  let m;
  while ((m = re.exec(xml))) {
    const id = /w:styleId="([^"]+)"/.exec(m[0]);
    const name = /<w:name w:val="([^"]+)"/.exec(m[0]);
    if (id) map.set(id[1], (name ? name[1] : id[1]).toLowerCase());
  }
  return map;
}

function headingLevel(styleId, styles) {
  if (!styleId) return 0;
  const name = styles.get(styleId) || styleId.toLowerCase();
  if (name === 'title' || name === 'titel') return 1;
  const m = /^(?:heading|überschrift|berschrift)\s*(\d)$/.exec(name) || /^(?:heading|berschrift|überschrift)(\d)$/i.exec(styleId);
  return m ? +m[1] : 0;
}

function headingStyleId(level, styles) {
  for (const [id, name] of styles) if (name === `heading ${level}`) return id;
  return null;
}

function isTocStyle(styleId, styles) {
  const name = styleId && (styles.get(styleId) || styleId.toLowerCase());
  return !!name && /^(toc|verzeichnis)\s*\d/.test(name);
}

class WordDoc {
  constructor(buffer) {
    this.zip = readZip(buffer);
    const raw = this.zip.read('word/document.xml');
    if (!raw) throw new Error('Keine Word-Datei (word/document.xml fehlt)');
    let xml = raw.toString('utf8');
    this.bom = xml.charCodeAt(0) === 0xfeff;
    if (this.bom) xml = xml.slice(1);
    this.root = parseXml(xml);
    this.body = find(this.root, 'w:body');
    if (!this.body) throw new Error('Keine Word-Datei (w:body fehlt)');
    const st = this.zip.read('word/styles.xml');
    this.styles = readStyles(st ? st.toString('utf8') : '');
    this.extra = new Map(); // geänderte oder neue Paketteile
    const e = enumerate(this.body);
    this.paras = e.paras;
    this.tables = e.tables;
  }

  part(name) {
    if (this.extra.has(name)) return this.extra.get(name);
    const b = this.zip.read(name);
    return b ? b.toString('utf8') : null;
  }

  toBuffer() {
    const doc = (this.bom ? '﻿' : '') + serialize(this.root);
    const files = [];
    const seen = new Set();
    for (const name of this.zip.names()) {
      seen.add(name);
      if (name === 'word/document.xml') files.push({ name, data: doc });
      else if (this.extra.has(name)) files.push({ name, data: this.extra.get(name) });
      else files.push({ name, data: this.zip.read(name) });
    }
    for (const [name, data] of this.extra) if (!seen.has(name)) files.push({ name, data });
    return writeZip(files);
  }
}

// ---------- Fassung mit Absatznummern für den Assistenten ----------

function nummeriert(buffer, { datei = '' } = {}) {
  const d = new WordDoc(buffer);
  const L = [];
  L.push(`Word-Datei: ${datei} – Fassung mit Absatznummern (von der App erstellt, nur lesen).`);
  L.push('Ändern: Block ```word mit diesen Nummern (siehe Regeln). [n] = Absatz n, „(leer)“ = leere Zeile, z. B. zum Ausfüllen.');
  L.push('');
  let lastTbl = 0;
  d.paras.forEach((p, i) => {
    const n = i + 1;
    const info = paraInfo(p.node);
    if (p.tbl && p.tbl.nr !== lastTbl) {
      const t = d.tables[p.tbl.nr - 1];
      const rows = kids(t.node, 'w:tr');
      const cols = Math.max(0, ...rows.map((r) => kids(r, 'w:tc').length));
      L.push(`Tabelle ${t.nr} (${rows.length} Zeilen × ${cols} Spalten; neue Zeile anhängen: {"zeile":${t.nr},"zellen":[…]}):`);
    }
    if (!p.tbl && lastTbl) L.push('');
    lastTbl = p.tbl ? p.tbl.nr : 0;
    let text = info.text.replace(/\t/g, ' ').replace(/\n/g, ' ⏎ ').replace(/\s+$/, '');
    const lvl = headingLevel(styleOf(p.node), d.styles);
    if (lvl && text.trim()) text = `${'#'.repeat(Math.min(6, lvl))} ${text.trim()}`;
    if (info.bild) text = `${text ? `${text} ` : ''}[Bild]`;
    if (!text.trim()) text = '(leer)';
    const pos = p.tbl ? `T${p.tbl.nr} Z${p.tbl.z} S${p.tbl.s}: ` : '';
    L.push(`[${n}] ${pos}${text}`);
  });
  return L.join('\n');
}

// ---------- Neue Läufe und Absätze ----------

// Hervorhebungen gehören zum Text, nicht zur Vorlage des neuen Absatzes.
const BETONUNG = new Set(['w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:u', 'w:color', 'w:highlight', 'w:shd', 'w:caps', 'w:smallCaps', 'w:vanish', 'w:rStyle', 'w:strike', 'w:dstrike']);

function baseRPr(p, { neutral = false } = {}) {
  let rPr = null;
  (function walk(n) {
    for (const c of n.children) {
      if (rPr || c.t !== 'el') continue;
      if (c.name === 'w:pPr') continue;
      if (c.name === 'w:r') {
        if (find(c, 'w:t')) rPr = kid(c, 'w:rPr');
        if (find(c, 'w:t') && !rPr) rPr = { t: 'el', name: 'w:rPr', attrs: '', children: [] };
      } else if (!NICHT_BETRETEN.has(c.name)) walk(c);
    }
  }(p));
  if (!rPr) {
    const pPr = kid(p, 'w:pPr');
    rPr = pPr && kid(pPr, 'w:rPr');
  }
  if (!rPr) return '';
  const c = clone(rPr);
  c.children = c.children.filter((x) => x.t === 'el' && !['w:ins', 'w:del', 'w:rPrChange', 'w:moveFrom', 'w:moveTo'].includes(x.name) && !(neutral && BETONUNG.has(x.name)));
  return c.children.length ? serialize(c) : '';
}

// Nur **fett** und *kursiv*; Unterstriche bleiben Text (Dateinamen wie Lerntagebuch_Name_Vorname).
function inline(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\*(?![\s*])(.+?)(?<!\s)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: m[1], b: true });
    else out.push({ t: m[2], i: true });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

function runsXml(text, rPr) {
  const inner = rPr ? rPr.replace(/^<w:rPr>|<\/w:rPr>$|^<w:rPr\/>$/g, '') : '';
  return inline(String(text)).map((r) => {
    let props = inner;
    if (r.b && !/<w:b\/>|<w:b /.test(props)) props += '<w:b/>';
    if (r.i && !/<w:i\/>|<w:i /.test(props)) props += '<w:i/>';
    const rp = props ? `<w:rPr>${props}</w:rPr>` : '';
    return String(r.t).split('\n').map((line, i) => {
      const parts = line.split('\t').map((seg, k) => `${k ? '<w:tab/>' : ''}${seg ? `<w:t xml:space="preserve">${esc(seg)}</w:t>` : ''}`).join('');
      return `<w:r>${rp}${i ? '<w:br/>' : ''}${parts}</w:r>`;
    }).join('');
  }).join('');
}

// Absatzformat als Vorlage für eingefügte Absätze: ohne Abschnittswechsel, Überschrift oder Liste.
function basePPr(p, styles, { liste = false } = {}) {
  const pPr = p && kid(p, 'w:pPr');
  if (!pPr) return '';
  const c = clone(pPr);
  c.children = c.children.filter((x) => {
    if (x.t !== 'el') return false;
    if (['w:sectPr', 'w:pPrChange', 'w:framePr', 'w:outlineLvl', 'w:pageBreakBefore'].includes(x.name)) return false;
    if (x.name === 'w:numPr') return liste;
    if (x.name === 'w:pStyle') {
      const id = attr(x, 'w:val');
      return !(headingLevel(id, styles) || isTocStyle(id, styles));
    }
    return true;
  });
  return c.children.length ? serialize(c) : '';
}

function hasNum(p) {
  const pPr = p && kid(p, 'w:pPr');
  return !!(pPr && kid(pPr, 'w:numPr'));
}

// Markdown-artiger Text → Absätze. Leerzeile trennt Absätze, „#“ wird zur Überschrift der Datei.
function paragraphsXml(text, { pPr, pPrListe, rPr, styles }) {
  const out = [];
  const blocks = String(text).replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n');
    let buf = [];
    const flush = () => {
      if (!buf.length) return;
      out.push(`<w:p>${pPr}${runsXml(buf.join('\n'), rPr)}</w:p>`);
      buf = [];
    };
    for (const line of lines) {
      const h = /^(#{1,6})\s+(.*)$/.exec(line.trim());
      const li = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(line);
      if (h) {
        flush();
        const id = headingStyleId(Math.min(9, h[1].length), styles);
        const text2 = h[2].replace(/\s*#+\s*$/, '');
        if (id) out.push(`<w:p><w:pPr><w:pStyle w:val="${esc(id)}"/></w:pPr>${runsXml(text2, '')}</w:p>`);
        else out.push(`<w:p>${pPr}${runsXml(`**${text2}**`, rPr)}</w:p>`);
      } else if (li) {
        flush();
        const zahl = /\d/.test(li[1]);
        if (pPrListe && !zahl) out.push(`<w:p>${pPrListe}${runsXml(li[2], rPr)}</w:p>`);
        else out.push(`<w:p>${pPr}${runsXml(`${zahl ? li[1] : '–'} ${li[2]}`, rPr)}</w:p>`);
      } else if (line.trim() || buf.length) {
        buf.push(line.replace(/\s+$/, ''));
      }
    }
    flush();
  }
  return out.length ? out.join('') : `<w:p>${pPr}</w:p>`;
}

// Inhalt eines Absatzes leeren: Absatzformat, Textmarken und Grafiken bleiben.
function clearText(p) {
  p.children = p.children.filter((c) => {
    if (c.t !== 'el') return false;
    if (c.name === 'w:pPr' || c.name === 'w:bookmarkStart' || c.name === 'w:bookmarkEnd') return true;
    if (c.name === 'w:r' && (find(c, 'w:drawing') || find(c, 'w:pict') || find(c, 'mc:AlternateContent'))) return true;
    return false;
  });
}

function appendRuns(p, xml) {
  // Vor einer abschließenden Textmarke einfügen wäre egal; einfach anhängen.
  p.children.push(...fragment(xml, p));
}

// Teiltext ersetzen, auch wenn er über mehrere Läufe verteilt ist.
function replaceSubstring(p, alt, neu) {
  const texts = [];
  (function walk(n) {
    for (const c of n.children) {
      if (c.t !== 'el' || c.name === 'w:pPr' || c.name === 'w:del' || NICHT_BETRETEN.has(c.name)) continue;
      if (c.name === 'w:t') texts.push(c);
      else walk(c);
    }
  }(p));
  const vals = texts.map((t) => decode(t.children.map((x) => (x.t === 'raw' ? x.v : '')).join('')));
  const full = vals.join('');
  let start = full.indexOf(alt);
  let len = alt.length;
  if (start < 0) {
    // Mehrfache Leerzeichen der Vorlage tolerieren.
    const re = new RegExp(alt.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    const m = re.exec(full);
    if (!m) return false;
    start = m.index;
    len = m[0].length;
  }
  const end = start + len;
  let pos = 0;
  let placed = false;
  texts.forEach((t, i) => {
    const v = vals[i];
    const a = pos;
    const b = pos + v.length;
    pos = b;
    if (b <= start || a >= end) return;
    const keepL = v.slice(0, Math.max(0, start - a));
    const keepR = v.slice(Math.max(0, end - a));
    const nv = placed ? keepL + keepR : keepL + neu + keepR;
    placed = true;
    t.attrs = ' xml:space="preserve"';
    t.children = nv ? [{ t: 'raw', v: esc(nv), parent: t }] : [];
  });
  return placed;
}

// ---------- Bilder ----------

function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { ext: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') return { ext: 'gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { ext: 'jpeg', w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

const EMU_CM = 360000;
const CONTENT_TYPE = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif' };

function addImage(d, buf, name, breiteCm) {
  const info = imageSize(buf);
  if (!info || !info.w || !info.h) throw new Error('Bild nicht lesbar (nur PNG, JPG oder GIF)');
  const maxCm = 16;
  let wCm = Number(breiteCm) > 0 ? Math.min(Number(breiteCm), maxCm) : Math.min(maxCm, (info.w / 96) * 2.54);
  let hCm = (wCm * info.h) / info.w;
  if (hCm > 22) { wCm = (wCm * 22) / hCm; hCm = 22; }
  const cx = Math.round(wCm * EMU_CM);
  const cy = Math.round(hCm * EMU_CM);

  const relsName = 'word/_rels/document.xml.rels';
  let rels = d.part(relsName) || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  let n = 1;
  while (new RegExp(`Id="rIdMango${n}"`).test(rels) || d.zip.has(`word/media/mango_bild${n}.${info.ext}`) || d.extra.has(`word/media/mango_bild${n}.${info.ext}`)) n++;
  const rid = `rIdMango${n}`;
  const media = `media/mango_bild${n}.${info.ext}`;
  rels = rels.replace(/<\/Relationships>\s*$/, `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${media}"/></Relationships>`);
  d.extra.set(relsName, rels);
  d.extra.set(`word/${media}`, buf);
  const ctName = '[Content_Types].xml';
  let ct = d.part(ctName);
  if (ct && !new RegExp(`<Default\\s+Extension="${info.ext}"`, 'i').test(ct)) {
    ct = ct.replace(/(<Types\b[^>]*>)/, `$1<Default Extension="${info.ext}" ContentType="${CONTENT_TYPE[info.ext]}"/>`);
    d.extra.set(ctName, ct);
  }
  const ids = [...serialize(d.root).matchAll(/<(?:wp:docPr|pic:cNvPr)\s[^>]*\bid="(\d+)"/g)].map((m) => +m[1]);
  const docPr = Math.max(0, ...ids, ...(d.docPrIds || [])) + 1;
  d.docPrIds = [...(d.docPrIds || []), docPr];
  const safe = esc(name);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPr}" name="Bild ${docPr}" descr="${safe}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPr}" name="${safe}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// ---------- Änderungen ausführen ----------

function nr(v) {
  const n = Number(String(v == null ? '' : v).replace(/^\[|\]$/g, ''));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function describe(op) {
  if (op.ersetzen != null) return `Absatz ${op.ersetzen} ersetzt`;
  if (op.bild) return `Bild nach Absatz ${op.nach}`;
  if (op.nach != null) return `nach Absatz ${op.nach} eingefügt`;
  if (op.vor != null) return `vor Absatz ${op.vor} eingefügt`;
  if (op.zeile != null) return `Zeile in Tabelle ${op.zeile}`;
  if (op.loeschen != null) return `Absatz ${[].concat(op.loeschen).join(', ')} gelöscht`;
  return 'Änderung';
}

// ops: Liste von Änderungen; Nummern beziehen sich auf die Fassung VOR diesem Block.
// bildLaden(pfad) → Buffer (vom Aufrufer auf erlaubte Pfade geprüft).
async function apply(buffer, ops, { bildLaden } = {}) {
  const d = new WordDoc(buffer);
  const geloescht = new Set();
  const results = [];
  const para = (n) => {
    const k = nr(n);
    if (!k || k > d.paras.length) throw new Error(`Absatz ${n} gibt es nicht (1–${d.paras.length})`);
    const p = d.paras[k - 1].node;
    if (geloescht.has(p)) throw new Error(`Absatz ${n} wurde schon gelöscht`);
    return p;
  };
  const next = (p) => {
    const i = d.paras.findIndex((x) => x.node === p);
    return i >= 0 && i + 1 < d.paras.length ? d.paras[i + 1].node : null;
  };
  for (const op of ops) {
    const r = { was: describe(op) };
    try {
      if (!op || typeof op !== 'object') throw new Error('Ungültige Änderung');
      if (op.ersetzen != null) {
        const p = para(op.ersetzen);
        const neu = String(op.text ?? op.neu ?? '');
        if (op.alt != null && String(op.alt) !== '') {
          if (neu.includes('\n')) throw new Error('Beim Ersetzen von Teiltext („alt“) ist nur eine Zeile erlaubt');
          if (!replaceSubstring(p, String(op.alt), neu)) throw new Error(`„${String(op.alt).slice(0, 60)}“ steht nicht in Absatz ${op.ersetzen}`);
        } else {
          const info = paraInfo(p);
          if (info.feld) throw new Error(`Absatz ${op.ersetzen} ist ein Feld (z. B. Verzeichnis) – in Word aktualisieren`);
          const rPr = baseRPr(p);
          const blocks = neu.replace(/\r\n?/g, '\n').split(/\n\s*\n/);
          clearText(p);
          appendRuns(p, runsXml(blocks[0].replace(/^#{1,6}\s+/, ''), rPr));
          if (blocks.length > 1) {
            const xml = paragraphsXml(blocks.slice(1).join('\n\n'), { pPr: basePPr(p, d.styles), pPrListe: hasNum(p) ? basePPr(p, d.styles, { liste: true }) : '', rPr: baseRPr(p, { neutral: true }), styles: d.styles });
            insertAfter(p, fragment(xml, p.parent));
          }
        }
      } else if (op.bild) {
        if (!bildLaden) throw new Error('Bilder werden hier nicht unterstützt');
        const p = para(op.nach);
        const buf = await bildLaden(String(op.bild));
        const run = addImage(d, buf, String(op.bild).split('/').pop(), op.breite_cm);
        const pPr = basePPr(p, d.styles).replace(/<w:jc [^>]*\/>/, '');
        const center = pPr ? pPr.replace(/<\/w:pPr>$/, '<w:jc w:val="center"/></w:pPr>').replace(/^<w:pPr\/>$/, '<w:pPr><w:jc w:val="center"/></w:pPr>') : '<w:pPr><w:jc w:val="center"/></w:pPr>';
        let xml = `<w:p>${center}${run}</w:p>`;
        if (op.unterschrift) {
          const cap = [...d.styles].find(([, name]) => name === 'caption');
          xml += cap ? `<w:p><w:pPr><w:pStyle w:val="${esc(cap[0])}"/><w:jc w:val="center"/></w:pPr>${runsXml(op.unterschrift, '')}</w:p>`
            : `<w:p>${center}${runsXml(`*${op.unterschrift}*`, baseRPr(p, { neutral: true }))}</w:p>`;
        }
        insertAfter(p, fragment(xml, p.parent));
      } else if (op.nach != null || op.vor != null) {
        const p = para(op.nach != null ? op.nach : op.vor);
        const text = String(op.text ?? '');
        if (!text.trim()) throw new Error('Kein Text zum Einfügen');
        // Formatvorlage: der Absatz selbst, bei Überschriften der folgende normale Absatz.
        let vorlage = p;
        if (headingLevel(styleOf(p), d.styles) || isTocStyle(styleOf(p), d.styles) || paraInfo(p).bild) {
          const n2 = next(p);
          vorlage = n2 && !headingLevel(styleOf(n2), d.styles) ? n2 : null;
        }
        const xml = paragraphsXml(text, {
          pPr: basePPr(vorlage, d.styles), pPrListe: hasNum(vorlage) ? basePPr(vorlage, d.styles, { liste: true }) : '',
          rPr: vorlage ? baseRPr(vorlage, { neutral: true }) : '', styles: d.styles,
        });
        if (op.nach != null) insertAfter(p, fragment(xml, p.parent));
        else insertBefore(p, fragment(xml, p.parent));
      } else if (op.zeile != null) {
        const k = nr(op.zeile);
        const t = k && d.tables[k - 1];
        if (!t) throw new Error(`Tabelle ${op.zeile} gibt es nicht (1–${d.tables.length})`);
        const rows = kids(t.node, 'w:tr');
        if (!rows.length) throw new Error('Tabelle ohne Zeilen');
        const zellen = (Array.isArray(op.zellen) ? op.zellen : [op.text ?? '']).map((z) => String(z ?? ''));
        const row = stripIds(clone(rows[rows.length - 1], t.node));
        const trPr = kid(row, 'w:trPr');
        if (trPr) trPr.children = trPr.children.filter((x) => x.t === 'el' && x.name !== 'w:tblHeader');
        const tcs = kids(row, 'w:tc');
        tcs.forEach((tc, i) => {
          const ps = kids(tc, 'w:p');
          const first = ps[0];
          for (const extra of kids(tc).filter((x) => x !== first && x.name !== 'w:tcPr')) remove(extra);
          const p = first || fragment('<w:p/>', tc)[0];
          if (!first) tc.children.push(p);
          const rPr = baseRPr(p, { neutral: true });
          const pPr = basePPr(p, d.styles);
          let val = zellen[i] ?? '';
          if (i === tcs.length - 1 && zellen.length > tcs.length) val = zellen.slice(i).join(' – ');
          clearText(p);
          const lines = val.replace(/\r\n?/g, '\n').split(/\n\s*\n/);
          appendRuns(p, runsXml(lines[0], rPr));
          if (lines.length > 1) insertAfter(p, fragment(lines.slice(1).map((l) => `<w:p>${pPr}${runsXml(l, rPr)}</w:p>`).join(''), tc));
          // Grafiken aus der kopierten Zeile nicht übernehmen.
          p.children = p.children.filter((c) => !(c.name === 'w:r' && (find(c, 'w:drawing') || find(c, 'w:pict'))));
        });
        insertAfter(rows[rows.length - 1], [row]);
      } else if (op.loeschen != null) {
        for (const n of [].concat(op.loeschen)) {
          const p = para(n);
          const pPr = kid(p, 'w:pPr');
          if (pPr && kid(pPr, 'w:sectPr')) throw new Error(`Absatz ${n} enthält einen Abschnittswechsel und bleibt`);
          const parent = p.parent;
          if (parent.name === 'w:tc' && kids(parent, 'w:p').length === 1) clearText(p);
          else remove(p);
          geloescht.add(p);
        }
      } else {
        throw new Error('Unbekannte Änderung (erlaubt: ersetzen, nach, vor, zeile, bild, loeschen)');
      }
      r.ok = true;
    } catch (err) {
      r.fehler = err.message;
    }
    results.push(r);
  }
  const ok = results.filter((r) => r.ok).length;
  return { buffer: ok ? d.toBuffer() : null, results, ok };
}

// ---------- Block in der Antwort ----------

const BLOCK_RE = /```[ \t]*word[^\n]*\n([\s\S]*?)(?:\n```|$)/gi;

function parseBlock(text) {
  const raw = String(text || '');
  const dateien = [];
  let invalid = false;
  for (const m of raw.matchAll(BLOCK_RE)) {
    try {
      const j = JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, '$1'));
      for (const e of Array.isArray(j) ? j : [j]) {
        if (!e || typeof e !== 'object') continue;
        const datei = String(e.datei || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
        if (!datei) continue;
        const ops = Array.isArray(e.aenderungen) ? e.aenderungen : Array.isArray(e.änderungen) ? e.änderungen : [];
        dateien.push({ datei, neu: e.neu === true, text: e.neu === true ? String(e.text || '') : '', ops: ops.slice(0, 200) });
      }
    } catch {
      invalid = true;
    }
  }
  return { text: raw.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim(), dateien: dateien.slice(0, 20), invalid };
}

module.exports = { nummeriert, apply, parseBlock, imageSize, parseXml, serialize, WordDoc, paraInfo };
