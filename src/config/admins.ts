/**
 * ============================================================================
 *  ADMINISTRADORES — acesso ao envio da planilha de manutenção de produtos
 * ----------------------------------------------------------------------------
 *  🔒 As senhas NÃO ficam no site: apenas o "hash" PBKDF2-SHA256 com salt
 *     aleatório (não dá para descobrir a senha a partir dele).
 *
 *  Para criar um acesso ou trocar uma senha:
 *    node scripts/admin-hash.mjs <login> "<nova senha>"
 *  cole a linha gerada abaixo (no lugar da antiga) e rode:  npm run build
 * ============================================================================
 */
export interface AdminAccount {
  /** Login (sempre em minúsculas) */
  user: string;
  salt: string;
  hash: string;
  iterations: number;
}

export const ADMINS: AdminAccount[] = [
  { user: 'cleverton', salt: 'f2af685409ebb0ecd97b0acbe0c5f5d4', hash: '37a23e5a239af5233de682f95e9d3ed86dd2728ba64e298ccda160bd33a712d3', iterations: 310000 },
  { user: 'saomarcos2026', salt: 'e8fca0f7aea860cb18f52c548d3833c1', hash: 'e38eac15b8579d74d26d46fa7ddbd727fd52df3afce6781b26792eb0a72ceacb', iterations: 310000 },
];
