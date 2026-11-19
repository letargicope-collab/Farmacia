import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { SearchEngine } = await vite.ssrLoadModule('/src/lib/search.ts');
  const { hydrateCatalog } = await vite.ssrLoadModule('/src/lib/catalog.ts');
  const { CARE_GROUPS, identifyCare, CareIndex } = await vite.ssrLoadModule('/src/lib/care-search.ts');
  const { documentMessage } = await vite.ssrLoadModule('/src/lib/health-documents.ts');
  const { getStoreStatus } = await vite.ssrLoadModule('/src/lib/hours.ts');
  const file = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
  const products = hydrateCatalog(file);
  const engine = new SearchEngine(products);
  const index = new CareIndex(products);

  for (const phrase of ['dor de cabeça', 'dor no corpo', 'febre', 'gripe', 'tosse', 'azia', 'dor de estômago', 'pressão', ...CARE_GROUPS.map(g => g.label)]) {
    const result = engine.search(phrase);
    assert.ok(result.care, phrase);
    assert.deepEqual(result.items.map(p => p.code), index.find(identifyCare(phrase)).map(p => p.code));
    assert.ok(result.items.every(p => !p.controlled));
  }
  for (const phrase of ['medidor de pressão', 'meia de compressão', 'dipirona 500 mg', 'paracetamol gotas', 'sem febre']) {
    assert.equal(identifyCare(phrase), null, phrase);
  }
  assert.equal(identifyCare('Estou com dor de cabeça').label, 'Dor de cabeça');
  assert.deepEqual(identifyCare('Minha pressão está baixa').topics, ['monitor']);
  assert.equal(identifyCare('febre e tosse').label, 'Febre e tosse');
  assert.equal(new CareIndex([]).find(identifyCare('azia')).length, 0);
  assert.deepEqual(new CareIndex([{ rawName: 'ITEM DE TESTE', name: 'Teste', formula: '', category: 'conveniencia', group: 'DOR E FEBRE', code: 'A' }]).find(identifyCare('dor de cabeça')).map(p => p.code), ['A']);

  assert.equal(documentMessage('prescription'), 'Olá! Gostaria de fazer um pedido com esta receita médica.');
  assert.equal(documentMessage('vaccine'), 'Olá! Estou enviando a foto da minha receita / cartão de vacina para atendimento.');
  assert.match(documentMessage('insurance'), /convênio/);
  assert.match(getStoreStatus(new Date('2026-11-19T03:00:00Z')).delivery, /hoje às 8h/);
  assert.match(getStoreStatus(new Date('2026-11-22T17:00:00Z')).delivery, /hoje às 17h/);
  assert.equal(getStoreStatus(new Date('2026-11-19T14:00:00Z')).open, true);
  console.log('Atalhos, sintomas, mensagens e horários: verificações concluídas.');
} finally { await vite.close(); }