'use strict';
// Erzeugt Word-Dateien (.docx) aus Markdown mit den Formvorgaben der Schule
// (Handreichung 4.3.2): A4, Arial 11 pt, Zeilenabstand 1,5, Fußnoten 9 pt,
// Rand links 2,5 cm, sonst 2,0 cm, Seitenzahl oben zentriert ab der Einleitung.
const { writeZip } = require('./zip');

const CM = 567; // Twips pro Zentimeter
const A4 = { w: 11906, h: 16838 };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- Inline-Markdown → Runs ----------

function parseInline(text) {
  const runs = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)(?<!\s)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ t: text.slice(last, m.index) });
    if (m[2] !== undefined) runs.push(...parseInline(m[2]).map((r) => ({ ...r, b: true })));
    else if (m[4] !== undefined) runs.push(...parseInline(m[4]).map((r) => ({ ...r, i: true })));
    else if (m[5] !== undefined) runs.push({ t: m[5], code: true });
    else if (m[6] !== undefined) runs.push({ t: /^https?:/.test(m[7]) ? `${m[6]} (${m[7]})` : m[6] });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ t: text.slice(last) });
  return runs;
}

function runXml(r) {
  const props = [];
  if (r.b) props.push('<w:b/>');
  if (r.i) props.push('<w:i/>');
  if (r.code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/>');
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  const parts = String(r.t).split('\n');
  return parts.map((p, i) => `<w:r>${rPr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(p)}</w:t></w:r>`).join('');
}

function para(text, { style, align, numId, ilvl = 0, keepNext = false, runs } = {}) {
  const pPr = [];
  if (style) pPr.push(`<w:pStyle w:val="${style}"/>`);
  if (keepNext) pPr.push('<w:keepNext/>');
  if (numId) pPr.push(`<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`);
  if (align) pPr.push(`<w:jc w:val="${align}"/>`);
  const content = (runs || parseInline(text)).map(runXml).join('');
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${content}</w:p>`;
}

function tableXml(rows) {
  const cols = Math.max(...rows.map((r) => r.length));
  const width = A4.w - 2.5 * CM - 2 * CM;
  const colW = Math.floor(width / cols);
  const grid = `<w:tblGrid>${'<w:gridCol w:w="' + colW + '"/>'.repeat(cols)}</w:tblGrid>`;
  const body = rows.map((cells, ri) => `<w:tr>${Array.from({ length: cols }, (_, ci) => {
    const runs = parseInline(cells[ci] || '').map((r) => (ri === 0 ? { ...r, b: true } : r));
    return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/></w:tcPr>${para('', { style: 'Tabellentext', runs })}</w:tc>`;
  }).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="Tabellenraster"/><w:tblW w:w="${width}" w:type="dxa"/></w:tblPr>${grid}${body}</w:tbl>${para('')}`;
}

// ---------- Block-Markdown → Absätze ----------

function markdownToBody(md, { stripTemplateHints = false } = {}) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let paraBuf = [];
  const flush = () => {
    if (paraBuf.length) {
      out.push(para(paraBuf.join(' ').trim()));
      paraBuf = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^<!--.*-->\s*$/.test(line.trim())) { i++; continue; }
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    const fence = /^\s*```/.exec(line);
    if (fence) {
      flush();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      if (/mermaid/.test(line)) continue; // Diagrammcode gehört nicht in die Arbeit
      for (const c of code) out.push(para('', { style: 'Code', runs: [{ t: c || ' ' }] }));
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(3, h[1].length);
      out.push(para(h[2].replace(/\s*#+\s*$/, ''), { style: `Heading${level}`, keepNext: true }));
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const rows = [];
      const split = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      rows.push(split(line));
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(split(lines[i++]));
      out.push(tableXml(rows));
      continue;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      const text = q.join(' ').trim();
      if (stripTemplateHints && /^\*\*(Vorgabe|Stil|Hinweis|Zweck|Rahmen)/.test(text)) continue;
      if (text) out.push(para(text, { style: 'Zitat' }));
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const level = Math.min(2, Math.floor(li[1].replace(/\t/g, '  ').length / 2));
      const text = li[3].replace(/^\[( |x|X)\]\s+/, (m0, x) => (x.trim() ? '☒ ' : '☐ '));
      out.push(para(text, { numId: ordered ? 2 : 1, ilvl: level, style: 'Listenabsatz' }));
      i++;
      continue;
    }
    if (stripTemplateHints && /^\s*\*\[[^\]]*\]\*\s*$/.test(line)) { i++; continue; } // Platzhalter der Vorlage
    if (stripTemplateHints && /^\s*\*\((Regel|Hinweis|Vollständige|Wortlaut|Alphabetisch)[^)]*\)\*\s*$/.test(line)) { i++; continue; }
    paraBuf.push(line.trim());
    i++;
  }
  flush();
  return out.join('');
}

// ---------- Paketteile ----------

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
 <w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="de-DE" w:eastAsia="de-DE" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
 <w:pPrDefault><w:pPr><w:spacing w:after="240" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Standard"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Standard"/><w:next w:val="Standard"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Standard"/><w:next w:val="Standard"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Standard"/><w:next w:val="Standard"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titelseite"><w:name w:val="Titelseite"/><w:basedOn w:val="Standard"/><w:pPr><w:tabs><w:tab w:val="left" w:pos="2835"/></w:tabs><w:spacing w:after="120"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Titel"><w:name w:val="Title"/><w:basedOn w:val="Standard"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Zitat"><w:name w:val="Quote"/><w:basedOn w:val="Standard"/><w:pPr><w:ind w:left="567" w:right="567"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Standard"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Listenabsatz"><w:name w:val="List Paragraph"/><w:basedOn w:val="Standard"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Tabellentext"><w:name w:val="Tabellentext"/><w:basedOn w:val="Standard"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Beschriftung"><w:name w:val="caption"/><w:basedOn w:val="Standard"/><w:rPr><w:i/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Funotentext"><w:name w:val="footnote text"/><w:basedOn w:val="Standard"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Kopfzeile"><w:name w:val="header"/><w:basedOn w:val="Standard"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Verzeichnis1"><w:name w:val="toc 1"/><w:basedOn w:val="Standard"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9061"/></w:tabs><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Verzeichnis2"><w:name w:val="toc 2"/><w:basedOn w:val="Standard"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9061"/></w:tabs><w:spacing w:after="60"/><w:ind w:left="284"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Verzeichnis3"><w:name w:val="toc 3"/><w:basedOn w:val="Standard"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9061"/></w:tabs><w:spacing w:after="60"/><w:ind w:left="567"/></w:pPr></w:style>
<w:style w:type="table" w:styleId="Tabellenraster"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:left w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:right w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="808080"/></w:tblBorders><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0">${[0, 1, 2].map((l) => `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${['•', '–', '·'][l]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 + l * 360}" w:hanging="360"/></w:pPr></w:lvl>`).join('')}</w:abstractNum>
<w:abstractNum w:abstractNumId="1">${[0, 1, 2].map((l) => `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${['decimal', 'lowerLetter', 'lowerRoman'][l]}"/><w:lvlText w:val="%${l + 1}${l === 1 ? ')' : '.'}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 + l * 360}" w:hanging="360"/></w:pPr></w:lvl>`).join('')}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:autoHyphenation/><w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/><w:themeFontLang w:val="de-DE"/></w:settings>`;

const HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Kopfzeile"/><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>`;

const EMPTY_HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Kopfzeile"/></w:pPr></w:p></w:hdr>`;

function sectPr({ numbered, restart, final }) {
  const ref = numbered ? '<w:headerReference w:type="default" r:id="rIdHdr"/>' : '<w:headerReference w:type="default" r:id="rIdHdrLeer"/>';
  const pg = restart ? '<w:pgNumType w:start="1"/>' : '';
  const xml = `<w:sectPr>${ref}<w:type w:val="nextPage"/><w:pgSz w:w="${A4.w}" w:h="${A4.h}"/><w:pgMar w:top="${2 * CM}" w:right="${2 * CM}" w:bottom="${2 * CM}" w:left="${Math.round(2.5 * CM)}" w:header="567" w:footer="567" w:gutter="0"/>${pg}<w:cols w:space="708"/></w:sectPr>`;
  return final ? xml : `<w:p><w:pPr>${xml}</w:pPr></w:p>`;
}

function buildDocx(bodyXml, { title = 'Facharbeit', author = '' } = {}) {
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${ns}><w:body>${bodyXml}</w:body></w:document>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return writeZip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><dc:language>de-DE</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdHdrLeer" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/></Relationships>` },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: STYLES },
    { name: 'word/settings.xml', data: SETTINGS },
    { name: 'word/numbering.xml', data: NUMBERING },
    { name: 'word/header1.xml', data: HEADER },
    { name: 'word/header2.xml', data: EMPTY_HEADER },
  ]);
}

// Einzelne Markdown-Datei mit Seitenzahlen.
function markdownToDocx(md, meta = {}) {
  return buildDocx(markdownToBody(md) + sectPr({ numbered: true, final: true }), meta);
}

function titlePage(angaben, datum) {
  const a = angaben;
  const p = [];
  p.push(para('IBB Private Schule gGmbH', { style: 'Titelseite' }));
  p.push(para('Schumannstraße 21', { style: 'Titelseite' }));
  p.push(para('01307 Dresden', { style: 'Titelseite' }));
  for (let i = 0; i < 4; i++) p.push(para(''));
  p.push(para('Facharbeit', { style: 'Titel' }));
  const fach = a.fach || '[Fach]';
  p.push(para(`im Fach ${fach}${a.bezugsfach ? ` mit Bezug zum Fach ${a.bezugsfach}` : ' mit Bezug zum Fach [Bezugsfach]'}`, { align: 'center' }));
  p.push(para(''));
  p.push(para(a.titel || '[Titel der Facharbeit]', { style: 'Titel' }));
  for (let i = 0; i < 4; i++) p.push(para(''));
  const zeile = (label, wert) => para('', { style: 'Titelseite', runs: [{ t: `${label}\t` }, { t: wert || '' }] });
  p.push(zeile('Verfasser/in:', a.name));
  p.push(zeile('Klasse:', a.klasse));
  p.push(zeile('Schuljahr:', '2026/2027'));
  p.push(para(''));
  p.push(zeile('Betreuer/in:', a.lehrkraft));
  p.push(zeile('Ort, Datum:', `Dresden, ${datum}`));
  return p.join('');
}

function tocField() {
  return `${para('Inhaltsverzeichnis', { style: 'Heading1' })}<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Inhaltsverzeichnis wird beim Öffnen in Word aktualisiert (sonst: Rechtsklick → Felder aktualisieren).</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
}

// Gesamtarbeit: Titelblatt und Inhaltsverzeichnis ohne Seitenzahl, ab der Einleitung nummeriert (Start bei 1).
function facharbeitToDocx({ angaben, teile, datum }) {
  let body = titlePage(angaben, datum);
  body += sectPr({ numbered: false });
  body += tocField();
  body += sectPr({ numbered: false });
  teile.forEach((t, i) => {
    body += markdownToBody(t.markdown, { stripTemplateHints: true });
    if (i < teile.length - 1) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  });
  body += sectPr({ numbered: true, restart: true, final: true });
  return buildDocx(body, { title: angaben.titel || 'Facharbeit', author: angaben.name || '' });
}

module.exports = { markdownToDocx, facharbeitToDocx, markdownToBody, parseInline };
