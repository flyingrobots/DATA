#!/usr/bin/env node

/**
 * D.A.T.A. CLI Entry Point
 * 
 * Simple executable that imports and runs the CLI
 */

import { cli } from '../src/index.js';

// Run CLI with process arguments
cli(process.argv).catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});