import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { speak, useVoiceSearch } from '../hooks/useVoiceSearch';
import { focusVisibleSearch, usePersistentState } from '../hooks/common';
import { VoiceOverlay, type VoicePhase, type VoiceResult } from '../components/VoiceOverlay';
import { scrollToId, useCatalog, useUI } from './store';

interface VoiceContextValue {
  startVoice: () => void;
  supported: boolean;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { search } = useCatalog();
  const { applySearch, setQuery } = useUI();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [audioOn, setAudioOn] = usePersistentState('fsm:voice-audio', true);

  const voice = useVoiceSearch((alternatives) => {
    // Testa cada alternativa reconhecida e escolhe a que encontra produtos.
    const tried = alternatives.map((term) => ({ term, r: search.search(term) }));
    if (tried[0]?.r.care && !tried[0].r.total) {
      const { term } = tried[0];
      applySearch(term, false);
      setOpen(false);
      scrollToId('produtos');
      if (audioOn) speak('Não há produtos cadastrados para esse cuidado. Você pode falar com a farmácia.');
      return;
    }
    const best = tried.find((x) => x.r.total > 0 && !x.r.approximate) ?? tried.find((x) => x.r.total > 0);
    if (best) {
      const label = best.r.care?.label ?? best.term;
      setResult({ term: label, total: best.r.total, approximate: best.r.approximate });
      applySearch(best.term, false);
      if (audioOn) speak(`Encontrei ${best.r.total} ${best.r.total === 1 ? 'produto' : 'produtos'} para ${label}.`);
    } else {
      const term = alternatives[0] ?? '';
      setResult({ term, total: 0, approximate: false });
      setQuery(term);
      if (audioOn) speak(`Desculpe, não encontrei ${term}. Tente falar de novo, ou peça pelo WhatsApp.`);
    }
  });

  const { supported, start, cancel, stop, status, transcript, error } = voice;

  // Encontrou: mostra a confirmação e leva o cliente aos resultados.
  useEffect(() => {
    if (!open || !result || result.total === 0) return;
    const t = setTimeout(() => {
      setOpen(false);
      scrollToId('produtos');
    }, 1800);
    return () => clearTimeout(t);
  }, [open, result]);

  const startVoice = useCallback(() => {
    setResult(null);
    setOpen(true);
    if (supported) start(); // chamado no próprio clique (exigência dos navegadores)
  }, [supported, start]);

  const close = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel]);

  const retry = useCallback(() => {
    setResult(null);
    start();
  }, [start]);

  const typeInstead = useCallback(() => {
    cancel();
    setOpen(false);
    focusVisibleSearch();
  }, [cancel]);

  const seeResults = useCallback(() => {
    setOpen(false);
    scrollToId('produtos');
  }, []);

  let phase: VoicePhase;
  if (!supported) phase = 'unsupported';
  else if (result) phase = result.total > 0 ? 'found' : 'notfound';
  else if (status === 'error') phase = 'error';
  else if (status === 'processing') phase = 'processing';
  else phase = 'listening';

  return (
    <VoiceContext.Provider value={{ startVoice, supported }}>
      {children}
      <VoiceOverlay
        open={open}
        phase={phase}
        transcript={transcript}
        error={error}
        result={result}
        audioOn={audioOn}
        onToggleAudio={() => setAudioOn(!audioOn)}
        onClose={close}
        onRetry={retry}
        onStop={stop}
        onType={typeInstead}
        onSeeResults={seeResults}
      />
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice precisa estar dentro de <VoiceProvider>');
  return ctx;
}
