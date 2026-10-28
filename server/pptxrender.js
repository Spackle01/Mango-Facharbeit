'use strict';
// Zeichnet PowerPoint-Folien als HTML nach (Positionen, Farben, Schriften, Aufzählungen,
// Tabellen, Bilder, Hintergründe, Platzhalter aus Layout und Folienmaster). Ohne Office:
// So sieht man eine Datei in der App ungefähr so, wie sie in PowerPoint aussieht.
const { readZip } = require('./zip');

const BASIS = 960; // Breite einer Folie in der Anzeige (px)
const MAX_BILD = 4 * 1024 * 1024;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };

// ---------- kleines XML ----------

function decode(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
}

function parse(xml) {
  const root = { name: '#', a: {}, c: [], t: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.t += m[1];
    else if (m[2]) { if (stack.length > 1) stack.pop(); } else if (m[3]) {
      const n = { name: m[3], a: {}, c: [], t: '' };
      for (const at of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) n.a[at[1]] = decode(at[2] !== undefined ? at[2] : at[3]);
      top.c.push(n);
      if (!m[5]) stack.push(n);
    } else if (m[6] !== undefined) top.t += decode(m[6]);
  }
  return root.c[0] || root;
}

const kid = (n, name) => (n ? n.c.find((x) => x.name === name) : undefined);
const kids = (n, name) => (n ? n.c.filter((x) => x.name === name) : []);
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex6 = (s) => (/^[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : '000000');

// ---------- Farben ----------

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function rgb(h, s, l) {
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
  return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map((x) => Math.round(x * 255));
}

class Farben {
  constructor(theme, clrMap) { this.theme = theme; this.map = clrMap; }

  // Liefert 'rgba(...)' oder null. phClr: Farbe, die der Platzhalter „phClr“ ersetzt.
  aus(fillNode, phClr = null) {
    if (!fillNode) return null;
    const c = fillNode.c.find((x) => ['a:srgbClr', 'a:schemeClr', 'a:sysClr', 'a:prstClr'].includes(x.name));
    if (!c) return null;
    let base;
    if (c.name === 'a:srgbClr') base = hex6(c.a.val);
    else if (c.name === 'a:sysClr') base = hex6(c.a.lastClr || '000000');
    else if (c.name === 'a:prstClr') base = ({ black: '000000', white: 'FFFFFF', red: 'FF0000', green: '00FF00', blue: '0000FF' })[c.a.val] || '000000';
    else {
      let v = c.a.val;
      if (v === 'phClr') { if (!phClr) return null; base = phClr; } else {
        v = this.map[v] || v;
        base = this.theme[v] || ({ bg1: 'FFFFFF', tx1: '000000' })[v] || '000000';
      }
    }
    let [r, g, b] = [0, 2, 4].map((i) => parseInt(base.slice(i, i + 2), 16));
    let alpha = 1;
    for (const m of c.c) {
      const v = num(m.a.val) / 100000;
      if (m.name === 'a:lumMod' || m.name === 'a:lumOff') {
        const [h, s, l] = hsl(r, g, b);
        const l2 = m.name === 'a:lumMod' ? l * v : Math.min(1, l + v);
        [r, g, b] = rgb(h, s, l2);
      } else if (m.name === 'a:tint' || m.name === 'a:shade') {
        // Wie Office: Mischung im linearen Farbraum
        const lin = (x) => ((x / 255) <= 0.04045 ? (x / 255) / 12.92 : (((x / 255) + 0.055) / 1.055) ** 2.4);
        const sr = (l) => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055));
        [r, g, b] = [r, g, b].map((x) => sr(m.name === 'a:tint' ? 1 - (1 - lin(x)) * v : lin(x) * v));
      } else if (m.name === 'a:alpha') alpha = v;
    }
    return alpha < 1 ? `rgba(${r},${g},${b},${alpha.toFixed(2)})` : `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;
  }

  fuellung(spPr, phClr) {
    if (!spPr) return null;
    if (kid(spPr, 'a:noFill')) return 'transparent';
    const s = kid(spPr, 'a:solidFill');
    if (s) return this.aus(s, phClr);
    const g = kid(spPr, 'a:gradFill');
    if (g) {
      const stops = kids(kid(g, 'a:gsLst'), 'a:gs').map((x) => ({ pos: num(x.a.pos) / 1000, c: this.aus(x, phClr) })).filter((x) => x.c);
      if (stops.length) {
        const lin = kid(g, 'a:lin');
        const ang = lin ? Math.round(num(lin.a.ang) / 60000 + 90) : 180;
        return `linear-gradient(${ang}deg, ${stops.map((x) => `${x.c} ${x.pos}%`).join(', ')})`;
      }
    }
    return null;
  }
}

// ---------- Paket ----------

class Paket {
  constructor(buf) {
    this.zip = readZip(buf);
    this.cache = new Map();
  }

  text(name) { const b = this.zip.read(name); return b ? b.toString('utf8') : ''; }
  xml(name) { if (!this.cache.has(name)) this.cache.set(name, this.zip.names().includes(name) ? parse(this.text(name)) : null); return this.cache.get(name); }

  rels(name) {
    const r = {};
    const x = this.xml(name.replace(/([^/]+)$/, '_rels/$1.rels'));
    if (!x) return r;
    for (const n of kids(x, 'Relationship')) r[n.a.Id] = { typ: (n.a.Type || '').split('/').pop(), ziel: normpfad(name, n.a.Target || ''), extern: n.a.TargetMode === 'External' };
    return r;
  }
}

function normpfad(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const p of target.split('/')) { if (p === '..') parts.pop(); else if (p && p !== '.') parts.push(p); }
  return parts.join('/');
}

// ---------- Textstile ----------

const LVL = (n) => `a:lvl${n + 1}pPr`;

function ph(sp) {
  const nv = kid(kid(sp, 'p:nvSpPr'), 'p:nvPr');
  const p = nv && kid(nv, 'p:ph');
  return p ? { typ: p.a.type || (p.a.idx ? 'obj' : 'body'), idx: p.a.idx, a: p.a } : null;
}

function gleich(a, b) {
  if (!a || !b) return false;
  if (a.idx && b.idx && a.idx === b.idx) return true;
  const typ = (t) => (t === 'ctrTitle' ? 'title' : t === 'subTitle' ? 'body' : t === 'obj' ? 'body' : t);
  return !a.idx || !b.idx ? typ(a.typ) === typ(b.typ) : typ(a.typ) === typ(b.typ) && typ(a.typ) === 'title';
}

function alleSp(tree, out = []) {
  for (const n of tree.c) {
    if (n.name === 'p:sp' || n.name === 'p:pic' || n.name === 'p:graphicFrame' || n.name === 'p:cxnSp') out.push(n);
    else if (n.name === 'p:grpSp') alleSp(n, out);
  }
  return out;
}

class Folie {
  constructor(paket, name, ctx) {
    this.p = paket; this.name = name; this.ctx = ctx;
    this.xml = paket.xml(name);
    const rels = paket.rels(name);
    this.rels = rels;
    const lay = Object.values(rels).find((r) => r.typ === 'slideLayout');
    this.layoutName = lay && lay.ziel;
    this.layout = this.layoutName ? paket.xml(this.layoutName) : null;
    const lrels = this.layoutName ? paket.rels(this.layoutName) : {};
    const mas = Object.values(lrels).find((r) => r.typ === 'slideMaster');
    this.masterName = mas && mas.ziel;
    this.master = this.masterName ? paket.xml(this.masterName) : null;
    this.lrels = lrels;
    this.mrels = this.masterName ? paket.rels(this.masterName) : {};
    const themeRel = Object.values(this.mrels).find((r) => r.typ === 'theme');
    const theme = themeRel ? paket.xml(themeRel.ziel) : null;
    this.farben = ctx.farbenFuer(theme, this.master);
    this.fonts = ctx.fontsFuer(theme);
  }

  baum(x) { return x && kid(kid(x, 'p:cSld'), 'p:spTree'); }

  // Entsprechender Platzhalter in Layout bzw. Master
  suche(x, info) {
    const tree = this.baum(x);
    if (!tree || !info) return null;
    return alleSp(tree).filter((s) => s.name === 'p:sp').find((s) => gleich(info, ph(s))) || null;
  }

  stilArt(info) {
    if (!info) return 'other';
    if (info.typ === 'title' || info.typ === 'ctrTitle') return 'title';
    if (['body', 'subTitle', 'obj', 'chart', 'tbl', 'media'].includes(info.typ)) return 'body';
    return 'other';
  }

  // Kette der Listenstile (stärkster zuerst) für eine Form
  stilKette(sp) {
    const info = ph(sp);
    const ketten = [kid(kid(sp, 'p:txBody'), 'a:lstStyle')];
    if (info) {
      const l = this.suche(this.layout, info);
      const m = this.suche(this.master, info);
      ketten.push(kid(kid(l, 'p:txBody'), 'a:lstStyle'), kid(kid(m, 'p:txBody'), 'a:lstStyle'));
    }
    const ts = kid(this.master, 'p:txStyles');
    const art = this.stilArt(info);
    ketten.push(kid(ts, art === 'title' ? 'p:titleStyle' : art === 'body' ? 'p:bodyStyle' : 'p:otherStyle'));
    ketten.push(this.ctx.defaultText);
    return ketten.filter(Boolean);
  }

  bodyPr(sp) {
    const info = ph(sp);
    const reihe = [kid(kid(sp, 'p:txBody'), 'a:bodyPr')];
    if (info) reihe.push(kid(kid(this.suche(this.layout, info), 'p:txBody'), 'a:bodyPr'), kid(kid(this.suche(this.master, info), 'p:txBody'), 'a:bodyPr'));
    const out = {}; let auto = null;
    for (const b of reihe.filter(Boolean)) {
      for (const k of Object.keys(b.a)) if (!(k in out)) out[k] = b.a[k];
      if (!auto) auto = kid(b, 'a:normAutofit');
    }
    return { a: out, auto };
  }

  xfrm(sp) {
    const x = (n) => (n && (kid(kid(n, 'p:spPr'), 'a:xfrm') || kid(n, 'p:xfrm') || kid(kid(n, 'p:grpSpPr'), 'a:xfrm')));
    let f = x(sp);
    if (!f) {
      const info = ph(sp);
      f = x(this.suche(this.layout, info)) || x(this.suche(this.master, info));
    }
    if (!f) return null;
    const off = kid(f, 'a:off'); const ext = kid(f, 'a:ext');
    if (!off || !ext) return null;
    return { x: num(off.a.x), y: num(off.a.y), w: num(ext.a.cx), h: num(ext.a.cy), rot: num(f.a.rot) / 60000, flipH: f.a.flipH === '1', flipV: f.a.flipV === '1' };
  }
}

// ---------- Rendern ----------

class Zeichner {
  constructor(paket) {
    this.p = paket;
    this.pres = paket.xml('ppt/presentation.xml');
    const sz = kid(this.pres, 'p:sldSz');
    this.W = num(sz && sz.a.cx, 12192000);
    this.H = num(sz && sz.a.cy, 6858000);
    this.k = BASIS / this.W; // px je EMU
    this.defaultText = kid(this.pres, 'p:defaultTextStyle');
    this.themeCache = new Map();
    this.bytes = 0;
  }

  farbenFuer(theme, master) {
    const key = theme;
    if (this.themeCache.has(key)) return this.themeCache.get(key);
    const cs = kid(kid(kid(theme, 'a:themeElements'), 'a:clrScheme'), '');
    const map = {};
    const clrScheme = theme && kid(kid(theme, 'a:themeElements'), 'a:clrScheme');
    if (clrScheme) {
      for (const c of clrScheme.c) {
        const v = c.c[0];
        if (v) map[c.name.replace('a:', '')] = hex6(v.name === 'a:sysClr' ? (v.a.lastClr || '000000') : v.a.val);
      }
    }
    void cs;
    const cm = master && kid(master, 'p:clrMap');
    const f = new Farben(map, cm ? cm.a : { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' });
    this.themeCache.set(key, f);
    return f;
  }

  fontsFuer(theme) {
    const fs = theme && kid(kid(theme, 'a:themeElements'), 'a:fontScheme');
    const lat = (n) => { const l = kid(kid(fs, n), 'a:latin'); return l && l.a.typeface; };
    return { major: lat('a:majorFont') || 'Arial', minor: lat('a:minorFont') || 'Arial' };
  }

  px(emu) { return +(emu * this.k).toFixed(2); }
  pt(v) { return +(v * 12700 * this.k).toFixed(2); }

  // ----- Folien -----

  folie(name) {
    const f = new Folie(this.p, name, this);
    const teile = [];
    // Hintergrund: Folie vor Layout vor Master
    const bg = [f.xml, f.layout, f.master].map((x) => kid(kid(x, 'p:cSld'), 'p:bg')).find(Boolean);
    let hintergrund = '#FFFFFF';
    if (bg) {
      const bp = kid(bg, 'p:bgPr');
      const ref = kid(bg, 'p:bgRef');
      const fill = bp && f.farben.fuellung(bp);
      if (fill) hintergrund = fill;
      else if (bp && kid(bp, 'a:blipFill')) hintergrund = this.bildCss(f, kid(bp, 'a:blipFill'), name) || '#FFFFFF';
      else if (ref) hintergrund = f.farben.aus(ref) || '#FFFFFF';
    }
    const zeichneBaum = (x, rels, nurDeko) => {
      const tree = f.baum(x);
      if (!tree) return;
      for (const n of tree.c) this.form(f, n, rels, teile, { deko: nurDeko, t: { sx: 1, sy: 1, tx: 0, ty: 0 } });
    };
    const zeigeMaster = !(f.layout && f.layout.a.showMasterSp === '0');
    if (zeigeMaster) zeichneBaum(f.master, f.mrels, true);
    zeichneBaum(f.layout, f.lrels, true);
    zeichneBaum(f.xml, f.rels, false);
    const style = `width:${BASIS}px;height:${this.px(this.H)}px;background:${hintergrund.startsWith('url') || hintergrund.includes('gradient') ? hintergrund : hintergrund};background-size:cover`;
    return `<div class="ps" style="position:relative;overflow:hidden;${style}">${teile.join('')}</div>`;
  }

  bildCss(f, blipFill, name) {
    const blip = kid(blipFill, 'a:blip');
    const rid = blip && (blip.a['r:embed']);
    const rels = name === f.name ? f.rels : name === f.layoutName ? f.lrels : f.mrels;
    const r = rid && (rels[rid] || f.rels[rid] || f.lrels[rid] || f.mrels[rid]);
    const uri = r && this.dataUri(r.ziel);
    return uri ? `url(${uri})` : null;
  }

  dataUri(ziel) {
    const ext = ziel.split('.').pop().toLowerCase();
    if (!MIME[ext]) return null;
    const b = this.p.zip.read(ziel);
    if (!b || b.length > MAX_BILD || this.bytes + b.length > 24 * 1024 * 1024) return null;
    this.bytes += b.length;
    return `data:${MIME[ext]};base64,${b.toString('base64')}`;
  }

  // Lage einer Form in Folien-px (mit Gruppen-Transformation)
  lage(f, sp, t) {
    const g = f.xfrm(sp);
    if (!g) return null;
    return { x: this.px(g.x * t.sx + t.tx), y: this.px(g.y * t.sy + t.ty), w: this.px(g.w * t.sx), h: this.px(g.h * t.sy), rot: g.rot, flipH: g.flipH, flipV: g.flipV };
  }

  form(f, n, rels, out, { deko, t }) {
    if (n.name === 'p:grpSp') {
      const gx = kid(kid(n, 'p:grpSpPr'), 'a:xfrm');
      let t2 = t;
      if (gx) {
        const off = kid(gx, 'a:off'); const ext = kid(gx, 'a:ext'); const co = kid(gx, 'a:chOff'); const ce = kid(gx, 'a:chExt');
        if (off && ext && co && ce && num(ce.a.cx) && num(ce.a.cy)) {
          const sx = num(ext.a.cx) / num(ce.a.cx); const sy = num(ext.a.cy) / num(ce.a.cy);
          t2 = { sx: t.sx * sx, sy: t.sy * sy, tx: t.tx + (num(off.a.x) - num(co.a.x) * sx) * t.sx, ty: t.ty + (num(off.a.y) - num(co.a.y) * sy) * t.sy };
        }
      }
      for (const c of n.c) this.form(f, c, rels, out, { deko, t: t2 });
      return;
    }
    if (!['p:sp', 'p:pic', 'p:graphicFrame', 'p:cxnSp'].includes(n.name)) return;
    const info = n.name === 'p:sp' ? ph(n) : null;
    if (deko && info) return; // Platzhalter von Layout und Master erscheinen nicht selbst
    if (deko && n.name === 'p:sp' && kid(n, 'p:nvSpPr') && kid(kid(n, 'p:nvSpPr'), 'p:cNvSpPr') && false) return;
    const pos = this.lage(f, n, t);
    if (!pos) return;
    if (n.name === 'p:pic') out.push(this.bild(f, n, pos, rels));
    else if (n.name === 'p:graphicFrame') out.push(this.rahmen(f, n, pos));
    else if (n.name === 'p:cxnSp') out.push(this.linie(f, n, pos));
    else out.push(this.sp(f, n, pos, info));
  }

  boxStyle(pos, extra = '') {
    const rot = pos.rot || pos.flipH || pos.flipV ? `transform:rotate(${pos.rot || 0}deg)${pos.flipH ? ' scaleX(-1)' : ''}${pos.flipV ? ' scaleY(-1)' : ''};` : '';
    return `position:absolute;left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;height:${pos.h}px;box-sizing:border-box;${rot}${extra}`;
  }

  umrandung(f, spPr, phClr) {
    const ln = kid(spPr, 'a:ln');
    if (!ln || kid(ln, 'a:noFill')) return '';
    const fill = kid(ln, 'a:solidFill');
    const c = fill && f.farben.aus(fill, phClr);
    if (!c) return '';
    const w = Math.max(1, this.px(num(ln.a.w, 12700)));
    return `border:${w}px ${kid(ln, 'a:prstDash') ? 'dashed' : 'solid'} ${c};`;
  }

  sp(f, n, pos, info) {
    const spPr = kid(n, 'p:spPr');
    const geo = kid(spPr, 'a:prstGeom');
    const form = geo && geo.a.prst;
    // Füllung: eigene, sonst die des Platzhalters in Layout/Master
    let fill = f.farben.fuellung(spPr);
    if (!fill && !info) { const fr = kid(kid(n, 'p:style'), 'a:fillRef'); if (fr && num(fr.a.idx) > 0) fill = f.farben.aus(fr); }
    let rand = this.umrandung(f, spPr);
    if (!fill && info) {
      for (const x of [f.suche(f.layout, info), f.suche(f.master, info)]) {
        const sp2 = x && kid(x, 'p:spPr');
        fill = fill || f.farben.fuellung(sp2);
        rand = rand || this.umrandung(f, sp2);
      }
    }
    const style = (fill && fill !== 'transparent' ? `background:${fill};` : '') + rand
      + (form === 'ellipse' ? 'border-radius:50%;' : form === 'roundRect' ? `border-radius:${Math.min(pos.w, pos.h) * 0.16}px;` : '');
    if (form === 'line' || form === 'straightConnector1') return this.linie(f, n, pos);
    const fr = kid(kid(n, 'p:style'), 'a:fontRef');
    const stdFarbe = fr ? f.farben.aus(fr) : null;
    const text = kid(n, 'p:txBody') ? this.textrahmen(f, n, kid(n, 'p:txBody'), stdFarbe) : '';
    return `<div style="${this.boxStyle(pos, style)}">${text}</div>`;
  }

  linie(f, n, pos) {
    const spPr = kid(n, 'p:spPr');
    const ln = kid(spPr, 'a:ln');
    const c = (ln && f.farben.aus(kid(ln, 'a:solidFill'))) || '#000000';
    const w = Math.max(1, this.px(num(ln && ln.a.w, 12700)));
    if (pos.h < 2) return `<div style="${this.boxStyle({ ...pos, h: 0 }, `border-top:${w}px solid ${c};`)}"></div>`;
    if (pos.w < 2) return `<div style="${this.boxStyle({ ...pos, w: 0 }, `border-left:${w}px solid ${c};`)}"></div>`;
    const len = Math.hypot(pos.w, pos.h); const ang = Math.atan2(pos.h, pos.w) * 180 / Math.PI;
    return `<div style="position:absolute;left:${pos.x}px;top:${pos.y}px;width:${len.toFixed(1)}px;border-top:${w}px solid ${c};transform-origin:0 0;transform:rotate(${ang.toFixed(2)}deg)"></div>`;
  }

  bild(f, n, pos, rels) {
    const bf = kid(n, 'p:blipFill');
    const blip = kid(bf, 'a:blip');
    const rid = blip && blip.a['r:embed'];
    const r = rid && rels[rid];
    const uri = r && this.dataUri(r.ziel);
    if (!uri) return `<div style="${this.boxStyle(pos, 'background:#E8E8EE;color:#6b6b78;font:12px Arial;display:flex;align-items:center;justify-content:center;')}">Bild</div>`;
    const sr = kid(bf, 'a:srcRect');
    const l = num(sr && sr.a.l) / 100000; const tt = num(sr && sr.a.t) / 100000; const rr = num(sr && sr.a.r) / 100000; const bb = num(sr && sr.a.b) / 100000;
    const bw = 1 - l - rr; const bh = 1 - tt - bb;
    const alt = (kid(kid(n, 'p:nvPicPr'), 'p:cNvPr') || { a: {} }).a.descr || '';
    return `<div style="${this.boxStyle(pos, 'overflow:hidden;')}"><img alt="${esc(alt)}" src="${uri}" style="position:absolute;left:${(-l / bw * 100).toFixed(2)}%;top:${(-tt / bh * 100).toFixed(2)}%;width:${(100 / bw).toFixed(2)}%;height:${(100 / bh).toFixed(2)}%"></div>`;
  }

  rahmen(f, n, pos) {
    const tbl = kid(kid(kid(n, 'a:graphic'), 'a:graphicData'), 'a:tbl');
    if (!tbl) return `<div style="${this.boxStyle(pos, 'background:#F1F1F5;border:1px dashed #B5B5C3;color:#6b6b78;font:12px Arial;display:flex;align-items:center;justify-content:center;text-align:center;')}">Diagramm oder Grafik<br>(in PowerPoint ansehen)</div>`;
    const cols = kids(kid(tbl, 'a:tblGrid'), 'a:gridCol').map((c) => this.px(num(c.a.w)));
    const rows = kids(tbl, 'a:tr').map((tr) => {
      const h = this.px(num(tr.a.h));
      const cells = kids(tr, 'a:tc').map((tc, ci) => {
        const pr = kid(tc, 'a:tcPr') || { a: {}, c: [] };
        const fill = f.farben.fuellung(pr);
        const kante = (nm, css) => { const l = kid(pr, nm); const c = l && f.farben.aus(kid(l, 'a:solidFill')); return c ? `${css}:${Math.max(1, this.px(num(l.a.w, 12700)))}px solid ${c};` : ''; };
        const body = kid(tc, 'a:txBody');
        const text = body ? this.absaetze(f, null, body, { gross: 1 }) : '';
        const pad = `padding:${this.px(num(pr.a.marT, 45720))}px ${this.px(num(pr.a.marR, 91440))}px ${this.px(num(pr.a.marB, 45720))}px ${this.px(num(pr.a.marL, 91440))}px;`;
        return `<td style="box-sizing:border-box;width:${cols[ci] || 0}px;height:${h}px;vertical-align:${pr.a.anchor === 'ctr' ? 'middle' : pr.a.anchor === 'b' ? 'bottom' : 'top'};${pad}${fill && fill !== 'transparent' ? `background:${fill};` : ''}${kante('a:lnL', 'border-left')}${kante('a:lnR', 'border-right')}${kante('a:lnT', 'border-top')}${kante('a:lnB', 'border-bottom')}overflow:hidden">${text}</td>`;
      });
      return `<tr>${cells.join('')}</tr>`;
    });
    return `<table style="${this.boxStyle(pos)}width:${cols.reduce((a, b) => a + b, 0)}px;border-collapse:collapse;table-layout:fixed;height:auto"><tbody>${rows.join('')}</tbody></table>`;
  }

  // ----- Text -----

  textrahmen(f, n, body, stdFarbe = null) {
    const bp = f.bodyPr(n);
    const a = bp.a;
    const ins = (k, d) => this.px(num(a[k], d));
    const anchor = a.anchor === 'ctr' ? 'center' : a.anchor === 'b' ? 'flex-end' : 'flex-start';
    const scale = bp.auto && bp.auto.a.fontScale ? num(bp.auto.a.fontScale) / 100000 : 1;
    const inhalt = this.absaetze(f, n, body, { gross: scale, stdFarbe });
    if (!inhalt) return '';
    const wrap = a.wrap === 'none' ? 'white-space:nowrap;' : '';
    return `<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:${anchor};padding:${ins('tIns', 45720)}px ${ins('rIns', 91440)}px ${ins('bIns', 45720)}px ${ins('lIns', 91440)}px;box-sizing:border-box;${wrap}word-wrap:break-word">${inhalt}</div>`;
  }

  // Wirksame Eigenschaft einer Ebene aus der Kette der Listenstile
  ebenenWert(kette, lvl, lesen) {
    for (const st of kette) {
      const p = kid(st, LVL(lvl));
      if (!p) continue;
      const v = lesen(p);
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  }

  absaetze(f, sp, body, { gross = 1, stdFarbe = null }) {
    const kette = sp ? f.stilKette(sp) : [kid(this.pres && kid(f.master, 'p:txStyles'), 'p:otherStyle'), this.defaultText].filter(Boolean);
    const zaehler = {};
    const teile = [];
    let leer = true;
    for (const p of kids(body, 'a:p')) {
      const pPr = kid(p, 'a:pPr');
      const lvl = Math.min(8, num(pPr && pPr.a.lvl));
      const wert = (lesen) => {
        const own = pPr && lesen(pPr);
        return own !== undefined && own !== null ? own : this.ebenenWert(kette, lvl, lesen);
      };
      const attr = (k) => (pp) => (pp.a[k] !== undefined ? pp.a[k] : undefined);
      const marL = num(wert(attr('marL')), 0);
      const indent = num(wert(attr('indent')), 0);
      const algn = wert(attr('algn')) || 'l';
      const defRPr = (pp) => kid(pp, 'a:defRPr');
      const standardGroesse = num(this.ebenenWert(kette, lvl, (pp) => (defRPr(pp) && defRPr(pp).a.sz) || undefined), 1800) / 100;

      const prozent = (pp, name) => { const x = kid(kid(pp, name), 'a:spcPct'); return x ? num(x.a.val) / 100000 : undefined; };
      const punkte = (pp, name) => { const x = kid(kid(pp, name), 'a:spcPts'); return x ? num(x.a.val) / 100 : undefined; };
      const lnPct = wert((pp) => prozent(pp, 'a:lnSpc'));
      const lnPts = wert((pp) => punkte(pp, 'a:lnSpc'));
      const bef = wert((pp) => punkte(pp, 'a:spcBef'));
      const aft = wert((pp) => punkte(pp, 'a:spcAft'));
      const befP = wert((pp) => prozent(pp, 'a:spcBef'));
      const aftP = wert((pp) => prozent(pp, 'a:spcAft'));

      // Aufzählung
      const bu = wert((pp) => {
        if (kid(pp, 'a:buNone')) return { typ: 'keine' };
        const c = kid(pp, 'a:buChar'); if (c) return { typ: 'zeichen', z: c.a.char };
        const an = kid(pp, 'a:buAutoNum'); if (an) return { typ: 'nummer', art: an.a.type, start: num(an.a.startAt, 1) };
        return undefined;
      }) || { typ: 'keine' };
      const buFarbe = wert((pp) => { const c = kid(pp, 'a:buClr'); return c ? f.farben.aus(c) : undefined; });

      // Läufe
      const laeufe = [];
      let text = false;
      let erste = null;
      for (const r of p.c) {
        if (r.name === 'a:br') { laeufe.push('<br>'); continue; }
        if (!['a:r', 'a:fld'].includes(r.name)) continue;
        const t = kid(r, 'a:t');
        const s = t ? t.t : '';
        if (!s) continue;
        text = true;
        const rPr = kid(r, 'a:rPr');
        const eig = (fn) => {
          const own = rPr && fn(rPr);
          if (own !== undefined && own !== null) return own;
          const dp = pPr && kid(pPr, 'a:defRPr');
          const d = dp && fn(dp);
          if (d !== undefined && d !== null) return d;
          return this.ebenenWert(kette, lvl, (pp) => { const x = defRPr(pp); return x ? fn(x) : undefined; });
        };
        const sz = num(eig((x) => x.a.sz), standardGroesse * 100) / 100 * gross;
        const b = eig((x) => x.a.b) === '1'; const i = eig((x) => x.a.i) === '1';
        const u = eig((x) => x.a.u); const cap = eig((x) => x.a.cap);
        const farbFn = (x) => { const sf = kid(x, 'a:solidFill'); return sf ? f.farben.aus(sf) : undefined; };
        // Reihenfolge: eigener Lauf, Absatz, Form-Stil (fontRef), dann Platzhalter-, Master- und Standardstile
        const eigenFarbe = (rPr && farbFn(rPr)) || (pPr && kid(pPr, 'a:defRPr') && farbFn(kid(pPr, 'a:defRPr')));
        const farbe = eigenFarbe || (stdFarbe && (!sp || !kid(kid(sp, 'p:txBody'), 'a:lstStyle') || !this.ebenenWert([kid(kid(sp, 'p:txBody'), 'a:lstStyle')], lvl, (pp) => (kid(pp, 'a:defRPr') && farbFn(kid(pp, 'a:defRPr'))) || undefined)) ? stdFarbe : null)
          || eig(farbFn) || '#000000';
        let face = eig((x) => { const l = kid(x, 'a:latin'); return l ? l.a.typeface : undefined; }) || '+mn-lt';
        if (face === '+mj-lt') face = f.fonts.major; else if (face === '+mn-lt') face = f.fonts.minor;
        face = String(face).replace(/[^\w \-ÄÖÜäöüß]/g, '');
        const base = eig((x) => x.a.baseline);
        const st = `font-size:${this.pt(sz)}px;color:${farbe};font-family:'${face}',Arial,sans-serif;${b ? 'font-weight:700;' : ''}${i ? 'font-style:italic;' : ''}${u && u !== 'none' ? 'text-decoration:underline;' : ''}${cap === 'all' ? 'text-transform:uppercase;' : ''}${base && num(base) > 0 ? 'vertical-align:super;font-size:70%;' : base && num(base) < 0 ? 'vertical-align:sub;font-size:70%;' : ''}`;
        if (!erste) erste = { sz, farbe, face };
        laeufe.push(`<span style="${st}">${esc(s).replace(/\n/g, '<br>')}</span>`);
      }
      const endGroesse = num(kid(p, 'a:endParaRPr') && kid(p, 'a:endParaRPr').a.sz, standardGroesse * 100) / 100 * gross;
      if (text) leer = false;
      let marke = '';
      if (text && bu.typ !== 'keine') {
        let z = bu.z;
        if (bu.typ === 'nummer') {
          zaehler[lvl] = (zaehler[lvl] === undefined ? bu.start : zaehler[lvl] + 1);
          z = `${zaehler[lvl]}.`;
        }
        const breite = Math.max(0, -indent);
        marke = `<span style="display:inline-block;min-width:${this.px(breite)}px;text-indent:0;font-size:${this.pt(erste ? erste.sz : standardGroesse * gross)}px;font-family:'${erste ? erste.face : 'Arial'}',Arial,sans-serif;color:${buFarbe || (erste ? erste.farbe : '#000')};">${esc(z || '•')}</span>`;
      } else if (!text) { /* leerer Absatz */ }
      for (const k of Object.keys(zaehler)) if (+k > lvl) delete zaehler[k];
      const grund = erste && /^(arial|helvetica|liberation sans)$/i.test(erste.face) ? 1.15 : 1.2;
      const lh = lnPts ? `${this.pt(lnPts)}px` : (lnPct ? (grund * lnPct).toFixed(3) : String(grund));
      const mt = bef !== undefined ? this.pt(bef) : befP !== undefined ? this.pt(befP * standardGroesse * gross) : 0;
      const mb = aft !== undefined ? this.pt(aft) : aftP !== undefined ? this.pt(aftP * standardGroesse * gross) : 0;
      const ta = { l: 'left', ctr: 'center', r: 'right', just: 'justify' }[algn] || 'left';
      const st = `margin:${mt}px 0 ${mb}px 0;text-align:${ta};padding-left:${this.px(marL)}px;text-indent:${this.px(indent)}px;line-height:${lh};min-height:${this.pt(endGroesse * 1.2)}px;`;
      teile.push(`<div style="${st}">${marke}${laeufe.join('')}</div>`);
    }
    return leer ? '' : teile.join('');
  }
}

// Liefert { breite, hoehe, folien: [html, …] }
function folienAlsHtml(buffer, { max = 80 } = {}) {
  const paket = new Paket(buffer);
  const z = new Zeichner(paket);
  const rels = paket.rels('ppt/presentation.xml');
  const ids = kids(kid(z.pres, 'p:sldIdLst'), 'p:sldId').map((s) => s.a['r:id']).filter((id) => rels[id]);
  const folien = [];
  for (const id of ids.slice(0, max)) {
    try { folien.push(z.folie(rels[id].ziel)); } catch { folien.push(`<div class="ps" style="width:${BASIS}px;height:${z.px(z.H)}px;background:#fff"></div>`); }
  }
  return { breite: BASIS, hoehe: z.px(z.H), folien, gesamt: ids.length };
}

module.exports = { folienAlsHtml, parse };
