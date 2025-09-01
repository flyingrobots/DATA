/**
 * ESLint configuration for data-core
 * Enforces architectural boundaries - NO Node.js built-ins allowed
 */

module.exports = {
  env: {
    es2022: true,
    node: false // Core should not use Node
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Forbid Node.js built-in modules
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'node:fs', message: 'Use FileSystemPort instead of node:fs' },
        { name: 'fs', message: 'Use FileSystemPort instead of fs' },
        { name: 'node:path', message: 'Use path utilities in core or PathPort' },
        { name: 'path', message: 'Use path utilities in core or PathPort' },
        { name: 'node:child_process', message: 'Use ProcessPort instead of node:child_process' },
        { name: 'child_process', message: 'Use ProcessPort instead of child_process' },
        { name: 'node:process', message: 'Use EnvironmentPort/ProcessPort instead of node:process' },
        { name: 'process', message: 'Use EnvironmentPort/ProcessPort instead of process' },
        { name: 'node:events', message: 'Use EventBusPort instead of node:events' },
        { name: 'events', message: 'Use EventBusPort instead of events' },
        { name: 'node:crypto', message: 'Use CryptoPort instead of node:crypto' },
        { name: 'crypto', message: 'Use CryptoPort instead of crypto' },
        { name: 'node:http', message: 'Core should not make HTTP calls directly' },
        { name: 'http', message: 'Core should not make HTTP calls directly' },
        { name: 'node:https', message: 'Core should not make HTTPS calls directly' },
        { name: 'https', message: 'Core should not make HTTPS calls directly' },
        { name: 'node:net', message: 'Core should not use networking directly' },
        { name: 'net', message: 'Core should not use networking directly' },
        { name: 'node:os', message: 'Core should not access OS information directly' },
        { name: 'os', message: 'Core should not access OS information directly' },
        { name: 'node:util', message: 'Core should not use Node util directly' },
        { name: 'util', message: 'Core should not use Node util directly' }
      ],
      patterns: [
        'node:*',        // Block all node: prefixed modules
        '@starfleet/data-host-node/*', // Core cannot import from host layer
        '@starfleet/data-cli/*'        // Core cannot import from CLI layer
      ]
    }],

    // Forbid console usage - use LoggerPort
    'no-console': ['error', {
      allow: [] // No console methods allowed
    }],

    // Forbid process global
    'no-restricted-globals': ['error', {
      name: 'process',
      message: 'Use EnvironmentPort or ProcessPort instead of global process'
    }, {
      name: 'console',
      message: 'Use LoggerPort instead of global console'
    }, {
      name: '__dirname',
      message: 'Core should not use __dirname'
    }, {
      name: '__filename',
      message: 'Core should not use __filename'
    }, {
      name: 'Buffer',
      message: 'Core should not use Buffer directly'
    }],

    // Async/await best practices
    'require-await': 'error',
    'no-return-await': 'error',

    // General code quality
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
