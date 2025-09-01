/**
 * CI Run Command - CI-optimized test execution
 *
 * Wraps RunCommand with machine-friendly output, JUnit XML generation,
 * and proper exit codes for CI/CD environments.
 */

const RunCommand = require('../RunCommand');

/**
 * CI-friendly test execution with structured output
 */
class CIRunCommand extends RunCommand {
  constructor(databaseUrl, serviceRoleKey = null, testsDir, outputDir, logger = null, isProd = false) {
    super(databaseUrl, serviceRoleKey, testsDir, outputDir, logger, isProd);

    // Force CI mode behavior
    this.ciMode = true;
    this.suppressProgress = true;
  }

  /**
   * Execute CI test run with structured output
   */
  async performExecute(options = {}) {
    const startTime = Date.now();
    const isCI = process.env.CI !== 'false';

    // Force machine-readable output by default in CI mode
    const ciOptions = {
      ...options,
      format: options.format || (isCI ? 'junit' : 'console'),
      output: options.output || (isCI ? 'test-results' : null)
    };

    try {
      // Emit structured start event
      this.emitCIEvent('test_run_started', {
        testsDir: this.testsDir,
        options: ciOptions,
        timestamp: new Date().toISOString()
      });

      // Execute tests using parent class logic
      const results = await super.performExecute(ciOptions);

      // Calculate execution time
      const duration = Date.now() - startTime;

      // Generate CI-friendly summary
      const ciSummary = this.generateCISummary(results, duration);

      // Output summary for CI
      if (isCI) {
        // Always output summary to stdout for CI parsing
        console.log(JSON.stringify(ciSummary, null, 2));
      } else {
        // Human-readable summary for local development
        this.displayCISummary(ciSummary);
      }

      // Write additional CI artifacts
      await this.writeCIArtifacts(results, ciSummary, ciOptions);

      // Emit structured completion event
      this.emitCIEvent('test_run_completed', {
        success: results.failed === 0,
        duration,
        summary: ciSummary.summary
      });

      // Set proper exit code based on test results
      const exitCode = this.getExitCode(results);
      process.exitCode = exitCode;

      return ciSummary;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Structured error output
      const errorReport = {
        status: 'error',
        error: {
          message: error.message,
          type: error.constructor.name
        },
        duration,
        timestamp: new Date().toISOString()
      };

      if (isCI) {
        console.error(JSON.stringify(errorReport, null, 2));
      } else {
        console.error(`TEST_RUN_ERROR: ${error.message}`);
      }

      this.emitCIEvent('test_run_failed', { error: error.message, duration });

      process.exitCode = 1;
      throw error;
    }
  }

  /**
   * Generate CI-friendly test summary
   * @param {Object} results - Test results from parent class
   * @param {number} duration - Execution duration in ms
   * @returns {Object} Structured CI summary
   */
  generateCISummary(results, duration) {
    const { total, passed, failed, skipped, testFunctions } = results;

    return {
      status: failed > 0 ? 'failed' : 'passed',
      summary: {
        total,
        passed,
        failed,
        skipped,
        success: failed === 0,
        functionCount: testFunctions.length
      },
      testFunctions: testFunctions.map(func => ({
        name: func.name,
        status: func.success ? 'passed' : 'failed',
        total: func.total,
        passed: func.passed,
        failed: func.failed,
        skipped: func.skipped
      })),
      failedTests: results.tests
        .filter(test => test.status === 'fail')
        .map(test => ({
          description: test.description,
          function: test.function,
          message: test.message || null
        })),
      execution: {
        duration,
        timestamp: new Date().toISOString(),
        testsDirectory: this.testsDir
      }
    };
  }

  /**
   * Display CI summary in human-readable format (for local development)
   * @param {Object} summary - CI summary
   */
  displayCISummary(summary) {
    const { status, summary: stats, failedTests, execution } = summary;

    console.log(`\nTEST_RUN_STATUS: ${status.toUpperCase()}`);
    console.log(`TOTAL_TESTS: ${stats.total}`);
    console.log(`PASSED: ${stats.passed}`);
    console.log(`FAILED: ${stats.failed}`);
    console.log(`SKIPPED: ${stats.skipped}`);
    console.log(`SUCCESS: ${stats.success}`);

    if (failedTests.length > 0) {
      console.log('\nFAILED_TESTS:');
      failedTests.forEach(test => {
        console.log(`  ${test.function}: ${test.description}`);
        if (test.message) {
          console.log(`    ${test.message}`);
        }
      });
    }

    console.log(`\nEXECUTION_TIME: ${execution.duration}ms`);
  }

  /**
   * Write CI artifacts (JUnit XML, JSON reports, etc.)
   * @param {Object} results - Full test results
   * @param {Object} summary - CI summary
   * @param {Object} options - Execution options
   */
  async writeCIArtifacts(results, summary, options) {
    try {
      // Always write JSON summary for CI consumption
      if (this.outputDir) {
        await this.writeJSONArtifact(summary, 'test-summary.json');

        // Write detailed results if requested
        if (options.detailed !== false) {
          await this.writeJSONArtifact(results, 'test-results.json');
        }
      }

      // JUnit XML is handled by parent class via format option
      // JSON format is handled by parent class via format option

    } catch (error) {
      // Don't fail tests if we can't write artifacts
      console.error(`Warning: Could not write CI artifacts: ${error.message}`);
    }
  }

  /**
   * Write JSON artifact to output directory
   * @param {Object} data - Data to write
   * @param {string} filename - Output filename
   */
  async writeJSONArtifact(data, filename) {
    try {
      const filePath = await this.getOutputFile(filename);
      const fs = require('fs').promises;
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to write ${filename}: ${error.message}`);
    }
  }

  /**
   * Emit structured CI events
   * @param {string} eventType - Type of event
   * @param {Object} data - Event data
   */
  emitCIEvent(eventType, data) {
    this.emit('ci:event', {
      type: eventType,
      ...data
    });
  }

  /**
   * Override _displayResults to suppress console output in CI mode
   */
  _displayResults(results) {
    // Only display results if explicitly not in CI mode
    if (process.env.CI === 'false') {
      super._displayResults(results);
    }
    // In CI mode, output is handled by generateCISummary
  }

  /**
   * Override progress method to suppress output in CI mode
   */
  progress(message) {
    // Only show progress if explicitly not in CI mode
    if (process.env.CI === 'false') {
      super.progress(message);
    }
  }

  /**
   * Override warn method for structured CI output
   */
  warn(message) {
    if (process.env.CI !== 'false') {
      // Structured warning for CI
      console.error(JSON.stringify({
        level: 'warning',
        message,
        timestamp: new Date().toISOString()
      }));
    } else {
      super.warn(message);
    }
  }

  /**
   * Override error method for structured CI output
   */
  error(message, error = null) {
    if (process.env.CI !== 'false') {
      // Structured error for CI
      console.error(JSON.stringify({
        level: 'error',
        message,
        error: error ? error.message : null,
        timestamp: new Date().toISOString()
      }));
    } else {
      super.error(message, error);
    }
  }

  /**
   * Override success method for structured CI output
   */
  success(message) {
    if (process.env.CI !== 'false') {
      // Structured success for CI
      console.log(JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString()
      }));
    } else {
      super.success(message);
    }
  }

  /**
   * Get detailed test metrics for CI reporting
   * @param {Object} results - Test results
   * @returns {Object} Detailed metrics
   */
  getCIMetrics(results) {
    const metrics = {
      totalExecutionTime: 0,
      averageTestTime: 0,
      testFunctionMetrics: []
    };

    // Calculate per-function metrics if available
    if (results.testFunctions) {
      results.testFunctions.forEach(func => {
        metrics.testFunctionMetrics.push({
          name: func.name,
          testCount: func.total,
          passRate: func.total > 0 ? (func.passed / func.total) * 100 : 0,
          success: func.success
        });
      });
    }

    return metrics;
  }
}

module.exports = CIRunCommand;
