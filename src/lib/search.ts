import { CATEGORY_BY_ID, type Product } from './catalog';
import { CareIndex, identifyCare, type CareIntent } from './care-search';

/* ============================================================================
 *  MOTOR DE BUSCA INTELIGENTE (texto e voz)
 * ----------------------------------------------------------------------------
 *  • Índice invertido (rápido mesmo com 12 mil produtos)
 *  • Busca por nome, princípio ativo/fórmula, marca/laboratório e categoria
 *  • Tolerante a erros de digitação (Damerau-Levenshtein) e "fonética" do
 *    português (ex.: "omeprasol" → omeprazol, "dipyrona" → dipirona)
 *  • Entende frases faladas: "eu quero dipirona quinhentos miligramas"
 *  • Busca por código interno ou código de barras (EAN)
 * ==========================================================================*/

export function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2');
}

const TOKEN_RE = /\d+(?:\.\d+)?|[a-z]+/g;
export const rawTokens = (s: string): string[] => normalizeText(s).match(TOKEN_RE) ?? [];

const STOPWORDS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'pro', 'com',
  'sem', 'e', 'em', 'no', 'na', 'nos', 'nas', 'por', 'eu', 'quero', 'queria', 'preciso', 'precisava', 'comprar',
  'compra', 'tem', 'tenho', 'voce', 'voces', 'vcs', 'me', 've', 'ver', 'procuro', 'procurando', 'gostaria', 'favor',
  'remedio', 'remedios', 'medicamento', 'medicamentos', 'produto', 'produtos', 'algum', 'alguma', 'qual', 'quais',
  'farmacia', 'oi', 'ola', 'bom', 'dia', 'boa', 'tarde', 'noite', 'buscar', 'busca', 'pesquisar', 'encontrar',
  'achar', 'c', 'x', 'p', 's', 'vende', 'vendem', 'aqui',
]);

const SYNONYMS: Record<string, string> = {
  miligrama: 'mg', miligramas: 'mg', mililitro: 'ml', mililitros: 'ml', micrograma: 'mcg', microgramas: 'mcg',
  grama: 'g', gramas: 'g', comprimido: 'comprimidos', capsula: 'capsulas', gota: 'gotas', sache: 'saches',
  pastilha: 'pastilhas', idoso: 'geriatrica', idosos: 'geriatrica', geriatrico: 'geriatrica',
  cem: '100', duzentos: '200', trezentos: '300', quatrocentos: '400', quinhentos: '500', seiscentos: '600',
  setecentos: '700', oitocentos: '800', novecentos: '900', mil: '1000', dez: '10', vinte: '20', trinta: '30',
  quarenta: '40', cinquenta: '50', sessenta: '60', setenta: '70', oitenta: '80', noventa: '90', cinco: '5',
  dois: '2', duas: '2', tres: '3', quatro: '4', seis: '6', sete: '7', oito: '8', nove: '9',
};

const isDigit = (t: string) => {
  const c = t.charCodeAt(0);
  return c >= 48 && c <= 57;
};
const stem = (t: string) => (t.length >= 5 && t.endsWith('s') && !t.endsWith('ss') && !isDigit(t) ? t.slice(0, -1) : t);

/** "vitamina c" → "vitaminac" · "omega 3" → "omega3" · "fps 50" → "fps50" */
const MERGE_HEADS = new Set(['vitamina', 'omega', 'fps', 'complexo', 'tam']);
function mergeTokens(tokens: string[], keepOriginal: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (MERGE_HEADS.has(t) && next && next.length <= 3) {
      out.push(t + next);
      if (keepOriginal) out.push(t, next);
      i++;
    } else out.push(t);
  }
  return out;
}

function indexTokens(text: string): string[] {
  const merged = mergeTokens(rawTokens(text).map(stem), true);
  const out = new Set<string>();
  for (const t of merged) {
    if (t.length < 2 && !isDigit(t)) continue;
    out.add(t);
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) out.add(t.replace(/\./g, '')); // 50.000 → 50000
  }
  return [...out];
}

export function queryTokens(query: string): string[] {
  const base = mergeTokens(rawTokens(query).map((t) => SYNONYMS[t] ?? t).map(stem), false);
  let toks = base.filter((t) => !STOPWORDS.has(t) && (t.length >= 2 || isDigit(t)));
  if (!toks.length) toks = base.filter((t) => t.length >= 2);
  return [...new Set(toks)];
}

/** Chave "fonética" simplificada para o português. */
export function phonetic(t: string): string {
  if (isDigit(t)) return t;
  return t
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/k/g, 'c')
    .replace(/ch|sh/g, 'x')
    .replace(/qu/g, 'c')
    .replace(/gu(?=[ei])/g, 'g')
    .replace(/c(?=[ei])/g, 's')
    .replace(/z/g, 's')
    .replace(/^h/, '')
    .replace(/([a-z])\1+/g, '$1');
}

/* Damerau-Levenshtein (OSA) com limite — compara `a` com os primeiros `bLen` caracteres de `b`. */
const ROW_A = new Int32Array(66);
const ROW_B = new Int32Array(66);
const ROW_C = new Int32Array(66);
function boundedDistance(a: string, b: string, max: number, bLen = b.length): number {
  const la = a.length;
  const lb = Math.min(bLen, b.length);
  if (Math.abs(la - lb) > max) return max + 1;
  if (la > 64 || lb > 64) return max + 1;
  let prev2 = ROW_A;
  let prev = ROW_B;
  let cur = ROW_C;
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1);
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca === cb ? 0 : 1));
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const t = prev2;
    prev2 = prev;
    prev = cur;
    cur = t;
  }
  return prev[lb];
}

interface Entry {
  t: string;
  ph: string;
  num: boolean;
  ids: Int32Array;
  w: Float32Array;
}

/** Tokens compostos ("vitaminac", "omega3", "fps50") só aceitam correspondência exata ou prefixo. */
const MERGED_RE = /^(?:vitamina|omega|fps|complexo|tam)[a-z0-9]{1,3}$/;

/** Sinônimos de princípio ativo indexados junto da fórmula. */
const FORMULA_ALIASES: Array<[RegExp, string]> = [
  [/colecalciferol/, 'vitamina d3 vitamina d'],
  [/acido ascorbico/, 'vitamina c'],
  [/cianocobalamina/, 'vitamina b12'],
  [/acido folico/, 'vitamina b9'],
  [/acido acetilsalicilico/, 'aas aspirina'],
  [/oleo de peixe/, 'omega 3'],
  [/polivitaminico|multivitaminico/, 'multivitaminico polivitaminico vitaminas'],
  [/levotiroxina/, 'tireoide hormonio'],
];

function tokenScore(q: string, qph: string, qNum: boolean, strict: boolean, e: Entry): number {
  const t = e.t;
  if (t === q) return 1;
  if (qNum || e.num) return qNum && e.num && t.startsWith(q) ? 0.55 : 0;
  if (q.length >= 2 && t.startsWith(q)) return 0.9 - Math.min(0.15, (t.length - q.length) * 0.012);
  if (strict) return 0;
  if (qph.length >= 3 && e.ph === qph) return 0.84;
  if (q.length >= 4 && t.includes(q)) return 0.62;
  const max = qph.length >= 7 ? 2 : qph.length >= 4 ? 1 : 0;
  if (max > 0 && e.ph.length >= 3) {
    const d = boundedDistance(qph, e.ph, max);
    if (d <= max) return d <= 1 ? 0.74 : 0.6;
    if (qph.length >= 5 && e.ph.length > qph.length && boundedDistance(qph, e.ph, 1, qph.length) <= 1) return 0.62;
  }
  return 0;
}

export interface SearchResult {
  items: Product[];
  care?: CareIntent;
  total: number;
  /** true quando o resultado depende de correção de erros de digitação */
  approximate: boolean;
  tokens: string[];
}

const EMPTY: SearchResult = { items: [], total: 0, approximate: false, tokens: [] };

export class SearchEngine {
  private readonly products: Product[];
  private readonly care: CareIndex;
  private readonly entries: Entry[] = [];
  private readonly names: string[];
  private readonly cache = new Map<string, SearchResult>();

  constructor(products: Product[]) {
    this.products = products;
    this.care = new CareIndex(products);
    const map = new Map<string, Map<number, number>>();
    const add = (text: string, pid: number, weight: number) => {
      if (!text) return;
      for (const tok of indexTokens(text)) {
        let m = map.get(tok);
        if (!m) map.set(tok, (m = new Map()));
        const prev = m.get(pid);
        if (prev === undefined || weight > prev) m.set(pid, weight);
      }
    };
    products.forEach((p, i) => {
      add(p.rawName, i, 1);
      add(p.name, i, 1);
      add(p.formula, i, 0.9);
      const aliasSource = normalizeText(`${p.formula} ${p.name}`);
      const aliases = FORMULA_ALIASES.filter(([re]) => re.test(aliasSource)).map(([, words]) => words);
      if (/\bd3\b/.test(aliasSource)) aliases.push('vitamina d3 vitamina d');
      if (aliases.length) add(aliases.join(' '), i, 0.85);
      add(`${p.brand} ${p.lab}`, i, 0.6);
      const cat = CATEGORY_BY_ID[p.category];
      add(`${p.group} ${cat.label} ${cat.keywords}`, i, 0.4);
      // "black friday", "promoção", "oferta" (por texto ou voz) encontram os produtos em oferta
      if (p.promo > 0) add(p.campaign ? 'black friday blackfriday oferta ofertas promocao desconto' : 'oferta ofertas promocao desconto', i, 0.5);
    });
    for (const [t, m] of map) {
      const ids = new Int32Array(m.size);
      const w = new Float32Array(m.size);
      let k = 0;
      for (const [pid, weight] of m) {
        ids[k] = pid;
        w[k] = weight;
        k++;
      }
      this.entries.push({ t, ph: phonetic(t), num: isDigit(t), ids, w });
    }
    this.names = products.map((p) => normalizeText(p.name));
  }

  get size() {
    return this.products.length;
  }

  search(query: string, limit = 0): SearchResult {
    const key = normalizeText(query).replace(/\s+/g, ' ').trim();
    if (key.length < 2) return EMPTY;
    let result = this.cache.get(key);
    if (!result) {
      result = this.run(key);
      if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value as string);
      this.cache.set(key, result);
    }
    return limit > 0 ? { ...result, items: result.items.slice(0, limit) } : result;
  }

  private run(key: string): SearchResult {
    const care = identifyCare(key);
    if (care) {
      const items = this.care.find(care);
      return { items, total: items.length, approximate: false, tokens: [], care };
    }
    const N = this.products.length;
    const qt = queryTokens(key);

    // Código interno / código de barras (EAN)
    const digits = key.replace(/\s/g, '');
    const direct: number[] = [];
    if (/^\d{4,14}$/.test(digits)) {
      this.products.forEach((p, i) => {
        if (p.code === digits || p.ean === digits || (digits.length >= 8 && p.ean.startsWith(digits))) direct.push(i);
      });
    }
    if (!qt.length) return { ...EMPTY, items: direct.map((i) => this.products[i]), total: direct.length };

    const total = new Float32Array(N);
    const matched = new Uint8Array(N);
    const inName = new Uint8Array(N);
    let approximate = false;

    for (const q of qt) {
      const best = new Float32Array(N);
      const nameHit = new Uint8Array(N);
      const qph = phonetic(q);
      const qNum = isDigit(q);
      const strict = MERGED_RE.test(q);
      let bestRaw = 0;
      for (const e of this.entries) {
        const s = tokenScore(q, qph, qNum, strict, e);
        if (s <= 0) continue;
        if (s > bestRaw) bestRaw = s;
        const { ids, w } = e;
        for (let k = 0; k < ids.length; k++) {
          const id = ids[k];
          const v = s * w[k];
          if (v > best[id]) best[id] = v;
          if (w[k] >= 1) nameHit[id] = 1;
        }
      }
      if (bestRaw > 0 && bestRaw < 0.8) approximate = true;
      for (let i = 0; i < N; i++) {
        if (best[i] > 0) {
          total[i] += best[i];
          matched[i]++;
          if (nameHit[i]) inName[i]++;
        }
      }
    }

    const need = qt.length;
    let cands: number[] = [];
    for (let i = 0; i < N; i++) if (matched[i] === need) cands.push(i);
    if (!cands.length && need > 1) {
      const min = Math.ceil(need / 2);
      for (let i = 0; i < N; i++) if (matched[i] >= min) cands.push(i);
      if (cands.length) approximate = true;
    }

    const first = qt[0];
    const scored = cands.map((i) => {
      const p = this.products[i];
      let s = total[i] / need;
      if (inName[i] === need) s += 0.12;
      if (this.names[i].startsWith(first)) s += 0.15;
      s += p.inStock ? 0.08 : -0.35;
      if (p.curve === 'A') s += 0.05;
      else if (p.curve === 'B') s += 0.025;
      if (p.promo > 0) s += 0.02;
      if (p.controlled) s -= 0.05;
      return { i, s };
    });
    scored.sort((a, b) => b.s - a.s || this.products[a.i].name.length - this.products[b.i].name.length);

    const seen = new Set(direct);
    const ordered = [...direct, ...scored.map((x) => x.i).filter((i) => !seen.has(i))];
    return {
      items: ordered.map((i) => this.products[i]),
      total: ordered.length,
      approximate: approximate && !direct.length,
      tokens: qt,
    };
  }
}

/** Divide o texto em partes destacadas conforme os termos digitados. */
export function highlightParts(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const toks = [...new Set(rawTokens(query).filter((t) => t.length >= 2 && !STOPWORDS.has(t)))];
  if (!toks.length || !text) return [{ text, hit: false }];
  let norm = '';
  for (const ch of text) {
    const n = normalizeText(ch);
    norm += n.length === ch.length ? n : (n[0] ?? ' ').padEnd(ch.length, ' ');
  }
  const marks = new Uint8Array(text.length);
  for (const t of toks) {
    let idx = norm.indexOf(t);
    while (idx >= 0) {
      marks.fill(1, idx, idx + t.length);
      idx = norm.indexOf(t, idx + t.length);
    }
  }
  const parts: Array<{ text: string; hit: boolean }> = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      parts.push({ text: text.slice(start, i), hit: marks[start] === 1 });
      start = i;
    }
  }
  return parts;
}
