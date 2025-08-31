/**
 * Success Event Class for D.A.T.A. CLI
 * 
 * This module provides the SuccessEvent class for indicating successful
 * completion of operations, commands, or tasks. Often the final event
 * emitted by a command.
 * 
 * @fileoverview Success event class with timing and result tracking
 * @author Supa Base 12 Engineering Team
 * @version 1.0.0
 */

import CommandEvent from './CommandEvent.js';

/**
 * Success event for successful operations
 * 
 * Indicates successful completion of operations, commands, or tasks.
 * Supports timing information and result data for comprehensive success reporting.
 * Often the final event emitted by a command.
 * 
 * @extends CommandEvent
 */
class SuccessEvent extends CommandEvent {
  /**
   * Create a new success event
   * 
   * @param {string} message - Success message describing what was accomplished
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional success details
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
   * Factory method that automatically calculates operation duration based on
   * start time. Useful for measuring and reporting operation performance.
   * 
   * @param {string} message - Success message
   * @param {Date} startTime - When the operation started
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {SuccessEvent} New success event with calculated duration
   * 
   * @example
   * const startTime = new Date();
   * // ... perform operation ...
   * const successEvent = SuccessEvent.withTiming('Operation completed', startTime);
   * console.log(successEvent.getFormattedDuration()); // "1.23s"
   */
  static withTiming(message, startTime, details = {}) {
    const duration = Date.now() - startTime.getTime();
    return new SuccessEvent(message, details, duration);
  }

  /**
   * Create a success event with result data
   * 
   * Factory method for operations that produce significant result data.
   * Automatically includes result information in the event details.
   * 
   * @param {string} message - Success message
   * @param {*} result - The result data from the operation
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {SuccessEvent} New success event with result data
   * 
   * @example
   * const result = { filesProcessed: 42, migrations: 3 };
   * const successEvent = SuccessEvent.withResult('Build completed', result);
   */
  static withResult(message, result, details = {}) {
    return new SuccessEvent(message, { ...details, result });
  }

  /**
   * Create a success event for database operations
   * 
   * Factory method for database-specific success events with standardized
   * database operation metrics and information.
   * 
   * @param {string} operation - Database operation performed
   * @param {number} [rowsAffected=0] - Number of database rows affected
   * @param {number} [duration=null] - Query duration in milliseconds
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {SuccessEvent} New database success event
   */
  static database(operation, rowsAffected = 0, duration = null, details = {}) {
    return new SuccessEvent(
      `Database ${operation} completed successfully`,
      {
        ...details,
        operation,
        rowsAffected,
        category: 'database'
      },
      duration
    );
  }

  /**
   * Create a success event for file operations
   * 
   * Factory method for file system operation success events with
   * standardized file operation metrics.
   * 
   * @param {string} operation - File operation performed
   * @param {string} filePath - Path of the file involved
   * @param {number} [fileSize=null] - Size of file in bytes
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {SuccessEvent} New file operation success event
   */
  static fileOperation(operation, filePath, fileSize = null, details = {}) {
    return new SuccessEvent(
      `File ${operation} completed: ${filePath}`,
      {
        ...details,
        operation,
        filePath,
        fileSize,
        category: 'file'
      }
    );
  }

  /**
   * Get formatted duration string
   * 
   * Converts duration from milliseconds to a human-readable format.
   * Returns null if no duration is available.
   * 
   * @returns {string|null} Formatted duration or null if no duration set
   */
  getFormattedDuration() {
    if (this.duration === null) return null;
    
    if (this.duration < 1000) {
      return `${this.duration}ms`;
    }
    
    const seconds = Math.round(this.duration / 1000 * 100) / 100;
    return `${seconds}s`;
  }

  /**
   * Check if the operation was fast (under 1 second)
   * 
   * @returns {boolean} True if duration is less than 1000ms
   */
  isFastOperation() {
    return this.duration !== null && this.duration < 1000;
  }

  /**
   * Check if the operation was slow (over 10 seconds)
   * 
   * @returns {boolean} True if duration is greater than 10000ms
   */
  isSlowOperation() {
    return this.duration !== null && this.duration > 10000;
  }

  /**
   * Check if this success event has result data
   * 
   * @returns {boolean} True if event contains result information
   */
  hasResult() {
    return this.details.result !== undefined;
  }

  /**
   * Get the result data from this success event
   * 
   * @returns {*} Result data or null if no result available
   */
  getResult() {
    return this.details.result || null;
  }

  /**
   * Check if this is a database operation success
   * 
   * @returns {boolean} True if this is a database success event
   */
  isDatabaseSuccess() {
    return this.details.category === 'database';
  }

  /**
   * Check if this is a file operation success
   * 
   * @returns {boolean} True if this is a file operation success event
   */
  isFileOperationSuccess() {
    return this.details.category === 'file';
  }

  /**
   * Convert to event data format expected by emit()
   * 
   * Extends the base toEventData method to include success-specific information
   * for backward compatibility with existing success event listeners.
   * 
   * @returns {Object} Event data in the format expected by emit()
   */
  toEventData() {
    return {
      ...super.toEventData(),
      duration: this.duration,
      formattedDuration: this.getFormattedDuration(),
      result: this.getResult(),
      category: this.details.category
    };
  }

  /**
   * Get a comprehensive success summary
   * 
   * @returns {Object} Summary object with key success metrics
   */
  getSummary() {
    return {
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      duration: this.duration,
      formattedDuration: this.getFormattedDuration(),
      hasResult: this.hasResult(),
      category: this.details.category || 'general',
      isFast: this.isFastOperation(),
      isSlow: this.isSlowOperation()
    };
  }
}

export { SuccessEvent };
export default SuccessEvent;