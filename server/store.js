'use strict';
// Dauerhafte Speicherung: App-Einstellungen im Benutzerprofil, Projektdaten
// (Angaben, Arbeitsstand, Chats) im Arbeitsraum unter .facharbeit/.
const os = require('os');
const {
  fsp, path, ensureDir, readJson, writeJsonAtomic, newId, nowIso, truncate, writeTextAtomic,
} = require('./util');
const { AUFGABEN, AUFGABEN_BY_ID, STATUS } = require('./aufgaben');
const ws = require('./workspace');

function appDataDir() {
  if (process.env.MANGO_DATA_DIR) return path.resolve(process.env.MANGO_DATA_DIR);
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Mango-Facharbeit');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Mango-Facharbeit');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'mango-facharbeit');
}

const ANGABEN_FELDER = ['name', 'klasse', 'titel', 'fach', 'bezugsfach', 'fachrichtung', 'lehrkraft', 'abgabedatum', 'forschungsfrage', 'methode'];

function cleanAngaben(input, base = {}) {
  const out = { ...base };
  for (const key of ANGABEN_FELDER) {
    if (input && Object.prototype.hasOwnProperty.call(input, key)) {
      let v = input[key] == null ? '' : String(input[key]).trim();
      v = truncate(v.replace(/\s+/g, ' '), key === 'forschungsfrage' || key === 'methode' ? 600 : 200);
      if (key === 'abgabedatum' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
      out[key] = v;
    }
  }
  for (const key of ANGABEN_FELDER) if (out[key] === undefined) out[key] = '';
  return out;
}

class AppStore {
  constructor() {
    this.dir = appDataDir();
    this.file = path.join(this.dir, 'app.json');
    this.data = null;
  }

  async load() {
    await ensureDir(this.dir);
    this.data = await readJson(this.file, null);
    if (!this.data) this.data = { version: 1, settings: {}, projects: [], lastProjectId: null };
    this.data.settings = { theme: 'system', provider: 'claude', ...this.data.settings };
    this.data.projects = Array.isArray(this.data.projects) ? this.data.projects : [];
    return this.data;
  }

  async save() {
    await writeJsonAtomic(this.file, this.data);
  }

  get settings() {
    return this.data.settings;
  }

  async updateSettings(patch) {
    if (patch.theme && ['light', 'dark', 'system'].includes(patch.theme)) this.data.settings.theme = patch.theme;
    if (patch.provider && ['claude', 'antigravity'].includes(patch.provider)) this.data.settings.provider = patch.provider;
    await this.save();
    return this.data.settings;
  }

  async registerProject(id, workspace) {
    const existing = this.data.projects.find((p) => p.id === id || path.resolve(p.workspace) === path.resolve(workspace));
    if (existing) { existing.id = id; existing.workspace = workspace; existing.lastOpened = nowIso(); }
    else this.data.projects.push({ id, workspace, lastOpened: nowIso() });
    this.data.lastProjectId = id;
    await this.save();
  }

  async forgetProject(id) {
    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    if (this.data.lastProjectId === id) this.data.lastProjectId = this.data.projects[0]?.id || null;
    await this.save();
  }
}

class Project {
  constructor(workspace) {
    this.workspace = path.resolve(workspace);
    this.dir = ws.internalDir(this.workspace);
    this.data = null; // projekt.json
    this.stand = null; // arbeitsstand.json
    this.chats = new Map(); // id -> chat (vollständig geladen)
  }

  get id() {
    return this.data.id;
  }

  static async create(workspace, angaben) {
    const p = new Project(workspace);
    await ws.setupWorkspace(p.workspace);
    const existing = await readJson(path.join(p.dir, 'projekt.json'), null);
    p.data = existing || { id: newId(), version: 1, createdAt: nowIso(), angaben: cleanAngaben({}), merken: [] };
    p.data.angaben = cleanAngaben(angaben, existing ? existing.angaben : {});
    p.data.updatedAt = nowIso();
    p.stand = await readJson(path.join(p.dir, 'arbeitsstand.json'), { aufgaben: {} });
    await p.saveProject();
    await p.saveStand();
    await p.loadChats();
    return p;
  }

  static async open(workspace) {
    const p = new Project(workspace);
    p.data = await readJson(path.join(p.dir, 'projekt.json'), null);
    if (!p.data) throw Object.assign(new Error('Kein Arbeitsraum gefunden'), { status: 404 });
    p.data.angaben = cleanAngaben(p.data.angaben || {});
    p.data.merken = Array.isArray(p.data.merken) ? p.data.merken : [];
    p.stand = await readJson(path.join(p.dir, 'arbeitsstand.json'), { aufgaben: {} });
    await ws.setupWorkspace(p.workspace); // fehlende Vorlagen und verwaltete Dateien ergänzen
    await ws.cleanupStaging(p.workspace);
    await p.loadChats();
    await p.writeOverview();
    return p;
  }

  async saveProject() {
    this.data.updatedAt = nowIso();
    await writeJsonAtomic(path.join(this.dir, 'projekt.json'), this.data);
    await this.writeOverview();
  }

  async saveStand() {
    await writeJsonAtomic(path.join(this.dir, 'arbeitsstand.json'), this.stand);
    await this.writeOverview();
  }

  async updateAngaben(patch) {
    this.data.angaben = cleanAngaben(patch, this.data.angaben);
    await this.saveProject();
    return this.data.angaben;
  }

  // Aufgabenliste mit Definition und aktuellem Status.
  aufgaben() {
    return AUFGABEN.map((a) => {
      const s = this.stand.aufgaben[a.id] || {};
      const abgabe = a.id === 'abgabe' && this.data.angaben.abgabedatum;
      return {
        ...a,
        frist: abgabe ? `${this.data.angaben.abgabedatum}T16:00` : a.frist,
        status: STATUS.includes(s.status) ? s.status : 'offen',
        notiz: s.notiz || '',
        nachweis: s.nachweis || '',
        von: s.von || '',
        am: s.am || '',
      };
    });
  }

  async setStatus(id, status, { von = 'nutzer', notiz, nachweis } = {}) {
    if (!AUFGABEN_BY_ID.has(id)) throw Object.assign(new Error('Unbekannte Aufgabe'), { status: 400 });
    if (!STATUS.includes(status)) throw Object.assign(new Error('Ungültiger Status'), { status: 400 });
    const prev = this.stand.aufgaben[id] || {};
    this.stand.aufgaben[id] = {
      status,
      notiz: notiz !== undefined ? truncate(notiz, 400) : prev.notiz || '',
      nachweis: nachweis !== undefined ? truncate(nachweis, 400) : prev.nachweis || '',
      von,
      am: nowIso(),
    };
    await this.saveStand();
    return this.stand.aufgaben[id];
  }

  async addMerken(texte, quelle = 'assistent') {
    const added = [];
    for (const raw of texte) {
      const text = truncate(String(raw || '').trim().replace(/\s+/g, ' '), 300);
      if (!text) continue;
      if (this.data.merken.some((m) => m.text.toLowerCase() === text.toLowerCase())) continue;
      const entry = { id: newId(), text, am: nowIso(), quelle };
      this.data.merken.push(entry);
      added.push(entry);
    }
    if (this.data.merken.length > 60) this.data.merken = this.data.merken.slice(-60);
    if (added.length) await this.saveProject();
    return added;
  }

  async removeMerken(id) {
    this.data.merken = this.data.merken.filter((m) => m.id !== id);
    await this.saveProject();
  }

  // ---------- Chats ----------

  chatFile(id) {
    return path.join(this.dir, 'chats', `${id}.json`);
  }

  async loadChats() {
    this.chats.clear();
    const dir = path.join(this.dir, 'chats');
    await ensureDir(dir);
    for (const f of await fsp.readdir(dir)) {
      if (!/^[0-9a-f-]{36}\.json$/.test(f)) continue;
      const chat = await readJson(path.join(dir, f), null);
      if (!chat || !chat.id) continue;
      chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
      chat.sessions = chat.sessions || {};
      // Nach einem Absturz: laufende Antworten als unterbrochen markieren.
      let fixed = false;
      for (const m of chat.messages) {
        if (m.status === 'laeuft') { m.status = 'unterbrochen'; fixed = true; }
      }
      this.chats.set(chat.id, chat);
      if (fixed) await this.saveChat(chat);
    }
  }

  chatList() {
    return [...this.chats.values()]
      .map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, count: c.messages.length }))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  getChat(id) {
    const chat = this.chats.get(id);
    if (!chat) throw Object.assign(new Error('Chat nicht gefunden'), { status: 404 });
    return chat;
  }

  async createChat() {
    const chat = { id: newId(), title: 'Neuer Chat', titleAuto: true, createdAt: nowIso(), updatedAt: nowIso(), sessions: {}, messages: [] };
    this.chats.set(chat.id, chat);
    await this.saveChat(chat);
    return chat;
  }

  async saveChat(chat) {
    await writeJsonAtomic(this.chatFile(chat.id), chat);
  }

  async renameChat(id, title) {
    const chat = this.getChat(id);
    const t = truncate(String(title || '').trim().replace(/\s+/g, ' '), 80);
    if (!t) throw Object.assign(new Error('Titel darf nicht leer sein'), { status: 400 });
    chat.title = t;
    chat.titleAuto = false;
    await this.saveChat(chat);
    return chat;
  }

  async deleteChat(id) {
    this.getChat(id);
    this.chats.delete(id);
    await fsp.rm(this.chatFile(id), { force: true });
  }

  // ---------- Übersicht im Arbeitsraum ----------

  async writeOverview() {
    const { renderOverview } = require('./context');
    const file = path.join(this.workspace, 'FACHARBEIT.md');
    const current = await fsp.readFile(file, 'utf8').catch(() => null);
    if (current !== null && !current.includes(ws.MARKER)) return; // eigene Datei des Nutzers
    const text = renderOverview(this);
    if (current !== text) await writeTextAtomic(file, text);
  }
}

module.exports = { AppStore, Project, appDataDir, cleanAngaben, ANGABEN_FELDER };
