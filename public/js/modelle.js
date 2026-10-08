// Modellauswahl je Anbieter: Menüeinträge für das Eingabefeld und ein Dialog mit allen Modellen.
import { api } from './api.js';
import { h, iconEl, btn, dialog, closePopover, toast, announce } from './ui.js';
import { S, chooseModel } from './app.js';
import { modelLabel } from './modelname.js';

export function providerModels(pid) {
  const p = S.state.providers.find((x) => x.id === pid);
  return (p && p.models) || [];
}

export function selectedModel(pid) {
  return ((S.state.settings.modelle || {})[pid]) || '';
}

export function selectedModelLabel(pid) {
  return modelLabel(selectedModel(pid), providerModels(pid));
}

const STUFEN = [
  ['sparsam', 'Sparsam', 'Schnelle, kurze Antworten. Verbraucht am wenigsten.'],
  ['ausgewogen', 'Ausgewogen', 'Für die meisten Aufgaben die beste Wahl.'],
  ['gruendlich', 'Gründlich', 'Denkt länger nach, z. B. beim Prüfen der Arbeit. Verbraucht mehr.'],
];

// Gründlichkeit (gilt für beide Anbieter): Auswahl als Segmentknopf mit kurzer Erklärung.
export function gruendlichkeitEl({ onChange } = {}) {
  const current = S.state.settings.gruendlichkeit || 'ausgewogen';
  const info = h('div', { class: 'mg-note' }, (STUFEN.find((x) => x[0] === current) || STUFEN[1])[2]);
  const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Gründlichkeit' });
  for (const [val, label, text] of STUFEN) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': val === current ? 'true' : 'false' }, label);
    b.addEventListener('click', async () => {
      try {
        const r = await api.put('/api/settings', { gruendlichkeit: val });
        S.state.settings = r.settings;
        for (const x of seg.children) x.setAttribute('aria-checked', x === b ? 'true' : 'false');
        info.textContent = text;
        announce(`Gründlichkeit: ${label}`);
        if (onChange) onChange(val);
      } catch (err) { toast(err.message, { error: true }); }
    });
    seg.append(b);
  }
  return h('div', { class: 'gruendlichkeit' }, seg, info);
}

function standardInfo(pid) {
  return pid === 'claude' ? 'Das Modell, das in Claude Code voreingestellt ist.' : 'Das Modell, das in Antigravity voreingestellt ist.';
}

// Kurzauswahl im Anbieter-Menü des Eingabefelds.
export function modelMenuSection(pid) {
  const p = S.state.providers.find((x) => x.id === pid);
  if (!p || p.modelWahl === false) return [];
  const current = selectedModel(pid);
  const models = providerModels(pid);
  const quick = pid === 'claude' ? models.filter((m) => m.gruppe === 'familie') : models.slice(0, 6);
  const entries = [{ id: '', name: 'Standard', info: '' }, ...quick];
  if (current && !entries.some((m) => m.id === current)) entries.push({ id: current, name: modelLabel(current, models) });
  const items = entries.map((m) => {
    const active = m.id === current;
    const b = h('button', { type: 'button', role: 'menuitemradio', 'aria-checked': active ? 'true' : 'false', class: 'menu-item model-option', title: m.info || m.id || standardInfo(pid) },
      h('span', { class: 'mo-name' }, m.name), active ? iconEl('check', 16, 'check') : null);
    b.addEventListener('click', () => { closePopover(); if (!active) chooseModel(pid, m.id); });
    return b;
  });
  const more = h('button', { type: 'button', role: 'menuitem', class: 'menu-item model-option more' }, h('span', { class: 'mo-name' }, 'Weitere Modelle …'));
  more.addEventListener('click', () => { closePopover(); openModelDialog(pid); });
  return [h('div', { class: 'menu-label', 'aria-hidden': 'true' }, `Modell · ${p.name}`), ...items, more];
}

// Vollständige Auswahl: Standard, Modellfamilien, feste Versionen bzw. Liste aus „agy models“, eigene ID.
export function openModelDialog(pid, { onClose } = {}) {
  const p = S.state.providers.find((x) => x.id === pid);
  if (!p) return null;
  const models = providerModels(pid);
  const current = selectedModel(pid);
  const body = h('div', { class: 'model-dialog' });
  let d = null;

  const pick = async (id) => {
    if (await chooseModel(pid, id)) d.close();
  };
  const row = (m) => {
    const active = m.id === current;
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': active ? 'true' : 'false', class: 'model-row' },
      h('span', { class: 'radio', 'aria-hidden': 'true' }),
      h('span', { class: 'mr-main' },
        h('span', { class: 'mr-name' }, m.name, m.id ? h('code', {}, m.id) : null),
        m.info ? h('span', { class: 'mr-info' }, m.info) : null));
    b.addEventListener('click', () => pick(m.id));
    return b;
  };
  const group = (title, list, note) => {
    if (!list.length) return null;
    return h('section', { class: 'model-group' }, h('h3', {}, title), note ? h('p', { class: 'mg-note' }, note) : null,
      h('div', { class: 'model-list', role: 'radiogroup', 'aria-label': title }, list.map(row)));
  };

  body.append(h('section', { class: 'model-group' }, h('h3', {}, 'Gründlichkeit'), gruendlichkeitEl()));
  body.append(group('Voreinstellung', [{ id: '', name: 'Standard', info: standardInfo(pid) }]));
  if (pid === 'claude') {
    body.append(
      group('Immer die neueste Version', models.filter((m) => m.gruppe === 'familie')),
      group('Bestimmte Version', models.filter((m) => m.gruppe === 'version'), 'Bleibt fest, auch wenn neuere Versionen erscheinen.'));
  } else {
    const g = group('Verfügbare Modelle', models.filter((m) => m.gruppe === 'verfuegbar'), 'Liste aus „agy models“.');
    body.append(g || h('p', { class: 'mg-note' }, 'Die Modellliste von Antigravity konnte nicht gelesen werden. Prüfe den Anbieter in den Einstellungen oder trage die Modell-ID selbst ein.'));
  }

  // Eigene Modell-ID
  const known = [{ id: '' }, ...models].some((m) => m.id === current);
  const input = h('input', { class: 'input', id: 'model-own', spellcheck: 'false', autocomplete: 'off', value: known ? '' : current, placeholder: pid === 'claude' ? 'z. B. claude-opus-4-7' : 'z. B. gemini-3.1-pro-high' });
  const use = btn('Verwenden', { cls: 'btn btn-soft' });
  const err = h('div', { class: 'field-note err', 'aria-live': 'polite' });
  const submit = () => {
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,99}$/.test(v)) { err.textContent = 'Erlaubt sind Buchstaben, Ziffern und . - _ : [ ]'; input.focus(); return; }
    pick(v);
  };
  use.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  body.append(h('section', { class: 'model-group' }, h('h3', {}, h('label', { for: 'model-own' }, 'Eigene Modell-ID')),
    h('div', { class: 'path-field' }, input, use), err));
  body.append(h('p', { class: 'mg-note foot' }, pid === 'claude'
    ? 'Welche Modelle du nutzen kannst, hängt von deinem Claude-Konto ab. Die Auswahl gilt ab der nächsten Nachricht, auch in laufenden Chats.'
    : 'Welche Modelle du nutzen kannst, hängt von deinem Google-Konto ab. Die Auswahl gilt ab der nächsten Nachricht.'));

  d = dialog({ title: `Modell für ${p.name}`, body, onClose });
  setTimeout(() => { const el = body.querySelector('.model-row[aria-checked="true"]') || body.querySelector('.model-row'); if (el) el.focus(); });
  return d;
}
