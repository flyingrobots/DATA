/**
 * Base Command Event Class for D.A.T.A. CLI
 * 
 * This module provides the foundational CommandEvent class for the event-driven
 * architecture used throughout the D.A.T.A. (Database Automation, Testing, and 
 * Alignment) CLI tool. All events support instanceof checks for runtime type safety.
 * 
 * @fileoverview Base event class for robust event-driven command architecture
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

  /**
   * Convert to event data format expected by emit()
   * 
   * This method provides backward compatibility with the existing event system
   * by converting event instances to the object format expected by listeners.
   * 
   * @returns {Object} Event data in the format expected by emit()
   */
  toEventData() {
    return {
      message: this.message,
      data: this.details,
      timestamp: this.timestamp,
      type: this.type
    };
  }
}

export { CommandEvent };
export default CommandEvent;