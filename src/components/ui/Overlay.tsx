import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEscape, useScrollLock } from '../../hooks/common';
import { highlightParts } from '../../lib/search';

interface ShellProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}

/** Modal: folha inferior no celular, janela central no computador. */
export function Modal({ open, onClose, label, children, className = '' }: ShellProps) {
  useScrollLock(open);
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`relative max-h-[94dvh] w-full overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem] ${className}`}
            initial={{ y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 56, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Gaveta lateral (carrinho). */
export function Drawer({ open, onClose, label, children, className = '' }: ShellProps) {
  useScrollLock(open);
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl ${className}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CloseButton({ onClick, label = 'Fechar', className = '' }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 ${className}`}
    >
      <X className="h-6 w-6" />
    </button>
  );
}

export function Highlight({ text, query }: { text: string; query: string }) {
  const parts = highlightParts(text, query);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-primary-100 px-0.5 text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
