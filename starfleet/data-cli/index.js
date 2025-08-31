/**
 * D.A.T.A. CLI Main Module
 * 
 * Provides the command-line interface for database automation,
 * testing, and alignment operations.
 */

import { Command } from 'commander';
import { DataCore } from '@data/core';
import { createNodeAdapters } from '@data/host-node';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { version } = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

/**
 * Main CLI function
 * @param {string[]} argv - Command line arguments
 */
export async function cli(argv) {
  const program = new Command();
  
  program
    .name('data')
    .description('⛰️ D.A.T.A. - Database Automation, Testing & Alignment')
    .version(version)
    .option('--prod', 'Target production environment')
    .option('--json', 'Output results as JSON')
    .option('--no-color', 'Disable colored output');

  // Initialize command
  program
    .command('init')
    .description('Initialize a new D.A.T.A. project')
    .option('--path <path>', 'Project path (default: current directory)')
    .action(async (options) => {
      console.log('Initializing D.A.T.A. project...');
      // TODO: Implement init command using DataCore
    });

  // Database commands
  const db = program
    .command('db')
    .description('Database operations');

  db.command('compile')
    .description('Compile SQL sources into migration')
    .option('--sql-dir <path>', 'SQL source directory', './sql')
    .option('--migrations-dir <path>', 'Migrations output directory', './migrations')
    .action(async (options) => {
      const adapters = createNodeAdapters();
      const dataCore = new DataCore(adapters);
      
      try {
        console.log('Compiling SQL sources...');
        // TODO: Implement compile using DataCore
      } catch (error) {
        console.error('Compilation failed:', error.message);
        process.exit(1);
      }
    });

  // Test commands
  const test = program
    .command('test')
    .description('Testing operations');

  test.command('run')
    .description('Run database tests')
    .option('--pattern <pattern>', 'Test pattern to match')
    .action(async (options) => {
      console.log('Running tests...');
      // TODO: Implement test runner using DataCore
    });

  // Parse arguments
  await program.parseAsync(argv);
  
  // Show help if no command provided
  if (argv.length === 2) {
    program.help();
  }
}

export default cli;