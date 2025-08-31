/**
 * Test Generate Command
 * 
 * Generate pgTAP test templates for RPC functions and RLS policies.
 * Creates properly structured test files in the correct directories.
 */

const fs = require('fs').promises;
const path = require('path');
const TestCommand = require('../../lib/TestCommand');

/**
 * Generate pgTAP test templates for RPC functions and RLS policies
 */
class GenerateCommand extends TestCommand {
  constructor(
    testsDir,
    outputDir,
    logger = null,
    isProd = false
  ) {
    super(null, null, testsDir, outputDir, logger, isProd);
    
    // Test generation doesn't require database access
    this.requiresProductionConfirmation = false;
  }

  /**
   * Execute test template generation
   * @param {Object} options - Generation options
   * @param {string} options.type - Test type ('rpc' or 'rls')
   * @param {string} options.name - Function or table name
   * @returns {Promise<Object>} Generation result
   */
  async performExecute(options = {}) {
    this.emit('generation:start', { type: options.type, name: options.name });
    
    try {
      // Validate options
      this.validateGenerationOptions(options);
      
      // Determine template type and generate
      let result;
      if (options.type === 'rpc') {
        result = await this.generateRpcTest(options.name);
      } else if (options.type === 'rls') {
        result = await this.generateRlsTest(options.name);
      } else {
        throw new Error(`Unsupported test type: ${options.type}`);
      }
      
      this.success(`Test template generated: ${result.outputFile}`);
      this.emit('generation:complete', result);
      
      return result;
      
    } catch (error) {
      this.error('Test template generation failed', error);
      this.emit('generation:failed', { error, type: options.type, name: options.name });
      throw error;
    }
  }

  /**
   * Validate generation options
   * @param {Object} options - Options to validate
   */
  validateGenerationOptions(options) {
    if (!options.type) {
      throw new Error('Test type is required. Use --rpc or --rls');
    }
    
    if (!options.name) {
      throw new Error('Function or table name is required');
    }
    
    if (!['rpc', 'rls'].includes(options.type)) {
      throw new Error('Test type must be either "rpc" or "rls"');
    }
    
    // Validate name format
    if (!/^[a-zA-Z0-9_]+$/.test(options.name)) {
      throw new Error('Name must contain only letters, numbers, and underscores');
    }
  }

  /**
   * Generate RPC function test template
   * @param {string} functionName - Name of the RPC function
   * @returns {Promise<Object>} Generation result
   */
  async generateRpcTest(functionName) {
    const testDir = await this.getTestsDir();
    const rpcTestDir = path.join(testDir, '002_rpc_tests');
    const outputFile = path.join(rpcTestDir, `${functionName}.test.sql`);
    
    // Ensure RPC test directory exists
    await fs.mkdir(rpcTestDir, { recursive: true });
    
    // Generate template content
    const template = this.generateRpcTemplate(functionName);
    
    // Write template file
    await fs.writeFile(outputFile, template, 'utf8');
    
    this.progress(`Generated RPC test template: ${outputFile}`);
    
    return {
      type: 'rpc',
      functionName,
      outputFile,
      directory: rpcTestDir,
      template
    };
  }

  /**
   * Generate RLS policy test template
   * @param {string} tableName - Name of the table to test RLS policies for
   * @returns {Promise<Object>} Generation result
   */
  async generateRlsTest(tableName) {
    const testDir = await this.getTestsDir();
    const rlsTestDir = path.join(testDir, '003_rls_tests');
    const outputFile = path.join(rlsTestDir, `${tableName}.test.sql`);
    
    // Ensure RLS test directory exists
    await fs.mkdir(rlsTestDir, { recursive: true });
    
    // Generate template content
    const template = this.generateRlsTemplate(tableName);
    
    // Write template file
    await fs.writeFile(outputFile, template, 'utf8');
    
    this.progress(`Generated RLS test template: ${outputFile}`);
    
    return {
      type: 'rls',
      tableName,
      outputFile,
      directory: rlsTestDir,
      template
    };
  }

  /**
   * Generate RPC function test template content
   * @param {string} functionName - Name of the function
   * @returns {string} Template content
   */
  generateRpcTemplate(functionName) {
    const testFunctionName = `run_${functionName}_tests`;
    
    return `-- =========================================================================
-- RPC FUNCTION TESTS: ${functionName}
-- =========================================================================
-- Tests for the ${functionName} function to ensure:
-- 1. Function exists and has correct signature
-- 2. Function handles valid inputs correctly
-- 3. Function validates invalid inputs properly
-- 4. Function respects security and authorization
-- 5. Function returns expected data structure

CREATE OR REPLACE FUNCTION test.${testFunctionName}()
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test, public, security
AS $$
DECLARE
  v_admin_id uuid;
  v_user_id uuid;
  v_result jsonb;
  v_test_data record;
BEGIN
  -- Plan our tests (adjust count as needed)
  RETURN NEXT tap.plan(6);
  
  -- Setup: Create test users if needed
  v_admin_id := test.create_test_admin();
  v_user_id := test.create_test_user();
  
  -- Test 1: Function exists
  RETURN NEXT tap.has_function(
    'public',
    '${functionName}',
    'Function ${functionName} exists'
  );
  
  -- Test 2: Function returns expected data type
  -- TODO: Adjust the expected return type based on your function
  RETURN NEXT tap.has_function(
    'public', 
    '${functionName}',
    ARRAY[]::text[],  -- TODO: Add parameter types if function has parameters
    'Function ${functionName} has correct signature'
  );
  
  -- Test 3: Function works with valid input
  -- TODO: Set appropriate auth context if needed
  PERFORM test.set_auth_context(v_user_id);
  
  RETURN NEXT tap.lives_ok(
    'SELECT ${functionName}()',  -- TODO: Add parameters if needed
    'Function ${functionName} executes successfully with valid input'
  );
  
  -- Test 4: Function returns expected structure
  -- TODO: Implement test for expected return values
  SELECT ${functionName}() INTO v_result;  -- TODO: Add parameters if needed
  
  RETURN NEXT tap.ok(
    v_result IS NOT NULL,
    'Function ${functionName} returns non-null result'
  );
  
  -- Test 5: Function handles invalid input appropriately
  -- TODO: Add test for invalid input validation
  -- RETURN NEXT tap.throws_ok(
  --   'SELECT ${functionName}(invalid_param)',
  --   'error_code',
  --   'Expected error message',
  --   'Function ${functionName} validates invalid input'
  -- );
  RETURN NEXT tap.pass('TODO: Add invalid input validation test');
  
  -- Test 6: Function respects authorization/security
  -- TODO: Test unauthorized access if applicable
  -- PERFORM test.set_auth_context(NULL);
  -- RETURN NEXT tap.throws_ok(
  --   'SELECT ${functionName}()',
  --   'ADMIN',
  --   'Access denied',
  --   'Function ${functionName} requires proper authorization'
  -- );
  RETURN NEXT tap.pass('TODO: Add authorization test');
  
  -- Additional custom tests can be added here
  -- TODO: Add function-specific test logic
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Tests for ${functionName} RPC function';
`;
  }

  /**
   * Generate RLS policy test template content
   * @param {string} tableName - Name of the table
   * @returns {string} Template content
   */
  generateRlsTemplate(tableName) {
    const testFunctionName = `run_${tableName}_rls_tests`;
    
    return `-- =========================================================================
-- RLS POLICY TESTS: ${tableName}
-- =========================================================================
-- Tests for Row Level Security policies on ${tableName} table to ensure:
-- 1. RLS is enabled on the table
-- 2. Anonymous users have appropriate access
-- 3. Authenticated users can access their own data
-- 4. Users cannot access other users' data
-- 5. Admin users have appropriate elevated access
-- 6. Service role bypasses RLS when needed

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
  v_test_record_id uuid;
  v_user1_record_id uuid;
  v_user2_record_id uuid;
BEGIN
  -- Plan our tests (adjust count as needed)
  RETURN NEXT tap.plan(8);
  
  -- Setup: Create test users
  v_admin_id := test.create_test_admin();
  v_user1_id := test.create_test_user();
  v_user2_id := '00000000-0000-0000-0000-000000000003'::uuid;
  
  -- Test 1: RLS is enabled on table
  RETURN NEXT tap.is(
    (SELECT COUNT(*) FROM pg_tables 
     WHERE schemaname = 'public' 
     AND tablename = '${tableName}' 
     AND rowsecurity = true),
    1::bigint,
    'RLS is enabled on ${tableName} table'
  );
  
  -- Test 2: Check if RLS policies exist
  RETURN NEXT tap.is(
    (SELECT COUNT(*) > 0 FROM pg_policies 
     WHERE schemaname = 'public' 
     AND tablename = '${tableName}'),
    true,
    'RLS policies exist for ${tableName} table'
  );
  
  -- TODO: Create test data records
  -- Setup test records for different scenarios
  -- Example:
  -- PERFORM test.set_auth_context(v_user1_id);
  -- INSERT INTO public.${tableName} (...) VALUES (...) RETURNING id INTO v_user1_record_id;
  
  -- Test 3: Anonymous users access (adjust based on your requirements)
  PERFORM test.set_auth_context(NULL);
  
  -- TODO: Adjust this test based on whether anonymous users should have access
  RETURN NEXT tap.lives_ok(
    'SELECT COUNT(*) FROM public.${tableName}',
    'Anonymous users can query ${tableName} table'
  );
  
  -- Alternative if anonymous users should NOT have access:
  -- RETURN NEXT tap.throws_ok(
  --   'SELECT * FROM public.${tableName}',
  --   '42501',  -- insufficient_privilege
  --   NULL,
  --   'Anonymous users cannot access ${tableName} table'
  -- );
  
  -- Test 4: User can see their own records
  -- TODO: Implement user-specific data access test
  PERFORM test.set_auth_context(v_user1_id);
  
  RETURN NEXT tap.pass('TODO: Test user can see their own records in ${tableName}');
  -- Example implementation:
  -- RETURN NEXT tap.is(
  --   (SELECT COUNT(*) FROM public.${tableName} WHERE user_id = v_user1_id),
  --   1::bigint,
  --   'User can see their own records in ${tableName}'
  -- );
  
  -- Test 5: User cannot see other users' records
  -- TODO: Implement cross-user access restriction test
  RETURN NEXT tap.pass('TODO: Test user cannot see other users records in ${tableName}');
  -- Example implementation:
  -- RETURN NEXT tap.is(
  --   (SELECT COUNT(*) FROM public.${tableName} WHERE user_id = v_user2_id),
  --   0::bigint,
  --   'User cannot see other users records in ${tableName}'
  -- );
  
  -- Test 6: Admin user access (if applicable)
  PERFORM test.set_auth_context(v_admin_id);
  
  -- TODO: Adjust based on whether admins should have elevated access
  RETURN NEXT tap.pass('TODO: Test admin access to ${tableName}');
  -- Example implementation:
  -- RETURN NEXT tap.lives_ok(
  --   'SELECT * FROM public.${tableName}',
  --   'Admin can access all records in ${tableName}'
  -- );
  
  -- Test 7: Service role bypasses RLS
  SET ROLE service_role;
  
  RETURN NEXT tap.lives_ok(
    'SELECT COUNT(*) FROM public.${tableName}',
    'Service role can access ${tableName} (RLS bypass)'
  );
  
  RESET ROLE;
  
  -- Test 8: INSERT/UPDATE/DELETE permissions (adjust as needed)
  PERFORM test.set_auth_context(v_user1_id);
  
  -- TODO: Test write permissions
  RETURN NEXT tap.pass('TODO: Test write permissions for ${tableName}');
  -- Example implementation:
  -- RETURN NEXT tap.lives_ok(
  --   format('INSERT INTO public.${tableName} (...) VALUES (...)'),
  --   'User can insert into ${tableName}'
  -- );
  
  -- Additional custom tests can be added here
  -- TODO: Add table-specific RLS test logic
  
  -- Cleanup is handled by the master test runner
  RETURN NEXT tap.finish();
END;
$$;

GRANT EXECUTE ON FUNCTION test.${testFunctionName}() TO postgres, service_role;

COMMENT ON FUNCTION test.${testFunctionName}() IS 'Tests for Row Level Security policies on ${tableName} table';
`;
  }

  /**
   * List available RPC functions from the database schema
   * @returns {Promise<string[]>} List of RPC function names
   */
  async listAvailableRpcFunctions() {
    // This would require database access to query pg_proc
    // For now, return common functions based on existing patterns
    return [
      'get_random_pets',
      'get_pet_details', 
      'search_adoptable_pets',
      'is_admin',
      'is_bootstrap_mode',
      'complete_bootstrap',
      'is_maintenance_mode',
      'record_donation_payment',
      'update_donation_totals'
    ];
  }

  /**
   * List available tables for RLS testing
   * @returns {Promise<string[]>} List of table names
   */
  async listAvailableTables() {
    // Common tables from the schema
    return [
      'pets',
      'applications',
      'donations',
      'profiles',
      'admin_members'
    ];
  }
}

module.exports = GenerateCommand;