// Einstellungen: Darstellung, KI-Anbieter, Facharbeit.
import { api } from './api.js';
import { h, iconEl, btn, toast, dialog, copyText } from './ui.js';
import { S, applyTheme, chooseProvider, checkProvider, updateComposer, loadState, enterApp } from './app.js';
import { showOnboarding, chooseFolder } from './onboarding.js';

export function openSettings(focusSection) {
  const body = h('div');
  const d = dialog({ title: 'Einstellungen', body });

  const render = () => {
    body.innerHTML = '';
    // Darstellung
    const theme = S.state.settings.theme;
    const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Farbschema' });
    for (const [val, label, ic] of [['light', 'Hell', 'sun'], ['dark', 'Dunkel', 'moon'], ['system', 'System', 'monitor']]) {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': theme === val ? 'true' : 'false' }, iconEl(ic, 16), label);
      b.addEventListener('click', async () => {
        applyTheme(val);
        S.state.settings.theme = val;
        render();
        try { await api.put('/api/settings', { theme: val }); } catch (err) { toast(err.message, { error: true }); }
      });
      seg.append(b);
    }
    body.append(h('section', { class: 'settings-section' }, h('h3', {}, 'Darstellung'), seg));

    // KI-Anbieter
    const prov = h('section', { class: 'settings-section', id: 'set-anbieter' }, h('h3', {}, 'KI-Anbieter'));
    for (const p of S.state.providers) {
      const active = S.state.settings.provider === p.id;
      const card = h('div', { class: 'provider-card', role: 'radio', tabindex: '0', 'aria-checked': active ? 'true' : 'false' },
        h('span', { class: 'radio', 'aria-hidden': 'true' }),
        h('div', { class: 'pc-main' },
          h('div', { class: 'pc-name' }, p.id === 'claude' ? 'Claude Code CLI' : 'Antigravity CLI (agy)'),
          h('div', { class: 'pc-state' }, h('span', { class: 'status-dot', 'data-s': p.status }), h('span', {}, [p.label, p.version ? `Version ${p.version}` : '', p.status === 'verbunden' && p.model ? p.model : ''].filter(Boolean).join(' · '))),
          p.hint ? hintEl(p.hint) : (p.status === 'fehler' && p.detail ? h('div', { class: 'hint-box' }, p.detail) : null)));
      const choose = async () => { if (!active) { await chooseProvider(p.id); render(); } };
      card.addEventListener('click', (e) => { if (!e.target.closest('button')) choose(); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      const check = btn('Prüfen', { iconName: 'refresh', cls: 'btn btn-sm', size: 15, onClick: async () => { await checkProvider(p.id); render(); } });
      card.append(check);
      prov.append(card);
    }
    body.append(prov);

    // Facharbeit
    const p = S.state.project;
    const fa = h('section', { class: 'settings-section' }, h('h3', {}, 'Facharbeit'));
    if (p) fa.append(h('div', { class: 'kv' }, h('span', {}, 'Arbeitsraum'), h('code', {}, p.workspace)));
    const other = btn('Andere Facharbeit öffnen …', { cls: 'btn btn-soft btn-sm', iconName: 'folderOpen', size: 15 });
    other.addEventListener('click', async () => {
      const picked = await chooseFolder(p ? p.workspace : '');
      if (!picked) return;
      try {
        await api.post('/api/projects/open', { workspace: picked });
        await loadState();
        d.close();
        await enterApp();
        toast('Facharbeit geöffnet');
      } catch (err) {
        toast(err.status === 404 ? `${err.message} Lege dort eine neue Facharbeit an.` : err.message, { error: true });
      }
    });
    const fresh = btn('Neue Facharbeit anlegen', { cls: 'btn btn-soft btn-sm', iconName: 'plus', size: 15, onClick: () => { d.close(); showOnboarding({ fromSettings: true }); } });
    fa.append(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } }, other, fresh));
    body.append(fa);

    body.append(h('section', { class: 'settings-section' }, h('h3', {}, 'Über'),
      h('div', { class: 'kv' }, h('span', {}, 'Version'), h('span', {}, S.state.version), h('span', {}, 'App-Daten'), h('code', {}, S.state.dataDir))));
  };
  render();
  updateComposer();
  if (focusSection === 'anbieter') setTimeout(() => { const el = body.querySelector('#set-anbieter .provider-card[aria-checked="true"]'); if (el) el.focus(); });
}

function hintEl(hint) {
  const box = h('div', { class: 'hint-box' }, h('div', {}, hint.text));
  if (hint.befehl) box.append(h('div', { class: 'cmd-row' }, h('code', { class: 'cmd' }, hint.befehl), btn('Kopieren', { iconName: 'copy', cls: 'btn btn-sm', size: 15, onClick: () => copyText(hint.befehl) })));
  return box;
}
