'use strict';
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file, fallback) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    if (err instanceof SyntaxError) {
      // Beschädigte Datei nicht überschreiben, sondern sichern.
      const backup = `${file}.defekt-${Date.now()}`;
      await fsp.copyFile(file, backup).catch(() => {});
      return fallback;
    }
    throw err;
  }
}

// Schreibt erst in eine temporäre Datei und benennt dann um, damit ein Absturz
// keine halb geschriebene Datei hinterlässt.
async function writeJsonAtomic(file, data) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

async function writeTextAtomic(file, text) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fsp.writeFile(tmp, text, 'utf8');
  await fsp.rename(tmp, file);
}

// true, wenn target innerhalb von base liegt (oder base selbst ist).
function isInside(base, target) {
  const rel = path.relative(path.resolve(base), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Wandelt einen relativen Pfad (mit / oder \) sicher in einen absoluten Pfad im Basisordner um.
function resolveInside(base, rel) {
  if (typeof rel !== 'string' || rel.includes('\0')) return null;
  const cleaned = rel.replace(/\\/g, '/').replace(/^\/+/, '');
  const abs = path.resolve(base, ...cleaned.split('/'));
  return isInside(base, abs) ? abs : null;
}

function toPosix(rel) {
  return rel.split(path.sep).join('/');
}

// Dateinamen für alle Betriebssysteme gültig machen, Umlaute bleiben erhalten.
function safeFileName(name) {
  let base = String(name || 'datei').normalize('NFC');
  base = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim();
  if (!base) base = 'datei';
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(base)) base = `_${base}`;
  if (base.length > 150) {
    const ext = path.extname(base).slice(0, 12);
    base = base.slice(0, 150 - ext.length) + ext;
  }
  return base;
}

// Liefert einen freien Dateinamen: name.pdf, name (2).pdf, name (3).pdf …
async function uniquePath(dir, name) {
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let candidate = path.join(dir, name);
  let n = 2;
  while (await exists(candidate)) {
    candidate = path.join(dir, `${stem} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

function localDateStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fileTimeStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${localDateStamp(d)}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function formatDateDE(input, { withTime = false, weekday = false } = {}) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  let s = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  if (weekday) s = `${WOCHENTAGE[d.getDay()]}, ${s}`;
  if (withTime) s += `, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
  return s;
}

// Lokales Datum aus "JJJJ-MM-TT" oder "JJJJ-MM-TTThh:mm" (ohne Zeitzonenverschiebung).
function parseLocalDate(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59);
}

function daysUntil(date, now = new Date()) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86400000);
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

module.exports = {
  newId, nowIso, ensureDir, exists, readJson, writeJsonAtomic, writeTextAtomic,
  isInside, resolveInside, toPosix, safeFileName, uniquePath, localDateStamp,
  fileTimeStamp, formatDateDE, parseLocalDate, daysUntil, sha1, truncate, humanSize,
  fs, fsp, path,
};
