/**
 * Domain Types - Core business types with JSDoc
 * Pure type definitions - no implementation
 */

/**
 * @typedef {Object} MigrationStep
 * @property {string} id - Unique identifier (hash of SQL content)
 * @property {string} path - Source file path
 * @property {string} sql - SQL content
 * @property {string} checksum - Content checksum
 */

/**
 * @typedef {Object} MigrationPlan
 * @property {MigrationStep[]} steps - Ordered migration steps
 * @property {string} preview - Human-readable preview
 * @property {string} checksum - Plan checksum
 * @property {number} timestamp - Creation timestamp (ms)
 * @property {string} name - Migration name
 */

/**
 * @typedef {Object} MigrationResult
 * @property {number} applied - Number of steps applied
 * @property {boolean} dryRun - Whether this was a dry run
 * @property {number} duration - Execution time in ms
 * @property {boolean} success - Whether migration succeeded
 * @property {Array<{step: string, error: string}>} [errors] - Any errors encountered
 */

/**
 * @typedef {Object} SafetyGatePolicy
 * @property {boolean} [requireClean] - Require clean working tree
 * @property {string[]} [allowedBranches] - List of allowed branch names
 * @property {boolean} [requireTests] - Require tests to pass
 * @property {string[]} [testGlobs] - Test file patterns
 * @property {boolean} [requireUpToDate] - Require branch up to date with remote
 */

/**
 * @typedef {Object} SafetyGateResult
 * @property {boolean} passed - Whether all checks passed
 * @property {string[]} failures - List of failed check names
 * @property {Object} details - Detailed check results
 */

/**
 * @typedef {Object} CompilationOptions
 * @property {string} sqlRoot - Root directory for SQL files
 * @property {string} outputDir - Output directory for compiled files
 * @property {boolean} [minify] - Whether to minify output
 * @property {boolean} [sourceMaps] - Whether to generate source maps
 */

/**
 * @typedef {Object} TestRunOptions
 * @property {string[]} patterns - Test file patterns
 * @property {number} [timeout] - Test timeout in ms
 * @property {boolean} [coverage] - Whether to collect coverage
 * @property {string} [reporter] - Output format (tap, json, junit)
 */

/**
 * @typedef {Object} TestResult
 * @property {number} passed - Number of passed tests
 * @property {number} failed - Number of failed tests
 * @property {number} total - Total number of tests
 * @property {number} duration - Test run duration in ms
 * @property {string[]} failures - Failed test descriptions
 * @property {Object} [coverage] - Coverage data if collected
 */

/**
 * @typedef {Object} DeploymentOptions
 * @property {string} environment - Target environment (dev, staging, prod)
 * @property {boolean} [dryRun] - Whether to do a dry run
 * @property {string[]} [functions] - Specific functions to deploy
 * @property {boolean} [skipValidation] - Skip validation checks
 */

/**
 * @typedef {Object} DeploymentResult
 * @property {boolean} success - Whether deployment succeeded
 * @property {string[]} deployed - List of deployed resources
 * @property {string[]} skipped - List of skipped resources
 * @property {Object} [errors] - Any errors encountered
 */

// Export as frozen enums for safety
export const MigrationStatus = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  APPLIED: 'applied',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back'
});

export const Environment = Object.freeze({
  LOCAL: 'local',
  DEV: 'dev',
  STAGING: 'staging',
  PROD: 'prod'
});

export const TestReporter = Object.freeze({
  TAP: 'tap',
  JSON: 'json',
  JUNIT: 'junit',
  CONSOLE: 'console'
});
