/** Linha compacta do catálogo (mesma ordem de CATALOG_FIELDS). */
export type CatalogRow = [
  code: string,
  name: string,
  lab: string,
  group: number,
  formula: string,
  stock: number,
  price: number,
  promo: number,
  pmc: number,
  ean: string,
  ms: string,
  curve: string,
  flags: number,
];

export interface CatalogStats {
  totalRows: number;
  active: number;
  inactive: number;
  inStock: number;
  activeInStock: number;
  exported: number;
  promos: number;
  controlled: number;
  skippedNoPrice: number;
  skippedOutOfStock: number;
  groups: number;
}

export interface CatalogFile {
  version: number;
  generatedAt: string;
  source: string;
  sample?: boolean;
  fields: string[];
  groups: string[];
  stats: CatalogStats;
  items: CatalogRow[];
}

export interface BuildCatalogOptions {
  sourceName?: string;
  includeOutOfStock?: boolean;
  sample?: boolean;
}

export interface UpdateCatalogOptions {
  sourceName?: string;
  includeOutOfStock?: boolean;
  /** Ignora o catálogo anterior (substituição completa). */
  replace?: boolean;
}

export interface RowIssue {
  row: number;
  code: string;
  name: string;
  message: string;
}
export interface IncompleteIssue {
  row: number;
  code: string;
  name: string;
  missing: string[];
}
export interface DuplicateIssue {
  code: string;
  name: string;
  rows: number[];
  prices: (number | null)[];
  resolution: string;
}
export interface ProductRef {
  code: string;
  name: string;
}

export interface ImportReport {
  source: string;
  generatedAt: string;
  mode: string;
  headerRow: number;
  missingColumns: string[];
  analyzed: number;
  activeRows: number;
  inactiveRows: number;
  activeInStockRows: number;
  validRows: number;
  catalogBefore: number;
  catalogAfter: number;
  updated: { code: string; name: string; changes: string[] }[];
  unchanged: number;
  added: { code: string; name: string; price: number; stock: number }[];
  priceChanges: { code: string; name: string; oldPrice: number; newPrice: number }[];
  promoChanges: { code: string; name: string; oldPromo: number; newPromo: number }[];
  fieldChanges: Record<string, number>;
  kept: ProductRef[];
  deactivated: ProductRef[];
  unidentified: RowIssue[];
  incomplete: IncompleteIssue[];
  errors: RowIssue[];
  alerts: RowIssue[];
  duplicates: DuplicateIssue[];
  skippedInactiveNew: number;
  skippedOutOfStockNew: number;
  skippedInternal: number;
  demoRemoved: ProductRef[];
}

export const CATALOG_VERSION: number;
export const CATALOG_FIELDS: string[];
export const FLAG_CONTROLLED: number;
export const FLAG_CONTINUOUS: number;
export const FLAG_INACTIVE: number;
export const FLAG_DEMO: number;

export function updateCatalog(
  previous: CatalogFile | null,
  rows: unknown[][],
  options?: UpdateCatalogOptions,
): { file: CatalogFile; report: ImportReport };
export function buildCatalogFromRows(rows: unknown[][], options?: BuildCatalogOptions): CatalogFile;
export function renderReportMarkdown(report: ImportReport): string;
export function reportSummaryRows(report: ImportReport): Array<[string, number]>;
export function cleanProductName(raw: unknown): { name: string; lab: string };
export function detectHeader(rows: unknown[][], maxScan?: number): { row: number; idx: Record<string, number> } | null;
export function summarizeGroups(catalog: CatalogFile): { group: string; count: number }[];
export function similarNames(a: string, b: string): boolean;
export function toNumber(v: unknown): number;
export function isChecked(v: unknown): boolean;
export function normalizeKey(v: unknown): string;
