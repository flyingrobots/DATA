#!/usr/bin/env node

/**
 * D.A.T.A. CLI - Database Automation, Testing, and Alignment
 *
 * 🖖 "Computer, prepare for database operations."
 * Provides safe, powerful database management for local and production environments
 */

// Typed testing error handler (instanceof → exit codes + structured logs)
const { handleTestingError } = require("../src/lib/testing/handleTestingError");

// Route all top-level failures through the typed handler
process.on("unhandledRejection", (err) => {
  handleTestingError(err, console);
  process.exit(process.exitCode ?? 1);
});

process.on("uncaughtException", (err) => {
  handleTestingError(err, console);
  process.exit(process.exitCode ?? 1);
});

// Load environment variables
require("dotenv").config();

// Import the main CLI
const { cli } = require("../src/index");

// Run the CLI with process arguments (typed-error aware)
(async () => {
  try {
    await cli(process.argv);
  } catch (err) {
    handleTestingError(err, console);
    process.exit(process.exitCode ?? 1);
  }
})();
