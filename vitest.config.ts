import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
