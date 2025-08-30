# Architecture Decisions

## Type System Philosophy

### Decision: JavaScript Classes with JSDoc over TypeScript

**Status**: Adopted  
**Date**: 2025-08-30  
**Deciding Officer**: Captain James, USS Supa-Data

### Context

The D.A.T.A. system requires robust type safety for its event-driven architecture, particularly for the 179+ event emissions across 34 subsystem files. The choice between TypeScript and properly-typed JavaScript classes was evaluated.

### Decision

We will use **native JavaScript classes with comprehensive JSDoc annotations** rather than TypeScript.

### Rationale

1. **Runtime Type Safety**: JavaScript classes provide `instanceof` checks that actually execute at runtime, catching type errors where they matter - in production.

2. **Zero Build Step**: No transpilation required. The code that runs is the code we write. This eliminates:
   - Build configuration complexity
   - Source map debugging issues  
   - Deployment artifacts
   - Transpilation bugs

3. **Full IDE Support**: Modern editors (VSCode, WebStorm, etc.) use the TypeScript Language Server for JavaScript files with JSDoc, providing:
   - IntelliSense/autocomplete
   - Type checking
   - Refactoring support
   - Parameter hints

4. **Simplified Debugging**: Stack traces point to actual source files, not transpiled output.

### Implementation Pattern

```javascript
/**
 * @typedef {Object} EventDetails
 * @property {string} [directoryName] - Name of directory being processed
 * @property {number} [filesProcessed] - Count of files processed
 * @property {Error} [error] - Error object if applicable
 * @property {string} [code] - Error code for categorization
 */

/**
 * Base class for all command events
 * @class
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
    this.timestamp = new Date();
  }
}

/**
 * Progress event for long-running operations
 * @extends CommandEvent
 */
class ProgressEvent extends CommandEvent {
  /**
   * @param {string} message - Progress message
   * @param {number} [percentage] - Completion percentage (0-100)
   * @param {EventDetails} [details] - Additional details
   */
  constructor(message, percentage = null, details = {}) {
    super('progress', message, details);
    this.percentage = percentage;
  }
}

/**
 * Error event for operation failures
 * @extends CommandEvent
 */
class ErrorEvent extends CommandEvent {
  /**
   * @param {string} message - Error message
   * @param {Error} error - The actual error object
   * @param {string} [code] - Error code for categorization
   */
  constructor(message, error, code = null) {
    super('error', message, { error, code });
    this.error = error;
    this.code = code;
  }
}
```

### Usage Example

```javascript
// Emission with type safety
this.emit('progress', new ProgressEvent(
  'Processing directory', 
  50, 
  { directoryName: 'sql/001_extensions' }
));

// Reception with runtime validation
command.on('progress', (event) => {
  if (!(event instanceof ProgressEvent)) {
    throw new Error('Invalid event type received');
  }
  console.log(`${event.message}: ${event.percentage}%`);
});
```

### Migration Strategy

1. Create event classes in `src/lib/events/`
2. Update high-frequency emitters first (BuildCommand, MigrationCompiler)
3. Gradually migrate all 179 emissions to use typed events
4. Add runtime validation to critical event handlers

### Benefits Realized

- **Type Safety**: Both development-time (via JSDoc) and runtime (via instanceof)
- **Maintainability**: Self-documenting code with clear contracts
- **Performance**: No transpilation overhead
- **Debugging**: Direct source code execution
- **Compatibility**: Works with any Node.js version, no build toolchain required

### Exceptions

None. This pattern applies to all new code and should be retrofitted to existing code during refactoring.

### References

- [TypeScript JSDoc Support](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Node.js Best Practices - Prefer Native JS](https://github.com/goldbergyoni/nodebestpractices#prefer-native-js-when-possible)
- Starfleet Engineering Manual, Section 7.3: "Simplicity in System Design"

---

*"The needs of the runtime outweigh the needs of the compile time."* - Vulcan Engineering Proverb