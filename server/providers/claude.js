'use strict';
// Anbindung an die Claude Code CLI im Headless-Modus (claude -p, stream-json).
const { which, runCapture, spawnProgram, killTree, onJsonLines, needsShell, IS_WIN } = require('./proc');
const { describeTool, classifyError } = require('./activity');

const ID = 'claude';
const NAME = 'Claude Code';
const ALLOWED_TOOLS = 'Read,Write,Edit,MultiEdit,Glob,Grep,WebSearch,WebFetch,TodoWrite,Skill';
const READ_ONLY_TOOLS = 'Read,Glob,Grep,TodoWrite,Skill';

function installHint() {
  return IS_WIN
    ? { text: 'Claude Code ist nicht installiert. Installiere es in der PowerShell und starte danach die Prüfung neu.', befehl: 'irm https://claude.ai/install.ps1 | iex' }
    : { text: 'Claude Code ist nicht installiert. Installiere es im Terminal und starte danach die Prüfung neu.', befehl: 'curl -fsSL https://claude.ai/install.sh | bash' };
}

function loginHint() {
  return { text: 'Melde dich einmal im Terminal bei Claude an und prüfe danach erneut.', befehl: 'claude auth login' };
}

async function detect() {
  const bin = which('claude');
  if (!bin) return { id: ID, name: NAME, installed: false, status: 'nicht_installiert', hint: installHint() };
  const [ver, help] = await Promise.all([
    runCapture(bin, ['--version'], { timeout: 20000 }),
    runCapture(bin, ['--help'], { timeout: 20000 }),
  ]);
  if (ver.error || (ver.code !== 0 && !ver.stdout)) {
    return { id: ID, name: NAME, installed: true, bin, status: 'fehler', detail: 'Claude Code lässt sich nicht starten.', hint: installHint() };
  }
  const version = (/(\d+\.\d+\.\d+)/.exec(ver.stdout) || [])[1] || '';
  const h = help.stdout || '';
  const caps = {
    partial: h.includes('--include-partial-messages'),
    permissionMode: h.includes('--permission-mode'),
    sessionId: h.includes('--session-id'),
    appendPrompt: h.includes('--append-system-prompt'),
    appendFile: /append-system-prompt(-file|\[-file\])/.test(h),
    allowedTools: /--allowed-?tools|--allowedTools/i.test(h),
    disallowedTools: /--disallowed-?tools|--disallowedTools/i.test(h),
    auth: /\bauth\b/.test(h),
  };
  const base = { id: ID, name: NAME, installed: true, bin, version, caps };
  if (process.env.ANTHROPIC_API_KEY) return { ...base, status: 'bereit', detail: 'API-Schlüssel gefunden' };
  if (!caps.auth) return { ...base, status: 'bereit', detail: 'Anmeldung wird beim ersten Senden geprüft' };
  const auth = await runCapture(bin, ['auth', 'status', '--json'], { timeout: 20000 });
  try {
    const json = JSON.parse(auth.stdout.trim());
    if (json.loggedIn) return { ...base, status: 'bereit', detail: 'Angemeldet' };
    return { ...base, status: 'anmeldung_noetig', hint: loginHint() };
  } catch {
    return { ...base, status: 'bereit', detail: 'Anmeldung wird beim ersten Senden geprüft' };
  }
}

// Startet einen Durchlauf. Gibt { cancel, done: Promise } zurück.
function run(info, { cwd, prompt, sessionId, resume, rulesText, rulesFile, onEvent, readOnly = false }) {
  const caps = info.caps || {};
  const args = ['-p', '--output-format', 'stream-json', '--verbose'];
  if (caps.partial) args.push('--include-partial-messages');
  if (caps.permissionMode) args.push('--permission-mode', 'acceptEdits');
  if (caps.allowedTools !== false) args.push('--allowedTools', readOnly ? READ_ONLY_TOOLS : ALLOWED_TOOLS);
  // Nur lesen (z. B. bei der Übernahme): Schreibwerkzeuge ausdrücklich sperren.
  if (readOnly && caps.disallowedTools) args.push('--disallowedTools', 'Write,Edit,MultiEdit,NotebookEdit,Bash');
  if (sessionId) {
    if (resume) args.push('--resume', sessionId);
    else if (caps.sessionId) args.push('--session-id', sessionId);
  }
  // Regeln als Systemprompt: direkt als Argument, außer bei .cmd-Starter unter Windows (Längen- und Zeichengrenzen).
  if (rulesText && caps.appendPrompt && !needsShell(info.bin)) args.push('--append-system-prompt', rulesText);
  else if (rulesFile && caps.appendFile) args.push('--append-system-prompt-file', rulesFile);

  const child = spawnProgram(info.bin, args, { cwd, stdin: 'pipe' });
  let text = '';
  let stderr = '';
  let model = '';
  let sid = sessionId || '';
  let result = null;
  let sawTextBlock = false;
  let canceled = false;
  const toolIds = new Set();

  const emitText = (delta) => {
    if (!delta) return;
    text += delta;
    onEvent({ type: 'text', delta });
  };

  onJsonLines(child.stdout, (ev) => {
    if (!ev) return;
    if (ev.type === 'system' && ev.subtype === 'init') {
      model = ev.model || model;
      sid = ev.session_id || sid;
      onEvent({ type: 'init', model, sessionId: sid });
    } else if (ev.type === 'stream_event' && ev.event) {
      const e = ev.event;
      if (e.type === 'content_block_start' && e.content_block && e.content_block.type === 'text') {
        if (sawTextBlock && text && !text.endsWith('\n\n')) emitText('\n\n');
        sawTextBlock = true;
      } else if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta') {
        emitText(e.delta.text);
      }
    } else if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
      for (const block of ev.message.content) {
        if (block.type === 'tool_use' && !toolIds.has(block.id)) {
          toolIds.add(block.id);
          onEvent({ type: 'activity', item: describeTool(block.name, block.input, cwd) });
        } else if (block.type === 'text' && !caps.partial) {
          if (text && !text.endsWith('\n\n')) emitText('\n\n');
          emitText(block.text);
        }
      }
    } else if (ev.type === 'result') {
      result = ev;
      if (ev.session_id) sid = ev.session_id;
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 200000) stderr = stderr.slice(-200000); });
  child.stdin.on('error', () => {});
  child.stdin.end(prompt);

  const done = new Promise((resolve) => {
    let settled = false;
    const finish = (code, spawnError) => {
      if (settled) return;
      settled = true;
      let error = null;
      if (spawnError) error = `Claude Code konnte nicht gestartet werden: ${spawnError.message}`;
      else if (canceled) error = null;
      else if (result && (result.is_error || (result.subtype && result.subtype !== 'success'))) {
        error = (typeof result.result === 'string' && result.result) || (Array.isArray(result.errors) && result.errors.join('; ')) || result.subtype || 'Unbekannter Fehler';
      } else if (!result && code !== 0) {
        error = stderr.trim().split('\n').slice(-6).join('\n') || `Claude Code wurde unerwartet beendet (Code ${code}).`;
      } else if (!result && !text) {
        error = 'Claude Code hat keine Antwort geliefert.';
      }
      if (!text && result && typeof result.result === 'string' && !error) emitText(result.result);
      resolve({
        text, model, sessionId: sid, canceled, error,
        errorKind: error ? classifyError(`${error}\n${stderr}`) : null,
        stderr: stderr.slice(-4000),
        kosten: result && result.total_cost_usd,
      });
    };
    child.on('error', (err) => finish(-1, err));
    child.on('close', (code) => finish(code));
  });

  return {
    done,
    cancel() { canceled = true; killTree(child); },
  };
}

module.exports = { ID, NAME, detect, run, installHint, loginHint };
