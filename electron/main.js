'use strict';
// Desktop-App: startet den lokalen Server im selben Prozess und zeigt die Oberfläche in einem
// eigenen Fenster ohne Titelleiste. Minimieren, Maximieren und Schließen bleiben als
// Systemknöpfe erhalten und übernehmen die Farben der App (titleBarOverlay).
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, Menu, dialog, shell, ipcMain, nativeTheme, session } = require('electron');

const IS_MAC = process.platform === 'darwin';
const TITLEBAR_HEIGHT = 48;
const COLORS = {
  light: { bg: '#faf8f5', fg: '#55514a' },
  dark: { bg: '#1e1f22', fg: '#b3afa8' },
};

const smokeArg = process.argv.find((a) => a.startsWith('--smoke-test='));
const SMOKE_FILE = smokeArg ? smokeArg.slice('--smoke-test='.length) : null;

app.setName('Mango Facharbeit');
if (process.platform === 'win32') app.setAppUserModelId('de.mango.facharbeit');

// Electron-eigene Daten (Cache, Fensterposition) neben den App-Daten ablegen.
const appDataBase = process.platform === 'win32'
  ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
  : IS_MAC ? path.join(os.homedir(), 'Library', 'Application Support') : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
if (SMOKE_FILE) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mango-smoke-'));
  process.env.MANGO_DATA_DIR = path.join(tmp, 'daten');
  app.setPath('userData', path.join(tmp, 'desktop'));
} else {
  app.setPath('userData', path.join(appDataBase, process.platform === 'win32' || IS_MAC ? 'Mango-Facharbeit' : 'mango-facharbeit', 'desktop'));
}

if (!SMOKE_FILE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;
  let server = null;

  const stateFile = () => path.join(app.getPath('userData'), 'fenster.json');
  const loadBounds = () => {
    try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return null; }
  };
  const saveBounds = () => {
    if (!win || win.isDestroyed()) return;
    try {
      fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
      fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
    } catch { /* nicht wichtig */ }
  };

  const themeColors = () => {
    const pref = server ? server.settings().theme : 'system';
    const dark = pref === 'dark' || (pref === 'system' && nativeTheme.shouldUseDarkColors);
    return dark ? COLORS.dark : COLORS.light;
  };

  const isAppUrl = (url) => server && url.startsWith(server.url);
  const openExternal = (url) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
  };

  function createWindow() {
    const saved = loadBounds();
    const colors = themeColors();
    win = new BrowserWindow({
      width: saved ? saved.width : 1280,
      height: saved ? saved.height : 860,
      x: saved ? saved.x : undefined,
      y: saved ? saved.y : undefined,
      minWidth: 400,
      minHeight: 560,
      show: false,
      title: 'Mango Facharbeit',
      icon: path.join(__dirname, 'icon.png'),
      backgroundColor: colors.bg,
      titleBarStyle: 'hidden',
      titleBarOverlay: IS_MAC ? undefined : { color: colors.bg, symbolColor: colors.fg, height: TITLEBAR_HEIGHT },
      trafficLightPosition: { x: 16, y: 16 },
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: true,
      },
    });
    if (saved && saved.maximized) win.maximize();

    const wc = win.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      openExternal(url);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (e, url) => {
      if (!isAppUrl(url)) { e.preventDefault(); openExternal(url); }
    });
    // Zoomen wie im Browser (ohne Menüleiste gibt es sonst keine Tastenkürzel dafür).
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
      const k = input.key;
      if (k === '+' || k === '=') { wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 4)); e.preventDefault(); }
      else if (k === '-') { wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3)); e.preventDefault(); }
      else if (k === '0') { wc.setZoomLevel(0); e.preventDefault(); }
      else if (k.toLowerCase() === 'r' && !input.shift) { wc.reload(); e.preventDefault(); }
      else if (process.env.MANGO_DEV && input.shift && k.toLowerCase() === 'i') wc.toggleDevTools();
    });
    // Kontextmenü mit Rechtschreibvorschlägen, Ausschneiden, Kopieren, Einfügen.
    wc.on('context-menu', (e, p) => {
      const items = [];
      for (const s of (p.dictionarySuggestions || []).slice(0, 5)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
      if (p.misspelledWord) {
        items.push({ label: 'Zum Wörterbuch hinzufügen', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
        items.push({ type: 'separator' });
      }
      if (p.isEditable) items.push({ label: 'Ausschneiden', role: 'cut', enabled: p.editFlags.canCut });
      if (p.isEditable || p.selectionText) items.push({ label: 'Kopieren', role: 'copy', enabled: p.editFlags.canCopy });
      if (p.isEditable) items.push({ label: 'Einfügen', role: 'paste', enabled: p.editFlags.canPaste }, { label: 'Alles auswählen', role: 'selectAll' });
      if (p.linkURL && !isAppUrl(p.linkURL)) items.push({ type: 'separator' }, { label: 'Link im Browser öffnen', click: () => openExternal(p.linkURL) });
      if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
    });

    win.once('ready-to-show', () => { if (!SMOKE_FILE) win.show(); });
    win.on('resize', saveBounds);
    win.on('move', saveBounds);
    win.on('close', (e) => {
      saveBounds();
      if (SMOKE_FILE || !server || !server.running() || win.forceClose) return;
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Beenden', 'Abbrechen'],
        defaultId: 1,
        cancelId: 1,
        title: 'Mango Facharbeit',
        message: 'Der Assistent arbeitet gerade noch.',
        detail: 'Wenn du jetzt beendest, wird die laufende Antwort abgebrochen.',
      });
      if (choice !== 0) e.preventDefault();
      else win.forceClose = true;
    });
    win.on('closed', () => { win = null; });
    wc.loadURL(server.url);
    return win;
  }

  // Die Oberfläche meldet Farbwechsel (Hell/Dunkel), damit die Systemknöpfe passen.
  ipcMain.on('titlebar-colors', (e, { bg, fg }) => {
    if (!win || e.sender !== win.webContents || IS_MAC) return;
    const ok = (c) => /^#[0-9a-f]{6}$/i.test(String(c));
    if (!ok(bg) || !ok(fg)) return;
    try {
      win.setTitleBarOverlay({ color: bg, symbolColor: fg, height: TITLEBAR_HEIGHT });
      win.setBackgroundColor(bg);
    } catch { /* ältere Systeme */ }
  });

  // Funktionen, die der Server statt eigener Hilfsprogramme nutzt.
  const host = {
    async openPath(target) {
      const err = await shell.openPath(target);
      return !err;
    },
    async revealPath(target) {
      shell.showItemInFolder(target);
      return true;
    },
    async pickFolder() {
      const r = await dialog.showOpenDialog(win || undefined, {
        title: 'Speicherort für die Facharbeit wählen',
        buttonLabel: 'Ordner wählen',
        properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
      });
      return { supported: true, path: r.canceled ? null : r.filePaths[0] || null };
    },
  };

  async function runSmokeTest() {
    const result = { ok: false };
    try {
      const w = createWindow();
      await new Promise((resolve, reject) => {
        w.webContents.once('did-finish-load', resolve);
        w.webContents.once('did-fail-load', (e, code, desc) => reject(new Error(desc)));
        setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden')), 60000);
      });
      Object.assign(result, await w.webContents.executeJavaScript(`(async () => {
        const token = document.querySelector('meta[name="mango-token"]').content;
        const s = await (await fetch('/api/state', { headers: { 'x-mango-token': token } })).json();
        await new Promise((r) => setTimeout(r, 1500));
        return { title: document.title, version: s.version, platform: s.platform, desktop: document.documentElement.classList.contains('desktop'),
          onboarding: !!document.querySelector('.onboard'), logo: !!document.querySelector('img.logo') && document.querySelector('img.logo').naturalWidth > 0 };
      })()`));
      result.ok = result.title === 'Mango Facharbeit' && !!result.version && result.desktop;
    } catch (err) {
      result.error = err.message;
    }
    fs.writeFileSync(SMOKE_FILE, JSON.stringify(result, null, 2));
    app.exit(result.ok ? 0 : 1);
  }

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    // Nur Kopieren in die Zwischenablage erlauben, sonst keine Berechtigungen.
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(['clipboard-sanitized-write', 'fullscreen'].includes(permission)));
    if (!IS_MAC) {
      try { session.defaultSession.setSpellCheckerLanguages(['de-DE']); } catch { /* Sprache nicht verfügbar */ }
    }
    try {
      server = await require('../server/index.js').start({ host, log: SMOKE_FILE ? () => {} : console.log });
    } catch (err) {
      dialog.showErrorBox('Mango Facharbeit konnte nicht starten', String(err && err.message ? err.message : err));
      app.exit(1);
      return;
    }
    if (SMOKE_FILE) { await runSmokeTest(); return; }
    createWindow();
    app.on('activate', () => { if (!win) createWindow(); });
  });

  app.on('window-all-closed', () => {
    if (!IS_MAC || SMOKE_FILE) app.quit();
  });
  app.on('before-quit', () => {
    if (server) server.shutdown();
  });
}
