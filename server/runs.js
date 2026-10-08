'use strict';
// Steuert einen Durchlauf: Nachricht speichern, Kontext bauen, Anbieter starten,
// Antwort streamen, Dateiänderungen sichern und den Arbeitsstand aktualisieren.
const { fsp, path, newId, nowIso, resolveInside, writeTextAtomic, truncate } = require('./util');
const ws = require('./workspace');
const ctx = require('./context');
const importer = require('./importer');
const sortieren = require('./sortieren');
const { kindOf } = require('./extract');
const { GRUENDLICHKEIT } = require('./providers/models');

const MAX_ARG_PROMPT = 24000;

function autoTitle(text, attachments) {
  let t = String(text || '').split('\n').find((l) => l.trim()) || '';
  t = t.replace(/[#*_`>[\]]/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(hallo|hi|hey|moin|guten (morgen|tag|abend))[,!.\s]+/i, '');
  t = t.replace(/^(kannst du( mir)?|könntest du( mir)?|bitte|hilf mir( bitte)?( dabei)?,?|ich (möchte|will|brauche|würde gern(e)?))\s+/i, '');
  t = t.replace(/^(mir\s+)?(dabei\s+)?helfen,?\s+/i, '');
  t = t.replace(/[?!.:,;]+$/, '').trim();
  t = t.split(/(?<=[^\s.]{2})[.!?](?=\s+[A-ZÄÖÜ]|$)/)[0].trim(); // erster Satz (Abkürzungen wie „z. B.“ bleiben)
  // „ein Exposé zu schreiben (und …)“ → „Exposé schreiben“
  const zu = /^(?:(?:ein|eine|einen|mein|meine|meinen|die|das|den|der)\s+)?(.{3,40}?)\s+zu\s+([\wäöüß]+)(?:\s+und\b.*)?$/i.exec(t);
  if (zu) t = `${zu[1]} ${zu[2]}`;
  if (!t && attachments && attachments.length) t = `Datei: ${attachments[0].name}`;
  if (!t) return 'Neuer Chat';
  if (t.length > 48) {
    t = t.slice(0, 48);
    const cut = t.lastIndexOf(' ');
    if (cut > 24) t = t.slice(0, cut);
    t = `${t}…`;
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function errorHint(kind, providerState, model = '') {
  if ((kind === 'anmeldung' || kind === 'vertrauen') && providerState && providerState.hint) return providerState.hint;
  if (kind === 'modell') {
    const name = providerState ? providerState.name : 'dem Anbieter';
    return {
      text: model
        ? `Das Modell „${model}“ ist bei ${name} nicht verfügbar oder für dein Konto nicht freigeschaltet. Wähle ein anderes Modell.`
        : `${name} meldet ein Problem mit dem Modell. Wähle ein Modell aus.`,
      aktion: 'modell',
    };
  }
  if (kind === 'limit') return { text: 'Der Anbieter ist gerade überlastet oder dein Nutzungslimit ist erreicht. Warte etwas oder wechsle den Anbieter.' };
  if (kind === 'netz') return { text: 'Keine Verbindung zum Anbieter. Prüfe die Internetverbindung und versuche es erneut.' };
  return null;
}

class RunManager {
  // bereit: liefert ein Promise, das nach laufenden Anbieterprüfungen erfüllt ist.
  // modellAbgelehnt(anbieter, id): ein automatisch gewähltes Modell wurde abgelehnt.
  constructor({ providers, settings, bereit = async () => {}, modellAbgelehnt = async () => {} }) {
    this.providers = providers;
    this.settings = settings; // Funktion, liefert aktuelle Einstellungen
    this.bereit = bereit;
    this.modellAbgelehnt = modellAbgelehnt;
    this.runs = new Map();
  }

  isRunning(chatId) {
    return this.runs.has(chatId);
  }

  runningChats() {
    return [...this.runs.keys()];
  }

  subscribe(chatId, send) {
    const run = this.runs.get(chatId);
    if (!run) return null;
    run.subscribers.add(send);
    send({ type: 'snapshot', message: run.message });
    return () => run.subscribers.delete(send);
  }

  stop(chatId) {
    const run = this.runs.get(chatId);
    if (!run) return false;
    run.stopRequested = true;
    if (run.handle) run.handle.cancel();
    return true;
  }

  async prepareAttachments(project, list) {
    const out = [];
    for (const item of (list || []).slice(0, 20)) {
      let rel;
      if (item.staged) rel = await ws.finalizeAttachment(project.workspace, item.staged);
      else if (item.path) {
        const abs = resolveInside(project.workspace, item.path);
        if (!abs) throw Object.assign(new Error('Ungültiger Dateipfad'), { status: 400 });
        rel = item.path.replace(/\\/g, '/');
      } else continue;
      const abs = resolveInside(project.workspace, rel);
      const st = await fsp.stat(abs).catch(() => null);
      const info = await ws.ensureExtract(project.workspace, rel);
      out.push({
        path: rel, name: path.basename(rel), kind: info.kind, size: st ? st.size : 0,
        lesbar: st ? info.lesbar : 'nein', hinweis: st ? info.hinweis || '' : 'Datei fehlt', extrakt: info.extrakt || '',
      });
    }
    return out;
  }

  async start(project, chatId, { text, attachments, importId }, send) {
    if (this.runs.has(chatId)) throw Object.assign(new Error('In diesem Chat läuft bereits eine Antwort.'), { status: 409 });
    const chat = project.getChat(chatId);
    // Läuft noch die Anbieterprüfung (z. B. direkt nach dem Start), erst deren Auswahl abwarten.
    await this.bereit();
    if (this.runs.has(chatId)) throw Object.assign(new Error('In diesem Chat läuft bereits eine Antwort.'), { status: 409 });
    const providerId = this.settings().provider;
    let model = ((this.settings().modelle || {})[providerId]) || '';
    let effort = GRUENDLICHKEIT[this.settings().gruendlichkeit] || '';
    const selbstGewaehlt = !!(this.settings().modellGewaehlt || {})[providerId];
    const pstate = this.providers.state[providerId];
    if (!this.providers.usable(providerId)) {
      const err = new Error(`${pstate.name}: ${pstate.label || pstate.detail || 'nicht verfügbar'}`);
      err.status = 409; err.hint = pstate.hint || null; err.code = 'anbieter';
      throw err;
    }
    // Übernahme einer bestehenden Arbeit: Inventar muss vorliegen.
    let inv = null;
    if (importId) {
      inv = await importer.loadInventory(project, importId);
      if (!inv) throw Object.assign(new Error('Die Übernahme wurde noch nicht vorbereitet.'), { status: 400 });
      if (!inv.anzahl) throw Object.assign(new Error('Es wurden keine Dateien übernommen.'), { status: 400 });
    }
    const weiteres = !!(inv && project.data.uebernahme && project.data.uebernahme.importId !== inv.id);
    const cleanText = String(text || '').trim() || (inv
      ? (weiteres ? 'Hier ist neues Material zu meiner Facharbeit. Sortiere es bitte ein und aktualisiere meinen Stand.' : 'Sortiere bitte alles ein, was ich schon gemacht habe, und bring meinen Arbeitsstand auf den neuesten Stand.')
      : '');
    if (!cleanText && !(attachments && attachments.length)) throw Object.assign(new Error('Die Nachricht ist leer.'), { status: 400 });

    // Platz reservieren, bevor asynchron gearbeitet wird.
    const run = { subscribers: new Set(), message: null, handle: null, stopRequested: false };
    this.runs.set(chatId, run);
    if (send) run.subscribers.add(send);
    const broadcast = (ev) => { for (const s of run.subscribers) { try { s(ev); } catch { /* Verbindung weg */ } } };

    try {
      const atts = await this.prepareAttachments(project, attachments);
      const earlier = chat.messages.slice();
      const userMsg = { id: newId(), role: 'user', text: cleanText, attachments: atts, createdAt: nowIso() };
      const msg = {
        id: newId(), role: 'assistant', provider: providerId, model: '', modelWahl: model, text: '', status: 'laeuft',
        activity: [], files: [], updates: null, createdAt: nowIso(),
      };
      if (inv) {
        userMsg.import = {
          id: inv.id, ordner: inv.ordner, anzahl: inv.anzahl, bytes: inv.bytes,
          ordnerAnzahl: inv.ordnerListe.length, unlesbar: inv.unlesbar.length,
          nichtUebernommen: (inv.nichtUebernommen || []).length,
        };
        msg.mode = 'import';
      }
      run.message = msg;
      if (chat.titleAuto && !earlier.some((m) => m.role === 'user')) chat.title = inv ? (weiteres ? 'Neues Material einsortiert' : 'Bisherige Arbeit einsortiert') : autoTitle(cleanText, atts);
      chat.messages.push(userMsg, msg);
      chat.updatedAt = nowIso();
      await project.saveChat(chat);
      broadcast({ type: 'start', userMessage: userMsg, message: msg, chat: { id: chat.id, title: chat.title, updatedAt: chat.updatedAt } });

      // Projektkontext: nur senden, wenn er sich seit der letzten Nachricht geändert hat.
      const files = await ws.listFiles(project.workspace);
      const context = await ctx.buildContext(project, files);
      const sess = chat.sessions[providerId] || {};
      let sessionId = sess.id || null;
      let resume = !!sessionId;
      let history = !sessionId && earlier.length ? ctx.historyTranscript(earlier) : '';
      const buildPrompt = (unchanged) => ctx.buildPrompt({
        context: context.text, contextUnchanged: unchanged, attachments: atts, history,
        text: inv ? `${cleanText}\n\n${importer.importPrompt(inv, { bisher: project.data.uebernahme })}` : cleanText || 'Bitte sieh dir die angehängten Dateien an.',
      });
      let prompt = buildPrompt(!!sessionId && sess.contextHash === context.hash);
      userMsg.gesendet = prompt;

      const rulesFile = path.join(ws.internalDir(project.workspace), 'regeln.md');
      const rulesText = await fsp.readFile(rulesFile, 'utf8').catch(() => '');
      const before = await ws.snapshot(project.workspace);
      const started = Date.now();

      let saveTimer = null;
      const scheduleSave = () => {
        if (saveTimer) return;
        saveTimer = setTimeout(() => { saveTimer = null; project.saveChat(chat).catch(() => {}); }, 1500);
      };
      const onEvent = (ev) => {
        if (ev.type === 'init') {
          if (ev.model) msg.model = ev.model;
        } else if (ev.type === 'text') {
          msg.text += ev.delta;
          broadcast({ type: 'text', delta: ev.delta });
          scheduleSave();
        } else if (ev.type === 'activity') {
          if (msg.activity.length < 200) msg.activity.push(ev.item);
          broadcast({ type: 'activity', item: ev.item });
          scheduleSave();
        }
      };

      const launch = async (p) => {
        let finalPrompt = p;
        if (providerId === 'antigravity' && p.length > MAX_ARG_PROMPT) {
          const file = path.join(ws.internalDir(project.workspace), 'nachrichten', `${userMsg.id}.md`);
          await writeTextAtomic(file, p);
          finalPrompt = `Die vollständige Nachricht mit Projektkontext und Anhängen steht in der Datei .facharbeit/nachrichten/${userMsg.id}.md. Lies sie vollständig und antworte darauf.`;
        }
        if (providerId === 'claude' && !sessionId) { sessionId = newId(); resume = false; }
        run.handle = this.providers.run(providerId, {
          cwd: project.workspace, prompt: finalPrompt, sessionId, resume, rulesText, rulesFile, onEvent, model, effort,
        });
        if (run.stopRequested) run.handle.cancel();
        return run.handle.done;
      };

      let res = await launch(prompt);
      // Sitzung nicht mehr vorhanden: einmal mit neuer Sitzung und Chatverlauf wiederholen.
      if (res.error && !msg.text && !run.stopRequested && (res.errorKind === 'sitzung' || res.errorKind === 'sitzung_belegt')) {
        if (res.errorKind === 'sitzung_belegt') { resume = true; } else {
          sessionId = null; resume = false; history = earlier.length ? ctx.historyTranscript(earlier) : '';
          prompt = buildPrompt(false);
          userMsg.gesendet = prompt;
        }
        msg.activity.push({ kind: 'info', label: 'Sitzung neu gestartet' });
        res = await launch(prompt);
      }
      // Modell abgelehnt: einmal so wiederholen, wie die CLI im Terminal startet (ohne --model und
      // --effort). Ein automatisch gewähltes Modell nimmt die App danach aus der Auswahl, ein selbst
      // gewähltes bleibt und wird unter der Antwort gemeldet.
      if (res.error && res.errorKind === 'modell' && !run.stopRequested && (model || effort)) {
        const abgelehnt = model;
        model = '';
        effort = '';
        // Die abgelehnte Anfrage hat keinen Verlauf erzeugt: Eine bestehende Sitzung läuft weiter,
        // sonst beginnt eine neue (bei Claude mit neuer Sitzungs-ID).
        if (!sess.id) { sessionId = null; resume = false; }
        Object.assign(msg, { text: '', modelWahl: '', modellErsatz: abgelehnt || null });
        msg.activity.push({ kind: 'info', label: abgelehnt ? `Modell „${abgelehnt}“ nicht verfügbar – Voreinstellung von ${pstate.name}` : `Neuer Versuch mit der Voreinstellung von ${pstate.name}` });
        broadcast({ type: 'snapshot', message: msg });
        res = await launch(prompt);
        if (!res.error && abgelehnt && !selbstGewaehlt) await this.modellAbgelehnt(providerId, abgelehnt).catch(() => {});
        if (selbstGewaehlt) msg.modellSelbst = true;
      }
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }

      // Dateiänderungen erfassen und vorherige Fassungen sichern.
      let changes = [];
      try { changes = await ws.diffAndBackup(project.workspace, before); } catch (err) { changes = []; msg.activity.push({ kind: 'info', label: `Dateiabgleich fehlgeschlagen: ${err.message}` }); }
      // Originale (mitgebrachte Dateien, Anhänge) bleiben unverändert: Änderungen zurückholen.
      changes = await ws.restoreChanges(project.workspace, changes);

      // Einsortieren: Der Assistent nennt Quelle und Ziel, die App kopiert bzw. wandelt wortgetreu um.
      const sp = sortieren.parsePlan(res.text || msg.text);
      let einsortiert = [];
      if (sp.plan.length && !res.canceled) {
        einsortiert = await sortieren.applyPlan(project, sp.plan);
        for (const r of einsortiert) {
          if (r.fehler) continue;
          const known = changes.find((c) => c.path === r.nach);
          if (known) Object.assign(known, { aktion: r.ersetzt ? 'geaendert' : 'neu', version: r.version || known.version });
          else changes.push({ path: r.nach, aktion: r.ersetzt ? 'geaendert' : 'neu', kind: kindOf(r.nach), version: r.version || undefined });
        }
      }
      if (sp.invalid) msg.activity.push({ kind: 'info', label: 'Einsortier-Plan war nicht lesbar und wurde ignoriert' });

      const parsed = ctx.parseUpdate(sp.text);
      const filesAfter = await ws.listFiles(project.workspace);
      let applied = null;
      if (!res.canceled && parsed.update) applied = await ctx.applyUpdate(project, parsed.update, filesAfter, { nurLeereFelder: !!inv });
      if (parsed.invalid) msg.activity.push({ kind: 'info', label: 'Arbeitsstand-Block war nicht lesbar und wurde ignoriert' });

      let finalText = parsed.text;
      if (inv) {
        const ir = importer.parseResult(finalText);
        finalText = ir.text;
        if (ir.invalid) msg.activity.push({ kind: 'info', label: 'Übernahme-Block war nicht lesbar' });
        if (ir.result && !res.canceled && !res.error) await importer.saveSummary(project, inv, ir.result);
        msg.importErgebnis = importer.displayResult(inv, !res.canceled && !res.error ? ir.result : null, einsortiert);
      } else if (einsortiert.length) {
        msg.einsortiert = einsortiert;
      }

      msg.text = finalText;
      msg.files = changes.slice(0, 100);
      msg.updates = applied && (applied.aufgaben.length || applied.vorschlaege.length || applied.projekt.length || applied.merken.length || applied.konflikte.length) ? applied : null;
      msg.durationMs = Date.now() - started;
      if (run.stopRequested || res.canceled) msg.status = 'abgebrochen';
      else if (res.error) {
        msg.status = 'fehler';
        msg.error = truncate(res.error, 1200);
        msg.errorKind = res.errorKind;
      } else msg.status = 'fertig';

      if (res.sessionId && !(res.error && ['sitzung', 'anmeldung', 'modell'].includes(res.errorKind))) {
        chat.sessions[providerId] = { id: res.sessionId, contextHash: context.hash };
      }
      this.providers.noteResult(providerId, res, project.workspace);
      if (msg.status === 'fehler') msg.hinweis = errorHint(res.errorKind, this.providers.state[providerId], model);
      chat.updatedAt = nowIso();
      await project.saveChat(chat);
      broadcast({ type: 'done', message: msg, chat: { id: chat.id, title: chat.title, updatedAt: chat.updatedAt }, providers: this.providers.publicState(), settings: this.settings() });
    } catch (err) {
      if (run.message) {
        run.message.status = 'fehler';
        run.message.error = err.message;
        await project.saveChat(chat).catch(() => {});
        broadcast({ type: 'done', message: run.message, chat: { id: chat.id, title: chat.title, updatedAt: chat.updatedAt } });
      } else {
        throw err;
      }
    } finally {
      this.runs.delete(chatId);
      for (const s of run.subscribers) { try { s(null); } catch { /* beendet */ } }
    }
  }
}

module.exports = { RunManager, autoTitle };
