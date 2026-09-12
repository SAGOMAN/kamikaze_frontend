import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = fileURLToPath(new URL('../src', import.meta.url));
const errors = [];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function stripComments(source, kind) {
  if (kind === 'css') {
    return source.replace(/\/\*[\s\S]*?\*\//g, '');
  }
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

for (const file of walk(srcRoot)) {
  const rel = relative(srcRoot, file).replaceAll('\\', '/');
  const ext = extname(file);
  const raw = readFileSync(file, 'utf8');

  if (ext === '.css') {
    const css = stripComments(raw, 'css');
    const mediaPx = [...css.matchAll(/@media[^{]*\d+px/gi)];
    for (const match of mediaPx) {
      errors.push(`${rel}: media query en px → ${match[0].trim()}`);
    }
  }

  if (ext === '.ts' && !rel.endsWith('.spec.ts')) {
    const ts = stripComments(raw, 'ts');
    if (/\binnerWidth\s*[<>=]/.test(ts) || /\binnerWidth\s*<=?\s*\d+/.test(ts)) {
      errors.push(`${rel}: compara innerWidth en píxeles; usar matchMedia con em (MEDIA / isNavCompact)`);
    }
  }

  if (rel === 'index.html') {
    if (!/viewport-fit=cover/.test(raw)) {
      errors.push(`${rel}: falta viewport-fit=cover`);
    }
    if (/user-scalable\s*=\s*no/i.test(raw) || /maximum-scale\s*=\s*1/i.test(raw)) {
      errors.push(`${rel}: el viewport no debe bloquear el zoom`);
    }
  }

  if (rel === 'styles/tokens.css') {
    const css = stripComments(raw, 'css');
    if (!/@media\s*\(\s*pointer\s*:\s*coarse\s*\)[\s\S]*touch-action\s*:\s*manipulation/.test(css)) {
      errors.push(`${rel}: falta touch-action: manipulation en táctil (doble toque)`);
    }
  }
}

if (errors.length) {
  console.error('lint:zoom — falló la consistencia de unidades:\n');
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('lint:zoom — media queries en em, JS sin innerWidth en px, viewport accesible y doble toque táctil.');
