import type { Product } from './catalog';

type Topic = 'pain' | 'fever' | 'cold' | 'cough' | 'stomach' | 'heartburn' | 'pressure' | 'monitor' | 'ongoing' | 'care';

export const CARE_GROUPS = [
  { id: 'pain-fever', label: 'Dor e Febre', topics: ['pain', 'fever'] },
  { id: 'cold-cough', label: 'Gripe e Tosse', topics: ['cold', 'cough'] },
  { id: 'digestion', label: 'Estômago e Azia', topics: ['stomach', 'heartburn'] },
  { id: 'pressure-ongoing', label: 'Pressão e Uso Contínuo', topics: ['pressure', 'monitor', 'ongoing'] },
  { id: 'diapers', label: 'Fraldas e Cuidados', topics: ['care'] },
] as const satisfies ReadonlyArray<{ id: string; label: string; topics: readonly Topic[] }>;

export interface CareIntent {
  label: string;
  topics: readonly Topic[];
}

const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const phrases: { pattern: RegExp; label: string; topics: Topic[] }[] = [
  { pattern: /\b(?:dor|dores) (?:de|na) cabeca\b/g, label: 'Dor de cabeça', topics: ['pain'] },
  { pattern: /\b(?:dor|dores) (?:(?:no|pelo|em todo o) corpo(?: inteiro)?|musculares?)\b/g, label: 'Dor no corpo', topics: ['pain'] },
  { pattern: /\b(?:febre|febril)\b/g, label: 'Febre', topics: ['fever'] },
  { pattern: /\b(?:gripe|gripado|gripada|resfriado|resfriada)\b/g, label: 'Gripe', topics: ['cold'] },
  { pattern: /\b(?:tosse(?: seca| com catarro)?|tossindo)\b/g, label: 'Tosse', topics: ['cough'] },
  { pattern: /\b(?:azia|queimacao(?: no estomago)?|refluxo)\b/g, label: 'Azia', topics: ['heartburn'] },
  { pattern: /\b(?:dor|dores) (?:de|no) estomago\b/g, label: 'Dor de estômago', topics: ['stomach', 'heartburn'] },
  { pattern: /\bpressao(?: arterial)? (?:(?:esta|ta|ficou) )?(?:baixa|caiu|subiu|alta)\b/g, label: 'Medição da pressão', topics: ['monitor'] },
  { pattern: /\b(?:pressao(?: arterial)?|hipertensao)\b/g, label: 'Pressão', topics: ['monitor', 'pressure'] },
  { pattern: /\buso continuo\b/g, label: 'Uso contínuo', topics: ['ongoing'] },
  { pattern: /\bfraldas?\b/g, label: 'Fraldas e cuidados', topics: ['care'] },
];
const filler = /\b(?:eu|to|tou|estou|estamos|sinto|sentindo|tenho|minha|meu|preciso|gostaria|quero|queria|algo|alguma|coisa|algum|o|a|os|as|um|uma|com|e|de|da|do|para|pra|pro|por|favor|buscar|busque|pesquisar|procurar|ver|me|mostre|mostra|tem|voces|muita|muito|bastante|pouco|agora|hoje|aqui|ai|desde|ontem|remedios?|medicamentos?|produtos?|opcoes|contra|aliviar|tratar|sintomas?|ola|oi)\b/g;

export function identifyCare(query: string): CareIntent | null {
  let rest = plain(query);
  const group = CARE_GROUPS.find(g => plain(g.label) === rest);
  if (group) return { label: group.label, topics: group.topics };
  if (/\b(?:sem|nao)\b/.test(rest)) return null;
  const topics = new Set<Topic>();
  const labels: string[] = [];
  for (const rule of phrases) {
    const next = rest.replace(rule.pattern, ' ');
    if (next === rest) continue;
    rest = next;
    labels.push(rule.label);
    rule.topics.forEach(t => topics.add(t));
  }
  // A named product or dosage must not be replaced by a broad symptom category.
  if (!topics.size || rest.replace(filler, '').trim()) return null;
  return { label: labels.map((s, i) => i ? s.toLowerCase() : s).join(' e '), topics: [...topics] };
}

function productTopics(p: Product): Set<Topic> {
  const topics = new Set<Topic>();
  if (p.controlled) return topics;
  const name = plain(p.rawName);
  const group = plain(p.group);
  const formula = plain(p.formula);
  identifyCare(group)?.topics.forEach(topic => topics.add(topic));
  const clinicalGroup = /analgesic|antitermic|antipiretic|antigrip|antituss|expectorant|mucolitic|antiacid|antiulcer|digestiv|antiflatulent|anti ?hipertens|uso continuo/.test(group);
  const medicine = p.category === 'medicamentos' || p.category === 'genericos' || clinicalGroup;
  const singleIngredient = !/[+;]/.test(p.formula);
  if (medicine) {
    if (/analgesic/.test(group) || (singleIngredient && /\b(?:dipirona|paracetamol|ibuprofeno)\b/.test(formula || name)) || /^(?:dorflex|neosaldina)\b/.test(name)) topics.add('pain');
    if (/antitermic|antipiretic/.test(group) || (singleIngredient && /\b(?:dipirona|paracetamol|ibuprofeno)\b/.test(formula || name))) topics.add('fever');
    if (/antigrip/.test(group) || /\b(?:benegrip|cimegripe|antigripal|resfenol|vaporub)\b/.test(name)) topics.add('cold');
    if (/antituss|expectorant|mucolitic/.test(group) || /\b(?:ambroxol|bromexina|guaifenesina|levodropropizina)\b/.test(formula) || /\b(?:tosse|antitussivo|expectorante)\b|^xarope vick mel\b/.test(name)) topics.add('cough');
    if (/antiacid|antiulcer|inibidor.*proton/.test(group) || /\b(?:omeprazol|pantoprazol|esomeprazol|hidroxido de aluminio|alginato de sodio)\b/.test(formula || name) || /^(?:eno|gaviscon|antiacido)\b/.test(name)) topics.add('heartburn');
    if (topics.has('heartburn') || /antiflatulent|digestiv/.test(group) || /\bsimeticona\b/.test(formula || name)) topics.add('stomach');
    if (/anti ?hipertens/.test(group) || /\b(?:losartana|anlodipino|amlodipino|enalapril|atenolol|hidroclorotiazida|metoprolol|captopril|valsartana)\b/.test(formula || name)) topics.add('pressure');
    if (p.continuous || /uso continuo/.test(group)) topics.add('ongoing');
  }
  if (/\btermometro\b/.test(name)) topics.add('fever');
  if (/\b(?:medidor|aparelho|monitor)(?: de)? pressao\b|\besfigmomanometro\b/.test(name)) topics.add('monitor');
  if (/fraldas|incontinencia/.test(group) || /\b(?:fraldas?|bigfral|plenitud|lencos? umedecidos?|hipoglos|assaduras?)\b/.test(name)) topics.add('care');
  return topics;
}

export class CareIndex {
  private readonly entries: { product: Product; topics: Set<Topic> }[];

  constructor(products: Product[]) {
    this.entries = products.map(product => ({ product, topics: productTopics(product) }));
  }

  find(intent: CareIntent): Product[] {
    return this.entries.filter(e => intent.topics.some(t => e.topics.has(t))).map(e => e.product)
      .sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.name.localeCompare(b.name, 'pt-BR'));
  }
}