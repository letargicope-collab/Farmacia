import { PIX } from '../config/pix';
import { STORE } from '../config/store';

/* ============================================================================
 *  PIX — QR Code e "Pix Copia e Cola" (BR Code estático do Banco Central)
 *  Manual de Padrões para Iniciação do Pix · EMV® QRCPS-MPM
 *  O código leva a chave, o recebedor, o VALOR EXATO e o identificador do pedido.
 * ==========================================================================*/

const field = (id: string, value: string) => {
  if (value.length > 99) throw new Error(`Campo ${id} do Pix com mais de 99 caracteres.`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
};

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Texto sem acentos, só com letras, números e espaços (padrão aceito por todos os bancos). */
export function pixText(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

export function isValidCnpj(value: string): boolean {
  const d = value.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digit = (len: number) => {
    let sum = 0;
    let w = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * w--;
      if (w < 2) w = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}

export interface PixPayloadInput {
  key: string;
  name: string;
  city: string;
  /** Valor exato (R$). Sem valor, o cliente digita no banco. */
  amount?: number;
  /** Identificador do pedido (até 25 letras/números). */
  txid?: string;
  /** Descrição exibida no app do banco de quem paga. */
  description?: string;
}

/** Monta o código "Pix Copia e Cola" (o mesmo conteúdo do QR Code). */
export function buildPixPayload(input: PixPayloadInput): string {
  const key = input.key.trim();
  const name = pixText(input.name, 25);
  const city = pixText(input.city, 15);
  if (!key || !name || !city) throw new Error('Dados do Pix incompletos.');
  const txid = (input.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const room = 99 - 18 - (4 + key.length) - 4; // o campo 26 inteiro precisa caber em 99 caracteres
  const description = input.description ? pixText(input.description, Math.max(0, room)) : '';
  const account = field('00', 'br.gov.bcb.pix') + field('01', key) + (description ? field('02', description) : '');
  let payload = field('00', '01') + field('26', account) + field('52', '0000') + field('53', '986');
  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Valor do Pix inválido.');
    payload += field('54', (Math.round(input.amount * 100) / 100).toFixed(2));
  }
  payload += field('58', 'BR') + field('59', name) + field('60', city) + field('62', field('05', txid)) + '6304';
  return payload + crc16(payload);
}

/** Lê os campos de um código Pix (conferência e testes). Ex.: { '54': '87.56', '26.01': chave } */
export function parsePixFields(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (s: string, prefix: string) => {
    let i = 0;
    while (i < s.length) {
      const id = s.slice(i, i + 2);
      const len = Number(s.slice(i + 2, i + 4));
      const value = s.slice(i + 4, i + 4 + len);
      if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || value.length !== len) throw new Error('Código Pix malformado.');
      out[prefix + id] = value;
      if (!prefix && (id === '26' || id === '62')) walk(value, `${id}.`);
      i += 4 + len;
    }
  };
  walk(payload, '');
  return out;
}

export const pixCrcOk = (payload: string) => payload.length > 8 && crc16(payload.slice(0, -4)) === payload.slice(-4);

/* ------------------------------------------------ identificador do pedido -- */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I, para leitura fácil

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Identificador: prefixo + AAMMDDHHMM (horário da farmácia) + 4 caracteres. Ex.: SM2611151034K7Q2 */
export function newOrderId(now: Date = new Date()): string {
  let stamp = '';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: STORE.timeZone,
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    stamp = `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}`;
  } catch {
    /* navegador sem fuso horário */
  }
  if (!/^\d{10}$/.test(stamp)) {
    const d = new Date(now.getTime() - 3 * 3_600_000);
    const p = (n: number) => String(n).padStart(2, '0');
    stamp = `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
  }
  return `${PIX.prefixo}${stamp}${randomChars(4)}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
}

const ORDER_KEY = 'fsm:pix-order';

/**
 * Mantém o mesmo identificador enquanto o carrinho for o mesmo (até 6 h nesta aba):
 * se o cliente pagar, fechar e reabrir a tela, a mensagem continua com o código pago.
 */
export function orderIdFor(signature: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ORDER_KEY) ?? 'null') as { sig: string; id: string; at: number } | null;
    if (saved && saved.sig === signature && Date.now() - saved.at < 6 * 3_600_000 && /^[A-Za-z0-9]{6,25}$/.test(saved.id)) return saved.id;
  } catch {
    /* ignore */
  }
  const id = newOrderId();
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify({ sig: signature, id, at: Date.now() }));
  } catch {
    /* modo privado */
  }
  return id;
}

/** Pedido concluído: o próximo pedido recebe um identificador novo. */
export function forgetOrderId() {
  try {
    sessionStorage.removeItem(ORDER_KEY);
  } catch {
    /* ignore */
  }
}

/** Código Pix do pedido (null se não for possível gerar). */
export function orderPixPayload(amount: number, orderId: string): string | null {
  try {
    return buildPixPayload({
      key: PIX.chave,
      name: PIX.recebedor,
      city: STORE.cityUf.split('/')[0]?.trim() || PIX.cidade,
      amount,
      txid: orderId,
      description: `Farmacia Sao Marcos pedido ${orderId}`,
    });
  } catch {
    return null;
  }
}
