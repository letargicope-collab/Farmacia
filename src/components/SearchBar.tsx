import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MessageCircle, Mic, Search, SearchX, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDebounced } from '../hooks/common';
import { CATEGORY_BY_ID, type Product } from '../lib/catalog';
import { brl, intBR } from '../lib/format';
import { notFoundMessage, waUrl } from '../lib/whatsapp';
import { useCatalog, useUI } from '../state/store';
import { useVoice } from '../state/voice';
import { ProductVisual } from './ProductVisual';
import { Highlight } from './ui/Overlay';

/**
 * Barra de pesquisa fixa no topo (cabeçalho): digitação com autocompletar a partir de
 * 2 letras + microfone. É a única pesquisa da página, sempre acessível ao rolar.
 */
export function SearchBar({ compact = false }: { compact?: boolean }) {
  const { search } = useCatalog();
  const ui = useUI();
  const { startVoice } = useVoice();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listId = `${inputId}-lista`;

  const debounced = useDebounced(ui.query, 110);
  const term = debounced.trim();
  const result = useMemo(() => (term.length >= 2 ? search.search(term, 7) : null), [term, search]);

  useEffect(() => setActive(-1), [term]);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  const submit = (value = ui.query) => {
    const t = value.trim();
    if (!t) {
      inputRef.current?.focus();
      return;
    }
    ui.applySearch(t, true);
    setOpen(false);
    inputRef.current?.blur();
  };

  const pick = (p: Product) => {
    setOpen(false);
    ui.openProduct(p);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const items = result?.items ?? [];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && items[active]) pick(items[active]);
      else submit();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown = open && term.length >= 2 && result !== null;

  return (
    <div ref={wrapRef} className="relative w-full min-w-0 max-w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="group relative flex items-center rounded-2xl bg-white p-1.5 pl-4 shadow-sm ring-1 ring-slate-200 transition focus-within:ring-4 focus-within:ring-primary-200"
      >
        <Search className="h-5 w-5 shrink-0 text-secondary-500" aria-hidden="true" />
        <label htmlFor={inputId} className="sr-only">
          Buscar remédios e produtos
        </label>
        <input
          id={inputId}
          ref={inputRef}
          data-search-input="header"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          value={ui.query}
          onChange={(e) => {
            ui.setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={compact ? 'Remédio ou produto' : 'Remédio, princípio ativo ou marca...'}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
        />
        {ui.query && (
          <button
            type="button"
            onClick={() => {
              ui.setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Limpar o que foi digitado"
            className="mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={startVoice}
          aria-label="Pesquisar falando (microfone)"
          title="Pesquisar falando"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md shadow-primary-600/30 transition hover:brightness-105 active:scale-95"
        >
          <span className="mic-pulse absolute inset-0 rounded-xl" aria-hidden="true" />
          <Mic className="h-5 w-5" />
        </button>
      </form>

      <AnimatePresence>
        {showDropdown && result && (
          <motion.div
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-[60] overflow-hidden rounded-3xl bg-white text-left shadow-2xl ring-1 ring-slate-200"
          >
            {result.total === 0 ? (
              <div className="p-6 text-center">
                <SearchX className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-2 text-lg font-bold text-slate-900">Não encontramos “{term}”</p>
                <p className="mt-1 text-base text-slate-600">Confira a escrita, busque pelo princípio ativo ou fale com a gente.</p>
                <a
                  href={waUrl(notFoundMessage(term))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-green-600 px-5 text-base font-bold text-white hover:bg-green-700"
                >
                  <MessageCircle className="h-5 w-5" /> Pedir pelo WhatsApp
                </a>
              </div>
            ) : (
              <>
                {result.approximate && (
                  <p className="border-b border-slate-100 bg-primary-50 px-5 py-2.5 text-sm font-semibold text-primary-800">
                    Mostrando resultados parecidos com “{term}”
                  </p>
                )}
                <ul className="max-h-[min(60vh,460px)] overflow-y-auto p-2">
                  {result.items.map((p, i) => (
                    <li key={p.id} role="option" aria-selected={i === active}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(p)}
                        className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${i === active ? 'bg-primary-50' : 'hover:bg-slate-50'}`}
                      >
                        <span className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-b from-slate-50 to-primary-50/60 p-0.5">
                          <ProductVisual product={p} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-semibold text-slate-900">
                            <Highlight text={p.name} query={term} />
                          </span>
                          <span className="block truncate text-sm text-slate-500">
                            {p.formula ? `Princípio ativo: ${p.formula}` : CATEGORY_BY_ID[p.category].label}
                            {p.brand ? ` · ${p.brand}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-base font-extrabold text-primary-600">{brl(p.price)}</span>
                          {!p.inStock ? (
                            <span className="text-xs font-semibold text-slate-500">Indisponível</span>
                          ) : p.discount > 0 ? (
                            <span className="text-xs font-bold text-primary-700">-{p.discount}%</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => submit(term)}
                  className="flex w-full items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 text-base font-bold text-secondary-700 transition hover:bg-secondary-50"
                >
                  Ver {result.total === 1 ? 'o resultado' : `todos os ${intBR(result.total)} resultados`} para “{term}”
                  <ArrowRight className="h-5 w-5" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
