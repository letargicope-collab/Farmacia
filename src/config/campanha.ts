/**
 * ============================================================================
 *  CAMPANHA PROMOCIONAL — BLACK FRIDAY SÃO MARCOS
 * ----------------------------------------------------------------------------
 *  • O desconto é aplicado sobre o "Preço Venda" da planilha do sistema
 *    (centavos preservados). O catálogo importado não é alterado.
 *  • Fora do período (inicio → fim) a campanha desliga sozinha e o site
 *    volta a mostrar só as promoções da planilha.
 *  • Nenhum desconto passa de `limiteDesconto`. Controlados nunca entram.
 *
 *  ⚠️ Confirme produtos e percentuais antes de divulgar: o preço anunciado
 *     no site vale como oferta para o cliente (CDC, art. 30).
 *
 *  Os códigos 300011–301011 abaixo são itens ILUSTRATIVOS do protótipo e
 *  somem na primeira importação da planilha real — troque pelos códigos
 *  reais do sistema (coluna "Código").
 * ============================================================================
 */

export interface CampaignItem {
  /** Código do produto no sistema (coluna "Código") */
  codigo: string;
  /** Desconto em % sobre o Preço Venda */
  desconto: number;
  /** Apenas para referência de quem edita */
  referencia?: string;
}

export interface Campaign {
  ativa: boolean;
  nome: string;
  /** Selo exibido nos produtos */
  selo: string;
  /** Chamada exibida acima do título */
  chamada: string;
  /** Complemento do texto da vitrine */
  descricao: string;
  inicio: string;
  fim: string;
  limiteDesconto: number;
  produtos: CampaignItem[];
}

export const CAMPANHA: Campaign = {
  ativa: true,
  nome: 'Black Friday São Marcos',
  selo: 'BLACK FRIDAY',
  chamada: 'Esquenta Black São Marcos',
  descricao: 'em dermocosméticos, fraldas, vitaminas e muito mais',
  inicio: '2026-11-01T00:00:00-03:00',
  fim: '2026-11-30T23:59:59-03:00',
  limiteDesconto: 50,
  produtos: [
    { codigo: '300671', desconto: 50, referencia: 'Protetor Solar La Roche Anthelios FPS 70 50g' },
    { codigo: '300881', desconto: 50, referencia: 'Centrum Essentials 60 comprimidos' },
    { codigo: '300701', desconto: 45, referencia: 'Sérum Vitamina C 10 Vichy 30ml' },
    { codigo: '300681', desconto: 45, referencia: 'Hidratante Nivea Milk 400ml' },
    { codigo: '300741', desconto: 35, referencia: 'Fralda Pampers Confort Sec G 46un' },
    { codigo: '300911', desconto: 35, referencia: 'Ômega 3 1000mg 120 cápsulas' },
    { codigo: '300691', desconto: 35, referencia: 'Água Micelar Garnier 400ml' },
    { codigo: '300711', desconto: 30, referencia: 'Cetaphil Loção Hidratante 473ml' },
    { codigo: '300761', desconto: 30, referencia: 'Fralda Geriátrica Bigfral Plus G 8un' },
    { codigo: '300751', desconto: 30, referencia: 'Fralda Huggies Tripla Proteção M 46un' },
    { codigo: '300941', desconto: 30, referencia: 'Colágeno Verisol 30 sachês' },
    { codigo: '300581', desconto: 25, referencia: 'Enxaguante Listerine Cool Mint 500ml' },
    { codigo: '300801', desconto: 25, referencia: 'Hipoglós Amêndoas 80g' },
    { codigo: '300461', desconto: 25, referencia: 'Medidor de Pressão Digital G-Tech' },
    { codigo: '300931', desconto: 20, referencia: 'Creatina Monohidratada 300g' },
  ],
};

/** A campanha está valendo agora? */
export function campaignActive(now: number = Date.now()): boolean {
  if (!CAMPANHA.ativa) return false;
  const start = Date.parse(CAMPANHA.inicio);
  const end = Date.parse(CAMPANHA.fim);
  return (!Number.isFinite(start) || now >= start) && (!Number.isFinite(end) || now <= end);
}

const DISCOUNTS = new Map(CAMPANHA.produtos.map((p) => [String(p.codigo).trim(), p.desconto]));

/** Desconto da campanha para o código (0 = fora da campanha). */
export function campaignDiscount(code: string, now: number = Date.now()): number {
  if (!campaignActive(now)) return 0;
  const d = DISCOUNTS.get(code) ?? 0;
  return Math.max(0, Math.min(CAMPANHA.limiteDesconto, Math.round(d)));
}

/** Data final da campanha, ex.: "30/11/2026". */
export function campaignEndLabel(): string {
  const d = new Date(CAMPANHA.fim);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' });
  } catch {
    return d.toLocaleDateString('pt-BR');
  }
}
