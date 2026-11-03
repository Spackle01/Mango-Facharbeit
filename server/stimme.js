'use strict';
// Schreibwerkzeuge für DeepSeek: Muster-Scan, Stil-Fingerabdruck aus eigenen Texten, Ähnlichkeit zur Stimme der
// Person und Umschreib-Anleitungen. Alles deterministisch, ohne Modellaufruf: Die KI schreibt selbst um.
//
// Das Prinzip stammt aus „dsh-humanizer“ (lynote-ai, BSD-3-Clause, siehe ressourcen/deepseek/LIZENZ-dsh-humanizer.txt):
// nicht „wie irgendein Mensch“, sondern „wie ich“ schreiben. Hier ist es für deutsche Texte neu geschrieben und mit
// den Regeln und Mustern der Schreib-Skills (Huminizer GER V2) verbunden. Es gibt bewusst keinen „KI-Wert“: Die
// Befunde zeigen Stellen zum Prüfen, die Ähnlichkeit misst die Nähe zur Schreibweise der Person (Qualität), nicht
// das Urteil eines Erkennungsprogramms.
const stil = require('./stil');

const KURZ = 8; // Sätze unter so vielen Wörtern gelten als kurz
const LANG = 25; // Sätze über so vielen Wörtern gelten als lang

const STOP = new Set(('der die das den dem des ein eine einen einem einer eines und oder aber auch als wie wenn dass weil ob zu zum zur von vom mit ' +
  'bei nach aus auf an in im um für über unter vor bis durch gegen ohne ist sind war waren wird werden wurde wurden hat haben hatte hatten sein seine ' +
  'ich du er sie es wir ihr mich mir dich dir ihn ihm uns euch sich nicht nur noch schon sehr mehr so da dann denn doch man kann können konnte muss ' +
  'müssen soll sollen will wollen dies diese dieser dieses jede jeder jedes alle dabei dafür damit dazu hier dort jetzt immer wieder ganz mal').split(' '));

const ICH = ['ich', 'mir', 'mich', 'mein\\p{L}*', 'wir', 'uns', 'unser\\p{L}*'];
const DU = ['du', 'dir', 'dich', 'dein\\p{L}*', 'euch'];
const ABSICHERUNG = ['vielleicht', 'eventuell', 'möglicherweise', 'wohl', 'eher', 'ziemlich', 'relativ', 'gewissermaßen', 'sozusagen', 'irgendwie',
  'eigentlich', 'könnte', 'dürfte', 'scheint', 'scheinbar', 'anscheinend', 'offenbar', 'tendenziell'];
const UEBERGANG = ['zudem', 'außerdem', 'darüber hinaus', 'des weiteren', 'ferner', 'somit', 'folglich', 'demnach', 'dennoch', 'nichtsdestotrotz',
  'allerdings', 'insgesamt', 'letztendlich', 'schließlich'];

// ---------- Hilfen ----------

const woerterListe = (s) => String(s).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const wc = (s) => woerterListe(s).length;
const tokens = (t) => (String(t).toLowerCase().match(/\p{L}[\p{L}\p{N}-]*/gu) || []).filter((x) => x.length > 1);
const mittel = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const abw = (a) => { if (a.length < 2) return 0; const m = mittel(a); return Math.sqrt(mittel(a.map((x) => (x - m) ** 2))); };
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
const runde = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
const de = (x) => String(x).replace('.', ',');
const je100 = (n, w) => (w ? runde((n / w) * 100, 2) : 0);

function zaehle(text, liste) {
  const re = new RegExp(`(?<![\\p{L}])(?:${liste.map((w) => w.replace(/ /g, '\\s+')).join('|')})(?![\\p{L}])`, 'giu');
  return (String(text).match(re) || []).length;
}

const erster = (satz) => (String(satz).trim().split(/\s+/)[0] || '').replace(/^[„"“”‚‘’([{\-–—]+/, '').replace(/[,.:;!?]+$/, '').toLowerCase();

// ---------- Stil-Fingerabdruck ----------

// Kennzahlen der Schreibweise aus Textproben (Satzlänge, Rhythmus, Zeichen, Haltung, Wortschatz).
function fingerabdruck(proben) {
  const korpus = (proben || []).map(String).filter((t) => t.trim()).join('\n\n');
  const saetze = stil.saetze(korpus);
  const laengen = saetze.map(wc);
  const w = laengen.reduce((a, b) => a + b, 0);
  const z = (re) => (korpus.match(re) || []).length;
  const haeufig = new Map();
  const toks = tokens(korpus);
  // Typische Wörter: nur klein geschriebene (Verben, Adjektive, Adverbien), keine Hauptwörter und Namen. Sonst würde die KI
  // Themenwörter des Beispieltextes als „Stil“ übernehmen.
  for (const t of korpus.match(/(?<![\p{L}\p{N}-])\p{Ll}[\p{L}\p{N}-]+/gu) || []) if (!STOP.has(t) && t.length > 2) haeufig.set(t, (haeufig.get(t) || 0) + 1);
  const anfaenge = new Map();
  for (const s of saetze) { const a = erster(s); if (a.length > 1) anfaenge.set(a, (anfaenge.get(a) || 0) + 1); }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([wort, anzahl]) => ({ wort, anzahl }));
  return {
    proben: (proben || []).filter((t) => String(t).trim()).length,
    woerter: w,
    saetze: saetze.length,
    satz: {
      mittel: runde(mittel(laengen)), median: runde(median(laengen)), streuung: runde(abw(laengen)),
      kurz: laengen.length ? runde(laengen.filter((n) => n < KURZ).length / laengen.length, 3) : 0,
      lang: laengen.length ? runde(laengen.filter((n) => n > LANG).length / laengen.length, 3) : 0,
    },
    zeichen: {
      komma: je100(z(/,/g), w), gedankenstrich: je100(z(/[—–]|--/g), w), doppelpunkt: je100(z(/:/g), w), semikolon: je100(z(/;/g), w),
      klammer: je100(z(/[()]/g), w), ausruf: je100(z(/!/g), w), frage: je100(z(/\?/g), w),
    },
    haltung: {
      ich: je100(zaehle(korpus, ICH), w), du: je100(zaehle(korpus, DU), w),
      absicherung: je100(zaehle(korpus, ABSICHERUNG), w), uebergang: je100(zaehle(korpus, UEBERGANG), w),
    },
    wortschatz: { vielfalt: toks.length ? runde(new Set(toks).size / toks.length, 3) : 0, haeufig: top(haeufig, 12), anfaenge: top(anfaenge, 6) },
  };
}

// ---------- Ähnlichkeit zur Stimme der Person ----------

const nah = (a, b, toleranz) => {
  const d = Math.abs(a - b);
  return d <= toleranz ? 1 : Math.max(0, 1 - (d - toleranz) / (3 * toleranz));
};
const kosinus = (a, b) => {
  const k = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0; let na = 0; let nb = 0;
  for (const x of k) { const va = a[x] || 0; const vb = b[x] || 0; dot += va * vb; na += va * va; nb += vb * vb; }
  if (!na || !nb) return na === nb ? 1 : 0;
  return dot / Math.sqrt(na * nb);
};
const ueberlapp = (a, b) => {
  if (!a.length || !b.length) return 0;
  const s = new Set(b.map((x) => x.wort));
  return a.filter((x) => s.has(x.wort)).length / Math.min(a.length, b.length);
};

// Vergleicht den Fingerabdruck eines Entwurfs mit dem Profil. Ergebnis: { punkte 0–100, merkmale }.
function aehnlichkeit(entwurf, profil) {
  const merkmale = [
    { merkmal: 'Satzlänge', aehnlichkeit: nah(entwurf.satz.mittel, profil.satz.mittel, 2.5), gewicht: 0.2 },
    { merkmal: 'Rhythmus (Streuung der Satzlängen)', aehnlichkeit: nah(entwurf.satz.streuung, profil.satz.streuung, 2), gewicht: 0.2 },
    { merkmal: 'Zeichensetzung', aehnlichkeit: kosinus(entwurf.zeichen, profil.zeichen), gewicht: 0.15 },
    { merkmal: 'Haltung (Ich-Form, Absicherungen, Übergangswörter)', gewicht: 0.15, aehnlichkeit: (nah(entwurf.haltung.ich, profil.haltung.ich, 1) + nah(entwurf.haltung.du, profil.haltung.du, 1)
      + nah(entwurf.haltung.absicherung, profil.haltung.absicherung, 0.5) + nah(entwurf.haltung.uebergang, profil.haltung.uebergang, 0.5)) / 4 },
    { merkmal: 'Wortschatz', aehnlichkeit: ueberlapp(entwurf.wortschatz.haeufig, profil.wortschatz.haeufig), gewicht: 0.15 },
    { merkmal: 'Mischung aus kurzen und langen Sätzen', aehnlichkeit: (nah(entwurf.satz.kurz, profil.satz.kurz, 0.1) + nah(entwurf.satz.lang, profil.satz.lang, 0.05)) / 2, gewicht: 0.15 },
  ];
  const punkte = Math.max(0, Math.min(100, Math.round(merkmale.reduce((a, f) => a + f.aehnlichkeit * f.gewicht, 0) * 100)));
  return { punkte, merkmale: merkmale.map((f) => ({ ...f, aehnlichkeit: runde(f.aehnlichkeit, 2) })) };
}

// ---------- Muster-Scan ----------

// Befunde zu einem Text: die Muster der automatischen Sprachprüfung (stil.js) plus Rhythmus, Satzanfänge, Dreierreihen.
function scan(text) {
  const saetze = stil.saetze(text);
  const laengen = saetze.map(wc);
  const extra = [];
  if (saetze.length >= 5 && abw(laengen) < 3) extra.push({ grund: 'gleichförmiger Rhythmus', hinweis: `Alle Sätze sind ähnlich lang (Streuung ${de(runde(abw(laengen)))} Wörter). Lass einen Satz kürzer und einen längeren stehen, wo der Inhalt es hergibt.` });
  const anf = new Map();
  for (const s of saetze) { const a = erster(s); if (a.length > 1) anf.set(a, (anf.get(a) || 0) + 1); }
  for (const [a, n] of anf) if (saetze.length >= 5 && n >= 3) extra.push({ grund: `${n} Sätze beginnen mit „${a}“`, hinweis: 'Satzanfänge abwechseln oder Sätze verbinden.' });
  const dreier = (String(text).match(/[\p{L}-]+, [\p{L}-]+ und [\p{L}-]+/gu) || []).length;
  if (dreier >= 3) extra.push({ grund: `${dreier} Dreierreihen („A, B und C“)`, hinweis: 'Nicht alles in Dreiergruppen: zwei oder vier Punkte sind genauso gut, wenn es so viele sind.' });
  const striche = (String(text).match(/[—–]/g) || []).length;
  if (striche >= 4) extra.push({ grund: `${striche} Gedankenstriche`, hinweis: 'Nur dort lassen, wo die Person selbst Gedankenstriche nutzt.' });
  return { woerter: laengen.reduce((a, b) => a + b, 0), saetze: saetze.length, satzMittel: runde(mittel(laengen)), streuung: runde(abw(laengen)), funde: stil.pruefen(text), extra };
}

function scanText(r) {
  const L = [`Prüfung: ${r.woerter} Wörter, ${r.saetze} Sätze, Satzlänge im Mittel ${de(r.satzMittel)} Wörter (Streuung ${de(r.streuung)}).`];
  if (!r.funde.length && !r.extra.length) {
    L.push('Keine auffälligen Muster gefunden. Prüfe trotzdem, ob jeder Satz etwas Konkretes sagt.');
    return L.join('\n');
  }
  for (const f of r.funde.slice(0, 15)) L.push(`- „${f.satz}“ – ${f.grund}${f.hart ? ' (ändern)' : ''}`);
  for (const e of r.extra) L.push(`- ${e.grund}: ${e.hinweis}`);
  L.push('Stellen mit „(ändern)“ änderst du immer. Die übrigen prüfst du im Zusammenhang und änderst sie nur, wenn sie im Text schlechter sind als eine Alternative.');
  return L.join('\n');
}

// ---------- Umschreib-Anleitungen ----------

const REGELN = [
  'Beginne mit der eigentlichen Aussage, nicht mit einer Einleitung oder einem Rahmen.',
  'Streiche Sätze, die in jedem Text zum Thema stehen könnten. Ersetze sie durch eine konkrete Einzelheit der Person oder lass sie weg.',
  'Keine Floskeln und Stilwörter in Serie (zudem, somit, maßgeblich, ganzheitlich …), keine Schlussformel am Absatzende.',
  'Sätze und Absätze nicht gleichförmig bauen, aber auch nicht künstlich abwechseln: Die Länge richtet sich nach dem Inhalt.',
  'Ein Begriff bleibt ein Begriff, keine Synonyme zum Abwechseln. Einfache Wörter, wo sie das Gemeinte treffen.',
  'Bezüge klar machen: Wer tut was, warum folgt der nächste Satz.',
  'Nichts erfinden: keine Zahlen, Zitate, Erlebnisse, Gefühle oder Quellen. Zahlen, Fristen, Verneinungen und Unsicherheit („könnte“, „voraussichtlich“) bleiben wie in der Vorlage.',
  'Keine absichtlichen Fehler und keine Sonderzeichen-Tricks.',
];

const fundZeilen = (r) => [...r.funde.slice(0, 12).map((f) => `- „${f.satz}“ – ${f.grund}${f.hart ? ' (ändern)' : ''}`), ...r.extra.map((e) => `- ${e.grund}: ${e.hinweis}`)];

function umschreibAnleitung(text) {
  const r = scan(text);
  const L = ['Umschreib-Anleitung', '', 'Regeln:', ...REGELN.map((x, i) => `${i + 1}. ${x}`), '', 'Gefunden in diesem Text:'];
  const f = fundZeilen(r);
  L.push(...(f.length ? f : ['- nichts Auffälliges. Ändere nur, was die Regeln oben verlangen.']));
  L.push('', 'Schreibe den Text jetzt selbst um: der kleinste Eingriff, der die Stellen behebt. Prüfe das Ergebnis danach mit humanize_scan. Gib nur den fertigen Text aus.');
  return L.join('\n');
}

function profilZeilen(p) {
  const f = p.fingerabdruck || p;
  const z = f.zeichen;
  return [
    `Satzlänge: im Schnitt ${de(f.satz.mittel)} Wörter (Streuung ${de(f.satz.streuung)}); ${Math.round(f.satz.kurz * 100)} % kurze Sätze (unter ${KURZ} Wörter), ${Math.round(f.satz.lang * 100)} % lange (über ${LANG}).`,
    `Haltung je 100 Wörter: Ich-Form ${de(f.haltung.ich)}, Du-Form ${de(f.haltung.du)}, Absicherungen ${de(f.haltung.absicherung)}, Übergangswörter ${de(f.haltung.uebergang)}.`,
    `Zeichen je 100 Wörter: Komma ${de(z.komma)}, Gedankenstrich ${de(z.gedankenstrich)}, Doppelpunkt ${de(z.doppelpunkt)}, Klammern ${de(z.klammer)}, Ausrufezeichen ${de(z.ausruf)}, Fragezeichen ${de(z.frage)}.`,
    f.wortschatz.haeufig.length ? `Oft genutzte Wörter (ohne Hauptwörter): ${f.wortschatz.haeufig.map((x) => x.wort).join(', ')}.` : '',
    f.wortschatz.anfaenge.length ? `Typische Satzanfänge: ${f.wortschatz.anfaenge.map((x) => x.wort).join(', ')}.` : '',
  ].filter(Boolean);
}

function stimmeAnleitung(text, profil) {
  const r = scan(text);
  const fa = fingerabdruck([text]);
  const a = aehnlichkeit(fa, profil.fingerabdruck);
  const L = ['Umschreib-Anleitung im Stil der Person', '', `Ihre Schreibweise (aus ${profil.fingerabdruck.proben} Text${profil.fingerabdruck.proben === 1 ? '' : 'en'}, ${profil.fingerabdruck.woerter} Wörter):`, ...profilZeilen(profil).map((x) => `- ${x}`)];
  if (profil.auszuege && profil.auszuege.length) L.push('', 'So klingt sie (Beispiele aus ihren eigenen Texten, nur der Ton zählt, nicht der Inhalt):', ...profil.auszuege.map((x) => `> ${x}`));
  L.push('', `Nähe des Entwurfs zu ihrer Schreibweise jetzt: ${a.punkte} von 100.`, '', 'Regeln:', ...REGELN.map((x, i) => `${i + 1}. ${x}`), '', 'Gefunden in diesem Text:');
  const f = fundZeilen(r);
  L.push(...(f.length ? f : ['- nichts Auffälliges.']));
  L.push('', 'Schreibe den Text jetzt selbst um, in ihrer Schreibweise und mit ihren Wörtern, aber ohne ihre Inhalte zu übernehmen. Prüfe danach mit humanize_scan und voice_score. Gib nur den fertigen Text aus.');
  return L.join('\n');
}

function aehnlichkeitText(a, entwurf, profil) {
  const L = [`Nähe zur Schreibweise der Person: ${a.punkte} von 100 (Entwurf: ${entwurf.woerter} Wörter).`];
  if (entwurf.woerter < 50) L.push('Der Entwurf ist kurz, der Wert ist nur ein grober Anhaltspunkt.');
  for (const m of [...a.merkmale].sort((x, y) => x.aehnlichkeit - y.aehnlichkeit)) L.push(`- ${m.merkmal}: ${Math.round(m.aehnlichkeit * 100)} %${m.aehnlichkeit < 0.5 ? ' (weicht ab)' : ''}`);
  const f = entwurf; const p = profil.fingerabdruck;
  if (a.merkmale[0].aehnlichkeit < 0.5) L.push(`Hinweis: Ihre Sätze sind im Schnitt ${de(p.satz.mittel)} Wörter lang, deiner ${de(f.satz.mittel)}.`);
  L.push('Das misst die Nähe zur Schreibweise der Person, nicht das Urteil eines Erkennungsprogramms.');
  return L.join('\n');
}

// Auszüge für die Anleitung: bis zu drei Absätze in ganzer Prosa, über den Text verteilt.
function auszuege(proben) {
  const absaetze = proben.flatMap((t) => String(t).split(/\n\s*\n/)).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 80 && !/^[#>|*-]/.test(s));
  if (!absaetze.length) return [];
  const n = Math.min(3, absaetze.length);
  const aus = [];
  for (let i = 0; i < n; i++) { const a = absaetze[Math.floor((i * absaetze.length) / n)]; aus.push(a.length > 400 ? `${a.slice(0, 397)}…` : a); }
  return aus;
}

function neuesProfil(proben, quellen) {
  const texte = proben.map(String).filter((t) => t.trim());
  return { erstellt: new Date().toISOString(), quellen, fingerabdruck: fingerabdruck(texte), auszuege: auszuege(texte) };
}

function profilText(p) {
  const f = p.fingerabdruck;
  return [`Stimmenprofil (aus ${f.proben} Text${f.proben === 1 ? '' : 'en'}, ${f.woerter} Wörter, erstellt ${p.erstellt.slice(0, 10)}):`, ...profilZeilen(p).map((x) => `- ${x}`),
    f.woerter < 150 ? 'Wenig Material: Das Profil ist vorläufig. Mit mehr eigenen Texten (ab etwa 300 Wörtern) wird es verlässlicher.' : ''].filter(Boolean).join('\n');
}

module.exports = { fingerabdruck, aehnlichkeit, scan, scanText, umschreibAnleitung, stimmeAnleitung, aehnlichkeitText, neuesProfil, profilText, auszuege, REGELN, wc };
