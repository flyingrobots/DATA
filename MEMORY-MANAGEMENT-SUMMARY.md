# Memory Management Improvements for pgTAPTestScanner

## Overview

The pgTAPTestScanner.js has been enhanced with comprehensive memory management to prevent OOM errors when processing large test suites. The improvements maintain backward compatibility while adding intelligent resource management.

## Key Improvements Implemented

### 1. **Memory Monitoring & Limits**
- **Configurable memory limits**: Set via `maxMemoryMB` option (default: 500MB)
- **Real-time monitoring**: Periodic memory usage checks with configurable intervals
- **Threshold-based cleanup**: Automatic cleanup when memory usage exceeds 80% of limit
- **Memory statistics**: Detailed reporting of memory usage patterns

### 2. **Streaming & Batch Processing**
- **Automatic streaming mode**: Activates when file count or memory usage is high
- **Configurable batch size**: Process files in batches (default: 100 files per batch)
- **Progress reporting**: Detailed progress events during batch processing
- **Event loop yielding**: Prevents blocking the JavaScript event loop

### 3. **Object Accumulation Limits**
- **Per-type object limits**: Maximum objects per coverage type (default: 10,000)
- **Intelligent pruning**: Keeps most recent objects when limits are reached
- **Warning notifications**: Alerts when limits are hit
- **Graceful degradation**: Continues processing with limited data

### 4. **Garbage Collection Management**
- **Manual GC triggering**: Forces garbage collection when enabled
- **GC availability detection**: Works when Node.js is started with `--expose-gc`
- **Weak references**: Uses WeakMap for temporary data that can be cleaned up
- **Resource cleanup**: Proper cleanup of intervals and controllers

### 5. **Enhanced Coverage Database Building**
- **Memory-aware decision making**: Chooses processing strategy based on memory state
- **Batched processing**: Processes large datasets in manageable chunks
- **Memory metadata**: Tracks memory management state in database
- **Async support**: Non-blocking operations for large datasets

## New Configuration Options

```javascript
const scanner = new pgTAPTestScanner({
  // Memory management options
  maxMemoryMB: 500,           // Maximum memory usage in MB
  batchSize: 100,             // Files to process in each batch
  enableStreaming: true,      // Enable streaming mode for large datasets
  cleanupInterval: 1000,      // Cleanup interval in ms
  maxObjectsPerType: 10000,   // Maximum objects per coverage type
  enableGC: true,             // Enable garbage collection hints
  enableCompression: false,   // Enable data compression (experimental)
  // ... other existing options
});
```

## New Public Methods

### `getMemoryStats()`
Returns comprehensive memory usage statistics:
```javascript
const stats = scanner.getMemoryStats();
console.log('Memory usage:', stats.currentUsage.heapUsed, 'MB');
console.log('Peak usage:', stats.maxUsageMB, 'MB');
console.log('Streaming mode:', stats.streamingMode);
```

## New Events

### Memory Status Event
```javascript
scanner.on('memory_status', (data) => {
  console.log(`Memory: ${data.current}MB/${data.threshold}MB`);
});
```

### Cleanup Event
```javascript
scanner.on('cleanup', (data) => {
  console.log('Cleanup performed:', data.type);
});
```

### Warning Events
```javascript
scanner.on('warning', (data) => {
  console.log('Warning:', data.message);
});
```

## Backward Compatibility

- **Existing API unchanged**: All public methods maintain the same interface
- **Default behavior preserved**: Memory management is enabled by default but non-intrusive
- **Graceful fallbacks**: Continues working even if memory management features aren't available
- **Event-based notifications**: Existing error/progress events still work

## Performance Impact

### Benefits
- **Prevents OOM errors**: No more memory-related crashes on large datasets
- **Predictable memory usage**: Configurable limits prevent runaway memory consumption
- **Better resource utilization**: Intelligent cleanup and garbage collection
- **Progress visibility**: Real-time feedback on processing status

### Considerations
- **Slight overhead**: Memory monitoring adds minimal CPU overhead
- **Async processing**: Some methods now return Promises (buildCoverageDatabase)
- **Batch processing**: May take longer for very large datasets due to careful memory management

## Usage Examples

### Basic Usage (Default Settings)
```javascript
const scanner = new pgTAPTestScanner();
await scanner.scanDirectory('./tests');
const database = await scanner.buildCoverageDatabase(); // Now async
```

### Memory-Constrained Environment
```javascript
const scanner = new pgTAPTestScanner({
  maxMemoryMB: 200,        // Lower memory limit
  batchSize: 50,           // Smaller batches
  enableStreaming: true,   // Force streaming mode
  cleanupInterval: 500     // More frequent cleanup
});

// Monitor memory usage
scanner.on('memory_status', (data) => {
  if (data.current > data.threshold * 0.9) {
    console.warn('High memory usage detected');
  }
});

await scanner.scanDirectory('./tests');
const database = await scanner.buildCoverageDatabase();
```

### High-Performance Environment
```javascript
const scanner = new pgTAPTestScanner({
  maxMemoryMB: 1000,       // Higher memory limit
  batchSize: 500,          // Larger batches
  enableStreaming: false,  // Disable streaming
  enableGC: true,          // Enable manual GC
  cleanupInterval: 5000    // Less frequent cleanup
});
```

## Running with Garbage Collection

For optimal performance, start Node.js with garbage collection exposed:

```bash
node --expose-gc your-script.js
```

This enables the memory management system to manually trigger garbage collection when needed.

## Testing

A test script is provided to verify memory management functionality:

```bash
node test-memory-management.js
```

This script will:
- Test memory monitoring and cleanup
- Verify batch processing works correctly
- Show memory usage statistics
- Demonstrate streaming mode activation

## Migration Notes

### For Existing Code
- Change `buildCoverageDatabase()` calls to `await buildCoverageDatabase()`
- Add error handling for memory limit warnings if needed
- Consider adjusting memory limits based on your environment

### For New Code
- Take advantage of memory events for progress reporting
- Use `getMemoryStats()` for debugging memory issues
- Configure memory options based on expected dataset sizes

## Monitoring & Debugging

### Memory Events
Enable memory status logging to monitor usage:
```javascript
scanner.on('memory_status', (data) => {
  console.log(`Memory: ${data.current}/${data.threshold}MB, Streaming: ${data.streamingMode}`);
});
```

### Performance Metrics
Track processing performance:
```javascript
scanner.on('progress', (data) => {
  if (data.type === 'batch_progress') {
    const rate = data.filesProcessed / ((Date.now() - startTime) / 1000);
    console.log(`Processing rate: ${rate.toFixed(1)} files/sec`);
  }
});
```

## Future Enhancements

- **Data compression**: Experimental compression support for large datasets
- **Persistent caching**: Store processed data to disk for very large projects
- **Memory profiling**: Built-in memory profiling and leak detection
- **Dynamic batch sizing**: Automatically adjust batch sizes based on memory pressure

---

The memory management improvements make pgTAPTestScanner suitable for processing large test suites while maintaining excellent performance and reliability.