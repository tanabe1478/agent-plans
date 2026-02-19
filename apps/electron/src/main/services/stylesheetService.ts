import { access, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, isAbsolute, join, resolve } from 'node:path';
import type { StylesheetLoadResult } from '@agent-plans/shared';

const MAX_STYLESHEET_BYTES = 512 * 1024;

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

  return {
    ok: true,
    path: normalizedPath,
    cssText,
  };
}
