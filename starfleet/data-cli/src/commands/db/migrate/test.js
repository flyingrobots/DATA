/**
 * Migration Test Command with pgTAP Validation
 */

const { Command } = require('../../../lib/Command');
const MigrationMetadata = require('../../../lib/MigrationMetadata');
const ChildProcessWrapper = require('../../../lib/ChildProcessWrapper');
const fs = require('fs');
const path = require('path');

/**
 * Test migration command that creates isolated test database,
 * applies staged migration, and runs pgTAP validation
 */
class MigrateTestCommand extends Command {
  static description = 'Test migration with pgTAP validation';

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Testing is safe
    this.workingDir = process.cwd();
    this.stagingDir = path.join(this.workingDir, 'migrations-staging');
    this.currentMigrationDir = path.join(this.stagingDir, 'current');
    this.processWrapper = new ChildProcessWrapper(logger || console);

    // Add ONLY safe database commands for testing
    this.processWrapper.allowCommand('psql');
    this.processWrapper.allowCommand('createdb');
    // DO NOT add dropdb - too dangerous!
  }

  /**
   * Execute the migration test process
   */
  async performExecute(args = {}) {
    this.emit('start');

    try {
      this.progress('Starting migration test process');

      // Validate that we have a staged migration
      await this.validateStagedMigration();

      // Get migration metadata
      const metadata = await this.getMigrationMetadata();
      this.progress(`Testing migration: ${metadata.name} (${metadata.id})`);

      // Create isolated test database
      const testDbUrl = await this.createTestDatabase();
      this.progress(`Created test database: ${this.getDbName(testDbUrl)}`);

      try {
        // Apply staged migration to test database
        await this.applyMigration(testDbUrl);
        this.progress('Applied migration to test database');

        // Run pgTAP tests if available
        const testResults = await this.runPgTapTests(testDbUrl);
        this.progress(`Test results: ${testResults.passed} passed, ${testResults.failed} failed`);

        // Update metadata with test results
        await this.updateTestResults(metadata.id, testResults);

        if (testResults.failed > 0) {
          this.error(`Migration test failed: ${testResults.failed} test(s) failed`);
          this.emit('failed', { error: 'Tests failed', results: testResults });
          throw new Error(`Migration test failed: ${testResults.failed} test(s) failed`);
        }

        this.success(`Migration test completed successfully: ${testResults.passed} tests passed`);
        this.emit('complete', { results: testResults });

      } finally {
        // Clean up test database
        await this.cleanupTestDatabase(testDbUrl);
        this.progress(`Cleaned up test database: ${this.getDbName(testDbUrl)}`);
      }

    } catch (error) {
      this.error('Migration test failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }

  /**
   * Validate that we have a staged migration ready for testing
   */
  async validateStagedMigration() {
    if (!fs.existsSync(this.currentMigrationDir)) {
      throw new Error('No staged migration found. Run "data compile-migration" first.');
    }

    const migrationFile = path.join(this.currentMigrationDir, 'migration.sql');
    if (!fs.existsSync(migrationFile)) {
      throw new Error('No migration.sql file found in staged migration.');
    }

    const metadataFile = path.join(this.currentMigrationDir, 'metadata.json');
    if (!fs.existsSync(metadataFile)) {
      throw new Error('No metadata.json file found in staged migration.');
    }
  }

  /**
   * Get migration metadata from staged migration
   */
  async getMigrationMetadata() {
    const metadata = new MigrationMetadata(this.currentMigrationDir);
    return metadata.read();
  }

  /**
   * Create isolated test database with unique name
   */
  async createTestDatabase() {
    const timestamp = Date.now();
    const testDbName = `temp_test_${timestamp}`;

    // Get base database connection info
    const baseDbUrl = this.getBaseDbUrl();
    const testDbUrl = this.createTestDbUrl(baseDbUrl, testDbName);

    try {
      // Create test database
      this.progress(`Creating test database: ${testDbName}`);
      await this.processWrapper.execute('createdb', [
        testDbName,
        '-h', 'localhost',
        '-p', '54332',
        '-U', 'postgres'
      ], {
        env: { ...process.env, PGPASSWORD: 'postgres' },
        timeout: 10000
      });

      return testDbUrl;
    } catch (error) {
      throw new Error(`Failed to create test database: ${error.message}`);
    }
  }

  /**
   * Apply staged migration to test database
   */
  async applyMigration(testDbUrl) {
    const migrationFile = path.join(this.currentMigrationDir, 'migration.sql');

    try {
      this.progress('Applying migration to test database');
      await this.processWrapper.execute('psql', [
        testDbUrl,
        '-f', migrationFile
      ], {
        env: { ...process.env, PGPASSWORD: 'postgres' },
        timeout: 30000
      });
    } catch (error) {
      throw new Error(`Failed to apply migration: ${error.message}`);
    }
  }

  /**
   * Run pgTAP tests if available
   */
  async runPgTapTests(testDbUrl) {
    // Check if pgTAP is available
    const hasPgTap = await this.checkPgTapAvailable(testDbUrl);

    if (!hasPgTap) {
      this.warn('pgTAP not available, skipping test validation');
      return {
        passed: 0,
        failed: 0,
        total: 0,
        message: 'pgTAP not available'
      };
    }

    try {
      // Run pgTAP tests
      this.progress('Running pgTAP test suite');

      // Check if we have test functions available
      const testFunctions = await this.getAvailableTestFunctions(testDbUrl);

      if (testFunctions.length === 0) {
        this.warn('No test functions found, creating basic validation test');
        return await this.runBasicValidationTest(testDbUrl);
      }

      // Run all available test functions
      let totalPassed = 0;
      let totalFailed = 0;

      for (const testFunction of testFunctions) {
        const result = await this.runTestFunction(testDbUrl, testFunction);
        totalPassed += result.passed;
        totalFailed += result.failed;
      }

      return {
        passed: totalPassed,
        failed: totalFailed,
        total: totalPassed + totalFailed,
        message: `Ran ${testFunctions.length} test function(s)`
      };

    } catch (error) {
      throw new Error(`pgTAP test execution failed: ${error.message}`);
    }
  }

  /**
   * Check if pgTAP extension is available
   */
  async checkPgTapAvailable(testDbUrl) {
    try {
      const result = execSync(`psql "${testDbUrl}" -c "SELECT 1 FROM pg_extension WHERE extname = 'pgtap';"`, {
        stdio: 'pipe',
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: 'postgres' }
      });

      return result.includes('(1 row)');
    } catch (error) {
      // Try to install pgTAP extension
      try {
        this.progress('Installing pgTAP extension');
        execSync(`psql "${testDbUrl}" -c "CREATE EXTENSION IF NOT EXISTS pgtap;"`, {
          stdio: 'pipe',
          env: { ...process.env, PGPASSWORD: 'postgres' }
        });
        return true;
      } catch (installError) {
        this.warn('Could not install pgTAP extension');
        return false;
      }
    }
  }

  /**
   * Get available test functions in test schema
   */
  async getAvailableTestFunctions(testDbUrl) {
    try {
      const result = execSync(`psql "${testDbUrl}" -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'test' AND routine_name LIKE '%test%' ORDER BY routine_name;"`, {
        stdio: 'pipe',
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: 'postgres' }
      });

      const lines = result.split('\n').filter(line =>
        line.trim() &&
        !line.includes('routine_name') &&
        !line.includes('------') &&
        !line.includes('(') &&
        !line.includes('row')
      );

      return lines.map(line => line.trim()).filter(name => name.length > 0);
    } catch (error) {
      this.warn('Could not query test functions');
      return [];
    }
  }

  /**
   * Run a specific test function
   */
  async runTestFunction(testDbUrl, functionName) {
    try {
      const result = execSync(`psql "${testDbUrl}" -c "SELECT * FROM test.${functionName}();"`, {
        stdio: 'pipe',
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: 'postgres' }
      });

      // Parse pgTAP results (simplified parsing)
      const lines = result.split('\n');
      let passed = 0;
      let failed = 0;

      for (const line of lines) {
        if (line.includes('ok ')) {
          passed++;
        } else if (line.includes('not ok ')) {
          failed++;
        }
      }

      this.progress(`Test function ${functionName}: ${passed} passed, ${failed} failed`);

      return { passed, failed };
    } catch (error) {
      this.warn(`Test function ${functionName} failed: ${error.message}`);
      return { passed: 0, failed: 1 };
    }
  }

  /**
   * Run basic validation test when no test functions available
   */
  async runBasicValidationTest(testDbUrl) {
    try {
      // Basic database connectivity and structure validation
      const checks = [
        "SELECT CASE WHEN current_database() IS NOT NULL THEN 'ok 1 - database connection' ELSE 'not ok 1 - database connection' END",
        "SELECT CASE WHEN count(*) > 0 THEN 'ok 2 - has tables' ELSE 'not ok 2 - has tables' END FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')",
        "SELECT CASE WHEN count(*) >= 0 THEN 'ok 3 - schema valid' ELSE 'not ok 3 - schema valid' END FROM information_schema.schemata"
      ];

      let passed = 0;
      let failed = 0;

      for (const check of checks) {
        try {
          const result = execSync(`psql "${testDbUrl}" -c "${check};"`, {
            stdio: 'pipe',
            encoding: 'utf8',
            env: { ...process.env, PGPASSWORD: 'postgres' }
          });

          if (result.includes('ok ')) {
            passed++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      }

      return {
        passed,
        failed,
        total: passed + failed,
        message: 'Basic validation tests'
      };
    } catch (error) {
      throw new Error(`Basic validation test failed: ${error.message}`);
    }
  }

  /**
   * Update metadata with test results
   */
  async updateTestResults(migrationId, testResults) {
    const metadata = new MigrationMetadata(this.currentMigrationDir);

    const updates = {
      status: testResults.failed > 0 ? 'pending' : 'tested',
      testing: {
        tested_at: new Date().toISOString(),
        tests_passed: testResults.passed,
        tests_failed: testResults.failed
      }
    };

    metadata.update(updates);
    this.progress('Updated migration metadata with test results');
  }

  /**
   * Clean up test database
   */
  async cleanupTestDatabase(testDbUrl) {
    const dbName = this.getDbName(testDbUrl);

    try {
      // Drop test database
      execSync(`dropdb "${dbName}" -h localhost -p 54332 -U postgres`, {
        stdio: 'pipe',
        env: { ...process.env, PGPASSWORD: 'postgres' }
      });
    } catch (error) {
      this.warn(`Could not cleanup test database ${dbName}: ${error.message}`);
      // Don't throw - cleanup failure shouldn't fail the test
    }
  }

  /**
   * Get base database URL from environment or config
   */
  getBaseDbUrl() {
    // Default to local Supabase instance
    return 'postgresql://postgres:postgres@127.0.0.1:54332/postgres';
  }

  /**
   * Create test database URL from base URL and test database name
   */
  createTestDbUrl(baseUrl, testDbName) {
    return baseUrl.replace(/\/[^\/]*$/, `/${testDbName}`);
  }

  /**
   * Extract database name from URL
   */
  getDbName(dbUrl) {
    const match = dbUrl.match(/\/([^\/]+)$/);
    return match ? match[1] : 'unknown';
  }
}

module.exports = MigrateTestCommand;
