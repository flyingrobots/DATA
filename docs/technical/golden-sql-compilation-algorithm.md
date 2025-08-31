# Golden SQL Compilation Algorithm

**Critical Component Documentation**  
**Status**: CORE FUNCTIONALITY  
**Date**: 2025-08-31

## Overview

The Golden SQL algorithm is the SECRET SAUCE that makes D.A.T.A. special. It treats SQL files in Git as the single source of truth and generates migrations through git diffs, not database introspection.

## Core Concept: Golden SQL

"Golden SQL" refers to the authoritative SQL files stored in `/sql/` that define your ENTIRE database schema. These files are:

1. **The Single Source of Truth** - What's in Git IS the database
2. **Organized in Named Directories** - D.A.T.A. handles compilation order
3. **Version Controlled** - Every change is tracked
4. **Deterministic** - Same input always produces same output

## Directory Structure

SQL files are organized in named directories:

```
/sql/
  extensions/     -- PostgreSQL extensions
  schemas/        -- Schema definitions
  types/          -- Custom types and enums  
  tables/         -- Table definitions
  functions/      -- Stored procedures
  views/          -- Views and materialized views
  policies/       -- RLS policies
  triggers/       -- Triggers
  indexes/        -- Indexes
  data/           -- Seed data
```

D.A.T.A. internally processes these in the correct order to ensure:
- Extensions are created before they're used
- Schemas exist before tables are placed in them
- Tables exist before foreign keys reference them
- Functions exist before triggers call them

## The Two-Phase Algorithm

### Phase 1: Compilation (MigrationCompiler)

The `MigrationCompiler` concatenates all SQL files into a single "compiled" migration:

1. **Read directories** in dependency-resolved order (extensions, schemas, types...)
2. **Process each directory**:
   - Find all `.sql` files recursively
   - Sort them alphabetically for consistency
   - Read and concatenate contents
3. **Generate output** with:
   - Header with timestamp and metadata
   - Directory section markers
   - File source comments
   - Footer with statistics

**Output**: A single SQL file representing the COMPLETE database state

### Phase 2: Incremental Migrations (DiffEngine)

The `DiffEngine` generates incremental migrations using git diffs:

1. **Compare Git References**:
   ```bash
   git diff data/prod/last-tag...HEAD -- sql/
   ```

2. **Analyze Changes**:
   - **Additions**: New files or new SQL statements
   - **Modifications**: Changed SQL (generates ALTER statements)
   - **Deletions**: Removed files (generates DROP statements with warnings)

3. **Generate Migration**:
   - Only includes CHANGES since last deployment
   - Not a full rewrite, just the delta
   - Intelligent ALTER statement generation where possible

## The Magic: Git Tags as Deployment Markers

Every deployment creates a git tag:

```
data/prod/2025.241.1430
data/staging/2025.241.1200
```

This enables:
- **Rollback**: Deploy any previous tag's Golden SQL
- **Audit Trail**: Git history shows exactly what was deployed when
- **Diff Generation**: Compare any two points in time

## Example Workflow

1. **Initial Setup**:
   ```bash
   # Create Golden SQL structure
   data init
   
   # Write your SQL files
   vim sql/tables/users.sql
   ```

2. **First Compilation** (Full):
   ```bash
   data db compile
   # Output: migrations/20250831143000_compiled.sql (COMPLETE database)
   ```

3. **Make Changes**:
   ```bash
   # Edit a table
   vim sql/004_tables/users.sql  # Add a column
   git add -A && git commit -m "Add user preferences"
   ```

4. **Generate Incremental Migration**:
   ```bash
   data db migrate generate
   # Uses DiffEngine to create:
   # migrations/20250831144500_add_user_preferences.sql
   # Contains ONLY: ALTER TABLE users ADD COLUMN preferences JSONB;
   ```

5. **Deploy and Tag**:
   ```bash
   data align production
   # Applies migration
   # Creates tag: data/prod/2025.241.1445
   ```

## Critical Implementation Details

### MigrationCompiler

- **Event-Driven**: Emits events for progress tracking
- **Directory Order**: MUST process in numerical order
- **File Tracking**: Records every file processed for audit
- **Error Handling**: Fails fast on any read error

### DiffEngine  

- **Git-Based**: Uses `git diff` not database introspection
- **Intelligent Parsing**: Attempts to generate ALTER statements
- **Safety First**: Warns on destructive operations
- **Tag Aware**: Knows about deployment tags

## Why This Matters

Traditional migration tools:
- Hand-write migrations (error-prone)
- Use database introspection (state can drift)
- Can't rollback reliably (down migrations often broken)
- Mystery state in production

Golden SQL with D.A.T.A.:
- Migrations are generated (deterministic)
- Git is truth (no drift possible)
- Rollback to any tag (guaranteed state)
- Production state = specific git tag

## Testing

Run tests to verify the algorithm:

```bash
# Test MigrationCompiler
node test/test-migration-compiler.js

# Test DiffEngine  
node test/test-diff-engine.js

# Integration test
npm test
```

## Recovery Procedures

If the compilation is broken:

1. **Check directory structure**: Ensure `/sql/` follows the numbered pattern
2. **Validate SQL files**: Each file must be valid SQL
3. **Check git state**: Must be on correct branch with clean working directory
4. **Review last good tag**: Can always rollback to last known good state

## The Secret Sauce

The REAL magic is that we're not trying to be smart about SQL. We're just:

1. Treating files as truth (not database state)
2. Using git for what it's good at (tracking changes)
3. Making deployments deterministic (same input = same output)
4. Tying everything to git tags (perfect audit trail)

This is why D.A.T.A. is special. It's not complex - it's simple done right.

---

**Remember**: This algorithm is the core of D.A.T.A. Without it, we're just another migration tool. WITH it, we're bringing Star Trek-level precision to database deployments.

"The algorithm is logical, Captain." - Lt. Commander Data