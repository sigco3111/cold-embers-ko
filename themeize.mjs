// 1.2 冷暖两套：打包时把旧样式里写死的颜色换成「可换的色板」
// 每个写死的颜色变成 rgba(var(--w某族, 原来的 r,g,b), 原来的透明度)：
// 冷色和暖色里的铁板、木板处都不定义这些变量，所以还是原来的颜色；
// 暖色的纸面（面板正文、弹窗）里定义了它们，浅字变深棕、深底变奶白纸、浅色细线变棕线。
// 族的划分只看三样：这个颜色用在哪（字、底、边、影子）、明暗、色相。

const NAMED = /var\(--(brass-hi|brass|brass-lo|ember-hi|ember|ember-lo|a-ember2|a-ember|frost)\)/g;
const COL = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^()]*\)/g;

function parse(c) {
  let r, g, b, a = 1;
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length <= 4) h = [...h].map(x => x + x).join('');
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    if (c.includes('var(')) return null;
    const p = c.slice(c.indexOf('(') + 1, -1).replace('/', ',').split(/[,\s]+/).filter(Boolean);
    if (p.length < 3) return null;
    [r, g, b] = p.slice(0, 3).map(Number); a = p.length > 3 ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : Number(p[3])) : 1;
    if ([r, g, b, a].some(Number.isNaN)) return null;
  }
  return { r, g, b, a };
}
// 色相（度）、饱和度、HSL 亮度、感知亮度
function hsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l, L: (0.2126 * R + 0.7152 * G + 0.0722 * B) };
}
const hueFam = h => (h < 15 || h >= 330) ? 'r' : h < 38 ? 'o' : h < 65 ? 'y' : h < 170 ? 'g' : h < 260 ? 'b' : 'p';

function kindOf(prop) {
  if (/^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color|-webkit-text-stroke(-color)?|column-rule-color)$/.test(prop)) return 'text';
  if (prop.startsWith('background')) return 'bg';
  if (prop.startsWith('border') || prop.startsWith('outline') || prop === 'scrollbar-color') return 'line';
  if (prop === 'text-shadow') return 'tshadow';
  if (prop === 'box-shadow' || prop === 'filter') return 'shadow';
  return null;
}

// 返回族名；null = 不动
function family(c, kind) {
  if (c.a < 0.02) return null;
  const { h, s, l, L } = hsl(c), sat = s > 0.3 && l > 0.12 && l < 0.92;
  if (kind === 'text') {
    if (sat && L > 0.3) return 't' + hueFam(h);
    if (L >= 0.6) return 't1';
    if (L >= 0.36) return 't2';
    return null; // 深色字（橙按钮上的字）不动
  }
  if (kind === 'bg') {
    if (sat && l >= 0.3) return null;               // 炉火橙、提示的色块：两套都一样
    if (s > 0.3 && l < 0.3 && l > 0.06) return (c.a >= 0.6 ? 'B' : 'm') + hueFam(h); // 深色的红底、黄底……换成浅色的
    if (L < 0.06) return c.a < 0.95 ? 'sh' : 'b0';
    if (L < 0.3) return c.a < 0.5 ? 'sh' : L < 0.12 ? 'b0' : L < 0.2 ? 'b1' : 'b2';
    if (c.a < 0.6) return 'hl';                     // 浅色的半透明叠层
    return null;
  }
  if (kind === 'line') {
    if (sat && l >= 0.3) return null;
    if (L >= 0.4) return 'ln';
    if (c.a >= 0.6) return 'bd';
    return 'sh';
  }
  if (kind === 'tshadow') return L < 0.3 ? 'ts' : null;
  return null;
}

export function themeize(css) {
  // url(...) 里可能有分号和颜色，先藏起来
  const urls = [];
  css = css.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, m => `\u0001${urls.push(m) - 1}\u0001`);
  let n = 0;
  css = css.replace(/\{([^{}]*)\}/g, (all, body) => {
    const out = body.split(';').map(decl => {
      const i = decl.indexOf(':'); if (i < 0) return decl;
      const prop = decl.slice(0, i).trim().toLowerCase();
      if (prop.startsWith('--')) return decl;
      const kind = kindOf(prop); if (!kind) return decl;
      let v = decl.slice(i + 1);
      // 旧的亮色命名变量（黄铜高光、炉火橙……）当字用时，在纸面上另给一个深色（--wc-名字）
      if (kind === 'text') v = v.replace(NAMED, (m, k) => { n++; return `var(--wc-${k},var(--${k}))`; });
      const val = v.replace(COL, m => {
        const c = parse(m); if (!c) return m;
        const f = family(c, kind); if (!f) return m;
        n++;
        const rgb = `${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`, a = +c.a.toFixed(3);
        return a >= 1 ? `rgb(var(--w${f},${rgb}))` : `rgba(var(--w${f},${rgb}),${a})`;
      });
      return decl.slice(0, i + 1) + val;
    }).join(';');
    return '{' + out + '}';
  });
  css = css.replace(/\u0001(\d+)\u0001/g, (m, i) => urls[+i]);
  return { css, n };
}
