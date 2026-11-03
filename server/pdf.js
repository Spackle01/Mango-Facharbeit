'use strict';
// Erzeugt PDF-Dateien aus Markdown (A4, Helvetica/Arial-Optik, 11 pt). Ohne Abhängigkeiten:
// Standardschriften des PDF-Formats, Zeichensatz Windows-1252, einfacher Zeilenumbruch.
const zlib = require('zlib');
const md = require('./mdblocks');

// Zeichenbreiten (1/1000 em) für ASCII 32–126: Helvetica und Helvetica-Bold.
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556,
  333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611,
  389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// Unicode → Windows-1252 (nur Abweichungen von Latin-1).
const CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
const SPECIAL_W = { 0x84: 333, 0x93: 333, 0x94: 333, 0x82: 222, 0x91: 222, 0x92: 222, 0x96: 556, 0x97: 1000, 0x95: 350, 0x85: 1000, 0x80: 556 };
const SPECIAL_W_BOLD = { 0x84: 500, 0x93: 500, 0x94: 500, 0x82: 278, 0x91: 278, 0x92: 278, 0x96: 556, 0x97: 1000, 0x95: 350, 0x85: 1000, 0x80: 556 };

function toCp(str) {
  const out = [];
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    if (CP1252[ch] !== undefined) out.push(CP1252[ch]);
    else if (c === 0x2192) out.push(0x2d, 0x3e); // →
    else if (c === 0x2713 || c === 0x2611) out.push(0x78);
    else if (c === 0xa0 || c === 0x202f) out.push(0x20);
    else if (c === 0x2011) out.push(0x2d);
    else if (c < 0x20 && c !== 0x0a) out.push(0x20);
    else if (c <= 0xff) out.push(c);
    else out.push(0x3f);
  }
  return out;
}

function charW(code, bold) {
  if (code >= 32 && code <= 126) return (bold ? W_BOLD : W_REG)[code - 32];
  const sp = (bold ? SPECIAL_W_BOLD : SPECIAL_W)[code];
  if (sp) return sp;
  if (code >= 0xc0) return (code === 0xdf ? 611 : code >= 0xe0 ? 556 : 700);
  return 556;
}

function width(codes, size, bold) {
  let w = 0;
  for (const c of codes) w += charW(c, bold);
  return (w * size) / 1000;
}

const PAGE = { w: 595.28, h: 841.89 };
const M = { l: 2.5 * 28.3465, r: 2 * 28.3465, t: 2 * 28.3465, b: 2.2 * 28.3465 };
const TEXT_W = PAGE.w - M.l - M.r;

// Runs → Wörter mit Schnitt: [{codes, bold, italic}]
function words(runs, boldAll) {
  const out = [];
  for (const r of runs) {
    for (const part of String(r.t).split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { out.push({ space: true, bold: boldAll || !!r.b, italic: !!r.i }); continue; }
      out.push({ codes: toCp(part), bold: boldAll || !!r.b, italic: !!r.i });
    }
  }
  return out;
}

class Layout {
  constructor(title) {
    this.title = title;
    this.pages = [];
    this.ops = null;
    this.y = 0;
    this.neu();
  }

  neu() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = PAGE.h - M.t;
  }

  platz(h) {
    if (this.y - h < M.b) this.neu();
  }

  // Textblock mit Umbruch. opts: size, lead (Zeilenhöhe), bold, indent, hang (Hängeeinzug), mark (Aufzählungszeichen)
  absatz(runs, { size = 11, lead = 1.45, bold = false, indent = 0, mark = null, after = 6, before = 0, keep = false, color = '0 g' } = {}) {
    const ws = words(runs, bold);
    const maxW = TEXT_W - indent;
    const lines = [];
    let line = [];
    let w = 0;
    const flush = () => { while (line.length && line[line.length - 1].space) line.pop(); lines.push(line); line = []; w = 0; };
    for (const wd of ws) {
      if (wd.space) { if (line.length) { line.push(wd); w += width([32], size, wd.bold); } continue; }
      const ww = width(wd.codes, size, wd.bold);
      if (w + ww > maxW && line.length) flush();
      // sehr lange Wörter hart trennen
      if (ww > maxW) {
        let part = [];
        for (const c of wd.codes) {
          if (width(part.concat(c), size, wd.bold) > maxW - 6) { line.push({ codes: part, bold: wd.bold, italic: wd.italic }); flush(); part = []; }
          part.push(c);
        }
        line.push({ codes: part, bold: wd.bold, italic: wd.italic });
        w = width(part, size, wd.bold);
        continue;
      }
      line.push(wd);
      w += ww;
    }
    if (line.length) flush();
    if (!lines.length) return;
    const lh = size * lead;
    this.y -= before;
    // Überschriften nicht am Seitenende allein lassen
    this.platz(lh * (keep ? Math.min(lines.length, 2) + 2 : Math.min(lines.length, 2)));
    lines.forEach((ln, idx) => {
      this.platz(lh);
      this.y -= lh;
      let x = M.l + indent;
      if (idx === 0 && mark) this.text(mark, M.l + indent - 14, this.y + (lh - size) / 2 - 1, size, false, false, color);
      for (const wd of ln) {
        if (wd.space) { x += width([32], size, wd.bold); continue; }
        this.text(wd.codes, x, this.y + (lh - size) / 2 - 1, size, wd.bold, wd.italic, color);
        x += width(wd.codes, size, wd.bold);
      }
    });
    this.y -= after;
  }

  text(codes, x, y, size, bold, italic, color) {
    const f = bold ? 'F2' : italic ? 'F3' : 'F1';
    const arr = typeof codes === 'string' ? toCp(codes) : codes;
    const hex = Buffer.from(arr).toString('hex');
    this.ops.push(`${color} BT /${f} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td <${hex}> Tj ET`);
  }

  linie(x1, y1, x2, y2, grau = 0.6, dicke = 0.5) {
    this.ops.push(`${grau} G ${dicke} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  tabelle(rows) {
    const cols = Math.max(...rows.map((r) => r.length));
    const cw = TEXT_W / cols;
    const size = 9.5;
    const pad = 4;
    const lh = size * 1.3;
    rows.forEach((cells, ri) => {
      const cellLines = Array.from({ length: cols }, (_, ci) => {
        const ws = words(md.inline(cells[ci] || ''), ri === 0);
        const lines = [];
        let line = [];
        let w = 0;
        for (const wd of ws) {
          if (wd.space) { if (line.length) { line.push(wd); w += width([32], size, wd.bold); } continue; }
          const ww = width(wd.codes, size, wd.bold);
          if (w + ww > cw - 2 * pad && line.length) { while (line.length && line[line.length - 1].space) line.pop(); lines.push(line); line = []; w = 0; }
          line.push(wd);
          w += ww;
        }
        while (line.length && line[line.length - 1].space) line.pop();
        if (line.length) lines.push(line);
        return lines;
      });
      const n = Math.max(1, ...cellLines.map((l) => l.length));
      const h = n * lh + 2 * pad - 2;
      this.platz(h);
      const top = this.y;
      if (ri === 0) this.ops.push(`0.93 g ${M.l.toFixed(2)} ${(top - h).toFixed(2)} ${TEXT_W.toFixed(2)} ${h.toFixed(2)} re f 0 g`);
      cellLines.forEach((lines, ci) => {
        lines.forEach((ln, li) => {
          let x = M.l + ci * cw + pad;
          const y = top - pad - (li + 1) * lh + 3;
          for (const wd of ln) {
            if (wd.space) { x += width([32], size, wd.bold); continue; }
            this.text(wd.codes, x, y, size, wd.bold, wd.italic, '0 g');
            x += width(wd.codes, size, wd.bold);
          }
        });
      });
      this.ops.push(`0.6 G 0.5 w ${M.l.toFixed(2)} ${(top - h).toFixed(2)} ${TEXT_W.toFixed(2)} ${h.toFixed(2)} re S`);
      for (let c = 1; c < cols; c++) this.linie(M.l + c * cw, top, M.l + c * cw, top - h);
      this.y = top - h;
    });
    this.y -= 10;
  }
}

function markdownToPdf(markdown, { title = '', author = '' } = {}) {
  const L = new Layout(title);
  const blocks = md.parse(markdown);
  let nr = 0;
  let erstes = true;
  for (const b of blocks) {
    if (b.t !== 'li') nr = 0;
    if (b.t === 'h') {
      const size = b.n === 1 ? (erstes ? 20 : 16) : b.n === 2 ? 13.5 : 11.5;
      L.absatz(md.inline(b.text), { size, bold: true, lead: 1.3, before: erstes ? 0 : (b.n === 1 ? 14 : 10), after: b.n === 1 ? 10 : 6, keep: true });
      erstes = false;
    } else if (b.t === 'p') {
      L.absatz(md.inline(b.text));
      erstes = false;
    } else if (b.t === 'li') {
      nr = b.nr ? nr + 1 : 0;
      L.absatz(md.inline(b.text), { indent: 16 + b.n * 16, mark: b.nr ? `${b.nr}.` : '•', after: 3 });
      erstes = false;
    } else if (b.t === 'quote') {
      L.absatz(md.inline(b.text).map((r) => ({ ...r, i: true })), { indent: 20 });
    } else if (b.t === 'table') {
      L.tabelle(b.rows);
      erstes = false;
    } else if (b.t === 'hr') {
      L.platz(14);
      L.y -= 6;
      L.linie(M.l, L.y, PAGE.w - M.r, L.y);
      L.y -= 8;
    } else if (b.t === 'img') {
      L.absatz([{ t: `[Bild: ${b.alt || b.src}]`, i: true }]);
    }
  }
  return buildPdf(L, { title, author });
}

function pdfStr(s) {
  const bytes = [0xfe, 0xff];
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c > 0xffff) { const v = c - 0x10000; bytes.push(0xd8 + (v >> 18), (v >> 10) & 0xff, 0xdc + ((v >> 8) & 3), v & 0xff); } else bytes.push(c >> 8, c & 0xff);
  }
  return `<${Buffer.from(bytes).toString('hex')}>`;
}

function buildPdf(L, { title, author }) {
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const catalog = add(null);
  const pages = add(null);
  const font = (name) => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
  const f1 = font('Helvetica');
  const f2 = font('Helvetica-Bold');
  const f3 = font('Helvetica-Oblique');
  const kids = [];
  const total = L.pages.length;
  L.pages.forEach((ops, idx) => {
    const num = String(idx + 1);
    const footer = `0.4 g BT /F1 9 Tf ${(PAGE.w / 2 - width(toCp(num), 9, false) / 2).toFixed(2)} ${(M.b - 24).toFixed(2)} Td <${Buffer.from(toCp(num)).toString('hex')}> Tj ET`;
    const data = zlib.deflateSync(Buffer.from(`${ops.join('\n')}\n${total > 1 ? footer : ''}`, 'latin1'));
    const content = add({ stream: data, dict: '/Filter /FlateDecode' });
    const page = add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${content} 0 R >>`);
    kids.push(page);
  });
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R /Lang (de-DE) >>`;
  objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title ${pdfStr(title || 'Dokument')} /Author ${pdfStr(author || '')} /Producer ${pdfStr('Mango Facharbeit')} >>`);

  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    offsets.push(pos);
    let buf;
    if (o && o.stream) {
      buf = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${o.stream.length} ${o.dict} >>\nstream\n`, 'latin1'), o.stream, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    } else buf = Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
    parts.push(buf);
    pos += buf.length;
  });
  const xref = [`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`];
  for (const off of offsets) xref.push(`${String(off).padStart(10, '0')} 00000 n \n`);
  xref.push(`trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`);
  parts.push(Buffer.from(xref.join(''), 'latin1'));
  return Buffer.concat(parts);
}

module.exports = { markdownToPdf };
