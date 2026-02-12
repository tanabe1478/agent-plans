import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**'],
    environmentMatchGlobs: [
      ['src/renderer/**', 'jsdom'],
      ['**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.d.ts'],
      lines: 85,
      branches: 80,
      functions: 85,
      statements: 85,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@services': resolve(__dirname, 'src/main/services'),
      '@ipc': resolve(__dirname, 'src/main/ipc'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@components': resolve(__dirname, 'src/renderer/components'),
      '@pages': resolve(__dirname, 'src/renderer/pages'),
      '@hooks': resolve(__dirname, 'src/renderer/hooks'),
      '@stores': resolve(__dirname, 'src/renderer/stores'),
      '@lib': resolve(__dirname, 'src/renderer/lib'),
    },
  },
});
