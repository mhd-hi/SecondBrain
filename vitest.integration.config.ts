import path from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

for (const [key, value] of Object.entries(loadEnv('test', process.cwd(), ''))) {
  process.env[key] ??= value;
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/server': path.resolve(__dirname, './node_modules/next/server.js'),
    },
  },
});
