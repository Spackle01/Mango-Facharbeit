'use strict';
// Gemeinsamer Kern für KI-Anbieter mit API-Schlüssel und OpenAI-kompatibler Schnittstelle (Chat Completions):
// DeepSeek und OpenCode Go. Es gibt keine CLI: Mango führt die Arbeitsschleife selbst aus. Das Modell ruft
// Werkzeuge auf (lesen, schreiben, bearbeiten, suchen, Skills laden, Webseiten abrufen, Scan), Mango führt sie
// im Arbeitsraum aus und schickt die Ergebnisse zurück, bis die Antwort fertig ist.
const crypto = require('crypto');
const { path, ensureDir, writeJsonAtomic, readJson } = require('../util');
const { describeTool } = require('./activity');
const { Werkzeuge } = require('./werkzeuge');

const MAX_RUNDEN = 40;
const VERLAUF_BUDGET = 420000; // Zeichen im gespeicherten Verlauf, ältere Werkzeugergebnisse werden gekürzt
const MODELLE_CACHE_MS = 10 * 60 * 1000;

// ---------- Verlauf ----------

// Ältere Werkzeugergebnisse kürzen, damit der Verlauf nicht unbegrenzt wächst.
function kuerzeVerlauf(messages) {
  const laenge = (m) => (m.content ? String(m.content).length : 0) + (m.reasoning_content ? m.reasoning_content.length : 0);
  let summe = messages.reduce((n, m) => n + laenge(m), 0);
  for (let i = 0; i < messages.length - 6 && summe > VERLAUF_BUDGET; i++) {
    const m = messages[i];
    if (m.role === 'tool' && m.content && m.content.length > 400) {
      summe -= m.content.length - 60;
      m.content = '(frühere Werkzeugausgabe gekürzt; bei Bedarf erneut lesen)';
    }
  }
}

class ApiFehler extends Error {
  constructor(status, text, art) { super(text); this.status = status; this.art = art; }
}

// Liest einen Chat-Completions-Stream. Liefert { content, reasoning, toolCalls, finish, usage, model }.
async function leseStrom(res, onText) {
  const dec = new TextDecoder();
  const erg = { content: '', reasoning: '', toolCalls: [], finish: null, usage: null, model: '' };
  let puffer = '';
  const verarbeite = (zeile) => {
    if (!zeile.startsWith('data:')) return;
    const daten = zeile.slice(5).trim();
    if (!daten || daten === '[DONE]') return;
    let j;
    try { j = JSON.parse(daten); } catch { return; }
    if (j.model) erg.model = j.model;
    if (j.usage) erg.usage = j.usage;
    const c = j.choices && j.choices[0];
    if (!c) return;
    if (c.finish_reason) erg.finish = c.finish_reason;
    const d = c.delta || {};
    if (d.reasoning_content) erg.reasoning += d.reasoning_content;
    if (d.content) { erg.content += d.content; onText(d.content); }
    for (const t of d.tool_calls || []) {
      const i = t.index || 0;
      const z = erg.toolCalls[i] || (erg.toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } });
      if (t.id) z.id = t.id;
      if (t.function && t.function.name) z.function.name += t.function.name;
      if (t.function && t.function.arguments) z.function.arguments += t.function.arguments;
    }
  };
  for await (const chunk of res.body) {
    puffer += dec.decode(chunk, { stream: true });
    let i;
    while ((i = puffer.indexOf('\n')) >= 0) { verarbeite(puffer.slice(0, i).replace(/\r$/, '')); puffer = puffer.slice(i + 1); }
  }
  if (puffer) verarbeite(puffer.replace(/\r$/, ''));
  erg.toolCalls = erg.toolCalls.filter(Boolean);
  return erg;
}

// cfg: id, name, keyLink, base, standardModell ('' = erstes Modell der Liste), modelle (feste Liste) oder
// modelleLaden (true: Liste kommt von GET /models), schluesselMuster, denken (Nachdenken-Modus wie bei DeepSeek),
// loginText, guthabenText (Fehler 402), keinSchluesselFehler.
function erstelleAnbieter(cfg) {
  const { id: ID, name: NAME } = cfg;
  let geheim = null;
  const cache = { key: '', zeit: 0, liste: [] };

  function init({ geheim: g }) { geheim = g; }

  function loginHint() {
    return { text: cfg.loginText, link: cfg.keyLink, aktion: 'schluessel' };
  }

  // Modellliste: feste Liste oder GET /models (kurz zwischengespeichert, bei Fehlern die letzte Liste).
  async function ladeModelle(key, { fetchFn = (...a) => fetch(...a) } = {}) {
    if (cfg.modelle) return cfg.modelle;
    if (!key) return [];
    if (cache.key === key && cache.liste.length && Date.now() - cache.zeit < MODELLE_CACHE_MS) return cache.liste;
    try {
      const res = await fetchFn(`${cfg.base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return cache.key === key ? cache.liste : [];
      const j = await res.json();
      const ids = [...new Set((Array.isArray(j.data) ? j.data : []).map((m) => m && m.id).filter((x) => typeof x === 'string' && x))];
      const liste = ids.map((mid) => ({ id: mid, name: mid, gruppe: 'verfuegbar', info: '' }));
      if (liste.length) Object.assign(cache, { key, zeit: Date.now(), liste });
      return liste.length ? liste : (cache.key === key ? cache.liste : []);
    } catch {
      return cache.key === key ? cache.liste : [];
    }
  }

  async function detect() {
    const key = geheim ? await geheim.get(ID) : '';
    const base = { id: ID, name: NAME, installed: true, api: true, models: await ladeModelle(key), caps: { model: true, effort: !!cfg.denken } };
    if (!key) return { ...base, status: 'anmeldung_noetig', detail: 'Kein Schlüssel verbunden', hint: loginHint() };
    return { ...base, status: 'bereit', detail: `Schlüssel ${key.slice(-4) ? `…${key.slice(-4)}` : ''} gespeichert`, hint: null };
  }

  // Prüft einen Schlüssel mit einer kleinen Abfrage der Modellliste.
  async function pruefeSchluessel(key, { fetchFn = (...a) => fetch(...a) } = {}) {
    try {
      const res = await fetchFn(`${cfg.base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
      if (res.status === 401 || res.status === 403) return { ok: false, fehler: `${NAME} lehnt diesen Schlüssel ab. Prüfe, ob du ihn vollständig kopiert hast.` };
      if (!res.ok) return { ok: false, fehler: `${NAME} antwortet mit Fehler ${res.status}. Versuche es später noch einmal.` };
      return { ok: true };
    } catch (err) {
      return { ok: false, fehler: err && err.name === 'TimeoutError' ? `Keine Antwort von ${NAME}. Prüfe die Internetverbindung.` : `${NAME} ist nicht erreichbar. Prüfe die Internetverbindung.`, netz: true };
    }
  }

  const sitzungsDatei = (cwd, sid) => path.join(cwd, '.facharbeit', 'sitzungen', `${ID}-${sid}.json`);

  async function ladeVerlauf(cwd, sid) {
    const d = await readJson(sitzungsDatei(cwd, sid), null);
    return d && Array.isArray(d.messages) ? d.messages : null;
  }

  async function speichereVerlauf(cwd, sid, messages) {
    const f = sitzungsDatei(cwd, sid);
    await ensureDir(path.dirname(f));
    await writeJsonAtomic(f, { version: 1, messages });
  }

  function fehlerAusAntwort(status, body) {
    let text = '';
    try { text = JSON.parse(body).error.message || ''; } catch { text = String(body || '').slice(0, 300); }
    if (status === 401) return new ApiFehler(status, `Der ${NAME}-Schlüssel wurde abgelehnt. Verbinde ihn in den Einstellungen neu.`, 'anmeldung');
    if (status === 402) return new ApiFehler(status, cfg.guthabenText, 'limit');
    if (status === 429) return new ApiFehler(status, `${NAME} bremst gerade (zu viele Anfragen oder Kontingent erreicht). Warte kurz und versuche es erneut.`, 'limit');
    if (status >= 500) return new ApiFehler(status, `${NAME} hat gerade ein Problem (${status}). Versuche es gleich noch einmal.`, 'netz');
    if (status === 404 || /model/i.test(text)) return new ApiFehler(status, `Das Modell ist bei ${NAME} nicht verfügbar oder arbeitet mit dieser Schnittstelle nicht. Wähle in den Einstellungen ein anderes Modell. ${text}`.trim(), 'modell');
    return new ApiFehler(status, text || `${NAME} meldet Fehler ${status}.`, 'allgemein');
  }

  // Startet einen Durchlauf. Gibt { cancel, done: Promise } zurück.
  function run(info, { cwd, prompt, sessionId, resume, rulesText, onEvent, model: modelWahl = '', effort = '', fetchFn = (...a) => fetch(...a) }) {
    const ac = new AbortController();
    let canceled = false;
    const werkzeuge = new Werkzeuge(cwd);

    const done = (async () => {
      const sid = sessionId || crypto.randomUUID();
      let model = modelWahl || cfg.standardModell || ((info && info.models && info.models[0] && info.models[0].id) || '');
      let text = '';
      let key = '';
      let gemeldet = ''; // Name, den der Server in der Antwort nennt (nur zur Anzeige; Anfragen nutzen immer das gewählte Modell)
      const meld = (error, errorKind, retryable = false) => ({ text, model: gemeldet || model, sessionId: sid, canceled, error, errorKind, retryable, denied: [], stderr: '' });
      try {
        key = geheim ? await geheim.get(ID) : '';
        if (!key) return meld(`Es ist noch kein ${NAME}-Schlüssel verbunden.`, 'anmeldung');
        if (!model) {
          const liste = await ladeModelle(key, { fetchFn });
          model = liste[0] ? liste[0].id : '';
        }
        if (!model) return meld(`${NAME} hat keine Modelle geliefert. Wähle in den Einstellungen ein Modell oder trage eine Modell-ID ein.`, 'modell');
        let messages = [];
        if (resume) {
          const alt = await ladeVerlauf(cwd, sid);
          if (!alt) return meld('Der Verlauf dieser Sitzung wurde nicht gefunden.', 'sitzung');
          messages = alt;
        }
        messages.push({ role: 'user', content: prompt });
        let konsistent = messages.length;
        let denkt = !!cfg.denken && effort === 'high';
        onEvent({ type: 'init', model, sessionId: sid });
        const system = `${rulesText || ''}\n\n## Werkzeuge in dieser Umgebung\n\nDu hast die Werkzeuge Read, Write, Edit, Glob, Grep, Skill und WebFetch sowie \`ai_tell_scan\` (der Scan des Skills ai-tell-audit). Ruf sie direkt auf, ohne sie anzukündigen. Es gibt kein Terminal. Die Schreib-Skills stehen am Anfang deiner Regeln, die übrigen Skills (Recherche, Abgabe prüfen, Material übernehmen) lädst du mit dem Werkzeug Skill. Word-, PDF- und PowerPoint-Dateien erzeugst oder änderst du nur über die Blöcke am Ende deiner Antwort. Zum Schluss, bei jeder Antwort: Jeder Text, den du schreibst, klingt wie ein Mensch und wie die Person selbst. Folge dafür den Schreib-Skills vom Anfang deiner Regeln: human-voice bzw. humanize-rewrite, dann ai-tell-audit mit dem Werkzeug ai_tell_scan.`;

        for (let runde = 0; runde < MAX_RUNDEN; runde++) {
          if (canceled) break;
          kuerzeVerlauf(messages);
          const anfrage = () => ({
            model, stream: true, stream_options: { include_usage: true }, tools: werkzeuge.definitionen(),
            messages: [{ role: 'system', content: system }, ...messages],
            // DeepSeek kennt den Nachdenken-Modus; andere Anbieter bekommen nur Standardfelder.
            ...(cfg.denken ? { thinking: { type: denkt ? 'enabled' : 'disabled' } } : {}),
            ...(denkt ? { reasoning_effort: 'high' } : { temperature: 0.7 }),
          });
          let teilStart = true;
          const onText = (d) => {
            if (teilStart) { teilStart = false; if (text && !text.endsWith('\n\n')) { text += '\n\n'; onEvent({ type: 'text', delta: '\n\n' }); } }
            text += d;
            onEvent({ type: 'text', delta: d });
          };
          let erg;
          for (let versuch = 0; ; versuch++) {
            const res = await fetchFn(`${cfg.base}/chat/completions`, {
              method: 'POST', signal: ac.signal,
              headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(anfrage()),
            });
            if (!res.ok) {
              const body = await res.text().catch(() => '');
              // Nachdenken-Modus wurde vom Verlauf nicht akzeptiert: ohne Nachdenken wiederholen.
              if (res.status === 400 && denkt && versuch === 0 && /reasoning/i.test(body)) {
                denkt = false;
                for (const m of messages) delete m.reasoning_content;
                continue;
              }
              throw fehlerAusAntwort(res.status, body);
            }
            erg = await leseStrom(res, onText);
            break;
          }
          if (erg.model) gemeldet = erg.model;
          const antwort = { role: 'assistant', content: erg.content || null };
          // Denkprotokoll nur bei Anbietern, die es verlangen (DeepSeek); andere Server lehnen das Feld ab.
          if (erg.reasoning && cfg.denken) antwort.reasoning_content = erg.reasoning;
          if (erg.toolCalls.length) antwort.tool_calls = erg.toolCalls.map((t, i) => ({ id: t.id || `call_${runde}_${i}`, type: 'function', function: t.function }));
          messages.push(antwort);
          if (!antwort.tool_calls) { konsistent = messages.length; break; }
          for (const tc of antwort.tool_calls) {
            let args = {};
            let ergebnis;
            try { args = JSON.parse(tc.function.arguments || '{}'); } catch { ergebnis = 'Fehler: Die Argumente waren kein gültiges JSON.'; }
            onEvent({ type: 'activity', item: describeTool(tc.function.name, args, cwd) });
            if (ergebnis === undefined) ergebnis = canceled ? 'Abgebrochen.' : await werkzeuge.ausfuehren(tc.function.name, args);
            messages.push({ role: 'tool', tool_call_id: tc.id, content: String(ergebnis) });
          }
          konsistent = messages.length;
          if (runde === MAX_RUNDEN - 1) return meld('Zu viele Arbeitsschritte in einer Antwort. Teile die Aufgabe in kleinere Schritte.', 'allgemein');
        }
        messages.length = konsistent;
        await speichereVerlauf(cwd, sid, messages).catch(() => {});
        if (canceled) return meld(null, null);
        if (!text.trim()) return meld(`${NAME} hat eine leere Antwort geliefert.`, 'allgemein', true);
        return meld(null, null);
      } catch (err) {
        if (canceled || (err && err.name === 'AbortError')) return meld(null, null);
        if (err instanceof ApiFehler) return meld(err.message, err.art, ['limit', 'netz'].includes(err.art) && err.status !== 402);
        const netz = err && (err.name === 'TypeError' || /fetch|network|ECONN|ENOTFOUND|socket|terminated/i.test(String(err.message)));
        return meld(netz ? `${NAME} ist nicht erreichbar. Prüfe die Internetverbindung.` : String(err && err.message ? err.message : err), netz ? 'netz' : 'allgemein', !!netz);
      }
    })();

    return { done, cancel() { canceled = true; ac.abort(); } };
  }

  return { ID, NAME, KEY_LINK: cfg.keyLink, STANDARD_MODELL: cfg.standardModell, SCHLUESSEL_MUSTER: cfg.schluesselMuster, SCHLUESSEL_FEHLER: cfg.schluesselFehler, init, detect, pruefeSchluessel, run, loginHint, ladeModelle };
}

module.exports = { erstelleAnbieter };
