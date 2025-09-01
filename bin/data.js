#!/usr/bin/env node

/**
 * D.A.T.A. CLI - Database Automation, Testing, and Alignment
 *
 * 🖖 "Computer, prepare for database operations."
 * Provides safe, powerful database management for local and production environments
 */

// Enable better error messages
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
  process.exit(1);
});

// Load environment variables
import { config } from 'dotenv';
config();

// Import the main CLI
import { cli } from '../src/index.js';

// Run the CLI with process arguments
cli(process.argv).catch((error) => {
  console.error('Fatal error:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});
