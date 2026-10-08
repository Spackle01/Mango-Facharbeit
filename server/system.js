'use strict';
// Betriebssystem-Funktionen: Dateien öffnen, Ordner wählen, App-Fenster starten.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { which } = require('./providers/proc');

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

function detached(cmd, args) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false });
      child.on('error', () => resolve(false));
      child.unref();
      setTimeout(() => resolve(true), 150);
    } catch {
      resolve(false);
    }
  });
}

// Die Desktop-App kann eigene Umsetzungen liefern (native Dialoge, shell.openPath …).
let host = null;
function setHost(h) {
  host = h || null;
}

// Öffnet eine Datei oder einen Ordner mit dem Standardprogramm.
async function openPath(target) {
  if (host && host.openPath) return host.openPath(target);
  if (IS_WIN) return detached('explorer.exe', [target]);
  if (IS_MAC) return detached('open', [target]);
  if (which('xdg-open')) return detached('xdg-open', [target]);
  return false;
}

// Zeigt eine Datei im Dateimanager an.
async function revealPath(target) {
  if (host && host.revealPath) return host.revealPath(target);
  if (IS_WIN) return detached('explorer.exe', [`/select,${target}`]);
  if (IS_MAC) return detached('open', ['-R', target]);
  return openPath(path.dirname(target));
}

function antigravityAppAvailable() {
  return !!which('antigravity');
}

async function openInAntigravity(dir) {
  const bin = which('antigravity');
  if (!bin) return false;
  if (IS_WIN && /\.(cmd|bat)$/i.test(bin)) return detached('cmd.exe', ['/d', '/s', '/c', `""${bin}" "${dir}""`]);
  return detached(bin, [dir]);
}

function run(cmd, args, timeout = 10 * 60 * 1000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: false, encoding: 'utf8' }, (err, stdout) => {
      resolve({ ok: !err, stdout: (stdout || '').trim(), err });
    });
  });
}

// Nativer Ordnerdialog. supported=false, wenn keiner verfügbar ist.
async function pickFolder() {
  if (host && host.pickFolder) return host.pickFolder();
  if (IS_WIN) {
    const ps = [
      '[Console]::OutputEncoding=[Text.Encoding]::UTF8;',
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$f = New-Object System.Windows.Forms.Form; $f.TopMost = $true;',
      '$d = New-Object System.Windows.Forms.FolderBrowserDialog;',
      "$d.Description = 'Speicherort für die Facharbeit wählen'; $d.ShowNewFolderButton = $true;",
      "if ($d.ShowDialog($f) -eq 'OK') { Write-Output $d.SelectedPath }",
    ].join(' ');
    const r = await run('powershell.exe', ['-NoProfile', '-STA', '-Command', ps]);
    if (r.err && r.err.code === 'ENOENT') return { supported: false };
    return { supported: true, path: r.stdout || null };
  }
  if (IS_MAC) {
    const r = await run('osascript', ['-e', 'POSIX path of (choose folder with prompt "Speicherort für die Facharbeit wählen")']);
    if (r.err && r.err.code === 'ENOENT') return { supported: false };
    return { supported: true, path: r.stdout ? r.stdout.replace(/\/$/, '') : null };
  }
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return { supported: false };
  if (which('zenity')) {
    const r = await run('zenity', ['--file-selection', '--directory', '--title=Speicherort für die Facharbeit wählen']);
    return { supported: true, path: r.stdout || null };
  }
  if (which('kdialog')) {
    const r = await run('kdialog', ['--getexistingdirectory', os.homedir(), '--title', 'Speicherort für die Facharbeit wählen']);
    return { supported: true, path: r.stdout || null };
  }
  return { supported: false };
}

function browserCandidates() {
  if (IS_WIN) {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return [
      path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter((p) => fs.existsSync(p));
  }
  if (IS_MAC) {
    return ['Google Chrome', 'Microsoft Edge', 'Chromium', 'Brave Browser']
      .filter((app) => fs.existsSync(`/Applications/${app}.app`));
  }
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].map(which).filter(Boolean);
}

// Öffnet die App in einem eigenen Fenster (Chromium-App-Modus), sonst im Standardbrowser.
async function openAppWindow(url) {
  const candidates = browserCandidates();
  const appArgs = [`--app=${url}`, '--window-size=1280,860'];
  if (candidates.length) {
    if (IS_MAC) return detached('open', ['-na', candidates[0], '--args', ...appArgs]);
    return detached(candidates[0], appArgs);
  }
  if (IS_WIN) return detached('explorer.exe', [url]);
  if (IS_MAC) return detached('open', [url]);
  if (which('xdg-open')) return detached('xdg-open', [url]);
  return false;
}

module.exports = { setHost, openPath, revealPath, pickFolder, openAppWindow, antigravityAppAvailable, openInAntigravity };
