import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import catalogRaw from '../data/catalog.json?raw';
import type { CatalogFile } from '../lib/erp/erp-catalog.js';
import { CATEGORIES, defaultSort, hydrateCatalog, type CategoryId, type Product } from '../lib/catalog';
import { SearchEngine, type SearchResult } from '../lib/search';
import { identifyCare } from '../lib/care-search';
import { idbDel, idbGet, idbSet } from '../lib/storage';
import { usePersistentState } from '../hooks/common';
import { onlinePublishingEnabled } from '../config/publicacao';
import { fetchPublishedCatalog, isCatalogFile } from '../lib/publish';

export const scrollToId = (id: string) =>
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' }));

/* =============================================================== CATÁLOGO */

const EMBEDDED: CatalogFile = JSON.parse(catalogRaw) as CatalogFile;
const OVERRIDE_KEY = 'catalog-override-v1';
const ONLINE = onlinePublishingEnabled();
const isNewer = (a: CatalogFile, b: CatalogFile) => (Date.parse(a.generatedAt) || 0) > (Date.parse(b.generatedAt) || 0);

/** De onde vem o catálogo exibido: do site (build), publicado on-line ou aplicado só neste aparelho. */
export type CatalogOrigin = 'site' | 'publicado' | 'aparelho';

/** Índice de busca criado sob demanda (não atrasa a primeira tela). */
export class LazySearch {
  private engine: SearchEngine | null = null;
  private readonly products: Product[];
  constructor(products: Product[]) {
    this.products = products;
  }
  warm() {
    if (!this.engine) this.engine = new SearchEngine(this.products);
    return this.engine;
  }
  search(query: string, limit = 0): SearchResult {
    return this.warm().search(query, limit);
  }
}

interface CatalogContextValue {
  file: CatalogFile;
  products: Product[];
  byId: Map<string, Product>;
  showcase: Product[];
  search: LazySearch;
  origin: CatalogOrigin;
  /** Publicação on-line configurada (Supabase) */
  online: boolean;
  /** Exibe o catálogo recém-publicado sem precisar recarregar a página */
  markPublished: (file: CatalogFile) => void;
  counts: Record<CategoryId, number>;
  inStockCount: number;
  promoCount: number;
  maxDiscount: number;
  /** Produtos disponíveis na campanha ativa (Black Friday) */
  campaignCount: number;
  /** Maior desconto da campanha ativa */
  campaignMax: number;
  applyCatalog: (file: CatalogFile) => Promise<void>;
  resetCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<CatalogFile>(EMBEDDED);
  const [origin, setOrigin] = useState<CatalogOrigin>('site');
  const fileRef = useRef<CatalogFile>(EMBEDDED);
  useEffect(() => {
    fileRef.current = file;
  }, [file]);

  useEffect(() => {
    let alive = true;
    if (ONLINE) {
      // Publicação on-line: todos os visitantes recebem o último catálogo publicado
      // (só se for mais novo que o que já está no site).
      idbDel(OVERRIDE_KEY).catch(() => undefined);
      fetchPublishedCatalog().then((remote) => {
        if (alive && remote && isNewer(remote, fileRef.current)) {
          setFile(remote);
          setOrigin('publicado');
        }
      });
    } else {
      // Sem servidor: catálogo aplicado só neste aparelho pelo administrador.
      idbGet<CatalogFile>(OVERRIDE_KEY)
        .then((saved) => {
          if (alive && saved && isCatalogFile(saved) && saved.items.length) {
            setFile(saved);
            setOrigin('aparelho');
          }
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, []);

  const products = useMemo(() => hydrateCatalog(file), [file]);
  const search = useMemo(() => new LazySearch(products), [products]);

  useEffect(() => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => search.warm());
    else setTimeout(() => search.warm(), 600);
  }, [search]);

  const derived = useMemo(() => {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>;
    let inStockCount = 0;
    let promoCount = 0;
    let maxDiscount = 0;
    let campaignCount = 0;
    let campaignMax = 0;
    for (const p of products) {
      if (!p.inStock) continue;
      inStockCount++;
      counts[p.category]++;
      if (p.promo > 0 && !p.controlled) {
        promoCount++;
        if (p.discount > maxDiscount) maxDiscount = p.discount;
        if (p.campaign) {
          campaignCount++;
          if (p.discount > campaignMax) campaignMax = p.discount;
        }
      }
    }
    return {
      counts,
      inStockCount,
      promoCount,
      maxDiscount,
      campaignCount,
      campaignMax,
      byId: new Map(products.map((p) => [p.id, p])),
      showcase: [...products].sort(defaultSort),
    };
  }, [products]);

  const applyCatalog = useCallback(async (next: CatalogFile) => {
    try {
      await idbSet(OVERRIDE_KEY, next);
    } catch {
      /* sem IndexedDB: vale só para esta sessão */
    }
    setFile(next);
    setOrigin('aparelho');
  }, []);

  const resetCatalog = useCallback(async () => {
    try {
      await idbDel(OVERRIDE_KEY);
    } catch {
      /* ignore */
    }
    setFile(EMBEDDED);
    setOrigin('site');
  }, []);

  const markPublished = useCallback((next: CatalogFile) => {
    setFile(next);
    setOrigin('publicado');
  }, []);

  const value = useMemo<CatalogContextValue>(
    () => ({ file, products, search, origin, online: ONLINE, markPublished, applyCatalog, resetCatalog, ...derived }),
    [file, products, search, origin, markPublished, applyCatalog, resetCatalog, derived],
  );
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog precisa estar dentro de <CatalogProvider>');
  return ctx;
}

/* =============================================================== CARRINHO */

export interface CartLine {
  product: Product;
  qty: number;
}
type StoredLine = { id: string; qty: number; snap: Product };
export type AddResult = 'added' | 'max' | 'blocked';

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  savings: number;
  qtyOf: (id: string) => number;
  add: (p: Product, qty?: number) => AddResult;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const maxQty = (p: Product) => (p.stock > 0 ? Math.max(1, Math.floor(p.stock)) : 0);

export function CartProvider({ children }: { children: ReactNode }) {
  const { byId } = useCatalog();
  const [stored, setStored] = usePersistentState<StoredLine[]>('fsm:cart', []);
  const ref = useRef(stored);
  useEffect(() => {
    ref.current = stored;
  }, [stored]);

  const commit = useCallback(
    (next: StoredLine[]) => {
      ref.current = next;
      setStored(next);
    },
    [setStored],
  );

  const lines = useMemo<CartLine[]>(
    () => stored.map((s) => ({ product: byId.get(s.id) ?? s.snap, qty: s.qty })).filter((l) => l.qty > 0),
    [stored, byId],
  );

  const add = useCallback(
    (p: Product, qty = 1): AddResult => {
      if (p.controlled || !p.inStock) return 'blocked';
      const current = ref.current.find((x) => x.id === p.id)?.qty ?? 0;
      const max = maxQty(p);
      if (current >= max) return 'max';
      const nextQty = Math.min(max, current + qty);
      commit(
        current
          ? ref.current.map((x) => (x.id === p.id ? { ...x, qty: nextQty, snap: p } : x))
          : [...ref.current, { id: p.id, qty: nextQty, snap: p }],
      );
      return 'added';
    },
    [commit],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      const line = ref.current.find((x) => x.id === id);
      if (!line) return;
      const product = byId.get(id) ?? line.snap;
      const next = Math.min(Math.max(0, Math.floor(qty)), Math.max(1, maxQty(product)));
      commit(next <= 0 ? ref.current.filter((x) => x.id !== id) : ref.current.map((x) => (x.id === id ? { ...x, qty: next } : x)));
    },
    [byId, commit],
  );

  const remove = useCallback((id: string) => commit(ref.current.filter((x) => x.id !== id)), [commit]);
  const clear = useCallback(() => commit([]), [commit]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const total = Math.round(lines.reduce((s, l) => s + l.product.price * l.qty, 0) * 100) / 100;
    const savings = lines.reduce((s, l) => s + (l.product.promo > 0 ? (l.product.regularPrice - l.product.price) * l.qty : 0), 0);
    const qtyMap = new Map(lines.map((l) => [l.product.id, l.qty]));
    return { lines, count, total, savings, qtyOf: (id) => qtyMap.get(id) ?? 0, add, setQty, remove, clear };
  }, [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart precisa estar dentro de <CartProvider>');
  return ctx;
}

/* ============================================================== INTERFACE */

export type SortKey = 'relevancia' | 'menor-preco' | 'maior-preco' | 'az' | 'desconto';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'warning';
  actionLabel?: string;
  onAction?: () => void;
}

interface UIContextValue {
  query: string;
  setQuery: (q: string) => void;
  searchTerm: string;
  applySearch: (term: string, scroll?: boolean) => void;
  clearSearch: () => void;
  category: CategoryId | 'todos';
  selectCategory: (c: CategoryId | 'todos', scroll?: boolean) => void;
  onlyPromo: boolean;
  setOnlyPromo: (v: boolean) => void;
  showUnavailable: boolean;
  setShowUnavailable: (v: boolean) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  checkoutOpen: boolean;
  setCheckoutOpen: (v: boolean) => void;
  adminOpen: boolean;
  setAdminOpen: (v: boolean) => void;
  product: Product | null;
  openProduct: (p: Product) => void;
  closeProduct: () => void;
  toasts: ToastItem[];
  toast: (message: string, opts?: Partial<Omit<ToastItem, 'id' | 'message'>>) => void;
  dismissToast: (id: number) => void;
  fontScale: number;
  setFontScale: (n: number) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<CategoryId | 'todos'>('todos');
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [sort, setSort] = useState<SortKey>('relevancia');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [fontScale, setFontScale] = usePersistentState('fsm:font-scale', 0);
  const toastId = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.font = String(fontScale);
  }, [fontScale]);

  useEffect(() => {
    const check = () => {
      if (/^#(admin|lojista)$/i.test(window.location.hash)) setAdminOpen(true);
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const applySearch = useCallback((term: string, scroll = true) => {
    if (identifyCare(term)) setOnlyPromo(false);
    setQuery(term);
    setSearchTerm(term.trim());
    setCategory('todos');
    if (scroll) scrollToId('produtos');
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setSearchTerm('');
  }, []);

  const selectCategory = useCallback((c: CategoryId | 'todos', scroll = false) => {
    setCategory(c);
    if (scroll && identifyCare(searchTerm)) {
      setQuery('');
      setSearchTerm('');
    }
    if (scroll) scrollToId('produtos');
  }, [searchTerm]);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback<UIContextValue['toast']>(
    (message, opts) => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? 'success', actionLabel: opts?.actionLabel, onAction: opts?.onAction }]);
      setTimeout(() => dismissToast(id), 3600);
    },
    [dismissToast],
  );

  const value = useMemo<UIContextValue>(
    () => ({
      query, setQuery, searchTerm, applySearch, clearSearch, category, selectCategory, onlyPromo, setOnlyPromo,
      showUnavailable, setShowUnavailable, sort, setSort, cartOpen, setCartOpen, checkoutOpen, setCheckoutOpen,
      adminOpen, setAdminOpen, product, openProduct: setProduct, closeProduct: () => setProduct(null), toasts, toast,
      dismissToast, fontScale, setFontScale,
    }),
    [query, searchTerm, applySearch, clearSearch, category, selectCategory, onlyPromo, showUnavailable, sort, cartOpen,
      checkoutOpen, adminOpen, product, toasts, toast, dismissToast, fontScale, setFontScale],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI precisa estar dentro de <UIProvider>');
  return ctx;
}
