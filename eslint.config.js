const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const promisePlugin = require('eslint-plugin-promise');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        project: false
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        Promise: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'promise': promisePlugin
    },
    rules: {
      // Promise-specific rules (these work without type info)
      
      // Promise-specific rules
      'promise/catch-or-return': 'error',
      'promise/always-return': 'error',
      'promise/no-return-wrap': 'error',
      
      // Require await in async functions
      'require-await': 'error',
      
      // Other async best practices
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'prefer-promise-reject-errors': 'error',
      
      // Allow console and require
      'no-console': 'off',
      'no-undef': 'error',
      
      // Allow unused args with underscore prefix
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      
      // Node.js specific
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
];