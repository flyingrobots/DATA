/**
 * @fileoverview Test requirement analysis use-case
 * Pure function factory - no I/O, optional event bus
 */

import { TEST_TYPES, TEST_PRIORITIES } from '../domain/testingTypes.js';
import { getRecommendedPatterns } from '../testing/render/renderPattern.js';

/**
 * Events that can be emitted during analysis
 */
export const AnalysisEvents = {
  STARTED: 'TEST_ANALYSIS_STARTED',
  PROGRESS: 'TEST_ANALYSIS_PROGRESS',
  COMPLETE: 'TEST_ANALYSIS_COMPLETE',
  WARNING: 'TEST_ANALYSIS_WARNING'
};

/**
 * Create test requirement analyzer function
 * @param {Object} deps - Dependencies
 * @param {Object} [deps.bus] - Optional event bus for progress
 * @param {Function} [deps.clock] - Optional clock for timestamps
 * @returns {Function} Analyzer function
 */
export function makeAnalyzeTestRequirements({ bus, clock = Date } = {}) {
  /**
   * Analyze operations for test requirements
   * @param {Array<Object>} operations - Migration operations to analyze
   * @param {Object} [context] - Analysis context
   * @returns {Object} Analysis results
   */
  return async function analyzeTestRequirements(operations, context = {}) {
    const startTime = clock.now();

    bus?.emit?.(AnalysisEvents.STARTED, {
      operationCount: operations.length,
      timestamp: startTime
    });

    const requirements = [];
    const summary = {
      totalRequirements: 0,
      byType: {},
      byPriority: {},
      operationsAnalyzed: operations.length
    };
    const suggestions = [];
    const riskAreas = [];
    let estimatedEffort = 0;

    // Analyze each operation
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      bus?.emit?.(AnalysisEvents.PROGRESS, {
        current: i + 1,
        total: operations.length,
        operation: operation.description || operation.sql?.substring(0, 50)
      });

      try {
        const opRequirements = analyzeOperation(operation, context);

        for (const req of opRequirements) {
          requirements.push(req);

          // Update statistics
          summary.byType[req.type] = (summary.byType[req.type] || 0) + 1;
          summary.byPriority[req.priority] = (summary.byPriority[req.priority] || 0) + 1;
          estimatedEffort += estimateTestEffort(req);

          // Check for risks
          if (isHighRisk(operation)) {
            riskAreas.push(operation.description || extractOperationDescription(operation));
          }
        }
      } catch (error) {
        bus?.emit?.(AnalysisEvents.WARNING, {
          message: `Failed to analyze operation: ${error.message}`,
          operation,
          error
        });
      }
    }

    // Generate suggestions based on analysis
    suggestions.push(...generateSuggestions(requirements, summary, riskAreas));

    // Sort requirements by priority
    requirements.sort((a, b) => comparePriority(a.priority, b.priority));

    summary.totalRequirements = requirements.length;

    const result = {
      requirements,
      summary,
      suggestions,
      estimatedEffort: Math.round(estimatedEffort * 10) / 10,
      riskAreas
    };

    bus?.emit?.(AnalysisEvents.COMPLETE, {
      totalRequirements: summary.totalRequirements,
      estimatedEffort: result.estimatedEffort,
      riskAreas: riskAreas.length,
      duration: clock.now() - startTime
    });

    return result;
  };
}

/**
 * Analyze a single operation for test requirements
 * @param {Object} operation - Operation to analyze
 * @param {Object} context - Analysis context
 * @returns {Array<Object>} Test requirements
 */
function analyzeOperation(operation, context) {
  const requirements = [];
  const operationType = categorizeOperation(operation);
  const target = extractTargetObject(operation);
  const basePriority = getBasePriority(operation);

  // Generate requirements based on operation type
  switch (operationType) {
  case 'CREATE_TABLE':
    requirements.push(...generateTableCreationRequirements(operation, target, basePriority));
    break;

  case 'DROP_TABLE':
    requirements.push(...generateTableDropRequirements(operation, target, basePriority));
    break;

  case 'ALTER_TABLE':
    requirements.push(...generateTableAlterRequirements(operation, target, basePriority));
    break;

  case 'CREATE_INDEX':
    requirements.push(...generateIndexRequirements(operation, target, basePriority));
    break;

  case 'CREATE_FUNCTION':
    requirements.push(...generateFunctionRequirements(operation, target, basePriority));
    break;

  case 'CREATE_POLICY':
  case 'ALTER_POLICY':
  case 'DROP_POLICY':
    requirements.push(
      ...generatePolicyRequirements(operation, target, basePriority, operationType)
    );
    break;

  case 'ENABLE_RLS':
  case 'DISABLE_RLS':
    requirements.push(...generateRLSRequirements(operation, target, basePriority, operationType));
    break;

  default:
    requirements.push(...generateGenericRequirements(operation, target, basePriority));
  }

  // Add security tests if needed
  if (requiresSecurityTests(operation)) {
    requirements.push(...generateSecurityRequirements(operation, target, TEST_PRIORITIES.CRITICAL));
  }

  // Enhance requirements with metadata
  for (const req of requirements) {
    req.reason = req.reason || generateTestReason(req, operation);
    req.metadata = { ...req.metadata, operation: operationType };
  }

  return requirements;
}

/**
 * Categorize operation type from SQL
 */
function categorizeOperation(operation) {
  const sql = (operation.sql || '').toUpperCase();

  if (sql.includes('CREATE TABLE')) return 'CREATE_TABLE';
  if (sql.includes('DROP TABLE')) return 'DROP_TABLE';
  if (sql.includes('ALTER TABLE')) return 'ALTER_TABLE';
  if (sql.includes('CREATE INDEX')) return 'CREATE_INDEX';
  if (sql.includes('CREATE FUNCTION')) return 'CREATE_FUNCTION';
  if (sql.includes('CREATE POLICY')) return 'CREATE_POLICY';
  if (sql.includes('ALTER POLICY')) return 'ALTER_POLICY';
  if (sql.includes('DROP POLICY')) return 'DROP_POLICY';
  if (sql.includes('ENABLE ROW LEVEL SECURITY')) return 'ENABLE_RLS';
  if (sql.includes('DISABLE ROW LEVEL SECURITY')) return 'DISABLE_RLS';

  return 'UNKNOWN';
}

/**
 * Extract target object name from SQL
 */
function extractTargetObject(operation) {
  const sql = operation.sql || '';

  // Try various patterns
  const patterns = [
    /(?:TABLE|INDEX|FUNCTION|POLICY|VIEW)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([^\s(]+)/i,
    /ON\s+([^\s(]+)/i,
    /FROM\s+([^\s(]+)/i
  ];

  for (const pattern of patterns) {
    const match = sql.match(pattern);
    if (match) {
      return match[1].replace(/["`]/g, '');
    }
  }

  return 'unknown';
}

/**
 * Get base priority for operation
 */
function getBasePriority(operation) {
  if (operation.type === 'DESTRUCTIVE') return TEST_PRIORITIES.CRITICAL;
  if (operation.type === 'WARNING') return TEST_PRIORITIES.HIGH;
  return TEST_PRIORITIES.MEDIUM;
}

/**
 * Generate requirements for table creation
 */
function generateTableCreationRequirements(operation, target, priority) {
  const [schema, table] = target.includes('.') ? target.split('.') : ['public', target];

  return [
    {
      type: TEST_TYPES.SCHEMA,
      priority,
      description: `Verify table ${target} exists with correct structure`,
      target,
      testCases: [
        'has_table() - table exists',
        'columns_are() - correct columns',
        'col_type_is() - correct types'
      ],
      vars: { schema, table },
      recommendedPatterns: ['table_exists', 'column_type_check']
    }
  ];
}

/**
 * Generate requirements for table drops
 */
function generateTableDropRequirements(operation, target, priority) {
  const [schema, table] = target.includes('.') ? target.split('.') : ['public', target];

  return [
    {
      type: TEST_TYPES.SCHEMA,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify table ${target} is properly dropped`,
      target,
      testCases: [
        'hasnt_table() - table no longer exists',
        'Verify cascade behavior if applicable'
      ],
      vars: { schema, table },
      reason: 'Destructive operations require critical testing'
    }
  ];
}

/**
 * Generate requirements for table alterations
 */
function generateTableAlterRequirements(operation, target, priority) {
  const [schema, table] = target.includes('.') ? target.split('.') : ['public', target];
  const sql = operation.sql || '';
  const requirements = [];

  if (sql.includes('ADD COLUMN')) {
    requirements.push({
      type: TEST_TYPES.SCHEMA,
      priority,
      description: `Verify new column added to ${target}`,
      target,
      testCases: ['has_column() - column exists'],
      vars: { schema, table },
      recommendedPatterns: ['column_exists', 'column_type_check']
    });
  }

  if (sql.includes('DROP COLUMN')) {
    requirements.push({
      type: TEST_TYPES.SCHEMA,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify column dropped from ${target}`,
      target,
      testCases: ['hasnt_column() - column removed'],
      vars: { schema, table }
    });
  }

  if (sql.includes('ALTER COLUMN') && sql.includes('TYPE')) {
    requirements.push({
      type: TEST_TYPES.DATA,
      priority: TEST_PRIORITIES.HIGH,
      description: `Verify data integrity after type change in ${target}`,
      target,
      testCases: ['Data conversion successful', 'No data loss'],
      vars: { schema, table },
      recommendedPatterns: ['data_type_conversion_test']
    });
  }

  return requirements;
}

/**
 * Generate requirements for indexes
 */
function generateIndexRequirements(operation, target, priority) {
  const sql = operation.sql || '';
  const tableMatch = sql.match(/ON\s+([^\s(]+)/i);
  const tableName = tableMatch ? tableMatch[1] : 'unknown';
  const [schema, table] = tableName.includes('.') ? tableName.split('.') : ['public', tableName];

  return [
    {
      type: TEST_TYPES.INDEX,
      priority,
      description: `Verify index ${target} exists and functions correctly`,
      target,
      testCases: [
        'has_index() - index exists',
        'Verify index type if specified',
        'Test query performance improvement'
      ],
      vars: { schema, table, index_name: target },
      recommendedPatterns: ['index_exists', 'index_type_check']
    }
  ];
}

/**
 * Generate requirements for functions
 */
function generateFunctionRequirements(operation, target, priority) {
  const [schema, functionName] = target.includes('.') ? target.split('.') : ['public', target];

  return [
    {
      type: TEST_TYPES.FUNCTION,
      priority,
      description: `Verify function ${target} exists and behaves correctly`,
      target,
      testCases: [
        'has_function() - function exists',
        'Test with valid inputs',
        'Test error handling'
      ],
      vars: { schema, function_name: functionName }
    }
  ];
}

/**
 * Generate requirements for policy operations
 */
function generatePolicyRequirements(operation, target, priority, operationType) {
  const sql = operation.sql || '';
  const tableMatch = sql.match(/ON\s+([^\s(]+)/i);
  const tableName = tableMatch ? tableMatch[1] : 'unknown';
  const [schema, table] = tableName.includes('.') ? tableName.split('.') : ['public', tableName];

  const requirements = [
    {
      type: TEST_TYPES.RLS,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify RLS policy ${target} on ${tableName}`,
      target,
      testCases: [
        'is_rls_enabled() - RLS is active',
        'policy_exists() - policy created/modified',
        'Test with different roles'
      ],
      vars: { schema, table, policy_name: target },
      recommendedPatterns: ['rls_enablement_check', 'policy_exists', 'role_based_access']
    }
  ];

  // Add permission tests for each role
  const roles = ['anon', 'authenticated'];
  for (const role of roles) {
    requirements.push({
      type: TEST_TYPES.PERMISSION,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Test ${target} enforcement for role ${role}`,
      target: `${target}_${role}`,
      testCases: [
        `Test data visibility as ${role}`,
        'Verify authorized operations allowed',
        'Verify unauthorized operations blocked'
      ],
      vars: { schema, table, policy_name: target, role },
      recommendedPatterns: ['role_based_access', 'privilege_escalation_test']
    });
  }

  return requirements;
}

/**
 * Generate requirements for RLS enable/disable
 */
function generateRLSRequirements(operation, target, priority, operationType) {
  const [schema, table] = target.includes('.') ? target.split('.') : ['public', target];
  const isEnabling = operationType === 'ENABLE_RLS';

  return [
    {
      type: TEST_TYPES.RLS,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify RLS ${isEnabling ? 'enabled' : 'disabled'} on ${target}`,
      target,
      testCases: [
        `is_rls_enabled() - RLS is ${isEnabling ? 'active' : 'inactive'}`,
        'Test access patterns after change'
      ],
      vars: { schema, table },
      recommendedPatterns: ['rls_enablement_check', 'service_role_bypass']
    }
  ];
}

/**
 * Generate generic requirements
 */
function generateGenericRequirements(operation, target, priority) {
  return [
    {
      type: TEST_TYPES.SCHEMA,
      priority: TEST_PRIORITIES.LOW,
      description: `Verify operation on ${target}`,
      target,
      testCases: ['Verify operation completed successfully'],
      vars: {},
      reason: 'Generic operation requires basic validation'
    }
  ];
}

/**
 * Generate security-specific requirements
 */
function generateSecurityRequirements(operation, target, priority) {
  return [
    {
      type: TEST_TYPES.PERMISSION,
      priority,
      description: `Security validation for ${target}`,
      target,
      testCases: [
        'Test with different user roles',
        'Verify no privilege escalation',
        'Test SQL injection protection'
      ],
      vars: {},
      recommendedPatterns: ['privilege_escalation_test', 'multi_role_data_isolation']
    }
  ];
}

/**
 * Check if operation requires security tests
 */
function requiresSecurityTests(operation) {
  const sql = (operation.sql || '').toUpperCase();
  return (
    sql.includes('POLICY') ||
    sql.includes('GRANT') ||
    sql.includes('REVOKE') ||
    sql.includes('SECURITY DEFINER')
  );
}

/**
 * Check if operation is high risk
 */
function isHighRisk(operation) {
  const sql = (operation.sql || '').toUpperCase();
  return (
    sql.includes('DROP') ||
    sql.includes('TRUNCATE') ||
    sql.includes('DELETE FROM') ||
    operation.type === 'DESTRUCTIVE'
  );
}

/**
 * Extract operation description
 */
function extractOperationDescription(operation) {
  if (operation.description) return operation.description;
  const sql = (operation.sql || '').substring(0, 50);
  return sql.length === 50 ? sql + '...' : sql;
}

/**
 * Estimate test effort in hours
 */
function estimateTestEffort(requirement) {
  const effortMap = {
    [TEST_PRIORITIES.CRITICAL]: 1.0,
    [TEST_PRIORITIES.HIGH]: 0.75,
    [TEST_PRIORITIES.MEDIUM]: 0.5,
    [TEST_PRIORITIES.LOW]: 0.25
  };
  return effortMap[requirement.priority] || 0.5;
}

/**
 * Generate test reason
 */
function generateTestReason(requirement, operation) {
  if (requirement.reason) return requirement.reason;

  if (operation.type === 'DESTRUCTIVE') {
    return 'Destructive operations require comprehensive testing';
  }

  if (requirement.type === TEST_TYPES.RLS || requirement.type === TEST_TYPES.PERMISSION) {
    return 'Security-critical functionality requires thorough validation';
  }

  return `Verify ${requirement.type.toLowerCase()} changes are correctly applied`;
}

/**
 * Generate suggestions based on analysis
 */
function generateSuggestions(requirements, summary, riskAreas) {
  const suggestions = [];

  if (riskAreas.length > 0) {
    suggestions.push(
      `⚠️ High-risk operations detected: ${riskAreas.length} destructive changes require careful testing`
    );
  }

  if (summary.byType[TEST_TYPES.RLS] > 0 || summary.byType[TEST_TYPES.PERMISSION] > 0) {
    suggestions.push(
      '🔒 Security tests required: Test with multiple user roles and verify access controls'
    );
  }

  if (summary.byPriority[TEST_PRIORITIES.CRITICAL] > 5) {
    suggestions.push(
      `🚨 ${summary.byPriority[TEST_PRIORITIES.CRITICAL]} critical tests required - allocate sufficient testing time`
    );
  }

  if (summary.totalRequirements === 0) {
    suggestions.push(
      'ℹ️ No specific test requirements identified - consider adding basic validation tests'
    );
  }

  return suggestions;
}

/**
 * Compare priorities for sorting
 */
function comparePriority(a, b) {
  const order = {
    [TEST_PRIORITIES.CRITICAL]: 0,
    [TEST_PRIORITIES.HIGH]: 1,
    [TEST_PRIORITIES.MEDIUM]: 2,
    [TEST_PRIORITIES.LOW]: 3
  };
  return order[a] - order[b];
}
