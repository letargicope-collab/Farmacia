import { ArrowRight, Flame } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CAMPANHA, campaignEndLabel } from '../config/campanha';
import { BRAND } from '../config/store';
import { useCatalog, useUI } from '../state/store';
import { ProductCard } from './ProductCard';

/**
 * Vitrine de ofertas.
 *  • Campanha ativa (src/config/campanha.ts) → BLACK FRIDAY · ATÉ X% OFF
 *  • Sem campanha → promoções comprovadas pela coluna "Preço Promoção"
 * O percentual do título é sempre o maior desconto realmente aplicado.
 */
export function Offers() {
  const { products, maxDiscount, campaignCount, campaignMax } = useCatalog();
  const ui = useUI();
  const [failed, setFailed] = useState<string | null>(null);
  const blackFriday = campaignCount > 0;
  const top = blackFriday ? campaignMax : maxDiscount;
  const mascot = blackFriday ? BRAND.mascotBlack : BRAND.mascot;

  const offers = useMemo(
    () =>
      products
        .filter((p) => p.promo > 0 && p.inStock && !p.controlled)
        .sort((a, b) => Number(b.campaign) - Number(a.campaign) || b.discount - a.discount)
        .slice(0, 8),
    [products],
  );

  if (!offers.length) return null;

  return (
    <section id="ofertas" className="scroll-mt-44 py-10 md:scroll-mt-32 md:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(248,131,43,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(58,58,146,0.55),transparent_60%)]" />
          <div className="cross-pattern-light absolute inset-0 opacity-[0.07]" aria-hidden="true" />
          <div className="relative grid items-center gap-6 p-6 sm:p-10 md:grid-cols-[1fr_auto]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-500/15 px-3 py-1.5 text-sm font-bold text-primary-300 ring-1 ring-primary-400/30">
                <Flame className="h-4 w-4" /> {blackFriday ? CAMPANHA.chamada : 'Ofertas da semana'}
              </span>
              <h2 className="mt-4 text-[clamp(2rem,10.5vw,3.75rem)] font-black leading-[0.95] tracking-tight text-white">
                {blackFriday ? CAMPANHA.selo : 'OFERTAS'}
                <span className="block text-primary-500">{blackFriday ? `ATÉ ${top}% OFF` : 'SÃO MARCOS'}</span>
              </h2>
              <p className="mt-4 max-w-lg text-lg text-slate-300">
                {blackFriday ? 'Produtos selecionados com ' : 'Até '}
                <strong className="text-white">{blackFriday ? `até ${top}% de desconto` : `${top}% de desconto`}</strong>{' '}
                {blackFriday ? `${CAMPANHA.descricao}.` : 'em produtos selecionados.'}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {blackFriday ? `Ofertas válidas até ${campaignEndLabel()} ou enquanto durarem os estoques.` : 'Ofertas válidas enquanto durarem os estoques.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  ui.setOnlyPromo(true);
                  ui.selectCategory('todos', true);
                }}
                className="btn-shine mt-6 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary-600 px-6 text-lg font-bold text-white shadow-lg shadow-primary-600/40 hover:bg-primary-500"
              >
                Ver todas as ofertas <ArrowRight className="h-5 w-5" />
              </button>
            </div>
            {failed !== mascot && (
              <div className="relative mx-auto hidden h-72 w-52 overflow-hidden rounded-[1.75rem] bg-white shadow-2xl ring-4 ring-primary-500/40 sm:block md:h-80 md:w-60">
                <img
                  src={mascot}
                  alt={blackFriday ? 'Mascote Marcos com a camisa Esquenta Black São Marcos' : 'Mascote Marcos da Farmácia São Marcos'}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={() => setFailed(mascot)}
                  className={`h-full w-full object-contain ${blackFriday ? 'p-2' : 'object-bottom px-2 pt-4'}`}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {offers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
