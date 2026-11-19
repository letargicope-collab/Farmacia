import type { CatalogFile, CatalogRow } from './erp/erp-catalog.js';
import { FLAG_CONTINUOUS, FLAG_CONTROLLED, FLAG_INACTIVE } from './erp/erp-catalog.js';
import { campaignDiscount } from '../config/campanha';

/* ============================================================================
 *  CATÁLOGO DA LOJA — transforma as linhas do ERP em produtos prontos para
 *  exibição: nome amigável, marca, categoria da vitrine e tipo de embalagem.
 * ==========================================================================*/

export type CategoryId =
  | 'medicamentos'
  | 'genericos'
  | 'vitaminas'
  | 'beleza'
  | 'higiene'
  | 'infantil'
  | 'saude'
  | 'conveniencia';

export type VisualKind = 'box' | 'bottle' | 'tube' | 'jar' | 'pack' | 'device';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  description: string;
  keywords: string;
  tone: 'orange' | 'blue';
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'medicamentos', label: 'Medicamentos', description: 'Éticos, similares e MIPs', keywords: 'medicamento remedio etico similar', tone: 'blue' },
  { id: 'genericos', label: 'Genéricos', description: 'Mesmo efeito, menor preço', keywords: 'generico', tone: 'orange' },
  { id: 'vitaminas', label: 'Vitaminas & Suplementos', description: 'Imunidade e energia', keywords: 'vitamina suplemento', tone: 'blue' },
  { id: 'beleza', label: 'Perfumaria & Beleza', description: 'Dermocosméticos e cuidados', keywords: 'beleza perfumaria cosmetico dermocosmetico', tone: 'orange' },
  { id: 'higiene', label: 'Higiene Pessoal', description: 'Bucal, íntima e banho', keywords: 'higiene', tone: 'blue' },
  { id: 'infantil', label: 'Mamães & Bebês', description: 'Fraldas, leites e cuidados', keywords: 'bebe infantil crianca mamae', tone: 'orange' },
  { id: 'saude', label: 'Saúde & Bem-estar', description: 'Aparelhos, curativos e testes', keywords: 'saude hospitalar ortopedico idoso', tone: 'blue' },
  { id: 'conveniencia', label: 'Conveniência', description: 'Bomboniere e utilidades', keywords: 'conveniencia', tone: 'orange' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, CategoryMeta>;

export interface Product {
  id: string;
  /** Código do produto no ERP */
  code: string;
  /** Nome higienizado (como no sistema) */
  rawName: string;
  /** Nome amigável para exibição */
  name: string;
  lab: string;
  brand: string;
  /** Grupo original do ERP (ETICO, GENERICO, PERFUMARIA GERAL…) */
  group: string;
  category: CategoryId;
  /** Princípio ativo / fórmula */
  formula: string;
  stock: number;
  inStock: boolean;
  /** Preço final cobrado (promoção quando houver) */
  price: number;
  /** Preço de venda regular */
  regularPrice: number;
  promo: number;
  discount: number;
  /** Produto na campanha promocional ativa (ex.: Black Friday) */
  campaign: boolean;
  /** Preço Máximo ao Consumidor */
  pmc: number;
  ean: string;
  ms: string;
  curve: string;
  controlled: boolean;
  continuous: boolean;
  visual: VisualKind;
  dosage: string;
  /** URL do render 3D (preenchida pelo pipeline de imagens, quando configurado) */
  imageUrl?: string;
}

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ------------------------------------------------------- Laboratórios -- */
const LAB_NAMES: Record<string, string> = {
  ACHE: 'Aché', APSE: 'Apsen', ASTR: 'AstraZeneca', BAYE: 'Bayer', BAYER: 'Bayer', BOEH: 'Boehringer Ingelheim',
  CIFAR: 'Cifarma', CIFARMA: 'Cifarma', CIME: 'Cimed', CIMED: 'Cimed', DAII: 'Daiichi Sankyo', DELTA: 'Delta',
  EMS: 'EMS', EURO: 'Eurofarma', EUROFARMA: 'Eurofarma', GEOLA: 'Geolab', GEOLAB: 'Geolab', GERMED: 'Germed', GSK: 'GSK',
  HALE: 'Haleon', HYPE: 'Hypera', JOHN: 'Johnson & Johnson', MANT: 'Mantecorp', MEDLEY: 'Medley', MEDL: 'Medley',
  MEDSO: 'Medsonda', MERC: 'Merck', NEOQ: 'Neo Química', 'NEO QUIMICA': 'Neo Química', PFIZ: 'Pfizer', PFIZER: 'Pfizer',
  PRATI: 'Prati-Donaduzzi', PROC: 'Procter & Gamble', RECK: 'Reckitt', SANO: 'Sanofi', SANOFI: 'Sanofi', TAKE: 'Takeda',
  TEUTO: 'Teuto', CREMER: 'Cremer', ROCHE: 'Roche', ABBOTT: 'Abbott', ABBO: 'Abbott', GALDERMA: 'Galderma',
  VICHY: 'Vichy', GROWTH: 'Growth Supplements', SANAVITA: 'Sanavita', VITAFOR: 'Vitafor', INTEGRALMEDICA: 'Integralmédica',
  NOVA: 'Novartis', NOVARTIS: 'Novartis', LIBBS: 'Libbs', LEGRAND: 'Legrand', SAND: 'Sandoz', SANDOZ: 'Sandoz',
  BIOS: 'Biosintética', NATU: 'Natulab', KENV: 'Kenvue', COLG: 'Colgate', NEST: 'Nestlé', NESTLE: 'Nestlé',
  LORE: "L'Oréal", UNIA: 'União Química', FQM: 'FQM', CRIS: 'Cristália', BIOL: 'Biolab', MULT: 'Multilab', SR: 'SR',
};

export function resolveBrand(lab: string): string {
  const key = (lab || '').toUpperCase().trim();
  if (!key) return '';
  return LAB_NAMES[key] ?? key.split(/\s+/).map((w) => (w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase())).join(' ');
}

/* ------------------------------------------------------ Nome amigável -- */
const EXPAND: Record<string, string> = {
  ABS: 'Absorvente', PROT: 'Protetor', HIDRAT: 'Hidratante', NEUT: 'Neutrogena',
  SACH: 'Sachês', SACHE: 'Sachês', SACHES: 'Sachês', ENV: 'Envelopes',
  CPR: 'Comprimidos', CPRS: 'Comprimidos', COMP: 'Comprimidos', COMPR: 'Comprimidos', CP: 'Comprimidos', CPS: 'Comprimidos',
  DRG: 'Drágeas', DRGS: 'Drágeas', CAP: 'Cápsulas', CAPS: 'Cápsulas', FLAC: 'Flaconetes', PAST: 'Pastilhas',
  GTS: 'Gotas', XPE: 'Xarope', POM: 'Pomada', SUSP: 'Suspensão', AMP: 'Ampolas', INJ: 'Injetável',
  INF: 'Infantil', SH: 'Shampoo', COND: 'Condicionador', SAB: 'Sabonete', DES: 'Desodorante', DESOD: 'Desodorante',
  LENC: 'Lenço', FRALD: 'Fralda', EFERV: 'Efervescente', TAM: 'Tam.', CX: 'Caixa', FR: 'Frasco', TB: 'Bisnaga',
  PCT: 'Pacote', CR: 'Creme', LOC: 'Loção', SOL: 'Solução',
};

const ACCENTS: Record<string, string> = {
  ALCA: 'Alça', PEROXIDO: 'Peróxido', HIDROGENIO: 'Hidrogênio', SODICA: 'Sódica', SODICO: 'Sódico', SODIO: 'Sódio',
  POTASSICA: 'Potássica', POTASSIO: 'Potássio', CALCIO: 'Cálcio', MAGNESIO: 'Magnésio', ACIDO: 'Ácido',
  ACETILSALICILICO: 'Acetilsalicílico', ASCORBICO: 'Ascórbico', FOLICO: 'Fólico', OLEO: 'Óleo', OMEGA: 'Ômega',
  COLAGENO: 'Colágeno', SOLUCAO: 'Solução', LOCAO: 'Loção', PROTECAO: 'Proteção', HIDRATACAO: 'Hidratação',
  ESTERIL: 'Estéril', TERMOMETRO: 'Termômetro', PRESSAO: 'Pressão', DESCARTAVEL: 'Descartável',
  COMPRESSAO: 'Compressão', MEDIA: 'Média', GERIATRICA: 'Geriátrica', INTIMA: 'Íntima', INTIMO: 'Íntimo',
  AGUA: 'Água', ALCOOL: 'Álcool', ALGODAO: 'Algodão', FLEXIVEIS: 'Flexíveis', LIMAO: 'Limão', PO: 'Pó',
  BEBE: 'Bebê', GENERICO: 'Genérico', CAPSULAS: 'Cápsulas', AMENDOAS: 'Amêndoas', SENSIVEL: 'Sensível',
  BASICO: 'Básico', SERUM: 'Sérum', MICELAR: 'Micelar', CLORIDRATO: 'Cloridrato', CAFEINA: 'Cafeína',
  BETAINA: 'Betaína', DIETILAMONIO: 'Dietilamônio', POLIVITAMINICO: 'Polivitamínico',
  MULTIVITAMINICO: 'Multivitamínico', CANFORA: 'Cânfora', ORFENADRINA: 'Orfenadrina', VITAMINICO: 'Vitamínico',
  ANTISSEPTICO: 'Antisséptico', ANALGESICO: 'Analgésico', ANTIACIDO: 'Antiácido', LIQUIDO: 'Líquido',
  PROTEINA: 'Proteína', NUTRICAO: 'Nutrição', REPARACAO: 'Reparação', CRIANCA: 'Criança', MAMAE: 'Mamãe',
  FOSFATO: 'Fosfato', SUCCINATO: 'Succinato', CARBONATO: 'Carbonato', CITRATO: 'Citrato',
};

const KEEP_UPPER = new Set([
  'AAS', 'FPS', 'SPF', 'UI', 'DK', 'BI', 'UV', 'UVA', 'UVB', 'RN', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'EG',
  'PP', 'XR', 'DL', 'AA', 'AAA', 'II', 'III', 'IV', 'HD', 'XL', 'C', 'D', 'E', 'K', 'B', 'A', 'OB', 'SR', 'GSK',
  'EMS', 'MSD', 'PH', 'DHA', 'EPA', 'Q10', 'A-Z', 'NAN',
]);
const CONNECTORS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'COM', 'PARA', 'SEM', 'AO', 'A', 'O', 'POR', 'X', 'NO', 'NA']);
const UNITS: Record<string, string> = {
  MG: 'mg', MCG: 'mcg', G: 'g', KG: 'kg', ML: 'ml', L: 'L', UI: 'UI', MM: 'mm', CM: 'cm', M: 'm',
  UN: ' un', UND: ' un', UNDS: ' un', UNID: ' un',
};

const cap = (w: string) => w.charAt(0) + w.slice(1).toLowerCase();
const singular = (word: string, count: string) => (count === '1' ? word.replace(/s$/, '') : word);

function prettyWord(word: string, index: number, prev: string): string {
  const U = word.toUpperCase();
  if (!U) return '';
  let m: RegExpExecArray | null;
  if ((m = /^L(\d+)P(\d+)$/.exec(U))) return `Leve ${m[1]} Pague ${m[2]}`;
  if ((m = /^([CSP])\/(.*)$/.exec(U))) {
    const head = `${m[1].toLowerCase()}/`;
    return m[2] ? `${head} ${prettyWord(m[2], 1, '')}` : head;
  }
  if ((m = /^(\d+(?:[.,]\d+)*)(MG|MCG|G|KG|ML|L|UI|MM|CM|M|UN|UND|UNDS|UNID)(\/(?:ML|G|L|KG|GOTA|DOSE))?$/.exec(U))) {
    return `${m[1]}${UNITS[m[2]]}${m[3] ? m[3].toLowerCase() : ''}`;
  }
  if ((m = /^(\d+)([A-Z]{2,})$/.exec(U)) && EXPAND[m[2]]) return `${m[1]} ${singular(EXPAND[m[2]].toLowerCase(), m[1])}`;
  if ((m = /^(FPS|SPF)(\d+)$/.exec(U))) return `FPS ${m[2]}`;
  if (U.length > 1 && U.includes('+')) return U.split('+').filter(Boolean).map((p) => prettyWord(p, 1, '')).join(' + ');
  if (KEEP_UPPER.has(U)) return (U === 'A' || U === 'E') && prev !== 'VITAMINA' ? U.toLowerCase() : U;
  if (index > 0 && CONNECTORS.has(U)) return U.toLowerCase();
  if (UNITS[U] && /\d$/.test(prev)) return UNITS[U].trim();
  if (EXPAND[U]) return /\d$/.test(prev) ? singular(EXPAND[U].toLowerCase(), prev) : EXPAND[U];
  if (ACCENTS[U]) return ACCENTS[U];
  if (/^[A-Z]+-[A-Z]+$/.test(U)) return U.split('-').map((p) => (p.length <= 1 ? p : prettyWord(p, 1, ''))).join('-');
  if (/^\([A-Z]+\)$/.test(U)) return `(${cap(U.slice(1, -1))})`;
  if (/^[A-Z]+$/.test(U)) return cap(U);
  if (/^[A-Z]+\d+[A-Z\d]*$/.test(U) || /^\d+[A-Z]+$/.test(U)) return U;
  return U.toLowerCase();
}

/** "LACTULONA 10SACH AMEIXA 15ML" → "Lactulona 10 sachês Ameixa 15ml" */
export function prettyName(raw: string): string {
  const src = (raw || '').replace(/-SIMILAR\b/gi, ' (SIMILAR)').replace(/\s+/g, ' ').trim();
  if (!src) return '';
  const words = src.split(' ');
  return words
    .map((w, i) => prettyWord(w, i, (words[i - 1] || '').toUpperCase()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ----------------------------------------------------- Categoria vitrine -- */
const KEYWORD_RULES: Array<[CategoryId, RegExp]> = [
  ['saude', /\b(geriatric|plenitud|bigfral|tena|roupa intima|fralda adulto)/],
  ['infantil', /\b(fralda|mamadeira|chupeta|mordedor|copinho|baby|bebe|infantil|kids|crianca|lenco umedecido|assadura|seios|amamenta|gestante|nan |aptamil|nestogeno|mucilon)/],
  ['vitaminas', /\b(vitamina|whey|creatina|omega|colageno|polivitaminico|multivitaminico|proteina|suplemento)/],
  ['higiene', /^absorvente|\b(absorvente|escova dental|creme dental|fio dental|enxaguante|sabonete|desodorante|papel higienico|cotonete|hastes|algodao|repelente|aparelho de barbear)/],
  ['saude', /\b(teste de gravidez|termometro|seringa|agulha|gaze|atadura|esparadrapo|curativo|colostomia|luva|mascara|pressao|glicosimetro|tiras|lanceta|bengala|muleta|compressao|inalador|nebulizador|coletor|sonda|preservativo|alcool)/],
  ['beleza', /\b(shampoo|condicionador|hidratante|protetor solar|perfume|colonia|batom|esmalte|maquiagem|serum|facial|tintura|coloracao|micelar|demaquilante|anti-idade)/],
  ['medicamentos', /\d\s?(mg|mcg|ui)\b|\b(comprimido|capsula|drageas|gotas|xarope|pomada|suspensao|solucao oral|ampola|injetavel|efervescente)/],
];

function keywordCategory(text: string): CategoryId | null {
  for (const [cat, re] of KEYWORD_RULES) if (re.test(text)) return cat;
  return null;
}

export function classifyCategory(group: string, text: string): CategoryId {
  const g = strip(group);
  if (/generic/.test(g)) return 'genericos';
  if (/psico|controlad|antibiot|antimicrob|etico|similar|referencia|medicament|homeopat|fitoter|manipul|hormon/.test(g)) return 'medicamentos';
  if (/suplement|vitamin|nutri|esportiv/.test(g)) return 'vitaminas';
  if (/fralda|infantil|bebe|leite|mamae|gestante/.test(g)) return keywordCategory(text) === 'saude' ? 'saude' : 'infantil';
  if (/higiene|bucal|absorv|algodao|intim|desodor|barbear/.test(g)) return 'higiene';
  if (/hospital|ortoped|curativo|diagnost|saude|cirurg/.test(g)) return 'saude';
  if (/bombon|conveni|aliment|bebida|doce/.test(g)) return 'conveniencia';
  if (/perfum|capilar|dermo|cosmet|maquia|beleza|unha/.test(g)) {
    const k = keywordCategory(text);
    return k === 'higiene' || k === 'infantil' || k === 'saude' ? k : 'beleza';
  }
  return keywordCategory(text) ?? 'conveniencia'; // grupos amplos: VAREJO, IMPORTACAO, ARTIGOS VARIADOS…
}

/* -------------------------------------------------- Tipo de embalagem 3D -- */
export function inferVisual(text: string, category: CategoryId): VisualKind {
  if (/\b(fralda|absorvente|lenco|algodao|pacote|roupa intima|gaze|mascara descartavel)/.test(text)) return 'pack';
  if (/\b(sache|envelope|comprimido|capsula|drageas|pastilha)/.test(text)) return 'box';
  if (/\b(pomada|creme|gel|emulgel|protetor solar|bisnaga|pasta|unguento|vaporub)/.test(text)) return 'tube';
  if (/\b(teste|termometro|medidor|aparelho|seringa|mamadeira|chupeta|copinho|mordedor|escova|pilha|tiras|bolsa|meia|protetor de seios|preservativo|esparadrapo)/.test(text)) return 'device';
  if (/\b(pote|lata|leite|whey|creatina|colageno|ensure|nestogeno|mucilon)\b|\bpo\b/.test(text) || (category === 'vitaminas' && /\d\s?g\b/.test(text))) return 'jar';
  if (/\b(gotas|xarope|solucao|suspensao|spray|aerosol|shampoo|condicionador|locao|colonia|perfume|enxaguante|alcool|peroxido|agua|micelar|serum|flaconete|frasco|esmalte|oleo)/.test(text) || /\d\s?ml\b/.test(text)) return 'bottle';
  return 'box';
}

export function extractDosage(name: string): string {
  const m = /(\d+(?:[.,]\d+)*)\s?(mg|mcg|g|ml|UI)\b/i.exec(name);
  return m ? `${m[1]}${m[2].toUpperCase() === 'UI' ? 'UI' : m[2].toLowerCase()}` : '';
}

/* --------------------------------------------------------- Hidratação -- */
function hydrateRow(row: CatalogRow, groups: string[], now: number): Product {
  const [code, rawName, lab, gi, formula, stock, price, promo, pmc, ean, ms, curve, flags] = row;
  const name = prettyName(rawName);
  const group = groups[gi] ?? '';
  const text = strip(`${name} ${rawName}`);
  const category = classifyCategory(group, text);

  // Preço exibido = "Preço Venda" do sistema. Desconto só quando comprovado pela
  // coluna "Preço Promoção" ou pela campanha configurada (src/config/campanha.ts).
  let finalPromo = promo > 0 && promo < price ? promo : 0;
  let discount = finalPromo > 0 ? Math.max(0, Math.round((1 - finalPromo / price) * 100)) : 0;
  let campaign = false;
  const campaignOff = (flags & FLAG_CONTROLLED) === 0 ? campaignDiscount(code, now) : 0;
  if (campaignOff > 0 && price > 0) {
    // Cálculo em centavos inteiros: preserva os centavos sem erro de arredondamento.
    const campaignPrice = Math.round((Math.round(price * 100) * (100 - campaignOff)) / 100) / 100;
    if (campaignPrice > 0 && (finalPromo === 0 || campaignPrice < finalPromo)) {
      finalPromo = campaignPrice;
      discount = campaignOff;
      campaign = true;
    }
  }
  return {
    id: code,
    code,
    rawName,
    name,
    lab,
    brand: resolveBrand(lab),
    group,
    category,
    formula: formula ? prettyName(formula) : '',
    stock,
    // Produto desativado no sistema: mantido no catálogo, exibido como indisponível.
    inStock: stock > 0 && (flags & FLAG_INACTIVE) === 0,
    price: finalPromo > 0 ? finalPromo : price,
    regularPrice: price,
    promo: finalPromo,
    discount,
    campaign,
    pmc,
    ean,
    ms,
    curve,
    controlled: (flags & FLAG_CONTROLLED) !== 0,
    continuous: (flags & FLAG_CONTINUOUS) !== 0,
    visual: inferVisual(text, category),
    dosage: extractDosage(name),
  };
}

export function hydrateCatalog(file: CatalogFile): Product[] {
  const groups = Array.isArray(file.groups) ? file.groups : [];
  const items = Array.isArray(file.items) ? file.items : [];
  const now = Date.now();
  return items.map((row) => hydrateRow(row, groups, now));
}

/** Ordem padrão da vitrine: disponíveis, curva ABC (mais vendidos), promoções e nome. */
export function defaultSort(a: Product, b: Product): number {
  const curve = (p: Product) => (p.curve === 'A' ? 3 : p.curve === 'B' ? 2 : p.curve === 'C' ? 1 : 0);
  return (
    Number(b.inStock) - Number(a.inStock) ||
    curve(b) - curve(a) ||
    Number(b.promo > 0) - Number(a.promo > 0) ||
    a.name.localeCompare(b.name, 'pt-BR')
  );
}
