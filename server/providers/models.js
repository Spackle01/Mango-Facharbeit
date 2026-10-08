'use strict';
// Modellauswahl für beide Anbieter. Leere ID = Voreinstellung der jeweiligen CLI.

// Nur Zeichen, die in Modellnamen vorkommen (z. B. „sonnet“, „claude-opus-5-5“,
// „sonnet[1m]“, „gemini-3.1-pro-high“). Schützt auch den Aufruf über cmd.exe.
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,99}$/;

function validModelId(id) {
  return id === '' || MODEL_ID_RE.test(String(id));
}

// Claude Code nimmt Kurznamen für die jeweils neueste Version oder den vollen Modellnamen
// (siehe `claude --help`, Option --model). Welche Versionen ein Konto nutzen darf,
// entscheidet Anthropic; nicht freigeschaltete Modelle meldet die CLI als Fehler.
const CLAUDE_MODELS = [
  { id: 'fable', name: 'Fable', gruppe: 'familie', info: 'Stärkstes Modell für sehr anspruchsvolle Aufgaben. Langsamer und verbraucht das Kontingent am schnellsten.' },
  { id: 'opus', name: 'Opus', gruppe: 'familie', info: 'Sehr gründlich, gut für Gliederung, Argumentation und die Prüfung der Arbeit.' },
  { id: 'sonnet', name: 'Sonnet', gruppe: 'familie', info: 'Schnell und stark, gut für die tägliche Arbeit.' },
  { id: 'haiku', name: 'Haiku', gruppe: 'familie', info: 'Am schnellsten, für kurze und einfache Aufgaben.' },
  { id: 'claude-fable-5-1', name: 'Fable 5.1', gruppe: 'version' },
  { id: 'claude-fable-5', name: 'Fable 5', gruppe: 'version' },
  { id: 'claude-opus-5-5', name: 'Opus 5.5', gruppe: 'version' },
  { id: 'claude-opus-5', name: 'Opus 5', gruppe: 'version' },
  { id: 'claude-opus-4-8', name: 'Opus 4.8', gruppe: 'version' },
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', gruppe: 'version' },
  { id: 'claude-sonnet-5', name: 'Sonnet 5', gruppe: 'version' },
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', gruppe: 'version' },
  { id: 'claude-haiku-5-5', name: 'Haiku 5.5', gruppe: 'version' },
  { id: 'claude-haiku-4-5', name: 'Haiku 4.5', gruppe: 'version' },
];

// Ausgabe von `agy models`: je Zeile „<slug>  <Anzeigename>“.
function parseAgyModels(text) {
  const out = [];
  const seen = new Set();
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, '').trim();
    const m = /^[*>•-]?\s*(\S+)(?:\s{2,}|\t+)(.+)$/.exec(line) || /^[*>•-]?\s*(\S+)$/.exec(line);
    if (!m) continue;
    const id = m[1];
    if (!MODEL_ID_RE.test(id) || /^(slug|model|models|id|name)$/i.test(id) || seen.has(id)) continue;
    if (!/[a-z]/i.test(id) || !/[-.\d]/.test(id)) continue; // Fließtext und Überschriften überspringen
    seen.add(id);
    const name = (m[2] || '').replace(/\s+/g, ' ').trim();
    out.push({ id, name: name || id, gruppe: 'verfuegbar' });
    if (out.length >= 60) break;
  }
  return out;
}

// Bestes Gemini-Modell aus `agy models`: zuerst die stärkste Klasse (Pro vor Flash vor Lite),
// darin die neueste Version, dann die höchste Denkstufe im Namen (high vor medium vor low).
function bestGeminiModel(models) {
  const rank = (m) => {
    const g = /^gemini-(\d+(?:\.\d+)?)(?:-(.+))?$/i.exec(m.id);
    if (!g) return null;
    const rest = (g[2] || '').toLowerCase();
    const klasse = /ultra/.test(rest) ? 4 : /pro/.test(rest) ? 3 : /lite/.test(rest) ? 1 : /flash/.test(rest) ? 2 : 2;
    const stufe = /(^|-)high$/.test(rest) ? 3 : /(^|-)medium$/.test(rest) ? 2 : /(^|-)low$/.test(rest) ? 1 : 2.5;
    const vorschau = /preview|exp/.test(rest) ? 0 : 1; // bei gleicher Version: stabil vor Vorschau
    return [klasse, parseFloat(g[1]), vorschau, stufe];
  };
  const vergleiche = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  };
  let best = null;
  let bestRank = null;
  for (const m of models || []) {
    const r = rank(m);
    if (r && (!bestRank || vergleiche(r, bestRank) > 0)) { best = m; bestRank = r; }
  }
  return best ? best.id : '';
}

// Gründlichkeit → --effort der CLIs. „Ausgewogen“ ist sparsam genug für den Alltag.
const GRUENDLICHKEIT = { sparsam: 'low', ausgewogen: 'medium', gruendlich: 'high' };

module.exports = { MODEL_ID_RE, validModelId, CLAUDE_MODELS, parseAgyModels, bestGeminiModel, GRUENDLICHKEIT };
