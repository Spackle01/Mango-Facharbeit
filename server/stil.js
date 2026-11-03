'use strict';
// Automatische Sprachprüfung zum Skill `textpruefung`.
// Prüft Texte, die der Assistent in Dateien schreibt, auf Chatbot-Reste, Floskeln, Stilwörter und lange Sätze.
// Eine Heuristik: Sie findet Stellen zum Prüfen, kein Urteil über die Autorschaft. Wortlisten sind nur Suchhilfen
// (so auch die Skills): Nur Chatbot-Reste und falsche Anführungszeichen müssen immer geändert werden, bei allen
// anderen Treffern entscheidet der Assistent im Zusammenhang des Textes.

const MAX_WOERTER = 25;

// Stilwörter: einzeln unproblematisch, gehäuft auffällig.
const STIL_DE = ['maßgeblich', 'vielfältig', 'nahtlos', 'ganzheitlich', 'facettenreich', 'Meilenstein', 'unterstreicht', 'unterstreichen',
  'Bereicherung', 'Mehrwert', 'essenziell', 'essentiell', 'zudem', 'somit', 'letztendlich', 'gewährleisten', 'gewährleistet', 'innovativ',
  'zukunftsweisend', 'wegweisend'];
const STIL_EN = ['delve', 'tapestry', 'testament', 'intricate', 'meticulous', 'pivotal', 'realm', 'showcase', 'underscore', 'crucial',
  'foster', 'leverage', 'seamless', 'holistic', 'multifaceted', 'nuanced', 'elevate', 'empower', 'unlock', 'harness', 'embark', 'bustling',
  'vibrant', 'garner', 'interplay', 'streamline', 'cutting-edge', 'game-changer', 'paramount', 'noteworthy', 'invaluable', 'ever-evolving',
  'synergy', 'spearhead', 'bolster', 'groundbreaking', 'transformative', 'furthermore', 'moreover', 'additionally', 'notably'];

// Floskeln und Strukturen: Prüfhinweise. Ein dritter Eintrag `true` markiert Treffer, die immer geändert werden müssen.
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
  [/\b(?:Gerne!|Ich hoffe, (?:das|dies) hilft|Lass mich wissen|Gute Frage)/i, 'Chatbot-Rest', true],
  [/\[(?:Dein|Ihr) Name\]/i, 'Chatbot-Rest', true],
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

// Liefert gefundene Stellen: [{ satz, grund, hart? }]. Höchstens eine Meldung je Satz und Grund.
// `hart`: muss geändert werden; alle anderen Stellen sind Prüfhinweise.
function pruefen(text) {
  const raw = String(text || '');
  const stellen = [];
  const seen = new Set();
  const add = (satz, grund, hart = false) => {
    const key = `${satz}|${grund}`;
    if (seen.has(key)) return;
    seen.add(key);
    stellen.push(hart ? { satz: kurz(satz), grund, hart: true } : { satz: kurz(satz), grund });
  };
  const list = saetze(raw);
  const woerter = list.reduce((n, s) => n + s.split(/\s+/).length, 0);
  const istEn = englisch(raw);

  for (const s of list) {
    for (const [re, grund, hart] of MUSTER) if (re.test(s)) add(s, grund, !!hart);
    if (s.includes('—')) add(s, 'Geviertstrich (—)');
    if (!istEn && /["“”]/.test(s) && !/[„]/.test(s)) add(s, 'englische Anführungszeichen statt „…“', true);
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
// `fehlendeSkills`: Beschreibungen der Pflicht-Skills, die nicht geladen wurden (siehe schreibskills.js).
function korrekturPrompt(funde, extrakte = {}, { fehlendeSkills = [], dateien = [] } = {}) {
  const L = [];
  if (fehlendeSkills.length) {
    L.push(`Du hast für den eben eingetragenen Text die Pflicht-Skills nicht geladen (${fehlendeSkills.join(', ')}). Lade sie jetzt mit dem Skill-Werkzeug, in dieser Reihenfolge: \`stimmenprofil\`, dann \`natuerlich-schreiben\` bzw. \`stilrevision\`, dann \`textpruefung\`. Überarbeite den Text in ${dateien.map((d) => `\`${d}\`${extrakte[d] ? ` (Word: Block \`word\`, aktuelle Absatznummern in ${extrakte[d]})` : ''}`).join(', ')} mit ihnen direkt in der Datei: Stimme der Person, Fakten und Unsicherheit erhalten, nichts Neues erfinden, kurz und einfach. Ist der Text schon passend, lass ihn unverändert. Antworte danach nur mit „Überarbeitet.“ und dem nötigen Block.`);
  }
  if (funde.length) {
    L.push(fehlendeSkills.length
      ? 'Die automatische Prüfung hat außerdem diese Stellen gefunden. Sie sind Suchhilfen: Stellen mit „(ändern)“ änderst du immer, bei den übrigen änderst du nur, wenn sie in diesem Text schlechter sind als eine Alternative.'
      : 'Automatische Sprachprüfung (Skill `textpruefung`) deines gerade eingetragenen Textes. Die Treffer sind Suchhilfen, keine Urteile: Stellen mit „(ändern)“ änderst du immer. Die übrigen prüfst du im Zusammenhang und änderst sie nur, wenn sie in diesem Text schlechter sind als eine Alternative (kleinster Eingriff, Skill `stilrevision`). Eine passende Stelle bleibt, wie sie ist. Keine neuen Inhalte, Stimme der Person und Fakten erhalten. Antworte danach nur mit „Überarbeitet.“ und dem nötigen Block.');
  }
  for (const f of funde) {
    const hinweis = extrakte[f.datei] ? ` (Word: Block \`word\`, aktuelle Absatznummern in ${extrakte[f.datei]})`
      : /\.(pdf|pptx|xlsx)$/i.test(f.datei) ? ' (Block `erstellen` mit "ersetzen": true und dem vollständigen überarbeiteten Text)' : ' (Edit)';
    L.push('', `${f.datei}${hinweis}:`);
    for (const s of f.stellen.slice(0, 12)) L.push(`- „${s.satz}“ – ${s.grund}${s.hart ? ' (ändern)' : ''}`);
  }
  return L.join('\n');
}

// Nachricht, wenn der Assistent einen Text im Chat geschrieben hat, ohne die Pflicht-Skills zu laden:
// Er soll sie laden und den Text komplett neu ausgeben (die App ersetzt die erste Fassung).
function chatNachholenPrompt(fehlendeSkills) {
  return `Du hast in deiner Antwort einen Text geschrieben, ohne die Pflicht-Skills zu laden (${fehlendeSkills.join(', ')}). Lade jetzt alle drei Schritte mit dem Skill-Werkzeug, in dieser Reihenfolge: \`stimmenprofil\`, dann \`natuerlich-schreiben\` bzw. \`stilrevision\`, dann \`textpruefung\`. Schreib den Text mit ihnen neu bzw. überarbeite ihn: Stimme der Person, Fakten und Unsicherheit erhalten, nichts erfinden, kurz und einfach. Prüfe ihn danach mit \`textpruefung\` und behebe die Befunde. Gib dann deine ganze Antwort noch einmal aus, mit der neuen Fassung des Textes und allen Blöcken, die schon in der ersten Antwort standen. Kein Hinweis auf die Überarbeitung.`;
}

module.exports = { pruefen, textAusWord, neueZeilen, korrekturPrompt, chatNachholenPrompt, saetze, MAX_WOERTER };
