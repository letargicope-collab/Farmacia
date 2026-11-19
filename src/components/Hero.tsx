import { AnimatePresence, motion } from 'framer-motion';
import { BadgePercent, Headphones, MapPin, MessageCircle, Mic, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BRAND, STORE } from '../config/store';
import { intBR } from '../lib/format';
import { pharmacistMessage, waUrl } from '../lib/whatsapp';
import { scrollToId, useCatalog, useUI } from '../state/store';
import { useVoice } from '../state/voice';

const CHIPS = ['Dipirona', 'Paracetamol', 'Fralda geriátrica', 'Vitamina C', 'Protetor solar', 'Losartana'];

export function Hero() {
  const { startVoice } = useVoice();
  const { promoCount, maxDiscount, campaignCount, campaignMax } = useCatalog();
  const ui = useUI();
  const [bubble, setBubble] = useState(0);
  const [mascotOk, setMascotOk] = useState(true);
  const blackFriday = campaignCount > 0;
  const topDiscount = blackFriday ? campaignMax : maxDiscount;

  const messages = [
    'Oi, eu sou o Marcos! Vamos encontrar o que você precisa?',
    'Toque no microfone e fale o nome do produto.',
    blackFriday
      ? `Black Friday: até ${campaignMax}% de desconto. Vamos ver as ofertas?`
      : promoCount > 0
        ? `${intBR(promoCount)} ofertas com até ${maxDiscount}% de desconto.`
        : 'Confira as ofertas da farmácia.',
    'Você pode enviar sua localização junto com o pedido.',
  ];

  useEffect(() => {
    const t = setInterval(() => setBubble((b) => (b + 1) % 4), 5200);
    return () => clearInterval(t);
  }, []);

  const badges = [
    { icon: Truck, title: 'Entrega Rápida', text: 'Entregas todos os dias' },
    { icon: Headphones, title: 'Atendimento Farmacêutico', text: 'Dúvidas pelo WhatsApp' },
    { icon: BadgePercent, title: 'Descontos Exclusivos', text: 'Ofertas toda semana' },
  ];

  return (
    <section aria-labelledby="delivery-title" className="delivery-hero relative">
      <div className="delivery-pattern cross-pattern pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="delivery-layout relative mx-auto grid w-full min-w-0 max-w-7xl grid-cols-1 items-center gap-5 px-4 py-7 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:py-10">
        <div className="w-full min-w-0 lg:col-span-7">
          <motion.h1
            id="delivery-title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="delivery-title font-extrabold tracking-tight text-secondary-950"
          >
            <span className="block text-primary-600">Entrega rápida.</span>{' '}Faça o seu pedido
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="delivery-description mt-3 text-slate-600 sm:mt-4"
          >
            Busque seu produto por texto ou voz e finalize o pedido pelo WhatsApp da farmácia.
          </motion.p>

          <div className="popular-searches mt-5 w-full min-w-0 max-w-lg lg:mt-7">
            <p id="popular-searches-label" className="text-sm font-bold text-secondary-800">Mais buscados</p>
            <div role="group" aria-labelledby="popular-searches-label" className="mt-2.5 flex w-full max-w-full flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => ui.applySearch(c, true)}
                  className="min-h-10 min-w-0 max-w-full rounded-full border border-secondary-100 bg-white px-2 text-sm font-semibold text-secondary-700 transition hover:border-secondary-300 hover:bg-secondary-50 active:scale-95 min-[390px]:px-3 sm:px-4"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative w-full min-w-0 lg:col-span-5">
          <div className="hero-stage relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="hero-mascot relative">
              <div className="mascot-halo" aria-hidden="true" />
              <div className="absolute bottom-[1%] left-[15%] right-[25%] h-[4%] rounded-[100%] bg-secondary-900/20 blur-md" aria-hidden="true" />
              {mascotOk ? (
                <div className="animate-float relative z-10 h-full w-full">
                  <motion.img
                    src={BRAND.mascot}
                    alt="Marcos, mascote da Farmácia São Marcos, com a mão estendida apresentando as novidades"
                    referrerPolicy="no-referrer"
                    onError={() => setMascotOk(false)}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.15 }}
                    className="h-full w-full object-contain drop-shadow-[0_10px_14px_rgba(58,58,146,0.1)]"
                  />
                </div>
              ) : (
                <img src={BRAND.logo} alt={STORE.name} className="relative z-10 mt-[45%] w-full object-contain" />
              )}
            </div>

            <div className="hero-side relative z-20 flex min-w-0 flex-col items-start justify-between gap-2.5">
              <motion.button
                type="button"
                onClick={startVoice}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                aria-label="Falar com o Marcos: buscar remédio por voz"
                className="hero-bubble bubble-tail-up relative w-full rounded-2xl rounded-tr-md bg-white px-3.5 py-3 text-left shadow-[0_5px_22px_rgba(43,38,83,0.08)] ring-1 ring-secondary-100 transition hover:shadow-md sm:px-4 sm:py-3.5"
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={bubble}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="block min-h-[4.125em] text-[13.5px] font-semibold leading-snug text-slate-800 max-[359px]:text-[12.5px] sm:text-[15px]"
                  >
                    {messages[bubble]}
                  </motion.span>
                </AnimatePresence>
                <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-primary-600 px-2 py-1.5 text-[12.5px] font-bold leading-tight text-white max-[389px]:text-[12px] max-[359px]:text-[11.5px] sm:gap-1.5 sm:px-3 sm:text-sm">
                  <Mic className="h-4 w-4 shrink-0" /> Falar com o Marcos
                </span>
              </motion.button>

              <div className="flex flex-col items-start gap-2.5">
                {topDiscount > 0 && (
                  <motion.button
                    type="button"
                    onClick={() => scrollToId('ofertas')}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    aria-label={`Ver ofertas: ${blackFriday ? 'Black Friday' : 'ofertas'} com até ${topDiscount}% de desconto`}
                    className="glass-card flex items-center gap-2 rounded-2xl py-2 pl-2 pr-3 text-left transition hover:-translate-y-0.5 sm:gap-2.5 sm:py-2.5 sm:pl-2.5 sm:pr-4 lg:gap-2 lg:py-2 lg:pl-2 lg:pr-3 xl:gap-2.5 xl:py-2.5 xl:pl-2.5 xl:pr-4"
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 lg:h-8 lg:w-8 xl:h-10 xl:w-10 ${blackFriday ? 'bg-slate-950 text-primary-400' : 'bg-primary-600 text-white'}`}
                    >
                      <BadgePercent className="h-[18px] w-[18px] sm:h-5 sm:w-5 lg:h-[18px] lg:w-[18px] xl:h-5 xl:w-5" />
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wide text-primary-700 sm:text-[11px] lg:text-[10px] xl:text-[11px]">
                        {blackFriday ? 'Black Friday' : 'Ofertas'}
                      </span>
                      <span className="block whitespace-nowrap text-sm font-extrabold text-slate-900 sm:text-base lg:text-sm xl:text-base">até {topDiscount}% OFF</span>
                    </span>
                  </motion.button>
                )}
                <a
                  href={waUrl(pharmacistMessage())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card hidden items-center gap-2.5 rounded-2xl p-2.5 pr-4 sm:flex lg:hidden xl:flex"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-700 text-white">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-secondary-600">Pedido no WhatsApp</span>
                    <span className="flex items-center gap-1 text-base font-extrabold text-slate-900">
                      com GPS <MessageCircle className="h-4 w-4 text-green-600" />
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative border-y border-secondary-100/80 bg-white/85">
        <ul className="service-notes mx-auto grid w-full min-w-0 max-w-7xl grid-cols-3 px-4 py-3 sm:px-6 sm:py-4">
          {badges.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex min-w-0 flex-col items-center justify-center gap-1.5 px-1.5 text-center sm:flex-row sm:gap-3 sm:text-left">
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary-600 sm:h-6 sm:w-6" />
              <span className="min-w-0">
                <span className="block text-[0.75rem] font-bold leading-tight text-secondary-900 sm:text-sm">{title}</span>
                <span className="hidden text-xs text-slate-600 sm:block">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
