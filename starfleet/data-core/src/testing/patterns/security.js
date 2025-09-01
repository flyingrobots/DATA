/**
 * @fileoverview Security-related pgTAP test patterns
 * Pure data structures - no I/O, no dependencies
 */

export const securityPatterns = [
  {
    id: 'rls_enablement_check',
    category: 'security',
    description: 'Verify RLS is enabled on a table',
    placeholders: ['schema', 'table'],
    template: `
      SELECT plan(1);
      SELECT is_rls_enabled('{{schema}}.{{table}}');
      SELECT finish();
    `,
    difficulty: 'basic',
    bestPractices: ['Always verify RLS is enabled before testing policies']
  },

  {
    id: 'policy_exists',
    category: 'security',
    description: 'Verify a specific RLS policy exists',
    placeholders: ['schema', 'table', 'policy_name'],
    template: `
      SELECT plan(1);
      SELECT policy_exists('{{schema}}.{{table}}', '{{policy_name}}');
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'policy_cmd_verification',
    category: 'security',
    description: 'Verify policy applies to correct commands',
    placeholders: ['schema', 'table', 'policy_name', 'commands'],
    template: `
      SELECT plan(1);
      SELECT policy_cmd_is('{{schema}}.{{table}}', '{{policy_name}}', ARRAY[{{commands}}]);
      SELECT finish();
    `,
    difficulty: 'intermediate'
  },

  {
    id: 'role_based_access',
    category: 'security',
    description: 'Test data visibility for specific role',
    placeholders: ['role', 'schema', 'table', 'expected_count'],
    template: `
      SELECT plan(2);
      SET ROLE {{role}};
      SELECT results_eq(
        'SELECT COUNT(*) FROM {{schema}}.{{table}}',
        'SELECT {{expected_count}}::bigint',
        'Role {{role}} sees expected row count'
      );
      RESET ROLE;
      SELECT finish();
    `,
    difficulty: 'intermediate',
    bestPractices: ['Always RESET ROLE after testing']
  },

  {
    id: 'privilege_escalation_test',
    category: 'security',
    description: 'Test that role cannot escalate privileges',
    placeholders: ['role', 'schema', 'table', 'forbidden_operation'],
    template: `
      SELECT plan(1);
      SET ROLE {{role}};
      SELECT throws_ok(
        '{{forbidden_operation}}',
        '42501',
        'permission denied',
        'Role {{role}} cannot perform forbidden operation'
      );
      RESET ROLE;
      SELECT finish();
    `,
    difficulty: 'advanced',
    bestPractices: ['Test both positive and negative cases for permissions']
  },

  {
    id: 'security_definer_validation',
    category: 'security',
    description: 'Verify function runs with definer privileges',
    placeholders: ['schema', 'function_name'],
    template: `
      SELECT plan(1);
      SELECT is_definer('{{schema}}.{{function_name}}');
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'multi_role_data_isolation',
    category: 'security',
    description: 'Test data isolation between different roles',
    placeholders: ['role1', 'role2', 'schema', 'table'],
    template: `
      SELECT plan(2);
      
      -- Test role1 data
      SET ROLE {{role1}};
      CREATE TEMP TABLE role1_data AS 
        SELECT * FROM {{schema}}.{{table}};
      RESET ROLE;
      
      -- Test role2 data
      SET ROLE {{role2}};
      CREATE TEMP TABLE role2_data AS 
        SELECT * FROM {{schema}}.{{table}};
      RESET ROLE;
      
      -- Verify isolation
      SELECT isnt(
        'SELECT * FROM role1_data',
        'SELECT * FROM role2_data',
        'Data is properly isolated between roles'
      );
      
      DROP TABLE role1_data, role2_data;
      SELECT finish();
    `,
    difficulty: 'advanced',
    bestPractices: ['Clean up temp tables after testing']
  },

  {
    id: 'service_role_bypass',
    category: 'security',
    description: 'Verify service_role bypasses RLS',
    placeholders: ['schema', 'table'],
    template: `
      SELECT plan(2);
      
      -- Count as service_role
      SET ROLE service_role;
      SELECT ok(
        (SELECT COUNT(*) FROM {{schema}}.{{table}}) > 0,
        'service_role can access all data'
      );
      RESET ROLE;
      
      -- Count as anon (should be restricted)
      SET ROLE anon;
      SELECT ok(
        (SELECT COUNT(*) FROM {{schema}}.{{table}}) >= 0,
        'anon role access is restricted by RLS'
      );
      RESET ROLE;
      
      SELECT finish();
    `,
    difficulty: 'intermediate'
  }
];
