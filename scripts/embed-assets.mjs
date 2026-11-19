#!/usr/bin/env node
/**
 * ============================================================================
 *  Embute as imagens da marca como TEXTO (data URL) em src/assets/embedded.ts
 * ----------------------------------------------------------------------------
 *  Assim a logo e a foto da família ficam dentro do próprio site: não somem
 *  e não dependem de servidores externos.
 *
 *  Uso:  node scripts/embed-assets.mjs
 *  (rode de novo sempre que trocar a logo ou a foto em src/assets)
 * ============================================================================
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/assets/embedded.ts');
const ASSETS = [
  { name: 'LOGO_SRC', file: 'src/assets/logo-farmacia-sao-marcos.png', mime: 'image/png' },
  { name: 'FAMILY_SRC', file: 'src/assets/familia-sao-marcos.jpg', mime: 'image/jpeg' },
];

const previous = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
const lines = ['/* Gerado por scripts/embed-assets.mjs — imagens da marca embutidas como texto. Não edite à mão. */', ''];

for (const a of ASSETS) {
  const path = join(ROOT, a.file);
  let value = '';
  if (existsSync(path)) {
    const data = readFileSync(path);
    value = `data:${a.mime};base64,${data.toString('base64')}`;
    console.log(`✓ ${a.file} (${Math.round(data.length / 1024)} KB)`);
  } else {
    const m = new RegExp(`export const ${a.name} = '([^']*)'`).exec(previous);
    value = m ? m[1] : '';
    console.log(`${value ? '•' : '✗'} ${a.file} não encontrado — ${value ? 'mantida a versão já embutida' : 'o site usará a versão on-line'}`);
  }
  lines.push(`export const ${a.name} = '${value}';`);
}

writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`→ ${OUT.replace(`${ROOT}/`, '')}`);
