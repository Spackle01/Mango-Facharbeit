// Drop-in: Dateien und Ordner auswählen oder hineinziehen, hochladen und prüfen lassen.
// Danach sortiert der Assistent alles in die Facharbeit ein (startImportChat in app.js).
import { api, TOKEN } from './api.js';
import { h, iconEl, btn, dialog, toast } from './ui.js';

const MAX_FILES = 2000;
const MAX_FILE = 200 * 1024 * 1024;
const MAX_TOTAL = 1024 * 1024 * 1024;

export function isJunk(rel) {
  const parts = rel.split('/');
  const name = parts[parts.length - 1];
  if (!name) return true;
  if (parts.some((p) => p === '__MACOSX' || p === '.git' || p === 'node_modules')) return true;
  if (name.startsWith('.') || name.startsWith('~$') || name.startsWith('._')) return true;
  return /^(thumbs\.db|desktop\.ini)$/i.test(name) || /\.(tmp|crdownload|part)$/i.test(name);
}

function sizeLabel(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

// ---------- Dateien einsammeln ----------

function readAllEntries(reader) {
  return new Promise((resolve) => {
    const all = [];
    const next = () => reader.readEntries((batch) => {
      if (!batch.length) { resolve(all); return; }
      all.push(...batch);
      next();
    }, () => resolve(all));
    next();
  });
}

async function walkEntry(entry, out) {
  if (entry.isFile) {
    const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
    if (file) out.push({ file, rel: entry.fullPath.replace(/^\/+/, '') });
  } else if (entry.isDirectory) {
    for (const child of await readAllEntries(entry.createReader())) await walkEntry(child, out);
  }
}

// Muss synchron im drop-Ereignis aufgerufen werden (danach sind die Einträge nicht mehr verfügbar).
export function entriesFromDrop(dataTransfer) {
  const entries = [];
  const plain = [];
  for (const item of dataTransfer.items || []) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
    else { const f = item.getAsFile(); if (f) plain.push(f); }
  }
  const hasFolder = entries.some((e) => e.isDirectory);
  return {
    hasFolder,
    async collect() {
      const out = plain.map((file) => ({ file, rel: file.name }));
      for (const e of entries) await walkEntry(e, out);
      return out;
    },
  };
}

export function itemsFromInput(fileList) {
  return [...fileList].map((file) => ({ file, rel: file.webkitRelativePath || file.name }));
}

// ---------- Auswahl-Baustein ----------

export function createPicker({ onChange } = {}) {
  let items = [];
  let skipped = 0;
  const fileInput = h('input', { type: 'file', multiple: true, hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
  const dirInput = h('input', { type: 'file', multiple: true, hidden: true, tabindex: '-1', 'aria-hidden': 'true', webkitdirectory: true });
  const list = h('div', { class: 'import-list', 'aria-live': 'polite' });
  const zone = h('div', { class: 'drop-zone', tabindex: '0', role: 'group', 'aria-label': 'Dateien oder Ordner hier ablegen' },
    iconEl('upload', 22),
    h('div', { class: 'dz-title' }, 'Dateien und Ordner hierher ziehen'),
    h('div', { class: 'dz-buttons' },
      btn('Dateien wählen', { iconName: 'file', cls: 'btn btn-soft btn-sm', size: 16, onClick: () => fileInput.click() }),
      btn('Ordner wählen', { iconName: 'folder', cls: 'btn btn-soft btn-sm', size: 16, onClick: () => dirInput.click() })),
    fileInput, dirInput);

  const add = (newItems) => {
    for (const it of newItems) {
      if (isJunk(it.rel)) { skipped += 1; continue; }
      if (items.some((x) => x.rel === it.rel && x.file.size === it.file.size)) continue;
      items.push(it);
    }
    render();
    if (onChange) onChange(items);
  };

  const render = () => {
    list.innerHTML = '';
    if (!items.length) return;
    const groups = new Map();
    for (const it of items) {
      const top = it.rel.includes('/') ? it.rel.split('/')[0] : '';
      if (!groups.has(top)) groups.set(top, []);
      groups.get(top).push(it);
    }
    const total = items.reduce((s, x) => s + x.file.size, 0);
    const tooBig = items.filter((x) => x.file.size > MAX_FILE);
    if (groups.size > 1 || skipped) list.append(h('div', { class: 'import-sum' },
      h('b', {}, `${items.length} ${items.length === 1 ? 'Datei' : 'Dateien'}`), ` · ${sizeLabel(total)}`,
      skipped ? h('span', { class: 'muted' }, ` · ${skipped} Systemdateien übersprungen`) : null));
    for (const [top, group] of groups) {
      const label = top ? `${top}/` : group.length === 1 ? group[0].rel : 'Einzelne Dateien';
      const row = h('div', { class: 'import-row' },
        iconEl(top ? 'folder' : 'file', 16),
        h('span', { class: 'name', title: top ? group.map((g) => g.rel).slice(0, 30).join('\n') : label }, label),
        h('span', { class: 'muted' }, top || group.length > 1 ? `${group.length} Dateien · ${sizeLabel(group.reduce((s, x) => s + x.file.size, 0))}` : sizeLabel(group[0].file.size)),
        btn('', { iconName: 'x', cls: 'btn btn-sm btn-icon', title: `${label} entfernen`, size: 15, onClick: () => { items = items.filter((x) => !group.includes(x)); render(); if (onChange) onChange(items); } }));
      list.append(row);
    }
    if (tooBig.length) list.append(h('div', { class: 'field-note warn' }, `${tooBig.length} Datei(en) über 200 MB werden nicht übernommen.`));
    if (items.length > MAX_FILES) list.append(h('div', { class: 'field-note err' }, `Höchstens ${MAX_FILES} Dateien auf einmal.`));
    if (total > MAX_TOTAL) list.append(h('div', { class: 'field-note err' }, 'Höchstens 1 GB auf einmal.'));
  };

  fileInput.addEventListener('change', () => { add(itemsFromInput(fileInput.files)); fileInput.value = ''; });
  dirInput.addEventListener('change', () => { add(itemsFromInput(dirInput.files)); dirInput.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('over');
    const d = entriesFromDrop(e.dataTransfer);
    add(await d.collect());
  });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

  return {
    el: h('div', { class: 'import-picker' }, zone, list),
    add,
    items: () => items.filter((x) => x.file.size <= MAX_FILE),
    tooLarge: () => items.filter((x) => x.file.size > MAX_FILE),
    valid: () => items.length > 0 && items.length <= MAX_FILES && items.reduce((s, x) => s + x.file.size, 0) <= MAX_TOTAL,
  };
}

// ---------- Fortschritt ----------

export function createProgress() {
  const label = h('div', { class: 'ip-label' }, '');
  const bar = h('i');
  const el = h('div', { class: 'import-progress', role: 'status', 'aria-live': 'polite' }, label, h('div', { class: 'ip-bar' }, bar));
  return {
    el,
    set(text, fraction) {
      label.textContent = text;
      if (fraction == null) el.classList.add('indeterminate');
      else { el.classList.remove('indeterminate'); bar.style.width = `${Math.round(Math.min(1, fraction) * 100)}%`; }
    },
  };
}

// ---------- Hochladen und prüfen ----------

function uploadOne(importId, it) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/import/${importId}/dateien`);
    xhr.setRequestHeader('x-mango-token', TOKEN);
    xhr.setRequestHeader('x-relpath', encodeURIComponent(it.rel));
    xhr.setRequestHeader('x-last-modified', String(it.file.lastModified || ''));
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* leer */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Upload fehlgeschlagen (${xhr.status})`));
    };
    xhr.onerror = async () => {
      // Häufigste Ursache: Datei ist gesperrt, wurde verschoben oder darf nicht gelesen werden.
      try { await it.file.slice(0, 1).arrayBuffer(); } catch { reject(new Error('Datei konnte nicht gelesen werden (geöffnet, verschoben oder keine Berechtigung).')); return; }
      reject(new Error('Upload fehlgeschlagen – keine Verbindung zur App.'));
    };
    xhr.send(it.file);
  });
}

// Lädt alle Dateien hoch und lässt sie prüfen. Liefert die Inventar-Zusammenfassung.
export async function runImport(items, progress, skippedLarge = []) {
  const imp = await api.post('/api/import');
  const total = items.reduce((s, x) => s + x.file.size, 0) || 1;
  let done = 0;
  const failed = [];
  for (let i = 0; i < items.length; i++) {
    progress.set(`Dateien werden hochgeladen … ${i + 1} von ${items.length}`, done / total);
    try { await uploadOne(imp.id, items[i]); } catch (err) { failed.push({ rel: items[i].rel, error: err.message }); }
    done += items[i].file.size;
  }
  for (const it of skippedLarge) failed.push({ rel: it.rel, error: 'Größer als 200 MB' });
  if (items.length && failed.length === items.length) throw new Error(`Keine Datei konnte übernommen werden: ${failed[0].error}`);
  if (!items.length) throw new Error('Keine Datei zum Übernehmen ausgewählt.');
  progress.set('Dateien werden geprüft …', 0);
  let inventar = null;
  await api.stream('POST', `/api/import/${imp.id}/analyse`, { fehlgeschlagen: failed }, (ev) => {
    if (ev.type === 'fortschritt' && ev.gesamt) progress.set(`Dateien werden geprüft … ${ev.aktuell} von ${ev.gesamt}`, ev.aktuell / ev.gesamt);
    if (ev.type === 'fertig') inventar = ev.inventar;
  });
  if (!inventar) throw new Error('Die Prüfung der Dateien wurde nicht abgeschlossen.');
  inventar.fehlgeschlagen = failed;
  progress.set('Der Assistent sortiert ein …', null);
  return inventar;
}

// Direkt nach dem Hineinziehen: ohne Rückfrage hochladen und prüfen, Fortschritt unten rechts.
let dropInRunning = false;
export async function dropIn(items, onDone) {
  const usable = items.filter((x) => !isJunk(x.rel));
  if (!usable.length) { toast('Keine Dateien zum Einsortieren gefunden.'); return; }
  if (dropInRunning) { toast('Es wird gerade schon etwas einsortiert. Bitte kurz warten.'); return; }
  if (usable.length > MAX_FILES) { toast(`Höchstens ${MAX_FILES} Dateien auf einmal.`, { error: true }); return; }
  const tooBig = usable.filter((x) => x.file.size > MAX_FILE);
  const ok = usable.filter((x) => x.file.size <= MAX_FILE);
  if (ok.reduce((s, x) => s + x.file.size, 0) > MAX_TOTAL) { toast('Höchstens 1 GB auf einmal.', { error: true }); return; }
  dropInRunning = true;
  const progress = createProgress();
  const box = h('div', { class: 'dropin-status', role: 'status' },
    h('div', { class: 'ds-head' }, iconEl('upload', 16), h('b', {}, `${usable.length} ${usable.length === 1 ? 'Datei' : 'Dateien'} einsortieren`)), progress.el);
  document.body.append(box);
  try {
    const inv = await runImport(ok, progress, tooBig);
    box.remove();
    onDone(inv);
  } catch (err) {
    box.remove();
    toast(err.message, { error: true });
  } finally {
    dropInRunning = false;
  }
}

// Dialog zum Auswählen (Seitenleiste, Büroklammer, Bereich „Dateien“).
export function openImportDialog(initialItems, onDone) {
  const picker = createPicker({ onChange: () => { start.disabled = !picker.valid(); } });
  const progress = createProgress();
  progress.el.hidden = true;
  const start = btn('Einsortieren', { cls: 'btn btn-primary' });
  const cancel = btn('Abbrechen', { cls: 'btn' });
  start.disabled = true;
  const note = h('p', {}, 'Alles, was du schon für deine Facharbeit gemacht hast: Entwürfe, Notizen, Quellen, Bilder. Mango sortiert es in die passenden Ordner ein und aktualisiert deinen Arbeitsstand. Die Originale bleiben unverändert.');
  const d = dialog({ title: 'Dateien einsortieren', body: h('div', {}, note, picker.el, progress.el), footer: [cancel, start] });
  if (initialItems && initialItems.length) picker.add(initialItems);
  cancel.addEventListener('click', () => d.close());
  start.addEventListener('click', async () => {
    start.disabled = true;
    cancel.disabled = true;
    picker.el.hidden = true;
    progress.el.hidden = false;
    try {
      const inv = await runImport(picker.items(), progress, picker.tooLarge());
      d.close();
      onDone(inv);
    } catch (err) {
      toast(err.message, { error: true });
      picker.el.hidden = false;
      progress.el.hidden = true;
      start.disabled = false;
      cancel.disabled = false;
    }
  });
  return d;
}

