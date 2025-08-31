/**
 * Test Cache Management Command
 */

const TestCommand = require("../../lib/TestCommand");
const TestCache = require("../../lib/test/TestCache");
const chalk = require("chalk");

/**
 * Manage test result cache (clear, stats, invalidate)
 */
class CacheCommand extends TestCommand {
  constructor(
    databaseUrl,
    serviceRoleKey = null,
    testsDir,
    outputDir,
    logger = null,
    isProd = false,
  ) {
    super(databaseUrl, serviceRoleKey, testsDir, outputDir, logger, isProd);
    this.testCache = new TestCache(".data-cache/test-results", logger);
  }

  /**
   * Execute cache management command
   */
  async performExecute(options = {}) {
    this.emit("start", { isProd: this.isProd, options });

    try {
      const action = options.action || "stats";

      switch (action.toLowerCase()) {
        case "clear":
          return await this._clearCache(options);
        case "stats":
          return await this._showStats(options);
        case "invalidate":
          return await this._invalidateCache(options);
        default:
          throw new Error(
            `Unknown cache action: ${action}. Use 'clear', 'stats', or 'invalidate'.`,
          );
      }
    } catch (error) {
      this.error("Failed to execute cache command", error);
      this.emit("failed", { error });
      throw error;
    }
  }

  /**
   * Clear the test cache
   * @private
   */
  async _clearCache(options) {
    this.progress("Clearing test result cache...");

    const result = await this.testCache.clearCache();

    console.log(""); // Empty line
    console.log(chalk.green.bold("✓ Cache cleared successfully"));
    console.log(chalk.green(`  ${result.filesRemoved} cache files removed`));
    console.log(chalk.green(`  Completed in ${result.duration}ms`));

    this.emit("complete", {
      action: "clear",
      filesRemoved: result.filesRemoved,
      duration: result.duration,
    });

    return result;
  }

  /**
   * Show cache statistics
   * @private
   */
  async _showStats(options) {
    this.progress("Gathering cache statistics...");

    const stats = await this.testCache.getStats();

    console.log(""); // Empty line
    console.log(chalk.cyan.bold("Test Cache Statistics"));
    console.log(chalk.cyan("━".repeat(50)));

    // File statistics
    console.log(chalk.white.bold("Storage:"));
    console.log(chalk.white(`  Directory: ${stats.directory}`));
    console.log(chalk.white(`  Cache files: ${stats.files.count}`));

    if (stats.files.count > 0) {
      console.log(
        chalk.white(
          `  Total size: ${this._formatBytes(stats.files.totalSize)}`,
        ),
      );
      console.log(
        chalk.white(
          `  Average file size: ${this._formatBytes(stats.files.averageSize)}`,
        ),
      );

      if (stats.files.oldest) {
        console.log(
          chalk.white(`  Oldest entry: ${stats.files.oldest.age} minutes ago`),
        );
      }
      if (stats.files.newest) {
        console.log(
          chalk.white(`  Newest entry: ${stats.files.newest.age} minutes ago`),
        );
      }
    }

    console.log(""); // Empty line

    // Performance statistics
    console.log(chalk.white.bold("Performance:"));
    const hitRate = parseFloat(stats.performance.hitRate);
    const hitRateColor =
      hitRate > 75 ? "green" : hitRate > 50 ? "yellow" : "red";
    console.log(
      chalk[hitRateColor](`  Hit rate: ${stats.performance.hitRate}%`),
    );
    console.log(
      chalk.white(`  Total requests: ${stats.performance.totalRequests}`),
    );
    console.log(chalk.green(`  Cache hits: ${stats.performance.hits}`));
    console.log(chalk.red(`  Cache misses: ${stats.performance.misses}`));
    console.log(
      chalk.yellow(`  Cache invalidations: ${stats.performance.invalidations}`),
    );

    if (stats.performance.averageHashTime > 0) {
      console.log(
        chalk.white(
          `  Average hash calculation: ${stats.performance.averageHashTime}ms`,
        ),
      );
    }
    if (stats.performance.averageCacheOpTime > 0) {
      console.log(
        chalk.white(
          `  Average cache operation: ${stats.performance.averageCacheOpTime}ms`,
        ),
      );
    }

    // Show recent activity if available
    if (stats.timings.recentCacheOps.length > 0) {
      console.log(""); // Empty line
      console.log(chalk.white.bold("Recent Cache Activity:"));
      stats.timings.recentCacheOps.forEach((op) => {
        const opColor = op.operation === "hit" ? "green" : "blue";
        const timeAgo = this._formatTimeAgo(new Date(op.timestamp));
        console.log(
          chalk[opColor](
            `  ${op.operation}: ${op.hash}... (${op.duration}ms, ${timeAgo})`,
          ),
        );
      });
    }

    // Performance recommendations
    console.log(""); // Empty line
    console.log(chalk.white.bold("Recommendations:"));

    if (hitRate < 25) {
      console.log(
        chalk.yellow(
          "  • Consider running tests multiple times to build up cache",
        ),
      );
    } else if (hitRate > 90) {
      console.log(
        chalk.green(
          "  • Excellent cache performance! Tests are running efficiently.",
        ),
      );
    } else if (hitRate > 50) {
      console.log(
        chalk.green(
          "  • Good cache performance. Cache is providing significant speedup.",
        ),
      );
    }

    if (stats.files.count > 1000) {
      console.log(
        chalk.yellow(
          "  • Consider clearing old cache entries to save disk space",
        ),
      );
    }

    if (stats.performance.averageHashTime > 100) {
      console.log(
        chalk.yellow(
          "  • Hash calculations are slow. Check for large test files.",
        ),
      );
    }

    this.emit("complete", {
      action: "stats",
      stats: stats,
    });

    return stats;
  }

  /**
   * Invalidate cache entries by pattern
   * @private
   */
  async _invalidateCache(options) {
    const pattern = options.pattern;

    if (!pattern) {
      throw new Error(
        "Pattern is required for cache invalidation. Use --pattern <pattern>",
      );
    }

    this.progress(`Invalidating cache entries matching pattern: ${pattern}`);

    const count = await this.testCache.invalidateByPattern(pattern);

    console.log(""); // Empty line
    if (count > 0) {
      console.log(chalk.green.bold(`✓ Invalidated ${count} cache entries`));
      console.log(chalk.green(`  Pattern: ${pattern}`));
    } else {
      console.log(
        chalk.yellow.bold(
          `No cache entries found matching pattern: ${pattern}`,
        ),
      );
    }

    this.emit("complete", {
      action: "invalidate",
      pattern: pattern,
      invalidatedCount: count,
    });

    return { pattern, invalidatedCount: count };
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Format time ago string
   * @param {Date} date - Date to format
   * @returns {string} Time ago string
   * @private
   */
  _formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  /**
   * Get command usage help
   * @returns {string} Usage information
   */
  static getUsage() {
    return `
Test Cache Management Commands:

  Clear cache:
    ./build/data test cache --clear
    
  Show statistics:
    ./build/data test cache --stats
    
  Invalidate by pattern:
    ./build/data test cache --invalidate --pattern <pattern>
    
Examples:
  ./build/data test cache --stats
  ./build/data test cache --clear
  ./build/data test cache --invalidate --pattern "admin"
  ./build/data test cache --invalidate --pattern "run_pet_tests"
`;
  }
}

module.exports = CacheCommand;
