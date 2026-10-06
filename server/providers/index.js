'use strict';
// Verwaltet die beiden KI-Anbieter: Erkennung, Verbindungsstatus und Durchläufe.
const claude = require('./claude');
const antigravity = require('./antigravity');

const MODULES = { claude, antigravity };

const STATUS_LABEL = {
  pruefe: 'Wird geprüft …',
  nicht_installiert: 'Nicht installiert',
  anmeldung_noetig: 'Anmeldung nötig',
  vertrauen_noetig: 'Ordnerfreigabe nötig',
  ungeprueft: 'Installiert, noch nicht geprüft',
  bereit: 'Angemeldet',
  verbunden: 'Verbunden',
  fehler: 'Verbindungsfehler',
};

class Providers {
  constructor() {
    this.state = {};
    this.pending = {};
    for (const [id, mod] of Object.entries(MODULES)) this.state[id] = { id, name: mod.NAME, status: 'pruefe' };
  }

  publicState() {
    return Object.values(this.state).map((s) => ({
      id: s.id, name: s.name, status: s.status, label: STATUS_LABEL[s.status] || s.status,
      detail: s.detail || '', hint: s.hint || null, version: s.version || '', model: s.model || '',
      models: s.models || [], modelWahl: !!(s.caps ? s.caps.model : s.id === 'claude'),
      checkedAt: s.checkedAt || null, usable: this.usable(s.id),
    }));
  }

  usable(id) {
    const s = this.state[id];
    return !!s && s.installed && ['bereit', 'verbunden', 'ungeprueft', 'fehler'].includes(s.status) && !!s.bin;
  }

  // Erkennt Installation und (soweit ohne Anfrage möglich) die Anmeldung.
  async detect(id) {
    if (this.pending[id]) return this.pending[id];
    const mod = MODULES[id];
    this.state[id] = { ...this.state[id], status: 'pruefe' };
    this.pending[id] = (async () => {
      try {
        const info = await mod.detect();
        this.state[id] = { ...this.state[id], ...info, hint: info.hint || null, checkedAt: new Date().toISOString() };
      } catch (err) {
        this.state[id] = { ...this.state[id], status: 'fehler', detail: err.message, checkedAt: new Date().toISOString() };
      } finally {
        delete this.pending[id];
      }
      return this.state[id];
    })();
    return this.pending[id];
  }

  // Für Antigravity: echter Testaufruf, da es keinen Statusbefehl gibt.
  async verify(id, cwd) {
    await this.detect(id);
    const s = this.state[id];
    if (!s.installed || id !== 'antigravity') return s;
    this.state[id] = { ...s, status: 'pruefe' };
    try {
      const r = await antigravity.verify(s, cwd);
      this.state[id] = { ...s, ...r, hint: r.hint || null, checkedAt: new Date().toISOString() };
    } catch (err) {
      this.state[id] = { ...s, status: 'fehler', detail: err.message };
    }
    return this.state[id];
  }

  async detectAll(activeId, cwd) {
    await Promise.all(Object.keys(MODULES).map((id) => this.detect(id)));
    if (activeId === 'antigravity' && this.state.antigravity.installed) await this.verify('antigravity', cwd);
  }

  run(id, opts) {
    const s = this.state[id];
    return MODULES[id].run(s, opts);
  }

  // Nach einem Durchlauf den Status anhand des Ergebnisses aktualisieren.
  noteResult(id, res, cwd) {
    const s = this.state[id];
    if (!s) return;
    if (!res.error) {
      this.state[id] = { ...s, status: 'verbunden', detail: 'Verbunden', hint: null, model: res.model || s.model };
      return;
    }
    const mod = MODULES[id];
    if (res.errorKind === 'anmeldung') this.state[id] = { ...s, status: 'anmeldung_noetig', detail: 'Anmeldung nötig', hint: mod.loginHint() };
    else if (res.errorKind === 'vertrauen' && mod.trustHint) this.state[id] = { ...s, status: 'vertrauen_noetig', detail: 'Ordnerfreigabe nötig', hint: mod.trustHint(cwd) };
    else if (['netz', 'allgemein', 'version'].includes(res.errorKind)) this.state[id] = { ...s, status: 'fehler', detail: String(res.error).slice(0, 300) };
  }
}

module.exports = { Providers, STATUS_LABEL, MODULES };
