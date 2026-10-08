#!/usr/bin/env node
'use strict';
// Mango Facharbeit – lokaler Server. Läuft nur auf 127.0.0.1 und liefert die Oberfläche aus.
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { fsp, path, exists, resolveInside, humanSize } = require('./util');
const { AppStore, Project } = require('./store');
const { Providers } = require('./providers');
const { bestGeminiModel } = require('./providers/models');
const { RunManager } = require('./runs');
const ws = require('./workspace');
const ctx = require('./context');
const exporter = require('./export');
const importer = require('./importer');
const system = require('./system');
const { STATUS_INFO, PHASEN } = require('./aufgaben');
const { kindLabel } = require('./extract');

const PKG = require('../package.json');
const PUBLIC = path.join(__dirname, '..', 'public');
const IS_MAIN = require.main === module;
const args = IS_MAIN ? process.argv.slice(2) : [];
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
if (argValue('--data-dir')) process.env.MANGO_DATA_DIR = argValue('--data-dir');

const TOKEN = crypto.randomBytes(24).toString('hex');
const app = new AppStore();
const providers = new Providers();
let project = null;
let projectError = null;
const runs = new RunManager({
  providers,
  settings: () => app.settings,
  bereit: async () => { await (pruefung || Promise.resolve()).catch(() => {}); await providers.idle(); },
  // Abgelehntes Modell aus der automatischen Wahl nehmen; danach gilt die Voreinstellung der CLI.
  modellAbgelehnt: (anbieter, id) => app.updateSettings({ modelle: { [anbieter]: '' }, modellAbgelehnt: { [anbieter]: id } }, { auto: true }),
});

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}

const arbeitsordner = () => (project ? project.workspace : os.tmpdir());

// Automatische Wahl nach jeder Erkennung: Claude Code mit der neuesten Sonnet-Version, wenn es
// bereit ist, sonst Antigravity mit dem besten Gemini-Modell aus „agy models“. Was die Person
// selbst gewählt hat, bleibt – außer der gewählte Anbieter ist gar nicht installiert.
async function autoSelect() {
  const s = app.settings;
  const st = providers.state;
  const installiert = (id) => !!(st[id] && st[id].installed);
  let ziel = s.provider;
  if (!s.anbieterGewaehlt) {
    if (installiert('claude') && ['bereit', 'verbunden'].includes(st.claude.status)) ziel = 'claude';
    else if (installiert('antigravity')) ziel = 'antigravity';
    else if (installiert('claude')) ziel = 'claude';
  } else if (!installiert(ziel)) {
    const anderer = ziel === 'claude' ? 'antigravity' : 'claude';
    if (installiert(anderer)) ziel = anderer;
  }
  const patch = {};
  if (ziel !== s.provider) patch.provider = ziel;
  if (installiert('antigravity') && !(s.modellGewaehlt || {}).antigravity && !(s.modellAbgelehnt || {}).antigravity) {
    const best = bestGeminiModel(st.antigravity.models);
    if (best && best !== s.modelle.antigravity) patch.modelle = { antigravity: best };
  }
  if (Object.keys(patch).length) await app.updateSettings(patch, { auto: true });
  if (ziel === 'antigravity' && installiert('antigravity') && st.antigravity.status === 'ungeprueft') {
    await providers.verify('antigravity', arbeitsordner());
  }
}

// Erkennung beider Anbieter mit anschließender Auswahl. Läuft beim Start und auf Wunsch erneut.
let pruefung = null;
function pruefeAnbieter() {
  if (!pruefung) {
    pruefung = providers.detectAll(null)
      .then(autoSelect)
      .finally(() => { pruefung = null; });
  }
  return pruefung;
}

function requireProject() {
  if (!project) throw new HttpError(409, 'Es ist noch keine Facharbeit eingerichtet.');
  return project;
}

// ---------- Nutzdaten ----------

function projectPayload(p) {
  if (!p) return null;
  return {
    id: p.id,
    workspace: p.workspace,
    angaben: p.data.angaben,
    merken: p.data.merken,
    uebernahme: p.data.uebernahme || null,
    createdAt: p.data.createdAt,
    aufgaben: p.aufgaben(),
    fristen: ctx.naechsteFristen(p).map((f) => ({ id: f.id, titel: f.titel, frist: f.frist, text: ctx.fristText(f.frist) })),
  };
}

async function statePayload() {
  return {
    version: PKG.version,
    platform: process.platform,
    settings: app.settings,
    hasProjects: app.data.projects.length > 0,
    project: projectPayload(project),
    projectError,
    chats: project ? project.chatList() : [],
    running: runs.runningChats(),
    providers: providers.publicState(),
    pruefung: !!pruefung,
    meta: { status: STATUS_INFO, phasen: PHASEN },
    antigravityApp: system.antigravityAppAvailable(),
    dataDir: app.dir,
  };
}

async function openProjectAt(workspace) {
  project = await Project.open(workspace);
  projectError = null;
  await app.registerProject(project.id, project.workspace);
  return project;
}

// ---------- HTTP-Helfer ----------

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

async function readBody(req, limit = 12 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Anfrage ist zu groß.');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Ungültige Anfrage.');
  }
}

function ndjson(res) {
  let started = false;
  let ended = false;
  const start = () => {
    if (started) return;
    started = true;
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  };
  const send = (ev) => {
    if (ended) return;
    if (ev === null) { if (started) { ended = true; res.end(); } return; }
    start();
    res.write(`${JSON.stringify(ev)}\n`);
  };
  return { send, isStarted: () => started, start };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
};

async function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const abs = resolveInside(PUBLIC, rel);
  if (!abs) return sendJson(res, 404, { error: 'Nicht gefunden' });
  let data;
  try {
    data = await fsp.readFile(abs);
  } catch {
    // Unbekannte Pfade: Oberfläche ausliefern.
    rel = 'index.html';
    data = await fsp.readFile(path.join(PUBLIC, 'index.html'));
  }
  const ext = path.extname(rel).toLowerCase();
  if (ext === '.html') data = Buffer.from(data.toString('utf8').replace('__MANGO_TOKEN__', TOKEN));
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.woff2' ? 'max-age=31536000' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
  });
  res.end(data);
}

// ---------- Routen ----------

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

route('GET', /^\/api\/state$/, async () => statePayload());

route('GET', /^\/api\/suggest-workspace$/, async (req, url) => ({ path: await ws.suggestWorkspacePath(url.searchParams.get('titel') || '') }));

route('GET', /^\/api\/fs\/inspect$/, async (req, url) => {
  const p = url.searchParams.get('path') || '';
  if (!p || !path.isAbsolute(p)) return { valid: false, message: 'Bitte einen vollständigen Ordnerpfad angeben.' };
  const st = await fsp.stat(p).catch(() => null);
  if (!st) {
    const parent = await fsp.stat(path.dirname(p)).catch(() => null);
    return { valid: !!parent, exists: false, message: parent ? '' : 'Der übergeordnete Ordner existiert nicht.' };
  }
  if (!st.isDirectory()) return { valid: false, exists: true, message: 'Das ist eine Datei, kein Ordner.' };
  const entries = (await fsp.readdir(p).catch(() => [])).filter((n) => !n.startsWith('.'));
  return { valid: true, exists: true, isWorkspace: await ws.isWorkspace(p), fileCount: entries.length };
});

route('GET', /^\/api\/fs\/list$/, async (req, url) => {
  let p = url.searchParams.get('path') || ws.defaultWorkspaceParent();
  if (!path.isAbsolute(p)) p = os.homedir();
  const st = await fsp.stat(p).catch(() => null);
  if (!st || !st.isDirectory()) p = os.homedir();
  const entries = await fsp.readdir(p, { withFileTypes: true }).catch(() => []);
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$'))
    .map((e) => ({ name: e.name, path: path.join(p, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const roots = [{ name: 'Persönlicher Ordner', path: os.homedir() }, { name: 'Dokumente', path: ws.defaultWorkspaceParent() }];
  if (process.platform === 'win32') for (const d of ['C:\\', 'D:\\', 'E:\\']) if (await exists(d)) roots.push({ name: d, path: d });
  const parent = path.dirname(p);
  return { path: p, parent: parent !== p ? parent : null, dirs, roots };
});

route('POST', /^\/api\/pick-folder$/, async () => system.pickFolder());

route('POST', /^\/api\/setup$/, async (req) => {
  const body = await readBody(req);
  const workspace = String(body.workspace || '').trim();
  if (!workspace || !path.isAbsolute(workspace)) throw new HttpError(400, 'Bitte einen vollständigen Speicherort angeben.');
  const parent = await fsp.stat(path.dirname(workspace)).catch(() => null);
  if (!parent) throw new HttpError(400, 'Der übergeordnete Ordner existiert nicht.');
  try {
    project = await Project.create(workspace, body.angaben || {});
  } catch (err) {
    throw new HttpError(500, `Der Arbeitsraum konnte nicht angelegt werden: ${err.message}`);
  }
  projectError = null;
  await app.registerProject(project.id, project.workspace);
  if (!project.chats.size) await project.createChat();
  return statePayload();
});

route('POST', /^\/api\/projects\/open$/, async (req) => {
  const body = await readBody(req);
  const workspace = String(body.workspace || '').trim();
  if (!(await ws.isWorkspace(workspace))) throw new HttpError(404, 'In diesem Ordner liegt noch keine Facharbeit.');
  await openProjectAt(workspace);
  return statePayload();
});

route('POST', /^\/api\/projects\/close$/, async () => {
  project = null;
  projectError = null;
  return statePayload();
});

route('PUT', /^\/api\/project$/, async (req) => {
  const p = requireProject();
  const body = await readBody(req);
  await p.updateAngaben(body.angaben || {});
  return projectPayload(p);
});

route('DELETE', /^\/api\/project\/merken\/([\w-]+)$/, async (req, url, m) => {
  const p = requireProject();
  await p.removeMerken(m[1]);
  return projectPayload(p);
});

route('PATCH', /^\/api\/aufgaben\/([\w-]+)$/, async (req, url, m) => {
  const p = requireProject();
  const body = await readBody(req);
  await p.setStatus(m[1], body.status, { von: 'nutzer', notiz: body.notiz });
  return projectPayload(p);
});

route('PUT', /^\/api\/settings$/, async (req) => {
  const body = await readBody(req);
  const before = app.settings.provider;
  await app.updateSettings(body);
  if (body.provider && body.provider !== before) {
    const s = providers.state[body.provider];
    if (body.provider === 'antigravity' && s.installed && s.status === 'ungeprueft') {
      providers.verify('antigravity', arbeitsordner()).catch(() => {});
    }
  }
  return { settings: app.settings, providers: providers.publicState() };
});

route('GET', /^\/api\/settings$/, async () => ({ settings: app.settings, providers: providers.publicState(), pruefung: !!pruefung }));

route('GET', /^\/api\/providers$/, async () => providers.publicState());

// Beide Anbieter neu erkennen (z. B. nach der Installation) und automatisch auswählen.
route('POST', /^\/api\/providers\/pruefen$/, async () => {
  await pruefeAnbieter();
  return { settings: app.settings, providers: providers.publicState(), pruefung: false };
});

route('POST', /^\/api\/providers\/(claude|antigravity)\/check$/, async (req, url, m) => {
  if (m[1] === 'antigravity') await providers.verify('antigravity', arbeitsordner());
  else await providers.detect('claude');
  await autoSelect();
  return providers.publicState();
});

route('GET', /^\/api\/chats$/, async () => requireProject().chatList());

route('POST', /^\/api\/chats$/, async () => {
  const p = requireProject();
  // Leere Chats wiederverwenden statt neue anzulegen.
  const empty = [...p.chats.values()].find((c) => !c.messages.length);
  const chat = empty || await p.createChat();
  return { id: chat.id, title: chat.title, createdAt: chat.createdAt, updatedAt: chat.updatedAt, count: 0 };
});

route('GET', /^\/api\/chats\/([\w-]+)$/, async (req, url, m) => {
  const chat = requireProject().getChat(m[1]);
  return { ...chat, messages: chat.messages.map(({ gesendet, ...rest }) => rest), running: runs.isRunning(chat.id) };
});

route('PATCH', /^\/api\/chats\/([\w-]+)$/, async (req, url, m) => {
  const body = await readBody(req);
  const chat = await requireProject().renameChat(m[1], body.title);
  return { id: chat.id, title: chat.title };
});

route('DELETE', /^\/api\/chats\/([\w-]+)$/, async (req, url, m) => {
  if (runs.isRunning(m[1])) runs.stop(m[1]);
  await requireProject().deleteChat(m[1]);
  return { ok: true };
});

route('POST', /^\/api\/chats\/([\w-]+)\/stop$/, async (req, url, m) => ({ stopped: runs.stop(m[1]) }));

route('GET', /^\/api\/chats\/([\w-]+)\/export$/, async (req, url, m, res) => {
  const p = requireProject();
  const chat = p.getChat(m[1]);
  const md = ctx.chatToMarkdown(chat, { project: p });
  const name = `${chat.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
  res.writeHead(200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="chat.md"; filename*=UTF-8''${encodeURIComponent(name)}`,
  });
  res.end(md);
  return undefined;
});

route('POST', /^\/api\/chats\/([\w-]+)\/messages$/, async (req, url, m, res) => {
  const p = requireProject();
  const body = await readBody(req);
  const stream = ndjson(res);
  let closed = false;
  res.on('close', () => { closed = true; });
  try {
    await runs.start(p, m[1], { text: body.text, attachments: body.attachments, importId: body.importId }, (ev) => { if (!closed) stream.send(ev); });
  } catch (err) {
    if (stream.isStarted()) { stream.send({ type: 'error', message: err.message }); stream.send(null); return undefined; }
    throw err;
  }
  return undefined;
});

route('GET', /^\/api\/chats\/([\w-]+)\/stream$/, async (req, url, m, res) => {
  requireProject();
  const stream = ndjson(res);
  const unsubscribe = runs.subscribe(m[1], (ev) => stream.send(ev));
  if (!unsubscribe) throw new HttpError(404, 'Keine laufende Antwort.');
  req.on('close', unsubscribe);
  return undefined;
});

route('POST', /^\/api\/uploads$/, async (req) => {
  const p = requireProject();
  const name = decodeURIComponent(String(req.headers['x-filename'] || 'datei'));
  const info = await ws.stageUpload(p.workspace, name, req);
  return { ...info, kindLabel: kindLabel(info.kind), sizeLabel: humanSize(info.size) };
});

// ---------- Übernahme einer bestehenden Arbeit ----------

function inventorySummary(inv) {
  const { dateien, ...rest } = inv;
  return { ...rest, kategorien: dateien.reduce((acc, d) => { if (d.vermutlich) acc[d.vermutlich.label] = (acc[d.vermutlich.label] || 0) + 1; return acc; }, {}) };
}

route('POST', /^\/api\/import$/, async () => importer.createImport(requireProject()));

route('POST', /^\/api\/import\/([\w-]+)\/dateien$/, async (req, url, m) => {
  const p = requireProject();
  const rel = decodeURIComponent(String(req.headers['x-relpath'] || req.headers['x-filename'] || 'datei'));
  return importer.addFile(p, m[1], rel, req, { lastModified: req.headers['x-last-modified'] });
});

route('POST', /^\/api\/import\/([\w-]+)\/analyse$/, async (req, url, m, res) => {
  const p = requireProject();
  await importer.loadStatus(p, m[1]);
  const body = await readBody(req);
  const stream = ndjson(res);
  let last = 0;
  const inv = await importer.analyse(p, m[1], (ev) => {
    const now = Date.now();
    if (ev.phase !== 'fertig' && now - last < 120 && ev.aktuell !== ev.gesamt) return;
    last = now;
    stream.send({ type: 'fortschritt', ...ev });
  }, { fehlgeschlagen: body.fehlgeschlagen });
  stream.send({ type: 'fertig', inventar: inventorySummary(inv) });
  stream.send(null);
  return undefined;
});

route('GET', /^\/api\/import\/([\w-]+)$/, async (req, url, m) => {
  const inv = await importer.loadInventory(requireProject(), m[1]);
  if (!inv) throw new HttpError(404, 'Unbekannte Übernahme');
  return inventorySummary(inv);
});

route('POST', /^\/api\/uebernahme\/fassung$/, async (req) => {
  const p = requireProject();
  const body = await readBody(req);
  await importer.chooseVersion(p, body.dateien, String(body.gewaehlt || ''));
  return projectPayload(p);
});

route('DELETE', /^\/api\/uploads\/([\w-]+)$/, async (req, url, m) => {
  await ws.discardStaged(requireProject().workspace, m[1]);
  return { ok: true };
});

route('GET', /^\/api\/files$/, async () => {
  const p = requireProject();
  const files = await ws.listFiles(p.workspace);
  return files.map((f) => ({ ...f, kindLabel: kindLabel(f.kind), sizeLabel: humanSize(f.size) }));
});

route('GET', /^\/api\/files\/info$/, async (req, url) => {
  const p = requireProject();
  const rel = url.searchParams.get('path') || '';
  const abs = resolveInside(p.workspace, rel);
  const st = abs ? await fsp.stat(abs).catch(() => null) : null;
  const info = st ? await ws.ensureExtract(p.workspace, rel) : { lesbar: 'nein', hinweis: 'Datei fehlt', kind: 'andere' };
  return { path: rel, exists: !!st, size: st ? st.size : 0, ...info, kindLabel: kindLabel(info.kind), versions: await ws.listVersions(p.workspace, rel) };
});

route('GET', /^\/api\/files\/raw$/, async (req, url, m, res) => {
  const p = requireProject();
  const rel = url.searchParams.get('path') || '';
  const abs = resolveInside(p.workspace, rel);
  const st = abs ? await fsp.stat(abs).catch(() => null) : null;
  if (!st || !st.isFile()) throw new HttpError(404, 'Datei nicht gefunden. Sie wurde eventuell verschoben oder gelöscht.');
  const ext = path.extname(abs).toLowerCase();
  const name = path.basename(abs);
  const inline = url.searchParams.get('download') !== '1' && ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.md', '.csv'].includes(ext);
  res.writeHead(200, {
    'Content-Type': (ext === '.md' ? 'text/plain; charset=utf-8' : MIME[ext]) || 'application/octet-stream',
    'Content-Length': st.size,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="datei${ext}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  });
  require('fs').createReadStream(abs).pipe(res);
  return undefined;
});

route('POST', /^\/api\/files\/open$/, async (req) => {
  const p = requireProject();
  const body = await readBody(req);
  const abs = resolveInside(p.workspace, body.path || '');
  if (!abs || !(await exists(abs))) throw new HttpError(404, 'Datei nicht gefunden. Sie wurde eventuell verschoben oder gelöscht.');
  const ok = body.reveal ? await system.revealPath(abs) : await system.openPath(abs);
  if (!ok) throw new HttpError(501, 'Auf diesem System kann die Datei nicht direkt geöffnet werden.');
  return { ok: true };
});

route('POST', /^\/api\/files\/restore$/, async (req) => {
  const p = requireProject();
  const body = await readBody(req);
  return { path: await ws.restoreVersionAsCopy(p.workspace, body.path, body.version) };
});

route('POST', /^\/api\/workspace\/open$/, async (req) => {
  const p = requireProject();
  const body = await readBody(req);
  if (!(await exists(p.workspace))) throw new HttpError(404, 'Der Arbeitsraum-Ordner wurde nicht gefunden.');
  const ok = body.app === 'antigravity' ? await system.openInAntigravity(p.workspace) : await system.openPath(p.workspace);
  if (!ok) throw new HttpError(501, 'Der Ordner konnte nicht geöffnet werden.');
  return { ok: true };
});

route('POST', /^\/api\/export\/transcripts$/, async () => exporter.exportTranscripts(requireProject()));
route('POST', /^\/api\/export\/docx$/, async (req) => {
  const body = await readBody(req);
  return exporter.exportMarkdownAsDocx(requireProject(), body.path || '');
});
route('POST', /^\/api\/export\/facharbeit$/, async () => exporter.exportFacharbeit(requireProject()));
route('GET', /^\/api\/export\/backup$/, async (req, url, m, res) => {
  const p = requireProject();
  const buf = await exporter.backupZip(p);
  const name = `Sicherung_${path.basename(p.workspace)}_${new Date().toISOString().slice(0, 10)}.zip`;
  res.writeHead(200, {
    'Content-Type': 'application/zip', 'Content-Length': buf.length,
    'Content-Disposition': `attachment; filename="sicherung.zip"; filename*=UTF-8''${encodeURIComponent(name)}`,
  });
  res.end(buf);
  return undefined;
});

// ---------- Server ----------

function checkRequest(req, url, port) {
  const host = String(req.headers.host || '');
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return 'Ungültiger Host';
  const origin = req.headers.origin;
  if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) return 'Ungültiger Ursprung';
  if (url.pathname.startsWith('/api/')) {
    const token = req.headers['x-mango-token'] || url.searchParams.get('t');
    if (token !== TOKEN) return 'Sitzung abgelaufen – bitte die Seite neu laden.';
  }
  return null;
}

function createServer(portRef) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const problem = checkRequest(req, url, portRef.port);
    if (problem) return sendJson(res, 403, { error: problem });
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Nicht erlaubt' });
      return serveStatic(req, res, url.pathname).catch((err) => sendJson(res, 500, { error: err.message }));
    }
    const r = routes.find((x) => x.method === req.method && x.pattern.test(url.pathname));
    if (!r) return sendJson(res, 404, { error: 'Nicht gefunden' });
    try {
      const result = await r.handler(req, url, url.pathname.match(r.pattern), res);
      if (result !== undefined && !res.headersSent) sendJson(res, 200, result);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500 && status !== 501) console.error(err);
      if (!res.headersSent) sendJson(res, status, { error: err.message, hint: err.hint || null, code: err.code || null });
      else res.end();
    }
  });
}

async function listen(server, start) {
  for (let port = start; port < start + 20; port++) {
    const ok = await new Promise((resolve, reject) => {
      const onError = (err) => (err.code === 'EADDRINUSE' ? resolve(false) : reject(err));
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => { server.off('error', onError); resolve(true); });
    });
    if (ok) return port;
  }
  throw new Error('Kein freier Port gefunden.');
}

// Startet den Server. Wird direkt (node server/index.js) oder von der Desktop-App aufgerufen.
// host: optionale Betriebssystem-Funktionen der Desktop-App (Ordnerdialog, Dateien öffnen).
async function start({ port, open = false, host = null, log = console.log } = {}) {
  if (host) system.setHost(host);
  await app.load();
  const last = app.data.projects.find((p) => p.id === app.data.lastProjectId) || app.data.projects[0];
  if (last) {
    try {
      await openProjectAt(last.workspace);
    } catch (err) {
      project = null;
      projectError = { workspace: last.workspace, message: (await exists(last.workspace)) ? `Der Arbeitsraum konnte nicht geöffnet werden: ${err.message}` : 'Der Arbeitsraum-Ordner wurde nicht gefunden. Wurde er verschoben oder umbenannt?' };
    }
  }
  const portRef = { port: 0 };
  const server = createServer(portRef);
  portRef.port = await listen(server, Number(port || process.env.PORT || 4317));
  const url = `http://127.0.0.1:${portRef.port}/`;
  log(`Mango Facharbeit läuft: ${url}`);
  log(`App-Daten: ${app.dir}`);
  if (project) log(`Arbeitsraum: ${project.workspace}`);
  pruefeAnbieter()
    .then(() => log(`Anbieter: ${providers.publicState().map((p) => `${p.name}: ${p.label}`).join(' · ')} – aktiv: ${app.settings.provider}${app.settings.modelle[app.settings.provider] ? ` (${app.settings.modelle[app.settings.provider]})` : ''}`))
    .catch((err) => console.error('Anbietererkennung fehlgeschlagen:', err.message));
  if (open) system.openAppWindow(url);
  const shutdown = () => {
    for (const id of runs.runningChats()) runs.stop(id);
    server.close();
  };
  return { url, port: portRef.port, token: TOKEN, settings: () => app.settings, running: () => runs.runningChats().length > 0, shutdown };
}

if (IS_MAIN) {
  start({ port: argValue('--port'), open: !args.includes('--no-open') && !process.env.MANGO_NO_OPEN })
    .then(({ shutdown }) => {
      const stop = () => { shutdown(); setTimeout(() => process.exit(0), 300); };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    })
    .catch((err) => {
      console.error('Start fehlgeschlagen:', err);
      process.exit(1);
    });
}

module.exports = { start };
