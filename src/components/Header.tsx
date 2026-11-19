import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, CloudUpload, Menu, MessageCircle, ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';
import { BRAND, STORE } from '../config/store';
import { brl } from '../lib/format';
import { useStoreStatus, type StoreStatus } from '../lib/hours';
import { pharmacistMessage, waUrl } from '../lib/whatsapp';
import { scrollToId, useCart, useUI } from '../state/store';
import { SearchBar } from './SearchBar';

function FontSizeControl() {
  const { fontScale, setFontScale } = useUI();
  const options = [
    { v: 0, label: 'A', aria: 'Letra normal', cls: 'text-[13px]' },
    { v: 1, label: 'A+', aria: 'Letra grande', cls: 'text-[15px]' },
    { v: 2, label: 'A++', aria: 'Letra muito grande', cls: 'text-[17px]' },
  ];
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Tamanho da letra">
      <span className="mr-1 hidden text-xs font-medium text-white/80 sm:inline">Letra:</span>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setFontScale(o.v)}
          aria-label={o.aria}
          aria-pressed={fontScale === o.v}
          className={`grid h-7 min-w-7 place-items-center rounded-lg px-1 font-extrabold leading-none transition min-[380px]:h-8 min-[380px]:min-w-8 min-[380px]:px-1.5 ${o.cls} ${
            fontScale === o.v ? 'bg-white text-secondary-800' : 'text-white hover:bg-white/15'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Situação da loja em tempo real (horário de Maceió). */
function StoreStatusLine({ status: s }: { status: StoreStatus }) {
  return (
    <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold" title={s.delivery ? `${s.long} — ${s.delivery}` : s.long}>
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        {s.open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.open ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      </span>
      <span className="truncate sm:hidden">{s.short}</span>
      <span className="hidden truncate sm:inline">{s.long}</span>
    </p>
  );
}

/** Logo oficial + slogan "A farmácia de toda a família". */
function BrandLockup() {
  const words = STORE.slogan.split(' ');
  const last = words.pop();
  return (
    <a
      href="#inicio"
      onClick={(e) => {
        e.preventDefault();
        scrollToId('inicio');
      }}
      className="flex min-w-0 flex-col items-center md:shrink-0"
      aria-label={`${STORE.name}, ${STORE.slogan.toLowerCase()} — voltar ao início`}
    >
      <img src={BRAND.logo} alt={STORE.name} className="h-8 w-auto min-[380px]:h-9 sm:h-10 lg:h-11" width={178} height={44} />
      <span className="mt-1 max-w-full text-center text-[10px] font-bold leading-tight text-secondary-700 min-[380px]:text-[11px] sm:text-xs">
        {words.join(' ')} <span className="text-primary-600">{last}</span>
      </span>
    </a>
  );
}

export function Header() {
  const ui = useUI();
  const cart = useCart();
  const [menu, setMenu] = useState(false);
  const status = useStoreStatus();

  const nav = [
    { label: 'Início', run: () => scrollToId('inicio') },
    { label: 'Categorias', run: () => scrollToId('categorias') },
    { label: 'Ofertas', run: () => scrollToId('ofertas') },
    { label: 'Medicamentos', run: () => ui.selectCategory('medicamentos', true) },
    { label: 'Contato', run: () => scrollToId('contato') },
  ];

  return (
    <header id="site-header" className="relative z-50 w-full min-w-0 shrink-0">
      <div className="bg-gradient-to-r from-secondary-800 via-secondary-700 to-secondary-800 text-white">
        <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-2 px-4 py-1 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <StoreStatusLine status={status} />
            {/* Envio da planilha de produtos (login de administrador) */}
            <button
              type="button"
              onClick={() => ui.setAdminOpen(true)}
              aria-label="Enviar planilha de produtos (acesso restrito ao administrador)"
              title="Enviar planilha de produtos"
              className="relative grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/60 ring-1 ring-white/15 transition before:absolute before:-inset-2 before:content-[''] hover:bg-white/10 hover:text-white"
            >
              <CloudUpload className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2 min-[380px]:gap-4">
            <a
              href={waUrl(pharmacistMessage())}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 text-[13px] font-semibold hover:text-primary-200 md:flex"
            >
              <MessageCircle className="h-4 w-4 text-primary-300" /> WhatsApp {STORE.whatsappDisplay}
            </a>
            <FontSizeControl />
          </div>
        </div>
      </div>

      {!status.open && (
        <div className="closed-notice">
          <p className="mx-auto flex w-full min-w-0 max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-6">
            <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>Estamos fechados agora, mas você já pode montar seu pedido. <strong>{status.delivery}.</strong></span>
          </p>
        </div>
      )}

      <div className="relative border-b border-white/70 bg-white/85 shadow-[0_10px_30px_-20px_rgba(58,58,146,0.45)] backdrop-blur-xl">
        <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-2 sm:px-6">
          <div className="flex w-full min-w-0 items-center gap-2 min-[380px]:gap-3 sm:gap-5">
            <BrandLockup />

            <div className="hidden min-w-0 flex-1 md:block">
              <SearchBar />
            </div>

            <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Menu principal">
              {nav.map((n) => (
                <button
                  key={n.label}
                  type="button"
                  onClick={n.run}
                  className="rounded-xl px-3 py-2 text-[15px] font-semibold text-slate-700 transition hover:bg-secondary-50 hover:text-secondary-700"
                >
                  {n.label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => ui.setCartOpen(true)}
              aria-label={`Abrir carrinho, ${cart.count} ${cart.count === 1 ? 'item' : 'itens'}`}
              className="relative ml-auto flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 px-3 text-white shadow-lg shadow-primary-600/30 transition hover:brightness-105 min-[380px]:h-12 min-[380px]:px-3.5 sm:px-4 md:ml-0"
            >
              <ShoppingCart className="h-6 w-6" />
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-[11px] font-medium text-white/90">Carrinho</span>
                <span className="block text-sm font-extrabold">{brl(cart.total)}</span>
              </span>
              {cart.count > 0 && (
                <motion.span
                  key={cart.count}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-secondary-700 px-1.5 text-xs font-extrabold text-white ring-2 ring-white"
                >
                  {cart.count}
                </motion.span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menu}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200 min-[380px]:h-12 min-[380px]:w-12 xl:hidden"
            >
              {menu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          <div className="mt-2 w-full min-w-0 md:hidden">
            <SearchBar compact />
          </div>
        </div>

        <AnimatePresence>
          {menu && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="absolute inset-x-0 top-full max-h-[min(50dvh,24rem)] overflow-y-auto overflow-x-hidden overscroll-contain border-t border-slate-200 bg-white shadow-md xl:hidden"
              aria-label="Menu"
            >
              <div className="mx-auto grid max-w-7xl gap-1 p-3 sm:grid-cols-3 sm:px-6">
                {nav.map((n) => (
                  <button
                    key={n.label}
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      n.run();
                    }}
                    className="min-h-12 rounded-2xl px-4 text-left text-lg font-semibold text-slate-800 hover:bg-secondary-50"
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
