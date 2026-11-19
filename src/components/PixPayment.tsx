import { Check, Copy, KeyRound, ShieldCheck, Truck } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PIX } from '../config/pix';
import { copyText } from '../lib/clipboard';
import { brl } from '../lib/format';
import { qrDrawing } from '../lib/qr';

type CopyState = 'code' | 'key' | 'fail' | null;

/** Etapa "Pague com PIX": QR Code + Pix Copia e Cola com o valor exato do pedido. */
export function PixPayment({ amount, orderId, payload }: { amount: number; orderId: string; payload: string | null }) {
  const [copied, setCopied] = useState<CopyState>(null);
  const qr = useMemo(() => {
    if (!payload) return null;
    try {
      return qrDrawing(payload);
    } catch {
      return null;
    }
  }, [payload]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), copied === 'fail' ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (text: string, what: 'code' | 'key') => setCopied((await copyText(text)) ? what : 'fail');

  const keyButton = (
    <button
      type="button"
      onClick={() => void copy(PIX.chave, 'key')}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-secondary-700 ring-2 ring-secondary-200 transition hover:bg-secondary-50"
    >
      {copied === 'key' ? <Check className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
      {copied === 'key' ? 'Chave copiada!' : 'Copiar chave PIX (CNPJ)'}
    </button>
  );

  const steps: ReactNode[] = [
    <>
      Toque em <strong>“Copiar código Pix”</strong> (ou escaneie o QR Code com outro celular).
    </>,
    <>
      No app do seu banco, abra o <strong>Pix</strong> e escolha <strong>“Pix Copia e Cola”</strong> (ou “Ler QR Code”).
    </>,
    <>
      Confira o recebedor <strong>{PIX.recebedor}</strong> e o valor <strong>{brl(amount)}</strong>, e confirme o pagamento.
    </>,
    <>
      Volte aqui e toque em <strong>“Já paguei — enviar pedido”</strong>.
    </>,
  ];

  return (
    <section aria-label="Pagamento com PIX" className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-700 to-secondary-900 p-5 text-white shadow-lg sm:p-6">
        <div className="cross-pattern-light absolute inset-0 opacity-[0.07]" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-secondary-200">Valor a pagar</p>
            <p className="text-4xl font-extrabold leading-tight sm:text-5xl">{brl(amount)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-semibold text-secondary-200">Recebedor</p>
            <p className="text-xl font-extrabold leading-tight">{PIX.recebedor}</p>
            <p className="text-sm text-secondary-100">Chave PIX (CNPJ): {PIX.chaveExibicao}</p>
          </div>
        </div>
      </div>

      {qr && payload ? (
        <div className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <figure className="mx-auto w-fit rounded-3xl bg-white p-3 shadow-[0_18px_40px_-20px_rgba(58,58,146,0.55)] ring-1 ring-slate-200">
            <svg
              viewBox={`0 0 ${qr.dim} ${qr.dim}`}
              className="h-52 w-52 sm:h-56 sm:w-56"
              role="img"
              aria-label={`QR Code do PIX de ${brl(amount)} para ${PIX.recebedor}`}
              shapeRendering="crispEdges"
            >
              <rect width={qr.dim} height={qr.dim} fill="#ffffff" />
              <path d={qr.path} fill="#000000" />
            </svg>
            <figcaption className="mt-1 text-center text-sm font-bold text-slate-600">Escaneie no app do banco</figcaption>
          </figure>

          <div className="min-w-0 space-y-3">
            <p className="text-base font-extrabold text-slate-900">Pix Copia e Cola</p>
            <p className="max-h-24 select-all overflow-y-auto break-all rounded-2xl bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
              {payload}
            </p>
            <button
              type="button"
              onClick={() => void copy(payload, 'code')}
              className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-lg font-bold text-white shadow-lg transition ${
                copied === 'code' ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-gradient-to-r from-primary-600 to-primary-700 shadow-primary-600/30 hover:brightness-105'
              }`}
            >
              {copied === 'code' ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
              {copied === 'code' ? 'Código copiado!' : 'Copiar código Pix'}
            </button>
            {keyButton}
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-3xl bg-primary-50 p-4 text-base text-primary-950 ring-1 ring-primary-200">
          <p>
            Faça o PIX para a chave CNPJ <strong>{PIX.chaveExibicao}</strong> ({PIX.recebedor}) no valor de <strong>{brl(amount)}</strong>.
          </p>
          {keyButton}
        </div>
      )}

      {copied === 'fail' && (
        <p role="alert" className="rounded-2xl bg-rose-50 p-3 text-base font-semibold text-rose-800 ring-1 ring-rose-200">
          Não foi possível copiar automaticamente. Toque e segure no código para copiar.
        </p>
      )}

      <ol className="space-y-2.5 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5" aria-label="Como pagar">
        {steps.map((content, i) => (
          <li key={i} className="flex gap-3 text-base text-slate-700">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary-700 text-sm font-extrabold text-white">{i + 1}</span>
            <span className="pt-0.5">{content}</span>
          </li>
        ))}
      </ol>

      <p className="flex gap-2.5 rounded-2xl bg-emerald-50 p-4 text-base text-emerald-900 ring-1 ring-emerald-200">
        <Truck className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <strong>Seu pedido é enviado após a confirmação do pagamento.</strong> A mensagem do WhatsApp já vai com o PIX informado: a atendente só confere se o
          pagamento chegou e libera a entrega.
        </span>
      </p>
      <p className="flex gap-2 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-secondary-600" />
        <span>
          Antes de confirmar, veja se o recebedor é <strong>{PIX.recebedor}</strong> (CNPJ {PIX.chaveExibicao}). Em caso de dúvida, fale com a farmácia antes de pagar.
        </span>
      </p>
      <p className="text-sm text-slate-500">
        Identificador do pedido: <strong className="font-mono text-slate-700">{orderId}</strong>
      </p>
    </section>
  );
}
