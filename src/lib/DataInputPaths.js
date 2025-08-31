const PathResolver = require("./PathResolver");
const path = require("path");

/**
 * dataInputPaths - Manages all input/read sources for data
 *
 * This class handles all directories where data reads files from.
 * It uses PathResolver to ensure directories exist and are readable.
 * All paths are resolved to absolute paths and cached.
 */
class DataInputPaths {
  /**
   * Create an dataInputPaths instance
   * @param {string} sqlDir - Directory containing SQL source files
   * @param {string} testsDir - Directory containing test files
   * @param {string} functionsDir - Directory containing function definitions
   * @param {string} schemasDir - Directory containing schema definitions
   * @param {string} configDir - Directory containing configuration files
   * @param {PathResolver} pathResolver - Optional PathResolver instance
   */
  constructor(
    sqlDir = null,
    testsDir = null,
    functionsDir = null,
    schemasDir = null,
    configDir = null,
    pathResolver = null,
  ) {
    this.pathResolver = pathResolver || new PathResolver();

    // Store configuration with defaults
    this._config = {
      sqlDir: sqlDir || process.env.data_SQL_DIR || "./sql",
      testsDir: testsDir || process.env.data_TESTS_DIR || "./tests",
      functionsDir:
        functionsDir || process.env.data_FUNCTIONS_DIR || "./functions",
      schemasDir: schemasDir || process.env.data_SCHEMAS_DIR || "./schemas",
      configDir: configDir || process.env.data_CONFIG_DIR || ".",
    };

    // Cache for resolved paths
    this._resolvedPaths = {};
    this._resolving = {}; // Prevent duplicate resolution attempts

    // Cache for file listings
    this._fileCache = {};
  }

  /**
   * Get the SQL source directory (must exist)
   * @returns {Promise<string>} Absolute path to SQL directory
   * @throws {Error} If directory doesn't exist or isn't readable
   */
  getSqlDir() {
    return this._resolvePath("sqlDir");
  }

  /**
   * Get the tests source directory (must exist)
   * @returns {Promise<string>} Absolute path to tests directory
   * @throws {Error} If directory doesn't exist or isn't readable
   */
  getTestsDir() {
    return this._resolvePath("testsDir");
  }

  /**
   * Get the functions source directory (must exist)
   * @returns {Promise<string>} Absolute path to functions directory
   * @throws {Error} If directory doesn't exist or isn't readable
   */
  getFunctionsDir() {
    return this._resolvePath("functionsDir");
  }

  /**
   * Get the schemas source directory (must exist)
   * @returns {Promise<string>} Absolute path to schemas directory
   * @throws {Error} If directory doesn't exist or isn't readable
   */
  getSchemasDir() {
    return this._resolvePath("schemasDir");
  }

  /**
   * Get the config directory (must exist)
   * @returns {Promise<string>} Absolute path to config directory
   * @throws {Error} If directory doesn't exist or isn't readable
   */
  getConfigDir() {
    return this._resolvePath("configDir");
  }

  /**
   * Get a specific SQL file path for reading
   * @param {string} filename - The SQL filename (relative to SQL dir)
   * @returns {Promise<string>} Absolute path to the SQL file
   * @throws {Error} If file doesn't exist or isn't readable
   */
  async getSqlFilePath(filename) {
    const dir = await this.getSqlDir();
    return this.pathResolver.resolveFileForRead(path.join(dir, filename));
  }

  /**
   * Get a specific test file path for reading
   * @param {string} filename - The test filename (relative to tests dir)
   * @returns {Promise<string>} Absolute path to the test file
   * @throws {Error} If file doesn't exist or isn't readable
   */
  async getTestFilePath(filename) {
    const dir = await this.getTestsDir();
    return this.pathResolver.resolveFileForRead(path.join(dir, filename));
  }

  /**
   * Get a specific function file path for reading
   * @param {string} filename - The function filename (relative to functions dir)
   * @returns {Promise<string>} Absolute path to the function file
   * @throws {Error} If file doesn't exist or isn't readable
   */
  async getFunctionFilePath(filename) {
    const dir = await this.getFunctionsDir();
    return this.pathResolver.resolveFileForRead(path.join(dir, filename));
  }

  /**
   * Get a specific config file path for reading
   * @param {string} filename - The config filename (relative to config dir)
   * @returns {Promise<string>} Absolute path to the config file
   * @throws {Error} If file doesn't exist or isn't readable
   */
  async getConfigFilePath(filename) {
    const dir = await this.getConfigDir();
    return this.pathResolver.resolveFileForRead(path.join(dir, filename));
  }

  /**
   * Check if a directory exists (without throwing)
   * @param {string} key - Configuration key for the directory
   * @returns {Promise<boolean>} True if directory exists and is readable
   */
  async hasDirectory(key) {
    if (!Object.prototype.hasOwnProperty.call(this._config, key)) {
      throw new Error(`Unknown path configuration: ${key}`);
    }

    try {
      await this.pathResolver.resolveDirectoryForRead(this._config[key]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to find a directory by checking multiple possible locations
   * @param {string} key - Configuration key for the directory
   * @param {string[]} candidates - Array of paths to try
   * @returns {Promise<string|null>} First existing path or null
   */
  async findDirectory(key, candidates) {
    const checkPromises = candidates.map(async (candidate) => {
      this._config[key] = candidate;
      const exists = await this.hasDirectory(key);
      return exists ? { candidate, exists } : null;
    });

    const results = await Promise.allSettled(checkPromises);
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        this._config[key] = result.value.candidate;
        return this._resolvePath(key);
      }
    }
    return null;
  }

  /**
   * Update configuration (useful for CLI overrides)
   * @param {string} key - Configuration key
   * @param {string} value - New value
   */
  setPath(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this._config, key)) {
      throw new Error(`Unknown path configuration: ${key}`);
    }
    this._config[key] = value;
    // Clear cached resolution for this path
    delete this._resolvedPaths[key];
    delete this._resolving[key];
    delete this._fileCache[key];
  }

  /**
   * Get all configured paths (for debugging)
   * @returns {Object} Configuration object
   */
  getConfig() {
    return { ...this._config };
  }

  /**
   * Clear all cached paths and file listings
   */
  clearCache() {
    this._resolvedPaths = {};
    this._resolving = {};
    this._fileCache = {};
  }

  /**
   * Internal method to resolve and cache paths
   * @private
   */
  _resolvePath(key) {
    // Return cached if available
    if (this._resolvedPaths[key]) {
      return this._resolvedPaths[key];
    }

    // Wait if already resolving
    if (this._resolving[key]) {
      return this._resolving[key];
    }

    // Start resolution
    this._resolving[key] = this.pathResolver
      .resolveDirectoryForRead(this._config[key])
      .then((resolved) => {
        this._resolvedPaths[key] = resolved;
        delete this._resolving[key];
        return resolved;
      })
      .catch((error) => {
        delete this._resolving[key];
        throw new Error(
          `Failed to resolve input path ${key}: ${error.message}`,
        );
      });

    return this._resolving[key];
  }
}

module.exports = DataInputPaths;
