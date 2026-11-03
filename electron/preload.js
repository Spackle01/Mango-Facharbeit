'use strict';
// Schmale Brücke zur Desktop-App: nur Farben der Fensterknöpfe setzen.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mangoDesktop', {
  platform: process.platform,
  setTitleBarColors(bg, fg) {
    ipcRenderer.send('titlebar-colors', { bg: String(bg), fg: String(fg) });
  },
});
