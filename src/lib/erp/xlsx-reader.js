/**
 * ============================================================================
 *  LEITOR XLSX MINIMALISTA (sem dependências) — Farmácia São Marcos
 * ----------------------------------------------------------------------------
 *  Lê a primeira planilha de um arquivo .xlsx (que é um ZIP com XMLs) e
 *  devolve as linhas como uma matriz de valores.
 *
 *  • Navegador: usa o DecompressionStream nativo ("deflate-raw").
 *  • Node.js:   passe `inflateRaw` (ex.: zlib.inflateRawSync) nas opções.
 *
 *  Usado pelo painel "Área do Lojista" (importação no navegador) e pelo
 *  script `node scripts/import-catalog.mjs` (importação no build).
 * ============================================================================
 */

const utf8 = new TextDecoder('utf-8');

/** Descompactação DEFLATE nativa do navegador. */
export async function browserInflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Este navegador não consegue abrir arquivos .xlsx. Atualize o Chrome, Edge, Firefox ou Safari.',
    );
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ------------------------------------------------------------------ ZIP -- */

function readZipDirectory(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.length;
  let eocd = -1;
  for (let i = len - 22, min = Math.max(0, len - 65557); i >= min; i--) {
    if (bytes[i] === 0x50 && dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Arquivo inválido: selecione a planilha .xlsx exportada do sistema.');

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (p + 46 > len || dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compressedSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
    entries.set(name.toLowerCase(), { name, method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function extractEntry(bytes, entry, inflateRaw) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const o = entry.offset;
  if (dv.getUint32(o, true) !== 0x04034b50) throw new Error('Planilha corrompida (estrutura ZIP inválida).');
  const start = o + 30 + dv.getUint16(o + 26, true) + dv.getUint16(o + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRaw(data);
  throw new Error('Compressão não suportada na planilha (método ' + entry.method + ').');
}

/* ------------------------------------------------------------------ XML -- */

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(s) {
  if (!s) return '';
  let out =
    s.indexOf('&') >= 0
      ? s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, e) => {
          if (e[0] === '#') {
            const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : all;
          }
          return XML_ENTITIES[e.toLowerCase()] ?? all;
        })
      : s;
  if (out.indexOf('_x') >= 0) out = out.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return out;
}

/** Concatena todos os <t>…</t> de um fragmento (ignora textos fonéticos <rPh>). */
function textOf(fragment) {
  const clean = fragment.indexOf('rPh') >= 0
    ? fragment.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')
    : fragment;
  const re = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g;
  let m;
  let s = '';
  while ((m = re.exec(clean))) s += m[1];
  return decodeXml(s);
}

function parseSharedStrings(xml) {
  const list = [];
  const re = /<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>|<(?:\w+:)?si\/>/g;
  let m;
  while ((m = re.exec(xml))) list.push(m[1] ? textOf(m[1]) : '');
  return list;
}

function colIndex(letters) {
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function parseCells(body, shared) {
  const row = [];
  const cStart = /<(?:\w+:)?c\b([^>]*?)(\/?)>/g;
  const cEnd = /<\/(?:\w+:)?c>/g;
  let m;
  let col = -1;
  while ((m = cStart.exec(body))) {
    const attrs = m[1];
    const ref = /\br="([A-Za-z]+)\d*"/.exec(attrs);
    col = ref ? colIndex(ref[1].toUpperCase()) : col + 1;
    if (m[2] === '/') continue;
    cEnd.lastIndex = cStart.lastIndex;
    const end = cEnd.exec(body);
    if (!end) break;
    const inner = body.slice(cStart.lastIndex, end.index);
    cStart.lastIndex = cEnd.lastIndex;

    const type = (/\bt="([^"]+)"/.exec(attrs) || [])[1] || 'n';
    let value;
    if (type === 'inlineStr') {
      value = textOf(inner);
    } else {
      const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
      if (!v) continue;
      const raw = v[1];
      if (type === 's') value = shared[+raw] ?? '';
      else if (type === 'b') value = raw === '1' || raw === 'true';
      else if (type === 'str' || type === 'e' || type === 'd') value = decodeXml(raw);
      else {
        const num = Number(raw);
        value = raw.trim() !== '' && Number.isFinite(num) ? num : decodeXml(raw);
      }
    }
    row[col] = value;
  }
  return row;
}

async function parseSheet(xml, shared, progress) {
  const rows = [];
  const rowStart = /<(?:\w+:)?row\b([^>]*?)(\/?)>/g;
  const rowEnd = /<\/(?:\w+:)?row>/g;
  let m;
  let idx = -1;
  let count = 0;
  while ((m = rowStart.exec(xml))) {
    const r = /\br="(\d+)"/.exec(m[1]);
    idx = r ? parseInt(r[1], 10) - 1 : idx + 1;
    if (m[2] === '/') {
      rows[idx] = [];
      continue;
    }
    rowEnd.lastIndex = rowStart.lastIndex;
    const end = rowEnd.exec(xml);
    if (!end) break;
    rows[idx] = parseCells(xml.slice(rowStart.lastIndex, end.index), shared);
    rowStart.lastIndex = rowEnd.lastIndex;
    if (++count % 2000 === 0) {
      progress({ stage: 'rows', rows: count });
      await new Promise((res) => setTimeout(res, 0)); // mantém a interface responsiva
    }
  }
  progress({ stage: 'rows', rows: count });
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/* ----------------------------------------------------------- API pública -- */

/**
 * Lê a primeira planilha do arquivo .xlsx.
 * @param {ArrayBuffer|Uint8Array} input
 * @param {{ inflateRaw?: (d: Uint8Array) => Promise<Uint8Array>|Uint8Array, onProgress?: (i: {stage: string, rows?: number}) => void }} [options]
 */
export async function readXlsx(input, options = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const inflate = options.inflateRaw || browserInflateRaw;
  const progress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

  progress({ stage: 'zip' });
  const entries = readZipDirectory(bytes);
  const readText = async (path) => {
    const e = entries.get(String(path).toLowerCase());
    if (!e) return null;
    return utf8.decode(await extractEntry(bytes, e, inflate));
  };

  let sheetPath = null;
  let sheetName = 'Planilha';
  let sharedPath = 'xl/sharedStrings.xml';
  const workbook = await readText('xl/workbook.xml');
  const rels = await readText('xl/_rels/workbook.xml.rels');
  const relTargets = new Map();
  if (rels) {
    const relRe = /<(?:\w+:)?Relationship\b[^>]*>/g;
    let m;
    while ((m = relRe.exec(rels))) {
      const id = /\bId="([^"]+)"/.exec(m[0]);
      const target = /\bTarget="([^"]+)"/.exec(m[0]);
      const type = /\bType="([^"]+)"/.exec(m[0]);
      if (!target) continue;
      const t = target[1].replace(/\\/g, '/');
      const full = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
      if (id) relTargets.set(id[1], full);
      if (type && /sharedStrings$/i.test(type[1])) sharedPath = full;
    }
  }
  if (workbook) {
    const tag = /<(?:\w+:)?sheet\b[^>]*>/.exec(workbook);
    if (tag) {
      const nm = /\bname="([^"]*)"/.exec(tag[0]);
      if (nm) sheetName = decodeXml(nm[1]);
      const rid = /\b(?:\w+:)?id="([^"]+)"/.exec(tag[0]);
      if (rid && relTargets.has(rid[1])) sheetPath = relTargets.get(rid[1]);
    }
  }
  if (!sheetPath || !entries.has(sheetPath.toLowerCase())) {
    const candidates = [...entries.values()]
      .map((e) => e.name)
      .filter((n) => /^xl\/worksheets\/[^/]+\.xml$/i.test(n))
      .sort();
    sheetPath = candidates[0] || null;
  }
  if (!sheetPath) throw new Error('Nenhuma planilha foi encontrada dentro do arquivo.');

  progress({ stage: 'strings' });
  const sst = (await readText(sharedPath)) ?? (await readText('xl/sharedStrings.xml'));
  const shared = sst ? parseSharedStrings(sst) : [];

  progress({ stage: 'sheet' });
  const xml = await readText(sheetPath);
  if (!xml) throw new Error('Não foi possível ler o conteúdo da planilha.');
  const rows = await parseSheet(xml, shared, progress);
  return { sheetName, rows };
}
