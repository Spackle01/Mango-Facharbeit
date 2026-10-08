// Erster Start, Begrüßung bei späteren Starts und Ordnerauswahl.
import { api } from './api.js';
import { h, iconEl, btn, toast, dialog, prefersReducedMotion, parseDateDE, shortPath } from './ui.js';
import { enterApp, loadState, startImportChat } from './app.js';
import { createPicker, createProgress, runImport } from './importer.js';

const HEADLINE = 'Lass uns mit deiner Facharbeit anfangen.';

function typewriter(el, text, done) {
  const caret = h('span', { class: 'caret', 'aria-hidden': 'true' });
  const out = h('span', { 'aria-hidden': 'true' });
  el.setAttribute('aria-label', text);
  el.replaceChildren(out, caret);
  if (prefersReducedMotion()) {
    out.textContent = text;
    el.classList.add('done');
    done();
    return;
  }
  let i = 0;
  const step = () => {
    i += 1;
    out.textContent = text.slice(0, i);
    if (i < text.length) setTimeout(step, text[i - 1] === ' ' ? 22 : 34);
    else { el.classList.add('done'); setTimeout(done, 180); }
  };
  setTimeout(step, 250);
}

// Nativer Ordnerdialog, sonst ein einfacher Ordner-Browser in der App.
export async function chooseFolder(startPath) {
  try {
    const r = await api.post('/api/pick-folder');
    if (r.supported) return r.path || null;
  } catch { /* Fallback */ }
  return browseFolders(startPath);
}

function browseFolders(startPath) {
  return new Promise((resolve) => {
    let result = null;
    let currentPath = '';
    const crumbs = h('div', { class: 'crumbs' });
    const list = h('div', { class: 'folder-list', role: 'listbox', 'aria-label': 'Ordner' });
    const roots = h('div', { class: 'roots' });
    const newName = h('input', { class: 'input', placeholder: 'Neuer Ordner (optional), z. B. Facharbeit', 'aria-label': 'Name für einen neuen Ordner' });
    const load = async (p) => {
      try {
        const r = await api.get(`/api/fs/list?path=${encodeURIComponent(p || '')}`);
        currentPath = r.path;
        crumbs.textContent = r.path;
        list.innerHTML = '';
        if (r.parent) list.append(h('button', { type: 'button', onclick: () => load(r.parent) }, iconEl('chevronLeft', 16), '.. (eine Ebene höher)'));
        for (const d of r.dirs) list.append(h('button', { type: 'button', onclick: () => load(d.path) }, iconEl('folder', 16), d.name));
        if (!r.dirs.length) list.append(h('div', { class: 'empty-note' }, 'Keine Unterordner'));
        roots.replaceChildren(...r.roots.map((x) => btn(x.name, { cls: 'btn btn-sm btn-soft', onClick: () => load(x.path) })));
      } catch (err) { toast(err.message, { error: true }); }
    };
    const ok = btn('Diesen Ordner verwenden', { cls: 'btn btn-primary' });
    const cancel = btn('Abbrechen', { cls: 'btn' });
    const d = dialog({
      title: 'Speicherort wählen',
      body: h('div', {}, roots, h('div', { style: { margin: '12px 0 4px' } }, crumbs), list, newName),
      footer: [cancel, ok],
      onClose: () => resolve(result),
    });
    ok.addEventListener('click', () => {
      const sep = currentPath.includes('\\') ? '\\' : '/';
      const name = newName.value.trim().replace(/[\\/:*?"<>|]/g, '_');
      result = name ? `${currentPath.replace(/[\\/]+$/, '')}${sep}${name}` : currentPath;
      d.close();
    });
    cancel.addEventListener('click', () => d.close());
    const start = startPath ? startPath.replace(/[\\/][^\\/]*$/, '') : '';
    load(start);
  });
}

export function showOnboarding({ fromSettings = false } = {}) {
  const root = document.getElementById('root');
  const title = h('h1', { class: 'typewriter' });
  const form = h('form', { class: 'onboard-form', novalidate: true, hidden: true, 'aria-label': 'Angaben zur Facharbeit' });
  const logo = h('img', { class: 'logo', src: 'logo.png', alt: '', width: '44', height: '44', draggable: 'false' });

  // Zwei gleichwertige Einstiege
  const choice = h('div', { class: 'choice', role: 'group', 'aria-label': 'Wie möchtest du starten?', hidden: true });
  const choiceCard = (mode, iconName, label, sub) => {
    const b = h('button', { type: 'button', class: 'choice-card', 'data-mode': mode },
      h('span', { class: 'cc-icon' }, iconEl(iconName, 22)), h('span', { class: 'cc-label' }, label), h('span', { class: 'cc-sub' }, sub));
    b.addEventListener('click', () => setMode(mode));
    return b;
  };
  choice.append(
    choiceCard('neu', 'plus', 'Neu anfangen', 'Mit den Vorlagen der Schule starten'),
    choiceCard('import', 'upload', 'Ich habe schon angefangen', 'Dateien reinziehen – Mango sortiert sie ein'));
  root.replaceChildren(h('div', { class: 'onboard' }, h('div', { class: 'onboard-inner' }, logo, title, choice, form)));

  const field = (key, label, attrs = {}, cls = '') => {
    const id = `ob-${key}`;
    const input = h('input', { class: 'input', id, name: key, autocomplete: 'off', ...attrs });
    return { input, el: h('div', { class: `field${cls ? ` ${cls}` : ''}` }, h('label', { for: id }, label), input) };
  };
  const f = {
    name: field('name', 'Name', { autocomplete: 'name' }),
    klasse: field('klasse', 'Klasse oder Kurs'),
    titel: field('titel', 'Titel oder vorläufiger Name der Facharbeit', {}, 'full'),
    fach: field('fach', 'Fach'),
    lehrkraft: field('lehrkraft', 'Zuständige Lehrkraft'),
    abgabedatum: field('abgabedatum', 'Abgabedatum', { type: 'text', placeholder: 'TT.MM.JJJJ' }),
  };
  const fillDate = h('button', { type: 'button', class: 'link-btn' }, '07.12.2026 laut Zeitschiene');
  fillDate.addEventListener('click', () => { f.abgabedatum.input.value = '07.12.2026'; });
  f.abgabedatum.el.querySelector('label').replaceWith(h('div', { class: 'label-row' }, h('label', { for: 'ob-abgabedatum', class: 'field-label' }, 'Abgabedatum'), fillDate));

  // Speicherort: wird vorgeschlagen und nur bei Bedarf geändert (kein Pfad zum Abtippen).
  const pathInput = h('input', { type: 'hidden', id: 'ob-ws' });
  const pathShow = h('code', { class: 'ws-show' });
  const note = h('div', { class: 'field-note', id: 'ob-ws-note', 'aria-live': 'polite' });
  const change = h('button', { type: 'button', class: 'link-btn' }, 'Ändern');
  const wsField = h('div', { class: 'ws-line full' }, iconEl('folder', 15), h('span', {}, 'Speicherort:'), pathShow, change, pathInput, note);
  const showPath = () => { pathShow.textContent = shortPath(pathInput.value); pathShow.title = pathInput.value; };

  let userPickedPath = false;
  const inspect = async () => {
    const p = pathInput.value.trim();
    note.className = 'field-note';
    note.textContent = '';
    if (!p) return;
    try {
      const r = await api.get(`/api/fs/inspect?path=${encodeURIComponent(p)}`);
      if (!r.valid) { note.className = 'field-note err'; note.textContent = r.message; return; }
      if (r.isWorkspace) { note.textContent = 'Hier liegt bereits eine Facharbeit. Sie wird geöffnet und deine Angaben werden ergänzt.'; return; }
      if (r.exists && r.fileCount) { note.className = 'field-note warn'; note.textContent = `Der Ordner enthält ${r.fileCount} Einträge. Sie bleiben unverändert erhalten.`; }
    } catch { /* still */ }
  };
  const suggest = async () => {
    if (userPickedPath) return;
    try {
      const r = await api.get(`/api/suggest-workspace?titel=${encodeURIComponent(f.titel.input.value.trim())}`);
      if (!userPickedPath) { pathInput.value = r.path; showPath(); inspect(); }
    } catch { /* still */ }
  };
  let suggestTimer = null;
  f.titel.input.addEventListener('input', () => { clearTimeout(suggestTimer); suggestTimer = setTimeout(suggest, 400); });
  change.addEventListener('click', async () => {
    const picked = await chooseFolder(pathInput.value.trim());
    if (picked) { pathInput.value = picked; userPickedPath = true; showPath(); inspect(); }
  });

  // Bausteine für beide Wege
  const grid = h('div', { class: 'form-grid' }, f.name.el, f.klasse.el, f.titel.el, f.fach.el, f.lehrkraft.el, f.abgabedatum.el);
  // Beim Drop-in werden die Angaben ebenfalls abgefragt. Was Mango in den Dateien findet,
  // füllt es nur in leere Felder ein.
  const importHead = h('div', { class: 'angaben-head' }, h('b', {}, 'Deine Angaben'),
    h('span', {}, 'Was du leer lässt, ergänzt Mango aus deinen Dateien.'));
  const gridHost = h('div', { class: 'grid-host' }, importHead, grid);
  const picker = createPicker({ onChange: () => { if (mode === 'import') submit.disabled = !picker.valid(); } });
  const pickerHost = h('div', { class: 'picker-host' }, picker.el);
  const progress = createProgress();
  progress.el.hidden = true;
  const submit = btn('Los geht’s', { cls: 'btn btn-primary', attrs: { type: 'submit' } });
  const back = btn('Zurück', { cls: 'btn', onClick: () => setMode(null) });
  const actions = h('div', { class: 'actions' }, submit, back);
  if (fromSettings) actions.append(btn('Abbrechen', { cls: 'btn', onClick: () => enterApp() }));
  form.append(pickerHost, gridHost, h('div', { class: 'ws-grid' }, wsField), progress.el, actions);

  let mode = null;
  function setMode(m) {
    mode = m;
    choice.hidden = !!m;
    form.hidden = !m;
    if (!m) { choice.querySelector('.choice-card').focus(); return; }
    pickerHost.hidden = m !== 'import';
    importHead.hidden = m !== 'import';
    if (m === 'import') {
      submit.querySelector('.lbl').textContent = 'Einsortieren und loslegen';
      submit.disabled = !picker.valid();
      setTimeout(() => form.querySelector('.drop-zone').focus());
    } else {
      submit.querySelector('.lbl').textContent = 'Los geht’s';
      submit.disabled = false;
      setTimeout(() => f.name.input.focus());
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const workspace = pathInput.value.trim();
    if (!workspace) { note.className = 'field-note err'; note.textContent = 'Bitte einen Speicherort wählen.'; change.focus(); return; }
    const angaben = {};
    for (const [k, v] of Object.entries(f)) angaben[k] = v.input.value.trim();
    const datum = parseDateDE(angaben.abgabedatum);
    if (datum === null) { note.className = 'field-note err'; note.textContent = 'Abgabedatum bitte als TT.MM.JJJJ eingeben oder leer lassen.'; f.abgabedatum.input.focus(); return; }
    angaben.abgabedatum = datum;
    if (mode === 'import' && !picker.valid()) { note.className = 'field-note err'; note.textContent = 'Bitte zuerst Dateien oder Ordner auswählen.'; return; }
    submit.disabled = true;
    back.disabled = true;
    submit.querySelector('.lbl').textContent = 'Wird eingerichtet …';
    try {
      await api.post('/api/setup', { workspace, angaben });
      await loadState();
    } catch (err) {
      submit.disabled = false;
      back.disabled = false;
      submit.querySelector('.lbl').textContent = mode === 'import' ? 'Einsortieren und loslegen' : 'Los geht’s';
      note.className = 'field-note err';
      note.textContent = err.message;
      return;
    }
    if (mode !== 'import') { await enterApp(); return; }
    // Drop-in: Dateien hochladen und prüfen, danach sortiert der Assistent im Chat ein.
    pickerHost.hidden = true;
    gridHost.hidden = true;
    progress.el.hidden = false;
    actions.hidden = true;
    let inv = null;
    try {
      inv = await runImport(picker.items(), progress, picker.tooLarge());
    } catch (err) {
      toast(`Das Einsortieren ist nicht vollständig gelungen: ${err.message}`, { error: true, timeout: 7000 });
    }
    await enterApp();
    if (inv) await startImportChat(inv);
  });

  suggest();
  typewriter(title, HEADLINE, () => {
    choice.hidden = false;
    choice.querySelector('.choice-card').focus();
  });
}

const GREETINGS = ['Willkommen zurück', 'Lass uns weitermachen', 'Schön, dass du wieder da bist', 'Weiter geht’s', 'Auf zum nächsten Schritt'];

export function showGreeting(name) {
  let i = 0;
  try { i = (Number(localStorage.getItem('mango.greet')) || 0) % GREETINGS.length; localStorage.setItem('mango.greet', String(i + 1)); } catch { /* egal */ }
  const first = name ? name.trim().split(/\s+/)[0] : '';
  const text = first && i % 2 === 0 ? `${GREETINGS[i]}, ${first}` : GREETINGS[i];
  const el = h('div', { class: 'greeting', role: 'status' }, h('span', {}, text));
  document.body.append(el);
  const hold = prefersReducedMotion() ? 900 : 1250;
  const finish = () => {
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 330);
    const ta = document.querySelector('.composer textarea');
    if (ta) ta.focus({ preventScroll: true });
  };
  el.addEventListener('click', finish);
  document.addEventListener('keydown', finish, { once: true });
  setTimeout(finish, hold);
}

export function showWorkspaceMissing(err) {
  const root = document.getElementById('root');
  const openOther = btn('Ordner wählen …', { cls: 'btn btn-primary' });
  const fresh = btn('Neue Facharbeit anlegen', { cls: 'btn btn-soft', onClick: () => showOnboarding() });
  openOther.addEventListener('click', async () => {
    const picked = await chooseFolder(err.workspace);
    if (!picked) return;
    try {
      await api.post('/api/projects/open', { workspace: picked });
      await loadState();
      await enterApp({ greet: true });
    } catch (e) {
      toast(e.message, { error: true });
    }
  });
  root.replaceChildren(h('div', { class: 'center-state' },
    iconEl('alert', 30),
    h('h1', {}, 'Arbeitsraum nicht gefunden'),
    h('p', {}, err.message),
    h('p', {}, h('code', { class: 'cmd' }, err.workspace)),
    h('div', { class: 'btns' }, openOther, fresh)));
}
