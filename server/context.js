'use strict';
// Projektkontext für den Assistenten, Übersichtsdatei, Auswertung der
// Arbeitsstand-Blöcke in Antworten und Export der Gesprächsverläufe.
const { formatDateDE, parseLocalDate, daysUntil, sha1, truncate, humanSize } = require('./util');
const { STATUS_INFO, PHASEN, AUFGABEN_BY_ID, STATUS } = require('./aufgaben');
const { kindLabel } = require('./extract');

const MARKER = 'mango-facharbeit:verwaltet';

const FELD_LABEL = {
  name: 'Name', klasse: 'Klasse/Kurs', titel: 'Titel', fach: 'Fach', bezugsfach: 'Bezugsfach',
  fachrichtung: 'Fachrichtung', lehrkraft: 'Betreuende Lehrkraft', abgabedatum: 'Abgabedatum',
  forschungsfrage: 'Fragestellung/These', methode: 'Methode/Eigenanteil',
};

function statusText(status) {
  const s = STATUS_INFO[status] || STATUS_INFO.offen;
  return `${s.symbol} ${s.label}`;
}

function fristText(frist, now = new Date()) {
  const d = parseLocalDate(frist);
  if (!d) return '';
  const hasTime = /T\d{2}:\d{2}/.test(frist) && !/T23:59/.test(frist);
  const base = formatDateDE(d, { withTime: hasTime });
  const n = daysUntil(d, now);
  if (n === 0) return `${base} (heute)`;
  if (n === 1) return `${base} (morgen)`;
  if (n > 1) return `${base} (in ${n} Tagen)`;
  return `${base} (vorbei)`;
}

function abgabeDatum(project) {
  return project.data.angaben.abgabedatum ? `${project.data.angaben.abgabedatum}T16:00` : '2026-12-07T16:00';
}

function naechsteFristen(project, now = new Date(), max = 3) {
  const items = [];
  for (const a of project.aufgaben()) {
    if (a.status === 'erledigt' || !a.frist) continue;
    const frist = a.frist;
    const d = parseLocalDate(frist);
    if (!d || daysUntil(d, now) < 0) continue;
    items.push({ id: a.id, titel: a.titel, frist, d });
  }
  items.sort((x, y) => x.d - y.d);
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.frist.slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= max) break;
  }
  return out;
}

function ueberfaellig(project, now = new Date()) {
  return project.aufgaben().filter((a) => {
    if (a.status === 'erledigt' || !a.frist) return false;
    const d = parseLocalDate(a.frist);
    return d && daysUntil(d, now) < 0;
  });
}

// ---------- FACHARBEIT.md ----------

function renderOverview(project, now = new Date()) {
  const a = project.data.angaben;
  const lines = [];
  lines.push(`<!-- ${MARKER} -->`);
  lines.push(`# Facharbeit: ${a.titel || '(Titel noch offen)'}`);
  lines.push('');
  lines.push(`*Automatisch erstellt von Mango Facharbeit, Stand ${formatDateDE(now, { withTime: true })}. Änderungen bitte in der App vornehmen.*`);
  lines.push('');
  lines.push('## Projektangaben');
  lines.push('');
  lines.push('| Angabe | Wert |');
  lines.push('|---|---|');
  for (const [key, label] of Object.entries(FELD_LABEL)) {
    let v = a[key] || '–';
    if (key === 'abgabedatum' && a[key]) v = formatDateDE(parseLocalDate(a[key]));
    lines.push(`| ${label} | ${String(v).replace(/\|/g, '/')} |`);
  }
  lines.push('');
  lines.push('## Arbeitsstand');
  lines.push('');
  lines.push('Legende: × Offen (noch nicht begonnen) · ? In Arbeit (begonnen, noch nicht abgeschlossen oder geprüft) · ✓ Erledigt (fertiggestellt und anhand der Vorgaben geprüft)');
  const aufgaben = project.aufgaben();
  for (const phase of PHASEN) {
    lines.push('');
    lines.push(`### ${phase.titel}`);
    lines.push('');
    for (const t of aufgaben.filter((x) => x.phase === phase.id)) {
      let line = `- ${statusText(t.status)} – ${t.titel}`;
      if (t.frist) line += ` (Frist: ${formatDateDE(parseLocalDate(t.frist))})`;
      const extra = [t.notiz, t.nachweis && `Nachweis: ${t.nachweis}`].filter(Boolean).join('; ');
      if (extra) line += ` – ${extra}`;
      lines.push(line);
    }
  }
  lines.push('');
  const u = project.data.uebernahme;
  if (u && u.zusammenfassung) {
    lines.push('## Übernommener Stand');
    lines.push('');
    lines.push(`*Mitgebrachte Arbeit, zuletzt übernommen am ${formatDateDE(u.am)} (${u.anzahl} Dateien in ${(u.importe || [{ ordner: u.ordner }]).map((i) => `\`${i.ordner}/\``).join(', ')}).*`);
    lines.push('');
    lines.push(u.zusammenfassung);
    lines.push('');
  }
  lines.push('## Gemerkte Ergebnisse und Entscheidungen');
  lines.push('');
  if (!project.data.merken.length) lines.push('- (noch keine)');
  for (const m of project.data.merken) lines.push(`- ${formatDateDE(m.am)}: ${m.text}`);
  lines.push('');
  return lines.join('\n');
}

// ---------- Projektkontext für jede Nachricht ----------

async function recentFiles(project, files, max = 25) {
  const created = Date.parse(project.data.createdAt || 0) || 0;
  return files
    .filter((f) => !f.path.startsWith('00_vorgaben/') && !f.path.startsWith('uebernommen/') && f.path !== 'FACHARBEIT.md' && f.mtime > created + 60000)
    .sort((x, y) => y.mtime - x.mtime)
    .slice(0, max);
}

async function buildContext(project, files, now = new Date()) {
  const a = project.data.angaben;
  const L = [];
  L.push(`Heute: ${formatDateDE(now, { weekday: true })}`);
  const proj = [];
  for (const key of ['name', 'klasse', 'titel', 'fach', 'bezugsfach', 'fachrichtung', 'lehrkraft']) {
    if (a[key]) proj.push(`${FELD_LABEL[key]}: ${a[key]}`);
  }
  proj.push(`Abgabe: ${fristText(abgabeDatum(project), now)}${a.abgabedatum ? '' : ' (laut Zeitschiene)'}`);
  L.push(`Projekt: ${proj.join('; ')}`);
  L.push(`Fragestellung/These: ${a.forschungsfrage || '(noch nicht festgelegt)'}`);
  if (a.methode) L.push(`Methode/Eigenanteil: ${a.methode}`);
  const fehlend = ['name', 'klasse', 'titel', 'fach', 'bezugsfach', 'lehrkraft'].filter((k) => !a[k]).map((k) => FELD_LABEL[k]);
  if (fehlend.length) L.push(`Noch fehlende Angaben: ${fehlend.join(', ')} (bei passender Gelegenheit nachfragen)`);
  L.push('');
  L.push('Arbeitsstand (Status ID – Aufgabe [Frist]; × offen, ? in Arbeit, ✓ erledigt):');
  for (const t of project.aufgaben()) {
    let line = `${STATUS_INFO[t.status].symbol} ${t.id} – ${t.titel}`;
    if (t.frist) line += ` [${formatDateDE(parseLocalDate(t.frist))}]`;
    if (AUFGABEN_BY_ID.get(t.id).extern) line += ' {außerhalb der App}';
    const extra = [t.notiz, t.nachweis && `Nachweis: ${t.nachweis}`].filter(Boolean).join('; ');
    if (extra) line += ` (${truncate(extra, 160)})`;
    L.push(line);
  }
  const next = naechsteFristen(project, now);
  if (next.length) L.push(`Nächste Fristen: ${next.map((n) => `${n.titel} ${fristText(n.frist, now)}`).join('; ')}`);
  const over = ueberfaellig(project, now);
  if (over.length) L.push(`Frist vorbei, aber nicht erledigt: ${over.map((o) => o.titel).join('; ')}`);
  L.push('');
  if (project.data.merken.length) {
    L.push('Gemerkte Ergebnisse und Entscheidungen:');
    for (const m of project.data.merken.slice(-25)) L.push(`- ${m.text}`);
    L.push('');
  }
  const u = project.data.uebernahme;
  if (u && u.zusammenfassung) {
    const orte = (u.importe || [{ ordner: u.ordner }]).map((i) => `${i.ordner}/`).join(', ');
    L.push(`Übernommener Stand (mitgebrachte Arbeit, zuletzt übernommen am ${formatDateDE(u.am)}, Originale in ${orte}, Details in .facharbeit/uebernahme.md):`);
    L.push(truncate(u.zusammenfassung, 3000));
    if (u.versionen && u.versionen.length) L.push(`Offene Fragen zu Entwurfsständen: ${u.versionen.map((v) => `${v.frage || 'Welche Fassung ist aktuell?'} (${v.dateien.join(', ')})`).join('; ')}`);
    L.push('');
  }
  const recent = await recentFiles(project, files);
  if (recent.length) {
    L.push('Eigene Dateien im Arbeitsraum (zuletzt geändert zuerst):');
    for (const f of recent) L.push(`- ${f.path} (${formatDateDE(new Date(f.mtime))})`);
  } else {
    L.push('Eigene Dateien im Arbeitsraum: noch keine (nur Vorlagen in 01_ bis 08_).');
  }
  L.push('Vorgaben: 00_vorgaben/anforderungen.md · Regeln: .facharbeit/regeln.md');
  const body = L.join('\n');
  // Der Hash ignoriert die Uhrzeit, damit unveränderter Kontext nicht erneut gesendet wird.
  return { text: `<projektkontext stand="${formatDateDE(now, { withTime: true })}">\n${body}\n</projektkontext>`, hash: sha1(body) };
}

function describeAttachment(att) {
  const parts = [`${att.path} (${kindLabel(att.kind)}${att.size ? `, ${humanSize(att.size)}` : ''})`];
  if (att.lesbar === 'ja' && att.extrakt) parts.push(`Textauszug: ${att.extrakt}`);
  else if (att.lesbar === 'direkt') parts.push(att.kind === 'image' ? 'Bild, direkt ansehen' : 'direkt lesen');
  else parts.push(`NICHT LESBAR: ${att.hinweis || 'Dateityp wird nicht unterstützt'}`);
  return `- ${parts.join(' – ')}`;
}

function historyTranscript(messages, maxChars = 24000) {
  const out = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m.text) continue;
    const who = m.role === 'user' ? 'Schüler/in' : 'Assistent';
    const entry = `${who}: ${truncate(m.text, 4000)}`;
    if (used + entry.length > maxChars) break;
    out.unshift(entry);
    used += entry.length;
  }
  return out.join('\n\n');
}

function buildPrompt({ context, contextUnchanged, attachments = [], history, text }) {
  const parts = [];
  parts.push(contextUnchanged ? '<projektkontext>unverändert seit der letzten Nachricht</projektkontext>' : context);
  if (history) {
    parts.push(`<bisheriger_chatverlauf hinweis="Dieser Chat wurde mit einem anderen Anbieter oder in einer früheren Sitzung begonnen.">\n${history}\n</bisheriger_chatverlauf>`);
  }
  if (attachments.length) {
    parts.push(`<anhaenge hinweis="Diese Dateien gehören zur aktuellen Nachricht. Lies sie, bevor du antwortest.">\n${attachments.map(describeAttachment).join('\n')}\n</anhaenge>`);
  }
  parts.push(`Nachricht der Schülerin bzw. des Schülers:\n${text}`);
  return parts.join('\n\n');
}

// ---------- Arbeitsstand-Block in Antworten ----------

const BLOCK_RE = /```[ \t]*arbeitsstand[^\n]*\n([\s\S]*?)(?:\n```|$)/gi;

function parseUpdate(text) {
  const raw = String(text || '');
  const merged = { aufgaben: [], projekt: {}, merken: [] };
  let found = false;
  let invalid = false;
  for (const m of raw.matchAll(BLOCK_RE)) {
    found = true;
    try {
      const json = JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, '$1'));
      if (Array.isArray(json.aufgaben)) merged.aufgaben.push(...json.aufgaben);
      if (json.projekt && typeof json.projekt === 'object') Object.assign(merged.projekt, json.projekt);
      if (Array.isArray(json.merken)) merged.merken.push(...json.merken);
      else if (typeof json.merken === 'string') merged.merken.push(json.merken);
    } catch {
      invalid = true;
    }
  }
  const clean = raw.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text: clean, update: found ? merged : null, invalid };
}

// Verweist der Nachweis auf eine Datei, muss sie im Arbeitsraum existieren.
function nachweisDateiOk(nachweis, files) {
  const s = String(nachweis);
  if (!/\.(md|txt|docx?|pdf|pptx?|xlsx?|csv|odt|png|jpe?g|svg)\b/i.test(s)) return true; // kein Dateiverweis
  const norm = s.replace(/\\/g, '/');
  return files.some((f) => norm.includes(f.path) || norm.includes(f.name));
}

async function applyUpdate(project, update, files = [], { nurLeereFelder = false } = {}) {
  const result = { aufgaben: [], vorschlaege: [], projekt: [], merken: [], hinweise: [], konflikte: [] };
  if (!update) return result;

  for (const item of update.aufgaben.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const def = AUFGABEN_BY_ID.get(item.id);
    if (!def || !STATUS.includes(item.status)) { result.hinweise.push(`Unbekannte Aufgabe oder Status ignoriert: ${item.id}`); continue; }
    const current = project.aufgaben().find((t) => t.id === item.id);
    let status = item.status;
    let notiz = item.notiz !== undefined ? String(item.notiz) : undefined;
    const nachweis = item.nachweis !== undefined ? String(item.nachweis) : undefined;
    let hinweis = '';

    if (status === 'erledigt' && def.extern) {
      if (current.status !== 'erledigt') result.vorschlaege.push({ id: def.id, titel: def.titel, status: 'erledigt', notiz: notiz || '' });
      continue;
    }
    if (status === 'erledigt') {
      if (!nachweis || !nachweis.trim()) {
        status = 'in_arbeit';
        hinweis = 'ohne Nachweis nicht als erledigt übernommen';
      } else {
        if (!nachweisDateiOk(nachweis, files)) { status = 'in_arbeit'; hinweis = 'Nachweis-Datei nicht gefunden'; }
      }
      if (status !== 'erledigt' && current.status === 'erledigt') continue; // nichts verschlechtern ohne Grund
    }
    if (hinweis) notiz = [notiz, hinweis].filter(Boolean).join(' – ');
    if (current.status === status && (notiz === undefined || notiz === current.notiz) && (nachweis === undefined || nachweis === current.nachweis)) continue;
    await project.setStatus(def.id, status, { von: 'assistent', notiz, nachweis });
    if (current.status !== status) result.aufgaben.push({ id: def.id, titel: def.titel, von: current.status, nach: status, hinweis });
  }

  const erlaubt = Object.keys(FELD_LABEL);
  const patch = {};
  for (const [k, v] of Object.entries(update.projekt || {})) {
    if (!erlaubt.includes(k) || v == null) continue;
    const val = String(v).trim();
    if (!val || val === project.data.angaben[k]) continue;
    if (k === 'abgabedatum' && !/^\d{4}-\d{2}-\d{2}$/.test(val)) continue;
    // Bei der Übernahme nur leere Felder füllen; Abweichungen bestätigt die Person selbst.
    if (nurLeereFelder && project.data.angaben[k]) {
      result.konflikte.push({ feld: k, label: FELD_LABEL[k], bisher: project.data.angaben[k], gefunden: val.slice(0, 600) });
      continue;
    }
    patch[k] = val;
  }
  if (Object.keys(patch).length) {
    await project.updateAngaben(patch);
    for (const k of Object.keys(patch)) result.projekt.push({ feld: k, label: FELD_LABEL[k], wert: project.data.angaben[k] });
  }

  if (update.merken.length) {
    const added = await project.addMerken(update.merken.slice(0, 10));
    result.merken.push(...added.map((m) => m.text));
  }
  return result;
}

// ---------- Export der Gesprächsverläufe ----------

const PROVIDER_NAMES = { claude: 'Claude Code', antigravity: 'Antigravity' };

function chatToMarkdown(chat, { project, level = 1 } = {}) {
  const h = '#'.repeat(level);
  const L = [];
  L.push(`${h} KI-Gesprächsverlauf: ${chat.title}`);
  L.push('');
  const providers = [...new Set(chat.messages.filter((m) => m.role === 'assistant').map((m) => PROVIDER_NAMES[m.provider] + (m.model ? ` (${m.model})` : '')))];
  L.push(`- Begonnen: ${formatDateDE(chat.createdAt, { withTime: true })}`);
  L.push(`- KI-Tool: ${providers.join(', ') || '–'}`);
  if (project) L.push(`- Facharbeit: ${project.data.angaben.titel || '–'}${project.data.angaben.name ? `, ${project.data.angaben.name}` : ''}`);
  L.push('');
  let n = 0;
  for (const m of chat.messages) {
    if (m.role === 'user') {
      n += 1;
      L.push(`${h}# Prompt ${n} (${formatDateDE(m.createdAt, { withTime: true })})`);
      L.push('');
      L.push(m.text || '');
      if (m.attachments && m.attachments.length) {
        L.push('');
        L.push(`Angehängte Dateien: ${m.attachments.map((a) => a.path).join(', ')}`);
      }
      L.push('');
    } else {
      L.push(`${h}# Antwort zu Prompt ${n} (${PROVIDER_NAMES[m.provider] || 'KI'}, ${formatDateDE(m.createdAt, { withTime: true })})`);
      L.push('');
      L.push(m.text || (m.status === 'fehler' ? `(Fehler: ${m.error || 'keine Antwort'})` : '(keine Antwort)'));
      if (m.status === 'abgebrochen') L.push('\n*(Antwort wurde abgebrochen.)*');
      if (m.files && m.files.length) {
        L.push('');
        L.push(`Vom Assistenten erstellte oder geänderte Dateien: ${m.files.map((f) => `${f.path} (${f.aktion})`).join(', ')}`);
      }
      L.push('');
    }
  }
  return L.join('\n');
}

function transcriptsMarkdown(project, chats, now = new Date()) {
  const L = [];
  L.push('# Anlage: Vollständige Verläufe der KI-Gespräche');
  L.push('');
  L.push(`Exportiert am ${formatDateDE(now, { withTime: true })} mit Mango Facharbeit.`);
  L.push('');
  L.push('Hinweis: Zu jeder Nachricht hat die App automatisch Projektangaben, Arbeitsstand und eine Dateiliste als Kontext an das KI-Tool übermittelt. Die Regeln für den Assistenten stehen im Arbeitsraum unter `.facharbeit/regeln.md`. Die vollständigen Rohdaten liegen unter `.facharbeit/chats/`.');
  L.push('');
  L.push('Kennzeichnung nach Handreichung 3.6: „Erstellt mithilfe von [KI-Tool]. Prompt 1: …; Prompt 2: …“');
  L.push('');
  const sorted = [...chats].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  sorted.forEach((c, i) => {
    if (!c.messages.length) return;
    L.push(chatToMarkdown(c, { project, level: 2 }).replace(/^## KI-Gesprächsverlauf: /, `## Gespräch ${i + 1}: `));
    L.push('');
    L.push('---');
    L.push('');
  });
  return L.join('\n');
}

module.exports = {
  nachweisDateiOk, renderOverview, buildContext, buildPrompt, historyTranscript, parseUpdate, applyUpdate,
  chatToMarkdown, transcriptsMarkdown, naechsteFristen, fristText, abgabeDatum, statusText, FELD_LABEL, PROVIDER_NAMES,
  ueberfaellig,
};
