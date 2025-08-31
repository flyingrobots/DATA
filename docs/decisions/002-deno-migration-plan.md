# D.A.T.A. → Deno Migration Plan

**Created:** 2025-08-30  
**Status:** DRAFT  
**Estimated Effort:** 40-60 hours  
**Risk Level:** Medium

## Executive Summary

Migrate D.A.T.A. from Node.js to Deno to achieve perfect Supabase Edge Function testing parity and eliminate module system technical debt.

## Why Deno? The 30-Second Pitch

```
Current: Node.js CLI → Deploys to → Deno Edge Functions
         (MISMATCH! 🔴)

Future:  Deno CLI → Deploys to → Deno Edge Functions
         (PERFECT MATCH! ✅)
```

## Migration Phases

### 🏗️ Phase 0: Foundation (Day 1-2)

**Goal:** Prove Deno can handle our core needs

```bash
# Create deno-poc branch
git checkout -b deno-poc

# Test critical capabilities
deno run --allow-net --allow-env test-postgres.ts
deno run --allow-read test-edge-function-import.ts
deno run --allow-run test-pgtap-execution.ts
```

**Checklist:**

- [ ] PostgreSQL connection working
- [ ] Edge Function imports working
- [ ] pgTAP test execution working
- [ ] File system operations working
- [ ] Environment variables working

### 🔄 Phase 1: Core Library Migration (Day 3-7)

**Goal:** Port foundation classes

```typescript
// Old (Node.js)
const { EventEmitter } = require("events");
class Command extends EventEmitter {
  // ...
}

// New (Deno)
import { EventEmitter } from "https://deno.land/std@0.208.0/node/events.ts";
class Command extends EventEmitter {
  // ...
}
```

**Files to Migrate:**

```
src/lib/
├── Command.ts                 (4 hours)
├── DatabaseCommand.ts          (2 hours)
├── SupabaseCommand.ts          (2 hours)
├── TestCommand.ts              (2 hours)
├── CommandRouter.ts            (3 hours)
├── PathResolver.ts             (1 hour)
├── config.ts                   (2 hours)
└── db-utils.ts                 (3 hours)
```

### 🚀 Phase 2: Command Migration (Day 8-14)

**Goal:** Port all commands to Deno

**Priority Order:**

1. **Test commands** (Most complex, highest value)

   ```typescript
   // Focus: Edge Function testing accuracy
   src/commands/test/
   ├── RunCommand.ts      (4 hours)
   ├── CompileCommand.ts  (3 hours)
   └── WatchCommand.ts    (2 hours)
   ```

2. **Database commands** (Core functionality)

   ```typescript
   src/commands/db/
   ├── MigrateCommand.ts  (4 hours)
   ├── CompileCommand.ts  (3 hours)
   └── ResetCommand.ts    (2 hours)
   ```

3. **Function commands** (Edge Function specific)
   ```typescript
   src/commands/functions/
   └── DeployCommand.ts   (3 hours)
   ```

### 🧪 Phase 3: Test Suite Migration (Day 15-18)

**Goal:** All tests running in Deno

```typescript
// Old (Vitest)
import { describe, it, expect } from "vitest";

// New (Deno)
import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("Command emits events correctly", async () => {
  // Test implementation
  assertEquals(result, expected);
});
```

**Test Migration Strategy:**

1. Start with unit tests (simpler)
2. Move to integration tests
3. Add Deno-specific tests for Edge Functions

### 📦 Phase 4: Distribution (Day 19-20)

**Goal:** Single binary distribution

```bash
# Compile to single executable
deno compile \
  --allow-read \
  --allow-write \
  --allow-net \
  --allow-env \
  --allow-run \
  --output data \
  src/index.ts

# Test binary
./data --version
./data db migrate status
```

**Distribution Targets:**

- macOS ARM64 (Apple Silicon)
- macOS x64 (Intel)
- Linux x64
- Windows x64

### 🎯 Phase 5: Cutover (Day 21)

**Goal:** Switch to Deno as primary

1. **Documentation Update**
   - Installation instructions
   - Deno permission model explanation
   - Migration guide for users

2. **CI/CD Update**

   ```yaml
   # .github/workflows/test.yml
   - uses: denoland/setup-deno@v1
     with:
       deno-version: v1.x
   ```

3. **Deprecation Notice**
   - Announce Node version deprecation
   - Set EOL date for Node support

## Dependency Mapping

| Node.js Package | Deno Replacement | Notes                     |
| --------------- | ---------------- | ------------------------- |
| commander       | cliffy           | Better TypeScript support |
| pg              | deno-postgres    | Native Deno driver        |
| chalk           | std/fmt/colors   | Built-in formatting       |
| dotenv          | std/dotenv       | Standard library          |
| fs-extra        | std/fs           | Built-in                  |
| glob            | std/fs/walk      | Built-in                  |
| eslint          | deno lint        | Built-in                  |
| vitest          | Deno.test        | Built-in                  |

## Risk Mitigation

### Risk 1: PostgreSQL Driver Limitations

**Mitigation:**

- Test extensively in Phase 0
- Keep Node.js fallback for complex queries
- Contribute to deno-postgres if needed

### Risk 2: Missing npm Packages

**Mitigation:**

- Use CDN imports: `https://esm.sh/package-name`
- Write native Deno replacements
- Use subprocess for Node-only tools

### Risk 3: Team Learning Curve

**Mitigation:**

- Pair programming during migration
- Create Deno cheat sheet
- Start with familiar patterns

## Success Metrics

### Technical Metrics

- [ ] 100% test coverage maintained
- [ ] Edge Function test accuracy: 100% (up from ~70%)
- [ ] Binary size < 50MB
- [ ] Startup time < 100ms
- [ ] No node_modules directory

### Developer Experience Metrics

- [ ] Installation: Single command
- [ ] No npm install required
- [ ] TypeScript errors caught at runtime
- [ ] Permissions clearly documented

## Rollback Plan

If Deno migration fails:

1. **Keep Node branch updated** (first 30 days)
2. **Dual release** (Node + Deno versions)
3. **Feature freeze** on Node version
4. **Quick fixes only** for Node critical bugs

## Code Examples

### Before (Node.js)

```javascript
// Complex module resolution
const { Command } = require("commander");
const chalk = require("chalk");
const { config } = require("dotenv");
const pg = require("pg");

// Confusing async handling
async function connectDB() {
  const client = new pg.Client(process.env.DATABASE_URL);
  await client.connect();
  return client;
}

// No built-in TypeScript
/** @type {import('./types').Config} */
const conf = loadConfig();
```

### After (Deno)

```typescript
// Clean URL imports
import { Command } from "https://deno.land/x/cliffy@v1.0.0/command/mod.ts";
import { colors } from "https://deno.land/std@0.208.0/fmt/colors.ts";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// Clear permissions needed
async function connectDB() {
  const client = new Client(Deno.env.get("DATABASE_URL"));
  await client.connect();
  return client;
}

// Native TypeScript
const conf: Config = await loadConfig();
```

### Edge Function Testing

```typescript
// IMPOSSIBLE in Node.js (different runtime)
// PERFECT in Deno (same runtime)

async function testEdgeFunction(functionPath: string) {
  // Import actual Edge Function
  const mod = await import(functionPath);

  // Test with Deno-native Request/Response
  const request = new Request("https://example.com", {
    method: "POST",
    body: JSON.stringify({ test: true }),
  });

  // This runs EXACTLY like in production
  const response = await mod.handler(request);

  // Validate using Web Standards
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);
}
```

## Timeline Summary

```
Week 1: Foundation + Core Libraries
Week 2: Commands + Tests
Week 3: Distribution + Documentation
Week 4: Cutover + Monitoring
```

## The Ultimate Test

Can a Supabase developer write an Edge Function and test it with D.A.T.A. without knowing they're using different runtimes?

- **Today with Node.js:** No (subtle differences cause bugs)
- **Tomorrow with Deno:** Yes (identical runtime behavior)

## Decision Point

**Should we proceed with Deno migration?**

If YES → Start Phase 0 immediately  
If NO → Document Node.js module fixes needed  
If MAYBE → Run Phase 0 as experiment (2 days)

---

_"Change is the essential process of all existence."_ - Spock

The module system chaos is unsustainable. Whether we choose Deno or fix Node.js, we must act.
