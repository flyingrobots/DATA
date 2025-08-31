/**
 * Memory-aware batch processor for D.A.T.A. CLI
 * 
 * Processes large datasets in batches with memory monitoring
 * and cleanup to prevent OOM errors.
 * 
 * @class BatchProcessor
 * @author D.A.T.A. Engineering Team
 */

import MemoryMonitor from './MemoryMonitor.js';

class BatchProcessor {
  /**
   * Create a new batch processor
   * @param {Object} scanner - Scanner instance to emit events through
   * @param {Object} options - Configuration options
   * @param {number} options.batchSize - Number of items per batch
   * @param {number} options.maxMemoryMB - Maximum memory usage in MB
   * @param {boolean} options.enableGC - Enable garbage collection
   */
  constructor(scanner, options = {}) {
    this.scanner = scanner;
    this.options = {
      batchSize: options.batchSize || 100,
      maxMemoryMB: options.maxMemoryMB || 500,
      enableGC: options.enableGC || true,
      ...options
    };
    
    this.processedBatches = 0;
    this.totalItems = 0;
  }

  /**
   * Process items in batches with memory management
   * @param {Array} items - Items to process
   * @param {Function} processor - Async function to process each batch
   * @returns {Promise<Array>} Combined results from all batches
   */
  async processBatches(items, processor) {
    const batches = this.createBatches(items);
    let results = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Check memory before processing batch
      const memBefore = MemoryMonitor.getMemoryUsage();
      
      if (MemoryMonitor.shouldTriggerCleanup(memBefore.heapUsed, this.options.maxMemoryMB)) {
        await this.performCleanup();
      }

      // Process batch
      const batchResults = await processor(batch, i);
      results = results.concat(batchResults);
      
      this.processedBatches++;
      this.totalItems += batch.length;

      // Emit progress
      this.scanner.emit('progress', {
        type: 'batch_processed',
        batch: i + 1,
        totalBatches: batches.length,
        itemsProcessed: this.totalItems,
        memoryUsage: MemoryMonitor.getMemoryUsage()
      });

      // Yield to event loop
      await this.yieldToEventLoop();
    }

    return results;
  }

  /**
   * Create batches from items array
   * @param {Array} items - Items to batch
   * @returns {Array<Array>} Array of batches
   */
  createBatches(items) {
    const batches = [];
    for (let i = 0; i < items.length; i += this.options.batchSize) {
      batches.push(items.slice(i, i + this.options.batchSize));
    }
    return batches;
  }

  /**
   * Perform memory cleanup operations
   * @returns {Promise<void>}
   */
  async performCleanup() {
    // Clear temporary references
    if (this.scanner.weakRefs) {
      this.scanner.weakRefs = new WeakMap();
    }

    // Force garbage collection if enabled
    if (this.options.enableGC) {
      const gcResult = MemoryMonitor.forceGC();
      if (gcResult && this.scanner.memoryState) {
        this.scanner.memoryState.gcCount++;
      }
    }

    // Update memory state if available
    if (this.scanner.memoryState) {
      const usage = MemoryMonitor.getMemoryUsage();
      this.scanner.memoryState.currentUsageMB = usage.heapUsed;
      this.scanner.memoryState.maxUsageMB = Math.max(
        this.scanner.memoryState.maxUsageMB,
        usage.heapUsed
      );
      this.scanner.memoryState.lastCleanup = Date.now();
    }

    // Emit cleanup event
    this.scanner.emit('cleanup', {
      type: 'memory_cleanup',
      memoryUsage: MemoryMonitor.getMemoryUsage(),
      gcPerformed: true
    });
  }

  /**
   * Yield control to event loop
   * @returns {Promise<void>}
   */
  async yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
  }

  /**
   * Reset batch processor state
   */
  reset() {
    this.processedBatches = 0;
    this.totalItems = 0;
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing stats
   */
  getStats() {
    return {
      processedBatches: this.processedBatches,
      totalItems: this.totalItems,
      batchSize: this.options.batchSize,
      maxMemoryMB: this.options.maxMemoryMB,
      enableGC: this.options.enableGC
    };
  }
}

export default BatchProcessor;