'use strict';
// Aktualisierung der Desktop-App: Mango fragt bei GitHub nach einer neueren Version, lädt die
// Setup-Datei auf Wunsch herunter, prüft die Prüfsumme und startet sie. Nur auf ausdrücklichen
// Klick der Person; geprüft wird nur der öffentliche Release-Eintrag des Projekts.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const { fsp, path, ensureDir } = require('./util');

const REPO = 'Spackle01/Mango-Facharbeit';
const TEST_API = process.env.MANGO_UPDATE_API || '';
const API = TEST_API || `https://api.github.com/repos/${REPO}/releases?per_page=10`;
const ERLAUBT = TEST_API ? new RegExp(`^${TEST_API.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/[^/]*$/, '/')}`) : new RegExp(`^https://github\\.com/${REPO}/releases/download/`);
const CACHE_MS = 30 * 60 * 1000;
const MAX_BYTES = 400 * 1024 * 1024;

// "0.2.8-beta" → { nums: [0,2,8], pre: 'beta' }
function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?/.exec(String(v || '').trim());
  return m ? { nums: [+m[1], +m[2], +m[3]], pre: m[4] || '' } : null;
}

// > 0: a ist neuer als b. Eine Fassung ohne Zusatz („1.0.0“) ist neuer als „1.0.0-beta“.
function vergleiche(a, b) {
  const x = parseVersion(a); const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i];
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

// Welche Datei einer Veröffentlichung zu diesem System passt: Windows-Setup oder Mac-Image (nach Prozessor).
function assetMuster(plattform, arch) {
  if (plattform === 'darwin') return new RegExp(`^Mango-Facharbeit-.*-Mac-${arch === 'arm64' ? 'arm64' : 'x64'}\\.dmg$`, 'i');
  return /^Mango-Facharbeit-Setup-.*\.exe$/i;
}

// Neueste Veröffentlichung mit passender Datei aus der Liste der Releases
function neuesteVersion(releases, { plattform = process.platform, arch = process.arch } = {}) {
  const muster = assetMuster(plattform, arch);
  let best = null;
  for (const r of Array.isArray(releases) ? releases : []) {
    if (!r || r.draft || !parseVersion(r.tag_name)) continue;
    const assets = Array.isArray(r.assets) ? r.assets : [];
    const exe = assets.find((a) => muster.test(a.name) && ERLAUBT.test(String(a.browser_download_url || '')));
    if (!exe) continue;
    if (best && vergleiche(r.tag_name, best.tag_name) <= 0) continue;
    const sha = assets.find((a) => a.name === `${exe.name}.sha256` && ERLAUBT.test(String(a.browser_download_url || '')));
    best = { tag_name: r.tag_name, r, exe, sha };
  }
  if (!best) return null;
  const notizen = String(best.r.body || '').split(/\n\s*\n/)[0].replace(/[#*`]/g, '').trim().slice(0, 400);
  return {
    version: best.tag_name.replace(/^v/, ''), tag: best.tag_name, seite: String(best.r.html_url || ''), notizen,
    groesse: best.exe.size || 0, url: best.exe.browser_download_url, shaUrl: best.sha ? best.sha.browser_download_url : '', name: best.exe.name,
  };
}

class Updater {
  constructor({ version, host = null, dir = path.join(os.tmpdir(), 'mango-update'), fetchFn = (...a) => fetch(...a) }) {
    this.version = version;
    this.host = host; // { kannAktualisieren, updateAnwenden(datei) }
    this.dir = dir;
    this.fetch = fetchFn;
    this.neu = null;
    this.geprueft = 0;
    this.fehler = '';
    this.status = { phase: 'bereit', prozent: 0, fehler: '' };
    this.laeuft = null;
  }

  oeffentlich() {
    return {
      aktuell: this.version,
      neu: this.neu,
      geprueft: this.geprueft,
      direkt: !!(this.host && this.host.kannAktualisieren),
      status: this.status,
      fehler: this.fehler,
    };
  }

  // Fragt GitHub nach neueren Versionen (höchstens alle 30 Minuten, außer mit force).
  async pruefen({ force = false } = {}) {
    if (!force && this.geprueft && Date.now() - this.geprueft < CACHE_MS) return this.oeffentlich();
    if (this.laeuft && this.status.phase !== 'bereit') return this.oeffentlich();
    try {
      const res = await this.fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Mango-Facharbeit' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}`);
      const neu = neuesteVersion(await res.json());
      this.neu = neu && vergleiche(neu.version, this.version) > 0 ? neu : null;
      this.fehler = '';
    } catch (err) {
      this.fehler = err && err.name === 'TimeoutError' ? 'Keine Antwort von GitHub' : String(err && err.message ? err.message : err);
    }
    this.geprueft = Date.now();
    return this.oeffentlich();
  }

  async laden(url, ziel, onProgress) {
    if (!ERLAUBT.test(url)) throw new Error('Unerlaubte Adresse');
    const res = await this.fetch(url, { headers: { 'User-Agent': 'Mango-Facharbeit' }, redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`Download fehlgeschlagen (${res.status})`);
    const total = Number(res.headers.get('content-length')) || 0;
    if (total > MAX_BYTES) throw new Error('Die Datei ist ungewöhnlich groß');
    await ensureDir(path.dirname(ziel));
    const hash = crypto.createHash('sha256');
    const out = fs.createWriteStream(ziel);
    let n = 0;
    try {
      for await (const chunk of res.body) {
        n += chunk.length;
        if (n > MAX_BYTES) throw new Error('Die Datei ist ungewöhnlich groß');
        hash.update(chunk);
        if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
        if (onProgress && total) onProgress(Math.min(99, Math.round((n / total) * 100)));
      }
      await new Promise((resolve, reject) => { out.end((e) => (e ? reject(e) : resolve())); });
    } catch (err) {
      out.destroy();
      await fsp.rm(ziel, { force: true }).catch(() => {});
      throw err;
    }
    return { sha256: hash.digest('hex'), bytes: n };
  }

  // Lädt das Setup, prüft die Prüfsumme und startet es. Läuft im Hintergrund; der Stand steht in status.
  starten({ laeuftArbeit = () => false } = {}) {
    if (!this.host || !this.host.kannAktualisieren) throw Object.assign(new Error('Das Update ist nur in der installierten Windows-App möglich. Lade die neue Version von der Release-Seite.'), { status: 409 });
    if (!this.neu) throw Object.assign(new Error('Es gibt kein neueres Update.'), { status: 409 });
    if (laeuftArbeit()) throw Object.assign(new Error('Der Assistent arbeitet gerade. Warte, bis die Antwort fertig ist.'), { status: 409 });
    if (this.laeuft) return this.oeffentlich();
    const neu = this.neu;
    this.status = { phase: 'laedt', prozent: 0, fehler: '' };
    this.laeuft = (async () => {
      const datei = path.join(this.dir, neu.name.replace(/[^\w.-]/g, '_'));
      try {
        const r = await this.laden(neu.url, datei, (p) => { this.status = { phase: 'laedt', prozent: p, fehler: '' }; });
        if (neu.shaUrl) {
          const t = await (await this.fetch(neu.shaUrl, { headers: { 'User-Agent': 'Mango-Facharbeit' } })).text();
          const soll = (/\b([0-9a-f]{64})\b/i.exec(t) || [])[1];
          if (!soll || soll.toLowerCase() !== r.sha256) throw new Error('Die Prüfsumme stimmt nicht. Die Datei wurde nicht installiert.');
        }
        this.status = { phase: 'startet', prozent: 100, fehler: '' };
        await this.host.updateAnwenden(datei);
      } catch (err) {
        await fsp.rm(datei, { force: true }).catch(() => {});
        this.status = { phase: 'fehler', prozent: 0, fehler: String(err && err.message ? err.message : err) };
        this.laeuft = null;
      }
    })();
    return this.oeffentlich();
  }

  zuruecksetzen() {
    if (this.status.phase === 'fehler') this.status = { phase: 'bereit', prozent: 0, fehler: '' };
  }
}

module.exports = { Updater, parseVersion, vergleiche, neuesteVersion, assetMuster, REPO };
