/**
 * Schema Diff Analyzer for D.A.T.A.
 *
 * Analyzes migration operations for risk assessment, performance impact,
 * and provides intelligent recommendations for safer deployments.
 *
 * @module SchemaDiffAnalyzer
 */

const { EventEmitter } = require('events');

/**
 * Risk levels for migration operations
 * @readonly
 * @enum {string}
 */
const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

/**
 * Performance impact levels
 * @readonly
 * @enum {string}
 */
const PERFORMANCE_IMPACT = {
  NONE: 'NONE',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

/**
 * Migration analysis result
 * @typedef {Object} MigrationAnalysis
 * @property {string} riskLevel - Overall risk level
 * @property {string} performanceImpact - Performance impact level
 * @property {number} estimatedDuration - Estimated duration in minutes
 * @property {Array} recommendations - Array of recommendation objects
 * @property {Array} warnings - Array of warning objects
 * @property {Object} statistics - Migration statistics
 * @property {boolean} requiresDowntime - Whether migration requires downtime
 * @property {Array} rollbackPlan - Rollback recommendations
 */

class SchemaDiffAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();

    // Risk assessment thresholds
    this.thresholds = {
      largeTable: options.largeTableRows || 1000000, // 1M rows
      slowQuery: options.slowQueryTime || 30, // 30 seconds
      indexCreation: options.indexCreationTime || 60, // 1 minute per 100k rows
      ...options.thresholds
    };

    // Known high-impact operations
    this.highRiskPatterns = [
      'DROP TABLE',
      'DROP COLUMN',
      'TRUNCATE',
      'DELETE FROM',
      'ALTER COLUMN.*TYPE',
      'DROP CONSTRAINT',
      'ALTER TABLE.*ALTER COLUMN.*NOT NULL'
    ];

    // Performance-impacting operations
    this.performancePatterns = [
      'CREATE INDEX',
      'CREATE UNIQUE INDEX',
      'ALTER TABLE.*ADD CONSTRAINT',
      'VACUUM',
      'ANALYZE',
      'REINDEX'
    ];

    // Supabase-specific patterns
    this.supabasePatterns = {
      rls: /CREATE POLICY|ALTER POLICY|DROP POLICY/i,
      auth: /auth\.(users|refresh_tokens|audit_log_entries)/i,
      storage: /storage\.(buckets|objects)/i,
      realtime: /realtime\.(subscription)/i
    };
  }

  /**
   * Analyze migration operations for risks and recommendations
   * @param {Array} operations - Array of migration operations
   * @param {Object} context - Migration context (SQL, environment, etc.)
   * @returns {Promise<MigrationAnalysis>} Analysis results
   */
  async analyzeMigration(operations, context = {}) {
    this.emit('progress', { message: 'Analyzing migration operations...' });

    const analysis = {
      riskLevel: RISK_LEVELS.LOW,
      performanceImpact: PERFORMANCE_IMPACT.NONE,
      estimatedDuration: 0,
      recommendations: [],
      warnings: [],
      statistics: this.calculateStatistics(operations),
      requiresDowntime: false,
      rollbackPlan: []
    };

    // Analyze each operation
    for (const operation of operations) {
      const opAnalysis = await this.analyzeOperation(operation, context);

      // Update overall risk level
      if (this.compareRiskLevels(opAnalysis.riskLevel, analysis.riskLevel) > 0) {
        analysis.riskLevel = opAnalysis.riskLevel;
      }

      // Update performance impact
      if (this.comparePerformanceImpact(opAnalysis.performanceImpact, analysis.performanceImpact) > 0) {
        analysis.performanceImpact = opAnalysis.performanceImpact;
      }

      // Accumulate duration
      analysis.estimatedDuration += opAnalysis.estimatedDuration;

      // Collect recommendations and warnings
      analysis.recommendations.push(...opAnalysis.recommendations);
      analysis.warnings.push(...opAnalysis.warnings);

      // Check if requires downtime
      if (opAnalysis.requiresDowntime) {
        analysis.requiresDowntime = true;
      }

      // Add to rollback plan
      if (opAnalysis.rollbackStep) {
        analysis.rollbackPlan.push(opAnalysis.rollbackStep);
      }
    }

    // Generate overall recommendations
    analysis.recommendations.push(...this.generateOverallRecommendations(analysis, context));

    // Sort recommendations by priority
    analysis.recommendations.sort((a, b) => this.comparePriority(a.priority, b.priority));

    this.emit('complete', {
      message: 'Migration analysis complete',
      riskLevel: analysis.riskLevel,
      operations: operations.length,
      estimatedDuration: analysis.estimatedDuration
    });

    return analysis;
  }

  /**
   * Analyze a single migration operation
   * @param {Object} operation - Migration operation
   * @param {Object} context - Migration context
   * @returns {Promise<Object>} Operation analysis
   */
  async analyzeOperation(operation, context) {
    const analysis = {
      riskLevel: this.assessOperationRisk(operation),
      performanceImpact: this.assessPerformanceImpact(operation),
      estimatedDuration: this.estimateDuration(operation, context),
      recommendations: [],
      warnings: [],
      requiresDowntime: false,
      rollbackStep: null
    };

    // Risk-specific analysis
    if (operation.type === 'DESTRUCTIVE') {
      analysis.recommendations.push({
        type: 'BACKUP',
        priority: 'HIGH',
        message: 'Create full database backup before executing destructive operation',
        operation: operation.description
      });

      analysis.warnings.push({
        type: 'DATA_LOSS',
        message: `${operation.description} may result in permanent data loss`,
        severity: 'CRITICAL'
      });

      analysis.rollbackStep = {
        description: `Manual intervention required to reverse: ${operation.description}`,
        manual: true
      };
    }

    // Column type changes
    if (this.matchesPattern(operation.sql, 'ALTER COLUMN.*TYPE')) {
      analysis.recommendations.push({
        type: 'TYPE_SAFETY',
        priority: 'MEDIUM',
        message: 'Verify data compatibility before changing column type',
        operation: operation.description
      });

      analysis.warnings.push({
        type: 'TYPE_CONVERSION',
        message: 'Column type change may fail if existing data is incompatible',
        severity: 'WARNING'
      });
    }

    // Index creation
    if (this.matchesPattern(operation.sql, 'CREATE.*INDEX')) {
      const concurrent = operation.sql.includes('CONCURRENTLY');

      if (!concurrent && context.isProd) {
        analysis.recommendations.push({
          type: 'CONCURRENT_INDEX',
          priority: 'HIGH',
          message: 'Use CREATE INDEX CONCURRENTLY in production to avoid locks',
          operation: operation.description
        });

        analysis.requiresDowntime = true;
      }

      analysis.warnings.push({
        type: 'INDEX_CREATION',
        message: 'Index creation may take significant time on large tables',
        severity: 'INFO'
      });
    }

    // NOT NULL constraints
    if (this.matchesPattern(operation.sql, 'ALTER COLUMN.*SET NOT NULL')) {
      analysis.recommendations.push({
        type: 'NULL_CHECK',
        priority: 'HIGH',
        message: 'Ensure no NULL values exist before adding NOT NULL constraint',
        operation: operation.description
      });

      analysis.warnings.push({
        type: 'CONSTRAINT_FAILURE',
        message: 'NOT NULL constraint will fail if NULL values exist',
        severity: 'WARNING'
      });
    }

    // RLS Policy changes (Supabase-specific)
    if (this.supabasePatterns.rls.test(operation.sql)) {
      if (operation.sql.includes('DROP POLICY')) {
        analysis.warnings.push({
          type: 'SECURITY',
          message: 'Removing RLS policy may expose data - verify security implications',
          severity: 'HIGH'
        });
      }

      analysis.recommendations.push({
        type: 'RLS_TESTING',
        priority: 'MEDIUM',
        message: 'Test RLS policies with different user roles before deployment',
        operation: operation.description
      });
    }

    // Function changes
    if (this.matchesPattern(operation.sql, 'CREATE OR REPLACE FUNCTION')) {
      analysis.recommendations.push({
        type: 'FUNCTION_TESTING',
        priority: 'MEDIUM',
        message: 'Test function changes thoroughly, especially if used in triggers',
        operation: operation.description
      });
    }

    return analysis;
  }

  /**
   * Assess the risk level of an operation
   * @param {Object} operation - Migration operation
   * @returns {string} Risk level
   */
  assessOperationRisk(operation) {
    if (operation.type === 'DESTRUCTIVE') {
      return RISK_LEVELS.CRITICAL;
    }

    if (operation.type === 'WARNING') {
      // Check specific patterns for risk escalation
      if (this.matchesPattern(operation.sql, 'ALTER COLUMN.*TYPE')) {
        return RISK_LEVELS.HIGH;
      }

      if (this.matchesPattern(operation.sql, 'DROP POLICY')) {
        return RISK_LEVELS.HIGH; // Security risk
      }

      return RISK_LEVELS.MEDIUM;
    }

    // SAFE operations can still have some risk
    if (this.matchesPattern(operation.sql, 'CREATE.*INDEX')) {
      return RISK_LEVELS.LOW; // Performance risk but safe
    }

    return RISK_LEVELS.LOW;
  }

  /**
   * Assess performance impact of operation
   * @param {Object} operation - Migration operation
   * @returns {string} Performance impact level
   */
  assessPerformanceImpact(operation) {
    for (const pattern of this.performancePatterns) {
      if (this.matchesPattern(operation.sql, pattern)) {
        if (pattern.includes('INDEX')) {
          return PERFORMANCE_IMPACT.HIGH;
        }
        return PERFORMANCE_IMPACT.MEDIUM;
      }
    }

    // Lock-inducing operations
    if (this.matchesPattern(operation.sql, 'ALTER TABLE.*ADD COLUMN.*NOT NULL')) {
      return PERFORMANCE_IMPACT.MEDIUM;
    }

    return PERFORMANCE_IMPACT.LOW;
  }

  /**
   * Estimate operation duration in minutes
   * @param {Object} operation - Migration operation
   * @param {Object} context - Migration context
   * @returns {number} Estimated duration in minutes
   */
  estimateDuration(operation, context) {
    // Base duration
    let duration = 0.1; // 6 seconds minimum

    // Index creation - estimate based on table size
    if (this.matchesPattern(operation.sql, 'CREATE.*INDEX')) {
      const concurrent = operation.sql.includes('CONCURRENTLY');
      duration = concurrent ? 5 : 2; // Concurrent takes longer but safer

      // If we know table size, adjust estimate
      if (context.tableStats) {
        const tableName = this.extractTableName(operation.sql);
        const stats = context.tableStats[tableName];
        if (stats && stats.rows > 100000) {
          duration *= Math.log10(stats.rows / 100000) + 1;
        }
      }
    }

    // Column type changes
    else if (this.matchesPattern(operation.sql, 'ALTER COLUMN.*TYPE')) {
      duration = 1; // Depends on table size and type conversion
    }

    // NOT NULL constraints require table scan
    else if (this.matchesPattern(operation.sql, 'ALTER COLUMN.*NOT NULL')) {
      duration = 0.5; // Table scan required
    }

    // Function/view changes are usually fast
    else if (this.matchesPattern(operation.sql, 'CREATE.*FUNCTION|CREATE.*VIEW')) {
      duration = 0.1;
    }

    // RLS policies are fast
    else if (this.supabasePatterns.rls.test(operation.sql)) {
      duration = 0.1;
    }

    return Math.round(duration * 10) / 10; // Round to 1 decimal
  }

  /**
   * Generate overall recommendations based on analysis
   * @param {Object} analysis - Current analysis state
   * @param {Object} context - Migration context
   * @returns {Array} Array of recommendations
   */
  generateOverallRecommendations(analysis, context) {
    const recommendations = [];

    // High-risk migration recommendations
    if (analysis.riskLevel === RISK_LEVELS.CRITICAL) {
      recommendations.push({
        type: 'DEPLOYMENT_STRATEGY',
        priority: 'CRITICAL',
        message: 'Consider blue-green deployment or maintenance window for critical operations'
      });
    }

    // Performance recommendations
    if (analysis.performanceImpact === PERFORMANCE_IMPACT.HIGH) {
      recommendations.push({
        type: 'MAINTENANCE_WINDOW',
        priority: 'HIGH',
        message: 'Schedule during low-traffic period due to high performance impact'
      });
    }

    // Long-running migration recommendations
    if (analysis.estimatedDuration > 30) {
      recommendations.push({
        type: 'MONITORING',
        priority: 'MEDIUM',
        message: 'Monitor migration progress and database performance during execution'
      });
    }

    // Production-specific recommendations
    if (context.isProd) {
      if (analysis.riskLevel !== RISK_LEVELS.LOW) {
        recommendations.push({
          type: 'STAGING_TEST',
          priority: 'HIGH',
          message: 'Test migration on staging environment with production-like data'
        });
      }

      recommendations.push({
        type: 'ROLLBACK_PLAN',
        priority: 'MEDIUM',
        message: 'Prepare rollback plan and verify rollback procedures'
      });
    }

    // Multiple destructive operations
    const destructiveCount = analysis.statistics.destructiveOperations;
    if (destructiveCount > 1) {
      recommendations.push({
        type: 'PHASED_DEPLOYMENT',
        priority: 'HIGH',
        message: `Consider breaking ${destructiveCount} destructive operations into separate deployments`
      });
    }

    return recommendations;
  }

  /**
   * Calculate migration statistics
   * @param {Array} operations - Migration operations
   * @returns {Object} Statistics object
   */
  calculateStatistics(operations) {
    const stats = {
      totalOperations: operations.length,
      safeOperations: 0,
      warningOperations: 0,
      destructiveOperations: 0,
      newTables: 0,
      droppedTables: 0,
      newColumns: 0,
      droppedColumns: 0,
      newIndexes: 0,
      droppedIndexes: 0,
      newFunctions: 0,
      droppedFunctions: 0,
      rlsPolicies: 0
    };

    for (const op of operations) {
      // Count by risk type
      if (op.type === 'SAFE') stats.safeOperations++;
      else if (op.type === 'WARNING') stats.warningOperations++;
      else if (op.type === 'DESTRUCTIVE') stats.destructiveOperations++;

      // Count specific operations
      const sql = op.sql.toUpperCase();
      if (sql.includes('CREATE TABLE')) stats.newTables++;
      if (sql.includes('DROP TABLE')) stats.droppedTables++;
      if (sql.includes('ADD COLUMN')) stats.newColumns++;
      if (sql.includes('DROP COLUMN')) stats.droppedColumns++;
      if (sql.includes('CREATE INDEX') || sql.includes('CREATE UNIQUE INDEX')) stats.newIndexes++;
      if (sql.includes('DROP INDEX')) stats.droppedIndexes++;
      if (sql.includes('CREATE FUNCTION') || sql.includes('CREATE OR REPLACE FUNCTION')) stats.newFunctions++;
      if (sql.includes('DROP FUNCTION')) stats.droppedFunctions++;
      if (sql.includes('CREATE POLICY') || sql.includes('DROP POLICY')) stats.rlsPolicies++;
    }

    return stats;
  }

  /**
   * Helper methods
   */

  matchesPattern(sql, pattern) {
    const regex = new RegExp(pattern, 'i');
    return regex.test(sql);
  }

  extractTableName(sql) {
    // Simple table name extraction - could be more sophisticated
    const match = sql.match(/(?:CREATE INDEX.*ON|ALTER TABLE|DROP TABLE)\s+([^\s(]+)/i);
    return match ? match[1] : null;
  }

  compareRiskLevels(level1, level2) {
    const levels = [RISK_LEVELS.LOW, RISK_LEVELS.MEDIUM, RISK_LEVELS.HIGH, RISK_LEVELS.CRITICAL];
    return levels.indexOf(level1) - levels.indexOf(level2);
  }

  comparePerformanceImpact(impact1, impact2) {
    const impacts = [PERFORMANCE_IMPACT.NONE, PERFORMANCE_IMPACT.LOW, PERFORMANCE_IMPACT.MEDIUM, PERFORMANCE_IMPACT.HIGH];
    return impacts.indexOf(impact1) - impacts.indexOf(impact2);
  }

  comparePriority(priority1, priority2) {
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return priorities.indexOf(priority2) - priorities.indexOf(priority1); // Reverse order (highest first)
  }
}

module.exports = {
  SchemaDiffAnalyzer,
  RISK_LEVELS,
  PERFORMANCE_IMPACT
};
