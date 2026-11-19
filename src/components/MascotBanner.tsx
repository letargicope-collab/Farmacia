import { motion } from 'framer-motion';
import { CircleCheck, Headphones, MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
import { BRAND, STORE } from '../config/store';
import { pharmacistMessage, waUrl } from '../lib/whatsapp';

export function MascotBanner() {
  const [ok, setOk] = useState(true);
  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-secondary-800 via-secondary-700 to-secondary-600 shadow-2xl shadow-secondary-800/30">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-500/30 blur-3xl" />
          <div className="absolute -bottom-24 left-10 h-80 w-80 rounded-full bg-primary-400/20 blur-3xl" />
          <div className="cross-pattern-light absolute inset-0 opacity-[0.08]" aria-hidden="true" />

          <div className="relative grid items-end gap-4 px-6 pt-8 sm:px-10 md:grid-cols-12 md:pt-10">
            <div className="order-2 flex justify-center md:order-1 md:col-span-4">
              {ok ? (
                <motion.img
                  src={BRAND.mascot}
                  alt="Marcos, mascote da Farmácia São Marcos"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={() => setOk(false)}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-64 w-auto object-contain drop-shadow-2xl sm:h-80"
                />
              ) : (
                <div className="mb-10 grid h-40 w-40 place-items-center rounded-full bg-white/10">
                  <MessageCircle className="h-16 w-16 text-white" />
                </div>
              )}
            </div>

            <div className="order-1 pb-6 text-white md:order-2 md:col-span-8 md:pb-12">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold ring-1 ring-white/25 backdrop-blur">
                <Headphones className="h-4 w-4" /> Atendimento farmacêutico gratuito
              </span>
              <h2 className="mt-4 text-[clamp(1.6rem,7.6vw,3rem)] font-extrabold leading-tight">
                Tire suas dúvidas direto com o nosso <span className="text-primary-300">farmacêutico</span>
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-white/90">
                Posologia, interações, genéricos equivalentes ou aquele remédio que você não achou no site: fale com a gente pelo WhatsApp, de forma rápida e humana.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={waUrl(pharmacistMessage())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-green-600 px-6 text-lg font-bold text-white shadow-lg hover:bg-green-700"
                >
                  <MessageCircle className="h-6 w-6" /> Chamar no WhatsApp
                </a>
                <a
                  href={STORE.phoneHref}
                  className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-white/10 px-6 text-lg font-bold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20"
                >
                  <Phone aria-hidden="true" className="h-5 w-5 shrink-0" /> Ligar para a Farmácia
                </a>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-base text-white/90">
                {['Resposta em minutos', 'Atendimento humanizado', 'Sem custo'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CircleCheck className="h-5 w-5 text-primary-300" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
