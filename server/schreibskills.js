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

// Anforderungen, für die in `geladen` (Menge von Skill-Namen) noch kein passender Skill vorkommt.
function fehlend(geladen) {
  return ANFORDERUNGEN.filter((a) => !a.skills.some((s) => geladen.has(s)));
}

// Geladene Schreib-Skills in fester Reihenfolge.
function geladene(geladen) {
  return ALLE.filter((s) => geladen.has(s));
}

module.exports = { ANFORDERUNGEN, ALLE, REIHENFOLGE, PLATZHALTER, BLOCK_TITEL, DEEPSEEK_TITEL, VERALTET, fehlend, geladene };
