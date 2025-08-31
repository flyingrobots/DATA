# Runtime Migration: Node.js to Deno

> [!danger] **This is not yet started, but it is top priority**

## [CRITICAL] Complete Runtime Migration from Node.js to Deno for Edge Function Parity

### Core Information

| Field                 | Why It Matters                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------- |
| **Severity Level**    | 🔴 CRITICAL - Show Stopper                                                               |
| **Location**          | Entire codebase - all JavaScript files                                                   |
| **Category**          | Architecture / Technical Debt                                                            |
| **Brief Description** | Runtime mismatch prevents accurate Edge Function testing                                 |
| **Impact**            | Cannot test Edge Functions in their actual runtime; ES module chaos blocking development |

## Summary

D.A.T.A. currently runs on Node.js but deploys Edge Functions to Deno runtime. This fundamental mismatch means we cannot accurately test what we deploy. Additionally, legacy ES module/CommonJS mixing from NextJS origins causes constant development friction. Migration to Deno eliminates both issues.

## Details

### Root Cause

**Historical:** D.A.T.A. originated in a NextJS project, inheriting mixed module systems. When extracted as standalone CLI, the module confusion persisted.

**Architectural:** Supabase Edge Functions run on Deno. Testing Deno code from Node.js is like testing starship systems in a shuttlecraft - fundamentally incompatible.

### Sequential Analysis

```
STEP 1: Problem Recognition
├─ ES modules failing in tests ✓
├─ Cannot import Edge Functions ✓
└─ Runtime behavior differs ✓

STEP 2: Constraint Analysis
├─ Must test Edge Functions accurately
├─ Must maintain database operations
└─ Must preserve existing functionality

STEP 3: Solution Discovery
├─ Option A: Fix Node modules → Doesn't solve runtime mismatch ✗
├─ Option B: Hybrid approach → Too complex ✗
└─ Option C: Full Deno migration → Solves both problems ✓

STEP 4: Complexity Assessment
├─ Initial estimate: 40-60 hours (with PostgreSQL drivers)
├─ Realization: We use Supabase API, not direct PostgreSQL
└─ Revised estimate: 8-12 hours ✓

STEP 5: Risk Evaluation
├─ API compatibility: Fetch is identical ✓
├─ Team knowledge: Deno is standard JavaScript ✓
├─ Rollback plan: Keep Node branch for 30 days ✓
└─ Risk level: LOW
```

### Example of Current Failure

```javascript
// Current: IMPOSSIBLE in Node.js
import edgeFunction from "./supabase/functions/my-func/index.ts";
// Error: Cannot import Deno-specific APIs

// Future: PERFECT in Deno
import edgeFunction from "./supabase/functions/my-func/index.ts";
const response = await edgeFunction.handler(request); // Works exactly as deployed
```

## Proposed Solution

### Migration Blueprint

#### Phase 1: Environment Setup (Hour 0-1)

```bash
# 1. Create migration branch
git checkout -b deno-migration

# 2. Initialize Deno project
deno init

# 3. Create import map
{
  "imports": {
    "@supabase/": "https://esm.sh/@supabase/supabase-js@2.45.0",
    "cliffy/": "https://deno.land/x/cliffy@v1.0.0/",
    "std/": "https://deno.land/std@0.208.0/"
  }
}
```

#### Phase 2: Core Library Migration (Hour 1-4)

**Order of Operations:**

1. **Base Classes First**

   ```typescript
   // src/lib/Command.ts
   import { EventEmitter } from "std/node/events.ts";

   export abstract class Command extends EventEmitter {
     // Minimal changes needed - EventEmitter compatible
   }
   ```

2. **Configuration System**

   ```typescript
   // src/lib/config.ts
   import { load } from "std/dotenv/mod.ts";

   export async function loadConfig() {
     await load(); // Loads .env automatically
     return {
       supabaseUrl: Deno.env.get("SUPABASE_URL"),
       supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
     };
   }
   ```

3. **Path Resolution**

   ```typescript
   // src/lib/PathResolver.ts
   import { join, resolve } from "std/path/mod.ts";

   export class PathResolver {
     // Path operations nearly identical
   }
   ```

#### Phase 3: Command Migration (Hour 4-8)

**Critical Path Commands:**

```typescript
// Priority 1: Test Commands (for Edge Function testing)
src / commands / test / RunCommand.ts; // Must work first
src / commands / test / CompileCommand.ts; // Validates Edge Functions

// Priority 2: Core Database Commands
src / commands / db / MigrateCommand.ts; // Primary workflow
src / commands / db / CompileCommand.ts; // Migration generation

// Priority 3: Function Commands
src / commands / functions / DeployCommand.ts; // Edge Function deployment
```

**Migration Pattern:**

```typescript
// Before (Node.js)
const fs = require("fs").promises;
const { exec } = require("child_process");
const chalk = require("chalk");

// After (Deno)
const { readFile, writeFile } = Deno;
const { Command } = new Deno.Command();
import { colors } from "std/fmt/colors.ts";
```

#### Phase 4: Test Suite Migration (Hour 8-10)

```typescript
// Test migration pattern
// Before: Vitest
import { describe, it, expect } from "vitest";

// After: Deno.test
import { assertEquals, assertThrows } from "std/assert/mod.ts";

Deno.test("MigrateCommand deploys successfully", async () => {
  const cmd = new MigrateCommand();
  const result = await cmd.execute();
  assertEquals(result.success, true);
});
```

#### Phase 5: Build & Distribution (Hour 10-12)

```bash
# Single binary compilation
deno compile \
  --allow-read \
  --allow-write \
  --allow-net \
  --allow-env \
  --allow-run \
  --output data \
  src/index.ts

# Result: Single 30-50MB executable
# No node_modules, no npm install, just works
```

### File-by-File Migration Checklist

```markdown
## Core Libraries (4 hours)

- [ ] src/lib/Command.js → Command.ts
- [ ] src/lib/DatabaseCommand.js → DatabaseCommand.ts
- [ ] src/lib/SupabaseCommand.js → SupabaseCommand.ts
- [ ] src/lib/TestCommand.js → TestCommand.ts
- [ ] src/lib/CommandRouter.js → CommandRouter.ts
- [ ] src/lib/config.js → config.ts
- [ ] src/lib/PathResolver.js → PathResolver.ts
- [ ] src/lib/db-utils.js → db-utils.ts

## Commands (4 hours)

- [ ] src/commands/db/MigrateCommand.js → MigrateCommand.ts
- [ ] src/commands/db/CompileCommand.js → CompileCommand.ts
- [ ] src/commands/db/ResetCommand.js → ResetCommand.ts
- [ ] src/commands/test/RunCommand.js → RunCommand.ts
- [ ] src/commands/test/CompileCommand.js → CompileCommand.ts
- [ ] src/commands/functions/DeployCommand.js → DeployCommand.ts
- [ ] src/commands/InitCommand.js → InitCommand.ts

## Test System (2 hours)

- [ ] src/lib/testing/TestRequirementAnalyzer.js → TestRequirementAnalyzer.ts
- [ ] src/lib/testing/TestCoverageOrchestrator.js → TestCoverageOrchestrator.ts
- [ ] src/lib/testing/pgTAPTestScanner.js → pgTAPTestScanner.ts
- [ ] src/lib/testing/CoverageEnforcer.js → CoverageEnforcer.ts

## Entry Points (1 hour)

- [ ] bin/data.js → Removed (compiled binary replaces)
- [ ] src/index.js → index.ts

## Configuration (1 hour)

- [ ] package.json → deno.json
- [ ] .eslintrc → Removed (deno lint)
- [ ] vitest.config.js → Removed (Deno.test)
- [ ] tsconfig.json → Removed (Deno native)
```

### Validation Criteria

**Migration Success Metrics:**

1. All existing tests pass in Deno
2. Can import and test actual Edge Functions
3. Binary size < 50MB
4. No node_modules directory exists
5. Single command installation works

### Rollback Plan

```bash
# If migration fails at any point:
git checkout main
git branch -D deno-migration

# Keep Node version in parallel for 30 days:
git checkout -b legacy-node
git tag v1.0.0-final-node
```

## Known Unknowns

1. **pgTAP execution**: Will `Deno.Command` handle pgTAP subprocess correctly?
   - Mitigation: Test in first hour, fallback to shell script

2. **CI/CD compatibility**: Will GitHub Actions support Deno smoothly?
   - Mitigation: denoland/setup-deno action is mature

3. **Developer adoption**: Will team embrace Deno?
   - Mitigation: Deno is just JavaScript with better tooling

## Unknown Unknowns

1. Unexpected Supabase API incompatibilities?
2. Hidden Node-specific dependencies?
3. Performance characteristics different?

## Success Criteria

```typescript
// The Ultimate Test
async function validateMigration() {
  // 1. Can we call Supabase API?
  const migrations = await getMigrations(); // ✓

  // 2. Can we run pgTAP tests?
  const tests = await runTests(); // ✓

  // 3. Can we import Edge Functions?
  const func = await import("./supabase/functions/test/index.ts"); // ✓

  // 4. Can we compile to binary?
  await Deno.run({ cmd: ["deno", "compile", "..."] }); // ✓

  return SUCCESS;
}
```

## Timeline

```
Hour 0-1:   Environment setup, Deno initialization
Hour 1-4:   Core library migration
Hour 4-8:   Command migration
Hour 8-10:  Test migration
Hour 10-12: Build and distribution
Hour 12:    COMPLETE ✓
```

## Impact if NOT Fixed

- **Immediate**: Cannot write integration tests (ES module failures)
- **Short-term**: Edge Function bugs only caught in production
- **Long-term**: Technical debt compounds, migration becomes harder
- **Strategic**: Competitors using Deno gain advantage

## Impact When Fixed

- **Immediate**: All tests pass, development unblocked
- **Short-term**: Perfect Edge Function testing prevents production bugs
- **Long-term**: Single binary distribution, no dependency management
- **Strategic**: Aligned with Supabase platform direction

## Authorization

**Priority Override**: This issue supersedes ALL other issues.

**Rationale**:

1. Current ES module chaos blocks ALL development
2. Edge Function testing gap risks production failures
3. Solution is simpler than initially thought (8-12 hours)
4. Every day delayed adds technical debt

## Final Recommendation

**BEGIN MIGRATION IMMEDIATELY**

The Supabase API revelation changes everything. This is not a risky database driver migration. This is a straightforward runtime swap with identical APIs.

```
Risk:    ██░░░░░░░░ LOW (20%)
Benefit: ██████████ CRITICAL (100%)
Effort:  ████░░░░░░ SMALL (8-12 hours)
Impact:  ██████████ MASSIVE (100%)

Decision: PROCEED IMMEDIATELY
```

---

_"Logic is the beginning of wisdom, not the end."_ - Spock

The logical path is clear. The ES module chaos ends today. The runtime mismatch ends today. D.A.T.A. becomes a Deno application today.

**Status**: Ready to Execute  
**Blocking**: ALL other issues  
**Assignment**: Immediate  
**Completion**: Before undocking from Supa Base 12
