/**
 * Test Pattern Library
 *
 * Comprehensive library of reusable test patterns for pgTAP test generation.
 * Provides common patterns for each test type with best practices and examples.
 * Used by TestTemplateGenerator to ensure consistency across all generated tests.
 *
 * @fileoverview Test Pattern Library for pgTAP test generation
 * @author D.A.T.A. Engineering Team
 * @version 1.0.0
 */
const { ValidationError } = require("./errors"); // using your barrel export
/**
 * @typedef {Object} TestPattern
 * @property {string} name - Pattern name identifier
 * @property {string} category - Pattern category (validation, security, performance, error_handling, multi_user)
 * @property {string} description - Human-readable description
 * @property {string} sqlTemplate - SQL template with placeholders
 * @property {Array<string>} placeholders - List of placeholder variables
 * @property {Object} metadata - Additional metadata about the pattern
 * @property {Array<string>} bestPractices - Best practice recommendations
 * @property {Array<string>} examples - Usage examples
 * @property {string} difficulty - Pattern difficulty level (basic, intermediate, advanced)
 * @property {Array<string>} dependencies - Required test utilities or setup
 */

/**
 * @typedef {Object} PatternCategory
 * @property {string} name - Category name
 * @property {string} description - Category description
 * @property {Array<TestPattern>} patterns - Patterns in this category
 * @property {Array<string>} commonUseCases - Common use cases for this category
 * @property {Array<string>} bestPractices - Category-level best practices
 */

class TestPatternLibrary {
  constructor() {
    /**
     * @type {Map<string, PatternCategory>}
     * @private
     */
    this.categories = this.initializePatternCategories();

    /**
     * @type {Map<string, TestPattern>}
     * @private
     */
    this.patterns = this.initializePatterns();

    /**
     * @type {Object<string, Array<string>>}
     * @private
     */
    this.testTypePatterns = this.initializeTestTypeMapping();
  }

  /**
   * Get pattern by name
   * @param {string} patternName - Pattern name
   * @returns {TestPattern|null} Pattern or null if not found
   */
  getPattern(patternName) {
    return this.patterns.get(patternName) || null;
  }

  /**
   * Get patterns by category
   * @param {string} categoryName - Category name
   * @returns {Array<TestPattern>} Patterns in the category
   */
  getPatternsByCategory(categoryName) {
    const category = this.categories.get(categoryName);
    return category ? category.patterns : [];
  }

  /**
   * Get recommended patterns for a test type
   * @param {string} testType - Test type (rpc, rls, trigger, etc.)
   * @returns {Array<TestPattern>} Recommended patterns
   */
  getRecommendedPatterns(testType) {
    const patternNames = this.testTypePatterns[testType] || [];
    return patternNames.map((name) => this.patterns.get(name)).filter(Boolean);
  }

  /**
   * Render pattern with provided variables
   * @param {string} patternName - Pattern name
   * @param {Object} variables - Variable substitutions
   * @returns {string} Rendered SQL template
   */
  renderPattern(patternName, variables = {}) {
    const pattern = this.getPattern(patternName);
    if (!pattern) {
      throw new ValidationError(`Pattern not found: ${patternName}`);
    }

    let rendered = pattern.sqlTemplate;

    // Replace placeholders with variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\$\\{${key}\\}`, "g");
      rendered = rendered.replace(placeholder, value);
    }

    return rendered;
  }

  /**
   * Get all available pattern names
   * @returns {Array<string>} Pattern names
   */
  getAvailablePatterns() {
    return Array.from(this.patterns.keys()).sort();
  }

  /**
   * Get patterns by difficulty level
   * @param {string} difficulty - Difficulty level (basic, intermediate, advanced)
   * @returns {Array<TestPattern>} Patterns at the specified difficulty
   */
  getPatternsByDifficulty(difficulty) {
    return Array.from(this.patterns.values()).filter(
      (pattern) => pattern.difficulty === difficulty,
    );
  }

  /**
   * Initialize pattern categories
   * @returns {Map<string, PatternCategory>} Pattern categories
   * @private
   */
  initializePatternCategories() {
    const categories = new Map();

    categories.set("data_validation", {
      name: "data_validation",
      description:
        "Patterns for validating data integrity, constraints, and business rules",
      patterns: [], // Will be populated by initializePatterns
      commonUseCases: [
        "Validating column constraints (NOT NULL, CHECK, UNIQUE)",
        "Testing foreign key relationships",
        "Verifying data type constraints",
        "Validating business rule enforcement",
      ],
      bestPractices: [
        "Always test both valid and invalid data scenarios",
        "Include boundary value testing",
        "Test constraint cascading behavior",
        "Verify error messages are appropriate",
      ],
    });

    categories.set("security_testing", {
      name: "security_testing",
      description:
        "Patterns for testing security features, RLS policies, and access controls",
      patterns: [],
      commonUseCases: [
        "Testing Row Level Security policies",
        "Verifying role-based access controls",
        "Testing data isolation between users",
        "Validating privilege escalation prevention",
      ],
      bestPractices: [
        "Test with multiple user roles and contexts",
        "Verify policy expressions are not bypassable",
        "Test edge cases and boundary conditions",
        "Include SQL injection resistance testing",
      ],
    });

    categories.set("performance_testing", {
      name: "performance_testing",
      description:
        "Patterns for testing performance characteristics and query efficiency",
      patterns: [],
      commonUseCases: [
        "Testing index usage and effectiveness",
        "Validating query performance under load",
        "Testing function execution time",
        "Verifying materialized view refresh performance",
      ],
      bestPractices: [
        "Use realistic data volumes for testing",
        "Test performance regression scenarios",
        "Monitor resource usage during tests",
        "Include both cold and warm cache scenarios",
      ],
    });

    categories.set("error_handling", {
      name: "error_handling",
      description:
        "Patterns for testing error conditions and exception handling",
      patterns: [],
      commonUseCases: [
        "Testing constraint violation handling",
        "Validating custom exception throwing",
        "Testing transaction rollback scenarios",
        "Verifying graceful degradation",
      ],
      bestPractices: [
        "Test all expected error conditions",
        "Verify error codes and messages",
        "Test error handling under concurrent access",
        "Ensure proper cleanup after errors",
      ],
    });

    categories.set("multi_user_scenarios", {
      name: "multi_user_scenarios",
      description:
        "Patterns for testing concurrent access and multi-user interactions",
      patterns: [],
      commonUseCases: [
        "Testing concurrent data modifications",
        "Validating lock contention handling",
        "Testing user isolation in multi-tenant scenarios",
        "Verifying audit trail accuracy with concurrent users",
      ],
      bestPractices: [
        "Use realistic concurrency scenarios",
        "Test both read and write conflicts",
        "Verify data consistency after concurrent operations",
        "Include deadlock detection and resolution testing",
      ],
    });

    return categories;
  }

  /**
   * Initialize all test patterns
   * @returns {Map<string, TestPattern>} All patterns indexed by name
   * @private
   */
  initializePatterns() {
    const patterns = new Map();

    // ===========================================================================
    // DATA VALIDATION PATTERNS
    // ===========================================================================

    patterns.set("table_exists_basic", {
      name: "table_exists_basic",
      category: "data_validation",
      description: "Basic table existence validation",
      sqlTemplate: `-- Test: Table exists
RETURN NEXT tap.has_table(
  '\${schema}',
  '\${tableName}',
  'Table \${tableName} exists in \${schema} schema'
);`,
      placeholders: ["schema", "tableName"],
      metadata: {
        testType: "existence",
        complexity: "low",
        executionTime: "fast",
      },
      bestPractices: [
        "Always test table existence before testing structure",
        "Include schema name for clarity",
        "Use descriptive test messages",
      ],
      examples: [
        "renderPattern('table_exists_basic', { schema: 'public', tableName: 'users' })",
      ],
      difficulty: "basic",
      dependencies: [],
    });

    patterns.set("column_structure_validation", {
      name: "column_structure_validation",
      category: "data_validation",
      description:
        "Comprehensive column structure validation including type, constraints, and defaults",
      sqlTemplate: `-- Column: \${columnName}
RETURN NEXT tap.has_column(
  '\${schema}',
  '\${tableName}',
  '\${columnName}',
  'Column \${columnName} exists in \${tableName}'
);

\${dataTypeTest}

\${notNullTest}

\${defaultValueTest}

\${primaryKeyTest}

\${foreignKeyTest}`,
      placeholders: [
        "schema",
        "tableName",
        "columnName",
        "dataTypeTest",
        "notNullTest",
        "defaultValueTest",
        "primaryKeyTest",
        "foreignKeyTest",
      ],
      metadata: {
        testType: "structure",
        complexity: "medium",
        executionTime: "medium",
        conditionalSections: [
          "dataTypeTest",
          "notNullTest",
          "defaultValueTest",
          "primaryKeyTest",
          "foreignKeyTest",
        ],
      },
      bestPractices: [
        "Test column existence before testing properties",
        "Include both positive and negative test cases",
        "Test all relevant column properties",
        "Use consistent naming patterns",
      ],
      examples: [
        "Test user_id column with all properties",
        "Test email column with unique constraint",
        "Test timestamp columns with defaults",
      ],
      difficulty: "intermediate",
      dependencies: ["column_exists_basic"],
    });

    patterns.set("foreign_key_relationship", {
      name: "foreign_key_relationship",
      category: "data_validation",
      description:
        "Foreign key relationship validation with referential integrity testing",
      sqlTemplate: `-- Test: Foreign key relationship
RETURN NEXT tap.fk_ok(
  '\${sourceSchema}',
  '\${sourceTable}',
  '\${sourceColumn}',
  '\${targetSchema}',
  '\${targetTable}',
  '\${targetColumn}',
  'Foreign key relationship from \${sourceTable}.\${sourceColumn} to \${targetTable}.\${targetColumn} exists'
);

-- Test: Referential integrity enforcement
RETURN NEXT tap.throws_ok(
  'INSERT INTO \${sourceSchema}.\${sourceTable} (\${sourceColumn}) VALUES (''\${invalidValue}'')',
  '23503',
  'Foreign key constraint prevents invalid references'
);

-- Test: Cascade behavior (if applicable)
\${cascadeTest}`,
      placeholders: [
        "sourceSchema",
        "sourceTable",
        "sourceColumn",
        "targetSchema",
        "targetTable",
        "targetColumn",
        "invalidValue",
        "cascadeTest",
      ],
      metadata: {
        testType: "integrity",
        complexity: "medium",
        executionTime: "medium",
        requiresTestData: true,
      },
      bestPractices: [
        "Test both valid and invalid foreign key values",
        "Include cascade behavior testing",
        "Test referential integrity under concurrent access",
        "Verify constraint error messages",
      ],
      examples: [
        "Test user_id references users.id",
        "Test order references with cascade delete",
        "Test nullable foreign keys",
      ],
      difficulty: "intermediate",
      dependencies: ["test_data_setup"],
    });

    patterns.set("constraint_validation", {
      name: "constraint_validation",
      category: "data_validation",
      description: "CHECK constraint validation with boundary testing",
      sqlTemplate: `-- Test: Constraint exists
RETURN NEXT tap.has_check(
  '\${schema}',
  '\${tableName}',
  '\${constraintName}',
  'Check constraint \${constraintName} exists on \${tableName}'
);

-- Test: Valid data acceptance
BEGIN
  INSERT INTO \${schema}.\${tableName} (\${testColumns}) VALUES (\${validValues});
  RETURN NEXT tap.pass('Constraint \${constraintName} allows valid data: \${validValues}');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEXT tap.fail('Constraint \${constraintName} should allow valid data: ' || SQLERRM);
END;

-- Test: Invalid data rejection
RETURN NEXT tap.throws_ok(
  'INSERT INTO \${schema}.\${tableName} (\${testColumns}) VALUES (\${invalidValues})',
  '23514',
  'Constraint \${constraintName} rejects invalid data: \${invalidValues}'
);

-- Test: Boundary conditions
\${boundaryTests}`,
      placeholders: [
        "schema",
        "tableName",
        "constraintName",
        "testColumns",
        "validValues",
        "invalidValues",
        "boundaryTests",
      ],
      metadata: {
        testType: "validation",
        complexity: "medium",
        executionTime: "medium",
        requiresTestData: true,
      },
      bestPractices: [
        "Test boundary values and edge cases",
        "Include both acceptance and rejection tests",
        "Test multiple invalid scenarios",
        "Verify proper error codes",
      ],
      examples: [
        "Age constraint: age >= 0 AND age <= 150",
        "Email format constraint validation",
        "Status enum constraint testing",
      ],
      difficulty: "intermediate",
      dependencies: ["test_data_setup"],
    });

    // ===========================================================================
    // SECURITY TESTING PATTERNS
    // ===========================================================================

    patterns.set("rls_enablement_check", {
      name: "rls_enablement_check",
      category: "security_testing",
      description: "Row Level Security enablement validation",
      sqlTemplate: `-- Test: RLS is enabled on table
RETURN NEXT tap.ok(
  (SELECT relrowsecurity FROM pg_class 
   WHERE relname = '\${tableName}' 
   AND relnamespace = '\${schema}'::regnamespace),
  'RLS is enabled on \${schema}.\${tableName}'
);

-- Test: RLS is enforced (not just enabled)
RETURN NEXT tap.ok(
  (SELECT relforcerowsecurity FROM pg_class 
   WHERE relname = '\${tableName}' 
   AND relnamespace = '\${schema}'::regnamespace) OR
  (SELECT relrowsecurity FROM pg_class 
   WHERE relname = '\${tableName}' 
   AND relnamespace = '\${schema}'::regnamespace),
  'RLS enforcement is properly configured on \${schema}.\${tableName}'
);`,
      placeholders: ["schema", "tableName"],
      metadata: {
        testType: "security_config",
        complexity: "low",
        executionTime: "fast",
      },
      bestPractices: [
        "Always verify RLS is both enabled and enforced",
        "Test RLS configuration before testing policies",
        "Include both positive and negative checks",
      ],
      examples: [
        "Check RLS on users table",
        "Verify RLS enforcement on sensitive data tables",
      ],
      difficulty: "basic",
      dependencies: [],
    });

    patterns.set("policy_existence_check", {
      name: "policy_existence_check",
      category: "security_testing",
      description: "RLS policy existence and configuration validation",
      sqlTemplate: `-- Test: Policy '\${policyName}' exists
RETURN NEXT tap.ok(
  (SELECT COUNT(*) > 0 FROM pg_policies 
   WHERE schemaname = '\${schema}' 
   AND tablename = '\${tableName}'
   AND policyname = '\${policyName}'),
  'Policy "\${policyName}" exists on \${schema}.\${tableName}'
);

-- Test: Policy applies to correct commands
RETURN NEXT tap.ok(
  (SELECT COUNT(*) > 0 FROM pg_policies 
   WHERE schemaname = '\${schema}' 
   AND tablename = '\${tableName}'
   AND policyname = '\${policyName}'
   AND cmd = '\${commandType}'),
  'Policy "\${policyName}" applies to \${commandType} operations'
);

-- Test: Policy has correct roles (if specified)
\${roleTest}`,
      placeholders: [
        "schema",
        "tableName",
        "policyName",
        "commandType",
        "roleTest",
      ],
      metadata: {
        testType: "security_config",
        complexity: "medium",
        executionTime: "fast",
      },
      bestPractices: [
        "Test policy existence before testing behavior",
        "Verify policy applies to intended SQL commands",
        "Check role assignments if policies are role-specific",
      ],
      examples: [
        "Check user_select_own_data policy exists",
        "Verify admin policies apply to all commands",
      ],
      difficulty: "intermediate",
      dependencies: ["rls_enablement_check"],
    });

    patterns.set("multi_user_access_test", {
      name: "multi_user_access_test",
      category: "security_testing",
      description:
        "Multi-user access pattern testing data isolation and permissions",
      sqlTemplate: `-- Setup: Create test users and data
v_user1_id := test.create_test_user('user1@test.com');
v_user2_id := test.create_test_user('user2@test.com');
v_admin_id := test.create_test_admin('admin@test.com');

-- Test: User1 can access own data
PERFORM test.set_auth_context(v_user1_id, 'authenticated');

-- Create test record for user1
\${createUser1Data}

SELECT COUNT(*) INTO v_accessible_count 
FROM \${schema}.\${tableName} WHERE \${userFilter};

RETURN NEXT tap.ok(
  v_accessible_count > 0,
  'User1 can access their own data in \${tableName}'
);

-- Test: User2 cannot access User1's data
PERFORM test.set_auth_context(v_user2_id, 'authenticated');

SELECT COUNT(*) INTO v_accessible_count 
FROM \${schema}.\${tableName} WHERE \${userFilter};

RETURN NEXT tap.is(
  v_accessible_count,
  0::bigint,
  'User2 cannot access User1 data in \${tableName}'
);

-- Test: Admin can access all data (if applicable)
PERFORM test.set_auth_context(v_admin_id, 'authenticated');

\${adminAccessTest}`,
      placeholders: [
        "schema",
        "tableName",
        "createUser1Data",
        "userFilter",
        "adminAccessTest",
      ],
      metadata: {
        testType: "security_isolation",
        complexity: "high",
        executionTime: "medium",
        requiresTestUsers: true,
        requiresTestData: true,
      },
      bestPractices: [
        "Create fresh test users for each test run",
        "Test both positive and negative access scenarios",
        "Include admin override testing where applicable",
        "Clean up test data after tests complete",
      ],
      examples: [
        "Test user can only see their own posts",
        "Test admin can see all user data",
        "Test service role bypasses RLS",
      ],
      difficulty: "advanced",
      dependencies: [
        "test_user_setup",
        "rls_enablement_check",
        "policy_existence_check",
      ],
    });

    patterns.set("privilege_escalation_test", {
      name: "privilege_escalation_test",
      category: "security_testing",
      description: "Test that privilege escalation is properly prevented",
      sqlTemplate: `-- Test: Regular user cannot escalate privileges
PERFORM test.set_auth_context(v_user_id, 'authenticated');

-- Attempt privilege escalation - should fail
RETURN NEXT tap.throws_ok(
  '\${privilegeEscalationAttempt}',
  '\${expectedErrorCode}',
  'User cannot escalate privileges: \${escalationType}'
);

-- Test: User cannot bypass RLS through functions
\${functionBypassTest}

-- Test: User cannot modify system catalogs
RETURN NEXT tap.throws_ok(
  'UPDATE pg_authid SET rolsuper = true WHERE rolname = current_user',
  '42501',
  'User cannot modify system catalogs'
);

-- Test: User cannot access restricted schemas
\${restrictedSchemaTest}`,
      placeholders: [
        "privilegeEscalationAttempt",
        "expectedErrorCode",
        "escalationType",
        "functionBypassTest",
        "restrictedSchemaTest",
      ],
      metadata: {
        testType: "security_hardening",
        complexity: "high",
        executionTime: "medium",
        requiresTestUsers: true,
      },
      bestPractices: [
        "Test common privilege escalation vectors",
        "Verify proper error codes are returned",
        "Include tests for function-based bypasses",
        "Test access to system catalogs",
      ],
      examples: [
        "Test user cannot SET ROLE to admin",
        "Test user cannot create SECURITY DEFINER functions",
        "Test user cannot access information_schema",
      ],
      difficulty: "advanced",
      dependencies: ["test_user_setup"],
    });

    // ===========================================================================
    // PERFORMANCE TESTING PATTERNS
    // ===========================================================================

    patterns.set("index_usage_verification", {
      name: "index_usage_verification",
      category: "performance_testing",
      description: "Verify that indexes are used by query plans",
      sqlTemplate: `-- Test: Index exists and has correct structure
RETURN NEXT tap.has_index(
  '\${schema}',
  '\${tableName}',
  '\${indexName}',
  'Index \${indexName} exists on \${tableName}'
);

-- Test: Query uses index (basic check)
\${queryPlanTest}

-- Test: Index selectivity is reasonable
\${selectivityTest}

-- Performance baseline test
\${performanceTest}`,
      placeholders: [
        "schema",
        "tableName",
        "indexName",
        "queryPlanTest",
        "selectivityTest",
        "performanceTest",
      ],
      metadata: {
        testType: "performance_validation",
        complexity: "high",
        executionTime: "slow",
        requiresTestData: true,
      },
      bestPractices: [
        "Test with realistic data volumes",
        "Include both selective and non-selective queries",
        "Test index usage under different query patterns",
        "Monitor index maintenance overhead",
      ],
      examples: [
        "Test email index is used for login queries",
        "Test composite index covers complex WHERE clauses",
        "Test partial index effectiveness",
      ],
      difficulty: "advanced",
      dependencies: ["performance_test_data"],
    });

    patterns.set("function_performance_test", {
      name: "function_performance_test",
      category: "performance_testing",
      description: "Function execution time and resource usage validation",
      sqlTemplate: `-- Test: Function executes within time limit
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_execution_duration interval;
BEGIN
  v_start_time := clock_timestamp();
  
  \${functionCall}
  
  v_end_time := clock_timestamp();
  v_execution_duration := v_end_time - v_start_time;
  
  RETURN NEXT tap.ok(
    v_execution_duration < '\${maxExecutionTime}'::interval,
    format('Function \${functionName} executes within %s (actual: %s)', 
           '\${maxExecutionTime}', v_execution_duration)
  );
END;

-- Test: Function handles concurrent execution
\${concurrencyTest}

-- Test: Function resource usage is reasonable
\${resourceUsageTest}`,
      placeholders: [
        "functionCall",
        "maxExecutionTime",
        "functionName",
        "concurrencyTest",
        "resourceUsageTest",
      ],
      metadata: {
        testType: "performance_validation",
        complexity: "high",
        executionTime: "slow",
        requiresTestData: true,
      },
      bestPractices: [
        "Set realistic performance expectations",
        "Test with various input sizes",
        "Include concurrent execution testing",
        "Monitor memory and CPU usage",
      ],
      examples: [
        "Test report generation completes within 30 seconds",
        "Test batch processing handles 10,000 records",
        "Test concurrent user function calls",
      ],
      difficulty: "advanced",
      dependencies: ["performance_test_data"],
    });

    // ===========================================================================
    // ERROR HANDLING PATTERNS
    // ===========================================================================

    patterns.set("constraint_violation_handling", {
      name: "constraint_violation_handling",
      category: "error_handling",
      description: "Test proper constraint violation error handling",
      sqlTemplate: `-- Test: NOT NULL constraint violation
RETURN NEXT tap.throws_ok(
  'INSERT INTO \${schema}.\${tableName} (\${columns}) VALUES (\${nullValues})',
  '23502',
  'NOT NULL constraint violation properly detected: \${constraintName}'
);

-- Test: Unique constraint violation
RETURN NEXT tap.throws_ok(
  '\${duplicateInsert}',
  '23505',
  'Unique constraint violation properly detected: \${constraintName}'
);

-- Test: Check constraint violation
RETURN NEXT tap.throws_ok(
  'INSERT INTO \${schema}.\${tableName} (\${columns}) VALUES (\${invalidValues})',
  '23514',
  'Check constraint violation properly detected: \${constraintName}'
);

-- Test: Foreign key constraint violation
RETURN NEXT tap.throws_ok(
  'INSERT INTO \${schema}.\${tableName} (\${columns}) VALUES (\${orphanValues})',
  '23503',
  'Foreign key constraint violation properly detected: \${constraintName}'
);`,
      placeholders: [
        "schema",
        "tableName",
        "columns",
        "nullValues",
        "constraintName",
        "duplicateInsert",
        "invalidValues",
        "orphanValues",
      ],
      metadata: {
        testType: "error_validation",
        complexity: "medium",
        executionTime: "medium",
        requiresTestData: true,
      },
      bestPractices: [
        "Test all constraint types individually",
        "Verify correct error codes are returned",
        "Test constraint violation messages",
        "Include cascade constraint testing",
      ],
      examples: [
        "Test email uniqueness constraint",
        "Test age check constraint violation",
        "Test foreign key reference violations",
      ],
      difficulty: "intermediate",
      dependencies: ["test_data_setup"],
    });

    patterns.set("function_exception_handling", {
      name: "function_exception_handling",
      category: "error_handling",
      description: "Test function exception handling and error recovery",
      sqlTemplate: `-- Test: Function handles invalid input gracefully
RETURN NEXT tap.lives_ok(
  'SELECT \${schema}.\${functionName}(\${invalidInput})',
  'Function \${functionName} handles invalid input without crashing'
);

-- Test: Function throws appropriate exceptions
RETURN NEXT tap.throws_ok(
  'SELECT \${schema}.\${functionName}(\${errorInput})',
  '\${expectedErrorCode}',
  'Function \${functionName} throws expected exception: \${errorMessage}'
);

-- Test: Function maintains transaction integrity on error
BEGIN
  -- Setup transaction state
  \${transactionSetup}
  
  -- Attempt operation that should fail
  BEGIN
    PERFORM \${schema}.\${functionName}(\${errorInput});
  EXCEPTION
    WHEN OTHERS THEN
      -- Exception expected
      NULL;
  END;
  
  -- Verify transaction state is consistent
  \${transactionStateCheck}
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEXT tap.fail('Function \${functionName} should maintain transaction integrity on error');
END;`,
      placeholders: [
        "schema",
        "functionName",
        "invalidInput",
        "errorInput",
        "expectedErrorCode",
        "errorMessage",
        "transactionSetup",
        "transactionStateCheck",
      ],
      metadata: {
        testType: "error_validation",
        complexity: "high",
        executionTime: "medium",
        requiresTestData: true,
      },
      bestPractices: [
        "Test both recoverable and non-recoverable errors",
        "Verify transaction integrity is maintained",
        "Test error propagation in nested calls",
        "Include proper cleanup after errors",
      ],
      examples: [
        "Test division by zero handling",
        "Test invalid JSON parsing errors",
        "Test authorization failures in functions",
      ],
      difficulty: "advanced",
      dependencies: ["test_data_setup", "transaction_test_helpers"],
    });

    // ===========================================================================
    // MULTI-USER SCENARIO PATTERNS
    // ===========================================================================

    patterns.set("concurrent_modification_test", {
      name: "concurrent_modification_test",
      category: "multi_user_scenarios",
      description:
        "Test concurrent data modification scenarios and conflict resolution",
      sqlTemplate: `-- Test: Concurrent updates with optimistic locking
DECLARE
  v_initial_version integer;
  v_user1_success boolean := false;
  v_user2_success boolean := false;
BEGIN
  -- Setup: Create test record with version
  INSERT INTO \${schema}.\${tableName} (id, data, version) 
  VALUES ('\${testId}', 'initial', 1)
  RETURNING version INTO v_initial_version;
  
  -- Simulate concurrent updates
  BEGIN
    -- User 1 update
    UPDATE \${schema}.\${tableName} 
    SET data = 'user1_update', version = version + 1
    WHERE id = '\${testId}' AND version = v_initial_version;
    
    IF FOUND THEN
      v_user1_success := true;
    END IF;
  END;
  
  BEGIN
    -- User 2 update (should fail if optimistic locking works)
    UPDATE \${schema}.\${tableName} 
    SET data = 'user2_update', version = version + 1
    WHERE id = '\${testId}' AND version = v_initial_version;
    
    IF FOUND THEN
      v_user2_success := true;
    END IF;
  END;
  
  -- Verify conflict resolution
  RETURN NEXT tap.ok(
    v_user1_success AND NOT v_user2_success,
    'Optimistic locking prevents concurrent modification conflicts'
  );
END;

-- Test: Concurrent insert conflict resolution
\${concurrentInsertTest}`,
      placeholders: ["schema", "tableName", "testId", "concurrentInsertTest"],
      metadata: {
        testType: "concurrency_validation",
        complexity: "high",
        executionTime: "slow",
        requiresTestData: true,
      },
      bestPractices: [
        "Use realistic concurrency scenarios",
        "Test both optimistic and pessimistic locking",
        "Verify data consistency after conflicts",
        "Include deadlock detection testing",
      ],
      examples: [
        "Test shopping cart concurrent updates",
        "Test inventory concurrent modifications",
        "Test user profile concurrent edits",
      ],
      difficulty: "advanced",
      dependencies: ["test_data_setup", "concurrency_test_helpers"],
    });

    patterns.set("data_isolation_verification", {
      name: "data_isolation_verification",
      category: "multi_user_scenarios",
      description: "Verify data isolation between different user contexts",
      sqlTemplate: `-- Setup: Create isolated test data for multiple users
DECLARE
  v_user1_data_count integer;
  v_user2_data_count integer;
  v_cross_access_count integer;
BEGIN
  -- Create data for user1
  PERFORM test.set_auth_context(v_user1_id, 'authenticated');
  \${createUser1Data}
  
  -- Create data for user2  
  PERFORM test.set_auth_context(v_user2_id, 'authenticated');
  \${createUser2Data}
  
  -- Test: User1 sees only their data
  PERFORM test.set_auth_context(v_user1_id, 'authenticated');
  SELECT COUNT(*) INTO v_user1_data_count FROM \${schema}.\${tableName};
  
  RETURN NEXT tap.is(
    v_user1_data_count,
    \${expectedUser1Count}::integer,
    'User1 sees only their own data (\${expectedUser1Count} records)'
  );
  
  -- Test: User2 sees only their data
  PERFORM test.set_auth_context(v_user2_id, 'authenticated');
  SELECT COUNT(*) INTO v_user2_data_count FROM \${schema}.\${tableName};
  
  RETURN NEXT tap.is(
    v_user2_data_count,
    \${expectedUser2Count}::integer,
    'User2 sees only their own data (\${expectedUser2Count} records)'
  );
  
  -- Test: No cross-user data leakage
  PERFORM test.set_auth_context(v_user1_id, 'authenticated');
  SELECT COUNT(*) INTO v_cross_access_count 
  FROM \${schema}.\${tableName} 
  WHERE \${user2Filter};
  
  RETURN NEXT tap.is(
    v_cross_access_count,
    0::integer,
    'No cross-user data leakage detected'
  );
END;`,
      placeholders: [
        "createUser1Data",
        "createUser2Data",
        "schema",
        "tableName",
        "expectedUser1Count",
        "expectedUser2Count",
        "user2Filter",
      ],
      metadata: {
        testType: "isolation_validation",
        complexity: "high",
        executionTime: "medium",
        requiresTestUsers: true,
        requiresTestData: true,
      },
      bestPractices: [
        "Test isolation with realistic data volumes",
        "Verify both read and write isolation",
        "Include edge cases for data boundaries",
        "Test isolation under concurrent access",
      ],
      examples: [
        "Test user posts are isolated from each other",
        "Test tenant data isolation in SaaS applications",
        "Test role-based data filtering",
      ],
      difficulty: "advanced",
      dependencies: ["test_user_setup", "multi_user_data_setup"],
    });

    // Add patterns to their respective categories
    const dataValidationPatterns = [
      patterns.get("table_exists_basic"),
      patterns.get("column_structure_validation"),
      patterns.get("foreign_key_relationship"),
      patterns.get("constraint_validation"),
    ];

    const securityPatterns = [
      patterns.get("rls_enablement_check"),
      patterns.get("policy_existence_check"),
      patterns.get("multi_user_access_test"),
      patterns.get("privilege_escalation_test"),
    ];

    const performancePatterns = [
      patterns.get("index_usage_verification"),
      patterns.get("function_performance_test"),
    ];

    const errorHandlingPatterns = [
      patterns.get("constraint_violation_handling"),
      patterns.get("function_exception_handling"),
    ];

    const multiUserPatterns = [
      patterns.get("concurrent_modification_test"),
      patterns.get("data_isolation_verification"),
    ];

    // Update category references
    this.categories.get("data_validation").patterns = dataValidationPatterns;
    this.categories.get("security_testing").patterns = securityPatterns;
    this.categories.get("performance_testing").patterns = performancePatterns;
    this.categories.get("error_handling").patterns = errorHandlingPatterns;
    this.categories.get("multi_user_scenarios").patterns = multiUserPatterns;

    return patterns;
  }

  /**
   * Initialize test type to pattern mapping
   * @returns {Object<string, Array<string>>} Test type mappings
   * @private
   */
  initializeTestTypeMapping() {
    return {
      // RPC function tests
      rpc: [
        "table_exists_basic",
        "function_exception_handling",
        "function_performance_test",
        "multi_user_access_test",
        "privilege_escalation_test",
      ],

      // Row Level Security tests
      rls: [
        "rls_enablement_check",
        "policy_existence_check",
        "multi_user_access_test",
        "data_isolation_verification",
        "privilege_escalation_test",
      ],

      // Trigger tests
      trigger: [
        "table_exists_basic",
        "constraint_violation_handling",
        "concurrent_modification_test",
        "function_exception_handling",
      ],

      // Constraint tests
      constraint: [
        "constraint_validation",
        "constraint_violation_handling",
        "foreign_key_relationship",
      ],

      // Function tests (database functions)
      function: [
        "function_exception_handling",
        "function_performance_test",
        "constraint_violation_handling",
      ],

      // Table tests
      table: [
        "table_exists_basic",
        "column_structure_validation",
        "constraint_validation",
        "foreign_key_relationship",
        "index_usage_verification",
      ],

      // Column tests
      column: [
        "column_structure_validation",
        "constraint_validation",
        "constraint_violation_handling",
      ],

      // Index tests
      index: ["index_usage_verification", "function_performance_test"],
    };
  }

  /**
   * Get best practices for a specific test type
   * @param {string} testType - Test type
   * @returns {Array<string>} Best practices
   */
  getBestPractices(testType) {
    const patterns = this.getRecommendedPatterns(testType);
    const practices = new Set();

    patterns.forEach((pattern) => {
      pattern.bestPractices.forEach((practice) => practices.add(practice));
    });

    return Array.from(practices);
  }

  /**
   * Get usage examples for a test type
   * @param {string} testType - Test type
   * @returns {Array<string>} Usage examples
   */
  getUsageExamples(testType) {
    const patterns = this.getRecommendedPatterns(testType);
    const examples = [];

    patterns.forEach((pattern) => {
      if (pattern.examples && pattern.examples.length > 0) {
        examples.push(...pattern.examples);
      }
    });

    return examples;
  }

  /**
   * Generate pattern documentation
   * @returns {string} Formatted documentation
   */
  generateDocumentation() {
    let doc = `# Test Pattern Library Documentation\n\n`;
    doc += `Generated on: ${new Date().toISOString()}\n\n`;
    doc += `Total Patterns: ${this.patterns.size}\n`;
    doc += `Categories: ${this.categories.size}\n\n`;

    // Document each category
    for (const [categoryName, category] of this.categories) {
      doc += `## ${category.name.toUpperCase().replace("_", " ")}\n\n`;
      doc += `${category.description}\n\n`;

      doc += `### Common Use Cases\n`;
      category.commonUseCases.forEach((useCase) => {
        doc += `- ${useCase}\n`;
      });
      doc += `\n`;

      doc += `### Best Practices\n`;
      category.bestPractices.forEach((practice) => {
        doc += `- ${practice}\n`;
      });
      doc += `\n`;

      doc += `### Available Patterns\n`;
      category.patterns.forEach((pattern) => {
        doc += `#### ${pattern.name}\n`;
        doc += `**Difficulty:** ${pattern.difficulty}\n`;
        doc += `**Description:** ${pattern.description}\n\n`;

        if (pattern.examples && pattern.examples.length > 0) {
          doc += `**Examples:**\n`;
          pattern.examples.forEach((example) => {
            doc += `- ${example}\n`;
          });
          doc += `\n`;
        }
      });
      doc += `\n`;
    }

    return doc;
  }
}

module.exports = TestPatternLibrary;
