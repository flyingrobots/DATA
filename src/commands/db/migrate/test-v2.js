/**
 * Migration Test Command with pgTAP Validation - V2 using Supabase API
 */

const Command = require('../../../lib/Command');
const MigrationMetadata = require('../../../lib/MigrationMetadata');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test migration in isolated schema using Supabase API
 */
class MigrateTestCommand extends Command {
  static description = 'Test migration with pgTAP validation';
  
  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Testing is safe
    this.workingDir = process.cwd();
    this.stagingDir = path.join(this.workingDir, 'migrations-staging');
    this.currentMigrationDir = path.join(this.stagingDir, 'current');
    
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for testing');
    }
    
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    
    // Generate unique test schema name with clear namespace
    const timestamp = Math.floor(Date.now() / 1000); // POSIX timestamp
    this.testSchema = `"@data.tests.${timestamp}"`; // Quote for special chars
  }

  /**
   * Execute the migration test process
   */
  async performExecute(args = {}) {
    this.emit('start');
    
    let schemaCreated = false;
    
    try {
      this.progress('Starting migration test process');
      
      // Validate that we have a staged migration
      await this.validateStagedMigration();
      
      // Get migration metadata
      const metadata = await this.getMigrationMetadata();
      this.progress(`Testing migration: ${metadata.name} (${metadata.id})`);
      
      // Create isolated test schema
      await this.createTestSchema();
      schemaCreated = true;
      this.success(`Created test schema: ${this.testSchema}`);
      
      // Apply migration to test schema
      await this.applyMigration();
      this.success('Applied migration to test schema');
      
      // Install pgTAP if needed
      await this.ensurePgTap();
      
      // Run pgTAP tests
      const testResults = await this.runTests(args);
      
      // Report results
      this.reportTestResults(testResults);
      
      // Update metadata with test results
      await this.updateMetadata(metadata, testResults);
      
      this.emit('complete', { 
        success: testResults.success,
        schema: this.testSchema,
        results: testResults 
      });
      
      return testResults;
      
    } catch (error) {
      this.error('Migration test failed', error);
      this.emit('failed', { error });
      throw error;
      
    } finally {
      try {
        // Always cleanup test schema unless explicitly kept
        if (schemaCreated && args.keepSchema !== true) {
          await this.cleanupTestSchema();
        } else if (schemaCreated) {
          this.warn(`Test schema ${this.testSchema} was kept for debugging`);
        }
        
        // Close database connection
        if (this.supabase) {
          // Supabase client doesn't have an explicit close method, but we can
          // clear the auth session and remove listeners
          await this.supabase.auth.signOut();
          this.supabase.removeAllChannels();
          this.progress('Database connection closed');
        }
      } catch (cleanupError) {
        this.error('Cleanup error:', cleanupError);
        // Don't re-throw, we want to exit gracefully
      }
    }
  }
  
  /**
   * Validate that we have a staged migration ready to test
   */
  async validateStagedMigration() {
    try {
      await fs.access(this.currentMigrationDir);
      const migrationFile = path.join(this.currentMigrationDir, 'migration.sql');
      await fs.access(migrationFile);
    } catch (error) {
      throw new Error('No staged migration found. Run "data db:migrate:generate" first.');
    }
  }
  
  /**
   * Get migration metadata
   */
  async getMigrationMetadata() {
    const metadata = new MigrationMetadata(this.currentMigrationDir);
    return metadata.read();
  }
  
  /**
   * Create isolated test schema using Supabase API
   */
  async createTestSchema() {
    try {
      // Create schema with CASCADE to handle dependencies
      const { error } = await this.supabase.rpc('exec_sql', {
        sql: `CREATE SCHEMA IF NOT EXISTS ${this.testSchema};`
      });
      
      if (error) throw error;
      
      // Set search path to include our test schema
      const { error: pathError } = await this.supabase.rpc('exec_sql', {
        sql: `SET search_path TO ${this.testSchema}, public, test;`
      });
      
      if (pathError) throw pathError;
      
    } catch (error) {
      throw new Error(`Failed to create test schema: ${error.message}`);
    }
  }
  
  /**
   * Apply staged migration to test schema
   */
  async applyMigration() {
    const migrationFile = path.join(this.currentMigrationDir, 'migration.sql');
    
    try {
      // Read migration SQL
      const migrationSql = await fs.readFile(migrationFile, 'utf8');
      
      // Wrap migration in schema context
      const wrappedSql = `
        -- Switch to test schema
        SET search_path TO ${this.testSchema}, public;
        
        -- Run migration
        ${migrationSql}
        
        -- Reset search path
        SET search_path TO public;
      `;
      
      // Execute migration via RPC
      const { error } = await this.supabase.rpc('exec_sql', {
        sql: wrappedSql
      });
      
      if (error) throw error;
      
    } catch (error) {
      throw new Error(`Failed to apply migration: ${error.message}`);
    }
  }
  
  /**
   * Ensure pgTAP extension is available
   */
  async ensurePgTap() {
    try {
      // Check if pgTAP exists
      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: `SELECT 1 FROM pg_extension WHERE extname = 'pgtap';`
      });
      
      if (error) throw error;
      
      // Install if not present
      if (!data || data.length === 0) {
        this.progress('Installing pgTAP extension');
        
        const { error: installError } = await this.supabase.rpc('exec_sql', {
          sql: `CREATE EXTENSION IF NOT EXISTS pgtap;`
        });
        
        if (installError) throw installError;
        
        this.success('pgTAP extension installed');
      }
    } catch (error) {
      this.warn(`Could not install pgTAP: ${error.message}`);
      this.warn('Some tests may be skipped');
    }
  }
  
  /**
   * Run pgTAP tests in test schema
   */
  async runTests(options = {}) {
    try {
      this.progress('Discovering test functions...');
      
      // Find test functions in test schema
      const { data: testFunctions, error: discoverError } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT routine_name 
          FROM information_schema.routines 
          WHERE routine_schema IN ('test', '${this.testSchema}')
            AND routine_name LIKE '%test%' 
          ORDER BY routine_name;
        `
      });
      
      if (discoverError) throw discoverError;
      
      if (!testFunctions || testFunctions.length === 0) {
        this.warn('No test functions found');
        return {
          success: true,
          testsRun: 0,
          testsPassed: 0,
          testsFailed: 0,
          skipped: 0
        };
      }
      
      this.progress(`Found ${testFunctions.length} test function(s)`);
      
      // Run each test function
      const results = {
        success: true,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        skipped: 0,
        details: []
      };
      
      for (const func of testFunctions) {
        const functionName = func.routine_name;
        
        try {
          this.progress(`Running ${functionName}...`);
          
          // Execute test function
          const { data: testOutput, error: testError } = await this.supabase.rpc('exec_sql', {
            sql: `SELECT * FROM test.${functionName}();`
          });
          
          if (testError) throw testError;
          
          // Parse TAP output
          const tapResults = this.parseTapOutput(testOutput);
          
          results.testsRun += tapResults.total;
          results.testsPassed += tapResults.passed;
          results.testsFailed += tapResults.failed;
          results.skipped += tapResults.skipped;
          
          if (tapResults.failed > 0) {
            results.success = false;
          }
          
          results.details.push({
            function: functionName,
            ...tapResults
          });
          
          if (tapResults.failed > 0) {
            this.error(`✗ ${functionName}: ${tapResults.failed} test(s) failed`);
          } else {
            this.success(`✓ ${functionName}: All ${tapResults.passed} test(s) passed`);
          }
          
        } catch (error) {
          this.error(`Failed to run ${functionName}: ${error.message}`);
          results.success = false;
          results.testsFailed++;
          results.details.push({
            function: functionName,
            error: error.message
          });
        }
      }
      
      return results;
      
    } catch (error) {
      throw new Error(`Test execution failed: ${error.message}`);
    }
  }
  
  /**
   * Parse TAP output from test results
   */
  parseTapOutput(output) {
    if (!output || !Array.isArray(output)) {
      return { total: 0, passed: 0, failed: 0, skipped: 0 };
    }
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const row of output) {
      const line = Object.values(row)[0];
      if (typeof line !== 'string') continue;
      
      if (line.startsWith('ok ')) {
        passed++;
      } else if (line.startsWith('not ok ')) {
        failed++;
      } else if (line.includes('# SKIP')) {
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
  
  /**
   * Report test results
   */
  reportTestResults(results) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`Total Tests Run: ${results.testsRun}`);
    console.log(`✓ Passed: ${results.testsPassed}`);
    console.log(`✗ Failed: ${results.testsFailed}`);
    console.log(`⊘ Skipped: ${results.skipped}`);
    
    if (results.success) {
      this.success('\n✓ All tests passed!');
    } else {
      this.error(`\n✗ ${results.testsFailed} test(s) failed`);
      
      // Show failed test details
      const failedTests = results.details.filter(d => d.failed > 0 || d.error);
      if (failedTests.length > 0) {
        console.log('\nFailed Tests:');
        for (const test of failedTests) {
          console.log(`  - ${test.function}: ${test.error || `${test.failed} failures`}`);
        }
      }
    }
    
    console.log('='.repeat(60) + '\n');
  }
  
  /**
   * Update migration metadata with test results
   */
  async updateMetadata(metadata, testResults) {
    const updatedMetadata = {
      ...metadata,
      lastTested: new Date().toISOString(),
      testResults: {
        success: testResults.success,
        testsRun: testResults.testsRun,
        testsPassed: testResults.testsPassed,
        testsFailed: testResults.testsFailed
      }
    };
    
    const metadataManager = new MigrationMetadata(this.currentMigrationDir);
    await metadataManager.write(updatedMetadata);
  }
  
  /**
   * Clean up test schema
   */
  async cleanupTestSchema() {
    try {
      this.progress(`Cleaning up test schema: ${this.testSchema}`);
      
      // Drop schema with CASCADE to remove all objects
      const { error } = await this.supabase.rpc('exec_sql', {
        sql: `DROP SCHEMA IF EXISTS ${this.testSchema} CASCADE;`
      });
      
      if (error) {
        this.warn(`Failed to cleanup test schema: ${error.message}`);
      } else {
        this.success('Test schema cleaned up');
      }
    } catch (error) {
      this.warn(`Cleanup error: ${error.message}`);
    }
  }
  
  /**
   * Create RPC function for executing arbitrary SQL (if it doesn't exist)
   * This should be added to your database migrations
   */
  static getExecSqlFunction() {
    return `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        result json;
      BEGIN
        EXECUTE sql;
        RETURN json_build_object('success', true);
      EXCEPTION
        WHEN OTHERS THEN
          RETURN json_build_object(
            'success', false,
            'error', SQLERRM
          );
      END;
      $$;
    `;
  }
}

module.exports = MigrateTestCommand;