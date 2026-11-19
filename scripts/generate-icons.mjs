#!/usr/bin/env node
/**
 * ============================================================================
 *  ÍCONES DO SITE A PARTIR DA LOGO OFICIAL — Farmácia São Marcos
 * ----------------------------------------------------------------------------
 *  Gera, sem nenhuma dependência externa:
 *    • ícone do atalho na tela inicial do iPhone (apple-touch-icon 180×180)
 *    • ícones do Android/Chrome (manifest: 192, 512 e 512 "maskable")
 *    • ícone da aba do navegador (favicon)
 *
 *  Os ícones usam os PIXELS da logo oficial (a cruz e o texto "SÃO MARCOS"),
 *  montados na versão empilhada, a mesma usada na camisa do mascote.
 *  Tudo é gravado como texto (data URL) em index.html e public/manifest.webmanifest.
 *
 *  Uso:  node scripts/generate-icons.mjs   (depois: npm run build)
 * ============================================================================
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = process.argv.includes('--preview') ? join(ROOT, '.tmp-icons') : '';

/* ------------------------------------------------------------- logo -- */
function loadLogo() {
  const file = join(ROOT, 'src/assets/logo-farmacia-sao-marcos.png');
  if (existsSync(file)) return readFileSync(file);
  const embedded = join(ROOT, 'src/assets/embedded.ts');
  const m = existsSync(embedded) && /LOGO_SRC = 'data:image\/png;base64,([^']+)'/.exec(readFileSync(embedded, 'utf8'));
  if (m) return Buffer.from(m[1], 'base64');
  throw new Error('Logo não encontrada (src/assets/logo-farmacia-sao-marcos.png ou src/assets/embedded.ts).');
}

/* -------------------------------------------------------------- PNG -- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const paeth = (a, b, c) => {
  const q = a + b - c;
  const pa = Math.abs(q - a);
  const pb = Math.abs(q - b);
  const pc = Math.abs(q - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decodifica PNG 8 bits → imagem RGBA "pré-multiplicada" em ponto flutuante. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('A logo precisa ser um arquivo PNG.');
  let p = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let ct = 0;
  let interlace = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      depth = d[8];
      ct = d[9];
      interlace = d[12];
    } else if (type === 'PLTE') plte = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error('PNG não suportado: use 8 bits por canal, sem entrelaçamento.');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const stride = w * ch;
  const raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const o = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= ch && y ? px[(y - 1) * stride + x - ch] : 0;
      let v = raw[o + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) v += paeth(a, b, c);
      px[y * stride + x] = v & 255;
    }
  }
  const out = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r;
    let g;
    let b;
    let a = 255;
    if (ct === 6) [r, g, b, a] = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3]];
    else if (ct === 2) [r, g, b] = [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]];
    else if (ct === 0) r = g = b = px[i];
    else if (ct === 4) [r, g, b, a] = [px[i * 2], px[i * 2], px[i * 2], px[i * 2 + 1]];
    else {
      const k = px[i];
      [r, g, b] = [plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2]];
      a = trns && k < trns.length ? trns[k] : 255;
    }
    const af = a / 255;
    out[i * 4] = (r / 255) * af;
    out[i * 4 + 1] = (g / 255) * af;
    out[i * 4 + 2] = (b / 255) * af;
    out[i * 4 + 3] = af;
  }
  return { w, h, px: out };
}

/** Codifica PNG (RGB opaco ou RGBA) com o melhor filtro por linha e compressão máxima. */
function encodePng(img, opaque) {
  const ch = opaque ? 3 : 4;
  const stride = img.w * ch;
  const bytes = new Uint8Array(img.h * stride);
  for (let i = 0; i < img.w * img.h; i++) {
    const A = Math.max(0, Math.min(1, img.px[i * 4 + 3]));
    for (let c = 0; c < 3; c++) {
      const v = opaque ? img.px[i * 4 + c] + (1 - A) : A > 0 ? img.px[i * 4 + c] / A : 0;
      bytes[i * ch + c] = Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
    if (!opaque) bytes[i * ch + 3] = Math.round(A * 255);
  }
  const rows = [];
  let prev = new Uint8Array(stride);
  for (let y = 0; y < img.h; y++) {
    const cur = bytes.subarray(y * stride, (y + 1) * stride);
    let best = null;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const line = new Uint8Array(stride + 1);
      line[0] = f;
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= ch ? cur[x - ch] : 0;
        const b = prev[x];
        const c = x >= ch ? prev[x - ch] : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const v = (cur[x] - pred) & 255;
        line[x + 1] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = line;
      }
    }
    rows.push(best);
    prev = cur;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------------------------- imagem básica -- */
const canvas = (w, h, white) => {
  const px = new Float32Array(w * h * 4);
  if (white) px.fill(1);
  return { w, h, px };
};

function crop(img, x0, y0, x1, y1) {
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = canvas(w, h, false);
  for (let y = 0; y < h; y++) out.px.set(img.px.subarray(((y + y0) * img.w + x0) * 4, ((y + y0) * img.w + x1 + 1) * 4), y * w * 4);
  return out;
}

/** Pesos do filtro "tenda" (bilinear ao ampliar, média de área ao reduzir). */
function weights(srcLen, dstLen) {
  const scale = dstLen / srcLen;
  const r = Math.max(1, 1 / scale);
  const list = [];
  for (let i = 0; i < dstLen; i++) {
    const center = (i + 0.5) / scale - 0.5;
    const idx = [];
    const ws = [];
    let sum = 0;
    for (let j = Math.max(0, Math.floor(center - r)); j <= Math.min(srcLen - 1, Math.ceil(center + r)); j++) {
      const wgt = Math.max(0, 1 - Math.abs(j - center) / r);
      if (wgt > 0) {
        idx.push(j);
        ws.push(wgt);
        sum += wgt;
      }
    }
    if (!idx.length) {
      idx.push(Math.min(srcLen - 1, Math.max(0, Math.round(center))));
      ws.push(1);
      sum = 1;
    }
    list.push({ idx, ws: ws.map((v) => v / sum) });
  }
  return list;
}

function resize(img, dw, dh) {
  const wx = weights(img.w, dw);
  const wy = weights(img.h, dh);
  const tmp = new Float32Array(dw * img.h * 4);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < dw; x++) {
      const { idx, ws } = wx[x];
      const o2 = (y * dw + x) * 4;
      for (let k = 0; k < idx.length; k++) {
        const o = (y * img.w + idx[k]) * 4;
        for (let c = 0; c < 4; c++) tmp[o2 + c] += img.px[o + c] * ws[k];
      }
    }
  }
  const out = canvas(dw, dh, false);
  for (let y = 0; y < dh; y++) {
    const { idx, ws } = wy[y];
    for (let x = 0; x < dw; x++) {
      const o2 = (y * dw + x) * 4;
      for (let k = 0; k < idx.length; k++) {
        const o = (idx[k] * dw + x) * 4;
        for (let c = 0; c < 4; c++) out.px[o2 + c] += tmp[o + c] * ws[k];
      }
    }
  }
  return out;
}

function draw(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.w) continue;
      const s = (y * src.w + x) * 4;
      const d = (ty * dst.w + tx) * 4;
      const ia = 1 - src.px[s + 3];
      for (let c = 0; c < 4; c++) dst.px[d + c] = src.px[s + c] + dst.px[d + c] * ia;
    }
  }
}

/* ------------------------------------- partes da logo (detecção) -- */
const alphaAt = (img, x, y) => img.px[(y * img.w + x) * 4 + 3];
function runs(flags, maxGap) {
  const out = [];
  let start = -1;
  let last = -1;
  flags.forEach((on, i) => {
    if (!on) return;
    if (start < 0 || i - last - 1 > maxGap) {
      if (start >= 0) out.push({ start, end: last });
      start = i;
    }
    last = i;
  });
  if (start >= 0) out.push({ start, end: last });
  return out;
}
function bbox(img, x0, x1, y0, y1, thr = 0.08) {
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (alphaAt(img, x, y) > thr) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  return { x0: minX, x1: maxX, y0: minY, y1: maxY };
}

function findParts(logo) {
  const cols = Array.from({ length: logo.w }, (_, x) => {
    for (let y = 0; y < logo.h; y++) if (alphaAt(logo, x, y) > 0.3) return true;
    return false;
  });
  const colRuns = runs(cols, 6);
  if (colRuns.length < 2) throw new Error('Não consegui separar a cruz do texto da logo.');
  const cross = bbox(logo, colRuns[0].start, colRuns[0].end, 0, logo.h - 1);
  const tx0 = colRuns[1].start;
  const rows = Array.from({ length: logo.h }, (_, y) => {
    for (let x = tx0; x < logo.w; x++) if (alphaAt(logo, x, y) > 0.3) return true;
    return false;
  });
  const rowRuns = runs(rows, 1).map((r) => ({ ...r, ...bbox(logo, tx0, logo.w - 1, r.start, r.end, 0.3) }));
  // "SÃO MARCOS" é a linha mais alta; o til (acima) é estreito e é juntado a ela.
  let main = rowRuns.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  const i = rowRuns.indexOf(main);
  const above = rowRuns[i - 1];
  if (above && above.x1 - above.x0 < 0.2 * (main.x1 - main.x0) && main.start - above.end < 0.5 * (main.end - main.start)) {
    main = { ...main, start: above.start };
  }
  const text = bbox(logo, tx0, logo.w - 1, main.start, main.end);
  return { cross, text, info: { colRuns, rowRuns: rowRuns.map((r) => [r.start, r.end, r.x0, r.x1]) } };
}

/* -------------------------------------------------------- montagem -- */
function composer(logo, parts) {
  const crossImg = crop(logo, parts.cross.x0, parts.cross.y0, parts.cross.x1, parts.cross.y1);
  const textImg = crop(logo, parts.text.x0, parts.text.y0, parts.text.x1, parts.text.y1);
  const crossAspect = crossImg.w / crossImg.h;
  const textAspect = textImg.w / textImg.h;
  // Versão empilhada: cruz em cima, "SÃO MARCOS" embaixo com 1,5× a altura da cruz de largura.
  const layout = (u) => {
    const ch = Math.round(u);
    const cw = Math.round(u * crossAspect);
    const tw = Math.round(1.5 * u);
    const th = Math.max(1, Math.round(tw / textAspect));
    const gap = Math.round(0.11 * u);
    return { ch, cw, tw, th, gap, W: Math.max(cw, tw), H: ch + gap + th };
  };
  const render = (S, u) => {
    const L = layout(u);
    const img = canvas(S, S, true);
    const top = Math.round((S - L.H) / 2);
    draw(img, resize(crossImg, L.cw, L.ch), Math.round((S - L.cw) / 2), top);
    draw(img, resize(textImg, L.tw, L.th), Math.round((S - L.tw) / 2), top + L.ch + L.gap);
    return img;
  };
  const maxRadius = (img) => {
    let max = 0;
    const c = (img.w - 1) / 2;
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++) {
        const o = (y * img.w + x) * 4;
        if (Math.abs(img.px[o] - 1) + Math.abs(img.px[o + 1] - 1) + Math.abs(img.px[o + 2] - 1) > 0.12) max = Math.max(max, Math.hypot(x - c, y - c));
      }
    return max;
  };
  return {
    /** Ícone padrão: a logo empilhada ocupando ~82% do quadrado branco. */
    stacked(S) {
      const one = layout(1000);
      return render(S, Math.min((0.82 * S) / one.W, (0.8 * S) / one.H) * 1000);
    },
    /** Android "maskable": todo o desenho dentro do círculo seguro (raio de 40%). */
    maskable(S) {
      let lo = 0.2 * S;
      let hi = 0.7 * S;
      for (let k = 0; k < 16; k++) {
        const mid = (lo + hi) / 2;
        if (maxRadius(render(S, mid)) <= 0.4 * S - 2) lo = mid;
        else hi = mid;
      }
      return render(S, lo);
    },
    /** Aba do navegador: só a cruz, fundo transparente. */
    crossOnly(S) {
      const img = canvas(S, S, false);
      const fit = (S - 2) / Math.max(crossImg.w, crossImg.h);
      const w = Math.round(crossImg.w * fit);
      const h = Math.round(crossImg.h * fit);
      draw(img, resize(crossImg, w, h), Math.round((S - w) / 2), Math.round((S - h) / 2));
      return img;
    },
  };
}

/* ----------------------------------------------------------- saída -- */
const logo = decodePng(loadLogo());
const parts = findParts(logo);
const make = composer(logo, parts);
console.log(`Logo ${logo.w}×${logo.h} · cruz ${parts.cross.x1 - parts.cross.x0 + 1}×${parts.cross.y1 - parts.cross.y0 + 1} · texto "SÃO MARCOS" ${parts.text.x1 - parts.text.x0 + 1}×${parts.text.y1 - parts.text.y0 + 1}`);

const icons = {
  favicon48: { img: make.crossOnly(48), opaque: false },
  icon192: { img: make.stacked(192), opaque: true },
  apple180: { img: make.stacked(180), opaque: true },
  icon512: { img: make.stacked(512), opaque: true },
  maskable512: { img: make.maskable(512), opaque: true },
};
const uri = {};
for (const [name, { img, opaque }] of Object.entries(icons)) {
  const png = encodePng(img, opaque);
  uri[name] = `data:image/png;base64,${png.toString('base64')}`;
  console.log(`  ✓ ${name.padEnd(12)} ${img.w}×${img.h}  ${(png.length / 1024).toFixed(1)} KB`);
  if (PREVIEW) {
    mkdirSync(PREVIEW, { recursive: true });
    writeFileSync(join(PREVIEW, `${name}.png`), png);
  }
}

// 1) index.html — favicon, ícone 192 e apple-touch-icon embutidos (funcionam mesmo publicando só o index.html)
const htmlPath = join(ROOT, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
const block = [
  '<!-- ÍCONES: gerado por scripts/generate-icons.mjs a partir da logo oficial (não edite à mão) -->',
  `    <link rel="icon" type="image/png" sizes="48x48" href="${uri.favicon48}" />`,
  `    <link rel="icon" type="image/png" sizes="192x192" href="${uri.icon192}" />`,
  `    <link rel="apple-touch-icon" sizes="180x180" href="${uri.apple180}" />`,
  '    <!-- /ÍCONES -->',
].join('\n');
const re = /<!-- ÍCONES:[\s\S]*?<!-- \/ÍCONES -->/;
html = re.test(html) ? html.replace(re, block) : html.replace('</head>', `    ${block}\n  </head>`);
writeFileSync(htmlPath, html);

// 2) manifest — "Adicionar à tela inicial" no Android/Chrome
mkdirSync(join(ROOT, 'public'), { recursive: true });
const manifest = {
  name: 'Farmácia São Marcos — A farmácia de toda a família',
  short_name: 'São Marcos',
  description: 'Busque seu remédio digitando ou falando e peça pelo WhatsApp, com entregas todos os dias.',
  lang: 'pt-BR',
  dir: 'ltr',
  id: './',
  start_url: './',
  scope: './',
  display: 'minimal-ui',
  background_color: '#FFFFFF',
  theme_color: '#3A3A92',
  categories: ['health', 'medical', 'shopping'],
  icons: [
    { src: uri.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: uri.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: uri.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(ROOT, 'public/manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('→ index.html (favicon, ícone 192 e apple-touch-icon) e public/manifest.webmanifest atualizados');
