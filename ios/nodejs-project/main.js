'use strict';
// Startet Mango Facharbeit in der iPad-App (Node.js für Mobilgeräte, nodejs-mobile).
// Aufruf durch die App: node main.js <Datenordner> <Heimordner> <Port>
// Die App wartet auf die Datei `laeuft.txt` im Datenordner (enthält die Adresse) bzw. `fehler.txt` (Fehlermeldung).
// Im Repository liegt dieses Skript unter ios/nodejs-project/, der Server eine Ebene höher; in der App liegt der Server daneben.
const fs = require('fs');
const path = require('path');

const [, , datenOrdner, heimOrdner, portArg] = process.argv;

function melden(name, text) {
  try {
    fs.mkdirSync(datenOrdner, { recursive: true });
    fs.writeFileSync(path.join(datenOrdner, name), String(text));
  } catch { /* nichts zu tun, die App zeigt dann den Standardtext */ }
}

function fehler(err) {
  melden('fehler.txt', (err && err.stack) || String(err));
  console.error('Start fehlgeschlagen:', err);
}

process.on('uncaughtException', fehler);
process.on('unhandledRejection', fehler);

try {
  if (!datenOrdner || !heimOrdner) throw new Error('Aufruf: main.js <Datenordner> <Heimordner> <Port>');
  for (const name of ['laeuft.txt', 'fehler.txt']) fs.rmSync(path.join(datenOrdner, name), { force: true });

  // Umgebung: Heimordner der App (Dokumente liegen darin und sind in der Dateien-App sichtbar), nur Anbieter mit
  // API-Schlüssel (auf dem iPad gibt es keine Kommandozeile), keine Umwandlung über Office, kein eigenes Fenster.
  Object.assign(process.env, {
    HOME: heimOrdner,
    USERPROFILE: heimOrdner,
    MANGO_DATA_DIR: datenOrdner,
    MANGO_IPAD: '1',
    MANGO_NUR_API: '1',
    MANGO_OHNE_KONVERTIERUNG: '1',
    MANGO_NO_OPEN: '1',
  });

  const serverDatei = [path.join(__dirname, 'server', 'index.js'), path.join(__dirname, '..', '..', 'server', 'index.js')].find((p) => fs.existsSync(p));
  if (!serverDatei) throw new Error('Der Server wurde nicht gefunden.');
  const { start } = require(serverDatei);

  start({ port: Number(portArg) || 4317, open: false })
    .then(({ url }) => melden('laeuft.txt', url))
    .catch(fehler);
} catch (err) {
  fehler(err);
}
