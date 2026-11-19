import { ArrowRight, Info, Mic, Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { brl, plural } from '../lib/format';
import { scrollToId, useCart, useUI } from '../state/store';
import { useVoice } from '../state/voice';
import { ProductVisual } from './ProductVisual';
import { CloseButton, Drawer } from './ui/Overlay';

export function CartDrawer() {
  const ui = useUI();
  const cart = useCart();
  const { startVoice } = useVoice();
  const close = () => ui.setCartOpen(false);
  const hasMedicine = cart.lines.some((l) => l.product.category === 'medicamentos' || l.product.category === 'genericos');

  return (
    <Drawer open={ui.cartOpen} onClose={close} label="Carrinho de compras">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Seu carrinho</h2>
          <p className="text-base text-slate-600">{plural(cart.count, 'item', 'itens')}</p>
        </div>
        <CloseButton onClick={close} />
      </div>

      {cart.lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-primary-50">
            <ShoppingCart className="h-10 w-10 text-primary-500" />
          </span>
          <p className="mt-4 text-xl font-extrabold text-slate-900">Seu carrinho está vazio</p>
          <p className="mt-1 text-base text-slate-600">Busque seu remédio digitando ou falando.</p>
          <button
            type="button"
            onClick={() => {
              close();
              startVoice();
            }}
            className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 text-lg font-bold text-white hover:bg-primary-700"
          >
            <Mic className="h-6 w-6" /> Buscar falando
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              scrollToId('ofertas');
            }}
            className="mt-3 min-h-12 w-full rounded-2xl text-base font-bold text-secondary-700 ring-1 ring-secondary-200 hover:bg-secondary-50"
          >
            Ver ofertas da semana
          </button>
        </div>
      ) : (
        <>
          <ul className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
            {cart.lines.map(({ product: p, qty }) => (
              <li key={p.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <button
                  type="button"
                  onClick={() => ui.openProduct(p)}
                  className="h-20 w-20 shrink-0 rounded-xl bg-gradient-to-b from-slate-50 to-primary-50/60 p-1"
                  aria-label={`Ver ${p.name}`}
                >
                  <ProductVisual product={p} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="line-clamp-2 flex-1 text-base font-bold leading-snug text-slate-900">{p.name}</p>
                    <button
                      type="button"
                      onClick={() => cart.remove(p.id)}
                      aria-label={`Remover ${p.name} do carrinho`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-500">
                    {brl(p.price)} cada · Cód. {p.code}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-xl bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => cart.setQty(p.id, qty - 1)}
                        aria-label="Diminuir quantidade"
                        className="grid h-10 w-10 place-items-center rounded-lg text-secondary-700 hover:bg-white"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <span className="w-8 text-center text-lg font-extrabold" aria-live="polite">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => cart.setQty(p.id, qty + 1)}
                        disabled={qty >= Math.floor(p.stock)}
                        aria-label="Aumentar quantidade"
                        className="grid h-10 w-10 place-items-center rounded-lg text-secondary-700 hover:bg-white disabled:opacity-35"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="text-lg font-extrabold text-primary-600">{brl(p.price * qty)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {hasMedicine && (
              <p className="mb-3 flex gap-2 rounded-2xl bg-secondary-50 p-3 text-sm text-secondary-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> Alguns medicamentos exigem receita: tenha-a em mãos na entrega.
              </p>
            )}
            {cart.savings > 0 && (
              <p className="flex justify-between text-base font-semibold text-emerald-700">
                <span>Você economiza</span>
                <span>{brl(cart.savings)}</span>
              </p>
            )}
            <p className="mt-1 flex justify-between text-base text-slate-600">
              <span>Entrega</span>
              <span>combinada no WhatsApp</span>
            </p>
            <p className="mt-2 flex items-end justify-between">
              <span className="text-lg font-bold text-slate-900">Total</span>
              <span className="text-3xl font-extrabold text-primary-600">{brl(cart.total)}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                close();
                ui.setCheckoutOpen(true);
              }}
              className="btn-shine mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 text-lg font-bold text-white shadow-lg shadow-primary-600/30 hover:brightness-105"
            >
              Finalizar pedido <ArrowRight className="h-6 w-6" />
            </button>
            <button type="button" onClick={close} className="mt-2 min-h-12 w-full rounded-2xl text-base font-bold text-secondary-700 hover:bg-slate-50">
              Continuar comprando
            </button>
          </div>
        </>
      )}
    </Drawer>
  );
}
