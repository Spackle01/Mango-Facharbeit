// DeepSeek: API-Schlüssel verbinden, ändern oder entfernen.
import { api } from './api.js';
import { h, btn, toast, iconEl } from './ui.js';

const LINK = 'https://platform.deepseek.com/api_keys';

// Eingabefeld mit „Verbinden“. onFertig bekommt die Antwort (Einstellungen und Anbieter).
export function schluesselFormular({ onFertig, kompakt = false } = {}) {
  const input = h('input', { class: 'input', type: 'password', id: `ds-key-${Math.random().toString(36).slice(2, 7)}`, placeholder: 'sk-…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'DeepSeek-API-Schlüssel' });
  const fehler = h('div', { class: 'field-note err', 'aria-live': 'polite' });
  const ok = btn('Verbinden', { cls: 'btn btn-primary btn-sm' });
  const senden = async () => {
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    fehler.textContent = '';
    ok.disabled = true;
    const alt = ok.textContent;
    ok.firstChild.textContent = 'Prüft …';
    try {
      const r = await api.post('/api/providers/deepseek/schluessel', { schluessel: v });
      input.value = '';
      toast('DeepSeek ist verbunden.');
      if (onFertig) onFertig(r);
    } catch (err) {
      fehler.textContent = err.message;
      ok.disabled = false;
      ok.firstChild.textContent = alt;
    }
  };
  ok.addEventListener('click', senden);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); senden(); } });
  const hilfe = h('div', { class: 'ds-hilfe' },
    h('a', { class: 'link-btn', href: LINK, target: '_blank', rel: 'noopener noreferrer' }, 'Schlüssel bei DeepSeek erstellen', iconEl('external', 14)),
    kompakt ? null : h('span', {}, ' Der Schlüssel bleibt auf diesem Computer. DeepSeek rechnet nach Verbrauch ab, dafür brauchst du dort Guthaben.'));
  return h('div', { class: 'ds-form' }, h('div', { class: 'path-field' }, input, ok), fehler, hilfe);
}

export async function schluesselEntfernen() {
  return api.del('/api/providers/deepseek/schluessel');
}
