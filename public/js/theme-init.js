// Setzt das Farbschema vor dem ersten Zeichnen, damit nichts aufblitzt.
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('mango.theme') || 'system'; } catch (e) { /* kein Speicher */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  // Desktop-App: eigene Titelleiste mit Systemknöpfen (Windows/Linux rechts, macOS links).
  if (/Electron\//.test(navigator.userAgent)) {
    document.documentElement.classList.add('desktop', /Mac OS X/.test(navigator.userAgent) ? 'desktop-mac' : 'desktop-win');
  }
})();
