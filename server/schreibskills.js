'use strict';
// Die Schreib-Skills (Paket „Huminizer GER V2“) und die Pflicht, sie bei jedem Text zu nutzen.
// Ein Text braucht drei Schritte: Stimme klären, schreiben oder überarbeiten, prüfen.

const ANFORDERUNGEN = [
  { id: 'stimme', skills: ['stimmenprofil'], text: '`stimmenprofil`' },
  { id: 'schreiben', skills: ['natuerlich-schreiben', 'stilrevision'], text: '`natuerlich-schreiben` (neuer Text) oder `stilrevision` (vorhandener Text)' },
  { id: 'pruefung', skills: ['textpruefung'], text: '`textpruefung`' },
];

const ALLE = ['natuerlich-schreiben', 'stilrevision', 'stimmenprofil', 'textpruefung'];

// Reihenfolge, in der die Skills in den Regeln stehen und angewendet werden: Stimme, schreiben bzw. überarbeiten, prüfen.
const REIHENFOLGE = ['stimmenprofil', 'natuerlich-schreiben', 'stilrevision', 'textpruefung'];

// Platzhalter in ressourcen/regeln.md und Überschrift des Abschnitts, der ihn ersetzt (daran erkennt die App,
// dass der Wortlaut der Skills schon im Systemprompt steht).
const PLATZHALTER = '<!-- MANGO:SCHREIB-SKILLS -->';
const BLOCK_TITEL = '## Schreib-Skills: Wortlaut (zuerst lesen)';
// Für DeepSeek steht statt der vier Skills die eigene Schreib-Anleitung mit Werkzeugen (ressourcen/deepseek/schreiben.md).
const DEEPSEEK_TITEL = '## Schreib-Anleitung für DeepSeek (zuerst lesen)';

// Frühere Skills: Die App entfernt sie aus bestehenden Arbeitsräumen, damit niemand sie mehr nutzt.
const VERALTET = ['wissenschaftlich-schreiben', 'sprachpruefung'];

// DeepSeek: Statt der Skills gelten Schreibwerkzeuge (server/stimme.js). Pflicht bei jedem Text sind dieselben drei Schritte.
const DEEPSEEK_WERKZEUGE = ['voice_profile', 'voice_import', 'humanize_scan', 'humanize_rewrite', 'voice_score', 'voice_rewrite'];
const DEEPSEEK_ANFORDERUNGEN = [
  { id: 'stimme', skills: ['voice_profile', 'voice_import'], text: '`voice_profile` (gibt es kein Profil: `voice_import`)' },
  { id: 'schreiben', skills: ['voice_rewrite', 'humanize_rewrite'], text: '`voice_rewrite` (mit Profil) oder `humanize_rewrite`' },
  { id: 'pruefung', skills: ['humanize_scan'], text: '`humanize_scan`' },
];

// Anforderungen, für die in `geladen` (Menge von Skill- bzw. Werkzeugnamen) noch nichts Passendes vorkommt.
function fehlend(geladen, anbieter = '') {
  return (anbieter === 'deepseek' ? DEEPSEEK_ANFORDERUNGEN : ANFORDERUNGEN).filter((a) => !a.skills.some((s) => geladen.has(s)));
}

// Geladene Schreib-Skills bzw. genutzte Schreibwerkzeuge in fester Reihenfolge.
function geladene(geladen, anbieter = '') {
  return (anbieter === 'deepseek' ? DEEPSEEK_WERKZEUGE : ALLE).filter((s) => geladen.has(s));
}

module.exports = { ANFORDERUNGEN, DEEPSEEK_ANFORDERUNGEN, DEEPSEEK_WERKZEUGE, ALLE, REIHENFOLGE, PLATZHALTER, BLOCK_TITEL, DEEPSEEK_TITEL, VERALTET, fehlend, geladene };
