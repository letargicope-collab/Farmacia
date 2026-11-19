import { motion } from 'framer-motion';
import { Baby, HandHeart, HeartPulse, Leaf, MessageCircle, ToyBrick, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { BRAND, STORE } from '../config/store';
import { pharmacistMessage, waUrl } from '../lib/whatsapp';
import { useUI } from '../state/store';

type UI = ReturnType<typeof useUI>;

const STAGES: { icon: LucideIcon; title: string; text: string; tone: string; go: (ui: UI) => void }[] = [
  { icon: Baby, title: 'Bebês e mamães', text: 'Fraldas, leites e cuidados', tone: 'from-primary-400 to-primary-700', go: (ui) => ui.selectCategory('infantil', true) },
  { icon: ToyBrick, title: 'Crianças', text: 'Vitaminas e higiene infantil', tone: 'from-secondary-500 to-secondary-800', go: (ui) => ui.applySearch('infantil', true) },
  { icon: Leaf, title: 'Adultos', text: 'Vitaminas e bem-estar', tone: 'from-primary-400 to-primary-700', go: (ui) => ui.selectCategory('vitaminas', true) },
  { icon: HeartPulse, title: 'Melhor idade', text: 'Pressão, conforto e cuidado', tone: 'from-secondary-500 to-secondary-800', go: (ui) => ui.selectCategory('saude', true) },
];

/** "A farmácia de toda a família" — slogan oficial com a foto da família. */
export function FamilySection() {
  const ui = useUI();
  const [src, setSrc] = useState(BRAND.family);
  const [failed, setFailed] = useState(false);
  const words = STORE.slogan.split(' ');
  const lead = words.slice(0, -3).join(' ');
  const highlight = words.slice(-3).join(' ');

  return (
    <section id="familia" className="relative scroll-mt-44 overflow-hidden py-12 md:scroll-mt-32 md:py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="relative mb-4 lg:col-span-6 lg:mb-0"
        >
          <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-primary-200/70 via-white to-secondary-200/70 blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-100 to-secondary-100 shadow-[0_30px_60px_-30px_rgba(58,58,146,0.55)] ring-4 ring-white">
            {failed ? (
              <div className="grid aspect-[3/2] place-items-center">
                <HandHeart className="h-20 w-20 text-primary-500" />
              </div>
            ) : (
              <img
                src={src}
                alt="Família reunida e sorridente — avós, pais e filhos"
                loading="lazy"
                width={1280}
                height={853}
                onError={() => (src !== BRAND.familyFallback ? setSrc(BRAND.familyFallback) : setFailed(true))}
                className="aspect-[3/2] w-full object-cover"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-secondary-950/35 to-transparent" aria-hidden="true" />
          </div>
          <div className="glass-card absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl px-4 py-3 sm:left-6">
            <span className="icon-3d grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
              <HandHeart className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-extrabold text-slate-900">Cuidado para todas as idades</span>
              <span className="block text-sm text-slate-600">Do bebê aos avós</span>
            </span>
          </div>
        </motion.div>

        <div className="lg:col-span-6">
          <p className="eyebrow">{STORE.name}</p>
          <h2 className="mt-1 text-[clamp(1.6rem,7.6vw,3rem)] font-extrabold leading-tight tracking-tight text-slate-900">
            {lead} <span className="text-gradient-brand">{highlight}</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Do primeiro banho do bebê ao remédio de uso contínuo dos avós: aqui a sua família encontra cuidado, atendimento farmacêutico de confiança e
            entrega todos os dias.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {STAGES.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => s.go(ui)}
                className="glass-card group flex min-h-20 min-w-0 flex-col items-start gap-2 rounded-2xl p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-xl sm:flex-row sm:items-center sm:gap-3 sm:p-4"
              >
                <span className={`icon-3d grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white transition group-hover:scale-110 ${s.tone}`}>
                  <s.icon className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-extrabold leading-tight text-slate-900">{s.title}</span>
                  <span className="block text-sm leading-snug text-slate-600">{s.text}</span>
                </span>
              </button>
            ))}
          </div>

          <a
            href={waUrl(pharmacistMessage())}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-green-600 px-6 text-lg font-bold text-white shadow-lg shadow-green-600/25 transition hover:bg-green-700"
          >
            <MessageCircle className="h-6 w-6" /> Fale com o farmacêutico
          </a>
        </div>
      </div>
    </section>
  );
}
