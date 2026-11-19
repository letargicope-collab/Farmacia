/** R$ 1.234,56 — com espaço normal (o WhatsApp exibe melhor que o espaço não separável). */
export const brl = (value: number) =>
  (Number.isFinite(value) ? value : 0)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/\u00a0/g, ' ');

export const intBR = (n: number) => Math.round(n).toLocaleString('pt-BR');

export const onlyDigits = (s: string) => s.replace(/\D/g, '');

export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function parseMoney(v: string): number {
  const s = v.replace(/[^\d,.]/g, '');
  if (!s) return 0;
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : 0;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const plural = (n: number, one: string, many: string) => `${intBR(n)} ${n === 1 ? one : many}`;
