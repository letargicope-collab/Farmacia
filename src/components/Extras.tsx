import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, House, Info, LayoutGrid, MessageCircle, Mic, ShoppingCart, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { pharmacistMessage, waUrl } from '../lib/whatsapp';
import { scrollToId, useCart, useUI } from '../state/store';
import { useVoice } from '../state/voice';

/** Barra inferior para celular: botões grandes e o microfone sempre à mão. */
export function MobileBottomBar() {
  const ui = useUI();
  const cart = useCart();
  const { startVoice } = useVoice();

  const Item = ({ icon: Icon, label, onClick, href, badge }: { icon: LucideIcon; label: string; onClick?: () => void; href?: string; badge?: number }) => {
    const content = (
      <>
        <span className="relative">
          <Icon className="h-6 w-6" />
          {!!badge && (
            <span className="absolute -right-2.5 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary-600 px-1 text-[11px] font-extrabold text-white">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-1 w-full truncate text-center text-[11px] font-bold min-[380px]:text-[12px]">{label}</span>
      </>
    );
    const cls =
      'flex min-h-16 min-w-0 flex-col items-center justify-center px-0.5 text-slate-700 active:text-primary-700';
    return href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
      </a>
    ) : (
      <button type="button" onClick={onClick} className={cls}>
        {content}
      </button>
    );
  };

  return (
    <nav
      className="storefront-tabs fixed inset-x-0 bottom-0 z-40 w-full max-w-full border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-15px_rgba(58,58,146,0.35)] backdrop-blur-xl md:hidden"
      aria-label="Atalhos"
    >
      <div className="grid grid-cols-5 items-end">
        <Item icon={House} label="Início" onClick={() => scrollToId('inicio')} />
        <Item icon={LayoutGrid} label="Categorias" onClick={() => scrollToId('categorias')} />
        <div className="flex flex-col items-center pb-1.5">
          <button
            type="button"
            onClick={startVoice}
            aria-label="Buscar falando"
            className="-mt-7 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-xl shadow-primary-600/40 ring-4 ring-white"
          >
            <Mic className="h-8 w-8" />
          </button>
          <span className="mt-1 text-[12px] font-extrabold text-primary-700">Falar</span>
        </div>
        <Item icon={ShoppingCart} label="Carrinho" badge={cart.count} onClick={() => ui.setCartOpen(true)} />
        <Item icon={MessageCircle} label="WhatsApp" href={waUrl(pharmacistMessage())} />
      </div>
    </nav>
  );
}

/** Botão flutuante do WhatsApp (computador). */
export function FloatingWhatsApp() {
  return (
    <a
      href={waUrl(pharmacistMessage())}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com o farmacêutico no WhatsApp"
      className="pulse-ring fixed bottom-6 right-6 z-40 hidden h-16 w-16 place-items-center rounded-full bg-green-600 text-white shadow-2xl shadow-green-600/40 transition hover:scale-110 md:grid"
    >
      <MessageCircle className="h-8 w-8" />
    </a>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useUI();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[95] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-2xl ${
              t.tone === 'warning' ? 'bg-primary-700' : t.tone === 'info' ? 'bg-secondary-800' : 'bg-slate-900'
            }`}
          >
            {t.tone === 'success' ? <CircleCheck className="h-6 w-6 shrink-0 text-emerald-400" /> : <Info className="h-6 w-6 shrink-0" />}
            <p className="flex-1 text-base font-semibold">{t.message}</p>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismissToast(t.id);
                }}
                className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold hover:bg-white/25"
              >
                {t.actionLabel}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Orienta quem abre o site pelo navegador interno do Instagram. */
export function InstagramHint() {
  const [show, setShow] = useState(() => {
    try {
      return /Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent) && !sessionStorage.getItem('fsm:ig-hint');
    } catch {
      return false;
    }
  });
  if (!show) return null;
  return (
    <div className="relative z-[51] border-b border-primary-200 bg-primary-50 px-4 py-3 text-primary-950">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
        <p className="flex-1 text-base">
          Você abriu pelo Instagram. Para usar a <strong>busca por voz</strong> e o <strong>GPS</strong>, toque em <strong>⋯</strong> e escolha <strong>“Abrir no navegador”</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem('fsm:ig-hint', '1');
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
          aria-label="Fechar aviso"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl hover:bg-primary-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
