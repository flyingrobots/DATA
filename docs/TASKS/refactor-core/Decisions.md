# Design Decisions Log: DATA JavaScript ESM Refactor

## Decision 1: Runtime Platform Selection

### Context
Need to choose primary runtime platform for DATA CLI tool.

### Options Considered

#### Option A: Deno as Primary Runtime
- **Pros**: Built-in TypeScript, secure by default, Edge-compatible
- **Cons**: Limited ecosystem, not standard in CI/CD, learning curve
- **Estimated Impact**: Would require rewriting many dependencies
- **Adoption Risk**: High - users need Deno installed

#### Option B: Node.js 20+ ESM (SELECTED)
- **Pros**: Universal availability, mature ecosystem, CI/CD standard
- **Cons**: None for JavaScript approach
- **Compatibility**: Works everywhere, including Bun
- **Adoption Risk**: None - already standard

#### Option C: Bun as Primary
- **Pros**: Fast, modern, JavaScript-first
- **Cons**: Still maturing, not universally available
- **Ecosystem**: Growing but incomplete
- **Adoption Risk**: Medium - not all users have Bun

### Rationale
Node.js selected because:
- Universal availability in all environments
- Zero adoption friction
- Mature tooling and debugging
- Bun compatibility as bonus
- Deno remains a target (for Edge Functions) not a host

### Implementation Notes
- Target Node 20+ for native ESM
- Ensure Bun compatibility through testing
- Generate Deno artifacts, don't run on it

---

## Decision 2: Type System Philosophy

### Context
Determining approach to type safety and developer experience.

### Options Considered

#### Option A: TypeScript
- **Pros**: Compile-time type checking, IDE support
- **Cons**: Build step required, runtime overhead, complexity
- **Philosophy**: Violates zero-build principle
- **Runtime Value**: Zero - all types erased

#### Option B: JavaScript with JSDoc (SELECTED)
- **Pros**: Zero build step, runtime validation, AI-powered generation
- **Cons**: More verbose syntax (mitigated by AI)
- **Runtime Safety**: instanceof checks actually execute
- **Developer Experience**: Full IDE support via TS Language Server

#### Option C: No Type Annotations
- **Pros**: Simplest approach
- **Cons**: Poor developer experience, no IDE support
- **Maintainability**: Difficult at scale
- **Documentation**: Inadequate

### Rationale
JavaScript with JSDoc selected because:
- **Zero Build Step**: The code that runs is the code we write
- **Runtime Type Safety**: instanceof checks catch real errors in production
- **AI-Powered Documentation**: Perfect JSDoc on every commit
- **Full IDE Support**: Modern editors use TypeScript Language Server for JavaScript
- **Simplified Debugging**: Stack traces point to actual source files

### Implementation Notes
```javascript
/**
 * @typedef {Object} EventDetails
 * @property {string} [directoryName] - Name of directory being processed
 * @property {number} [filesProcessed] - Count of files processed
 */

class CommandEvent {
  /**
   * @param {string} type - Event type identifier
   * @param {string} message - Human-readable message
   * @param {EventDetails} [details] - Additional structured data
   */
  constructor(type, message, details = {}) {
    this.type = type;
    this.message = message;
    this.details = details;
  }
}

// Runtime validation
if (!(event instanceof CommandEvent)) {
  throw new Error('Invalid event type');
}
```

---

## Decision 3: Module System Architecture

### Context
Choosing between monolithic architecture and modular packages.

### Options Considered

#### Option A: Single Package Refactor
- **Pros**: Simpler migration, fewer moving parts
- **Cons**: Tight coupling, harder to test, no clear boundaries
- **Migration Effort**: 15 hours
- **Long-term Cost**: High maintenance burden

#### Option B: Modular Packages (SELECTED)
- **Pros**: Clean boundaries, testable, reusable, portable
- **Cons**: More initial setup
- **Structure**: data-core, data-host-node, data-cli, data-templates
- **Migration Effort**: 19 hours
- **Long-term Benefit**: Easy to maintain and extend

#### Option C: Microservices Architecture
- **Pros**: Ultimate modularity, independent deployment
- **Cons**: Overengineered for CLI tool, network overhead
- **Complexity**: Too high for use case
- **Migration Effort**: 40+ hours

### Rationale
Modular packages selected for:
- Clean separation of concerns
- Testable pure logic core
- Port/adapter pattern enables testing
- Future flexibility for alternative hosts
- Reasonable complexity for CLI tool

### Implementation Notes
- data-core: Pure JavaScript logic, no I/O
- data-host-node: Node.js adapters
- data-cli: CLI entry point
- data-templates: Edge Function scaffolds

---

## Decision 4: CommonJS to ESM Migration

### Context
Module system for the refactored codebase.

### Options Considered

#### Option A: Dual CJS/ESM Support
- **Pros**: Maximum compatibility
- **Cons**: Complex maintenance, larger bundles
- **Build Complexity**: High (even for JavaScript)
- **Bundle Size**: +40%

#### Option B: ESM Only (SELECTED)
- **Pros**: Simpler, faster, future-proof, tree-shakeable
- **Cons**: Requires Node 20+
- **Performance**: ~20% faster loading
- **Bundle Size**: Optimal

#### Option C: Keep CommonJS
- **Pros**: No migration needed
- **Cons**: Legacy system, poor tree-shaking, slower
- **Future**: Eventually deprecated
- **Developer Experience**: Inferior

### Rationale
ESM-only selected because:
- Simpler implementation
- Better performance
- Future-proof choice
- Node 20+ is reasonable requirement
- Bun compatibility included

### Implementation Notes
- package.json: "type": "module"
- All imports use extensions (.js)
- No require() calls
- No __dirname (use import.meta.url)
- Top-level await available

---

## Decision 5: Dependency Injection Pattern

### Context
How to handle I/O operations in pure logic core.

### Options Considered

#### Option A: Direct Node.js Imports
- **Pros**: Simple, familiar
- **Cons**: Untestable, Node-locked, impure
- **Code**: `import fs from 'fs'` everywhere
- **Testability**: Poor - requires mocking Node

#### Option B: Port/Adapter Pattern (SELECTED)
- **Pros**: Testable, portable, clean boundaries
- **Cons**: Initial abstraction overhead
- **Implementation**: Inject ports: readFile, spawn, env
- **Testability**: Excellent - inject test doubles

#### Option C: Service Locator Pattern
- **Pros**: Centralized dependencies
- **Cons**: Hidden dependencies, harder to test
- **Complexity**: Moderate
- **Maintainability**: Becomes problematic at scale

### Rationale
Port/Adapter pattern selected for:
- Complete testability
- Platform independence
- Explicit dependencies
- Clean architecture
- Future adaptability

### Implementation Notes
```javascript
// Core accepts ports
const ports = {
  readFile: (path) => Promise.resolve(content),
  spawn: (cmd, args) => Promise.resolve({code: 0}),
  env: { get: (key) => process.env[key] }
};

// Host provides implementations
const nodePorts = {
  readFile: fs.promises.readFile,
  spawn: wrapSpawn(child_process.spawn),
  env: process.env
};
```

---

## Decision 6: Edge Function Strategy

### Context
How to support Supabase Edge Functions (Deno runtime).

### Options Considered

#### Option A: Run DATA on Deno
- **Pros**: Same runtime as Edge Functions
- **Cons**: DATA needs Node APIs (git, spawn, fs)
- **Feasibility**: Not practical
- **User Impact**: High friction

#### Option B: Generate Deno Templates (SELECTED)
- **Pros**: Clean separation, proper patterns, no runtime conflicts
- **Cons**: Can't execute functions locally
- **Approach**: Scaffold Web API-only code
- **User Experience**: Familiar Node CLI generates Edge code

#### Option C: Transpile Node to Deno
- **Pros**: Reuse existing code
- **Cons**: Runtime incompatibilities, polyfill hell
- **Reliability**: Poor - too many edge cases
- **Maintenance**: Nightmare

### Rationale
Template generation selected because:
- DATA remains a Node tool (where it belongs)
- Edge Functions get proper Deno code
- No runtime conflicts or polyfills
- Clear boundary between authoring and execution
- Best practices baked into templates

### Implementation Notes
- Templates use Web APIs only
- No Node built-ins in generated code
- Favor PostgREST over raw Postgres
- Include connection pooling warnings
- Document env variables needed

---

## Decision 7: Testing Strategy

### Context
Testing approach for refactored modular architecture.

### Options Considered

#### Option A: Mock Everything
- **Pros**: Fast tests, isolated units
- **Cons**: Doesn't catch integration issues
- **Confidence**: Low - mocks can lie
- **Maintenance**: High - mocks drift from reality

#### Option B: Integration-First (SELECTED)
- **Pros**: Tests real behavior, high confidence
- **Cons**: Slower tests, needs test infrastructure
- **Approach**: Real databases, minimal mocks
- **Coverage Target**: 90%+

#### Option C: E2E Only
- **Pros**: Tests actual user flows
- **Cons**: Slow, flaky, hard to debug
- **Feedback Loop**: Too slow for development
- **Coverage**: Hard to achieve

### Rationale
Integration-first selected because:
- Tests actual behavior not implementation
- Catches real bugs
- Port/adapter pattern enables test doubles
- Good balance of speed and confidence
- Aligns with "test real databases" principle

### Implementation Notes
- Unit tests for pure logic
- Integration tests with test doubles
- pgTAP for database tests
- Smoke tests for Edge Functions
- Same test suite runs on Node and Bun

---

## Decision 8: Production Safety Gates

### Context
Preventing accidental production damage during migrations.

### Options Considered

#### Option A: Warning Messages Only
- **Pros**: Simple, non-blocking
- **Cons**: Easy to ignore, accidents happen
- **Safety Level**: Low
- **User Trust**: Risky

#### Option B: Full Safety Gates (SELECTED)
- **Pros**: Prevents accidents, builds confidence
- **Cons**: Slightly slower workflow
- **Requirements**: Clean git, tests pass, typed confirmation
- **Safety Level**: High

#### Option C: Audit Logging Only
- **Pros**: Non-invasive, traceable
- **Cons**: Damage already done, reactive not proactive
- **Recovery**: After the fact
- **User Trust**: Damaged after incidents

### Rationale
Full safety gates selected for:
- Production safety paramount
- Builds user confidence
- Prevents 3am emergencies
- Industry standard practice
- Minor inconvenience worth it

### Implementation Notes
- Git tree must be clean
- Branch must be correct
- Must be synced with origin
- Tests must pass with coverage threshold
- Production requires typed confirmation
- Tags applied after success

---

## Decision 9: AI-Powered Documentation

### Context
How to maintain comprehensive JSDoc without manual effort.

### Options Considered

#### Option A: Manual JSDoc
- **Pros**: Full control
- **Cons**: Time-consuming, often outdated
- **Maintenance**: High burden
- **Quality**: Inconsistent

#### Option B: AI-Generated JSDoc (SELECTED)
- **Pros**: Automatic, consistent, always current
- **Cons**: Requires AI integration
- **Implementation**: Git pre-commit hooks
- **Quality**: Superior to manual

#### Option C: No Documentation
- **Pros**: No effort
- **Cons**: Poor maintainability, bad DX
- **Long-term**: Technical debt
- **Team Impact**: Onboarding difficulty

### Rationale
AI-generated JSDoc selected because:
- Perfect documentation on every commit
- No manual effort required
- Consistent quality
- Better than most manually-written docs
- Enables full IDE support

### Implementation Notes
```bash
# .husky/pre-commit
git diff --cached --name-only | grep '\.js$' | while read file; do
  claude -p "Add comprehensive JSDoc" "$file" > "$file.tmp"
  mv "$file.tmp" "$file"
  git add "$file"
done
```

---

## Decision 10: Zero Build Step Philosophy

### Context
Whether to introduce any build/compilation steps.

### Options Considered

#### Option A: Build Pipeline
- **Pros**: Could add optimizations
- **Cons**: Complexity, slower feedback, debugging issues
- **Philosophy**: Against core principles
- **Value**: Minimal for JavaScript

#### Option B: Zero Build (SELECTED)
- **Pros**: Instant feedback, real stack traces, simplicity
- **Cons**: No compile-time optimizations
- **Performance**: Negligible difference
- **Developer Experience**: Superior

#### Option C: Optional Build
- **Pros**: Flexibility
- **Cons**: Two codepaths to maintain
- **Complexity**: Unnecessary
- **Testing**: Doubles test matrix

### Rationale
Zero build selected because:
- Aligns with JavaScript philosophy
- Instant developer feedback
- Real stack traces for debugging
- Simplifies entire toolchain
- "The code that runs is the code we write"

### Implementation Notes
- Direct execution: `node bin/data.js`
- No transpilation step
- No source maps needed
- Stack traces point to actual files
- Change and run immediately

---

## Key Design Principles Applied

1. **Zero Build Steps**: No transpilation or compilation
2. **Runtime Type Safety**: instanceof checks that actually execute
3. **Pure Logic Core**: No I/O in business logic
4. **AI-Powered Documentation**: Perfect JSDoc automatically
5. **Explicit Dependencies**: All dependencies injected
6. **Test Real Things**: Integration over mocks
7. **Production Safety**: Multiple gates and confirmations
8. **Future Proof**: ESM, Node 20+, standards-based
9. **Clean Boundaries**: Clear package separation
10. **Developer Experience**: Instant feedback, real debugging

## Conclusion

These decisions create a modern, maintainable, and production-ready CLI tool that:
- Runs everywhere (Node/Bun)
- Generates Edge Functions (Deno)
- Provides runtime safety (instanceof)
- Enables instant feedback (zero build)
- Supports easy testing (ports)
- Ensures portability (pure core)

The 19-hour investment yields a 10x return in simplicity, maintainability, and developer experience.

As stated in our architecture philosophy:
> "The needs of the runtime outweigh the needs of the compile time."

---

*"Ship JavaScript. Skip the costume party."*