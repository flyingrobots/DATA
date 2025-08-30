/**
 * Test Coverage Command
 */

const TestCommand = require('../../lib/TestCommand');
const DatabaseUtils = require('../../lib/db-utils');
const CoverageAnalyzer = require('../../lib/test/CoverageAnalyzer');
const chalk = require('chalk');
const Config = require('../../lib/config');

/**
 * Generate test coverage reports
 */
class CoverageCommand extends TestCommand {
  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.dbUtils = new DatabaseUtils();
    this.analyzer = new CoverageAnalyzer();
  }

  /**
   * Execute test coverage analysis
   */
  async performExecute(options = {}) {
    this.emit('start', { isProd: this.isProd, options });
    
    // Load test configuration
    const testConfig = await this._getTestConfig();
    
    // Parse enforcement options with config defaults
    const enforce = options.enforce !== undefined ? options.enforce : testConfig.coverage_enforcement;
    const minCoverage = parseInt(options.minCoverage || testConfig.minimum_coverage || '80', 10);
    const minRpcCoverage = parseInt(options.minRpcCoverage || testConfig.minimum_coverage || '75', 10);
    const minRlsCoverage = parseInt(options.minRlsCoverage || '70', 10);
    
    let client = null;
    
    try {
      this.progress('Connecting to database...');
      
      // Connect to the main postgres database (default database name)
      client = this.dbUtils.createDatabaseClient('postgres');
      await client.connect();
      
      this.progress('Analyzing RPC function coverage...');
      
      // Query RPC coverage
      const rpcResult = await client.query('SELECT * FROM test.analyze_rpc_coverage()');
      const rpcAnalysis = this.analyzer.analyzeRpcCoverage(rpcResult.rows);
      
      this.progress('Analyzing RLS policy coverage...');
      
      // Query RLS policy coverage
      const policyResult = await client.query('SELECT * FROM test.analyze_policy_coverage()');
      const policyAnalysis = this.analyzer.analyzePolicyCoverage(policyResult.rows);
      
      this.progress('Generating coverage summary...');
      
      // Query overall summary
      let summaryResult = null;
      try {
        const summaryQuery = await client.query('SELECT * FROM test.get_coverage_summary()');
        summaryResult = this.analyzer.processCoverageSummary(summaryQuery.rows);
      } catch (summaryError) {
        // Summary function might not exist in some migrations
        this.warn('Could not retrieve coverage summary - function may not be available');
      }
      
      this.progress('Formatting coverage report...');
      
      // Generate formatted report
      const report = this.analyzer.formatCoverageReport(rpcAnalysis, policyAnalysis, summaryResult);
      
      // Output the report
      console.log('\n' + report);
      
      // Generate stats for return value
      const stats = this.analyzer.generateCoverageStats(rpcAnalysis, policyAnalysis);
      
      // Enforce coverage thresholds if requested
      if (enforce) {
        this.progress('Enforcing coverage thresholds...');
        this.enforcementResult = this.enforceCoverageThresholds(
          stats, 
          minCoverage, 
          minRpcCoverage, 
          minRlsCoverage
        );
        
        if (!this.enforcementResult.passed) {
          // Exit after emitting the event and returning result
          this.emit('failed', { error: new Error('Coverage enforcement failed'), thresholds: this.enforcementResult });
          // Note: process.exit will be handled after the function returns
        } else {
          this.success('All coverage thresholds met!');
        }
      }
      
      this.emit('complete', { 
        rpcAnalysis, 
        policyAnalysis, 
        summary: summaryResult,
        stats,
        report 
      });
      
      // Exit with non-zero code if enforcement failed
      if (enforce && this.enforcementResult && !this.enforcementResult.passed) {
        process.exit(1);
      }
      
      return {
        rpc: rpcAnalysis,
        policies: policyAnalysis,
        summary: summaryResult,
        overall: stats.overall
      };
      
    } catch (error) {
      // Handle common database connection errors with helpful messages
      if (error.code === 'ECONNREFUSED') {
        this.error('Database connection refused. Is PostgreSQL running on localhost:54332?');
        this.info('Try starting Supabase with: cd supabase && npm run start');
      } else if (error.code === '3D000') {
        this.error('Database "postgres" does not exist.');
        this.info('Make sure you are connected to the correct database.');
      } else if (error.message.includes('test.analyze_rpc_coverage') || error.message.includes('does not exist')) {
        this.error('Test coverage functions not found in database.');
        this.info('Run the test coverage migration: data db compile-migration && supabase db reset');
        this.warn('Make sure migration 20250829_050000_test_coverage_analysis.sql has been applied.');
      } else {
        this.error('Failed to analyze test coverage', error);
      }
      
      this.emit('failed', { error });
      throw error;
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (closeError) {
          // Ignore connection close errors
        }
      }
    }
  }
  
  /**
   * Enforce coverage thresholds
   * @param {Object} stats - Coverage statistics
   * @param {number} minOverall - Minimum overall coverage percentage
   * @param {number} minRpc - Minimum RPC coverage percentage
   * @param {number} minRls - Minimum RLS coverage percentage
   * @returns {Object} Enforcement result
   */
  enforceCoverageThresholds(stats, minOverall, minRpc, minRls) {
    const failures = [];
    let passed = true;
    
    // Check overall coverage
    if (stats.overall && stats.overall.percentage < minOverall) {
      const message = `Overall coverage ${stats.overall.percentage}% below threshold ${minOverall}%`;
      this.error(chalk.red(message));
      failures.push({ type: 'overall', actual: stats.overall.percentage, expected: minOverall, message });
      passed = false;
    } else if (stats.overall) {
      this.success(chalk.green(`✓ Overall coverage ${stats.overall.percentage}% meets threshold ${minOverall}%`));
    }
    
    // Check RPC coverage
    if (stats.rpc && stats.rpc.percentage < minRpc) {
      const message = `RPC function coverage ${stats.rpc.percentage}% below threshold ${minRpc}%`;
      this.error(chalk.red(message));
      failures.push({ type: 'rpc', actual: stats.rpc.percentage, expected: minRpc, message });
      passed = false;
    } else if (stats.rpc) {
      this.success(chalk.green(`✓ RPC function coverage ${stats.rpc.percentage}% meets threshold ${minRpc}%`));
    }
    
    // Check RLS policy coverage
    if (stats.policies && stats.policies.percentage < minRls) {
      const message = `RLS policy coverage ${stats.policies.percentage}% below threshold ${minRls}%`;
      this.error(chalk.red(message));
      failures.push({ type: 'rls', actual: stats.policies.percentage, expected: minRls, message });
      passed = false;
    } else if (stats.policies) {
      this.success(chalk.green(`✓ RLS policy coverage ${stats.policies.percentage}% meets threshold ${minRls}%`));
    }
    
    // Summary
    if (passed) {
      this.success(chalk.bold.green('🎉 All coverage thresholds met!'));
    } else {
      this.error(chalk.bold.red(`💥 Coverage enforcement failed - ${failures.length} threshold(s) not met`));
      
      // Show details of failures
      failures.forEach(failure => {
        this.error(chalk.red(`  • ${failure.type}: ${failure.actual}% < ${failure.expected}%`));
      });
      
      this.progress(chalk.yellow('\nTo fix coverage issues:'));
      this.progress(chalk.yellow('  1. Run: ./build/data test coverage (to see detailed coverage report)'));
      this.progress(chalk.yellow('  2. Add missing tests for uncovered RPC functions and RLS policies'));
      this.progress(chalk.yellow('  3. Re-run with --enforce to validate improvements'));
    }
    
    return {
      passed,
      failures,
      thresholds: {
        overall: minOverall,
        rpc: minRpc,
        rls: minRls
      }
    };
  }

  /**
   * Get test configuration from config object or load from file
   * @private
   */
  async _getTestConfig() {
    if (this.config) {
      return this.config.getTestConfig();
    }
    
    try {
      const config = await Config.load();
      return config.getTestConfig();
    } catch (error) {
      this.logger.debug('Could not load config file, using defaults');
      const defaultConfig = new Config();
      return defaultConfig.getTestConfig();
    }
  }
}

module.exports = CoverageCommand;