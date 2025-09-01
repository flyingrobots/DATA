/**
 * Test Requirement Analyzer for D.A.T.A.
 *
 * Analyzes AST migration operations and determines what pgTAP tests are required
 * to ensure database schema changes are properly validated. Maps schema operations
 * to specific test requirements for comprehensive coverage.
 *
 * @module TestRequirementAnalyzer
 */

import { EventEmitter } from 'events';

/**
 * Test requirement types
 * @readonly
 * @enum {string}
 */
const TEST_TYPES = {
  SCHEMA: 'SCHEMA', // Table structure tests
  DATA: 'DATA', // Data integrity tests
  CONSTRAINT: 'CONSTRAINT', // Constraint validation tests
  INDEX: 'INDEX', // Index existence and performance tests
  FUNCTION: 'FUNCTION', // Function behavior tests
  TRIGGER: 'TRIGGER', // Trigger functionality tests
  RLS: 'RLS', // Row Level Security tests
  VIEW: 'VIEW', // View definition tests
  ENUM: 'ENUM', // Enum type tests
  PERMISSION: 'PERMISSION' // Permission and security tests
};

/**
 * Test priority levels
 * @readonly
 * @enum {string}
 */
const TEST_PRIORITIES = {
  CRITICAL: 'CRITICAL', // Must have - blocks deployment
  HIGH: 'HIGH', // Should have - important coverage
  MEDIUM: 'MEDIUM', // Nice to have - good practice
  LOW: 'LOW' // Optional - comprehensive coverage
};

/**
 * Test requirement object
 * @typedef {Object} TestRequirement
 * @property {string} type - Test type from TEST_TYPES
 * @property {string} priority - Test priority from TEST_PRIORITIES
 * @property {string} description - Human-readable description
 * @property {string} target - Target object (table, column, function, etc.)
 * @property {Object} operation - Source migration operation
 * @property {Array<string>} testCases - Suggested test cases to implement
 * @property {Object} metadata - Additional context for test generation
 * @property {string} [reason] - Why this test is required
 * @property {Array<string>} [dependencies] - Other tests this depends on
 */

/**
 * Test analysis result
 * @typedef {Object} TestAnalysis
 * @property {Array<TestRequirement>} requirements - All test requirements
 * @property {Object} summary - Summary statistics
 * @property {Array<string>} suggestions - High-level testing suggestions
 * @property {number} estimatedEffort - Estimated effort in hours
 * @property {Array<string>} riskAreas - Areas requiring extra attention
 */

class TestRequirementAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration options
    this.options = {
      // Test coverage requirements
      requireDataTests: options.requireDataTests !== false, // Default true
      requireConstraintTests: options.requireConstraintTests !== false,
      requirePerformanceTests: options.requirePerformanceTests || false,
      requireSecurityTests: options.requireSecurityTests !== false,

      // Risk-based test priorities
      destructiveOperationPriority:
        options.destructiveOperationPriority || TEST_PRIORITIES.CRITICAL,
      warningOperationPriority: options.warningOperationPriority || TEST_PRIORITIES.HIGH,
      safeOperationPriority: options.safeOperationPriority || TEST_PRIORITIES.MEDIUM,

      // Test complexity thresholds
      maxTestCasesPerRequirement: options.maxTestCasesPerRequirement || 10,
      estimatedEffortPerTest: options.estimatedEffortPerTest || 0.5, // hours

      ...options
    };

    // Operation type to test type mappings
    this.operationTestMappings = this._initializeTestMappings();

    // Risk patterns that require additional testing
    this.highRiskPatterns = [
      /DROP TABLE/i,
      /DROP COLUMN/i,
      /ALTER.*TYPE/i,
      /DROP CONSTRAINT/i,
      /TRUNCATE/i,
      /DELETE FROM/i
    ];

    // Security-sensitive patterns
    this.securityPatterns = [
      /CREATE POLICY|DROP POLICY|ALTER POLICY/i,
      /GRANT|REVOKE/i,
      /auth\.|storage\.|realtime\./i,
      /security_definer|security_invoker/i
    ];
  }

  /**
   * Analyze migration operations for test requirements
   * @param {Array<Object>} operations - Array of migration operations
   * @param {Object} context - Analysis context (environment, options, etc.)
   * @returns {Promise<TestAnalysis>} Analysis results with test requirements
   */
  async analyzeOperations(operations, context = {}) {
    this.emit('progress', {
      message: 'Analyzing operations for test requirements...',
      operations: operations.length
    });

    const analysis = {
      requirements: [],
      summary: {
        totalRequirements: 0,
        byType: {},
        byPriority: {},
        operationsAnalyzed: operations.length
      },
      suggestions: [],
      estimatedEffort: 0,
      riskAreas: []
    };

    // Analyze each operation
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      this.emit('progress', {
        message: `Analyzing operation ${i + 1}/${operations.length}...`,
        operation: operation.description || operation.sql?.substring(0, 50)
      });

      const requirements = await this.determineTestRequirements(operation, context);

      // Add requirements to analysis
      analysis.requirements.push(...requirements);

      // Update statistics
      for (const req of requirements) {
        analysis.summary.byType[req.type] = (analysis.summary.byType[req.type] || 0) + 1;
        analysis.summary.byPriority[req.priority] =
          (analysis.summary.byPriority[req.priority] || 0) + 1;
        analysis.estimatedEffort += this._estimateTestEffort(req);
      }

      // Check for risk areas
      if (this._isHighRiskOperation(operation)) {
        analysis.riskAreas.push(
          operation.description || this._extractOperationDescription(operation)
        );
      }
    }

    // Update total requirements
    analysis.summary.totalRequirements = analysis.requirements.length;

    // Generate high-level suggestions
    analysis.suggestions = this._generateTestingSuggestions(analysis, operations, context);

    // Sort requirements by priority
    analysis.requirements.sort((a, b) => this._comparePriority(a.priority, b.priority));

    this.emit('complete', {
      message: 'Test requirement analysis complete',
      totalRequirements: analysis.summary.totalRequirements,
      estimatedEffort: Math.round(analysis.estimatedEffort * 10) / 10,
      riskAreas: analysis.riskAreas.length
    });

    return analysis;
  }

  /**
   * Validate operation structure before processing
   * @param {Object} operation - Operation to validate
   * @throws {Error} If operation is invalid
   * @private
   */
  _validateOperation(operation) {
    // Check operation is an object
    if (!operation || typeof operation !== 'object') {
      throw new Error('Invalid operation: must be a non-null object');
    }

    // Check required properties
    if (!operation.sql || typeof operation.sql !== 'string') {
      throw new Error(
        `Invalid operation: missing or invalid 'sql' property (got ${typeof operation.sql})`
      );
    }

    if (!operation.type || typeof operation.type !== 'string') {
      throw new Error(
        `Invalid operation: missing or invalid 'type' property (got ${typeof operation.type})`
      );
    }

    // Validate operation type is known
    const validTypes = ['SAFE', 'WARNING', 'DESTRUCTIVE'];
    if (!validTypes.includes(operation.type)) {
      this.emit('warning', {
        message: `Unknown operation type: ${operation.type}`,
        operation,
        validTypes
      });
    }

    // Validate optional properties if present
    if (operation.description && typeof operation.description !== 'string') {
      throw new Error(
        `Invalid operation: 'description' must be a string (got ${typeof operation.description})`
      );
    }

    if (operation.warning && typeof operation.warning !== 'string') {
      throw new Error(
        `Invalid operation: 'warning' must be a string (got ${typeof operation.warning})`
      );
    }

    // Check for malformed SQL (basic validation)
    if (operation.sql.length === 0) {
      throw new Error('Invalid operation: SQL cannot be empty');
    }

    if (operation.sql.length > 100000) {
      throw new Error('Invalid operation: SQL exceeds maximum length (100KB)');
    }

    return true;
  }

  /**
   * Determine test requirements for a single migration operation
   * @param {Object} operation - Migration operation
   * @param {Object} context - Analysis context
   * @returns {Promise<Array<TestRequirement>>} Array of test requirements
   */
  async determineTestRequirements(operation, context = {}) {
    // Validate operation structure first
    try {
      this._validateOperation(operation);
    } catch (error) {
      this.emit('error', {
        message: 'Operation validation failed',
        error: error.message,
        operation
      });
      throw error;
    }

    const requirements = [];

    // Base priority based on operation type
    const basePriority = this._getBasePriority(operation);

    // Extract operation details
    const operationType = this._categorizeOperation(operation);
    const target = this._extractTargetObject(operation);

    // Generate requirements based on operation type
    switch (operationType) {
    case 'CREATE_TABLE':
      requirements.push(...this._generateTableCreationTests(operation, target, basePriority));
      break;

    case 'DROP_TABLE':
      requirements.push(...this._generateTableDropTests(operation, target, basePriority));
      break;

    case 'ALTER_TABLE':
      requirements.push(...this._generateTableAlterationTests(operation, target, basePriority));
      break;

    case 'CREATE_INDEX':
      requirements.push(...this._generateIndexTests(operation, target, basePriority));
      break;

    case 'CREATE_FUNCTION':
      requirements.push(...this._generateFunctionTests(operation, target, basePriority));
      break;

    case 'CREATE_POLICY':
      requirements.push(...this._generateCreatePolicyTests(operation, target, basePriority));
      break;

    case 'ALTER_POLICY':
      requirements.push(...this._generateAlterPolicyTests(operation, target, basePriority));
      break;

    case 'DROP_POLICY':
      requirements.push(...this._generateDropPolicyTests(operation, target, basePriority));
      break;

    case 'ENABLE_RLS':
      requirements.push(...this._generateEnableRLSTests(operation, target, basePriority));
      break;

    case 'DISABLE_RLS':
      requirements.push(...this._generateDisableRLSTests(operation, target, basePriority));
      break;

    case 'CREATE_VIEW':
      requirements.push(...this._generateViewTests(operation, target, basePriority));
      break;

    case 'CREATE_ENUM':
      requirements.push(...this._generateEnumTests(operation, target, basePriority));
      break;

    case 'CREATE_TRIGGER':
      requirements.push(...this._generateTriggerTests(operation, target, basePriority));
      break;

    case 'ALTER_TRIGGER':
      requirements.push(...this._generateTriggerTests(operation, target, basePriority));
      break;

    case 'DROP_TRIGGER':
      requirements.push(...this._generateTriggerTests(operation, target, basePriority));
      break;

    case 'CREATE_EVENT_TRIGGER':
      requirements.push(...this._generateTriggerTests(operation, target, basePriority));
      break;

    default:
      // Generic tests for unclassified operations
      requirements.push(...this._generateGenericTests(operation, target, basePriority));
    }

    // Add security tests for sensitive operations
    if (this._requiresSecurityTests(operation)) {
      requirements.push(...this._generateSecurityTests(operation, target, basePriority));
    }

    // Add performance tests for performance-impacting operations
    if (this.options.requirePerformanceTests && this._requiresPerformanceTests(operation)) {
      requirements.push(...this._generatePerformanceTests(operation, target, basePriority));
    }

    // Enhance requirements with metadata
    for (const req of requirements) {
      req.operation = operation;
      req.reason = req.reason || this._generateTestReason(req, operation);
      req.metadata = req.metadata || this._generateTestMetadata(req, operation, context);
    }

    return requirements;
  }

  /**
   * Initialize operation to test type mappings
   * @private
   * @returns {Object} Mapping configuration
   */
  _initializeTestMappings() {
    return {
      'CREATE TABLE': [TEST_TYPES.SCHEMA, TEST_TYPES.CONSTRAINT],
      'DROP TABLE': [TEST_TYPES.SCHEMA, TEST_TYPES.DATA],
      'ALTER TABLE': [TEST_TYPES.SCHEMA, TEST_TYPES.CONSTRAINT, TEST_TYPES.DATA],
      'CREATE INDEX': [TEST_TYPES.INDEX, TEST_TYPES.SCHEMA],
      'DROP INDEX': [TEST_TYPES.INDEX],
      'CREATE FUNCTION': [TEST_TYPES.FUNCTION],
      'DROP FUNCTION': [TEST_TYPES.FUNCTION],
      'CREATE POLICY': [TEST_TYPES.RLS, TEST_TYPES.PERMISSION],
      'ALTER POLICY': [TEST_TYPES.RLS, TEST_TYPES.PERMISSION],
      'DROP POLICY': [TEST_TYPES.RLS, TEST_TYPES.PERMISSION],
      'ENABLE RLS': [TEST_TYPES.RLS, TEST_TYPES.PERMISSION],
      'DISABLE RLS': [TEST_TYPES.RLS, TEST_TYPES.PERMISSION],
      'CREATE VIEW': [TEST_TYPES.VIEW, TEST_TYPES.SCHEMA],
      'DROP VIEW': [TEST_TYPES.VIEW],
      'CREATE TYPE': [TEST_TYPES.ENUM, TEST_TYPES.SCHEMA],
      'CREATE TRIGGER': [TEST_TYPES.TRIGGER, TEST_TYPES.FUNCTION],
      'DROP TRIGGER': [TEST_TYPES.TRIGGER]
    };
  }

  /**
   * Generate test requirements for table creation
   * @private
   */
  _generateTableCreationTests(operation, target, priority) {
    const requirements = [];
    const sql = operation.sql || '';
    const tableStructure = this._parseTableStructure(sql);

    // Basic table existence test
    requirements.push({
      type: TEST_TYPES.SCHEMA,
      priority,
      description: `Verify table ${target} exists with correct structure`,
      target,
      testCases: [
        `has_table('${target}')`,
        `columns_are('${target}', ARRAY[${tableStructure.columns.map((c) => `'${c.name}'`).join(', ')}])`,
        ...tableStructure.columns.map(
          (col) => `col_type_is('${target}', '${col.name}', '${col.type}')`
        ),
        ...tableStructure.columns
          .filter((col) => col.notNull)
          .map((col) => `col_not_null('${target}', '${col.name}')`),
        ...tableStructure.columns
          .filter((col) => col.hasDefault)
          .map((col) => `col_has_default('${target}', '${col.name}')`)
      ]
    });

    // Primary key tests
    if (tableStructure.primaryKeys.length > 0) {
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify primary key constraints on table ${target}`,
        target,
        testCases: [
          `has_pk('${target}')`,
          ...tableStructure.primaryKeys.map((pk) => `col_is_pk('${target}', '${pk}')`)
        ]
      });
    }

    // Foreign key tests
    if (tableStructure.foreignKeys.length > 0) {
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify foreign key constraints on table ${target}`,
        target,
        testCases: [
          ...tableStructure.foreignKeys.map((fk) => `has_fk('${target}', '${fk.column}')`),
          ...tableStructure.foreignKeys.map(
            (fk) =>
              `fk_ok('${target}', '${fk.column}', '${fk.referencedTable}', '${fk.referencedColumn}')`
          )
        ]
      });
    }

    // Constraint tests (check constraints, unique constraints)
    if (this.options.requireConstraintTests) {
      const constraintTests = [];

      // Check constraints
      tableStructure.checkConstraints.forEach((constraint) => {
        constraintTests.push(`has_check('${target}', '${constraint.name}')`);
      });

      // Unique constraints
      tableStructure.uniqueConstraints.forEach((constraint) => {
        constraintTests.push(`has_unique('${target}', '${constraint.name}')`);
      });

      if (constraintTests.length > 0) {
        requirements.push({
          type: TEST_TYPES.CONSTRAINT,
          priority,
          description: `Verify additional constraints on table ${target}`,
          target,
          testCases: constraintTests
        });
      }
    }

    // Index tests for inline indexes
    if (tableStructure.indexes.length > 0) {
      requirements.push({
        type: TEST_TYPES.INDEX,
        priority,
        description: `Verify indexes created for table ${target}`,
        target,
        testCases: [
          ...tableStructure.indexes.map(
            (idx) =>
              `has_index('${target}', '${idx.name}', ARRAY[${idx.columns.map((c) => `'${c}'`).join(', ')}])`
          )
        ]
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for table drops
   * @private
   */
  _generateTableDropTests(operation, target, priority) {
    const sql = operation.sql || '';
    const isCascade = sql.toUpperCase().includes('CASCADE');

    const testCases = [`hasnt_table('${target}')`, '-- Verify table no longer exists in schema'];

    if (isCascade) {
      testCases.push(
        '-- Verify dependent objects were also dropped (CASCADE)',
        '-- Check that foreign key references are cleaned up',
        '-- Ensure dependent views were dropped',
        '-- Verify dependent functions/triggers were dropped'
      );
    } else {
      testCases.push(
        '-- Verify no dependent objects were affected (RESTRICT)',
        '-- Check that foreign key references are handled properly',
        '-- Ensure operation failed if dependencies existed'
      );
    }

    return [
      {
        type: TEST_TYPES.SCHEMA,
        priority: TEST_PRIORITIES.CRITICAL, // Always critical for destructive ops
        description: `Verify table ${target} is properly dropped${isCascade ? ' with CASCADE' : ''}`,
        target,
        testCases
      }
    ];
  }

  /**
   * Generate test requirements for table alterations
   * @private
   */
  _generateTableAlterationTests(operation, target, priority) {
    const requirements = [];
    const sql = operation.sql || '';
    const alterations = this._parseTableAlterations(sql, target);

    // Handle ADD COLUMN operations
    alterations.addedColumns.forEach((column) => {
      const testCases = [
        `has_column('${target}', '${column.name}')`,
        `col_type_is('${target}', '${column.name}', '${column.type}')`
      ];

      if (column.notNull) {
        testCases.push(`col_not_null('${target}', '${column.name}')`);
      }

      if (column.hasDefault) {
        testCases.push(`col_has_default('${target}', '${column.name}')`);
        if (column.defaultValue) {
          testCases.push(`col_default_is('${target}', '${column.name}', ${column.defaultValue})`);
        }
      }

      // Add foreign key test if it's a reference column
      if (column.foreignKey) {
        testCases.push(`has_fk('${target}', '${column.name}')`);
        testCases.push(
          `fk_ok('${target}', '${column.name}', '${column.foreignKey.referencedTable}', '${column.foreignKey.referencedColumn}')`
        );
      }

      requirements.push({
        type: TEST_TYPES.SCHEMA,
        priority,
        description: `Verify new column '${column.name}' added to ${target}`,
        target,
        testCases
      });
    });

    // Handle DROP COLUMN operations
    alterations.droppedColumns.forEach((columnName) => {
      requirements.push({
        type: TEST_TYPES.SCHEMA,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify column '${columnName}' dropped from ${target}`,
        target,
        testCases: [
          `hasnt_column('${target}', '${columnName}')`,
          '-- Verify remaining columns are intact',
          '-- Check that dependent objects were handled properly'
        ]
      });
    });

    // Handle ALTER COLUMN TYPE operations
    alterations.alteredColumns.forEach((column) => {
      const testCases = [`col_type_is('${target}', '${column.name}', '${column.newType}')`];

      // Add data integrity tests for type changes
      if (column.oldType !== column.newType) {
        testCases.push(
          `-- Test data conversion from ${column.oldType} to ${column.newType}`,
          '-- Verify no data loss occurred during type conversion',
          '-- Test edge cases for type conversion'
        );
      }

      requirements.push({
        type: TEST_TYPES.DATA,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify column '${column.name}' type change in ${target}`,
        target,
        testCases
      });
    });

    // Handle RENAME TABLE operations
    if (alterations.renamedTo) {
      requirements.push({
        type: TEST_TYPES.SCHEMA,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify table renamed from ${target} to ${alterations.renamedTo}`,
        target: alterations.renamedTo,
        testCases: [
          `has_table('${alterations.renamedTo}')`,
          `hasnt_table('${target}')`,
          '-- Verify all dependent objects reference new table name',
          '-- Check that foreign key references are updated'
        ]
      });
    }

    // Handle RENAME COLUMN operations
    alterations.renamedColumns.forEach((rename) => {
      requirements.push({
        type: TEST_TYPES.SCHEMA,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify column '${rename.oldName}' renamed to '${rename.newName}' in ${target}`,
        target,
        testCases: [
          `has_column('${target}', '${rename.newName}')`,
          `hasnt_column('${target}', '${rename.oldName}')`,
          `col_type_is('${target}', '${rename.newName}', '${rename.type}')`,
          '-- Verify column maintains all constraints and properties'
        ]
      });
    });

    // Handle ADD CONSTRAINT operations
    alterations.addedConstraints.forEach((constraint) => {
      const testCases = [];

      switch (constraint.type) {
      case 'PRIMARY KEY':
        testCases.push(`has_pk('${target}')`);
        constraint.columns.forEach((col) => {
          testCases.push(`col_is_pk('${target}', '${col}')`);
        });
        break;
      case 'FOREIGN KEY':
        testCases.push(`has_fk('${target}', '${constraint.column}')`);
        testCases.push(
          `fk_ok('${target}', '${constraint.column}', '${constraint.referencedTable}', '${constraint.referencedColumn}')`
        );
        break;
      case 'UNIQUE':
        testCases.push(`has_unique('${target}', '${constraint.name}')`);
        break;
      case 'CHECK':
        testCases.push(`has_check('${target}', '${constraint.name}')`);
        break;
      }

      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify ${constraint.type} constraint added to ${target}`,
        target,
        testCases
      });
    });

    // Handle DROP CONSTRAINT operations
    alterations.droppedConstraints.forEach((constraint) => {
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify constraint '${constraint.name}' dropped from ${target}`,
        target,
        testCases: [
          `-- Verify constraint ${constraint.name} no longer exists`,
          '-- Check that dependent functionality still works',
          '-- Test that constraint is truly removed'
        ]
      });
    });

    return requirements;
  }

  /**
   * Generate test requirements for indexes
   * @private
   */
  _generateIndexTests(operation, target, priority) {
    const requirements = [];
    const sql = operation.sql?.toUpperCase() || '';

    // Determine index operation type
    const operationType = this._categorizeIndexOperation(sql);

    switch (operationType) {
    case 'CREATE_INDEX':
      requirements.push(...this._generateCreateIndexTests(operation, target, priority, sql));
      break;

    case 'CREATE_UNIQUE_INDEX':
      requirements.push(
        ...this._generateCreateUniqueIndexTests(operation, target, priority, sql)
      );
      break;

    case 'DROP_INDEX':
      requirements.push(...this._generateDropIndexTests(operation, target, priority, sql));
      break;

    case 'ALTER_INDEX':
      requirements.push(...this._generateAlterIndexTests(operation, target, priority, sql));
      break;

    default:
      // Fallback for generic index operations
      requirements.push({
        type: TEST_TYPES.INDEX,
        priority,
        description: `Verify index ${target} operation`,
        target,
        testCases: ['has_index()', 'Verify index operation completed successfully']
      });
    }

    // Add performance tests for large table considerations
    if (this._requiresIndexPerformanceTests(sql)) {
      requirements.push(...this._generateIndexPerformanceTests(operation, target, priority, sql));
    }

    return requirements;
  }

  /**
   * Categorize index operation type
   * @private
   * @param {string} sql - SQL statement
   * @returns {string} Operation category
   */
  _categorizeIndexOperation(sql) {
    if (sql.includes('CREATE UNIQUE INDEX')) return 'CREATE_UNIQUE_INDEX';
    if (sql.includes('CREATE INDEX')) return 'CREATE_INDEX';
    if (sql.includes('DROP INDEX')) return 'DROP_INDEX';
    if (sql.includes('ALTER INDEX')) return 'ALTER_INDEX';
    return 'UNKNOWN_INDEX';
  }

  /**
   * Generate test requirements for CREATE INDEX operations
   * @private
   */
  _generateCreateIndexTests(operation, target, priority, sql) {
    const requirements = [];
    const indexDetails = this._parseIndexDetails(sql);

    // Basic index existence tests
    requirements.push({
      type: TEST_TYPES.INDEX,
      priority,
      description: `Verify index ${target} exists with correct structure`,
      target,
      testCases: [
        'has_index()',
        'index_is_on() for column verification',
        'index_is_type() for index type verification'
      ],
      metadata: {
        indexType: indexDetails.type,
        columns: indexDetails.columns,
        tableName: indexDetails.tableName,
        isPartial: indexDetails.isPartial
      }
    });

    // Column-specific tests
    if (indexDetails.columns && indexDetails.columns.length > 0) {
      requirements.push({
        type: TEST_TYPES.SCHEMA,
        priority,
        description: `Verify index ${target} column mappings`,
        target,
        testCases: indexDetails.columns.map(
          (col) => `index_is_on('${indexDetails.tableName}', '${target}', '${col}')`
        ),
        metadata: {
          columns: indexDetails.columns,
          tableName: indexDetails.tableName
        }
      });
    }

    // Partial index condition tests
    if (indexDetails.isPartial && indexDetails.whereClause) {
      requirements.push({
        type: TEST_TYPES.INDEX,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify partial index ${target} condition`,
        target,
        testCases: [
          'Test index is used only when condition is met',
          'Test index is not used when condition is not met',
          'Verify partial index filter condition accuracy'
        ],
        metadata: {
          whereClause: indexDetails.whereClause,
          isPartial: true
        }
      });
    }

    // Index type-specific tests
    if (indexDetails.type) {
      requirements.push({
        type: TEST_TYPES.INDEX,
        priority,
        description: `Verify index ${target} type is ${indexDetails.type}`,
        target,
        testCases: [
          `index_is_type('${indexDetails.tableName}', '${target}', '${indexDetails.type}')`
        ],
        metadata: {
          indexType: indexDetails.type
        }
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for CREATE UNIQUE INDEX operations
   * @private
   */
  _generateCreateUniqueIndexTests(operation, target, priority, sql) {
    const requirements = [];
    const indexDetails = this._parseIndexDetails(sql);

    // Include all regular index tests
    requirements.push(...this._generateCreateIndexTests(operation, target, priority, sql));

    // Unique constraint validation tests
    requirements.push({
      type: TEST_TYPES.CONSTRAINT,
      priority: TEST_PRIORITIES.HIGH,
      description: `Verify unique constraint enforcement for index ${target}`,
      target,
      testCases: [
        'has_unique()',
        'Test unique constraint allows distinct values',
        'Test unique constraint rejects duplicate values',
        'Test NULL value handling in unique constraint'
      ],
      metadata: {
        isUnique: true,
        columns: indexDetails.columns,
        tableName: indexDetails.tableName
      }
    });

    // Unique constraint violation tests
    if (indexDetails.columns && indexDetails.columns.length > 0) {
      requirements.push({
        type: TEST_TYPES.DATA,
        priority: TEST_PRIORITIES.HIGH,
        description: `Test unique constraint violations for ${target}`,
        target,
        testCases: [
          'Test INSERT with duplicate values fails',
          'Test UPDATE creating duplicates fails',
          'Test constraint error messages are appropriate',
          'Test partial unique constraints (if applicable)'
        ],
        metadata: {
          constraintType: 'unique',
          columns: indexDetails.columns,
          violationTests: true
        }
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for DROP INDEX operations
   * @private
   */
  _generateDropIndexTests(operation, target, priority, sql) {
    const requirements = [];
    const indexDetails = this._parseIndexDetails(sql);

    // Index removal verification
    requirements.push({
      type: TEST_TYPES.INDEX,
      priority: TEST_PRIORITIES.CRITICAL, // Always critical for destructive operations
      description: `Verify index ${target} is properly removed`,
      target,
      testCases: [
        'hasnt_index()',
        'Verify dependent queries still function',
        'Check for performance impact after removal'
      ],
      metadata: {
        operation: 'drop',
        tableName: indexDetails.tableName
      }
    });

    // If it was a unique index, verify unique constraint is also removed
    if (sql.includes('UNIQUE')) {
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify unique constraint removed with index ${target}`,
        target,
        testCases: [
          'hasnt_unique()',
          'Test duplicate values are now allowed',
          'Verify constraint-dependent code still works'
        ],
        metadata: {
          wasUnique: true,
          constraintRemoved: true
        }
      });
    }

    // Performance impact tests
    requirements.push({
      type: TEST_TYPES.INDEX,
      priority: TEST_PRIORITIES.MEDIUM,
      description: `Verify performance impact of removing index ${target}`,
      target,
      testCases: [
        'Measure query performance after index removal',
        'Identify queries that may be affected',
        'Verify no critical performance regressions'
      ],
      metadata: {
        performanceTest: true,
        expectedImpact: 'degradation'
      }
    });

    return requirements;
  }

  /**
   * Generate test requirements for ALTER INDEX operations
   * @private
   */
  _generateAlterIndexTests(operation, target, priority, sql) {
    const requirements = [];
    const indexDetails = this._parseIndexDetails(sql);

    // Index alteration verification
    requirements.push({
      type: TEST_TYPES.INDEX,
      priority,
      description: `Verify index ${target} alteration applied correctly`,
      target,
      testCases: [
        'has_index()',
        'Verify index properties after alteration',
        'Test index functionality after changes'
      ],
      metadata: {
        operation: 'alter',
        tableName: indexDetails.tableName
      }
    });

    // Rename operations
    if (sql.includes('RENAME TO')) {
      const newName = this._extractNewIndexName(sql);
      requirements.push({
        type: TEST_TYPES.SCHEMA,
        priority,
        description: `Verify index rename from ${target} to ${newName}`,
        target: newName,
        testCases: [
          `has_index('${indexDetails.tableName}', '${newName}')`,
          `hasnt_index('${indexDetails.tableName}', '${target}')`,
          'Verify dependent objects reference new name'
        ],
        metadata: {
          oldName: target,
          newName,
          operation: 'rename'
        }
      });
    }

    // Tablespace or other property changes
    if (sql.includes('SET TABLESPACE') || sql.includes('SET (')) {
      requirements.push({
        type: TEST_TYPES.INDEX,
        priority: TEST_PRIORITIES.MEDIUM,
        description: `Verify index ${target} property changes`,
        target,
        testCases: [
          'Verify tablespace assignment (if applicable)',
          'Test index parameters are updated',
          'Verify index performance characteristics'
        ],
        metadata: {
          propertyChange: true
        }
      });
    }

    return requirements;
  }

  /**
   * Generate performance test requirements for indexes
   * @private
   */
  _generateIndexPerformanceTests(operation, target, priority, sql) {
    const requirements = [];
    const indexDetails = this._parseIndexDetails(sql);

    requirements.push({
      type: TEST_TYPES.INDEX,
      priority: TEST_PRIORITIES.MEDIUM,
      description: `Performance testing for index ${target}`,
      target,
      testCases: [
        'Measure query execution plans before/after',
        'Test index selectivity and effectiveness',
        'Benchmark with realistic data volumes',
        'Verify index is being utilized by optimizer'
      ],
      metadata: {
        performanceTest: true,
        tableName: indexDetails.tableName,
        suggestedDataVolume: 'large',
        measureMetrics: ['execution_time', 'index_usage', 'selectivity']
      }
    });

    // Large table considerations
    if (this._isLargeTableOperation(indexDetails.tableName)) {
      requirements.push({
        type: TEST_TYPES.INDEX,
        priority: TEST_PRIORITIES.HIGH,
        description: `Large table performance considerations for ${target}`,
        target,
        testCases: [
          'Test index creation time on large dataset',
          'Verify maintenance overhead is acceptable',
          'Test concurrent access during index operations',
          'Monitor storage space impact'
        ],
        metadata: {
          largeTable: true,
          performanceConsiderations: ['creation_time', 'maintenance_overhead', 'storage_impact']
        }
      });
    }

    return requirements;
  }

  /**
   * Parse index details from SQL statement
   * @private
   * @param {string} sql - SQL statement
   * @returns {Object} Parsed index details
   */
  _parseIndexDetails(sql) {
    const details = {
      type: null,
      columns: [],
      tableName: null,
      isPartial: false,
      whereClause: null,
      isUnique: false
    };

    // Extract table name
    let match = sql.match(/ON\s+([^\s(]+)/i);
    if (match) {
      details.tableName = match[1];
    }

    // Extract columns
    match = sql.match(/\(([^)]+)\)/);
    if (match) {
      details.columns = match[1]
        .split(',')
        .map((col) => col.trim())
        .map((col) => col.replace(/["'`]/g, '')); // Remove quotes
    }

    // Check for index type
    match = sql.match(/USING\s+(\w+)/i);
    if (match) {
      details.type = match[1].toLowerCase();
    } else {
      details.type = 'btree'; // Default PostgreSQL index type
    }

    // Check if unique
    details.isUnique = sql.includes('UNIQUE');

    // Check for partial index (WHERE clause)
    match = sql.match(/WHERE\s+(.+?)(?:$|\s*;)/i);
    if (match) {
      details.isPartial = true;
      details.whereClause = match[1].trim();
    }

    return details;
  }

  /**
   * Extract new index name from ALTER INDEX RENAME statement
   * @private
   * @param {string} sql - SQL statement
   * @returns {string} New index name
   */
  _extractNewIndexName(sql) {
    const match = sql.match(/RENAME TO\s+([^\s;]+)/i);
    return match ? match[1] : 'unknown_name';
  }

  /**
   * Check if index operation requires performance tests
   * @private
   * @param {string} sql - SQL statement
   * @returns {boolean} Whether performance tests are needed
   */
  _requiresIndexPerformanceTests(sql) {
    // Performance tests recommended for:
    // - Indexes on likely large tables
    // - Complex expressions or functions in indexes
    // - Partial indexes with complex conditions
    return (
      sql.includes('CREATE INDEX') &&
      (sql.includes('WHERE') || // Partial index
        (sql.includes('(') && sql.includes('||')) || // Expression index
        this.options.requirePerformanceTests)
    );
  }

  /**
   * Determine if operation is on a large table (heuristic)
   * @private
   * @param {string} tableName - Table name
   * @returns {boolean} Whether table is likely large
   */
  _isLargeTableOperation(tableName) {
    if (!tableName) return false;

    // Heuristic: tables with certain naming patterns are likely large
    const largeTablePatterns = [
      /events?$/i,
      /logs?$/i,
      /transactions?$/i,
      /messages?$/i,
      /analytics?$/i,
      /audit/i,
      /history$/i,
      /metrics?$/i
    ];

    return largeTablePatterns.some((pattern) => pattern.test(tableName));
  }

  /**
   * Generate test requirements for functions
   * @private
   */
  _generateFunctionTests(operation, target, priority) {
    const sql = (operation.sql || '').toUpperCase();
    const requirements = [];

    // Determine specific function operation type
    const functionOperation = this._categorizeFunction(operation);

    // Extract function metadata
    const functionMetadata = this._extractFunctionMetadata(operation);

    // Base function existence and structure tests
    switch (functionOperation) {
    case 'CREATE_FUNCTION':
    case 'CREATE_OR_REPLACE_FUNCTION':
      requirements.push(
        ...this._generateFunctionCreationTests(operation, target, priority, functionMetadata)
      );
      break;

    case 'DROP_FUNCTION':
      requirements.push(...this._generateFunctionDropTests(operation, target, priority));
      break;

    case 'ALTER_FUNCTION':
      requirements.push(
        ...this._generateFunctionAlterationTests(operation, target, priority, functionMetadata)
      );
      break;

    default:
      requirements.push(...this._generateGenericFunctionTests(operation, target, priority));
    }

    // Add Supabase RPC-specific tests if applicable
    if (this._isSupabaseRpcFunction(operation, functionMetadata)) {
      requirements.push(
        ...this._generateSupabaseRpcTests(operation, target, priority, functionMetadata)
      );
    }

    // Add security tests for security definer functions
    if (functionMetadata.securityDefiner) {
      requirements.push(
        ...this._generateFunctionSecurityTests(operation, target, priority, functionMetadata)
      );
    }

    return requirements;
  }

  /**
   * Categorize function operations for specific test mapping
   * @private
   */
  _categorizeFunction(operation) {
    const sql = (operation.sql || '').toUpperCase();

    if (sql.includes('CREATE OR REPLACE FUNCTION')) return 'CREATE_OR_REPLACE_FUNCTION';
    if (sql.includes('CREATE FUNCTION')) return 'CREATE_FUNCTION';
    if (sql.includes('DROP FUNCTION')) return 'DROP_FUNCTION';
    if (sql.includes('ALTER FUNCTION')) return 'ALTER_FUNCTION';

    return 'UNKNOWN_FUNCTION';
  }

  /**
   * Extract function metadata from SQL operation
   * @private
   */
  _extractFunctionMetadata(operation) {
    const sql = operation.sql || '';
    const metadata = {
      parameterTypes: [],
      returnType: null,
      isRpcFunction: false,
      securityDefiner: false,
      isVolatile: null,
      language: null,
      hasParameters: false
    };

    // Extract parameter types
    const paramMatch = sql.match(/\((.*?)\)\s*RETURNS/i);
    if (paramMatch && paramMatch[1].trim()) {
      metadata.hasParameters = true;
      // Basic parameter extraction - can be enhanced
      metadata.parameterTypes = paramMatch[1].split(',').map((p) => p.trim().split(' ').pop());
    }

    // Extract return type
    const returnMatch = sql.match(/RETURNS\s+([^\s]+)/i);
    if (returnMatch) {
      metadata.returnType = returnMatch[1];
    }

    // Check for security definer
    metadata.securityDefiner = /SECURITY\s+DEFINER/i.test(sql);

    // Check volatility
    if (/VOLATILE/i.test(sql)) metadata.isVolatile = true;
    else if (/STABLE/i.test(sql)) metadata.isVolatile = false;
    else if (/IMMUTABLE/i.test(sql)) metadata.isVolatile = false;

    // Extract language
    const langMatch = sql.match(/LANGUAGE\s+(\w+)/i);
    if (langMatch) {
      metadata.language = langMatch[1].toLowerCase();
    }

    // Check if it's likely an RPC function (exposed via API)
    metadata.isRpcFunction = this._isLikelyRpcFunction(sql, metadata);

    return metadata;
  }

  /**
   * Generate tests for function creation (CREATE FUNCTION or CREATE OR REPLACE)
   * @private
   */
  _generateFunctionCreationTests(operation, target, priority, metadata) {
    const requirements = [];

    // Core function existence and structure
    requirements.push({
      type: TEST_TYPES.FUNCTION,
      priority,
      description: `Verify function ${target} exists with correct structure`,
      target,
      testCases: [
        'has_function() - function exists',
        'function_returns() - return type validation',
        ...(metadata.hasParameters ? ['function_args() - parameter validation'] : []),
        ...(metadata.language ? [`function_lang_is() - language is ${metadata.language}`] : []),
        ...(metadata.securityDefiner ? ['is_definer() - security definer check'] : []),
        ...(metadata.isVolatile !== null ? ['volatility_is() - volatility check'] : [])
      ],
      metadata: {
        functionMetadata: metadata,
        testType: 'structure'
      }
    });

    // Behavioral testing
    requirements.push({
      type: TEST_TYPES.FUNCTION,
      priority:
        priority === TEST_PRIORITIES.CRITICAL ? TEST_PRIORITIES.HIGH : TEST_PRIORITIES.MEDIUM,
      description: `Verify function ${target} behavior and logic`,
      target,
      testCases: [
        'Test with valid input parameters',
        'Test return value correctness',
        'Test error handling for invalid inputs',
        'Test edge cases and boundary conditions',
        ...(metadata.returnType === 'SETOF' || metadata.returnType?.includes('[]')
          ? ['Test result set completeness']
          : [])
      ],
      metadata: {
        functionMetadata: metadata,
        testType: 'behavior'
      }
    });

    return requirements;
  }

  /**
   * Generate tests for function drops
   * @private
   */
  _generateFunctionDropTests(operation, target, priority) {
    return [
      {
        type: TEST_TYPES.FUNCTION,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify function ${target} is properly dropped`,
        target,
        testCases: [
          'hasnt_function() - function no longer exists',
          'Verify dependent objects are handled',
          'Check cascade behavior if applicable',
          'Verify no orphaned permissions remain'
        ],
        metadata: {
          testType: 'removal'
        }
      }
    ];
  }

  /**
   * Generate tests for function alterations
   * @private
   */
  _generateFunctionAlterationTests(operation, target, priority, metadata) {
    const sql = (operation.sql || '').toUpperCase();
    const requirements = [];

    if (sql.includes('RENAME TO')) {
      requirements.push({
        type: TEST_TYPES.FUNCTION,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify function rename from ${target}`,
        target,
        testCases: [
          'hasnt_function() - old function name gone',
          'has_function() - new function name exists',
          'Verify function signature unchanged',
          'Test function behavior unchanged'
        ],
        metadata: {
          testType: 'rename'
        }
      });
    }

    if (sql.includes('OWNER TO')) {
      requirements.push({
        type: TEST_TYPES.FUNCTION,
        priority: TEST_PRIORITIES.MEDIUM,
        description: `Verify function ${target} ownership change`,
        target,
        testCases: [
          'Verify new owner has correct permissions',
          'Test function accessibility from different roles',
          'Verify function behavior unchanged'
        ],
        metadata: {
          testType: 'ownership'
        }
      });
    }

    if (sql.includes('SET') || sql.includes('RESET')) {
      requirements.push({
        type: TEST_TYPES.FUNCTION,
        priority: TEST_PRIORITIES.MEDIUM,
        description: `Verify function ${target} configuration changes`,
        target,
        testCases: [
          'Test function behavior with new settings',
          'Verify configuration parameters applied',
          'Test performance impact of changes'
        ],
        metadata: {
          testType: 'configuration'
        }
      });
    }

    return requirements;
  }

  /**
   * Generate generic function tests for unknown operations
   * @private
   */
  _generateGenericFunctionTests(operation, target, priority) {
    return [
      {
        type: TEST_TYPES.FUNCTION,
        priority: TEST_PRIORITIES.LOW,
        description: `Verify function ${target} after operation`,
        target,
        testCases: [
          'has_function() - function exists',
          'Test basic function execution',
          'Verify no unexpected side effects'
        ],
        metadata: {
          testType: 'generic'
        }
      }
    ];
  }

  /**
   * Generate Supabase RPC-specific tests
   * @private
   */
  _generateSupabaseRpcTests(operation, target, priority, metadata) {
    const requirements = [];

    // API accessibility tests
    requirements.push({
      type: TEST_TYPES.FUNCTION,
      priority: TEST_PRIORITIES.HIGH,
      description: `Verify Supabase RPC function ${target} API access`,
      target,
      testCases: [
        'Test function call with authenticated user',
        'Test function call with anonymous user',
        'Test function parameter validation via RPC',
        'Test return structure matches expected format',
        'Test function accessibility via PostgREST'
      ],
      metadata: {
        functionMetadata: metadata,
        testType: 'supabase_rpc',
        requiresSupabaseClient: true
      }
    });

    // Security and permissions for RPC
    requirements.push({
      type: TEST_TYPES.PERMISSION,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify Supabase RPC function ${target} security`,
      target,
      testCases: [
        'Test RLS enforcement in function calls',
        'Test unauthorized access scenarios',
        'Test parameter injection protection',
        'Verify rate limiting (if applicable)',
        'Test with different user contexts'
      ],
      metadata: {
        functionMetadata: metadata,
        testType: 'supabase_security',
        requiresSupabaseClient: true
      }
    });

    // Error handling for RPC
    requirements.push({
      type: TEST_TYPES.FUNCTION,
      priority: TEST_PRIORITIES.MEDIUM,
      description: `Verify Supabase RPC function ${target} error handling`,
      target,
      testCases: [
        'Test error response format via RPC',
        'Test invalid parameter handling',
        'Test timeout scenarios',
        'Test connection error handling',
        'Verify error messages are user-friendly'
      ],
      metadata: {
        functionMetadata: metadata,
        testType: 'supabase_errors',
        requiresSupabaseClient: true
      }
    });

    return requirements;
  }

  /**
   * Generate security tests for security definer functions
   * @private
   */
  _generateFunctionSecurityTests(operation, target, priority, metadata) {
    return [
      {
        type: TEST_TYPES.PERMISSION,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify security definer function ${target} security`,
        target,
        testCases: [
          'is_definer() - verify security definer setting',
          'Test function executes with definer privileges',
          'Test privilege escalation protection',
          'Verify input parameter sanitization',
          'Test SQL injection protection',
          'Test with different invoker roles'
        ],
        metadata: {
          functionMetadata: metadata,
          testType: 'security_definer',
          securityCritical: true
        }
      }
    ];
  }

  /**
   * Determine if function is likely RPC-accessible based on characteristics
   * @private
   */
  _isLikelyRpcFunction(sql, metadata) {
    // Check if function name suggests API usage (common patterns)
    const apiPatterns = [
      /get_.*\(/i,
      /create_.*\(/i,
      /update_.*\(/i,
      /delete_.*\(/i,
      /search_.*\(/i,
      /list_.*\(/i,
      /find_.*\(/i
    ];

    return (
      apiPatterns.some((pattern) => pattern.test(sql)) ||
      metadata.language === 'plpgsql' ||
      metadata.returnType?.toLowerCase().includes('json')
    );
  }

  /**
   * Check if operation creates a Supabase RPC function
   * @private
   */
  _isSupabaseRpcFunction(operation, metadata) {
    if (!metadata) return false;

    const sql = operation.sql || '';

    // Skip system schema functions
    if (
      sql.includes('auth.') ||
      sql.includes('storage.') ||
      sql.includes('realtime.') ||
      sql.includes('supabase_functions.')
    ) {
      return false;
    }

    // Functions in public schema are typically RPC-accessible
    if (
      sql.includes('public.') ||
      (!sql.includes('.') &&
        !sql.includes('CREATE FUNCTION auth.') &&
        !sql.includes('CREATE FUNCTION storage.'))
    ) {
      return true;
    }

    // Functions with simple parameter types are more likely to be RPC
    if (
      metadata.parameterTypes.length === 0 ||
      metadata.parameterTypes.every((type) =>
        ['text', 'integer', 'boolean', 'json', 'jsonb', 'uuid'].includes(type.toLowerCase())
      )
    ) {
      return true;
    }

    // Functions returning JSON or simple types
    if (
      metadata.returnType &&
      ['json', 'jsonb', 'text', 'integer', 'boolean', 'uuid'].includes(
        metadata.returnType.toLowerCase()
      )
    ) {
      return true;
    }

    // Functions in public schema or without schema qualifier are likely RPC
    return (
      metadata.isRpcFunction ||
      sql.includes('public.') ||
      (!sql.includes('.') && !sql.includes('pg_') && !sql.includes('information_schema'))
    );
  }

  /**
   * Generate test requirements for CREATE POLICY operations
   * @private
   */
  _generateCreatePolicyTests(operation, policyName, priority) {
    const requirements = [];
    const sql = operation.sql || '';
    const tableMatch = sql.match(/ON\s+([^\s(]+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'unknown_table';

    // Extract policy details
    const policyDetails = this._extractPolicyDetails(sql);

    // Core policy existence test
    requirements.push({
      type: TEST_TYPES.RLS,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify policy ${policyName} exists and is properly configured`,
      target: policyName,
      testCases: [
        'policy_exists() - verify policy was created',
        'policy_cmd_is() - verify policy applies to correct commands',
        'policy_roles_are() - verify policy applies to correct roles'
      ],
      metadata: {
        tableName,
        policyName,
        commands: policyDetails.commands,
        roles: policyDetails.roles,
        isPermissive: policyDetails.isPermissive,
        testType: 'policy_creation'
      }
    });

    // RLS enablement test
    requirements.push({
      type: TEST_TYPES.RLS,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify RLS is enabled on table ${tableName}`,
      target: tableName,
      testCases: ['is_rls_enabled() - ensure RLS is active on the table'],
      metadata: {
        tableName,
        testType: 'rls_enablement',
        reason: `Policy ${policyName} requires RLS to be enabled`
      }
    });

    // Security boundary tests for different user roles
    const userRoles = ['anon', 'authenticated', 'service_role'];
    for (const role of userRoles) {
      requirements.push({
        type: TEST_TYPES.PERMISSION,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Test ${policyName} enforcement for role ${role}`,
        target: `${policyName}_${role}`,
        testCases: [
          `results_eq() - test data visibility as ${role}`,
          'Test authorized operations are allowed',
          'Test unauthorized operations are blocked',
          'Test edge cases and boundary conditions'
        ],
        metadata: {
          tableName,
          policyName,
          testRole: role,
          commands: policyDetails.commands,
          testType: 'security_boundary',
          testScenarios: this._generateSecurityTestScenarios(policyDetails, role)
        }
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for ALTER POLICY operations
   * @private
   */
  _generateAlterPolicyTests(operation, policyName, priority) {
    const requirements = [];
    const sql = operation.sql || '';
    const tableMatch = sql.match(/ON\s+([^\s(]+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'unknown_table';

    const policyDetails = this._extractPolicyDetails(sql);

    // Policy validation after alteration
    requirements.push({
      type: TEST_TYPES.RLS,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify altered policy ${policyName} configuration`,
      target: policyName,
      testCases: [
        'policy_exists() - verify policy still exists after alteration',
        'policy_cmd_is() - verify updated command restrictions',
        'policy_roles_are() - verify updated role assignments'
      ],
      metadata: {
        tableName,
        policyName,
        commands: policyDetails.commands,
        roles: policyDetails.roles,
        testType: 'policy_alteration'
      }
    });

    // Re-test security boundaries with updated policy
    const userRoles =
      policyDetails.roles.length > 0 ? policyDetails.roles : ['anon', 'authenticated'];
    for (const role of userRoles) {
      requirements.push({
        type: TEST_TYPES.PERMISSION,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Re-test ${policyName} enforcement after alteration for role ${role}`,
        target: `${policyName}_altered_${role}`,
        testCases: [
          `results_eq() - verify updated policy behavior for ${role}`,
          'Test that policy changes work as expected',
          'Verify no unintended access granted or denied'
        ],
        metadata: {
          tableName,
          policyName,
          testRole: role,
          testType: 'altered_security_boundary',
          testScenarios: this._generateSecurityTestScenarios(policyDetails, role)
        }
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for DROP POLICY operations
   * @private
   */
  _generateDropPolicyTests(operation, policyName, priority) {
    const requirements = [];
    const sql = operation.sql || '';
    const tableMatch = sql.match(/ON\s+([^\s(]+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'unknown_table';

    // Policy absence test
    requirements.push({
      type: TEST_TYPES.RLS,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify policy ${policyName} is properly removed`,
      target: policyName,
      testCases: [
        'policy_exists() should return false',
        'Verify policy no longer appears in policy list'
      ],
      metadata: {
        tableName,
        policyName,
        testType: 'policy_removal'
      }
    });

    // Test security implications of policy removal
    requirements.push({
      type: TEST_TYPES.PERMISSION,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Test security implications of removing policy ${policyName}`,
      target: `${tableName}_post_drop`,
      testCases: [
        'results_eq() - verify expected access changes after policy drop',
        "Test that removal doesn't unexpectedly grant access",
        'Verify other policies still function correctly',
        'Test with different user roles'
      ],
      metadata: {
        tableName,
        policyName,
        testType: 'post_drop_security',
        reason: 'Dropping policies can unexpectedly grant broader access'
      }
    });

    return requirements;
  }

  /**
   * Generate test requirements for ENABLE ROW LEVEL SECURITY operations
   * @private
   */
  _generateEnableRLSTests(operation, tableName, priority) {
    const requirements = [];

    // RLS enablement test
    requirements.push({
      type: TEST_TYPES.RLS,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify RLS is enabled on table ${tableName}`,
      target: tableName,
      testCases: [
        'is_rls_enabled() - verify RLS is active',
        'Test that access is properly restricted when RLS is enabled'
      ],
      metadata: {
        tableName,
        testType: 'rls_enablement'
      }
    });

    // Security impact test - RLS should restrict access by default
    requirements.push({
      type: TEST_TYPES.PERMISSION,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Test security impact of enabling RLS on ${tableName}`,
      target: `${tableName}_rls_enabled`,
      testCases: [
        'results_eq() - verify restricted access with no policies',
        'Test with anon role (should have no access by default)',
        'Test with authenticated role',
        'Verify service_role bypasses RLS'
      ],
      metadata: {
        tableName,
        testType: 'rls_security_impact',
        testScenarios: [
          { role: 'anon', operation: 'SELECT', shouldAllow: false },
          { role: 'authenticated', operation: 'SELECT', shouldAllow: false },
          { role: 'service_role', operation: 'SELECT', shouldAllow: true }
        ]
      }
    });

    return requirements;
  }

  /**
   * Generate test requirements for DISABLE ROW LEVEL SECURITY operations
   * @private
   */
  _generateDisableRLSTests(operation, tableName, priority) {
    const requirements = [];

    // RLS disablement test
    requirements.push({
      type: TEST_TYPES.RLS,
      priority: TEST_PRIORITIES.CRITICAL,
      description: `Verify RLS is disabled on table ${tableName}`,
      target: tableName,
      testCases: ['is_rls_enabled() - verify RLS is inactive'],
      metadata: {
        tableName,
        testType: 'rls_disablement'
      }
    });

    // Security impact test - disabling RLS might grant broader access
    requirements.push({
      type: TEST_TYPES.PERMISSION,
      priority: TEST_PRIORITIES.HIGH,
      description: `Test security impact of disabling RLS on ${tableName}`,
      target: `${tableName}_rls_disabled`,
      testCases: [
        'results_eq() - verify access patterns after RLS disabled',
        'Test with different user roles',
        'Verify no unintended data exposure'
      ],
      metadata: {
        tableName,
        testType: 'rls_disable_security_impact',
        reason: 'Disabling RLS can unexpectedly grant broader access'
      }
    });

    return requirements;
  }

  /**
   * Extract policy details from SQL statement
   * @private
   */
  _extractPolicyDetails(sql) {
    const details = {
      commands: [],
      roles: [],
      isPermissive: true,
      expression: null,
      checkExpression: null
    };

    // Extract commands (FOR SELECT, INSERT, UPDATE, DELETE, ALL)
    const commandMatch = sql.match(/FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)/i);
    if (commandMatch) {
      if (commandMatch[1].toUpperCase() === 'ALL') {
        details.commands = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
      } else {
        details.commands = [commandMatch[1].toUpperCase()];
      }
    } else {
      // Default is ALL commands
      details.commands = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
    }

    // Extract roles (TO role1, role2, ...)
    const rolesMatch = sql.match(/TO\s+((?:\w+(?:\s*,\s*\w+)*))\s+(?:USING|WITH|$)/i);
    if (rolesMatch) {
      details.roles = rolesMatch[1].split(',').map((role) => role.trim());
    }

    // Check if restrictive policy
    details.isPermissive = !sql.toUpperCase().includes('AS RESTRICTIVE');

    // Extract USING expression (handle nested parentheses)
    const usingStart = sql.search(/USING\s*\(/i);
    if (usingStart !== -1) {
      let parenCount = 0;
      const startIdx = sql.indexOf('(', usingStart);
      let endIdx = startIdx;

      for (let i = startIdx; i < sql.length; i++) {
        if (sql[i] === '(') parenCount++;
        if (sql[i] === ')') parenCount--;
        if (parenCount === 0) {
          endIdx = i;
          break;
        }
      }

      if (parenCount === 0) {
        details.expression = sql.substring(startIdx + 1, endIdx);
      }
    }

    // Extract WITH CHECK expression
    const checkMatch = sql.match(/WITH\s+CHECK\s*\(([^)]+)\)/i);
    if (checkMatch) {
      details.checkExpression = checkMatch[1];
    }

    return details;
  }

  /**
   * Generate security test scenarios for a policy and role combination
   * @private
   */
  _generateSecurityTestScenarios(policyDetails, role) {
    const scenarios = [];

    for (const command of policyDetails.commands) {
      // Basic allowed scenario
      scenarios.push({
        role,
        operation: command,
        shouldAllow: this._shouldPolicyAllowOperation(policyDetails, role, command),
        context: { description: `Test ${command} operation for ${role}` }
      });

      // Edge case scenarios
      if (command === 'SELECT') {
        scenarios.push({
          role,
          operation: 'SELECT with WHERE clause',
          shouldAllow: this._shouldPolicyAllowOperation(policyDetails, role, command),
          context: { description: `Test filtered SELECT for ${role}` }
        });
      }

      if (command === 'INSERT') {
        scenarios.push({
          role,
          operation: 'INSERT with invalid data',
          shouldAllow: false,
          context: { description: `Test INSERT validation for ${role}` }
        });
      }
    }

    // Test policy bypass scenarios
    scenarios.push({
      role: 'service_role',
      operation: 'bypass_test',
      shouldAllow: true,
      context: { description: 'Verify service_role bypasses RLS policies' }
    });

    return scenarios;
  }

  /**
   * Determine if a policy should allow an operation for a role
   * @private
   */
  _shouldPolicyAllowOperation(policyDetails, role, command) {
    // This is a simplified heuristic - in practice, this would depend on
    // the specific policy expression and database state

    if (role === 'service_role') {
      return true; // service_role bypasses RLS
    }

    if (policyDetails.roles.length > 0 && !policyDetails.roles.includes(role)) {
      return false; // Role not in policy
    }

    if (!policyDetails.commands.includes(command)) {
      return false; // Command not covered by policy
    }

    // Default assumption - policy allows the operation
    // In practice, this would need to evaluate the USING expression
    return true;
  }

  /**
   * Generate test requirements for views
   * @private
   */
  _generateViewTests(operation, target, priority) {
    return [
      {
        type: TEST_TYPES.VIEW,
        priority,
        description: `Verify view ${target} definition and data`,
        target,
        testCases: [
          'has_view()',
          'Verify view returns expected columns',
          'Test view data accuracy',
          'Verify view permissions'
        ]
      }
    ];
  }

  /**
   * Generate test requirements for enum types
   * @private
   */
  _generateEnumTests(operation, target, priority) {
    return [
      {
        type: TEST_TYPES.ENUM,
        priority,
        description: `Verify enum type ${target} values`,
        target,
        testCases: [
          'has_type()',
          'Test all enum values are valid',
          'Test invalid values are rejected',
          'Verify enum usage in tables'
        ]
      }
    ];
  }

  /**
   * Generate test requirements for triggers
   * @private
   */
  _generateTriggerTests(operation, target, priority) {
    const sql = (operation.sql || '').toUpperCase();

    // Route to specific trigger test methods based on operation type
    if (sql.includes('CREATE EVENT TRIGGER')) {
      return this._generateEventTriggerTests(operation, target, priority);
    }

    if (sql.includes('CREATE TRIGGER')) {
      return this._generateTriggerCreationTests(operation, target, priority);
    }

    if (sql.includes('ALTER TRIGGER')) {
      return this._generateTriggerAlterationTests(operation, target, priority);
    }

    if (sql.includes('DROP TRIGGER')) {
      return this._generateTriggerDropTests(operation, target, priority);
    }

    // Fallback for unknown trigger operations
    return [
      {
        type: TEST_TYPES.TRIGGER,
        priority,
        description: `Verify trigger ${target} functionality`,
        target,
        testCases: [
          'has_trigger() - trigger exists',
          'trigger_is() - verify trigger properties',
          'Test trigger fires on correct events',
          'Test trigger function execution',
          'Verify trigger timing (BEFORE/AFTER)',
          'Test trigger with different data scenarios'
        ],
        metadata: {
          testType: 'functionality'
        }
      }
    ];
  }

  /**
   * Generate generic test requirements
   * @private
   */
  _generateGenericTests(operation, target, priority) {
    return [
      {
        type: TEST_TYPES.SCHEMA,
        priority: TEST_PRIORITIES.LOW,
        description: `Verify operation executed successfully: ${operation.description || 'Unknown operation'}`,
        target: target || 'Unknown',
        testCases: ['Verify operation completed without errors', 'Check database state consistency']
      }
    ];
  }

  /**
   * Generate security test requirements
   * @private
   */
  _generateSecurityTests(operation, target, priority) {
    return [
      {
        type: TEST_TYPES.PERMISSION,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify security implications of ${target} changes`,
        target,
        testCases: [
          'Test access control enforcement',
          'Verify unauthorized access is blocked',
          'Test with different user roles',
          'Audit security policy changes'
        ]
      }
    ];
  }

  /**
   * Generate performance test requirements
   * @private
   */
  _generatePerformanceTests(operation, target, priority) {
    return [
      {
        type: TEST_TYPES.INDEX,
        priority: TEST_PRIORITIES.MEDIUM,
        description: `Verify performance impact of ${target} changes`,
        target,
        testCases: [
          'Measure query performance before/after',
          'Verify indexes are utilized',
          'Check for performance regressions',
          'Test with realistic data volumes'
        ]
      }
    ];
  }

  /**
   * Generate test requirements for column addition
   * @private
   */
  _generateColumnAdditionTests(operation, tableName, columnName, priority) {
    const requirements = [];
    const sql = operation.sql || '';

    // Extract column metadata from SQL
    const columnMetadata = this._parseColumnConstraints(sql, columnName);

    requirements.push({
      type: TEST_TYPES.SCHEMA,
      priority,
      description: `Verify column ${columnName} added to ${tableName}`,
      target: `${tableName}.${columnName}`,
      testCases: [
        'has_column()',
        'col_type_is()',
        ...(columnMetadata.notNull ? ['col_not_null()'] : ['col_is_null()']),
        ...(columnMetadata.hasDefault ? ['col_has_default()', 'col_default_is()'] : []),
        ...(columnMetadata.isUnique ? ['col_is_unique()'] : []),
        ...(columnMetadata.isForeignKey ? ['has_fk()', 'fk_ok()'] : [])
      ],
      metadata: {
        columnType: columnMetadata.type,
        nullable: !columnMetadata.notNull,
        hasDefault: columnMetadata.hasDefault,
        defaultValue: columnMetadata.defaultValue,
        isUnique: columnMetadata.isUnique,
        isForeignKey: columnMetadata.isForeignKey,
        referencedTable: columnMetadata.referencedTable,
        referencedColumn: columnMetadata.referencedColumn
      }
    });

    // Add constraint tests if applicable
    if (columnMetadata.hasCheckConstraint) {
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify check constraint on ${tableName}.${columnName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['has_check()', 'check_test()'],
        metadata: {
          checkExpression: columnMetadata.checkExpression
        }
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for column drops
   * @private
   */
  _generateColumnDropTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.SCHEMA,
        priority: TEST_PRIORITIES.CRITICAL, // Always critical for destructive ops
        description: `Verify column ${columnName} dropped from ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: [
          'hasnt_column()',
          'Verify dependent constraints are handled',
          'Verify dependent indexes are handled',
          'Check data integrity after column drop'
        ],
        metadata: {
          destructive: true,
          requiresDataValidation: true
        }
      }
    ];
  }

  /**
   * Generate test requirements for column type changes
   * @private
   */
  _generateColumnTypeChangeTests(operation, tableName, columnName, priority) {
    const requirements = [];
    const sql = operation.sql || '';

    // Extract old and new types from SQL
    const typeChangeInfo = this._parseTypeChange(sql, columnName);

    requirements.push({
      type: TEST_TYPES.SCHEMA,
      priority: TEST_PRIORITIES.HIGH,
      description: `Verify column ${columnName} type change in ${tableName}`,
      target: `${tableName}.${columnName}`,
      testCases: [
        'col_type_is()',
        'Verify existing data compatibility',
        'Test data conversion accuracy'
      ],
      metadata: {
        oldType: typeChangeInfo.oldType,
        newType: typeChangeInfo.newType,
        requiresDataMigration: typeChangeInfo.requiresConversion
      }
    });

    // Add data migration tests for incompatible type changes
    if (typeChangeInfo.requiresConversion) {
      requirements.push({
        type: TEST_TYPES.DATA,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify data migration for ${tableName}.${columnName} type change`,
        target: `${tableName}.${columnName}`,
        testCases: [
          'Test data conversion edge cases',
          'Verify no data loss during conversion',
          'Test boundary values',
          'Validate converted data accuracy'
        ],
        metadata: {
          conversionRequired: true,
          dataValidationCritical: true
        }
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for setting column NOT NULL
   * @private
   */
  _generateColumnNotNullTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.CONSTRAINT,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify column ${columnName} NOT NULL constraint in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: [
          'col_not_null()',
          'Test null insertion rejection',
          'Verify existing data has no nulls',
          'Test constraint enforcement'
        ],
        metadata: {
          constraintType: 'NOT NULL',
          requiresDataValidation: true
        }
      }
    ];
  }

  /**
   * Generate test requirements for dropping NOT NULL constraint
   * @private
   */
  _generateColumnNullableTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify column ${columnName} nullable constraint removed in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: [
          'col_is_null() - column allows nulls',
          'Test null insertion acceptance',
          'Verify constraint properly removed'
        ],
        metadata: {
          constraintType: 'NULLABLE',
          constraintRemoved: true
        }
      }
    ];
  }

  /**
   * Generate test requirements for setting column default
   * @private
   */
  _generateColumnSetDefaultTests(operation, tableName, columnName, priority) {
    const sql = operation.sql || '';
    const defaultValue = this._extractDefaultValue(sql, columnName);

    return [
      {
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify column ${columnName} default value set in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: [
          'col_has_default()',
          'col_default_is()',
          'Test default value application on insert',
          'Verify default value type compatibility'
        ],
        metadata: {
          defaultValue,
          requiresInsertTest: true
        }
      }
    ];
  }

  /**
   * Generate test requirements for dropping column default
   * @private
   */
  _generateColumnDropDefaultTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify column ${columnName} default value removed in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: [
          'col_hasnt_default()',
          'Test explicit value requirement on insert',
          'Verify default properly removed'
        ],
        metadata: {
          defaultRemoved: true,
          requiresInsertTest: true
        }
      }
    ];
  }

  /**
   * Generate test requirements for constraint additions
   * @private
   */
  _generateConstraintTests(operation, tableName, constraintName, priority) {
    const requirements = [];
    const sql = operation.sql || '';
    const constraintType = this._identifyConstraintType(sql);

    switch (constraintType) {
    case 'PRIMARY_KEY':
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify primary key constraint ${constraintName} on ${tableName}`,
        target: `${tableName}.${constraintName}`,
        testCases: [
          'has_pk()',
          'Test uniqueness enforcement',
          'Test null rejection',
          'Verify constraint naming'
        ]
      });
      break;

    case 'FOREIGN_KEY':
      const fkInfo = this._parseForeignKeyConstraint(sql);
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify foreign key constraint ${constraintName} on ${tableName}`,
        target: `${tableName}.${constraintName}`,
        testCases: [
          'has_fk()',
          'fk_ok()',
          'Test referential integrity',
          'Test cascade behavior if applicable'
        ],
        metadata: {
          referencedTable: fkInfo.referencedTable,
          referencedColumn: fkInfo.referencedColumn,
          onDelete: fkInfo.onDelete,
          onUpdate: fkInfo.onUpdate
        }
      });
      break;

    case 'UNIQUE':
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify unique constraint ${constraintName} on ${tableName}`,
        target: `${tableName}.${constraintName}`,
        testCases: [
          'has_unique()',
          'Test uniqueness enforcement',
          'Test duplicate rejection',
          'Verify constraint scope'
        ]
      });
      break;

    case 'CHECK':
      const checkExpression = this._extractCheckExpression(sql);
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify check constraint ${constraintName} on ${tableName}`,
        target: `${tableName}.${constraintName}`,
        testCases: [
          'has_check()',
          'check_test()',
          'Test constraint violation rejection',
          'Test valid values acceptance'
        ],
        metadata: {
          checkExpression
        }
      });
      break;

    default:
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify constraint ${constraintName} on ${tableName}`,
        target: `${tableName}.${constraintName}`,
        testCases: ['Verify constraint existence', 'Test constraint enforcement']
      });
    }

    return requirements;
  }

  /**
   * Generate comprehensive column validation test
   * This ensures all aspects of a column are properly tested after critical changes
   * @private
   */
  _generateComprehensiveColumnValidation(operation, tableName, columnName, priority) {
    return {
      type: TEST_TYPES.SCHEMA,
      priority: TEST_PRIORITIES.HIGH,
      description: `Comprehensive validation for ${tableName}.${columnName}`,
      target: `${tableName}.${columnName}`,
      testCases: [
        'has_column() - verify column exists',
        'col_type_is() - verify correct data type',
        'col_not_null() or col_is_null() - verify nullability',
        'col_has_default() or col_hasnt_default() - verify default state',
        'Verify dependent objects (indexes, constraints)',
        'Test data integrity and constraints',
        'Validate column in table schema'
      ],
      metadata: {
        comprehensive: true,
        validatesAllAspects: true,
        criticalOperation: true,
        requiresFullValidation: true
      }
    };
  }

  /**
   * Helper methods for column operation parsing
   */

  _extractColumnName(sql, operation) {
    const patterns = {
      'ADD COLUMN': /ADD\s+COLUMN\s+([^\s(]+)/i,
      'DROP COLUMN': /DROP\s+COLUMN\s+([^\s,;]+)/i,
      'ALTER COLUMN': /ALTER\s+COLUMN\s+([^\s]+)/i
    };

    const pattern = patterns[operation];
    if (!pattern) return 'unknown_column';

    const match = sql.match(pattern);
    return match ? match[1] : 'unknown_column';
  }

  _extractConstraintName(sql, operation) {
    const pattern = /ADD\s+CONSTRAINT\s+([^\s]+)/i;
    const match = sql.match(pattern);
    return match ? match[1] : 'unknown_constraint';
  }

  _parseColumnConstraints(sql, columnName) {
    // Extract column definition from SQL - everything after the column name
    const columnDefPattern = new RegExp(`${columnName}\\s+(.+?)(?:,|$)`, 'i');
    const match = sql.match(columnDefPattern);

    if (!match) {
      return {
        type: 'unknown',
        notNull: false,
        hasDefault: false,
        isUnique: false,
        isForeignKey: false,
        hasCheckConstraint: false
      };
    }

    const definition = match[1].toUpperCase();

    return {
      type: this._extractDataType(definition),
      notNull: definition.includes('NOT NULL'),
      hasDefault: definition.includes('DEFAULT'),
      defaultValue: this._extractDefaultFromDefinition(definition),
      isUnique: definition.includes('UNIQUE'),
      isForeignKey: definition.includes('REFERENCES'),
      hasCheckConstraint: definition.includes('CHECK'),
      checkExpression: this._extractCheckFromDefinition(definition),
      referencedTable: this._extractReferencedTable(definition),
      referencedColumn: this._extractReferencedColumn(definition)
    };
  }

  _parseTypeChange(sql, columnName) {
    // This is simplified - in production you'd want more sophisticated parsing
    const typePattern = new RegExp(
      `ALTER\\s+COLUMN\\s+${columnName}\\s+(?:SET\\s+DATA\\s+)?TYPE\\s+([^\\s,;]+)`,
      'i'
    );
    const match = sql.match(typePattern);

    return {
      oldType: 'unknown', // Would need schema introspection
      newType: match ? match[1] : 'unknown',
      requiresConversion: true // Conservative assumption
    };
  }

  _extractDefaultValue(sql, columnName) {
    const defaultPattern = new RegExp(
      `ALTER\\s+COLUMN\\s+${columnName}\\s+SET\\s+DEFAULT\\s+([^;,\\s]+(?:\\s*'[^']*')?[^;,]*)`,
      'i'
    );
    const match = sql.match(defaultPattern);
    return match ? match[1].trim() : null;
  }

  _identifyConstraintType(sql) {
    const upperSql = sql.toUpperCase();
    if (upperSql.includes('PRIMARY KEY')) return 'PRIMARY_KEY';
    if (upperSql.includes('FOREIGN KEY') || upperSql.includes('REFERENCES')) return 'FOREIGN_KEY';
    if (upperSql.includes('UNIQUE')) return 'UNIQUE';
    if (upperSql.includes('CHECK')) return 'CHECK';
    return 'UNKNOWN';
  }

  _parseForeignKeyConstraint(sql) {
    const referencesPattern = /REFERENCES\s+([^\s(]+)(?:\s*\(\s*([^)]+)\s*\))?/i;
    const onDeletePattern =
      /ON\s+DELETE\s+(CASCADE|RESTRICT|SET\s+NULL|SET\s+DEFAULT|NO\s+ACTION)/i;
    const onUpdatePattern =
      /ON\s+UPDATE\s+(CASCADE|RESTRICT|SET\s+NULL|SET\s+DEFAULT|NO\s+ACTION)/i;

    const referencesMatch = sql.match(referencesPattern);
    const onDeleteMatch = sql.match(onDeletePattern);
    const onUpdateMatch = sql.match(onUpdatePattern);

    return {
      referencedTable: referencesMatch ? referencesMatch[1] : null,
      referencedColumn: referencesMatch ? referencesMatch[2] : null,
      onDelete: onDeleteMatch ? onDeleteMatch[1] : null,
      onUpdate: onUpdateMatch ? onUpdateMatch[1] : null
    };
  }

  _extractCheckExpression(sql) {
    const checkPattern = /CHECK\s*\(\s*([^)]+)\s*\)/i;
    const match = sql.match(checkPattern);
    return match ? match[1] : null;
  }

  _extractDataType(definition) {
    // Extract the data type including size/precision in parentheses
    const typeMatch = definition.match(/^([^\s]+(?:\([^)]+\))?)/);
    return typeMatch ? typeMatch[1] : 'unknown';
  }

  _extractDefaultFromDefinition(definition) {
    const defaultPattern = /DEFAULT\s+('[^']*'|[^\s]+)/i;
    const match = definition.match(defaultPattern);
    return match ? match[1].trim() : null;
  }

  _extractCheckFromDefinition(definition) {
    const checkPattern = /CHECK\s*\(\s*([^)]+)\s*\)/i;
    const match = definition.match(checkPattern);
    return match ? match[1] : null;
  }

  _extractReferencedTable(definition) {
    const referencesPattern = /REFERENCES\s+([^\s(]+)/i;
    const match = definition.match(referencesPattern);
    return match ? match[1] : null;
  }

  _extractReferencedColumn(definition) {
    const referencesPattern = /REFERENCES\s+[^\s(]+\s*\(\s*([^)]+)\s*\)/i;
    const match = definition.match(referencesPattern);
    return match ? match[1] : null;
  }

  /**
   * Helper methods
   */

  _getBasePriority(operation) {
    switch (operation.type) {
    case 'DESTRUCTIVE':
      return this.options.destructiveOperationPriority;
    case 'WARNING':
      return this.options.warningOperationPriority;
    default:
      return this.options.safeOperationPriority;
    }
  }

  _categorizeOperation(operation) {
    const sql = (operation.sql || '').toUpperCase().trim();

    if (sql.startsWith('CREATE TABLE')) return 'CREATE_TABLE';
    if (sql.startsWith('DROP TABLE')) return 'DROP_TABLE';
    if (sql.startsWith('ALTER TABLE')) {
      if (sql.includes('ENABLE ROW LEVEL SECURITY')) return 'ENABLE_RLS';
      if (sql.includes('DISABLE ROW LEVEL SECURITY')) return 'DISABLE_RLS';
      return 'ALTER_TABLE';
    }

    // Index operations - all use CREATE_INDEX for main switching, specialized handling in _generateIndexTests
    if (sql.includes('CREATE UNIQUE INDEX')) return 'CREATE_INDEX';
    if (sql.includes('CREATE INDEX')) return 'CREATE_INDEX';
    if (sql.includes('DROP INDEX')) return 'CREATE_INDEX';
    if (sql.includes('ALTER INDEX')) return 'CREATE_INDEX';

    // Function operations - all use CREATE_FUNCTION for main switching
    if (sql.includes('CREATE OR REPLACE FUNCTION')) return 'CREATE_FUNCTION';
    if (sql.includes('CREATE FUNCTION')) return 'CREATE_FUNCTION';
    if (sql.includes('DROP FUNCTION')) return 'CREATE_FUNCTION';
    if (sql.includes('ALTER FUNCTION')) return 'CREATE_FUNCTION';
    // Policy operations
    if (sql.includes('CREATE POLICY')) return 'CREATE_POLICY';
    if (sql.includes('ALTER POLICY')) return 'ALTER_POLICY';
    if (sql.includes('DROP POLICY')) return 'DROP_POLICY';
    if (sql.includes('CREATE VIEW')) return 'CREATE_VIEW';
    if (sql.includes('CREATE TYPE')) return 'CREATE_ENUM';

    // Trigger operations (check EVENT TRIGGER before TRIGGER to avoid false matches)
    if (sql.includes('CREATE EVENT TRIGGER')) return 'CREATE_EVENT_TRIGGER';
    if (sql.includes('CREATE TRIGGER')) return 'CREATE_TRIGGER';
    if (sql.includes('ALTER TRIGGER')) return 'ALTER_TRIGGER';
    if (sql.includes('DROP TRIGGER')) return 'DROP_TRIGGER';

    return 'UNKNOWN';
  }

  _extractTargetObject(operation) {
    const sql = operation.sql || '';

    // Extract table name
    let match = sql.match(/(?:CREATE TABLE|DROP TABLE|ALTER TABLE)\s+([^\s(]+)/i);
    if (match) return match[1];

    // Extract index name (handles CREATE, DROP, ALTER INDEX)
    match = sql.match(/(?:CREATE(?:\s+UNIQUE)?\s+INDEX|DROP\s+INDEX|ALTER\s+INDEX)\s+([^\s]+)/i);
    if (match) return match[1];

    // Extract function name (handles CREATE, CREATE OR REPLACE, DROP, ALTER)
    // Handle DROP FUNCTION IF EXISTS specially
    if (sql.includes('DROP FUNCTION IF EXISTS')) {
      match = sql.match(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+([^\s(]+)/i);
      if (match) return match[1];
    }
    match = sql.match(/(?:CREATE(?:\s+OR\s+REPLACE)?|DROP|ALTER)\s+FUNCTION\s+([^\s(]+)/i);
    if (match) return match[1];

    // Extract policy name for CREATE, ALTER, DROP POLICY
    match = sql.match(/(?:CREATE|ALTER|DROP)\s+POLICY\s+([^\s]+)/i);
    if (match) return match[1];

    // Extract view name
    match = sql.match(/CREATE VIEW\s+([^\s]+)/i);
    if (match) return match[1];

    // Extract type name
    match = sql.match(/CREATE TYPE\s+([^\s]+)/i);
    if (match) return match[1];

    // Extract trigger name for CREATE, ALTER, DROP TRIGGER
    match = sql.match(/(?:CREATE|ALTER|DROP)\s+TRIGGER\s+([^\s]+)/i);
    if (match) return match[1];

    // Extract event trigger name
    match = sql.match(/CREATE\s+EVENT\s+TRIGGER\s+([^\s]+)/i);
    if (match) return match[1];

    return 'unknown';
  }

  _isHighRiskOperation(operation) {
    const sql = operation.sql || '';
    return (
      this.highRiskPatterns.some((pattern) => pattern.test(sql)) || operation.type === 'DESTRUCTIVE'
    );
  }

  _requiresSecurityTests(operation) {
    if (!this.options.requireSecurityTests) return false;

    const sql = operation.sql || '';
    return this.securityPatterns.some((pattern) => pattern.test(sql));
  }

  _requiresPerformanceTests(operation) {
    const sql = operation.sql || '';
    return /CREATE.*INDEX|ALTER TABLE.*ADD|VACUUM|ANALYZE/i.test(sql);
  }

  _estimateTestEffort(requirement) {
    const baseEffort = this.options.estimatedEffortPerTest;
    const complexityMultiplier = Math.min(requirement.testCases.length / 3, 3);

    return baseEffort * complexityMultiplier;
  }

  _generateTestReason(requirement, operation) {
    switch (requirement.type) {
    case TEST_TYPES.SCHEMA:
      return 'Ensure schema changes are applied correctly';
    case TEST_TYPES.DATA:
      return 'Verify data integrity after migration';
    case TEST_TYPES.CONSTRAINT:
      return 'Validate constraint enforcement';
    case TEST_TYPES.RLS:
    case TEST_TYPES.PERMISSION:
      return 'Critical security validation required';
    case TEST_TYPES.FUNCTION:
      return 'Ensure function behavior meets requirements';
    default:
      return 'Validate operation completed successfully';
    }
  }

  _generateTestMetadata(requirement, operation, context) {
    return {
      operationType: operation.type,
      operationSQL: operation.sql,
      analysisContext: {
        environment: context.environment || 'unknown',
        timestamp: new Date().toISOString()
      },
      estimatedEffort: this._estimateTestEffort(requirement)
    };
  }

  _extractOperationDescription(operation) {
    return operation.description || operation.sql?.substring(0, 100) + '...' || 'Unknown operation';
  }

  _generateTestingSuggestions(analysis, operations, context) {
    const suggestions = [];

    // High-level coverage suggestions
    if (analysis.summary.totalRequirements === 0) {
      suggestions.push('No test requirements identified - consider reviewing migration complexity');
    } else {
      suggestions.push(`${analysis.summary.totalRequirements} test requirements identified`);
    }

    // Priority-based suggestions
    const criticalTests = analysis.summary.byPriority[TEST_PRIORITIES.CRITICAL] || 0;
    if (criticalTests > 0) {
      suggestions.push(
        `${criticalTests} critical tests required - these must pass before deployment`
      );
    }

    // Risk area suggestions
    if (analysis.riskAreas.length > 0) {
      suggestions.push(
        `${analysis.riskAreas.length} high-risk operations require extra testing attention`
      );
    }

    // Effort estimation
    if (analysis.estimatedEffort > 8) {
      suggestions.push('Consider parallelizing test implementation due to high effort estimate');
    }

    // Security focus
    const securityTests =
      analysis.summary.byType[TEST_TYPES.RLS] ||
      0 + analysis.summary.byType[TEST_TYPES.PERMISSION] ||
      0;
    if (securityTests > 0) {
      suggestions.push('Security-related changes detected - prioritize RLS and permission tests');
    }

    return suggestions;
  }

  /**
   * Generate column test requirements based on operation type
   * @param {Object} operation - Migration operation
   * @param {string} tableName - Table name
   * @param {string} columnName - Column name
   * @param {string} operationType - Type of column operation
   * @param {string} priority - Test priority
   * @returns {Array<TestRequirement>} Array of test requirements
   */
  generateColumnTestRequirements(operation, tableName, columnName, operationType, priority) {
    const requirements = [];

    switch (operationType) {
    case 'ADD_COLUMN':
      requirements.push(
        ...this._generateColumnAdditionTests(operation, tableName, columnName, priority)
      );
      break;
    case 'DROP_COLUMN':
      requirements.push(
        ...this._generateColumnDropTests(operation, tableName, columnName, priority)
      );
      break;
    case 'ALTER_TYPE':
      requirements.push(
        ...this._generateColumnTypeChangeTests(operation, tableName, columnName, priority)
      );
      break;
    case 'SET_NOT_NULL':
      requirements.push(
        ...this._generateColumnNotNullTests(operation, tableName, columnName, priority)
      );
      break;
    case 'DROP_NOT_NULL':
      requirements.push(
        ...this._generateColumnNullableTests(operation, tableName, columnName, priority)
      );
      break;
    case 'SET_DEFAULT':
      requirements.push(
        ...this._generateColumnSetDefaultTests(operation, tableName, columnName, priority)
      );
      break;
    case 'DROP_DEFAULT':
      requirements.push(
        ...this._generateColumnDropDefaultTests(operation, tableName, columnName, priority)
      );
      break;
    default:
      // Generic column operation test
      requirements.push({
        type: TEST_TYPES.SCHEMA,
        priority: TEST_PRIORITIES.MEDIUM,
        description: `Verify column ${columnName} operation in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['has_column()', '-- Verify column operation completed successfully'],
        metadata: {
          operationType,
          tableName,
          columnName
        }
      });
    }

    return requirements;
  }

  /**
   * Generate column addition test requirements
   * @private
   */
  _generateColumnAdditionTests(operation, tableName, columnName, priority) {
    const columnMeta = this._parseColumnDefinition(operation.sql, columnName);
    const testCases = ['has_column()', 'col_type_is()'];

    if (columnMeta && columnMeta.notNull) {
      testCases.push('col_not_null()');
    }

    if (columnMeta && columnMeta.hasDefault) {
      testCases.push('col_has_default()');
    }

    return [
      {
        type: TEST_TYPES.SCHEMA,
        priority,
        description: `Verify column ${columnName} added to ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases,
        metadata: columnMeta
      }
    ];
  }

  /**
   * Generate column drop test requirements
   * @private
   */
  _generateColumnDropTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.SCHEMA,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify column ${columnName} dropped from ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['hasnt_column()'],
        metadata: { destructive: true }
      },
      {
        type: TEST_TYPES.DATA,
        priority: TEST_PRIORITIES.HIGH,
        description: `Comprehensive validation after ${columnName} drop from ${tableName}`,
        target: tableName,
        testCases: ['-- Verify table structure integrity', '-- Check remaining columns are intact']
      }
    ];
  }

  /**
   * Generate column type change test requirements
   * @private
   */
  _generateColumnTypeChangeTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.SCHEMA,
        priority,
        description: `Verify ${columnName} type change in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['col_type_is()']
      },
      {
        type: TEST_TYPES.DATA,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Verify data migration for ${columnName} in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['-- Test data conversion', '-- Verify no data loss']
      },
      {
        type: TEST_TYPES.DATA,
        priority: TEST_PRIORITIES.HIGH,
        description: `Comprehensive validation after ${columnName} type change`,
        target: tableName,
        testCases: ['-- Check data integrity', '-- Test edge cases']
      }
    ];
  }

  /**
   * Generate NOT NULL constraint test requirements
   * @private
   */
  _generateColumnNotNullTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify NOT NULL constraint on ${columnName} in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['col_not_null()'],
        metadata: { constraintType: 'NOT NULL' }
      },
      {
        type: TEST_TYPES.DATA,
        priority: TEST_PRIORITIES.HIGH,
        description: 'Comprehensive validation after NOT NULL constraint',
        target: tableName,
        testCases: [
          '-- Verify existing data compatibility',
          '-- Test INSERT operations require value'
        ]
      }
    ];
  }

  /**
   * Generate nullable constraint test requirements
   * @private
   */
  _generateColumnNullableTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify nullable constraint removed from ${columnName} in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['col_is_null() - column allows nulls'],
        metadata: { constraintRemoved: true }
      }
    ];
  }

  /**
   * Generate SET DEFAULT test requirements
   * @private
   */
  _generateColumnSetDefaultTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify default value set for ${columnName} in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['col_has_default()', 'col_default_is()'],
        metadata: { requiresInsertTest: true }
      }
    ];
  }

  /**
   * Generate DROP DEFAULT test requirements
   * @private
   */
  _generateColumnDropDefaultTests(operation, tableName, columnName, priority) {
    return [
      {
        type: TEST_TYPES.CONSTRAINT,
        priority,
        description: `Verify default value removed from ${columnName} in ${tableName}`,
        target: `${tableName}.${columnName}`,
        testCases: ['col_hasnt_default()'],
        metadata: { defaultRemoved: true }
      }
    ];
  }

  /**
   * Extract column name from SQL operation
   * @private
   * @param {string} sql - SQL statement
   * @param {string} operation - Operation type (ADD COLUMN, DROP COLUMN, etc.)
   * @returns {string} Column name
   */
  _extractColumnName(sql, operation) {
    const upperSql = sql.toUpperCase();
    const operationUpper = operation.toUpperCase();

    const operationIndex = upperSql.indexOf(operationUpper);
    if (operationIndex === -1) {
      return 'unknown';
    }

    const afterOperation = sql.substring(operationIndex + operation.length).trim();
    const parts = afterOperation.split(/\s+/);

    if (parts.length > 0) {
      return parts[0].replace(/[";,]/g, '').replace(/"/g, '');
    }

    return 'unknown';
  }

  /**
   * Extract constraint name from SQL operation
   * @private
   * @param {string} sql - SQL statement
   * @param {string} operation - Operation type
   * @returns {string} Constraint name
   */
  _extractConstraintName(sql, operation) {
    const constraintMatch = sql.match(new RegExp(`${operation}\\s+([^\\s]+)`, 'i'));
    return constraintMatch ? constraintMatch[1].replace(/"/g, '') : 'unknown';
  }

  /**
   * Identify constraint type from SQL
   * @private
   * @param {string} sql - SQL statement
   * @returns {string} Constraint type
   */
  _identifyConstraintType(sql) {
    const upperSql = sql.toUpperCase();

    if (upperSql.includes('PRIMARY KEY')) {
      return 'PRIMARY_KEY';
    } else if (upperSql.includes('FOREIGN KEY')) {
      return 'FOREIGN_KEY';
    } else if (upperSql.includes('UNIQUE')) {
      return 'UNIQUE';
    } else if (upperSql.includes('CHECK')) {
      return 'CHECK';
    }

    return 'UNKNOWN';
  }

  /**
   * Parse column constraints from SQL (alias for _parseColumnDefinition for test compatibility)
   * @private
   * @param {string} sql - SQL statement
   * @param {string} columnName - Column name
   * @returns {Object|null} Parsed column information
   */
  _parseColumnConstraints(sql, columnName) {
    return this._parseColumnDefinition(sql, columnName);
  }

  /**
   * Parse table structure from CREATE TABLE SQL
   * @private
   * @param {string} sql - CREATE TABLE SQL statement
   * @returns {Object} Parsed table structure
   */
  _parseTableStructure(sql) {
    const structure = {
      columns: [],
      primaryKeys: [],
      foreignKeys: [],
      checkConstraints: [],
      uniqueConstraints: [],
      indexes: []
    };

    try {
      // Extract table definition inside parentheses
      const tableDefMatch = sql.match(/CREATE TABLE\s+[^\s(]+\s*\(([\s\S]*?)\)(?:\s*;|\s*$)/i);
      if (!tableDefMatch) {
        return structure;
      }

      const tableDef = tableDefMatch[1];

      // Parse column definitions and constraints
      const items = this._splitTableItems(tableDef);

      for (const item of items) {
        const cleanItem = item.trim();

        if (cleanItem.toUpperCase().startsWith('PRIMARY KEY')) {
          // Parse primary key constraint
          const pkMatch = cleanItem.match(/PRIMARY KEY\s*\(\s*([^)]+)\s*\)/i);
          if (pkMatch) {
            structure.primaryKeys = pkMatch[1]
              .split(',')
              .map((col) => col.trim().replace(/"/g, ''));
          }
        } else if (cleanItem.toUpperCase().startsWith('FOREIGN KEY')) {
          // Parse foreign key constraint
          const fkMatch = cleanItem.match(
            /FOREIGN KEY\s*\(\s*([^)]+)\s*\)\s*REFERENCES\s+([^\s(]+)\s*\(\s*([^)]+)\s*\)/i
          );
          if (fkMatch) {
            structure.foreignKeys.push({
              column: fkMatch[1].trim().replace(/"/g, ''),
              referencedTable: fkMatch[2].trim().replace(/"/g, ''),
              referencedColumn: fkMatch[3].trim().replace(/"/g, '')
            });
          }
        } else if (cleanItem.toUpperCase().startsWith('UNIQUE')) {
          // Parse unique constraint
          const uniqueMatch = cleanItem.match(/UNIQUE\s*(?:\(\s*([^)]+)\s*\))?/i);
          if (uniqueMatch) {
            structure.uniqueConstraints.push({
              name: `unique_${uniqueMatch[1] || 'constraint'}`,
              columns: uniqueMatch[1] ? uniqueMatch[1].split(',').map((c) => c.trim()) : []
            });
          }
        } else if (cleanItem.toUpperCase().startsWith('CHECK')) {
          // Parse check constraint
          const checkMatch = cleanItem.match(/CHECK\s*\(([^)]+)\)/i);
          if (checkMatch) {
            structure.checkConstraints.push({
              name: `check_constraint_${Date.now()}`,
              expression: checkMatch[1]
            });
          }
        } else if (cleanItem.toUpperCase().includes('CONSTRAINT')) {
          // Parse named constraints
          const constraintMatch = cleanItem.match(/CONSTRAINT\s+([^\s]+)\s+(.*)/i);
          if (constraintMatch) {
            const constraintName = constraintMatch[1];
            const constraintDef = constraintMatch[2];

            if (constraintDef.toUpperCase().startsWith('PRIMARY KEY')) {
              const pkMatch = constraintDef.match(/PRIMARY KEY\s*\(\s*([^)]+)\s*\)/i);
              if (pkMatch) {
                structure.primaryKeys = pkMatch[1]
                  .split(',')
                  .map((col) => col.trim().replace(/"/g, ''));
              }
            } else if (constraintDef.toUpperCase().startsWith('FOREIGN KEY')) {
              const fkMatch = constraintDef.match(
                /FOREIGN KEY\s*\(\s*([^)]+)\s*\)\s*REFERENCES\s+([^\s(]+)\s*\(\s*([^)]+)\s*\)/i
              );
              if (fkMatch) {
                structure.foreignKeys.push({
                  name: constraintName,
                  column: fkMatch[1].trim().replace(/"/g, ''),
                  referencedTable: fkMatch[2].trim().replace(/"/g, ''),
                  referencedColumn: fkMatch[3].trim().replace(/"/g, '')
                });
              }
            } else if (constraintDef.toUpperCase().startsWith('UNIQUE')) {
              const uniqueMatch = constraintDef.match(/UNIQUE\s*\(\s*([^)]+)\s*\)/i);
              if (uniqueMatch) {
                structure.uniqueConstraints.push({
                  name: constraintName,
                  columns: uniqueMatch[1].split(',').map((c) => c.trim().replace(/"/g, ''))
                });
              }
            } else if (constraintDef.toUpperCase().startsWith('CHECK')) {
              const checkMatch = constraintDef.match(/CHECK\s*\(([^)]+)\)/i);
              if (checkMatch) {
                structure.checkConstraints.push({
                  name: constraintName,
                  expression: checkMatch[1]
                });
              }
            }
          }
        } else {
          // Parse column definition
          const column = this._parseColumnDefinition(cleanItem);
          if (column) {
            structure.columns.push(column);
          }
        }
      }
    } catch (error) {
      // If parsing fails, return basic structure
      console.warn('Failed to parse table structure:', error.message);
    }

    return structure;
  }

  /**
   * Parse table alterations from ALTER TABLE SQL
   * @private
   * @param {string} sql - ALTER TABLE SQL statement
   * @param {string} tableName - Table name being altered
   * @returns {Object} Parsed alterations
   */
  _parseTableAlterations(sql, tableName) {
    const alterations = {
      addedColumns: [],
      droppedColumns: [],
      alteredColumns: [],
      renamedColumns: [],
      renamedTo: null,
      addedConstraints: [],
      droppedConstraints: []
    };

    try {
      const upperSql = sql.toUpperCase();

      // Handle ADD COLUMN
      const addColumnRegex =
        /ADD\s+(?:COLUMN\s+)?([^\s,;]+)\s+([^,;]*?)(?=\s*(?:,|;|$|ADD|DROP|ALTER))/gi;
      let addMatch;
      while ((addMatch = addColumnRegex.exec(upperSql)) !== null) {
        const columnName = addMatch[1].replace(/"/g, '');
        const columnDef = addMatch[2].trim();
        alterations.addedColumns.push(this._parseColumnDefinition(`${columnName} ${columnDef}`));
      }

      // Handle DROP COLUMN
      const dropColumnRegex = /DROP\s+(?:COLUMN\s+)?([^\s,;]+)/gi;
      let dropMatch;
      while ((dropMatch = dropColumnRegex.exec(upperSql)) !== null) {
        alterations.droppedColumns.push(dropMatch[1].replace(/"/g, ''));
      }

      // Handle ALTER COLUMN TYPE
      const alterTypeRegex =
        /ALTER\s+(?:COLUMN\s+)?([^\s]+)\s+(?:SET\s+DATA\s+)?TYPE\s+([^\s,;]+)/gi;
      let alterTypeMatch;
      while ((alterTypeMatch = alterTypeRegex.exec(upperSql)) !== null) {
        alterations.alteredColumns.push({
          name: alterTypeMatch[1].replace(/"/g, ''),
          newType: alterTypeMatch[2],
          oldType: 'unknown' // Would need additional context to determine old type
        });
      }

      // Handle RENAME TABLE
      const renameTableMatch = upperSql.match(/RENAME\s+TO\s+([^\s;]+)/i);
      if (renameTableMatch) {
        alterations.renamedTo = renameTableMatch[1].replace(/"/g, '');
      }

      // Handle RENAME COLUMN
      const renameColumnRegex = /RENAME\s+(?:COLUMN\s+)?([^\s]+)\s+TO\s+([^\s,;]+)/gi;
      let renameColMatch;
      while ((renameColMatch = renameColumnRegex.exec(upperSql)) !== null) {
        alterations.renamedColumns.push({
          oldName: renameColMatch[1].replace(/"/g, ''),
          newName: renameColMatch[2].replace(/"/g, ''),
          type: 'unknown' // Would need additional context to determine type
        });
      }

      // Handle ADD CONSTRAINT
      const addConstraintRegex =
        /ADD\s+(?:CONSTRAINT\s+([^\s]+)\s+)?(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\s*([^,;]*?)(?=\s*(?:,|;|$|ADD|DROP|ALTER))/gi;
      let constraintMatch;
      while ((constraintMatch = addConstraintRegex.exec(upperSql)) !== null) {
        const constraintName = constraintMatch[1] || `auto_${Date.now()}`;
        const constraintType = constraintMatch[2].replace(/\s+/g, ' ');
        const constraintDef = constraintMatch[3].trim();

        const constraint = {
          name: constraintName.replace(/"/g, ''),
          type: constraintType,
          definition: constraintDef
        };

        // Parse specific constraint details
        if (constraintType.includes('FOREIGN KEY')) {
          const fkMatch = constraintDef.match(
            /\(\s*([^)]+)\s*\)\s*REFERENCES\s+([^\s(]+)\s*\(\s*([^)]+)\s*\)/i
          );
          if (fkMatch) {
            constraint.column = fkMatch[1].trim().replace(/"/g, '');
            constraint.referencedTable = fkMatch[2].trim().replace(/"/g, '');
            constraint.referencedColumn = fkMatch[3].trim().replace(/"/g, '');
          }
        } else if (constraintType.includes('PRIMARY KEY')) {
          const pkMatch = constraintDef.match(/\(\s*([^)]+)\s*\)/i);
          if (pkMatch) {
            constraint.columns = pkMatch[1].split(',').map((col) => col.trim().replace(/"/g, ''));
          }
        }

        alterations.addedConstraints.push(constraint);
      }

      // Handle DROP CONSTRAINT
      const dropConstraintRegex = /DROP\s+CONSTRAINT\s+([^\s,;]+)/gi;
      let dropConstraintMatch;
      while ((dropConstraintMatch = dropConstraintRegex.exec(upperSql)) !== null) {
        alterations.droppedConstraints.push({
          name: dropConstraintMatch[1].replace(/"/g, '')
        });
      }
    } catch (error) {
      console.warn('Failed to parse table alterations:', error.message);
    }

    return alterations;
  }

  /**
   * Parse individual column definition
   * @private
   * @param {string} columnDef - Column definition string
   * @returns {Object|null} Parsed column information
   */
  _parseColumnDefinition(columnDef, columnName = null) {
    if (!columnDef || !columnDef.trim()) {
      return null;
    }

    try {
      const parts = columnDef.trim().split(/\s+/);
      if (parts.length < 2) {
        return null;
      }

      // Handle different SQL formats
      let nameIndex = null;
      let typeIndex = 1;

      if (columnName) {
        // If column name is provided separately, find it in the SQL and get the type after it
        const upperSql = columnDef.toUpperCase();
        const upperColumnName = columnName.toUpperCase();
        const columnIndex = upperSql.indexOf(upperColumnName);

        if (columnIndex !== -1) {
          // Find the position of the column name in the parts array
          const beforeColumn = columnDef.substring(0, columnIndex);
          const beforeParts = beforeColumn.trim() ? beforeColumn.trim().split(/\s+/) : [];
          nameIndex = beforeParts.length;
          typeIndex = nameIndex + 1;
        } else {
          // Column name not found in SQL, try to infer position
          if (parts[0].toUpperCase() === 'ADD' && parts[1].toUpperCase() === 'COLUMN') {
            nameIndex = 2;
            typeIndex = 3;
          } else if (parts[0].toUpperCase() === 'ADD') {
            nameIndex = 1;
            typeIndex = 2;
          }
        }
      } else if (parts[0].toUpperCase() === 'ADD' && parts[1].toUpperCase() === 'COLUMN') {
        // Handle "ADD COLUMN name type" format
        nameIndex = 2;
        typeIndex = 3;
      } else if (parts[0].toUpperCase() === 'ADD') {
        // Handle "ADD name type" format
        nameIndex = 1;
        typeIndex = 2;
      } else {
        // Default "name type" format
        nameIndex = 0;
        typeIndex = 1;
      }

      const column = {
        name:
          columnName ||
          (nameIndex !== null && nameIndex < parts.length
            ? parts[nameIndex].replace(/"/g, '')
            : 'unknown'),
        type: this._parseColumnType(parts, typeIndex),
        notNull: false,
        hasDefault: false,
        defaultValue: null,
        foreignKey: null,
        isUnique: false
      };

      const defString = columnDef.toUpperCase();

      // Check for NOT NULL
      column.notNull = defString.includes('NOT NULL');

      // Check for UNIQUE
      column.isUnique = defString.includes('UNIQUE');

      // Check for DEFAULT - more comprehensive pattern, preserve original case
      const defaultMatch = columnDef.match(
        /DEFAULT\s+('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\d+\.?\d*|[a-zA-Z_][a-zA-Z0-9_]*(?:\([^)]*\))?)/i
      );
      if (defaultMatch) {
        column.hasDefault = true;
        column.defaultValue = defaultMatch[1];
      }

      // Check for inline foreign key reference
      const referencesMatch = defString.match(/REFERENCES\s+([^\s(]+)(?:\s*\(\s*([^)]+)\s*\))?/i);
      if (referencesMatch) {
        column.foreignKey = {
          referencedTable: referencesMatch[1].replace(/"/g, ''),
          referencedColumn: referencesMatch[2] ? referencesMatch[2].replace(/"/g, '') : 'id'
        };
      }

      return column;
    } catch (error) {
      console.warn('Failed to parse column definition:', columnDef, error.message);
      return null;
    }
  }

  /**
   * Parse column type including size specifications
   * @private
   * @param {Array<string>} parts - Split column definition parts
   * @param {number} typeIndex - Index where type definition starts
   * @returns {string} Parsed column type
   */
  _parseColumnType(parts, typeIndex) {
    if (!parts || typeIndex >= parts.length) {
      return 'UNKNOWN';
    }

    let type = parts[typeIndex].toUpperCase();

    // Check if next part contains size specification
    if (typeIndex + 1 < parts.length && parts[typeIndex + 1].match(/^\(\d+(?:,\d+)?\)$/)) {
      type += parts[typeIndex + 1];
    } else if (type.includes('(')) {
      // Type already includes size specification
      // Check if it spans multiple parts due to spacing
      let i = typeIndex + 1;
      while (i < parts.length && !type.includes(')')) {
        type += parts[i];
        i++;
      }
    }

    return type;
  }

  /**
   * Split table items (columns and constraints) while respecting parentheses
   * @private
   * @param {string} tableDef - Table definition content
   * @returns {Array<string>} Array of table items
   */
  _splitTableItems(tableDef) {
    const items = [];
    let current = '';
    let parenDepth = 0;
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < tableDef.length; i++) {
      const char = tableDef[i];
      const prevChar = i > 0 ? tableDef[i - 1] : null;

      // Handle quotes
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
      }

      if (!inQuotes) {
        // Track parentheses depth
        if (char === '(') {
          parenDepth++;
        } else if (char === ')') {
          parenDepth--;
        } else if (char === ',' && parenDepth === 0) {
          // Split on comma only at top level
          if (current.trim()) {
            items.push(current.trim());
          }
          current = '';
          continue;
        }
      }

      current += char;
    }

    // Add the last item
    if (current.trim()) {
      items.push(current.trim());
    }

    return items;
  }

  _comparePriority(priority1, priority2) {
    const priorities = [
      TEST_PRIORITIES.LOW,
      TEST_PRIORITIES.MEDIUM,
      TEST_PRIORITIES.HIGH,
      TEST_PRIORITIES.CRITICAL
    ];
    return priorities.indexOf(priority2) - priorities.indexOf(priority1); // Reverse order (highest first)
  }

  /**
   * Generate test requirements for trigger creation
   * @private
   * @param {Object} operation - The CREATE TRIGGER operation
   * @param {string} target - The trigger name
   * @param {string} priority - Test priority level
   * @returns {Array<TestRequirement>} Array of test requirements
   */
  _generateTriggerCreationTests(operation, target, priority) {
    const requirements = [];
    const sql = operation.sql || '';
    const triggerDetails = this._parseTriggerDetails(sql);

    // Basic trigger existence test
    requirements.push({
      type: TEST_TYPES.TRIGGER,
      priority,
      description: `Verify trigger ${target} exists with correct properties`,
      target,
      testCases: [
        'has_trigger() - trigger exists',
        'trigger_is() - trigger function validation',
        'is_trigger_on() - verify correct table',
        'trigger_fires_on() - verify trigger events',
        'trigger_is_for() - verify trigger level (ROW/STATEMENT)'
      ],
      metadata: {
        tableName: triggerDetails.tableName,
        functionName: triggerDetails.functionName,
        timing: triggerDetails.timing,
        events: triggerDetails.events,
        level: triggerDetails.level,
        condition: triggerDetails.condition
      }
    });

    // Trigger function validation test
    if (triggerDetails.functionName) {
      requirements.push({
        type: TEST_TYPES.FUNCTION,
        priority: TEST_PRIORITIES.HIGH,
        description: `Verify trigger function ${triggerDetails.functionName} behavior`,
        target: triggerDetails.functionName,
        testCases: [
          'has_function() - function exists',
          'function_returns() - returns TRIGGER type',
          'Test function handles TG_OP correctly',
          'Test function handles OLD/NEW records',
          'Verify function error handling'
        ],
        metadata: {
          isTriggerFunction: true,
          associatedTrigger: target,
          returnType: 'trigger'
        }
      });
    }

    // Behavioral tests for trigger firing
    requirements.push({
      type: TEST_TYPES.DATA,
      priority: TEST_PRIORITIES.HIGH,
      description: `Test trigger ${target} firing conditions and behavior`,
      target,
      testCases: [
        'Test trigger fires on correct operations',
        'Test trigger timing (BEFORE/AFTER/INSTEAD OF)',
        'Test data modifications by trigger',
        'Test trigger with different data scenarios',
        'Test cascade effects of trigger actions'
      ],
      metadata: {
        behaviorTests: this._generateTriggerBehaviorTests(triggerDetails),
        requiresDataSetup: true,
        testComplexity: 'high'
      }
    });

    // Constraint trigger specific tests
    if (triggerDetails.isConstraintTrigger) {
      requirements.push({
        type: TEST_TYPES.CONSTRAINT,
        priority: TEST_PRIORITIES.CRITICAL,
        description: `Test constraint trigger ${target} enforcement`,
        target,
        testCases: [
          'Test constraint enforcement behavior',
          'Test deferred constraint checking',
          'Test constraint violation handling',
          'Test transaction rollback on constraint failure'
        ],
        metadata: {
          isConstraintTrigger: true,
          deferrable: triggerDetails.deferrable,
          initiallyDeferred: triggerDetails.initiallyDeferred
        }
      });
    }

    // Performance tests for potentially expensive triggers
    if (
      this.options.requirePerformanceTests &&
      this._isTriggerPerformanceSensitive(triggerDetails)
    ) {
      requirements.push({
        type: TEST_TYPES.INDEX,
        priority: TEST_PRIORITIES.MEDIUM,
        description: `Test performance impact of trigger ${target}`,
        target,
        testCases: [
          'Measure operation performance with/without trigger',
          'Test trigger performance with large data sets',
          "Verify trigger doesn't create deadlocks",
          'Test concurrent operation performance'
        ],
        metadata: {
          performanceSensitive: true,
          requiresBenchmarking: true
        }
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for trigger alterations
   * @private
   * @param {Object} operation - The ALTER TRIGGER operation
   * @param {string} target - The trigger name
   * @param {string} priority - Test priority level
   * @returns {Array<TestRequirement>} Array of test requirements
   */
  _generateTriggerAlterationTests(operation, target, priority) {
    const requirements = [];
    const sql = operation.sql || '';

    // Basic trigger property verification
    requirements.push({
      type: TEST_TYPES.TRIGGER,
      priority: TEST_PRIORITIES.HIGH,
      description: `Verify trigger ${target} alterations applied correctly`,
      target,
      testCases: [
        'has_trigger() - trigger still exists',
        'trigger_is() - verify updated properties',
        'Test altered trigger behavior',
        'Verify backward compatibility where applicable'
      ],
      metadata: {
        alterationType: this._parseAlterationType(sql),
        requiresRegression: true
      }
    });

    // If enabling/disabling trigger
    if (sql.toUpperCase().includes('ENABLE') || sql.toUpperCase().includes('DISABLE')) {
      const isEnabled = sql.toUpperCase().includes('ENABLE');
      requirements.push({
        type: TEST_TYPES.DATA,
        priority: TEST_PRIORITIES.HIGH,
        description: `Test trigger ${target} ${isEnabled ? 'enabled' : 'disabled'} state`,
        target,
        testCases: [
          isEnabled
            ? 'Test trigger fires after being enabled'
            : 'Test trigger does not fire when disabled',
          'Verify state change is persistent',
          'Test operations that should/should not trigger'
        ],
        metadata: {
          stateChange: isEnabled ? 'enabled' : 'disabled',
          requiresStateTesting: true
        }
      });
    }

    return requirements;
  }

  /**
   * Generate test requirements for trigger drops
   * @private
   * @param {Object} operation - The DROP TRIGGER operation
   * @param {string} target - The trigger name
   * @param {string} priority - Test priority level
   * @returns {Array<TestRequirement>} Array of test requirements
   */
  _generateTriggerDropTests(operation, target, priority) {
    const requirements = [];

    // Trigger removal verification
    requirements.push({
      type: TEST_TYPES.TRIGGER,
      priority: TEST_PRIORITIES.CRITICAL, // Always critical for destructive ops
      description: `Verify trigger ${target} is properly dropped`,
      target,
      testCases: [
        'hasnt_trigger() - trigger no longer exists',
        'Test operations no longer fire the trigger',
        'Verify dependent objects are handled correctly',
        'Test that trigger function still exists (if shared)'
      ],
      metadata: {
        destructiveOperation: true,
        requiresCleanupVerification: true
      }
    });

    // Behavioral verification that trigger is no longer active
    requirements.push({
      type: TEST_TYPES.DATA,
      priority: TEST_PRIORITIES.HIGH,
      description: `Test that operations are not affected by dropped trigger ${target}`,
      target,
      testCases: [
        'Test INSERT operations without trigger effects',
        'Test UPDATE operations without trigger effects',
        'Test DELETE operations without trigger effects',
        'Verify performance improvement (if applicable)'
      ],
      metadata: {
        behaviorVerification: true,
        operationsTested: ['INSERT', 'UPDATE', 'DELETE']
      }
    });

    return requirements;
  }

  /**
   * Generate test requirements for event triggers
   * @private
   * @param {Object} operation - The CREATE EVENT TRIGGER operation
   * @param {string} target - The event trigger name
   * @param {string} priority - Test priority level
   * @returns {Array<TestRequirement>} Array of test requirements
   */
  _generateEventTriggerTests(operation, target, priority) {
    const requirements = [];
    const sql = operation.sql || '';
    const eventDetails = this._parseEventTriggerDetails(sql);

    // Event trigger existence and properties
    requirements.push({
      type: TEST_TYPES.TRIGGER,
      priority,
      description: `Verify event trigger ${target} exists and fires correctly`,
      target,
      testCases: [
        'has_trigger() - event trigger exists',
        'Test event trigger fires on DDL commands',
        'Test event trigger function receives correct event data',
        'Verify event trigger timing (before/after)',
        'Test event trigger filter conditions'
      ],
      metadata: {
        isEventTrigger: true,
        events: eventDetails.events,
        filterConditions: eventDetails.filterConditions,
        functionName: eventDetails.functionName
      }
    });

    // Event trigger function tests
    if (eventDetails.functionName) {
      requirements.push({
        type: TEST_TYPES.FUNCTION,
        priority: TEST_PRIORITIES.HIGH,
        description: `Test event trigger function ${eventDetails.functionName}`,
        target: eventDetails.functionName,
        testCases: [
          'has_function() - function exists',
          'function_returns() - returns event_trigger type',
          'Test function handles TG_EVENT correctly',
          'Test function accesses pg_event_trigger_ddl_commands()',
          "Verify function error handling doesn't block DDL"
        ],
        metadata: {
          isEventTriggerFunction: true,
          associatedEventTrigger: target,
          returnType: 'event_trigger'
        }
      });
    }

    // DDL operation behavior tests
    requirements.push({
      type: TEST_TYPES.SCHEMA,
      priority: TEST_PRIORITIES.HIGH,
      description: `Test DDL operations with event trigger ${target}`,
      target,
      testCases: [
        'Test CREATE operations trigger the event',
        'Test ALTER operations trigger the event',
        'Test DROP operations trigger the event',
        "Test event trigger doesn't break normal DDL",
        'Test event trigger handles DDL failures gracefully'
      ],
      metadata: {
        ddlOperationsTested: eventDetails.events || ['ddl_command_start', 'ddl_command_end'],
        requiresDDLTesting: true
      }
    });

    return requirements;
  }

  /**
   * Parse trigger details from SQL
   * @private
   * @param {string} sql - CREATE TRIGGER SQL statement
   * @returns {Object} Parsed trigger details
   */
  _parseTriggerDetails(sql) {
    const details = {};

    // Extract table name
    const tableMatch = sql.match(/ON\s+([^\s]+)/i);
    details.tableName = tableMatch ? tableMatch[1] : null;

    // Extract function name
    const functionMatch = sql.match(/EXECUTE\s+(?:PROCEDURE\s+|FUNCTION\s+)?([^\s(]+)/i);
    details.functionName = functionMatch ? functionMatch[1] : null;

    // Extract timing (BEFORE, AFTER, INSTEAD OF)
    if (sql.toUpperCase().includes('BEFORE')) details.timing = ['BEFORE'];
    else if (sql.toUpperCase().includes('AFTER')) details.timing = ['AFTER'];
    else if (sql.toUpperCase().includes('INSTEAD OF')) details.timing = ['INSTEAD OF'];

    // Extract events
    details.events = [];
    if (sql.toUpperCase().includes('INSERT')) details.events.push('INSERT');
    if (sql.toUpperCase().includes('UPDATE')) details.events.push('UPDATE');
    if (sql.toUpperCase().includes('DELETE')) details.events.push('DELETE');
    if (sql.toUpperCase().includes('TRUNCATE')) details.events.push('TRUNCATE');

    // Extract level
    details.level = sql.toUpperCase().includes('FOR EACH ROW') ? 'ROW' : 'STATEMENT';

    // Extract condition
    const conditionMatch = sql.match(/WHEN\s*\(([^)]+)\)/i);
    details.condition = conditionMatch ? conditionMatch[1] : null;

    // Check if constraint trigger
    details.isConstraintTrigger = sql.toUpperCase().includes('CONSTRAINT TRIGGER');
    details.deferrable = sql.toUpperCase().includes('DEFERRABLE');
    details.initiallyDeferred = sql.toUpperCase().includes('INITIALLY DEFERRED');

    return details;
  }

  /**
   * Parse event trigger details from SQL
   * @private
   * @param {string} sql - CREATE EVENT TRIGGER SQL statement
   * @returns {Object} Parsed event trigger details
   */
  _parseEventTriggerDetails(sql) {
    const details = {};

    // Extract function name
    const functionMatch = sql.match(/EXECUTE\s+(?:PROCEDURE\s+|FUNCTION\s+)?([^\s(]+)/i);
    details.functionName = functionMatch ? functionMatch[1] : null;

    // Extract events
    const eventMatch = sql.match(/ON\s+([^\s]+)/i);
    if (eventMatch) {
      details.events = [eventMatch[1].toLowerCase()];
    } else {
      details.events = ['ddl_command_start'];
    }

    // Extract filter conditions
    const filterMatch = sql.match(/WHEN\s+TAG\s+IN\s*\(([^)]+)\)/i);
    if (filterMatch) {
      details.filterConditions = filterMatch[1]
        .split(',')
        .map((tag) => tag.trim().replace(/'/g, ''));
    }

    return details;
  }

  /**
   * Generate behavioral test scenarios for triggers
   * @private
   * @param {Object} triggerDetails - Parsed trigger details
   * @returns {Array<Object>} Array of behavior test scenarios
   */
  _generateTriggerBehaviorTests(triggerDetails) {
    const scenarios = [];

    // Generate scenarios based on events
    (triggerDetails.events || []).forEach((event) => {
      scenarios.push({
        scenario: `Test ${event} operation fires trigger`,
        operation: event,
        expectedResult: 'Trigger function executes and modifies data as expected'
      });

      if (triggerDetails.condition) {
        scenarios.push({
          scenario: `Test ${event} with condition evaluation`,
          operation: event,
          expectedResult: `Trigger fires only when condition (${triggerDetails.condition}) is true`
        });
      }
    });

    // Add timing-specific scenarios
    if (triggerDetails.timing && triggerDetails.timing.includes('BEFORE')) {
      scenarios.push({
        scenario: 'Test BEFORE trigger can prevent operation',
        operation: 'INSERT/UPDATE/DELETE',
        expectedResult: 'Operation is prevented when trigger returns NULL'
      });
    }

    // Add level-specific scenarios
    if (triggerDetails.level === 'ROW') {
      scenarios.push({
        scenario: 'Test trigger fires once per affected row',
        operation: 'Multi-row operation',
        expectedResult: 'Trigger executes once for each row affected'
      });
    } else if (triggerDetails.level === 'STATEMENT') {
      scenarios.push({
        scenario: 'Test trigger fires once per statement',
        operation: 'Multi-row operation',
        expectedResult: 'Trigger executes once regardless of rows affected'
      });
    }

    return scenarios;
  }

  /**
   * Parse alteration type from ALTER TRIGGER SQL
   * @private
   * @param {string} sql - ALTER TRIGGER SQL statement
   * @returns {string} Type of alteration
   */
  _parseAlterationType(sql) {
    const upperSql = sql.toUpperCase();
    if (upperSql.includes('ENABLE')) return 'ENABLE';
    if (upperSql.includes('DISABLE')) return 'DISABLE';
    if (upperSql.includes('RENAME')) return 'RENAME';
    return 'MODIFY';
  }

  /**
   * Check if trigger is performance sensitive
   * @private
   * @param {Object} triggerDetails - Parsed trigger details
   * @returns {boolean} True if trigger may have performance impact
   */
  _isTriggerPerformanceSensitive(triggerDetails) {
    // Row-level triggers on high-frequency operations are performance sensitive
    if (
      triggerDetails.level === 'ROW' &&
      triggerDetails.events &&
      (triggerDetails.events.includes('INSERT') || triggerDetails.events.includes('UPDATE'))
    ) {
      return true;
    }

    // Complex trigger functions may be performance sensitive
    if (
      triggerDetails.functionName &&
      (triggerDetails.functionName.includes('complex') ||
        triggerDetails.functionName.includes('heavy'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Aggregate test requirements from multiple operations
   * Combines requirements by target object, merges duplicates intelligently,
   * resolves priority conflicts, and generates summary statistics
   *
   * @param {Array<Array<TestRequirement>>} requirementsList - Array of requirement arrays from multiple operations
   * @returns {Object} Aggregated requirements with deduplication and statistics
   */
  aggregateRequirements(requirementsList) {
    if (!Array.isArray(requirementsList) || requirementsList.length === 0) {
      return {
        requirements: [],
        summary: {
          totalRequirements: 0,
          totalOperations: 0,
          duplicatesRemoved: 0,
          priorityDistribution: {},
          typeDistribution: {},
          targetCoverage: {}
        },
        relatedObjects: new Map(),
        cascadingChanges: []
      };
    }

    this.emit('progress', { message: 'Aggregating test requirements from multiple operations...' });

    // Flatten all requirements into a single array
    const allRequirements = requirementsList.flat();
    const totalOriginalCount = allRequirements.length;

    // Track aggregation state
    const aggregationState = {
      targetGroups: new Map(),
      relatedObjects: new Map(),
      cascadingChanges: [],
      duplicatesRemoved: 0
    };

    // Group requirements by target object
    this._groupRequirementsByTarget(allRequirements, aggregationState);

    // Merge duplicate requirements within each target group
    this._mergeDuplicateRequirements(aggregationState);

    // Identify and handle cascading changes
    this._identifyCascadingChanges(aggregationState);

    // Resolve priority conflicts and merge related objects
    this._resolveConflictsAndMergeRelated(aggregationState);

    // Extract final aggregated requirements
    const aggregatedRequirements = this._extractAggregatedRequirements(aggregationState);

    // Generate summary statistics
    const summary = this._generateAggregationSummary(
      aggregatedRequirements,
      requirementsList.length,
      totalOriginalCount,
      aggregationState.duplicatesRemoved
    );

    this.emit('progress', {
      message: `Aggregation complete: ${totalOriginalCount} → ${aggregatedRequirements.length} requirements`
    });

    return {
      requirements: aggregatedRequirements,
      summary,
      relatedObjects: aggregationState.relatedObjects,
      cascadingChanges: aggregationState.cascadingChanges
    };
  }

  /**
   * Group requirements by target object for deduplication
   * @private
   */
  _groupRequirementsByTarget(allRequirements, aggregationState) {
    for (const requirement of allRequirements) {
      const target = requirement.target || 'unknown';
      const targetKey = `${target}:${requirement.type}`;

      if (!aggregationState.targetGroups.has(targetKey)) {
        aggregationState.targetGroups.set(targetKey, []);
      }

      aggregationState.targetGroups.get(targetKey).push(requirement);

      // Track related objects (tables + indexes + policies)
      this._trackRelatedObjects(requirement, aggregationState);
    }
  }

  /**
   * Track relationships between database objects
   * @private
   */
  _trackRelatedObjects(requirement, aggregationState) {
    const target = requirement.target;
    if (!target) return;

    // Initialize related objects tracking
    if (!aggregationState.relatedObjects.has(target)) {
      aggregationState.relatedObjects.set(target, {
        type: requirement.type,
        dependencies: new Set(),
        dependents: new Set(),
        operations: new Set()
      });
    }

    const objectInfo = aggregationState.relatedObjects.get(target);

    // Track operations affecting this object
    if (requirement.metadata?.operationType) {
      objectInfo.operations.add(requirement.metadata.operationType);
    }

    // Identify relationships based on requirement metadata
    if (requirement.metadata) {
      // Index -> Table relationship
      if (requirement.type === TEST_TYPES.INDEX && requirement.metadata.tableName) {
        objectInfo.dependencies.add(requirement.metadata.tableName);
        this._ensureRelatedObject(requirement.metadata.tableName, 'TABLE', aggregationState);
        aggregationState.relatedObjects.get(requirement.metadata.tableName).dependents.add(target);
      }

      // Foreign Key -> Referenced Table relationship
      if (requirement.metadata.referencedTable) {
        objectInfo.dependencies.add(requirement.metadata.referencedTable);
        this._ensureRelatedObject(requirement.metadata.referencedTable, 'TABLE', aggregationState);
        aggregationState.relatedObjects
          .get(requirement.metadata.referencedTable)
          .dependents.add(target);
      }

      // Policy -> Table relationship
      if (requirement.type === TEST_TYPES.RLS && requirement.metadata.tableName) {
        objectInfo.dependencies.add(requirement.metadata.tableName);
        this._ensureRelatedObject(requirement.metadata.tableName, 'TABLE', aggregationState);
        aggregationState.relatedObjects.get(requirement.metadata.tableName).dependents.add(target);
      }
    }
  }

  /**
   * Ensure related object exists in tracking
   * @private
   */
  _ensureRelatedObject(objectName, objectType, aggregationState) {
    if (!aggregationState.relatedObjects.has(objectName)) {
      aggregationState.relatedObjects.set(objectName, {
        type: objectType,
        dependencies: new Set(),
        dependents: new Set(),
        operations: new Set()
      });
    }
  }

  /**
   * Merge duplicate requirements intelligently
   * @private
   */
  _mergeDuplicateRequirements(aggregationState) {
    for (const [targetKey, requirements] of aggregationState.targetGroups) {
      if (requirements.length <= 1) continue;

      // Group by description similarity for intelligent merging
      const descriptionGroups = this._groupByDescriptionSimilarity(requirements);
      const mergedRequirements = [];

      for (const group of descriptionGroups) {
        if (group.length === 1) {
          mergedRequirements.push(group[0]);
        } else {
          // Merge similar requirements
          const merged = this._mergeRequirementGroup(group);
          mergedRequirements.push(merged);
          aggregationState.duplicatesRemoved += group.length - 1;
        }
      }

      aggregationState.targetGroups.set(targetKey, mergedRequirements);
    }
  }

  /**
   * Group requirements by description similarity
   * @private
   */
  _groupByDescriptionSimilarity(requirements) {
    const groups = [];
    const processed = new Set();

    for (let i = 0; i < requirements.length; i++) {
      if (processed.has(i)) continue;

      const group = [requirements[i]];
      processed.add(i);

      for (let j = i + 1; j < requirements.length; j++) {
        if (processed.has(j)) continue;

        if (this._areRequirementsSimilar(requirements[i], requirements[j])) {
          group.push(requirements[j]);
          processed.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Check if two requirements are similar enough to merge
   * @private
   */
  _areRequirementsSimilar(req1, req2) {
    // Same type and target
    if (req1.type !== req2.type || req1.target !== req2.target) {
      return false;
    }

    // Similar descriptions (basic keyword matching)
    const desc1Keywords = this._extractDescriptionKeywords(req1.description);
    const desc2Keywords = this._extractDescriptionKeywords(req2.description);
    const commonKeywords = desc1Keywords.filter((k) => desc2Keywords.includes(k));

    // At least 50% keyword overlap
    return commonKeywords.length >= Math.max(desc1Keywords.length, desc2Keywords.length) * 0.5;
  }

  /**
   * Extract keywords from requirement description
   * @private
   */
  _extractDescriptionKeywords(description) {
    return description
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 3 &&
          !['verify', 'test', 'check', 'with', 'that', 'this', 'table'].includes(word)
      );
  }

  /**
   * Merge a group of similar requirements
   * @private
   */
  _mergeRequirementGroup(group) {
    const base = group[0];

    // Take highest priority
    const priority = this._getHighestPriority(group.map((r) => r.priority));

    // Merge test cases (deduplicate)
    const allTestCases = new Set();
    group.forEach((req) => {
      if (req.testCases) {
        req.testCases.forEach((testCase) => allTestCases.add(testCase));
      }
    });

    // Merge metadata
    const mergedMetadata = this._mergeMetadata(group.map((r) => r.metadata).filter(Boolean));

    // Combine operations
    const operations = group.map((r) => r.operation).filter(Boolean);

    return {
      type: base.type,
      priority,
      target: base.target,
      description: this._generateMergedDescription(group),
      testCases: Array.from(allTestCases).sort(),
      metadata: {
        ...mergedMetadata,
        mergedFrom: group.length,
        originalDescriptions: group.map((r) => r.description)
      },
      operations,
      reason: this._generateMergedReason(group)
    };
  }

  /**
   * Get the highest priority from a list
   * @private
   */
  _getHighestPriority(priorities) {
    const priorityOrder = [
      TEST_PRIORITIES.LOW,
      TEST_PRIORITIES.MEDIUM,
      TEST_PRIORITIES.HIGH,
      TEST_PRIORITIES.CRITICAL
    ];

    return priorities.reduce((highest, current) => {
      const currentIndex = priorityOrder.indexOf(current);
      const highestIndex = priorityOrder.indexOf(highest);
      return currentIndex > highestIndex ? current : highest;
    }, TEST_PRIORITIES.LOW);
  }

  /**
   * Merge metadata objects from multiple requirements
   * @private
   */
  _mergeMetadata(metadataArray) {
    if (metadataArray.length === 0) return {};

    const merged = {};

    for (const metadata of metadataArray) {
      for (const [key, value] of Object.entries(metadata)) {
        if (merged[key] === undefined) {
          merged[key] = value;
        } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
          // Merge arrays and deduplicate
          merged[key] = [...new Set([...merged[key], ...value])];
        } else if (merged[key] !== value) {
          // Handle conflicts by creating arrays
          merged[key] = Array.isArray(merged[key])
            ? [...new Set([...merged[key], value])]
            : [...new Set([merged[key], value])];
        }
      }
    }

    return merged;
  }

  /**
   * Generate description for merged requirement
   * @private
   */
  _generateMergedDescription(group) {
    if (group.length === 1) return group[0].description;

    const target = group[0].target;
    const type = group[0].type.toLowerCase();

    return `Comprehensive ${type} validation for ${target} (merged from ${group.length} requirements)`;
  }

  /**
   * Generate reason for merged requirement
   * @private
   */
  _generateMergedReason(group) {
    const reasons = group.map((r) => r.reason).filter(Boolean);
    if (reasons.length === 0) return undefined;

    const uniqueReasons = [...new Set(reasons)];
    return uniqueReasons.length === 1
      ? uniqueReasons[0]
      : `Multiple requirements: ${uniqueReasons.join('; ')}`;
  }

  /**
   * Identify cascading changes between related objects
   * @private
   */
  _identifyCascadingChanges(aggregationState) {
    for (const [objectName, objectInfo] of aggregationState.relatedObjects) {
      // Look for operations that might cascade
      const cascadingOps = ['DROP', 'RENAME', 'ALTER'];

      for (const operation of objectInfo.operations) {
        if (cascadingOps.some((op) => operation.toUpperCase().includes(op))) {
          // Check if this affects dependent objects
          for (const dependent of objectInfo.dependents) {
            aggregationState.cascadingChanges.push({
              source: objectName,
              target: dependent,
              operation,
              impact: this._assessCascadingImpact(operation, objectInfo.type)
            });
          }
        }
      }
    }
  }

  /**
   * Assess the impact of cascading changes
   * @private
   */
  _assessCascadingImpact(operation, objectType) {
    const upperOp = operation.toUpperCase();

    if (upperOp.includes('DROP')) {
      return objectType === 'TABLE' ? 'HIGH' : 'MEDIUM';
    } else if (upperOp.includes('RENAME')) {
      return 'MEDIUM';
    } else if (upperOp.includes('ALTER')) {
      return 'LOW';
    }

    return 'LOW';
  }

  /**
   * Resolve priority conflicts and merge related objects
   * @private
   */
  _resolveConflictsAndMergeRelated(aggregationState) {
    // Elevate priorities for objects with cascading changes
    for (const cascade of aggregationState.cascadingChanges) {
      if (cascade.impact === 'HIGH') {
        this._elevatePriorityForTarget(cascade.target, TEST_PRIORITIES.HIGH, aggregationState);
      } else if (cascade.impact === 'MEDIUM') {
        this._elevatePriorityForTarget(cascade.target, TEST_PRIORITIES.MEDIUM, aggregationState);
      }
    }
  }

  /**
   * Elevate priority for requirements targeting a specific object
   * @private
   */
  _elevatePriorityForTarget(target, minPriority, aggregationState) {
    for (const [targetKey, requirements] of aggregationState.targetGroups) {
      if (targetKey.startsWith(`${target}:`)) {
        for (const req of requirements) {
          const currentPriorityIndex = [
            TEST_PRIORITIES.LOW,
            TEST_PRIORITIES.MEDIUM,
            TEST_PRIORITIES.HIGH,
            TEST_PRIORITIES.CRITICAL
          ].indexOf(req.priority);
          const minPriorityIndex = [
            TEST_PRIORITIES.LOW,
            TEST_PRIORITIES.MEDIUM,
            TEST_PRIORITIES.HIGH,
            TEST_PRIORITIES.CRITICAL
          ].indexOf(minPriority);

          if (currentPriorityIndex < minPriorityIndex) {
            req.priority = minPriority;
            req.metadata = req.metadata || {};
            req.metadata.priorityElevated = true;
            req.metadata.elevationReason = 'Cascading change impact';
          }
        }
      }
    }
  }

  /**
   * Extract final aggregated requirements from state
   * @private
   */
  _extractAggregatedRequirements(aggregationState) {
    const requirements = [];

    for (const [_targetKey, targetRequirements] of aggregationState.targetGroups) {
      requirements.push(...targetRequirements);
    }

    // Sort by priority (highest first), then by target
    return requirements.sort((a, b) => {
      const priorityComparison = this._comparePriority(a.priority, b.priority);
      if (priorityComparison !== 0) return priorityComparison;

      return (a.target || '').localeCompare(b.target || '');
    });
  }

  /**
   * Generate summary statistics for aggregation
   * @private
   */
  _generateAggregationSummary(
    aggregatedRequirements,
    operationCount,
    originalCount,
    duplicatesRemoved
  ) {
    const priorityDistribution = {};
    const typeDistribution = {};
    const targetCoverage = {};

    for (const req of aggregatedRequirements) {
      // Priority distribution
      priorityDistribution[req.priority] = (priorityDistribution[req.priority] || 0) + 1;

      // Type distribution
      typeDistribution[req.type] = (typeDistribution[req.type] || 0) + 1;

      // Target coverage
      if (req.target) {
        targetCoverage[req.target] = (targetCoverage[req.target] || 0) + 1;
      }
    }

    return {
      totalRequirements: aggregatedRequirements.length,
      totalOperations: operationCount,
      originalRequirements: originalCount,
      duplicatesRemoved,
      deduplicationRate:
        originalCount > 0 ? ((duplicatesRemoved / originalCount) * 100).toFixed(1) : 0,
      priorityDistribution,
      typeDistribution,
      targetCoverage,
      estimatedEffort: aggregatedRequirements.reduce(
        (sum, req) => sum + this._estimateTestEffort(req),
        0
      ),
      criticalRequirements: aggregatedRequirements.filter(
        (r) => r.priority === TEST_PRIORITIES.CRITICAL
      ).length,
      highPriorityRequirements: aggregatedRequirements.filter(
        (r) => r.priority === TEST_PRIORITIES.HIGH
      ).length,
      coverageAreas: Object.keys(typeDistribution).length,
      uniqueTargets: Object.keys(targetCoverage).length
    };
  }
}

export { TestRequirementAnalyzer, TEST_TYPES, TEST_PRIORITIES };
