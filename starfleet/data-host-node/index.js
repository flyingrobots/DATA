/**
 * @fileoverview Node.js host adapters for data-core ports.
 * 
 * This module provides Node.js-specific implementations of the ports that
 * data-core requires. These adapters wrap Node.js built-ins to match the
 * port interfaces defined by data-core.
 * 
 * @module data-host-node
 * @version 1.0.0
 */

// Import all adapter implementations
import { FileSystemAdapter } from './adapters/FileSystemAdapter.js';
import { CryptoAdapter } from './adapters/CryptoAdapter.js';
import { ProcessAdapter } from './adapters/ProcessAdapter.js';
import { EnvironmentAdapter } from './adapters/EnvironmentAdapter.js';
import { GlobAdapter } from './adapters/GlobAdapter.js';

/**
 * Create a complete set of Node.js adapters with default configuration.
 * 
 * @param {Object} [config] - Global configuration options
 * @param {Object} [config.fileSystem] - FileSystem adapter options
 * @param {Object} [config.crypto] - Crypto adapter options
 * @param {Object} [config.process] - Process adapter options
 * @param {Object} [config.environment] - Environment adapter options
 * @param {Object} [config.glob] - Glob adapter options
 * @returns {NodeAdapters} Object containing all configured adapters
 * 
 * @example
 * ```javascript
 * import { createNodeAdapters } from 'data-host-node';
 * 
 * const adapters = createNodeAdapters({
 *   fileSystem: { encoding: 'utf8' },
 *   environment: { prefix: 'DATA_' },
 *   glob: { followSymlinks: true }
 * });
 * 
 * // Use with data-core
 * const core = new DataCore(adapters);
 * ```
 */
export function createNodeAdapters(config = {}) {
  return {
    fileSystem: new FileSystemAdapter(config.fileSystem),
    crypto: new CryptoAdapter(config.crypto),
    process: new ProcessAdapter(config.process),
    environment: new EnvironmentAdapter(config.environment),
    glob: new GlobAdapter(config.glob)
  };
}

/**
 * Create Node.js adapters with development-optimized configuration.
 * 
 * @param {Object} [overrides] - Configuration overrides
 * @returns {NodeAdapters} Development-configured adapters
 * 
 * @example
 * ```javascript
 * import { createDevAdapters } from 'data-host-node';
 * 
 * const adapters = createDevAdapters();
 * // Includes helpful defaults for development work
 * ```
 */
export function createDevAdapters(overrides = {}) {
  return createNodeAdapters({
    fileSystem: {
      encoding: 'utf8',
      mode: 0o644,
      ...overrides.fileSystem
    },
    process: {
      timeout: 60000, // Longer timeout for dev builds
      shell: '/bin/bash',
      ...overrides.process
    },
    environment: {
      defaults: {
        NODE_ENV: 'development',
        DEBUG: '1'
      },
      ...overrides.environment
    },
    glob: {
      absolute: false,
      followSymlinks: true,
      ignore: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '.nyc_output/**'
      ],
      ...overrides.glob
    }
  });
}

/**
 * Create Node.js adapters with production-optimized configuration.
 * 
 * @param {Object} [overrides] - Configuration overrides
 * @returns {NodeAdapters} Production-configured adapters
 * 
 * @example
 * ```javascript
 * import { createProdAdapters } from 'data-host-node';
 * 
 * const adapters = createProdAdapters();
 * // Includes optimized defaults for production use
 * ```
 */
export function createProdAdapters(overrides = {}) {
  return createNodeAdapters({
    fileSystem: {
      encoding: 'utf8',
      mode: 0o644,
      ...overrides.fileSystem
    },
    process: {
      timeout: 30000, // Shorter timeout for prod
      shell: '/bin/sh',
      ...overrides.process
    },
    environment: {
      defaults: {
        NODE_ENV: 'production'
      },
      caseSensitive: true,
      ...overrides.environment
    },
    glob: {
      absolute: true,
      followSymlinks: false, // Security: don't follow symlinks in prod
      caseSensitive: true,
      ignore: [
        'node_modules/**',
        '.git/**',
        '**/.env*',
        '**/.*'
      ],
      ...overrides.glob
    }
  });
}

/**
 * Wire adapters to a data-core instance.
 * This is a convenience function that handles the common pattern
 * of injecting adapters into data-core's dependency injection system.
 * 
 * @param {Object} core - data-core instance
 * @param {NodeAdapters} adapters - Node.js adapters
 * @returns {Object} The core instance with adapters wired
 * 
 * @example
 * ```javascript
 * import { DataCore } from 'data-core';
 * import { createNodeAdapters, wireAdapters } from 'data-host-node';
 * 
 * const core = new DataCore();
 * const adapters = createNodeAdapters();
 * 
 * // Wire the adapters to the core
 * wireAdapters(core, adapters);
 * 
 * // Now core can use the Node.js implementations
 * await core.initialize();
 * ```
 */
export function wireAdapters(core, adapters) {
  // Register adapters with data-core's dependency injection
  if (typeof core.register === 'function') {
    core.register('fileSystem', adapters.fileSystem);
    core.register('process', adapters.process);
    core.register('environment', adapters.environment);
    core.register('glob', adapters.glob);
  } else if (typeof core.setAdapters === 'function') {
    core.setAdapters(adapters);
  } else {
    // Fallback: try direct property assignment
    Object.assign(core, adapters);
  }
  
  return core;
}

// Export individual adapter classes for advanced use cases
export {
  FileSystemAdapter,
  CryptoAdapter,
  ProcessAdapter,
  EnvironmentAdapter,
  GlobAdapter
};

/**
 * @typedef {Object} NodeAdapters
 * @property {FileSystemAdapter} fileSystem - File system operations adapter
 * @property {CryptoAdapter} crypto - Cryptographic operations adapter
 * @property {ProcessAdapter} process - Process execution adapter
 * @property {EnvironmentAdapter} environment - Environment variables adapter
 * @property {GlobAdapter} glob - File pattern matching adapter
 */

/**
 * Default export provides the most common use case.
 * 
 * @example
 * ```javascript
 * import nodeAdapters from 'data-host-node';
 * 
 * const adapters = nodeAdapters(); // Uses createNodeAdapters() with defaults
 * ```
 */
export default createNodeAdapters;