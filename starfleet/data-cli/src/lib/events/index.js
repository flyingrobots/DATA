/**
 * @fileoverview Comprehensive Event System Index - Runtime Type Safety for D.A.T.A. CLI
 * 
 * Central export point for the complete event class hierarchy with instanceof validation,
 * zero dependencies, and phenomenal JavaScript runtime type safety.
 * 
 * This module provides:
 * - All event classes with runtime validation
 * - Type checking utilities
 * - Event factory functions
 * - Category-based imports
 * - Complete TypeScript-like safety without TypeScript
 * 
 * @module Events
 * @since 2.0.0
 * @author JavaScript Pro (via Claude Code)
 * @example
 * // Import all events
 * import { ProgressEvent, MigrationStartEvent, TestResultEvent } from './events/index.js';
 * 
 * // Import by category
 * import { CommandEvents, MigrationEvents, TestEvents } from './events/index.js';
 * 
 * // Runtime validation
 * import { validateEvent, isEventType } from './events/index.js';
 */

'use strict';

// =============================================================================
// CORE EVENT SYSTEM IMPORTS
// =============================================================================

import CommandEvents from './CommandEvents.cjs';
import MigrationEvents from './MigrationEvents.cjs';
import TestEvents from './TestEvents.cjs';

// =============================================================================
// INDIVIDUAL CLASS EXPORTS FOR CLEAN IMPORTS
// =============================================================================

// Base and core events
const {
  CommandEvent,
  ProgressEvent,
  ErrorEvent,
  SuccessEvent,
  WarningEvent,
  StartEvent,
  CompleteEvent,
  CancelledEvent,
  validateCommandEvent
} = CommandEvents;

// Migration events
const {
  MigrationStartEvent,
  MigrationStepEvent,
  MigrationCompleteEvent,
  MigrationFailedEvent,
  MigrationRollbackEvent,
  MigrationValidationEvent,
  SchemaDiffEvent
} = MigrationEvents;

// Test events
const {
  TestRunEvent,
  TestProgressEvent,
  TestResultEvent,
  TestFailedEvent,
  CoverageEvent,
  TestDiscoveryEvent,
  TestValidationEvent
} = TestEvents;

// =============================================================================
// RUNTIME TYPE CHECKING UTILITIES
// =============================================================================

/**
 * Enhanced event validation with comprehensive type checking.
 * 
 * Provides more detailed validation than the basic validateCommandEvent,
 * with support for multiple expected types and detailed error reporting.
 * 
 * @param {Object} event - Event object to validate
 * @param {Function|Array<Function>} [expectedTypes] - Expected event class(es)
 * @param {Object} [options={}] - Validation options
 * @param {boolean} [options.strict=true] - Strict validation mode
 * @param {boolean} [options.throwOnError=true] - Throw error vs return result
 * @returns {Object|boolean} Validation result or throws error
 * @throws {TypeError} When validation fails and throwOnError is true
 * @example
 * // Single type validation
 * validateEvent(event, ProgressEvent);
 * 
 * // Multiple type validation
 * validateEvent(event, [ProgressEvent, ErrorEvent]);
 * 
 * // Non-throwing validation
 * const result = validateEvent(event, ProgressEvent, { throwOnError: false });
 * if (!result.valid) console.error(result.errors);
 */
function validateEvent(event, expectedTypes = null, options = {}) {
  const opts = {
    strict: true,
    throwOnError: true,
    ...options
  };

  const errors = [];

  // Basic structure validation
  try {
    validateCommandEvent(event);
  } catch (error) {
    errors.push(`Basic validation failed: ${error.message}`);
  }

  // Type-specific validation
  if (expectedTypes) {
    const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    const matches = types.some(Type => {
      try {
        validateCommandEvent(event, Type);
        return true;
      } catch (error) {
        errors.push(`Type ${Type.name} validation failed: ${error.message}`);
        return false;
      }
    });

    if (!matches) {
      const typeNames = types.map(T => T.name).join(' or ');
      errors.push(`Event does not match expected type(s): ${typeNames}`);
    }
  }

  // Strict mode additional checks
  if (opts.strict) {
    // Check for required properties based on event type
    if (event instanceof ProgressEvent && event.percentage !== null) {
      if (typeof event.percentage !== 'number' || event.percentage < 0 || event.percentage > 100) {
        errors.push('ProgressEvent percentage must be null or number between 0-100');
      }
    }
    
    if (event instanceof ErrorEvent) {
      if (!event.message || event.message.trim().length === 0) {
        errors.push('ErrorEvent must have non-empty message');
      }
    }

    // Check immutability
    if (!Object.isFrozen(event)) {
      errors.push('Event object must be frozen (immutable)');
    }
  }

  const result = {
    valid: errors.length === 0,
    errors: errors,
    event: event,
    timestamp: new Date()
  };

  if (!result.valid && opts.throwOnError) {
    throw new TypeError(`Event validation failed:\n${errors.join('\n')}`);
  }

  return opts.throwOnError ? true : result;
}

/**
 * Checks if an event is of a specific type using instanceof.
 * 
 * Provides a clean way to do runtime type checking with support
 * for multiple types and null safety.
 * 
 * @param {Object|null} event - Event to check
 * @param {Function|Array<Function>} EventTypes - Class(es) to check against
 * @returns {boolean} True if event matches any of the specified types
 * @example
 * if (isEventType(event, ProgressEvent)) {
 *   console.log(`Progress: ${event.percentage}%`);
 * }
 * 
 * if (isEventType(event, [ErrorEvent, WarningEvent])) {
 *   console.log('Issue detected:', event.message);
 * }
 */
function isEventType(event, EventTypes) {
  if (!event || typeof event !== 'object') return false;
  
  const types = Array.isArray(EventTypes) ? EventTypes : [EventTypes];
  return types.some(Type => event instanceof Type);
}

/**
 * Creates a type guard function for a specific event type.
 * 
 * Returns a function that can be used to check and narrow event types
 * in a functional programming style.
 * 
 * @param {Function} EventType - Event class to create guard for
 * @returns {Function} Type guard function
 * @example
 * const isProgress = createTypeGuard(ProgressEvent);
 * const progressEvents = events.filter(isProgress);
 */
function createTypeGuard(EventType) {
  return function(event) {
    return event instanceof EventType;
  };
}

/**
 * Gets the event type hierarchy for a given event.
 * 
 * Returns an array of classes that the event inherits from,
 * useful for debugging and type analysis.
 * 
 * @param {Object} event - Event to analyze
 * @returns {Array<string>} Array of class names in inheritance chain
 * @example
 * const hierarchy = getEventHierarchy(migrationEvent);
 * // ['MigrationStartEvent', 'CommandEvent', 'Object']
 */
function getEventHierarchy(event) {
  if (!event || typeof event !== 'object') return [];
  
  const hierarchy = [];
  let current = event.constructor;
  
  while (current && current.name !== 'Object') {
    hierarchy.push(current.name);
    current = Object.getPrototypeOf(current);
  }
  
  return hierarchy;
}

// =============================================================================
// EVENT FACTORY FUNCTIONS
// =============================================================================

/**
 * Creates events with automatic validation and error handling.
 * 
 * Factory functions that ensure events are created correctly with
 * proper validation and consistent error handling.
 */
const EventFactory = {
  /**
   * Creates a progress event with validation.
   * 
   * @param {string} message - Progress message
   * @param {number|null} [percentage=null] - Progress percentage
   * @param {Object} [details={}] - Additional details
   * @returns {ProgressEvent} Validated progress event
   */
  progress(message, percentage = null, details = {}) {
    try {
      return new ProgressEvent(message, percentage, details);
    } catch (error) {
      throw new TypeError(`Failed to create ProgressEvent: ${error.message}`);
    }
  },

  /**
   * Creates an error event with validation.
   * 
   * @param {string} message - Error message
   * @param {Error|null} [error=null] - Error object
   * @param {string|null} [code=null] - Error code
   * @param {Object} [details={}] - Additional details
   * @returns {ErrorEvent} Validated error event
   */
  error(message, error = null, code = null, details = {}) {
    try {
      return new ErrorEvent(message, error, code, details);
    } catch (err) {
      throw new TypeError(`Failed to create ErrorEvent: ${err.message}`);
    }
  },

  /**
   * Creates a migration start event with validation.
   * 
   * @param {string} message - Migration message
   * @param {Object} [details={}] - Migration details
   * @returns {MigrationStartEvent} Validated migration event
   */
  migrationStart(message, details = {}) {
    try {
      return new MigrationStartEvent(message, details);
    } catch (error) {
      throw new TypeError(`Failed to create MigrationStartEvent: ${error.message}`);
    }
  },

  /**
   * Creates a test result event with validation.
   * 
   * @param {string} message - Test result message
   * @param {Object} [details={}] - Test result details
   * @returns {TestResultEvent} Validated test result event
   */
  testResult(message, details = {}) {
    try {
      return new TestResultEvent(message, details);
    } catch (error) {
      throw new TypeError(`Failed to create TestResultEvent: ${error.message}`);
    }
  }
};

// =============================================================================
// EVENT CATEGORY COLLECTIONS
// =============================================================================

/**
 * All core command events for basic operations.
 */
const CoreEvents = {
  CommandEvent,
  ProgressEvent,
  ErrorEvent,
  SuccessEvent,
  WarningEvent,
  StartEvent,
  CompleteEvent,
  CancelledEvent
};

/**
 * All migration-related events for database operations.
 */
const MigrationEventTypes = {
  MigrationStartEvent,
  MigrationStepEvent,
  MigrationCompleteEvent,
  MigrationFailedEvent,
  MigrationRollbackEvent,
  MigrationValidationEvent,
  SchemaDiffEvent
};

/**
 * All test-related events for pgTAP and coverage operations.
 */
const TestEventTypes = {
  TestRunEvent,
  TestProgressEvent,
  TestResultEvent,
  TestFailedEvent,
  CoverageEvent,
  TestDiscoveryEvent,
  TestValidationEvent
};

/**
 * All available event types in the system.
 */
const AllEvents = {
  ...CoreEvents,
  ...MigrationEventTypes,
  ...TestEventTypes
};

// =============================================================================
// EXPORTS
// =============================================================================

// Individual event classes for clean imports
export {
  // Base and core events
  CommandEvent,
  ProgressEvent,
  ErrorEvent,
  SuccessEvent,
  WarningEvent,
  StartEvent,
  CompleteEvent,
  CancelledEvent,
  
  // Migration events
  MigrationStartEvent,
  MigrationStepEvent,
  MigrationCompleteEvent,
  MigrationFailedEvent,
  MigrationRollbackEvent,
  MigrationValidationEvent,
  SchemaDiffEvent,
  
  // Test events
  TestRunEvent,
  TestProgressEvent,
  TestResultEvent,
  TestFailedEvent,
  CoverageEvent,
  TestDiscoveryEvent,
  TestValidationEvent,
  
  // Validation utilities
  validateCommandEvent,
  validateEvent,
  isEventType,
  createTypeGuard,
  getEventHierarchy,
  
  // Factory functions
  EventFactory,
  
  // Category collections
  CoreEvents,
  MigrationEventTypes,
  TestEventTypes,
  AllEvents,
  
  // Module collections for namespace imports
  CommandEvents,
  MigrationEvents,
  TestEvents
};

// Default export for convenience
export default AllEvents;