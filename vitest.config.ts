import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    host: '127.0.0.1',
  },
  test: {
    api: {
      host: '127.0.0.1',
      port: 63315,
      strictPort: true,
    },
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'tests/**',
        '**/*.d.ts',
        'src/**/*.tsx',
        'src/types/**',
        'src/contexts/**',
        'src/components/ui/**',
        'src/instrumentation.ts',
        'src/instrumentation-client.ts',
        'src/server/auth/config.ts',
        'src/server/auth/index.ts',
        'src/server/db/index.ts',
        'src/server/db/schema.ts',
        'src/server/db/seed.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
