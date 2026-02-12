import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const externalizeDeps = externalizeDepsPlugin({
  exclude: ['@ccplans/shared'],
});

export default defineConfig({
  main: {
    plugins: [externalizeDeps].filter(Boolean),
    resolve: {
      alias: {
        '@services': resolve('src/main/services'),
        '@ipc': resolve('src/main/ipc'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDeps].filter(Boolean),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@renderer': resolve('src/renderer'),
        '@components': resolve('src/renderer/components'),
        '@pages': resolve('src/renderer/pages'),
        '@hooks': resolve('src/renderer/hooks'),
        '@stores': resolve('src/renderer/stores'),
        '@lib': resolve('src/renderer/lib'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
  },
});
