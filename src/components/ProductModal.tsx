import { BellRing, Info, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CAMPANHA, campaignEndLabel } from '../config/campanha';
import { CATEGORY_BY_ID } from '../lib/catalog';
import { brl } from '../lib/format';
import { controlledMessage, notifyStockMessage, productQuestionMessage, waUrl } from '../lib/whatsapp';
import { useUI } from '../state/store';
import { showFormula, useAddToCart } from './ProductCard';
import { ProductVisual } from './ProductVisual';
import { CloseButton, Modal } from './ui/Overlay';

export function ProductModal() {
  const ui = useUI();
  const addToCart = useAddToCart();
  const p = ui.product;
  const [qty, setQty] = useState(1);

  useEffect(() => setQty(1), [p?.id]);

  const isMedicine = p ? p.category === 'medicamentos' || p.category === 'genericos' : false;
  const max = p ? Math.max(1, Math.floor(p.stock)) : 1;

  return (
    <Modal open={!!p} onClose={ui.closeProduct} label={p ? p.name : 'Produto'} className="sm:max-w-4xl">
      {p && (
        <div className="grid md:grid-cols-2">
          <div className="relative bg-gradient-to-b from-slate-50 via-white to-primary-50 p-6 md:rounded-l-[1.75rem]">
            <div className="absolute right-4 top-4 md:hidden">
              <CloseButton onClick={ui.closeProduct} />
            </div>
            <div className="mx-auto aspect-square max-w-[340px]">
              <ProductVisual product={p} />
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">Imagem ilustrativa · render 3D gerado pelo pipeline de imagens</p>
          </div>

          <div className="flex flex-col p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex rounded-full bg-secondary-50 px-3 py-1 text-sm font-bold text-secondary-700">
                {CATEGORY_BY_ID[p.category].label}
              </span>
              <div className="hidden md:block">
                <CloseButton onClick={ui.closeProduct} />
              </div>
            </div>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight text-slate-900 sm:text-[1.7rem]">{p.name}</h2>
            {p.brand && <p className="mt-1 text-base font-medium text-slate-600">{p.brand}</p>}
            {p.formula && (showFormula(p) || isMedicine) && (
              <p className="mt-2 text-base text-slate-700">
                <strong>Princípio ativo:</strong> {p.formula}
              </p>
            )}

            <div className="mt-5 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
              {p.promo > 0 && (
                <p className="text-base text-slate-500">
                  de <span className="line-through">{brl(p.regularPrice)}</span> por{' '}
                  <span className="rounded-full bg-primary-600 px-2 py-0.5 text-sm font-bold text-white">-{p.discount}%</span>
                </p>
              )}
              <p className="text-4xl font-extrabold text-primary-600">{brl(p.price)}</p>
              {p.pmc > p.price && (
                <p className="mt-1 text-sm text-slate-500">Preço Máximo ao Consumidor (PMC): {brl(p.pmc)}</p>
              )}
              <p className={`mt-2 text-base font-semibold ${!p.inStock ? 'text-slate-500' : p.stock <= 3 ? 'text-primary-700' : 'text-emerald-700'}`}>
                {!p.inStock
                  ? 'Sem estoque no momento'
                  : p.stock <= 3
                    ? `Últimas ${p.stock} unidades disponíveis`
                    : `✓ Disponível — ${Math.floor(p.stock)} em estoque`}
              </p>
              {p.campaign && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black tracking-wide text-primary-400">{CAMPANHA.selo}</span>
                  Oferta válida até {campaignEndLabel()} ou enquanto durarem os estoques.
                </p>
              )}
            </div>

            {p.controlled ? (
              <div className="mt-5 rounded-3xl bg-slate-900 p-5 text-white">
                <p className="flex items-center gap-2 text-lg font-bold">
                  <Store className="h-5 w-5" /> Venda somente na loja física
                </p>
                <p className="mt-2 text-base text-slate-200">
                  Medicamento controlado (Portaria 344/98): a venda exige retenção da receita e não pode ser feita pela internet.
                </p>
                <a
                  href={waUrl(controlledMessage(p))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 text-base font-bold text-slate-900"
                >
                  <MessageCircle className="h-5 w-5 text-green-600" /> Consultar disponibilidade
                </a>
              </div>
            ) : p.inStock ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <div className="flex min-h-14 items-center justify-between rounded-2xl bg-white p-1 ring-2 ring-slate-200 sm:w-40">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Diminuir quantidade"
                    className="grid h-12 w-12 place-items-center rounded-xl text-secondary-700 hover:bg-slate-100"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="text-xl font-extrabold text-slate-900" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(max, q + 1))}
                    aria-label="Aumentar quantidade"
                    className="grid h-12 w-12 place-items-center rounded-xl text-secondary-700 hover:bg-slate-100"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (addToCart(p, qty) === 'added') ui.closeProduct();
                  }}
                  className="btn-shine flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 text-lg font-bold text-white shadow-lg shadow-primary-600/30 hover:brightness-105"
                >
                  <ShoppingCart className="h-6 w-6" /> Adicionar · {brl(p.price * qty)}
                </button>
              </div>
            ) : (
              <a
                href={waUrl(notifyStockMessage(p))}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-secondary-700 px-5 text-lg font-bold text-white hover:bg-secondary-800"
              >
                <BellRing className="h-6 w-6" /> Avise-me quando chegar
              </a>
            )}

            <a
              href={waUrl(productQuestionMessage(p))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-bold text-green-700 ring-2 ring-green-200 hover:bg-green-50"
            >
              <MessageCircle className="h-5 w-5" /> Tirar dúvida com o farmacêutico
            </a>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Código</dt>
              <dd className="font-semibold text-slate-800">{p.code}</dd>
              {p.ean && (
                <>
                  <dt className="text-slate-500">Código de barras (EAN)</dt>
                  <dd className="font-semibold text-slate-800">{p.ean}</dd>
                </>
              )}
              {p.ms && (
                <>
                  <dt className="text-slate-500">Registro MS</dt>
                  <dd className="font-semibold text-slate-800">{p.ms === 'ISENTO' ? 'Isento' : p.ms}</dd>
                </>
              )}
              <dt className="text-slate-500">Grupo</dt>
              <dd className="font-semibold text-slate-800">{p.group}</dd>
            </dl>

            {isMedicine && !p.controlled && (
              <p className="mt-5 flex gap-2 rounded-2xl bg-secondary-50 p-3 text-sm text-secondary-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Alguns medicamentos exigem receita médica, que deve ser apresentada na entrega. <strong>SE PERSISTIREM OS SINTOMAS, O MÉDICO DEVERÁ SER CONSULTADO.</strong>
                </span>
              </p>
            )}
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-secondary-500" /> Produto original, com nota fiscal.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
