import type { Product } from './catalog';

/* ============================================================================
 *  PIPELINE DE RENDER 3D DE PRODUTOS (placeholder pronto para integração)
 * ----------------------------------------------------------------------------
 *  Ao importar/cadastrar produtos novos, chame `queue3DRenders(novos)`.
 *  Cada produto recebe o prompt automático abaixo e a URL gerada é salva em
 *  `product.imageUrl` (exibida no lugar da embalagem ilustrada em SVG).
 *
 *  Integre um provedor real implementando `Render3DProvider`, por exemplo:
 *
 *  // DALL·E 3 (OpenAI) — rode no SEU backend (nunca exponha a chave no site)
 *  const openaiProvider: Render3DProvider = {
 *    name: 'dall-e-3',
 *    async generate(prompt) {
 *      const r = await fetch('/api/render-3d', { method: 'POST', body: JSON.stringify({ prompt, model: 'dall-e-3', size: '1024x1024', quality: 'hd' }) });
 *      return (await r.json()).url;
 *    },
 *  };
 *
 *  // Flux (fal.ai / Replicate) ou Gemini (Imagen) seguem o mesmo contrato.
 * ==========================================================================*/

/** Prompt automático padronizado por produto. */
export function buildProduct3DPrompt(product: Pick<Product, 'name'>): string {
  return `Commercial 3D render of ${product.name}, realistic pharmaceutical packaging mockup, studio lighting, clean soft gradient background, ultra-detailed, photorealistic 8k, professional product photography style.`;
}

export interface Render3DProvider {
  name: string;
  /** Retorna a URL da imagem gerada (ou string vazia se indisponível). */
  generate: (prompt: string, product: Product) => Promise<string>;
}

/** Provedor padrão: não gera imagens (a loja usa a embalagem ilustrada em SVG). */
export const placeholderProvider: Render3DProvider = {
  name: 'placeholder',
  generate: async () => '',
};

export async function generateProduct3DImage(
  product: Product,
  provider: Render3DProvider = placeholderProvider,
): Promise<string | null> {
  const prompt = buildProduct3DPrompt(product);
  try {
    const url = await provider.generate(prompt, product);
    return url || null;
  } catch {
    return null;
  }
}

/** Produtos que ainda não têm render 3D (para alimentar a fila). */
export const pending3DRenders = (products: Product[]) => products.filter((p) => !p.imageUrl);

/** Detecta produtos novos em relação ao catálogo anterior (por código ERP). */
export const diffNewProducts = (previousCodes: Iterable<string>, next: Product[]) => {
  const prev = new Set(previousCodes);
  return next.filter((p) => !prev.has(p.code));
};

/** Fila com concorrência limitada — respeita limites de taxa das APIs de imagem. */
export async function queue3DRenders(
  products: Product[],
  provider: Render3DProvider = placeholderProvider,
  onResult?: (product: Product, url: string | null) => void,
  concurrency = 2,
): Promise<void> {
  const queue = [...products];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      if (!p) break;
      onResult?.(p, await generateProduct3DImage(p, provider));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
}
