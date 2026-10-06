'use strict';
// Plattformunabhängige Hilfen zum Finden und Starten von Kommandozeilenprogrammen.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const IS_WIN = process.platform === 'win32';

function extraDirs() {
  const home = os.homedir();
  const dirs = [
    path.join(home, '.local', 'bin'),
    path.join(home, '.claude', 'local'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.antigravity', 'bin'),
    path.join(home, 'bin'),
  ];
  if (IS_WIN) {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    dirs.push(path.join(appData, 'npm'), path.join(local, 'Programs', 'agy'), path.join(local, 'Programs', 'antigravity-cli'),
      path.join(local, 'agy', 'bin'), path.join(local, 'Microsoft', 'WinGet', 'Links'));
  } else {
    dirs.push('/usr/local/bin', '/opt/homebrew/bin', '/usr/bin');
  }
  return dirs;
}

function isExecutable(file) {
  try {
    const st = fs.statSync(file);
    if (!st.isFile()) return false;
    if (IS_WIN) return true;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Sucht ein Programm im PATH und in typischen Installationsordnern.
function which(cmd) {
  const dirs = [...(process.env.PATH || '').split(path.delimiter).filter(Boolean), ...extraDirs()];
  const exts = IS_WIN ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const ext of exts) {
    for (const dir of dirs) {
      const candidate = path.join(dir, cmd + ext);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

function needsShell(file) {
  return IS_WIN && /\.(cmd|bat)$/i.test(file);
}

function quoteForCmd(arg) {
  return `"${String(arg).replace(/"/g, '""')}"`;
}

function childEnv() {
  return { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
}

// Startet ein Programm. Nutzereingaben gehören nie in eine Shell-Zeile:
// .cmd-Dateien unter Windows bekommen nur feste Optionen und Pfade.
function spawnProgram(file, args, { cwd, stdin = 'pipe' } = {}) {
  const opts = { cwd, env: childEnv(), windowsHide: true, stdio: [stdin, 'pipe', 'pipe'] };
  if (!IS_WIN) opts.detached = true; // eigene Prozessgruppe, damit Stopp alle Unterprozesse beendet
  if (needsShell(file)) {
    const line = [quoteForCmd(file), ...args.map(quoteForCmd)].join(' ');
    return spawn(line, { ...opts, shell: true });
  }
  return spawn(file, args, opts);
}

function killTree(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  try {
    if (IS_WIN) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
      setTimeout(() => {
        if (child.exitCode === null) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* bereits beendet */ } }
        }
      }, 3000).unref();
    }
  } catch { /* bereits beendet */ }
}

// Führt ein Programm aus und sammelt die Ausgabe.
function runCapture(file, args, { cwd, timeout = 20000, input = null } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnProgram(file, args, { cwd, stdin: input === null ? 'ignore' : 'pipe' });
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: '', error });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeout);
    child.stdout.on('data', (d) => { stdout += d; if (stdout.length > 4e6) stdout = stdout.slice(-4e6); });
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 1e6) stderr = stderr.slice(-1e6); });
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr, error, timedOut }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
    if (input !== null) { child.stdin.on('error', () => {}); child.stdin.end(input); }
  });
}

// Liest NDJSON zeilenweise aus einem Stream.
function onJsonLines(stream, handler) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      let obj = null;
      try { obj = JSON.parse(line); } catch { handler(null, line); continue; }
      handler(obj, line);
    }
  });
  stream.on('end', () => {
    const line = buf.trim();
    if (!line) return;
    try { handler(JSON.parse(line), line); } catch { handler(null, line); }
  });
}

module.exports = { IS_WIN, which, spawnProgram, runCapture, killTree, onJsonLines, needsShell };
