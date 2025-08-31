# Memory Management Implementation Guide

## Overview

The pgTAPTestScanner includes built-in memory management to handle large test suites without OOM errors.

## Features

### Memory Monitoring
- Real-time heap usage tracking
- Automatic cleanup triggers at 80% threshold
- Garbage collection hints when available

### Batch Processing
- Processes files in configurable batches
- Yields to event loop between batches
- Prevents blocking with large datasets

### Streaming Mode
- Automatically enabled for large file sets
- Reduces memory footprint for massive test suites
- Progressive processing with backpressure control

## Configuration

```javascript
const scanner = new pgTAPTestScanner({
  maxMemoryMB: 500,      // Maximum heap usage
  batchSize: 100,        // Files per batch
  enableStreaming: true, // Auto-streaming for large sets
  enableGC: true         // Force GC when available
});
```

## Implementation Details

### Memory State Tracking
```javascript
memoryState = {
  initialUsageMB: 0,
  currentUsageMB: 0,
  maxUsageMB: 0,
  lastCleanup: 0,
  gcCount: 0,
  streamingMode: false
}
```

### Cleanup Triggers
- Every 10 files during processing
- When heap usage exceeds 80% of maximum
- Before processing large batches
- After completing major operations

### Batch Processing Algorithm
1. Divide files into batches of `batchSize`
2. Check memory before each batch
3. Process batch
4. Yield to event loop
5. Trigger cleanup if needed
6. Continue with next batch

## Performance Characteristics

| File Count | Mode | Memory Usage | Processing Time |
|------------|------|--------------|-----------------|
| < 100 | Standard | ~50MB | < 1s |
| 100-1000 | Batched | ~200MB | 2-5s |
| > 1000 | Streaming | ~100MB (constant) | 5-30s |

## Best Practices

1. **Always enable memory management** - no performance penalty for small datasets
2. **Set appropriate batch sizes** - 100 is good default
3. **Monitor memory stats** in production with `getMemoryStats()`
4. **Use streaming mode** for test suites > 1000 files

## Troubleshooting

### OOM Errors
- Reduce `batchSize`
- Lower `maxMemoryMB` threshold
- Enable `--expose-gc` Node flag

### Slow Processing
- Increase `batchSize` for small files
- Disable streaming for small datasets
- Check for memory leaks in test files

## Future Improvements

- Worker thread processing for CPU-intensive operations
- Shared memory buffers for parallel processing
- Incremental coverage database updates
- Memory-mapped file processing for huge test files