/**
 * pgTAP Test Result Parser
 * Parses TAP (Test Anything Protocol) format output from pgTAP test functions
 */

/**
 * Parse pgTAP TAP format output
 */
class ResultParser {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: [],
      diagnostics: [],
      plan: null
    };
  }

  /**
   * Parse TAP output from pgTAP test results
   * @param {string} tapOutput - Raw TAP output from pgTAP
   * @returns {object} Parsed test results
   */
  parse(tapOutput) {
    if (!tapOutput || typeof tapOutput !== 'string') {
      return this.results;
    }

    const lines = tapOutput.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('1..')) {
        this._parsePlan(line);
      } else if (line.startsWith('ok ') || line.startsWith('not ok ')) {
        this._parseTest(line);
      } else if (line.startsWith('#')) {
        this._parseDiagnostic(line);
      }
    }

    // Calculate totals
    this.results.total = this.results.passed + this.results.failed + this.results.skipped;

    return this.results;
  }

  /**
   * Parse test plan line (e.g., "1..5")
   * @private
   */
  _parsePlan(line) {
    const match = line.match(/^1\.\.(\d+)$/);
    if (match) {
      this.results.plan = parseInt(match[1], 10);
    }
  }

  /**
   * Parse individual test result line
   * @private
   */
  _parseTest(line) {
    const okMatch = line.match(/^ok (\d+)(.*)/);
    const notOkMatch = line.match(/^not ok (\d+)(.*)/);

    if (okMatch) {
      const testNumber = parseInt(okMatch[1], 10);
      const description = okMatch[2].replace(/^[^\w]*/, '').trim();

      // Check for SKIP directive
      if (description.includes('# SKIP')) {
        this.results.skipped++;
        this.results.tests.push({
          number: testNumber,
          status: 'skip',
          description: description.replace(/# SKIP.*$/, '').trim(),
          directive: 'SKIP',
          reason: this._extractSkipReason(description)
        });
      } else {
        this.results.passed++;
        this.results.tests.push({
          number: testNumber,
          status: 'pass',
          description
        });
      }
    } else if (notOkMatch) {
      const testNumber = parseInt(notOkMatch[1], 10);
      const description = notOkMatch[2].replace(/^[^\w]*/, '').trim();

      this.results.failed++;
      this.results.tests.push({
        number: testNumber,
        status: 'fail',
        description
      });
    }
  }

  /**
   * Parse diagnostic line (comments starting with #)
   * @private
   */
  _parseDiagnostic(line) {
    const diagnostic = line.replace(/^#\s*/, '');
    this.results.diagnostics.push(diagnostic);
  }

  /**
   * Extract SKIP reason from test line
   * @private
   */
  _extractSkipReason(line) {
    const match = line.match(/# SKIP (.*)$/);
    return match ? match[1].trim() : '';
  }

  /**
   * Format results for console output with colors
   * @param {object} chalk - Chalk instance for colors
   * @returns {string} Formatted output
   */
  formatResults(chalk) {
    const { total, passed, failed, skipped, tests, diagnostics } = this.results;
    const lines = [];

    // Summary line
    if (failed > 0) {
      lines.push(chalk.red(`✗ ${failed}/${total} tests failed`));
    } else if (skipped > 0) {
      lines.push(chalk.yellow(`✓ ${passed}/${total} tests passed (${skipped} skipped)`));
    } else {
      lines.push(chalk.green(`✓ All ${passed}/${total} tests passed`));
    }

    // Individual test results
    if (tests.length > 0) {
      lines.push('');
      tests.forEach(test => {
        let symbol, color;

        switch (test.status) {
        case 'pass':
          symbol = '✓';
          color = chalk.green;
          break;
        case 'fail':
          symbol = '✗';
          color = chalk.red;
          break;
        case 'skip':
          symbol = '○';
          color = chalk.yellow;
          break;
        default:
          symbol = '?';
          color = chalk.gray;
        }

        let line = color(`  ${symbol} ${test.description}`);
        if (test.directive === 'SKIP' && test.reason) {
          line += chalk.gray(` (${test.reason})`);
        }
        lines.push(line);
      });
    }

    // Diagnostics (if any)
    if (diagnostics.length > 0) {
      lines.push('');
      lines.push(chalk.gray('Diagnostics:'));
      diagnostics.forEach(diagnostic => {
        lines.push(chalk.gray(`  ${diagnostic}`));
      });
    }

    return lines.join('\n');
  }

  /**
   * Check if all tests passed
   * @returns {boolean} True if all tests passed
   */
  isSuccess() {
    return this.results.failed === 0;
  }

  /**
   * Get exit code based on test results
   * @returns {number} Exit code (0 for success, 1 for failure)
   */
  getExitCode() {
    return this.isSuccess() ? 0 : 1;
  }
}

module.exports = ResultParser;
