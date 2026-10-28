// Lesbare Modellnamen, z. B. „claude-sonnet-5-5“ → „Sonnet 5.5“. Ohne Abhängigkeiten.

const FAMILIEN = { fable: 'Fable', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', mythos: 'Mythos' };

const gross = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function modelLabel(id, models = []) {
  const v = String(id || '').trim();
  if (!v) return 'Standard';
  const known = models.find((m) => m.id === v);
  if (known) return known.name;
  const alias = /^([a-z]+)(\[1m\])?$/i.exec(v);
  if (alias && FAMILIEN[alias[1].toLowerCase()]) return `${FAMILIEN[alias[1].toLowerCase()]}${alias[2] ? ' (1M)' : ''}`;
  const c = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/i.exec(v);
  if (c && FAMILIEN[c[1].toLowerCase()]) return `${FAMILIEN[c[1].toLowerCase()]} ${c[2]}${c[3] ? `.${c[3]}` : ''}${c[4] ? ' (1M)' : ''}`;
  const g = /^gemini-([\d.]+)-([a-z]+)(?:-([a-z]+))?$/i.exec(v);
  if (g) return `Gemini ${g[1]} ${gross(g[2])}${g[3] ? ` (${gross(g[3])})` : ''}`;
  return v;
}
