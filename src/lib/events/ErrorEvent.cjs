/**
 * Error Event Class for D.A.T.A. CLI
 * 
 * This module provides the ErrorEvent class for representing errors, failures,
 * and exceptions that occur during command execution. Includes the original
 * error object and optional error categorization.
 * 
 * @fileoverview Error event class with error context and categorization
 * @author Supa Base 12 Engineering Team
 * @version 1.0.0
 */

const CommandEvent = require('./CommandEvent.cjs');

/**
 * Error event for operation failures
 * 
 * Represents errors, failures, or exceptions that occur during command execution.
 * Includes the original error object and optional error categorization for better
 * error handling and reporting.
 * 
 * @extends CommandEvent
 */
class ErrorEvent extends CommandEvent {
  /**
   * Create a new error event
   * 
   * @param {string} message - Error message describing what went wrong
   * @param {Error|null} error - The actual error object that was thrown
   * @param {string|null} [code=null] - Error code for categorization
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional error context
   */
  constructor(message, error = null, code = null, details = {}) {
    super('error', message, { ...details, error, code });
    
    /**
     * @type {Error|null} The original error object
     */
    this.error = error;
    
    /**
     * @type {string|null} Error code for categorization
     */
    this.code = code || error?.code || null;
  }

  /**
   * Create an error event from an exception
   * 
   * Factory method that creates an ErrorEvent from a caught exception.
   * Automatically extracts error information and constructs a meaningful message.
   * 
   * @param {Error} error - The error object
   * @param {string} [context='Operation failed'] - Context message
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {ErrorEvent} New error event
   * 
   * @example
   * try {
   *   // some operation
   * } catch (error) {
   *   const errorEvent = ErrorEvent.fromError(error, 'Database connection failed');
   *   command.emit('error', errorEvent.toEventData());
   * }
   */
  static fromError(error, context = 'Operation failed', details = {}) {
    return new ErrorEvent(
      `${context}: ${error.message}`,
      error,
      error.code || null,
      details
    );
  }

  /**
   * Create an error event for validation failures
   * 
   * Factory method for creating validation-specific error events with
   * standardized error codes and categorization.
   * 
   * @param {string} message - Validation error message
   * @param {string} field - Field that failed validation
   * @param {*} value - The invalid value
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {ErrorEvent} New validation error event
   */
  static validation(message, field, value, details = {}) {
    return new ErrorEvent(
      message,
      new Error(`Validation failed for field: ${field}`),
      'VALIDATION_ERROR',
      {
        ...details,
        field,
        value,
        category: 'validation'
      }
    );
  }

  /**
   * Create an error event for system/infrastructure failures
   * 
   * Factory method for system-level errors like database connections,
   * file system operations, or external service failures.
   * 
   * @param {string} message - System error message
   * @param {Error} error - The underlying system error
   * @param {string} [system='unknown'] - The system component that failed
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {ErrorEvent} New system error event
   */
  static system(message, error, system = 'unknown', details = {}) {
    return new ErrorEvent(
      message,
      error,
      'SYSTEM_ERROR',
      {
        ...details,
        system,
        category: 'system'
      }
    );
  }

  /**
   * Get the full error stack trace
   * 
   * @returns {string} Stack trace string or fallback message
   */
  getStackTrace() {
    return this.error?.stack || 'No stack trace available';
  }

  /**
   * Check if this is a validation error
   * 
   * @returns {boolean} True if this is a validation error
   */
  isValidationError() {
    return this.code === 'VALIDATION_ERROR' || this.details.category === 'validation';
  }

  /**
   * Check if this is a system error
   * 
   * @returns {boolean} True if this is a system error
   */
  isSystemError() {
    return this.code === 'SYSTEM_ERROR' || this.details.category === 'system';
  }

  /**
   * Get error severity level
   * 
   * Determines error severity based on error type and context.
   * 
   * @returns {string} Severity level: 'critical', 'high', 'medium', 'low'
   */
  getSeverity() {
    if (this.isSystemError()) {
      return 'critical';
    }
    
    if (this.isValidationError()) {
      return 'medium';
    }
    
    // Check for specific error types
    if (this.error instanceof TypeError || this.error instanceof ReferenceError) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Convert to event data format expected by emit()
   * 
   * Extends the base toEventData method to include error information
   * for backward compatibility with existing error event listeners.
   * 
   * @returns {Object} Event data in the format expected by emit()
   */
  toEventData() {
    return {
      ...super.toEventData(),
      error: this.error,
      code: this.code,
      severity: this.getSeverity(),
      stackTrace: this.getStackTrace()
    };
  }

  /**
   * Get a sanitized version of the error for logging
   * 
   * Returns error information safe for logging, excluding sensitive data.
   * 
   * @returns {Object} Sanitized error information
   */
  toLogSafeObject() {
    return {
      type: this.type,
      message: this.message,
      code: this.code,
      severity: this.getSeverity(),
      timestamp: this.timestamp.toISOString(),
      errorName: this.error?.name,
      errorMessage: this.error?.message,
      // Exclude full stack trace and details for security
      hasStackTrace: !!this.error?.stack
    };
  }
}

module.exports = ErrorEvent;