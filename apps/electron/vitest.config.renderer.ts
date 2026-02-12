import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/renderer/**/*.test.{ts,tsx}'],
    exclude: ['src/main/**', 'e2e/**'],
    setupFiles: ['./src/renderer/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/**/*.test.{ts,tsx}',
        'src/renderer/**/*.d.ts',
        'src/renderer/main.tsx',
      ],
      lines: 80,
      branches: 75,
      functions: 80,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@components': resolve(__dirname, 'src/renderer/components'),
      '@pages': resolve(__dirname, 'src/renderer/pages'),
      '@hooks': resolve(__dirname, 'src/renderer/hooks'),
      '@stores': resolve(__dirname, 'src/renderer/stores'),
      '@lib': resolve(__dirname, 'src/renderer/lib'),
    },
  },
});
