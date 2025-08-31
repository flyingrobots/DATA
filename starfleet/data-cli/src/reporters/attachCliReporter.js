/**
 * CLI Reporter - Attaches event listeners to format output for terminal
 * Separated from container to keep composition root clean
 */

import { Events } from '@starfleet/data-core/events/EventTypes.js';

/**
 * Attach CLI reporter event handlers
 * @param {Object} deps - Dependencies
 * @param {import('@starfleet/data-core/ports/EventBusPort.js').EventBusPort} deps.bus - Event bus
 * @param {import('@starfleet/data-core/ports/LoggerPort.js').LoggerPort} deps.logger - Logger
 */
export function attachCliReporter({ bus, logger }) {
  // Migration plan events
  bus.on(Events.MIGRATION_PLAN_STARTED, (payload) => {
    logger.info(payload, '🔍 Analyzing SQL files...');
  });
  
  bus.on(Events.MIGRATION_PLAN_STEP, (payload) => {
    logger.debug(payload, `  Processing: ${payload.path}`);
  });
  
  bus.on(Events.MIGRATION_PLAN_READY, (payload) => {
    logger.info(payload, `✅ Migration plan ready (${payload.count} files)`);
  });
  
  // Migration apply events
  bus.on(Events.MIGRATION_APPLY_STARTED, (payload) => {
    const mode = payload.dryRun ? '🧪 Dry run' : '🚀 Applying';
    logger.info(payload, `${mode} migration (${payload.steps} steps)`);
  });
  
  bus.on(Events.MIGRATION_APPLY_STEP, (payload) => {
    logger.info(payload, `  [${payload.index}/${payload.total}] ${payload.path}`);
  });
  
  bus.on(Events.MIGRATION_APPLY_DONE, (payload) => {
    if (payload.failed) {
      logger.error(payload, '❌ Migration failed');
    } else {
      logger.info(payload, `✅ Migration complete (${payload.applied} applied)`);
    }
  });

  // Safety gate events
  bus.on(Events.SAFETY_CHECKS_STARTED, (payload) => {
    logger.info(payload, '🔒 Verifying safety gates...');
  });
  
  bus.on(Events.SAFETY_CHECK_ITEM, (payload) => {
    const icon = payload.passed ? '✅' : '❌';
    logger.info(payload, `  ${icon} ${payload.check}`);
  });
  
  bus.on(Events.SAFETY_CHECKS_RESULT, (payload) => {
    if (payload.passed) {
      logger.info(payload, '✅ All safety checks passed');
    } else {
      logger.warn(payload, `⚠️  Safety checks failed: ${payload.failures.join(', ')}`);
    }
  });

  // Compilation events
  bus.on(Events.COMPILE_STARTED, (payload) => {
    logger.info(payload, '🔨 Starting compilation...');
  });

  bus.on(Events.COMPILE_FILE, (payload) => {
    logger.debug(payload, `  Compiling: ${payload.file}`);
  });

  bus.on(Events.COMPILE_DONE, (payload) => {
    logger.info(payload, '✅ Compilation complete');
  });

  // Test events
  bus.on(Events.TEST_RUN_STARTED, (payload) => {
    logger.info(payload, '🧪 Running tests...');
  });

  bus.on(Events.TEST_PASSED, (payload) => {
    logger.debug(payload, `  ✅ ${payload.test}`);
  });

  bus.on(Events.TEST_FAILED, (payload) => {
    logger.error(payload, `  ❌ ${payload.test}`);
  });

  bus.on(Events.TEST_RUN_DONE, (payload) => {
    const icon = payload.failed === 0 ? '✅' : '❌';
    logger.info(payload, `${icon} Tests: ${payload.passed}/${payload.total} passed`);
  });

  // Generic command events
  bus.on(Events.COMMAND_PROGRESS, (payload) => {
    logger.info(payload, payload.message || 'Processing...');
  });

  bus.on(Events.COMMAND_WARNING, (payload) => {
    logger.warn(payload, `⚠️  ${payload.message}`);
  });

  bus.on(Events.COMMAND_ERROR, (payload) => {
    logger.error(payload, `❌ ${payload.message}`);
  });

  bus.on(Events.COMMAND_SUCCESS, (payload) => {
    logger.info(payload, `✅ ${payload.message}`);
  });
}