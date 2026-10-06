'use strict';
// Arbeitsraum einer Facharbeit: Ordnerstruktur, verwaltete Dateien (Regeln, Skills,
// Vorgaben), Dateiliste, Sicherung geänderter Dateien und Anhänge.
const os = require('os');
const {
  fsp, path, ensureDir, exists, toPosix, safeFileName, uniquePath, localDateStamp,
  fileTimeStamp, resolveInside, writeTextAtomic, isInside,
} = require('./util');
const extract = require('./extract');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'ressourcen');
const MARKER = 'mango-facharbeit:verwaltet';

const HIDDEN_DIRS = new Set(['.facharbeit', '.agents', '.claude', '.git', 'node_modules', '.gemini', '.vscode', '.idea']);
const HIDDEN_FILES = new Set(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'desktop.ini', 'Thumbs.db']);

function internalDir(ws) {
  return path.join(ws, '.facharbeit');
}

function defaultWorkspaceParent() {
  const home = os.homedir();
  for (const name of ['Dokumente', 'Documents']) {
    const p = path.join(home, name);
    try {
      if (require('fs').statSync(p).isDirectory()) return p;
    } catch { /* nicht vorhanden */ }
  }
  return home;
}

async function suggestWorkspacePath(titel) {
  const parent = defaultWorkspaceParent();
  const base = safeFileName(titel ? `Facharbeit – ${titel}`.slice(0, 80) : 'Facharbeit');
  let candidate = path.join(parent, base);
  let n = 2;
  // Vorhandene, nicht leere Ordner nicht vorschlagen (außer es ist bereits ein Arbeitsraum).
  while (await exists(candidate)) {
    const entries = await fsp.readdir(candidate).catch(() => []);
    if (entries.length === 0) break;
    candidate = path.join(parent, `${base} ${n}`);
    n += 1;
  }
  return candidate;
}

async function copyIfMissing(src, dest) {
  if (await exists(dest)) return false;
  await ensureDir(path.dirname(dest));
  await fsp.copyFile(src, dest);
  return true;
}

// Verwaltete Textdatei schreiben: nur wenn sie fehlt oder von der App stammt.
async function writeManaged(dest, content) {
  if (await exists(dest)) {
    const current = await fsp.readFile(dest, 'utf8').catch(() => '');
    if (!current.includes(MARKER)) return false; // Datei des Nutzers – nicht anfassen
    if (current === content) return false;
  }
  await writeTextAtomic(dest, content);
  return true;
}

async function copyTree(srcDir, destDir, { managed = false } = {}) {
  const entries = await fsp.readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(srcDir, e.name);
    const d = path.join(destDir, e.name);
    if (e.isDirectory()) await copyTree(s, d, { managed });
    else if (managed && /\.(md|txt)$/i.test(e.name)) {
      let content = await fsp.readFile(s, 'utf8');
      if (!content.includes(MARKER)) content = `<!-- ${MARKER} -->\n${content}`;
      await writeManaged(d, content);
    } else if (managed) {
      // Skripte usw.: überschreiben, wenn sich der Inhalt geändert hat.
      const neu = await fsp.readFile(s);
      const alt = await fsp.readFile(d).catch(() => null);
      if (!alt || !alt.equals(neu)) { await ensureDir(path.dirname(d)); await fsp.writeFile(d, neu); }
    } else {
      await copyIfMissing(s, d);
    }
  }
}

function agentsMd() {
  return `<!-- ${MARKER} -->
# Facharbeit – Hinweise für KI-Assistenten

Dieser Ordner ist der Arbeitsraum einer Facharbeit (Fachoberschule, Klasse 12). Er wird mit der App „Mango Facharbeit“ verwaltet.

- Verbindliche Arbeitsregeln: \`.facharbeit/regeln.md\` – bitte zuerst lesen.
- Projektangaben, Arbeitsstand und gemerkte Ergebnisse: \`FACHARBEIT.md\`
- Schulvorgaben mit Quellen: \`00_vorgaben/anforderungen.md\`
- Skills: \`.agents/skills/\` bzw. \`.claude/skills/\`

Vorhandene Dateien nicht überschreiben; Überarbeitungen als neue Version speichern (\`_v2\`, \`_v3\`).
`;
}

async function syncManagedFiles(ws) {
  const regeln = await fsp.readFile(path.join(RES, 'regeln.md'), 'utf8');
  await writeManaged(path.join(internalDir(ws), 'regeln.md'), `<!-- ${MARKER} -->\n${regeln}`);
  // Antigravity lädt Regeln aus .agents/rules/ automatisch.
  await writeManaged(path.join(ws, '.agents', 'rules', 'mango-facharbeit.md'),
    `---\ntrigger: always_on\n---\n<!-- ${MARKER} -->\n${regeln}`);
  await writeManaged(path.join(ws, 'AGENTS.md'), agentsMd());
  await writeManaged(path.join(ws, 'CLAUDE.md'), agentsMd());

  const skillsSrc = path.join(RES, 'skills');
  for (const e of await fsp.readdir(skillsSrc, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    await copyTree(path.join(skillsSrc, e.name), path.join(ws, '.agents', 'skills', e.name), { managed: true });
    await copyTree(path.join(skillsSrc, e.name), path.join(ws, '.claude', 'skills', e.name), { managed: true });
  }

  const vorgabenSrc = path.join(RES, 'vorgaben');
  const vorgabenDest = path.join(ws, '00_vorgaben');
  await ensureDir(vorgabenDest);
  const anf = await fsp.readFile(path.join(vorgabenSrc, 'anforderungen.md'), 'utf8');
  await writeManaged(path.join(vorgabenDest, 'anforderungen.md'), `<!-- ${MARKER} -->\n${anf}`);
  for (const f of await fsp.readdir(vorgabenSrc)) {
    if (f.endsWith('.pdf')) await copyIfMissing(path.join(vorgabenSrc, f), path.join(vorgabenDest, f));
  }
}

async function setupWorkspace(ws) {
  await ensureDir(ws);
  await ensureDir(internalDir(ws));
  await copyTree(path.join(RES, 'vorlagen', 'arbeitsraum'), ws);
  await copyIfMissing(path.join(RES, 'vorgaben', 'Lerntagebuch-Vorlage.docx'),
    path.join(ws, '06_lerntagebuch_und_konsultationen', 'Lerntagebuch-Vorlage.docx'));
  await ensureDir(path.join(ws, 'anhaenge'));
  await syncManagedFiles(ws);
}

async function isWorkspace(dir) {
  return exists(path.join(internalDir(dir), 'projekt.json'));
}

// Rekursive Dateiliste (ohne interne Ordner), sortiert nach Pfad.
async function listFiles(ws, { limit = 4000 } = {}) {
  const out = [];
  async function walk(dir) {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith('.') || e.name.startsWith('~$')) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (HIDDEN_DIRS.has(e.name)) continue;
        await walk(abs);
      } else if (e.isFile()) {
        if (HIDDEN_FILES.has(e.name) && (dir === ws || !/^(AGENTS|CLAUDE)\.md$/.test(e.name))) continue;
        let st;
        try { st = await fsp.stat(abs); } catch { continue; }
        const rel = toPosix(path.relative(ws, abs));
        out.push({ path: rel, name: e.name, size: st.size, mtime: st.mtimeMs, kind: extract.kindOf(e.name) });
      }
    }
  }
  await walk(ws);
  out.sort((a, b) => a.path.localeCompare(b.path, 'de'));
  return out;
}

// ---------- Sicherung vor und nach einem Assistenten-Durchlauf ----------

const SNAP_MAX_FILE = 8 * 1024 * 1024;
const SNAP_MAX_TOTAL = 200 * 1024 * 1024;

async function snapshot(ws) {
  const files = await listFiles(ws, { limit: 6000 });
  const map = new Map();
  let total = 0;
  for (const f of files) {
    const entry = { size: f.size, mtime: f.mtime, content: null };
    if (f.size <= SNAP_MAX_FILE && total + f.size <= SNAP_MAX_TOTAL) {
      try {
        entry.content = await fsp.readFile(path.join(ws, ...f.path.split('/')));
        total += f.size;
      } catch { /* Datei gesperrt – ohne Inhalt merken */ }
    }
    map.set(f.path, entry);
  }
  return map;
}

async function versionDir(ws, rel) {
  return path.join(internalDir(ws), 'versionen', ...rel.split('/'));
}

async function saveVersion(ws, rel, content, stamp = new Date()) {
  const dir = await versionDir(ws, rel);
  await ensureDir(dir);
  const target = path.join(dir, `${fileTimeStamp(stamp)}${path.extname(rel)}`);
  await fsp.writeFile(target, content);
  return toPosix(path.relative(ws, target));
}

// Vergleicht den Stand vor und nach dem Durchlauf. Geänderte und gelöschte Dateien
// werden mit ihrer vorherigen Fassung unter .facharbeit/versionen/ gesichert.
async function diffAndBackup(ws, before) {
  const after = await listFiles(ws, { limit: 6000 });
  const afterMap = new Map(after.map((f) => [f.path, f]));
  const changes = [];
  const stamp = new Date();
  for (const f of after) {
    if (f.path === 'FACHARBEIT.md') continue; // wird von der App selbst geschrieben
    const old = before.get(f.path);
    if (!old) {
      changes.push({ path: f.path, aktion: 'neu', kind: f.kind, size: f.size });
      continue;
    }
    if (old.size === f.size && old.mtime === f.mtime) continue;
    let changed = true;
    if (old.content) {
      const now = await fsp.readFile(path.join(ws, ...f.path.split('/'))).catch(() => null);
      changed = !now || !now.equals(old.content);
    }
    if (!changed) continue;
    const version = old.content ? await saveVersion(ws, f.path, old.content, stamp) : null;
    changes.push({ path: f.path, aktion: 'geaendert', kind: f.kind, size: f.size, version });
  }
  for (const [rel, old] of before) {
    if (afterMap.has(rel) || rel === 'FACHARBEIT.md') continue;
    const version = old.content ? await saveVersion(ws, rel, old.content, stamp) : null;
    changes.push({ path: rel, aktion: 'geloescht', kind: extract.kindOf(rel), version });
  }
  return changes;
}

async function listVersions(ws, rel) {
  const dir = await versionDir(ws, rel);
  const entries = await fsp.readdir(dir).catch(() => []);
  const out = [];
  for (const name of entries.sort().reverse()) {
    const st = await fsp.stat(path.join(dir, name)).catch(() => null);
    if (st && st.isFile()) out.push({ path: toPosix(path.relative(ws, path.join(dir, name))), name, size: st.size, mtime: st.mtimeMs });
  }
  return out;
}

// Stellt eine gesicherte Fassung als NEUE Datei neben dem Original wieder her.
async function restoreVersionAsCopy(ws, rel, versionRel) {
  const src = resolveInside(ws, versionRel);
  const original = resolveInside(ws, rel);
  if (!src || !original || !isInside(path.join(internalDir(ws), 'versionen'), src)) throw new Error('Ungültiger Pfad');
  const ext = path.extname(original);
  const stem = path.basename(original, ext);
  const stamp = path.basename(src, path.extname(src)).slice(0, 10);
  const target = await uniquePath(path.dirname(original), `${stem}_wiederhergestellt_${stamp}${ext}`);
  await fsp.copyFile(src, target);
  return toPosix(path.relative(ws, target));
}

// ---------- Anhänge ----------

function stagingDir(ws) {
  return path.join(internalDir(ws), 'staging');
}

async function stageUpload(ws, originalName, readable, { maxBytes = 200 * 1024 * 1024 } = {}) {
  const id = require('crypto').randomUUID();
  const name = safeFileName(originalName);
  const dir = path.join(stagingDir(ws), id);
  await ensureDir(dir);
  const target = path.join(dir, name);
  const handle = await fsp.open(target, 'w');
  let size = 0;
  try {
    for await (const chunk of readable) {
      size += chunk.length;
      if (size > maxBytes) throw Object.assign(new Error('Datei ist zu groß (maximal 200 MB)'), { status: 413 });
      await handle.write(chunk);
    }
  } catch (err) {
    await handle.close();
    await fsp.rm(dir, { recursive: true, force: true });
    throw err;
  }
  await handle.close();
  const info = await extract.analyse(target);
  return { id, name, size, kind: info.kind, lesbar: info.lesbar, hinweis: info.hinweis };
}

async function discardStaged(ws, id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await fsp.rm(path.join(stagingDir(ws), id), { recursive: true, force: true });
}

async function cleanupStaging(ws) {
  await fsp.rm(stagingDir(ws), { recursive: true, force: true }).catch(() => {});
}

function extractPathFor(ws, rel) {
  return path.join(internalDir(ws), 'extrakte', ...`${rel}.txt`.split('/'));
}

// Textauszug für eine Arbeitsraum-Datei erstellen bzw. aus dem Zwischenspeicher holen.
async function ensureExtract(ws, rel) {
  const abs = resolveInside(ws, rel);
  if (!abs) return { lesbar: 'nein', hinweis: 'Ungültiger Pfad', kind: 'andere' };
  const st = await fsp.stat(abs).catch(() => null);
  if (!st) return { lesbar: 'nein', hinweis: 'Datei fehlt', kind: extract.kindOf(rel) };
  const cache = extractPathFor(ws, rel);
  const kind = extract.kindOf(rel);
  if (['word', 'praesentation', 'tabelle', 'odt', 'pdf'].includes(kind)) {
    const cst = await fsp.stat(cache).catch(() => null);
    if (cst && cst.mtimeMs >= st.mtimeMs) {
      return { lesbar: 'ja', kind, hinweis: '', extrakt: toPosix(path.relative(ws, cache)) };
    }
  }
  const info = await extract.analyse(abs);
  if (info.lesbar === 'ja' && info.text) {
    await ensureDir(path.dirname(cache));
    await fsp.writeFile(cache, info.text, 'utf8');
    return { lesbar: 'ja', kind: info.kind, hinweis: info.hinweis, extrakt: toPosix(path.relative(ws, cache)) };
  }
  return { lesbar: info.lesbar, kind: info.kind, hinweis: info.hinweis };
}

// Verschiebt bereitgestellte Uploads in den Arbeitsraum (anhaenge/JJJJ-MM-TT/).
async function finalizeAttachment(ws, stagedId) {
  if (!/^[0-9a-f-]{36}$/.test(stagedId)) throw new Error('Ungültiger Anhang');
  const dir = path.join(stagingDir(ws), stagedId);
  const files = await fsp.readdir(dir).catch(() => []);
  if (!files.length) throw Object.assign(new Error('Der Anhang ist nicht mehr vorhanden. Bitte erneut anhängen.'), { status: 410 });
  const name = files[0];
  const destDir = path.join(ws, 'anhaenge', localDateStamp());
  await ensureDir(destDir);
  const target = await uniquePath(destDir, name);
  await fsp.rename(path.join(dir, name), target).catch(async () => {
    await fsp.copyFile(path.join(dir, name), target);
  });
  await fsp.rm(dir, { recursive: true, force: true });
  return toPosix(path.relative(ws, target));
}

module.exports = {
  MARKER, internalDir, suggestWorkspacePath, setupWorkspace, syncManagedFiles, isWorkspace,
  listFiles, snapshot, diffAndBackup, listVersions, restoreVersionAsCopy, stageUpload,
  discardStaged, cleanupStaging, ensureExtract, finalizeAttachment, defaultWorkspaceParent, RES, ROOT,
};
