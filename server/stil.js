'use strict';
// Automatische Sprachprüfung zum Skill `ai-tell-audit`: Mango lässt nach dem Schreiben den Scan des Skills laufen
// (server/aitell.js, Nachbau von ai_tell_scan.py) und gibt die Fundstellen mit dem Satz an die KI zurück.
// Eine Heuristik: Sie findet Stellen zum Prüfen, kein Urteil über die Autorschaft. Nur Chatbot-Reste, Geviertstriche
// und falsche Anführungszeichen müssen immer geändert werden; über alle anderen Treffer entscheidet die KI im Zusammenhang.
const aitell = require('./aitell');
const schreibskills = require('./schreibskills');

// Bezeichnungen des Scans auf Deutsch (so stehen sie in der Rückmeldung an die KI und in der App).
const GRUND = {
  "negative parallelism: 'not just X but Y'": '„nicht nur X, sondern Y“-Muster',
  "negative parallelism: 'it's not X, it's Y'": '„nicht X, sondern Y“-Muster',
  "negative parallelism: 'isn't X. It's Y'": '„nicht X, sondern Y“-Muster',
  "DE: 'nicht nur ... sondern auch'": '„nicht nur …, sondern auch“',
  "DE: 'es geht nicht um X, es geht um Y'": '„es geht nicht um X, sondern um Y“',
  "participle tail (', highlighting ...')": 'Anhängsel am Satzende („…, was unterstreicht“)',
  'significance inflation': 'aufgeblähte Bedeutung',
  'DE significance inflation': 'aufgeblähte Bedeutung',
  "'important to note' hedge": 'Absicherungsfloskel',
  'warm-up opener / signposting': 'Aufwärm-Einstieg',
  'summary / moral ending': 'Schlussfloskel',
  'chatbot leftovers': 'Chatbot-Rest',
  'vague attribution': 'vager Beleg ohne Quelle',
  'colon / question reveal': 'Enthüllungstrick („Das Ergebnis:“)',
  "false range 'from X to Y'": 'falsche Spannweite („von … bis …“)',
  'stock transition': 'Floskel-Übergang',
  "'This + verb' sentence opener": 'Satzanfang „Dies zeigt/unterstreicht …“',
};

// Deutsche Chatbot-Reste, die das Skript nicht kennt: müssen immer geändert werden.
const CHATBOT_DE = /\b(?:Gerne!|Sehr gerne!|Gute Frage|Lass mich wissen|Sag Bescheid, wenn)/i;

// Weitere deutsche Muster, die das Skript nicht erfasst (Wörter zwischen „spielt“ und „eine Rolle“).
const BEDEUTUNG_DE = /\bspielt(?:\s+\S+){1,3}\s+eine (?:entscheidende|zentrale|wichtige|wesentliche|bedeutende) Rolle\b/gi;

// Deutsch ist die Voreinstellung; nur ein Text mit mehr englischen als deutschen Funktionswörtern gilt als englisch.
function englisch(text) {
  const en = (text.match(/\b(the|and|of|is|are|with)\b/gi) || []).length;
  const de = (text.match(/\b(der|die|das|und|ist|sind|mit)\b/gi) || []).length;
  return en > de;
}

// Ein Kurzbeleg im Satz (Autor Jahr) macht „Studien zeigen“ zu einem belegten Satz.
const KURZBELEG = /\((?:Vgl\.\s*)?[A-ZÄÖÜ][^)]*\d{4}/;

function kurz(s, max = 140) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Text für den Scan: ohne Kommentare, KI-Vermerk und Überschriften; direkte Zitate „…“ zählen nicht als eigene Sprache.
function bereinigen(text) {
  return String(text || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s*\[KI-Entwurf[^\]]*\]\s*$/gm, '')
    .replace(/„[^“]{0,400}“\s*(\([^)]*\))?/g, ' Zitat ')
    .replace(/^\s*#{1,6}\s.*$/gm, '');
}

// Auswertung eines Textes: { stellen: [{ satz, grund, hart? }], urteil, schwer }.
// `schwer`: lohnt eine Überarbeitung (harte Treffer, mindestens zwei Stellen (bei längeren Texten eine je 100 Wörter) oder bei Texten ab 40 Wörtern das Urteil „reads as AI“ des Scans).
// Stellen ohne `satz` betreffen den ganzen Text (Rhythmus).
function bewerten(text) {
  const t = bereinigen(text);
  const s = aitell.scan(t);
  const stellen = [];
  const seen = new Set();
  const add = (satz, grund, hart = false) => {
    const key = `${satz}|${grund}`;
    if (seen.has(key)) return;
    seen.add(key);
    stellen.push(hart ? { satz: kurz(satz), grund, hart: true } : { satz: kurz(satz), grund });
  };

  // Musterfunde. Stilwörter zählen erst gehäuft (mindestens zwei, bzw. mehr als eins je 150 Wörter): Eines ist unproblematisch.
  const stil = s.hits.filter((h) => h.label === 'style word');
  const stilMeldet = stil.length >= Math.max(2, Math.ceil(s.nWords / 150));
  for (const h of s.hits) {
    if (h.label === 'style word') { if (stilMeldet) add(aitell.satzUm(t, h.index), `Stilwort „${h.text}“`); continue; }
    const satz = aitell.satzUm(t, h.index);
    if (h.label === 'vague attribution' && KURZBELEG.test(satz)) continue;
    add(satz, GRUND[h.label] || h.label, h.hart);
  }

  for (const m of t.matchAll(new RegExp(CHATBOT_DE.source, 'gi'))) add(aitell.satzUm(t, m.index), 'Chatbot-Rest', true);

  for (const m of t.matchAll(BEDEUTUNG_DE)) add(aitell.satzUm(t, m.index), 'aufgeblähte Bedeutung');

  // Form: Geviertstriche, falsche Anführungszeichen, fette Etiketten, Emojis.
  const deutsch = !englisch(t);
  for (const m of t.matchAll(/—/g)) add(aitell.satzUm(t, m.index), 'Geviertstrich (—): Komma, Punkt, Doppelpunkt oder Klammer', true);
  if (deutsch) {
    for (const m of t.matchAll(/["“”]/g)) add(aitell.satzUm(t, m.index), 'englische Anführungszeichen statt „…“', true);
  }
  for (const m of t.matchAll(/^\s*(?:[-*•]|\d+\.)\s+\*\*[^*]+:?\*\*:?.*$/gm)) add(m[0].trim(), 'Stichpunkt mit fettem Etikett');
  for (const m of t.matchAll(/[\u{1F300}-\u{1FAFF}☀-➿]/gu)) add(aitell.satzUm(t, m.index), 'Emoji');

  // Dreierreihen: erst gehäuft ein Hinweis.
  if (s.triplets.length >= 3) for (const x of s.triplets.slice(0, 4)) add(x, 'Dreierreihe: zwei, vier oder ein Beispiel statt drei');

  // Rhythmus des ganzen Textes.
  if (s.flach) add('', `Satzlängen zu gleichförmig (Variation ${s.cvSaetze.toFixed(2)}, gut ab 0,40): kurze und lange Sätze mischen`);
  if (s.absaetzeUngleich) add('', 'Absätze alle ähnlich lang: ungleiche Längen, auch einzeilige Absätze');
  for (const [wort, n] of s.repStarts) add('', `${n} Sätze beginnen mit „${wort}“: Satzanfänge ändern`);

  const schwer = stellen.some((x) => x.hart) || stellen.length >= Math.max(2, Math.ceil(s.nWords / 100)) || (s.nWords >= 40 && s.urteil === 'reads as AI, rewrite rather than patch');
  return { stellen, urteil: s.urteil, schwer };
}

// Liefert gefundene Stellen: [{ satz, grund, hart? }].
function pruefen(text) {
  return bewerten(text).stellen;
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

// Anweisung für fehlende Pflichtschritte, je nach Anbieter und danach, was fehlt (Skills und/oder das Scan-Werkzeug).
function schritte(fehlend, anbieter) {
  const skills = fehlend.some((x) => !x.includes('ai_tell_scan'));
  const scan = fehlend.some((x) => x.includes('ai_tell_scan'));
  const teile = [];
  if (skills) teile.push(`${schreibskills.hatScanWerkzeug(anbieter) ? 'Lies' : 'Lade'} dafür \`human-voice\` (neuer Text) bzw. \`humanize-rewrite\` (vorhandener Text) und \`ai-tell-audit\` mit dem Skill-Werkzeug.`);
  if (scan) teile.push('Ruf `ai_tell_scan` mit dem fertigen Text auf und behebe die Befunde.');
  return teile.join(' ');
}

function stellenZeilen(funde, extrakte) {
  const L = [];
  for (const f of funde) {
    const hinweis = extrakte[f.datei] ? ` (Word: Block \`word\`, aktuelle Absatznummern in ${extrakte[f.datei]})`
      : /\.(pdf|pptx|xlsx)$/i.test(f.datei) ? ' (Block `erstellen` mit "ersetzen": true und dem vollständigen überarbeiteten Text)' : ' (Edit)';
    L.push('', `${f.datei}${hinweis}:`);
    for (const s of f.stellen.slice(0, 12)) L.push(s.satz ? `- „${s.satz}“ – ${s.grund}${s.hart ? ' (ändern)' : ''}` : `- Ganzer Text – ${s.grund}`);
  }
  return L;
}

// Nachricht an den Assistenten mit den gefundenen Stellen (für den Überarbeitungsdurchlauf).
// `fehlendeSkills`: Beschreibungen der Pflichtschritte, die nicht erfüllt wurden (siehe schreibskills.js).
function korrekturPrompt(funde, extrakte = {}, { fehlendeSkills = [], dateien = [], anbieter = '' } = {}) {
  const L = [];
  const orte = dateien.map((d) => `\`${d}\`${extrakte[d] ? ` (Word: Block \`word\`, aktuelle Absatznummern in ${extrakte[d]})` : ''}`).join(', ');
  if (fehlendeSkills.length) {
    L.push(`Für den eben eingetragenen Text fehlt noch: ${fehlendeSkills.join(', ')}. ${schritte(fehlendeSkills, anbieter)} Überarbeite den Text in ${orte} danach direkt in der Datei: nach \`humanize-rewrite\` (Inhalt herausziehen, Form neu bauen, nicht Satz für Satz ändern), Stimme der Person, Fakten und Unsicherheit erhalten, nichts Neues erfinden, kurz und einfach. Ist der Text schon passend, lass ihn unverändert. Antworte danach nur mit „Überarbeitet.“ und dem nötigen Block.`);
  }
  if (funde.length) {
    L.push(fehlendeSkills.length
      ? 'Der Scan von `ai-tell-audit` (Mango hat ihn für dich ausgeführt) hat außerdem diese Stellen gefunden. Sie sind Suchhilfen: Stellen mit „(ändern)“ änderst du immer, die übrigen nur, wenn sie in diesem Text schlechter sind als eine Alternative.'
      : 'Mango hat den Scan von `ai-tell-audit` auf deinen gerade eingetragenen Text angewendet. Die Treffer sind Suchhilfen, keine Urteile: Stellen mit „(ändern)“ änderst du immer. Die übrigen prüfst du im Zusammenhang und änderst sie nur, wenn sie in diesem Text schlechter sind als eine Alternative. Stellen, die den ganzen Text betreffen (Rhythmus, Absätze), löst du durch Umbauen, nicht durch Austauschen einzelner Wörter (`humanize-rewrite`). Keine neuen Inhalte, Stimme der Person und Fakten erhalten. Antworte danach nur mit „Überarbeitet.“ und dem nötigen Block.');
    L.push(...stellenZeilen(funde, extrakte));
  }
  return L.join('\n');
}

// Nachricht, wenn der Assistent einen Text im Chat geschrieben hat, ohne die Pflichtschritte zu erfüllen oder mit auffälligem Scan:
// Er soll sie nachholen und den Text komplett neu ausgeben (die App ersetzt die erste Fassung).
function chatNachholenPrompt(fehlendeSkills, anbieter = '', stellen = []) {
  const teile = [];
  if (fehlendeSkills.length) teile.push(`Du hast in deiner Antwort einen Text geschrieben, ohne dass folgendes erfüllt war: ${fehlendeSkills.join(', ')}. ${schritte(fehlendeSkills, anbieter)}`);
  else teile.push('Du hast in deiner Antwort einen Text geschrieben. Der Scan von `ai-tell-audit` (Mango hat ihn für dich ausgeführt) findet darin noch Muster.');
  if (stellen.length) {
    teile.push(`Fundstellen (Suchhilfen; „(ändern)“ immer ändern):\n${stellen.slice(0, 12).map((s) => (s.satz ? `- „${s.satz}“ – ${s.grund}${s.hart ? ' (ändern)' : ''}` : `- Ganzer Text – ${s.grund}`)).join('\n')}`);
  }
  teile.push('Schreib den Text mit `humanize-rewrite` neu bzw. überarbeite ihn: Inhalt herausziehen, Form neu bauen, Stimme der Person, Fakten und Unsicherheit erhalten, nichts erfinden, kurz und einfach. Prüfe ihn danach mit `ai-tell-audit` und behebe die Befunde. Gib dann deine ganze Antwort noch einmal aus, mit der neuen Fassung des Textes und allen Blöcken, die schon in der ersten Antwort standen. Kein Hinweis auf die Überarbeitung.');
  return teile.join('\n\n');
}

module.exports = { pruefen, bewerten, textAusWord, neueZeilen, korrekturPrompt, chatNachholenPrompt };
