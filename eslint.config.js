import js from '@eslint/js';
import promisePlugin from 'eslint-plugin-promise';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        Promise: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    plugins: {
      'promise': promisePlugin
    },
    rules: {
      // Promise-specific rules for proper async handling
      'promise/catch-or-return': 'error',
      'promise/always-return': 'error',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      
      // Require await in async functions
      'require-await': 'error',
      
      // Other async best practices
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'no-return-await': 'error',
      'prefer-promise-reject-errors': 'error',
      
      // ESM-specific rules
      'no-console': 'off',
      'no-undef': 'error',
      'no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      
      // Modern JavaScript best practices
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'comma-dangle': ['error', 'never'],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': 'error'
    }
  }
];