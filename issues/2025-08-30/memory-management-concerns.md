# GitHub Issue Format

> [!success] **This issuse has been fixed**

## Issue Title

Implement memory management for large test suite coverage databases

### Core Information

| Field                 | Why It Matters                                                          |
| --------------------- | ----------------------------------------------------------------------- |
| **Severity Level**    | CRITICAL - Risk of OOM errors in production                             |
| **Location**          | `src/lib/testing/pgTAPTestScanner.js` (2,728 lines)                     |
| **Category**          | Performance/Bug                                                         |
| **Brief Description** | Coverage database built entirely in memory without limits               |
| **Impact**            | Memory exhaustion with large test suites could crash deployment process |

## Summary

The pgTAPTestScanner builds potentially large in-memory coverage databases without any memory management, size limits, or cleanup mechanisms. For projects with thousands of tests and database objects, this could lead to out-of-memory errors during the deployment process.

## Details

### Root Cause

The scanner accumulates all coverage data in memory structures (Maps and Objects) without considering memory constraints or implementing pagination/streaming for large datasets.

### Example

```javascript
// Current implementation accumulates everything in memory
buildCoverageDatabase() {
  const database = {
    objects: {},
    byType: {},
    byFile: {},
    gaps: [],
    metadata: {}
  };

  // This grows unbounded!
  for (const [type, objects] of Object.entries(this.coverageMap)) {
    if (!database.byType[type]) {
      database.byType[type] = {};
    }

    for (const [name, coverage] of Object.entries(objects)) {
      // No memory limit checking
      database.objects[`${type}.${name}`] = {
        type,
        name,
        assertions: coverage.assertions || [],
        files: coverage.files || [],
        testCount: coverage.testCount || 0
      };
    }
  }

  return database;
}
```

## Proposed Solution

Implement memory-aware coverage database building with streaming and pagination:

```javascript
class CoverageDatabase {
  constructor(options = {}) {
    this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB default
    this.currentMemory = 0;
    this.useStreaming = options.streaming || false;
    this.tempDir = options.tempDir || "/tmp/coverage";
  }

  async addCoverage(type, name, coverage) {
    const size = this.estimateSize(coverage);

    if (this.currentMemory + size > this.maxMemory) {
      await this.flushToDisk();
    }

    // Add to memory buffer
    this.buffer.push({ type, name, coverage });
    this.currentMemory += size;
  }

  async flushToDisk() {
    // Write current buffer to disk
    const file = path.join(this.tempDir, `coverage-${Date.now()}.json`);
    await fs.writeFile(file, JSON.stringify(this.buffer));
    this.buffer = [];
    this.currentMemory = 0;
  }

  async *iterate() {
    // Stream results from disk if needed
    if (this.useStreaming) {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        const data = await fs.readFile(path.join(this.tempDir, file));
        yield* JSON.parse(data);
      }
    }
    yield* this.buffer;
  }
}
```

### Known Unknowns

- What is the typical memory footprint for coverage of 1000 tests?
- What is the largest test suite we need to support?
- Should we implement disk-based caching for coverage data?

### Unknown Unknowns

- How does memory usage scale with complex assertion patterns?
- Are there memory leaks in the regex processing?
- How does Node.js garbage collection handle large Map structures?

---

_"The complexity of the universe is beyond measure. Every new discovery reveals ten new mysteries." - Data, Star Trek: The Next Generation, "The Most Toys"_
