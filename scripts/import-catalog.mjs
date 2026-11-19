#!/usr/bin/env node
/**
 * ============================================================================
 *  ATUALIZAÇÃO DO CATÁLOGO (ERP → LOJA VIRTUAL) — Farmácia São Marcos
 * ----------------------------------------------------------------------------
 *  Lê o relatório "MANUTENÇÃO DE PRODUTOS" (.xlsx, .xls ou .csv) e ATUALIZA
 *  src/data/catalog.json com segurança:
 *    • associa pelo Código do produto (conferindo o código de barras)
 *    • atualiza os existentes, cadastra os novos, evita duplicados
 *    • NÃO exclui produtos existentes (os que não constam são mantidos)
 *    • preço = coluna "Preço Venda" (centavos preservados)
 *    • gera relatório completo em ./relatorios (Markdown + JSON)
 *    • faz backup do catálogo anterior antes de gravar
 *
 *  Uso:
 *    node scripts/import-catalog.mjs "MANUTENÇÃO DE PRODUTOS - 21-07-2026 112224.xlsx" --simular
 *    node scripts/import-catalog.mjs "MANUTENÇÃO DE PRODUTOS - 21-07-2026 112224.xlsx"
 *    node scripts/import-catalog.mjs          # usa a planilha mais recente da raiz ou de ./data
 *
 *  Opções:
 *    --simular           só lê, confere e gera o relatório (não altera o site)
 *    --somente-estoque   não cadastra produtos NOVOS sem estoque
 *    --substituir        ignora o catálogo atual (recria do zero — use com cuidado)
 *    --saida=arquivo     catálogo de saída (padrão: src/data/catalog.json)
 *    --relatorio=pasta   pasta dos relatórios (padrão: relatorios)
 *
 *  Depois rode:  npm run build
 * ============================================================================
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, basename, dirname, join, relative } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { formatLabel, readSpreadsheet, SPREADSHEET_EXTENSIONS } from '../src/lib/erp/sheet-reader.js';
import { renderReportMarkdown, reportSummaryRows, updateCatalog } from '../src/lib/erp/erp-catalog.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name) => flag(name)?.split('=').slice(1).join('=');
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
const rel = (p) => relative(process.cwd(), p) || p;

function findLatestSheet() {
  const found = [];
  for (const dir of [ROOT, join(ROOT, 'data')]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!SPREADSHEET_EXTENSIONS.test(f) || f.startsWith('~$') || /^readme/i.test(f)) continue;
      const full = join(dir, f);
      found.push({ full, sample: /^amostra|teste/i.test(f), erp: /manuten/i.test(f), mtime: statSync(full).mtimeMs });
    }
  }
  found.sort((a, b) => Number(a.sample) - Number(b.sample) || Number(b.erp) - Number(a.erp) || b.mtime - a.mtime);
  return found[0]?.full;
}

const input = args.find((a) => !a.startsWith('--')) ?? findLatestSheet();
if (!input || !existsSync(resolve(input))) {
  console.error('\n❌ Planilha não encontrada.');
  console.error('   Coloque o arquivo "MANUTENÇÃO DE PRODUTOS" (.xlsx, .xls ou .csv) na raiz do projeto (ou em ./data)');
  console.error('   ou informe o caminho:  node scripts/import-catalog.mjs "caminho/da/planilha.xlsx"\n');
  process.exit(1);
}

const file = resolve(input);
const output = resolve(ROOT, flagValue('saida') || 'src/data/catalog.json');
const reportDir = resolve(ROOT, flagValue('relatorio') || 'relatorios');
const dryRun = !!flag('simular');
const replace = !!flag('substituir');
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const t0 = Date.now();

console.log(`\n📥 Lendo a planilha completa: ${basename(file)}`);
let sheet;
try {
  sheet = await readSpreadsheet(new Uint8Array(readFileSync(file)), {
    fileName: basename(file),
    inflateRaw: (data) => inflateRawSync(data),
    onProgress: ({ stage, rows: n }) => {
      if (stage === 'rows' && n) process.stdout.write(`\r   ...${n.toLocaleString('pt-BR')} linhas lidas`);
    },
  });
} catch (err) {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}\n   Nada foi alterado.`);
  process.exit(1);
}
process.stdout.write('\n');
const { rows, sheetName, format } = sheet;

let previous = null;
if (!replace && existsSync(output)) {
  try {
    previous = JSON.parse(readFileSync(output, 'utf8'));
  } catch {
    console.error(`❌ Não foi possível ler o catálogo atual (${rel(output)}). Nada foi alterado.`);
    process.exit(1);
  }
}

let result;
try {
  result = updateCatalog(previous, rows, {
    sourceName: basename(file),
    includeOutOfStock: !flag('somente-estoque'),
    replace,
  });
} catch (err) {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}\n   Nada foi alterado.`);
  process.exit(1);
}
const { file: catalog, report } = result;
if (dryRun) report.mode = `SIMULAÇÃO — ${report.mode} (nenhum arquivo do site foi alterado)`;

mkdirSync(reportDir, { recursive: true });
if (!dryRun) {
  if (previous) writeFileSync(join(reportDir, `backup-catalogo-${stamp}.json`), JSON.stringify(previous));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(catalog));
}
const mdPath = join(reportDir, `relatorio-${dryRun ? 'simulacao-' : ''}${stamp}.md`);
const jsonPath = join(reportDir, `relatorio-${dryRun ? 'simulacao-' : ''}${stamp}.json`);
writeFileSync(mdPath, renderReportMarkdown(report));
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

console.log(
  `\n${dryRun ? '🔎 SIMULAÇÃO concluída (site não alterado)' : '✅ Catálogo atualizado'} em ${((Date.now() - t0) / 1000).toFixed(1)}s — ${formatLabel(format)}, aba "${sheetName}", cabeçalho na linha ${report.headerRow}`,
);
if (report.missingColumns.length) console.log(`⚠️  Colunas não encontradas: ${report.missingColumns.join(', ')}`);
console.table(Object.fromEntries(reportSummaryRows(report).map(([label, value]) => [label, value.toLocaleString('pt-BR')])));
if (report.priceChanges.length) {
  console.log('Preços alterados (amostra):');
  for (const p of report.priceChanges.slice(0, 15)) console.log(`   ${p.code.padEnd(8)} ${p.name.slice(0, 44).padEnd(44)} ${brl(p.oldPrice)} → ${brl(p.newPrice)}`);
  if (report.priceChanges.length > 15) console.log(`   … e mais ${report.priceChanges.length - 15} (ver relatório)`);
}
console.log(`\n📄 Relatório: ${rel(mdPath)}\n📄 Dados completos: ${rel(jsonPath)}`);
if (!dryRun) console.log(`💾 Catálogo: ${rel(output)}${previous ? `  (backup do anterior em ${rel(reportDir)})` : ''}\n👉 Agora rode:  npm run build\n`);
else console.log('👉 Se estiver tudo certo, rode o mesmo comando sem --simular.\n');
