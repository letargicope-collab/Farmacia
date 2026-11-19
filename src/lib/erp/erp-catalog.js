/**
 * ============================================================================
 *  MAPEADOR ERP → CATÁLOGO DA LOJA — Farmácia São Marcos
 * ----------------------------------------------------------------------------
 *  Converte o relatório "MANUTENÇÃO DE PRODUTOS" (exportado do sistema) no
 *  catálogo público da loja e ATUALIZA o catálogo existente com segurança:
 *
 *   1. Leitura completa e validação da planilha (analyzeSheet)
 *   2. Detecção de códigos duplicados
 *   3. Associação segura pelo Código do produto (conferindo o EAN)
 *   4. Atualiza existentes · cadastra novos · NUNCA exclui produtos reais
 *   5. Relatório final detalhado (renderReportMarkdown)
 *
 *  Preço exibido = coluna "Preço Venda" (centavos preservados).
 *  Promoção só quando a coluna "Preço Promoção" comprova (> 0 e < Preço Venda).
 *  🔒 Preço Compra, Custo, Markup, Valor ST, Fornecedor e Comissão são
 *     ignorados e nunca chegam ao site.
 * ============================================================================
 */

export const CATALOG_VERSION = 1;
export const CATALOG_FIELDS = [
  'code', 'name', 'lab', 'group', 'formula', 'stock', 'price', 'promo', 'pmc', 'ean', 'ms', 'curve', 'flags',
];
export const FLAG_CONTROLLED = 1;
export const FLAG_CONTINUOUS = 2;
/** Desativado no sistema: mantido no catálogo, exibido como indisponível. */
export const FLAG_INACTIVE = 4;
/** Item ilustrativo da demonstração: removido na primeira importação real. */
export const FLAG_DEMO = 8;

export function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES = {
  codigo: 'code', codigodoproduto: 'code', codproduto: 'code', cod: 'code',
  produto: 'name', nomedoproduto: 'name', descricao: 'name', descricaodoproduto: 'name',
  laboratorio: 'lab', fabricante: 'lab',
  curvaabc: 'curve',
  grupo: 'group', categoria: 'group', grupodoproduto: 'group',
  formula: 'formula', principioativo: 'formula',
  grupoinventario: 'inventoryGroup',
  estoque: 'stock', estoqueatual: 'stock', saldo: 'stock',
  precovenda: 'price', precodevenda: 'price',
  precomaximoaoconsumidor: 'pmc', pmc: 'pmc',
  precopromocao: 'promo', precopromocional: 'promo',
  codigobarra: 'ean', codigodebarras: 'ean', codigobarras: 'ean', ean: 'ean',
  registroms: 'ms',
  controlado: 'controlled',
  sempregravarusocontinuo: 'continuous', usocontinuo: 'continuous',
  ativo: 'active',
};

const COLUMN_LABELS = {
  code: 'Código', name: 'Produto', price: 'Preço Venda', stock: 'Estoque', active: 'Ativo', promo: 'Preço Promoção',
  group: 'Grupo', lab: 'Laboratório', ean: 'Código Barra',
};

/** Localiza a linha de cabeçalho (ex.: linha 2, abaixo de "Informações do Produto"). */
export function detectHeader(rows, maxScan = 25) {
  for (let r = 0; r < Math.min(rows.length, maxScan); r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const idx = {};
    for (let c = 0; c < row.length; c++) {
      const key = HEADER_ALIASES[normalizeKey(row[c])];
      if (key && idx[key] === undefined) idx[key] = c;
    }
    if (idx.code !== undefined && idx.name !== undefined && idx.price !== undefined) return { row: r, idx };
  }
  return null;
}

export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const hasComma = s.indexOf(',') >= 0;
  const hasDot = s.indexOf('.') >= 0;
  if (hasComma && hasDot) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function isChecked(v) {
  if (v === true || v === 1) return true;
  return /^(checked|sim|s|true|1|x|verdadeiro|yes|y|ativo)$/i.test(String(v ?? '').trim());
}

const round2 = (n) => Math.round(n * 100) / 100;
const cleanText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

function codeToString(v) {
  if (typeof v === 'number') return String(Math.round(v));
  return cleanText(v);
}

/** Notação científica (ex.: "7,89741E+12"): o Excel já perdeu os dígitos — não dá para recuperar. */
const isScientific = (v) => typeof v === 'string' && /\d\s*e\s*[+-]?\d/i.test(v);

/** Converte códigos longos (EAN, Registro MS) sem corromper dígitos. */
function digitsOf(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? String(Math.round(v)) : '';
  const s = String(v ?? '').trim();
  if (!s || isScientific(s)) return '';
  return s.replace(/[.,]0+$/, '').replace(/\D/g, ''); // "7897411600010.0" → "7897411600010"
}

function eanToString(v) {
  const s = digitsOf(v);
  return /^0*$/.test(s) ? '' : s;
}

function msToString(v) {
  const raw = cleanText(v);
  if (/isent/i.test(raw)) return 'ISENTO';
  const d = digitsOf(typeof v === 'number' ? v : raw);
  return /^0*$/.test(d) ? '' : d;
}

/**
 * Higieniza o nome vindo do ERP e extrai o laboratório quando embutido.
 *   "- LACTULONA 10SACH AMEIXA 15ML   DAII %DN:0.00" → "LACTULONA 10SACH AMEIXA 15ML" (lab DAII)
 *   "#*AFOPIC 5MG C/20CPRS (TEUTO)"                  → "AFOPIC 5MG C/20CPRS"          (lab TEUTO)
 *   "09725 - PROTETOR DE SEIOS COM CAIXA PROTETORA"  → "PROTETOR DE SEIOS COM CAIXA PROTETORA"
 *   "ABS ALWAYS 32UN SUAVE ABAS(E) - 43234"          → "ABS ALWAYS 32UN SUAVE ABAS"
 */
export function cleanProductName(raw) {
  let s = cleanText(raw);
  let lab = '';
  const disc = /\s+(?:([A-Z][A-Z0-9&.]{1,9})\s+)?%D[A-Z]?\s*:?\s*-?\d+(?:[.,]\d+)?\s*%?\s*$/i.exec(s);
  if (disc) {
    if (disc[1]) lab = disc[1].toUpperCase();
    s = s.slice(0, disc.index);
  }
  s = s.replace(/\s+-\s*\d{3,7}\s*$/, '');
  s = s.replace(/^[\s#*+\-.•]+/, '');
  s = s.replace(/^\d{3,7}\s*-\s+/, '');
  const par = /\s*\(([A-Za-z][A-Za-z0-9 .&-]{1,24})\)\s*$/.exec(s);
  if (par) {
    if (!lab) lab = par[1].trim().toUpperCase();
    s = s.slice(0, par.index);
  }
  s = s.replace(/\s*\([A-Z]\)/gi, '');
  s = s.replace(/\s+/g, ' ').replace(/\s+-\s*$/, '').trim();
  return { name: s, lab };
}

const nameWords = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().match(/[A-Z]{3,}/g) ?? [];

/** Compara nomes de produto (mesma primeira palavra ou ≥ 34% de palavras em comum). */
export function similarNames(a, b) {
  const wa = nameWords(a);
  const wb = nameWords(b);
  if (!wa.length || !wb.length) return false;
  if (wa[0] === wb[0]) return true;
  const A = new Set(wa);
  const B = new Set(wb);
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter) >= 0.34;
}

/* ===================================================== 1. LEITURA COMPLETA */

/** Lê e valida TODAS as linhas da planilha, sem alterar nada. */
export function analyzeSheet(rows) {
  const header = detectHeader(rows);
  if (!header) {
    throw new Error(
      'Não encontrei o cabeçalho da planilha. Verifique se é o relatório "MANUTENÇÃO DE PRODUTOS" com as colunas Código, Produto e Preço Venda.',
    );
  }
  const c = header.idx;
  const has = (k) => c[k] !== undefined;
  const get = (row, k) => (has(k) ? row[c[k]] : undefined);

  const counts = { analyzed: 0, active: 0, inactive: 0, inStock: 0, activeInStock: 0 };
  let scientific = 0;
  let scientificExample = '';
  const records = [];
  const unidentified = [];
  const errors = [];
  const incomplete = [];
  const alerts = [];

  for (let r = header.row + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some((v) => !isBlank(v))) continue;
    const line = r + 1; // número da linha como aparece no Excel
    const code = codeToString(get(row, 'code'));
    const rawName = cleanText(get(row, 'name'));
    if (!code && !rawName) continue; // rodapés / totais sem produto

    counts.analyzed++;
    const active = has('active') ? isChecked(get(row, 'active')) : true;
    const stock = toNumber(get(row, 'stock'));
    if (active) counts.active++;
    else counts.inactive++;
    if (stock > 0) {
      counts.inStock++;
      if (active) counts.activeInStock++;
    }

    if (!code) {
      unidentified.push({ row: line, code: '', name: rawName, message: 'Produto sem código — não é possível identificá-lo com segurança' });
      continue;
    }
    if (!rawName) {
      errors.push({ row: line, code, name: '', message: 'Produto sem nome — não importado' });
      continue;
    }

    const priceCell = get(row, 'price');
    const parsedPrice = round2(toNumber(priceCell));
    const price = parsedPrice > 0 ? parsedPrice : null;
    if (price === null && active) {
      errors.push({
        row: line,
        code,
        name: rawName,
        message: isBlank(priceCell) ? 'Sem Preço Venda — não importado' : `Preço Venda inválido ou zerado (${String(priceCell)}) — não importado`,
      });
      continue;
    }

    const { name, lab: labFromName } = cleanProductName(rawName);
    const lab = cleanText(get(row, 'lab')).toUpperCase() || labFromName;
    const group = cleanText(get(row, 'group')).toUpperCase();
    const eanCell = get(row, 'ean');
    if (isScientific(eanCell) || isScientific(get(row, 'ms'))) {
      scientific++;
      if (!scientificExample) scientificExample = String(isScientific(eanCell) ? eanCell : get(row, 'ms'));
    }
    const ean = eanToString(eanCell);

    let promo = round2(toNumber(get(row, 'promo')));
    if (promo > 0 && price !== null && promo >= price) {
      if (active) alerts.push({ row: line, code, name, message: `Preço Promoção (${promo.toFixed(2)}) ≥ Preço Venda (${price.toFixed(2)}) — promoção ignorada` });
      promo = 0;
    }
    if (active && stock < 0) alerts.push({ row: line, code, name, message: `Estoque negativo (${stock}) — exibido como indisponível` });

    if (active) {
      const missing = [];
      if (!lab) missing.push('laboratório');
      if (!group) missing.push('grupo');
      if (!ean) missing.push('código de barras');
      if (missing.length) incomplete.push({ row: line, code, name, missing });
    }

    records.push({
      row: line,
      code,
      name: name || rawName,
      lab,
      group,
      formula: cleanText(get(row, 'formula')).toUpperCase(),
      stock,
      price,
      promo,
      pmc: round2(toNumber(get(row, 'pmc'))),
      ean,
      ms: msToString(get(row, 'ms')),
      curve: cleanText(get(row, 'curve')).toUpperCase().slice(0, 1),
      active,
      controlled: (has('controlled') && isChecked(get(row, 'controlled'))) || /psico|controlad/i.test(group),
      continuous: has('continuous') && isChecked(get(row, 'continuous')),
      internal: /uso\s*(e\s*)?consumo|uso\s*interno|imobilizado/i.test(cleanText(get(row, 'inventoryGroup'))),
    });
  }

  if (scientific) {
    alerts.unshift({
      row: 0,
      code: '',
      name: '',
      message: `${scientific} linha(s) com código de barras ou Registro MS em notação científica (ex.: ${scientificExample}). Esses valores foram ignorados e os já cadastrados foram mantidos. No Excel, formate essas colunas como “Texto” antes de exportar.`,
    });
  }

  /* ---- 2. códigos duplicados ---- */
  const byCode = new Map();
  for (const rec of records) {
    const list = byCode.get(rec.code);
    if (list) list.push(rec);
    else byCode.set(rec.code, [rec]);
  }
  const unique = [];
  const duplicates = [];
  for (const [code, list] of byCode) {
    if (list.length === 1) {
      unique.push(list[0]);
      continue;
    }
    const actives = list.filter((x) => x.active);
    const pool = actives.length ? actives : list;
    const poolPrices = [...new Set(pool.map((x) => x.price))];
    const info = { code, name: list[0].name, rows: list.map((x) => x.row), prices: [...new Set(list.map((x) => x.price))] };
    if (poolPrices.length === 1) {
      unique.push(pool[0]);
      duplicates.push({ ...info, resolution: actives.length === 1 ? 'mantido o único registro ativo' : 'registros com o mesmo preço mesclados' });
    } else {
      duplicates.push({ ...info, resolution: 'conflito de preços entre registros ativos — não importado (conferir no sistema)' });
    }
  }

  return {
    headerRow: header.row + 1,
    present: Object.keys(c),
    missingColumns: Object.keys(COLUMN_LABELS).filter((k) => !has(k)).map((k) => COLUMN_LABELS[k]),
    ...counts,
    valid: records.length,
    records: unique,
    unidentified,
    errors,
    incomplete,
    alerts,
    duplicates,
  };
}

/* ======================================== 3–4. ASSOCIAÇÃO E ATUALIZAÇÃO */

const TRACKED = [
  ['name', 'nome'], ['price', 'preço'], ['promo', 'promoção'], ['stock', 'estoque'], ['lab', 'laboratório'],
  ['group', 'grupo'], ['formula', 'fórmula'], ['ean', 'código de barras'], ['ms', 'registro MS'], ['pmc', 'PMC'],
  ['curve', 'curva ABC'], ['flags', 'situação'],
];

const fromRow = (it, groups) => ({
  code: it[0], name: it[1], lab: it[2], group: groups[it[3]] ?? 'OUTROS', formula: it[4], stock: it[5],
  price: it[6], promo: it[7], pmc: it[8], ean: it[9], ms: it[10], curve: it[11], flags: it[12] | 0,
});

const sellable = (it) => it[5] > 0 && (it[12] & FLAG_INACTIVE) === 0;

/**
 * Atualiza o catálogo existente com os dados oficiais da planilha.
 * @param {object|null} previous  catálogo atual (CatalogFile) — null para criar do zero
 * @param {unknown[][]} rows       linhas da planilha
 * @param {{ sourceName?: string, includeOutOfStock?: boolean, replace?: boolean }} [options]
 */
export function updateCatalog(previous, rows, options = {}) {
  const { sourceName = '', includeOutOfStock = true, replace = false } = options;
  const sheet = analyzeSheet(rows);
  const present = new Set(sheet.present);
  const prevItems = !replace && previous && Array.isArray(previous.items) ? previous.items : [];
  const prevGroups = previous && Array.isArray(previous.groups) ? previous.groups : [];

  const current = new Map();
  const demoRemoved = [];
  for (const it of prevItems) {
    if ((it[12] & FLAG_DEMO) !== 0) {
      demoRemoved.push({ code: it[0], name: it[1] });
      continue;
    }
    current.set(it[0], fromRow(it, prevGroups));
  }
  const existingCodes = new Set(current.keys());
  const eanIndex = new Map();
  for (const rec of current.values()) if (rec.ean && !eanIndex.has(rec.ean)) eanIndex.set(rec.ean, rec);

  const report = {
    source: sourceName,
    generatedAt: new Date().toISOString(),
    mode: replace || !previous ? 'criação do catálogo' : 'atualização (mescla)',
    headerRow: sheet.headerRow,
    missingColumns: sheet.missingColumns,
    analyzed: sheet.analyzed,
    activeRows: sheet.active,
    inactiveRows: sheet.inactive,
    activeInStockRows: sheet.activeInStock,
    validRows: sheet.valid,
    catalogBefore: existingCodes.size,
    catalogAfter: 0,
    updated: [],
    unchanged: 0,
    added: [],
    priceChanges: [],
    promoChanges: [],
    fieldChanges: {},
    kept: [],
    deactivated: [],
    unidentified: [...sheet.unidentified],
    incomplete: sheet.incomplete,
    errors: [...sheet.errors],
    alerts: [...sheet.alerts],
    duplicates: sheet.duplicates,
    skippedInactiveNew: 0,
    skippedOutOfStockNew: 0,
    skippedInternal: 0,
    demoRemoved,
  };

  const touched = new Set(sheet.duplicates.filter((d) => d.resolution.startsWith('conflito')).map((d) => d.code));

  for (const rec of sheet.records) {
    touched.add(rec.code);
    const before = current.get(rec.code);

    if (before) {
      // Associação segura: mesmo código, mas EAN e nome diferentes → possível reaproveitamento de código.
      if (before.ean && rec.ean && before.ean !== rec.ean && !similarNames(before.name, rec.name)) {
        report.unidentified.push({
          row: rec.row,
          code: rec.code,
          name: rec.name,
          message: `Código já cadastrado para “${before.name}” (EAN ${before.ean}); na planilha o EAN é ${rec.ean} e o nome é diferente — mantido sem alteração para conferência`,
        });
        continue;
      }
      const controlled = present.has('controlled') ? rec.controlled : rec.controlled || (before.flags & FLAG_CONTROLLED) !== 0;
      const continuous = present.has('continuous') ? rec.continuous : (before.flags & FLAG_CONTINUOUS) !== 0;
      const after = {
        code: rec.code,
        name: rec.name,
        lab: rec.lab || before.lab,
        group: rec.group || before.group,
        formula: rec.formula || before.formula,
        stock: present.has('stock') ? rec.stock : before.stock,
        price: rec.price ?? before.price,
        promo: rec.price === null ? before.promo : rec.promo,
        pmc: rec.pmc > 0 ? rec.pmc : before.pmc,
        ean: rec.ean || before.ean,
        ms: rec.ms || before.ms,
        curve: rec.curve || before.curve,
        flags: (controlled ? FLAG_CONTROLLED : 0) | (continuous ? FLAG_CONTINUOUS : 0) | (rec.active ? 0 : FLAG_INACTIVE),
      };
      const changes = [];
      for (const [key, label] of TRACKED) {
        if (before[key] !== after[key]) {
          changes.push(label);
          report.fieldChanges[label] = (report.fieldChanges[label] || 0) + 1;
        }
      }
      if (before.price !== after.price) report.priceChanges.push({ code: rec.code, name: after.name, oldPrice: before.price, newPrice: after.price });
      if (before.promo !== after.promo) report.promoChanges.push({ code: rec.code, name: after.name, oldPromo: before.promo, newPromo: after.promo });
      if (!rec.active && (before.flags & FLAG_INACTIVE) === 0) report.deactivated.push({ code: rec.code, name: after.name });
      if (changes.length) report.updated.push({ code: rec.code, name: after.name, changes });
      else report.unchanged++;
      current.set(rec.code, after);
      continue;
    }

    // Produto novo
    if (!rec.active) {
      report.skippedInactiveNew++;
      continue;
    }
    if (rec.internal) {
      report.skippedInternal++;
      continue;
    }
    if (!includeOutOfStock && rec.stock <= 0) {
      report.skippedOutOfStockNew++;
      continue;
    }
    const sameEan = rec.ean ? eanIndex.get(rec.ean) : undefined;
    if (sameEan && sameEan.code !== rec.code) {
      if (similarNames(sameEan.name, rec.name)) {
        report.unidentified.push({
          row: rec.row,
          code: rec.code,
          name: rec.name,
          message: `Mesmo código de barras (${rec.ean}) do produto ${sameEan.code} “${sameEan.name}” — não cadastrado para evitar duplicidade`,
        });
        continue;
      }
      report.alerts.push({
        row: rec.row,
        code: rec.code,
        name: rec.name,
        message: `Código de barras ${rec.ean} também usado por ${sameEan.code} “${sameEan.name}” (nome diferente) — cadastrado; conferir no sistema`,
      });
    }
    const created = {
      code: rec.code,
      name: rec.name,
      lab: rec.lab,
      group: rec.group || 'OUTROS',
      formula: rec.formula,
      stock: rec.stock,
      price: rec.price,
      promo: rec.promo,
      pmc: rec.pmc,
      ean: rec.ean,
      ms: rec.ms,
      curve: rec.curve,
      flags: (rec.controlled ? FLAG_CONTROLLED : 0) | (rec.continuous ? FLAG_CONTINUOUS : 0),
    };
    current.set(rec.code, created);
    if (rec.ean && !eanIndex.has(rec.ean)) eanIndex.set(rec.ean, created);
    report.added.push({ code: rec.code, name: rec.name, price: rec.price, stock: rec.stock });
  }

  for (const code of existingCodes) {
    if (!touched.has(code) && current.has(code)) report.kept.push({ code, name: current.get(code).name });
  }

  // Monta o arquivo final
  const groups = [];
  const gIndex = new Map();
  const items = [];
  for (const rec of current.values()) {
    let gi = gIndex.get(rec.group);
    if (gi === undefined) {
      gi = groups.length;
      groups.push(rec.group);
      gIndex.set(rec.group, gi);
    }
    items.push([rec.code, rec.name, rec.lab, gi, rec.formula, rec.stock, rec.price, rec.promo, rec.pmc, rec.ean, rec.ms, rec.curve, rec.flags]);
  }
  items.sort((a, b) => Number(sellable(b)) - Number(sellable(a)) || a[1].localeCompare(b[1], 'pt-BR'));
  report.catalogAfter = items.length;
  report.priceChanges.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  report.added.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const file = {
    version: CATALOG_VERSION,
    generatedAt: report.generatedAt,
    source: sourceName,
    sample: false,
    fields: CATALOG_FIELDS,
    groups,
    stats: {
      totalRows: sheet.analyzed,
      active: sheet.active,
      inactive: sheet.inactive,
      inStock: sheet.inStock,
      activeInStock: sheet.activeInStock,
      exported: items.length,
      promos: items.filter((it) => it[7] > 0 && sellable(it)).length,
      controlled: items.filter((it) => (it[12] & FLAG_CONTROLLED) !== 0).length,
      skippedNoPrice: report.errors.filter((e) => /pre[cç]o/i.test(e.message)).length,
      skippedOutOfStock: report.skippedOutOfStockNew,
      groups: groups.length,
    },
    items,
  };
  return { file, report };
}

/** Cria um catálogo do zero a partir das linhas (sem catálogo anterior). */
export function buildCatalogFromRows(rows, options = {}) {
  const { file } = updateCatalog(null, rows, options);
  file.sample = !!options.sample;
  return file;
}

/** Contagem de itens por grupo do ERP (ordem decrescente). */
export function summarizeGroups(catalog) {
  const counts = new Map();
  for (const it of catalog.items) counts.set(it[3], (counts.get(it[3]) || 0) + 1);
  return [...counts.entries()]
    .map(([gi, count]) => ({ group: catalog.groups[gi] ?? 'OUTROS', count }))
    .sort((a, b) => b.count - a.count);
}

/* ============================================================ 5. RELATÓRIO */

export function reportSummaryRows(r) {
  return [
    ['Produtos analisados na planilha', r.analyzed],
    ['Produtos válidos (código, nome e preço)', r.validRows],
    ['Produtos atualizados', r.updated.length],
    ['Preços alterados', r.priceChanges.length],
    ['Produtos sem nenhuma alteração', r.unchanged],
    ['Produtos novos cadastrados', r.added.length],
    ['Mantidos sem alteração (não constam na planilha)', r.kept.length],
    ['Desativados no sistema (mantidos como indisponíveis)', r.deactivated.length],
    ['Não identificados com segurança', r.unidentified.length],
    ['Com informações incompletas', r.incomplete.length],
    ['Códigos duplicados na planilha', r.duplicates.length],
    ['Erros durante a importação', r.errors.length],
    ['Alertas', r.alerts.length],
    ['Itens ilustrativos removidos', r.demoRemoved.length],
    ['Total no catálogo após a atualização', r.catalogAfter],
  ];
}

const brl = (v) =>
  v === null || v === undefined
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
const md = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const intBR = (n) => Number(n).toLocaleString('pt-BR');

function table(headers, rows) {
  if (!rows.length) return '_Nenhum._\n';
  return [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(md).join(' | ')} |`)].join('\n') + '\n';
}

/** Relatório final em Markdown (pt-BR). */
export function renderReportMarkdown(r) {
  const when = new Date(r.generatedAt).toLocaleString('pt-BR');
  const out = [];
  out.push('# Relatório de atualização do catálogo — Farmácia São Marcos', '');
  out.push(`- **Planilha:** ${r.source || '—'}`);
  out.push(`- **Gerado em:** ${when}`);
  out.push(`- **Modo:** ${r.mode}`);
  out.push(`- **Cabeçalho encontrado na linha:** ${r.headerRow}`);
  out.push(`- **Preço utilizado:** coluna "Preço Venda" (promoção somente quando a coluna "Preço Promoção" comprova)`);
  if (r.missingColumns.length) out.push(`- ⚠️ **Colunas não encontradas:** ${r.missingColumns.join(', ')}`);
  out.push('', '## Resumo', '', table(['Indicador', 'Quantidade'], reportSummaryRows(r).map(([l, v]) => [l, intBR(v)])));
  out.push(
    `Linhas ativas: ${intBR(r.activeRows)} · inativas: ${intBR(r.inactiveRows)} · ativas com estoque: ${intBR(r.activeInStockRows)} · novos inativos ignorados: ${intBR(r.skippedInactiveNew)}` +
      (r.skippedInternal ? ` · uso interno ignorados: ${intBR(r.skippedInternal)}` : '') +
      (r.skippedOutOfStockNew ? ` · novos sem estoque ignorados: ${intBR(r.skippedOutOfStockNew)}` : ''),
    '',
  );
  const fields = Object.entries(r.fieldChanges).sort((a, b) => b[1] - a[1]);
  if (fields.length) out.push('**Campos atualizados:** ' + fields.map(([k, v]) => `${k} (${intBR(v)})`).join(' · '), '');

  out.push(`## Preços alterados (${intBR(r.priceChanges.length)})`, '');
  out.push(
    table(
      ['Código', 'Produto', 'Preço anterior', 'Novo preço', 'Variação'],
      r.priceChanges.map((p) => [p.code, p.name, brl(p.oldPrice), brl(p.newPrice), p.oldPrice ? `${p.newPrice >= p.oldPrice ? '+' : ''}${(((p.newPrice - p.oldPrice) / p.oldPrice) * 100).toFixed(1).replace('.', ',')}%` : '—']),
    ),
  );
  if (r.promoChanges.length) {
    out.push(`## Promoções alteradas (${intBR(r.promoChanges.length)})`, '');
    out.push(table(['Código', 'Produto', 'Promoção anterior', 'Promoção atual'], r.promoChanges.map((p) => [p.code, p.name, p.oldPromo ? brl(p.oldPromo) : 'sem promoção', p.newPromo ? brl(p.newPromo) : 'sem promoção'])));
  }
  out.push(`## Produtos novos cadastrados (${intBR(r.added.length)})`, '');
  out.push(table(['Código', 'Produto', 'Preço Venda', 'Estoque'], r.added.map((p) => [p.code, p.name, brl(p.price), intBR(p.stock)])));
  out.push(`## Produtos atualizados (${intBR(r.updated.length)})`, '');
  out.push(table(['Código', 'Produto', 'Campos alterados'], r.updated.map((p) => [p.code, p.name, p.changes.join(', ')])));
  out.push(`## Produtos que não puderam ser identificados (${intBR(r.unidentified.length)})`, '');
  out.push(table(['Linha', 'Código', 'Produto', 'Motivo'], r.unidentified.map((e) => [e.row, e.code || '—', e.name || '—', e.message])));
  out.push(`## Códigos duplicados na planilha (${intBR(r.duplicates.length)})`, '');
  out.push(table(['Código', 'Produto', 'Linhas', 'Preços', 'Resolução'], r.duplicates.map((d) => [d.code, d.name, d.rows.join(', '), d.prices.map(brl).join(' / '), d.resolution])));
  out.push(`## Produtos com informações incompletas (${intBR(r.incomplete.length)})`, '');
  const byField = {};
  for (const i of r.incomplete) for (const f of i.missing) byField[f] = (byField[f] || 0) + 1;
  if (Object.keys(byField).length) out.push('Campos ausentes: ' + Object.entries(byField).map(([k, v]) => `${k} (${intBR(v)})`).join(' · ') + ' — os produtos foram importados normalmente.', '');
  out.push(table(['Linha', 'Código', 'Produto', 'Falta'], r.incomplete.slice(0, 500).map((i) => [i.row, i.code, i.name, i.missing.join(', ')])));
  if (r.incomplete.length > 500) out.push(`_… e mais ${intBR(r.incomplete.length - 500)} (lista completa no relatório .json)._`, '');
  out.push(`## Erros durante a importação (${intBR(r.errors.length)})`, '');
  out.push(table(['Linha', 'Código', 'Produto', 'Erro'], r.errors.map((e) => [e.row, e.code || '—', e.name || '—', e.message])));
  out.push(`## Alertas (${intBR(r.alerts.length)})`, '');
  out.push(table(['Linha', 'Código', 'Produto', 'Alerta'], r.alerts.map((e) => [e.row || '—', e.code || '—', e.name || '—', e.message])));
  out.push(`## Desativados no sistema — mantidos como indisponíveis (${intBR(r.deactivated.length)})`, '');
  out.push(table(['Código', 'Produto'], r.deactivated.map((p) => [p.code, p.name])));
  out.push(`## Mantidos sem alteração — não constam na planilha (${intBR(r.kept.length)})`, '');
  out.push(table(['Código', 'Produto'], r.kept.map((p) => [p.code, p.name])));
  if (r.demoRemoved.length) {
    out.push(`## Itens ilustrativos removidos (${intBR(r.demoRemoved.length)})`, '');
    out.push('Itens de demonstração criados apenas para o protótipo (preços fictícios, não pertencem à farmácia). Nenhum produto real foi excluído.', '');
    out.push(table(['Código', 'Produto'], r.demoRemoved.map((p) => [p.code, p.name])));
  }
  return out.join('\n');
}
