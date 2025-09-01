/**
 * ESLint configuration for data-cli
 * CLI can import from all layers but should keep commands thin
 */

export default {
  env: {
    es2022: true,
    node: true // CLI can use Node
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Warn against importing adapters directly - use container instead
    'no-restricted-imports': ['warn', {
      patterns: ['@starfleet/data-host-node/adapters/*']
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
    'no-var': 'error',

    // Commands should be thin - warn on large functions
    'max-lines-per-function': ['warn', {
      max: 50,
      skipBlankLines: true,
      skipComments: true
    }]
  }
};
