export interface XlsxProgress {
  stage: 'zip' | 'strings' | 'sheet' | 'rows' | string;
  rows?: number;
}

export interface ReadXlsxOptions {
  /** Função de descompactação DEFLATE "raw" (no Node: zlib.inflateRawSync). */
  inflateRaw?: (data: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  onProgress?: (info: XlsxProgress) => void;
}

export interface XlsxSheet {
  sheetName: string;
  rows: unknown[][];
}

export function readXlsx(input: ArrayBuffer | Uint8Array, options?: ReadXlsxOptions): Promise<XlsxSheet>;
export function browserInflateRaw(data: Uint8Array): Promise<Uint8Array>;
export function decodeXml(s: string): string;
