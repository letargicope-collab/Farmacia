/**
 * ============================================================================
 *  PUBLICAÇÃO ON-LINE DO CATÁLOGO — Supabase (plano gratuito)
 * ----------------------------------------------------------------------------
 *  Com estes dois campos preenchidos, a planilha enviada pela nuvem ☁️ do topo
 *  atualiza o site para TODOS os clientes, e o login passa a ser conferido
 *  pelo servidor.
 *
 *  Vazio = modo sem servidor: a planilha é conferida e aplicada só no aparelho
 *  de quem enviou (e pode ser baixada como catalog.json).
 *
 *  Passo a passo (configuração única): README.md → "Publicação on-line" e o
 *  arquivo supabase/setup.sql.
 * ============================================================================
 */
export const PUBLICACAO = {
  /** URL do projeto. Ex.: https://abcdefghijklmnop.supabase.co */
  supabaseUrl: '',
  /** Chave pública "anon" (ou "publishable") do projeto: pode ficar no site. */
  supabaseAnonKey: '',
  /** Pasta pública (bucket) onde o catálogo é guardado. */
  bucket: 'catalogo',
  arquivo: 'catalog.json',
  /** O login "cleverton" entra no Supabase como cleverton@farmaciasaomarcos.app (nenhum e-mail é enviado). */
  dominioLogin: 'farmaciasaomarcos.app',
};

/** A publicação on-line está configurada? */
export const onlinePublishingEnabled = () =>
  /^https:\/\/[^\s/]+/.test(PUBLICACAO.supabaseUrl.trim()) && PUBLICACAO.supabaseAnonKey.trim().length > 20;
