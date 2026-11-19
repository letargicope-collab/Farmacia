/**
 * Armazenamento local:
 *  • localStorage → carrinho, dados do cliente, preferências (pequenos)
 *  • IndexedDB    → catálogo importado no painel do lojista (até ~12 mil itens)
 */
const DB_NAME = 'farmacia-sao-marcos';
const STORE_NAME = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const req = run(tx.objectStore(STORE_NAME));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

export const idbGet = <T>(key: string) => withStore<T | undefined>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => withStore<unknown>('readwrite', (s) => s.put(value, key)).then(() => undefined);
export const idbDel = (key: string) => withStore<unknown>('readwrite', (s) => s.delete(key)).then(() => undefined);

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado / sem espaço */
  }
}
