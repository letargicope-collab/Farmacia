import { PUBLICACAO } from '../config/publicacao';
import type { CatalogFile } from './erp/erp-catalog.js';

/* ============================================================================
 *  PUBLICAÇÃO DO CATÁLOGO NO SITE (Supabase via REST, sem bibliotecas)
 *  • Login dos administradores: Supabase Auth (senha conferida no servidor)
 *  • Envio: Supabase Storage (somente os e-mails autorizados — supabase/setup.sql)
 *  • Leitura pública: todos os visitantes carregam o catálogo publicado
 * ==========================================================================*/

export interface RemoteAuth {
  token: string;
  expiresAt: number;
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Sua sessão expirou. Entre de novo para publicar.');
    this.name = 'SessionExpiredError';
  }
}

const base = () => PUBLICACAO.supabaseUrl.trim().replace(/\/+$/, '');
const anonKey = () => PUBLICACAO.supabaseAnonKey.trim();
const objectPath = () => [PUBLICACAO.bucket, ...PUBLICACAO.arquivo.split('/')].map(encodeURIComponent).join('/');
const NO_CONNECTION = 'Sem conexão com o servidor. Verifique a internet e tente de novo.';

export const publicCatalogUrl = () => `${base()}/storage/v1/object/public/${objectPath()}`;

/** "cleverton" → "cleverton@farmaciasaomarcos.app" (quem digitar um e-mail completo usa o próprio e-mail). */
export function loginEmail(login: string) {
  const l = login.trim().toLowerCase();
  return l.includes('@') ? l : `${l}@${PUBLICACAO.dominioLogin}`;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Login no Supabase. Retorna null quando login/senha estão errados. */
export async function remoteSignIn(login: string, password: string): Promise<RemoteAuth | null> {
  let res: Response;
  try {
    res = await fetch(`${base()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail(login), password }),
    });
  } catch {
    throw new Error(NO_CONNECTION);
  }
  const j = await readJson(res);
  if (res.ok && typeof j.access_token === 'string') {
    return { token: j.access_token, expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  }
  const code = `${j.error_code ?? ''} ${j.error ?? ''} ${j.msg ?? ''}`;
  if (/email_not_confirmed|not confirmed/i.test(code)) {
    throw new Error('Este acesso ainda não foi confirmado no Supabase: ao criar o usuário, marque "Auto Confirm User".');
  }
  if (res.status === 429) throw new Error('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  if ([400, 401, 403, 422].includes(res.status)) return null;
  throw new Error(`O servidor não respondeu como esperado (erro ${res.status}). Tente novamente.`);
}

/** Envia o catálogo (substitui o anterior). Os visitantes passam a ver em até ~1 minuto. */
export async function publishCatalog(file: CatalogFile, auth: RemoteAuth): Promise<void> {
  if (auth.expiresAt <= Date.now()) throw new SessionExpiredError();
  let res: Response;
  try {
    res = await fetch(`${base()}/storage/v1/object/${objectPath()}`, {
      method: 'POST',
      headers: {
        apikey: anonKey(),
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
        'cache-control': 'max-age=60',
      },
      body: JSON.stringify(file),
    });
  } catch {
    throw new Error(NO_CONNECTION);
  }
  if (res.ok) return;
  const text = await res.text().catch(() => '');
  if (res.status === 401 || /exp.{0,6}claim|jwt expired|token.{0,10}expired|invalid jwt/i.test(text)) throw new SessionExpiredError();
  if (res.status === 403 || /row-level security|violates|not allowed|permission/i.test(text)) {
    throw new Error('Este acesso não tem permissão para publicar. Confira as permissões no Supabase (README → Publicação on-line).');
  }
  if (res.status === 413 || /too large|maximum allowed size|exceeded/i.test(text)) throw new Error('O catálogo ficou maior que o limite do armazenamento.');
  if (/bucket not found/i.test(text)) throw new Error('A pasta "catalogo" não existe no Supabase. Rode o arquivo supabase/setup.sql.');
  throw new Error(`Não foi possível publicar (erro ${res.status}). Tente novamente.`);
}

/** Confere a estrutura de um catálogo recebido antes de exibi-lo. */
export function isCatalogFile(v: unknown): v is CatalogFile {
  if (!v || typeof v !== 'object') return false;
  const f = v as Partial<CatalogFile>;
  if (f.version !== 1 || typeof f.generatedAt !== 'string' || !Array.isArray(f.groups) || !Array.isArray(f.items) || !f.stats) return false;
  return f.items.every(
    (r) =>
      Array.isArray(r) &&
      r.length >= 13 &&
      typeof r[0] === 'string' &&
      typeof r[1] === 'string' &&
      typeof r[3] === 'number' &&
      typeof r[5] === 'number' &&
      typeof r[6] === 'number' &&
      Number.isFinite(r[6]) &&
      r[6] >= 0 &&
      typeof r[7] === 'number' &&
      typeof r[12] === 'number',
  );
}

/** Catálogo publicado (null se ainda não houver publicação ou se estiver inacessível). */
export async function fetchPublishedCatalog(timeoutMs = 12000): Promise<CatalogFile | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(publicCatalogUrl(), { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isCatalogFile(data) ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
