/**
 * Test Coverage Orchestrator for D.A.T.A.
 * 
 * Integrates test coverage enforcement into the migration workflow.
 * Coordinates between TestRequirementAnalyzer, pgTAPTestScanner, and CoverageEnforcer
 * to ensure adequate test coverage before allowing database deployments.
 * 
 * @module TestCoverageOrchestrator
 */

const { EventEmitter } = require('events');
const TestRequirementAnalyzer = require('./TestRequirementAnalyzer');
const pgTAPTestScanner = require('./pgTAPTestScanner');
const CoverageEnforcer = require('./CoverageEnforcer');
const TestTemplateGenerator = require('./TestTemplateGenerator');
const path = require('path');
const fs = require('fs').promises;

/**
 * @typedef {Object} CoverageCheckResult
 * @property {boolean} passed - Whether coverage check passed
 * @property {number} coveragePercentage - Overall coverage percentage
 * @property {Array} gaps - Coverage gaps identified
 * @property {Array} suggestions - Test suggestions for gaps
 * @property {boolean} shouldBlock - Whether deployment should be blocked
 * @property {string} [bypassReason] - Reason if coverage was bypassed
 */

/**
 * @typedef {Object} OrchestratorOptions
 * @property {string} [testsDir] - Directory containing pgTAP tests
 * @property {string} [sqlDir] - Directory containing SQL files
 * @property {string} [enforcementLevel] - Enforcement level (strict, normal, lenient)
 * @property {boolean} [generateTemplates] - Whether to generate test templates for gaps
 * @property {Object} [thresholds] - Coverage thresholds by object type
 * @property {boolean} [allowBypass] - Whether to allow coverage bypass
 * @property {Function} [logger] - Logger function
 */

class TestCoverageOrchestrator extends EventEmitter {
  /**
   * @param {OrchestratorOptions} options - Orchestrator configuration
   */
  constructor(options = {}) {
    super();
    
    // Configuration
    this.testsDir = options.testsDir || './tests';
    this.sqlDir = options.sqlDir || './sql';
    this.enforcementLevel = options.enforcementLevel || 'normal';
    this.generateTemplates = options.generateTemplates || false;
    this.thresholds = options.thresholds || {};
    this.allowBypass = options.allowBypass || false;
    this.logger = options.logger || console.log;
    
    // Initialize components
    this.analyzer = new TestRequirementAnalyzer();
    this.scanner = new pgTAPTestScanner();
    this.enforcer = new CoverageEnforcer();
    this.generator = new TestTemplateGenerator();
    
    // Wire up event forwarding
    this.setupEventHandlers();
  }
  
  /**
   * Setup event forwarding from sub-components
   */
  setupEventHandlers() {
    // Forward analyzer events
    this.analyzer.on('progress', (data) => 
      this.emit('progress', { component: 'analyzer', ...data }));
    this.analyzer.on('warning', (data) => 
      this.emit('warning', { component: 'analyzer', ...data }));
    
    // Forward scanner events
    this.scanner.on('progress', (data) => 
      this.emit('progress', { component: 'scanner', ...data }));
    this.scanner.on('file', (data) => 
      this.emit('progress', { component: 'scanner', message: `Scanning ${data.file}` }));
    
    // Forward enforcer events
    this.enforcer.on('progress', (data) => 
      this.emit('progress', { component: 'enforcer', ...data }));
    this.enforcer.on('enforcement_failed', (data) => 
      this.emit('enforcement_failed', data));
    this.enforcer.on('enforcement_bypassed', (data) => 
      this.emit('enforcement_bypassed', data));
  }
  
  /**
   * Check test coverage for migration operations
   * @param {Array} operations - Migration operations from AST analysis
   * @param {Object} options - Check options
   * @returns {Promise<CoverageCheckResult>} Coverage check results
   */
  async checkCoverage(operations, options = {}) {
    this.emit('start', { 
      message: 'Starting test coverage analysis',
      operations: operations.length 
    });
    
    try {
      // Step 1: Analyze operations to determine test requirements
      this.emit('progress', { message: 'Analyzing test requirements...' });
      const requirements = await this.analyzeRequirements(operations);
      
      // Step 2: Scan existing tests for coverage
      this.emit('progress', { message: 'Scanning existing test coverage...' });
      const coverage = await this.scanTestCoverage();
      
      // Step 3: Enforce coverage requirements
      this.emit('progress', { message: 'Enforcing coverage requirements...' });
      const enforcement = await this.enforceCoverage(requirements, coverage, options);
      
      // Step 4: Generate templates if requested and there are gaps
      if (this.generateTemplates && enforcement.gaps.length > 0) {
        this.emit('progress', { message: 'Generating test templates for gaps...' });
        const templates = await this.generateTestTemplates(enforcement.gaps);
        enforcement.templates = templates;
      }
      
      // Step 5: Determine final result
      const result = {
        passed: !enforcement.shouldBlock,
        coveragePercentage: enforcement.coveragePercentage,
        gaps: enforcement.gaps,
        suggestions: enforcement.suggestions,
        shouldBlock: enforcement.shouldBlock,
        bypassReason: enforcement.bypassReason,
        templates: enforcement.templates || []
      };
      
      this.emit('complete', {
        message: 'Test coverage analysis complete',
        passed: result.passed,
        coverage: result.coveragePercentage
      });
      
      return result;
      
    } catch (error) {
      this.emit('error', {
        message: 'Test coverage analysis failed',
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Analyze migration operations to determine test requirements
   * @param {Array} operations - Migration operations
   * @returns {Promise<Object>} Test requirements analysis
   */
  async analyzeRequirements(operations) {
    // Use TestRequirementAnalyzer to determine what tests are needed
    const analysis = await this.analyzer.analyzeOperations(operations, {
      includeDataTests: true,
      includeConstraintTests: true,
      includePerformanceTests: this.enforcementLevel === 'strict',
      includeSecurityTests: true
    });
    
    this.emit('progress', {
      message: `Identified ${analysis.requirements.length} test requirements`,
      critical: analysis.summary.criticalCount,
      high: analysis.summary.highCount
    });
    
    return analysis;
  }
  
  /**
   * Scan existing tests for coverage
   * @returns {Promise<Object>} Coverage scan results
   */
  async scanTestCoverage() {
    // Check if tests directory exists
    try {
      await fs.access(this.testsDir);
    } catch (error) {
      this.emit('warning', {
        message: 'Tests directory not found',
        path: this.testsDir
      });
      return { coverage: [], statistics: {} };
    }
    
    // Scan all test files
    await this.scanner.scanDirectory(this.testsDir);
    
    // Build coverage database
    const database = this.scanner.buildCoverageDatabase();
    
    // Get coverage statistics
    const stats = this.scanner.getCoverageStatistics();
    
    this.emit('progress', {
      message: `Found ${stats.totalFiles} test files with ${stats.totalAssertions} assertions`,
      tables: stats.tablesWithTests,
      functions: stats.functionsWithTests,
      policies: stats.policiesWithTests
    });
    
    return {
      coverage: database.objects,
      statistics: stats
    };
  }
  
  /**
   * Enforce coverage requirements
   * @param {Object} requirements - Test requirements analysis
   * @param {Object} coverage - Current test coverage
   * @param {Object} options - Enforcement options
   * @returns {Promise<Object>} Enforcement results
   */
  async enforceCoverage(requirements, coverage, options = {}) {
    // Convert coverage database to format expected by enforcer
    const coverageArray = this.convertCoverageToArray(coverage.coverage);
    
    // Run enforcement
    const enforcement = await this.enforcer.enforce(
      requirements.requirements,
      coverageArray,
      {
        enforcementLevel: options.enforcementLevel || this.enforcementLevel,
        thresholds: options.thresholds || this.thresholds,
        bypassReason: options.bypassReason,
        allowBypass: options.allowBypass !== undefined ? options.allowBypass : this.allowBypass
      }
    );
    
    return enforcement;
  }
  
  /**
   * Generate test templates for coverage gaps
   * @param {Array} gaps - Coverage gaps
   * @returns {Promise<Array>} Generated templates
   */
  async generateTestTemplates(gaps) {
    const templates = [];
    
    for (const gap of gaps) {
      try {
        const template = this.generator.generateTemplate(gap.requirement);
        templates.push({
          requirement: gap.requirement,
          template: template,
          path: this.getTemplateOutputPath(gap.requirement)
        });
      } catch (error) {
        this.emit('warning', {
          message: `Failed to generate template for ${gap.requirement.name}`,
          error: error.message
        });
      }
    }
    
    this.emit('progress', {
      message: `Generated ${templates.length} test templates`
    });
    
    return templates;
  }
  
  /**
   * Convert coverage database to array format
   * @param {Map} coverageMap - Coverage database map
   * @returns {Array} Coverage array
   */
  convertCoverageToArray(coverageMap) {
    const coverageArray = [];
    
    for (const [type, objects] of Object.entries(coverageMap)) {
      for (const [name, data] of Object.entries(objects)) {
        coverageArray.push({
          type: type,
          name: name,
          schema: data.schema || 'public',
          assertions: data.assertions || [],
          files: data.files || []
        });
      }
    }
    
    return coverageArray;
  }
  
  /**
   * Get output path for test template
   * @param {Object} requirement - Test requirement
   * @returns {string} Template output path
   */
  getTemplateOutputPath(requirement) {
    const typeDir = {
      'rpc': '002_rpc_tests',
      'rls': '003_rls_tests',
      'trigger': '004_trigger_tests',
      'constraint': '005_constraint_tests',
      'function': '006_function_tests',
      'table': '001_table_tests',
      'column': '007_column_tests',
      'index': '008_index_tests'
    }[requirement.type] || '999_other_tests';
    
    return path.join(this.testsDir, typeDir, `${requirement.name}.test.sql`);
  }
  
  /**
   * Write test templates to disk
   * @param {Array} templates - Generated templates
   * @returns {Promise<void>}
   */
  async writeTemplates(templates) {
    for (const { template, path: templatePath } of templates) {
      const dir = path.dirname(templatePath);
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      
      // Write template
      await fs.writeFile(templatePath, template, 'utf8');
      
      this.emit('progress', {
        message: `Wrote template to ${templatePath}`
      });
    }
  }
}

module.exports = TestCoverageOrchestrator;