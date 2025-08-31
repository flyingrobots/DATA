/**
 * @fileoverview Base Command Class for Event-Driven Architecture
 * 
 * Provides a common foundation for all CLI commands with event emission,
 * logging, production safety checks, and user interaction capabilities.
 * All commands in the D.A.T.A. system extend from this base class.
 * 
 * @module Command
 * @requires EventEmitter
 * @requires pino
 * @since 1.0.0
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import {
  ProgressEvent,
  WarningEvent,
  ErrorEvent,
  SuccessEvent,
  StartEvent,
  CompleteEvent,
  CancelledEvent,
  validateCommandEvent
} from './events/CommandEvents.cjs';

/**
 * Base command class that all commands extend from.
 * 
 * Provides event-driven architecture with production safety features,
 * logging capabilities, and standardized user interaction patterns.
 * 
 * @class
 * @extends EventEmitter
 * @example
 * class MyCommand extends Command {
 *   async performExecute(options) {
 *     this.progress('Starting operation...');
 *     // Do work here
 *     this.success('Operation completed!');
 *     return result;
 *   }
 * }
 */
class Command extends EventEmitter {
  /**
   * Creates a new Command instance.
   * 
   * @param {Object|null} legacyConfig - Legacy configuration object (Config class instance)
   * @param {Object|null} logger - Pino logger instance (optional, will create default if null)
   * @param {boolean} isProd - Whether running in production mode (affects confirmation behavior)
   * @param {Object|null} outputConfig - Output configuration for paths (OutputConfig class instance)
   */
  constructor(
    legacyConfig = null,  // Config class instance is OK - it's a typed class
    logger = null,
    isProd = false,
    outputConfig = null   // OutputConfig class instance for paths
  ) {
    super();
    // Store the Config instance (this is fine - it's a proper class)
    this.config = legacyConfig;

    // Logging and environment
    this.isProd = isProd;
    this.logger = logger || this.createLogger();

    // Path configuration via dependency injection
    this.outputConfig = outputConfig;

    // Command behavior flags
    this.requiresProductionConfirmation = true; // Can be overridden by subclasses
  }

  /**
   * Creates a default pino logger with development-friendly configuration.
   * 
   * @returns {Object} Configured pino logger instance
   * @private
   */
  createLogger() {
    const isDev = process.env.NODE_ENV !== 'production';

    return pino({
      level: this.config?.get ? this.config.get('logging.level') : 'info',
      transport: isDev ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      } : undefined
    });
  }

  /**
   * Executes the command with production safety checks and event emission.
   * 
   * This is the main entry point for command execution. It handles:
   * - Start event emission
   * - Production confirmation (if required)
   * - Delegation to performExecute()
   * - Completion event emission
   * - Error handling and cleanup
   * 
   * @param {...*} args - Arguments to pass to performExecute()
   * @returns {Promise<*>} Result from performExecute() or undefined if cancelled
   * @throws {Error} Any error thrown by performExecute()
   * @emits start - When command execution begins
   * @emits complete - When command execution succeeds
   * @emits cancelled - When command is cancelled by user
   * @emits error - When command execution fails
   */
  async execute(...args) {
    // Emit start event
    const startEvent = new StartEvent(`Starting ${this.constructor.name}`, { isProd: this.isProd });
    this.emit('start', {
      message: startEvent.message,
      data: startEvent.details,
      timestamp: startEvent.timestamp,
      type: startEvent.type,
      isProd: this.isProd
    });

    try {
      // Check for production confirmation if needed
      if (this.isProd && this.requiresProductionConfirmation) {
        const confirmed = await this.confirmProduction();
        if (!confirmed) {
          this.success('Operation cancelled');
          const cancelledEvent = new CancelledEvent('Operation cancelled');
          this.emit('cancelled', {
            message: cancelledEvent.message,
            data: cancelledEvent.details,
            timestamp: cancelledEvent.timestamp,
            type: cancelledEvent.type
          });
          return;
        }
      }

      // Call the actual implementation
      const result = await this.performExecute(...args);

      // Emit completion event
      const completeEvent = new CompleteEvent(`${this.constructor.name} completed successfully`, result);
      this.emit('complete', {
        message: completeEvent.message,
        result: completeEvent.result,
        data: completeEvent.details,
        timestamp: completeEvent.timestamp,
        type: completeEvent.type
      });

      return result;
    } catch (error) {
      this.error(`${this.constructor.name} failed`, error);
      throw error;
    }
  }

  /**
   * The actual execution logic that must be implemented by subclasses.
   * 
   * This abstract method contains the core command logic. Subclasses must
   * override this method to provide their specific functionality.
   * 
   * @abstract
   * @param {...*} args - Command-specific arguments
   * @returns {Promise<*>} Command execution result
   * @throws {Error} Must be implemented by subclass
   */
  // eslint-disable-next-line require-await
  async performExecute(..._args) {
    throw new Error('Command.performExecute() must be implemented by subclass');
  }

  /**
   * Prompts user to confirm production operation with safety warnings.
   * 
   * Displays warning about production environment and requests explicit
   * user confirmation before proceeding with potentially dangerous operations.
   * 
   * @returns {Promise<boolean>} True if user confirms, false otherwise
   * @private
   */
  async confirmProduction() {
    this.warn('Production operation requested!', {
      environment: 'PRODUCTION',
      command: this.constructor.name
    });

    return await this.confirm(
      'Are you sure you want to perform this operation in PRODUCTION?'
    );
  }

  /**
   * Emits a progress event with optional data payload.
   * 
   * Used to communicate ongoing operation status to event listeners,
   * typically for progress bars or status updates in CLI interfaces.
   * 
   * @param {string} message - Progress description
   * @param {Object} [data={}] - Additional progress data
   * @emits progress - Progress event with message and data
   */
  progress(message, data = {}) {
    const event = new ProgressEvent(message, null, data); // null percentage for indeterminate progress
    // Emit typed event - maintain existing event object structure for backward compatibility
    this.emit('progress', {
      message: event.message,
      data: event.details,
      timestamp: event.timestamp,
      type: event.type,
      percentage: event.percentage
    });
    this.logger.info({ ...data }, message);
  }

  /**
   * Emits a warning event for non-fatal issues.
   * 
   * Used to communicate potential problems or important information
   * that doesn't prevent command execution from continuing.
   * 
   * @param {string} message - Warning message
   * @param {Object} [data={}] - Additional warning context
   * @emits warning - Warning event with message and data
   */
  warn(message, data = {}) {
    const event = new WarningEvent(message, data);
    // Emit typed event - maintain existing event object structure for backward compatibility
    this.emit('warning', {
      message: event.message,
      data: event.details,
      timestamp: event.timestamp,
      type: event.type
    });
    this.logger.warn({ ...data }, message);
  }

  /**
   * Emits an error event for command failures.
   * 
   * Used to communicate command execution errors with full context
   * including error objects and additional debugging information.
   * 
   * @param {string} message - Error description
   * @param {Error|null} [error=null] - Error object with stack trace
   * @param {Object} [data={}] - Additional error context
   * @emits error - Error event with message, error object, and data
   */
  error(message, error = null, data = {}) {
    // Extract code from data if provided
    const code = data.code || error?.code || null;
    const event = new ErrorEvent(message, error, code, data);
    // Emit typed event - maintain existing event object structure for backward compatibility
    this.emit('error', {
      message: event.message,
      error: event.error,
      data: event.details,
      timestamp: event.timestamp,
      type: event.type
    });
    this.logger.error({ err: error, ...data }, message);
  }

  /**
   * Emits a success event for completed operations.
   * 
   * Used to communicate successful command execution with result data
   * for display in CLI interfaces or logging.
   * 
   * @param {string} message - Success message
   * @param {Object} [data={}] - Additional success data
   * @emits success - Success event with message and data
   */
  success(message, data = {}) {
    const event = new SuccessEvent(message, data);
    // Emit typed event - maintain existing event object structure for backward compatibility
    this.emit('success', {
      message: event.message,
      data: event.details,
      timestamp: event.timestamp,
      type: event.type
    });
    this.logger.info({ ...data }, message);
  }

  /**
   * Emits a prompt event and waits for user response.
   * 
   * Creates an interactive prompt that waits for user input through
   * the event system. Used by CLI interfaces for user interaction.
   * 
   * @param {string} type - Type of prompt (confirm, input, select, etc.)
   * @param {Object} options - Prompt configuration options
   * @returns {Promise<*>} User response value
   * @emits prompt - Prompt event with type, options, and resolve callback
   */
  prompt(type, options) {
    return new Promise((resolve) => {
      this.emit('prompt', { type, options, resolve });
    });
  }

  /**
   * Prompts user for yes/no confirmation.
   * 
   * Convenience method for boolean confirmation prompts with
   * optional default value handling.
   * 
   * @param {string} message - Confirmation question
   * @param {boolean} [defaultValue=false] - Default response if user presses enter
   * @returns {Promise<boolean>} True if confirmed, false otherwise
   */
  async confirm(message, defaultValue = false) {
    return await this.prompt('confirm', { message, default: defaultValue });
  }

  /**
   * Prompts user for text input.
   * 
   * Convenience method for text input prompts with optional
   * validation and default value handling.
   * 
   * @param {string} message - Input prompt message
   * @param {Object} [options={}] - Input options (default, validation, etc.)
   * @returns {Promise<string>} User input string
   */
  async input(message, options = {}) {
    return await this.prompt('input', { message, ...options });
  }

  /**
   * Validates an event object against expected class type using instanceof checks.
   * 
   * Provides runtime type validation for event objects to ensure they conform
   * to expected event class structures and contain required properties.
   * 
   * @param {Object} event - The event object to validate
   * @param {Function|null} [expectedClass=null] - Expected event class constructor for instanceof validation
   * @returns {Object} Validation result object
   * @returns {boolean} returns.success - True if validation passes
   * @returns {string|null} returns.error - Error message if validation fails, null if success
   * @example
   * const result = command.validateEvent(progressEvent, ProgressEvent);
   * if (!result.success) {
   *   console.error('Invalid event:', result.error);
   * }
   */
  validateEvent(event, expectedClass = null) {
    if (!expectedClass) {
      // If no specific class expected, just check if it has the basic event structure
      return {
        success: !!(event && event.type && event.message && event.timestamp),
        error: event && event.type && event.message && event.timestamp ? null : 'Invalid event structure'
      };
    }

    try {
      validateCommandEvent(event, expectedClass);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Emits a typed event with optional validation and automatic format conversion.
   * 
   * Provides event emission with runtime validation against expected class types
   * and automatic conversion of CommandEvent instances to the standard event format
   * required by the CLI interface for backward compatibility.
   * 
   * @param {string} eventName - The event name to emit
   * @param {Object} eventData - The event data or CommandEvent instance
   * @param {Function|null} [expectedClass=null] - Optional expected event class for instanceof validation
   * @emits eventName - The specified event with standardized format
   * @example
   * const progressEvent = new ProgressEvent('Processing...', 50);
   * command.emitTypedEvent('progress', progressEvent, ProgressEvent);
   */
  emitTypedEvent(eventName, eventData, expectedClass = null) {
    const validation = this.validateEvent(eventData, expectedClass);
    if (!validation.success) {
      this.logger.warn({ validationError: validation.error }, `Invalid event data for ${eventName}`);
      // Still emit the event for backward compatibility, but log the validation issue
    }

    // If eventData is a CommandEvent instance, convert it to the expected format
    if (eventData && typeof eventData.toJSON === 'function') {
      const jsonData = eventData.toJSON();
      this.emit(eventName, {
        message: jsonData.message,
        data: jsonData.details || {},
        timestamp: new Date(jsonData.timestamp),
        type: jsonData.type
      });
    } else {
      this.emit(eventName, eventData);
    }
  }
}

export { Command };
export default Command;
