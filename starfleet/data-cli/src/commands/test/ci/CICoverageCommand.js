/**
 * CI Coverage Command - CI-optimized test coverage analysis
 * 
 * Wraps CoverageCommand with machine-friendly output, JSON reports,
 * and proper exit codes for CI/CD environments.
 */

const CoverageCommand = require('../CoverageCommand');

/**
 * CI-friendly test coverage analysis with structured output
 */
class CICoverageCommand extends CoverageCommand {
  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    
    // Force CI mode behavior
    this.ciMode = true;
    this.suppressProgress = true;
  }

  /**
   * Execute CI coverage analysis with structured output
   */
  async performExecute(options = {}) {
    const startTime = Date.now();
    const isCI = process.env.CI !== 'false';
    
    // Parse enforcement options with CI-friendly defaults
    const ciOptions = {
      enforce: options.enforce || false,
      minCoverage: parseInt(options.minCoverage || '80', 10),
      minRpcCoverage: parseInt(options.minRpcCoverage || '75', 10),
      minRlsCoverage: parseInt(options.minRlsCoverage || '70', 10),
      format: options.format || 'json',
      output: options.output || (isCI ? 'coverage' : null)
    };
    
    try {
      // Emit structured start event
      this.emitCIEvent('coverage_analysis_started', { 
        options: ciOptions,
        timestamp: new Date().toISOString()
      });
      
      // Execute coverage analysis using parent class logic
      const results = await super.performExecute(ciOptions);
      
      // Calculate execution time
      const duration = Date.now() - startTime;
      
      // Generate CI-friendly report
      const ciReport = this.generateCIReport(results, duration, ciOptions);
      
      // Output report (structured for CI consumption)
      if (isCI) {
        // Machine-readable JSON output for CI
        console.log(JSON.stringify(ciReport, null, 2));
      } else {
        // Human-readable for local development
        this.displayCIReport(ciReport);
      }
      
      // Write CI artifacts
      await this.writeCIArtifacts(results, ciReport, ciOptions);
      
      // Handle enforcement results
      const success = this.handleEnforcement(ciReport, ciOptions);
      
      // Emit structured completion event
      this.emitCIEvent('coverage_analysis_completed', {
        success,
        duration,
        summary: ciReport.summary
      });
      
      // Set proper exit code
      const exitCode = success ? 0 : 1;
      process.exitCode = exitCode;
      
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
        console.error(`COVERAGE_ANALYSIS_ERROR: ${error.message}`);
      }
      
      this.emitCIEvent('coverage_analysis_failed', { error: error.message, duration });
      
      process.exitCode = 1;
      throw error;
    }
  }
  
  /**
   * Generate CI-friendly coverage report
   * @param {Object} results - Coverage results from parent class
   * @param {number} duration - Execution duration in ms
   * @param {Object} options - Analysis options
   * @returns {Object} Structured CI report
   */
  generateCIReport(results, duration, options) {
    // Generate stats using parent class analyzer
    const stats = this.analyzer.generateCoverageStats(results.rpc, results.policies);
    
    // Calculate enforcement status if enabled
    let enforcement = null;
    if (options.enforce) {
      enforcement = this.calculateEnforcement(stats, options);
    }
    
    return {
      status: enforcement ? (enforcement.passed ? 'passed' : 'failed') : 'analyzed',
      summary: {
        overall: stats.overall || { total: 0, covered: 0, percentage: 0 },
        rpcFunctions: stats.rpc || { total: 0, covered: 0, percentage: 0 },
        rlsPolicies: stats.policies || { total: 0, covered: 0, percentage: 0 }
      },
      details: {
        uncoveredRpcFunctions: this.extractUncoveredRpc(results.rpc),
        uncoveredPolicies: this.extractUncoveredPolicies(results.policies),
        coverageBreakdown: this.generateBreakdown(results)
      },
      enforcement: enforcement,
      execution: {
        duration,
        timestamp: new Date().toISOString(),
        thresholds: options.enforce ? {
          overall: options.minCoverage,
          rpcFunctions: options.minRpcCoverage,
          rlsPolicies: options.minRlsCoverage
        } : null
      }
    };
  }
  
  /**
   * Calculate enforcement results
   * @param {Object} stats - Coverage statistics
   * @param {Object} options - Analysis options
   * @returns {Object} Enforcement results
   */
  calculateEnforcement(stats, options) {
    const failures = [];
    let passed = true;
    
    // Check overall coverage
    if (stats.overall && stats.overall.percentage < options.minCoverage) {
      failures.push({
        type: 'overall',
        actual: stats.overall.percentage,
        expected: options.minCoverage,
        message: `Overall coverage ${stats.overall.percentage}% below threshold ${options.minCoverage}%`
      });
      passed = false;
    }
    
    // Check RPC coverage
    if (stats.rpc && stats.rpc.percentage < options.minRpcCoverage) {
      failures.push({
        type: 'rpc',
        actual: stats.rpc.percentage,
        expected: options.minRpcCoverage,
        message: `RPC function coverage ${stats.rpc.percentage}% below threshold ${options.minRpcCoverage}%`
      });
      passed = false;
    }
    
    // Check RLS policy coverage
    if (stats.policies && stats.policies.percentage < options.minRlsCoverage) {
      failures.push({
        type: 'rls',
        actual: stats.policies.percentage,
        expected: options.minRlsCoverage,
        message: `RLS policy coverage ${stats.policies.percentage}% below threshold ${options.minRlsCoverage}%`
      });
      passed = false;
    }
    
    return {
      passed,
      failures,
      thresholds: {
        overall: options.minCoverage,
        rpc: options.minRpcCoverage,
        rls: options.minRlsCoverage
      }
    };
  }
  
  /**
   * Extract uncovered RPC functions
   * @param {Object} rpcResults - RPC analysis results
   * @returns {Array} List of uncovered RPC functions
   */
  extractUncoveredRpc(rpcResults) {
    if (!rpcResults || !Array.isArray(rpcResults)) return [];
    
    return rpcResults
      .filter(rpc => !rpc.has_tests || rpc.has_tests === false)
      .map(rpc => ({
        schema: rpc.schema_name,
        function: rpc.function_name,
        signature: rpc.function_signature || `${rpc.function_name}(...)`
      }));
  }
  
  /**
   * Extract uncovered RLS policies
   * @param {Object} policyResults - Policy analysis results
   * @returns {Array} List of uncovered policies
   */
  extractUncoveredPolicies(policyResults) {
    if (!policyResults || !Array.isArray(policyResults)) return [];
    
    return policyResults
      .filter(policy => !policy.has_tests || policy.has_tests === false)
      .map(policy => ({
        schema: policy.schema_name,
        table: policy.table_name,
        policy: policy.policy_name,
        command: policy.command_type || 'unknown'
      }));
  }
  
  /**
   * Generate detailed coverage breakdown
   * @param {Object} results - Coverage results
   * @returns {Object} Coverage breakdown
   */
  generateBreakdown(results) {
    const breakdown = {
      schemas: {},
      tables: {}
    };
    
    // Process RPC functions by schema
    if (results.rpc && Array.isArray(results.rpc)) {
      results.rpc.forEach(rpc => {
        const schema = rpc.schema_name;
        if (!breakdown.schemas[schema]) {
          breakdown.schemas[schema] = { total: 0, covered: 0, functions: [] };
        }
        breakdown.schemas[schema].total++;
        if (rpc.has_tests) {
          breakdown.schemas[schema].covered++;
        }
        breakdown.schemas[schema].functions.push({
          name: rpc.function_name,
          covered: rpc.has_tests || false
        });
      });
    }
    
    // Process RLS policies by table
    if (results.policies && Array.isArray(results.policies)) {
      results.policies.forEach(policy => {
        const table = `${policy.schema_name}.${policy.table_name}`;
        if (!breakdown.tables[table]) {
          breakdown.tables[table] = { total: 0, covered: 0, policies: [] };
        }
        breakdown.tables[table].total++;
        if (policy.has_tests) {
          breakdown.tables[table].covered++;
        }
        breakdown.tables[table].policies.push({
          name: policy.policy_name,
          command: policy.command_type,
          covered: policy.has_tests || false
        });
      });
    }
    
    return breakdown;
  }
  
  /**
   * Display CI report in human-readable format (for local development)
   * @param {Object} report - CI report
   */
  displayCIReport(report) {
    const { status, summary, enforcement } = report;
    
    console.log(`\nCOVERAGE_STATUS: ${status.toUpperCase()}`);
    console.log(`OVERALL_COVERAGE: ${summary.overall.percentage}% (${summary.overall.covered}/${summary.overall.total})`);
    console.log(`RPC_COVERAGE: ${summary.rpcFunctions.percentage}% (${summary.rpcFunctions.covered}/${summary.rpcFunctions.total})`);
    console.log(`RLS_COVERAGE: ${summary.rlsPolicies.percentage}% (${summary.rlsPolicies.covered}/${summary.rlsPolicies.total})`);
    
    if (enforcement) {
      console.log(`\nENFORCEMENT: ${enforcement.passed ? 'PASSED' : 'FAILED'}`);
      if (enforcement.failures.length > 0) {
        console.log('ENFORCEMENT_FAILURES:');
        enforcement.failures.forEach(failure => {
          console.log(`  ${failure.type}: ${failure.actual}% < ${failure.expected}%`);
        });
      }
    }
    
    console.log(`\nEXECUTION_TIME: ${report.execution.duration}ms`);
  }
  
  /**
   * Write CI artifacts (JSON reports, coverage files)
   * @param {Object} results - Full coverage results
   * @param {Object} report - CI report
   * @param {Object} options - Analysis options
   */
  async writeCIArtifacts(results, report, options) {
    try {
      if (this.outputDir) {
        // Write structured coverage report
        await this.writeJSONArtifact(report, 'coverage-report.json');
        
        // Write detailed results for further analysis
        await this.writeJSONArtifact(results, 'coverage-details.json');
        
        // Write enforcement results if enabled
        if (options.enforce && report.enforcement) {
          await this.writeJSONArtifact(report.enforcement, 'coverage-enforcement.json');
        }
        
        // Write coverage badges data for README/CI
        const badges = this.generateBadgeData(report.summary);
        await this.writeJSONArtifact(badges, 'coverage-badges.json');
      }
      
    } catch (error) {
      // Don't fail coverage analysis if we can't write artifacts
      console.error(`Warning: Could not write coverage artifacts: ${error.message}`);
    }
  }
  
  /**
   * Generate badge data for shields.io or similar services
   * @param {Object} summary - Coverage summary
   * @returns {Object} Badge data
   */
  generateBadgeData(summary) {
    const getColor = (percentage) => {
      if (percentage >= 80) return 'brightgreen';
      if (percentage >= 60) return 'yellow';
      return 'red';
    };
    
    return {
      overall: {
        label: 'coverage',
        message: `${summary.overall.percentage}%`,
        color: getColor(summary.overall.percentage)
      },
      rpc: {
        label: 'rpc-coverage',
        message: `${summary.rpcFunctions.percentage}%`,
        color: getColor(summary.rpcFunctions.percentage)
      },
      rls: {
        label: 'rls-coverage',
        message: `${summary.rlsPolicies.percentage}%`,
        color: getColor(summary.rlsPolicies.percentage)
      }
    };
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
   * Handle enforcement logic and exit codes
   * @param {Object} report - CI report
   * @param {Object} options - Analysis options
   * @returns {boolean} Success status
   */
  handleEnforcement(report, options) {
    if (!options.enforce || !report.enforcement) {
      return true; // No enforcement requested
    }
    
    return report.enforcement.passed;
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

module.exports = CICoverageCommand;