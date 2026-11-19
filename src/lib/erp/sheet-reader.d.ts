import type { XlsxProgress } from './xlsx-reader.js';

export type SpreadsheetFormat = 'xlsx' | 'xls' | 'csv' | 'html' | 'xml';

export interface ReadSpreadsheetOptions {
  /** Nome do arquivo (ajuda nas mensagens de erro). */
  fileName?: string;
  /** Descompactação DEFLATE "raw" para .xlsx no Node (zlib.inflateRawSync). */
  inflateRaw?: (data: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  onProgress?: (info: XlsxProgress) => void;
}

export interface SpreadsheetData {
  sheetName: string;
  rows: unknown[][];
  format: SpreadsheetFormat;
}

export const SPREADSHEET_ACCEPT: string;
export const SPREADSHEET_EXTENSIONS: RegExp;
export function formatLabel(format: SpreadsheetFormat): string;
export function readSpreadsheet(input: ArrayBuffer | Uint8Array, options?: ReadSpreadsheetOptions): Promise<SpreadsheetData>;

export const __test: {
  parseSST(segments: Uint8Array[]): string[];
  rkValue(v: number): number;
  parseDelimited(text: string): string[][];
  parseHtmlTable(html: string): string[][];
  decodeText(bytes: Uint8Array): string;
};
