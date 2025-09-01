/**
 * Composition Root - Wire all dependencies together
 * This is the ONLY place where we instantiate adapters and wire dependencies
 */

import { ensurePort } from '@starfleet/data-core/ports/ensurePort.js';
import { Events } from '@starfleet/data-core/events/EventTypes.js';
import { makeGenerateMigrationPlan } from '@starfleet/data-core/application/GenerateMigrationPlan.js';
import { makeApplyMigrationPlan } from '@starfleet/data-core/application/ApplyMigrationPlan.js';
import { makeVerifySafetyGates } from '@starfleet/data-core/application/VerifySafetyGates.js';

import { FileSystemAdapter } from '@starfleet/data-host-node/adapters/FileSystemAdapter.js';
import { GlobAdapter } from '@starfleet/data-host-node/adapters/GlobAdapter.js';
import { ClockAdapter } from '@starfleet/data-host-node/adapters/ClockAdapter.js';
import { EnvironmentAdapter } from '@starfleet/data-host-node/adapters/EnvironmentAdapter.js';
import { LoggerConsoleAdapter } from '@starfleet/data-host-node/adapters/LoggerConsoleAdapter.js';
import { EventBusNodeAdapter } from '@starfleet/data-host-node/adapters/EventBusNodeAdapter.js';
import { GitPortNodeAdapter } from '@starfleet/data-host-node/adapters/GitPortNodeAdapter.js';
import { DbPortNodeAdapter } from '@starfleet/data-host-node/adapters/DbPortNodeAdapter.js';
import { ProcessPortNodeAdapter } from '@starfleet/data-host-node/adapters/ProcessPortNodeAdapter.js';
import { CryptoPortNodeAdapter } from '@starfleet/data-host-node/adapters/CryptoPortNodeAdapter.js';

import { attachCliReporter } from '../reporters/attachCliReporter.js';

/**
 * Build and wire all services
 * @param {Object} [config] - Optional configuration
 * @param {string} [config.databaseUrl] - Database connection string
 * @param {boolean} [config.debug] - Enable debug logging
 * @returns {Object} Services container
 */
export function buildServices(config = {}) {
  // Get database URL from config or environment
  const databaseUrl =
    config.databaseUrl || process.env.DATABASE_URL || process.env.DATA_DATABASE_URL;

  // Instantiate adapters with runtime validation
  const fs = ensurePort('FileSystemPort', FileSystemAdapter, [
    'readFile',
    'writeFile',
    'exists',
    'mkdirp',
    'rm',
    'readdir',
    'stat'
  ]);

  const glob = ensurePort('GlobPort', GlobAdapter, ['find']);

  const clock = ensurePort('ClockPort', ClockAdapter, ['now', 'nowMs']);

  const env = ensurePort('EnvironmentPort', EnvironmentAdapter, ['get', 'has']);

  const git = ensurePort('GitPort', new GitPortNodeAdapter(), [
    'status',
    'tag',
    'latestTag',
    'revParse'
  ]);

  const db = ensurePort('DbPort', new DbPortNodeAdapter(databaseUrl), [
    'apply',
    'query',
    'runPgTap',
    'withTransaction'
  ]);

  const proc = ensurePort('ProcessPort', new ProcessPortNodeAdapter(), [
    'spawn',
    'exec',
    'exit',
    'cwd',
    'chdir',
    'which'
  ]);

  const crypto = ensurePort('CryptoPort', new CryptoPortNodeAdapter(), [
    'hash',
    'randomUUID',
    'randomBytes',
    'timingSafeEqual'
  ]);

  // Logger with context bindings
  const logger = ensurePort(
    'LoggerPort',
    new LoggerConsoleAdapter({
      service: 'data-cli',
      version: '1.0.0'
    }),
    ['info', 'warn', 'error', 'debug', 'child']
  );

  // Event bus for decoupled communication
  const bus = new EventBusNodeAdapter();

  // Wire up use-cases with dependencies
  const generateMigrationPlan = makeGenerateMigrationPlan({
    fs,
    glob,
    crypto,
    logger,
    clock,
    bus
  });

  const applyMigrationPlan = makeApplyMigrationPlan({
    db,
    logger,
    clock,
    bus
  });

  const verifySafetyGates = makeVerifySafetyGates({
    git,
    db,
    logger,
    bus
  });

  // Attach CLI reporter for formatted output
  attachCliReporter({ bus, logger });

  // Return service container
  return {
    // Ports for direct access when needed
    ports: {
      fs,
      glob,
      clock,
      env,
      git,
      db,
      proc,
      crypto,
      logger,
      bus
    },

    // Use-cases for business logic
    useCases: {
      generateMigrationPlan,
      applyMigrationPlan,
      verifySafetyGates
    },

    // Cleanup function
    async shutdown() {
      await db.close?.();
    }
  };
}
