'use strict';
// Anbindung an die Antigravity CLI (agy) im Headless-Modus.
// Dokumentation: https://antigravity.google/docs/cli/headless/
// Wichtig: stdin muss geschlossen sein, und -p/--print verbraucht das nächste Argument
// als Prompt – deshalb steht es immer am Ende.
const { which, runCapture, spawnProgram, killTree, onJsonLines, IS_WIN } = require('./proc');
const { describeTool, classifyError } = require('./activity');
const { parseAgyModels } = require('./models');

const ID = 'antigravity';
const NAME = 'Antigravity';
const INSTALL_LINK = 'https://antigravity.google/docs/getting-started?tab=cli';

function installHint() {
  return IS_WIN
    ? { text: 'Die Antigravity CLI (agy) ist nicht installiert. Installiere sie in der PowerShell und prüfe danach erneut.', befehl: 'irm https://antigravity.google/cli/install.ps1 | iex', link: INSTALL_LINK }
    : { text: 'Die Antigravity CLI (agy) ist nicht installiert. Installiere sie im Terminal und prüfe danach erneut.', befehl: 'curl -fsSL https://antigravity.google/cli/install.sh | bash', link: INSTALL_LINK };
}

function loginHint() {
  return { text: 'Starte agy einmal im Terminal und melde dich mit deinem Google-Konto an. Danach erneut prüfen.', befehl: 'agy' };
}

function trustHint(cwd) {
  return {
    text: 'Antigravity muss dem Arbeitsraum einmal vertrauen. Öffne den Ordner im Terminal, starte agy und bestätige „Yes, I trust this folder“.',
    befehl: cwd ? `cd "${cwd}" && agy` : 'agy',
  };
}

async function detect() {
  const bin = which('agy');
  if (!bin) return { id: ID, name: NAME, installed: false, status: 'nicht_installiert', hint: installHint() };
  const [ver, help, list] = await Promise.all([
    runCapture(bin, ['--version'], { timeout: 20000 }),
    runCapture(bin, ['--help'], { timeout: 20000 }),
    runCapture(bin, ['models'], { timeout: 30000 }), // verfügbare Modelle („agy models“)
  ]);
  if (ver.error) return { id: ID, name: NAME, installed: true, bin, status: 'fehler', detail: 'agy lässt sich nicht starten.', hint: installHint() };
  const h = `${help.stdout}\n${help.stderr}`;
  const caps = {
    printTimeout: h.includes('--print-timeout'),
    conversation: h.includes('--conversation'),
    streamJson: !h || h.includes('stream-json') || h.includes('--output-format'),
    model: h.includes('--model'),
    effort: h.includes('--effort'),
  };
  const models = list && !list.error && list.code === 0 ? parseAgyModels(list.stdout) : [];
  const version = (/(\d+\.\d+(?:\.\d+)?)/.exec(`${ver.stdout} ${ver.stderr}`) || [])[1] || '';
  return { id: ID, name: NAME, installed: true, bin, version, caps, models, status: 'ungeprueft', detail: 'Verbindung noch nicht geprüft' };
}

// Kurzer echter Testaufruf, weil agy keinen eigenen Anmeldestatus-Befehl hat.
async function verify(info, cwd) {
  const args = ['--output-format', 'json'];
  if (info.caps && info.caps.printTimeout) args.push('--print-timeout', '90s');
  args.push('-p', 'Antworte nur mit dem Wort OK.');
  const r = await runCapture(info.bin, args, { cwd, timeout: 120000 });
  let json = null;
  try { json = JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop() || ''); } catch { /* keine JSON-Ausgabe */ }
  if (json && json.status === 'SUCCESS') return { status: 'verbunden', detail: 'Verbunden' };
  const msg = (json && json.error) || r.stderr.trim() || (r.timedOut ? 'Zeitüberschreitung beim Testaufruf' : '') || 'Keine Antwort erhalten';
  const kind = classifyError(msg);
  if (kind === 'anmeldung') return { status: 'anmeldung_noetig', detail: 'Anmeldung nötig', hint: loginHint() };
  if (kind === 'vertrauen') return { status: 'vertrauen_noetig', detail: 'Ordnerfreigabe nötig', hint: trustHint(cwd) };
  return {
    status: 'fehler',
    detail: msg.split('\n').slice(-3).join(' ').slice(0, 300),
    hint: r.code === 0 && !r.stdout.trim()
      ? { text: 'agy hat nichts ausgegeben. Aktualisiere die CLI und prüfe erneut.', befehl: 'agy update' }
      : null,
  };
}

const hatStufe = (id) => /-(low|medium|high)$/i.test(id || '');

function run(info, { cwd, prompt, sessionId, onEvent, model: modelWahl = '', effort = '' }) {
  const caps = info.caps || {};
  const args = ['--output-format', 'stream-json'];
  if (modelWahl && caps.model) args.push('--model', modelWahl);
  // Viele Modelle tragen die Denkstufe schon im Namen (z. B. gemini-3.1-pro-high). Dann gilt diese
  // Stufe; eine abweichende --effort-Angabe würde ihr widersprechen.
  if (effort && caps.effort && !hatStufe(modelWahl)) args.push('--effort', effort);
  if (caps.printTimeout) args.push('--print-timeout', '30m');
  if (sessionId) args.push('--conversation', sessionId);
  args.push('-p', prompt);

  const child = spawnProgram(info.bin, args, { cwd, stdin: 'ignore' });
  let text = '';
  let stderr = '';
  let model = '';
  let cid = sessionId || '';
  let result = null;
  let lastTextStep = null;
  let sawEvent = false;
  let canceled = false;
  const toolSteps = new Set();

  const emitText = (delta) => {
    if (!delta) return;
    text += delta;
    onEvent({ type: 'text', delta });
  };

  onJsonLines(child.stdout, (ev) => {
    if (!ev) return;
    sawEvent = true;
    if (ev.event === 'init') {
      cid = ev.conversation_id || cid;
      model = (ev.init && ev.init.model) || model;
      onEvent({ type: 'init', model, sessionId: cid });
    } else if (ev.event === 'step_update' && ev.step_update) {
      const su = ev.step_update;
      if (su.conversation_id && !cid) cid = su.conversation_id;
      if (su.step_type === 'agent_response' && su.text_delta) {
        if (lastTextStep !== null && lastTextStep !== su.step_index && text && !text.endsWith('\n\n')) emitText('\n\n');
        lastTextStep = su.step_index;
        emitText(su.text_delta);
      } else if (su.step_type === 'tool' && !toolSteps.has(su.step_index)) {
        toolSteps.add(su.step_index);
        const ti = su.tool_info || {};
        onEvent({ type: 'activity', item: describeTool(ti.name || su.tool_name, ti.parameters, cwd) });
      }
    } else if (ev.event === 'result' && ev.result) {
      result = ev.result;
      if (result.conversation_id) cid = result.conversation_id;
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 200000) stderr = stderr.slice(-200000); });

  const done = new Promise((resolve) => {
    let settled = false;
    const finish = (code, spawnError) => {
      if (settled) return;
      settled = true;
      let error = null;
      if (spawnError) error = `agy konnte nicht gestartet werden: ${spawnError.message}`;
      else if (canceled) error = null;
      else if (result && result.status && result.status !== 'SUCCESS') error = result.error || `Antigravity meldet: ${result.status}`;
      else if (!sawEvent) error = stderr.trim().split('\n').slice(-6).join('\n') || 'Antigravity hat keine Antwort geliefert. Bitte „agy update“ ausführen und erneut versuchen.';
      else if (!result && code !== 0) error = stderr.trim().split('\n').slice(-6).join('\n') || `agy wurde unerwartet beendet (Code ${code}).`;
      if (!text && result && result.response && !error) emitText(result.response);
      if (!error && !canceled && !text) error = 'Antigravity hat eine leere Antwort geliefert.';
      resolve({
        text, model, sessionId: cid, canceled, error,
        errorKind: error ? classifyError(`${error}\n${stderr}`) : null,
        stderr: stderr.slice(-4000),
      });
    };
    child.on('error', (err) => finish(-1, err));
    child.on('close', (code) => finish(code));
  });

  return { done, cancel() { canceled = true; killTree(child); } };
}

module.exports = { ID, NAME, detect, verify, run, installHint, loginHint, trustHint };
