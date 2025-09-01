import { glob } from 'glob';
import { resolve, relative, isAbsolute } from 'path';
import minimatch from 'minimatch';

/**
 * Node.js implementation of the Glob port.
 * Provides file pattern matching and globbing functionality.
 *
 * @class GlobAdapter
 */
export class GlobAdapter {
  /**
   * Create a new GlobAdapter instance.
   *
   * @param {Object} options - Configuration options
   * @param {string} [options.cwd] - Default working directory
   * @param {boolean} [options.absolute=false] - Return absolute paths by default
   * @param {boolean} [options.followSymlinks=false] - Follow symbolic links
   * @param {boolean} [options.caseSensitive] - Case sensitive matching (OS default)
   * @param {Array<string>} [options.ignore=[]] - Default ignore patterns
   */
  constructor(options = {}) {
    this.defaultCwd = options.cwd || process.cwd();
    this.defaultAbsolute = options.absolute || false;
    this.followSymlinks = options.followSymlinks || false;
    this.caseSensitive = options.caseSensitive;
    this.defaultIgnore = options.ignore || [];
  }

  /**
   * Find files matching a glob pattern.
   *
   * @param {string} pattern - Glob pattern to match
   * @param {Object} [options] - Globbing options
   * @param {string} [options.cwd] - Working directory override
   * @param {boolean} [options.absolute] - Return absolute paths
   * @param {boolean} [options.onlyFiles=true] - Only return files (not directories)
   * @param {boolean} [options.onlyDirectories=false] - Only return directories
   * @param {Array<string>} [options.ignore] - Additional ignore patterns
   * @param {number} [options.maxDepth] - Maximum directory depth
   * @returns {Promise<Array<string>>} Array of matching file paths
   * @throws {GlobError} When pattern matching fails
   */
  async find(pattern, options = {}) {
    try {
      const globOptions = this._buildGlobOptions(options);

      const matches = await glob(pattern, globOptions);

      // Apply post-processing filters
      let results = matches;

      if (options.onlyDirectories) {
        const { FileSystemAdapter } = await import('./FileSystemAdapter.js');
        const fs = new FileSystemAdapter();
        const filtered = [];

        for (const match of matches) {
          const stats = await fs.stat(match).catch(() => null);
          if (stats && stats.isDirectory) {
            filtered.push(match);
          }
        }
        results = filtered;
      }

      // Sort results for consistency
      results.sort();

      return results;
    } catch (error) {
      throw this._normalizeError(error, 'find', pattern);
    }
  }

  /**
   * Find files matching multiple glob patterns.
   *
   * @param {Array<string>} patterns - Array of glob patterns
   * @param {Object} [options] - Globbing options (same as find)
   * @returns {Promise<Array<string>>} Array of unique matching file paths
   * @throws {GlobError} When pattern matching fails
   */
  async findMultiple(patterns, options = {}) {
    try {
      const allMatches = await Promise.all(patterns.map((pattern) => this.find(pattern, options)));

      // Flatten and deduplicate results
      const uniqueMatches = [...new Set(allMatches.flat())];
      uniqueMatches.sort();

      return uniqueMatches;
    } catch (error) {
      throw this._normalizeError(error, 'findMultiple', patterns.join(', '));
    }
  }

  /**
   * Test if a file path matches a glob pattern.
   *
   * @param {string} filePath - File path to test
   * @param {string} pattern - Glob pattern
   * @param {Object} [options] - Matching options
   * @param {string} [options.cwd] - Working directory for relative paths
   * @param {boolean} [options.caseSensitive] - Case sensitive matching override
   * @returns {boolean} True if path matches pattern
   */
  matches(filePath, pattern, options = {}) {
    try {
      const cwd = options.cwd || this.defaultCwd;
      const caseSensitive =
        options.caseSensitive !== undefined ? options.caseSensitive : this.caseSensitive;

      // Normalize path relative to cwd if not absolute
      let normalizedPath = filePath;
      if (!isAbsolute(filePath)) {
        normalizedPath = resolve(cwd, filePath);
      }

      // Convert to relative path for matching if pattern is relative
      if (!isAbsolute(pattern)) {
        normalizedPath = relative(cwd, normalizedPath);
      }

      const minimatchOptions = {
        dot: true,
        nocase: caseSensitive === false
      };

      return minimatch(normalizedPath, pattern, minimatchOptions);
    } catch (error) {
      return false;
    }
  }

  /**
   * Test if a file path matches any of the provided patterns.
   *
   * @param {string} filePath - File path to test
   * @param {Array<string>} patterns - Array of glob patterns
   * @param {Object} [options] - Matching options (same as matches)
   * @returns {boolean} True if path matches any pattern
   */
  matchesAny(filePath, patterns, options = {}) {
    return patterns.some((pattern) => this.matches(filePath, pattern, options));
  }

  /**
   * Filter an array of file paths by glob patterns.
   *
   * @param {Array<string>} filePaths - Array of file paths
   * @param {Array<string>} includePatterns - Patterns to include
   * @param {Array<string>} [excludePatterns=[]] - Patterns to exclude
   * @param {Object} [options] - Filtering options
   * @param {string} [options.cwd] - Working directory
   * @returns {Array<string>} Filtered file paths
   */
  filter(filePaths, includePatterns, excludePatterns = [], options = {}) {
    return filePaths.filter((filePath) => {
      // Must match at least one include pattern
      const included =
        includePatterns.length === 0 || this.matchesAny(filePath, includePatterns, options);

      // Must not match any exclude pattern
      const excluded =
        excludePatterns.length > 0 && this.matchesAny(filePath, excludePatterns, options);

      return included && !excluded;
    });
  }

  /**
   * Expand a glob pattern to see what files it would match (dry run).
   *
   * @param {string} pattern - Glob pattern to expand
   * @param {Object} [options] - Expansion options (same as find)
   * @returns {Promise<GlobExpansion>} Expansion result with stats
   */
  async expand(pattern, options = {}) {
    const startTime = Date.now();

    try {
      const matches = await this.find(pattern, options);
      const endTime = Date.now();

      return {
        pattern,
        matches,
        count: matches.length,
        duration: endTime - startTime,
        options: { ...options }
      };
    } catch (error) {
      throw this._normalizeError(error, 'expand', pattern);
    }
  }

  /**
   * Watch for file changes matching glob patterns.
   *
   * @param {string|Array<string>} patterns - Glob pattern(s) to watch
   * @param {Object} [options] - Watch options
   * @param {string} [options.cwd] - Working directory
   * @param {Array<string>} [options.ignore] - Ignore patterns
   * @param {boolean} [options.persistent=true] - Keep process alive
   * @param {number} [options.interval=100] - Polling interval for non-native watchers
   * @returns {Promise<GlobWatcher>} File system watcher
   * @throws {GlobError} When watcher setup fails
   */
  async watch(patterns, options = {}) {
    try {
      const { watch: chokidarWatch } = await import('chokidar');

      const watchPatterns = Array.isArray(patterns) ? patterns : [patterns];
      const watchOptions = {
        cwd: options.cwd || this.defaultCwd,
        ignored: [...this.defaultIgnore, ...(options.ignore || [])],
        persistent: options.persistent !== false,
        ignoreInitial: true,
        followSymlinks: this.followSymlinks,
        interval: options.interval || 100,
        binaryInterval: options.binaryInterval || 300
      };

      const watcher = chokidarWatch(watchPatterns, watchOptions);

      return {
        watcher,
        close: () => watcher.close(),
        on: (event, callback) => watcher.on(event, callback),
        off: (event, callback) => watcher.off(event, callback),
        getWatched: () => watcher.getWatched()
      };
    } catch (error) {
      throw this._normalizeError(
        error,
        'watch',
        Array.isArray(patterns) ? patterns.join(', ') : patterns
      );
    }
  }

  /**
   * Build glob options from input parameters.
   *
   * @private
   * @param {Object} options - Input options
   * @returns {Object} Glob library compatible options
   */
  _buildGlobOptions(options = {}) {
    const cwd = options.cwd || this.defaultCwd;
    const absolute = options.absolute !== undefined ? options.absolute : this.defaultAbsolute;

    return {
      cwd: resolve(cwd),
      absolute,
      dot: true,
      ignore: [...this.defaultIgnore, ...(options.ignore || [])],
      followSymbolicLinks: this.followSymlinks,
      onlyFiles: options.onlyFiles !== false && !options.onlyDirectories,
      onlyDirectories: options.onlyDirectories || false,
      maxDepth: options.maxDepth,
      caseSensitiveMatch: this.caseSensitive,
      suppressErrors: false
    };
  }

  /**
   * Normalize glob errors into consistent format.
   *
   * @private
   * @param {Error} error - Original error
   * @param {string} operation - Operation that failed
   * @param {string} pattern - Pattern(s) involved
   * @returns {GlobError} Normalized error
   */
  _normalizeError(error, operation, pattern) {
    const normalizedError = new Error(
      `Glob ${operation} failed for pattern "${pattern}": ${error.message}`
    );
    normalizedError.name = 'GlobError';
    normalizedError.operation = operation;
    normalizedError.pattern = pattern;
    normalizedError.originalError = error;

    return normalizedError;
  }
}

// Note: chokidar is an optional dependency for watching functionality
// If not available, watch() will throw an appropriate error
