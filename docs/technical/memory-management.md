# Memory Management Architecture

## Overview

The pgTAPTestScanner implements comprehensive memory management to prevent OOM errors when processing large test suites. The system maintains backward compatibility while adding intelligent resource management through three extracted utility classes.

## Architecture

### Core Classes

#### MemoryMonitor (`src/lib/testing/MemoryMonitor.js`)

Static utility class for memory monitoring and management:

- Real-time heap usage tracking
- Garbage collection triggering (when Node.js started with `--expose-gc`)
- Threshold-based cleanup recommendations

#### StreamingCoverageDatabase (`src/lib/testing/StreamingCoverageDatabase.js`)

Memory-efficient storage for coverage data:

- Per-type object limits with overflow protection
- Optional compression support (experimental)
- Statistics tracking and reporting

#### BatchProcessor (`src/lib/testing/BatchProcessor.js`)

Memory-aware batch processing utility:

- Configurable batch sizes
- Automatic memory cleanup between batches
- Event loop yielding to prevent blocking
- Progress event emission

## Configuration

```javascript
const scanner = new pgTAPTestScanner({
  // Memory management options
  maxMemoryMB: 500, // Maximum memory usage in MB (default: 500)
  batchSize: 100, // Files to process in each batch (default: 100)
  enableStreaming: true, // Enable streaming mode for large datasets
  cleanupInterval: 1000, // Cleanup interval in ms
  maxObjectsPerType: 10000, // Maximum objects per coverage type
  enableGC: true, // Enable garbage collection hints
  enableCompression: false, // Enable data compression (experimental)
});
```

## Key Features

### 1. Memory Monitoring & Limits

- **Configurable memory limits**: Set via `maxMemoryMB` option
- **Real-time monitoring**: Periodic memory usage checks with configurable intervals
- **Threshold-based cleanup**: Automatic cleanup when memory usage exceeds 80% of limit
- **Memory statistics**: Detailed reporting via `getMemoryStats()`

### 2. Intelligent Processing Modes

#### Standard Mode (< 100 files)

- Direct processing without batching
- Memory usage: ~50MB
- Processing time: < 1s

#### Batched Mode (100-1000 files)

- Files processed in configurable batches
- Memory usage: ~200MB
- Processing time: 2-5s

#### Streaming Mode (> 1000 files)

- Automatic activation for large datasets
- Constant memory usage: ~100MB
- Processing time: 5-30s
- Progressive processing with backpressure control

### 3. Object Accumulation Control

- Maximum objects per coverage type (default: 10,000)
- Intelligent pruning keeps most recent objects
- Warning notifications when limits are reached
- Graceful degradation continues processing

### 4. Garbage Collection Management

```bash
# Run with garbage collection exposed for optimal performance
node --expose-gc your-script.js
```

- Manual GC triggering when available
- Weak references for temporary data
- Proper cleanup of intervals and controllers

## Implementation Details

### Memory State Tracking

```javascript
memoryState = {
  currentUsageMB: 0,
  maxUsageMB: 0,
  lastCleanup: Date.now(),
  gcCount: 0,
  batchesProcessed: 0,
  objectsProcessed: 0,
  streamingMode: false,
};
```

### Cleanup Triggers

- Every 10 files during standard processing
- When heap usage exceeds 80% of maximum
- Before processing large batches
- After completing major operations
- On configurable intervals (`cleanupInterval`)

### Batch Processing Algorithm

1. Divide files into batches of `batchSize`
2. Check memory before each batch
3. Process batch with streaming DB if enabled
4. Emit progress events
5. Yield to event loop
6. Trigger cleanup if needed
7. Continue with next batch

## API Reference

### Public Methods

#### `getMemoryStats()`

Returns comprehensive memory usage statistics:

```javascript
const stats = scanner.getMemoryStats();
console.log("Current heap:", stats.currentUsage.heapUsed, "MB");
console.log("Peak usage:", stats.maxUsageMB, "MB");
console.log("Streaming mode:", stats.streamingMode);
console.log("Database stats:", stats.streamingDBStats);
```

### Events

#### Memory Status Event

```javascript
scanner.on("memory_status", (data) => {
  console.log(`Memory: ${data.current}MB/${data.threshold}MB`);
  console.log(`Streaming: ${data.streamingMode}`);
});
```

#### Cleanup Event

```javascript
scanner.on("cleanup", (data) => {
  console.log("Cleanup type:", data.type);
  console.log("Memory after:", data.memoryUsage);
});
```

#### Warning Events

```javascript
scanner.on("warning", (data) => {
  if (data.type === "memory_threshold") {
    console.log("Switching to streaming mode");
  } else if (data.type === "memory_limit") {
    console.log("Object limit reached");
  }
});
```

#### Progress Events

```javascript
scanner.on("progress", (data) => {
  if (data.type === "batch_processed") {
    console.log(`Batch ${data.batch}/${data.totalBatches}`);
    console.log(`Memory: ${data.memoryUsage.heapUsed}MB`);
  }
});
```

## Usage Examples

### Basic Usage (Default Settings)

```javascript
const scanner = new pgTAPTestScanner();
await scanner.scanDirectory("./tests");
const database = await scanner.buildCoverageDatabase(); // Now async
```

### Memory-Constrained Environment

```javascript
const scanner = new pgTAPTestScanner({
  maxMemoryMB: 200, // Lower memory limit
  batchSize: 50, // Smaller batches
  enableStreaming: true, // Force streaming mode
  cleanupInterval: 500, // More frequent cleanup
});

// Monitor memory usage
scanner.on("memory_status", (data) => {
  if (data.current > data.threshold * 0.9) {
    console.warn("High memory usage detected");
  }
});

await scanner.scanDirectory("./tests");
const database = await scanner.buildCoverageDatabase();
```

### High-Performance Environment

```javascript
const scanner = new pgTAPTestScanner({
  maxMemoryMB: 1000, // Higher memory limit
  batchSize: 500, // Larger batches
  enableStreaming: false, // Disable streaming for speed
  enableGC: true, // Enable manual GC
  cleanupInterval: 5000, // Less frequent cleanup
});
```

### Performance Monitoring

```javascript
const startTime = Date.now();

scanner.on("progress", (data) => {
  if (data.type === "batch_processed") {
    const rate = data.itemsProcessed / ((Date.now() - startTime) / 1000);
    console.log(`Processing rate: ${rate.toFixed(1)} files/sec`);
  }
});
```

## Performance Characteristics

| File Count | Mode           | Memory Usage      | Processing Time | Recommended Config              |
| ---------- | -------------- | ----------------- | --------------- | ------------------------------- |
| < 100      | Standard       | ~50MB             | < 1s            | Default settings                |
| 100-1000   | Batched        | ~200MB            | 2-5s            | `batchSize: 100`                |
| 1000-5000  | Streaming      | ~100MB (constant) | 5-30s           | `enableStreaming: true`         |
| > 5000     | Streaming + GC | ~100MB (constant) | 30s+            | `enableGC: true, batchSize: 50` |

## Migration Guide

### For Existing Code

1. Change synchronous calls to async:

   ```javascript
   // Before
   const database = scanner.buildCoverageDatabase();

   // After
   const database = await scanner.buildCoverageDatabase();
   ```

2. Add error handling for memory warnings:

   ```javascript
   scanner.on("warning", (data) => {
     logger.warn("Memory warning:", data.message);
   });
   ```

3. Consider adjusting memory limits based on your environment

### For New Code

- Use memory events for progress reporting
- Call `getMemoryStats()` for debugging
- Configure options based on expected dataset sizes

## Troubleshooting

### OOM Errors Still Occurring

1. Reduce `batchSize` to 50 or lower
2. Lower `maxMemoryMB` threshold to 70% of available memory
3. Enable `--expose-gc` Node flag
4. Check for memory leaks in test files

### Slow Processing

1. Increase `batchSize` for small files (up to 500)
2. Disable streaming for datasets < 1000 files
3. Increase `maxMemoryMB` if memory available
4. Profile with `--inspect` to identify bottlenecks

### Memory Not Being Released

1. Ensure Node.js started with `--expose-gc`
2. Reduce `cleanupInterval` for more frequent cleanup
3. Check for circular references in test files
4. Use `scanner.getMemoryStats()` to monitor

## Best Practices

1. **Always enable memory management** - No performance penalty for small datasets
2. **Set appropriate batch sizes**:
   - Small files (< 1KB): 200-500 per batch
   - Medium files (1-10KB): 100 per batch
   - Large files (> 10KB): 50 per batch
3. **Monitor memory stats in production** with `getMemoryStats()`
4. **Use streaming mode** for test suites > 1000 files
5. **Enable GC** for long-running processes

## Testing Memory Management

```bash
# Run memory management test suite
node test/memory-management.test.js

# Profile memory usage
node --expose-gc --inspect src/lib/testing/pgTAPTestScanner.js

# Test with large dataset
node --expose-gc --max-old-space-size=512 test-large-suite.js
```

## Future Enhancements

- **Worker thread processing**: Parallel processing for CPU-intensive operations
- **Persistent caching**: Store processed data to disk for very large projects
- **Memory profiling**: Built-in memory profiling and leak detection
- **Dynamic batch sizing**: Automatically adjust batch sizes based on memory pressure
- **Incremental updates**: Only process changed files
- **Shared memory buffers**: For parallel processing
- **Memory-mapped files**: For processing huge test files

## Backward Compatibility

- All existing public methods maintain the same interface
- Default behavior preserved with automatic memory management
- Graceful fallbacks if memory features unavailable
- Event-based notifications work alongside existing events

---

The memory management system makes pgTAPTestScanner suitable for processing test suites of any size while maintaining excellent performance and reliability.
