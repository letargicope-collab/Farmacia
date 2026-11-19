import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, Keyboard, LoaderCircle, MessageCircle, Mic, MicOff, RotateCcw, SearchX, Volume2, VolumeX, X } from 'lucide-react';
import { useState } from 'react';
import { BRAND } from '../config/store';
import { useEscape, useScrollLock } from '../hooks/common';
import { intBR } from '../lib/format';
import { notFoundMessage, waUrl } from '../lib/whatsapp';

export type VoicePhase = 'listening' | 'processing' | 'found' | 'notfound' | 'error' | 'unsupported';

export interface VoiceResult {
  term: string;
  total: number;
  approximate: boolean;
}

interface VoiceOverlayProps {
  open: boolean;
  phase: VoicePhase;
  transcript: string;
  error: string;
  result: VoiceResult | null;
  audioOn: boolean;
  onToggleAudio: () => void;
  onClose: () => void;
  onRetry: () => void;
  onStop: () => void;
  onType: () => void;
  onSeeResults: () => void;
}

const inInstagram = () => typeof navigator !== 'undefined' && /Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent);

const bigBtn = 'inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl px-6 text-lg font-bold transition active:scale-[0.98]';

export function VoiceOverlay(props: VoiceOverlayProps) {
  const { open, phase, transcript, error, result, audioOn, onToggleAudio, onClose, onRetry, onStop, onType, onSeeResults } = props;
  useScrollLock(open);
  useEscape(open, onClose);
  const [avatarOk, setAvatarOk] = useState(true);

  const titles: Record<VoicePhase, string> = {
    listening: 'Fale o nome do remédio ou produto...',
    processing: 'Entendi! Procurando para você...',
    found: `Encontrei ${intBR(result?.total ?? 0)} ${result?.total === 1 ? 'produto' : 'produtos'}!`,
    notfound: 'Não encontrei esse produto',
    error: 'Não consegui ouvir',
    unsupported: 'A busca por voz não funciona neste navegador',
  };

  const shownText = result?.term || transcript;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Busca por voz"
          className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-gradient-to-b from-white via-primary-50 to-secondary-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-5 pt-5">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-full bg-white shadow-md ring-4 ring-primary-200">
                {avatarOk ? (
                  <img
                    src={BRAND.mascot}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarOk(false)}
                    className="absolute left-1/2 top-[-3px] w-[185%] max-w-none -translate-x-1/2"
                  />
                ) : (
                  <Mic className="absolute inset-0 m-auto h-7 w-7 text-primary-600" />
                )}
              </div>
              <div className="text-left">
                <p className="text-lg font-extrabold text-secondary-800">Assistente de voz</p>
                <p className="text-sm font-medium text-slate-600">O Marcos ajuda você a encontrar</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar busca por voz"
              className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-700 shadow ring-1 ring-slate-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-8 text-center" aria-live="polite">
            <div className="relative grid h-40 w-40 place-items-center">
              {phase === 'listening' && (
                <>
                  <span className="voice-ring absolute inset-0 rounded-full bg-primary-400/30" />
                  <span className="voice-ring absolute inset-0 rounded-full bg-primary-400/25 [animation-delay:0.6s]" />
                  <span className="voice-ring absolute inset-0 rounded-full bg-secondary-400/20 [animation-delay:1.2s]" />
                </>
              )}
              <button
                type="button"
                onClick={phase === 'listening' ? onStop : phase === 'unsupported' ? onType : onRetry}
                aria-label={phase === 'listening' ? 'Parar de ouvir' : 'Tentar de novo'}
                className={`relative grid h-32 w-32 place-items-center rounded-full text-white shadow-2xl transition ${
                  phase === 'found'
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                    : phase === 'error'
                      ? 'bg-gradient-to-br from-rose-500 to-rose-700'
                      : phase === 'notfound' || phase === 'unsupported'
                        ? 'bg-gradient-to-br from-secondary-500 to-secondary-800'
                        : 'bg-gradient-to-br from-primary-500 to-primary-700'
                }`}
              >
                {phase === 'found' ? (
                  <CircleCheck className="h-16 w-16" />
                ) : phase === 'processing' ? (
                  <LoaderCircle className="h-16 w-16 animate-spin" />
                ) : phase === 'notfound' ? (
                  <SearchX className="h-16 w-16" />
                ) : phase === 'error' ? (
                  <MicOff className="h-16 w-16" />
                ) : phase === 'unsupported' ? (
                  <Keyboard className="h-16 w-16" />
                ) : (
                  <Mic className="h-16 w-16" />
                )}
              </button>
            </div>

            {phase === 'listening' && (
              <div className="mt-6 flex h-10 items-end gap-1.5" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span key={i} className="eq-bar w-2 rounded-full bg-primary-500" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            )}

            <h2 className="mt-6 text-[1.7rem] font-extrabold leading-tight text-slate-900 sm:text-3xl">{titles[phase]}</h2>

            {phase !== 'unsupported' && (
              <div className="mt-5 w-full rounded-3xl bg-white/90 px-5 py-5 shadow-sm ring-1 ring-slate-200">
                {shownText ? (
                  <p className="text-2xl font-bold text-secondary-800">“{shownText}”</p>
                ) : (
                  <p className="text-lg text-slate-600">
                    Exemplos: <strong>“Dipirona”</strong>, <strong>“Fralda geriátrica”</strong>, <strong>“Vitamina C”</strong>
                  </p>
                )}
                {phase === 'found' && result?.approximate && (
                  <p className="mt-2 text-base font-medium text-primary-700">Mostrando resultados parecidos.</p>
                )}
              </div>
            )}

            {phase === 'error' && <p className="mt-4 text-lg font-medium text-rose-700">{error}</p>}

            {phase === 'unsupported' && (
              <div className="mt-5 w-full space-y-3 rounded-3xl bg-white p-5 text-left text-lg text-slate-700 shadow-sm ring-1 ring-slate-200">
                <p>
                  💡 <strong>Dica:</strong> toque no campo de busca e use o <strong>microfone 🎤 do teclado</strong> do seu celular para ditar o nome do remédio.
                </p>
                {inInstagram() && (
                  <p>
                    📱 Você está no navegador do Instagram. Toque em <strong>⋯</strong> no canto da tela e escolha <strong>“Abrir no navegador”</strong> para usar a voz.
                  </p>
                )}
              </div>
            )}

            <div className="mt-7 grid w-full gap-3">
              {phase === 'listening' && (
                <>
                  <button type="button" onClick={onStop} className={`${bigBtn} bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700`}>
                    <CircleCheck className="h-6 w-6" /> Pronto, terminei de falar
                  </button>
                  <button type="button" onClick={onClose} className={`${bigBtn} bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50`}>
                    Cancelar
                  </button>
                </>
              )}
              {phase === 'found' && (
                <button type="button" onClick={onSeeResults} className={`${bigBtn} bg-secondary-700 text-white hover:bg-secondary-800`}>
                  Ver os resultados
                </button>
              )}
              {(phase === 'notfound' || phase === 'error') && (
                <>
                  <button type="button" onClick={onRetry} className={`${bigBtn} bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700`}>
                    <RotateCcw className="h-6 w-6" /> Tentar de novo
                  </button>
                  <button type="button" onClick={onType} className={`${bigBtn} bg-white text-secondary-800 ring-1 ring-slate-300 hover:bg-slate-50`}>
                    <Keyboard className="h-6 w-6" /> Digitar o nome
                  </button>
                </>
              )}
              {phase === 'notfound' && (
                <a
                  href={waUrl(notFoundMessage(result?.term || transcript))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${bigBtn} bg-green-600 text-white hover:bg-green-700`}
                >
                  <MessageCircle className="h-6 w-6" /> Pedir pelo WhatsApp
                </a>
              )}
              {phase === 'unsupported' && (
                <button type="button" onClick={onType} className={`${bigBtn} bg-primary-600 text-white hover:bg-primary-700`}>
                  <Keyboard className="h-6 w-6" /> Digitar o nome do remédio
                </button>
              )}
            </div>
          </div>

          {phase !== 'unsupported' && (
            <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
              <button
                type="button"
                onClick={onToggleAudio}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/80 px-5 text-base font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                {audioOn ? <Volume2 className="h-5 w-5 text-primary-600" /> : <VolumeX className="h-5 w-5" />}
                Respostas faladas: {audioOn ? 'ligadas' : 'desligadas'}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
