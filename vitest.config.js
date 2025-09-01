import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // Increased from 10000
    hookTimeout: 15000, // Increased from 10000
    teardownTimeout: 5000, // Increased from 1000
    isolate: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
        execArgv: ['--expose-gc']
      }
    },
    setupFiles: ['./test/setup.js'],
    forceExit: true // Force exit after tests complete
  }
});
