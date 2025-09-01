/**
 * Port interfaces for dependency injection in data-core package.
 * These define the contracts that external adapters must implement.
 * All ports are validated at runtime using instanceof checks.
 *
 * @fileoverview Core port definitions for I/O abstraction
 */

/**
 * File system port for reading files and globbing patterns.
 * Provides abstraction over file system operations.
 */
export class FileSystemPort {
  /**
   * Read file contents as string
   * @param {string} path - Absolute file path
   * @returns {Promise<string>} File contents
   * @throws {Error} If file cannot be read
   */
  async readFile(path) {
    throw new Error('FileSystemPort.readFile must be implemented');
  }

  /**
   * Find files matching glob patterns
   * @param {string[]} patterns - Glob patterns to match
   * @param {string} [cwd] - Working directory for glob search
   * @returns {Promise<string[]>} Array of matching file paths
   */
  async glob(patterns, cwd = process.cwd()) {
    throw new Error('FileSystemPort.glob must be implemented');
  }
}

/**
 * Cryptographic port for hashing operations.
 * Provides abstraction over crypto operations.
 */
export class CryptoPort {
  /**
   * Generate hash of byte data
   * @param {Buffer|Uint8Array|string} data - Data to hash
   * @param {string} [algorithm='sha256'] - Hash algorithm
   * @returns {string} Hex-encoded hash
   */
  hash(data, algorithm = 'sha256') {
    throw new Error('CryptoPort.hash must be implemented');
  }
}

/**
 * Process port for spawning child processes.
 * Provides abstraction over process execution.
 */
export class ProcessPort {
  /**
   * Spawn child process with command and arguments
   * @param {string} command - Command to execute
   * @param {string[]} args - Command arguments
   * @param {Object} [options] - Spawn options
   * @param {string} [options.cwd] - Working directory
   * @param {Object} [options.env] - Environment variables
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   */
  async spawn(command, args = [], options = {}) {
    throw new Error('ProcessPort.spawn must be implemented');
  }
}

/**
 * Environment port for accessing environment variables.
 * Provides abstraction over environment access.
 */
export class EnvironmentPort {
  /**
   * Get environment variable value
   * @param {string} key - Environment variable name
   * @param {string} [defaultValue] - Default value if not found
   * @returns {string|undefined} Environment variable value
   */
  get(key, defaultValue) {
    throw new Error('EnvironmentPort.get must be implemented');
  }

  /**
   * Check if environment variable exists
   * @param {string} key - Environment variable name
   * @returns {boolean} True if variable exists
   */
  has(key) {
    throw new Error('EnvironmentPort.has must be implemented');
  }
}

/**
 * Validate that an object implements the required port interface
 * @param {Object} port - Port implementation to validate
 * @param {Function} PortClass - Port class to validate against
 * @throws {Error} If port doesn't implement required interface
 */
export function validatePort(port, PortClass) {
  if (!(port instanceof PortClass)) {
    throw new Error(`Port must be instance of ${PortClass.name}`);
  }
}

// Export dependency injection components
export { DIContainer } from './DIContainer.js';
export { PortFactory, wireDataCore, createPortFactory } from './PortFactory.js';
