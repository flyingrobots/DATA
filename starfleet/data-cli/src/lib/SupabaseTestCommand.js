/**
 * SupabaseTestCommand - Base class for test operations using Supabase API
 *
 * Replaces TestCommand's raw PostgreSQL with Supabase client
 */

const SupabaseCommand = require('./SupabaseCommand');
const PathResolver = require('./PathResolver');
const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

class SupabaseTestCommand extends SupabaseCommand {
  /**
   * Create a SupabaseTestCommand instance
   * @param {string} supabaseUrl - Supabase project URL (optional, uses env var)
   * @param {string} serviceRoleKey - Service role key (optional, uses env var)
   * @param {string} testsDir - Directory containing test files
   * @param {string} outputDir - Directory for test output/reports
   * @param {Object} logger - Logger instance (optional)
   * @param {boolean} isProd - Whether running in production mode
   * @param {PathResolver} pathResolver - Optional PathResolver instance
   */
  constructor(
    supabaseUrl = null,
    serviceRoleKey = null,
    testsDir,
    outputDir,
    logger = null,
    isProd = false,
    pathResolver = null
  ) {
    // Call parent with Supabase config
    super(supabaseUrl, serviceRoleKey, logger, isProd, false);

    // Initialize path resolver
    this.pathResolver = pathResolver || new PathResolver({
      testsDir: testsDir || path.join(process.cwd(), 'supabase', 'test'),
      outputDir: outputDir || path.join(process.cwd(), 'supabase', 'test-output')
    });

    // Store resolved paths
    this.testsDir = this.pathResolver.resolve('testsDir');
    this.outputDir = this.pathResolver.resolve('outputDir');

    // Test configuration
    this.testConfig = {
      timeout: 30000,
      parallel: true,
      maxConcurrency: 5
    };
  }

  /**
   * List test files in the tests directory
   * @param {string} pattern - Glob pattern (default: '**\/*.sql')
   * @returns {Promise<Array>} List of test file paths
   */
  async listTestFiles(pattern) {
    if (!pattern) pattern = '**/*.sql';
    const searchPattern = path.join(this.testsDir, pattern);
    const files = await glob(searchPattern);
    return files.sort();
  }

  /**
   * Discover test functions in the database
   * @param {string} schema - Schema to search (default: 'test')
   * @returns {Promise<Array>} List of test function names
   */
  async discoverTestFunctions(schema = 'test') {
    try {
      const sql = `
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = $1
          AND routine_name LIKE '%test%'
        ORDER BY routine_name
      `;

      const result = await this.executeSql(sql.replace('$1', `'${schema}'`));

      if (!result || !result.data) {
        return [];
      }

      return result.data.map(row => row.routine_name);
    } catch (error) {
      this.warn(`Failed to discover test functions: ${error.message}`);
      return [];
    }
  }

  /**
   * Run a test function and get TAP output
   * @param {string} functionName - Name of test function
   * @param {string} schema - Schema containing the function (default: 'test')
   * @returns {Promise<Object>} Test results
   */
  async runTestFunction(functionName, _schema = 'test') {
    try {
      // Validate function name to prevent SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)) {
        throw new Error(`Invalid function name: ${functionName}`);
      }

      const result = await this.rpc(functionName, {}, true);

      return {
        success: true,
        function: functionName,
        output: result
      };
    } catch (error) {
      return {
        success: false,
        function: functionName,
        error: error.message
      };
    }
  }

  /**
   * Compile test files into a single migration
   * @param {Object} options - Compilation options
   * @returns {Promise<Object>} Compilation result
   */
  async compileTests(_options = {}) {
    const testFiles = await this.listTestFiles();

    if (testFiles.length === 0) {
      throw new Error('No test files found');
    }

    let compiledSql = '-- Compiled test migration\n\n';

    // Add pgTAP extension
    compiledSql += 'CREATE EXTENSION IF NOT EXISTS pgtap;\n\n';

    // Compile each test file
    const filePromises = testFiles.map(async (filePath) => {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath);

      return `-- Source: ${fileName}\n${content}\n\n`;
    });

    const fileContents = await Promise.all(filePromises);
    compiledSql += fileContents.join('');

    // Write to output
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const outputFile = path.join(this.outputDir, `${timestamp}_compiled_tests.sql`);

    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.writeFile(outputFile, compiledSql);

    return {
      outputFile,
      filesCompiled: testFiles.length,
      size: compiledSql.length
    };
  }

  /**
   * Create a temporary test schema
   * @returns {Promise<string>} Schema name
   */
  async createTestSchema() {
    const schemaName = `"@data.tests.${Math.floor(Date.now() / 1000)}"`;

    await this.executeSql(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    this.success(`Created test schema: ${schemaName}`);

    return schemaName;
  }

  /**
   * Apply migration to test schema
   * @param {string} schemaName - Target schema
   * @param {string} migrationFile - Path to migration file
   */
  async applyMigrationToSchema(schemaName, migrationFile) {
    const migrationSql = await fs.readFile(migrationFile, 'utf8');

    // Wrap in schema context
    const wrappedSql = `
      SET search_path TO ${schemaName}, public;
      ${migrationSql}
      SET search_path TO public;
    `;

    await this.executeSql(wrappedSql);
    this.success(`Applied migration to ${schemaName}`);
  }

  /**
   * Clean up test schema
   * @param {string} schemaName - Schema to drop
   */
  async cleanupTestSchema(schemaName) {
    await this.dropSchema(schemaName, true);
  }

  /**
   * Parse TAP output
   * @param {Array|string} output - TAP output
   * @returns {Object} Parsed results
   */
  parseTapOutput(output) {
    if (!output) {
      return { total: 0, passed: 0, failed: 0, skipped: 0 };
    }

    const lines = Array.isArray(output) ? output : output.split('\n');
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const line of lines) {
      const str = typeof line === 'object' ? JSON.stringify(line) : line;

      if (str.includes('ok ')) {
        passed++;
      } else if (str.includes('not ok ')) {
        failed++;
      } else if (str.includes('# SKIP')) {
        skipped++;
      }
    }

    return {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped
    };
  }
}

module.exports = SupabaseTestCommand;
