import { ChevronDown, MessageCircle, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BRAND } from '../config/store';
import { CATEGORIES, CATEGORY_BY_ID, type Product } from '../lib/catalog';
import { intBR } from '../lib/format';
import { notFoundMessage, waUrl } from '../lib/whatsapp';
import { useCatalog, useUI, type SortKey } from '../state/store';
import { CATEGORY_ICONS } from './CategoryGrid';
import { ProductCard } from './ProductCard';

const PAGE = 24;

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'relevancia', label: 'Mais relevantes' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'desconto', label: 'Maior desconto' },
  { value: 'az', label: 'Nome (A–Z)' },
];

const sorter = (key: SortKey) => (a: Product, b: Product) => {
  const stock = Number(b.inStock) - Number(a.inStock);
  if (stock) return stock;
  if (key === 'menor-preco') return a.price - b.price;
  if (key === 'maior-preco') return b.price - a.price;
  if (key === 'desconto') return b.discount - a.discount;
  return a.name.localeCompare(b.name, 'pt-BR');
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-semibold ring-1 transition ${
        checked ? 'bg-secondary-50 text-secondary-800 ring-secondary-300' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-secondary-700' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

export function Catalog() {
  const { search, showcase } = useCatalog();
  const ui = useUI();
  const [page, setPage] = useState(1);
  const term = ui.searchTerm.trim();

  const base = useMemo(() => (term ? search.search(term) : null), [term, search]);

  const list = useMemo(() => {
    const source = base ? base.items : showcase;
    const filtered = source.filter(
      (p) =>
        (ui.category === 'todos' || p.category === ui.category) &&
        (!ui.onlyPromo || p.promo > 0) &&
        (term !== '' || ui.showUnavailable || p.inStock),
    );
    return ui.sort === 'relevancia' ? filtered : [...filtered].sort(sorter(ui.sort));
  }, [base, showcase, ui.category, ui.onlyPromo, ui.showUnavailable, ui.sort, term]);

  const categoryCounts = useMemo(() => {
    const source = base ? base.items : showcase.filter((p) => ui.showUnavailable || p.inStock);
    const map = new Map<string, number>();
    for (const p of source) if (!ui.onlyPromo || p.promo > 0) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, [base, showcase, ui.onlyPromo, ui.showUnavailable]);

  useEffect(() => setPage(1), [term, ui.category, ui.onlyPromo, ui.showUnavailable, ui.sort]);

  const visible = list.slice(0, page * PAGE);
  const remaining = list.length - visible.length;
  const unavailableInResults = term ? list.filter((p) => !p.inStock).length : 0;
  const totalAll = base ? base.items.length : showcase.filter((p) => ui.showUnavailable || p.inStock).length;

  const title = base?.care ? `Mostrando opções para: ${base.care.label}` : term
    ? `Resultados para “${term}”`
    : ui.onlyPromo
      ? 'Ofertas da semana'
      : ui.category === 'todos'
        ? 'Vitrine de produtos'
        : CATEGORY_BY_ID[ui.category].label;

  return (
    <section id="produtos" aria-labelledby="catalog-title" className="relative scroll-mt-44 py-12 md:scroll-mt-32 md:py-16">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary-50/50 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">{base?.care ? 'Busca por sintoma ou cuidado' : term ? 'Busca inteligente' : 'Catálogo completo'}</p>
            <h2 id="catalog-title" aria-live="polite" className="mt-1 break-words text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
            <p className="mt-2 text-base text-slate-600" aria-live="polite">
              {intBR(list.length)} {list.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
              {unavailableInResults > 0 && ` · ${intBR(unavailableInResults)} sem estoque (peça pelo WhatsApp)`}
            </p>
            {base?.care && !base.care.topics.every(t => t === 'care') && (
              <p className="mt-2 max-w-2xl text-base text-slate-600">
                Esta lista não é uma indicação de tratamento.{' '}
                {base.care.topics.some(t => t === 'pressure' || t === 'ongoing')
                  ? 'Para medicamentos de uso contínuo, siga sua receita.'
                  : 'Em caso de dúvida, fale com o farmacêutico.'}
              </p>
            )}
          </div>
          {(term || ui.onlyPromo || ui.category !== 'todos') && (
            <button
              type="button"
              onClick={() => {
                ui.clearSearch();
                ui.setOnlyPromo(false);
                ui.selectCategory('todos');
              }}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-secondary-700 ring-1 ring-secondary-200 hover:bg-secondary-50"
            >
              <X className="h-5 w-5" /> Limpar busca e filtros
            </button>
          )}
        </div>

        {base?.approximate && list.length > 0 && (
          <p className="mt-4 rounded-2xl bg-primary-50 px-4 py-3 text-base font-medium text-primary-900 ring-1 ring-primary-200">
            Não achamos exatamente “{term}”. Mostrando os resultados mais parecidos.
          </p>
        )}

        <div className="no-scrollbar mt-6 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain p-1 sm:flex-wrap">
          <button
            type="button"
            onClick={() => ui.selectCategory('todos')}
            className={`min-h-12 shrink-0 rounded-2xl px-4 text-base font-bold transition ${
              ui.category === 'todos' ? 'bg-secondary-800 text-white shadow-md' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos <span className="opacity-70">({intBR(totalAll)})</span>
          </button>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c.id];
            const n = categoryCounts.get(c.id) ?? 0;
            const active = ui.category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => ui.selectCategory(c.id)}
                disabled={!n && !active}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl px-4 text-base font-bold transition disabled:opacity-40 ${
                  active ? 'bg-secondary-800 text-white shadow-md' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-primary-300' : 'text-primary-600'}`} />
                {c.label} <span className="opacity-70">({intBR(n)})</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Toggle checked={ui.onlyPromo} onChange={ui.setOnlyPromo} label="Só ofertas" />
          {!term && <Toggle checked={ui.showUnavailable} onChange={ui.setShowUnavailable} label="Mostrar indisponíveis" />}
          <label className="relative ml-auto inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white pl-4 text-base font-semibold text-slate-700 ring-1 ring-slate-200">
            <SlidersHorizontal className="h-5 w-5 text-secondary-600" />
            <span className="sr-only">Ordenar por</span>
            <select
              value={ui.sort}
              onChange={(e) => ui.setSort(e.target.value as SortKey)}
              className="h-12 appearance-none rounded-2xl bg-transparent pl-1 pr-10 font-semibold outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-5 w-5 text-slate-500" />
          </label>
        </div>

        {list.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-[2rem] bg-white px-6 py-10 text-center shadow-sm ring-1 ring-slate-200">
            <img src={BRAND.mascot} alt="" referrerPolicy="no-referrer" className="h-44 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <SearchX className="mt-2 h-9 w-9 text-slate-400" />
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{base?.care ? 'Nenhum produto encontrado para este cuidado' : term ? `Não encontramos “${term}”` : 'Nenhum produto com esses filtros'}</p>
            <p className="mt-2 max-w-md text-lg text-slate-600">
              {term ? 'Tente outro nome, o princípio ativo, ou peça diretamente para a nossa equipe.' : 'Experimente remover alguns filtros.'}
            </p>
            {term && (
              <a
                href={waUrl(notFoundMessage(term))}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-green-600 px-6 text-lg font-bold text-white hover:bg-green-700"
              >
                <MessageCircle className="h-6 w-6" /> Pedir “{term}” pelo WhatsApp
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} highlight={term} />
              ))}
            </div>
            {remaining > 0 && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setPage((n) => n + 1)}
                  className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-secondary-700 px-8 text-lg font-bold text-white shadow-lg shadow-secondary-700/25 hover:bg-secondary-800"
                >
                  Mostrar mais produtos <span className="font-medium text-white/80">({intBR(remaining)} restantes)</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
