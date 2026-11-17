'use strict';
// Anbindung an OpenCode Go (https://opencode.ai): ein Abo mit Zugang zu mehreren Modellen über eine
// OpenAI-kompatible Schnittstelle und einen eigenen API-Schlüssel. Der gemeinsame Kern steht in api-anbieter.js.
// Die Modellliste kommt zur Laufzeit von GET /models, weil sie sich ändert.
const { erstelleAnbieter } = require('./api-anbieter');

const KEY_LINK = 'https://opencode.ai/docs/go';
const BASE = (process.env.MANGO_OPENCODEGO_URL || 'https://opencode.ai/zen/go/v1').replace(/\/+$/, '');

module.exports = erstelleAnbieter({
  id: 'opencodego',
  name: 'OpenCode Go',
  keyLink: KEY_LINK,
  base: BASE,
  standardModell: '', // das erste Modell der Liste
  modelleLaden: true,
  denken: false,
  schluesselMuster: /^[A-Za-z0-9][A-Za-z0-9._~+/=-]{15,299}$/,
  schluesselFehler: 'Das sieht nicht wie ein OpenCode-Go-Schlüssel aus. Kopiere ihn vollständig aus der OpenCode-Konsole.',
  loginText: 'Abonniere OpenCode Go, erstelle in der OpenCode-Konsole einen API-Schlüssel und füge ihn hier ein. Die Nutzung ist im Abo enthalten, es gelten die Grenzen des Plans.',
  guthabenText: 'Dein OpenCode-Go-Kontingent ist aufgebraucht oder das Abo ist abgelaufen. Prüfe es in der OpenCode-Konsole.',
});
