# Manual Test Scripts

These scripts were originally in the repository root and are manual testing/debugging utilities.

## Files

- **simple-test.js** - Basic functionality test for pgTAPTestScanner
- **test-function-parsing.js** - Executable script to test pgTAP function parsing
- **test-memory-management.js** - Memory management testing (referenced in docs/technical/MEMORY-MANAGEMENT-SUMMARY.md)
- **test_trigger_final.js** - Trigger assertion parsing tests

## Usage

These are standalone scripts that can be run directly:

```bash
node test/manual-scripts/test-function-parsing.js
node test/manual-scripts/test-memory-management.js
```

## Status

These scripts are kept for reference and debugging purposes but are NOT part of the automated test suite. They may be useful for:

- Manual debugging of specific features
- Quick verification of functionality
- Reference for how certain features were tested during development

Consider converting these to proper Vitest tests if they prove valuable for ongoing development.
