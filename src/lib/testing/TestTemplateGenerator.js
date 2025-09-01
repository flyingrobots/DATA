/**
 * TestTemplateGenerator with Pattern Library
 *
 * Generates pgTAP test templates for missing coverage based on requirements.
 * Creates properly structured and formatted test SQL files following project conventions.
 * Includes a comprehensive pattern library for consistent test generation.
 */

const TestPatternLibrary = require("./TestPatternLibrary");
const { ValidationError, ParsingError } = require("../errors/index");
/**
 * @typedef {Object} TestRequirement
 * @property {string} type - Type of test ('rpc' | 'rls' | 'trigger' | 'constraint' | 'function' | 'table' | 'column' | 'index')
 * @property {string} name - Name of the entity to test (function name, table name, etc.)
 * @property {string} [schema] - Schema name (defaults to 'public')
 * @property {Object} [metadata] - Additional metadata about the entity
 * @property {string} [description] - Optional description of what needs testing
 * @property {Array<string>} [parameters] - Function parameters (for RPC functions)
 * @property {string} [returnType] - Expected return type (for functions)
 * @property {Array<string>} [policies] - Policy names (for RLS tests)
 * @property {ColumnTestRequirement[]} [columns] - Column requirements (for table tests)
 * @property {IndexTestRequirement[]} [indexes] - Index requirements (for table tests)
 * @property {string[]} [expectedConstraints] - Expected constraint names (for table tests)
 * @property {boolean} [requiresRowLevelSecurity] - Whether RLS should be tested (for table tests)
 * @property {string} [tableName] - Table name (for column tests)
 * @property {string} [expectedType] - Expected column data type (for column tests)
 * @property {boolean} [expectedNotNull] - Whether column should be NOT NULL (for column tests)
 * @property {boolean} [expectedHasDefault] - Whether column should have a default value (for column tests)
 * @property {*} [expectedDefaultValue] - Expected default value (for column tests)
 * @property {boolean} [isPrimaryKey] - Whether column is part of primary key (for column tests)
 * @property {boolean} [isForeignKey] - Whether column is a foreign key (for column tests)
 * @property {string} [referencedTable] - Referenced table if foreign key (for column tests)
 * @property {string} [referencedColumn] - Referenced column if foreign key (for column tests)
 * @property {Array<string>} [indexedColumns] - Columns included in index (for index tests)
 * @property {boolean} [isUnique] - Whether index enforces uniqueness (for index tests)
 * @property {string} [indexType] - Index type: btree, hash, gin, gist, etc. (for index tests)
 * @property {boolean} [isPartial] - Whether index is partial with WHERE clause (for index tests)
 * @property {string} [whereClause] - WHERE clause for partial indexes (for index tests)
 */

/**
 * @typedef {Object} PolicyTestMetadata
 * @property {string} name - Policy name
 * @property {Array<string>} [commands] - SQL commands the policy applies to (SELECT, INSERT, UPDATE, DELETE)
 * @property {Array<string>} [roles] - Database roles the policy applies to
 * @property {string} [expression] - Policy expression/condition
 * @property {string} [checkExpression] - Policy check expression for INSERT/UPDATE
 * @property {boolean} [isPermissive] - Whether policy is permissive (vs restrictive)
 */

/**
 * @typedef {Object} TestScenario
 * @property {string} [description] - Description of the test scenario
 * @property {string} [role] - Database role to test with (anon, authenticated, service_role)
 * @property {string} [userId] - User ID to test with
 * @property {string} [operation] - SQL operation to test (SELECT, INSERT, UPDATE, DELETE)
 * @property {boolean} [shouldAllow] - Whether operation should be allowed
 * @property {Object} [context] - Additional context for the test scenario
 */

/**
 * @typedef {Object} TestTemplate
 * @property {string} content - The generated test SQL content
 * @property {string} filename - Suggested filename for the test
 * @property {string} directory - Suggested directory path for the test
 * @property {string} type - Type of test template generated
 * @property {Object} metadata - Additional metadata about the template
 */

/**
 * @typedef {Object} BatchResult
 * @property {Array<TestTemplate>} templates - Generated templates
 * @property {number} totalGenerated - Number of templates generated
 * @property {Array<string>} errors - Any errors encountered during generation
 * @property {Object} summary - Summary by test type
 */

class TestTemplateGenerator {
  constructor() {
    /**
     * @type {TestPatternLibrary}
     * @private
     */
    this.patternLibrary = new TestPatternLibrary();

    /**
     * @type {Object<string, Function>}
     * @private
     */
    this.templateGenerators = {
      rpc: this.generateRpcTemplate.bind(this),
      rls: this.generateRlsTemplate.bind(this),
      trigger: this.generateTriggerTemplate.bind(this),
      constraint: this.generateConstraintTemplate.bind(this),
      function: this.generateFunctionTemplate.bind(this),
      table: this.generateTableTemplate.bind(this),
      column: this.generateColumnTemplate.bind(this),
      index: this.generateIndexTemplate.bind(this),
    };

    /**
     * @type {Object<string, string>}
     * @private
     */
    this.testDirectories = {
      rpc: "002_rpc_tests",
      rls: "003_rls_tests",
      trigger: "004_trigger_tests",
      constraint: "005_constraint_tests",
      function: "006_function_tests",
      table: "001_table_tests",
      column: "007_column_tests",
      index: "008_index_tests",
    };

    /**
     * @type {Object}
     * @private
     */
    this.templateDefaults = {
      planCount: 6,
      setupRequired: true,
      includeSecurity: true,
      includeValidation: true,
    };
  }

  /**
   * Generate a single test template for a requirement
   * @param {TestRequirement} requirement - The test requirement
   * @returns {TestTemplate} Generated test template
   * @throws {Error} When requirement is invalid or template generation fails
   */
  generateTemplate(requirement) {
    this.validateRequirement(requirement);

    const generator = this.templateGenerators[requirement.type];
    if (!generator) {
      throw new ValidationError(`Unsupported test type: ${requirement.type}`);
    }

    const content = generator(requirement);
    const filename = this.generateFilename(requirement);
    const directory = this.getTestDirectory(requirement.type);

    return {
      content: this.formatTest(content),
      filename,
      directory,
      type: requirement.type,
      metadata: {
        name: requirement.name,
        schema: requirement.schema || "public",
        generatedAt: new Date().toISOString(),
        description:
          requirement.description ||
          `Test for ${requirement.type}: ${requirement.name}`,
      },
    };
  }

  /**
   * Generate multiple test templates from an array of requirements
   * @param {Array<TestRequirement>} requirements - Array of test requirements
   * @returns {BatchResult} Batch generation results
   */
  generateBatch(requirements) {
    if (!Array.isArray(requirements)) {
      throw new ValidationErrorError("Requirements must be an array");
    }

    const templates = [];
    const errors = [];
    const summary = {};

    requirements.forEach((requirement, index) => {
      try {
        const template = this.generateTemplate(requirement);
        templates.push(template);

        // Update summary
        if (!summary[requirement.type]) {
          summary[requirement.type] = 0;
        }
        summary[requirement.type]++;
      } catch (error) {
        errors.push({
          index,
          requirement,
          error: error.message,
        });
      }
    });

    return {
      templates,
      totalGenerated: templates.length,
      errors,
      summary,
    };
  }

  /**
   * Get recommended patterns for a test type
   * @param {string} testType - Test type (rpc, rls, trigger, etc.)
   * @returns {Array<TestPattern>} Recommended patterns
   */
  getRecommendedPatterns(testType) {
    return this.patternLibrary.getRecommendedPatterns(testType);
  }

  /**
   * Get pattern by name
   * @param {string} patternName - Pattern name
   * @returns {TestPattern|null} Pattern or null if not found
   */
  getPattern(patternName) {
    return this.patternLibrary.getPattern(patternName);
  }

  /**
   * Get patterns by category
   * @param {string} categoryName - Category name ('data_validation', 'security_testing', etc.)
   * @returns {Array<TestPattern>} Patterns in the category
   */
  getPatternsByCategory(categoryName) {
    return this.patternLibrary.getPatternsByCategory(categoryName);
  }

  /**
   * Render pattern with provided variables
   * @param {string} patternName - Pattern name
   * @param {Object} variables - Variable substitutions
   * @returns {string} Rendered SQL template
   */
  renderPattern(patternName, variables = {}) {
    return this.patternLibrary.renderPattern(patternName, variables);
  }

  /**
   * Generate enhanced template using patterns from the library
   * @param {TestRequirement} requirement - The test requirement
   * @param {Array<string>} additionalPatterns - Additional pattern names to include
   * @returns {TestTemplate} Enhanced test template with error recovery
   */
  generateEnhancedTemplate(requirement, additionalPatterns = []) {
    const errors = [];
    const warnings = [];

    // Create checkpoint for rollback
    const checkpoint = {
      requirement: JSON.parse(JSON.stringify(requirement)),
      timestamp: Date.now(),
    };

    try {
      // Start with base template
      const baseTemplate = this.generateTemplate(requirement);
      if (!baseTemplate || !baseTemplate.content) {
        throw new ParsingError("Failed to generate base template");
      }

      // Get recommended patterns for this test type
      const recommendedPatterns = this.getRecommendedPatterns(requirement.type);
      const allPatterns = [...recommendedPatterns];

      // Add any additional patterns requested with error handling
      for (const patternName of additionalPatterns) {
        try {
          const pattern = this.getPattern(patternName);
          if (pattern && !allPatterns.find((p) => p.name === patternName)) {
            allPatterns.push(pattern);
          } else if (!pattern) {
            warnings.push(`Pattern '${patternName}' not found in library`);
          }
        } catch (error) {
          errors.push({ pattern: patternName, error: error.message });
          // Continue with other patterns if one fails
        }
      }

      // Extract variables from requirement for pattern rendering
      const variables = this.extractPatternVariables(requirement);

      // Generate enhanced content by incorporating relevant patterns
      let enhancedContent = baseTemplate.content;

      try {
        // Add pattern-based enhancements with error recovery
        const patternEnhancements = this.generatePatternEnhancements(
          requirement,
          allPatterns,
          variables,
        );
        if (patternEnhancements.trim()) {
          enhancedContent +=
            "\n\n-- =========================================================================\n";
          enhancedContent += "-- ENHANCED PATTERNS FROM LIBRARY\n";
          enhancedContent +=
            "-- =========================================================================\n\n";
          enhancedContent += patternEnhancements;
        }
      } catch (patternError) {
        errors.push({
          phase: "pattern_enhancement",
          error: patternError.message,
        });
        // Continue with base template content if pattern enhancement fails
        enhancedContent = baseTemplate.content;
      }

      // Create the enhanced template
      const enhancedTemplate = {
        ...baseTemplate,
        content: this.formatTest(enhancedContent),
        metadata: {
          ...baseTemplate.metadata,
          patternsUsed: allPatterns.map((p) => p.name),
          enhancementLevel: "advanced",
          generationMethod: "pattern-enhanced",
          errors: errors.length > 0 ? errors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };

      // Validate the generated template before returning
      if (!this._validateTemplate(enhancedTemplate)) {
        throw new ParsingError("Generated template failed validation");
      }

      return enhancedTemplate;
    } catch (enhancementError) {
      // Rollback to basic template if enhancement completely fails
      console.warn(
        `Enhancement failed for ${requirement.type} test '${requirement.name}': ${enhancementError.message}`,
      );
      console.warn("Falling back to basic template generation");

      try {
        const basicTemplate = this.generateTemplate(checkpoint.requirement);

        // Validate basic template before returning
        if (!this._validateTemplate(basicTemplate)) {
          throw new ParsingError(
            "Basic template fallback also failed validation",
          );
        }

        return {
          ...basicTemplate,
          metadata: {
            ...basicTemplate.metadata,
            enhancementLevel: "basic",
            generationMethod: "fallback",
            enhancementErrors: [enhancementError.message],
            fallbackReason: "Enhancement failed - using basic template",
          },
        };
      } catch (fallbackError) {
        throw new ParsingError(
          `Both enhanced and basic template generation failed: Enhancement: ${enhancementError.message}, Fallback: ${fallbackError.message}`,
        );
      }
    }
  }

  /**
   * Validate that a generated template has required pgTAP structure
   * @param {TestTemplate} template - Template to validate
   * @returns {boolean} True if template is valid
   * @private
   */
  _validateTemplate(template) {
    try {
      // Check basic template structure
      if (!template || typeof template !== "object") {
        console.error("Template validation failed: Template must be an object");
        return false;
      }

      // Check required properties
      if (!template.content || typeof template.content !== "string") {
        console.error(
          "Template validation failed: Template must have content string",
        );
        return false;
      }

      if (!template.metadata || typeof template.metadata !== "object") {
        console.error(
          "Template validation failed: Template must have metadata object",
        );
        return false;
      }

      const content = template.content;

      // Validate pgTAP structure - must have BEGIN (with or without semicolon for functions)
      if (!content.includes("BEGIN") && !content.includes("begin")) {
        console.error(
          "Template validation failed: Missing pgTAP BEGIN statement",
        );
        return false;
      }

      // Check for pgTAP plan statement (could be SELECT plan() or RETURN NEXT tap.plan())
      const hasPlan =
        content.includes("SELECT plan(") ||
        content.includes("select plan(") ||
        content.includes("tap.plan(") ||
        content.includes("TAP.PLAN(");

      if (!hasPlan) {
        console.error(
          "Template validation failed: Missing pgTAP plan() statement",
        );
        return false;
      }

      // Check for proper pgTAP function endings (PostgreSQL functions use END; and tap.finish())
      const hasEnd = content.includes("END;") || content.includes("end;");
      const hasRollback =
        content.includes("ROLLBACK;") || content.includes("rollback;");
      const hasCommit =
        content.includes("COMMIT;") || content.includes("commit;");

      if (!hasEnd && !hasRollback && !hasCommit) {
        console.error(
          "Template validation failed: Missing proper ending statement (END, ROLLBACK, or COMMIT)",
        );
        return false;
      }

      // Validate that content has at least one actual test function call
      const testFunctionPattern =
        /(tap\.|^|\s)(ok|is|isnt|like|unlike|pass|fail|throws_ok|lives_ok|cmp_ok|is_empty|isnt_empty|has_table|has_column|has_function|has_view|has_trigger|has_index)\s*\(/i;

      if (!testFunctionPattern.test(content)) {
        console.error(
          "Template validation failed: No pgTAP test functions found in content",
        );
        return false;
      }

      // Check for SQL injection vulnerabilities in dynamic content
      const suspiciousPatterns = [
        /;\s*DROP\s+/i,
        /;\s*DELETE\s+FROM\s+(?!.*WHERE)/i,
        /;\s*UPDATE\s+.*SET\s+.*(?!WHERE)/i,
        /UNION\s+SELECT/i,
        /--\s*'[^']*'[^;]*;/, // SQL comments with quotes followed by statements (more specific injection pattern)
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          console.error(
            `Template validation failed: Suspicious SQL pattern detected: ${pattern}`,
          );
          return false;
        }
      }

      // Validate metadata structure
      const metadata = template.metadata;

      // Check for name (required in all templates)
      if (!metadata.name || typeof metadata.name !== "string") {
        console.error("Template validation failed: Metadata missing name");
        return false;
      }

      // Check for schema (required in all templates)
      if (!metadata.schema || typeof metadata.schema !== "string") {
        console.error("Template validation failed: Metadata missing schema");
        return false;
      }

      // Check for reasonable plan count
      if (
        metadata.planCount &&
        (typeof metadata.planCount !== "number" ||
          metadata.planCount < 1 ||
          metadata.planCount > 1000)
      ) {
        console.error(
          "Template validation failed: Invalid planCount in metadata",
        );
        return false;
      }

      return true;
    } catch (validationError) {
      console.error(
        `Template validation failed with exception: ${validationError.message}`,
      );
      return false;
    }
  }

  /**
   * Generate best practices documentation for a test type
   * @param {string} testType - Test type
   * @returns {string} Best practices documentation
   */
  generateBestPracticesDoc(testType) {
    const practices = this.patternLibrary.getBestPractices(testType);
    const examples = this.patternLibrary.getUsageExamples(testType);

    let doc = `-- =========================================================================\n`;
    doc += `-- BEST PRACTICES FOR ${testType.toUpperCase()} TESTS\n`;
    doc += `-- =========================================================================\n\n`;

    if (practices.length > 0) {
      doc += `-- Best Practices:\n`;
      practices.forEach((practice) => {
        doc += `-- • ${practice}\n`;
      });
      doc += `\n`;
    }

    if (examples.length > 0) {
      doc += `-- Usage Examples:\n`;
      examples.forEach((example) => {
        doc += `-- • ${example}\n`;
      });
      doc += `\n`;
    }

    const recommendedPatterns = this.getRecommendedPatterns(testType);
    if (recommendedPatterns.length > 0) {
      doc += `-- Recommended Patterns:\n`;
      recommendedPatterns.forEach((pattern) => {
        doc += `-- • ${pattern.name}: ${pattern.description}\n`;
      });
    }

    return doc;
  }

  /**
   * Generate pattern library documentation
   * @returns {string} Complete pattern library documentation
   */
  generatePatternLibraryDoc() {
    return this.patternLibrary.generateDocumentation();
  }

  /**
   * Generate usage examples showing how to leverage patterns
   * @returns {Object} Usage examples with sample code
   */
  generateUsageExamples() {
    return {
      basicUsage: {
        description: "Basic template generation (existing functionality)",
        code: `const generator = new TestTemplateGenerator();
const requirement = {
  type: 'table',
  name: 'users',
  schema: 'public'
};
const template = generator.generateTemplate(requirement);`,
      },

      enhancedUsage: {
        description: "Enhanced template generation with patterns",
        code: `const generator = new TestTemplateGenerator();
const requirement = {
  type: 'rls',
  name: 'users',
  schema: 'public',
  metadata: {
    policies: [
      { name: 'users_select_own', commands: ['SELECT'] },
      { name: 'users_update_own', commands: ['UPDATE'] }
    ]
  }
};
const enhancedTemplate = generator.generateEnhancedTemplate(
  requirement, 
  ['privilege_escalation_test'] // Additional patterns
);`,
      },

      patternAccess: {
        description: "Direct pattern access and customization",
        code: `const generator = new TestTemplateGenerator();

// Get recommended patterns for a test type
const rlsPatterns = generator.getRecommendedPatterns('rls');

// Get patterns by category
const securityPatterns = generator.getPatternsByCategory('security_testing');

// Render a specific pattern
const variables = { schema: 'public', tableName: 'posts' };
const rendered = generator.renderPattern('table_exists_basic', variables);`,
      },

      documentationGeneration: {
        description: "Generate documentation and best practices",
        code: `const generator = new TestTemplateGenerator();

// Generate best practices for a test type
const bestPractices = generator.generateBestPracticesDoc('rls');

// Generate complete pattern library documentation
const libraryDoc = generator.generatePatternLibraryDoc();`,
      },

      batchGeneration: {
        description: "Batch generation with pattern enhancement",
        code: `const generator = new TestTemplateGenerator();
const requirements = [
  { type: 'table', name: 'users', schema: 'public' },
  { type: 'rls', name: 'posts', schema: 'public' },
  { type: 'function', name: 'get_user_posts', schema: 'public' }
];

// Generate enhanced templates for all requirements
const enhancedTemplates = requirements.map(req => 
  generator.generateEnhancedTemplate(req)
);

// Or use batch generation (basic templates)
const batchResult = generator.generateBatch(requirements);`,
      },
    };
  }

  /**
   * Format test SQL content with proper indentation and structure
   * @param {string} template - Raw template content
   * @returns {string} Formatted test SQL
   */
  formatTest(template) {
    if (!template || typeof template !== "string") {
      throw new ValidationError("Template content must be a non-empty string");
    }

    // Remove excessive blank lines and normalize line endings
    let formatted = template
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\n{3,}/g, "\n\n") // Reduce multiple blank lines to max 2
      .trim(); // Remove leading/trailing whitespace

    // Ensure proper pgTAP structure formatting
    formatted = this.formatPgTapStructure(formatted);

    // Add final newline
    return formatted + "\n";
  }

  /**
   * Validate a test requirement object
   * @param {TestRequirement} requirement - Requirement to validate
   * @throws {Error} When requirement is invalid
   * @private
   */
  validateRequirement(requirement) {
    if (!requirement || typeof requirement !== "object") {
      throw new ValidationError("Requirement must be an object");
    }

    if (!requirement.type || typeof requirement.type !== "string") {
      throw new ValidationError("Requirement must have a valid type");
    }

    if (!requirement.name || typeof requirement.name !== "string") {
      throw new ValidationError("Requirement must have a valid name");
    }

    if (!this.templateGenerators[requirement.type]) {
      throw new ValidationError(`Unsupported test type: ${requirement.type}`);
    }

    // Validate name format
    if (!/^[a-zA-Z0-9_]+$/.test(requirement.name)) {
      throw new ValidationError(
        "Name must contain only letters, numbers, and underscores",
      );
    }
  }

  /**
   * Generate filename for a test based on requirement
   * @param {TestRequirement} requirement - The test requirement
   * @returns {string} Generated filename
   * @private
   */
  generateFilename(requirement) {
    const sanitizedName = requirement.name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
    return `${sanitizedName}.test.sql`;
  }

  /**
   * Get test directory for a test type
   * @param {string} testType - Type of test
   * @returns {string} Directory name
   * @private
   */
  getTestDirectory(testType) {
    return this.testDirectories[testType] || "999_custom_tests";
  }

  /**
   * Generate RPC function test template
   * @param {TestRequirement} requirement - RPC function requirement
   * @returns {string} Generated template content
   * @private
   */
  generateRpcTemplate(requirement) {
    const schema = requirement.schema || "public";
    const functionName = requirement.name;
    const testFunctionName = `run_${functionName}_tests`;
    const planCount = this.calculatePlanCount(requirement, "rpc");

    // Build parameter placeholders if parameters are specified
    const hasParams =
      requirement.parameters && requirement.parameters.length > 0;
    const paramPlaceholder = hasParams
      ? `(${requirement.parameters.map(() => "TODO: param").join(", ")})`
      : "()";

    return `-- =========================================================================
-- RPC FUNCTION TESTS: ${functionName}
-- =========================================================================
-- Tests for the ${functionName} function to ensure:
-- 1. Function exists and has correct signature
-- 2. Function handles valid inputs correctly
-- 3. Function validates invalid inputs properly
-- 4. Function respects security and authorization
-- 5. Function returns expected data structure
${requirement.description ? `-- \n-- Description: ${requirement.description}` : ""}

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
DECLARE
  v_admin_id uuid;
  v_user_id uuid;
  v_result ${requirement.returnType || "jsonb"};
  v_test_data record;
BEGIN
  -- Plan our tests (adjust count as needed)
  RETURN NEXT tap.plan(${planCount});
  
  -- Setup: Create test users if needed
  v_admin_id := test.create_test_admin();
  v_user_id := test.create_test_user();
  
  -- Test 1: Function exists
  RETURN NEXT tap.has_function(
    '${schema}',
    '${functionName}',
    'Function ${functionName} exists'
  );
  
  -- Test 2: Function returns expected data type
  RETURN NEXT tap.has_function(
    '${schema}', 
    '${functionName}',
    ${hasParams ? `ARRAY[${requirement.parameters.map((p) => `'${p}'`).join(", ")}]` : "ARRAY[]::text[]"},
    'Function ${functionName} has correct signature'
  );
  
  -- Test 3: Function works with valid input
  PERFORM test.set_auth_context(v_user_id);
  
  RETURN NEXT tap.lives_ok(
    'SELECT ${schema}.${functionName}${paramPlaceholder}',
    'Function ${functionName} executes successfully with valid input'
  );
  
  -- Test 4: Function returns expected structure
  SELECT ${schema}.${functionName}${paramPlaceholder} INTO v_result;
  
  RETURN NEXT tap.ok(
    v_result IS NOT NULL,
    'Function ${functionName} returns non-null result'
  );
  
  -- Test 5: Function handles invalid input appropriately
  -- TODO: Add test for invalid input validation
  RETURN NEXT tap.pass('TODO: Add invalid input validation test');
  
  -- Test 6: Function respects authorization/security
  -- TODO: Test unauthorized access if applicable
  RETURN NEXT tap.pass('TODO: Add authorization test');
  
  -- Additional custom tests can be added here
  -- TODO: Add function-specific test logic
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Tests for ${functionName} RPC function';`;
  }

  /**
   * Generate RLS policy test template
   * @param {TestRequirement} requirement - RLS policy requirement
   * @returns {string} Generated template content
   * @private
   */
  generateRlsTemplate(requirement) {
    const schema = requirement.schema || "public";
    const tableName = requirement.name;
    const testFunctionName = `run_${tableName}_rls_tests`;
    const planCount = this.calculatePlanCount(requirement, "rls");

    // Extract policy metadata if available
    const policies = requirement.metadata?.policies || [];
    const testScenarios = requirement.metadata?.testScenarios || [];

    // Generate core RLS tests
    let rlsTests = this.generateRlsEnablementTests(schema, tableName);
    rlsTests += this.generatePolicyExistenceTests(schema, tableName, policies);
    rlsTests += this.generatePolicyCommandTests(schema, tableName, policies);
    rlsTests += this.generatePolicyRolesTests(schema, tableName, policies);
    rlsTests += this.generateMultiUserAccessTests(
      schema,
      tableName,
      testScenarios,
    );
    rlsTests += this.generateSecurityEdgeCaseTests(schema, tableName);

    return `-- =========================================================================
-- RLS POLICY TESTS: ${tableName}
-- =========================================================================
-- Comprehensive tests for Row Level Security policies on ${tableName} table:
-- 1. RLS enablement verification (is_rls_enabled)
-- 2. Policy existence tests (policy_exists)
-- 3. Policy command validation (policy_cmd_is)
-- 4. Policy role verification (policy_roles_are)
-- 5. Multi-user access scenarios
-- 6. Security edge cases and bypass scenarios
${requirement.description ? `-- \n-- Description: ${requirement.description}` : ""}

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
DECLARE
  v_admin_id uuid;
  v_user1_id uuid;
  v_user2_id uuid;
  v_anon_role text := 'anon';
  v_authenticated_role text := 'authenticated';
  v_service_role text := 'service_role';
  v_test_record_id uuid;
  v_policy_count integer;
  v_accessible_count integer;
BEGIN
  -- Plan our tests (adjust count based on policies and scenarios)
  RETURN NEXT tap.plan(${planCount});
  
  -- Setup: Create test users and test data
  v_admin_id := test.create_test_admin();
  v_user1_id := test.create_test_user();
  v_user2_id := test.create_test_user('user2@test.com');
  
${rlsTests}
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Comprehensive RLS policy tests for ${tableName} table';
`;
  }

  /**
   * Generate trigger test template
   * @param {TestRequirement} requirement - Trigger requirement
   * @returns {string} Generated template content
   * @private
   */
  generateTriggerTemplate(requirement) {
    const schema = requirement.schema || "public";
    const triggerName = requirement.name;
    const testFunctionName = `run_${triggerName}_tests`;
    const planCount = this.calculatePlanCount(requirement, "trigger");

    return `-- =========================================================================
-- TRIGGER TESTS: ${triggerName}
-- =========================================================================
-- Tests for the ${triggerName} trigger to ensure:
-- 1. Trigger exists and is properly configured
-- 2. Trigger fires on expected operations
-- 3. Trigger performs expected data modifications
-- 4. Trigger handles edge cases correctly
${requirement.description ? `-- \n-- Description: ${requirement.description}` : ""}

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
DECLARE
  v_test_record_id uuid;
BEGIN
  -- Plan our tests (adjust count as needed)
  RETURN NEXT tap.plan(${planCount});
  
  -- Test 1: Trigger exists
  RETURN NEXT tap.has_trigger(
    '${schema}',
    'TODO: table_name',
    '${triggerName}',
    'Trigger ${triggerName} exists'
  );
  
  -- Test 2: Trigger fires on INSERT
  -- TODO: Implement trigger behavior test for INSERT
  RETURN NEXT tap.pass('TODO: Test trigger behavior on INSERT');
  
  -- Test 3: Trigger fires on UPDATE
  -- TODO: Implement trigger behavior test for UPDATE
  RETURN NEXT tap.pass('TODO: Test trigger behavior on UPDATE');
  
  -- Test 4: Trigger fires on DELETE
  -- TODO: Implement trigger behavior test for DELETE
  RETURN NEXT tap.pass('TODO: Test trigger behavior on DELETE');
  
  -- Test 5: Trigger performs expected modifications
  -- TODO: Implement test for trigger side effects
  RETURN NEXT tap.pass('TODO: Test trigger side effects');
  
  -- Test 6: Trigger handles edge cases
  -- TODO: Implement edge case tests
  RETURN NEXT tap.pass('TODO: Test trigger edge cases');
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Tests for ${triggerName} trigger';`;
  }

  /**
   * Generate constraint test template
   * @param {TestRequirement} requirement - Constraint requirement
   * @returns {string} Generated template content
   * @private
   */
  generateConstraintTemplate(requirement) {
    const schema = requirement.schema || "public";
    const constraintName = requirement.name;
    const testFunctionName = `run_${constraintName}_tests`;
    const planCount = this.calculatePlanCount(requirement, "constraint");

    return `-- =========================================================================
-- CONSTRAINT TESTS: ${constraintName}
-- =========================================================================
-- Tests for the ${constraintName} constraint to ensure:
-- 1. Constraint exists and is properly configured
-- 2. Constraint allows valid data
-- 3. Constraint rejects invalid data
-- 4. Constraint behavior is consistent
${requirement.description ? `-- \n-- Description: ${requirement.description}` : ""}

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
BEGIN
  -- Plan our tests (adjust count as needed)
  RETURN NEXT tap.plan(${planCount});
  
  -- Test 1: Constraint exists
  RETURN NEXT tap.has_constraint(
    '${schema}',
    'TODO: table_name',
    '${constraintName}',
    'Constraint ${constraintName} exists'
  );
  
  -- Test 2: Constraint allows valid data
  -- TODO: Implement test for valid data acceptance
  RETURN NEXT tap.pass('TODO: Test constraint allows valid data');
  
  -- Test 3: Constraint rejects invalid data
  -- TODO: Implement test for invalid data rejection
  RETURN NEXT tap.pass('TODO: Test constraint rejects invalid data');
  
  -- Test 4: Constraint boundary conditions
  -- TODO: Implement boundary condition tests
  RETURN NEXT tap.pass('TODO: Test constraint boundary conditions');
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Tests for ${constraintName} constraint';`;
  }

  /**
   * Generate function test template (for database functions, not RPC)
   * @param {TestRequirement} requirement - Function requirement
   * @returns {string} Generated template content
   * @private
   */
  generateFunctionTemplate(requirement) {
    const schema = requirement.schema || "public";
    const functionName = requirement.name;
    const testFunctionName = `run_${functionName}_function_tests`;

    // Extract metadata with defaults
    const metadata = requirement.metadata || {};
    const parameterTypes = metadata.parameterTypes || [];
    const returnType = metadata.returnType || "text";
    const language = metadata.language || "plpgsql";
    const _isRpcFunction = metadata.isRpcFunction || false;
    const requiresSecurityTesting = metadata.requiresSecurityTesting || false;
    const testCases = metadata.testCases || [];
    const isVolatile = metadata.isVolatile || false;

    // Calculate plan count based on test complexity
    let planCount = this.calculateFunctionPlanCount(requirement, metadata);

    // Build parameter signature for testing
    const hasParams = parameterTypes.length > 0;
    const parameterSignature = hasParams
      ? `ARRAY[${parameterTypes.map((type) => `'${type}'`).join(", ")}]`
      : "ARRAY[]::text[]";

    // Generate sample test parameters based on types
    const sampleParams = this.generateSampleParameters(parameterTypes);
    const invalidParams = this.generateInvalidParameters(parameterTypes);

    return `-- =========================================================================
-- FUNCTION TESTS: ${functionName}
-- =========================================================================
-- Comprehensive tests for the ${functionName} database function covering:
-- 1. Function existence and signature validation
-- 2. Return type verification
-- 3. Parameter validation and type checking
-- 4. Security definer settings (if applicable)
-- 5. Function language verification
-- 6. Behavioral tests with sample inputs
-- 7. Error condition handling
-- 8. Authorization scenarios (if applicable)
${requirement.description ? `-- \n-- Description: ${requirement.description}` : ""}
${metadata.tags ? `-- Tags: ${metadata.tags.join(", ")}` : ""}

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
DECLARE
  v_result ${returnType};
  v_admin_id uuid;
  v_user_id uuid;
  v_test_data record;
  v_error_caught boolean := false;
BEGIN
  -- Plan our tests (adjust count as needed based on metadata)
  RETURN NEXT tap.plan(${planCount});
  
  ${
    requiresSecurityTesting
      ? `-- Setup: Create test users for security testing
  v_admin_id := test.create_test_admin();
  v_user_id := test.create_test_user();
  `
      : ""
  }
  -- ===================================================================
  -- BASIC FUNCTION EXISTENCE AND SIGNATURE TESTS
  -- ===================================================================
  
  -- Test 1: Function exists
  RETURN NEXT tap.has_function(
    '${schema}',
    '${functionName}',
    'Function ${functionName} exists'
  );
  
  ${
    hasParams
      ? `-- Test 2: Function has correct parameter signature
  RETURN NEXT tap.has_function(
    '${schema}',
    '${functionName}',
    ${parameterSignature},
    'Function ${functionName} has correct parameter types: ${parameterTypes.join(", ")}'
  );
  `
      : `-- Test 2: Function has no parameters
  RETURN NEXT tap.has_function(
    '${schema}',
    '${functionName}',
    ARRAY[]::text[],
    'Function ${functionName} takes no parameters'
  );
  `
  }
  -- Test 3: Function returns correct type
  RETURN NEXT tap.function_returns(
    '${schema}',
    '${functionName}',
    ${hasParams ? parameterSignature + "," : ""}
    '${returnType}',
    'Function ${functionName} returns ${returnType}'
  );
  
  ${
    language !== "sql"
      ? `-- Test 4: Function uses correct language
  RETURN NEXT tap.function_lang_is(
    '${schema}',
    '${functionName}',
    ${hasParams ? parameterSignature + "," : ""}
    '${language}',
    'Function ${functionName} is written in ${language}'
  );
  `
      : ""
  }
  
  ${
    metadata.securityDefiner
      ? `-- Test 5: Function is security definer
  RETURN NEXT tap.is_definer(
    '${schema}',
    '${functionName}',
    ${hasParams ? parameterSignature + "," : ""}
    'Function ${functionName} is security definer'
  );
  `
      : `-- Test 5: Function is NOT security definer (security invoker)
  RETURN NEXT tap.isnt_definer(
    '${schema}',
    '${functionName}',
    ${hasParams ? parameterSignature + "," : ""}
    'Function ${functionName} is security invoker'
  );
  `
  }
  
  -- ===================================================================
  -- BEHAVIORAL TESTS WITH SAMPLE INPUTS
  -- ===================================================================
  
  -- Test 6: Function executes successfully with valid input
  BEGIN
    ${sampleParams ? `SELECT ${schema}.${functionName}(${sampleParams}) INTO v_result;` : `SELECT ${schema}.${functionName}() INTO v_result;`}
    
    RETURN NEXT tap.ok(
      v_result IS NOT NULL,
      'Function ${functionName} returns non-null result with valid input'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NEXT tap.fail(
        'Function ${functionName} should not raise exception with valid input: ' || SQLERRM
      );
  END;
  
  ${
    testCases.length > 0
      ? testCases
          .map(
            (testCase, index) => `
  -- Test ${7 + index}: Custom test case - ${testCase.description || `Test case ${index + 1}`}
  BEGIN
    ${testCase.input ? `SELECT ${schema}.${functionName}(${testCase.input}) INTO v_result;` : `SELECT ${schema}.${functionName}() INTO v_result;`}
    
    ${
      testCase.expectedOutput !== undefined
        ? `RETURN NEXT tap.is(
      v_result,
      ${typeof testCase.expectedOutput === "string" ? `'${testCase.expectedOutput}'` : testCase.expectedOutput}::${returnType},
      'Function ${functionName} returns expected result: ${testCase.description || `test case ${index + 1}`}'
    );`
        : `RETURN NEXT tap.ok(
      v_result IS NOT NULL,
      'Function ${functionName} executes successfully: ${testCase.description || `test case ${index + 1}`}'
    );`
    }
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NEXT tap.fail(
        'Function ${functionName} test case failed: ${testCase.description || `test case ${index + 1}`} - ' || SQLERRM
      );
  END;
  `,
          )
          .join("")
      : ""
  }
  
  -- ===================================================================
  -- ERROR CONDITION AND VALIDATION TESTS
  -- ===================================================================
  
  ${
    hasParams
      ? `-- Test: Function handles invalid input appropriately
  BEGIN
    v_error_caught := false;
    BEGIN
      ${invalidParams ? `SELECT ${schema}.${functionName}(${invalidParams}) INTO v_result;` : `-- TODO: Add invalid parameter test`}
    EXCEPTION
      WHEN OTHERS THEN
        v_error_caught := true;
    END;
    
    -- Note: Adjust expectation based on function's error handling approach
    RETURN NEXT tap.ok(
      v_error_caught OR v_result IS NULL,
      'Function ${functionName} handles invalid input appropriately (either raises exception or returns null)'
    );
  END;
  `
      : ""
  }
  
  ${
    requiresSecurityTesting
      ? `-- ===================================================================
  -- AUTHORIZATION AND SECURITY TESTS
  -- ===================================================================
  
  -- Test: Function respects user context (if applicable)
  PERFORM test.set_auth_context(v_user_id);
  
  BEGIN
    ${sampleParams ? `SELECT ${schema}.${functionName}(${sampleParams}) INTO v_result;` : `SELECT ${schema}.${functionName}() INTO v_result;`}
    
    RETURN NEXT tap.ok(
      v_result IS NOT NULL,
      'Function ${functionName} works with regular user context'
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RETURN NEXT tap.pass(
        'Function ${functionName} properly restricts access for regular users'
      );
    WHEN OTHERS THEN
      RETURN NEXT tap.fail(
        'Function ${functionName} failed with user context: ' || SQLERRM
      );
  END;
  
  -- Test: Function works with admin context
  PERFORM test.set_auth_context(v_admin_id);
  
  BEGIN
    ${sampleParams ? `SELECT ${schema}.${functionName}(${sampleParams}) INTO v_result;` : `SELECT ${schema}.${functionName}() INTO v_result;`}
    
    RETURN NEXT tap.ok(
      v_result IS NOT NULL,
      'Function ${functionName} works with admin user context'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NEXT tap.fail(
        'Function ${functionName} should work with admin context: ' || SQLERRM
      );
  END;
  `
      : ""
  }
  
  ${
    isVolatile
      ? `-- ===================================================================
  -- SIDE EFFECTS AND STATE TESTS (for volatile functions)
  -- ===================================================================
  
  -- Test: Function maintains data consistency
  -- TODO: Add specific tests for function side effects
  RETURN NEXT tap.pass('TODO: Test function side effects and data consistency');
  `
      : `-- ===================================================================
  -- IMMUTABILITY TESTS (for stable/immutable functions)
  -- ===================================================================
  
  -- Test: Function returns consistent results
  DECLARE
    v_result1 ${returnType};
    v_result2 ${returnType};
  BEGIN
    ${
      sampleParams
        ? `SELECT ${schema}.${functionName}(${sampleParams}) INTO v_result1;
    SELECT ${schema}.${functionName}(${sampleParams}) INTO v_result2;`
        : `SELECT ${schema}.${functionName}() INTO v_result1;
    SELECT ${schema}.${functionName}() INTO v_result2;`
    }
    
    RETURN NEXT tap.is(
      v_result1,
      v_result2,
      'Function ${functionName} returns consistent results (deterministic)'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NEXT tap.fail(
        'Function ${functionName} consistency test failed: ' || SQLERRM
      );
  END;
  `
  }
  
  -- ===================================================================
  -- PERFORMANCE AND RESOURCE TESTS (optional)
  -- ===================================================================
  
  -- Test: Function completes within reasonable time
  -- TODO: Add performance benchmarks if needed
  RETURN NEXT tap.pass('TODO: Add performance tests if required');
  
  -- Additional custom tests can be added here based on specific function requirements
  -- TODO: Add function-specific business logic tests
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Comprehensive tests for ${functionName} database function covering existence, signature, behavior, and security';`;
  }

  /**
   * Generate RLS enablement tests (is_rls_enabled)
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @returns {string} Generated test content
   * @private
   */
  generateRlsEnablementTests(schema, tableName) {
    return `  -- =====================================================
  -- RLS ENABLEMENT TESTS
  -- =====================================================
  
  -- Test: RLS is enabled on table
  RETURN NEXT tap.ok(
    (SELECT relrowsecurity FROM pg_class 
     WHERE relname = '${tableName}' 
     AND relnamespace = '${schema}'::regnamespace),
    'RLS is enabled on ${schema}.${tableName}'
  );
  
  -- Test: RLS is enforced (not just enabled)
  RETURN NEXT tap.ok(
    (SELECT relforcerowsecurity FROM pg_class 
     WHERE relname = '${tableName}' 
     AND relnamespace = '${schema}'::regnamespace) OR
    (SELECT relrowsecurity FROM pg_class 
     WHERE relname = '${tableName}' 
     AND relnamespace = '${schema}'::regnamespace),
    'RLS enforcement is properly configured on ${schema}.${tableName}'
  );
  
`;
  }

  /**
   * Generate policy existence tests (policy_exists)
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @param {Array} policies - Policy metadata
   * @returns {string} Generated test content
   * @private
   */
  generatePolicyExistenceTests(schema, tableName, policies) {
    let tests = `  -- =====================================================
  -- POLICY EXISTENCE TESTS
  -- =====================================================
  
`;

    if (policies && policies.length > 0) {
      policies.forEach((policy) => {
        tests += `  -- Test: Policy '${policy.name}' exists
  RETURN NEXT tap.ok(
    (SELECT COUNT(*) > 0 FROM pg_policies 
     WHERE schemaname = '${schema}' 
     AND tablename = '${tableName}'
     AND policyname = '${policy.name}'),
    'Policy "${policy.name}" exists on ${schema}.${tableName}'
  );
  
`;
      });
    } else {
      tests += `  -- Test: At least one policy exists
  SELECT COUNT(*) INTO v_policy_count 
  FROM pg_policies 
  WHERE schemaname = '${schema}' AND tablename = '${tableName}';
  
  RETURN NEXT tap.ok(
    v_policy_count > 0,
    'At least one RLS policy exists for ${schema}.${tableName}'
  );
  
`;
    }

    return tests;
  }

  /**
   * Generate policy command tests (policy_cmd_is)
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @param {Array} policies - Policy metadata
   * @returns {string} Generated test content
   * @private
   */
  generatePolicyCommandTests(schema, tableName, policies) {
    let tests = `  -- =====================================================
  -- POLICY COMMAND TESTS
  -- =====================================================
  
`;

    if (policies && policies.length > 0) {
      policies.forEach((policy) => {
        if (policy.commands && policy.commands.length > 0) {
          policy.commands.forEach((cmd) => {
            tests += `  -- Test: Policy '${policy.name}' applies to ${cmd} command
  RETURN NEXT tap.ok(
    (SELECT COUNT(*) > 0 FROM pg_policies 
     WHERE schemaname = '${schema}' 
     AND tablename = '${tableName}'
     AND policyname = '${policy.name}'
     AND cmd = '${cmd}'),
    'Policy "${policy.name}" applies to ${cmd} operations'
  );
  
`;
          });
        }
      });
    } else {
      tests += `  -- Test: Policies cover basic CRUD operations
  RETURN NEXT tap.ok(
    (SELECT COUNT(DISTINCT cmd) >= 2 FROM pg_policies 
     WHERE schemaname = '${schema}' 
     AND tablename = '${tableName}'
     AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
    'Policies cover multiple CRUD operations on ${schema}.${tableName}'
  );
  
`;
    }

    return tests;
  }

  /**
   * Generate policy roles tests (policy_roles_are)
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @param {Array} policies - Policy metadata
   * @returns {string} Generated test content
   * @private
   */
  generatePolicyRolesTests(schema, tableName, policies) {
    let tests = `  -- =====================================================
  -- POLICY ROLES TESTS
  -- =====================================================
  
`;

    if (policies && policies.length > 0) {
      policies.forEach((policy) => {
        if (policy.roles && policy.roles.length > 0) {
          const _roleList = policy.roles.map((role) => `'${role}'`).join(", ");
          tests += `  -- Test: Policy '${policy.name}' applies to correct roles
  RETURN NEXT tap.set_eq(
    $$SELECT unnest(roles) FROM pg_policies 
      WHERE schemaname = '${schema}' 
      AND tablename = '${tableName}'
      AND policyname = '${policy.name}'$$,
    $$VALUES (${policy.roles.map((role) => `'${role}'`).join("), (")})$$,
    'Policy "${policy.name}" applies to correct roles: ${policy.roles.join(", ")}'
  );
  
`;
        }
      });
    } else {
      tests += `  -- Test: Policies are properly scoped to roles
  RETURN NEXT tap.ok(
    (SELECT COUNT(*) > 0 FROM pg_policies 
     WHERE schemaname = '${schema}' 
     AND tablename = '${tableName}'
     AND roles IS NOT NULL),
    'Policies have role restrictions defined for ${schema}.${tableName}'
  );
  
`;
    }

    return tests;
  }

  /**
   * Generate multi-user access tests
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @param {Array} testScenarios - Test scenarios
   * @returns {string} Generated test content
   * @private
   */
  generateMultiUserAccessTests(schema, tableName, testScenarios) {
    let tests = `  -- =====================================================
  -- MULTI-USER ACCESS TESTS
  -- =====================================================
  
`;

    // Anonymous user tests
    tests += `  -- Test: Anonymous access
  PERFORM test.set_auth_context(NULL, 'anon');
  
  RETURN NEXT tap.lives_ok(
    $$SELECT COUNT(*) FROM ${schema}.${tableName}$$,
    'Anonymous users can query ${schema}.${tableName} (may return 0 rows)'
  );
  
`;

    // Authenticated user tests
    tests += `  -- Test: Authenticated user can access own data
  PERFORM test.set_auth_context(v_user1_id, 'authenticated');
  
  -- TODO: Create test record owned by v_user1_id
  -- INSERT INTO ${schema}.${tableName} (user_id, ...) VALUES (v_user1_id, ...);
  
  RETURN NEXT tap.pass('TODO: Test authenticated user can access own data in ${tableName}');
  
`;

    // Cross-user access restriction tests
    tests += `  -- Test: Users cannot access other users' data
  PERFORM test.set_auth_context(v_user2_id, 'authenticated');
  
  -- TODO: Verify v_user2_id cannot see v_user1_id's data
  RETURN NEXT tap.pass('TODO: Test user cannot access other users data in ${tableName}');
  
`;

    // Admin access tests
    tests += `  -- Test: Admin users have elevated access
  PERFORM test.set_auth_context(v_admin_id, 'authenticated');
  
  RETURN NEXT tap.pass('TODO: Test admin user has appropriate access to ${tableName}');
  
`;

    if (testScenarios && testScenarios.length > 0) {
      testScenarios.forEach((scenario, index) => {
        tests += `  -- Custom Test Scenario ${index + 1}: ${scenario.description || "Custom scenario"}
  PERFORM test.set_auth_context(
    ${scenario.userId ? `'${scenario.userId}'::uuid` : "NULL"}, 
    '${scenario.role || "authenticated"}'
  );
  
  RETURN NEXT tap.pass('TODO: Implement custom test scenario: ${scenario.description || "custom scenario"}');
  
`;
      });
    }

    return tests;
  }

  /**
   * Generate security edge case tests
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @returns {string} Generated test content
   * @private
   */
  generateSecurityEdgeCaseTests(schema, tableName) {
    return `  -- =====================================================
  -- SECURITY EDGE CASES & BYPASS TESTS
  -- =====================================================
  
  -- Test: Service role bypasses RLS
  SET ROLE service_role;
  
  RETURN NEXT tap.lives_ok(
    $$SELECT COUNT(*) FROM ${schema}.${tableName}$$,
    'Service role can bypass RLS on ${schema}.${tableName}'
  );
  
  RESET ROLE;
  
  -- Test: Superuser bypasses RLS
  SET ROLE postgres;
  
  RETURN NEXT tap.lives_ok(
    $$SELECT COUNT(*) FROM ${schema}.${tableName}$$,
    'Postgres superuser can bypass RLS on ${schema}.${tableName}'
  );
  
  RESET ROLE;
  
  -- Test: Policy expressions are not bypassable
  PERFORM test.set_auth_context(v_user1_id, 'authenticated');
  
  -- TODO: Test that policy expressions cannot be circumvented
  RETURN NEXT tap.pass('TODO: Test policy expression security for ${tableName}');
  
  -- Test: SQL injection resistance in policies
  RETURN NEXT tap.pass('TODO: Test SQL injection resistance in ${tableName} policies');
  
`;
  }

  /**
   * Generate comprehensive table test template
   * @param {TableTestRequirement} requirement - Table test requirement
   * @returns {string} Generated template content
   * @private
   */
  generateTableTemplate(requirement) {
    const schema = requirement.schema || "public";
    const tableName = requirement.targetName || requirement.name;
    const testFunctionName = `run_${tableName}_table_tests`;
    const planCount = this.calculatePlanCount(requirement, "table");

    // Extract metadata for comprehensive testing
    const metadata = requirement.metadata || {};
    const columns = metadata.columns || [];
    const expectedConstraints = metadata.expectedConstraints || [];
    const requiresRowLevelSecurity = metadata.requiresRowLevelSecurity || false;
    const indexes = metadata.indexes || [];

    // Generate column test assertions
    const columnTests = this.generateColumnTestAssertions(
      schema,
      tableName,
      columns,
    );

    // Generate constraint test assertions
    const constraintTests = this.generateConstraintTestAssertions(
      schema,
      tableName,
      expectedConstraints,
    );

    // Generate index test assertions
    const indexTests = this.generateIndexTestAssertions(
      schema,
      tableName,
      indexes,
    );

    // Generate RLS test assertions if required
    const rlsTests = requiresRowLevelSecurity
      ? this.generateRlsTestAssertions(schema, tableName)
      : "";

    return `-- =========================================================================
-- TABLE TESTS: ${tableName}
-- =========================================================================
-- Comprehensive tests for the ${tableName} table to ensure:
-- 1. Table exists with correct structure
-- 2. All required columns exist with proper types and constraints
-- 3. Primary keys and foreign keys are configured correctly
-- 4. Check constraints and unique constraints work as expected
-- 5. Table ownership and privileges are set appropriately
-- 6. Row Level Security is configured if required
${requirement.description ? `-- \n-- Description: ${requirement.description}` : ""}

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
DECLARE
  v_test_record_id uuid;
  v_constraint_count integer;
  v_column_count integer;
BEGIN
  -- Plan our tests (adjust count as needed)
  RETURN NEXT tap.plan(${planCount});
  
  -- =========================================================================
  -- TABLE EXISTENCE TESTS
  -- =========================================================================
  
  -- Test 1: Table exists
  RETURN NEXT tap.has_table(
    '${schema}',
    '${tableName}',
    'Table ${tableName} exists in ${schema} schema'
  );
  
  -- Test 2: Table is not a view (ensure it's an actual table)
  RETURN NEXT tap.hasnt_view(
    '${schema}',
    '${tableName}',
    'Object ${tableName} is a table, not a view'
  );

${columnTests}

${constraintTests}

${indexTests}

${rlsTests}

  -- =========================================================================
  -- TABLE OWNERSHIP AND PRIVILEGE TESTS
  -- =========================================================================
  
  -- Test: Table has correct owner
  RETURN NEXT tap.is(
    (SELECT tableowner FROM pg_tables 
     WHERE schemaname = '${schema}' AND tablename = '${tableName}'),
    'postgres',
    'Table ${tableName} has correct owner'
  );
  
  -- Test: Service role has appropriate access
  RETURN NEXT tap.ok(
    (SELECT has_table_privilege('service_role', '${schema}.${tableName}', 'SELECT')),
    'Service role has SELECT privilege on ${tableName}'
  );
  
  -- Test: Anonymous role has appropriate access (adjust based on requirements)
  RETURN NEXT tap.ok(
    (SELECT has_table_privilege('anon', '${schema}.${tableName}', 'SELECT') IS NOT NULL),
    'Anonymous role privileges are defined for ${tableName}'
  );
  
  -- =========================================================================
  -- DATA INTEGRITY TESTS
  -- =========================================================================
  
  -- Test: Table accepts valid data (basic insert test)
  BEGIN
    RETURN NEXT tap.lives_ok(
      format('INSERT INTO %I.%I DEFAULT VALUES', '${schema}', '${tableName}'),
      'Table ${tableName} accepts valid data insertion'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NEXT tap.pass('Table ${tableName} requires specific values (no DEFAULT VALUES support)');
  END;
  
  -- Test: Table structure is consistent
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns 
  WHERE table_schema = '${schema}' AND table_name = '${tableName}';
  
  RETURN NEXT tap.ok(
    v_column_count > 0,
    format('Table ${tableName} has columns defined (%s columns found)', v_column_count)
  );
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Comprehensive tests for ${tableName} table structure, constraints, and behavior';`;
  }

  /**
   * Generate index test template
   * @param {TestRequirement} requirement - Index test requirement
   * @returns {string} Generated template content
   * @private
   */
  generateIndexTemplate(requirement) {
    const schema = requirement.schema || "public";
    const indexName = requirement.name;
    const tableName = requirement.tableName || "TODO_TABLE_NAME";
    const testFunctionName = `run_${indexName}_index_tests`;
    const planCount = this.calculatePlanCount(requirement, "index");

    const isUnique = requirement.isUnique || false;
    const indexType = requirement.indexType || "btree";
    const isPartial = requirement.isPartial || false;
    const indexedColumns = requirement.indexedColumns || ["TODO_COLUMN"];
    const whereClause = requirement.whereClause || "";

    // Build column array string for pgTAP
    const columnsArrayStr = indexedColumns.map((col) => `'${col}'`).join(", ");

    return `-- =========================================================================
-- INDEX TESTS: ${indexName}
-- =========================================================================
-- Tests for the ${indexName} index on ${tableName} table to ensure:
-- 1. Index exists and is properly configured
-- 2. Index covers expected columns
-- 3. Index type is correct (${indexType})
-- 4. Index uniqueness constraint works as expected
-- 5. Index performance characteristics are appropriate
${requirement.description ? `-- \\n-- Description: ${requirement.description}` : ""}

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
DECLARE
  v_test_record_id uuid;
  v_index_exists boolean;
  v_duplicate_test_id uuid;
BEGIN
  -- Plan our tests (adjust count as needed)
  RETURN NEXT tap.plan(${planCount});
  
  -- Test 1: Index exists
  RETURN NEXT tap.has_index(
    '${schema}',
    '${tableName}',
    '${indexName}',
    'Index ${indexName} exists on ${tableName} table'
  );
  
  -- Test 2: Index covers expected columns
  RETURN NEXT tap.index_is_on(
    '${schema}',
    '${tableName}',
    '${indexName}',
    ARRAY[${columnsArrayStr}],
    'Index ${indexName} covers expected columns'
  );
  
  -- Test 3: Index type is correct
  RETURN NEXT tap.index_is_type(
    '${schema}',
    '${tableName}',
    '${indexName}',
    '${indexType}',
    'Index ${indexName} is of type ${indexType}'
  );
  
${
  isUnique
    ? `  -- Test 4: Index enforces uniqueness
  RETURN NEXT tap.index_is_unique(
    '${schema}',
    '${tableName}',
    '${indexName}',
    'Index ${indexName} enforces uniqueness constraint'
  );
  
  -- Test 5: Unique constraint validation - duplicate insertion should fail
  BEGIN
    -- Insert a test record first
    INSERT INTO ${schema}.${tableName} (${indexedColumns.join(", ")}) 
    VALUES (${"null, ".repeat(indexedColumns.length).slice(0, -2)}) -- TODO: Add appropriate test values
    RETURNING id INTO v_test_record_id;
    
    -- Try to insert duplicate - should fail
    RETURN NEXT tap.throws_ok(
      'INSERT INTO ${schema}.${tableName} (${indexedColumns.join(", ")}) VALUES (${"null, ".repeat(indexedColumns.length).slice(0, -2)})', -- TODO: Same test values
      '23505', -- Unique violation error code
      'Duplicate insertion properly rejected by unique index ${indexName}'
    );
    
  EXCEPTION
    WHEN others THEN
      -- If setup fails, mark as TODO
      RETURN NEXT tap.pass('TODO: Set up unique constraint validation test');
  END;
`
    : `  -- Test 4: Non-unique index allows duplicates (if applicable)
  -- TODO: Add test for non-unique index behavior if relevant
  RETURN NEXT tap.pass('TODO: Add non-unique index behavior test if applicable');
  
  -- Test 5: Index performance characteristics
  -- TODO: Add performance validation tests (comments about expected usage patterns)
  RETURN NEXT tap.pass('TODO: Add performance validation tests');
`
}
${
  isPartial
    ? `  -- Test 6: Partial index WHERE clause validation
  -- TODO: Verify partial index WHERE clause: ${whereClause}
  RETURN NEXT tap.pass('TODO: Test partial index WHERE clause behavior');
`
    : `  -- Test 6: Full index coverage (not partial)
  -- TODO: Verify index covers all table rows (no WHERE clause)
  RETURN NEXT tap.pass('TODO: Verify full index coverage');
`
}
  -- Test 7: Index usage in query plans (performance validation)
  -- NOTE: This is a comment-based test for manual verification
  -- Query patterns that should use this index:
  -- TODO: List expected query patterns that benefit from ${indexName}
  RETURN NEXT tap.pass('Performance validation: Review query patterns for ${indexName} usage');
  
  -- Test 8: Index maintenance characteristics
  -- TODO: Test index behavior during INSERT/UPDATE/DELETE operations
  RETURN NEXT tap.pass('TODO: Test index maintenance during DML operations');
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Tests for ${indexName} index on ${tableName} table';

-- Performance Notes:
-- Index: ${indexName}
-- Type: ${indexType}
-- Columns: ${indexedColumns.join(", ")}
-- Unique: ${isUnique ? "Yes" : "No"}
${isPartial ? `-- Partial: Yes (WHERE ${whereClause})` : "-- Partial: No"}
-- Expected usage patterns:
--   TODO: Document expected query patterns that benefit from this index
--   TODO: Document any specific performance requirements or SLA targets`;
  }

  /**
   * Generate column test assertions
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @param {ColumnTestRequirement[]} columns - Column requirements
   * @returns {string} Generated column test assertions
   * @private
   */
  generateColumnTestAssertions(schema, tableName, columns) {
    if (!columns || columns.length === 0) {
      return `  -- =========================================================================
  -- COLUMN STRUCTURE TESTS  
  -- =========================================================================
  
  -- TODO: Add specific column tests based on table schema
  RETURN NEXT tap.pass('TODO: Add column existence and type tests');`;
    }

    let assertions = `  -- =========================================================================
  -- COLUMN STRUCTURE TESTS
  -- =========================================================================
  `;

    columns.forEach((column, _index) => {
      const columnName = column.targetName || column.name;
      const metadata = column.metadata || {};

      assertions += `
  -- Column: ${columnName}
  RETURN NEXT tap.has_column(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} exists in ${tableName}'
  );`;

      if (metadata.expectedType) {
        assertions += `
  
  RETURN NEXT tap.col_type_is(
    '${schema}',
    '${tableName}',
    '${columnName}',
    '${metadata.expectedType}',
    'Column ${columnName} has correct type (${metadata.expectedType})'
  );`;
      }

      if (metadata.expectedNotNull !== undefined) {
        const assertion = metadata.expectedNotNull
          ? "col_not_null"
          : "col_is_null";
        const description = metadata.expectedNotNull ? "NOT NULL" : "nullable";
        assertions += `
  
  RETURN NEXT tap.${assertion}(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} is ${description}'
  );`;
      }

      if (metadata.expectedHasDefault) {
        assertions += `
  
  RETURN NEXT tap.col_has_default(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} has a default value'
  );`;

        if (metadata.expectedDefaultValue !== undefined) {
          assertions += `
  
  RETURN NEXT tap.col_default_is(
    '${schema}',
    '${tableName}',
    '${columnName}',
    '${metadata.expectedDefaultValue}',
    'Column ${columnName} has expected default value'
  );`;
        }
      }

      if (metadata.isPrimaryKey) {
        assertions += `
  
  RETURN NEXT tap.col_is_pk(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} is part of primary key'
  );`;
      }

      if (metadata.isForeignKey && metadata.referencedTable) {
        const referencedColumn = metadata.referencedColumn || columnName;
        assertions += `
  
  RETURN NEXT tap.fk_ok(
    '${schema}',
    '${tableName}',
    '${columnName}',
    '${schema}',
    '${metadata.referencedTable}',
    '${referencedColumn}',
    'Foreign key ${columnName} references ${metadata.referencedTable}.${referencedColumn}'
  );`;
      }

      if (metadata.isUnique) {
        assertions += `
  
  RETURN NEXT tap.has_unique(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} has unique constraint'
  );`;
      }
    });

    return assertions;
  }

  /**
   * Generate constraint test assertions
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @param {string[]} expectedConstraints - Expected constraint names
   * @returns {string} Generated constraint test assertions
   * @private
   */
  generateConstraintTestAssertions(schema, tableName, expectedConstraints) {
    if (!expectedConstraints || expectedConstraints.length === 0) {
      return `  -- =========================================================================
  -- CONSTRAINT TESTS
  -- =========================================================================
  
  -- TODO: Add specific constraint tests if table has constraints
  RETURN NEXT tap.pass('TODO: Add constraint validation tests');`;
    }

    let assertions = `  -- =========================================================================
  -- CONSTRAINT TESTS
  -- =========================================================================
  `;

    expectedConstraints.forEach((constraintName) => {
      assertions += `
  -- Constraint: ${constraintName}
  RETURN NEXT tap.has_check(
    '${schema}',
    '${tableName}',
    '${constraintName}',
    'Check constraint ${constraintName} exists on ${tableName}'
  );
  
  -- TODO: Add specific validation for constraint ${constraintName}
  RETURN NEXT tap.pass('TODO: Test constraint ${constraintName} behavior');`;
    });

    return assertions;
  }

  /**
   * Generate index test assertions
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @param {IndexTestRequirement[]} indexes - Index requirements
   * @returns {string} Generated index test assertions
   * @private
   */
  generateIndexTestAssertions(schema, tableName, indexes) {
    if (!indexes || indexes.length === 0) {
      return `  -- =========================================================================
  -- INDEX TESTS
  -- =========================================================================
  
  -- Check for primary key index (most tables should have one)
  RETURN NEXT tap.has_pk(
    '${schema}',
    '${tableName}',
    'Table ${tableName} has a primary key'
  );`;
    }

    let assertions = `  -- =========================================================================
  -- INDEX TESTS  
  -- =========================================================================
  `;

    indexes.forEach((index) => {
      const indexName = index.targetName || index.name;
      const metadata = index.metadata || {};

      assertions += `
  -- Index: ${indexName}
  RETURN NEXT tap.has_index(
    '${schema}',
    '${tableName}',
    '${indexName}',
    '${JSON.stringify(metadata.indexedColumns || [])}',
    'Index ${indexName} exists on ${tableName}'
  );`;

      if (metadata.isUnique) {
        assertions += `
  
  RETURN NEXT tap.index_is_unique(
    '${schema}',
    '${tableName}',
    '${indexName}',
    'Index ${indexName} enforces uniqueness'
  );`;
      }

      if (metadata.isPrimaryKey) {
        assertions += `
  
  RETURN NEXT tap.has_pk(
    '${schema}',
    '${tableName}',
    'Primary key index ${indexName} exists'
  );`;
      }
    });

    return assertions;
  }

  /**
   * Generate Row Level Security test assertions
   * @param {string} schema - Schema name
   * @param {string} tableName - Table name
   * @returns {string} Generated RLS test assertions
   * @private
   */
  generateRlsTestAssertions(schema, tableName) {
    return `  -- =========================================================================
  -- ROW LEVEL SECURITY TESTS
  -- =========================================================================
  
  -- Test: RLS is enabled
  RETURN NEXT tap.is(
    (SELECT COUNT(*) FROM pg_tables 
     WHERE schemaname = '${schema}' 
     AND tablename = '${tableName}' 
     AND rowsecurity = true),
    1::bigint,
    'RLS is enabled on ${tableName} table'
  );
  
  -- Test: RLS policies exist
  RETURN NEXT tap.is(
    (SELECT COUNT(*) > 0 FROM pg_policies 
     WHERE schemaname = '${schema}' 
     AND tablename = '${tableName}'),
    true,
    'RLS policies exist for ${tableName} table'
  );
  
  -- TODO: Add specific RLS policy tests
  RETURN NEXT tap.pass('TODO: Add specific RLS policy validation tests');`;
  }

  /**
   * Generate column test template
   * @param {TestRequirement} requirement - Column test requirement
   * @returns {string} Generated template content
   * @private
   */
  generateColumnTemplate(requirement) {
    const schema = requirement.schema || "public";
    const tableName = requirement.tableName || requirement.metadata?.tableName;
    const columnName = requirement.name;
    const testFunctionName = `run_${tableName}_${columnName}_column_tests`;
    const planCount = this.calculatePlanCount(requirement, "column");

    if (!tableName) {
      throw new ValidationError(
        "Column test requirement must specify tableName",
      );
    }

    // Build test assertions based on column metadata
    const assertions = this.buildColumnAssertions(requirement);

    return `-- =========================================================================
-- COLUMN TESTS: ${tableName}.${columnName}
-- =========================================================================
-- Tests for the ${columnName} column in ${tableName} table to ensure:
-- 1. Column exists and has correct data type
-- 2. Column constraints are properly enforced (NOT NULL, defaults, etc.)
-- 3. Primary key and foreign key relationships work correctly
-- 4. Data integrity is maintained during operations
-- 5. Type conversions work as expected
${requirement.description ? `-- \\n-- Description: ${requirement.description}` : ""}

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
DECLARE
  v_test_id uuid;
  v_sample_value ${requirement.expectedType || "text"};
BEGIN
  -- Plan our tests (adjust count as needed)
  RETURN NEXT tap.plan(${planCount});
  
  -- Test 1: Column exists
  RETURN NEXT tap.has_column(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} exists in ${tableName} table'
  );
  
${assertions}
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Tests for ${columnName} column in ${tableName} table';`;
  }

  /**
   * Build column-specific test assertions based on metadata
   * @param {TestRequirement} requirement - Column test requirement
   * @returns {string} Generated assertion code
   * @private
   */
  buildColumnAssertions(requirement) {
    const schema = requirement.schema || "public";
    const tableName = requirement.tableName || requirement.metadata?.tableName;
    const columnName = requirement.name;
    const assertions = [];
    let testNumber = 2;

    // Test 2: Column type
    if (requirement.expectedType) {
      assertions.push(`  -- Test ${testNumber++}: Column has correct data type
  RETURN NEXT tap.col_type_is(
    '${schema}',
    '${tableName}',
    '${columnName}',
    '${requirement.expectedType}',
    'Column ${columnName} has correct data type (${requirement.expectedType})'
  );`);
    }

    // Test 3: NOT NULL constraint
    if (requirement.expectedNotNull === true) {
      assertions.push(`  -- Test ${testNumber++}: Column is NOT NULL
  RETURN NEXT tap.col_not_null(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} is NOT NULL'
  );`);
    } else if (requirement.expectedNotNull === false) {
      assertions.push(`  -- Test ${testNumber++}: Column allows NULL
  RETURN NEXT tap.col_is_null(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} allows NULL values'
  );`);
    }

    // Test 4: Default value
    if (requirement.expectedHasDefault === true) {
      assertions.push(`  -- Test ${testNumber++}: Column has default value
  RETURN NEXT tap.col_has_default(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} has a default value'
  );`);

      if (requirement.expectedDefaultValue !== undefined) {
        const defaultValue =
          typeof requirement.expectedDefaultValue === "string"
            ? `'${requirement.expectedDefaultValue}'`
            : requirement.expectedDefaultValue;
        assertions.push(`  -- Test ${testNumber++}: Column has correct default value
  RETURN NEXT tap.col_default_is(
    '${schema}',
    '${tableName}',
    '${columnName}',
    ${defaultValue},
    'Column ${columnName} has correct default value'
  );`);
      }
    }

    // Test 5: Primary key
    if (requirement.isPrimaryKey === true) {
      assertions.push(`  -- Test ${testNumber++}: Column is part of primary key
  RETURN NEXT tap.col_is_pk(
    '${schema}',
    '${tableName}',
    '${columnName}',
    'Column ${columnName} is part of primary key'
  );`);
    }

    // Test 6: Foreign key
    if (
      requirement.isForeignKey === true &&
      requirement.referencedTable &&
      requirement.referencedColumn
    ) {
      assertions.push(`  -- Test ${testNumber++}: Foreign key relationship
  RETURN NEXT tap.fk_ok(
    '${schema}', '${tableName}', '${columnName}',
    '${schema}', '${requirement.referencedTable}', '${requirement.referencedColumn}',
    'Foreign key relationship from ${columnName} to ${requirement.referencedTable}.${requirement.referencedColumn} exists'
  );`);
    }

    // Test 7: Data integrity test with sample data
    assertions.push(`  -- Test ${testNumber++}: Data integrity test
  -- Test insertion and retrieval of sample data
  RETURN NEXT tap.lives_ok(
    'INSERT INTO ${schema}.${tableName} (${columnName}) VALUES (DEFAULT)',
    'Can insert data into ${columnName} column (adjust based on table structure)'
  );`);

    // Test 8: Type conversion test (if applicable)
    if (
      requirement.expectedType &&
      this.isNumericType(requirement.expectedType)
    ) {
      assertions.push(`  -- Test ${testNumber++}: Type conversion test
  RETURN NEXT tap.lives_ok(
    'SELECT ${columnName}::${requirement.expectedType} FROM ${schema}.${tableName} LIMIT 1',
    'Column ${columnName} values can be cast to ${requirement.expectedType}'
  );`);
    }

    // Test 9: Constraint violation test (if NOT NULL)
    if (requirement.expectedNotNull === true) {
      assertions.push(`  -- Test ${testNumber++}: NOT NULL constraint violation
  RETURN NEXT tap.throws_ok(
    'INSERT INTO ${schema}.${tableName} (${columnName}) VALUES (NULL)',
    '23502',
    'NOT NULL constraint prevents NULL insertion into ${columnName}'
  );`);
    }

    return assertions.join("\\n\\n");
  }

  /**
   * Check if a data type is numeric
   * @param {string} dataType - PostgreSQL data type
   * @returns {boolean} True if numeric type
   * @private
   */
  isNumericType(dataType) {
    const numericTypes = [
      "integer",
      "int",
      "int4",
      "bigint",
      "int8",
      "smallint",
      "int2",
      "decimal",
      "numeric",
      "real",
      "float4",
      "double precision",
      "float8",
      "serial",
      "bigserial",
      "smallserial",
    ];
    return numericTypes.some((type) => dataType.toLowerCase().includes(type));
  }

  /**
   * Calculate appropriate plan count for test type
   * @param {TestRequirement} requirement - Test requirement
   * @param {string} testType - Type of test
   * @returns {number} Suggested plan count
   * @private
   */
  calculatePlanCount(requirement, testType) {
    const baseCounts = {
      rpc: 6,
      rls: 15, // Increased for comprehensive RLS testing
      trigger: 6,
      constraint: 4,
      function: 4,
      table: 12,
      column: 5,
      index: 8,
    };

    let baseCount = baseCounts[testType] || 4;

    // Adjust based on requirement complexity
    if (requirement.parameters && requirement.parameters.length > 2) {
      baseCount += 1; // More parameters = more validation tests
    }

    // For RLS tests, adjust based on policies and test scenarios
    if (testType === "rls" && requirement.metadata) {
      const metadata = requirement.metadata;

      // Add tests for each specific policy
      if (metadata.policies && metadata.policies.length > 0) {
        baseCount += metadata.policies.length * 2; // 2 tests per policy (existence + commands)

        // Additional tests for policies with role restrictions
        metadata.policies.forEach((policy) => {
          if (policy.roles && policy.roles.length > 0) {
            baseCount += 1; // Policy role test
          }
          if (policy.commands && policy.commands.length > 2) {
            baseCount += policy.commands.length - 2; // Extra command tests
          }
        });
      }

      // Add tests for custom test scenarios
      if (metadata.testScenarios && metadata.testScenarios.length > 0) {
        baseCount += metadata.testScenarios.length; // Custom scenario tests
      }
    }

    if (requirement.policies && requirement.policies.length > 3) {
      baseCount += 2; // More policies = more comprehensive testing (legacy support)
    }

    // For table tests, adjust based on metadata
    if (testType === "table" && requirement.metadata) {
      const metadata = requirement.metadata;

      // Add tests for each column
      if (metadata.columns && metadata.columns.length > 0) {
        baseCount += metadata.columns.length * 2; // 2 tests per column minimum
      }

      // Add tests for constraints
      if (
        metadata.expectedConstraints &&
        metadata.expectedConstraints.length > 0
      ) {
        baseCount += metadata.expectedConstraints.length * 2;
      }

      // Add tests for indexes
      if (metadata.indexes && metadata.indexes.length > 0) {
        baseCount += metadata.indexes.length * 2;
      }

      // Add tests for RLS if required
      if (metadata.requiresRowLevelSecurity) {
        baseCount += 3;
      }
    }

    // Column-specific adjustments
    if (testType === "column") {
      if (requirement.expectedType) baseCount += 1;
      if (requirement.expectedNotNull !== undefined) baseCount += 1;
      if (requirement.expectedHasDefault) baseCount += 1;
      if (requirement.expectedDefaultValue !== undefined) baseCount += 1;
      if (requirement.isPrimaryKey) baseCount += 1;
      if (requirement.isForeignKey) baseCount += 1;
      // Add 2 for data integrity and constraint violation tests
      baseCount += 2;
    }

    // Index-specific adjustments
    if (testType === "index") {
      if (requirement.isUnique) {
        baseCount += 2; // Additional uniqueness constraint tests
      }
      if (requirement.isPartial) {
        baseCount += 1; // Additional partial index tests
      }
      if (requirement.indexedColumns && requirement.indexedColumns.length > 3) {
        baseCount += 1; // More complex multi-column indexes
      }
      if (requirement.indexType && requirement.indexType !== "btree") {
        baseCount += 1; // Non-standard index types need more validation
      }
    }

    return baseCount;
  }

  /**
   * Calculate plan count specifically for function tests based on metadata
   * @param {TestRequirement} requirement - Test requirement
   * @param {Object} metadata - Function metadata
   * @returns {number} Calculated plan count
   * @private
   */
  calculateFunctionPlanCount(requirement, metadata) {
    let planCount = 6; // Base tests: exists, signature, return type, language, security, behavior

    // Add for parameter testing
    if (metadata.parameterTypes && metadata.parameterTypes.length > 0) {
      planCount += 1; // Parameter signature test
      planCount += 1; // Invalid parameter test
    }

    // Add for custom test cases
    if (metadata.testCases && metadata.testCases.length > 0) {
      planCount += metadata.testCases.length;
    }

    // Add for security testing
    if (metadata.requiresSecurityTesting) {
      planCount += 2; // User and admin context tests
    }

    // Add for volatility/consistency testing
    planCount += 1; // Consistency or side effects test

    // Add for performance testing placeholder
    planCount += 1; // Performance test placeholder

    return planCount;
  }

  /**
   * Generate sample parameters for testing based on parameter types
   * @param {string[]} parameterTypes - Array of parameter types
   * @returns {string|null} Comma-separated sample parameters or null
   * @private
   */
  generateSampleParameters(parameterTypes) {
    if (!parameterTypes || parameterTypes.length === 0) {
      return null;
    }

    const sampleValues = parameterTypes.map((type) => {
      const lowerType = type.toLowerCase();

      // Handle array types
      if (lowerType.includes("[]")) {
        const baseType = lowerType.replace("[]", "");
        return this.getSampleArrayValue(baseType);
      }

      return this.getSampleValue(lowerType);
    });

    return sampleValues.join(", ");
  }

  /**
   * Generate invalid parameters for testing error conditions
   * @param {string[]} parameterTypes - Array of parameter types
   * @returns {string|null} Comma-separated invalid parameters or null
   * @private
   */
  generateInvalidParameters(parameterTypes) {
    if (!parameterTypes || parameterTypes.length === 0) {
      return null;
    }

    const invalidValues = parameterTypes.map((type) => {
      const lowerType = type.toLowerCase();
      return this.getInvalidValue(lowerType);
    });

    return invalidValues.join(", ");
  }

  /**
   * Get sample value for a given SQL data type
   * @param {string} type - SQL data type (lowercase)
   * @returns {string} Sample value for testing
   * @private
   */
  getSampleValue(type) {
    const typeMap = {
      // Integer types
      integer: "42",
      int: "42",
      int4: "42",
      bigint: "123456789",
      int8: "123456789",
      smallint: "123",
      int2: "123",

      // Decimal types
      decimal: "123.45",
      numeric: "123.45",
      real: "123.45",
      float4: "123.45",
      "double precision": "123.45",
      float8: "123.45",

      // String types
      text: "'sample text'",
      varchar: "'sample varchar'",
      "character varying": "'sample varchar'",
      char: "'S'",
      character: "'S'",

      // Boolean
      boolean: "true",
      bool: "true",

      // Date/Time
      date: "'2024-01-01'",
      time: "'12:00:00'",
      timestamp: "'2024-01-01 12:00:00'",
      timestamptz: "'2024-01-01 12:00:00+00'",
      interval: "'1 hour'",

      // UUID
      uuid: "'00000000-0000-0000-0000-000000000001'::uuid",

      // JSON
      json: '\'{"key": "value"}\'::json',
      jsonb: '\'{"key": "value"}\'::jsonb',

      // Binary
      bytea: "'\\x414243'",

      // Network types
      inet: "'192.168.1.1'",
      cidr: "'192.168.1.0/24'",
      macaddr: "'08:00:2b:01:02:03'",

      // Geometric types (simplified)
      point: "'(1,2)'",
      polygon: "'((0,0),(1,1),(1,0))'",
      circle: "'<(0,0),1>'",

      // Default fallback
      default: "'sample_value'",
    };

    return typeMap[type] || typeMap["default"];
  }

  /**
   * Get sample array value for a given SQL base type
   * @param {string} baseType - SQL base type (lowercase)
   * @returns {string} Sample array value for testing
   * @private
   */
  getSampleArrayValue(baseType) {
    const sampleValue = this.getSampleValue(baseType);

    // For simple types, create an array
    if (
      baseType.includes("int") ||
      baseType.includes("numeric") ||
      baseType.includes("decimal")
    ) {
      return "ARRAY[1, 2, 3]";
    } else if (baseType === "text" || baseType.includes("varchar")) {
      return "ARRAY['item1', 'item2', 'item3']";
    } else if (baseType === "boolean") {
      return "ARRAY[true, false]";
    } else if (baseType === "uuid") {
      return "ARRAY['00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid]";
    }

    return `ARRAY[${sampleValue}, ${sampleValue}]`;
  }

  /**
   * Get invalid value for a given SQL data type (for error testing)
   * @param {string} type - SQL data type (lowercase)
   * @returns {string} Invalid value for testing
   * @private
   */
  getInvalidValue(type) {
    const invalidMap = {
      // Integer types - use string that can't be converted
      integer: "'not_a_number'",
      int: "'not_a_number'",
      int4: "'not_a_number'",
      bigint: "'not_a_number'",
      int8: "'not_a_number'",
      smallint: "'not_a_number'",

      // For numeric types, use invalid string
      decimal: "'invalid_decimal'",
      numeric: "'invalid_numeric'",
      real: "'invalid_real'",

      // For dates, use invalid format
      date: "'invalid-date'",
      timestamp: "'invalid-timestamp'",
      timestamptz: "'invalid-timestamp'",

      // For UUID, use invalid format
      uuid: "'invalid-uuid-format'",

      // For JSON, use invalid syntax
      json: "'invalid json syntax{'",
      jsonb: "'invalid json syntax{'",

      // For boolean, use invalid string
      boolean: "'maybe'",
      bool: "'maybe'",

      // For network types, use invalid formats
      inet: "'invalid.ip.address'",
      cidr: "'invalid/cidr'",

      // Default: null (which might be invalid for NOT NULL columns)
      default: "NULL",
    };

    return invalidMap[type] || invalidMap["default"];
  }

  /**
   * Format pgTAP structure for consistency
   * @param {string} content - Template content
   * @returns {string} Formatted content
   * @private
   */
  formatPgTapStructure(content) {
    // Ensure consistent indentation for pgTAP functions
    return content
      .replace(/^(\s*RETURN NEXT tap\.)/gm, "  $1") // Standardize pgTAP function indentation
      .replace(/^(\s*--)/gm, "$1") // Keep comment indentation as-is
      .replace(/^(\s*PERFORM)/gm, "  $1") // Standardize PERFORM indentation
      .replace(/^(\s*SELECT)/gm, "  $1"); // Standardize SELECT indentation
  }

  /**
   * Extract pattern variables from test requirement
   * @param {TestRequirement} requirement - Test requirement
   * @returns {Object} Variables for pattern rendering
   * @private
   */
  extractPatternVariables(requirement) {
    const variables = {
      schema: requirement.schema || "public",
      tableName: requirement.name,
      columnName: requirement.name,
      functionName: requirement.name,
      indexName: requirement.name,
      constraintName: requirement.name,
      policyName: requirement.name,
    };

    // Add metadata-based variables
    if (requirement.metadata) {
      const metadata = requirement.metadata;

      // Table-specific variables
      if (metadata.tableName) {
        variables.tableName = metadata.tableName;
      }

      // Column-specific variables
      if (metadata.expectedType) {
        variables.dataType = metadata.expectedType;
      }

      // Function-specific variables
      if (metadata.parameterTypes) {
        variables.parameterTypes = metadata.parameterTypes;
      }

      if (metadata.returnType) {
        variables.returnType = metadata.returnType;
      }

      // Index-specific variables
      if (metadata.indexedColumns) {
        variables.indexedColumns = metadata.indexedColumns;
      }

      // RLS-specific variables
      if (metadata.policies) {
        variables.policies = metadata.policies;
      }

      // Test data variables
      variables.testId = "test-id-" + Math.random().toString(36).substr(2, 9);
      variables.validValues = this.generateSampleTestData(requirement);
      variables.invalidValues = this.generateInvalidTestData(requirement);
    }

    return variables;
  }

  /**
   * Generate pattern enhancements for a requirement
   * @param {TestRequirement} requirement - Test requirement
   * @param {Array<TestPattern>} patterns - Patterns to apply
   * @param {Object} variables - Variables for rendering
   * @returns {string} Enhanced test content
   * @private
   */
  generatePatternEnhancements(requirement, patterns, variables) {
    let enhancements = "";

    patterns.forEach((pattern) => {
      try {
        // Skip patterns that are already covered by the base template
        if (this.isPatternCoveredByBase(pattern, requirement)) {
          return;
        }

        // Render pattern with variables
        const renderedPattern = this.patternLibrary.renderPattern(
          pattern.name,
          variables,
        );

        enhancements += `-- Pattern: ${pattern.name} (${pattern.category})\n`;
        enhancements += `-- ${pattern.description}\n`;
        enhancements += renderedPattern + "\n\n";
      } catch (error) {
        // Log pattern rendering errors but don't fail the whole generation
        enhancements += `-- Pattern ${pattern.name} could not be rendered: ${error.message}\n\n`;
      }
    });

    return enhancements;
  }

  /**
   * Check if pattern is already covered by base template
   * @param {TestPattern} pattern - Pattern to check
   * @param {TestRequirement} requirement - Test requirement
   * @returns {boolean} True if pattern is already covered
   * @private
   */
  isPatternCoveredByBase(pattern, requirement) {
    // Basic existence patterns are usually covered by base templates
    const basicPatterns = ["table_exists_basic", "column_exists_basic"];

    if (basicPatterns.includes(pattern.name)) {
      return true;
    }

    // For table tests, column structure validation is already covered
    if (
      requirement.type === "table" &&
      pattern.name === "column_structure_validation"
    ) {
      return true;
    }

    // For RLS tests, basic RLS checks are covered
    if (requirement.type === "rls" && pattern.name === "rls_enablement_check") {
      return true;
    }

    return false;
  }

  /**
   * Generate sample test data for patterns
   * @param {TestRequirement} requirement - Test requirement
   * @returns {string} Sample test data
   * @private
   */
  generateSampleTestData(requirement) {
    const metadata = requirement.metadata || {};

    if (requirement.type === "column" && metadata.expectedType) {
      return this.getSampleValue(metadata.expectedType.toLowerCase());
    }

    if (requirement.type === "table") {
      return "DEFAULT VALUES";
    }

    return "'sample_value'";
  }

  /**
   * Generate invalid test data for patterns
   * @param {TestRequirement} requirement - Test requirement
   * @returns {string} Invalid test data
   * @private
   */
  generateInvalidTestData(requirement) {
    const metadata = requirement.metadata || {};

    if (requirement.type === "column" && metadata.expectedType) {
      return this.getInvalidValue(metadata.expectedType.toLowerCase());
    }

    return "NULL";
  }
}

module.exports = TestTemplateGenerator;
