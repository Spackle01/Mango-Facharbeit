'use strict';
// Echte Ansicht von Word- und PowerPoint-Dateien: Ist Microsoft Office (Windows) oder LibreOffice
// installiert, wandelt Mango die Datei im Hintergrund in ein PDF um und zeigt dieses. So sieht
// man die Datei genau so, wie das Programm sie darstellt. Ohne Office bleibt die eigene Vorschau.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const { fsp, path, ensureDir, exists } = require('./util');
const ws = require('./workspace');
const { IS_WIN, which, runCapture } = require('./providers/proc');

const TIMEOUT = 90 * 1000;
const laeuft = new Map(); // Schlüssel → Promise
const gescheitert = new Map(); // Schlüssel → Zeitpunkt (nicht ständig neu versuchen)

const PS_POWERPOINT = `
$ErrorActionPreference = 'Stop'
$in = $env:MANGO_IN; $out = $env:MANGO_OUT
try { $app = New-Object -ComObject PowerPoint.Application } catch { exit 2 }
try {
  $pres = $app.Presentations.Open($in, -1, 0, 0)
  $pres.SaveAs($out, 32)
  $pres.Close()
} finally {
  try { if ($app.Presentations.Count -eq 0) { $app.Quit() } } catch {}
}
`;

const PS_WORD = `
$ErrorActionPreference = 'Stop'
$in = $env:MANGO_IN; $out = $env:MANGO_OUT
try { $app = New-Object -ComObject Word.Application } catch { exit 2 }
try {
  $app.Visible = $false
  $app.DisplayAlerts = 0
  $doc = $app.Documents.Open($in, $false, $true, $false)
  $doc.ExportAsFixedFormat($out, 17)
  $doc.Close($false)
} finally {
  try { if ($app.Documents.Count -eq 0) { $app.Quit() } } catch {}
}
`;

function schluessel(rel, st) {
  return crypto.createHash('sha1').update(`${rel}|${st.mtimeMs}|${st.size}`).digest('hex').slice(0, 24);
}

function cachePfad(workspace, key) {
  return path.join(ws.internalDir(workspace), 'vorschau', `${key}.pdf`);
}

function libreOffice() {
  const found = which('soffice') || which('libreoffice');
  if (found) return found;
  if (IS_WIN) {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) {
      const p = path.join(base, 'LibreOffice', 'program', 'soffice.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function mitOffice(abs, ziel, ext) {
  const skript = path.join(os.tmpdir(), `mango-${crypto.randomBytes(4).toString('hex')}.ps1`);
  await fsp.writeFile(skript, ext === 'pptx' ? PS_POWERPOINT : PS_WORD, 'utf8');
  try {
    const r = await runCapture('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', skript],
      { timeout: TIMEOUT, env: { MANGO_IN: abs, MANGO_OUT: ziel } });
    return r.code === 0 && (await exists(ziel)) ? (ext === 'pptx' ? 'PowerPoint' : 'Word') : null;
  } finally {
    fsp.rm(skript, { force: true }).catch(() => {});
  }
}

async function mitLibreOffice(abs, ziel) {
  const bin = libreOffice();
  if (!bin) return null;
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'mango-lo-'));
  try {
    const profil = `file://${path.join(tmp, 'profil').replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')}`;
    const r = await runCapture(bin, [`-env:UserInstallation=${profil}`, '--headless', '--convert-to', 'pdf', '--outdir', tmp, abs], { timeout: TIMEOUT });
    const erzeugt = path.join(tmp, `${path.basename(abs, path.extname(abs))}.pdf`);
    if (r.code !== 0 || !(await exists(erzeugt))) return null;
    await fsp.copyFile(erzeugt, ziel);
    return 'LibreOffice';
  } finally {
    fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// Liefert { pdf: absoluter Pfad, quelle } oder null. Ergebnisse werden je Dateistand gespeichert.
async function nachPdf(workspace, rel) {
  if (process.env.MANGO_OHNE_KONVERTIERUNG) return null;
  const abs = path.join(workspace, ...rel.split('/'));
  const ext = path.extname(rel).toLowerCase().slice(1);
  if (!['docx', 'pptx'].includes(ext)) return null;
  const st = await fsp.stat(abs);
  const key = schluessel(rel, st);
  const ziel = cachePfad(workspace, key);
  const meta = `${ziel}.json`;
  if (await exists(ziel)) {
    let quelle = '';
    try { quelle = JSON.parse(await fsp.readFile(meta, 'utf8')).quelle; } catch { /* egal */ }
    return { pdf: ziel, quelle: quelle || 'Office' };
  }
  if (gescheitert.has(key) && Date.now() - gescheitert.get(key) < 10 * 60 * 1000) return null;
  if (laeuft.has(key)) return laeuft.get(key);
  const job = (async () => {
    await ensureDir(path.dirname(ziel));
    const tmpZiel = `${ziel}.${crypto.randomBytes(3).toString('hex')}.tmp.pdf`;
    let quelle = null;
    try {
      if (IS_WIN) quelle = await mitOffice(abs, tmpZiel, ext).catch(() => null);
      if (!quelle) quelle = await mitLibreOffice(abs, tmpZiel).catch(() => null);
      if (!quelle) { gescheitert.set(key, Date.now()); return null; }
      await fsp.rename(tmpZiel, ziel);
      await fsp.writeFile(meta, JSON.stringify({ quelle }));
      // Alte Vorschauen aufräumen (nur die letzten 30 behalten)
      const dir = path.dirname(ziel);
      const alle = (await fsp.readdir(dir)).filter((n) => n.endsWith('.pdf') && !n.includes('.tmp.'));
      if (alle.length > 30) {
        const mit = await Promise.all(alle.map(async (n) => ({ n, t: (await fsp.stat(path.join(dir, n))).mtimeMs })));
        for (const x of mit.sort((a, b) => a.t - b.t).slice(0, alle.length - 30)) {
          await fsp.rm(path.join(dir, x.n), { force: true }); await fsp.rm(path.join(dir, `${x.n}.json`), { force: true });
        }
      }
      return { pdf: ziel, quelle };
    } finally {
      fsp.rm(tmpZiel, { force: true }).catch(() => {});
    }
  })().finally(() => laeuft.delete(key));
  laeuft.set(key, job);
  return job;
}

// Schon vorhandene Umwandlung (ohne neu zu starten)
async function vorhanden(workspace, rel) {
  try {
    const st = await fsp.stat(path.join(workspace, ...rel.split('/')));
    const ziel = cachePfad(workspace, schluessel(rel, st));
    if (!(await exists(ziel))) return null;
    let quelle = 'Office';
    try { quelle = JSON.parse(await fsp.readFile(`${ziel}.json`, 'utf8')).quelle || quelle; } catch { /* egal */ }
    return { pdf: ziel, quelle };
  } catch { return null; }
}

module.exports = { nachPdf, vorhanden };
