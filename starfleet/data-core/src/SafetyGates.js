/**
 * SafetyGates.js - Production Safety Gate Business Rules
 *
 * Pure business logic for safety gate validation rules and policies.
 * No process, filesystem, or I/O dependencies - only validation rules.
 */

/**
 * Business rules and validation logic for production safety gates
 */
export class SafetyGateRules {
  constructor(options = {}) {
    this.options = {
      gitEnabled: true,
      branchValidation: true,
      testValidation: true,
      confirmationRequired: true,
      coverageThreshold: 80,
      ...options
    };
  }

  /**
   * Validate safety gate configuration
   * @param {Object} config - Gate configuration
   * @returns {Object} Validation result
   */
  validateGateConfig(config = {}) {
    const errors = [];
    const warnings = [];

    // Required fields validation
    if (!config.operation || typeof config.operation !== 'string') {
      errors.push('Operation name is required');
    }

    // Coverage threshold validation
    if (config.coverageThreshold !== undefined) {
      if (typeof config.coverageThreshold !== 'number' ||
          config.coverageThreshold < 0 ||
          config.coverageThreshold > 100) {
        errors.push('Coverage threshold must be a number between 0 and 100');
      }
    }

    // Branch name validation
    if (config.expectedBranch && typeof config.expectedBranch !== 'string') {
      errors.push('Expected branch must be a string');
    }

    // Confirmation message validation
    if (config.confirmationMessage && typeof config.confirmationMessage !== 'string') {
      errors.push('Confirmation message must be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Determine which gates should be enabled based on configuration
   * @param {Object} config - Gate configuration
   * @param {boolean} force - Force bypass flag
   * @returns {Object} Gate execution plan
   */
  createGateExecutionPlan(config = {}, force = false) {
    if (force) {
      return {
        skipAll: true,
        reason: 'Force flag enabled - all gates bypassed',
        requiredGates: [],
        optionalGates: [],
        requiresForceConfirmation: true
      };
    }

    const requiredGates = [];
    const optionalGates = [];

    if (this.options.gitEnabled) {
      requiredGates.push({
        name: 'git-clean-check',
        description: 'Validate git repository state',
        critical: true
      });
    }

    if (this.options.branchValidation && config.expectedBranch) {
      requiredGates.push({
        name: 'branch-validation',
        description: `Validate current branch is ${config.expectedBranch}`,
        critical: true
      });
    }

    if (this.options.testValidation) {
      requiredGates.push({
        name: 'test-validation',
        description: `Validate tests pass with ${config.coverageThreshold || this.options.coverageThreshold}% coverage`,
        critical: true
      });
    }

    if (this.options.confirmationRequired) {
      requiredGates.push({
        name: 'production-confirmation',
        description: 'Require typed confirmation for production operation',
        critical: true
      });
    }

    return {
      skipAll: false,
      requiredGates,
      optionalGates,
      requiresForceConfirmation: false
    };
  }

  /**
   * Validate git status data
   * @param {Object} gitStatus - Git status information
   * @returns {Object} Validation result
   */
  validateGitStatus(gitStatus) {
    const issues = [];

    if (!gitStatus) {
      return {
        valid: false,
        issues: ['Git status data is required']
      };
    }

    // Check for uncommitted changes
    if (gitStatus.modified && gitStatus.modified.length > 0) {
      issues.push(`${gitStatus.modified.length} modified files need to be committed`);
    }

    if (gitStatus.untracked && gitStatus.untracked.length > 0) {
      issues.push(`${gitStatus.untracked.length} untracked files should be committed or ignored`);
    }

    if (gitStatus.staged && gitStatus.staged.length > 0) {
      issues.push(`${gitStatus.staged.length} staged files need to be committed`);
    }

    return {
      valid: issues.length === 0,
      issues,
      hasUncommittedChanges: issues.length > 0
    };
  }

  /**
   * Validate branch information
   * @param {string} currentBranch - Current branch name
   * @param {string} expectedBranch - Expected branch name
   * @returns {Object} Validation result
   */
  validateBranch(currentBranch, expectedBranch) {
    if (!currentBranch || typeof currentBranch !== 'string') {
      return {
        valid: false,
        issue: 'Current branch information is required'
      };
    }

    if (!expectedBranch || typeof expectedBranch !== 'string') {
      return {
        valid: false,
        issue: 'Expected branch information is required'
      };
    }

    const isCorrectBranch = currentBranch.trim() === expectedBranch.trim();

    return {
      valid: isCorrectBranch,
      currentBranch: currentBranch.trim(),
      expectedBranch: expectedBranch.trim(),
      issue: isCorrectBranch ? null : `Current branch "${currentBranch}" does not match expected "${expectedBranch}"`
    };
  }

  /**
   * Validate test results
   * @param {Object} testResults - Test execution results
   * @param {number} coverageThreshold - Minimum coverage threshold
   * @returns {Object} Validation result
   */
  validateTestResults(testResults, coverageThreshold = this.options.coverageThreshold) {
    const issues = [];

    if (!testResults || typeof testResults !== 'object') {
      return {
        valid: false,
        issues: ['Test results data is required']
      };
    }

    // Check for test failures
    if (testResults.failed && testResults.failed > 0) {
      issues.push(`${testResults.failed} tests failed - all tests must pass`);
    }

    // Check coverage if available
    if (testResults.coverage && testResults.coverage.total !== undefined) {
      if (testResults.coverage.total < coverageThreshold) {
        issues.push(`Coverage ${testResults.coverage.total}% is below required ${coverageThreshold}%`);
      }
    }

    // Validate test counts make sense
    const totalTests = (testResults.passed || 0) + (testResults.failed || 0) + (testResults.skipped || 0);
    if (totalTests === 0) {
      issues.push('No tests found - at least some tests should exist');
    }

    return {
      valid: issues.length === 0,
      issues,
      summary: {
        total: totalTests,
        passed: testResults.passed || 0,
        failed: testResults.failed || 0,
        skipped: testResults.skipped || 0,
        coverage: testResults.coverage?.total
      }
    };
  }

  /**
   * Validate confirmation input
   * @param {string} providedInput - User's confirmation input
   * @param {string} expectedInput - Expected confirmation text
   * @returns {Object} Validation result
   */
  validateConfirmation(providedInput, expectedInput) {
    if (typeof providedInput !== 'string' || typeof expectedInput !== 'string') {
      return {
        valid: false,
        issue: 'Both provided and expected confirmation inputs must be strings'
      };
    }

    const matches = providedInput.trim() === expectedInput.trim();

    return {
      valid: matches,
      providedLength: providedInput.trim().length,
      expectedLength: expectedInput.trim().length,
      issue: matches ? null : 'Confirmation text does not match expected input'
    };
  }

  /**
   * Generate safety gate audit entry
   * @param {string} gateName - Name of the gate
   * @param {Object} result - Gate execution result
   * @returns {Object} Audit entry
   */
  createAuditEntry(gateName, result) {
    return {
      gate: gateName,
      timestamp: new Date().toISOString(),
      status: result.valid ? 'PASSED' : 'FAILED',
      issues: result.issues || (result.issue ? [result.issue] : []),
      metadata: {
        ...result,
        duration: result.duration || null
      }
    };
  }

  /**
   * Calculate overall safety score
   * @param {Array} auditEntries - Array of gate audit entries
   * @returns {Object} Safety score summary
   */
  calculateSafetyScore(auditEntries) {
    if (!auditEntries || auditEntries.length === 0) {
      return {
        score: 0,
        total: 0,
        passed: 0,
        failed: 0,
        percentage: 0
      };
    }

    const passed = auditEntries.filter(entry => entry.status === 'PASSED').length;
    const failed = auditEntries.filter(entry => entry.status === 'FAILED').length;
    const total = auditEntries.length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

    return {
      score: percentage,
      total,
      passed,
      failed,
      percentage,
      allPassed: failed === 0,
      criticalFailures: auditEntries
        .filter(entry => entry.status === 'FAILED')
        .map(entry => entry.gate)
    };
  }

  /**
   * Get recommended actions based on gate failures
   * @param {Array} auditEntries - Array of gate audit entries
   * @returns {Array} Array of recommended actions
   */
  getRecommendedActions(auditEntries) {
    const actions = [];
    const failedEntries = auditEntries.filter(entry => entry.status === 'FAILED');

    for (const entry of failedEntries) {
      switch (entry.gate) {
      case 'git-clean-check':
        actions.push('Commit or stash uncommitted changes in git working tree');
        break;
      case 'branch-validation':
        actions.push(`Switch to the correct branch: ${entry.metadata.expectedBranch}`);
        break;
      case 'test-validation':
        if (entry.issues.some(issue => issue.includes('failed'))) {
          actions.push('Fix failing tests before proceeding');
        }
        if (entry.issues.some(issue => issue.includes('coverage'))) {
          actions.push('Increase test coverage to meet minimum threshold');
        }
        break;
      case 'production-confirmation':
        actions.push('Type the exact confirmation text as requested');
        break;
      default:
        actions.push(`Review and fix issues in ${entry.gate}`);
      }
    }

    return actions;
  }
}

export default SafetyGateRules;
