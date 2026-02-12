import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/preload/**/*.test.ts'],
    exclude: ['src/renderer/**', 'src/main/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/preload/**/*.ts'],
      exclude: ['src/preload/**/*.test.ts', 'src/preload/**/*.d.ts'],
      lines: 85,
      branches: 80,
      functions: 85,
      statements: 85,
    },
  },
});
