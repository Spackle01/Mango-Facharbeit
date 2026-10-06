// Kleiner, sicherer Markdown-Renderer: Text wird immer zuerst maskiert,
// erlaubt sind nur bekannte Strukturen und Links mit http(s)/mailto.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

const FILE_EXT = /\.(md|markdown|txt|docx?|pdf|pptx?|xlsx?|csv|odt|png|jpe?g|gif|webp|svg|json)$/i;

function safeUrl(url) {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u)) return u;
  return null;
}

function inline(text, opts) {
  const tokens = [];
  const keep = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = text;
  // Code-Spans zuerst schützen.
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const c = code.trim();
    if (opts.isFile && FILE_EXT.test(c) && opts.isFile(c)) {
      return keep(`<button type="button" class="file-ref" data-path="${escapeHtml(c)}">${escapeHtml(c)}</button>`);
    }
    return keep(`<code>${escapeHtml(code)}</code>`);
  });
  // Links [Text](URL)
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, label, url) => {
    const safe = safeUrl(url);
    if (safe) return keep(`<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${inline(label, { ...opts, isFile: null })}</a>`);
    if (opts.isFile && opts.isFile(url)) return keep(`<button type="button" class="file-ref" data-path="${escapeHtml(url)}">${escapeHtml(label)}</button>`);
    return keep(escapeHtml(label));
  });
  // Nackte URLs
  s = s.replace(/\bhttps?:\/\/[^\s<>()"]+[^\s<>()".,;:!?'’”]/g, (url) => keep(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`));
  s = escapeHtml(s);
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>');
  s = s.replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  s = s.replace(/\n/g, '<br>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[+i]);
}

function splitRow(line) {
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|') && !l.endsWith('\\|')) l = l.slice(0, -1);
  return l.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

function renderList(lines, opts) {
  // lines: [{indent, ordered, text, start}]
  const html = [];
  let i = 0;
  function build(level) {
    const first = lines[i];
    const ordered = first.ordered;
    const startAttr = ordered && first.start > 1 ? ` start="${first.start}"` : '';
    let out = ordered ? `<ol${startAttr}>` : '<ul>';
    while (i < lines.length && lines[i].indent >= level) {
      if (lines[i].indent > level) { out = out.replace(/<\/li>$/, '') + build(lines[i].indent) + '</li>'; continue; }
      const item = lines[i];
      let body = inline(item.text, opts);
      const task = /^\[( |x|X)\]\s+/.exec(item.text);
      if (task) body = `<span class="task-box${task[1].trim() ? ' done' : ''}" aria-hidden="true"></span>${inline(item.text.slice(task[0].length), opts)}`;
      out += `<li>${body}</li>`;
      i++;
    }
    return `${out}${ordered ? '</ol>' : '</ul>'}`;
  }
  while (i < lines.length) html.push(build(lines[i].indent));
  return html.join('');
}

export function renderMarkdown(src, opts = {}) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let para = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join('\n'), opts)}</p>`); para = []; }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { flush(); i++; continue; }
    const fence = /^(\s*)(```+|~~~+)\s*([\w+-]*)/.exec(line);
    if (fence) {
      flush();
      const marker = fence[2];
      const lang = fence[3] || '';
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) code.push(lines[i++]);
      i++;
      out.push(`<div class="code-block"><div class="code-head"><span>${escapeHtml(lang || 'Text')}</span><button type="button" class="code-copy" aria-label="Code kopieren">Kopieren</button></div><pre><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(4, h[1].length + 1);
      out.push(`<h${level}>${inline(h[2], opts)}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(line)) {
      flush();
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(q.join('\n'), opts)}</blockquote>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      flush();
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      const cell = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c, opts)}</${tag}>`;
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => cell('td', r[k] || '', k)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const li = /^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/.exec(lines[i]);
        if (m) {
          items.push({ indent: m[1].replace(/\t/g, '    ').length, ordered: !!m[3], start: m[3] ? +m[3] : 1, text: m[4] });
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1].text += `\n${lines[i].trim()}`;
          i++;
        } else break;
      }
      // Einrückungen auf Ebenen normalisieren.
      const levels = [...new Set(items.map((x) => x.indent))].sort((a, b) => a - b);
      for (const it of items) it.indent = levels.indexOf(it.indent);
      out.push(renderList(items, opts));
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return out.join('\n');
}

// Entfernt den (ggf. unvollständigen) Arbeitsstand-Block während des Streamens.
export function stripUpdateBlock(text) {
  const idx = text.search(/```[ \t]*arbeitsstand/i);
  if (idx < 0) return text;
  const rest = text.slice(idx);
  const end = rest.indexOf('```', 3);
  if (end < 0) return text.slice(0, idx).trimEnd();
  return (text.slice(0, idx) + rest.slice(end + 3)).trim();
}
