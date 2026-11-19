import { ArrowRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BRAND, STORE } from '../config/store';
import './opening-sequence.css';

const PLAY_MS = 4800;
const EXIT_MS = 480;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function OpeningSequence({ onFinish }: { onFinish: () => void }) {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION).matches);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const remaining = useRef(PLAY_MS);
  const scene = useRef<HTMLDivElement>(null);
  const stopped = paused || hidden;
  const leave = useCallback(() => setLeaving(true), []);

  useLayoutEffect(() => { scene.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION);
    const onMotionChange = () => {
      setReduced(media.matches);
      if (media.matches) setPaused(false);
    };
    const onVisibility = () => {
      setHidden(document.hidden);
      if (!document.hidden) onMotionChange();
    };
    media.addEventListener('change', onMotionChange);
    document.addEventListener('visibilitychange', onVisibility);
    onMotionChange();
    return () => {
      media.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (leaving) {
      const t = window.setTimeout(onFinish, reduced ? 0 : EXIT_MS);
      return () => window.clearTimeout(t);
    }
    if (stopped) return;
    const start = performance.now();
    const t = window.setTimeout(leave, reduced ? 750 : remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current = Math.max(0, remaining.current - (performance.now() - start));
    };
  }, [leaving, stopped, reduced, leave, onFinish]);

  return (
    <div ref={scene} className="sm-opening" role="dialog" aria-modal="true" tabIndex={-1}
      aria-label="Boas-vindas à Farmácia São Marcos" data-leaving={leaving} data-paused={stopped}
      style={{ '--opening-play': `${PLAY_MS}ms`, '--opening-exit': `${EXIT_MS}ms` } as CSSProperties}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); leave(); }
        if (e.key !== 'Tab') return;
        const controls = Array.from(scene.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        if (!controls.length) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === controls[0] || document.activeElement === scene.current)) {
          e.preventDefault(); controls[controls.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === controls[controls.length - 1]) {
          e.preventDefault(); controls[0].focus();
        }
      }}>
      <div className="opening-paper" aria-hidden="true" />
      <div className="opening-art" aria-hidden="true"><span className="opening-sun" /></div>
      <svg className="opening-orbit" viewBox="0 0 1600 1000" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path pathLength="1" d="M-95 928C208 698 192 1043 551 1052S858 632 1215 577C1483 535 1598 388 1703 202" />
        <path pathLength="1" d="M-118 963C184 738 210 1083 562 1082S877 660 1228 605C1493 561 1624 409 1728 234" />
      </svg>
      <div className="opening-rails">
        <header className="opening-top">
          <div className="opening-brand">
            <img src={BRAND.logo} width="687" height="170" alt={STORE.name} decoding="sync" fetchPriority="high" />
          </div>
          <button type="button" className="opening-skip" onClick={leave} disabled={leaving}>
            Pular abertura <ArrowRight size={17} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </header>

        <div className="opening-copy">
          <h1 className="opening-headline" aria-label={STORE.slogan}>
            <span className="opening-line"><span>A farmácia</span></span>{' '}
            <span className="opening-line"><span>de toda a</span></span>{' '}
            <span className="opening-line opening-family"><span>família<span className="opening-period">.</span></span></span>
          </h1>
          <div className="opening-greeting">
            <span className="opening-greeting-rule" aria-hidden="true" />
            <p>Boas-vindas à São Marcos.</p>
          </div>
        </div>

        <figure className="opening-portrait">
          <figcaption className="opening-autograph">
            <span>São Marquinhos</span>
            <svg viewBox="0 0 80 50" fill="none" aria-hidden="true">
              <path pathLength="1" d="M3 4C10 27 38 38 70 42M61 34L72 42L60 46" />
            </svg>
          </figcaption>
          <img className="opening-mascot" src={BRAND.mascot} alt="São Marquinhos sorrindo, com a mão estendida em boas-vindas"
            width="720" height="1080" decoding="sync" fetchPriority="high" />
        </figure>

        <footer className="opening-bottom">
          <div className="opening-time" aria-hidden="true">
            <span className="opening-track"><span /></span>
            <span>ABERTURA</span>
          </div>
          {!reduced && <button type="button" className="opening-pause" onClick={() => setPaused(v => !v)}
            disabled={leaving} aria-label={paused ? 'Continuar animação' : 'Pausar animação'} aria-pressed={paused}>
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            <span>{paused ? 'Continuar' : 'Pausar'}</span>
          </button>}
        </footer>
      </div>
    </div>
  );
}