'use strict';
// Werkzeuge für Anbieter ohne eigene CLI (DeepSeek-API): Lesen, Schreiben, Bearbeiten, Suchen,
// Skills und Webseiten abrufen. Alles bleibt im Arbeitsraum; Originale und Office-Dateien sind
// geschützt (Word, PDF und PowerPoint ändert die App über die Blöcke `word` und `erstellen`).
const dns = require('dns').promises;
const net = require('net');
const { fsp, path, ensureDir, exists, toPosix, resolveInside } = require('../util');
const extract = require('../extract');

const MAX_LINIEN = 2000;
const MAX_ZEICHEN = 60000;
const MAX_TREFFER = 150;
const ORIGINALE = /^(00_vorgaben|uebernommen|anhaenge)(\/|$)/;
const NICHT_SCHREIBEN = /\.(docx|docm|dotx|pptx|xlsx|pdf|png|jpe?g|gif|zip|exe)$/i;
const TEXT_ENDUNGEN = /\.(md|markdown|txt|csv|tsv|json|html?|xml|ya?ml|tex|bib|rtf)$/i;
const SKILL_NAME = /^[\w-]{1,60}$/;

// Werkzeugdefinitionen im Format der Chat-API (OpenAI-kompatibel).
const DEFINITIONEN = [
  { name: 'Read', description: 'Liest eine Datei im Arbeitsraum mit Zeilennummern. Word-, PDF- und PowerPoint-Dateien liefern ihren Textauszug (besser: den Pfad aus dem Projektkontext unter .facharbeit/extrakte/ lesen).',
    parameters: { type: 'object', properties: { file_path: { type: 'string', description: 'Relativer Pfad im Arbeitsraum' }, offset: { type: 'integer', description: 'Erste Zeile (ab 1)' }, limit: { type: 'integer', description: 'Anzahl Zeilen' } }, required: ['file_path'] } },
  { name: 'Write', description: 'Schreibt eine Textdatei (neu oder ersetzt sie). Nicht für Word, PDF, PowerPoint oder Excel: dafür die Blöcke `word` und `erstellen` in der Antwort nutzen.',
    parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
  { name: 'Edit', description: 'Ersetzt in einer Textdatei genau eine Stelle (old_string muss einmalig vorkommen, sonst replace_all setzen).',
    parameters: { type: 'object', properties: { file_path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['file_path', 'old_string', 'new_string'] } },
  { name: 'Glob', description: 'Sucht Dateien im Arbeitsraum nach Muster, z. B. "02_*/**/*.md".',
    parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string', description: 'Unterordner (optional)' } }, required: ['pattern'] } },
  { name: 'Grep', description: 'Durchsucht Textdateien im Arbeitsraum nach einem regulären Ausdruck.',
    parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, glob: { type: 'string', description: 'Nur Dateien, die zu diesem Muster passen' }, '-i': { type: 'boolean' } }, required: ['pattern'] } },
  { name: 'Skill', description: 'Lädt einen Skill (Arbeitsanleitung). Namen stehen in den Regeln, z. B. wissenschaftlich-schreiben, sprachpruefung, quellenrecherche, abgabe-pruefen, bestehende-arbeit-uebernehmen.',
    parameters: { type: 'object', properties: { skill: { type: 'string' } }, required: ['skill'] } },
  { name: 'WebFetch', description: 'Ruft eine öffentliche Webseite (http/https) ab und liefert den Text. Nur für Quellen, die die Person nennt oder die du prüfen willst.',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
];

function relativ(cwd, p) {
  let s = String(p || '').trim().replace(/\\/g, '/');
  const c = toPosix(cwd).replace(/\/+$/, '');
  if (s.startsWith(`${c}/`)) s = s.slice(c.length + 1);
  return s.replace(/^\.\//, '');
}

function aufloesen(cwd, p) {
  const rel = relativ(cwd, p);
  if (!rel) throw new Error('Kein Pfad angegeben');
  const abs = resolveInside(cwd, rel);
  if (!abs) throw new Error('Der Pfad liegt außerhalb des Arbeitsraums');
  return { rel, abs };
}

const kuerzen = (t, n = MAX_ZEICHEN) => (t.length > n ? `${t.slice(0, n)}\n… (gekürzt, ${t.length - n} Zeichen mehr)` : t);

// Muster mit * und ** in einen regulären Ausdruck umwandeln
function globRegex(muster) {
  const p = String(muster || '').replace(/\\/g, '/').replace(/^\.\//, '');
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') { re += '.*'; i++; if (p[i + 1] === '/') i++; } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') { const e = p.indexOf('}', i); if (e > i) { re += `(?:${p.slice(i + 1, e).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`; i = e; } else re += '\\{'; }
    else re += c.replace(/[.+^$()|[\]\\}]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

async function alleDateien(cwd, unter = '') {
  const out = [];
  async function lauf(dir) {
    if (out.length > 5000) return;
    let eintraege;
    try { eintraege = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      const abs = path.join(dir, e.name);
      const rel = toPosix(path.relative(cwd, abs));
      // Interne Ordner bleiben verborgen, nur die Textauszüge sind lesbar.
      if (e.name.startsWith('.') && !rel.startsWith('.facharbeit/extrakte')) { if (rel !== '.facharbeit') continue; }
      if (e.isDirectory()) {
        if (rel.startsWith('.facharbeit') && !(rel === '.facharbeit' || rel.startsWith('.facharbeit/extrakte'))) continue;
        if (['node_modules', '.git', '.agents', '.claude'].includes(e.name)) continue;
        await lauf(abs);
      } else if (e.isFile()) out.push(rel);
    }
  }
  await lauf(unter ? path.join(cwd, unter) : cwd);
  return out.sort();
}

// Webadressen: nur http/https, keine lokalen oder privaten Ziele
function privat(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

async function pruefeAdresse(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error('Ungültige Adresse'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Nur http- und https-Adressen sind erlaubt');
  if (u.username || u.password) throw new Error('Adressen mit Zugangsdaten sind nicht erlaubt');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) { if (privat(host)) throw new Error('Lokale Adressen sind nicht erlaubt'); return u; }
  if (!host.includes('.') || /\.(local|internal|localhost)$/i.test(host)) throw new Error('Lokale Adressen sind nicht erlaubt');
  const eintraege = await dns.lookup(host, { all: true }).catch(() => []);
  if (!eintraege.length) throw new Error('Adresse nicht gefunden');
  if (eintraege.some((e) => privat(e.address))) throw new Error('Lokale Adressen sind nicht erlaubt');
  return u;
}

function htmlZuText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
}

class Werkzeuge {
  constructor(cwd, { fetchFn = (...a) => fetch(...a) } = {}) {
    this.cwd = cwd;
    this.fetch = fetchFn;
  }

  definitionen() {
    return DEFINITIONEN.map((d) => ({ type: 'function', function: d }));
  }

  // Führt ein Werkzeug aus. Liefert immer Text; Fehler stehen als „Fehler: …“, damit das Modell reagieren kann.
  async ausfuehren(name, eingabe) {
    const f = this[`_${name}`];
    if (!f) return `Fehler: Das Werkzeug „${name}“ gibt es nicht.`;
    try {
      return await f.call(this, eingabe && typeof eingabe === 'object' ? eingabe : {});
    } catch (err) {
      return `Fehler: ${err.message}`;
    }
  }

  async _Read({ file_path: p, offset, limit }) {
    const { rel, abs } = aufloesen(this.cwd, p);
    const st = await fsp.stat(abs).catch(() => null);
    if (!st) throw new Error(`Datei „${rel}“ nicht gefunden`);
    if (st.isDirectory()) throw new Error(`„${rel}“ ist ein Ordner`);
    let text;
    if (TEXT_ENDUNGEN.test(rel) || !path.extname(rel)) text = await fsp.readFile(abs, 'utf8');
    else if (/\.(png|jpe?g|gif|webp)$/i.test(rel)) throw new Error('Bilder kann dieses Modell nicht ansehen. Frag die Person nach einer Beschreibung.');
    else {
      const info = await extract.analyse(abs);
      if (info.lesbar !== 'ja' || !info.text) throw new Error(info.hinweis || 'Die Datei lässt sich nicht lesen');
      text = info.text;
    }
    const zeilen = text.split('\n');
    const von = Math.max(1, Number(offset) || 1);
    const n = Math.min(MAX_LINIEN, Math.max(1, Number(limit) || MAX_LINIEN));
    const teil = zeilen.slice(von - 1, von - 1 + n).map((z, i) => `${String(von + i).padStart(5)}\t${z}`).join('\n');
    const mehr = zeilen.length > von - 1 + n ? `\n… (Datei hat ${zeilen.length} Zeilen; weiter mit offset ${von + n})` : '';
    return kuerzen(teil) + mehr || '(leere Datei)';
  }

  schreibCheck(p) {
    const { rel, abs } = aufloesen(this.cwd, p);
    if (ORIGINALE.test(rel)) throw new Error('Originale (00_vorgaben, uebernommen, anhaenge) bleiben unverändert. Arbeite in abgabe/ oder 01_ bis 08_.');
    if (/^\.(facharbeit|agents|claude)(\/|$)/.test(rel) || rel === 'FACHARBEIT.md') throw new Error('Interne Dateien sind gesperrt');
    if (NICHT_SCHREIBEN.test(rel)) throw new Error('Word-, PDF-, PowerPoint- und Excel-Dateien schreibst du nicht selbst: Nutze die Blöcke `word` (bestehende Word-Datei) oder `erstellen` (neue Datei) am Ende der Antwort.');
    return { rel, abs };
  }

  async _Write({ file_path: p, content }) {
    const { rel, abs } = this.schreibCheck(p);
    if (typeof content !== 'string') throw new Error('content fehlt');
    await ensureDir(path.dirname(abs));
    await fsp.writeFile(abs, content, 'utf8');
    return `Geschrieben: ${rel} (${content.split('\n').length} Zeilen)`;
  }

  async _Edit({ file_path: p, old_string: alt, new_string: neu, replace_all: alle }) {
    const { rel, abs } = this.schreibCheck(p);
    if (typeof alt !== 'string' || typeof neu !== 'string' || !alt) throw new Error('old_string und new_string fehlen');
    if (!(await exists(abs))) throw new Error(`Datei „${rel}“ nicht gefunden`);
    const text = await fsp.readFile(abs, 'utf8');
    const n = text.split(alt).length - 1;
    if (!n) throw new Error('old_string kommt in der Datei nicht vor');
    if (n > 1 && !alle) throw new Error(`old_string kommt ${n}-mal vor. Gib mehr Umgebungstext an oder setze replace_all.`);
    await fsp.writeFile(abs, alle ? text.split(alt).join(neu) : text.replace(alt, () => neu), 'utf8');
    return `Bearbeitet: ${rel}${alle ? ` (${n} Stellen)` : ''}`;
  }

  async _Glob({ pattern, path: unter }) {
    const sub = unter ? aufloesen(this.cwd, unter).rel : '';
    const re = globRegex(pattern);
    const treffer = (await alleDateien(this.cwd, sub)).filter((f) => re.test(f) || re.test(path.posix.basename(f)) && !String(pattern).includes('/'));
    return treffer.length ? kuerzen(treffer.slice(0, 300).join('\n') + (treffer.length > 300 ? `\n… ${treffer.length - 300} weitere` : '')) : 'Keine Dateien gefunden.';
  }

  async _Grep({ pattern, path: unter, glob, '-i': klein }) {
    let re;
    try { re = new RegExp(pattern, klein ? 'i' : ''); } catch { throw new Error('Ungültiger regulärer Ausdruck'); }
    const sub = unter ? aufloesen(this.cwd, unter).rel : '';
    const g = glob ? globRegex(glob) : null;
    const out = [];
    for (const rel of await alleDateien(this.cwd, sub)) {
      if (!(TEXT_ENDUNGEN.test(rel) || rel.endsWith('.txt'))) continue;
      if (g && !g.test(rel) && !g.test(path.posix.basename(rel))) continue;
      const text = await fsp.readFile(path.join(this.cwd, ...rel.split('/')), 'utf8').catch(() => '');
      text.split('\n').forEach((z, i) => { if (out.length < MAX_TREFFER && re.test(z)) out.push(`${rel}:${i + 1}: ${z.trim().slice(0, 200)}`); });
      if (out.length >= MAX_TREFFER) break;
    }
    return out.length ? out.join('\n') : 'Keine Treffer.';
  }

  async _Skill({ skill }) {
    const name = String(skill || '').replace(/^.*:/, '');
    if (!SKILL_NAME.test(name)) throw new Error('Ungültiger Skill-Name');
    for (const dir of ['.claude/skills', '.agents/skills']) {
      const f = path.join(this.cwd, ...dir.split('/'), name, 'SKILL.md');
      if (await exists(f)) return `Skill „${name}“ geladen. Folge dieser Anleitung:\n\n${await fsp.readFile(f, 'utf8')}`;
    }
    const namen = (await fsp.readdir(path.join(this.cwd, '.claude', 'skills')).catch(() => [])).join(', ');
    throw new Error(`Skill „${name}“ gibt es nicht. Vorhanden: ${namen || '–'}`);
  }

  async _WebFetch({ url }) {
    let u = await pruefeAdresse(url);
    for (let sprung = 0; sprung < 4; sprung++) {
      const res = await this.fetch(u.href, { redirect: 'manual', headers: { 'User-Agent': 'Mango-Facharbeit', Accept: 'text/html,text/plain,*/*;q=0.5' }, signal: AbortSignal.timeout(15000) });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { u = await pruefeAdresse(new URL(res.headers.get('location'), u).href); continue; }
      if (!res.ok) throw new Error(`Die Seite antwortet mit ${res.status}`);
      const typ = res.headers.get('content-type') || '';
      if (!/text|html|xml|json/i.test(typ)) throw new Error(`Dateityp „${typ.split(';')[0] || 'unbekannt'}“ wird nicht gelesen`);
      const buf = Buffer.from(await res.arrayBuffer()).subarray(0, 2 * 1024 * 1024);
      const roh = buf.toString('utf8');
      return kuerzen(/html/i.test(typ) ? htmlZuText(roh) : roh, 20000);
    }
    throw new Error('Zu viele Weiterleitungen');
  }
}

module.exports = { Werkzeuge, DEFINITIONEN, globRegex, htmlZuText, pruefeAdresse };
