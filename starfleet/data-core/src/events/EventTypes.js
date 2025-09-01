/**
 * EventTypes - Core event type definitions
 * No Node EventEmitter dependency - pure constants
 */

export const Events = {
  // Migration events
  MIGRATION_PLAN_STARTED: 'migration.plan.started',
  MIGRATION_PLAN_STEP: 'migration.plan.step',
  MIGRATION_PLAN_READY: 'migration.plan.ready',
  MIGRATION_APPLY_STARTED: 'migration.apply.started',
  MIGRATION_APPLY_STEP: 'migration.apply.step',
  MIGRATION_APPLY_DONE: 'migration.apply.done',
  MIGRATION_ROLLBACK_STARTED: 'migration.rollback.started',
  MIGRATION_ROLLBACK_DONE: 'migration.rollback.done',

  // Safety gate events
  SAFETY_CHECKS_STARTED: 'safety.checks.started',
  SAFETY_CHECK_ITEM: 'safety.check.item',
  SAFETY_CHECKS_RESULT: 'safety.checks.result',

  // Compilation events
  COMPILE_STARTED: 'compile.started',
  COMPILE_FILE: 'compile.file',
  COMPILE_DONE: 'compile.done',

  // Test events
  TEST_RUN_STARTED: 'test.run.started',
  TEST_FILE: 'test.file',
  TEST_PASSED: 'test.passed',
  TEST_FAILED: 'test.failed',
  TEST_RUN_DONE: 'test.run.done',

  // Coverage events
  COVERAGE_STARTED: 'coverage.started',
  COVERAGE_COMPUTED: 'coverage.computed',
  COVERAGE_DONE: 'coverage.done',

  // Function deployment events
  FUNCTION_DEPLOY_STARTED: 'function.deploy.started',
  FUNCTION_VALIDATE: 'function.validate',
  FUNCTION_DEPLOY_DONE: 'function.deploy.done',

  // Generic command events
  COMMAND_STARTED: 'command.started',
  COMMAND_PROGRESS: 'command.progress',
  COMMAND_WARNING: 'command.warning',
  COMMAND_ERROR: 'command.error',
  COMMAND_SUCCESS: 'command.success',
  COMMAND_DONE: 'command.done'
};
