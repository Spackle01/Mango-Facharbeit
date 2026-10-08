'use strict';
// Erkennt Dateitypen und erstellt Textauszüge aus Office- und PDF-Dateien,
// damit beide KI-Anbieter den Inhalt zuverlässig lesen können.
const { execFile } = require('child_process');
const { fsp, path } = require('./util');
const { readZip } = require('./zip');

const TEXT_EXT = new Set(['.md', '.markdown', '.txt', '.csv', '.tsv', '.json', '.html', '.htm', '.xml',
  '.tex', '.bib', '.yaml', '.yml', '.rtf', '.mmd', '.log', '.svg', '.py', '.js', '.css']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

const KINDS = {
  text: 'Text', markdown: 'Markdown', word: 'Word', pdf: 'PDF', image: 'Bild', tabelle: 'Tabelle',
  praesentation: 'Präsentation', odt: 'OpenDocument', archiv: 'Archiv', audio: 'Audio', video: 'Video', andere: 'Datei',
};

function kindOf(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (ext === '.csv' || ext === '.tsv') return 'tabelle';
  if (TEXT_EXT.has(ext)) return 'text';
  if (ext === '.docx' || ext === '.docm' || ext === '.dotx') return 'word';
  if (ext === '.doc') return 'word';
  if (ext === '.pdf') return 'pdf';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (ext === '.xlsx' || ext === '.xlsm' || ext === '.xls' || ext === '.ods') return 'tabelle';
  if (ext === '.pptx' || ext === '.ppt' || ext === '.odp') return 'praesentation';
  if (ext === '.odt') return 'odt';
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return 'archiv';
  if (['.mp3', '.wav', '.m4a', '.ogg'].includes(ext)) return 'audio';
  if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) return 'video';
  return 'andere';
}

function kindLabel(kind) {
  return KINDS[kind] || 'Datei';
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

// Text eines Absatzes mit Fett/Kursiv als Markdown. Gleich formatierte Läufe werden zusammengefasst.
function paragraphMarkdown(p, { plain = false } = {}) {
  const segs = [];
  const runRe = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
  let r;
  while ((r = runRe.exec(p))) {
    const run = r[1];
    const rPr = (/<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run) || [])[1] || '';
    const on = (tag) => new RegExp(`<w:${tag}(?:\\s+w:val="(?:1|true|on)")?\\s*/>`).test(rPr);
    let text = '';
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:noBreakHyphen\/>/g;
    let m;
    while ((m = re.exec(run))) {
      if (m[1] !== undefined) text += m[1];
      else if (m[0].startsWith('<w:tab')) text += '\t';
      else if (m[0].startsWith('<w:br')) text += '\n';
      else text += '-';
    }
    if (!text) continue;
    const seg = { text: decodeXml(text), b: !plain && on('b'), i: !plain && on('i') };
    const last = segs[segs.length - 1];
    if (last && last.b === seg.b && last.i === seg.i) last.text += seg.text;
    else segs.push(seg);
  }
  return segs.map((sg) => {
    if (!(sg.b || sg.i) || !sg.text.trim()) return sg.text;
    const mark = sg.b && sg.i ? '***' : sg.b ? '**' : '*';
    const lead = /^\s*/.exec(sg.text)[0];
    const trail = /\s*$/.exec(sg.text)[0];
    return `${lead}${mark}${sg.text.trim()}${mark}${trail}`;
  }).join('');
}

// Word-Dokument als Markdown: Überschriften, Listen, Tabellen, Fett/Kursiv. Wortgetreu, ohne Umformulierung.
function docxToText(buffer) {
  const zip = readZip(buffer);
  const xml = zip.read('word/document.xml');
  if (!xml) throw new Error('word/document.xml fehlt');
  const body = xml.toString('utf8');
  const out = [];
  // Absätze einzeln verarbeiten; Tabellen als Markdown-Tabelle.
  const blocks = body.split(/(<w:tbl>|<\/w:tbl>|<\/w:tc>|<\/w:tr>)/);
  let inTable = false;
  let rows = [];
  let row = [];
  let cell = [];
  const flushTable = () => {
    if (!rows.length) return;
    const width = Math.max(...rows.map((x) => x.length));
    const fmt = (x) => `| ${Array.from({ length: width }, (_, k) => (x[k] || '').replace(/\|/g, '\\|')).join(' | ')} |`;
    out.push('', fmt(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(fmt), '');
    rows = [];
  };
  for (const part of blocks) {
    if (part === '<w:tbl>') { inTable = true; rows = []; continue; }
    if (part === '</w:tbl>') { inTable = false; flushTable(); continue; }
    if (part === '</w:tc>') { row.push(cell.join(' ').trim()); cell = []; continue; }
    if (part === '</w:tr>') { rows.push(row); row = []; continue; }
    const paras = part.split(/<\/w:p>/);
    for (const p of paras) {
      const style = /<w:pStyle w:val="([^"]+)"/.exec(p);
      const level = style && /(?:heading|berschrift)\s*(\d)/i.exec(style[1]);
      const title = style && /^(title|titel)$/i.test(style[1]);
      // Nur echte Textknoten übernehmen (keine Positionsangaben von Grafiken o. Ä.).
      const text = paragraphMarkdown(p, { plain: !!(level || title) });
      if (inTable) { if (text.trim()) cell.push(text.trim().replace(/\n/g, ' ')); continue; }
      if (!text.trim()) { if (/<w:p[ >]/.test(p)) out.push(''); continue; }
      if (title) out.push(`# ${text.trim()}`);
      else if (level) out.push(`${'#'.repeat(Math.min(6, +level[1]))} ${text.trim()}`);
      else if (/<w:numPr>/.test(p)) out.push(`- ${text.trim()}`);
      else out.push(text);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function pptxToText(buffer) {
  const zip = readZip(buffer);
  const slides = zip.names()
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => +a.match(/(\d+)\.xml$/)[1] - +b.match(/(\d+)\.xml$/)[1]);
  return slides.map((n, i) => {
    const xml = zip.read(n).toString('utf8');
    const paras = xml.split(/<\/a:p>/).map((p) => decodeXml((p.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [])
      .map((t) => t.replace(/<\/?a:t>/g, '')).join(''))).filter((t) => t.trim());
    return `## Folie ${i + 1}\n${paras.join('\n')}`;
  }).join('\n\n');
}

function xlsxToText(buffer) {
  const zip = readZip(buffer);
  const shared = [];
  const ss = zip.read('xl/sharedStrings.xml');
  if (ss) {
    for (const si of ss.toString('utf8').split(/<\/si>/)) {
      const parts = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
      if (parts) shared.push(decodeXml(parts.map((t) => t.replace(/<\/?t[^>]*>/g, '')).join('')));
    }
  }
  const sheets = zip.names().filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  return sheets.map((n, i) => {
    const xml = zip.read(n).toString('utf8');
    const rows = xml.split(/<\/row>/).map((r) => {
      const cells = [];
      const re = /<c [^>]*?(?:t="(\w+)")?[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g;
      let m;
      while ((m = re.exec(r))) {
        const type = (/t="(\w+)"/.exec(m[0]) || [])[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(m[2] || '');
        const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(m[2] || '');
        if (type === 's' && v) cells.push(shared[+v[1]] ?? '');
        else if (inline) cells.push(decodeXml(inline[1]));
        else if (v) cells.push(decodeXml(v[1]));
        else cells.push('');
      }
      return cells;
    }).filter((c) => c.some((x) => x !== ''));
    return `## Tabellenblatt ${i + 1}\n${rows.map((c) => c.join('\t')).join('\n')}`;
  }).join('\n\n');
}

function odtToText(buffer) {
  const zip = readZip(buffer);
  const xml = zip.read('content.xml');
  if (!xml) throw new Error('content.xml fehlt');
  return decodeXml(xml.toString('utf8')
    .replace(/<text:h[^>]*>/g, '\n# ')
    .replace(/<\/text:(p|h)>/g, '\n')
    .replace(/<text:tab\/>/g, '\t')
    .replace(/<text:line-break\/>/g, '\n')
    .replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
}

let pdftotextAvailable = null;
function hasPdftotext() {
  if (pdftotextAvailable !== null) return Promise.resolve(pdftotextAvailable);
  return new Promise((resolve) => {
    execFile('pdftotext', ['-v'], { timeout: 5000 }, (err) => {
      pdftotextAvailable = !err || err.code !== 'ENOENT';
      resolve(pdftotextAvailable);
    });
  });
}

function pdfToText(file) {
  return new Promise((resolve, reject) => {
    execFile('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err); else resolve(stdout);
    });
  });
}

// Ergebnis: { lesbar: 'ja'|'direkt'|'nein', hinweis, text? }
//  ja     – Textauszug erstellt
//  direkt – der Assistent liest die Datei selbst (Text, Bild, PDF ohne Auszug)
//  nein   – nicht unterstützt oder nicht lesbar
async function analyse(file, { maxBytes = 60 * 1024 * 1024 } = {}) {
  const name = path.basename(file);
  const kind = kindOf(name);
  const ext = path.extname(name).toLowerCase();
  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    return { kind, lesbar: 'nein', hinweis: 'Datei fehlt' };
  }
  if (stat.size === 0) return { kind, lesbar: 'nein', hinweis: 'Datei ist leer' };
  if (kind === 'markdown' || kind === 'text' || (kind === 'tabelle' && (ext === '.csv' || ext === '.tsv'))) {
    return { kind, lesbar: 'direkt', hinweis: '' };
  }
  if (kind === 'image') return { kind, lesbar: 'direkt', hinweis: 'Bild' };
  if (stat.size > maxBytes) return { kind, lesbar: 'nein', hinweis: 'Datei ist zu groß für einen Textauszug' };
  try {
    if (ext === '.docx' || ext === '.docm' || ext === '.dotx') {
      const text = docxToText(await fsp.readFile(file));
      return text.trim() ? { kind, lesbar: 'ja', text, hinweis: '' } : { kind, lesbar: 'nein', hinweis: 'Kein Text gefunden' };
    }
    if (ext === '.pptx') return { kind, lesbar: 'ja', text: pptxToText(await fsp.readFile(file)), hinweis: '' };
    if (ext === '.xlsx' || ext === '.xlsm') return { kind, lesbar: 'ja', text: xlsxToText(await fsp.readFile(file)), hinweis: '' };
    if (ext === '.odt') return { kind, lesbar: 'ja', text: odtToText(await fsp.readFile(file)), hinweis: '' };
    if (ext === '.pdf') {
      if (await hasPdftotext()) {
        const text = await pdfToText(file);
        if (text.trim().length > 20) return { kind, lesbar: 'ja', text, hinweis: '' };
        return { kind, lesbar: 'direkt', hinweis: 'PDF ohne Textebene (z. B. Scan) – der Assistent liest sie direkt, falls möglich' };
      }
      return { kind, lesbar: 'direkt', hinweis: 'PDF – der Assistent liest sie direkt' };
    }
  } catch (err) {
    return { kind, lesbar: 'nein', hinweis: `Nicht lesbar: ${err.message}` };
  }
  if (ext === '.doc' || ext === '.xls' || ext === '.ppt') {
    return { kind, lesbar: 'nein', hinweis: 'Altes Office-Format – bitte als .docx/.xlsx/.pptx oder PDF speichern' };
  }
  return { kind, lesbar: 'nein', hinweis: 'Dateityp wird nicht unterstützt' };
}

module.exports = { kindOf, kindLabel, analyse, docxToText, pptxToText, xlsxToText, odtToText };
