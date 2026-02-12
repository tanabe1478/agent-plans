import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
    exclude: ['src/renderer/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/**/*.test.ts', 'src/main/**/*.d.ts'],
      lines: 85,
      branches: 80,
      functions: 85,
      statements: 85,
    },
  },
});
