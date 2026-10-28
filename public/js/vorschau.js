// Vorschau von Dateien in der App: PDF, Bilder, Text, Word, PowerPoint, Excel (vereinfacht).
import { api } from './api.js';
import { h, btn, toast, dialog, iconEl, fmtRelative } from './ui.js';
import { fileIcon } from './icons.js';
import { renderMarkdown } from './markdown.js';

export async function openExternal(path, { reveal = false } = {}) {
  try {
    await api.post('/api/files/open', { path, reveal });
  } catch (err) {
    if (err.status === 501 && !reveal) { window.open(api.rawUrl(path), '_blank', 'noopener'); return; }
    toast(err.status === 404 ? 'Datei nicht gefunden – sie wurde eventuell verschoben oder gelöscht.' : err.message, { error: true });
  }
}

function tabelle(rows, { kopf = true } = {}) {
  const t = h('table', { class: 'vs-table' });
  rows.forEach((r, i) => t.append(h('tr', {}, ...r.map((c) => h(kopf && i === 0 ? 'th' : 'td', {}, c)))));
  return h('div', { class: 'vs-table-wrap' }, t);
}

function wordAnsicht(info) {
  const box = h('div', { class: 'vs-doc' });
  for (const b of info.bloecke) {
    if (b.t === 'h') box.append(h(`h${Math.min(4, b.n + 1)}`, {}, b.text));
    else if (b.t === 'tabelle') box.append(tabelle(b.rows));
    else box.append(h('p', { class: b.text === '[Bild]' ? 'vs-bild' : '' }, b.text));
  }
  if (!info.bloecke.length) box.append(h('p', { class: 'vs-leer' }, 'Die Datei hat noch keinen Text.'));
  if (info.gekuerzt) box.append(h('p', { class: 'vs-leer' }, 'Die Vorschau zeigt nur den Anfang. Öffne die Datei im Programm für alles.'));
  return box;
}

// Gezeichnete Folien (wie in PowerPoint), je Folie auf die Fensterbreite skaliert.
function folienAnsicht(info) {
  const box = h('div', { class: 'vs-slides vs-slides-echt' });
  const seiten = info.seiten;
  if (!seiten) return folienText(info);
  const anpassen = [];
  info.folien.forEach((f, i) => {
    const rahmen = h('div', { class: 'vs-folie-rahmen', style: { aspectRatio: `${seiten.breite} / ${seiten.hoehe}` } });
    const innen = h('div', { class: 'vs-folie-innen', style: { width: `${seiten.breite}px`, height: `${seiten.hoehe}px` }, html: seiten.folien[i] || '' });
    rahmen.append(innen);
    anpassen.push(() => { const k = rahmen.clientWidth / seiten.breite; if (k > 0) innen.style.transform = `scale(${k})`; });
    const block = h('section', { class: 'vs-folie' }, h('div', { class: 'vs-nr' }, `Folie ${i + 1}`), rahmen);
    if (f && f.notizen) block.append(h('p', { class: 'vs-notiz' }, h('b', {}, 'Notizen: '), f.notizen));
    box.append(block);
  });
  const messen = () => anpassen.forEach((fn) => fn());
  if (typeof ResizeObserver === 'function') new ResizeObserver(messen).observe(box); else window.addEventListener('resize', messen);
  setTimeout(messen);
  if (info.gesamt > seiten.folien.length) box.append(h('p', { class: 'vs-leer' }, `Die Vorschau zeigt die ersten ${seiten.folien.length} von ${info.gesamt} Folien.`));
  return box;
}

// Nur Text (falls Folien nicht gezeichnet werden konnten)
function folienText(info) {
  const box = h('div', { class: 'vs-slides' });
  info.folien.forEach((f, i) => {
    const s = h('section', { class: 'vs-slide' }, h('div', { class: 'vs-nr' }, `Folie ${i + 1}`), h('h4', {}, f.titel || '(ohne Titel)'));
    const ul = h('ul', {});
    for (const z of f.zeilen) {
      if (z.punkt) ul.append(h('li', { style: { marginLeft: `${z.ebene * 16}px` } }, z.text));
      else s.append(h('p', {}, z.text));
    }
    if (ul.children.length) s.append(ul);
    for (const t of f.tabellen) s.append(tabelle(t));
    if (f.bilder) s.append(h('p', { class: 'vs-bild' }, `${f.bilder} ${f.bilder === 1 ? 'Bild' : 'Bilder'}`));
    if (f.notizen) s.append(h('p', { class: 'vs-notiz' }, h('b', {}, 'Notizen: '), f.notizen));
    box.append(s);
  });
  return box;
}

function tabellenAnsicht(info) {
  const box = h('div', { class: 'vs-sheets' });
  for (const b of info.blaetter) {
    box.append(h('h4', {}, b.name), b.rows.length ? tabelle(b.rows) : h('p', { class: 'vs-leer' }, 'Leeres Blatt'));
  }
  return box;
}

export function previewable(kind) {
  return ['word', 'pdf', 'praesentation', 'tabelle', 'image', 'markdown', 'text'].includes(kind);
}

export async function showPreview(path) {
  const name = path.split('/').pop();
  const body = h('div', { class: 'vs-body' }, h('p', { class: 'vs-leer' }, 'Wird geladen …'));
  const foot = h('div', { class: 'vs-foot' });
  const d = dialog({ title: name, body, footer: foot, wide: true });
  const aktionen = () => foot.append(
    btn('Im Programm öffnen', { iconName: 'external', cls: 'btn btn-primary', onClick: () => openExternal(path) }),
    btn('Im Ordner zeigen', { iconName: 'folder', cls: 'btn btn-soft', onClick: () => openExternal(path, { reveal: true }) }),
    btn('Herunterladen', { iconName: 'download', cls: 'btn btn-soft', onClick: () => { window.location.href = api.rawUrl(path, true); } }));
  let info;
  try {
    info = await api.get(`/api/files/vorschau?path=${encodeURIComponent(path)}`);
  } catch (err) {
    body.replaceChildren(h('p', { class: 'vs-leer' }, err.message));
    return d;
  }
  d.el.querySelector('.dialog-head h2').after(h('span', { class: 'vs-meta' }, `${info.sizeLabel} · ${fmtRelative(info.mtime)}`));
  let inhalt;
  if (info.typ === 'pdf') {
    // Ohne eingebauten PDF-Viewer bleibt der Rahmen leer: dann nur den Hinweis zeigen.
    inhalt = navigator.pdfViewerEnabled === false
      ? h('p', { class: 'vs-leer' }, 'Dieses Fenster kann PDFs nicht anzeigen. Öffne die Datei im Programm.')
      : h('div', {}, h('iframe', { class: 'vs-pdf', src: api.rawUrl(path), title: `Vorschau ${name}` }),
        h('p', { class: 'vs-leer' }, 'Wird das PDF nicht angezeigt, öffne es im Programm.'));
  } else if (info.typ === 'bild') inhalt = h('img', { class: 'vs-img', src: api.rawUrl(path), alt: name });
  else if (info.typ === 'text') {
    inhalt = info.markdown ? h('div', { class: 'vs-doc md', html: renderMarkdown(info.text) }) : h('pre', { class: 'vs-pre' }, info.text);
    if (info.gekuerzt) inhalt = h('div', {}, inhalt, h('p', { class: 'vs-leer' }, 'Die Vorschau zeigt nur den Anfang.'));
  } else if (info.typ === 'word') inhalt = wordAnsicht(info);
  else if (info.typ === 'folien') inhalt = folienAnsicht(info);
  else if (info.typ === 'tabelle') inhalt = tabellenAnsicht(info);
  else inhalt = h('p', { class: 'vs-leer' }, info.hinweis || 'Keine Vorschau möglich.');
  const kannEcht = ['word', 'folien'].includes(info.typ) && navigator.pdfViewerEnabled !== false;
  let status = null;
  if (['word', 'folien', 'tabelle'].includes(info.typ)) {
    status = h('p', { class: 'vs-hinweis' }, iconEl('info', 14), info.typ === 'folien' && info.seiten
      ? ' Nachgezeichnete Ansicht der Folien.'
      : ' Vereinfachte Vorschau. Das echte Aussehen siehst du im Programm.');
    inhalt = h('div', {}, status, inhalt);
  }
  body.replaceChildren(inhalt);
  aktionen();
  // Originalansicht: Word bzw. PowerPoint (oder LibreOffice) erzeugt im Hintergrund ein PDF.
  if (kannEcht) {
    const wartet = h('span', { class: 'vs-warte' }, ' Originalansicht wird erstellt …');
    status.append(wartet);
    api.post('/api/files/vorschau/echt', { path }).then((r) => {
      if (!r.ok || !document.body.contains(body)) { wartet.remove(); return; }
      body.replaceChildren(h('div', {},
        h('p', { class: 'vs-hinweis' }, iconEl('check', 14), ` Originalansicht (erzeugt mit ${r.quelle})`),
        h('iframe', { class: 'vs-pdf vs-pdf-hoch', src: api.vorschauPdfUrl(path), title: `Originalansicht ${name}` })));
    }).catch(() => wartet.remove());
  }
  return d;
}
