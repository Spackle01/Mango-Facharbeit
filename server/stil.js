'use strict';
// Automatische Sprachprüfung nach den Skills `wissenschaftlich-schreiben` und `sprachpruefung`.
// Prüft Texte, die der Assistent in Dateien schreibt, auf typische KI-Muster und zu lange Sätze.
// Eine Heuristik: Sie findet Stellen zum Überarbeiten, kein Urteil über die Autorschaft.

const MAX_WOERTER = 25;

// Stilwörter: einzeln unproblematisch, gehäuft auffällig (Skill, Abschnitt „Wörter“).
const STIL_DE = ['maßgeblich', 'vielfältig', 'nahtlos', 'ganzheitlich', 'facettenreich', 'Meilenstein', 'unterstreicht', 'unterstreichen',
  'Bereicherung', 'Mehrwert', 'essenziell', 'essentiell', 'zudem', 'somit', 'letztendlich', 'gewährleisten', 'gewährleistet', 'innovativ',
  'zukunftsweisend', 'wegweisend'];
const STIL_EN = ['delve', 'tapestry', 'testament', 'intricate', 'meticulous', 'pivotal', 'realm', 'showcase', 'underscore', 'crucial',
  'foster', 'leverage', 'seamless', 'holistic', 'multifaceted', 'nuanced', 'elevate', 'empower', 'unlock', 'harness', 'embark', 'bustling',
  'vibrant', 'garner', 'interplay', 'streamline', 'cutting-edge', 'game-changer', 'paramount', 'noteworthy', 'invaluable', 'ever-evolving',
  'synergy', 'spearhead', 'bolster', 'groundbreaking', 'transformative', 'furthermore', 'moreover', 'additionally', 'notably'];

// Floskeln und Strukturen, die immer überarbeitet werden.
const MUSTER = [
  [/\bin der heutigen (?:Zeit|Welt|Gesellschaft)\b/i, 'Aufwärm-Einstieg'],
  [/\bin einer (?:Welt|Zeit), in der\b/i, 'Aufwärm-Einstieg'],
  [/\bdarüber hinaus\b/i, 'Floskel-Übergang'],
  [/\bdes Weiteren\b/i, 'Floskel-Übergang'],
  [/\bin diesem Zusammenhang\b/i, 'Floskel-Übergang'],
  [/\bes ist (?:wichtig|erwähnenswert) zu (?:beachten|erwähnen|betonen)\b/i, 'Absicherungsfloskel'],
  [/\bes sei (?:darauf hingewiesen|erwähnt)\b/i, 'Absicherungsfloskel'],
  [/\bzusammenfassend lässt sich (?:sagen|festhalten)\b/i, 'Schlussfloskel'],
  [/\bspielt(?:\s+\S+){0,3}\s+eine (?:entscheidende|zentrale|wichtige|wesentliche|bedeutende) Rolle\b/i, 'aufgeblähte Bedeutung'],
  [/\b(?:ist|sind) von (?:zentraler|entscheidender|großer) Bedeutung\b/i, 'aufgeblähte Bedeutung'],
  [/\bein (?:Zeugnis|Beweis) für\b/i, 'aufgeblähte Bedeutung'],
  [/\bnicht zu unterschätzen\b/i, 'aufgeblähte Bedeutung'],
  [/\bnicht nur\b[^.!?]{1,80}\bsondern auch\b/i, '„nicht nur …, sondern auch“'],
  [/,\s*was (?:die|den|das)? ?\w+ (?:unterstreicht|verdeutlicht|hervorhebt)\b/i, 'Anhängsel'],
  [/\b(?:Experten|Fachleute|Studien|Forscher) (?:sagen|zeigen|belegen|meinen)\b(?![^.!?]*\((?:Vgl\.\s*)?[A-ZÄÖÜ][^)]*\d{4})/i, 'vager Beleg ohne Kurzbeleg'],
  [/\btauchen wir ein\b|\blass(?:t)? uns eintauchen\b/i, 'Wegweiser-Floskel'],
  [/\b(?:Gerne!|Ich hoffe, (?:das|dies) hilft|Lass mich wissen|Gute Frage)/i, 'Chatbot-Rest'],
  [/\[(?:Dein|Ihr) Name\]/i, 'Chatbot-Rest'],
  [/\bin today's (?:world|digital age)\b|\bit is important to note\b|\bin conclusion\b/i, 'Floskel (Englisch)'],
];

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STIL_DE_RE = new RegExp(`(?<![\\wäöüß])(${STIL_DE.map(esc).join('|')})(?![\\wäöüß])`, 'gi');
const STIL_EN_RE = new RegExp(`\\b(${STIL_EN.map(esc).join('|')})\\w*\\b`, 'gi');

const ABK = /(?:^|[\s(])(?:Vgl|vgl|S|bzw|ca|Abb|Tab|Nr|Hrsg|Aufl|Kap|usw|etc|Dr|Prof|z\. ?B|u\. ?a|d\. ?h|o\. ?J|ebd)\.$/;

function englisch(text) {
  const en = (text.match(/\b(the|and|of|is|are|with)\b/gi) || []).length;
  const de = (text.match(/\b(der|die|das|und|ist|sind|mit)\b/gi) || []).length;
  return en > de;
}

// Sätze ohne direkte Zitate „…“ und ohne Markdown-Zeichen.
function saetze(text) {
  const clean = String(text)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/„[^“]{0,400}“\s*(\([^)]*\))?/g, ' Zitat ')
    .replace(/^\s*#{1,6}\s.*$/gm, ' ')
    .replace(/^\s*\[KI-Entwurf[^\]]*\]\s*$/gm, ' ')
    .replace(/[*_`>|]/g, ' ');
  const out = [];
  for (const block of clean.split(/\n\s*\n|\n(?=\s*(?:[-•]|\d+[.)])\s)/)) {
    const parts = block.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"(])/);
    // Abkürzungen („Vgl.“, „S.“, „z. B.“) und offene Klammern beenden keinen Satz.
    const merged = [];
    for (const p of parts) {
      const prev = merged[merged.length - 1];
      const offen = prev && (prev.match(/\(/g) || []).length > (prev.match(/\)/g) || []).length;
      if (prev && (ABK.test(prev) || offen)) merged[merged.length - 1] = `${prev} ${p}`;
      else merged.push(p);
    }
    for (const p of merged) if (p.trim()) out.push(p.trim());
  }
  return out;
}

function kurz(s, max = 140) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Liefert gefundene Stellen: [{ satz, grund }]. Höchstens eine Meldung je Satz und Grund.
function pruefen(text) {
  const raw = String(text || '');
  const stellen = [];
  const seen = new Set();
  const add = (satz, grund) => {
    const key = `${satz}|${grund}`;
    if (seen.has(key)) return;
    seen.add(key);
    stellen.push({ satz: kurz(satz), grund });
  };
  const list = saetze(raw);
  const woerter = list.reduce((n, s) => n + s.split(/\s+/).length, 0);
  const istEn = englisch(raw);

  for (const s of list) {
    for (const [re, grund] of MUSTER) if (re.test(s)) add(s, grund);
    if (s.includes('—')) add(s, 'Geviertstrich (—)');
    if (!istEn && /["“”]/.test(s) && !/[„]/.test(s)) add(s, 'englische Anführungszeichen statt „…“');
    const n = s.split(/\s+/).filter((w) => /[\wäöüß]/i.test(w)).length;
    if (n > MAX_WOERTER) add(s, `Satz zu lang (${n} Wörter) – teilen`);
  }

  // Stilwörter: gehäuft (mindestens zwei, bzw. mehr als eins je 150 Wörter).
  const stil = [];
  for (const s of list) {
    const re = istEn ? STIL_EN_RE : STIL_DE_RE;
    re.lastIndex = 0;
    for (const m of s.matchAll(re)) stil.push({ s, wort: m[1] });
  }
  if (stil.length >= Math.max(2, Math.ceil(woerter / 150))) {
    for (const x of stil) add(x.s, `Stilwort „${x.wort}“`);
  }
  return stellen;
}

// Text aus den Änderungen eines ```word-Blocks (nur der neue Text).
function textAusWord(dateien) {
  const out = [];
  for (const d of dateien) {
    const teile = [];
    if (d.neu && d.text) teile.push(d.text);
    for (const op of d.ops || []) {
      if (!op || typeof op !== 'object') continue;
      if (op.text != null && (op.ersetzen != null || op.nach != null || op.vor != null) && !op.alt) teile.push(String(op.text));
      if (Array.isArray(op.zellen)) teile.push(op.zellen.map(String).join('. '));
      if (op.unterschrift) teile.push(String(op.unterschrift));
    }
    if (teile.length) out.push({ datei: d.datei, text: teile.join('\n\n') });
  }
  return out;
}

// Neu hinzugekommene Zeilen einer Textdatei (gegenüber der vorherigen Fassung).
function neueZeilen(vorher, nachher) {
  const alt = new Set(String(vorher || '').split('\n').map((l) => l.trim()));
  return String(nachher || '').split('\n').filter((l) => l.trim() && !alt.has(l.trim())).join('\n');
}

// Nachricht an den Assistenten mit den gefundenen Stellen (für den Überarbeitungsdurchlauf).
function korrekturPrompt(funde, extrakte = {}) {
  const L = ['Automatische Sprachprüfung (Skills `sprachpruefung` und `wissenschaftlich-schreiben`) deines gerade eingetragenen Textes. Überarbeite nur diese Stellen, direkt in der Datei: kurz und einfach, ohne neue Inhalte. Antworte danach nur mit „Überarbeitet.“ und dem nötigen Block.'];
  for (const f of funde) {
    const hinweis = extrakte[f.datei] ? ` (Word: Block \`word\`, aktuelle Absatznummern in ${extrakte[f.datei]})` : ' (Edit)';
    L.push('', `${f.datei}${hinweis}:`);
    for (const s of f.stellen.slice(0, 12)) L.push(`- „${s.satz}“ – ${s.grund}`);
  }
  return L.join('\n');
}

module.exports = { pruefen, textAusWord, neueZeilen, korrekturPrompt, saetze, MAX_WOERTER };
