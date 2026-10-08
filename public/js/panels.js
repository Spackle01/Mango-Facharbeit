// Leichte Seitenpanels: Arbeitsstand, Arbeitsraum (Dateien) und Projektangaben.
import { api } from './api.js';
import { h, iconEl, btn, toast, menu, popover, dialog, fmtRelative, fmtDate, parseLocal, daysUntil, parseDateDE, formatDateDE, shortPath } from './ui.js';
import { fileIcon } from './icons.js';
import {
  S, project, setProject, statusPill, statusMenu, setTaskStatus, openFile, refreshFiles, renderTopbar, startImportChat,
} from './app.js';
import { openImportDialog } from './importer.js';
import { renderMarkdown } from './markdown.js';

let current = null; // { id, el, scrim, prevFocus }

export function currentPanel() {
  return current ? current.id : null;
}

export function closePanel() {
  if (!current) return;
  const { el, scrim, prevFocus } = current;
  current = null;
  document.removeEventListener('keydown', panelKeys, true);
  el.classList.add('closing');
  scrim.remove();
  setTimeout(() => el.remove(), 130);
  renderTopbar();
  if (prevFocus && prevFocus.isConnected) prevFocus.focus();
}

function panelKeys(e) {
  if (e.key === 'Escape' && current && !document.querySelector('.dialog-scrim') && !document.querySelector('.popover')) {
    e.stopPropagation();
    closePanel();
  }
}

const TITLES = { stand: 'Arbeitsstand', dateien: 'Dateien', projekt: 'Projekt' };

export function openPanel(id) {
  if (current && current.id === id) return;
  const prevFocus = current ? current.prevFocus : document.activeElement;
  if (current) { current.el.remove(); current.scrim.remove(); current = null; }
  const titleId = `panel-${id}`;
  const body = h('div', { class: 'panel-body' });
  const headExtra = h('div', { class: 'head-extra' });
  const el = h('aside', { class: 'panel', role: 'dialog', 'aria-labelledby': titleId },
    h('div', { class: 'panel-head' }, h('h2', { id: titleId }, TITLES[id]), headExtra, btn('', { iconName: 'x', cls: 'btn btn-icon', title: 'Schließen', onClick: closePanel })),
    body);
  const scrim = h('div', { class: 'scrim', onclick: closePanel });
  document.body.append(scrim, el);
  current = { id, el, scrim, body, headExtra, prevFocus };
  document.addEventListener('keydown', panelKeys, true);
  renderTopbar();
  refreshPanel(true);
}

export async function refreshPanel(focus = false) {
  if (!current) return;
  const { id, body, headExtra } = current;
  if (id === 'stand') renderStand(body, headExtra);
  else if (id === 'dateien') await renderFiles(body, headExtra);
  else if (id === 'projekt') renderProject(body, headExtra);
  if (focus) {
    const target = body.querySelector('input, button') || current.el.querySelector('.panel-head .btn');
    if (target) target.focus({ preventScroll: true });
  }
}

// ---------- Arbeitsstand ----------

const openPhases = new Set(['vorbereitung', 'konsultationen', 'erarbeitung', 'fertigstellung', 'verteidigung']);
const openTasks = new Set();

function dueLabel(t) {
  const d = parseLocal(t.frist);
  if (!d) return null;
  const n = daysUntil(d);
  const over = n < 0 && t.status !== 'erledigt';
  return h('span', { class: `t-due${over ? ' over' : ''}`, title: over ? 'Frist vorbei' : `Frist: ${fmtDate(d.toISOString())}` }, fmtDate(d.toISOString()));
}

function renderStand(body, headExtra) {
  const p = project();
  headExtra.replaceChildren(btn('', {
    iconName: 'info', cls: 'btn btn-icon', title: 'Was bedeuten die Status?', onClick: (e) => {
      popover(e.currentTarget, h('div', { class: 'legend' },
        statusPill('offen'), h('span', {}, 'Noch nicht begonnen'),
        statusPill('in_arbeit'), h('span', {}, 'Begonnen, aber noch nicht abgeschlossen oder geprüft'),
        statusPill('erledigt'), h('span', {}, 'Fertiggestellt und anhand der Vorgaben geprüft')), { placement: 'bottom-end', focusFirst: false });
    },
  }));
  body.innerHTML = '';
  const tasks = p.aufgaben;
  const done = tasks.filter((t) => t.status === 'erledigt').length;
  const wip = tasks.filter((t) => t.status === 'in_arbeit').length;
  const pct = (n) => `${(n / tasks.length) * 100}%`;
  const summary = h('div', { class: 'progress-summary' },
    h('div', { class: 'line' }, h('span', {}, h('b', {}, `${done} von ${tasks.length}`), ' erledigt'), h('span', {}, `${wip} in Arbeit`)),
    h('div', { class: 'bar', role: 'img', 'aria-label': `${done} von ${tasks.length} Aufgaben erledigt, ${wip} in Arbeit` }, h('div', { class: 'done', style: { width: pct(done) } }), h('div', { class: 'wip', style: { width: pct(wip) } })));
  for (const f of (p.fristen || []).slice(0, 2)) summary.append(h('div', { class: 'deadline' }, iconEl('calendar', 15), h('span', {}, `${f.titel}: ${f.text}`)));
  body.append(summary);

  for (const phase of S.state.meta.phasen) {
    const items = tasks.filter((t) => t.phase === phase.id);
    const n = items.filter((t) => t.status === 'erledigt').length;
    const det = h('details', { class: 'phase', open: openPhases.has(phase.id) || null },
      h('summary', {}, iconEl('chevronRight', 15), h('span', {}, phase.titel), h('span', { class: 'n' }, `${n}/${items.length}`)));
    det.addEventListener('toggle', () => { if (det.open) openPhases.add(phase.id); else openPhases.delete(phase.id); });
    for (const t of items) det.append(taskEl(t));
    body.append(det);
  }
}

function taskEl(t) {
  const wrap = h('div', { class: 'task' });
  const pill = statusPill(t.status, { asButton: true });
  pill.addEventListener('click', () => statusMenu(pill, t.status, (s) => { if (s !== t.status) setTaskStatus(t.id, s); }));
  const detailId = `task-${t.id}`;
  const title = h('button', { type: 'button', class: 't-title', 'aria-expanded': openTasks.has(t.id) ? 'true' : 'false', 'aria-controls': detailId }, t.titel);
  const row = h('div', { class: 'task-row' }, pill, title, dueLabel(t));
  const detail = h('div', { class: 'task-detail', id: detailId, hidden: !openTasks.has(t.id) || null });
  detail.append(h('p', {}, t.hilfe));
  if (t.notiz) detail.append(h('p', {}, h('b', {}, 'Notiz: '), t.notiz));
  if (t.nachweis) {
    const ev = h('p', { class: 'ev' }, h('b', {}, 'Nachweis: '));
    const m = /[\w./ ()-]+\.(md|docx|pdf|txt|pptx|xlsx|png|jpg)/i.exec(t.nachweis);
    if (m && S.fileIndex.has(m[0].trim())) {
      ev.append(h('button', { type: 'button', class: 'file-ref', onclick: () => openFile(m[0].trim()) }, m[0].trim()));
      const rest = t.nachweis.replace(m[0], '').trim();
      if (rest) ev.append(` ${rest}`);
    } else ev.append(t.nachweis);
    detail.append(ev);
  }
  const who = t.von === 'assistent' ? 'vom Assistenten' : t.von === 'nutzer' ? 'von dir' : '';
  detail.append(h('p', { class: 'src' }, `Quelle: ${t.quelle}${t.extern ? ' · Ergebnis außerhalb der App, Status bitte selbst setzen' : ''}${t.am ? ` · geändert ${who} am ${fmtDate(t.am, { time: true })}` : ''}`));
  title.addEventListener('click', () => {
    const open = detail.hidden;
    detail.hidden = !open;
    title.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) openTasks.add(t.id); else openTasks.delete(t.id);
  });
  wrap.append(row, detail);
  return wrap;
}

// ---------- Arbeitsraum ----------

let fileFilter = '';
const openGroups = new Set(['anhaenge']);

function groupLabel(dir) {
  const names = {
    '00_vorgaben': 'Vorgaben der Schule', '01_themenfindung_und_mindmap': 'Themenfindung und Mindmap', '02_expose_und_zeitplan': 'Exposé und Zeitplan',
    '03_literatur_und_quellen': 'Literatur und Quellen', '04_forschung_und_eigenanteil': 'Forschung und Eigenanteil', '05_facharbeit_entwurf': 'Facharbeit (Entwurf)',
    '06_lerntagebuch_und_konsultationen': 'Lerntagebuch und Konsultationen', '07_ki_prompts_anhang': 'KI-Nutzung und Anhang', '08_praesentation_verteidigung': 'Präsentation und Verteidigung',
    anhaenge: 'Anhänge aus dem Chat', uebernommen: 'Originale (mitgebracht)', exporte: 'Exporte', '': 'Hauptordner',
  };
  return names[dir] || dir;
}

function fileRow(f, { indent = false, showDir = false } = {}) {
  const row = h('div', { class: `file-row${indent ? ' file-indent' : ''}` });
  const main = h('button', { type: 'button', class: 'f-main', title: `${f.path} öffnen` },
    h('span', { html: fileIcon(f.kind, 18) }).firstChild,
    h('span', { class: 'f-text' }, h('span', { class: 'f-name' }, f.name),
      h('span', { class: 'f-meta' }, [showDir ? f.path.split('/').slice(0, -1).join('/') : null, fmtRelative(f.mtime), f.sizeLabel].filter(Boolean).join(' · '))));
  main.addEventListener('click', () => openFile(f.path));
  const more = btn('', { iconName: 'more', cls: 'btn btn-sm btn-icon', title: `Weitere Aktionen für ${f.name}`, attrs: { 'aria-haspopup': 'menu' } });
  more.addEventListener('click', () => {
    menu(more, [
      { label: 'Öffnen', icon: 'external', onClick: () => openFile(f.path) },
      { label: 'Im Ordner zeigen', icon: 'folder', onClick: () => openFile(f.path, { reveal: true }) },
      { label: 'Im Chat anhängen', icon: 'clip', onClick: () => attachFromPanel(f.path) },
      { label: 'Herunterladen', icon: 'download', onClick: () => { window.location.href = api.rawUrl(f.path, true); } },
      /\.(md|txt)$/i.test(f.name) ? { label: 'Als Word-Datei exportieren', icon: 'fileText', onClick: () => exportDocx(f.path) } : null,
      { label: 'Frühere Fassungen', icon: 'history', onClick: () => showVersions(f) },
    ], { placement: 'bottom-end' });
  });
  row.append(main, h('span', { class: 'f-actions' },
    btn('', { iconName: 'clip', cls: 'btn btn-sm btn-icon', title: 'Im Chat anhängen', size: 16, onClick: () => attachFromPanel(f.path) })), more);
  return row;
}

function attachFromPanel(path) {
  window.dispatchEvent(new CustomEvent('mango:attach', { detail: [path] }));
  toast('Als Anhang hinzugefügt');
}

async function exportDocx(path) {
  try {
    const r = await api.post('/api/export/docx', { path });
    toast(`Word-Datei erstellt: ${r.path.split('/').pop()}`, { action: { label: 'Öffnen', run: () => openFile(r.path) } });
    refreshPanel();
  } catch (err) { toast(err.message, { error: true }); }
}

async function showVersions(f) {
  let info;
  try { info = await api.get(`/api/files/info?path=${encodeURIComponent(f.path)}`); } catch (err) { toast(err.message, { error: true }); return; }
  const list = info.versions || [];
  const body = list.length
    ? h('div', {}, h('p', {}, 'Diese Fassungen wurden gesichert, bevor der Assistent die Datei geändert hat.'), ...list.map((v) => h('div', { class: 'file-row' },
      h('button', { type: 'button', class: 'f-main', onclick: () => openFile(v.path) }, iconEl('history', 17),
        h('span', { class: 'f-text' }, h('span', { class: 'f-name' }, fmtRelative(v.mtime)), h('span', { class: 'f-meta' }, v.name))),
      btn('Als Kopie wiederherstellen', { cls: 'btn btn-sm', onClick: async () => {
        try { const r = await api.post('/api/files/restore', { path: f.path, version: v.path }); toast(`Wiederhergestellt als ${r.path.split('/').pop()}`); d.close(); refreshPanel(); } catch (err) { toast(err.message, { error: true }); }
      } }))))
    : h('p', {}, 'Für diese Datei gibt es noch keine gesicherten Fassungen.');
  const d = dialog({ title: `Frühere Fassungen: ${f.name}`, body });
}

async function renderFiles(body, headExtra) {
  const p = project();
  headExtra.replaceChildren();
  const files = await refreshFiles();
  if (!current || current.id !== 'dateien') return;
  const created = Date.parse(p.createdAt || 0) || 0;
  const scrollTop = body.scrollTop;
  body.innerHTML = '';

  const openBtn = btn('Arbeitsraum öffnen', { iconName: 'folderOpen', cls: 'btn btn-primary', onClick: () => openWorkspace() });
  const tools = h('div', { class: 'files-tools' }, openBtn);
  if (S.state.antigravityApp) tools.append(btn('In Antigravity öffnen', { iconName: 'external', cls: 'btn btn-soft', onClick: () => openWorkspace('antigravity') }));
  const moreBtn = btn('Exportieren', { iconName: 'download', cls: 'btn btn-soft', attrs: { 'aria-haspopup': 'menu' } });
  moreBtn.addEventListener('click', () => menu(moreBtn, [
    { label: 'Gesprächsverläufe für den Anhang', icon: 'history', onClick: exportTranscripts },
    { label: 'Facharbeit als Word-Datei', icon: 'fileText', onClick: exportFacharbeit },
    { label: 'Sicherung als ZIP herunterladen', icon: 'archive', onClick: () => { window.location.href = `/api/export/backup?t=${encodeURIComponent(document.querySelector('meta[name="mango-token"]').content)}`; } },
  ]));
  tools.append(moreBtn);
  tools.append(btn('Dateien einsortieren', { iconName: 'upload', cls: 'btn btn-soft', onClick: () => { closePanel(); openImportDialog([], (inv) => startImportChat(inv)); } }));
  body.append(h('div', { class: 'ws-path', title: p.workspace }, iconEl('folder', 15), h('span', {}, shortPath(p.workspace))), tools);

  const search = h('input', { class: 'input', type: 'search', placeholder: 'Dateien durchsuchen', 'aria-label': 'Dateien durchsuchen', value: fileFilter });
  body.append(h('div', { class: 'search' }, iconEl('search', 16), search));
  const listBox = h('div');
  body.append(listBox);

  const draw = () => {
    listBox.innerHTML = '';
    const q = fileFilter.trim().toLowerCase();
    if (q) {
      const hits = files.filter((f) => f.path.toLowerCase().includes(q));
      if (!hits.length) { listBox.append(h('div', { class: 'empty-note' }, 'Keine passenden Dateien.')); return; }
      hits.slice(0, 200).forEach((f) => listBox.append(fileRow(f, { showDir: true })));
      return;
    }
    const recent = files.filter((f) => f.mtime > created + 60000 && !f.path.startsWith('00_vorgaben/') && f.path !== 'FACHARBEIT.md')
      .sort((a, b) => b.mtime - a.mtime).slice(0, 6);
    if (recent.length) {
      listBox.append(h('div', { class: 'section-label' }, 'Zuletzt geändert'));
      recent.forEach((f) => listBox.append(fileRow(f, { showDir: true })));
      listBox.append(h('div', { class: 'section-label' }, 'Ordner'));
    }
    const groups = new Map();
    for (const f of files) {
      const dir = f.path.includes('/') ? f.path.split('/')[0] : '';
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir).push(f);
    }
    const order = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
    for (const dir of order) {
      const items = groups.get(dir);
      if (dir === '') { items.forEach((f) => listBox.append(fileRow(f))); continue; }
      const det = h('details', { class: 'file-group', open: openGroups.has(dir) || null },
        h('summary', {}, iconEl('chevronRight', 14, 'chev'), iconEl('folder', 16, 'folder'), h('span', {}, groupLabel(dir)), h('span', { class: 'n' }, String(items.length))));
      det.addEventListener('toggle', () => { if (det.open) openGroups.add(dir); else openGroups.delete(dir); });
      items.forEach((f) => det.append(fileRow({ ...f, name: f.path.split('/').slice(1).join('/') }, { indent: true })));
      listBox.append(det);
    }
    if (!files.length) listBox.append(h('div', { class: 'empty-note' }, 'Der Arbeitsraum ist leer.'));
  };
  search.addEventListener('input', () => { fileFilter = search.value; draw(); });
  draw();
  body.scrollTop = scrollTop;
}

async function openWorkspace(app) {
  try { await api.post('/api/workspace/open', { app }); } catch (err) { toast(err.message, { error: true }); }
}

async function exportTranscripts() {
  try {
    const r = await api.post('/api/export/transcripts');
    toast(`Gespeichert in ${r.path.split('/')[0]}`, { action: { label: 'Öffnen', run: () => openFile(r.docx || r.path) }, timeout: 6000 });
    refreshPanel();
  } catch (err) { toast(err.message, { error: true }); }
}

async function exportFacharbeit() {
  try {
    const r = await api.post('/api/export/facharbeit');
    toast(`Word-Datei erstellt (${r.teile.length} Kapitel)`, { action: { label: 'Öffnen', run: () => openFile(r.path) }, timeout: 6000 });
    refreshPanel();
  } catch (err) { toast(err.message, { error: true }); }
}

// Auswahl von Arbeitsraum-Dateien als Chat-Anhang.
export async function pickWorkspaceFiles() {
  const files = await refreshFiles();
  return new Promise((resolve) => {
    const chosen = new Set();
    let result = null;
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Dateien durchsuchen', 'aria-label': 'Dateien durchsuchen' });
    const list = h('div', { class: 'folder-list', style: { maxHeight: '360px' } });
    const ok = btn('Anhängen', { cls: 'btn btn-primary' });
    ok.disabled = true;
    const draw = () => {
      list.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      const hits = files.filter((f) => !q || f.path.toLowerCase().includes(q)).sort((a, b) => b.mtime - a.mtime).slice(0, 300);
      if (!hits.length) list.append(h('div', { class: 'empty-note' }, 'Keine Dateien gefunden.'));
      for (const f of hits) {
        const cb = h('input', { type: 'checkbox', checked: chosen.has(f.path) || null, 'aria-label': f.path });
        const row = h('label', { class: 'file-row', style: { cursor: 'pointer', padding: '4px 10px' } }, cb,
          h('span', { html: fileIcon(f.kind, 17) }).firstChild,
          h('span', { class: 'f-text' }, h('span', { class: 'f-name' }, f.name), h('span', { class: 'f-meta' }, f.path)));
        cb.addEventListener('change', () => { if (cb.checked) chosen.add(f.path); else chosen.delete(f.path); ok.disabled = !chosen.size; ok.querySelector('.lbl').textContent = chosen.size > 1 ? `${chosen.size} Dateien anhängen` : 'Anhängen'; });
        list.append(row);
      }
    };
    search.addEventListener('input', draw);
    draw();
    const cancel = btn('Abbrechen', { cls: 'btn' });
    const d = dialog({ title: 'Datei aus dem Arbeitsraum', body: h('div', {}, h('div', { class: 'search' }, iconEl('search', 16), search), list), footer: [cancel, ok], onClose: () => resolve(result) });
    ok.addEventListener('click', () => { result = [...chosen]; d.close(); });
    cancel.addEventListener('click', () => d.close());
  });
}

// ---------- Projektangaben ----------

const FIELDS = [
  ['name', 'Name', 'text', ''],
  ['klasse', 'Klasse oder Kurs', 'text', ''],
  ['titel', 'Titel der Facharbeit', 'text', 'full'],
  ['fach', 'Fach', 'text', ''],
  ['bezugsfach', 'Bezugsfach', 'text', ''],
  ['fachrichtung', 'Fachrichtung', 'text', ''],
  ['lehrkraft', 'Betreuende Lehrkraft', 'text', ''],
  ['abgabedatum', 'Abgabedatum', 'datum', ''],
  ['forschungsfrage', 'Fragestellung oder These', 'textarea', 'full'],
  ['methode', 'Methode und Eigenanteil', 'textarea', 'full'],
];

function renderProject(body) {
  const p = project();
  body.innerHTML = '';
  const form = h('form', { class: 'form-grid', novalidate: true });
  const inputs = {};
  for (const [key, label, type, cls] of FIELDS) {
    const id = `pf-${key}`;
    const input = type === 'textarea'
      ? h('textarea', { class: 'textarea', id, rows: 2 }, p.angaben[key] || '')
      : type === 'datum'
        ? h('input', { class: 'input', id, type: 'text', value: formatDateDE(p.angaben[key]), placeholder: 'TT.MM.JJJJ', autocomplete: 'off' })
        : h('input', { class: 'input', id, type, value: p.angaben[key] || '', autocomplete: 'off' });
    inputs[key] = input;
    const field = h('div', { class: `field${cls ? ` ${cls}` : ''}` }, h('label', { for: id }, label), input);
    if (key === 'abgabedatum') {
      const fill = h('button', { type: 'button', class: 'link-btn' }, '07.12.2026 laut Zeitschiene');
      fill.addEventListener('click', () => { input.value = '07.12.2026'; dirty(); });
      field.append(fill);
    }
    form.append(field);
  }
  const save = btn('Speichern', { cls: 'btn btn-primary', attrs: { type: 'submit' } });
  save.disabled = true;
  const status = h('span', { class: 'field-note', 'aria-live': 'polite' });
  const dirty = () => { save.disabled = false; status.textContent = ''; };
  Object.values(inputs).forEach((i) => i.addEventListener('input', dirty));
  form.append(h('div', { class: 'full', style: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' } }, status, save));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const angaben = {};
    for (const [key] of FIELDS) angaben[key] = inputs[key].value;
    const datum = parseDateDE(angaben.abgabedatum);
    if (datum === null) { status.className = 'field-note err'; status.textContent = 'Abgabedatum bitte als TT.MM.JJJJ eingeben.'; inputs.abgabedatum.focus(); return; }
    angaben.abgabedatum = datum;
    status.className = 'field-note';
    try {
      save.disabled = true;
      const np = await api.put('/api/project', { angaben });
      setProject(np);
      status.textContent = 'Gespeichert';
    } catch (err) {
      save.disabled = false;
      toast(err.message, { error: true });
    }
  });
  body.append(form);

  if (p.uebernahme && p.uebernahme.zusammenfassung) {
    const u = p.uebernahme;
    const box = h('div', { class: 'memory takeover' },
      h('h3', {}, 'Zusammenfassung deiner Arbeit'),
      h('div', { class: 'field-note' }, (u.importe || []).length > 1
        ? `Zuletzt aktualisiert am ${fmtDate(u.am)} · ${u.anzahl} Dateien aus ${u.importe.length} Drop-ins`
        : `Erstellt am ${fmtDate(u.am)} aus ${u.anzahl} mitgebrachten Dateien`),
      h('div', { class: 'content', html: renderMarkdown(u.zusammenfassung, { isFile: (x) => S.fileIndex.has(x) }) }));
    body.append(box);
  }
  const mem = h('div', { class: 'memory' }, h('h3', {}, 'Gemerkte Ergebnisse'));
  if (!p.merken.length) mem.append(h('div', { class: 'field-note' }, 'Noch nichts gemerkt.'));
  else {
    const ul = h('ul');
    for (const m of [...p.merken].reverse()) {
      ul.append(h('li', {}, h('span', {}, m.text, h('small', {}, fmtDate(m.am))),
        btn('', { iconName: 'x', cls: 'btn btn-sm btn-icon', title: 'Eintrag entfernen', size: 15, onClick: async () => {
          try { setProject(await api.del(`/api/project/merken/${m.id}`)); refreshPanel(); } catch (err) { toast(err.message, { error: true }); }
        } })));
    }
    mem.append(ul);
  }
  body.append(mem);
  body.append(h('div', { class: 'memory' }, h('h3', {}, 'Arbeitsraum'), h('div', { class: 'ws-path', title: p.workspace }, iconEl('folder', 15), h('span', {}, shortPath(p.workspace)))));
}
