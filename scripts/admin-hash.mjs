#!/usr/bin/env node
/**
 * ============================================================================
 *  Gera o acesso de um administrador para src/config/admins.ts
 * ----------------------------------------------------------------------------
 *  A senha NUNCA é gravada no site: só um "hash" PBKDF2-SHA256 com salt
 *  aleatório (impossível de reverter para a senha original).
 *
 *  Uso:  node scripts/admin-hash.mjs <login> "<senha>"
 *  Depois cole a linha gerada na lista ADMINS e rode:  npm run build
 * ============================================================================
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ITERATIONS = 310000;

export function hashAdmin(login, password) {
  const user = String(login).trim().toLowerCase();
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(String(password), Buffer.from(salt, 'hex'), ITERATIONS, 32, 'sha256').toString('hex');
  return { user, salt, hash, iterations: ITERATIONS };
}

export const formatAdmin = (a) => `  { user: '${a.user}', salt: '${a.salt}', hash: '${a.hash}', iterations: ${a.iterations} },`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [login, password] = process.argv.slice(2);
  if (!login || !password) {
    console.error('Uso: node scripts/admin-hash.mjs <login> "<senha>"');
    process.exit(1);
  }
  console.log('\nCole esta linha na lista ADMINS de src/config/admins.ts:\n');
  console.log(formatAdmin(hashAdmin(login, password)));
  console.log('\nDepois rode:  npm run build\n');
}
