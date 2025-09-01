/**
 * @fileoverview Test-Specific Event Classes for pgTAP and Coverage Operations
 * 
 * Specialized event classes for database testing operations including pgTAP test execution,
 * coverage analysis, test discovery, and validation reporting. Provides comprehensive
 * test lifecycle management with runtime type safety.
 * 
 * These events support both unit-style database tests and integration testing workflows
 * with detailed metrics and reporting capabilities.
 * 
 * @module TestEvents
 * @requires CommandEvents
 * @since 2.0.0
 * @author JavaScript Pro (via Claude Code)
 */

'use strict';

const {
  CommandEvent,
  ProgressEvent,
  ErrorEvent,
  SuccessEvent,
  WarningEvent
} = require('./CommandEvents.cjs');

// =============================================================================
// TEST EXECUTION EVENTS
// =============================================================================

/**
 * @typedef {Object} TestDetails
 * @property {string} [testSuite] - Name of test suite being executed
 * @property {string} [testFile] - Path to test file
 * @property {Array<string>} [testNames] - Names of individual tests
 * @property {number} [totalTests] - Total number of tests to run
 * @property {number} [passedTests] - Number of tests that passed
 * @property {number} [failedTests] - Number of tests that failed
 * @property {number} [skippedTests] - Number of tests that were skipped
 * @property {number} [duration] - Test execution duration in milliseconds
 * @property {number} [coverage] - Code coverage percentage
 * @property {Object} [coverageDetails] - Detailed coverage information
 * @property {Array<Object>} [failures] - Details of failed tests
 * @property {string} [framework] - Testing framework used (pgTAP, etc.)
 * @property {boolean} [isIntegration] - Whether this is an integration test
 * @property {string} [database] - Database being tested
 * @property {string} [schema] - Schema being tested
 */

/**
 * Event emitted when a test run begins execution.
 * 
 * Provides comprehensive context about the test execution including
 * test suite information, expected test count, and execution environment.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const testRun = new TestRunEvent('Starting pgTAP test suite', {
 *   testSuite: 'user_management',
 *   testFile: 'tests/001_users.sql',
 *   totalTests: 15,
 *   framework: 'pgTAP',
 *   database: 'test_db',
 *   schema: 'public'
 * });
 */
class TestRunEvent extends CommandEvent {
  /**
   * Creates a new TestRunEvent instance.
   * 
   * @param {string} message - Test run start message
   * @param {TestDetails} [details={}] - Test execution context
   */
  constructor(message, details = {}) {
    super('test_run', message, details);
    
    Object.defineProperties(this, {
      testSuite: {
        value: details.testSuite || null,
        writable: false,
        enumerable: true,
        configurable: false
      },
      totalTests: {
        value: details.totalTests || 0,
        writable: false,
        enumerable: true,
        configurable: false
      },
      framework: {
        value: details.framework || 'unknown',
        writable: false,
        enumerable: true,
        configurable: false
      }
    });
    
    this._freeze();
  }

  /**
   * Checks if this is a pgTAP test run.
   * 
   * @returns {boolean} True if using pgTAP framework
   */
  isPgTAP() {
    return this.framework.toLowerCase() === 'pgtap';
  }

  /**
   * Gets estimated completion time based on historical data.
   * 
   * @param {number} [avgTimePerTest=500] - Average milliseconds per test
   * @returns {Date|null} Estimated completion time
   */
  getEstimatedCompletion(avgTimePerTest = 500) {
    if (this.totalTests === 0) return null;
    const estimatedDuration = this.totalTests * avgTimePerTest;
    return new Date(this.timestamp.getTime() + estimatedDuration);
  }
}

/**
 * Event emitted for individual test progress during execution.
 * 
 * Provides real-time updates on test execution progress with details
 * about current test, pass/fail status, and overall completion percentage.
 * 
 * @class
 * @extends ProgressEvent
 * @example
 * const progress = new TestProgressEvent('Running test: user_creation', 40, {
 *   currentTest: 'test_user_creation',
 *   testIndex: 6,
 *   totalTests: 15,
 *   passedSoFar: 5,
 *   failedSoFar: 1
 * });
 */
class TestProgressEvent extends ProgressEvent {
  /**
   * Creates a new TestProgressEvent instance.
   * 
   * @param {string} message - Current test description
   * @param {number|null} [percentage=null] - Overall completion percentage
   * @param {TestDetails} [details={}] - Test progress details
   */
  constructor(message, percentage = null, details = {}) {
    super(message, percentage, details);
    
    // Test-specific event type available via getEventType()
    
    Object.defineProperties(this, {
      currentTest: {
        value: details.currentTest || null,
        writable: false,
        enumerable: true,
        configurable: false
      },
      testIndex: {
        value: details.testIndex || 0,
        writable: false,
        enumerable: true,
        configurable: false
      }
    });
    
    this._freeze();
  }

  /**
   * Gets current test statistics.
   * 
   * @returns {Object} Test execution statistics
   */
  getStats() {
    return {
      current: this.testIndex,
      total: this.details.totalTests || 0,
      passed: this.details.passedSoFar || 0,
      failed: this.details.failedSoFar || 0,
      successRate: this.getSuccessRate()
    };
  }

  /**
   * Calculates current success rate.
   * 
   * @returns {number} Success rate as percentage (0-100)
   */
  getSuccessRate() {
    const completed = (this.details.passedSoFar || 0) + (this.details.failedSoFar || 0);
    if (completed === 0) return 0;
    return Math.round((this.details.passedSoFar || 0) / completed * 100);
  }
}

/**
 * Event emitted when test execution completes successfully.
 * 
 * Contains comprehensive test results including pass/fail counts,
 * execution time, coverage metrics, and detailed test outcomes.
 * 
 * @class
 * @extends SuccessEvent
 * @example
 * const result = new TestResultEvent('Test suite completed', {
 *   testSuite: 'user_management',
 *   totalTests: 15,
 *   passedTests: 13,
 *   failedTests: 2,
 *   skippedTests: 0,
 *   duration: 2340,
 *   coverage: 87.5,
 *   framework: 'pgTAP'
 * });
 */
class TestResultEvent extends SuccessEvent {
  /**
   * Creates a new TestResultEvent instance.
   * 
   * @param {string} message - Test completion message
   * @param {TestDetails} [details={}] - Test results and metrics
   */
  constructor(message, details = {}) {
    super(message, details);
    
    // Test-specific event type available via getEventType()
    
    this._freeze();
  }

  /**
   * Calculates test success rate.
   * 
   * @returns {number} Success rate as percentage (0-100)
   */
  getSuccessRate() {
    const total = this.details.totalTests || 0;
    if (total === 0) return 0;
    const passed = this.details.passedTests || 0;
    return Math.round(passed / total * 100);
  }

  /**
   * Checks if all tests passed.
   * 
   * @returns {boolean} True if no test failures
   */
  allTestsPassed() {
    return (this.details.failedTests || 0) === 0;
  }

  /**
   * Gets comprehensive test metrics.
   * 
   * @returns {Object} Detailed test metrics
   */
  getMetrics() {
    const total = this.details.totalTests || 0;
    const passed = this.details.passedTests || 0;
    const failed = this.details.failedTests || 0;
    const skipped = this.details.skippedTests || 0;
    
    return {
      total,
      passed,
      failed,
      skipped,
      successRate: this.getSuccessRate(),
      duration: this.details.duration || 0,
      coverage: this.details.coverage || 0,
      testsPerSecond: this.details.duration ? 
        Math.round(total / (this.details.duration / 1000) * 100) / 100 : 0
    };
  }

  /**
   * Gets failure details if any tests failed.
   * 
   * @returns {Array<Object>} Array of failure information
   */
  getFailures() {
    return this.details.failures || [];
  }
}

/**
 * Event emitted when test execution fails catastrophically.
 * 
 * Different from individual test failures - this represents system-level
 * test execution problems like database connection failures, syntax errors, etc.
 * 
 * @class
 * @extends ErrorEvent
 * @example
 * const failed = new TestFailedEvent('Test execution failed', dbError, 'DB_CONNECTION', {
 *   testSuite: 'user_management',
 *   failurePoint: 'database_connection',
 *   testsCompleted: 3,
 *   totalTests: 15
 * });
 */
class TestFailedEvent extends ErrorEvent {
  /**
   * Creates a new TestFailedEvent instance.
   * 
   * @param {string} message - Test failure message
   * @param {Error|null} [error=null] - The underlying error
   * @param {string|null} [code=null] - Error classification code
   * @param {TestDetails} [details={}] - Test failure context
   */
  constructor(message, error = null, code = null, details = {}) {
    super(message, error, code, details);
    
    // Test-specific event type available via getEventType()
    
    this._freeze();
  }

  /**
   * Gets the point of failure in test execution.
   * 
   * @returns {string} Failure point description
   */
  getFailurePoint() {
    return this.details.failurePoint || 'unknown';
  }

  /**
   * Checks if tests can be retried safely.
   * 
   * @returns {boolean} True if retry is possible
   */
  canRetry() {
    const retryableCodes = ['DB_CONNECTION', 'TIMEOUT', 'RESOURCE_BUSY'];
    return retryableCodes.includes(this.code);
  }
}

// =============================================================================
// COVERAGE EVENTS
// =============================================================================

/**
 * @typedef {Object} CoverageDetails
 * @property {number} [linesCovered] - Number of lines covered
 * @property {number} [totalLines] - Total number of lines
 * @property {number} [functionsCovered] - Number of functions covered
 * @property {number} [totalFunctions] - Total number of functions
 * @property {number} [branchesCovered] - Number of branches covered
 * @property {number} [totalBranches] - Total number of branches
 * @property {Object} [fileCoverage] - Per-file coverage details
 * @property {Array<string>} [uncoveredLines] - Lines without coverage
 * @property {Array<string>} [uncoveredFunctions] - Functions without coverage
 * @property {number} [threshold] - Coverage threshold requirement
 * @property {boolean} [meetsThreshold] - Whether coverage meets threshold
 */

/**
 * Event emitted when code coverage analysis completes.
 * 
 * Provides detailed coverage metrics including line coverage, function coverage,
 * branch coverage, and threshold compliance for database code.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const coverage = new CoverageEvent('Coverage analysis complete', {
 *   linesCovered: 234,
 *   totalLines: 280,
 *   functionsCovered: 18,
 *   totalFunctions: 22,
 *   threshold: 80,
 *   meetsThreshold: true
 * });
 */
class CoverageEvent extends CommandEvent {
  /**
   * Creates a new CoverageEvent instance.
   * 
   * @param {string} message - Coverage analysis message
   * @param {CoverageDetails} [details={}] - Coverage metrics and details
   */
  constructor(message, details = {}) {
    super('coverage', message, details);
    
    this._freeze();
  }

  /**
   * Calculates line coverage percentage.
   * 
   * @returns {number} Line coverage percentage (0-100)
   */
  getLineCoverage() {
    const total = this.details.totalLines || 0;
    if (total === 0) return 0;
    const covered = this.details.linesCovered || 0;
    return Math.round(covered / total * 10000) / 100; // Two decimal places
  }

  /**
   * Calculates function coverage percentage.
   * 
   * @returns {number} Function coverage percentage (0-100)
   */
  getFunctionCoverage() {
    const total = this.details.totalFunctions || 0;
    if (total === 0) return 0;
    const covered = this.details.functionsCovered || 0;
    return Math.round(covered / total * 10000) / 100;
  }

  /**
   * Calculates branch coverage percentage.
   * 
   * @returns {number} Branch coverage percentage (0-100)
   */
  getBranchCoverage() {
    const total = this.details.totalBranches || 0;
    if (total === 0) return 0;
    const covered = this.details.branchesCovered || 0;
    return Math.round(covered / total * 10000) / 100;
  }

  /**
   * Gets overall coverage summary.
   * 
   * @returns {Object} Comprehensive coverage metrics
   */
  getSummary() {
    return {
      lines: {
        covered: this.details.linesCovered || 0,
        total: this.details.totalLines || 0,
        percentage: this.getLineCoverage()
      },
      functions: {
        covered: this.details.functionsCovered || 0,
        total: this.details.totalFunctions || 0,
        percentage: this.getFunctionCoverage()
      },
      branches: {
        covered: this.details.branchesCovered || 0,
        total: this.details.totalBranches || 0,
        percentage: this.getBranchCoverage()
      },
      threshold: this.details.threshold || 0,
      meetsThreshold: Boolean(this.details.meetsThreshold),
      overall: this.getLineCoverage() // Use line coverage as overall metric
    };
  }

  /**
   * Checks if coverage meets the required threshold.
   * 
   * @returns {boolean} True if threshold is met
   */
  meetsThreshold() {
    return Boolean(this.details.meetsThreshold);
  }

  /**
   * Gets areas that need additional test coverage.
   * 
   * @returns {Object} Coverage gaps information
   */
  getCoverageGaps() {
    return {
      uncoveredLines: this.details.uncoveredLines || [],
      uncoveredFunctions: this.details.uncoveredFunctions || [],
      filesNeedingCoverage: this.getFilesNeedingCoverage()
    };
  }

  /**
   * Identifies files that need additional coverage.
   * 
   * @returns {Array<Object>} Files with low coverage
   */
  getFilesNeedingCoverage() {
    const fileCoverage = this.details.fileCoverage || {};
    const threshold = this.details.threshold || 80;
    
    return Object.entries(fileCoverage)
      .filter(([_, coverage]) => coverage < threshold)
      .map(([file, coverage]) => ({ file, coverage, needed: threshold - coverage }))
      .sort((a, b) => a.coverage - b.coverage);
  }
}

// =============================================================================
// TEST DISCOVERY AND VALIDATION EVENTS
// =============================================================================

/**
 * Event emitted when test discovery finds test files and functions.
 * 
 * Reports discovered test files, test functions, and any issues
 * with test structure or naming conventions.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const discovery = new TestDiscoveryEvent('Found 5 test files', {
 *   testFiles: ['001_users.sql', '002_posts.sql'],
 *   totalTests: 42,
 *   testsByFile: { '001_users.sql': 15, '002_posts.sql': 27 },
 *   issues: ['Missing test plan in 003_comments.sql']
 * });
 */
class TestDiscoveryEvent extends CommandEvent {
  /**
   * Creates a new TestDiscoveryEvent instance.
   * 
   * @param {string} message - Discovery results message
   * @param {Object} [details={}] - Discovery details
   * @param {Array<string>} [details.testFiles] - Discovered test files
   * @param {number} [details.totalTests] - Total number of tests found
   * @param {Object} [details.testsByFile] - Test count per file
   * @param {Array<string>} [details.issues] - Issues found during discovery
   */
  constructor(message, details = {}) {
    super('test_discovery', message, details);
    
    Object.defineProperty(this, 'testFiles', {
      value: Object.freeze([...(details.testFiles || [])]),
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    this._freeze();
  }

  /**
   * Gets the number of test files discovered.
   * 
   * @returns {number} Test file count
   */
  getFileCount() {
    return this.testFiles.length;
  }

  /**
   * Gets the total number of tests across all files.
   * 
   * @returns {number} Total test count
   */
  getTotalTestCount() {
    return this.details.totalTests || 0;
  }

  /**
   * Checks if any issues were found during discovery.
   * 
   * @returns {boolean} True if issues were detected
   */
  hasIssues() {
    return (this.details.issues || []).length > 0;
  }

  /**
   * Gets detailed breakdown of tests per file.
   * 
   * @returns {Array<Object>} Test distribution information
   */
  getTestDistribution() {
    const testsByFile = this.details.testsByFile || {};
    return this.testFiles.map(file => ({
      file,
      testCount: testsByFile[file] || 0
    }));
  }
}

/**
 * Event emitted when test validation detects problems.
 * 
 * Used for validating pgTAP test structure, naming conventions,
 * test plans, and other quality checks.
 * 
 * @class
 * @extends WarningEvent
 * @example
 * const validation = new TestValidationEvent('Test plan mismatch detected', {
 *   testFile: '001_users.sql',
 *   expectedTests: 15,
 *   actualTests: 13,
 *   severity: 'medium',
 *   validationType: 'TEST_PLAN'
 * });
 */
class TestValidationEvent extends WarningEvent {
  /**
   * Creates a new TestValidationEvent instance.
   * 
   * @param {string} message - Validation warning message
   * @param {TestDetails} [details={}] - Validation context
   */
  constructor(message, details = {}) {
    super(message, details);
    
    // Test-specific event type available via getEventType()
    
    Object.defineProperty(this, 'validationType', {
      value: details.validationType || 'GENERAL',
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    this._freeze();
  }

  /**
   * Checks if validation issue should block test execution.
   * 
   * @returns {boolean} True if tests should not run
   */
  shouldBlockExecution() {
    const blockingTypes = ['SYNTAX_ERROR', 'MISSING_DEPENDENCY', 'INVALID_STRUCTURE'];
    const highSeverity = this.getSeverity() === 'high';
    return blockingTypes.includes(this.validationType) && highSeverity;
  }

  /**
   * Gets suggested fixes for the validation issue.
   * 
   * @returns {Array<string>} List of suggested fixes
   */
  getSuggestedFixes() {
    const fixes = {
      'TEST_PLAN': ['Update test plan count', 'Add missing tests', 'Remove extra tests'],
      'NAMING': ['Follow pgTAP naming conventions', 'Use descriptive test names'],
      'STRUCTURE': ['Add proper test setup', 'Include test teardown', 'Fix test organization'],
      'SYNTAX_ERROR': ['Check SQL syntax', 'Verify pgTAP function usage', 'Fix test assertions']
    };
    
    return fixes[this.validationType] || ['Review test documentation', 'Check test best practices'];
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Test execution events
  TestRunEvent,
  TestProgressEvent,
  TestResultEvent,
  TestFailedEvent,
  
  // Coverage events
  CoverageEvent,
  
  // Discovery and validation events
  TestDiscoveryEvent,
  TestValidationEvent
};

// Export for instanceof checks
module.exports.TestRunEvent = TestRunEvent;
module.exports.TestProgressEvent = TestProgressEvent;
module.exports.TestResultEvent = TestResultEvent;
module.exports.TestFailedEvent = TestFailedEvent;
module.exports.CoverageEvent = CoverageEvent;
module.exports.TestDiscoveryEvent = TestDiscoveryEvent;
module.exports.TestValidationEvent = TestValidationEvent;