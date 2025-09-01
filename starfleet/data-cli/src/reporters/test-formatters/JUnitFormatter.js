/**
 * JUnit XML Test Result Formatter
 * Produces standard JUnit XML format compatible with CI/CD systems
 */

/**
 * Format test results as JUnit XML
 */
class JUnitFormatter {
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Format combined test results to JUnit XML
   * @param {object} results - Test results from RunCommand._combineResults()
   * @returns {string} JUnit XML formatted output
   */
  format(results) {
    const { total, passed, failed, skipped, tests, testFunctions } = results;
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000; // Convert to seconds

    const xml = [];
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push('<testsuites>');

    // Create one testsuite containing all tests
    xml.push(`  <testsuite name="pgTAP Tests" tests="${total}" failures="${failed}" skipped="${skipped}" time="${duration.toFixed(3)}">`);

    // Add individual test cases
    tests.forEach(test => {
      const testName = this._escapeXml(test.description);
      const testTime = this._calculateTestTime(test, duration, total);

      if (test.status === 'fail') {
        xml.push(`    <testcase name="${testName}" time="${testTime.toFixed(3)}">`);
        xml.push('      <failure message="Test failed"/>');
        xml.push('    </testcase>');
      } else if (test.status === 'skip') {
        xml.push(`    <testcase name="${testName}" time="${testTime.toFixed(3)}">`);
        const reason = test.reason ? this._escapeXml(test.reason) : 'Skipped';
        xml.push(`      <skipped message="${reason}"/>`);
        xml.push('    </testcase>');
      } else {
        xml.push(`    <testcase name="${testName}" time="${testTime.toFixed(3)}"/>`);
      }
    });

    // Add system-out with function-level summary
    if (testFunctions && testFunctions.length > 0) {
      xml.push('    <system-out><![CDATA[');
      xml.push('Test Functions Summary:');
      testFunctions.forEach(func => {
        const status = func.success ? 'PASSED' : 'FAILED';
        xml.push(`${func.name}: ${func.passed}/${func.total} passed (${status})`);
      });
      xml.push(']]></system-out>');
    }

    xml.push('  </testsuite>');
    xml.push('</testsuites>');

    return xml.join('\n');
  }

  /**
   * Escape XML special characters
   * @private
   */
  _escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Calculate estimated test time (distribute total time evenly)
   * @private
   */
  _calculateTestTime(test, totalDuration, totalTests) {
    // Distribute total time evenly across tests as we don't have individual timing
    return totalTests > 0 ? totalDuration / totalTests : 0;
  }

  /**
   * Get file extension for this format
   * @returns {string} File extension
   */
  getFileExtension() {
    return '.xml';
  }

  /**
   * Get MIME type for this format
   * @returns {string} MIME type
   */
  getMimeType() {
    return 'application/xml';
  }
}

export default JUnitFormatter;
