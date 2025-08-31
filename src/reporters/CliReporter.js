/**
 * CLI Reporter for Command Events
 */

const chalk = require("chalk");
const inquirer = require("inquirer");
const { CommandEvent, ErrorEvent } = require("../lib/events/CommandEvents");

/**
 * Reporter that listens to command events and displays CLI output
 */
class CliReporter {
  constructor(silent = false) {
    this.silent = silent;
  }

  /**
   * Attach to a command and listen for events
   */
  attach(command) {
    // Progress events
    command.on("progress", (eventData) => {
      if (!this.silent) {
        const message = this._extractMessage(eventData);
        if (message) {
          console.log(chalk.blue(`🔄 ${message}`));
        }
      }
    });

    // Warning events
    command.on("warning", (eventData) => {
      if (!this.silent) {
        const message = this._extractMessage(eventData);
        const data = this._extractData(eventData);

        if (message) {
          console.log(chalk.yellow.bold(`\n⚠️  WARNING: ${message}\n`));

          if (data && data.actions) {
            console.log(chalk.yellow("This will:"));
            data.actions.forEach((action) => {
              console.log(chalk.yellow(`  • ${action}`));
            });
            console.log(chalk.yellow("\nThis action cannot be undone!\n"));
          }
        }
      }
    });

    // Error events
    command.on("error", (eventData) => {
      if (!this.silent) {
        const message = this._extractMessage(eventData);
        const error = this._extractError(eventData);

        if (message) {
          console.error(chalk.red(`✗ ${message}`));
        }
        if (error && error.message) {
          console.error(chalk.red(error.message));
        }
      }
    });

    // Success events
    command.on("success", (eventData) => {
      if (!this.silent) {
        const message = this._extractMessage(eventData);
        if (message) {
          console.log(chalk.green(`✓ ${message}`));
        }
      }
    });

    // Prompt events
    command.on("prompt", async ({ type, options, resolve }) => {
      if (this.silent) {
        // In silent mode, use defaults
        resolve(options.default || false);
        return;
      }

      try {
        if (type === "confirm") {
          const { result } = await inquirer.prompt([
            {
              type: "confirm",
              name: "result",
              message: options.message,
              default: options.default || false,
            },
          ]);
          resolve(result);
        } else if (type === "input") {
          const { result } = await inquirer.prompt([
            {
              type: "input",
              name: "result",
              message: options.message,
              validate: options.validate,
              default: options.default,
            },
          ]);
          resolve(result);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });

    // Command-specific events
    command.on("start", (eventData) => {
      if (!this.silent) {
        const isProd = this._extractIsProd(eventData);
        if (isProd) {
          console.log(chalk.red.bold("\n🚨 PRODUCTION MODE 🚨\n"));
        }
      }
    });

    command.on("cancelled", () => {
      if (!this.silent) {
        console.log(chalk.gray("\nOperation cancelled by user\n"));
      }
    });

    command.on("complete", () => {
      if (!this.silent) {
        console.log(
          chalk.green.bold("\n✨ Operation completed successfully!\n"),
        );
      }
    });

    command.on("output", (eventData) => {
      if (!this.silent && process.env.VERBOSE) {
        const stdout = this._extractStdout(eventData);
        if (stdout) {
          console.log(chalk.gray(stdout));
        }
      }
    });
  }

  /**
   * Extract message from event data (handles both legacy and typed events)
   * @private
   */
  _extractMessage(eventData) {
    // Handle typed CommandEvent instances
    if (eventData instanceof CommandEvent) {
      return eventData.message;
    }

    // Handle legacy event objects
    if (eventData && typeof eventData === "object") {
      return eventData.message;
    }

    // Handle simple string messages
    if (typeof eventData === "string") {
      return eventData;
    }

    return null;
  }

  /**
   * Extract data from event data (handles both legacy and typed events)
   * @private
   */
  _extractData(eventData) {
    // Handle typed CommandEvent instances
    if (eventData instanceof CommandEvent) {
      // Return all properties except the standard ones
      const {
        eventType: _eventType,
        timestamp: _timestamp,
        message: _message,
        ...data
      } = eventData;
      return Object.keys(data).length > 0 ? data : null;
    }

    // Handle legacy event objects
    if (eventData && typeof eventData === "object") {
      return eventData.data || eventData;
    }

    return null;
  }

  /**
   * Extract error from event data (handles both legacy and typed events)
   * @private
   */
  _extractError(eventData) {
    // Handle typed ErrorEvent instances
    if (eventData instanceof ErrorEvent) {
      return eventData.error;
    }

    // Handle legacy event objects
    if (eventData && typeof eventData === "object") {
      return eventData.error;
    }

    return null;
  }

  /**
   * Extract isProd flag from event data (handles both legacy and typed events)
   * @private
   */
  _extractIsProd(eventData) {
    // Handle typed CommandEvent instances
    if (eventData instanceof CommandEvent) {
      return eventData.isProd || false;
    }

    // Handle legacy event objects
    if (eventData && typeof eventData === "object") {
      return eventData.isProd || false;
    }

    return false;
  }

  /**
   * Extract stdout from event data (handles both legacy and typed events)
   * @private
   */
  _extractStdout(eventData) {
    // Handle typed CommandEvent instances
    if (eventData instanceof CommandEvent) {
      return eventData.stdout;
    }

    // Handle legacy event objects
    if (eventData && typeof eventData === "object") {
      return eventData.stdout;
    }

    return null;
  }
}

module.exports = CliReporter;
