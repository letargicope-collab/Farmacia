import { PIX } from '../config/pix';
import { STORE } from '../config/store';
import type { Product } from './catalog';
import { brl } from './format';

/* ============================================================================
 *  CHECKOUT VIA WHATSAPP — monta a mensagem padronizada do pedido
 * ==========================================================================*/

export type PaymentMethod = 'dinheiro' | 'cartao' | 'pix';

export interface OrderCustomer {
  name: string;
  phone: string;
  street: string;
  number: string;
  district: string;
  reference: string;
  city: string;
  uf: string;
}

export interface OrderPayment {
  method: PaymentMethod;
  /** Troco para (somente dinheiro) */
  change?: number;
  cardType?: 'credito' | 'debito';
}

export interface OrderGps {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface OrderLine {
  product: Product;
  qty: number;
}

const SEPARATOR = '---------------------------------------';

export const mapsLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

export const orderTotal = (lines: OrderLine[]) =>
  Math.round(lines.reduce((sum, l) => sum + l.product.price * l.qty, 0) * 100) / 100;

export function paymentLabel(p: OrderPayment, total: number): string {
  if (p.method === 'pix') return 'PIX (pagamento antecipado)';
  if (p.method === 'cartao') return `Cartão de ${p.cardType === 'debito' ? 'Débito' : 'Crédito'} (maquininha na entrega)`;
  return p.change && p.change > total ? `Dinheiro (troco para ${brl(p.change)})` : 'Dinheiro (não precisa de troco)';
}

/**
 * Mensagem no formato oficial:
 *  🛒 *NOVO PEDIDO - FARMÁCIA SÃO MARCOS* … 💳 *FORMA DE PAGAMENTO:*
 */
export function buildOrderMessage(order: {
  customer: OrderCustomer;
  gps: OrderGps | null;
  lines: OrderLine[];
  payment: OrderPayment;
  notes?: string;
  /** PIX pago pelo QR Code do site: vai pronto na mensagem para a atendente só conferir. */
  pix?: { orderId: string; amount: number } | null;
}): string {
  const { customer: c, gps, lines, payment, notes, pix } = order;
  const total = orderTotal(lines);
  const out: string[] = [
    '🛒 *NOVO PEDIDO - FARMÁCIA SÃO MARCOS*',
    SEPARATOR,
    `👤 *CLIENTE:* ${c.name.trim()}`,
    `📞 *CONTATO:* ${c.phone.trim()}`,
    '',
    '📌 *ENDEREÇO DE ENTREGA:*',
    `Rua: ${c.street.trim()}, Nº ${c.number.trim() || 'S/N'}`,
    `Bairro: ${c.district.trim()}`,
  ];
  if (c.city.trim()) out.push(`Cidade: ${c.city.trim()}${c.uf.trim() ? `/${c.uf.trim().toUpperCase()}` : ''}`);
  out.push(`Ref.: ${c.reference.trim() || 'Não informado'}`);
  out.push('', '📍 *LOCALIZAÇÃO EXATA (GPS):*', gps ? mapsLink(gps.lat, gps.lng) : 'Não compartilhada (usar o endereço acima)');
  out.push('', SEPARATOR, '📦 *ITENS DO PEDIDO:*');
  for (const l of lines) out.push(`- ${l.qty}x ${l.product.name} (Cód. ${l.product.code}) - ${brl(l.product.price * l.qty)}`);
  out.push('', `💰 *TOTAL DO PEDIDO:* ${brl(total)}`, `💳 *FORMA DE PAGAMENTO:* ${paymentLabel(payment, total)}`);
  if (payment.method === 'pix' && pix) {
    out.push(
      '',
      '✅ *PIX REALIZADO PELO CLIENTE*',
      `Valor: ${brl(pix.amount)}`,
      `Identificador: ${pix.orderId}`,
      `Recebedor: ${PIX.recebedor} (CNPJ ${PIX.chaveExibicao})`,
      '👉 _Confira o recebimento do PIX para liberar a entrega._',
    );
  }
  if (notes && notes.trim()) out.push('', `📝 *OBSERVAÇÕES:* ${notes.trim()}`);
  return out.join('\n');
}

export const waUrl = (text: string, phone: string = STORE.whatsappNumber) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

export const productQuestionMessage = (p: Product) =>
  `Olá, Farmácia São Marcos! 👋\nTenho uma dúvida sobre o produto:\n*${p.name}* (Cód. ${p.code})`;

export const notifyStockMessage = (p: Product) =>
  `Olá, Farmácia São Marcos! 👋\nGostaria de ser avisado(a) quando chegar:\n*${p.name}* (Cód. ${p.code})`;

export const controlledMessage = (p: Product) =>
  `Olá, Farmácia São Marcos! 👋\nTenho receita e gostaria de saber a disponibilidade de:\n*${p.name}* (Cód. ${p.code})`;

export const notFoundMessage = (term: string) =>
  `Olá, Farmácia São Marcos! 👋\nNão encontrei no site o produto: *${term}*.\nVocês têm disponível?`;

export const pharmacistMessage = () =>
  'Olá, Farmácia São Marcos! 👋\nGostaria de tirar uma dúvida com o(a) farmacêutico(a).';
