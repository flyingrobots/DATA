/**
 * @fileoverview Comprehensive Command Event System with Runtime Type Safety
 * 
 * This module provides a complete event class hierarchy for the D.A.T.A. CLI system
 * with runtime instanceof validation, zero dependencies, and pure JavaScript power.
 * 
 * Key Features:
 * - Runtime type safety via instanceof checks
 * - Immutable event objects with structured data
 * - Comprehensive JSDoc documentation
 * - Zero Node.js dependencies (pure JavaScript)
 * - Memory-efficient object design
 * - Standardized JSON serialization
 * 
 * @module CommandEvents
 * @since 2.0.0
 * @author JavaScript Pro (via Claude Code)
 */

'use strict';

// =============================================================================
// BASE EVENT CLASS
// =============================================================================

/**
 * @typedef {Object} EventDetails
 * @property {string} [directoryName] - Name of directory being processed
 * @property {number} [filesProcessed] - Count of files processed  
 * @property {number} [totalFiles] - Total number of files to process
 * @property {Error} [error] - Error object if applicable
 * @property {string} [code] - Error code for categorization
 * @property {string} [phase] - Current operation phase
 * @property {Array<string>} [warnings] - List of warning messages
 * @property {Object} [metadata] - Additional structured metadata
 * @property {boolean} [isProd] - Whether running in production mode
 * @property {*} [result] - Operation result data
 */

/**
 * Base class for all command events with immutable structure and runtime validation.
 * 
 * Provides the foundation for the event-driven architecture with guaranteed type safety
 * at runtime through instanceof checks. All events are immutable after construction
 * and include standardized timestamp, type, and structured data fields.
 * 
 * @class
 * @abstract
 * @example
 * // Never instantiate directly - use subclasses
 * const progress = new ProgressEvent('Processing files...', 45);
 * if (progress instanceof CommandEvent) {
 *   console.log('Runtime type safety confirmed!');
 * }
 */
class CommandEvent {
  /**
   * Creates a new CommandEvent instance with immutable properties.
   * 
   * @param {string} type - Event type identifier (must be non-empty string)
   * @param {string} message - Human-readable message (must be non-empty string) 
   * @param {EventDetails} [details={}] - Additional structured data
   * @throws {TypeError} When type or message are invalid
   * @throws {Error} When attempting to instantiate base class directly
   */
  constructor(type, message, details = {}) {
    // Prevent direct instantiation of base class
    if (this.constructor === CommandEvent) {
      throw new Error('CommandEvent is abstract and cannot be instantiated directly');
    }

    // Runtime validation with helpful error messages
    if (typeof type !== 'string' || type.trim().length === 0) {
      throw new TypeError('Event type must be a non-empty string');
    }
    
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new TypeError('Event message must be a non-empty string');
    }

    if (details !== null && (typeof details !== 'object' || Array.isArray(details))) {
      throw new TypeError('Event details must be an object or null');
    }

    // Set properties for immutability - this is SOLID JavaScript design
    Object.defineProperties(this, {
      type: {
        value: type.trim(),
        writable: false,
        enumerable: true,
        configurable: false
      },
      message: {
        value: message.trim(),
        writable: false,
        enumerable: true,
        configurable: false
      },
      details: {
        value: Object.freeze({ ...(details || {}) }),
        writable: false,
        enumerable: true,
        configurable: false
      },
      timestamp: {
        value: Object.freeze(new Date()),
        writable: false,
        enumerable: true,
        configurable: false
      }
    });

    // Don't freeze here - let subclasses add their properties first
  }

  /**
   * Finalizes the event object by making it immutable.
   * Called by subclasses after they've added their properties.
   * 
   * @protected
   */
  _freeze() {
    Object.freeze(this);
  }

  /**
   * Converts event to JSON-serializable object.
   * 
   * Provides standardized serialization for logging, API responses,
   * and persistent storage while preserving all event data.
   * 
   * @returns {Object} JSON-serializable representation
   * @example
   * const event = new ProgressEvent('Working...', 50);
   * const json = event.toJSON();
   * // { type: 'progress', message: 'Working...', details: {...}, timestamp: '...' }
   */
  toJSON() {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString()
    };
  }

  /**
   * Returns string representation for debugging and logging.
   * 
   * @returns {string} Human-readable event description
   * @example
   * console.log(event.toString()); // "ProgressEvent: Working... (50%)"
   */
  toString() {
    const className = this.constructor.name;
    const timestamp = this.timestamp.toISOString();
    return `${className}: ${this.message} [${timestamp}]`;
  }

  /**
   * Checks if this event is of a specific type using instanceof.
   * 
   * Provides runtime type checking that actually works at runtime,
   * unlike TypeScript's compile-time only checking.
   * 
   * @param {Function} EventClass - Event class constructor to check against
   * @returns {boolean} True if event is instance of specified class
   * @example
   * if (event.isType(ProgressEvent)) {
   *   console.log(`Progress: ${event.percentage}%`);
   * }
   */
  isType(EventClass) {
    return this instanceof EventClass;
  }

  /**
   * Creates a shallow clone with updated details.
   * 
   * Since events are immutable, this provides a way to create
   * modified versions while preserving the original event.
   * 
   * @param {EventDetails} newDetails - Details to merge with existing
   * @returns {CommandEvent} New event instance with merged details
   * @example
   * const updated = event.withDetails({ phase: 'complete' });
   */
  withDetails(newDetails = {}) {
    const Constructor = this.constructor;
    const mergedDetails = { ...this.details, ...newDetails };
    
    // Handle special properties for subclass constructors
    if (this.percentage !== undefined) {
      return new Constructor(this.message, this.percentage, mergedDetails);
    }
    if (this.error !== undefined) {
      return new Constructor(this.message, this.error, this.code, mergedDetails);
    }
    if (this.result !== undefined) {
      return new Constructor(this.message, this.result, mergedDetails);
    }
    
    return new Constructor(this.message, mergedDetails);
  }
}

// =============================================================================
// CORE EVENT CLASSES  
// =============================================================================

/**
 * Progress event for long-running operations with optional percentage tracking.
 * 
 * Used to communicate ongoing operation status with precise progress information.
 * Supports both determinate (with percentage) and indeterminate progress reporting.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * // Determinate progress
 * const progress = new ProgressEvent('Processing files...', 45.5);
 * 
 * // Indeterminate progress  
 * const working = new ProgressEvent('Analyzing data...', null, { phase: 'scan' });
 */
class ProgressEvent extends CommandEvent {
  /**
   * Creates a new ProgressEvent instance.
   * 
   * @param {string} message - Progress description
   * @param {number|null} [percentage=null] - Completion percentage (0-100) or null for indeterminate
   * @param {EventDetails} [details={}] - Additional progress context
   * @throws {TypeError} When percentage is invalid number
   */
  constructor(message, percentage = null, details = {}) {
    super('progress', message, details);
    
    // Validate percentage if provided
    if (percentage !== null) {
      if (typeof percentage !== 'number' || isNaN(percentage) || percentage < 0 || percentage > 100) {
        throw new TypeError('Percentage must be a number between 0 and 100, or null');
      }
    }
    
    Object.defineProperty(this, 'percentage', {
      value: percentage,
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    // Only freeze if this is the actual ProgressEvent, not a subclass
    if (this.constructor === ProgressEvent) {
      this._freeze();
    }
  }

  /**
   * Checks if this progress event has a defined percentage.
   * 
   * @returns {boolean} True if percentage is available
   */
  isDeterminate() {
    return this.percentage !== null;
  }

  /**
   * Gets completion ratio as decimal (0.0 to 1.0).
   * 
   * @returns {number|null} Completion ratio or null if indeterminate
   */
  getRatio() {
    return this.percentage !== null ? this.percentage / 100 : null;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      percentage: this.percentage
    };
  }

  /**
   * @override
   */
  toString() {
    const base = super.toString();
    const progress = this.percentage !== null ? ` (${this.percentage}%)` : ' (indeterminate)';
    return base.replace(']', progress + ']');
  }
}

/**
 * Error event for operation failures with comprehensive error context.
 * 
 * Provides structured error reporting with error objects, categorization codes,
 * and additional debugging context. Supports both JavaScript Error objects
 * and custom error information.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * // With Error object
 * const error = new ErrorEvent('Database connection failed', dbError, 'DB_CONNECT');
 * 
 * // With error details
 * const validation = new ErrorEvent('Invalid input', null, 'VALIDATION', {
 *   field: 'email',
 *   reason: 'Invalid format'
 * });
 */
class ErrorEvent extends CommandEvent {
  /**
   * Creates a new ErrorEvent instance.
   * 
   * @param {string} message - Error description
   * @param {Error|null} [error=null] - The actual error object with stack trace
   * @param {string|null} [code=null] - Error code for categorization
   * @param {EventDetails} [details={}] - Additional error context
   */
  constructor(message, error = null, code = null, details = {}) {
    // Merge error info into details for structured access
    const errorDetails = { ...details };
    if (error && error.code) {
      errorDetails.originalCode = error.code;
    }
    if (error && error.stack) {
      errorDetails.stack = error.stack;
    }
    if (code) {
      errorDetails.code = code;
    }
    
    super('error', message, errorDetails);
    
    Object.defineProperties(this, {
      error: {
        value: error,
        writable: false,
        enumerable: true,
        configurable: false
      },
      code: {
        value: code,
        writable: false,
        enumerable: true,
        configurable: false
      }
    });
    
    // Only freeze if this is the actual ErrorEvent, not a subclass
    if (this.constructor === ErrorEvent) {
      this._freeze();
    }
  }

  /**
   * Checks if this error has a JavaScript Error object.
   * 
   * @returns {boolean} True if error object is present
   */
  hasErrorObject() {
    return this.error instanceof Error;
  }

  /**
   * Gets the error stack trace if available.
   * 
   * @returns {string|null} Stack trace or null
   */
  getStackTrace() {
    return this.error && this.error.stack ? this.error.stack : null;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      error: this.error ? {
        name: this.error.name,
        message: this.error.message,
        stack: this.error.stack
      } : null,
      code: this.code
    };
  }
}

/**
 * Success event for completed operations with optional result data.
 * 
 * Communicates successful command execution with structured result information
 * for display, logging, or further processing.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const success = new SuccessEvent('Migration completed', {
 *   migrationsApplied: 3,
 *   tablesCreated: ['users', 'posts'],
 *   duration: 1250
 * });
 */
class SuccessEvent extends CommandEvent {
  /**
   * Creates a new SuccessEvent instance.
   * 
   * @param {string} message - Success message
   * @param {EventDetails} [details={}] - Additional success data and context
   */
  constructor(message, details = {}) {
    super('success', message, details);
    // Only freeze if this is the actual SuccessEvent, not a subclass
    if (this.constructor === SuccessEvent) {
      this._freeze();
    }
  }

  /**
   * Extracts result data from details if present.
   * 
   * @returns {*} Result data or null
   */
  getResult() {
    return this.details.result || null;
  }
}

/**
 * Warning event for non-fatal issues requiring attention.
 * 
 * Used to communicate potential problems, deprecated usage, or important
 * information that doesn't prevent command execution from continuing.
 * 
 * @class
 * @extends CommandEvent
 * @example  
 * const warning = new WarningEvent('Using deprecated API', {
 *   api: 'v1/users',
 *   replacement: 'v2/users',
 *   deprecationDate: '2024-12-01'
 * });
 */
class WarningEvent extends CommandEvent {
  /**
   * Creates a new WarningEvent instance.
   * 
   * @param {string} message - Warning message
   * @param {EventDetails} [details={}] - Additional warning context
   */
  constructor(message, details = {}) {
    super('warning', message, details);
    // Only freeze if this is the actual WarningEvent, not a subclass
    if (this.constructor === WarningEvent) {
      this._freeze();
    }
  }

  /**
   * Gets the warning severity level from details.
   * 
   * @returns {string} Severity level ('low', 'medium', 'high', or 'unknown')
   */
  getSeverity() {
    return this.details.severity || 'unknown';
  }
}

// =============================================================================
// EXECUTION EVENT CLASSES
// =============================================================================

/**
 * Start event emitted when command execution begins.
 * 
 * Marks the beginning of command execution with environment and configuration context.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const start = new StartEvent('Starting DatabaseCommand', { isProd: false });
 */
class StartEvent extends CommandEvent {
  /**
   * Creates a new StartEvent instance.
   * 
   * @param {string} message - Start message
   * @param {EventDetails} [details={}] - Execution context
   */
  constructor(message, details = {}) {
    super('start', message, details);
    this._freeze();
  }
}

/**
 * Complete event emitted when command execution succeeds.
 * 
 * Marks successful completion of command execution with final result data.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const complete = new CompleteEvent('Command completed', { rowsAffected: 42 });
 */
class CompleteEvent extends CommandEvent {
  /**
   * Creates a new CompleteEvent instance.
   * 
   * @param {string} message - Completion message
   * @param {*} [result=null] - Command execution result
   * @param {EventDetails} [details={}] - Additional completion context
   */
  constructor(message, result = null, details = {}) {
    const completeDetails = { ...details, result };
    super('complete', message, completeDetails);
    
    Object.defineProperty(this, 'result', {
      value: result,
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    this._freeze();
  }
}

/**
 * Cancelled event emitted when command execution is cancelled by user.
 * 
 * Marks user-initiated cancellation of command execution, typically due to
 * production confirmation denial or explicit user interruption.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const cancelled = new CancelledEvent('User cancelled production operation');
 */
class CancelledEvent extends CommandEvent {
  /**
   * Creates a new CancelledEvent instance.
   * 
   * @param {string} message - Cancellation message
   * @param {EventDetails} [details={}] - Cancellation context
   */
  constructor(message, details = {}) {
    super('cancelled', message, details);
    this._freeze();
  }
}

// =============================================================================
// RUNTIME VALIDATION UTILITY
// =============================================================================

/**
 * Validates an event object against expected class type using instanceof checks.
 * 
 * Provides comprehensive runtime type validation for event objects to ensure
 * they conform to expected event class structures and contain required properties.
 * This is the heart of our runtime type safety system.
 * 
 * @param {Object} event - The event object to validate
 * @param {Function|null} [expectedClass=null] - Expected event class constructor for instanceof validation
 * @throws {TypeError} When event fails validation
 * @example
 * try {
 *   validateCommandEvent(progressEvent, ProgressEvent);
 *   console.log('Event is valid!');
 * } catch (error) {
 *   console.error('Invalid event:', error.message);
 * }
 */
function validateCommandEvent(event, expectedClass = null) {
  // Basic structure validation
  if (!event || typeof event !== 'object') {
    throw new TypeError('Event must be an object');
  }

  if (!event.type || typeof event.type !== 'string') {
    throw new TypeError('Event must have a valid type string');
  }

  if (!event.message || typeof event.message !== 'string') {
    throw new TypeError('Event must have a valid message string');
  }

  if (!event.timestamp || !(event.timestamp instanceof Date)) {
    throw new TypeError('Event must have a valid timestamp Date object');
  }

  // Specific class validation using instanceof - this is REAL runtime type safety
  if (expectedClass) {
    if (typeof expectedClass !== 'function') {
      throw new TypeError('Expected class must be a constructor function');
    }

    if (!(event instanceof expectedClass)) {
      throw new TypeError(`Event must be an instance of ${expectedClass.name}, got ${event.constructor.name}`);
    }

    // Additional validation for specific event types
    if (expectedClass === ProgressEvent) {
      if (event.percentage !== null && (typeof event.percentage !== 'number' || 
          isNaN(event.percentage) || event.percentage < 0 || event.percentage > 100)) {
        throw new TypeError('ProgressEvent percentage must be null or number between 0-100');
      }
    } else if (expectedClass === ErrorEvent) {
      if (event.error !== null && !(event.error instanceof Error)) {
        throw new TypeError('ErrorEvent error must be null or Error instance');
      }
    }
  }

  // Validate that event is actually a CommandEvent
  if (!(event instanceof CommandEvent)) {
    throw new TypeError('Event must extend CommandEvent base class');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Base class
  CommandEvent,
  
  // Core events
  ProgressEvent,
  ErrorEvent,
  SuccessEvent,
  WarningEvent,
  
  // Execution events
  StartEvent,
  CompleteEvent,
  CancelledEvent,
  
  // Validation utility
  validateCommandEvent
};

// Export class hierarchy for instanceof checks
module.exports.CommandEvent = CommandEvent;
module.exports.ProgressEvent = ProgressEvent;
module.exports.ErrorEvent = ErrorEvent;
module.exports.SuccessEvent = SuccessEvent;
module.exports.WarningEvent = WarningEvent;
module.exports.StartEvent = StartEvent;
module.exports.CompleteEvent = CompleteEvent;
module.exports.CancelledEvent = CancelledEvent;