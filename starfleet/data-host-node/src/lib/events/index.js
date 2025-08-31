/**
 * Event System Index - Main Exports for D.A.T.A. CLI
 * 
 * This module provides the main exports for the event system, including all
 * event classes, utility functions, and backward compatibility with the existing
 * CommandEvents.js implementation.
 * 
 * @fileoverview Main exports and utilities for event-driven command architecture
 * @author Supa Base 12 Engineering Team
 * @version 1.0.0
 */

// Import individual event classes
import CommandEvent from './CommandEvent.js';
import ProgressEvent from './ProgressEvent.js';
import ErrorEvent from './ErrorEvent.js';
import WarningEvent from './WarningEvent.js';
import SuccessEvent from './SuccessEvent.js';

// Import additional event classes from the original CommandEvents.js for backward compatibility
import {
  DirectoryEvent,
  StartEvent,
  StatusEvent,
  CompleteEvent,
  CancelledEvent,
  BuildProgressEvent,
  BuildStartEvent,
  BuildCompleteEvent,
  BuildFailedEvent
} from './CommandEvents.js';

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
 * 
 * @example
 * // Runtime validation in event handlers
 * command.on('progress', (event) => {
 *   if (validateCommandEvent(event, ProgressEvent)) {
 *     console.log(`Progress: ${event.percentage}%`);
 *   }
 * });
 */
function validateCommandEvent(event, expectedClass) {
  if (!(event instanceof expectedClass)) {
    const actualType = event?.constructor?.name || typeof event;
    const expectedType = expectedClass.name;
    throw new TypeError(
      `Invalid event type: expected ${expectedType}, got ${actualType}`
    );
  }
  return true;
}

/**
 * Advanced runtime validation with detailed error reporting
 * 
 * Extended validation that provides more detailed error information
 * and handles edge cases for better debugging.
 * 
 * @param {*} event - The event to validate
 * @param {Function} expectedClass - The expected event class constructor
 * @returns {Object} Validation result with success/error properties
 * 
 * @example
 * const validation = validateEventSafely(event, ProgressEvent);
 * if (!validation.success) {
 *   console.warn('Event validation failed:', validation.error);
 * }
 */
function validateEventSafely(event, expectedClass) {
  try {
    validateCommandEvent(event, expectedClass);
    return { success: true, error: null };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      actualType: event?.constructor?.name || typeof event,
      expectedType: expectedClass.name
    };
  }
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
 * 
 * @example
 * // Create events using factory function
 * const progressEvent = createCommandEvent('progress', 'Processing files', 50);
 * const errorEvent = createCommandEvent('error', 'Connection failed', new Error('ECONNREFUSED'));
 */
function createCommandEvent(type, ...args) {
  const eventClasses = {
    // Core event classes (from separate files)
    progress: ProgressEvent,
    error: ErrorEvent,
    warning: WarningEvent,
    success: SuccessEvent,
    
    // Additional event classes (from CommandEvents.js)
    directory: DirectoryEvent,
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
    throw new Error(`Unknown event type: ${type}. Available types: ${Object.keys(eventClasses).join(', ')}`);
  }

  return new EventClass(...args);
}

/**
 * Type guard functions for runtime event type checking
 * 
 * Provides convenient type checking functions that can be used in
 * event handlers to ensure proper event types.
 */
const EventTypeGuards = {
  /**
   * Check if event is a ProgressEvent
   * @param {*} event - Event to check
   * @returns {boolean} True if event is ProgressEvent
   */
  isProgressEvent: (event) => event instanceof ProgressEvent,
  
  /**
   * Check if event is an ErrorEvent
   * @param {*} event - Event to check
   * @returns {boolean} True if event is ErrorEvent
   */
  isErrorEvent: (event) => event instanceof ErrorEvent,
  
  /**
   * Check if event is a WarningEvent
   * @param {*} event - Event to check
   * @returns {boolean} True if event is WarningEvent
   */
  isWarningEvent: (event) => event instanceof WarningEvent,
  
  /**
   * Check if event is a SuccessEvent
   * @param {*} event - Event to check
   * @returns {boolean} True if event is SuccessEvent
   */
  isSuccessEvent: (event) => event instanceof SuccessEvent,
  
  /**
   * Check if event is any CommandEvent
   * @param {*} event - Event to check
   * @returns {boolean} True if event is CommandEvent or subclass
   */
  isCommandEvent: (event) => event instanceof CommandEvent
};

/**
 * Event listener wrapper that validates event types
 * 
 * Creates a wrapper function that validates events before calling
 * the actual listener, providing runtime type safety.
 * 
 * @param {Function} listener - The actual event listener function
 * @param {Function} expectedClass - Expected event class
 * @param {boolean} [strict=true] - Whether to throw on validation failure
 * @returns {Function} Wrapped listener with validation
 * 
 * @example
 * // Wrap listener with validation
 * const safeListener = createValidatedListener(
 *   (event) => console.log(event.percentage),
 *   ProgressEvent
 * );
 * command.on('progress', safeListener);
 */
function createValidatedListener(listener, expectedClass, strict = true) {
  return function validatedListener(eventData) {
    try {
      // If eventData is already an instance of the expected class, use it directly
      if (eventData instanceof expectedClass) {
        return listener(eventData);
      }
      
      // If it's a plain object (backward compatibility), validate structure
      if (typeof eventData === 'object' && eventData.message && eventData.type) {
        return listener(eventData);
      }
      
      if (strict) {
        throw new TypeError(`Expected ${expectedClass.name}, got ${typeof eventData}`);
      } else {
        console.warn(`Event validation failed: expected ${expectedClass.name}`);
        return listener(eventData);
      }
    } catch (error) {
      if (strict) {
        throw error;
      } else {
        console.error('Event listener error:', error.message);
      }
    }
  };
}

// Export all event classes and utilities
export {
  // Base class
  CommandEvent,
  
  // Core event classes (from separate files)
  ProgressEvent,
  ErrorEvent,
  WarningEvent,
  SuccessEvent,
  
  // Additional event classes (from CommandEvents.js for backward compatibility)
  DirectoryEvent,
  StartEvent,
  StatusEvent,
  CompleteEvent,
  CancelledEvent,
  BuildProgressEvent,
  BuildStartEvent,
  BuildCompleteEvent,
  BuildFailedEvent,
  
  // Utilities
  validateCommandEvent,
  validateEventSafely,
  createCommandEvent,
  createValidatedListener,
  EventTypeGuards
};

// Export type guard aliases for backward compatibility
export const isProgressEvent = EventTypeGuards.isProgressEvent;
export const isErrorEvent = EventTypeGuards.isErrorEvent;
export const isWarningEvent = EventTypeGuards.isWarningEvent;
export const isSuccessEvent = EventTypeGuards.isSuccessEvent;
export const isCommandEvent = EventTypeGuards.isCommandEvent;

// Default export
export default {
  CommandEvent,
  ProgressEvent,
  ErrorEvent,
  WarningEvent,
  SuccessEvent,
  DirectoryEvent,
  StartEvent,
  StatusEvent,
  CompleteEvent,
  CancelledEvent,
  BuildProgressEvent,
  BuildStartEvent,
  BuildCompleteEvent,
  BuildFailedEvent,
  validateCommandEvent,
  validateEventSafely,
  createCommandEvent,
  createValidatedListener,
  EventTypeGuards,
  isProgressEvent,
  isErrorEvent,
  isWarningEvent,
  isSuccessEvent,
  isCommandEvent
};