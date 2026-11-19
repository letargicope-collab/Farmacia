import { motion } from 'framer-motion';
import { Baby, ChevronRight, Droplets, HeartPulse, Leaf, Pill, ShoppingBasket, Sparkles, Tablets, type LucideIcon } from 'lucide-react';
import { CATEGORIES, type CategoryId } from '../lib/catalog';
import { intBR } from '../lib/format';
import { useCatalog, useUI } from '../state/store';

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  medicamentos: Pill,
  genericos: Tablets,
  vitaminas: Leaf,
  beleza: Sparkles,
  higiene: Droplets,
  infantil: Baby,
  saude: HeartPulse,
  conveniencia: ShoppingBasket,
};

export function CategoryGrid() {
  const { counts } = useCatalog();
  const ui = useUI();

  return (
    <section id="categorias" className="scroll-mt-44 py-12 md:scroll-mt-32 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Navegue por categorias</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              O que você <span className="text-gradient-brand">precisa hoje?</span>
            </h2>
          </div>
          <p className="max-w-md text-base text-slate-600">Toque em uma categoria para ver os produtos disponíveis.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {CATEGORIES.map((c, i) => {
            const Icon = CATEGORY_ICONS[c.id];
            const active = ui.category === c.id;
            const orange = c.tone === 'orange';
            return (
              <motion.button
                key={c.id}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ y: -5 }}
                onClick={() => ui.selectCategory(c.id, true)}
                aria-pressed={active}
                className={`group relative overflow-hidden rounded-3xl p-4 text-left transition sm:p-5 ${
                  active ? 'bg-secondary-800 text-white shadow-xl' : 'glass-card hover:shadow-xl'
                }`}
              >
                <span
                  className={`icon-3d grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg transition group-hover:scale-110 sm:h-16 sm:w-16 ${
                    orange ? 'bg-gradient-to-br from-primary-400 to-primary-700' : 'bg-gradient-to-br from-secondary-500 to-secondary-800'
                  }`}
                >
                  <Icon className="h-7 w-7 drop-shadow sm:h-8 sm:w-8" />
                </span>
                <span className={`mt-3 block text-base font-extrabold leading-tight sm:text-lg ${active ? 'text-white' : 'text-slate-900'}`}>
                  {c.label}
                </span>
                <span className={`mt-0.5 block text-sm ${active ? 'text-white/80' : 'text-slate-600'}`}>{c.description}</span>
                <span className={`mt-2 inline-flex items-center gap-1 text-sm font-bold ${active ? 'text-primary-200' : 'text-primary-700'}`}>
                  {intBR(counts[c.id])} {counts[c.id] === 1 ? 'produto' : 'produtos'} <ChevronRight className="h-4 w-4" />
                </span>
                <span
                  className={`pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full blur-2xl transition group-hover:opacity-80 ${
                    orange ? 'bg-primary-300/40' : 'bg-secondary-300/40'
                  }`}
                  aria-hidden="true"
                />
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
