/**
 * JSON Test Result Formatter
 * Produces structured JSON format for programmatic consumption
 */

/**
 * Format test results as structured JSON
 */
class JSONFormatter {
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Format combined test results to JSON
   * @param {object} results - Test results from RunCommand._combineResults()
   * @returns {string} JSON formatted output
   */
  format(results) {
    const { total, passed, failed, skipped, tests, diagnostics, testFunctions } = results;
    const endTime = Date.now();
    const duration = endTime - this.startTime; // Keep in milliseconds for JSON

    const jsonResult = {
      metadata: {
        format: 'json',
        version: '1.0',
        timestamp: new Date().toISOString(),
        duration
      },
      stats: {
        total,
        passed,
        failed,
        skipped,
        success: failed === 0
      },
      testFunctions: testFunctions.map((func) => ({
        name: func.name,
        total: func.total,
        passed: func.passed,
        failed: func.failed,
        skipped: func.skipped,
        success: func.success,
        passRate: func.total > 0 ? ((func.passed / func.total) * 100).toFixed(1) : 0
      })),
      tests: tests.map((test, index) => {
        const testResult = {
          id: index + 1,
          name: test.description,
          status: test.status,
          function: test.function || 'unknown'
        };

        // Add additional properties for specific test types
        if (test.status === 'skip') {
          testResult.reason = test.reason || 'No reason provided';
          testResult.directive = test.directive;
        }

        if (test.number) {
          testResult.number = test.number;
        }

        return testResult;
      }),
      diagnostics: diagnostics || [],
      summary: {
        passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : 0,
        failRate: total > 0 ? ((failed / total) * 100).toFixed(1) : 0,
        skipRate: total > 0 ? ((skipped / total) * 100).toFixed(1) : 0,
        overallSuccess: failed === 0,
        executionTime: {
          total: duration,
          average: total > 0 ? (duration / total).toFixed(2) : 0,
          unit: 'milliseconds'
        }
      }
    };

    // Add function-level breakdown if multiple functions
    if (testFunctions && testFunctions.length > 1) {
      jsonResult.functionBreakdown = testFunctions.reduce((breakdown, func) => {
        breakdown[func.name] = {
          tests: tests.filter((test) => test.function === func.name),
          stats: {
            total: func.total,
            passed: func.passed,
            failed: func.failed,
            skipped: func.skipped,
            success: func.success
          }
        };
        return breakdown;
      }, {});
    }

    return JSON.stringify(jsonResult, null, 2);
  }

  /**
   * Get file extension for this format
   * @returns {string} File extension
   */
  getFileExtension() {
    return '.json';
  }

  /**
   * Get MIME type for this format
   * @returns {string} MIME type
   */
  getMimeType() {
    return 'application/json';
  }
}

export default JSONFormatter;
