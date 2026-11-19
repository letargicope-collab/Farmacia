import { useEffect, useState } from 'react';
import { STORE, type WeekSchedule } from '../config/store';

/* ============================================================================
 *  HORÁRIO DE FUNCIONAMENTO E ENTREGAS — "Aberto agora / Fechado"
 *  Calculado sempre no fuso da farmácia (America/Maceio, UTC−3),
 *  independentemente do relógio/fuso do aparelho do cliente.
 * ==========================================================================*/

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** "21:30" → "21h30" · "08:00" → "8h" */
export const formatHour = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h}h${m ? String(m).padStart(2, '0') : ''}`;
};

export interface ZonedTime {
  day: number;
  minutes: number;
}

/** Dia da semana e minuto atual no fuso da farmácia. */
export function zonedNow(date: Date = new Date()): ZonedTime {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: STORE.timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = WEEKDAYS.indexOf(get('weekday'));
    const hour = Number(get('hour')) % 24;
    const minute = Number(get('minute'));
    if (day >= 0 && Number.isFinite(hour) && Number.isFinite(minute)) return { day, minutes: hour * 60 + minute };
  } catch {
    /* navegador sem suporte a fuso horário: usa UTC−3 */
  }
  const d = new Date(date.getTime() - 3 * 3_600_000);
  return { day: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

interface Slot {
  start: number;
  end: number;
  from: string;
  to: string;
}

const slotsOf = (s: WeekSchedule, day: number): Slot[] =>
  (s[day] ?? []).map(([from, to]) => ({ start: toMinutes(from), end: toMinutes(to), from, to }));

const currentSlot = (s: WeekSchedule, t: ZonedTime) => slotsOf(s, t.day).find((x) => t.minutes >= x.start && t.minutes < x.end) ?? null;

interface NextStart {
  offset: number;
  day: number;
  from: string;
}

function nextStart(s: WeekSchedule, t: ZonedTime): NextStart | null {
  for (let offset = 0; offset <= 7; offset++) {
    const day = (t.day + offset) % 7;
    for (const x of slotsOf(s, day)) if (offset > 0 || x.start > t.minutes) return { offset, day, from: x.from };
  }
  return null;
}

const when = (n: NextStart) => `${n.offset === 0 ? 'hoje' : n.offset === 1 ? 'amanhã' : DAY_NAMES[n.day]} às ${formatHour(n.from)}`;

export interface StoreStatus {
  open: boolean;
  delivering: boolean;
  /** Texto curto (celular) */
  short: string;
  /** Texto completo */
  long: string;
  /** Situação das entregas */
  delivery: string;
}

export function getStoreStatus(date: Date = new Date()): StoreStatus {
  const t = zonedNow(date);
  const { open: openSchedule, delivery: deliverySchedule } = STORE.schedule;
  const openSlot = currentSlot(openSchedule, t);
  const deliverySlot = currentSlot(deliverySchedule, t);
  const nextOpen = nextStart(openSchedule, t);
  const nextDelivery = nextStart(deliverySchedule, t);
  const delivery = deliverySlot
    ? `Entregas hoje até ${formatHour(deliverySlot.to)}`
    : nextDelivery
      ? `Próximas entregas: ${when(nextDelivery)}`
      : '';

  if (openSlot && deliverySlot) {
    return {
      open: true,
      delivering: true,
      short: `Aberto · entregas até ${formatHour(deliverySlot.to)}`,
      long: `Aberto agora até ${formatHour(openSlot.to)} · entregas até ${formatHour(deliverySlot.to)}`,
      delivery,
    };
  }
  if (openSlot) {
    return {
      open: true,
      delivering: false,
      short: `Aberto até ${formatHour(openSlot.to)}`,
      long: `Aberto agora até ${formatHour(openSlot.to)} · próximas entregas ${nextDelivery ? when(nextDelivery) : 'em breve'}`,
      delivery,
    };
  }
  const reopen = nextOpen ? `abre ${when(nextOpen)}` : '';
  return {
    open: false,
    delivering: false,
    short: `Fechado${reopen ? ` · ${reopen}` : ''}`,
    long: `Fechado agora${reopen ? ` · ${reopen}` : ''}`,
    delivery,
  };
}

/** Situação da loja, atualizada a cada minuto. */
export function useStoreStatus(): StoreStatus {
  const [status, setStatus] = useState(() => getStoreStatus());
  useEffect(() => {
    const tick = () => setStatus(getStoreStatus());
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return status;
}
