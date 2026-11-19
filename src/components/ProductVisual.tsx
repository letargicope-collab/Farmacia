import { useId } from 'react';
import type { CategoryId, Product } from '../lib/catalog';

/* ============================================================================
 *  EMBALAGEM ILUSTRADA EM SVG (pseudo-3D)
 *  Exibida enquanto o produto não tem render 3D gerado pelo pipeline
 *  (src/lib/image3d.ts). Leve, nítida e consistente para 12 mil itens.
 *  Genéricos recebem a faixa amarela com "G", como nas embalagens reais.
 * ==========================================================================*/

interface Palette {
  main: string;
  dark: string;
  light: string;
}

const PALETTES: Palette[] = [
  { main: '#3A3A92', dark: '#25255E', light: '#7F82D3' }, // índigo da marca
  { main: '#F8832B', dark: '#C1520E', light: '#FDB175' }, // laranja da marca
  { main: '#2563EB', dark: '#1E3A8A', light: '#93C5FD' },
  { main: '#0EA5E9', dark: '#075985', light: '#7DD3FC' },
  { main: '#E11D48', dark: '#9F1239', light: '#FDA4AF' },
  { main: '#7C3AED', dark: '#4C1D95', light: '#C4B5FD' },
  { main: '#0D9488', dark: '#134E4A', light: '#5EEAD4' },
];

const BY_CATEGORY: Record<CategoryId, number[]> = {
  medicamentos: [0, 2, 3, 1],
  genericos: [0, 2],
  vitaminas: [1, 6, 0],
  beleza: [4, 5, 3, 1],
  higiene: [3, 2, 6],
  infantil: [3, 1, 4],
  saude: [0, 2, 6],
  conveniencia: [1, 4, 5],
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
/** Tamanho de fonte para caber na largura disponível. */
const fit = (text: string, width: number, max: number) => Math.min(max, width / Math.max(1, text.length * 0.66));

interface ShapeProps {
  p: Palette;
  uid: string;
  title: string;
  subtitle: string;
  dose: string;
  generic: boolean;
  controlled: boolean;
}

function Cross({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M4 0h4v4h4v4H8v4H4V8H0V4h4z" fill="#F8832B" />
      <circle cx="6" cy="6" r="2.2" fill="#3A3A92" />
    </g>
  );
}

function Box({ p, uid, title, subtitle, dose, generic, controlled, device }: ShapeProps & { device?: boolean }) {
  const ink = device ? '#ffffff' : p.dark;
  return (
    <g>
      <polygon points="34,64 56,46 170,46 148,64" fill={device ? p.light : '#f8fafc'} stroke="#e2e8f0" strokeWidth="0.6" />
      <polygon points="148,64 170,46 170,150 148,168" fill={p.dark} />
      <polygon points="148,64 170,46 170,58 148,76" fill="#ffffff" opacity="0.12" />
      <rect x="34" y="64" width="114" height="104" rx="3" fill={device ? p.main : `url(#face-${uid})`} />
      {!device && <path d="M34 128 C 70 112, 104 146, 148 118 L148 168 L34 168 Z" fill={p.main} />}
      {!device && <path d="M34 142 C 72 128, 106 158, 148 134 L148 168 L34 168 Z" fill={p.dark} opacity="0.35" />}
      {device && <circle cx="128" cy="140" r="34" fill="#ffffff" opacity="0.12" />}
      <Cross x={130} y={70} />
      <text x="42" y="88" fontSize={fit(title, 84, 15)} fontWeight="800" fill={ink} letterSpacing="0.2">
        {title}
      </text>
      <text x="42" y="101" fontSize="8.5" fontWeight="600" fill={device ? 'rgba(255,255,255,0.88)' : '#475569'}>
        {subtitle}
      </text>
      {dose && (
        <g>
          <rect x="42" y="107" width={dose.length * 5.4 + 14} height="15" rx="7.5" fill={device ? '#ffffff' : p.main} />
          <text x="49" y="118" fontSize="8.6" fontWeight="800" fill={device ? p.dark : '#ffffff'}>
            {dose}
          </text>
        </g>
      )}
      {generic && (
        <g>
          <rect x="34" y="146" width="114" height="22" fill="#FACC15" />
          <rect x="40" y="149" width="16" height="16" rx="2" fill="#1E3A8A" />
          <text x="44.2" y="161.6" fontSize="12.5" fontWeight="900" fill="#ffffff">
            G
          </text>
          <text x="61" y="160" fontSize="7" fontWeight="800" fill="#1E3A8A">
            MEDICAMENTO GENÉRICO
          </text>
        </g>
      )}
      {controlled && !generic && (
        <g>
          <rect x="34" y="151" width="114" height="17" fill="#0f172a" />
          <text x="40" y="162.5" fontSize="6.3" fontWeight="800" fill="#ffffff">
            VENDA SOB PRESCRIÇÃO MÉDICA
          </text>
        </g>
      )}
      <rect x="34" y="64" width="46" height="104" fill={`url(#gloss-${uid})`} opacity="0.55" />
      <rect x="34" y="64" width="114" height="104" rx="3" fill="none" stroke="rgba(15,23,42,0.08)" />
    </g>
  );
}

function Bottle({ p, uid, title, subtitle, dose }: ShapeProps) {
  return (
    <g>
      <rect x="82" y="24" width="36" height="24" rx="5" fill={`url(#cap-${uid})`} stroke="#cbd5e1" strokeWidth="0.8" />
      <rect x="84" y="28" width="32" height="3" rx="1.5" fill="#ffffff" opacity="0.7" />
      <path
        d="M88 48 H112 V58 Q112 64 120 68 Q134 75 134 90 V160 Q134 174 120 174 H80 Q66 174 66 160 V90 Q66 75 80 68 Q88 64 88 58 Z"
        fill={`url(#body-${uid})`}
      />
      <rect x="70" y="98" width="60" height="58" rx="7" fill="#ffffff" />
      <Cross x={115} y={102} s={0.75} />
      <text x="100" y="124" textAnchor="middle" fontSize={fit(title, 50, 12)} fontWeight="800" fill={p.dark}>
        {title}
      </text>
      <text x="100" y="135" textAnchor="middle" fontSize="7" fontWeight="600" fill="#64748b">
        {clip(subtitle, 14)}
      </text>
      {dose && (
        <text x="100" y="149" textAnchor="middle" fontSize="9" fontWeight="800" fill={p.main}>
          {dose}
        </text>
      )}
      <rect x="72" y="76" width="6" height="88" rx="3" fill="#ffffff" opacity="0.35" />
    </g>
  );
}

function Tube({ p, uid, title, subtitle, dose }: ShapeProps) {
  return (
    <g>
      <rect x="60" y="26" width="80" height="14" rx="2" fill={p.light} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={64 + i * 11} y="28" width="4" height="10" rx="1" fill={p.dark} opacity="0.18" />
      ))}
      <path d="M62 40 H138 L128 144 Q127 150 120 150 H80 Q73 150 72 144 Z" fill={`url(#body-${uid})`} />
      <rect x="76" y="66" width="48" height="60" rx="7" fill="#ffffff" />
      <Cross x={111} y={70} s={0.7} />
      <text x="100" y="92" textAnchor="middle" fontSize={fit(title, 40, 11)} fontWeight="800" fill={p.dark}>
        {title}
      </text>
      <text x="100" y="103" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#64748b">
        {clip(subtitle, 13)}
      </text>
      {dose && (
        <text x="100" y="117" textAnchor="middle" fontSize="8.5" fontWeight="800" fill={p.main}>
          {dose}
        </text>
      )}
      <rect x="80" y="148" width="40" height="30" rx="6" fill={p.dark} />
      <rect x="84" y="150" width="6" height="26" rx="3" fill="#ffffff" opacity="0.2" />
      <rect x="68" y="44" width="5" height="96" rx="2.5" fill="#ffffff" opacity="0.3" />
    </g>
  );
}

function Jar({ p, uid, title, subtitle, dose }: ShapeProps) {
  return (
    <g>
      <rect x="50" y="50" width="100" height="28" rx="7" fill={`url(#cap-${uid})`} stroke="#cbd5e1" strokeWidth="0.8" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={56 + i * 12} y="54" width="2" height="20" rx="1" fill="#94a3b8" opacity="0.35" />
      ))}
      <rect x="54" y="76" width="92" height="98" rx="12" fill={`url(#body-${uid})`} />
      <rect x="54" y="98" width="92" height="54" fill="#ffffff" />
      <Cross x={128} y={102} s={0.75} />
      <text x="100" y="122" textAnchor="middle" fontSize={fit(title, 74, 14)} fontWeight="800" fill={p.dark}>
        {title}
      </text>
      <text x="100" y="134" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#64748b">
        {clip(subtitle, 18)}
      </text>
      {dose && (
        <text x="100" y="147" textAnchor="middle" fontSize="9" fontWeight="800" fill={p.main}>
          {dose}
        </text>
      )}
      <rect x="60" y="80" width="7" height="90" rx="3.5" fill="#ffffff" opacity="0.3" />
    </g>
  );
}

function Pack({ p, uid, title, subtitle, dose }: ShapeProps) {
  return (
    <g>
      <path d="M44 62 Q100 44 156 62 L162 164 Q100 180 38 164 Z" fill={`url(#body-${uid})`} />
      <path d="M44 62 Q100 44 156 62 L157 76 Q100 60 43 76 Z" fill="#ffffff" opacity="0.28" />
      <ellipse cx="100" cy="117" rx="47" ry="31" fill="#ffffff" />
      <Cross x={92} y={92} s={0.8} />
      <text x="100" y="118" textAnchor="middle" fontSize={fit(title, 76, 14)} fontWeight="800" fill={p.dark}>
        {title}
      </text>
      <text x="100" y="129" textAnchor="middle" fontSize="7.2" fontWeight="600" fill="#64748b">
        {clip(subtitle, 18)}
      </text>
      {dose && (
        <text x="100" y="140" textAnchor="middle" fontSize="8" fontWeight="800" fill={p.main}>
          {dose}
        </text>
      )}
      <circle cx="62" cy="152" r="5" fill="#ffffff" opacity="0.35" />
      <circle cx="140" cy="80" r="4" fill="#ffffff" opacity="0.35" />
      <circle cx="146" cy="150" r="3" fill="#ffffff" opacity="0.35" />
    </g>
  );
}

export function ProductVisual({ product, className = '' }: { product: Product; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt={product.name} loading="lazy" className={`h-full w-full object-contain ${className}`} />;
  }
  const options = BY_CATEGORY[product.category];
  const p = PALETTES[options[hash(product.code) % options.length]];
  const words = product.name.replace(/[()]/g, '').split(' ').filter(Boolean);
  const props: ShapeProps = {
    p,
    uid,
    title: clip((words[0] ?? '').toUpperCase(), 11),
    subtitle: clip(words.slice(1, 3).join(' '), 18),
    dose: product.dosage,
    generic: product.category === 'genericos',
    controlled: product.controlled,
  };
  return (
    <svg viewBox="0 0 200 200" className={`h-full w-full ${className}`} role="img" aria-label={`Embalagem ilustrativa de ${product.name}`}>
      <defs>
        <radialGradient id={`sh-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`body-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={p.light} />
          <stop offset="38%" stopColor={p.main} />
          <stop offset="100%" stopColor={p.dark} />
        </linearGradient>
        <linearGradient id={`face-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2f7" />
        </linearGradient>
        <linearGradient id={`cap-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dbe3ee" />
        </linearGradient>
        <linearGradient id={`gloss-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="182" rx="66" ry="9" fill={`url(#sh-${uid})`} />
      {product.visual === 'bottle' ? (
        <Bottle {...props} />
      ) : product.visual === 'tube' ? (
        <Tube {...props} />
      ) : product.visual === 'jar' ? (
        <Jar {...props} />
      ) : product.visual === 'pack' ? (
        <Pack {...props} />
      ) : (
        <Box {...props} device={product.visual === 'device'} />
      )}
    </svg>
  );
}
