'use strict';
// Anbindung an die DeepSeek-API (Chat Completions, OpenAI-kompatibel). Der gemeinsame Kern steht in
// api-anbieter.js. Dokumentation: https://api-docs.deepseek.com/
const { erstelleAnbieter } = require('./api-anbieter');

const KEY_LINK = 'https://platform.deepseek.com/api_keys';
const BASE = (process.env.MANGO_DEEPSEEK_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const STANDARD_MODELL = 'deepseek-flash';

// Stand der API-Dokumentation: deepseek-flash = DeepSeek-V4.1-Flash, deepseek-v4-pro = V4 Pro.
const DEEPSEEK_MODELS = [
  { id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash', gruppe: 'familie', info: 'Neueste Version (V4.1), schnell und günstig. Gut für die tägliche Arbeit.' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', gruppe: 'familie', info: 'Stärkstes Modell, für schwierige Aufgaben wie Gliederung und Argumentation.' },
];

const anbieter = erstelleAnbieter({
  id: 'deepseek',
  name: 'DeepSeek',
  keyLink: KEY_LINK,
  base: BASE,
  standardModell: STANDARD_MODELL,
  modelle: DEEPSEEK_MODELS,
  denken: true,
  schluesselMuster: /^sk-[A-Za-z0-9_-]{16,200}$/,
  schluesselFehler: 'Das sieht nicht wie ein DeepSeek-Schlüssel aus. Er beginnt mit „sk-“.',
  loginText: 'Erstelle bei DeepSeek einen API-Schlüssel und füge ihn hier ein. Die Nutzung wird bei DeepSeek nach Verbrauch abgerechnet, dafür brauchst du dort Guthaben.',
  guthabenText: 'Dein DeepSeek-Guthaben ist aufgebraucht. Lade es unter platform.deepseek.com auf.',
});

module.exports = { ...anbieter, DEEPSEEK_MODELS };
