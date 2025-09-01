/**
 * Memory monitoring utilities for D.A.T.A. CLI
 *
 * Provides static methods for monitoring and managing memory usage
 * to prevent OOM errors when processing large datasets.
 *
 * @class MemoryMonitor
 * @author D.A.T.A. Engineering Team
 */
class MemoryMonitor {
  /**
   * Get current memory usage statistics
   * @returns {Object} Memory usage in MB
   * @static
   */
  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }

  /**
   * Force garbage collection if available
   * Note: Requires Node.js to be started with --expose-gc flag
   * @returns {boolean} True if GC was triggered, false otherwise
   * @static
   */
  static forceGC() {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Check if memory cleanup should be triggered
   * @param {number} currentMB - Current memory usage in MB
   * @param {number} maxMB - Maximum allowed memory in MB
   * @returns {boolean} True if cleanup should be triggered
   * @static
   */
  static shouldTriggerCleanup(currentMB, maxMB) {
    return currentMB > (maxMB * 0.8); // Trigger at 80% of max
  }

  /**
   * Log memory statistics
   * @param {string} label - Label for the log entry
   * @param {Object} logger - Logger instance (optional)
   * @static
   */
  static logMemoryStats(label = 'Memory', logger = console) {
    const stats = MemoryMonitor.getMemoryUsage();
    logger.log(`[${label}] Heap: ${stats.heapUsed}/${stats.heapTotal} MB, RSS: ${stats.rss} MB`);
  }

  /**
   * Check if system has sufficient memory
   * @param {number} requiredMB - Required memory in MB
   * @returns {boolean} True if sufficient memory available
   * @static
   */
  static hasSufficientMemory(requiredMB) {
    const stats = MemoryMonitor.getMemoryUsage();
    const availableMB = stats.heapTotal - stats.heapUsed;
    return availableMB >= requiredMB;
  }
}

export default MemoryMonitor;
