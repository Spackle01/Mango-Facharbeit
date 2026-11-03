// Chat-Liste der Seitenleiste: nach Datum gruppieren (Heute, Gestern, …) und nach Titel filtern.
// Reine Logik ohne DOM, damit sie sich testen lässt.

export const GRUPPEN = ['Heute', 'Gestern', 'Letzte 7 Tage', 'Letzte 30 Tage', 'Älter'];

const tagStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Gruppenname für ein Datum (ISO-Text oder Date). Ungültige Angaben zählen als „Älter“.
export function chatGruppe(wann, jetzt = new Date()) {
  const d = wann instanceof Date ? wann : new Date(wann);
  if (Number.isNaN(d.getTime())) return 'Älter';
  const tage = Math.round((tagStart(jetzt) - tagStart(d)) / 86400000);
  if (tage <= 0) return 'Heute';
  if (tage === 1) return 'Gestern';
  if (tage <= 7) return 'Letzte 7 Tage';
  if (tage <= 30) return 'Letzte 30 Tage';
  return 'Älter';
}

// Titel ohne Beachtung von Groß- und Kleinschreibung und Akzenten vergleichen.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Liefert [{ name, chats }] in fester Reihenfolge der Gruppen, leere Gruppen entfallen.
// Die Reihenfolge innerhalb einer Gruppe bleibt wie geliefert. Ein Filter betrifft den Titel.
export function gruppiere(chats, filter = '', jetzt = new Date()) {
  const q = norm(filter).trim();
  const nachGruppe = new Map(GRUPPEN.map((g) => [g, []]));
  for (const c of chats || []) {
    if (q && !norm(c.title || 'Neuer Chat').includes(q)) continue;
    nachGruppe.get(chatGruppe(c.updatedAt || c.createdAt, jetzt)).push(c);
  }
  return GRUPPEN.map((name) => ({ name, chats: nachGruppe.get(name) })).filter((g) => g.chats.length);
}
