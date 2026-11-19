import {
  ArrowLeft, ArrowRight, Banknote, Check, CircleCheck, Clock, Copy, CreditCard, ExternalLink, Info, LoaderCircle, LocateFixed,
  MapPin, MessageCircle, QrCode, RotateCcw, ShieldCheck, Truck, User, Wallet,
} from 'lucide-react';
import { PIX } from '../config/pix';
import { forgetOrderId, orderIdFor, orderPixPayload } from '../lib/pix';
import { PixPayment } from './PixPayment';
import { useStoreStatus } from '../lib/hours';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/common';
import { brl, maskCep, maskPhone, onlyDigits, parseMoney } from '../lib/format';
import { getCurrentPosition, lookupCep, reverseGeocode, type GeoPosition } from '../lib/geo';
import { buildOrderMessage, mapsLink, paymentLabel, waUrl, type PaymentMethod } from '../lib/whatsapp';
import { useCart, useUI } from '../state/store';
import { CloseButton, Modal } from './ui/Overlay';

interface FormState {
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  district: string;
  reference: string;
  city: string;
  uf: string;
}
type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey | 'payment' | 'change', string>>;

const EMPTY: FormState = { name: '', phone: '', cep: '', street: '', number: '', district: '', reference: '', city: '', uf: '' };

interface GpsState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  pos?: GeoPosition;
  label?: string;
  error?: string;
}

const inputCls = (err?: string) =>
  `h-14 w-full rounded-2xl border-2 bg-white px-4 text-lg text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 ${
    err ? 'border-rose-400' : 'border-slate-200'
  }`;

function Field({ id, label, hint, error, className = '', children }: { id: string; label: string; hint?: ReactNode; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-base font-bold text-slate-800">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-rose-700" role="alert">
          <Info className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Pré-visualização com *negrito* do WhatsApp. */
function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <strong key={i}>{part.slice(1, -1)}</strong> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

/** Etapas do pedido. No PIX há uma etapa a mais: o pagamento com QR Code. */
const FLOWS = {
  padrao: [
    { title: 'Dados e entrega', short: 'Entrega' },
    { title: 'Forma de pagamento', short: 'Pagamento' },
    { title: 'Confira e envie', short: 'Confira e envie' },
  ],
  pix: [
    { title: 'Dados e entrega', short: 'Entrega' },
    { title: 'Forma de pagamento', short: 'Pagamento' },
    { title: 'Confira o pedido', short: 'Confira' },
    { title: 'Pague com PIX', short: 'PIX' },
  ],
};

export function CheckoutModal() {
  const ui = useUI();
  const cart = useCart();
  const status = useStoreStatus();
  const [saved, setSaved] = usePersistentState<FormState>('fsm:customer', EMPTY);
  const [remember, setRemember] = usePersistentState('fsm:remember', true);
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, ...saved }));
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [gps, setGps] = useState<GpsState>({ status: 'idle' });
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [payment, setPayment] = useState<PaymentMethod | ''>('');
  const [cardType, setCardType] = useState<'credito' | 'debito'>('credito');
  const [change, setChange] = useState('');
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orderId, setOrderId] = useState('');
  const steps = payment === 'pix' ? FLOWS.pix : FLOWS.padrao;
  const lastStep = steps.length;

  // Identificador do pedido (vai no PIX e na mensagem): o mesmo enquanto o carrinho não mudar.
  const cartSig = useMemo(() => `${cart.lines.map((l) => `${l.product.id}x${l.qty}`).join('|')}|${cart.total}`, [cart.lines, cart.total]);
  useEffect(() => {
    if (ui.checkoutOpen && cart.lines.length) setOrderId(orderIdFor(cartSig));
  }, [ui.checkoutOpen, cartSig, cart.lines.length]);

  useEffect(() => {
    if (ui.checkoutOpen) {
      setStep(1);
      setSent(false);
      setErrors({});
      setCopied(false);
    }
  }, [ui.checkoutOpen]);

  // CEP → endereço automático (ViaCEP)
  useEffect(() => {
    const digits = onlyDigits(form.cep);
    if (digits.length !== 8) {
      setCepStatus('idle');
      return;
    }
    let alive = true;
    setCepStatus('loading');
    lookupCep(digits).then((r) => {
      if (!alive) return;
      if (!r) {
        setCepStatus('error');
        return;
      }
      setCepStatus('ok');
      setForm((f) => ({ ...f, street: r.street || f.street, district: r.district || f.district, city: r.city || f.city, uf: r.uf || f.uf }));
    });
    return () => {
      alive = false;
    };
  }, [form.cep]);

  const set = (key: FieldKey) => (e: ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (key === 'phone') v = maskPhone(v);
    if (key === 'cep') v = maskCep(v);
    if (key === 'uf') v = v.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const captureGps = async () => {
    setGps({ status: 'loading' });
    try {
      const pos = await getCurrentPosition();
      setGps({ status: 'ok', pos });
      const guess = await reverseGeocode(pos.lat, pos.lng);
      if (guess) {
        setGps({ status: 'ok', pos, label: guess.label });
        setForm((f) => ({
          ...f,
          street: f.street || guess.street || '',
          number: f.number || guess.number || '',
          district: f.district || guess.district || '',
          city: f.city || guess.city || '',
          uf: f.uf || guess.uf || '',
        }));
      }
    } catch (err) {
      setGps({ status: 'error', error: err instanceof Error ? err.message : 'Não foi possível obter a localização.' });
    }
  };

  const validateDelivery = () => {
    const e: Errors = {};
    if (form.name.trim().length < 3) e.name = 'Digite seu nome completo.';
    if (onlyDigits(form.phone).length < 10) e.phone = 'Digite o telefone com DDD. Ex.: (82) 98765-4321';
    if (!form.street.trim()) e.street = 'Informe o nome da rua.';
    if (!form.number.trim()) e.number = 'Informe o número (ou toque em “Sem número”).';
    if (!form.district.trim()) e.district = 'Informe o bairro.';
    if (!form.city.trim()) e.city = 'Informe a cidade.';
    if (form.uf.trim().length !== 2) e.uf = 'Use a sigla (ex.: AL).';
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      const el = document.getElementById(`ck-${first}`);
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  const validatePayment = () => {
    if (!payment) {
      setErrors({ payment: 'Escolha como você vai pagar.' });
      return false;
    }
    const c = parseMoney(change);
    if (payment === 'dinheiro' && c > 0 && c <= cart.total) {
      setErrors({ change: `O troco deve ser para um valor maior que ${brl(cart.total)}.` });
      return false;
    }
    setErrors({});
    return true;
  };

  const next = () => {
    if (step === 1 && !validateDelivery()) return;
    if (step === 2 && !validatePayment()) return;
    setStep((s) => Math.min(lastStep, s + 1));
    document.getElementById('checkout-top')?.scrollIntoView({ block: 'start' });
  };

  const paymentInfo = useMemo(
    () => ({ method: (payment || 'pix') as PaymentMethod, cardType, change: parseMoney(change) || undefined }),
    [payment, cardType, change],
  );

  const message = useMemo(
    () =>
      buildOrderMessage({
        customer: form,
        gps: gps.pos ? { lat: gps.pos.lat, lng: gps.pos.lng, accuracy: gps.pos.accuracy } : null,
        lines: cart.lines,
        payment: paymentInfo,
        notes,
        pix: payment === 'pix' && orderId ? { orderId, amount: cart.total } : null,
      }),
    [form, gps.pos, cart.lines, paymentInfo, notes, payment, orderId, cart.total],
  );
  const link = waUrl(message);

  /** Código "Pix Copia e Cola" com o valor exato e o identificador do pedido. */
  const pixPayload = useMemo(
    () => (payment === 'pix' && orderId && cart.total > 0 ? orderPixPayload(cart.total, orderId) : null),
    [payment, orderId, cart.total],
  );

  const onSend = () => {
    setSaved(remember ? { ...form, cep: form.cep } : EMPTY);
    setSent(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const finish = () => {
    forgetOrderId();
    cart.clear();
    ui.setCheckoutOpen(false);
    ui.toast('Obrigado pela preferência! 🧡', { tone: 'success' });
  };

  const close = () => ui.setCheckoutOpen(false);
  const empty = cart.lines.length === 0 && !sent;

  return (
    <Modal open={ui.checkoutOpen} onClose={close} label="Finalizar pedido" className="sm:max-w-3xl">
      <div id="checkout-top" className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-5 backdrop-blur sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-primary-700">Pedido via WhatsApp</p>
            <h2 className="text-2xl font-extrabold text-slate-900">{sent ? 'Pedido pronto!' : empty ? 'Carrinho vazio' : steps[step - 1]?.title}</h2>
          </div>
          <CloseButton onClick={close} />
        </div>
        {!sent && !empty && (
          <ol className={`mt-4 grid gap-2 ${lastStep === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} aria-label="Etapas">
            {steps.map((s, i) => (
              <li key={s.title} aria-current={step === i + 1 ? 'step' : undefined}>
                <span className={`block h-2 rounded-full ${step > i ? 'bg-primary-500' : 'bg-slate-200'}`} />
                <span className={`mt-1.5 block text-xs font-bold sm:text-sm ${step === i + 1 ? 'text-primary-700' : 'text-slate-500'}`}>
                  {i + 1}. {s.short}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {empty ? (
        <div className="p-8 text-center">
          <p className="text-lg text-slate-600">Adicione produtos ao carrinho para finalizar o pedido.</p>
          <button type="button" onClick={close} className="mt-5 min-h-14 rounded-2xl bg-primary-600 px-6 text-lg font-bold text-white">
            Voltar às compras
          </button>
        </div>
      ) : sent ? (
        <div className="p-6 text-center sm:p-10">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-100">
            <CircleCheck className="h-14 w-14 text-emerald-600" />
          </div>
          <h3 className="mt-5 text-3xl font-extrabold text-slate-900">Quase lá! 🎉</h3>
          <p className="mx-auto mt-2 max-w-md text-lg text-slate-600">
            Seu pedido foi montado no WhatsApp. Agora é só tocar em <strong>“Enviar” ➤</strong> no WhatsApp para a atendente receber.
          </p>
          {payment === 'pix' && (
            <p className="mx-auto mt-4 flex max-w-md gap-2.5 rounded-2xl bg-emerald-50 p-4 text-left text-base text-emerald-900 ring-1 ring-emerald-200">
              <Truck className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                A mensagem já vai com o <strong>PIX informado</strong> (identificador {orderId}). Assim que a farmácia confirmar o recebimento, seu pedido sai para
                entrega. Se quiser, envie também o comprovante na conversa.
              </span>
            </p>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 text-lg font-bold text-white hover:bg-green-700"
            >
              <ExternalLink className="h-5 w-5" /> Abrir o WhatsApp de novo
            </a>
            <button
              type="button"
              onClick={copy}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-lg font-bold text-secondary-700 ring-2 ring-secondary-200 hover:bg-secondary-50"
            >
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied ? 'Mensagem copiada!' : 'Copiar mensagem'}
            </button>
          </div>
          <button type="button" onClick={finish} className="mt-3 min-h-14 w-full rounded-2xl bg-secondary-700 px-5 text-lg font-bold text-white hover:bg-secondary-800">
            Concluir e esvaziar o carrinho
          </button>
          <button type="button" onClick={() => setSent(false)} className="mt-3 inline-flex min-h-12 items-center gap-2 text-base font-semibold text-slate-600">
            <ArrowLeft className="h-4 w-4" /> Voltar e editar o pedido
          </button>
        </div>
      ) : (
        <>
          <div className="px-5 py-6 sm:px-7">
            {step === 1 && (
              <>
                <p
                  className={`mb-6 flex items-start gap-2.5 rounded-2xl p-4 text-base ring-1 ${
                    status.delivering ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-primary-50 text-primary-950 ring-primary-200'
                  }`}
                >
                  <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                  {status.delivering ? (
                    <span>
                      <strong>{status.delivery}.</strong> Envie o pedido e a atendente confirma pelo WhatsApp.
                    </span>
                  ) : (
                    <span>
                      <strong>Estamos fora do horário de entrega agora.</strong> {status.delivery && `${status.delivery}.`} Você já pode enviar o pedido.
                    </span>
                  )}
                </p>
                <section>
                  <h3 className="flex items-center gap-2 text-lg font-extrabold text-secondary-800">
                    <User className="h-5 w-5" /> Seus dados
                  </h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field id="ck-name" label="Nome completo" error={errors.name}>
                      <input id="ck-name" autoComplete="name" value={form.name} onChange={set('name')} placeholder="Ex.: Maria da Silva" className={inputCls(errors.name)} />
                    </Field>
                    <Field id="ck-phone" label="Telefone / WhatsApp" error={errors.phone}>
                      <input id="ck-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="(82) 98765-4321" className={inputCls(errors.phone)} />
                    </Field>
                  </div>
                </section>

                <section className="mt-8">
                  <h3 className="flex items-center gap-2 text-lg font-extrabold text-secondary-800">
                    <MapPin className="h-5 w-5" /> Onde vamos entregar?
                  </h3>

                  {gps.status === 'ok' && gps.pos ? (
                    <div className="mt-3 overflow-hidden rounded-2xl ring-2 ring-emerald-200">
                      <div className="flex items-start gap-3 bg-emerald-50 p-4">
                        <CircleCheck className="h-7 w-7 shrink-0 text-emerald-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-bold text-emerald-900">Localização exata capturada!</p>
                          <p className="text-sm text-emerald-800">Precisão aproximada: {Math.round(gps.pos.accuracy)} metros.</p>
                          {gps.label && <p className="mt-1 line-clamp-2 text-sm text-emerald-900">📍 {gps.label}</p>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <a
                              href={mapsLink(gps.pos.lat, gps.pos.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200"
                            >
                              <ExternalLink className="h-4 w-4" /> Ver no mapa
                            </a>
                            <button
                              type="button"
                              onClick={captureGps}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200"
                            >
                              <RotateCcw className="h-4 w-4" /> Atualizar
                            </button>
                          </div>
                        </div>
                      </div>
                      <iframe
                        title="Mapa com a sua localização"
                        src={`https://maps.google.com/maps?q=${gps.pos.lat},${gps.pos.lng}&z=17&output=embed`}
                        className="h-48 w-full border-0"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={captureGps}
                      disabled={gps.status === 'loading'}
                      className="mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-secondary-700 to-secondary-800 px-5 text-lg font-bold text-white shadow-lg shadow-secondary-700/30 transition hover:brightness-110 disabled:opacity-80"
                    >
                      {gps.status === 'loading' ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <LocateFixed className="h-6 w-6" />}
                      {gps.status === 'loading' ? 'Obtendo sua localização...' : 'Usar Minha Localização Atual (GPS)'}
                    </button>
                  )}
                  {gps.status === 'error' && <p className="mt-3 rounded-2xl bg-rose-50 p-4 text-base text-rose-800 ring-1 ring-rose-200">{gps.error}</p>}
                  {gps.status !== 'ok' && (
                    <p className="mt-2 text-sm text-slate-500">
                      Recomendado: a atendente recebe o link exato do Google Maps e o entregador não erra o endereço.
                    </p>
                  )}

                  <div className="my-6 flex items-center gap-3 text-sm font-semibold text-slate-500">
                    <span className="h-px flex-1 bg-slate-200" />
                    {gps.status === 'ok' ? 'Confira e complete o endereço' : 'ou preencha o endereço'}
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-6">
                    <Field
                      id="ck-cep"
                      label="CEP (opcional)"
                      className="sm:col-span-2"
                      hint={cepStatus === 'loading' ? 'Buscando endereço...' : cepStatus === 'ok' ? '✓ Endereço preenchido' : cepStatus === 'error' ? 'CEP não encontrado' : 'Preenche a rua sozinho'}
                    >
                      <input id="ck-cep" inputMode="numeric" autoComplete="postal-code" value={form.cep} onChange={set('cep')} placeholder="00000-000" className={inputCls()} />
                    </Field>
                    <Field id="ck-street" label="Rua" error={errors.street} className="sm:col-span-4">
                      <input id="ck-street" autoComplete="address-line1" value={form.street} onChange={set('street')} placeholder="Ex.: Rua das Flores" className={inputCls(errors.street)} />
                    </Field>
                    <Field id="ck-number" label="Número" error={errors.number} className="sm:col-span-2">
                      <div className="flex gap-2">
                        <input id="ck-number" inputMode="numeric" value={form.number} onChange={set('number')} placeholder="123" className={inputCls(errors.number)} />
                        <button
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, number: 'S/N' }));
                            setErrors((er) => ({ ...er, number: undefined }));
                          }}
                          className="shrink-0 rounded-2xl bg-slate-100 px-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
                        >
                          Sem número
                        </button>
                      </div>
                    </Field>
                    <Field id="ck-district" label="Bairro" error={errors.district} className="sm:col-span-4">
                      <input id="ck-district" value={form.district} onChange={set('district')} placeholder="Ex.: Centro" className={inputCls(errors.district)} />
                    </Field>
                    <Field id="ck-reference" label="Ponto de referência" hint="Ex.: perto da padaria, portão azul, apto 12" className="sm:col-span-6">
                      <input id="ck-reference" value={form.reference} onChange={set('reference')} placeholder="Ajuda o entregador a achar você" className={inputCls()} />
                    </Field>
                    <Field id="ck-city" label="Cidade" error={errors.city} className="sm:col-span-4">
                      <input id="ck-city" autoComplete="address-level2" value={form.city} onChange={set('city')} placeholder="Sua cidade" className={inputCls(errors.city)} />
                    </Field>
                    <Field id="ck-uf" label="UF" error={errors.uf} className="sm:col-span-2">
                      <input id="ck-uf" autoComplete="address-level1" value={form.uf} onChange={set('uf')} placeholder="AL" className={`${inputCls(errors.uf)} uppercase`} />
                    </Field>
                  </div>
                </section>
              </>
            )}

            {step === 2 && (
              <section>
                <h3 className="flex items-center gap-2 text-lg font-extrabold text-secondary-800">
                  <Wallet className="h-5 w-5" /> Como você prefere pagar?
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Forma de pagamento">
                  {(
                    [
                      { id: 'pix', label: 'PIX', desc: 'Pague agora pelo QR Code', icon: QrCode },
                      { id: 'cartao', label: 'Cartão', desc: 'Maquininha na entrega', icon: CreditCard },
                      { id: 'dinheiro', label: 'Dinheiro', desc: 'Pague ao receber', icon: Banknote },
                    ] as const
                  ).map((o) => {
                    const on = payment === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setPayment(o.id);
                          setErrors({});
                        }}
                        className={`relative flex min-h-28 flex-col items-start gap-1 rounded-2xl p-4 text-left ring-2 transition ${
                          on ? 'bg-primary-50 ring-primary-500' : 'bg-white ring-slate-200 hover:ring-slate-300'
                        }`}
                      >
                        <o.icon className={`h-8 w-8 ${on ? 'text-primary-600' : 'text-secondary-600'}`} />
                        <span className="text-xl font-extrabold text-slate-900">{o.label}</span>
                        <span className="text-sm text-slate-600">{o.desc}</span>
                        {on && (
                          <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-primary-600 text-white">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {errors.payment && (
                  <p className="mt-3 flex items-center gap-1.5 text-base font-semibold text-rose-700" role="alert">
                    <Info className="h-5 w-5" /> {errors.payment}
                  </p>
                )}

                {payment === 'pix' && (
                  <div className="mt-5 space-y-2.5 rounded-2xl bg-secondary-50 p-4 text-base text-secondary-950 ring-1 ring-secondary-200">
                    <p className="flex items-start gap-2.5">
                      <Truck className="mt-0.5 h-5 w-5 shrink-0 text-secondary-700" />
                      <span>
                        <strong>Seu pedido é enviado após a confirmação do pagamento.</strong>
                      </span>
                    </p>
                    <p className="flex items-start gap-2.5">
                      <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-secondary-700" />
                      <span>
                        No final do pedido geramos o <strong>QR Code</strong> e o <strong>Pix Copia e Cola</strong> com o valor exato. A mensagem do WhatsApp já
                        vai com o PIX informado.
                      </span>
                    </p>
                    <p className="pl-7 text-sm text-secondary-800">
                      Recebedor: <strong>{PIX.recebedor}</strong> · CNPJ {PIX.chaveExibicao}
                    </p>
                  </div>
                )}

                {payment === 'cartao' && (
                  <div className="mt-5 flex gap-3" role="radiogroup" aria-label="Tipo de cartão">
                    {(['credito', 'debito'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={cardType === t}
                        onClick={() => setCardType(t)}
                        className={`min-h-14 flex-1 rounded-2xl text-lg font-bold ring-2 ${cardType === t ? 'bg-secondary-700 text-white ring-secondary-700' : 'bg-white text-slate-700 ring-slate-200'}`}
                      >
                        {t === 'credito' ? 'Crédito' : 'Débito'}
                      </button>
                    ))}
                  </div>
                )}

                {payment === 'dinheiro' && (
                  <Field id="ck-change" label="Precisa de troco? Para quanto?" hint="Deixe em branco se não precisar de troco." error={errors.change} className="mt-5">
                    <input
                      id="ck-change"
                      inputMode="decimal"
                      value={change}
                      onChange={(e) => setChange(e.target.value.replace(/[^\d,.]/g, ''))}
                      placeholder={`Ex.: ${brl(Math.ceil((cart.total + 1) / 50) * 50)}`}
                      className={inputCls(errors.change)}
                    />
                  </Field>
                )}

                <div className="mt-6">
                  <label htmlFor="ck-notes" className="mb-1.5 block text-base font-bold text-slate-800">
                    Observações (opcional)
                  </label>
                  <textarea
                    id="ck-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex.: tocar o interfone 12, entregar após as 18h..."
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white p-4 text-lg outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                  />
                </div>
              </section>
            )}

            {step === 4 && payment === 'pix' && <PixPayment amount={cart.total} orderId={orderId} payload={pixPayload} />}

            {step === 3 && (
              <section className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
                <div className="space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Itens ({cart.count})</p>
                    <ul className="mt-2 space-y-1.5">
                      {cart.lines.map((l) => (
                        <li key={l.product.id} className="flex justify-between gap-3 text-base">
                          <span className="min-w-0 text-slate-800">
                            <strong>{l.qty}x</strong> {l.product.name}
                          </span>
                          <span className="shrink-0 font-semibold">{brl(l.product.price * l.qty)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg font-extrabold">
                      <span>Total</span>
                      <span className="text-primary-600">{brl(cart.total)}</span>
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-base ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Entrega</p>
                      <button type="button" onClick={() => setStep(1)} className="text-sm font-bold text-secondary-700 underline">
                        Editar
                      </button>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900">{form.name}</p>
                    <p className="text-slate-700">{form.phone}</p>
                    <p className="text-slate-700">
                      {form.street}, {form.number} — {form.district}, {form.city}/{form.uf}
                    </p>
                    <p className={`mt-1 text-sm font-semibold ${gps.pos ? 'text-emerald-700' : 'text-primary-700'}`}>
                      {gps.pos ? '📍 Localização GPS incluída' : '⚠️ Sem localização GPS (opcional)'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-base ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Pagamento</p>
                      <button type="button" onClick={() => setStep(2)} className="text-sm font-bold text-secondary-700 underline">
                        Editar
                      </button>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900">{paymentLabel(paymentInfo, cart.total)}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-base font-bold text-slate-800">
                    {payment === 'pix' ? 'Mensagem que será enviada depois do pagamento:' : 'Mensagem que será enviada:'}
                  </p>
                  <div className="rounded-3xl bg-[#efe7dd] p-3">
                    <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-[#d9fdd3] p-4 text-[14.5px] leading-relaxed text-slate-900 shadow-sm">
                      <WhatsAppText text={message} />
                    </div>
                  </div>
                  <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 text-base text-slate-700">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-6 w-6 accent-primary-600" />
                    Lembrar meus dados neste aparelho
                  </label>
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <ShieldCheck className="h-4 w-4 text-secondary-500" /> Seus dados vão só para o WhatsApp da farmácia (LGPD).
                  </p>
                </div>
              </section>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-7">
            <div className="mb-3 flex items-baseline justify-between sm:hidden">
              <span className="text-base font-semibold text-slate-600">Total do pedido</span>
              <span className="text-2xl font-extrabold text-primary-600">{brl(cart.total)}</span>
            </div>
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="flex min-h-14 items-center gap-2 rounded-2xl bg-slate-100 px-5 text-lg font-bold text-slate-700 hover:bg-slate-200"
                >
                  <ArrowLeft className="h-5 w-5" /> <span className="hidden sm:inline">Voltar</span>
                </button>
              )}
              <div className="hidden flex-1 sm:block">
                <p className="text-sm text-slate-500">Total do pedido</p>
                <p className="text-2xl font-extrabold text-primary-600">{brl(cart.total)}</p>
              </div>
              {step < lastStep ? (
                <button
                  type="button"
                  onClick={next}
                  className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-7 text-lg font-bold text-white shadow-lg shadow-primary-600/30 hover:brightness-105 sm:flex-none"
                >
                  {step === 1 ? 'Continuar para pagamento' : step === 2 ? 'Revisar pedido' : 'Ir para o pagamento PIX'} <ArrowRight className="h-5 w-5" />
                </button>
              ) : (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onSend}
                  className="btn-shine flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 px-6 text-lg font-bold text-white shadow-lg shadow-green-600/30 hover:bg-green-700 sm:flex-none"
                >
                  <MessageCircle className="h-6 w-6" /> {payment === 'pix' ? 'Já paguei — enviar pedido' : 'Finalizar Pedido via WhatsApp'}
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
