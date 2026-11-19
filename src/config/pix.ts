/**
 * ============================================================================
 *  PIX DA FARMÁCIA — pagamento antecipado com QR Code
 * ----------------------------------------------------------------------------
 *  O QR Code e o "Pix Copia e Cola" são gerados no próprio site, com o VALOR
 *  EXATO do pedido (padrão BR Code do Banco Central, Pix estático).
 *  O dinheiro vai direto para a conta desta chave: o site não intermedeia
 *  nem guarda nenhum dado de pagamento.
 * ============================================================================
 */
export const PIX = {
  /** Chave Pix (CNPJ), somente números. */
  chave: '07228033000132',
  /** Como a chave aparece para o cliente. */
  chaveExibicao: '07.228.033/0001-32',
  /** Nome que o cliente confere no app do banco antes de confirmar o pagamento. */
  recebedor: 'Nadira Fernandes',
  /**
   * Cidade do recebedor: campo obrigatório do QR Code Pix (sem acentos, até 15 letras).
   * Os bancos não validam este campo. Troque pela cidade da farmácia quando quiser.
   */
  cidade: 'ALAGOAS',
  /** Prefixo do identificador do pedido (ex.: SM2611151034K7Q2). */
  prefixo: 'SM',
};
