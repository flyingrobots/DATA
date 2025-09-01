/**
 * ApplyMigrationPlan - Pure use-case for applying migration plans
 * No I/O, no Node dependencies - only uses injected ports
 */
import { Events } from '../events/index.js';

/**
 * Factory for ApplyMigrationPlan use-case
 * @param {Object} deps - Dependencies
 * @param {import('../ports/DbPort.js').DbPort} deps.db
 * @param {import('../ports/LoggerPort.js').LoggerPort} deps.logger
 * @param {import('../ports/ClockPort.js').ClockPort} deps.clock
 * @param {import('../ports/EventBusPort.js').EventBusPort} deps.bus
 */
export function makeApplyMigrationPlan({ db, logger, clock, bus }) {
  return {
    /**
     * Execute migration plan application
     * @param {Object} input
     * @param {Object} input.plan - Migration plan to apply
     * @param {Array} input.plan.steps - Migration steps
     * @param {boolean} [input.dryRun] - Whether to do a dry run
     * @returns {Promise<{applied: number, dryRun: boolean, duration: number}>}
     */
    async execute({ plan, dryRun = false }) {
      const startTime = clock.nowMs();

      bus.emit(Events.MIGRATION_APPLY_STARTED, {
        at: clock.now(),
        dryRun,
        steps: plan.steps.length,
        name: plan.name
      });

      if (dryRun) {
        logger.info({ steps: plan.steps.length }, 'Dry run - no changes will be applied');
        return {
          applied: 0,
          dryRun: true,
          duration: clock.nowMs() - startTime
        };
      }

      let applied = 0;
      const errors = [];

      try {
        // Run all migrations in a transaction
        await db.withTransaction(async (tx) => {
          for (const step of plan.steps) {
            bus.emit(Events.MIGRATION_APPLY_STEP, {
              id: step.id,
              path: step.path,
              index: applied + 1,
              total: plan.steps.length
            });

            try {
              await tx.apply(step.sql);
              applied++;
              logger.debug({ path: step.path, id: step.id }, 'Applied migration step');
            } catch (error) {
              logger.error({ path: step.path, error: error.message }, 'Failed to apply migration step');
              errors.push({ step: step.path, error: error.message });
              throw error; // This will rollback the transaction
            }
          }
        });

        bus.emit(Events.MIGRATION_APPLY_DONE, {
          at: clock.now(),
          applied,
          duration: clock.nowMs() - startTime
        });

        return {
          applied,
          dryRun: false,
          duration: clock.nowMs() - startTime,
          success: true
        };
      } catch (error) {
        bus.emit(Events.MIGRATION_APPLY_DONE, {
          at: clock.now(),
          applied,
          failed: true,
          error: error.message,
          duration: clock.nowMs() - startTime
        });

        return {
          applied,
          dryRun: false,
          duration: clock.nowMs() - startTime,
          success: false,
          errors
        };
      }
    }
  };
}
