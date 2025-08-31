# CRITICAL: Migration Compiler is Completely Missing

**Status**: 🔴 CRITICAL - Core functionality broken
**Date**: 2025-08-31
**Impact**: HIGH - `data db compile` command is non-functional

## Problem

The legacy build system in `/build/` was removed as dead code, but it turns out there is NO replacement MigrationCompiler in the codebase. This means:

1. **`data db compile` is completely broken** - throws error "Migration compilation not yet implemented"
2. **`data test compile` is completely broken** - throws error "Test compilation not yet implemented"
3. **No native compilation logic exists** in `src/lib/`

## Investigation Results

- Searched for `MigrationCompiler` class - NOT FOUND
- Searched for any `*Compiler*.js` files in `src/lib/` - NOT FOUND
- Found only basic test compilation in `SupabaseTestCommand.compileTests()` method (lines 124-161)
- No SQL source compilation logic exists

## Impact

This is a **CRITICAL BLOCKER** for:
- Database migration development workflow
- Test compilation and execution
- Any SQL source file compilation

## Required Implementation

Need to create `src/lib/MigrationCompiler.js` with:

1. **Core compilation logic**:
   - Read SQL files from source directory
   - Order files by dependencies
   - Concatenate into single migration file
   - Add proper headers and metadata

2. **Event-driven architecture** (matching existing patterns):
   - Emit progress events
   - Handle errors properly
   - Support both db and test compilation modes

3. **Configuration support**:
   - Input/output directories
   - File ordering rules
   - Validation options

## Temporary Workaround

Users can manually concatenate SQL files, but this is error-prone and doesn't handle:
- Dependency ordering
- Proper migration metadata
- Test compilation specifics

## Priority

**IMMEDIATE** - This is core functionality that is completely missing.

## References

- `src/commands/db/CompileCommand.js` - Needs MigrationCompiler
- `src/commands/test/CompileCommand.js` - Needs test compilation
- Removed legacy files: `/build/compile-migration.js`, `/build/compile-tests.js`