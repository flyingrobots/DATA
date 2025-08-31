# One Class Per File Policy Violations

## Issue Title
Audit and refactor codebase to enforce one-class-per-file policy

### Core Information

| Field | Why It Matters |
|-------|---------------|
| **Severity Level** | MEDIUM - Code maintainability |
| **Location** | Multiple files across codebase |
| **Category** | Architecture/Refactoring |
| **Brief Description** | Multiple classes exist in single files, violating maintainability standards |
| **Impact** | Confusion, harder debugging, unclear module boundaries |

## Summary

The codebase contains violations of the one-class-per-file rule. Each file should contain exactly one class, with the filename matching the class name. This makes the codebase self-documenting and improves maintainability.

## Known Violations

### Confirmed Multi-Class Files
1. **src/lib/testing/pgTAPTestScanner-memory-enhanced.js**
   - Contains: `MemoryMonitor`, `StreamingCoverageDatabase`, `BatchProcessor`
   - Should be: Three separate files

### Files to Audit
- All files in `src/lib/`
- All files in `src/commands/`
- Build directory files

## Proposed Solution

1. **Audit Phase**
   ```bash
   # Find all files with multiple class declarations
   grep -r "^class " src/ | awk -F: '{print $1}' | uniq -c | awk '$1 > 1'
   ```

2. **Refactor Phase**
   - Extract each class to its own file
   - Name file after the class (e.g., `MemoryMonitor.js`)
   - Update all imports
   - Test thoroughly

3. **Prevention Phase**
   - Add ESLint rule to enforce one class per file
   - Add pre-commit hook to check for violations

## Acceptance Criteria

- [ ] All classes in separate files
- [ ] Filenames match class names
- [ ] All imports updated and working
- [ ] Tests pass after refactoring
- [ ] ESLint rule added to prevent future violations
- [ ] Documentation updated in CLAUDE.md

## Example Refactoring

Before:
```javascript
// src/lib/testing/pgTAPTestScanner-memory-enhanced.js
class MemoryMonitor { ... }
class StreamingCoverageDatabase { ... }
class BatchProcessor { ... }
```

After:
```javascript
// src/lib/testing/MemoryMonitor.js
class MemoryMonitor { ... }
module.exports = MemoryMonitor;

// src/lib/testing/StreamingCoverageDatabase.js
class StreamingCoverageDatabase { ... }
module.exports = StreamingCoverageDatabase;

// src/lib/testing/BatchProcessor.js
class BatchProcessor { ... }
module.exports = BatchProcessor;
```

## Benefits

- **Clarity**: Filename tells you exactly what's inside
- **Maintainability**: Easy to find and modify specific classes
- **Testing**: Simpler to mock and test individual classes
- **Documentation**: Self-documenting structure
- **Debugging**: Stack traces point to meaningful file names

---

*"One function, one purpose. One class, one file. Simplicity is the ultimate sophistication."* - Engineering Best Practices