/**
 * Memory Management Enhancements for pgTAPTestScanner
 * 
 * This file contains the memory management improvements that should be applied
 * to the pgTAPTestScanner.js file to prevent OOM errors with large test suites.
 * 
 * Key improvements:
 * 1. Memory-aware coverage database building
 * 2. Efficient memory usage tracking in Node.js
 * 3. Streaming/pagination for large datasets
 * 4. Proper cleanup and garbage collection hints
 */

// Memory monitoring utilities
class MemoryMonitor {
  static getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
    };
  }

  static forceGC() {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  static shouldTriggerCleanup(currentMB, maxMB) {
    return currentMB > (maxMB * 0.8); // Trigger at 80% of max
  }
}

// Streaming coverage database implementation
class StreamingCoverageDatabase {
  constructor(options = {}) {
    this.options = {
      maxObjectsPerType: options.maxObjectsPerType || 10000,
      enableCompression: options.enableCompression || true,
      batchSize: options.batchSize || 100,
      ...options
    };
    
    this.objectCounts = new Map();
    this.compressed = new Map();
    this.overflow = new Set(); // Track overflowed object types
  }

  addObject(objectType, objectName, data) {
    const count = this.objectCounts.get(objectType) || 0;
    
    if (count >= this.options.maxObjectsPerType) {
      this.overflow.add(objectType);
      return false; // Reject to prevent memory overflow
    }

    this.objectCounts.set(objectType, count + 1);
    return true;
  }

  compress(objectType) {
    if (this.compressed.has(objectType)) return;
    
    // Implement compression logic here
    // For now, just mark as compressed
    this.compressed.set(objectType, Date.now());
  }

  getStats() {
    return {
      totalObjects: Array.from(this.objectCounts.values()).reduce((a, b) => a + b, 0),
      objectsByType: Object.fromEntries(this.objectCounts),
      compressedTypes: Array.from(this.compressed.keys()),
      overflowedTypes: Array.from(this.overflow)
    };
  }
}

// Memory-aware batch processor
class BatchProcessor {
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

  createBatches(items) {
    const batches = [];
    for (let i = 0; i < items.length; i += this.options.batchSize) {
      batches.push(items.slice(i, i + this.options.batchSize));
    }
    return batches;
  }

  async performCleanup() {
    // Clear temporary references
    if (this.scanner.weakRefs) {
      this.scanner.weakRefs = new WeakMap();
    }

    // Force garbage collection if enabled
    if (this.options.enableGC) {
      const gcResult = MemoryMonitor.forceGC();
      if (gcResult) {
        this.scanner.memoryState.gcCount++;
      }
    }

    // Update memory state
    const usage = MemoryMonitor.getMemoryUsage();
    this.scanner.memoryState.currentUsageMB = usage.heapUsed;
    this.scanner.memoryState.maxUsageMB = Math.max(
      this.scanner.memoryState.maxUsageMB,
      usage.heapUsed
    );
    this.scanner.memoryState.lastCleanup = Date.now();

    // Emit cleanup event
    this.scanner.emit('cleanup', {
      type: 'memory_cleanup',
      memoryUsage: usage,
      gcPerformed: true
    });
  }

  async yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
  }
}

// Here are the specific code modifications to apply to pgTAPTestScanner.js:

export const MEMORY_ENHANCEMENTS = {
  // 1. Enhanced constructor options
  constructorEnhancement: `
    /**
     * @type {Object} Scanner configuration
     */
    this.options = {
      includeCommented: false,
      fileExtensions: ['.sql'],
      includePatterns: ['**/*'],
      excludePatterns: ['**/node_modules/**', '**/.git/**', '**/.*'],
      ignorePatterns: [], // Legacy RegExp patterns
      validatePlans: true,
      followSymlinks: false,
      maxDepth: 10,
      // Memory management options
      maxMemoryMB: 500, // Maximum memory usage in MB
      batchSize: 100, // Files to process in each batch
      enableStreaming: true, // Enable streaming mode for large datasets
      cleanupInterval: 1000, // Cleanup interval in ms
      maxObjectsPerType: 10000, // Maximum objects per coverage type
      enableGC: true, // Enable garbage collection hints
      enableCompression: false, // Enable data compression (experimental)
      ...options
    };
  `,

  // 2. Additional instance variables
  memoryStateAddition: `
    /**
     * @type {Object} Memory management state
     */
    this.memoryState = {
      currentUsageMB: 0,
      maxUsageMB: 0,
      lastCleanup: Date.now(),
      gcCount: 0,
      batchesProcessed: 0,
      objectsProcessed: 0,
      streamingMode: false
    };
    
    /**
     * @type {WeakMap} Weak references for cleanup
     */
    this.weakRefs = new WeakMap();
    
    /**
     * @type {AbortController} For cancelling operations
     */
    this.abortController = new AbortController();
    
    /**
     * @type {StreamingCoverageDatabase} Memory-aware coverage database
     */
    this.streamingDB = null;
    
    /**
     * @type {BatchProcessor} Batch processing utility
     */
    this.batchProcessor = null;
  `,

  // 3. Memory monitoring initialization
  memoryMonitoringInit: `
    // Initialize memory monitoring
    this._initializeMemoryMonitoring();
  `,

  // 4. Memory monitoring methods
  memoryMonitoringMethods: `
  /**
   * Initialize memory monitoring and management
   * @private
   */
  _initializeMemoryMonitoring() {
    this.streamingDB = new StreamingCoverageDatabase(this.options);
    this.batchProcessor = new BatchProcessor(this, this.options);
    
    // Set up periodic memory monitoring
    if (this.options.cleanupInterval > 0) {
      this.memoryMonitoringInterval = setInterval(() => {
        this._checkMemoryUsage();
      }, this.options.cleanupInterval);
    }
    
    // Listen for process events
    process.once('exit', () => this._cleanup());
    process.once('SIGINT', () => this._cleanup());
    process.once('SIGTERM', () => this._cleanup());
  }

  /**
   * Check current memory usage and trigger cleanup if needed
   * @private
   */
  _checkMemoryUsage() {
    const usage = MemoryMonitor.getMemoryUsage();
    this.memoryState.currentUsageMB = usage.heapUsed;
    this.memoryState.maxUsageMB = Math.max(this.memoryState.maxUsageMB, usage.heapUsed);

    if (MemoryMonitor.shouldTriggerCleanup(usage.heapUsed, this.options.maxMemoryMB)) {
      this._performMemoryCleanup();
    }

    // Emit memory status
    this.emit('memory_status', {
      current: usage.heapUsed,
      max: this.memoryState.maxUsageMB,
      threshold: this.options.maxMemoryMB * 0.8,
      streamingMode: this.memoryState.streamingMode
    });
  }

  /**
   * Perform memory cleanup operations
   * @private
   */
  _performMemoryCleanup() {
    // Switch to streaming mode if not already
    if (!this.memoryState.streamingMode && this.options.enableStreaming) {
      this.memoryState.streamingMode = true;
      this.emit('warning', {
        type: 'memory_threshold',
        message: 'Switching to streaming mode due to high memory usage'
      });
    }

    // Clear weak references
    this.weakRefs = new WeakMap();

    // Compress coverage data if enabled
    if (this.options.enableCompression && this.streamingDB) {
      Object.keys(this.coverageMap).forEach(type => {
        this.streamingDB.compress(type);
      });
    }

    // Force garbage collection if enabled
    if (this.options.enableGC) {
      const gcResult = MemoryMonitor.forceGC();
      if (gcResult) {
        this.memoryState.gcCount++;
      }
    }

    this.memoryState.lastCleanup = Date.now();
  }

  /**
   * Cleanup resources
   * @private
   */
  _cleanup() {
    if (this.memoryMonitoringInterval) {
      clearInterval(this.memoryMonitoringInterval);
    }
    
    if (this.abortController) {
      this.abortController.abort();
    }

    this.emit('cleanup', { type: 'shutdown' });
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage stats
   * @public
   */
  getMemoryStats() {
    return {
      ...this.memoryState,
      currentUsage: MemoryMonitor.getMemoryUsage(),
      streamingDBStats: this.streamingDB?.getStats() || null,
      options: {
        maxMemoryMB: this.options.maxMemoryMB,
        batchSize: this.options.batchSize,
        enableStreaming: this.options.enableStreaming
      }
    };
  }
  `,

  // 5. Enhanced buildCoverageDatabase with memory management
  enhancedBuildCoverageDatabase: `
  /**
   * Build a comprehensive coverage database from all scanned test files
   * with memory management and streaming support
   * 
   * @returns {Promise<Object>} Enhanced coverage database
   * @public
   */
  async buildCoverageDatabase() {
    this.emit('progress', new ProgressEvent('Building coverage database with memory management...'));
    
    // Check if we should use streaming mode
    const initialMemory = MemoryMonitor.getMemoryUsage();
    const shouldStream = this.options.enableStreaming && 
                        (this.testFiles.length > this.options.batchSize || 
                         initialMemory.heapUsed > (this.options.maxMemoryMB * 0.5));
    
    if (shouldStream) {
      return this._buildCoverageDatabaseStreaming();
    } else {
      return this._buildCoverageDatabaseBatched();
    }
  }

  /**
   * Build coverage database using streaming approach
   * @private
   */
  async _buildCoverageDatabaseStreaming() {
    this.memoryState.streamingMode = true;
    
    const database = this._createEmptyDatabase();
    
    // Process files in batches using BatchProcessor
    await this.batchProcessor.processBatches(
      this.testFiles,
      async (batch, batchIndex) => {
        return this._processBatchStreaming(batch, database, batchIndex);
      }
    );

    // Finalize database
    this._identifyCoverageGaps(database);
    this.coverageDatabase = database;
    
    this.emit('success', new SuccessEvent('Streaming coverage database built successfully', {
      totalObjects: this._getTotalIndexedObjects(database),
      totalAssertions: database.assertionCounts.total,
      coverage: this._calculateOverallCoverage(database),
      memoryStats: this.getMemoryStats()
    }));

    return database;
  }

  /**
   * Build coverage database using batched approach
   * @private
   */
  async _buildCoverageDatabaseBatched() {
    const database = this._createEmptyDatabase();
    
    // Process in smaller batches to manage memory
    const batches = [];
    for (let i = 0; i < this.testFiles.length; i += this.options.batchSize) {
      batches.push(this.testFiles.slice(i, i + this.options.batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Check memory before each batch
      const memUsage = MemoryMonitor.getMemoryUsage();
      if (MemoryMonitor.shouldTriggerCleanup(memUsage.heapUsed, this.options.maxMemoryMB)) {
        await this.batchProcessor.performCleanup();
      }

      // Process batch
      for (const testFile of batch) {
        this._processFileForDatabase(testFile, database);
      }

      // Emit progress
      this.emit('progress', {
        type: 'batch_progress',
        batch: i + 1,
        totalBatches: batches.length,
        memoryUsage: memUsage
      });

      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));
    }

    this._identifyCoverageGaps(database);
    this.coverageDatabase = database;
    
    this.emit('success', new SuccessEvent('Batched coverage database built successfully', {
      totalObjects: this._getTotalIndexedObjects(database),
      totalAssertions: database.assertionCounts.total,
      coverage: this._calculateOverallCoverage(database),
      memoryStats: this.getMemoryStats()
    }));

    return database;
  }

  /**
   * Process a batch of files in streaming mode
   * @private
   */
  async _processBatchStreaming(batch, database, batchIndex) {
    const results = [];
    
    for (const testFile of batch) {
      // Check memory limits
      if (this.streamingDB && !this.streamingDB.addObject('files', testFile.filePath, testFile)) {
        this.emit('warning', {
          type: 'memory_limit',
          message: \`File processing limit reached at batch \${batchIndex}\`
        });
        break;
      }

      this._processFileForDatabase(testFile, database);
      results.push(testFile.filePath);
    }

    return results;
  }

  /**
   * Create empty database structure
   * @private
   */
  _createEmptyDatabase() {
    return {
      objects: {
        tables: new Map(),
        columns: new Map(),
        functions: new Map(),
        schemas: new Map(),
        policies: new Map(),
        indexes: new Map(),
        triggers: new Map()
      },
      assertionCounts: {
        total: 0,
        byType: new Map(),
        byObject: new Map()
      },
      gaps: {
        uncoveredObjects: new Set(),
        partialCoverage: new Set()
      },
      fileIndex: new Map(),
      buildTimestamp: new Date().toISOString(),
      totalFiles: this.testFiles.length,
      totalAssertions: this.totalAssertions,
      memoryManaged: true,
      streamingMode: this.memoryState.streamingMode
    };
  }

  /**
   * Process a single file for database building
   * @private
   */
  _processFileForDatabase(testFile, database) {
    // Index file for traceability
    database.fileIndex.set(testFile.filePath, {
      fileName: testFile.fileName,
      assertions: testFile.assertions.length,
      planCount: testFile.planCount,
      dependencies: testFile.dependencies,
      metadata: testFile.metadata
    });

    // Process each assertion in the file
    for (const assertion of testFile.assertions) {
      database.assertionCounts.total++;
      
      // Track assertion types
      const typeCount = database.assertionCounts.byType.get(assertion.type) || 0;
      database.assertionCounts.byType.set(assertion.type, typeCount + 1);

      // Process based on assertion type and extract object information
      this._indexAssertionInDatabase(database, assertion, testFile);
    }
  }
  `
};

export { MemoryMonitor, StreamingCoverageDatabase, BatchProcessor };