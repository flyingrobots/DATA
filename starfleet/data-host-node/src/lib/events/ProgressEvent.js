/**
 * Progress Event Class for D.A.T.A. CLI
 *
 * This module provides the ProgressEvent class for tracking progress during
 * long-running operations such as database migrations, file processing,
 * or compilation tasks.
 *
 * @fileoverview Progress event class with percentage tracking and factory methods
 * @author Supa Base 12 Engineering Team
 * @version 1.0.0
 */

import CommandEvent from './CommandEvent.js';

/**
 * Progress event for long-running operations
 *
 * Used to indicate progress during operations that may take significant time,
 * such as database migrations, file processing, or compilation tasks.
 * Supports both determinate progress (with percentage) and indeterminate progress.
 *
 * @extends CommandEvent
 */
class ProgressEvent extends CommandEvent {
  /**
   * Create a new progress event
   *
   * @param {string} message - Progress message describing current operation
   * @param {number|null} [percentage=null] - Completion percentage (0-100), null if unknown
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional progress details
   * @throws {Error} If percentage is not null and not a valid number between 0-100
   */
  constructor(message, percentage = null, details = {}) {
    super('progress', message, details);

    // Validate percentage if provided
    if (percentage !== null && (typeof percentage !== 'number' || percentage < 0 || percentage > 100)) {
      throw new Error('Percentage must be a number between 0 and 100, or null');
    }

    /**
     * @type {number|null} Completion percentage (0-100) or null if indeterminate
     */
    this.percentage = percentage;
  }

  /**
   * Create a progress event with percentage
   *
   * Factory method that automatically calculates percentage based on completed/total counts.
   * Ensures percentage is properly rounded and includes the counts in event details.
   *
   * @param {string} message - Progress message
   * @param {number} completed - Number of items completed
   * @param {number} total - Total number of items
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {ProgressEvent} New progress event with calculated percentage
   *
   * @example
   * const event = ProgressEvent.withPercentage('Processing files', 25, 100);
   * console.log(event.percentage); // 25
   * console.log(event.details.completed); // 25
   * console.log(event.details.total); // 100
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
   * Factory method for creating progress events where the completion percentage
   * cannot be determined. Useful for operations where the total work is unknown.
   *
   * @param {string} message - Progress message
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {ProgressEvent} New indeterminate progress event
   *
   * @example
   * const event = ProgressEvent.indeterminate('Scanning directory structure');
   * console.log(event.percentage); // null
   */
  static indeterminate(message, details = {}) {
    return new ProgressEvent(message, null, details);
  }

  /**
   * Check if this progress event is determinate (has percentage)
   *
   * @returns {boolean} True if progress has a specific percentage value
   */
  isDeterminate() {
    return this.percentage !== null;
  }

  /**
   * Check if the operation is complete (100%)
   *
   * @returns {boolean} True if percentage is 100
   */
  isComplete() {
    return this.percentage === 100;
  }

  /**
   * Convert to event data format expected by emit()
   *
   * Extends the base toEventData method to include percentage information
   * for backward compatibility with existing progress event listeners.
   *
   * @returns {Object} Event data in the format expected by emit()
   */
  toEventData() {
    return {
      ...super.toEventData(),
      percentage: this.percentage
    };
  }

  /**
   * Get formatted progress string
   *
   * @returns {string} Formatted progress representation
   */
  getFormattedProgress() {
    if (this.percentage === null) {
      return 'In progress...';
    }
    return `${this.percentage}%`;
  }
}

export { ProgressEvent };
export default ProgressEvent;
