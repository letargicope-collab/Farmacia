import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================================
 *  BUSCA POR VOZ — Web Speech API (pt-BR)
 *  Chrome/Edge (desktop e Android) e Safari (iOS 14.5+). Em navegadores sem
 *  suporte, a interface orienta o uso do microfone do teclado do celular.
 * ==========================================================================*/

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'error';

interface SpeechAlternativeLike {
  transcript: string;
}
interface SpeechResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternativeLike;
}
interface SpeechEventLike {
  results: { length: number; [index: number]: SpeechResultLike };
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_TEXT: Record<string, string> = {
  'not-allowed':
    'O microfone está bloqueado. Toque no cadeado 🔒 ao lado do endereço do site e permita o uso do microfone.',
  'service-not-allowed': 'A busca por voz não está liberada neste navegador. Tente pelo Chrome ou Safari.',
  'no-speech': 'Não ouvi nada. Toque em “Tentar de novo” e fale perto do celular.',
  'audio-capture': 'Não encontrei um microfone neste aparelho.',
  network: 'Sem internet para reconhecer a voz. Verifique sua conexão e tente novamente.',
  'language-not-supported': 'O português não está disponível para voz neste navegador.',
};

export function useVoiceSearch(onFinal: (alternatives: string[]) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef<RecognitionLike | null>(null);
  const altsRef = useRef<string[]>([]);
  const lastTextRef = useRef('');
  const stoppedRef = useRef(false);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const supported = getRecognition() !== null;

  const cancel = useCallback(() => {
    stoppedRef.current = true;
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 4;
    altsRef.current = [];
    lastTextRef.current = '';
    stoppedRef.current = false;
    setTranscript('');
    setError('');
    setStatus('listening');

    rec.onresult = (event) => {
      let finalText = '';
      let interim = '';
      let lastFinal: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
          lastFinal = [];
          for (let k = 0; k < res.length; k++) lastFinal.push(res[k].transcript.trim());
        } else {
          interim += res[0].transcript;
        }
      }
      const shown = `${finalText} ${interim}`.replace(/\s+/g, ' ').trim();
      lastTextRef.current = shown;
      setTranscript(shown);
      const full = finalText.trim();
      if (full) altsRef.current = [full, ...lastFinal.filter((a) => a && a !== full)];
    };

    rec.onerror = (event) => {
      if (event.error === 'aborted') return;
      stoppedRef.current = true;
      setError(ERROR_TEXT[event.error] ?? 'Não foi possível usar o microfone agora. Tente novamente.');
      setStatus('error');
    };

    rec.onend = () => {
      recRef.current = null;
      if (stoppedRef.current) return;
      const alts = altsRef.current.length ? altsRef.current : lastTextRef.current ? [lastTextRef.current] : [];
      if (alts.length) {
        setStatus('processing');
        onFinalRef.current(alts);
      } else {
        setError('Não consegui entender. Toque em “Tentar de novo” e fale devagar, perto do celular.');
        setStatus('error');
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError('Não foi possível iniciar o microfone. Tente novamente.');
      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { supported, status, transcript, error, start, stop, cancel };
}

/** Retorno em áudio (síntese de voz em português). */
export function speak(text: string) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 0.95;
    const voices = synth.getVoices();
    const voice = voices.find((v) => /pt[-_]BR/i.test(v.lang)) ?? voices.find((v) => /^pt/i.test(v.lang));
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    /* sem áudio */
  }
}
