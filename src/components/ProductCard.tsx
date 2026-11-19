import { motion } from 'framer-motion';
import { BellRing, CircleCheck, Flame, Minus, Plus, ShoppingCart, Store } from 'lucide-react';
import { useState } from 'react';
import { CAMPANHA } from '../config/campanha';
import { CATEGORY_BY_ID, type Product } from '../lib/catalog';
import { brl } from '../lib/format';
import { normalizeText } from '../lib/search';
import { notifyStockMessage, waUrl } from '../lib/whatsapp';
import { useCart, useUI } from '../state/store';
import { ProductVisual } from './ProductVisual';
import { Highlight } from './ui/Overlay';

export const shortName = (name: string) => (name.length > 38 ? `${name.slice(0, 36).trimEnd()}…` : name);

/** Exibe o princípio ativo só quando ele acrescenta informação ao nome. */
export const showFormula = (p: Product) => {
  if (!p.formula) return false;
  const first = normalizeText(p.formula.split(/[\s+]/)[0] ?? '');
  return first.length > 2 && !normalizeText(p.name).includes(first);
};

export function useAddToCart() {
  const cart = useCart();
  const ui = useUI();
  return (p: Product, qty = 1) => {
    const r = cart.add(p, qty);
    if (r === 'added') {
      ui.toast(`${shortName(p.name)} foi para o carrinho`, { tone: 'success', actionLabel: 'Ver carrinho', onAction: () => ui.setCartOpen(true) });
    } else if (r === 'max') {
      ui.toast(`Temos só ${p.stock} ${p.stock === 1 ? 'unidade' : 'unidades'} deste item em estoque.`, { tone: 'warning' });
    }
    return r;
  };
}

export function ProductCard({ product: p, highlight = '' }: { product: Product; highlight?: string }) {
  const cart = useCart();
  const ui = useUI();
  const addToCart = useAddToCart();
  const qty = cart.qtyOf(p.id);
  const [justAdded, setJustAdded] = useState(false);

  const onAdd = () => {
    if (addToCart(p) === 'added') {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1100);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35 }}
      className="group relative flex flex-col overflow-hidden rounded-[1.4rem] bg-white shadow-[0_10px_30px_-18px_rgba(58,58,146,0.35)] ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_-20px_rgba(58,58,146,0.45)]"
    >
      <button
        type="button"
        onClick={() => ui.openProduct(p)}
        aria-label={`Ver detalhes de ${p.name}`}
        className="relative block aspect-[1/0.92] w-full overflow-hidden bg-gradient-to-b from-slate-50 via-white to-primary-50/50"
      >
        <span className="absolute inset-x-6 bottom-3 h-6 rounded-full bg-secondary-900/5 blur-md" aria-hidden="true" />
        <span className="absolute inset-0 p-3 transition duration-500 group-hover:scale-[1.05] sm:p-4">
          <ProductVisual product={p} />
        </span>
        <span className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {p.discount > 0 && (
            <span className="rounded-full bg-primary-600 px-2.5 py-1 text-sm font-extrabold text-white shadow-md shadow-primary-600/30">
              -{p.discount}%
            </span>
          )}
          {p.campaign && (
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black tracking-wide text-primary-400 shadow-md">{CAMPANHA.selo}</span>
          )}
          {p.curve === 'A' && p.inStock && !p.campaign && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary-700 px-2 py-0.5 text-[11px] font-bold text-white">
              <Flame className="h-3 w-3" /> Mais vendido
            </span>
          )}
          {p.controlled && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">Receita retida</span>}
        </span>
        {!p.inStock && (
          <span className="absolute inset-0 grid place-items-center bg-white/55 backdrop-blur-[1px]">
            <span className="rounded-full bg-slate-800 px-3 py-1.5 text-sm font-bold text-white">Indisponível</span>
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <span className="text-[11px] font-bold uppercase tracking-wide text-secondary-600 sm:text-xs">{CATEGORY_BY_ID[p.category].label}</span>
        <h3 className="mt-1 line-clamp-2 text-[0.98rem] font-bold leading-snug text-slate-900 sm:text-[1.05rem]">
          <button type="button" onClick={() => ui.openProduct(p)} className="text-left hover:text-secondary-700">
            {highlight ? <Highlight text={p.name} query={highlight} /> : p.name}
          </button>
        </h3>
        {showFormula(p) && <p className="mt-1 line-clamp-1 text-sm text-slate-600">Princípio ativo: {p.formula}</p>}
        {p.brand && <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{p.brand}</p>}

        <div className="mt-auto pt-3">
          {p.promo > 0 && (
            <p className="text-sm text-slate-500">
              de <span className="line-through">{brl(p.regularPrice)}</span> por
            </p>
          )}
          <p className="text-[1.45rem] font-extrabold leading-tight text-primary-600 sm:text-[1.6rem]">{brl(p.price)}</p>
          <p className={`mt-0.5 text-xs font-semibold sm:text-sm ${!p.inStock ? 'text-slate-500' : p.stock <= 3 ? 'text-primary-700' : 'text-emerald-700'}`}>
            {!p.inStock ? 'Sem estoque no momento' : p.stock <= 3 ? `Últimas ${p.stock} unidades` : '✓ Em estoque'}
          </p>

          <div className="mt-3">
            {p.controlled ? (
              <button
                type="button"
                onClick={() => ui.openProduct(p)}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 text-sm font-bold text-white transition hover:bg-slate-800 sm:text-base"
              >
                <Store className="h-5 w-5" /> Comprar na loja
              </button>
            ) : !p.inStock ? (
              <a
                href={waUrl(notifyStockMessage(p))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-3 text-sm font-bold text-secondary-700 ring-2 ring-secondary-200 transition hover:bg-secondary-50 sm:text-base"
              >
                <BellRing className="h-5 w-5" /> Avise-me
              </a>
            ) : qty > 0 ? (
              <div className="flex min-h-12 items-center justify-between gap-1 rounded-2xl bg-secondary-50 p-1 ring-2 ring-secondary-200">
                <button
                  type="button"
                  onClick={() => cart.setQty(p.id, qty - 1)}
                  aria-label={`Diminuir quantidade de ${p.name}`}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-white text-secondary-700 shadow-sm hover:bg-secondary-100"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <span className="text-center text-lg font-extrabold text-secondary-800" aria-live="polite">
                  {qty}
                  <span className="sr-only"> no carrinho</span>
                </span>
                <button
                  type="button"
                  onClick={onAdd}
                  aria-label={`Aumentar quantidade de ${p.name}`}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-primary-600 text-white shadow-sm hover:bg-primary-700"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={onAdd}
                className={`btn-shine flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold text-white shadow-md transition sm:text-base ${
                  justAdded ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-gradient-to-r from-primary-600 to-primary-700 shadow-primary-600/30 hover:brightness-105'
                }`}
              >
                {justAdded ? <CircleCheck className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
                {justAdded ? 'Adicionado!' : 'Adicionar'}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
