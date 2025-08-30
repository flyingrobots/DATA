/**
 * Coverage Enforcer for D.A.T.A.
 * 
 * Main enforcement engine that compares required vs actual coverage and 
 * enforces coverage policies to prevent deployment of untested database changes.
 * 
 * @module CoverageEnforcer
 */

const { EventEmitter } = require('events');

/**
 * Coverage enforcement levels
 * @readonly
 * @enum {string}
 */
const ENFORCEMENT_LEVELS = {
  STRICT: 'STRICT',     // Block any missing coverage
  NORMAL: 'NORMAL',     // Block critical missing coverage
  LENIENT: 'LENIENT'    // Warn but allow deployment
};

/**
 * Coverage gap severity levels
 * @readonly
 * @enum {string}
 */
const GAP_SEVERITY = {
  CRITICAL: 'CRITICAL', // Destructive operations without tests
  HIGH: 'HIGH',         // New tables/functions without tests
  MEDIUM: 'MEDIUM',     // Column/index changes without tests
  LOW: 'LOW'            // Minor changes without tests
};

/**
 * Test requirement object
 * @typedef {Object} TestRequirement
 * @property {string} type - Type of requirement (table, column, function, etc.)
 * @property {string} name - Name of the database object
 * @property {string} schema - Schema name
 * @property {string} operation - Operation type (CREATE, ALTER, DROP)
 * @property {string} severity - Severity level (CRITICAL, HIGH, MEDIUM, LOW)
 * @property {Array<string>} requiredTests - Specific tests required
 * @property {Object} metadata - Additional metadata about the requirement
 */

/**
 * Coverage result object
 * @typedef {Object} CoverageResult
 * @property {string} type - Type of coverage (table, column, function, etc.)
 * @property {string} name - Name of the tested object
 * @property {string} schema - Schema name
 * @property {Array<string>} tests - Tests that provide coverage
 * @property {Object} metadata - Additional metadata about the coverage
 */

/**
 * Coverage gap object
 * @typedef {Object} CoverageGap
 * @property {TestRequirement} requirement - The requirement that's not met
 * @property {string} severity - Gap severity level
 * @property {string} message - Human-readable description of the gap
 * @property {Array<string>} suggestions - Suggested test functions to add
 * @property {boolean} isBlocking - Whether this gap should block deployment
 */

/**
 * Coverage enforcement report
 * @typedef {Object} CoverageReport
 * @property {string} enforcementLevel - Level used for enforcement
 * @property {number} totalRequirements - Total test requirements
 * @property {number} metRequirements - Requirements with coverage
 * @property {number} coveragePercentage - Overall coverage percentage
 * @property {Array<CoverageGap>} gaps - Coverage gaps identified
 * @property {boolean} shouldBlock - Whether deployment should be blocked
 * @property {Array} recommendations - Recommendations for improving coverage
 * @property {Object} statistics - Detailed coverage statistics
 */

/**
 * Coverage enforcement configuration
 * @typedef {Object} EnforcementConfig
 * @property {string} level - Enforcement level (STRICT, NORMAL, LENIENT)
 * @property {Object} thresholds - Coverage thresholds by object type
 * @property {Array<string>} ignoredSchemas - Schemas to ignore during enforcement
 * @property {Array<string>} ignoredTables - Tables to ignore during enforcement
 * @property {boolean} allowBypass - Whether bypass is allowed
 * @property {string} bypassReason - Required reason for bypass
 */

class CoverageEnforcer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Default enforcement configuration
    this.config = {
      level: options.level || ENFORCEMENT_LEVELS.NORMAL,
      thresholds: {
        overall: options.overallThreshold || 80,
        tables: options.tableThreshold || 90,
        functions: options.functionThreshold || 85,
        policies: options.policyThreshold || 90,
        ...options.thresholds
      },
      ignoredSchemas: options.ignoredSchemas || ['information_schema', 'pg_catalog'],
      ignoredTables: options.ignoredTables || [],
      allowBypass: options.allowBypass !== false,
      bypassReason: options.bypassReason || null,
      ...options
    };
    
    // Severity mapping for different operations
    this.operationSeverity = {
      'DROP_TABLE': GAP_SEVERITY.CRITICAL,
      'DROP_COLUMN': GAP_SEVERITY.CRITICAL,
      'TRUNCATE_TABLE': GAP_SEVERITY.CRITICAL,
      'CREATE_TABLE': GAP_SEVERITY.HIGH,
      'CREATE_FUNCTION': GAP_SEVERITY.HIGH,
      'ALTER_TABLE': GAP_SEVERITY.MEDIUM,
      'ALTER_COLUMN': GAP_SEVERITY.MEDIUM,
      'CREATE_INDEX': GAP_SEVERITY.MEDIUM,
      'CREATE_POLICY': GAP_SEVERITY.HIGH,
      'DROP_POLICY': GAP_SEVERITY.CRITICAL,
      'DEFAULT': GAP_SEVERITY.LOW
    };
    
    // Test suggestions by object type
    this.testSuggestions = {
      table: ['has_table', 'table_privs_are', 'tables_are'],
      column: ['has_column', 'col_type_is', 'col_is_null', 'col_not_null'],
      function: ['has_function', 'function_returns', 'function_lang_is'],
      index: ['has_index', 'index_is_unique', 'index_is_primary'],
      policy: ['policy_exists', 'policy_cmd_is', 'policy_role_is'],
      trigger: ['has_trigger', 'trigger_is']
    };
  }
  
  /**
   * Main enforcement method - compares requirements vs coverage
   * @param {Array<TestRequirement>} requirements - Test requirements from analyzer
   * @param {Array<CoverageResult>} coverage - Actual coverage from scanner
   * @param {EnforcementConfig} options - Enforcement options
   * @returns {Promise<CoverageReport>} Enforcement report
   */
  async enforce(requirements, coverage, options = {}) {
    this.emit('progress', { message: 'Starting coverage enforcement analysis...' });
    
    // Merge options with config
    const config = { ...this.config, ...options };
    
    // Filter ignored items
    const filteredRequirements = this.filterRequirements(requirements, config);
    const filteredCoverage = this.filterCoverage(coverage, config);
    
    this.emit('progress', { 
      message: `Analyzing ${filteredRequirements.length} requirements against ${filteredCoverage.length} coverage items` 
    });
    
    // Compare coverage
    const comparison = await this.compareCoverage(filteredRequirements, filteredCoverage);
    
    // Analyze gaps
    const gaps = this.analyzeGaps(comparison.unmetRequirements, config);
    
    // Determine if deployment should be blocked
    const shouldBlock = this.shouldBlock(gaps, config);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(gaps, comparison, config);
    
    // Calculate statistics
    const statistics = this.calculateStatistics(filteredRequirements, filteredCoverage, gaps);
    
    const report = {
      enforcementLevel: config.level,
      totalRequirements: filteredRequirements.length,
      metRequirements: comparison.metRequirements.length,
      coveragePercentage: Math.round((comparison.metRequirements.length / filteredRequirements.length) * 100) || 0,
      gaps: gaps,
      shouldBlock: shouldBlock,
      recommendations: recommendations,
      statistics: statistics,
      bypassReason: config.bypassReason || null
    };
    
    // Emit appropriate events
    if (shouldBlock) {
      this.emit('enforcement_failed', {
        message: 'Coverage enforcement failed - deployment blocked',
        gaps: gaps.length,
        coverage: report.coveragePercentage
      });
    } else {
      this.emit('enforcement_passed', {
        message: 'Coverage enforcement passed',
        coverage: report.coveragePercentage,
        gaps: gaps.length
      });
    }
    
    this.emit('complete', {
      message: 'Coverage enforcement analysis complete',
      shouldBlock: shouldBlock,
      gaps: gaps.length,
      coverage: report.coveragePercentage
    });
    
    return report;
  }
  
  /**
   * Generate normalized coverage key for consistent lookups
   * @param {Object} item - Item with schema, name, and type
   * @returns {string} Normalized key
   * @private
   */
  _generateCoverageKey(item) {
    // Normalize schema (default to 'public' per PostgreSQL convention)
    const schema = (item.schema || 'public').toLowerCase().trim();
    
    // Normalize name and type
    const name = (item.name || '').toLowerCase().trim();
    const type = (item.type || '').toLowerCase().trim();
    
    // Validate components
    if (!name) {
      throw new Error(`Invalid coverage item: missing name property`);
    }
    if (!type) {
      throw new Error(`Invalid coverage item: missing type property`);
    }
    
    // Use separator that won't appear in PostgreSQL identifiers
    const separator = '::';
    
    // Escape any separator sequences in the components (shouldn't happen in valid identifiers)
    const escapedSchema = schema.replace(/::/g, '\\:\\:');
    const escapedName = name.replace(/::/g, '\\:\\:');
    const escapedType = type.replace(/::/g, '\\:\\:');
    
    return `${escapedSchema}${separator}${escapedName}${separator}${escapedType}`;
  }

  /**
   * Compare required vs actual coverage
   * @param {Array<TestRequirement>} requirements - Test requirements
   * @param {Array<CoverageResult>} coverage - Actual coverage
   * @returns {Object} Comparison results
   */
  compareCoverage(requirements, coverage) {
    this.emit('progress', { message: 'Comparing requirements against actual coverage...' });
    
    // Build coverage lookup for efficient matching
    const coverageLookup = new Map();
    coverage.forEach(item => {
      try {
        const key = this._generateCoverageKey(item);
        if (!coverageLookup.has(key)) {
          coverageLookup.set(key, []);
        }
        coverageLookup.get(key).push(item);
      } catch (error) {
        this.emit('warning', { 
          message: `Skipping invalid coverage item: ${error.message}`,
          item: item 
        });
      }
    });
    
    const metRequirements = [];
    const unmetRequirements = [];
    
    for (const requirement of requirements) {
      try {
        const key = this._generateCoverageKey(requirement);
        const matchingCoverage = coverageLookup.get(key) || [];
      
        if (this.isRequirementMet(requirement, matchingCoverage)) {
          metRequirements.push({
            requirement: requirement,
            coverage: matchingCoverage
          });
        } else {
          unmetRequirements.push({
            requirement: requirement,
            coverage: matchingCoverage
          });
        }
      } catch (error) {
        this.emit('warning', {
          message: `Error processing requirement: ${error.message}`,
          requirement: requirement
        });
        // Treat as unmet if we can't process it
        unmetRequirements.push({
          requirement: requirement,
          coverage: [],
          error: error.message
        });
      }
    }
    
    return {
      metRequirements: metRequirements,
      unmetRequirements: unmetRequirements,
      coverageLookup: coverageLookup
    };
  }
  
  /**
   * Check if a requirement is met by available coverage
   * @param {TestRequirement} requirement - The requirement to check
   * @param {Array<CoverageResult>} coverage - Available coverage
   * @returns {boolean} Whether requirement is met
   */
  isRequirementMet(requirement, coverage) {
    if (!coverage || coverage.length === 0) {
      return false;
    }
    
    // For basic requirements, any coverage is sufficient
    if (!requirement.requiredTests || requirement.requiredTests.length === 0) {
      return true;
    }
    
    // Check for specific required tests
    const availableTests = new Set();
    coverage.forEach(item => {
      if (item.tests) {
        item.tests.forEach(test => availableTests.add(test));
      }
    });
    
    // All required tests must be present
    return requirement.requiredTests.every(requiredTest => 
      availableTests.has(requiredTest)
    );
  }
  
  /**
   * Analyze coverage gaps for severity and blocking status
   * @param {Array} unmetRequirements - Requirements without coverage
   * @param {EnforcementConfig} config - Enforcement configuration
   * @returns {Array<CoverageGap>} Coverage gaps with analysis
   */
  analyzeGaps(unmetRequirements, config) {
    this.emit('progress', { message: 'Analyzing coverage gaps...' });
    
    const gaps = [];
    
    for (const unmet of unmetRequirements) {
      const requirement = unmet.requirement;
      const severity = this.assessGapSeverity(requirement);
      const isBlocking = this.isGapBlocking(severity, config);
      
      const gap = {
        requirement: requirement,
        severity: severity,
        message: this.generateGapMessage(requirement),
        suggestions: this.generateTestSuggestions(requirement),
        isBlocking: isBlocking,
        availableCoverage: unmet.coverage || []
      };
      
      gaps.push(gap);
    }
    
    // Sort gaps by severity (most severe first)
    gaps.sort((a, b) => this.compareSeverity(b.severity, a.severity));
    
    return gaps;
  }
  
  /**
   * Assess the severity of a coverage gap
   * @param {TestRequirement} requirement - The requirement
   * @returns {string} Gap severity level
   */
  assessGapSeverity(requirement) {
    // Use operation-specific severity if available
    const operationSeverity = this.operationSeverity[requirement.operation];
    if (operationSeverity) {
      return operationSeverity;
    }
    
    // Fall back to requirement severity or default
    return requirement.severity || this.operationSeverity.DEFAULT;
  }
  
  /**
   * Determine if a gap should block deployment
   * @param {string} severity - Gap severity
   * @param {EnforcementConfig} config - Enforcement configuration
   * @returns {boolean} Whether gap should block deployment
   */
  isGapBlocking(severity, config) {
    switch (config.level) {
      case ENFORCEMENT_LEVELS.STRICT:
        return true; // Block all gaps
      
      case ENFORCEMENT_LEVELS.NORMAL:
        return severity === GAP_SEVERITY.CRITICAL || severity === GAP_SEVERITY.HIGH;
      
      case ENFORCEMENT_LEVELS.LENIENT:
        return severity === GAP_SEVERITY.CRITICAL;
      
      default:
        return false;
    }
  }
  
  /**
   * Determine if deployment should be blocked based on gaps
   * @param {Array<CoverageGap>} gaps - Coverage gaps
   * @param {EnforcementConfig} config - Enforcement configuration
   * @returns {boolean} Whether to block deployment
   */
  shouldBlock(gaps, config) {
    // Check for bypass
    if (config.allowBypass && config.bypassReason) {
      this.emit('bypass_used', {
        message: 'Coverage enforcement bypassed',
        reason: config.bypassReason,
        gaps: gaps.length
      });
      return false;
    }
    
    // Check if any gaps are blocking
    return gaps.some(gap => gap.isBlocking);
  }
  
  /**
   * Generate coverage gap report
   * @param {Array<CoverageGap>} gaps - Coverage gaps
   * @returns {string} Formatted gap report
   */
  generateReport(gaps) {
    if (!gaps || gaps.length === 0) {
      return '✅ No coverage gaps found - all requirements satisfied!';
    }
    
    const lines = [];
    lines.push(`📊 Coverage Gap Report (${gaps.length} gaps found)\n`);
    
    // Group by severity
    const bySeverity = gaps.reduce((acc, gap) => {
      if (!acc[gap.severity]) acc[gap.severity] = [];
      acc[gap.severity].push(gap);
      return acc;
    }, {});
    
    // Report each severity level
    for (const severity of [GAP_SEVERITY.CRITICAL, GAP_SEVERITY.HIGH, GAP_SEVERITY.MEDIUM, GAP_SEVERITY.LOW]) {
      const severityGaps = bySeverity[severity];
      if (!severityGaps || severityGaps.length === 0) continue;
      
      const icon = this.getSeverityIcon(severity);
      const blockingCount = severityGaps.filter(g => g.isBlocking).length;
      
      lines.push(`${icon} ${severity} (${severityGaps.length} gaps${blockingCount > 0 ? `, ${blockingCount} blocking` : ''})`);
      
      severityGaps.forEach(gap => {
        const blocking = gap.isBlocking ? ' 🚫' : '';
        lines.push(`  • ${gap.message}${blocking}`);
        
        if (gap.suggestions && gap.suggestions.length > 0) {
          lines.push(`    Suggested tests: ${gap.suggestions.join(', ')}`);
        }
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Generate human-readable message for a coverage gap
   * @param {TestRequirement} requirement - The requirement
   * @returns {string} Gap message
   */
  generateGapMessage(requirement) {
    const objectDesc = `${requirement.schema}.${requirement.name}`;
    const operation = requirement.operation?.toLowerCase() || 'change';
    
    switch (requirement.type) {
      case 'table':
        return `Table ${objectDesc} (${operation}) lacks test coverage`;
      case 'column':
        return `Column ${objectDesc} (${operation}) lacks test coverage`;
      case 'function':
        return `Function ${objectDesc} (${operation}) lacks test coverage`;
      case 'policy':
        return `RLS Policy ${objectDesc} (${operation}) lacks test coverage`;
      case 'index':
        return `Index ${objectDesc} (${operation}) lacks test coverage`;
      case 'trigger':
        return `Trigger ${objectDesc} (${operation}) lacks test coverage`;
      default:
        return `${requirement.type} ${objectDesc} (${operation}) lacks test coverage`;
    }
  }
  
  /**
   * Generate test suggestions for a requirement
   * @param {TestRequirement} requirement - The requirement
   * @returns {Array<string>} Suggested test functions
   */
  generateTestSuggestions(requirement) {
    const suggestions = this.testSuggestions[requirement.type] || [];
    
    // Add operation-specific suggestions
    if (requirement.operation === 'CREATE') {
      if (requirement.type === 'table') {
        suggestions.unshift('has_table');
      } else if (requirement.type === 'function') {
        suggestions.unshift('has_function');
      }
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }
  
  /**
   * Generate recommendations for improving coverage
   * @param {Array<CoverageGap>} gaps - Coverage gaps
   * @param {Object} comparison - Coverage comparison results
   * @param {EnforcementConfig} config - Enforcement configuration
   * @returns {Array} Recommendations
   */
  generateRecommendations(gaps, comparison, config) {
    const recommendations = [];
    
    // Critical gaps recommendation
    const criticalGaps = gaps.filter(g => g.severity === GAP_SEVERITY.CRITICAL);
    if (criticalGaps.length > 0) {
      recommendations.push({
        type: 'CRITICAL_COVERAGE',
        priority: 'CRITICAL',
        message: `${criticalGaps.length} critical operations lack test coverage - add tests before deployment`,
        gaps: criticalGaps.length
      });
    }
    
    // High-priority gaps
    const highGaps = gaps.filter(g => g.severity === GAP_SEVERITY.HIGH);
    if (highGaps.length > 0) {
      recommendations.push({
        type: 'HIGH_PRIORITY_COVERAGE',
        priority: 'HIGH',
        message: `${highGaps.length} high-priority changes lack test coverage`,
        gaps: highGaps.length
      });
    }
    
    // Coverage threshold recommendations
    const coveragePercentage = Math.round((comparison.metRequirements.length / (comparison.metRequirements.length + comparison.unmetRequirements.length)) * 100) || 0;
    if (coveragePercentage < config.thresholds.overall) {
      recommendations.push({
        type: 'COVERAGE_THRESHOLD',
        priority: 'MEDIUM',
        message: `Overall coverage (${coveragePercentage}%) is below threshold (${config.thresholds.overall}%)`,
        current: coveragePercentage,
        required: config.thresholds.overall
      });
    }
    
    // Test organization recommendations
    if (gaps.length > 10) {
      recommendations.push({
        type: 'TEST_ORGANIZATION',
        priority: 'MEDIUM',
        message: 'Consider organizing tests by schema or module for better maintainability',
        gaps: gaps.length
      });
    }
    
    // Enforcement level recommendations
    if (config.level === ENFORCEMENT_LEVELS.LENIENT && criticalGaps.length > 0) {
      recommendations.push({
        type: 'ENFORCEMENT_LEVEL',
        priority: 'MEDIUM',
        message: 'Consider using NORMAL or STRICT enforcement for better coverage',
        currentLevel: config.level
      });
    }
    
    return recommendations.sort((a, b) => this.comparePriority(a.priority, b.priority));
  }
  
  /**
   * Calculate detailed coverage statistics
   * @param {Array<TestRequirement>} requirements - All requirements
   * @param {Array<CoverageResult>} coverage - All coverage
   * @param {Array<CoverageGap>} gaps - Coverage gaps
   * @returns {Object} Coverage statistics
   */
  calculateStatistics(requirements, coverage, gaps) {
    const stats = {
      requirements: {
        total: requirements.length,
        byType: this.groupBy(requirements, 'type'),
        bySeverity: this.groupBy(requirements, 'severity'),
        byOperation: this.groupBy(requirements, 'operation')
      },
      coverage: {
        total: coverage.length,
        byType: this.groupBy(coverage, 'type'),
        bySchema: this.groupBy(coverage, 'schema')
      },
      gaps: {
        total: gaps.length,
        bySeverity: this.groupBy(gaps, 'severity'),
        blocking: gaps.filter(g => g.isBlocking).length
      },
      percentages: {
        overall: Math.round(((requirements.length - gaps.length) / requirements.length) * 100) || 0,
        byType: {}
      }
    };
    
    // Calculate coverage percentages by type
    Object.keys(stats.requirements.byType).forEach(type => {
      const totalByType = stats.requirements.byType[type];
      const gapsByType = gaps.filter(g => g.requirement.type === type).length;
      stats.percentages.byType[type] = Math.round(((totalByType - gapsByType) / totalByType) * 100) || 0;
    });
    
    return stats;
  }
  
  /**
   * Filter requirements based on configuration
   * @param {Array<TestRequirement>} requirements - Requirements to filter
   * @param {EnforcementConfig} config - Configuration
   * @returns {Array<TestRequirement>} Filtered requirements
   */
  filterRequirements(requirements, config) {
    return requirements.filter(req => {
      // Filter ignored schemas
      if (config.ignoredSchemas.includes(req.schema)) {
        return false;
      }
      
      // Filter ignored tables
      if (req.type === 'table' && config.ignoredTables.includes(req.name)) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Filter coverage based on configuration
   * @param {Array<CoverageResult>} coverage - Coverage to filter
   * @param {EnforcementConfig} config - Configuration
   * @returns {Array<CoverageResult>} Filtered coverage
   */
  filterCoverage(coverage, config) {
    return coverage.filter(cov => {
      // Filter ignored schemas
      if (config.ignoredSchemas.includes(cov.schema)) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Helper methods
   */
  
  groupBy(array, property) {
    return array.reduce((acc, item) => {
      const key = item[property] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }
  
  getSeverityIcon(severity) {
    switch (severity) {
      case GAP_SEVERITY.CRITICAL: return '🔴';
      case GAP_SEVERITY.HIGH: return '🟠';
      case GAP_SEVERITY.MEDIUM: return '🟡';
      case GAP_SEVERITY.LOW: return '🟢';
      default: return '⚪';
    }
  }
  
  compareSeverity(severity1, severity2) {
    const levels = [GAP_SEVERITY.LOW, GAP_SEVERITY.MEDIUM, GAP_SEVERITY.HIGH, GAP_SEVERITY.CRITICAL];
    return levels.indexOf(severity1) - levels.indexOf(severity2);
  }
  
  comparePriority(priority1, priority2) {
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return priorities.indexOf(priority2) - priorities.indexOf(priority1); // Reverse order (highest first)
  }
}

module.exports = {
  CoverageEnforcer,
  ENFORCEMENT_LEVELS,
  GAP_SEVERITY
};