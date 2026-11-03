// Einstellungen: Darstellung, KI-Anbieter, Facharbeit.
import { api } from './api.js';
import { h, iconEl, btn, toast, dialog, copyText } from './ui.js';
import { S, checkUpdate, openUpdateDialog, applyTheme, chooseProvider, checkProvider, updateComposer, loadState, enterApp } from './app.js';
import { showOnboarding, chooseFolder } from './onboarding.js';
import { openModelDialog, selectedModel, selectedModelLabel, gruendlichkeitEl } from './modelle.js';
import { modelLabel } from './modelname.js';
import { schluesselFormular, schluesselEntfernen } from './schluessel.js';

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
          h('div', { class: 'pc-name' }, { claude: 'Claude Code CLI', antigravity: 'Antigravity CLI (agy)', deepseek: 'DeepSeek (API-Schlüssel)' }[p.id] || p.name),
          h('div', { class: 'pc-state' }, h('span', { class: 'status-dot', 'data-s': p.status }), h('span', {}, [p.label, p.version ? `Version ${p.version}` : '', p.status === 'verbunden' && p.model ? `zuletzt ${modelLabel(p.model, p.models)}` : ''].filter(Boolean).join(' · '))),
          p.hint && p.hint.aktion === 'schluessel' ? h('div', { class: 'hint-box' }, h('div', {}, p.hint.text), schluesselFormular({ kompakt: true, onFertig: (r) => { Object.assign(S.state, { settings: r.settings, providers: r.providers }); updateComposer(); render(); } }))
            : p.hint ? hintEl(p.hint) : (p.status === 'fehler' && p.detail ? h('div', { class: 'hint-box' }, p.detail) : null),
          p.api && !p.hint ? h('div', { class: 'pc-model' }, h('span', {}, 'Schlüssel:'),
            btn('Neu eingeben', { cls: 'btn btn-sm', onClick: () => { const f = h('div', { class: 'hint-box' }, schluesselFormular({ kompakt: true, onFertig: (r) => { Object.assign(S.state, { settings: r.settings, providers: r.providers }); updateComposer(); render(); } })); card.querySelector('.pc-main').append(f); } }),
            btn('Entfernen', { cls: 'btn btn-sm', onClick: async () => { try { const r = await schluesselEntfernen(); Object.assign(S.state, { settings: r.settings, providers: r.providers }); updateComposer(); render(); toast('Schlüssel entfernt.'); } catch (err) { toast(err.message, { error: true }); } } })) : null,
          p.modelWahl !== false ? h('div', { class: 'pc-model' },
            h('span', {}, 'Modell:'), h('b', { title: selectedModel(p.id) || 'Voreinstellung der CLI' }, selectedModelLabel(p.id)),
            btn('Ändern', { cls: 'btn btn-sm', attrs: { 'aria-label': `Modell für ${p.name} ändern` }, onClick: () => openModelDialog(p.id, { onClose: render }) })) : null));
      const choose = async () => { if (!active) { await chooseProvider(p.id); render(); } };
      card.addEventListener('click', (e) => { if (!e.target.closest('button')) choose(); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      const check = btn('Prüfen', { iconName: 'refresh', cls: 'btn btn-sm', size: 15, onClick: async () => { await checkProvider(p.id); render(); } });
      card.append(check);
      prov.append(card);
    }
    body.append(prov);
    body.append(h('section', { class: 'settings-section' }, h('h3', {}, 'Gründlichkeit des Assistenten'), gruendlichkeitEl()));

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

    const pruef = S.state.settings.updatePruefen !== false;
    const cb = h('input', { type: 'checkbox', id: 'set-update', checked: pruef || null });
    cb.addEventListener('change', async () => {
      S.state.settings.updatePruefen = cb.checked;
      try { await api.put('/api/settings', { updatePruefen: cb.checked }); } catch (err) { toast(err.message, { error: true }); }
      if (cb.checked) checkUpdate(); else { S.update = null; checkUpdate(); }
    });
    const jetzt = btn('Jetzt suchen', { iconName: 'refresh', cls: 'btn btn-sm', size: 15, onClick: async () => {
      const u = await checkUpdate({ force: true });
      if (u && u.neu) { d.close(); openUpdateDialog(); } else toast(u && u.fehler ? `Suche nicht möglich: ${u.fehler}` : 'Du hast die neueste Version.');
    } });
    body.append(h('section', { class: 'settings-section' }, h('h3', {}, 'Updates'),
      h('label', { class: 'check-row', for: 'set-update' }, cb, h('span', {}, 'Beim Start nach einer neuen Version suchen')), h('div', { style: { marginTop: '8px' } }, jetzt)));

    body.append(h('section', { class: 'settings-section' }, h('h3', {}, 'Über'),
      h('div', { class: 'kv' }, h('span', {}, 'Version'), h('span', {}, S.state.version), h('span', {}, 'App-Daten'), h('code', {}, S.state.dataDir))));
  };
  render();
  updateComposer();
  if (focusSection === 'anbieter') setTimeout(() => { const el = body.querySelector('#set-anbieter .provider-card[aria-checked="true"]'); if (el) el.focus(); });
}

function hintEl(hint) {
  const box = h('div', { class: 'hint-box' }, h('div', {}, hint.text));
  if (hint.link) box.append(h('a', { class: 'link-btn', href: hint.link, target: '_blank', rel: 'noopener noreferrer' }, 'Installationsanleitung öffnen'));
  if (hint.befehl) box.append(h('div', { class: 'cmd-row' }, h('code', { class: 'cmd' }, hint.befehl), btn('Kopieren', { iconName: 'copy', cls: 'btn btn-sm', size: 15, onClick: () => copyText(hint.befehl) })));
  return box;
}
