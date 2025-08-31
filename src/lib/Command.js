/**
 * Base Command Class for Event-Driven Architecture
 */

const { EventEmitter } = require("events");
const pino = require("pino");
const {
  ProgressEvent,
  WarningEvent,
  ErrorEvent,
  SuccessEvent,
  StartEvent,
  CompleteEvent,
  CancelledEvent,
  validateCommandEvent,
} = require("./events/CommandEvents.js");

/**
 * Base command class that all commands extend from
 */
class Command extends EventEmitter {
  constructor(
    legacyConfig = null, // Config class instance is OK - it's a typed class
    logger = null,
    isProd = false,
    outputConfig = null, // OutputConfig class instance for paths
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
   * Create a default pino logger
   */
  createLogger() {
    const isDev = process.env.NODE_ENV !== "production";

    return pino({
      level: this.config?.get ? this.config.get("logging.level") : "info",
      transport: isDev
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    });
  }

  /**
   * Execute the command with production safety check
   */
  async execute(...args) {
    // Emit start event
    const startEvent = new StartEvent(`Starting ${this.constructor.name}`, {
      isProd: this.isProd,
    });
    this.emit("start", {
      message: startEvent.message,
      data: startEvent.details,
      timestamp: startEvent.timestamp,
      type: startEvent.type,
      isProd: this.isProd,
    });

    try {
      // Check for production confirmation if needed
      if (this.isProd && this.requiresProductionConfirmation) {
        const confirmed = await this.confirmProduction();
        if (!confirmed) {
          this.success("Operation cancelled");
          const cancelledEvent = new CancelledEvent("Operation cancelled");
          this.emit("cancelled", {
            message: cancelledEvent.message,
            data: cancelledEvent.details,
            timestamp: cancelledEvent.timestamp,
            type: cancelledEvent.type,
          });
          return;
        }
      }

      // Call the actual implementation
      const result = await this.performExecute(...args);

      // Emit completion event
      const completeEvent = new CompleteEvent(
        `${this.constructor.name} completed successfully`,
        result,
      );
      this.emit("complete", {
        message: completeEvent.message,
        result: completeEvent.result,
        data: completeEvent.details,
        timestamp: completeEvent.timestamp,
        type: completeEvent.type,
      });

      return result;
    } catch (error) {
      this.error(`${this.constructor.name} failed`, error);
      throw error;
    }
  }

  /**
   * The actual execution logic - must be overridden by subclasses
   */
  // eslint-disable-next-line require-await
  async performExecute(..._args) {
    throw new Error("Command.performExecute() must be implemented by subclass");
  }

  /**
   * Confirm production operation
   */
  async confirmProduction() {
    this.warn("Production operation requested!", {
      environment: "PRODUCTION",
      command: this.constructor.name,
    });

    return await this.confirm(
      "Are you sure you want to perform this operation in PRODUCTION?",
    );
  }

  /**
   * Emit a progress event
   */
  progress(message, data = {}) {
    const event = new ProgressEvent(message, null, data); // null percentage for indeterminate progress
    // Emit typed event - maintain existing event object structure for backward compatibility
    this.emit("progress", {
      message: event.message,
      data: event.details,
      timestamp: event.timestamp,
      type: event.type,
      percentage: event.percentage,
    });
    this.logger.info({ ...data }, message);
  }

  /**
   * Emit a warning event
   */
  warn(message, data = {}) {
    const event = new WarningEvent(message, data);
    // Emit typed event - maintain existing event object structure for backward compatibility
    this.emit("warning", {
      message: event.message,
      data: event.details,
      timestamp: event.timestamp,
      type: event.type,
    });
    this.logger.warn({ ...data }, message);
  }

  /**
   * Emit an error event
   */
  error(message, error = null, data = {}) {
    // Extract code from data if provided
    const code = data.code || error?.code || null;
    const event = new ErrorEvent(message, error, code, data);
    // Emit typed event - maintain existing event object structure for backward compatibility
    this.emit("error", {
      message: event.message,
      error: event.error,
      data: event.details,
      timestamp: event.timestamp,
      type: event.type,
    });
    this.logger.error({ err: error, ...data }, message);
  }

  /**
   * Emit a success event
   */
  success(message, data = {}) {
    const event = new SuccessEvent(message, data);
    // Emit typed event - maintain existing event object structure for backward compatibility
    this.emit("success", {
      message: event.message,
      data: event.details,
      timestamp: event.timestamp,
      type: event.type,
    });
    this.logger.info({ ...data }, message);
  }

  /**
   * Emit a prompt event and wait for response
   */
  prompt(type, options) {
    return new Promise((resolve) => {
      this.emit("prompt", { type, options, resolve });
    });
  }

  /**
   * Emit a confirmation event and wait for response
   */
  async confirm(message, defaultValue = false) {
    return await this.prompt("confirm", { message, default: defaultValue });
  }

  /**
   * Emit an input event and wait for response
   */
  async input(message, options = {}) {
    return await this.prompt("input", { message, ...options });
  }

  /**
   * Validate an event against expected class type
   * @param {Object} event - The event object to validate
   * @param {Function} expectedClass - Expected event class constructor
   * @returns {Object} Validation result with success/error properties
   */
  validateEvent(event, expectedClass = null) {
    if (!expectedClass) {
      // If no specific class expected, just check if it has the basic event structure
      return {
        success: !!(event && event.type && event.message && event.timestamp),
        error:
          event && event.type && event.message && event.timestamp
            ? null
            : "Invalid event structure",
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
   * Emit a typed event with validation
   * @param {string} eventName - The event name
   * @param {Object} eventData - The event data or event instance
   * @param {Function} expectedClass - Optional expected event class for validation
   */
  emitTypedEvent(eventName, eventData, expectedClass = null) {
    const validation = this.validateEvent(eventData, expectedClass);
    if (!validation.success) {
      this.logger.warn(
        { validationError: validation.error },
        `Invalid event data for ${eventName}`,
      );
      // Still emit the event for backward compatibility, but log the validation issue
    }

    // If eventData is a CommandEvent instance, convert it to the expected format
    if (eventData && typeof eventData.toJSON === "function") {
      const jsonData = eventData.toJSON();
      this.emit(eventName, {
        message: jsonData.message,
        data: jsonData.details || {},
        timestamp: new Date(jsonData.timestamp),
        type: jsonData.type,
      });
    } else {
      this.emit(eventName, eventData);
    }
  }
}

module.exports = Command;
