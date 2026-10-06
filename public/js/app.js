// Mango Facharbeit – Hauptmodul: Layout, Seitenleiste, Chat, Eingabefeld, Anbieter.
import { api, ApiError } from './api.js';
import {
  h, iconEl, btn, toast, menu, popover, closePopover, confirmDialog, copyText, fmtTime, fmtDate,
  announce, initials, parseLocal, daysUntil,
} from './ui.js';
import { fileIcon } from './icons.js';
import { renderMarkdown, stripUpdateBlock } from './markdown.js';
import { openPanel, closePanel, refreshPanel, pickWorkspaceFiles, currentPanel } from './panels.js';
import { showOnboarding, showGreeting, showWorkspaceMissing } from './onboarding.js';
import { openSettings } from './settings.js';
import { openImportDialog, entriesFromDrop } from './importer.js';
import { modelMenuSection, openModelDialog, providerModels, selectedModel, selectedModelLabel } from './modelle.js';
import { modelLabel } from './modelname.js';

export const S = {
  state: null,
  chatId: null,
  chat: null,
  fileIndex: new Set(),
  pending: [],
  streams: new Map(), // chatId -> Anzahl offener Streams
  viewStream: {}, // chatId -> Stream, dessen Ereignisse die Ansicht aktualisieren
  els: {},
};

let streamSeq = 0;
export function isStreaming(chatId = S.chatId) {
  return (S.streams.get(chatId) || 0) > 0;
}

const STATUS_SYMBOL = { offen: '×', in_arbeit: '?', erledigt: '✓' };
const STATUS_LABEL = { offen: 'Offen', in_arbeit: 'In Arbeit', erledigt: 'Erledigt' };
const PROVIDER_NAME = { claude: 'Claude Code', antigravity: 'Antigravity' };

// ---------- Farbschema ----------

const media = window.matchMedia('(prefers-color-scheme: dark)');
export function applyTheme(pref) {
  try { localStorage.setItem('mango.theme', pref); } catch { /* kein Speicher */ }
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}
media.addEventListener('change', () => { if (S.state) applyTheme(S.state.settings.theme); });

// ---------- Zustand ----------

export async function loadState() {
  S.state = await api.get('/api/state');
  applyTheme(S.state.settings.theme);
  return S.state;
}

export function project() {
  return S.state && S.state.project;
}

export function setProject(p) {
  S.state.project = p;
  renderSidebarFoot();
  renderTopbar();
  if (S.chat && !S.chat.messages.length) renderThread();
}

export async function refreshFiles() {
  try {
    const files = await api.get('/api/files');
    S.fileIndex = new Set(files.map((f) => f.path));
    return files;
  } catch {
    return [];
  }
}

export function statusPill(status, { asButton = false, onClick } = {}) {
  const el = h(asButton ? 'button' : 'span', {
    class: 'status-pill', 'data-status': status, type: asButton ? 'button' : null,
    'aria-label': asButton ? `Status: ${STATUS_LABEL[status]}. Ändern` : null, 'aria-haspopup': asButton ? 'menu' : null,
  }, h('span', { class: 'sym', 'aria-hidden': 'true' }, STATUS_SYMBOL[status]), h('span', {}, STATUS_LABEL[status]));
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

export function statusMenu(anchor, current, onPick) {
  menu(anchor, ['offen', 'in_arbeit', 'erledigt'].map((s) => ({
    label: `${STATUS_SYMBOL[s]}  ${STATUS_LABEL[s]}${s === current ? '  (aktuell)' : ''}`,
    onClick: () => onPick(s),
  })));
}

export async function setTaskStatus(id, status) {
  try {
    const p = await api.patch(`/api/aufgaben/${id}`, { status });
    setProject(p);
    refreshPanel();
  } catch (err) {
    toast(err.message, { error: true });
  }
}

// ---------- Dateien öffnen ----------

export async function openFile(path, { reveal = false } = {}) {
  try {
    await api.post('/api/files/open', { path, reveal });
  } catch (err) {
    if (err.status === 501 && !reveal) { window.open(api.rawUrl(path), '_blank', 'noopener'); return; }
    toast(err.status === 404 ? 'Datei nicht gefunden – sie wurde eventuell verschoben oder gelöscht.' : err.message, { error: true });
    if (err.status === 404) document.querySelectorAll(`[data-file="${CSS.escape(path)}"]`).forEach((c) => c.classList.add('missing'));
  }
}

export function fileChip(f, { badge, actions = true, onRemove } = {}) {
  const missing = f.aktion === 'geloescht';
  const unreadable = f.lesbar === 'nein';
  const chip = h('div', { class: `chip file-chip${missing ? ' missing' : ''}${unreadable ? ' unreadable' : ''}`, 'data-file': f.path, title: f.hinweis || f.path });
  const main = h(missing ? 'span' : 'button', { class: 'chip-main', type: missing ? null : 'button', 'aria-label': missing ? null : `${f.name || f.path.split('/').pop()} öffnen` },
    h('span', { html: fileIcon(f.kind, 16) }).firstChild,
    h('span', { class: 'name' }, f.name || f.path.split('/').pop()),
    (unreadable || f.kindLabel) ? h('span', { class: 'kind' }, unreadable ? 'nicht lesbar' : f.kindLabel) : null);
  if (!missing) main.addEventListener('click', () => openFile(f.path));
  chip.append(main);
  if (badge) chip.append(h('span', { class: `badge ${f.aktion || ''}` }, badge));
  if (actions && !missing) chip.append(btn('', { iconName: 'folder', cls: 'chip-act', title: 'Im Arbeitsraum zeigen', size: 15, onClick: () => openFile(f.path, { reveal: true }) }));
  if (f.version) chip.append(btn('', { iconName: 'history', cls: 'chip-act', title: 'Vorherige Fassung öffnen', size: 15, onClick: () => openFile(f.version) }));
  if (onRemove) chip.append(btn('', { iconName: 'x', cls: 'chip-act', title: `${f.name} entfernen`, size: 15, onClick: onRemove }));
  return chip;
}

// ---------- Layout ----------

export function mountApp() {
  const root = document.getElementById('root');
  root.innerHTML = '';
  const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Chats' });
  const topbar = h('header', { class: 'topbar' });
  const thread = h('div', { class: 'thread', role: 'log', 'aria-live': 'off' });
  const scroller = h('div', { class: 'scroller' }, thread);
  const jump = btn('', { iconName: 'chevronDown', cls: 'jump-down', title: 'Zum Ende springen', onClick: () => scrollToEnd(true) });
  jump.hidden = true;
  const composerWrap = h('div', { class: 'composer-wrap' }, jump);
  const main = h('main', { class: 'main' }, topbar, scroller, composerWrap);
  const app = h('div', { class: 'app' }, sidebar, main);
  root.append(app);
  S.els = { app, sidebar, topbar, thread, scroller, jump, composerWrap, main };
  let collapsed = false;
  try { collapsed = localStorage.getItem('mango.sidebar') === 'zu'; } catch { /* egal */ }
  if (collapsed) app.classList.add('sb-collapsed');
  scroller.addEventListener('scroll', () => { jump.hidden = isNearEnd(); });
  buildSidebar();
  renderTopbar();
  buildComposer();
  setupDragDrop();
  setupGlobalKeys();
  thread.addEventListener('click', onThreadClick);
  if (!listenersBound) {
    listenersBound = true;
    window.addEventListener('mango:attach', (e) => addWorkspaceFiles(e.detail));
  }
}

let listenersBound = false;

function toggleSidebar(force) {
  const app = S.els.app;
  if (window.matchMedia('(max-width: 860px)').matches) {
    const open = force ?? !app.classList.contains('sb-open');
    app.classList.toggle('sb-open', open);
    const old = document.querySelector('.sb-scrim');
    if (old) old.remove();
    if (open) {
      const scrim = h('div', { class: 'sb-scrim', onclick: () => toggleSidebar(false) });
      document.body.append(scrim);
      setTimeout(() => S.els.sidebar.querySelector('.new-chat').focus());
    }
    return;
  }
  const collapsed = force === undefined ? !app.classList.contains('sb-collapsed') : !force;
  app.classList.toggle('sb-collapsed', collapsed);
  try { localStorage.setItem('mango.sidebar', collapsed ? 'zu' : 'auf'); } catch { /* egal */ }
  renderTopbar();
}

// ---------- Seitenleiste ----------

function buildSidebar() {
  const sb = S.els.sidebar;
  sb.innerHTML = '';
  const logo = h('span', { html: `<svg class="icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="7" fill="currentColor"/><path d="M7.6 18c-2-2.3-2-6.8.7-9.6 2.8-2.8 7.3-3.4 9.6-1.5-.4 3.1-1.6 6.8-4.2 9.1-2.1 2-4.5 2.9-6.1 2Z" fill="var(--bg-sidebar)"/></svg>` }).firstChild;
  sb.append(
    h('div', { class: 'sb-head' },
      h('div', { class: 'brand' }, logo, h('span', {}, 'Mango'), h('small', {}, 'Facharbeit')),
      btn('', { iconName: 'panel', cls: 'btn btn-icon sb-toggle-desktop', title: 'Seitenleiste einklappen', onClick: () => toggleSidebar(false) }),
      btn('', { iconName: 'x', cls: 'btn btn-icon sb-toggle-mobile', title: 'Seitenleiste schließen', onClick: () => toggleSidebar(false) })),
    btn('Neuer Chat', { iconName: 'plus', cls: 'btn new-chat', onClick: newChat }),
    h('div', { class: 'sb-label', id: 'chats-label' }, 'Chats'),
    h('nav', { class: 'chat-list', 'aria-labelledby': 'chats-label' }),
    h('div', { class: 'sb-foot' }));
  renderChatList();
  renderSidebarFoot();
}

export function renderChatList() {
  const list = S.els.sidebar.querySelector('.chat-list');
  list.innerHTML = '';
  const chats = S.state.chats || [];
  if (!chats.length) list.append(h('div', { class: 'empty-note' }, 'Noch keine Chats'));
  for (const c of chats) {
    const running = S.state.running.includes(c.id) || isStreaming(c.id);
    const item = h('div', { class: `chat-item${c.id === S.chatId ? ' active' : ''}`, 'data-id': c.id });
    const link = h('button', { type: 'button', class: 'chat-link', 'aria-current': c.id === S.chatId ? 'page' : null, title: c.title }, c.title || 'Neuer Chat');
    link.addEventListener('click', () => { openChat(c.id); toggleSidebarMobileClose(); });
    item.append(link);
    if (running) item.append(h('span', { class: 'running-dot', title: 'Antwort läuft' }));
    const more = btn('', { iconName: 'more', cls: 'btn btn-sm btn-icon chat-more', title: `Optionen für „${c.title}“`, attrs: { 'aria-haspopup': 'menu' } });
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      menu(more, [
        { label: 'Umbenennen', icon: 'pencil', onClick: () => startRename(item, c) },
        { label: 'Als Markdown exportieren', icon: 'download', onClick: () => { window.location.href = `/api/chats/${c.id}/export?t=${encodeURIComponent(document.querySelector('meta[name="mango-token"]').content)}`; } },
        'sep',
        { label: 'Löschen', icon: 'trash', danger: true, onClick: () => deleteChat(c) },
      ], { placement: 'bottom-end' });
    });
    item.append(more);
    list.append(item);
  }
}

function toggleSidebarMobileClose() {
  if (window.matchMedia('(max-width: 860px)').matches) toggleSidebar(false);
}

function startRename(item, c) {
  const input = h('input', { class: 'input chat-rename', value: c.title, 'aria-label': 'Neuer Titel', maxlength: 80 });
  item.replaceChildren(input);
  input.focus();
  input.select();
  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    const title = input.value.trim();
    if (save && title && title !== c.title) {
      try {
        await api.patch(`/api/chats/${c.id}`, { title });
        c.title = title;
        if (S.chat && S.chat.id === c.id) { S.chat.title = title; renderTopbar(); }
      } catch (err) { toast(err.message, { error: true }); }
    }
    renderChatList();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

async function deleteChat(c) {
  const ok = await confirmDialog({ title: 'Chat löschen?', text: `„${c.title}“ wird dauerhaft gelöscht. Dateien im Arbeitsraum bleiben erhalten.`, confirmLabel: 'Löschen', danger: true });
  if (!ok) return;
  try {
    await api.del(`/api/chats/${c.id}`);
    S.state.chats = S.state.chats.filter((x) => x.id !== c.id);
    if (S.chatId === c.id) {
      const next = S.state.chats[0];
      if (next) await openChat(next.id); else await newChat();
    }
    renderChatList();
    toast('Chat gelöscht');
  } catch (err) {
    toast(err.message, { error: true });
  }
}

export function renderSidebarFoot() {
  const foot = S.els.sidebar && S.els.sidebar.querySelector('.sb-foot');
  if (!foot) return;
  const p = project();
  const a = p ? p.angaben : {};
  foot.innerHTML = '';
  const pbtn = h('button', { type: 'button', class: 'project-btn', title: 'Projektangaben' },
    h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(a.name)),
    h('span', { class: 'meta' }, h('b', {}, a.name || 'Meine Facharbeit'), h('span', {}, a.titel || 'Titel noch offen')));
  pbtn.addEventListener('click', () => { toggleSidebarMobileClose(); openPanel('projekt'); });
  foot.append(pbtn, btn('', { iconName: 'sliders', cls: 'btn btn-icon', title: 'Einstellungen', onClick: () => openSettings() }));
}

// ---------- Kopfzeile ----------

export function renderTopbar() {
  const tb = S.els.topbar;
  if (!tb) return;
  const p = project();
  const collapsed = S.els.app.classList.contains('sb-collapsed');
  tb.innerHTML = '';
  tb.append(btn('', { iconName: 'menu', cls: 'btn btn-icon sb-toggle-mobile', title: 'Chats anzeigen', onClick: () => toggleSidebar(true) }));
  if (collapsed) tb.append(btn('', { iconName: 'panel', cls: 'btn btn-icon sb-toggle-desktop', title: 'Seitenleiste ausklappen', onClick: () => toggleSidebar(true) }));
  tb.append(h('div', { class: 'title' }, S.chat ? S.chat.title : ''));
  const done = p ? p.aufgaben.filter((t) => t.status === 'erledigt').length : 0;
  const total = p ? p.aufgaben.length : 0;
  const panel = currentPanel();
  const mk = (id, label, iconName, extra) => {
    const b = btn(label, { iconName, cls: 'btn', title: null, attrs: { 'aria-expanded': panel === id ? 'true' : 'false', 'aria-label': label + (extra ? `, ${extra.aria}` : '') } });
    if (extra) b.append(h('span', { class: 'count', 'aria-hidden': 'true' }, extra.text));
    b.addEventListener('click', () => (currentPanel() === id ? closePanel() : openPanel(id)));
    return b;
  };
  tb.append(h('div', { class: 'actions' },
    mk('stand', 'Arbeitsstand', 'checks', { text: `${done}/${total}`, aria: `${done} von ${total} erledigt` }),
    mk('dateien', 'Arbeitsraum', 'folder'),
    mk('projekt', 'Projekt', 'book')));
}

// ---------- Chats ----------

function lastChatKey() {
  return `mango.lastChat.${project() ? project().id : ''}`;
}

export async function openInitialChat() {
  let id = null;
  try { id = localStorage.getItem(lastChatKey()); } catch { /* egal */ }
  const chats = S.state.chats;
  if (!id || !chats.some((c) => c.id === id)) id = chats[0] ? chats[0].id : null;
  if (id) await openChat(id); else await newChat();
}

export async function openChat(id) {
  try {
    const chat = await api.get(`/api/chats/${id}`);
    S.chatId = id;
    S.chat = chat;
    try { localStorage.setItem(lastChatKey(), id); } catch { /* egal */ }
    renderChatList();
    renderTopbar();
    renderThread();
    scrollToEnd(false);
    updateComposer();
    if (chat.running) attachStream(id);
    if (!isStreaming(id)) S.els.composerWrap.querySelector('textarea').focus({ preventScroll: true });
  } catch (err) {
    toast(err.message, { error: true });
  }
}

export async function newChat() {
  try {
    const c = await api.post('/api/chats');
    if (!S.state.chats.some((x) => x.id === c.id)) S.state.chats.unshift(c);
    await openChat(c.id);
    toggleSidebarMobileClose();
  } catch (err) {
    toast(err.message, { error: true });
  }
}

function upsertChatMeta(meta) {
  const list = S.state.chats;
  const i = list.findIndex((c) => c.id === meta.id);
  const merged = { ...(i >= 0 ? list[i] : {}), ...meta };
  if (i >= 0) list.splice(i, 1);
  list.unshift(merged);
  renderChatList();
}

// ---------- Nachrichten ----------

function isNearEnd() {
  const s = S.els.scroller;
  return s.scrollHeight - s.scrollTop - s.clientHeight < 140;
}

export function scrollToEnd(smooth) {
  const s = S.els.scroller;
  s.scrollTo({ top: s.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  S.els.jump.hidden = true;
}

function suggestionsFor(p) {
  const prompts = {
    mindmap: ['Mindmap erstellen', 'Hilf mir, meine Mindmap zu erstellen und daraus drei mögliche Themenbereiche abzuleiten.'],
    thema: ['Thema eingrenzen', 'Hilf mir, mein Thema einzugrenzen. Es muss Bezug zu zwei Fächern haben.'],
    fragestellung: ['Fragestellung schärfen', 'Hilf mir, eine klare Fragestellung oder These für meine Facharbeit zu formulieren.'],
    zeitplan: ['Zeitplan aufstellen', 'Erstelle mit mir einen Arbeits- und Zeitplan bis zur Abgabe.'],
    recherche: ['Quellen finden', 'Hilf mir, passende Fachliteratur und Quellen für mein Thema zu finden.'],
    gliederung: ['Gliederung entwerfen', 'Lass uns eine vorläufige Gliederung für meine Facharbeit entwerfen.'],
    lerntagebuch: ['Lerntagebuch-Eintrag', 'Hilf mir beim Eintrag ins Lerntagebuch für meinen letzten Arbeitsschritt.'],
    expose: ['Exposé vorbereiten', 'Lass uns mein Exposé vorbereiten. Was brauchen wir dafür?'],
    eigenanteil: ['Eigenanteil planen', 'Hilf mir, meinen Eigenanteil zu planen: Welche Methode passt zu meiner Fragestellung?'],
    einleitung: ['Einleitung planen', 'Lass uns die Einleitung meiner Facharbeit planen.'],
    hauptteil: ['Hauptteil gliedern', 'Hilf mir, den Hauptteil zu strukturieren.'],
    fazit: ['Fazit vorbereiten', 'Hilf mir, das Fazit vorzubereiten.'],
    literaturverzeichnis: ['Literaturverzeichnis prüfen', 'Prüfe mein Literaturverzeichnis nach den Vorgaben der Schule.'],
    praesentation: ['Präsentation planen', 'Hilf mir, die 15-minütige Präsentation für die Verteidigung zu planen.'],
    fachgespraech: ['Fachgespräch üben', 'Stell mir typische Fragen aus dem Fachgespräch, eine nach der anderen.'],
  };
  const out = [];
  if (p) {
    const open = p.aufgaben.filter((t) => t.status !== 'erledigt' && !t.extern && prompts[t.id]);
    const wip = open.filter((t) => t.status === 'in_arbeit');
    for (const t of [...wip, ...open]) {
      if (out.length >= 3) break;
      if (!out.some((o) => o.id === t.id)) out.push({ id: t.id, label: prompts[t.id][0], prompt: prompts[t.id][1], icon: 'sparkle' });
    }
  }
  out.push({ id: 'check', label: 'Stand prüfen', prompt: 'Was ist mein aktueller Stand, und was sollte ich als Nächstes tun?', icon: 'checks' });
  return out.slice(0, 4);
}

function renderEmpty() {
  const p = project();
  const a = p ? p.angaben : {};
  const first = a.name ? a.name.split(/\s+/)[0] : '';
  const heads = first ? [`Woran arbeiten wir heute, ${first}?`] : ['Woran arbeiten wir heute?'];
  const wrap = h('div', { class: 'empty' }, h('h1', {}, heads[0]));
  const next = p && p.fristen && p.fristen[0];
  if (next) wrap.append(h('p', { class: 'sub' }, 'Nächste Frist: ', h('b', {}, next.titel), ` – ${next.text}`));
  else wrap.append(h('p', { class: 'sub' }, ''));
  const grid = h('div', { class: 'suggestions' });
  for (const s of suggestionsFor(p)) {
    const b = h('button', { type: 'button', class: 'suggestion' }, iconEl(s.icon, 17), h('span', {}, s.label));
    b.addEventListener('click', () => { const ta = S.els.composerWrap.querySelector('textarea'); ta.value = s.prompt; autosize(ta); updateComposer(); ta.focus(); });
    grid.append(b);
  }
  wrap.append(grid);
  return wrap;
}

export function renderThread() {
  const t = S.els.thread;
  const container = S.els.scroller;
  t.innerHTML = '';
  if (!S.chat || !S.chat.messages.length) {
    t.hidden = true;
    const old = container.querySelector('.empty');
    if (old) old.remove();
    container.append(renderEmpty());
    return;
  }
  const old = container.querySelector('.empty');
  if (old) old.remove();
  t.hidden = false;
  const msgs = S.chat.messages;
  msgs.forEach((m, i) => t.append(renderMessage(m, i === msgs.length - 1)));
}

function attachmentChips(atts) {
  return h('div', { class: 'msg-atts' }, atts.map((a) => fileChip({ ...a, kindLabel: kindName(a.kind) }, { actions: false })));
}

function kindName(kind) {
  return { markdown: 'Markdown', text: 'Text', word: 'Word', pdf: 'PDF', image: 'Bild', tabelle: 'Tabelle', praesentation: 'Präsentation', odt: 'Dokument', archiv: 'Archiv' }[kind] || 'Datei';
}

function renderUserMessage(m) {
  const el = h('div', { class: 'msg user', 'data-id': m.id });
  if (m.import) {
    const i = m.import;
    const parts = [`${i.anzahl} ${i.anzahl === 1 ? 'Datei' : 'Dateien'} übernommen`];
    if (i.ordnerAnzahl) parts.push(`${i.ordnerAnzahl} Ordner`);
    if (i.unlesbar) parts.push(`${i.unlesbar} nicht lesbar`);
    if (i.nichtUebernommen) parts.push(`${i.nichtUebernommen} nicht übernommen`);
    const chip = h('div', { class: 'chip file-chip import-chip' + (i.unlesbar || i.nichtUebernommen ? ' unreadable' : '') },
      h('button', { type: 'button', class: 'chip-main', title: `${i.ordner} öffnen` }, iconEl('folder', 16), h('span', { class: 'name' }, parts.join(' · '))));
    chip.querySelector('button').addEventListener('click', () => openPanel('dateien'));
    el.append(h('div', { class: 'msg-atts' }, chip));
  }
  if (m.attachments && m.attachments.length) el.append(attachmentChips(m.attachments));
  if (m.text) el.append(h('div', { class: 'bubble' }, m.text));
  el.append(h('div', { class: 'msg-meta' },
    h('span', {}, fmtTime(m.createdAt)),
    m.text ? btn('', { iconName: 'copy', cls: 'btn btn-sm btn-icon', title: 'Nachricht kopieren', size: 15, onClick: () => copyText(m.text) }) : null));
  return el;
}

function liveStepEl(m) {
  const last = m.activity && m.activity[m.activity.length - 1];
  return h('div', { class: 'live-step' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, last ? `${last.label} …` : 'Denkt nach …'));
}

function stepsEl(m) {
  const n = m.activity.length;
  const d = h('details', { class: 'steps' },
    h('summary', {}, iconEl('chevronRight', 14), `${n} ${n === 1 ? 'Arbeitsschritt' : 'Arbeitsschritte'}`),
    h('ol', {}, m.activity.map((a) => h('li', {}, iconEl({ lesen: 'eye', schreiben: 'pencil', suchen: 'search', web: 'globe', planen: 'checks', skill: 'sparkle', befehl: 'terminal' }[a.kind] || 'info', 14), h('span', {}, a.label)))));
  return d;
}

function updatesEl(u) {
  const box = h('div', { class: 'updates' });
  for (const a of u.aufgaben || []) {
    box.append(h('div', { class: 'update' }, h('span', { class: 'label' }, 'Arbeitsstand'), statusPill(a.nach), h('span', { class: 'grow' }, a.titel), a.hinweis ? h('span', { class: 'label' }, `(${a.hinweis})`) : null));
  }
  for (const v of u.vorschlaege || []) {
    const current = project() && project().aufgaben.find((t) => t.id === v.id);
    const already = current && current.status === v.status;
    const b = btn(already ? 'Übernommen' : `Als ${STATUS_LABEL[v.status].toLowerCase()} markieren`, { cls: 'btn btn-sm btn-soft', iconName: already ? 'check' : null, size: 15 });
    if (already) b.disabled = true;
    b.addEventListener('click', async () => { await setTaskStatus(v.id, v.status); b.disabled = true; b.replaceChildren(iconEl('check', 15), h('span', {}, 'Übernommen')); });
    box.append(h('div', { class: 'update' }, h('span', { class: 'label' }, 'Vorschlag'), h('span', {}, `${v.titel}:`), b));
  }
  if ((u.projekt || []).length) {
    box.append(h('div', { class: 'update' }, h('span', { class: 'label' }, 'Projektangaben ergänzt'), h('span', { class: 'grow' }, u.projekt.map((p) => p.label).join(', '))));
  }
  for (const k of u.konflikte || []) {
    const current = project() && project().angaben[k.feld];
    const done = current === k.gefunden;
    const b = btn(done ? 'Übernommen' : 'Übernehmen', { cls: 'btn btn-sm btn-soft', iconName: done ? 'check' : null, size: 15 });
    if (done) b.disabled = true;
    b.addEventListener('click', async () => {
      try {
        setProject(await api.put('/api/project', { angaben: { [k.feld]: k.gefunden } }));
        b.disabled = true;
        b.replaceChildren(iconEl('check', 15), h('span', {}, 'Übernommen'));
        refreshPanel();
      } catch (err) { toast(err.message, { error: true }); }
    });
    box.append(h('div', { class: 'update conflict' },
      h('span', { class: 'label' }, `${k.label}:`),
      h('span', { class: 'grow' }, `In deinen Angaben „${k.bisher}“, in den Dateien „${k.gefunden}“.`), b));
  }
  for (const m of u.merken || []) box.append(h('div', { class: 'update' }, h('span', { class: 'label' }, 'Gemerkt'), h('span', { class: 'grow' }, m)));
  return box;
}

function listSection(title, items, cls = '') {
  if (!items || !items.length) return null;
  return h('section', { class: `ic-sec ${cls}` }, h('h4', {}, title), h('ul', {}, items.map((x) => h('li', { html: renderMarkdown(x, { isFile: (p) => S.fileIndex.has(p) }).replace(/^<p>|<\/p>$/g, '') }))));
}

function shortName(p) {
  return p.split('/').pop();
}

function sameFiles(a, b) {
  return a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
}

// Frage nach der aktuellen Fassung: Auswahl wird gespeichert und dem Assistenten mitgeteilt.
function versionChoiceEl(v, isLast) {
  const row = h('div', { class: 'ic-version' }, h('div', {}, v.frage || 'Mehrere Fassungen gefunden:'));
  const u = project() && project().uebernahme;
  const decided = u && (u.entscheidungen || []).find((e) => sameFiles(e.dateien, v.dateien));
  if (decided) {
    row.append(h('div', { class: 'ic-decided' }, iconEl('check', 15), h('span', {}, 'Aktuell: '), h('b', { title: decided.gewaehlt }, shortName(decided.gewaehlt))));
    return row;
  }
  const btns = h('div', { class: 'ic-choices' });
  for (const f of v.dateien) {
    btns.append(btn(shortName(f), { cls: 'btn btn-sm btn-soft', title: f, onClick: async () => {
      if (isStreaming()) { toast('Bitte warte, bis die aktuelle Antwort fertig ist.'); return; }
      try {
        setProject(await api.post('/api/uebernahme/fassung', { dateien: v.dateien, gewaehlt: f }));
      } catch (err) { toast(err.message, { error: true }); return; }
      row.replaceWith(versionChoiceEl(v, isLast));
      refreshPanel();
      if (isLast) sendText(`Die aktuelle Fassung ist ${shortName(f)}.`);
    } }));
  }
  row.append(btns);
  return row;
}

function importResultEl(r, isLast) {
  const head = [`${r.anzahl} ${r.anzahl === 1 ? 'Datei' : 'Dateien'} übernommen`];
  if (r.unlesbar && r.unlesbar.length) head.push(`${r.unlesbar.length} nicht lesbar`);
  if (r.nichtUebernommen && r.nichtUebernommen.length) head.push(`${r.nichtUebernommen.length} nicht übernommen`);
  if (r.duplikate && r.duplikate.length) head.push(`${r.duplikate.length} doppelt`);
  const card = h('div', { class: 'import-card' },
    h('div', { class: 'ic-head' }, iconEl('folderOpen', 17), h('span', {}, head.join(' · '))));
  if (!r.analysiert) {
    card.append(h('p', { class: 'ic-note' }, 'Die Dateien liegen sicher im Arbeitsraum. Die Analyse durch den Assistenten wurde nicht abgeschlossen.'));
    if (isLast) card.append(btn('Analyse erneut starten', { iconName: 'refresh', cls: 'btn btn-sm btn-soft', size: 15, onClick: () => startImportChat({ id: r.importId }, { sameChat: true }) }));
  }
  const grid = h('div', { class: 'ic-grid' });
  const vorhanden = listSection('Das ist bereits vorhanden', r.vorhanden, 'ok');
  const fehlt = listSection('Das fehlt noch', r.fehlt, 'todo');
  if (vorhanden) grid.append(vorhanden);
  if (fehlt) grid.append(fehlt);
  if (grid.childNodes.length) card.append(grid);
  if (r.naechsterSchritt) {
    const go = btn('Damit anfangen', { cls: 'btn btn-sm btn-primary', onClick: () => {
      const ta = S.els.composerWrap.querySelector('textarea');
      ta.value = `Lass uns mit dem nächsten Schritt anfangen: ${r.naechsterSchritt}`;
      autosize(ta);
      updateComposer();
      ta.focus();
    } });
    card.append(h('div', { class: 'ic-next' }, h('div', {}, h('b', {}, 'Nächster Schritt: '), r.naechsterSchritt), go));
  }
  const unsicher = listSection('Unsicher – bitte prüfen', r.unsicher, 'warn');
  if (unsicher) card.append(unsicher);
  if (r.versionen && r.versionen.length) {
    const sec = h('section', { class: 'ic-sec warn' }, h('h4', {}, 'Welche Fassung ist aktuell?'));
    for (const v of r.versionen) sec.append(versionChoiceEl(v, isLast));
    card.append(sec);
  }
  if (r.unlesbar && r.unlesbar.length) {
    card.append(h('details', { class: 'ic-details' }, h('summary', {}, iconEl('chevronRight', 14), `Nicht lesbar (${r.unlesbar.length})`),
      h('div', { class: 'chips' }, r.unlesbar.map((u) => fileChip({ path: u.pfad, name: shortName(u.pfad), lesbar: 'nein', hinweis: u.hinweis }, { actions: true })))));
  }
  if (r.nichtUebernommen && r.nichtUebernommen.length) {
    card.append(h('details', { class: 'ic-details', open: true }, h('summary', {}, iconEl('chevronRight', 14), `Nicht übernommen (${r.nichtUebernommen.length})`),
      h('ul', {}, r.nichtUebernommen.map((f) => h('li', {}, h('b', {}, f.pfad), ` – ${f.grund}`)))));
  }
  if (r.duplikate && r.duplikate.length) {
    card.append(h('details', { class: 'ic-details' }, h('summary', {}, iconEl('chevronRight', 14), `Doppelte Dateien (${r.duplikate.length} ${r.duplikate.length === 1 ? 'Gruppe' : 'Gruppen'})`),
      h('ul', {}, r.duplikate.map((g) => h('li', {}, g.map(shortName).join(' = '))))));
  }
  if (r.analysiert) {
    const link = h('button', { type: 'button', class: 'link-btn' }, 'Im Projekt ansehen');
    link.addEventListener('click', () => openPanel('projekt'));
    card.append(h('div', { class: 'ic-foot' }, iconEl('check', 14), h('span', {}, 'Zusammenfassung gespeichert – spätere Chats bauen darauf auf. '), link));
  }
  return card;
}

function hintBox(hint, { withCheck = false } = {}) {
  if (!hint) return null;
  const box = h('div', { class: 'hint-box' }, h('div', {}, hint.text));
  if (hint.befehl) {
    box.append(h('div', { class: 'cmd-row' }, h('code', { class: 'cmd' }, hint.befehl),
      btn('Kopieren', { iconName: 'copy', cls: 'btn btn-sm', size: 15, onClick: () => copyText(hint.befehl) })));
  }
  if (withCheck) box.append(h('div', {}, btn('Erneut prüfen', { iconName: 'refresh', cls: 'btn btn-sm btn-soft', size: 15, onClick: () => checkProvider(S.state.settings.provider) })));
  return box;
}

function renderAssistantMessage(m, isLast) {
  const el = h('div', { class: `msg assistant${isLast ? ' last' : ''}`, 'data-id': m.id });
  const running = m.status === 'laeuft';
  if (m.activity && m.activity.length && !running) el.append(stepsEl(m));
  const text = running ? stripUpdateBlock(m.text || '') : m.text || '';
  const content = h('div', { class: 'content' });
  if (text) content.innerHTML = renderMarkdown(text, { isFile: (p) => S.fileIndex.has(p) || /^[\w.-]+\/.+\.\w{1,5}$/.test(p) });
  el.append(content);
  if (running && m.mode === 'import') {
    el.append(h('div', { class: 'import-progress indeterminate', role: 'status' },
      h('div', { class: 'ip-label' }, 'Deine bisherige Arbeit wird analysiert'), h('div', { class: 'ip-bar' }, h('i'))));
    el.append(liveStepEl(m));
  } else if (running && (!text || m.phase === 'werkzeug')) el.append(liveStepEl(m));
  if (m.importErgebnis) el.append(importResultEl(m.importErgebnis, isLast && m.status !== 'fehler'));
  if (m.files && m.files.length) {
    const label = { neu: 'neu', geaendert: 'geändert', geloescht: 'gelöscht', zurueckgesetzt: 'zurückgesetzt' };
    el.append(h('div', { class: 'chips' }, m.files.map((f) => fileChip({ ...f, kindLabel: kindName(f.kind) }, { badge: label[f.aktion] }))));
  }
  if (m.updates) el.append(updatesEl(m.updates));
  if (m.status === 'fehler') {
    const err = h('div', { class: 'msg-error', role: 'alert' },
      h('div', { class: 'head' }, iconEl('alert', 16), text ? 'Die Antwort ist unvollständig' : 'Keine Antwort erhalten'),
      h('div', { class: 'detail' }, m.error || 'Unbekannter Fehler'));
    const hb = hintBox(m.hinweis);
    if (hb) err.append(hb);
    if (m.hinweis && m.hinweis.aktion === 'modell') {
      err.append(h('div', { style: { marginTop: '10px' } }, btn('Modell wählen', { iconName: 'sliders', cls: 'btn btn-sm btn-soft', size: 15, onClick: () => openModelDialog(m.provider) })));
    }
    if (isLast) err.append(h('div', { style: { marginTop: '10px' } }, btn('Erneut senden', { iconName: 'refresh', cls: 'btn btn-sm btn-soft', size: 15, onClick: retryLast })));
    el.append(err);
  }
  if (m.status === 'abgebrochen') el.append(h('div', { class: 'msg-note' }, 'Antwort abgebrochen.'));
  if (m.status === 'unterbrochen') el.append(h('div', { class: 'msg-note' }, 'Die Antwort wurde unterbrochen, weil die App beendet wurde.'));
  if (!running) {
    el.append(h('div', { class: 'msg-meta' },
      h('span', { title: m.model || m.modelWahl || '' }, `${PROVIDER_NAME[m.provider] || 'KI'}${modelText(m)}`), h('span', { class: 'sep' }, '·'), h('span', {}, fmtTime(m.createdAt)),
      text ? btn('', { iconName: 'copy', cls: 'btn btn-sm btn-icon', title: 'Antwort kopieren', size: 15, onClick: () => copyText(text) }) : null));
  }
  return el;
}

function modelText(m) {
  const id = m.model && m.model !== '<synthetic>' ? m.model : m.modelWahl;
  return id ? ` · ${modelLabel(id, providerModels(m.provider))}` : '';
}

function renderMessage(m, isLast) {
  return m.role === 'user' ? renderUserMessage(m) : renderAssistantMessage(m, isLast);
}

function replaceMessageEl(m) {
  const t = S.els.thread;
  const old = t.querySelector(`[data-id="${CSS.escape(m.id)}"]`);
  const isLast = S.chat.messages[S.chat.messages.length - 1] === m;
  const el = renderMessage(m, isLast);
  if (old) old.replaceWith(el); else t.append(el);
}

let rafPending = false;
function scheduleStreamRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (!S.chat) return;
    const m = S.chat.messages[S.chat.messages.length - 1];
    if (!m || m.role !== 'assistant') return;
    const stick = isNearEnd();
    replaceMessageEl(m);
    if (stick) scrollToEnd(false);
    else S.els.jump.hidden = false;
  });
}

function onThreadClick(e) {
  const ref = e.target.closest('.file-ref');
  if (ref) { openFile(ref.dataset.path); return; }
  const copy = e.target.closest('.code-copy');
  if (copy) { copyText(copy.closest('.code-block').querySelector('code').textContent); }
}

// ---------- Senden und Streamen ----------

function handleEvent(chatId, ev, sid) {
  // Nur der aktuelle Stream eines sichtbaren Chats aktualisiert die Ansicht.
  if (chatId !== S.chatId || !S.chat || S.chat.id !== chatId || S.viewStream[chatId] !== sid) {
    if (ev.type === 'done' && S.viewStream[chatId] === sid) {
      if (ev.chat) upsertChatMeta(ev.chat);
      refreshAfterRun(ev);
    }
    return;
  }
  const msgs = S.chat.messages;
  if (ev.type === 'start') {
    // Platzhalter durch die gespeicherten Nachrichten ersetzen.
    const ti = msgs.findIndex((m) => m.temp);
    if (ti >= 0) msgs.splice(ti);
    msgs.push(ev.userMessage, ev.message);
    if (ev.chat) { S.chat.title = ev.chat.title; upsertChatMeta(ev.chat); renderTopbar(); }
    renderThread();
    scrollToEnd(false);
  } else if (ev.type === 'snapshot') {
    const i = msgs.findIndex((m) => m.id === ev.message.id);
    if (i >= 0) msgs[i] = ev.message; else msgs.push(ev.message);
    scheduleStreamRender();
  } else if (ev.type === 'text') {
    const m = msgs[msgs.length - 1];
    if (m && m.role === 'assistant') { m.text = (m.text || '') + ev.delta; m.phase = 'text'; scheduleStreamRender(); }
  } else if (ev.type === 'activity') {
    const m = msgs[msgs.length - 1];
    if (m && m.role === 'assistant') { (m.activity = m.activity || []).push(ev.item); m.phase = 'werkzeug'; scheduleStreamRender(); }
  } else if (ev.type === 'done') {
    const i = msgs.findIndex((m) => m.id === ev.message.id);
    if (i >= 0) msgs[i] = ev.message; else msgs.push(ev.message);
    if (ev.chat) { S.chat.title = ev.chat.title; upsertChatMeta(ev.chat); }
    const stick = isNearEnd();
    renderThread();
    if (stick) scrollToEnd(false);
    refreshAfterRun(ev);
    announce(ev.message.status === 'fertig' ? 'Antwort fertig' : ev.message.status === 'abgebrochen' ? 'Antwort abgebrochen' : 'Fehler bei der Antwort');
  } else if (ev.type === 'error') {
    toast(ev.message, { error: true });
  }
}

async function refreshAfterRun(ev) {
  if (ev.providers) { S.state.providers = ev.providers; }
  const files = refreshFiles();
  if (ev.message && (ev.message.updates || (ev.message.files && ev.message.files.length))) {
    try {
      const st = await api.get('/api/state');
      S.state.project = st.project;
      renderSidebarFoot();
    } catch { /* später erneut */ }
  }
  await files;
  renderTopbar();
  updateComposer();
  refreshPanel();
}

async function runStream(chatId, method, url, body) {
  const sid = ++streamSeq;
  S.viewStream[chatId] = sid;
  S.streams.set(chatId, (S.streams.get(chatId) || 0) + 1);
  updateComposer();
  renderChatList();
  try {
    await api.stream(method, url, body, (ev) => handleEvent(chatId, ev, sid));
  } catch (err) {
    if (chatId === S.chatId && S.chat) {
      const ti = S.chat.messages.findIndex((m) => m.temp);
      if (ti >= 0) S.chat.messages.splice(ti);
      renderThread();
    }
    if (err instanceof ApiError && err.code === 'anbieter') {
      S.state.providers = await api.get('/api/providers').catch(() => S.state.providers);
      toast(err.message, { error: true });
    } else if (err.status !== 404) {
      toast(err.message, { error: true });
    }
    return false;
  } finally {
    const n = (S.streams.get(chatId) || 1) - 1;
    if (n > 0) S.streams.set(chatId, n); else { S.streams.delete(chatId); S.state.running = S.state.running.filter((x) => x !== chatId); }
    updateComposer();
    renderChatList();
  }
  return true;
}

// Erneut an eine laufende Antwort anhängen (z. B. nach Chatwechsel oder Neuladen).
// Der neue Stream liefert zuerst den aktuellen Stand und übernimmt die Ansicht.
function attachStream(chatId) {
  runStream(chatId, 'GET', `/api/chats/${chatId}/stream`).then(async (ok) => {
    // Antwort war schon fertig: gespeicherten Stand laden.
    if (ok || S.chatId !== chatId) return;
    try {
      const chat = await api.get(`/api/chats/${chatId}`);
      if (S.chatId === chatId && !chat.running) { S.chat = chat; renderThread(); scrollToEnd(false); }
    } catch { /* Chat wurde gelöscht */ }
  });
}

async function send() {
  const chatId = S.chatId;
  const ta = S.els.composerWrap.querySelector('textarea');
  const text = ta.value.trim();
  const ready = S.pending.filter((p) => p.status === 'ready');
  if (isStreaming() || (!text && !ready.length)) return;
  if (S.pending.some((p) => p.status === 'uploading')) { toast('Bitte warte, bis alle Dateien hochgeladen sind.'); return; }
  const prov = activeProvider();
  if (prov && !prov.usable) {
    const banner = S.els.composerWrap.querySelector('.provider-banner');
    if (banner) {
      banner.classList.remove('attention');
      void banner.offsetWidth;
      banner.classList.add('attention');
      const first = banner.querySelector('button');
      if (first) first.focus();
    }
    announce(`${prov.name}: ${prov.label}. Bitte zuerst den Hinweis über dem Eingabefeld beachten.`);
    return;
  }
  const attachments = ready.map((p) => (p.staged ? { staged: p.staged } : { path: p.path }));
  const optimisticAtts = ready.map((p) => ({ path: p.path || p.name, name: p.name, kind: p.kind, lesbar: p.lesbar }));
  // Optimistisch anzeigen.
  S.chat.messages.push(
    { id: `tmp-u-${Date.now()}`, temp: true, role: 'user', text, attachments: optimisticAtts, createdAt: new Date().toISOString() },
    { id: `tmp-a-${Date.now()}`, temp: true, role: 'assistant', provider: S.state.settings.provider, text: '', status: 'laeuft', activity: [], createdAt: new Date().toISOString() });
  renderThread();
  scrollToEnd(false);
  const draft = { text, pending: S.pending };
  ta.value = '';
  autosize(ta);
  S.pending = [];
  renderAttachments();
  const ok = await runStream(chatId, 'POST', `/api/chats/${chatId}/messages`, { text, attachments });
  if (!ok && !ta.value && S.chatId === chatId) {
    // Entwurf wiederherstellen, damit nichts verloren geht.
    ta.value = draft.text;
    S.pending = draft.pending;
    autosize(ta);
    renderAttachments();
    updateComposer();
  }
}

// Startet die Analyse einer Übernahme in einem (neuen) Chat.
export async function startImportChat(inv, { sameChat = false } = {}) {
  try {
    if (!sameChat) {
      const c = await api.post('/api/chats');
      if (!S.state.chats.some((x) => x.id === c.id)) S.state.chats.unshift(c);
      await openChat(c.id);
    }
    await refreshFiles();
    const chatId = S.chatId;
    S.chat.messages.push({ id: `tmp-a-${Date.now()}`, temp: true, role: 'assistant', mode: 'import', provider: S.state.settings.provider, text: '', status: 'laeuft', activity: [], createdAt: new Date().toISOString() });
    renderThread();
    await runStream(chatId, 'POST', `/api/chats/${chatId}/messages`, { importId: inv.id });
  } catch (err) {
    toast(err.message, { error: true });
  }
}

// Kurze Antwort direkt senden (z. B. Auswahl der aktuellen Fassung).
async function sendText(text) {
  if (isStreaming()) return;
  const ta = S.els.composerWrap.querySelector('textarea');
  ta.value = text;
  autosize(ta);
  await send();
}

async function retryLast() {
  if (!S.chat || isStreaming()) return;
  const lastUser = [...S.chat.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  // Übernahme: Analyse mit demselben Inventar neu starten (die Dateien liegen schon im Arbeitsraum).
  if (lastUser.import) { await startImportChat({ id: lastUser.import.id }, { sameChat: true }); return; }
  const ta = S.els.composerWrap.querySelector('textarea');
  ta.value = lastUser.text || '';
  S.pending = (lastUser.attachments || []).map((a) => ({ id: Math.random().toString(36).slice(2), name: a.name, path: a.path, kind: a.kind, kindLabel: kindName(a.kind), lesbar: a.lesbar, status: 'ready' }));
  renderAttachments();
  autosize(ta);
  await send();
}

async function stop() {
  try { await api.post(`/api/chats/${S.chatId}/stop`); } catch (err) { toast(err.message, { error: true }); }
}

// ---------- Eingabefeld ----------

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight, window.innerHeight * 0.4)}px`;
}

function buildComposer() {
  const wrap = S.els.composerWrap;
  const ta = h('textarea', { rows: 1, placeholder: 'Schreib eine Nachricht …', 'aria-label': 'Nachricht', spellcheck: 'true', lang: 'de' });
  const fileInput = h('input', { type: 'file', multiple: true, hidden: true, 'aria-hidden': 'true', tabindex: '-1' });
  const attachBtn = btn('', { iconName: 'clip', cls: 'btn btn-icon', title: 'Datei anhängen', attrs: { 'aria-haspopup': 'menu' } });
  const providerBtn = h('button', { type: 'button', class: 'btn provider-pill', 'aria-haspopup': 'menu' });
  const sendBtn = h('button', { type: 'button', class: 'send-btn' });
  const composer = h('div', { class: 'composer' },
    h('div', { class: 'att-list', 'aria-label': 'Anhänge' }),
    ta,
    h('div', { class: 'composer-bar' }, attachBtn, providerBtn, h('span', { class: 'spacer' }), sendBtn),
    fileInput);
  wrap.append(h('div', { class: 'banner-slot' }), composer);
  ta.addEventListener('input', () => { autosize(ta); updateComposer(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  ta.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  });
  attachBtn.addEventListener('click', () => {
    menu(attachBtn, [
      { label: 'Datei vom Computer', icon: 'upload', onClick: () => fileInput.click() },
      { label: 'Aus dem Arbeitsraum', icon: 'folder', onClick: async () => { const sel = await pickWorkspaceFiles(); if (sel) addWorkspaceFiles(sel); } },
      'sep',
      { label: 'Bestehende Arbeit übernehmen …', icon: 'archive', onClick: () => openImportDialog([], (inv) => startImportChat(inv)) },
    ], { placement: 'top-start' });
  });
  fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
  providerBtn.addEventListener('click', () => providerMenu(providerBtn));
  sendBtn.addEventListener('click', () => (isStreaming() ? stop() : send()));
  S.els.textarea = ta;
  updateComposer();
}

export function activeProvider() {
  return S.state.providers.find((p) => p.id === S.state.settings.provider);
}

export function updateComposer() {
  const wrap = S.els.composerWrap;
  if (!wrap) return;
  const ta = wrap.querySelector('textarea');
  const sendBtn = wrap.querySelector('.send-btn');
  const prov = activeProvider();
  const pill = wrap.querySelector('.provider-pill');
  const modelName = prov && selectedModel(prov.id) ? selectedModelLabel(prov.id) : '';
  pill.replaceChildren(...[h('span', { class: 'status-dot', 'data-s': prov ? prov.status : 'pruefe' }), h('span', { class: 'pp-name' }, prov ? prov.name : 'Anbieter'),
    modelName ? h('span', { class: 'pp-model' }, modelName) : null, iconEl('chevronDown', 14)].filter(Boolean));
  pill.setAttribute('aria-label', prov ? `KI-Anbieter: ${prov.name}, ${prov.label}, Modell: ${modelName || 'Standard'}. Ändern` : 'KI-Anbieter wählen');
  pill.title = prov ? `${prov.name}: ${prov.label} · Modell: ${modelName || 'Standard'}` : '';
  if (isStreaming()) {
    sendBtn.className = 'send-btn stop';
    sendBtn.innerHTML = '';
    sendBtn.append(iconEl('stop', 16));
    sendBtn.disabled = false;
    sendBtn.setAttribute('aria-label', 'Antwort stoppen');
    sendBtn.title = 'Antwort stoppen';
  } else {
    sendBtn.className = 'send-btn';
    sendBtn.innerHTML = '';
    sendBtn.append(iconEl('up', 18));
    const has = ta.value.trim() || S.pending.some((p) => p.status === 'ready');
    sendBtn.disabled = !has || S.pending.some((p) => p.status === 'uploading');
    sendBtn.setAttribute('aria-label', 'Senden');
    sendBtn.title = 'Senden (Enter)';
  }
  renderProviderBanner();
  pollProvidersIfNeeded();
}

function renderProviderBanner() {
  const slot = S.els.composerWrap.querySelector('.banner-slot');
  slot.innerHTML = '';
  const prov = activeProvider();
  if (!prov || ['bereit', 'verbunden'].includes(prov.status)) return;
  if (prov.status === 'pruefe') return;
  const other = S.state.providers.find((p) => p.id !== prov.id && p.usable);
  const bad = ['nicht_installiert', 'fehler'].includes(prov.status);
  const text = prov.status === 'ungeprueft'
    ? [h('b', {}, `${prov.name}: `), 'Installiert. Die Verbindung wird beim ersten Senden geprüft.']
    : [h('b', {}, `${prov.name}: ${prov.label}. `), prov.hint ? prov.hint.text : prov.detail || ''];
  const banner = h('div', { class: `provider-banner${bad ? ' danger' : ''}`, role: 'status' }, h('span', { class: 'txt' }, text));
  if (prov.hint && prov.hint.befehl) {
    banner.append(h('code', { class: 'cmd' }, prov.hint.befehl), btn('Kopieren', { iconName: 'copy', cls: 'btn btn-sm', size: 15, onClick: () => copyText(prov.hint.befehl) }));
  }
  banner.append(btn(prov.status === 'ungeprueft' ? 'Jetzt prüfen' : 'Erneut prüfen', { iconName: 'refresh', cls: 'btn btn-sm', size: 15, onClick: () => checkProvider(prov.id) }));
  if (other) banner.append(btn(`Zu ${other.name} wechseln`, { cls: 'btn btn-sm', onClick: () => chooseProvider(other.id) }));
  slot.append(banner);
}

let pollTimer = null;
function pollProvidersIfNeeded() {
  if (pollTimer || !S.state.providers.some((p) => p.status === 'pruefe')) return;
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    try { S.state.providers = await api.get('/api/providers'); } catch { /* erneut */ }
    updateComposer();
  }, 1500);
}

export async function checkProvider(id) {
  const p = S.state.providers.find((x) => x.id === id);
  if (p) p.status = 'pruefe';
  updateComposer();
  try {
    S.state.providers = await api.post(`/api/providers/${id}/check`);
    const np = S.state.providers.find((x) => x.id === id);
    toast(`${np.name}: ${np.label}`, { error: !np.usable });
  } catch (err) {
    toast(err.message, { error: true });
  }
  updateComposer();
}

export async function chooseModel(pid, id) {
  try {
    const r = await api.put('/api/settings', { modelle: { [pid]: id } });
    S.state.settings = r.settings;
    S.state.providers = r.providers;
    updateComposer();
    announce(`Modell für ${PROVIDER_NAME[pid]}: ${modelLabel(id, providerModels(pid))}`);
    return true;
  } catch (err) {
    toast(err.message, { error: true });
    return false;
  }
}

export async function chooseProvider(id) {
  try {
    const r = await api.put('/api/settings', { provider: id });
    S.state.settings = r.settings;
    S.state.providers = r.providers;
    updateComposer();
    announce(`KI-Anbieter: ${PROVIDER_NAME[id]}`);
  } catch (err) {
    toast(err.message, { error: true });
  }
}

function providerMenu(anchor) {
  const items = S.state.providers.map((p) => {
    const active = p.id === S.state.settings.provider;
    const b = h('button', { type: 'button', role: 'menuitemradio', 'aria-checked': active ? 'true' : 'false', class: 'menu-item provider-option' },
      h('span', { class: 'status-dot', 'data-s': p.status }),
      h('span', { class: 'po-main' }, h('span', { class: 'po-name' }, p.name), h('span', { class: 'po-state' }, p.label + (p.model && p.status === 'verbunden' ? ` · ${modelLabel(p.model, p.models)}` : ''))),
      active ? iconEl('check', 16, 'check') : null);
    b.addEventListener('click', () => { closePopover(); if (!active) chooseProvider(p.id); });
    return b;
  });
  const foot = h('div', { class: 'pop-foot' },
    btn('Erneut prüfen', { iconName: 'refresh', cls: 'btn btn-sm', size: 15, onClick: () => { closePopover(); checkProvider(S.state.settings.provider); } }),
    btn('Einstellungen', { iconName: 'sliders', cls: 'btn btn-sm', size: 15, onClick: () => { closePopover(); openSettings('anbieter'); } }));
  const models = modelMenuSection(S.state.settings.provider);
  popover(anchor, [h('div', { class: 'menu-label', 'aria-hidden': 'true' }, 'Anbieter'), ...items, ...(models.length ? [h('div', { class: 'menu-sep', role: 'separator' }), ...models] : []), foot], { placement: 'top-start' });
}

// ---------- Anhänge ----------

let pid = 0;
function addFiles(files) {
  for (const file of files) {
    const item = { id: `p${++pid}`, name: file.name, size: file.size, status: 'uploading', progress: 0 };
    if (file.size > 200 * 1024 * 1024) { item.status = 'error'; item.error = 'zu groß (max. 200 MB)'; S.pending.push(item); continue; }
    S.pending.push(item);
    api.upload(file, (p) => { item.progress = p; renderAttachments(); })
      .then((r) => {
        Object.assign(item, { status: 'ready', staged: r.id, kind: r.kind, kindLabel: r.kindLabel, sizeLabel: r.sizeLabel, lesbar: r.lesbar, hinweis: r.hinweis });
        if (!S.pending.includes(item)) api.del(`/api/uploads/${r.id}`).catch(() => {});
      })
      .catch((err) => { item.status = 'error'; item.error = err.message; })
      .finally(() => { renderAttachments(); updateComposer(); });
  }
  renderAttachments();
  updateComposer();
}

async function addWorkspaceFiles(paths) {
  for (const p of paths) {
    if (S.pending.some((x) => x.path === p)) continue;
    const item = { id: `p${++pid}`, name: p.split('/').pop(), path: p, status: 'ready', kindLabel: '' };
    S.pending.push(item);
    api.get(`/api/files/info?path=${encodeURIComponent(p)}`).then((info) => {
      Object.assign(item, { kind: info.kind, kindLabel: info.kindLabel, lesbar: info.lesbar, hinweis: info.hinweis });
      if (!info.exists) { item.status = 'error'; item.error = 'Datei fehlt'; }
      renderAttachments();
      updateComposer();
    }).catch(() => {});
  }
  renderAttachments();
  updateComposer();
}

function removePending(item) {
  S.pending = S.pending.filter((x) => x !== item);
  if (item.staged) api.del(`/api/uploads/${item.staged}`).catch(() => {});
  renderAttachments();
  updateComposer();
}

function renderAttachments() {
  const list = S.els.composerWrap.querySelector('.att-list');
  list.innerHTML = '';
  for (const item of S.pending) {
    const unreadable = item.lesbar === 'nein';
    const chip = h('div', {
      class: `chip att-chip${item.status === 'uploading' ? ' uploading' : ''}${item.status === 'error' ? ' error' : ''}${unreadable ? ' unreadable' : ''}`,
      title: item.error || item.hinweis || item.name,
    },
    h('span', { html: fileIcon(item.kind, 16) }).firstChild,
    h('span', { class: 'name' }, item.name));
    if (item.status === 'uploading') chip.append(h('span', { class: 'progress', 'aria-label': 'Wird hochgeladen' }, h('i', { style: { width: `${Math.round(item.progress * 100)}%` } })));
    else if (item.status === 'error') chip.append(h('span', { class: 'kind' }, item.error || 'Fehler'));
    else chip.append(h('span', { class: 'kind' }, unreadable ? 'nicht lesbar' : [item.kindLabel, item.sizeLabel].filter(Boolean).join(' · ')));
    chip.append(btn('', { iconName: 'x', cls: 'chip-act', title: `${item.name} entfernen`, size: 15, onClick: () => removePending(item) }));
    list.append(chip);
  }
}

function setupDragDrop() {
  const main = S.els.main;
  let depth = 0;
  let overlay = null;
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  main.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth += 1;
    if (!overlay) {
      overlay = h('div', { class: 'drop-overlay' }, h('div', { class: 'inner' }, iconEl('upload', 20), 'Dateien hier ablegen'));
      main.append(overlay);
      S.els.composerWrap.querySelector('.composer').classList.add('dragging');
    }
  });
  main.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  const reset = () => { depth = 0; if (overlay) { overlay.remove(); overlay = null; } S.els.composerWrap.querySelector('.composer').classList.remove('dragging'); };
  main.addEventListener('dragleave', () => { depth -= 1; if (depth <= 0) reset(); });
  main.addEventListener('drop', async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    reset();
    const d = entriesFromDrop(e.dataTransfer); // synchron lesen, bevor das Ereignis endet
    const files = [...e.dataTransfer.files];
    if (d.hasFolder) {
      // Ordner bringen meist eine ganze Arbeit mit: als Übernahme anbieten.
      openImportDialog(await d.collect(), (inv) => startImportChat(inv));
      return;
    }
    addFiles(files);
    S.els.textarea.focus();
  });
}

function setupGlobalKeys() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); newChat(); }
    if (e.key === 'Escape' && S.els.app.classList.contains('sb-open')) toggleSidebar(false);
  });
}

// ---------- Start ----------

export async function enterApp({ greet = false } = {}) {
  await refreshFiles();
  mountApp();
  await openInitialChat();
  if (greet) showGreeting(project() ? project().angaben.name : '');
}

async function boot() {
  try {
    await loadState();
  } catch (err) {
    document.getElementById('root').replaceChildren(h('div', { class: 'center-state' }, iconEl('alert', 28), h('h1', {}, 'Die App ist nicht erreichbar'), h('p', {}, err.message), btn('Neu laden', { cls: 'btn btn-primary', onClick: () => location.reload() })));
    return;
  }
  if (!S.state.project) {
    if (S.state.projectError) showWorkspaceMissing(S.state.projectError);
    else showOnboarding();
    return;
  }
  // Projekt vorhanden = späterer Start: kurze Begrüßung, dann direkt der letzte Arbeitsstand.
  await enterApp({ greet: true });
}

boot();

export { fmtDate, parseLocal, daysUntil, STATUS_LABEL, STATUS_SYMBOL, PROVIDER_NAME };
