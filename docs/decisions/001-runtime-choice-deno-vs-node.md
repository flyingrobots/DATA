# Architectural Decision Record: Runtime Choice - Deno vs Node.js

**Date:** 2025-08-30  
**Status:** PROPOSED  
**Deciders:** @james, D.A.T.A. Development Team  
**Technical Story:** The D.A.T.A. CLI tool currently suffers from ES module/CommonJS mixing issues inherited from its NextJS origins. With Supabase Edge Functions running on Deno, we must decide whether to migrate.

## Context and Problem Statement

D.A.T.A. (Database Automation, Testing, and Alignment) is a CLI tool that manages:

1. PostgreSQL/Supabase database migrations
2. Supabase Edge Functions deployment and testing
3. pgTAP test execution and coverage enforcement
4. Production deployment safety

Current pain points:

- **Module System Chaos**: Mixed CommonJS/ESM causing test failures and import issues
- **Runtime Mismatch**: We deploy to Deno (Edge Functions) but develop in Node.js
- **TypeScript Gaps**: Using JSDoc instead of native TypeScript
- **Dependency Hell**: 500+ packages in node_modules for basic functionality
- **Testing Friction**: Can't accurately test Edge Functions in Node environment

## Decision Drivers

1. **Primary Mission**: Safely manage database migrations and Edge Functions
2. **Developer Experience**: Must be smooth for Supabase developers
3. **Edge Function Parity**: Need accurate local testing of Deno runtime behavior
4. **Maintenance Burden**: Reduce complexity and technical debt
5. **Performance**: CLI should be fast and responsive
6. **Distribution**: Easy installation for users

## Considered Options

### Option 1: Full Migration to Deno 🦕

**Complete rewrite of D.A.T.A. as a Deno application**

```typescript
// Native TypeScript, no transpilation
import { Command } from "https://deno.land/x/cliffy@v1.0.0/command/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";

// Direct Edge Function testing
const edgeFunction = await import("./supabase/functions/my-function/index.ts");
```

**Pros:**

- ✅ **Perfect Edge Function parity**: Test functions in exact runtime
- ✅ **TypeScript native**: No transpilation, true type safety
- ✅ **Single executable**: `deno compile` creates standalone binary
- ✅ **Security model**: Explicit permissions for database access
- ✅ **Modern tooling**: Built-in formatter, linter, test runner
- ✅ **No node_modules**: URL imports, no package.json
- ✅ **Web standards**: Fetch, crypto, streams match Edge Functions
- ✅ **Future-proof**: Aligns with Supabase's direction

**Cons:**

- ❌ **PostgreSQL drivers**: Less mature (but improving rapidly)
- ❌ **Ecosystem gaps**: Some tools unavailable (pgTAP runners, etc.)
- ❌ **Rewrite effort**: 40-60 hours of migration work
- ❌ **Team learning**: Everyone needs Deno knowledge
- ❌ **Early adopter risk**: Breaking changes still happening

**Implementation Path:**

```bash
# Phase 1: Core migration (Week 1)
- Port Command base classes
- Migrate to Deno PostgreSQL driver
- Convert test suite to Deno.test

# Phase 2: Feature parity (Week 2)
- Port all commands
- Implement Edge Function testing
- Migration compilation

# Phase 3: Enhancements (Week 3)
- Add Deno-specific features
- Performance optimizations
- Distribution setup
```

### Option 2: Stay with Node.js + Fix Module System 📦

**Properly configure TypeScript and ES modules**

```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**Pros:**

- ✅ **Mature ecosystem**: All tools available
- ✅ **Team familiarity**: Everyone knows Node
- ✅ **Minimal migration**: Just configuration fixes
- ✅ **pg driver**: Battle-tested PostgreSQL support
- ✅ **CI/CD support**: Works everywhere

**Cons:**

- ❌ **Runtime mismatch**: Can't accurately test Edge Functions
- ❌ **Module complexity**: Even "fixed", still complex
- ❌ **Bundle size**: Node_modules bloat
- ❌ **Technical debt**: Carries forward legacy issues
- ❌ **Two TypeScripts**: Different configs for Edge Functions vs CLI

### Option 3: Hybrid Architecture 🔀

**Node.js for CLI, Deno for Edge Function testing**

```javascript
// Node CLI orchestrates
await exec("deno run --allow-net test-edge-function.ts");

// Deno subprocess tests Edge Functions
const result = await testInDenoRuntime(functionCode);
```

**Pros:**

- ✅ **Best of both**: Node ecosystem + Deno accuracy
- ✅ **Incremental migration**: Can move pieces over time
- ✅ **Risk mitigation**: Keep working system while experimenting

**Cons:**

- ❌ **Complexity explosion**: Two runtimes to maintain
- ❌ **Context switching**: Developers juggle two systems
- ❌ **Distribution harder**: Need both runtimes installed
- ❌ **Debugging nightmare**: Cross-runtime issues

### Option 4: Migrate to Bun 🥟

**Use Bun as Node-compatible modern runtime**

**Pros:**

- ✅ **Node compatibility**: Most packages work
- ✅ **Fast**: Blazing performance
- ✅ **Modern**: TypeScript native, JSX support

**Cons:**

- ❌ **Not Deno**: Still doesn't match Edge Functions
- ❌ **Newer than Deno**: Even less mature
- ❌ **Different goals**: Optimized for different use cases

### Option 5: Build Runtime Abstraction Layer 🏗️

**Create abstraction that can run on both**

```typescript
interface Runtime {
  fetch: GlobalFetch;
  crypto: Crypto;
  readFile: (path: string) => Promise<string>;
}
```

**Cons:**

- ❌ **Lowest common denominator**: Lose runtime-specific features
- ❌ **Abstraction overhead**: More code to maintain
- ❌ **Still doesn't solve**: Edge Function testing accuracy

## Decision Outcome

### 🎯 **RECOMMENDATION: Option 1 - Full Migration to Deno**

### Rationale:

1. **Mission Alignment**: D.A.T.A.'s primary purpose includes managing Supabase Edge Functions. Using the same runtime eliminates an entire class of "works on my machine" problems.

2. **Technical Debt Resolution**: Instead of patching Node.js module issues, we eliminate them entirely. Deno was built with hindsight of Node's mistakes.

3. **Developer Experience**: A Supabase developer writing Edge Functions in Deno can use the same mental model when using D.A.T.A. No context switching.

4. **Future-Proof**: Supabase is betting on Deno. As they add features, D.A.T.A. can immediately support them without runtime translation layers.

5. **Distribution Simplicity**: `deno compile` produces a single binary. Users don't need Node, npm, or package management.

### Sequential Thought Process:

```
1. Current State Analysis
   └─> Module system is broken (FACT)
   └─> We deploy to Deno runtime (FACT)
   └─> Mismatch causes testing gaps (FACT)

2. Core Question
   └─> Should deployment runtime = development runtime?
   └─> YES for Edge Functions (critical for accuracy)
   └─> MAYBE for database operations (less critical)

3. Effort vs Benefit
   └─> 40-60 hours migration (COST)
   └─> Eliminate entire class of bugs (BENEFIT)
   └─> Perfect Edge Function testing (BENEFIT)
   └─> Simplified distribution (BENEFIT)
   └─> BENEFITS >> COSTS

4. Risk Assessment
   └─> PostgreSQL driver maturity (MEDIUM RISK)
       └─> Mitigation: Deno postgres library is good enough
   └─> Team learning curve (LOW RISK)
       └─> Mitigation: Deno is very similar to modern JS
   └─> Ecosystem gaps (MEDIUM RISK)
       └─> Mitigation: Can write missing pieces or use subprocess

5. Strategic Alignment
   └─> Supabase uses Deno (ALIGNED)
   └─> Modern TypeScript-first (ALIGNED)
   └─> Security model fits database tools (ALIGNED)
   └─> Single binary distribution (ALIGNED)
```

## Implementation Strategy

### Phase 1: Proof of Concept (Week 1)

```typescript
// Test critical paths in Deno
- Database connections ✓
- Edge Function imports ✓
- pgTAP execution ✓
- File system operations ✓
```

### Phase 2: Parallel Development (Week 2-3)

```typescript
// Build Deno version alongside Node
- Keep Node version working
- Port modules incrementally
- Test both versions in CI
```

### Phase 3: Cutover (Week 4)

```typescript
// Switch primary development to Deno
- Deprecate Node version
- Update documentation
- Release Deno binary
```

## Consequences

### Positive

- **Unified runtime**: Edge Functions and CLI use same environment
- **Modern codebase**: No legacy module issues
- **Better security**: Explicit permission model
- **Simpler distribution**: Single binary
- **TypeScript native**: No build step

### Negative

- **Migration effort**: 40-60 hours of work
- **Ecosystem gaps**: May need to build some tools
- **Learning curve**: Team needs Deno knowledge
- **Early adopter risk**: Deno still evolving

### Neutral

- **Different paradigm**: URL imports vs package.json
- **New tooling**: Deno.test vs Vitest
- **Permission model**: Explicit flags needed

## Alternatives Not Chosen - Why?

**Node.js + Fixes**: Doesn't solve the fundamental runtime mismatch. We'd still be testing Edge Functions in the wrong environment.

**Hybrid**: Too complex. Maintaining two runtimes doubles cognitive load and deployment complexity.

**Bun**: Doesn't solve the Deno Edge Function problem. We'd have the same mismatch, just with a faster Node alternative.

**Abstraction Layer**: Adds complexity without solving the core issue. We need Deno-specific features for Edge Functions.

## Final Verdict

> "The needs of the many outweigh the needs of the few." - Spock

The many (Supabase developers) need accurate Edge Function testing. The few (D.A.T.A. maintainers) can handle a migration.

**D.A.T.A. should become a Deno application.**

---

## Addendum: Quick Wins If We Stay with Node

If we decide NOT to migrate, here's the minimum fixes needed:

```json
// package.json
{
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

```javascript
// Fix all imports
import { describe, it } from "vitest"; // not require()

// Use import.meta.url
const __dirname = new URL(".", import.meta.url).pathname;
```

```bash
# Add to .gitignore
.archy-cache/
node_modules/
```

But this is putting a bandaid on a broken leg when we need surgery.

---

_"It is possible to commit no mistakes and still lose. That is not weakness, that is life."_ - Jean-Luc Picard

In this case, staying with Node.js isn't a mistake, but it is a lost opportunity to align perfectly with our deployment target.
