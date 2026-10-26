'use strict';
// Kleiner Markdown-Zerleger für PDF, PowerPoint und Excel: Überschriften, Absätze, Listen,
// Tabellen, Zitate, Bilder. Inline-Auszeichnung (**fett**, *kursiv*) wird zu Runs.

function inline(text) {
  const runs = [];
  const re = /(\*\*)(.+?)\1|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ t: text.slice(last, m.index) });
    if (m[2] !== undefined) runs.push(...inline(m[2]).map((r) => ({ ...r, b: true })));
    else if (m[3] !== undefined) runs.push(...inline(m[3]).map((r) => ({ ...r, i: true })));
    else if (m[4] !== undefined) runs.push({ t: m[4] });
    else runs.push({ t: /^https?:/.test(m[6]) ? `${m[5]} (${m[6]})` : m[5] });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ t: text.slice(last) });
  return runs;
}

function plain(text) {
  return inline(String(text)).map((r) => r.t).join('');
}

// Blöcke: { t:'h', n, text } | { t:'p', text } | { t:'li', n (Ebene), nr (Zahl oder null), text }
//         | { t:'table', rows } | { t:'quote', text } | { t:'img', alt, src } | { t:'hr' }
function parse(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) { out.push({ t: 'p', text: buf.join(' ').trim() }); buf = []; } };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^<!--.*-->\s*$/.test(line.trim())) { i++; continue; }
    if (!line.trim()) { flush(); i++; continue; }
    if (/^\s*```/.test(line)) {
      flush();
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { out.push({ t: 'p', text: lines[i] }); i++; }
      i++;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); out.push({ t: 'h', n: Math.min(3, h[1].length), text: h[2].replace(/\s*#+\s*$/, '') }); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); out.push({ t: 'hr' }); i++; continue; }
    const img = /^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line);
    if (img) { flush(); out.push({ t: 'img', alt: img[1], src: img[2] }); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const split = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const rows = [split(line)];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(split(lines[i++]));
      out.push({ t: 'table', rows });
      continue;
    }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) {
      flush();
      const parts = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) parts.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ t: 'quote', text: parts.join(' ').trim() });
      continue;
    }
    const li = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const nr = /\d/.test(li[2]) ? parseInt(li[2], 10) : null;
      out.push({ t: 'li', n: Math.min(2, Math.floor(li[1].replace(/\t/g, '  ').length / 2)), nr, text: li[3] });
      i++;
      continue;
    }
    buf.push(line.trim());
    i++;
  }
  flush();
  return out;
}

module.exports = { parse, inline, plain };
