/**
 * ============================================================================
 *  LEITOR UNIVERSAL DE PLANILHAS (sem dependências) — Farmácia São Marcos
 * ----------------------------------------------------------------------------
 *  Detecta o formato pelo CONTEÚDO do arquivo, não só pela extensão:
 *    • .xlsx  Excel 2007+                → leitor ZIP/XML (xlsx-reader.js)
 *    • .xls   Excel 97-2003 (BIFF8/5)    → leitor binário próprio (CFB + BIFF)
 *    • .xls   "disfarçado" de HTML ou de XML 2003 (comum em sistemas de farmácia)
 *    • .csv / .txt  separados por ; , TAB ou |  ·  UTF-8 ou Windows-1252
 *  Funciona no navegador e no Node.js. Sempre lê TODAS as linhas.
 * ============================================================================
 */
import { readXlsx } from './xlsx-reader.js';

export const SPREADSHEET_ACCEPT =
  '.xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';
export const SPREADSHEET_EXTENSIONS = /\.(xlsx|xls|csv|txt)$/i;

const FORMAT_LABELS = {
  xlsx: 'Excel (.xlsx)',
  xls: 'Excel 97-2003 (.xls)',
  csv: 'CSV',
  html: 'Excel exportado em HTML (.xls)',
  xml: 'Excel XML 2003 (.xls)',
};
export const formatLabel = (format) => FORMAT_LABELS[format] ?? format;

/* ================================================================= TEXTO */

let cp1252 = null;
function decode1252(bytes) {
  try {
    cp1252 = cp1252 || new TextDecoder('windows-1252');
    return cp1252.decode(bytes);
  } catch {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
}

/** UTF-8 / UTF-16 (com BOM) ou Windows-1252 (padrão do Excel brasileiro). */
function decodeText(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decode1252(bytes);
  }
}

const HTML_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", aacute: 'á', Aacute: 'Á', agrave: 'à', Agrave: 'À',
  acirc: 'â', Acirc: 'Â', atilde: 'ã', Atilde: 'Ã', auml: 'ä', eacute: 'é', Eacute: 'É', ecirc: 'ê', Ecirc: 'Ê',
  egrave: 'è', iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó', ocirc: 'ô', Ocirc: 'Ô', otilde: 'õ', Otilde: 'Õ',
  ouml: 'ö', uacute: 'ú', Uacute: 'Ú', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç', ntilde: 'ñ', Ntilde: 'Ñ',
  ordm: 'º', ordf: 'ª', deg: '°', middot: '·', euro: '€', copy: '©', reg: '®',
};

function decodeHtml(s) {
  if (!s || s.indexOf('&') < 0) return s || '';
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return HTML_ENTITIES[e] ?? HTML_ENTITIES[e.toLowerCase()] ?? all;
  });
}

/* =================================================================== CSV */

function countOutsideQuotes(line, d) {
  let n = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === d && !quoted) n++;
  }
  return n;
}

/** CSV/TXT conforme RFC 4180 com detecção automática do separador. */
function parseDelimited(input) {
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  let delim = '';
  const sep = /^\s*sep=(.)\s*(?:\r\n|\n|\r)/i.exec(text);
  if (sep) {
    delim = sep[1];
    text = text.slice(sep[0].length);
  }
  if (!delim) {
    const lines = text.slice(0, 60000).split(/\r\n|\n|\r/).filter((l) => l.trim()).slice(0, 30);
    let best = ';';
    let bestScore = 0;
    for (const d of [';', '\t', ',', '|']) {
      const freq = new Map();
      for (const l of lines) {
        const n = countOutsideQuotes(l, d);
        if (n > 0) freq.set(n, (freq.get(n) || 0) + 1);
      }
      let score = 0;
      for (const [n, f] of freq) score = Math.max(score, f * 1000 + n);
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    delim = best;
  }

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

/* ============================================ HTML / XML 2003 (".xls") */

function parseHtmlTable(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
  const rows = [];
  for (const chunk of body.split(/<tr\b/i).slice(1)) {
    const end = chunk.search(/<\/tr\s*>|<\/table\s*>/i);
    const rowHtml = end >= 0 ? chunk.slice(0, end) : chunk;
    const row = [];
    for (const cell of rowHtml.split(/<t[dh]\b/i).slice(1)) {
      const gt = cell.indexOf('>');
      const attrs = gt >= 0 ? cell.slice(0, gt) : '';
      let content = gt >= 0 ? cell.slice(gt + 1) : '';
      const close = content.search(/<\/t[dh]\s*>/i);
      if (close >= 0) content = content.slice(0, close);
      row.push(decodeHtml(content.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim());
      const span = /colspan\s*=\s*["']?(\d+)/i.exec(attrs);
      for (let k = 1; k < Math.min(span ? Number(span[1]) : 1, 200); k++) row.push('');
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

function parseSpreadsheetML(xml) {
  const sheetMatch = /<(?:\w+:)?Worksheet\b[\s\S]*?(?:<\/(?:\w+:)?Worksheet>|$)/i.exec(xml);
  const sheet = sheetMatch ? sheetMatch[0] : xml;
  const nameMatch = /<(?:\w+:)?Worksheet\b[^>]*?\bName="([^"]*)"/i.exec(sheet);
  const rows = [];
  let r = -1;
  for (const chunk of sheet.split(/<(?:\w+:)?Row\b/i).slice(1)) {
    const gt = chunk.indexOf('>');
    const attrs = chunk.slice(0, Math.max(0, gt));
    const idx = /\bIndex="(\d+)"/i.exec(attrs);
    r = idx ? Number(idx[1]) - 1 : r + 1;
    const end = chunk.search(/<\/(?:\w+:)?Row>/i);
    const body = attrs.trimEnd().endsWith('/') ? '' : chunk.slice(gt + 1, end >= 0 ? end : undefined);
    const row = [];
    let c = -1;
    for (const cellChunk of body.split(/<(?:\w+:)?Cell\b/i).slice(1)) {
      const cgt = cellChunk.indexOf('>');
      const cattrs = cellChunk.slice(0, Math.max(0, cgt));
      const cidx = /\bIndex="(\d+)"/i.exec(cattrs);
      c = cidx ? Number(cidx[1]) - 1 : c + 1;
      const data = /<(?:\w+:)?Data\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?Data>/i.exec(cellChunk);
      if (data) {
        const type = (/\bType="([^"]+)"/i.exec(data[1]) || [])[1] || 'String';
        const text = decodeHtml(data[2].replace(/<[^>]*>/g, ''));
        row[c] = /^number$/i.test(type) && text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text;
      }
      const merge = /\bMergeAcross="(\d+)"/i.exec(cattrs);
      if (merge) c += Number(merge[1]);
    }
    rows[r] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return { sheetName: nameMatch ? decodeHtml(nameMatch[1]) : 'Planilha', rows };
}

/* ================================================== .xls binário (BIFF) */

const SPECIAL = 0xfffffffa; // ids de setor >= este valor são marcadores (fim de cadeia, livre…)

/** Lê um fluxo de dentro do contêiner OLE2/CFB do .xls. */
function cfbStream(bytes, wanted) {
  if (bytes.length < 512) throw new Error('Arquivo .xls incompleto.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const shift = dv.getUint16(30, true);
  if (shift !== 9 && shift !== 12) throw new Error('Arquivo .xls inválido ou corrompido.');
  const SS = 1 << shift;
  const MSS = 1 << (dv.getUint16(32, true) || 6);
  const numFat = dv.getUint32(44, true);
  const dirStart = dv.getUint32(48, true);
  const cutoff = dv.getUint32(56, true) || 4096;
  const miniFatStart = dv.getUint32(60, true);
  const numMiniFat = dv.getUint32(64, true);
  let difat = dv.getUint32(68, true);
  const numDifat = dv.getUint32(72, true);
  const off = (s) => (s + 1) * SS;
  const u32 = (o) => (o + 4 <= bytes.length ? dv.getUint32(o, true) : 0xffffffff);

  const fatSectors = [];
  for (let i = 0; i < 109 && fatSectors.length < numFat; i++) {
    const s = u32(76 + i * 4);
    if (s < SPECIAL) fatSectors.push(s);
  }
  for (let n = 0; difat < SPECIAL && n < numDifat && fatSectors.length < numFat; n++) {
    const base = off(difat);
    const per = SS / 4 - 1;
    for (let i = 0; i < per && fatSectors.length < numFat; i++) {
      const s = u32(base + i * 4);
      if (s < SPECIAL) fatSectors.push(s);
    }
    difat = u32(base + per * 4);
  }
  const perFat = SS / 4;
  const fat = new Uint32Array(fatSectors.length * perFat);
  fatSectors.forEach((s, k) => {
    const base = off(s);
    for (let i = 0; i < perFat; i++) fat[k * perFat + i] = u32(base + i * 4);
  });

  const follow = (start, table) => {
    const list = [];
    for (let s = start; s < SPECIAL && s < table.length && list.length <= table.length; s = table[s]) list.push(s);
    return list;
  };
  const read = (start, size) => {
    const list = follow(start, fat);
    const out = new Uint8Array(list.length * SS);
    list.forEach((s, i) => {
      const o = off(s);
      if (o < bytes.length) out.set(bytes.subarray(o, Math.min(o + SS, bytes.length)), i * SS);
    });
    return size === undefined ? out : out.subarray(0, Math.min(size, out.length));
  };

  const dir = read(dirStart);
  const le32 = (o) => (dir[o] | (dir[o + 1] << 8) | (dir[o + 2] << 16) | (dir[o + 3] << 24)) >>> 0;
  const entries = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const nameLen = dir[o + 64] | (dir[o + 65] << 8);
    let name = '';
    for (let i = 0; i < Math.min(31, nameLen / 2 - 1); i++) name += String.fromCharCode(dir[o + i * 2] | (dir[o + i * 2 + 1] << 8));
    entries.push({ name, type: dir[o + 66], start: le32(o + 116), size: le32(o + 120) });
  }
  const names = entries.map((e) => e.name.toLowerCase());
  const entry = entries.find((e) => e.type === 2 && wanted.includes(e.name.toLowerCase()));
  if (!entry) return { stream: null, names };

  if (entry.size < cutoff && entries[0]) {
    const root = entries[0];
    const mini = read(root.start, root.size);
    const mf = numMiniFat ? read(miniFatStart) : new Uint8Array(0);
    const minifat = new Uint32Array(mf.length >> 2);
    for (let i = 0; i < minifat.length; i++) minifat[i] = (mf[i * 4] | (mf[i * 4 + 1] << 8) | (mf[i * 4 + 2] << 16) | (mf[i * 4 + 3] << 24)) >>> 0;
    const list = follow(entry.start, minifat);
    const out = new Uint8Array(list.length * MSS);
    list.forEach((s, i) => out.set(mini.subarray(s * MSS, s * MSS + MSS), i * MSS));
    return { stream: out.subarray(0, entry.size), names };
  }
  return { stream: read(entry.start, entry.size), names };
}

const RK_VIEW = new DataView(new ArrayBuffer(8));
/** Número compactado "RK" do Excel. */
function rkValue(v) {
  let n;
  if (v & 2) n = (v | 0) >> 2;
  else {
    RK_VIEW.setUint32(0, 0, true);
    RK_VIEW.setUint32(4, (v & 0xfffffffc) >>> 0, true);
    n = RK_VIEW.getFloat64(0, true);
  }
  return v & 1 ? n / 100 : n;
}

/** Tabela de textos compartilhados (SST), inclusive quando dividida em registros CONTINUE. */
function parseSST(segs) {
  let si = 0;
  let pos = 0;
  const next = () => {
    while (si < segs.length && pos >= segs[si].length) {
      si++;
      pos = 0;
    }
    return si < segs.length;
  };
  const byte = () => (next() ? segs[si][pos++] : 0);
  const u16 = () => byte() | (byte() << 8);
  const u32 = () => (u16() | (u16() << 16)) >>> 0;
  const skip = (n) => {
    while (n > 0 && next()) {
      const t = Math.min(n, segs[si].length - pos);
      pos += t;
      n -= t;
    }
  };
  u32(); // total de ocorrências
  const unique = u32();
  const out = [];
  for (let i = 0; i < unique && next(); i++) {
    const cch = u16();
    const flags = byte();
    let high = flags & 1;
    const runs = flags & 8 ? u16() : 0;
    const ext = flags & 4 ? u32() : 0;
    const codes = [];
    let left = cch;
    while (left > 0 && si < segs.length) {
      const s = segs[si];
      if (pos >= s.length) {
        // O texto continua no próximo registro, que começa com um novo byte de opções.
        si++;
        pos = 0;
        if (si >= segs.length) break;
        high = segs[si][pos++] & 1;
        continue;
      }
      const avail = high ? (s.length - pos) >> 1 : s.length - pos;
      if (avail <= 0) {
        pos = s.length;
        continue;
      }
      const take = Math.min(left, avail);
      if (high) for (let k = 0; k < take; k++, pos += 2) codes.push(s[pos] | (s[pos + 1] << 8));
      else for (let k = 0; k < take; k++) codes.push(s[pos++]);
      left -= take;
    }
    let str = '';
    for (let k = 0; k < codes.length; k += 4096) str += String.fromCharCode.apply(null, codes.slice(k, k + 4096));
    out.push(str);
    skip(runs * 4 + ext);
  }
  return out;
}

function readXls(bytes) {
  const { stream, names } = cfbStream(bytes, ['workbook', 'book']);
  if (!stream) {
    if (names.includes('encryptedpackage') || names.includes('encryptioninfo')) {
      throw new Error('A planilha está protegida por senha. Abra no Excel, remova a senha e envie de novo.');
    }
    throw new Error('Não encontrei os dados da planilha dentro do arquivo .xls.');
  }
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const len = stream.length;
  if (len < 8 || dv.getUint16(0, true) !== 0x0809) {
    throw new Error('Formato de Excel muito antigo ou desconhecido. Abra no Excel e salve como .xlsx.');
  }
  const biff = dv.getUint16(4, true) >= 0x0600 ? 8 : 5;

  const str16 = (o) => {
    const cch = stream[o] | (stream[o + 1] << 8);
    if (biff < 8) return decode1252(stream.subarray(o + 2, o + 2 + cch));
    const high = stream[o + 2] & 1;
    let s = '';
    for (let i = 0, p = o + 3; i < cch && p < len; i++) {
      if (high) {
        s += String.fromCharCode(stream[p] | (stream[p + 1] << 8));
        p += 2;
      } else s += String.fromCharCode(stream[p++]);
    }
    return s;
  };

  // 1) Bloco global: lista de abas e textos compartilhados
  const sheets = [];
  let sst = null;
  let inSst = false;
  let pos = 0;
  while (pos + 4 <= len) {
    const type = dv.getUint16(pos, true);
    const size = dv.getUint16(pos + 2, true);
    const o = pos + 4;
    pos = o + size;
    if (type === 0x003c && inSst) {
      sst.push(stream.subarray(o, o + size));
      continue;
    }
    inSst = false;
    if (type === 0x002f) throw new Error('A planilha está protegida por senha. Abra no Excel, remova a senha e envie de novo.');
    if (type === 0x0085 && size >= 8) {
      const at = dv.getUint32(o, true);
      const cch = stream[o + 6];
      let name = '';
      if (biff >= 8) {
        const high = stream[o + 7] & 1;
        for (let i = 0, p = o + 8; i < cch && p < o + size; i++) {
          if (high) {
            name += String.fromCharCode(stream[p] | (stream[p + 1] << 8));
            p += 2;
          } else name += String.fromCharCode(stream[p++]);
        }
      } else name = decode1252(stream.subarray(o + 7, o + 7 + cch));
      sheets.push({ at, kind: stream[o + 5], name });
    } else if (type === 0x00fc) {
      sst = [stream.subarray(o, o + size)];
      inSst = true;
    } else if (type === 0x000a) break;
  }
  const strings = sst ? parseSST(sst) : [];
  const sheet = sheets.find((s) => s.kind === 0 && s.at < len) || sheets.find((s) => s.at < len);

  // 2) Células da primeira aba de dados
  const rows = [];
  const put = (r, c, v) => {
    (rows[r] || (rows[r] = []))[c] = v;
  };
  let p = sheet ? sheet.at : pos;
  if (p + 4 <= len && dv.getUint16(p, true) === 0x0809) p += 4 + dv.getUint16(p + 2, true);
  let pending = null;
  while (p + 4 <= len) {
    const type = dv.getUint16(p, true);
    const size = dv.getUint16(p + 2, true);
    const o = p + 4;
    p = o + size;
    if (type === 0x000a) break;
    if (type === 0x0809) {
      // gráfico/objeto embutido: pula até o EOF correspondente
      let depth = 1;
      while (p + 4 <= len && depth) {
        const t = dv.getUint16(p, true);
        p += 4 + dv.getUint16(p + 2, true);
        if (t === 0x0809) depth++;
        else if (t === 0x000a) depth--;
      }
      continue;
    }
    if (type === 0x0207) {
      if (pending) put(pending[0], pending[1], str16(o));
      pending = null;
      continue;
    }
    if (size < 6 || o + size > len) continue;
    const r = dv.getUint16(o, true);
    const c = dv.getUint16(o + 2, true);
    switch (type) {
      case 0x00fd: // LABELSST
        put(r, c, strings[dv.getUint32(o + 6, true)] ?? '');
        break;
      case 0x0203: // NUMBER
        put(r, c, dv.getFloat64(o + 6, true));
        break;
      case 0x027e: // RK
        put(r, c, rkValue(dv.getUint32(o + 6, true)));
        break;
      case 0x00bd: {
        // MULRK
        const last = dv.getUint16(o + size - 2, true);
        for (let k = 0, q = o + 4; c + k <= last && q + 6 <= o + size - 2; k++, q += 6) put(r, c + k, rkValue(dv.getUint32(q + 2, true)));
        break;
      }
      case 0x0204: // LABEL
      case 0x00d6: // RSTRING
        put(r, c, str16(o + 6));
        break;
      case 0x0006: // FORMULA (usa o resultado calculado)
        if (dv.getUint16(o + 12, true) === 0xffff) {
          const kind = stream[o + 6];
          if (kind === 0) pending = [r, c];
          else if (kind === 1) put(r, c, stream[o + 8] !== 0);
          else if (kind === 3) put(r, c, '');
        } else put(r, c, dv.getFloat64(o + 6, true));
        break;
      case 0x0205: // BOOLERR
        if (stream[o + 7] === 0) put(r, c, stream[o + 6] !== 0);
        break;
      default:
        break;
    }
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return { sheetName: sheet ? sheet.name : 'Planilha', rows };
}

/* ============================================================= API */

/**
 * Lê a primeira aba de uma planilha .xlsx, .xls ou .csv.
 * @param {ArrayBuffer|Uint8Array} input
 * @param {{ fileName?: string, inflateRaw?: Function, onProgress?: Function }} [options]
 */
export async function readSpreadsheet(input, options = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const progress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  if (bytes.length < 4) throw new Error('O arquivo está vazio ou incompleto.');

  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const r = await readXlsx(bytes, options);
    return { ...r, format: 'xlsx' };
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    progress({ stage: 'sheet' });
    await new Promise((res) => setTimeout(res, 0));
    const r = readXls(bytes);
    progress({ stage: 'rows', rows: r.rows.length });
    return { ...r, format: 'xls' };
  }

  progress({ stage: 'sheet' });
  const text = decodeText(bytes);
  const head = text.slice(0, 4000).replace(/^\uFEFF/, '').trimStart();
  let result;
  if (head.startsWith('<')) {
    if (/<(?:\w+:)?Workbook\b/i.test(head) && /office:spreadsheet/i.test(text.slice(0, 20000))) result = { ...parseSpreadsheetML(text), format: 'xml' };
    else if (/<table\b/i.test(text)) result = { sheetName: 'Planilha', rows: parseHtmlTable(text), format: 'html' };
  }
  if (!result) {
    if (/\.xlsx?$/i.test(options.fileName || '') && /[\u0000-\u0008]/.test(text.slice(0, 2000))) {
      throw new Error('Não consegui reconhecer este arquivo. Abra no Excel e salve como .xlsx ou .csv.');
    }
    result = { sheetName: 'CSV', rows: parseDelimited(text), format: 'csv' };
  }
  progress({ stage: 'rows', rows: result.rows.length });
  return result;
}

/** Funções internas expostas apenas para os testes automatizados. */
export const __test = { parseSST, rkValue, parseDelimited, parseHtmlTable, decodeText };
