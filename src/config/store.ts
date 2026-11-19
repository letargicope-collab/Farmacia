/**
 * ============================================================================
 *  CONFIGURAÇÃO DA LOJA — dados oficiais da Farmácia São Marcos
 * ============================================================================
 */
import { FAMILY_SRC, LOGO_SRC } from '../assets/embedded';
import mascot from '../assets/mascote-sao-marcos.webp';
import mascotBlack from '../assets/mascote-campanha.webp';

/** Período de funcionamento: ['HH:MM', 'HH:MM'] */
export type Period = readonly [string, string];
/** 0 = domingo, 1 = segunda … 6 = sábado */
export type WeekSchedule = Readonly<Record<number, readonly Period[]>>;

const SEG_A_SAB_LOJA: readonly Period[] = [['07:00', '22:00']];
const SEG_A_SAB_ENTREGA: readonly Period[] = [['08:00', '21:30']];
const DOMINGO: readonly Period[] = [
  ['08:00', '12:00'],
  ['17:00', '21:00'],
];
const segundaASabado = (p: readonly Period[]) => ({ 1: p, 2: p, 3: p, 4: p, 5: p, 6: p });

export const STORE = {
  name: 'Farmácia São Marcos',
  slogan: 'A farmácia de toda a família',

  /** WhatsApp oficial: +55 82 9926-9126 (somente dígitos, exatamente como informado). */
  whatsappNumber: '558299269126',
  whatsappDisplay: '(82) 9926-9126',
  phoneDisplay: '(82) 9926-9126',
  phoneHref: 'tel:+558299269126',

  /* ⚠️ Preencher com os dados oficiais. Campos vazios ficam ocultos no site. */
  email: '',
  instagram: '',
  address: '',
  cityUf: '',
  cnpj: '',
  pharmacist: '',

  /** Fuso horário da farmácia (Alagoas, UTC−3). */
  timeZone: 'America/Maceio',

  /** Horários exibidos no site. */
  hours: [
    { days: 'Segunda a sábado', open: '7h às 22h', delivery: 'Entregas das 8h às 21h30' },
    { days: 'Domingo', open: '8h às 12h e 17h às 21h', delivery: 'Entrega nos dois horários' },
  ],

  /** Os mesmos horários, usados para mostrar "Aberto agora / Fechado" em tempo real. */
  schedule: {
    open: { 0: DOMINGO, ...segundaASabado(SEG_A_SAB_LOJA) } as WeekSchedule,
    delivery: { 0: DOMINGO, ...segundaASabado(SEG_A_SAB_ENTREGA) } as WeekSchedule,
  },
};

const FAMILY_FALLBACK =
  'https://images.pexels.com/photos/6149192/pexels-photo-6149192.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=733&w=1100';

/**
 * Identidade visual (cores da logo oficial: laranja #F8832B · índigo #3A3A92).
 * Logo e foto da família vêm embutidas no site (src/assets/embedded.ts);
 * as URLs on-line são só reserva.
 */
export const BRAND = {
  logo: LOGO_SRC || 'https://i.imgur.com/ijPs45n.png',
  family: FAMILY_SRC || FAMILY_FALLBACK,
  familyFallback: FAMILY_FALLBACK,
  /** Mascote institucional (camisa branca, fundo transparente). */
  mascot,
  /** Mascote da campanha "Esquenta Black São Marcos". */
  mascotBlack,
};
