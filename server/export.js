'use strict';
// Exporte: Gesprächsverläufe (Anlage), Word-Dateien, Gesamtarbeit, Sicherung als ZIP.
const { fsp, path, ensureDir, uniquePath, localDateStamp, formatDateDE, resolveInside, toPosix, safeFileName } = require('./util');
const { transcriptsMarkdown } = require('./context');
const { markdownToDocx, facharbeitToDocx } = require('./docx');
const { writeZip } = require('./zip');

async function exportTranscripts(project) {
  const chats = [...project.chats.values()].filter((c) => c.messages.length);
  if (!chats.length) throw Object.assign(new Error('Es gibt noch keine Gespräche zum Exportieren.'), { status: 400 });
  const md = transcriptsMarkdown(project, chats);
  const dir = path.join(project.workspace, '07_ki_prompts_anhang');
  await ensureDir(dir);
  const target = await uniquePath(dir, `KI-Gespraechsverlaeufe_${localDateStamp()}.md`);
  await fsp.writeFile(target, md, 'utf8');
  const rel = toPosix(path.relative(project.workspace, target));
  // Zusätzlich als Word-Datei, damit sie direkt in den Anhang übernommen werden kann.
  const docxTarget = target.replace(/\.md$/, '.docx');
  await fsp.writeFile(docxTarget, markdownToDocx(md, { title: 'Verläufe der KI-Gespräche', author: project.data.angaben.name }));
  return { path: rel, docx: toPosix(path.relative(project.workspace, docxTarget)) };
}

async function exportMarkdownAsDocx(project, rel) {
  const abs = resolveInside(project.workspace, rel);
  if (!abs || !/\.(md|markdown|txt)$/i.test(abs)) throw Object.assign(new Error('Nur Markdown- und Textdateien lassen sich als Word exportieren.'), { status: 400 });
  const md = await fsp.readFile(abs, 'utf8').catch(() => null);
  if (md === null) throw Object.assign(new Error('Datei nicht gefunden'), { status: 404 });
  const target = await uniquePath(path.dirname(abs), `${path.basename(abs).replace(/\.(md|markdown|txt)$/i, '')}.docx`);
  await fsp.writeFile(target, markdownToDocx(md, { title: path.basename(abs), author: project.data.angaben.name }));
  return { path: toPosix(path.relative(project.workspace, target)) };
}

// Wählt je Kapitelnummer (00_ bis 08_) die neueste Fassung (höchstes _vN, sonst neueste Änderung).
async function chapterFiles(project) {
  const dir = path.join(project.workspace, '05_facharbeit_entwurf');
  const entries = await fsp.readdir(dir).catch(() => []);
  const byPrefix = new Map();
  for (const name of entries) {
    const m = /^(\d{2})_.*\.md$/i.exec(name);
    if (!m) continue;
    const st = await fsp.stat(path.join(dir, name));
    const v = +((/_v(\d+)\.md$/i.exec(name) || [])[1] || 1);
    const cur = byPrefix.get(m[1]);
    if (!cur || v > cur.v || (v === cur.v && st.mtimeMs > cur.mtime)) byPrefix.set(m[1], { name, v, mtime: st.mtimeMs });
  }
  return [...byPrefix.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([prefix, f]) => ({ prefix, ...f, abs: path.join(dir, f.name) }));
}

async function exportFacharbeit(project) {
  const files = await chapterFiles(project);
  // Titelblatt und Inhaltsverzeichnis erzeugt die App selbst (00, 01).
  const teile = [];
  for (const f of files.filter((x) => x.prefix !== '00' && x.prefix !== '01')) {
    teile.push({ name: f.name, markdown: await fsp.readFile(f.abs, 'utf8') });
  }
  if (!teile.length) throw Object.assign(new Error('Im Ordner 05_facharbeit_entwurf wurden keine Kapitel gefunden.'), { status: 400 });
  const buf = facharbeitToDocx({ angaben: project.data.angaben, teile, datum: formatDateDE(new Date()) });
  const dir = path.join(project.workspace, 'exporte');
  await ensureDir(dir);
  const name = safeFileName(`Facharbeit_${project.data.angaben.name || 'Entwurf'}_${localDateStamp()}.docx`.replace(/\s+/g, '_'));
  const target = await uniquePath(dir, name);
  await fsp.writeFile(target, buf);
  return { path: toPosix(path.relative(project.workspace, target)), teile: teile.map((t) => t.name) };
}

// ZIP des Arbeitsraums inkl. Projektdaten und Chats (ohne Zwischenspeicher).
async function backupZip(project) {
  const files = [];
  let total = 0;
  async function walk(dir, relBase) {
    for (const e of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const abs = path.join(dir, e.name);
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'staging', 'exporte'].includes(e.name)) continue;
        await walk(abs, rel);
      } else if (e.isFile()) {
        const st = await fsp.stat(abs);
        if (st.size > 100 * 1024 * 1024) continue;
        total += st.size;
        if (total > 1024 * 1024 * 1024) throw Object.assign(new Error('Der Arbeitsraum ist zu groß für eine Sicherung (über 1 GB).'), { status: 413 });
        files.push({ name: rel, data: await fsp.readFile(abs), date: st.mtime });
      }
    }
  }
  await walk(project.workspace, '');
  return writeZip(files);
}

module.exports = { exportTranscripts, exportMarkdownAsDocx, exportFacharbeit, backupZip, chapterFiles };
