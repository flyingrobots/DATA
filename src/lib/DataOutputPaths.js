const PathResolver = require("./PathResolver");
const path = require("path");

/**
 * dataOutputPaths - Manages all output/write destinations for data
 *
 * This class handles all directories where data writes files.
 * It uses PathResolver to ensure directories exist and are writable.
 * All paths are resolved to absolute paths and cached.
 */
class DataOutputPaths {
  /**
   * Create an dataOutputPaths instance
   * @param {string} migrationsDir - Directory for migration output files
   * @param {string} buildDir - Directory for build artifacts
   * @param {string} reportsDir - Directory for test reports and coverage
   * @param {string} tempDir - Directory for temporary files
   * @param {PathResolver} pathResolver - Optional PathResolver instance
   */
  constructor(
    migrationsDir = null,
    buildDir = null,
    reportsDir = null,
    tempDir = null,
    pathResolver = null,
  ) {
    this.pathResolver = pathResolver || new PathResolver();

    // Store configuration
    this._config = {
      migrationsDir:
        migrationsDir || process.env.data_MIGRATIONS_DIR || "./migrations",
      buildDir: buildDir || process.env.data_BUILD_DIR || "./build",
      reportsDir: reportsDir || process.env.data_REPORTS_DIR || "./reports",
      tempDir: tempDir || process.env.data_TEMP_DIR || "./tmp",
    };

    // Cache for resolved paths
    this._resolvedPaths = {};
    this._resolving = {}; // Prevent duplicate resolution attempts
  }

  /**
   * Get the migrations output directory (creates if needed)
   * @returns {Promise<string>} Absolute path to migrations directory
   */
  getMigrationsDir() {
    return this._resolvePath("migrationsDir");
  }

  /**
   * Get the build output directory (creates if needed)
   * @returns {Promise<string>} Absolute path to build directory
   */
  getBuildDir() {
    return this._resolvePath("buildDir");
  }

  /**
   * Get the reports output directory (creates if needed)
   * @returns {Promise<string>} Absolute path to reports directory
   */
  getReportsDir() {
    return this._resolvePath("reportsDir");
  }

  /**
   * Get the temp output directory (creates if needed)
   * @returns {Promise<string>} Absolute path to temp directory
   */
  getTempDir() {
    return this._resolvePath("tempDir");
  }

  /**
   * Get a migration file path for writing
   * @param {string} filename - The migration filename
   * @returns {Promise<string>} Absolute path where migration can be written
   */
  async getMigrationFilePath(filename) {
    const dir = await this.getMigrationsDir();
    return this.pathResolver.resolveFileForWrite(path.join(dir, filename));
  }

  /**
   * Get a build artifact file path for writing
   * @param {string} filename - The build artifact filename
   * @returns {Promise<string>} Absolute path where artifact can be written
   */
  async getBuildFilePath(filename) {
    const dir = await this.getBuildDir();
    return this.pathResolver.resolveFileForWrite(path.join(dir, filename));
  }

  /**
   * Get a report file path for writing
   * @param {string} filename - The report filename
   * @returns {Promise<string>} Absolute path where report can be written
   */
  async getReportFilePath(filename) {
    const dir = await this.getReportsDir();
    return this.pathResolver.resolveFileForWrite(path.join(dir, filename));
  }

  /**
   * Get a temp file path for writing
   * @param {string} filename - The temp filename
   * @returns {Promise<string>} Absolute path where temp file can be written
   */
  async getTempFilePath(filename) {
    const dir = await this.getTempDir();
    return this.pathResolver.resolveFileForWrite(path.join(dir, filename));
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
  }

  /**
   * Get all configured paths (for debugging)
   * @returns {Object} Configuration object
   */
  getConfig() {
    return { ...this._config };
  }

  /**
   * Clear all cached paths (forces re-resolution)
   */
  clearCache() {
    this._resolvedPaths = {};
    this._resolving = {};
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
      .resolveDirectoryForWrite(this._config[key])
      .then((resolved) => {
        this._resolvedPaths[key] = resolved;
        delete this._resolving[key];
        return resolved;
      })
      .catch((error) => {
        delete this._resolving[key];
        throw new Error(
          `Failed to resolve output path ${key}: ${error.message}`,
        );
      });

    return this._resolving[key];
  }
}

module.exports = DataOutputPaths;
