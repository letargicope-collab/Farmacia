import { ADMINS, type AdminAccount } from '../config/admins';
import { onlinePublishingEnabled } from '../config/publicacao';
import { remoteSignIn, type RemoteAuth } from './publish';

/* ============================================================================
 *  LOGIN DO ADMINISTRADOR (envio da planilha de produtos)
 * ----------------------------------------------------------------------------
 *  • A senha digitada é transformada em hash PBKDF2-SHA256 e comparada com o
 *    hash salvo em src/config/admins.ts. A senha nunca fica no site.
 *  • Bloqueio após 5 tentativas erradas (1 min; 5 min a partir da 10ª).
 *  • A sessão dura 4 horas e termina ao fechar a aba.
 * ==========================================================================*/

const SESSION_KEY = 'fsm:admin-session';
const LOCK_KEY = 'fsm:admin-lock';
const SESSION_MS = 4 * 60 * 60 * 1000;

export interface AdminSession {
  user: string;
  exp: number;
  /** Token do servidor (somente com a publicação on-line configurada). */
  token?: string;
}

export function getSession(): AdminSession | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as AdminSession | null;
    if (!s || typeof s.exp !== 'number' || s.exp <= Date.now()) return null;
    const valid = onlinePublishingEnabled() ? typeof s.token === 'string' : !s.token && ADMINS.some((a) => a.user === s.user);
    if (valid) return s;
  } catch {
    /* ignore */
  }
  return null;
}

export function startSession(user: string, remote?: RemoteAuth): AdminSession {
  const session: AdminSession = remote
    ? { user, exp: Math.min(Date.now() + SESSION_MS, remote.expiresAt - 60_000), token: remote.token }
    : { user, exp: Date.now() + SESSION_MS };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* modo privado: vale só enquanto a tela estiver aberta */
  }
  return session;
}

export function endSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

interface LockState {
  fails: number;
  until: number;
}

function readLock(): LockState {
  try {
    const v = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null') as LockState | null;
    if (v && typeof v.fails === 'number' && typeof v.until === 'number') return v;
  } catch {
    /* ignore */
  }
  return { fails: 0, until: 0 };
}

function writeLock(v: LockState) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Segundos restantes de bloqueio (0 = liberado). */
export const lockRemaining = () => Math.max(0, Math.ceil((readLock().until - Date.now()) / 1000));

export function registerFailure() {
  const fails = readLock().fails + 1;
  writeLock({ fails, until: fails >= 5 ? Date.now() + (fails >= 10 ? 300_000 : 60_000) : 0 });
}

export const clearFailures = () => writeLock({ fails: 0, until: 0 });

/* ------------------------------------------------------------- hash -- */

const hexToBytes = (hex: string) => {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

function compress(st: Uint32Array, w: Uint32Array) {
  for (let i = 16; i < 64; i++) {
    const a = w[i - 15];
    const b = w[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
  }
  let a = st[0], b = st[1], c = st[2], d = st[3], e = st[4], f = st[5], g = st[6], h = st[7];
  for (let i = 0; i < 64; i++) {
    const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
    const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  st[0] += a;
  st[1] += b;
  st[2] += c;
  st[3] += d;
  st[4] += e;
  st[5] += f;
  st[6] += g;
  st[7] += h;
}

/** Processa `msg` (com padding) a partir do estado `st`, contando `prefix` bytes já processados. */
function digestFrom(st: Uint32Array, msg: Uint8Array, prefix: number, w: Uint32Array) {
  const total = ((msg.length + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[msg.length] = 0x80;
  const bits = (prefix + msg.length) * 8;
  buf[total - 5] = Math.floor(bits / 0x100000000) & 255;
  buf[total - 4] = (bits >>> 24) & 255;
  buf[total - 3] = (bits >>> 16) & 255;
  buf[total - 2] = (bits >>> 8) & 255;
  buf[total - 1] = bits & 255;
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = ((buf[o + i * 4] << 24) | (buf[o + i * 4 + 1] << 16) | (buf[o + i * 4 + 2] << 8) | buf[o + i * 4 + 3]) >>> 0;
    compress(st, w);
  }
}

function wordsToBytes(words: Uint32Array) {
  const out = new Uint8Array(words.length * 4);
  words.forEach((v, i) => {
    out[i * 4] = v >>> 24;
    out[i * 4 + 1] = (v >>> 16) & 255;
    out[i * 4 + 2] = (v >>> 8) & 255;
    out[i * 4 + 3] = v & 255;
  });
  return out;
}

/** PBKDF2-HMAC-SHA256 em JavaScript puro (usado só se o navegador não oferecer o Web Crypto). */
export function pbkdf2Sha256Fallback(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  const w = new Uint32Array(64);
  let key = password;
  if (key.length > 64) {
    const st = new Uint32Array(IV);
    digestFrom(st, key, 0, w);
    key = wordsToBytes(st);
  }
  const block = new Uint8Array(64);
  const inner = new Uint32Array(IV);
  const outer = new Uint32Array(IV);
  const load = (bytes: Uint8Array) => {
    for (let i = 0; i < 16; i++) w[i] = ((bytes[i * 4] << 24) | (bytes[i * 4 + 1] << 16) | (bytes[i * 4 + 2] << 8) | bytes[i * 4 + 3]) >>> 0;
  };
  for (let i = 0; i < 64; i++) block[i] = (key[i] ?? 0) ^ 0x36;
  load(block);
  compress(inner, w);
  for (let i = 0; i < 64; i++) block[i] = (key[i] ?? 0) ^ 0x5c;
  load(block);
  compress(outer, w);

  const msg = new Uint8Array(salt.length + 4);
  msg.set(salt);
  msg[salt.length + 3] = 1;
  const st = new Uint32Array(inner);
  digestFrom(st, msg, 64, w);
  const pad32 = () => {
    w[8] = 0x80000000;
    for (let i = 9; i < 15; i++) w[i] = 0;
    w[15] = (64 + 32) * 8;
  };
  for (let i = 0; i < 8; i++) w[i] = st[i];
  st.set(outer);
  pad32();
  compress(st, w);
  const u = new Uint32Array(st);
  const t = new Uint32Array(st);

  for (let it = 1; it < iterations; it++) {
    st.set(inner);
    for (let i = 0; i < 8; i++) w[i] = u[i];
    pad32();
    compress(st, w);
    for (let i = 0; i < 8; i++) w[i] = st[i];
    st.set(outer);
    pad32();
    compress(st, w);
    for (let i = 0; i < 8; i++) {
      u[i] = st[i];
      t[i] ^= st[i];
    }
  }
  return wordsToBytes(t);
}

export async function pbkdf2Hex(password: string, saltHex: string, iterations: number): Promise<string> {
  const pass = new TextEncoder().encode(password);
  const salt = hexToBytes(saltHex);
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle) {
    try {
      const key = await subtle.importKey('raw', pass, 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
      return toHex(new Uint8Array(bits));
    } catch {
      /* segue para o cálculo em JavaScript */
    }
  }
  return toHex(pbkdf2Sha256Fallback(pass, salt, iterations));
}

const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const DECOY: AdminAccount = { user: '', salt: '5f3c9a1e7b2d4c6f8a0b1c2d3e4f5a6b', hash: '', iterations: ADMINS[0]?.iterations ?? 310000 };

/** Confere login e senha. Retorna o login normalizado ou null. */
export async function verifyLogin(login: string, password: string): Promise<string | null> {
  const user = login.trim().toLowerCase();
  const account = ADMINS.find((a) => a.user === user);
  const ref = account ?? DECOY; // calcula sempre, para não revelar quais logins existem
  const hash = await pbkdf2Hex(password, ref.salt, ref.iterations);
  return account && sameText(hash, account.hash) ? account.user : null;
}

/**
 * Login do administrador.
 *  • Publicação on-line configurada → senha conferida no servidor (Supabase).
 *  • Sem servidor → senha conferida pelo hash de src/config/admins.ts.
 * Retorna a sessão, ou null se login/senha estiverem errados.
 */
export async function adminLogin(login: string, password: string): Promise<AdminSession | null> {
  const user = login.trim().toLowerCase();
  if (onlinePublishingEnabled()) {
    const remote = await remoteSignIn(user, password);
    return remote ? startSession(user.split('@')[0], remote) : null;
  }
  const ok = await verifyLogin(user, password);
  return ok ? startSession(ok) : null;
}
