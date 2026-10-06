// Kleine DOM-Hilfen: Elemente bauen, Hinweise, Menüs, Dialoge.
import { icon } from './icons.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function iconEl(name, size = 18, cls = '') {
  const span = document.createElement('span');
  span.innerHTML = icon(name, size, cls);
  return span.firstChild;
}

export function btn(label, { iconName, cls = 'btn', title, onClick, attrs = {}, size = 18 } = {}) {
  const b = h('button', { type: 'button', class: cls, title: title || null, 'aria-label': title || (label ? null : attrs['aria-label']), onclick: onClick, ...attrs });
  if (iconName) b.append(iconEl(iconName, size));
  if (label) b.append(h('span', { class: 'lbl' }, label));
  return b;
}

// ---------- Hinweise ----------

export function toast(message, { error = false, action, timeout = 3800 } = {}) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast${error ? ' error' : ''}` }, h('span', {}, message));
  if (action) t.append(btn(action.label, { cls: 'btn', onClick: () => { action.run(); t.remove(); } }));
  box.append(t);
  setTimeout(() => t.remove(), timeout);
}

export function announce(text) {
  const live = document.getElementById('sr-live');
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 30);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Kopiert');
}

// ---------- Popover / Menü ----------

let openPop = null;

export function closePopover() {
  if (!openPop) return;
  const { el, anchor, onClose } = openPop;
  openPop = null;
  el.remove();
  if (anchor) anchor.setAttribute('aria-expanded', 'false');
  document.removeEventListener('mousedown', outside, true);
  document.removeEventListener('keydown', popKeys, true);
  if (onClose) onClose();
}

function outside(e) {
  if (openPop && !openPop.el.contains(e.target) && !(openPop.anchor && openPop.anchor.contains(e.target))) closePopover();
}

function popKeys(e) {
  if (!openPop) return;
  if (e.key === 'Escape') { e.stopPropagation(); const a = openPop.anchor; closePopover(); if (a) a.focus(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const items = [...openPop.el.querySelectorAll('.menu-item:not([disabled])')];
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? items[(i + 1) % items.length] : items[(i - 1 + items.length) % items.length];
    next.focus();
  }
}

export function popover(anchor, content, { placement = 'bottom-start', onClose, focusFirst = true } = {}) {
  if (openPop && openPop.anchor === anchor) { closePopover(); return null; }
  closePopover();
  const el = h('div', { class: 'popover', role: 'menu' }, content);
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  const hgt = el.offsetHeight;
  let left = placement.endsWith('end') ? r.right - w : r.left;
  let top = placement.startsWith('top') ? r.top - hgt - 6 : r.bottom + 6;
  if (top + hgt > window.innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
  if (top < 8) top = Math.min(window.innerHeight - hgt - 8, r.bottom + 6);
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  anchor.setAttribute('aria-expanded', 'true');
  openPop = { el, anchor, onClose };
  setTimeout(() => {
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', popKeys, true);
  });
  if (focusFirst) {
    const first = el.querySelector('.menu-item, button, input');
    if (first) first.focus({ preventScroll: true });
  }
  return el;
}

// items: [{label, icon, onClick, danger, disabled} | 'sep']
export function menu(anchor, items, opts = {}) {
  const list = items.filter(Boolean).map((it) => {
    if (it === 'sep') return h('div', { class: 'menu-sep', role: 'separator' });
    const b = h('button', { type: 'button', role: 'menuitem', class: `menu-item${it.danger ? ' danger' : ''}`, disabled: it.disabled || null },
      it.icon ? iconEl(it.icon, 17) : null, h('span', {}, it.label));
    b.addEventListener('click', () => { closePopover(); it.onClick(); });
    return b;
  });
  return popover(anchor, list, opts);
}

// ---------- Dialoge ----------

const dialogStack = [];

export function dialog({ title, body, footer, small = false, onClose, labelledBy } = {}) {
  const previous = document.activeElement;
  const titleId = `dlg-${Math.random().toString(36).slice(2)}`;
  const closeBtn = btn('', { iconName: 'x', cls: 'btn btn-icon', title: 'Schließen' });
  const box = h('div', { class: `dialog${small ? ' small' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': labelledBy || titleId },
    h('div', { class: 'dialog-head' }, h('h2', { id: titleId }, title), closeBtn),
    h('div', { class: 'dialog-body' }, body),
    footer ? h('div', { class: 'dialog-foot' }, footer) : null);
  const scrim = h('div', { class: 'dialog-scrim' }, box);
  const close = () => {
    const i = dialogStack.indexOf(api);
    if (i >= 0) dialogStack.splice(i, 1);
    scrim.remove();
    document.removeEventListener('keydown', keys, true);
    if (onClose) onClose();
    if (previous && previous.focus) previous.focus();
  };
  const keys = (e) => {
    if (dialogStack[dialogStack.length - 1] !== api) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const f = [...box.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"]), a[href]')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', keys, true);
  document.body.append(scrim);
  const api = { close, el: box, body: box.querySelector('.dialog-body') };
  dialogStack.push(api);
  setTimeout(() => {
    const auto = box.querySelector('[autofocus]') || box.querySelector('.dialog-body input, .dialog-body textarea, .dialog-foot .btn-primary, .dialog-body button') || closeBtn;
    auto.focus();
  });
  return api;
}

export function confirmDialog({ title, text, confirmLabel = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const ok = btn(confirmLabel, { cls: danger ? 'btn btn-primary btn-danger-fill' : 'btn btn-primary' });
    const cancel = btn('Abbrechen', { cls: 'btn' });
    const d = dialog({ title, small: true, body: h('p', {}, text), footer: [cancel, ok], onClose: () => resolve(result) });
    if (danger) { ok.style.background = 'var(--danger)'; ok.style.color = '#fff'; }
    ok.addEventListener('click', () => { result = true; d.close(); });
    cancel.addEventListener('click', () => d.close());
    setTimeout(() => ok.focus());
  });
}

export function hasOpenDialog() {
  return dialogStack.length > 0;
}

// ---------- Formatierung ----------

const pad = (n) => String(n).padStart(2, '0');

export function fmtDate(iso, { time = false } = {}) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let s = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  if (time) s += `, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return s;
}

export function fmtTime(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtRelative(ms) {
  const d = new Date(ms);
  const now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days === 0) return `heute, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (days === 1) return `gestern, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return fmtDate(d.toISOString());
}

// Lokales Datum aus "JJJJ-MM-TT" bzw. "JJJJ-MM-TTThh:mm".
export function parseLocal(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value || '');
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59);
}

export function daysUntil(date) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86400000);
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'FA';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Datum im deutschen Format: "7.12.2026" oder "07.12.26" → "2026-12-07"; leer → ""; ungültig → null.
export function parseDateDE(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  let y; let mo; let d;
  if (m) { [, y, mo, d] = m.map(Number); }
  else {
    m = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2}|\d{4})$/.exec(v);
    if (!m) return null;
    [, d, mo, y] = m.map(Number);
    if (y < 100) y += 2000;
  }
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function formatDateDE(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

export function shortPath(p, max = 52) {
  if (!p || p.length <= max) return p || '';
  const sep = p.includes('\\') ? '\\' : '/';
  const parts = p.split(sep);
  let out = parts.pop();
  while (parts.length && out.length + parts[parts.length - 1].length + 1 < max - 2) out = `${parts.pop()}${sep}${out}`;
  return `…${sep}${out}`;
}
