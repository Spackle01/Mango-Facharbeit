'use strict';
// Erzeugt PowerPoint-Dateien (.pptx, 16:9) aus Markdown. Folien trennt eine Zeile `---`.
//   # Titel            → Titelfolie (Zeilen darunter: Untertitel)
//   ## Folientitel     → Inhaltsfolie; `- Punkt` Stichpunkte; Text; Tabelle; ![Text](bild.png)
//   > Text             → Sprechernotizen der Folie
const { writeZip } = require('./zip');
const md = require('./mdblocks');
const { imageSize } = require('./word');

const W = 12192000;
const H = 6858000;
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const ACCENT = '5B5FB8';
const DARK = '23242B';
const GRAY = '5F6068';
const FONT = 'Arial';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rels = (list) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((r) => `<Relationship Id="${r.id}" Type="${r.type.startsWith('http') ? r.type : `${REL}/${r.type}`}" Target="${esc(r.target)}"/>`).join('')}</Relationships>`;

function runs(text, size, { color = DARK, bold = false } = {}) {
  return md.inline(text).map((r) => `<a:r><a:rPr lang="de-DE" sz="${size * 100}"${bold || r.b ? ' b="1"' : ''}${r.i ? ' i="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:rPr><a:t>${esc(r.t)}</a:t></a:r>`).join('');
}

function para(text, size, { bullet = false, level = 0, color, bold, algn, after = 600 } = {}) {
  const ppr = bullet
    ? `<a:pPr marL="${285750 + level * 285750}" indent="-285750"${algn ? ` algn="${algn}"` : ''}><a:spcAft><a:spcPts val="${after}"/></a:spcAft><a:buClr><a:srgbClr val="${ACCENT}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>`
    : `<a:pPr marL="0" indent="0"${algn ? ` algn="${algn}"` : ''}><a:spcAft><a:spcPts val="${after}"/></a:spcAft><a:buNone/></a:pPr>`;
  return `<a:p>${ppr}${runs(text, size, { color, bold })}</a:p>`;
}

function shape(id, name, { ph, x, y, w, h, body, anchor = 't', fill }) {
  const nv = `<p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvSpPr${ph ? '><a:spLocks noGrp="1"/></p:cNvSpPr>' : ' txBox="1"/>'}<p:nvPr>${ph ? `<p:ph ${ph}/>` : ''}</p:nvPr></p:nvSpPr>`;
  const sp = `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}</p:spPr>`;
  const tx = body ? `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${body}</p:txBody>` : '';
  return `<p:sp>${nv}${sp}${tx}</p:sp>`;
}

function rect(id, x, y, w, h, fill) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Akzent ${id}"/><p:cNvSpPr/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

function picture(id, rid, x, y, w, h, alt) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Bild ${id}" descr="${esc(alt)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function table(id, rows, x, y, w, size) {
  const cols = Math.max(...rows.map((r) => r.length));
  const cw = Math.floor(w / cols);
  const rh = Math.round(size * 12700 * 2.2);
  const cell = (t, head) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr marL="0" indent="0"><a:buNone/></a:pPr>${runs(t || ' ', size, { color: head ? 'FFFFFF' : DARK, bold: head })}</a:p></a:txBody><a:tcPr marL="91440" marR="91440" marT="45720" marB="45720"><a:lnL w="6350"><a:solidFill><a:srgbClr val="C9CAD3"/></a:solidFill></a:lnL><a:lnR w="6350"><a:solidFill><a:srgbClr val="C9CAD3"/></a:solidFill></a:lnR><a:lnT w="6350"><a:solidFill><a:srgbClr val="C9CAD3"/></a:solidFill></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="C9CAD3"/></a:solidFill></a:lnB><a:solidFill><a:srgbClr val="${head ? ACCENT : 'FFFFFF'}"/></a:solidFill></a:tcPr></a:tc>`;
  const trs = rows.map((r, ri) => `<a:tr h="${rh}">${Array.from({ length: cols }, (_, ci) => cell(r[ci], ri === 0)).join('')}</a:tr>`).join('');
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Tabelle ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${rh * rows.length}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>${Array.from({ length: cols }, () => `<a:gridCol w="${cw}"/>`).join('')}</a:tblGrid>${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

// ---------- Folien aus Markdown ----------

function zerlegen(markdown) {
  const folien = [];
  let aktuell = [];
  for (const line of String(markdown || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { folien.push(aktuell); aktuell = []; } else aktuell.push(line);
  }
  folien.push(aktuell);
  return folien.map((l) => l.join('\n')).filter((t) => t.trim());
}

async function markdownToPptx(markdown, { title = '', author = '', bildLaden } = {}) {
  const texte = zerlegen(markdown);
  if (!texte.length) throw new Error('Kein Inhalt für die Präsentation');
  const folien = [];
  const media = [];
  for (let idx = 0; idx < texte.length; idx++) {
    const blocks = md.parse(texte[idx]);
    const f = { titel: '', punkte: [], text: [], notizen: [], bilder: [], tabelle: null, titelfolie: false, untertitel: [] };
    for (const b of blocks) {
      if (b.t === 'h' && !f.titel) { f.titel = md.plain(b.text); if (b.n === 1 && idx === 0) f.titelfolie = true; } else if (b.t === 'h') f.punkte.push({ text: `**${md.plain(b.text)}**`, level: 0, plain: true });
      else if (b.t === 'li') f.punkte.push({ text: b.text, level: Math.min(1, b.n) });
      else if (b.t === 'p') (f.titelfolie ? f.untertitel : f.text).push(b.text);
      else if (b.t === 'quote') f.notizen.push(b.text);
      else if (b.t === 'table' && !f.tabelle) f.tabelle = b.rows;
      else if (b.t === 'img') {
        let buf = null;
        try { buf = bildLaden ? await bildLaden(b.src) : null; } catch (e) { throw new Error(`Bild „${b.src}“: ${e.message}`); }
        const info = buf && imageSize(buf);
        if (!info) throw new Error(`Bild „${b.src}“ nicht lesbar (nur PNG, JPG oder GIF)`);
        const name = `image${media.length + 1}.${info.ext}`;
        media.push({ name, data: buf });
        f.bilder.push({ name, w: info.w, h: info.h, alt: b.alt || b.src });
      }
    }
    if (idx === 0 && !f.titelfolie && !f.titel) f.titel = title || '';
    folien.push(f);
  }

  const parts = [];
  const notizenVorhanden = folien.some((f) => f.notizen.length);
  const slideXml = (f) => {
    const sp = [];
    let id = 2;
    if (f.titelfolie) {
      sp.push(rect(id++, 0, 0, 457200, H, ACCENT));
      sp.push(shape(id++, 'Titel', { ph: 'type="ctrTitle"', x: 914400, y: 2057400, w: W - 1828800, h: 1371600, anchor: 'b', body: para(f.titel, f.titel.length > 60 ? 32 : 40, { bold: true, after: 0 }) }));
      if (f.untertitel.length) sp.push(shape(id++, 'Untertitel', { ph: 'type="subTitle" idx="1"', x: 914400, y: 3657600, w: W - 1828800, h: 1143000, body: f.untertitel.map((t) => para(t, 20, { color: GRAY, after: 300 })).join('') }));
      return sp.join('');
    }
    sp.push(rect(id++, 0, 0, W, 114300, ACCENT));
    sp.push(shape(id++, 'Titel', { ph: 'type="title"', x: 685800, y: 365760, w: W - 1371600, h: 914400, anchor: 'ctr', body: para(f.titel || ' ', f.titel.length > 50 ? 28 : 34, { bold: true, after: 0 }) }));
    const links = 685800;
    const top = 1463040;
    const breit = W - 1371600;
    const hoch = H - top - 548640;
    const bild = f.bilder[0];
    const textBreit = bild && (f.punkte.length || f.text.length) ? Math.floor(breit * 0.5) : breit;
    const eintraege = f.punkte.length + f.text.length;
    const laenge = [...f.punkte.map((p) => p.text), ...f.text].join(' ').length;
    const size = eintraege > 6 || laenge > 420 ? 18 : eintraege > 4 || laenge > 280 ? 20 : 24;
    let body = f.text.map((t) => para(t, size, { after: 800 })).join('') + f.punkte.map((p) => para(p.text, p.level ? size - 2 : size, { bullet: !p.plain, level: p.level, after: 800 })).join('');
    let ty = top;
    let th = hoch;
    if (f.tabelle) {
      const tsize = f.tabelle.length > 8 ? 12 : 14;
      sp.push(table(id++, f.tabelle, links, top, breit, tsize));
      const used = Math.round(tsize * 12700 * 2.2) * f.tabelle.length;
      ty = top + used + 228600;
      th = Math.max(0, hoch - used - 228600);
      if (th < 600000) body = '';
    }
    if (body) sp.push(shape(id++, 'Inhalt', { ph: 'idx="1"', x: links, y: ty, w: textBreit, h: th, body }));
    if (bild) {
      const bx = textBreit < breit ? links + textBreit + 274320 : links;
      const bw = textBreit < breit ? breit - textBreit - 274320 : breit;
      // Mit Tabelle steht das Bild darunter, sonst neben dem Text oder allein in der Mitte.
      const boxTop = f.tabelle ? ty : top;
      const boxH = f.tabelle ? Math.max(th, 1) : hoch;
      const bwEff = !f.tabelle && body && textBreit === breit ? Math.floor(bw * 0.5) : bw;
      let w = Math.min(bwEff, boxH * (bild.w / bild.h));
      let h = (w * bild.h) / bild.w;
      if (h > boxH) { h = boxH; w = (h * bild.w) / bild.h; }
      const px = Math.round(bx + (bw - w) / 2);
      const py = Math.round(boxTop + (boxH - h) / 2);
      sp.push(picture(id++, 'rIdBild', px, py, Math.round(w), Math.round(h), bild.alt));
    }
    return sp.join('');
  };

  const slideDoc = (f) => `${HEAD}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${slideXml(f)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

  const notesDoc = (f) => `${HEAD}<p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Folienbild"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notizen"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${f.notizen.map((t) => `<a:p>${runs(t, 12)}</a:p>`).join('')}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;

  const files = [];
  const ct = [];
  const slideRels = [];
  folien.forEach((f, i) => {
    const n = i + 1;
    const r = [{ id: 'rId1', type: 'slideLayout', target: `../slideLayouts/slideLayout${f.titelfolie ? 1 : 2}.xml` }];
    if (f.bilder[0]) r.push({ id: 'rIdBild', type: 'image', target: `../media/${f.bilder[0].name}` });
    if (f.notizen.length) r.push({ id: 'rIdNotiz', type: 'notesSlide', target: `../notesSlides/notesSlide${n}.xml` });
    files.push({ name: `ppt/slides/slide${n}.xml`, data: slideDoc(f) }, { name: `ppt/slides/_rels/slide${n}.xml.rels`, data: rels(r) });
    ct.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    if (f.notizen.length) {
      files.push({ name: `ppt/notesSlides/notesSlide${n}.xml`, data: notesDoc(f) },
        { name: `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, data: rels([{ id: 'rId1', type: 'notesMaster', target: '../notesMasters/notesMaster1.xml' }, { id: 'rId2', type: 'slide', target: `../slides/slide${n}.xml` }]) });
      ct.push(`<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
    }
    slideRels.push({ id: `rId${10 + i}`, type: 'slide', target: `slides/slide${n}.xml` });
  });
  for (const m of media) files.push({ name: `ppt/media/${m.name}`, data: m.data });

  const pres = `${HEAD}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>${notizenVorhanden ? '<p:notesMasterIdLst><p:notesMasterId r:id="rId3"/></p:notesMasterIdLst>' : ''}<p:sldIdLst>${folien.map((f, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const presRels = [{ id: 'rId1', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' }, { id: 'rId2', type: 'theme', target: 'theme/theme1.xml' }];
  if (notizenVorhanden) presRels.push({ id: 'rId3', type: 'notesMaster', target: 'notesMasters/notesMaster1.xml' });
  presRels.push(...slideRels);

  const exts = [...new Set(media.map((m) => m.name.split('.').pop()))];
  const mime = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif' };
  const content = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${exts.map((e) => `<Default Extension="${e}" ContentType="${mime[e]}"/>`).join('')}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideLayouts/slideLayout2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${notizenVorhanden ? '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' : ''}${ct.join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title || folien[0].titel)}</dc:title><dc:creator>${esc(author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;

  const layoutShapes = (titelfolie) => (titelfolie
    ? `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Titel"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="2057400"/><a:ext cx="${W - 1828800}" cy="1371600"/></a:xfrm></p:spPr><p:txBody><a:bodyPr anchor="b"/><a:lstStyle/><a:p><a:r><a:rPr lang="de-DE"/><a:t>Titel</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Untertitel"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="3657600"/><a:ext cx="${W - 1828800}" cy="1143000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="de-DE"/><a:t>Untertitel</a:t></a:r></a:p></p:txBody></p:sp>`
    : `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Titel"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="365760"/><a:ext cx="${W - 1371600}" cy="914400"/></a:xfrm></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr lang="de-DE"/><a:t>Titel</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Inhalt"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1463040"/><a:ext cx="${W - 1371600}" cy="${H - 1463040 - 548640}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="de-DE"/><a:t>Text</a:t></a:r></a:p></p:txBody></p:sp>`);
  const grp = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  const layout = (n, titelfolie, name) => ({ name: `ppt/slideLayouts/slideLayout${n}.xml`, data: `${HEAD}<p:sldLayout ${NS} type="${titelfolie ? 'title' : 'obj'}" preserve="1"><p:cSld name="${name}"><p:spTree>${grp}${layoutShapes(titelfolie)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` });
  const lvl = (n, sz, bold) => `<a:lvl${n}pPr marL="${(n - 1) * 285750}" algn="l" defTabSz="914400"><a:buNone/><a:defRPr sz="${sz}"${bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${DARK}"/></a:solidFill><a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:defRPr></a:lvl${n}pPr>`;
  const master = `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${grp}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Titel"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="365760"/><a:ext cx="${W - 1371600}" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr lang="de-DE"/><a:t>Titel</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Text"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1463040"/><a:ext cx="${W - 1371600}" cy="${H - 1463040 - 548640}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="de-DE"/><a:t>Text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/><p:sldLayoutId id="2147483650" r:id="rId2"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle>${lvl(1, 3400, true)}</p:titleStyle><p:bodyStyle>${[1, 2, 3].map((n) => lvl(n, 2400 - n * 200, false)).join('')}</p:bodyStyle><p:otherStyle>${lvl(1, 1800, false)}</p:otherStyle></p:txStyles></p:sldMaster>`;

  const theme = (name) => `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${name}"><a:themeElements><a:clrScheme name="Mango"><a:dk1><a:srgbClr val="${DARK}"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="${GRAY}"/></a:dk2><a:lt2><a:srgbClr val="F3F1EC"/></a:lt2><a:accent1><a:srgbClr val="${ACCENT}"/></a:accent1><a:accent2><a:srgbClr val="E08A3C"/></a:accent2><a:accent3><a:srgbClr val="4C9A6B"/></a:accent3><a:accent4><a:srgbClr val="C4506B"/></a:accent4><a:accent5><a:srgbClr val="3E8EC4"/></a:accent5><a:accent6><a:srgbClr val="8A8D99"/></a:accent6><a:hlink><a:srgbClr val="${ACCENT}"/></a:hlink><a:folHlink><a:srgbClr val="7A5FA8"/></a:folHlink></a:clrScheme><a:fontScheme name="Mango"><a:majorFont><a:latin typeface="${FONT}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${FONT}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Mango"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

  const notesMaster = `${HEAD}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${grp}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Folienbild"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notizen"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="de-DE"/><a:t>Notizen</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="${FONT}"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>`;

  const all = [
    { name: '[Content_Types].xml', data: content },
    { name: '_rels/.rels', data: rels([{ id: 'rId1', type: 'officeDocument', target: 'ppt/presentation.xml' }, { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' }]) },
    { name: 'docProps/core.xml', data: core },
    { name: 'ppt/presentation.xml', data: pres },
    { name: 'ppt/_rels/presentation.xml.rels', data: rels(presRels) },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: master },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: rels([{ id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }, { id: 'rId2', type: 'slideLayout', target: '../slideLayouts/slideLayout2.xml' }, { id: 'rId3', type: 'theme', target: '../theme/theme1.xml' }]) },
    layout(1, true, 'Titelfolie'), layout(2, false, 'Titel und Inhalt'),
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: rels([{ id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' }]) },
    { name: 'ppt/slideLayouts/_rels/slideLayout2.xml.rels', data: rels([{ id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' }]) },
    { name: 'ppt/theme/theme1.xml', data: theme('Mango') },
  ];
  if (notizenVorhanden) {
    all.push({ name: 'ppt/notesMasters/notesMaster1.xml', data: notesMaster },
      { name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: rels([{ id: 'rId1', type: 'theme', target: '../theme/theme2.xml' }]) },
      { name: 'ppt/theme/theme2.xml', data: theme('Mango Notizen') });
  }
  return writeZip([...all, ...files]);
}

module.exports = { markdownToPptx, zerlegen };
