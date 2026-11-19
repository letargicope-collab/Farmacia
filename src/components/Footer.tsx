import { Camera, Clock, CreditCard, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Truck } from 'lucide-react';
import { BRAND, STORE } from '../config/store';
import { formatDateTime, intBR } from '../lib/format';
import { pharmacistMessage, waUrl } from '../lib/whatsapp';
import { scrollToId, useCatalog, useUI } from '../state/store';

export function Footer() {
  const ui = useUI();
  const { file } = useCatalog();
  const words = STORE.slogan.split(' ');
  const last = words.pop();
  const legal = [STORE.cnpj && `CNPJ ${STORE.cnpj}`, STORE.pharmacist].filter(Boolean).join(' · ');
  const iconBtn = 'grid h-12 w-12 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10 transition';

  return (
    <footer id="contato" className="relative overflow-hidden bg-gradient-to-br from-secondary-950 via-slate-950 to-secondary-950 pt-14 text-slate-300">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_25%_0%,rgba(226,98,12,0.08),transparent_55%),radial-gradient(ellipse_at_75%_100%,rgba(97,100,194,0.15),transparent_55%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="inline-block rounded-2xl bg-white px-4 py-3 shadow-lg">
              <img src={BRAND.logo} alt={STORE.name} className="h-11 w-auto" loading="lazy" />
            </div>
            <p className="mt-4 text-xl font-extrabold text-white">
              {words.join(' ')} <span className="text-primary-400">{last}</span>
            </p>
            <p className="mt-2 text-base leading-relaxed text-slate-400">
              Cuidando de cada geração com medicamentos originais, atendimento farmacêutico e entrega todos os dias.
            </p>
            <div className="mt-4 flex gap-2">
              {STORE.instagram && (
                <a href={STORE.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={`${iconBtn} hover:bg-primary-600`}>
                  <Camera className="h-5 w-5" />
                </a>
              )}
              <a href={waUrl(pharmacistMessage())} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={`${iconBtn} hover:bg-green-600`}>
                <MessageCircle className="h-5 w-5" />
              </a>
              <a href={STORE.phoneHref} aria-label="Ligar para a farmácia" className={`${iconBtn} hover:bg-secondary-600`}>
                <Phone className="h-5 w-5" />
              </a>
              {STORE.email && (
                <a href={`mailto:${STORE.email}`} aria-label="E-mail" className={`${iconBtn} hover:bg-secondary-600`}>
                  <Mail className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wider text-white">Navegação</h3>
            <ul className="mt-4 space-y-1">
              {[
                ['Categorias', () => scrollToId('categorias')],
                ['Ofertas da Black Friday', () => scrollToId('ofertas')],
                ['Medicamentos', () => ui.selectCategory('medicamentos', true)],
                ['Genéricos', () => ui.selectCategory('genericos', true)],
                ['Mamães & Bebês', () => ui.selectCategory('infantil', true)],
              ].map(([label, run]) => (
                <li key={label as string}>
                  <button type="button" onClick={run as () => void} className="min-h-10 text-base text-slate-400 transition hover:text-white">
                    {label as string}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wider text-white">Atendimento</h3>
            <ul className="mt-4 space-y-3 text-base">
              {STORE.address && (
                <li className="flex gap-2.5">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary-400" />
                  <span>
                    {STORE.address}
                    {STORE.cityUf && (
                      <>
                        <br />
                        {STORE.cityUf}
                      </>
                    )}
                  </span>
                </li>
              )}
              <li>
                <a href={waUrl(pharmacistMessage())} target="_blank" rel="noopener noreferrer" className="flex gap-2.5 hover:text-white">
                  <MessageCircle className="h-5 w-5 shrink-0 text-primary-400" /> WhatsApp {STORE.whatsappDisplay}
                </a>
              </li>
              <li>
                <a href={STORE.phoneHref} className="flex gap-2.5 hover:text-white">
                  <Phone className="h-5 w-5 shrink-0 text-primary-400" /> Telefone {STORE.phoneDisplay}
                </a>
              </li>
              {STORE.email && (
                <li>
                  <a href={`mailto:${STORE.email}`} className="flex gap-2.5 break-all hover:text-white">
                    <Mail className="h-5 w-5 shrink-0 text-primary-400" /> {STORE.email}
                  </a>
                </li>
              )}
            </ul>
            <h3 className="mt-7 text-base font-extrabold uppercase tracking-wider text-white">Formas de pagamento</h3>
            <p className="mt-2 text-sm text-slate-400">PIX na hora, pelo QR Code · cartão ou dinheiro na entrega</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['PIX (QR Code)', 'Crédito', 'Débito', 'Dinheiro'].map((m) => (
                <span key={m} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white ring-1 ring-white/10">
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-extrabold uppercase tracking-wider text-white">Horários</h3>
            <ul className="mt-4 space-y-4 text-base">
              {STORE.hours.map((h) => (
                <li key={h.days} className="flex gap-2.5">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary-400" />
                  <span>
                    <span className="block font-bold text-white">{h.days}</span>
                    <span className="block">{h.open}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-primary-300">
                      <Truck className="h-4 w-4 shrink-0" /> {h.delivery}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 py-6 text-sm lg:flex-row lg:items-center lg:justify-between">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-slate-400">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary-400" /> Produtos originais com nota fiscal
            </li>
            <li className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary-400" /> Entregas todos os dias
            </li>
            <li className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary-400" /> PIX pelo QR Code ou pague na entrega
            </li>
          </ul>
          <p className="text-slate-500">
            Catálogo: {intBR(file.stats.exported)} itens · atualizado em {formatDateTime(file.generatedAt)}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} {STORE.name} — {STORE.slogan.toLowerCase()}
          {legal && ` · ${legal}`}
        </p>
        <p className="pb-8 pt-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          Se persistirem os sintomas, o médico deverá ser consultado.
        </p>
      </div>
    </footer>
  );
}
