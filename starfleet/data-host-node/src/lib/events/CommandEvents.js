/**
 * Command Event System for D.A.T.A. CLI
 *
 * This module provides a comprehensive event class hierarchy for the event-driven
 * architecture used throughout the D.A.T.A. (Database Automation, Testing, and
 * Alignment) CLI tool. All events support instanceof checks for runtime type safety.
 *
 * @fileoverview Event classes for robust event-driven command architecture
 * @author Supa Base 12 Engineering Team
 * @version 1.0.0
 */

/**
 * @typedef {Object} EventDetails
 * @property {string} [directoryName] - Name of directory being processed
 * @property {number} [filesProcessed] - Count of files processed
 * @property {number} [totalFiles] - Total number of files to process
 * @property {string} [filePath] - Path to file being processed
 * @property {string} [operation] - Type of operation being performed
 * @property {string} [stage] - Current stage of operation
 * @property {Error} [error] - Error object if applicable
 * @property {string} [code] - Error code for categorization
 * @property {boolean} [isProd] - Whether operation is in production mode
 * @property {Object} [metadata] - Additional metadata for the event
 */

/**
 * Base class for all command events in the D.A.T.A. system
 *
 * Provides the foundational structure for all events emitted by commands.
 * All events include a timestamp and support structured data through the
 * details property.
 *
 * @class
 */
class CommandEvent {
  /**
   * Create a new command event
   *
   * @param {string} type - Event type identifier (e.g., 'progress', 'error')
   * @param {string} message - Human-readable message describing the event
   * @param {EventDetails} [details={}] - Additional structured data
   */
  constructor(type, message, details = {}) {
    /**
     * @type {string} Event type identifier
     */
    this.type = type;

    /**
     * @type {string} Human-readable message
     */
    this.message = message;

    /**
     * @type {EventDetails} Additional structured event data
     */
    this.details = details;

    /**
     * @type {Date} Timestamp when event was created
     */
    this.timestamp = new Date();
  }

  /**
   * Convert event to JSON-serializable object
   *
   * @returns {Object} JSON representation of the event
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
   * Get a string representation of the event
   *
   * @returns {string} String representation
   */
  toString() {
    return `[${this.type.toUpperCase()}] ${this.message}`;
  }
}

/**
 * Progress event for long-running operations
 *
 * Used to indicate progress during operations that may take significant time,
 * such as database migrations, file processing, or compilation tasks.
 *
 * @extends CommandEvent
 */
class ProgressEvent extends CommandEvent {
  /**
   * Create a new progress event
   *
   * @param {string} message - Progress message describing current operation
   * @param {number|null} [percentage=null] - Completion percentage (0-100), null if unknown
   * @param {EventDetails} [details={}] - Additional progress details
   */
  constructor(message, percentage = null, details = {}) {
    super('progress', message, details);

    /**
     * @type {number|null} Completion percentage (0-100) or null if indeterminate
     */
    this.percentage = percentage;

    // Validate percentage if provided
    if (
      percentage !== null &&
      (typeof percentage !== 'number' || percentage < 0 || percentage > 100)
    ) {
      throw new Error('Percentage must be a number between 0 and 100, or null');
    }
  }

  /**
   * Create a progress event with percentage
   *
   * @param {string} message - Progress message
   * @param {number} completed - Number of items completed
   * @param {number} total - Total number of items
   * @param {EventDetails} [details={}] - Additional details
   * @returns {ProgressEvent} New progress event with calculated percentage
   */
  static withPercentage(message, completed, total, details = {}) {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return new ProgressEvent(message, percentage, {
      ...details,
      completed,
      total
    });
  }

  /**
   * Create an indeterminate progress event
   *
   * @param {string} message - Progress message
   * @param {EventDetails} [details={}] - Additional details
   * @returns {ProgressEvent} New indeterminate progress event
   */
  static indeterminate(message, details = {}) {
    return new ProgressEvent(message, null, details);
  }
}

/**
 * Error event for operation failures
 *
 * Represents errors, failures, or exceptions that occur during command execution.
 * Includes the original error object and optional error categorization.
 *
 * @extends CommandEvent
 */
class ErrorEvent extends CommandEvent {
  /**
   * Create a new error event
   *
   * @param {string} message - Error message describing what went wrong
   * @param {Error} error - The actual error object that was thrown
   * @param {string|null} [code=null] - Error code for categorization
   * @param {EventDetails} [details={}] - Additional error context
   */
  constructor(message, error, code = null, details = {}) {
    super('error', message, { ...details, error, code });

    /**
     * @type {Error} The original error object
     */
    this.error = error;

    /**
     * @type {string|null} Error code for categorization
     */
    this.code = code;
  }

  /**
   * Create an error event from an exception
   *
   * @param {Error} error - The error object
   * @param {string} [context='Operation failed'] - Context message
   * @param {EventDetails} [details={}] - Additional details
   * @returns {ErrorEvent} New error event
   */
  static fromError(error, context = 'Operation failed', details = {}) {
    return new ErrorEvent(`${context}: ${error.message}`, error, error.code || null, details);
  }

  /**
   * Get the full error stack trace
   *
   * @returns {string} Stack trace string
   */
  getStackTrace() {
    return this.error?.stack || 'No stack trace available';
  }
}

/**
 * Directory operation event for filesystem operations
 *
 * Represents events related to directory processing, creation, scanning,
 * or other filesystem operations on directories.
 *
 * @extends CommandEvent
 */
class DirectoryEvent extends CommandEvent {
  /**
   * Create a new directory event
   *
   * @param {string} message - Message describing the directory operation
   * @param {string} directoryPath - Path to the directory being processed
   * @param {string} [operation='process'] - Type of operation (process, create, scan, etc.)
   * @param {EventDetails} [details={}] - Additional directory details
   */
  constructor(message, directoryPath, operation = 'process', details = {}) {
    super('directory', message, { ...details, directoryPath, operation });

    /**
     * @type {string} Path to the directory
     */
    this.directoryPath = directoryPath;

    /**
     * @type {string} Type of directory operation
     */
    this.operation = operation;
  }

  /**
   * Create a directory scanning event
   *
   * @param {string} directoryPath - Directory being scanned
   * @param {number} [fileCount=0] - Number of files found
   * @param {EventDetails} [details={}] - Additional details
   * @returns {DirectoryEvent} New directory scan event
   */
  static scan(directoryPath, fileCount = 0, details = {}) {
    return new DirectoryEvent(`Scanning directory: ${directoryPath}`, directoryPath, 'scan', {
      ...details,
      fileCount
    });
  }

  /**
   * Create a directory creation event
   *
   * @param {string} directoryPath - Directory being created
   * @param {EventDetails} [details={}] - Additional details
   * @returns {DirectoryEvent} New directory creation event
   */
  static create(directoryPath, details = {}) {
    return new DirectoryEvent(
      `Creating directory: ${directoryPath}`,
      directoryPath,
      'create',
      details
    );
  }
}

/**
 * Success event for successful operations
 *
 * Indicates successful completion of operations, commands, or tasks.
 * Often the final event emitted by a command.
 *
 * @extends CommandEvent
 */
class SuccessEvent extends CommandEvent {
  /**
   * Create a new success event
   *
   * @param {string} message - Success message describing what was accomplished
   * @param {EventDetails} [details={}] - Additional success details
   * @param {number|null} [duration=null] - Operation duration in milliseconds
   */
  constructor(message, details = {}, duration = null) {
    super('success', message, { ...details, duration });

    /**
     * @type {number|null} Duration of the operation in milliseconds
     */
    this.duration = duration;
  }

  /**
   * Create a success event with timing information
   *
   * @param {string} message - Success message
   * @param {Date} startTime - When the operation started
   * @param {EventDetails} [details={}] - Additional details
   * @returns {SuccessEvent} New success event with calculated duration
   */
  static withTiming(message, startTime, details = {}) {
    const duration = Date.now() - startTime.getTime();
    return new SuccessEvent(message, details, duration);
  }

  /**
   * Get formatted duration string
   *
   * @returns {string|null} Formatted duration or null if no duration set
   */
  getFormattedDuration() {
    if (this.duration === null) return null;

    if (this.duration < 1000) {
      return `${this.duration}ms`;
    }

    const seconds = Math.round((this.duration / 1000) * 100) / 100;
    return `${seconds}s`;
  }
}

/**
 * Warning event for non-fatal issues
 *
 * Represents warnings, non-critical issues, or situations that require
 * attention but don't prevent operation completion.
 *
 * @extends CommandEvent
 */
class WarningEvent extends CommandEvent {
  /**
   * Create a new warning event
   *
   * @param {string} message - Warning message
   * @param {EventDetails} [details={}] - Additional warning details
   * @param {string|null} [code=null] - Warning code for categorization
   */
  constructor(message, details = {}, code = null) {
    super('warning', message, { ...details, code });

    /**
     * @type {string|null} Warning code for categorization
     */
    this.code = code;
  }
}

/**
 * Start event for operation initiation
 *
 * Indicates the beginning of a command or operation. Often includes
 * configuration or context information.
 *
 * @extends CommandEvent
 */
class StartEvent extends CommandEvent {
  /**
   * Create a new start event
   *
   * @param {string} message - Start message describing what's beginning
   * @param {EventDetails} [details={}] - Additional start details
   */
  constructor(message, details = {}) {
    super('start', message, details);
  }

  /**
   * Create a start event for production operations
   *
   * @param {string} message - Start message
   * @param {EventDetails} [details={}] - Additional details
   * @returns {StartEvent} New production start event
   */
  static production(message, details = {}) {
    return new StartEvent(message, { ...details, isProd: true });
  }
}

/**
 * Status event for system state information
 *
 * Represents status checks, health reports, or system state information
 * that doesn't fit into other event categories.
 *
 * @extends CommandEvent
 */
class StatusEvent extends CommandEvent {
  /**
   * Create a new status event
   *
   * @param {string} message - Status message
   * @param {string} status - Status value (healthy, degraded, error, etc.)
   * @param {EventDetails} [details={}] - Additional status details
   */
  constructor(message, status, details = {}) {
    super('status', message, { ...details, status });

    /**
     * @type {string} Current status value
     */
    this.status = status;
  }

  /**
   * Check if status indicates a healthy state
   *
   * @returns {boolean} True if status is healthy
   */
  isHealthy() {
    const healthyStatuses = ['healthy', 'ok', 'success', 'active', 'running'];
    return healthyStatuses.includes(this.status.toLowerCase());
  }
}

/**
 * Complete event for successful operation completion
 *
 * Indicates that an operation has completed successfully with optional result data.
 * Similar to SuccessEvent but specifically for completion of multi-step operations.
 *
 * @extends CommandEvent
 */
class CompleteEvent extends CommandEvent {
  /**
   * Create a new complete event
   *
   * @param {string} message - Completion message
   * @param {*} [result=null] - Operation result data
   * @param {EventDetails} [details={}] - Additional completion details
   */
  constructor(message, result = null, details = {}) {
    super('complete', message, { ...details, result });

    /**
     * @type {*} The result of the completed operation
     */
    this.result = result;
  }
}

/**
 * Cancelled event for operations that were cancelled
 *
 * Indicates that an operation was cancelled by the user or system before completion.
 *
 * @extends CommandEvent
 */
class CancelledEvent extends CommandEvent {
  /**
   * Create a new cancelled event
   *
   * @param {string} [message='Operation cancelled'] - Cancellation message
   * @param {string|null} [reason=null] - Reason for cancellation
   * @param {EventDetails} [details={}] - Additional cancellation details
   */
  constructor(message = 'Operation cancelled', reason = null, details = {}) {
    super('cancelled', message, { ...details, reason });

    /**
     * @type {string|null} Reason for the cancellation
     */
    this.reason = reason;
  }
}

/**
 * Build-specific events for compilation and build operations
 */

/**
 * Build progress event for tracking build stages
 * @extends CommandEvent
 */
class BuildProgressEvent extends CommandEvent {
  /**
   * Create a build progress event
   * @param {string} stage - Current build stage
   * @param {string} inputDir - Input directory path
   * @param {string} outputDir - Output directory path
   * @param {EventDetails} [details={}] - Additional details
   */
  constructor(stage, inputDir, outputDir, details = {}) {
    super('build:progress', `Build stage: ${stage}`, {
      ...details,
      stage,
      inputDir,
      outputDir
    });
    this.stage = stage;
    this.inputDir = inputDir;
    this.outputDir = outputDir;
  }

  /**
   * Convert to event data format expected by emit()
   * @returns {Object}
   */
  toEventData() {
    return {
      timestamp: this.timestamp.toISOString(),
      eventType: 'BuildProgressEvent',
      stage: this.stage,
      inputDir: this.inputDir,
      outputDir: this.outputDir,
      ...this.details
    };
  }
}

/**
 * Build start event
 * @extends CommandEvent
 */
class BuildStartEvent extends CommandEvent {
  /**
   * Create a build start event
   * @param {string} type - Type of build operation
   * @param {string} inputDir - Input directory path
   * @param {string} outputDir - Output directory path
   * @param {EventDetails} [details={}] - Additional details
   */
  constructor(type, inputDir, outputDir, details = {}) {
    super('build:start', `Starting ${type} build`, {
      ...details,
      type,
      inputDir,
      outputDir
    });
    this.type = type;
    this.inputDir = inputDir;
    this.outputDir = outputDir;
  }

  /**
   * Convert to event data format expected by emit()
   * @returns {Object}
   */
  toEventData() {
    return {
      timestamp: this.timestamp.toISOString(),
      eventType: 'BuildStartEvent',
      type: this.type,
      inputDir: this.inputDir,
      outputDir: this.outputDir,
      ...this.details
    };
  }
}

/**
 * Build complete event
 * @extends CommandEvent
 */
class BuildCompleteEvent extends CommandEvent {
  /**
   * Create a build complete event
   * @param {Object} result - Build result details
   * @param {EventDetails} [details={}] - Additional details
   */
  constructor(result, details = {}) {
    super('build:complete', 'Build completed successfully', {
      ...details,
      result
    });
    this.result = result;
  }

  /**
   * Convert to event data format expected by emit()
   * @returns {Object}
   */
  toEventData() {
    return {
      timestamp: this.timestamp.toISOString(),
      eventType: 'BuildCompleteEvent',
      result: this.result,
      ...this.details
    };
  }
}

/**
 * Build failed event
 * @extends CommandEvent
 */
class BuildFailedEvent extends CommandEvent {
  /**
   * Create a build failed event
   * @param {Error} error - The error that caused failure
   * @param {EventDetails} [details={}] - Additional details
   */
  constructor(error, details = {}) {
    super('build:failed', `Build failed: ${error.message}`, {
      ...details,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
    this.buildError = error;
  }

  /**
   * Convert to event data format expected by emit()
   * @returns {Object}
   */
  toEventData() {
    return {
      timestamp: this.timestamp.toISOString(),
      eventType: 'BuildFailedEvent',
      error: {
        message: this.buildError.message,
        stack: this.buildError.stack,
        name: this.buildError.name
      },
      ...this.details
    };
  }
}

/**
 * Utility function to validate event types at runtime
 *
 * Provides runtime type checking for events, ensuring they are instances
 * of the expected event class. This is the runtime equivalent of TypeScript
 * type checking, using JavaScript's native instanceof operator.
 *
 * @param {*} event - The event to validate
 * @param {Function} expectedClass - The expected event class constructor
 * @throws {TypeError} If event is not an instance of expectedClass
 * @returns {boolean} True if validation passes
 */
function validateCommandEvent(event, expectedClass) {
  if (!(event instanceof expectedClass)) {
    const actualType = event?.constructor?.name || typeof event;
    const expectedType = expectedClass.name;
    throw new TypeError(`Invalid event type: expected ${expectedType}, got ${actualType}`);
  }
  return true;
}

/**
 * Factory function to create typed events with validation
 *
 * Creates events using a type string, providing a convenient way to
 * instantiate events while maintaining type safety through the class system.
 *
 * @param {string} type - Event type string
 * @param {...*} args - Arguments to pass to the event constructor
 * @returns {CommandEvent} New event instance of the appropriate type
 * @throws {Error} If event type is unknown
 */
function createCommandEvent(type, ...args) {
  const eventClasses = {
    progress: ProgressEvent,
    error: ErrorEvent,
    directory: DirectoryEvent,
    success: SuccessEvent,
    warning: WarningEvent,
    start: StartEvent,
    status: StatusEvent,
    complete: CompleteEvent,
    cancelled: CancelledEvent,
    'build:progress': BuildProgressEvent,
    'build:start': BuildStartEvent,
    'build:complete': BuildCompleteEvent,
    'build:failed': BuildFailedEvent
  };

  const EventClass = eventClasses[type];
  if (!EventClass) {
    throw new Error(
      `Unknown event type: ${type}. Available types: ${Object.keys(eventClasses).join(', ')}`
    );
  }

  return new EventClass(...args);
}

// Export all event classes and utilities
export {
  // Base class
  CommandEvent,

  // Core event classes
  ProgressEvent,
  ErrorEvent,
  DirectoryEvent,
  SuccessEvent,
  WarningEvent,
  StartEvent,
  StatusEvent,
  CompleteEvent,
  CancelledEvent,

  // Build-specific event classes
  BuildProgressEvent,
  BuildStartEvent,
  BuildCompleteEvent,
  BuildFailedEvent,

  // Utilities
  validateCommandEvent,
  createCommandEvent
};
