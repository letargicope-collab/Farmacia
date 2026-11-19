import { create } from 'qrcode';

export interface QrDrawing {
  /** Módulos por lado (sem a margem) */
  size: number;
  /** Lado total, com a margem (zona de silêncio) */
  dim: number;
  /** Desenho SVG de todos os módulos escuros */
  path: string;
}

/** Desenha o QR Code: correção de erros nível M e margem de 4 módulos (recomendação do padrão). */
export function qrDrawing(text: string, margin = 4): QrDrawing {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const data = modules.data;
  let path = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; ) {
      if (!data[y * n + x]) {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < n && data[y * n + x + len]) len++;
      path += `M${x + margin} ${y + margin}h${len}v1h-${len}z`;
      x += len;
    }
  }
  return { size: n, dim: n + margin * 2, path };
}
