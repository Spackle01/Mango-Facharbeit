'use strict';
// Die Schreib-Skills (Paket „human-voice“, „humanize-rewrite“, „ai-tell-audit“) und die Pflicht, sie bei jedem Text zu nutzen.
// Ein Text braucht zwei Schritte: schreiben bzw. umschreiben, dann prüfen. Den Scan des Prüf-Skills (ai_tell_scan.py)
// führt Mango selbst aus (server/aitell.js); DeepSeek kann ihn zusätzlich als Werkzeug `ai_tell_scan` aufrufen.

const SCAN_WERKZEUG = 'ai_tell_scan';

const ANFORDERUNGEN = [
  { id: 'schreiben', skills: ['human-voice', 'humanize-rewrite'], text: '`human-voice` (neuer Text) oder `humanize-rewrite` (vorhandener Text)' },
  { id: 'pruefung', skills: ['ai-tell-audit'], text: '`ai-tell-audit`' },
];

// DeepSeek hat kein Terminal: Der Scan läuft dort über das Werkzeug und muss wirklich aufgerufen werden.
const DEEPSEEK_ANFORDERUNGEN = [
  ...ANFORDERUNGEN,
  { id: 'scan', skills: [SCAN_WERKZEUG], text: 'das Werkzeug `ai_tell_scan` mit dem fertigen Text' },
];

const ALLE = ['human-voice', 'humanize-rewrite', 'ai-tell-audit'];

// Reihenfolge, in der die Skills in den Regeln stehen und angewendet werden: schreiben, umschreiben, prüfen.
const REIHENFOLGE = ['human-voice', 'humanize-rewrite', 'ai-tell-audit'];

// Platzhalter in ressourcen/regeln.md und Überschrift des Abschnitts, der ihn ersetzt (daran erkennt die App,
// dass der Wortlaut der Skills schon im Systemprompt steht).
const PLATZHALTER = '<!-- MANGO:SCHREIB-SKILLS -->';
const BLOCK_TITEL = '## Schreib-Skills: Wortlaut (zuerst lesen)';

// Frühere Skills: Die App entfernt sie aus bestehenden Arbeitsräumen (nur von der App verwaltete Kopien), damit niemand sie mehr nutzt.
const VERALTET = ['wissenschaftlich-schreiben', 'sprachpruefung', 'stimmenprofil', 'natuerlich-schreiben', 'stilrevision', 'textpruefung'];

// Anforderungen, für die in `geladen` (Menge von Skill- bzw. Werkzeugnamen) noch nichts Passendes vorkommt.
function fehlend(geladen, anbieter = '') {
  return (anbieter === 'deepseek' ? DEEPSEEK_ANFORDERUNGEN : ANFORDERUNGEN).filter((a) => !a.skills.some((s) => geladen.has(s)));
}

// Geladene Schreib-Skills (bei DeepSeek zusätzlich das Scan-Werkzeug) in fester Reihenfolge.
function geladene(geladen, anbieter = '') {
  return [...ALLE, ...(anbieter === 'deepseek' ? [SCAN_WERKZEUG] : [])].filter((s) => geladen.has(s));
}

module.exports = { ANFORDERUNGEN, DEEPSEEK_ANFORDERUNGEN, SCAN_WERKZEUG, ALLE, REIHENFOLGE, PLATZHALTER, BLOCK_TITEL, VERALTET, fehlend, geladene };
