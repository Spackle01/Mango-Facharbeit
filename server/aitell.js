'use strict';
// KI-Merkmale-Scan: JavaScript-Fassung von `ressourcen/skills/ai-tell-audit/scripts/ai_tell_scan.py`.
// Mango liefert ihn mit, weil auf vielen Rechnern kein Python installiert ist. Wörterlisten, Muster, Kennzahlen und
// Berichtsformat entsprechen dem Skript; ein Test vergleicht beide Ausgaben (wenn Python vorhanden ist).
// Eine Heuristik: Ein sauberer Scan beweist nichts, ein auffälliger zeigt, wo man hinschauen sollte.

// Python-Muster (Unicode-Wörter) in JavaScript-Muster mit Flag `u` übersetzen:
// \w und \b gelten in Python für alle Buchstaben, in JavaScript nur für ASCII.
const WZ = '\\p{L}\\p{N}_';
const GRENZE = `(?:(?<![${WZ}])(?=[${WZ}])|(?<=[${WZ}])(?![${WZ}]))`;
function uni(src) {
  let out = '';
  let klasse = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      const n = src[i + 1];
      i += 1;
      if (n === 'w') out += klasse ? WZ : `[${WZ}]`;
      else if (n === 'b' && !klasse) out += GRENZE;
      else out += `\\${n}`;
      continue;
    }
    if (c === '[' && !klasse) klasse = true;
    else if (c === ']' && klasse) klasse = false;
    out += c;
  }
  return out;
}
const re = (src, flags = '') => new RegExp(uni(src), `u${flags}`);

const EM = '—';
const EN = '–';

const WORDS_EN = `delv tapestr testament intricat meticulous pivotal realm showcas underscor
crucial vital landscape navigat foster leverag robust seamless holistic multifaceted
nuanc comprehensive elevat empower unlock harness embark bustling vibrant commendable
notabl additionally furthermore moreover boast garner resonat interplay enhanc streamlin
cutting-edge game-chang paramount noteworthy invaluable ever-evolving synerg spearhead
bolster captivat profound beacon myriad plethora enduring nestled renowned transformative
groundbreaking unwavering endeavo facilitat utiliz insightful intricacies align
revolutioniz dynamic innovative essential`.split(/\s+/);

const WORDS_DE = `maßgeblich vielfältig nahtlos ganzheitlich facettenreich meilenstein unterstreich
unterstrich bereicherung mehrwert essenziell essentiell zudem somit letztendlich gewährleist
herausforderung potenzial innovativ spannend zeugnis eintauchen revolutionier dynamisch
vielseitig fördert förderung ermöglicht nachhaltig zukunftsweisend wegweisend`.split(/\s+/);

const D = `[.,;:${EM}${EN}-]`; // Satzzeichen und Striche innerhalb eines Satzes

// [Bezeichnung, Muster, hart?]  `hart`: Treffer, die immer geändert werden müssen (Chatbot-Reste).
const PHRASES = [
  ['negative parallelism: \'not just X but Y\'', String.raw`\bnot (just|only|merely|simply)\b[^.?!\n]{0,90}\bbut\b`],
  ['negative parallelism: \'it\'s not X, it\'s Y\'', String.raw`\b(it'?s|this is|that'?s|it is|this isn'?t|it isn'?t)\s+not\b[^.?!\n]{0,70}` + D + String.raw`\s*(it'?s|it is|this is|that'?s)\b`],
  ['negative parallelism: \'isn\'t X. It\'s Y\'', String.raw`\bisn'?t (just |only |about |merely )?[^.?!\n]{0,60}` + D + String.raw`\s*(it'?s|it is)\b`],
  ['DE: \'nicht nur ... sondern auch\'', String.raw`\bnicht nur\b[^.?!\n]{0,110}\bsondern\b`],
  ['DE: \'es geht nicht um X, es geht um Y\'', String.raw`\bes geht nicht (nur )?(um|darum)\b[^.?!\n]{0,80}[.,;]\s*(es geht|sondern)\b`],
  ['participle tail (\', highlighting ...\')', String.raw`,\s+(highlighting|underscoring|reflecting|showcasing|emphasi[sz]ing|ensuring|contributing|fostering|demonstrating|illustrating|signal+ing|cementing|solidifying|paving|marking|making it|allowing|enabling|creating a)\b`],
  ['significance inflation', String.raw`\b(stands? as a|serves? as a|a testament to|plays? an? (crucial|vital|pivotal|key|significant|important|central) role|marks? a (significant|pivotal|major)|leaves? a lasting|indelible|rich (history|heritage|tapestry|culture)|deeply rooted|cannot be overstated)\b`],
  ['DE significance inflation', String.raw`\b(spielt eine (entscheidende|zentrale|wichtige|wesentliche|bedeutende) rolle|ein (wichtiger )?meilenstein|ein zeugnis (für|von)|nicht zu unterschätzen|von zentraler bedeutung)\b`],
  ['\'important to note\' hedge', String.raw`\b(it'?s|it is) (important|worth|crucial|essential) to (note|remember|mention|consider)|\bworth noting\b|es ist (wichtig|erwähnenswert|wichtig zu beachten)|es sei (darauf hingewiesen|erwähnt)`],
  ['warm-up opener / signposting', String.raw`\b(in today'?s|in an era|in the ever-|when it comes to|in the realm of|in the world of|imagine a|picture this|let'?s (dive|delve|explore|break)|here'?s the (thing|kicker|catch|deal)|here'?s (why|what|how)|the truth is|the reality is|buckle up|in der heutigen|in einer welt|tauchen wir|lass(t)? uns (eintauchen|einen blick)|wenn es um)\b`],
  ['summary / moral ending', String.raw`\b(in conclusion|in summary|to sum up|all in all|at the end of the day|ultimately,|overall,|the future (looks|is) (bright|promising)|only time will tell|remains to be seen|whether you'?re a|zusammenfassend|abschließend|alles in allem|insgesamt lässt sich|am ende des tages)\b`],
  ['chatbot leftovers', String.raw`(\bcertainly!|\babsolutely!|\bgreat question|\bas an ai\b|as of my (last|knowledge)|\bi'?d be happy to|\bi hope this helps|\blet me know if|\bfeel free to|\bhappy to help|\bgerne helfe ich|\bich hoffe, das hilft|\[(your|insert|name|company|dein|ihr)[^\]]*\])`, true],
  ['vague attribution', String.raw`\b(experts (say|agree|believe|suggest)|studies (show|suggest)|research (shows|suggests)|some (critics|people|argue)|it is (widely|generally) (believed|accepted)|many (believe|argue)|experten (sagen|sind sich einig)|studien zeigen)\b`],
  ['colon / question reveal', String.raw`\b(the (result|answer|catch|kicker|twist|best part|problem|secret|truth|reason|takeaway|bottom line))[?:]|\bdas ergebnis[?:]|\bder clou[?:]`],
  ['false range \'from X to Y\'', String.raw`\bfrom (?![^,.;\n]*\d)[a-z][^,.;\n]{2,40} to [a-z][^,.;\n]{2,40}`],
  ['stock transition', String.raw`\b(darüber hinaus|des weiteren|in diesem zusammenhang|im folgenden|nicht zuletzt|in addition to this|on top of that|that being said|with that in mind)\b`],
  ['\'This + verb\' sentence opener', String.raw`(^|[.!?]\s+)(this|dies) (highlights|underscores|shows|demonstrates|ensures|allows|means|makes|reflects|zeigt|unterstreicht|verdeutlicht|ermöglicht|sorgt)\b`],
].map(([label, src, hart]) => ({ label, re: re(src, 'gim'), hart: !!hart }));

const STIL_RE = [...WORDS_EN, ...WORDS_DE].map((stem) => ({ stem, re: re(String.raw`\b` + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + String.raw`[\wäöüß-]*`, 'g') }));

const RE_WORDS = /[A-Za-zÄÖÜäöüß'-]+/g;
const RE_WORDS_ANY = new RegExp(`[${WZ}]+`, 'gu');
const RE_WORDS_SENT = new RegExp(`[${WZ}'-]+`, 'gu');
const RE_TRIPLETS = re(String.raw`\b[\wäöüß-]+(?: [\wäöüß-]+)?, [\wäöüß-]+(?: [\wäöüß-]+)?,? (?:and|or|und|oder) [\wäöüß-]+`, 'g');

const zaehle = (rx, s) => (String(s).match(rx) || []).length;

function mittel(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function cv(xs) {
  if (xs.length < 2) return 0;
  const m = mittel(xs);
  if (!m) return 0;
  const varianz = xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(varianz) / m;
}

// Gibt alle Kennzahlen und Treffer zurück. Treffer: { label, text, index, hart }.
function scan(eingabe) {
  const text = String(eingabe == null ? '' : eingabe);
  const low = text.toLowerCase();
  const nWords = Math.max(zaehle(RE_WORDS, text), 1);

  const deHits = zaehle(re(String.raw`\b(und|der|die|das|nicht|ist|ich|mit|auch|sich|dass)\b`, 'g'), low);
  const enHits = zaehle(re(String.raw`\b(and|the|is|not|with|that|this|you|it|of)\b`, 'g'), low);
  const lang = deHits > enHits ? 'de' : 'en';

  const hits = [];
  for (const { re: rx } of STIL_RE) {
    rx.lastIndex = 0;
    for (const m of low.matchAll(rx)) hits.push({ label: 'style word', text: m[0], index: m.index, hart: false });
  }
  for (const p of PHRASES) {
    p.re.lastIndex = 0;
    for (const m of text.matchAll(p.re)) hits.push({ label: p.label, text: m[0].trim().slice(0, 80), index: m.index, hart: p.hart });
  }

  RE_TRIPLETS.lastIndex = 0;
  const triplets = text.match(RE_TRIPLETS) || [];

  const em = text.split(EM).length - 1;
  const spacedEn = text.split(` ${EN} `).length - 1;
  const bold = zaehle(/\*\*[^*]+\*\*/g, text);
  const boldLabelBullets = zaehle(/^\s*(?:[-*•]|\d+\.)\s+\*\*[^*]+:?\*\*:?/gm, text);
  const headings = zaehle(/^#{1,6} /gm, text);
  const emoji = zaehle(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, text);
  const curly = text.split('“').length - 1 + (text.split('”').length - 1);
  const germanQuotes = text.split('„').length - 1;

  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => zaehle(RE_WORDS_ANY, s) >= 1);
  const lens = sentences.map((s) => zaehle(RE_WORDS_SENT, s));
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim());
  const plens = paras.map((p) => zaehle(RE_WORDS_ANY, p));

  const starts = new Map();
  for (const s of sentences) {
    const w = s.toLowerCase().match(new RegExp(`[${WZ}']+`, 'gu'));
    if (w) starts.set(w[0], (starts.get(w[0]) || 0) + 1);
  }
  const repStarts = [...starts].filter(([, v]) => v >= 3 && v / Math.max(sentences.length, 1) > 0.15);

  const per100 = (hits.length / nWords) * 100;
  const flach = lens.length >= 5 && cv(lens) < 0.40;
  const flags = per100 + (flach ? 2 : 0) + (em / nWords) * 100 + boldLabelBullets;
  const urteil = flags < 1 ? 'reads clean (by these heuristics)' : flags < 3 ? 'a few tells, fix the flagged spots' : 'reads as AI, rewrite rather than patch';

  return {
    nWords, lang, hits, triplets, em, spacedEn, bold, boldLabelBullets, headings, emoji, curly, germanQuotes,
    sentences, lens, paras, plens, repStarts, per100, flach, flags, urteil,
    absaetzeUngleich: plens.length >= 4 && cv(plens) < 0.30,
    cvSaetze: cv(lens), cvAbsaetze: cv(plens),
  };
}

// Zahl mit d Nachkommastellen wie Pythons `:.df`: Exakte Halbwerte werden zur geraden Ziffer gerundet (toFixed rundet auf).
function fmt(x, d) {
  const lang = Math.abs(x).toFixed(d + 30);
  const rest = lang.slice(-30);
  if (rest === `5${'0'.repeat(29)}`) {
    const abgeschnitten = lang.slice(0, lang.length - 30).replace(/\.$/, '');
    if (Number(abgeschnitten.slice(-1)) % 2 === 0) return (x < 0 ? '-' : '') + abgeschnitten;
  }
  return x.toFixed(d);
}
const f0 = (x) => fmt(x, 0);
const f1 = (x) => fmt(x, 1);
const f2 = (x) => fmt(x, 2);

// Bericht im Format des Python-Skripts (englische Meldungen, wie im Skill beschrieben).
function bericht(s) {
  const L = [];
  L.push(`Words: ${s.nWords} | sentences: ${s.sentences.length} | paragraphs: ${s.paras.length} | language guess: ${s.lang}`);
  L.push('');
  L.push('RHYTHM');
  if (s.lens.length) {
    L.push(`  sentence length: mean ${f1(mittel(s.lens))}, min ${Math.min(...s.lens)}, max ${Math.max(...s.lens)}, variation (CV) ${f2(s.cvSaetze)}`);
    const kurz = (s.lens.filter((x) => x <= 6).length / s.lens.length) * 100;
    const lang = (s.lens.filter((x) => x >= 25).length / s.lens.length) * 100;
    L.push(`  short (<=6 words): ${f0(kurz)}% | long (>=25 words): ${f0(lang)}%`);
    if (s.flach) L.push('  !! flat rhythm: sentences are too similar in length (CV under 0.40)');
  }
  if (s.plens.length >= 3) L.push(`  paragraph length variation (CV): ${f2(s.cvAbsaetze)}${s.absaetzeUngleich ? '  !! paragraphs too uniform' : ''}`);
  if (s.repStarts.length) L.push(`  !! repeated sentence openers: {${s.repStarts.map(([k, v]) => `'${k}': ${v}`).join(', ')}}`);
  L.push('');
  L.push('FORMATTING');
  L.push(`  em dashes: ${s.em} (${f1((s.em / s.nWords) * 1000)} per 1000 words)${s.em ? '  !! cut these' : ''}`);
  if (s.lang === 'en' && s.spacedEn) L.push(`  spaced en dashes used as em dashes: ${s.spacedEn}`);
  if (s.bold) L.push(`  bold spans: ${s.bold}`);
  if (s.boldLabelBullets) L.push(`  !! bold-label bullets ('- **Label:** text'): ${s.boldLabelBullets}`);
  if (s.headings) L.push(`  markdown headings: ${s.headings}  (fine in a doc, a tell in a message/email/essay)`);
  if (s.emoji) L.push(`  emoji: ${s.emoji}`);
  if (s.lang === 'de' && s.curly && !s.germanQuotes) L.push('  !! English-style curly quotes in German text (expected „...“)');
  if (s.lang === 'de' && s.em) L.push('  !! unspaced em dash in German text (German writers use a spaced en dash)');
  L.push('');
  L.push(`RULE OF THREE: ${s.triplets.length} 'X, Y and Z' lists (${f1((s.triplets.length / s.nWords) * 1000)} per 1000 words)`);
  for (const t of s.triplets.slice(0, 6)) L.push(`  - ${t}`);
  L.push('');
  L.push(`PATTERN HITS: ${s.hits.length} (${f1(s.per100)} per 100 words)`);
  const gruppen = new Map();
  for (const h of s.hits) {
    if (!gruppen.has(h.label)) gruppen.set(h.label, []);
    gruppen.get(h.label).push(h.text);
  }
  for (const [label, frags] of [...gruppen].sort((a, b) => b[1].length - a[1].length)) {
    const uniq = [...new Set(frags)];
    L.push(`  [${frags.length}] ${label}: ${uniq.slice(0, 8).join(' | ')}`);
  }
  L.push('');
  L.push(`VERDICT: ${s.urteil}`);
  return L.join('\n');
}

// Satzgrenzen mit Stellung im Text. Abkürzungen („Vgl.“, „S.“, „z. B.“) und offene Klammern beenden keinen Satz,
// ein Zeilenumbruch immer.
const ABK = /(?:^|[\s(])(?:Vgl|vgl|S|bzw|ca|Abb|Tab|Nr|Hrsg|Aufl|Kap|usw|etc|Dr|Prof|z\. ?B|u\. ?a|d\. ?h|o\. ?J|ebd)\.$/;
let spannenText = null;
let spannen = [];
function satzSpannen(text) {
  if (spannenText === text) return spannen;
  const out = [];
  let start = 0;
  let tiefe = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') tiefe += 1;
    else if (c === ')') tiefe = Math.max(0, tiefe - 1);
    let ende = false;
    if (c === '\n') ende = true;
    else if (/[.!?]/.test(c) && tiefe === 0 && (i + 1 === text.length || /\s/.test(text[i + 1])) && !ABK.test(text.slice(Math.max(0, i - 8), i + 1))) ende = true;
    if (ende) {
      if (text.slice(start, i + 1).trim()) out.push([start, i + 1]);
      start = i + 1;
    }
  }
  if (text.slice(start).trim()) out.push([start, text.length]);
  spannenText = text;
  spannen = out;
  return out;
}

// Satz um eine Textstelle herum (für Rückmeldungen mit Textstelle).
function satzUm(text, index) {
  const sp = satzSpannen(text).find(([a, b]) => index >= a && index < b) || [0, text.length];
  return text.slice(sp[0], sp[1]).replace(/\s+/g, ' ').trim();
}

module.exports = { scan, bericht, satzUm, cv };
