/**
 * VerifySafetyGates - Pure use-case for verifying safety gates
 * No I/O, no Node dependencies - only uses injected ports
 */
import { Events } from '../events/index.js';

/**
 * Factory for VerifySafetyGates use-case
 * @param {Object} deps - Dependencies
 * @param {import('../ports/GitPort.js').GitPort} deps.git
 * @param {import('../ports/DbPort.js').DbPort} deps.db
 * @param {import('../ports/LoggerPort.js').LoggerPort} deps.logger
 * @param {import('../ports/EventBusPort.js').EventBusPort} deps.bus
 */
export function makeVerifySafetyGates({ git, db, logger, bus }) {
  return {
    /**
     * Execute safety gate verification
     * @param {Object} policy - Safety gate policy
     * @param {boolean} [policy.requireClean] - Require clean working tree
     * @param {string[]} [policy.allowedBranches] - List of allowed branches
     * @param {boolean} [policy.requireTests] - Require tests to pass
     * @param {string[]} [policy.testGlobs] - Test file patterns
     * @param {boolean} [policy.requireUpToDate] - Require branch up to date with remote
     * @returns {Promise<{passed: boolean, failures: string[], details: Object}>}
     */
    async execute(policy) {
      bus.emit(Events.SAFETY_CHECKS_STARTED, { policy });

      const failures = [];
      const details = {};

      // Check working tree cleanliness
      if (policy.requireClean) {
        const { clean, modified, untracked } = await git.status();
        details.workingTree = { clean, modified, untracked };

        if (!clean) {
          failures.push('working_tree_dirty');
          logger.warn({ modified, untracked }, 'Working tree is not clean');
        }

        bus.emit(Events.SAFETY_CHECK_ITEM, {
          check: 'working_tree',
          passed: clean
        });
      }

      // Check branch restrictions
      if (policy.allowedBranches?.length > 0) {
        const { branch } = await git.status();
        details.branch = { current: branch, allowed: policy.allowedBranches };

        const branchAllowed = policy.allowedBranches.includes(branch);
        if (!branchAllowed) {
          failures.push('branch_not_allowed');
          logger.warn({ branch, allowed: policy.allowedBranches }, 'Branch not in allowed list');
        }

        bus.emit(Events.SAFETY_CHECK_ITEM, {
          check: 'branch_policy',
          passed: branchAllowed
        });
      }

      // Check if branch is up to date with remote
      if (policy.requireUpToDate) {
        const { behind, ahead } = await git.status();
        details.remote = { behind, ahead };

        const upToDate = behind === 0;
        if (!upToDate) {
          failures.push('branch_behind_remote');
          logger.warn({ behind, ahead }, 'Branch is behind remote');
        }

        bus.emit(Events.SAFETY_CHECK_ITEM, {
          check: 'up_to_date',
          passed: upToDate
        });
      }

      // Run tests if required
      if (policy.requireTests) {
        const testGlobs = policy.testGlobs || ['test/pgtap/**/*.sql'];
        logger.info({ patterns: testGlobs }, 'Running tests');

        const testResult = await db.runPgTap(testGlobs);
        details.tests = testResult;

        const testsPass = testResult.failed === 0;
        if (!testsPass) {
          failures.push('tests_failed');
          logger.error({
            failed: testResult.failed,
            total: testResult.total,
            failures: testResult.failures
          }, 'Tests failed');
        }

        bus.emit(Events.SAFETY_CHECK_ITEM, {
          check: 'tests',
          passed: testsPass,
          details: testResult
        });
      }

      const passed = failures.length === 0;

      bus.emit(Events.SAFETY_CHECKS_RESULT, {
        passed,
        failures,
        details
      });

      return {
        passed,
        failures,
        details
      };
    }
  };
}
