/**
 * CI Validate Command - CI-optimized test validation
 *
 * Wraps ValidateCommand with machine-friendly output and proper exit codes
 * for CI/CD environments.
 */

const ValidateCommand = require('../ValidateCommand');

/**
 * CI-friendly test validation with structured output
 */
class CIValidateCommand extends ValidateCommand {
  constructor(
    databaseUrl = null,
    serviceRoleKey = null,
    testsDir,
    outputDir = null,
    logger = null,
    isProd = false,
    pathResolver = null
  ) {
    super(databaseUrl, serviceRoleKey, testsDir, outputDir, logger, isProd, pathResolver);

    // Force CI mode behavior
    this.ciMode = true;
    this.suppressProgress = true;
  }

  /**
   * Execute CI validation with structured output
   */
  async performExecute(options = {}) {
    const startTime = Date.now();

    // Force silent mode unless explicitly disabled
    const isCI = process.env.CI !== 'false';

    try {
      // Emit structured start event
      this.emitCIEvent('validation_started', {
        testsDir: this.testsDir,
        timestamp: new Date().toISOString()
      });

      // Execute validation (parent class handles the logic)
      const results = await super.performExecute(options);

      // Calculate execution time
      const duration = Date.now() - startTime;

      // Generate CI-friendly report
      const ciReport = this.generateCIReport(results, duration);

      // Output report (structured for CI consumption)
      if (isCI) {
        // Machine-readable JSON output for CI
        console.log(JSON.stringify(ciReport, null, 2));
      } else {
        // Human-readable for local development
        this.displayCIReport(ciReport);
      }

      // Write results to file if outputDir provided
      if (this.outputDir) {
        await this.writeCIResults(ciReport, 'validation-results.json');
      }

      // Emit structured completion event
      this.emitCIEvent('validation_completed', {
        success: !results.hasErrors,
        duration,
        summary: ciReport.summary
      });

      // Set proper exit code
      process.exitCode = results.hasErrors ? 1 : 0;

      return ciReport;

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
        console.error(`VALIDATION_ERROR: ${error.message}`);
      }

      this.emitCIEvent('validation_failed', { error: error.message, duration });

      process.exitCode = 1;
      throw error;
    }
  }

  /**
   * Generate CI-friendly report
   * @param {Object} results - Validation results from parent class
   * @param {number} duration - Execution duration in ms
   * @returns {Object} Structured CI report
   */
  generateCIReport(results, duration) {
    const { filesProcessed, syntaxErrors, pgTapIssues, structureWarnings, hasErrors } = results;

    return {
      status: hasErrors ? 'failed' : 'passed',
      summary: {
        filesProcessed,
        totalIssues: syntaxErrors.length + pgTapIssues.length + structureWarnings.length,
        errors: syntaxErrors.length + pgTapIssues.length,
        warnings: structureWarnings.length,
        hasErrors
      },
      details: {
        syntaxErrors: syntaxErrors.map(error => ({
          file: error.fileName,
          line: error.lineNum,
          severity: 'error',
          message: error.message,
          category: 'syntax'
        })),
        pgTapIssues: pgTapIssues.map(issue => ({
          file: issue.fileName,
          line: issue.lineNum,
          severity: 'error',
          message: issue.message,
          category: 'pgtap'
        })),
        structureWarnings: structureWarnings.map(warning => ({
          file: warning.fileName,
          line: warning.lineNum,
          severity: 'warning',
          message: warning.message,
          category: 'structure'
        }))
      },
      execution: {
        duration,
        timestamp: new Date().toISOString(),
        testsDirectory: this.testsDir
      }
    };
  }

  /**
   * Display CI report in human-readable format (for local development)
   * @param {Object} report - CI report
   */
  displayCIReport(report) {
    const { status, summary, details } = report;

    console.log(`\nVALIDATION_STATUS: ${status.toUpperCase()}`);
    console.log(`FILES_PROCESSED: ${summary.filesProcessed}`);
    console.log(`TOTAL_ISSUES: ${summary.totalIssues}`);
    console.log(`ERRORS: ${summary.errors}`);
    console.log(`WARNINGS: ${summary.warnings}`);

    if (details.syntaxErrors.length > 0) {
      console.log('\nSYNTAX_ERRORS:');
      details.syntaxErrors.forEach(error => {
        console.log(`  ${error.file}:${error.line} - ${error.message}`);
      });
    }

    if (details.pgTapIssues.length > 0) {
      console.log('\nPGTAP_ISSUES:');
      details.pgTapIssues.forEach(issue => {
        console.log(`  ${issue.file}:${issue.line} - ${issue.message}`);
      });
    }

    if (details.structureWarnings.length > 0) {
      console.log('\nSTRUCTURE_WARNINGS:');
      details.structureWarnings.forEach(warning => {
        console.log(`  ${warning.file}:${warning.line} - ${warning.message}`);
      });
    }

    console.log(`\nEXECUTION_TIME: ${report.execution.duration}ms`);
  }

  /**
   * Write CI results to file
   * @param {Object} report - CI report
   * @param {string} filename - Output filename
   */
  async writeCIResults(report, filename) {
    try {
      const filePath = await this.getOutputFile(filename);
      const fs = require('fs').promises;
      await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
    } catch (error) {
      // Don't fail the entire validation if we can't write results
      console.error(`Warning: Could not write validation results to file: ${error.message}`);
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
}

module.exports = CIValidateCommand;
