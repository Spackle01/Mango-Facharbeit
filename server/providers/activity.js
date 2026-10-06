'use strict';
// Übersetzt Werkzeugaufrufe der Anbieter in kurze deutsche Arbeitsschritte.
const path = require('path');

function relPath(cwd, p) {
  if (!p || typeof p !== 'string') return '';
  if (/^file:\/\//.test(p)) {
    try { p = decodeURIComponent(new URL(p).pathname); } catch { /* unverändert */ }
    if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
  }
  const rel = path.isAbsolute(p) && cwd ? path.relative(cwd, p) : p;
  if (rel.startsWith('..')) return path.basename(p);
  return rel.split(path.sep).join('/');
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return String(url || '').slice(0, 60); }
}

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) if (obj[k]) return obj[k];
  return '';
}

const PATH_KEYS = ['file_path', 'path', 'absolute_path', 'AbsolutePath', 'TargetFile', 'target_file', 'filePath', 'notebook_path', 'Uri', 'uri'];
const QUERY_KEYS = ['query', 'Query', 'search_query', 'q'];
const PATTERN_KEYS = ['pattern', 'Pattern', 'regex', 'glob'];

function describeTool(name, input, cwd) {
  const n = String(name || '');
  const lower = n.toLowerCase();
  const file = relPath(cwd, pick(input, PATH_KEYS));
  const query = pick(input, QUERY_KEYS);
  const pattern = pick(input, PATTERN_KEYS);
  const url = pick(input, ['url', 'Url', 'URL']);
  switch (n) {
    case 'Read': return { kind: 'lesen', label: `Liest ${file || 'eine Datei'}`, path: file };
    case 'Write': return { kind: 'schreiben', label: `Schreibt ${file || 'eine Datei'}`, path: file };
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': return { kind: 'schreiben', label: `Bearbeitet ${file || 'eine Datei'}`, path: file };
    case 'Glob': return { kind: 'suchen', label: `Sucht Dateien${pattern ? ` (${pattern})` : ''}` };
    case 'Grep': return { kind: 'suchen', label: `Durchsucht Dateien${pattern ? ` nach „${String(pattern).slice(0, 60)}“` : ''}` };
    case 'WebSearch': return { kind: 'web', label: `Sucht im Web${query ? `: „${String(query).slice(0, 80)}“` : ''}` };
    case 'WebFetch': return { kind: 'web', label: `Öffnet ${host(url) || 'eine Webseite'}` };
    case 'TodoWrite': return { kind: 'planen', label: 'Plant die Arbeitsschritte' };
    case 'Skill': return { kind: 'skill', label: `Nutzt den Skill ${pick(input, ['skill', 'name', 'command']) || ''}`.trim() };
    case 'Task': case 'Agent': return { kind: 'planen', label: 'Bearbeitet eine Teilaufgabe' };
    case 'Bash': return { kind: 'befehl', label: 'Führt einen Befehl aus' };
    default: break;
  }
  if (/web|google|browse|search_web|fetch_url|read_url/.test(lower)) {
    return { kind: 'web', label: query ? `Sucht im Web: „${String(query).slice(0, 80)}“` : url ? `Öffnet ${host(url)}` : 'Recherchiert im Web' };
  }
  if (/write|create|save/.test(lower)) return { kind: 'schreiben', label: `Schreibt ${file || 'eine Datei'}`, path: file };
  if (/edit|replace|patch|modify/.test(lower)) return { kind: 'schreiben', label: `Bearbeitet ${file || 'eine Datei'}`, path: file };
  if (/read|view|open/.test(lower)) return { kind: 'lesen', label: `Liest ${file || 'eine Datei'}`, path: file };
  if (/grep|find|search|list|glob/.test(lower)) return { kind: 'suchen', label: pattern ? `Durchsucht Dateien nach „${String(pattern).slice(0, 60)}“` : 'Durchsucht den Arbeitsraum' };
  if (/command|shell|terminal|run|exec/.test(lower)) return { kind: 'befehl', label: 'Führt einen Befehl aus' };
  return { kind: 'werkzeug', label: `Nutzt ${n || 'ein Werkzeug'}` };
}

// Ordnet Fehlermeldungen einer Kategorie zu, damit die App einen passenden Hinweis zeigen kann.
function classifyError(text) {
  const t = String(text || '');
  if (/not logged in|please run \/login|\/login|invalid api key|authentication|unauthori[sz]ed|\b401\b|oauth|sign in|log ?in required|credentials/i.test(t)) return 'anmeldung';
  if (/trust/i.test(t) && /folder|workspace|director/i.test(t)) return 'vertrauen';
  if (/no conversation found|conversation .*not found|session .*not found|could not find (session|conversation)/i.test(t)) return 'sitzung';
  if (/already in use/i.test(t)) return 'sitzung_belegt';
  if (/rate.?limit|usage limit|quota|resource_exhausted|\b429\b|overloaded|\b529\b/i.test(t)) return 'limit';
  if (/enotfound|econnrefused|econnreset|etimedout|network|fetch failed|getaddrinfo|socket hang up/i.test(t)) return 'netz';
  if (/unknown option|unrecognized option|unknown argument/i.test(t)) return 'version';
  return 'allgemein';
}

module.exports = { describeTool, classifyError, relPath };
