import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { lsGet, lsSet } from '../lib/storage';

/** useState sincronizado com o localStorage. */
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => lsGet<T>(key, initial));
  useEffect(() => {
    lsSet(key, value);
  }, [key, value]);
  return [value, setValue];
}

export function useDebounced<T>(value: T, delay = 150): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

let scrollLocks = 0;
/** Trava a rolagem da página enquanto modais/gavetas estão abertos. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    scrollLocks++;
    document.documentElement.setAttribute('data-scroll-locked', '');
    return () => {
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.documentElement.removeAttribute('data-scroll-locked');
    };
  }, [active]);
}

export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}

/** Foca o campo de pesquisa que está visível (o foco na hora do toque abre o teclado do celular). */
export function focusVisibleSearch() {
  const input = Array.from(document.querySelectorAll<HTMLInputElement>('[data-search-input]')).find((el) => el.offsetParent !== null);
  input?.focus();
}
