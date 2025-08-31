import DatabaseCommand from './DatabaseCommand.js';
import PathResolver from './PathResolver.js';

/**
 * TestCommand - Base class for test operations
 *
 * Commands that compile and run tests need both database access
 * and file system operations.
 */
/**
 * TestCommand class
 * @class
 */
class TestCommand extends DatabaseCommand {
  /**
   * Create a TestCommand instance
   * @param {string} databaseUrl - PostgreSQL connection string
   * @param {string} serviceRoleKey - Supabase service role key (optional)
   * @param {string} testsDir - Directory containing test files
   * @param {string} outputDir - Directory for test output/reports
   * @param {Object} logger - Logger instance (optional)
   * @param {boolean} isProd - Whether running in production mode
   * @param {PathResolver} pathResolver - Optional PathResolver instance
   */
  constructor(
    databaseUrl,
    serviceRoleKey = null,
    testsDir,
    outputDir,
    logger = null,
    isProd = false,
    pathResolver = null
  ) {
    // Call parent with database config
    super(databaseUrl, serviceRoleKey, null, logger, isProd);

    // Store test paths
    this.testsDir = testsDir;
    this.outputDir = outputDir;

    // Path resolver for ensuring directories exist
    this.pathResolver = pathResolver || new PathResolver();

    // Test operations typically don't need production confirmation
    this.requiresProductionConfirmation = false;
  }

  /**
   * Ensure tests directory exists and is readable
   * @returns {Promise<string>} Resolved tests directory path
   */
  async getTestsDir() {
    return await this.pathResolver.resolveDirectoryForRead(this.testsDir);
  }

  /**
   * Ensure output directory exists and is writable
   * @returns {Promise<string>} Resolved output directory path
   */
  async getOutputDir() {
    return await this.pathResolver.resolveDirectoryForWrite(this.outputDir);
  }

  /**
   * Get a specific test file path
   * @param {string} filename - The filename relative to tests dir
   * @returns {Promise<string>} Resolved file path
   */
  async getTestFile(filename) {
    const { join } = await import('path');
    const dir = await this.getTestsDir();
    return await this.pathResolver.resolveFileForRead(join(dir, filename));
  }

  /**
   * Get a specific output file path
   * @param {string} filename - The filename relative to output dir
   * @returns {Promise<string>} Resolved file path
   */
  async getOutputFile(filename) {
    const { join } = await import('path');
    const dir = await this.getOutputDir();
    return await this.pathResolver.resolveFileForWrite(join(dir, filename));
  }

  /**
   * List test files
   * @param {string} pattern - Glob pattern (optional)
   * @returns {Promise<string[]>} List of test file paths
   */
  async listTestFiles(pattern = '*.sql') {
    const { promises: fs } = await import('fs');
    const { join } = await import('path');
    const dir = await this.getTestsDir();

    try {
      const files = await fs.readdir(dir);
      return files
        .filter(file => {
          if (pattern === '*.sql') {
            return file.endsWith('.sql');
          }
          // For now, just support simple *.ext patterns
          if (pattern.startsWith('*.')) {
            const ext = pattern.slice(1); // Remove the *
            return file.endsWith(ext);
          }
          return file.includes(pattern);
        })
        .map(file => join(dir, file));
    } catch (error) {
      throw new Error(`Failed to list test files in ${dir}: ${error.message}`);
    }
  }

  /**
   * Compile test files into a single migration
   * @returns {Promise<string>} Compiled SQL content
   */
  async compileTests() {
    const { promises: fs } = await import('fs');
    const testFiles = await this.listTestFiles();

    const readPromises = testFiles.map(async (file) => {
      const content = await fs.readFile(file, 'utf8');
      return `-- Test file: ${file}\n${content}`;
    });

    const contents = await Promise.all(readPromises);

    return contents.join('\n\n');
  }

  /**
   * Run a test query and parse results
   * @param {string} sql - The test SQL to execute
   * @returns {Promise<Object>} Test results
   */
  async runTest(sql) {
    const result = await this.query(sql);
    return this.parseTestResults(result);
  }

  /**
   * Parse pgTAP test results
   * @param {Object} queryResult - Raw query result
   * @returns {Object} Parsed test results
   */
  parseTestResults(queryResult) {
    // Basic pgTAP result parsing
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };

    if (queryResult.rows) {
      queryResult.rows.forEach(row => {
        // Parse TAP output format
        const tapLine = row[Object.keys(row)[0]];
        if (typeof tapLine === 'string') {
          if (tapLine.startsWith('ok')) {
            results.passed++;
            results.tests.push({ status: 'passed', message: tapLine });
          } else if (tapLine.startsWith('not ok')) {
            results.failed++;
            results.tests.push({ status: 'failed', message: tapLine });
          } else if (tapLine.match(/^1\.\.(\d+)/)) {
            const match = tapLine.match(/^1\.\.(\d+)/);
            results.total = parseInt(match[1]);
          }
        }
      });
    }

    return results;
  }

  /**
   * Write test results to file
   * @param {Object} results - Test results
   * @param {string} filename - Output filename
   * @param {string} format - Output format (json, junit, etc.)
   * @returns {Promise<void>}
   */
  async writeResults(results, filename, format = 'json') {
    const { promises: fs } = await import('fs');
    const filePath = await this.getOutputFile(filename);

    let content;
    if (format === 'json') {
      content = JSON.stringify(results, null, 2);
    } else if (format === 'junit') {
      content = this.formatAsJUnit(results);
    } else {
      content = JSON.stringify(results);
    }

    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Format results as JUnit XML
   * @param {Object} results - Test results
   * @returns {string} JUnit XML
   */
  formatAsJUnit(results) {
    const xml = [];
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push(`<testsuite tests="${results.total}" failures="${results.failed}" skipped="${results.skipped}">`);

    results.tests.forEach((test, i) => {
      xml.push(`  <testcase name="Test ${i + 1}" classname="pgTAP">`);
      if (test.status === 'failed') {
        xml.push(`    <failure message="${test.message}"/>`);
      }
      xml.push('  </testcase>');
    });

    xml.push('</testsuite>');
    return xml.join('\n');
  }

  /**
   * Emit test progress events
   */
  emitTestProgress(stage, details = {}) {
    this.emit('test:progress', {
      stage,
      timestamp: new Date().toISOString(),
      testsDir: this.testsDir,
      ...details
    });
  }

  /**
   * Emit test results
   */
  emitTestResults(results) {
    this.emit('test:results', {
      ...results,
      timestamp: new Date().toISOString()
    });
  }
}

export { TestCommand };
export default TestCommand;
