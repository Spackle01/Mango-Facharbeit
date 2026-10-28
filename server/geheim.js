'use strict';
// Speicher für Zugangsdaten (z. B. den DeepSeek-API-Schlüssel). Liegt getrennt von den
// Einstellungen, wird nie an die Oberfläche geschickt und in der Desktop-App mit dem
// Schlüsselbund des Systems verschlüsselt (Windows DPAPI, macOS Keychain), falls verfügbar.
const fs = require('fs');
const { fsp, path, ensureDir, writeJsonAtomic, readJson } = require('./util');

class Geheim {
  constructor(dir, host = null) {
    this.file = path.join(dir, 'zugang.json');
    this.host = host;
    this.cache = null;
  }

  async laden() {
    if (!this.cache) this.cache = await readJson(this.file, {});
    return this.cache;
  }

  sicher() {
    return !!(this.host && this.host.verschluesseln && this.host.verschluesselnMoeglich && this.host.verschluesselnMoeglich());
  }

  async get(name) {
    const e = (await this.laden())[name];
    if (!e || typeof e.v !== 'string') return '';
    try {
      if (e.art === 'sicher') return this.host && this.host.entschluesseln ? String(this.host.entschluesseln(e.v) || '') : '';
      return e.v;
    } catch { return ''; }
  }

  async set(name, wert) {
    const d = await this.laden();
    const klar = String(wert);
    d[name] = this.sicher() ? { art: 'sicher', v: this.host.verschluesseln(klar) } : { art: 'klar', v: klar };
    await ensureDir(path.dirname(this.file));
    await writeJsonAtomic(this.file, d);
    try { await fsp.chmod(this.file, 0o600); } catch { /* Windows */ }
  }

  async entfernen(name) {
    const d = await this.laden();
    delete d[name];
    await writeJsonAtomic(this.file, d);
  }

  // Letzte Zeichen zur Anzeige („…a1b2“), nie der ganze Wert
  async hinweis(name) {
    const k = await this.get(name);
    return k ? `…${k.slice(-4)}` : '';
  }
}

module.exports = { Geheim };
void fs;
