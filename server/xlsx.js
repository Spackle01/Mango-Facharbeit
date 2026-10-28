'use strict';
// Erzeugt Excel-Dateien (.xlsx) aus Markdown-Tabellen. Jede Tabelle wird ein Blatt; der Name des
// Blattes ist die Überschrift davor. Zahlen werden als Zahlen gespeichert.
const { writeZip } = require('./zip');
const md = require('./mdblocks');

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colName(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function sheetName(name, used) {
  let n = String(name || 'Tabelle').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Tabelle';
  let out = n;
  for (let k = 2; used.has(out.toLowerCase()); k++) out = `${n.slice(0, 25)} ${k}`;
  used.add(out.toLowerCase());
  return out;
}

function markdownToXlsx(markdown, { title = '', author = '' } = {}) {
  const blocks = md.parse(markdown);
  const sheets = [];
  let name = '';
  const used = new Set();
  for (const b of blocks) {
    if (b.t === 'h') name = md.plain(b.text);
    else if (b.t === 'table') { sheets.push({ name: sheetName(name || title, used), rows: b.rows.map((r) => r.map((c) => md.plain(c))) }); name = ''; }
  }
  if (!sheets.length) throw new Error('Keine Tabelle gefunden (Markdown-Tabelle mit | und ---)');

  const files = [];
  sheets.forEach((s, i) => {
    const cols = Math.max(...s.rows.map((r) => r.length));
    const widths = Array.from({ length: cols }, (_, c) => Math.min(60, Math.max(8, ...s.rows.map((r) => String(r[c] || '').length + 2))));
    const rowsXml = s.rows.map((r, ri) => `<row r="${ri + 1}">${Array.from({ length: cols }, (_, ci) => {
      const v = r[ci] == null ? '' : String(r[ci]);
      if (v === '') return '';
      const ref = `${colName(ci)}${ri + 1}`;
      const style = ri === 0 ? ' s="1"' : '';
      const num = ri > 0 && /^-?\d+(?:,\d+)?$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : null;
      return num !== null ? `<c r="${ref}"${style}><v>${num}</v></c>` : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: `${HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rowsXml}</sheetData></worksheet>` });
  });
  const wb = `${HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
  const rel = (list) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.join('')}</Relationships>`;
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const styles = `${HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEDF7"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return writeZip([
    { name: '[Content_Types].xml', data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: rel([`<Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/>`, '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>']) },
    { name: 'docProps/core.xml', data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>` },
    { name: 'xl/workbook.xml', data: wb },
    { name: 'xl/_rels/workbook.xml.rels', data: rel([...sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`), `<Relationship Id="rId${sheets.length + 1}" Type="${R}/styles" Target="styles.xml"/>`]) },
    { name: 'xl/styles.xml', data: styles },
    ...files,
  ]);
}

module.exports = { markdownToXlsx };
