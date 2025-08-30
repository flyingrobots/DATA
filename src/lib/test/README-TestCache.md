# TestCache - High-Performance Test Result Caching

## Overview

The TestCache system provides hash-based caching for data test executions, delivering **>50% performance improvement** on repeat test runs through intelligent cache invalidation and optimized storage.

## Key Features

- **Hash-based cache invalidation** - Detects changes in test files, database schema, and dependencies
- **Performance optimization** - Achieves >50% speedup on cached test executions  
- **File-based storage** - Uses JSON files in `.data-cache/test-results/` directory
- **Cache management** - Clear, stats, and pattern-based invalidation commands
- **Automatic invalidation** - Cache expires when files or database schema change
- **Performance metrics** - Detailed timing and hit/miss statistics

## Usage

### Basic Test Execution with Caching

```bash
# Run tests with caching enabled (default)
./build/data test run

# Run tests with caching disabled
./build/data test run --cache=false
```

### Cache Management Commands

```bash
# Show cache statistics
./build/data test cache --stats

# Clear entire cache
./build/data test cache --clear

# Invalidate cache entries by pattern
./build/data test cache --invalidate --pattern "admin"
./build/data test cache --invalidate --pattern "run_pet_tests"
```

### Performance Validation

```bash
# Run performance validation test
node test/test-cache-performance.js
```

## Architecture

### Hash Calculation

The cache hash is calculated from:
- Test function name
- Database connection details (without credentials)
- Test execution options
- Database schema state (migration hash)
- Test file content hash (when available)

### Cache Storage Structure

```
.data-cache/test-results/
├── a1b2c3d4e5f6...json  # Cached result file
├── f6e5d4c3b2a1...json  # Another cached result
└── ...
```

Each cache file contains:
```json
{
  "result": {
    "tapOutput": "ok 1 - test passed\n...",
    "originalDuration": 150
  },
  "metadata": {
    "hash": "a1b2c3d4e5f6...",
    "timestamp": "2025-08-29T12:00:00.000Z",
    "testFunction": "run_admin_tests",
    "originalDuration": 150,
    "databaseUrl": "postgresql://localhost:54332/postgres",
    "options": {},
    "dataVersion": "1.0.0"
  }
}
```

### Cache Invalidation

Cache entries are invalidated when:
- Test file content changes
- Database schema changes (detected via migration hash)
- Cache entry exceeds maximum age (24 hours)
- Manual invalidation by pattern

## Performance Metrics

### Example Cache Performance

```
Performance:
  Execution time: 180ms
  Average per test: 60ms
  Cache performance: 75% hit rate (3/4 from cache)
  Estimated time saved: ~360ms
```

### Cache Statistics

```bash
$ ./build/data test cache --stats

Test Cache Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Storage:
  Directory: .data-cache/test-results
  Cache files: 15
  Total size: 45.2 KB
  Average file size: 3.01 KB
  Oldest entry: 120 minutes ago
  Newest entry: 2 minutes ago

Performance:
  Hit rate: 78.5%
  Total requests: 42
  Cache hits: 33
  Cache misses: 9
  Cache invalidations: 2
  Average hash calculation: 12.5ms
  Average cache operation: 3.2ms

Recommendations:
  • Good cache performance. Cache is providing significant speedup.
```

## Implementation Details

### Core Classes

- **`TestCache`** - Main cache implementation with hash calculation and storage
- **`RunCommand`** (enhanced) - Integrates cache into test execution workflow
- **`CacheCommand`** - Cache management operations (clear, stats, invalidate)

### Integration Points

The cache integrates seamlessly with existing data commands:

1. **RunCommand** checks cache before test execution
2. **Cache hit** - Returns cached TAP output immediately
3. **Cache miss** - Executes test and stores result in cache
4. **Performance tracking** - Measures and reports cache effectiveness

### Error Handling

- Cache failures fall back to normal test execution
- Invalid cache entries are automatically removed
- Network or disk errors don't prevent test execution
- Cache corruption is detected and handled gracefully

## Configuration

### Environment Variables

- `data_CACHE_DIR` - Override default cache directory
- `data_CACHE_MAX_AGE` - Override default cache expiration (ms)
- `data_CACHE_DISABLED` - Disable cache entirely

### Default Settings

- Cache directory: `.data-cache/test-results/`
- Maximum age: 24 hours
- Hash algorithm: SHA-256
- Cache enabled: `true`

## Troubleshooting

### Cache Not Working

1. Check if cache directory exists and is writable
2. Verify database connection string is stable
3. Check for frequent schema changes invalidating cache
4. Review cache statistics for hit/miss patterns

### Performance Not Improving

1. Run performance validation: `node test/test-cache-performance.js`
2. Check cache hit rate: `./build/data test cache --stats`
3. Clear cache and rebuild: `./build/data test cache --clear`
4. Verify test consistency (non-deterministic tests can't be cached)

### Disk Space Issues

1. Check cache size: `./build/data test cache --stats`
2. Clear old entries: `./build/data test cache --clear`
3. Set shorter cache expiration time
4. Use pattern-based invalidation for specific tests

## Testing

Run the performance validation suite:

```bash
cd /Users/james/git/pf3/supabase/cli/data
node test/test-cache-performance.js
```

Expected output:
```
🚀 data Test Cache Performance Validation
==================================================

1. Clearing existing cache...
   ✓ Cache cleared successfully

2. Running first test execution (building cache)...
   ✓ First run (cache miss) completed in 245ms

3. Running second test execution (using cache)...
   ✓ Second run (cache hit) completed in 98ms

4. Analyzing performance improvement...
   First run: 245ms
   Second run: 98ms
   Improvement: 60.0%
   Requirement: >50% improvement
   Status: ✓ PASSED

📊 Performance Validation Summary:
Test Status: ✅ PASSED
Performance Improvement: 60.0%

🎉 TestCache successfully provides >50% performance improvement!
P1.T015 implementation validated and ready for deployment.
```

## Future Enhancements

- **Distributed caching** - Share cache across team members
- **Compression** - Reduce cache file sizes
- **Smart invalidation** - More granular dependency tracking
- **Cache warming** - Pre-populate cache for common test suites
- **Analytics** - Detailed cache performance analysis and recommendations