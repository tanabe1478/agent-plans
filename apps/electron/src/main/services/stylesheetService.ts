import { access, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, isAbsolute, join, resolve } from 'node:path';
import {
  type StylesheetLoadResult,
  THEME_CONTRACT_SELECTORS,
  THEME_CONTRACT_TOKENS,
} from '@agent-plans/shared';

const MAX_STYLESHEET_BYTES = 512 * 1024;
const ALLOWED_THEME_SELECTORS = new Set<string>(THEME_CONTRACT_SELECTORS);
const ALLOWED_THEME_TOKENS = new Set<string>(THEME_CONTRACT_TOKENS);

function normalizeStylesheetPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed === '~') return homedir();
  if (trimmed.startsWith('~/')) return join(homedir(), trimmed.slice(2));
  return isAbsolute(trimmed) ? trimmed : resolve(trimmed);
}

function withError(path: string, error: string): StylesheetLoadResult {
  return {
    ok: false,
    path,
    error,
  };
}

function validateThemeStylesheetContract(cssText: string): string | null {
  const compactCss = cssText.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!compactCss) {
    return 'Stylesheet is empty.';
  }

  const blocks = [...compactCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  if (blocks.length === 0) {
    return 'Stylesheet must use :root or .dark blocks.';
  }

  let declarationCount = 0;

  for (const block of blocks) {
    const selectorText = (block[1] ?? '').trim();
    const declarationsText = block[2] ?? '';
    const selectors = selectorText
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean);

    if (selectors.length === 0) {
      return 'Stylesheet contains an invalid selector block.';
    }

    for (const selector of selectors) {
      if (!ALLOWED_THEME_SELECTORS.has(selector)) {
        return `Unsupported selector "${selector}". Use only :root or .dark.`;
      }
    }

    const declarations = declarationsText
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean);

    for (const declaration of declarations) {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex <= 0) {
        return 'Each declaration must use the "--token: value" format.';
      }

      const property = declaration.slice(0, separatorIndex).trim();
      if (!property.startsWith('--')) {
        return 'Only CSS custom properties are allowed in user themes.';
      }

      const tokenName = property.slice(2);
      if (!ALLOWED_THEME_TOKENS.has(tokenName)) {
        return `Unknown theme token "${property}".`;
      }
      declarationCount += 1;
    }
  }

  if (declarationCount === 0) {
    return 'Stylesheet must define at least one theme token.';
  }

  return null;
}

export async function loadStylesheet(pathInput: string): Promise<StylesheetLoadResult> {
  const normalizedPath = normalizeStylesheetPath(pathInput);
  if (!normalizedPath) {
    return withError('', 'Stylesheet path is empty.');
  }

  if (extname(normalizedPath).toLowerCase() !== '.css') {
    return withError(normalizedPath, 'Only .css files are supported.');
  }

  try {
    await access(normalizedPath);
  } catch {
    return withError(normalizedPath, 'Stylesheet file was not found.');
  }

  let stats: Awaited<ReturnType<typeof stat>>;
  try {
    stats = await stat(normalizedPath);
  } catch {
    return withError(normalizedPath, 'Unable to read stylesheet metadata.');
  }

  if (!stats.isFile()) {
    return withError(normalizedPath, 'Stylesheet path must point to a file.');
  }

  if (stats.size > MAX_STYLESHEET_BYTES) {
    return withError(normalizedPath, 'Stylesheet file is too large.');
  }

  let cssText: string;
  try {
    cssText = await readFile(normalizedPath, 'utf-8');
  } catch {
    return withError(normalizedPath, 'Failed to read stylesheet content.');
  }

  if (cssText.includes('\u0000')) {
    return withError(normalizedPath, 'Stylesheet appears to be invalid text.');
  }

  const contractError = validateThemeStylesheetContract(cssText);
  if (contractError) {
    return withError(normalizedPath, contractError);
  }

  return {
    ok: true,
    path: normalizedPath,
    cssText,
  };
}
