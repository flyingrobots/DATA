// eslint.config.cjs

const js = require("@eslint/js");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const promisePlugin = require("eslint-plugin-promise");

module.exports = [
  js.configs.recommended,

  // Default for plain .js files (ESM by default per your earlier config)
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      parser: tsParser,
      parserOptions: { project: false },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        global: "readonly",
        Promise: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      promise: promisePlugin,
    },
    rules: {
      // Promise rules
      "promise/catch-or-return": "error",
      "promise/always-return": "error",
      "promise/no-return-wrap": "error",

      // Async best practices
      "require-await": "error",
      "no-async-promise-executor": "error",
      "no-await-in-loop": "warn",
      "prefer-promise-reject-errors": "error",

      // General
      "no-console": "off",
      "no-undef": "error",

      // Unused handling: allow names starting with _
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Node interop
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",

      // Keep this ON; fix code instead of disabling
      "no-dupe-keys": "error",
    },
  },

  // ESM .mjs explicitly
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      parser: tsParser,
      parserOptions: { project: false },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      promise: promisePlugin,
    },
    rules: {
      "promise/catch-or-return": "error",
      "promise/always-return": "error",
      "promise/no-return-wrap": "error",
      "no-await-in-loop": "warn",
      "prefer-promise-reject-errors": "error",
      "no-console": "off",
      "no-undef": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-dupe-keys": "error",
    },
  },

  // CommonJS .cjs explicitly
  {
    files: ["**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      parser: tsParser,
      parserOptions: { project: false },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      promise: promisePlugin,
    },
    rules: {
      "promise/catch-or-return": "error",
      "promise/always-return": "error",
      "promise/no-return-wrap": "error",
      "require-await": "error",
      "no-async-promise-executor": "error",
      "no-await-in-loop": "warn",
      "prefer-promise-reject-errors": "error",
      "no-console": "off",
      "no-undef": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-dupe-keys": "error",
    },
  },

  // **NEW**: TypeScript files override (this is what you were missing)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        project: false, // set your tsconfig path if you want type-aware linting
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      promise: promisePlugin,
    },
    rules: {
      "promise/catch-or-return": "error",
      "promise/always-return": "error",
      "promise/no-return-wrap": "error",
      "require-await": "error",
      "no-async-promise-executor": "error",
      "no-await-in-loop": "warn",
      "prefer-promise-reject-errors": "error",

      // TS unused vars — allow underscore
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Keep dup-keys on
      "no-dupe-keys": "error",
    },
  },

  // Ignore typical folders
  {
    ignores: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.cache/**",
    ],
  },
];
