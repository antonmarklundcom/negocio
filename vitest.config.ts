import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Every test here runs WITHOUT MySQL. That is deliberate: the mapping, the
 * open-now rule, the query helpers and the generated SQL are all pure, so CI
 * needs no database and the suite keeps running.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
});
