// API-Schlüssel (DeepSeek, OpenCode Go) verbinden, ändern oder entfernen.
import { api } from './api.js';
import { h, btn, toast, iconEl } from './ui.js';

const ANBIETER = {
  deepseek: {
    name: 'DeepSeek', link: 'https://platform.deepseek.com/api_keys', platzhalter: 'sk-…',
    linkText: 'Schlüssel bei DeepSeek erstellen',
    erklaerung: ' Der Schlüssel bleibt auf diesem Computer. DeepSeek rechnet nach Verbrauch ab, dafür brauchst du dort Guthaben.',
  },
  opencodego: {
    name: 'OpenCode Go', link: 'https://opencode.ai/docs/go', platzhalter: 'Schlüssel aus der OpenCode-Konsole',
    linkText: 'OpenCode Go einrichten und Schlüssel erstellen',
    erklaerung: ' Der Schlüssel bleibt auf diesem Computer. Die Nutzung ist im OpenCode-Go-Abo enthalten, es gelten die Grenzen des Plans.',
  },
};

// Eingabefeld mit „Verbinden“ für einen Anbieter (Kennung). onFertig bekommt die Antwort (Einstellungen und Anbieter).
export function schluesselFormular({ provider = 'deepseek', onFertig, kompakt = false } = {}) {
  const a = ANBIETER[provider] || ANBIETER.deepseek;
  const input = h('input', { class: 'input', type: 'password', id: `ds-key-${Math.random().toString(36).slice(2, 7)}`, placeholder: a.platzhalter, autocomplete: 'off', spellcheck: 'false', 'aria-label': `${a.name}-API-Schlüssel` });
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
      const r = await api.post(`/api/providers/${provider}/schluessel`, { schluessel: v });
      input.value = '';
      toast(`${a.name} ist verbunden.`);
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
    h('a', { class: 'link-btn', href: a.link, target: '_blank', rel: 'noopener noreferrer' }, a.linkText, iconEl('external', 14)),
    kompakt ? null : h('span', {}, a.erklaerung));
  return h('div', { class: 'ds-form' }, h('div', { class: 'path-field' }, input, ok), fehler, hilfe);
}

export async function schluesselEntfernen(provider = 'deepseek') {
  return api.del(`/api/providers/${provider}/schluessel`);
}
