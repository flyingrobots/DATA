/**
 * ESLint configuration for data-host-node
 * Node adapters can use Node.js built-ins
 */

module.exports = {
  env: {
    es2022: true,
    node: true // Host layer CAN use Node
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Host-node should not import from CLI
    'no-restricted-imports': ['error', {
      patterns: [
        '@starfleet/data-cli/*' // Host cannot import from CLI layer
      ]
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
