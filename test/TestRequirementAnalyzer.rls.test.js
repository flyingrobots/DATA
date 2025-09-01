/**
 * Unit tests for RLS policy test mapping in TestRequirementAnalyzer
 *
 * Tests the specific RLS functionality implemented for task T007
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestRequirementAnalyzer,
  TEST_TYPES,
  TEST_PRIORITIES
} from '../starfleet/data-core/src/testing/TestRequirementAnalyzer.js';

describe('TestRequirementAnalyzer - RLS Policy Mapping', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new TestRequirementAnalyzer();
  });

  describe('CREATE POLICY mapping', () => {
    it('should generate comprehensive test requirements for CREATE POLICY', async () => {
      const operation = {
        sql: 'CREATE POLICY user_select_policy ON users FOR SELECT TO authenticated USING (auth.uid() = id)',
        type: 'SAFE'
      };

      const requirements = await analyzer.determineTestRequirements(operation);

      // Should generate multiple requirements
      expect(requirements.length).toBeGreaterThan(3);

      // Should include RLS and PERMISSION test types
      const testTypes = requirements.map((req) => req.type);
      expect(testTypes).toContain(TEST_TYPES.RLS);
      expect(testTypes).toContain(TEST_TYPES.PERMISSION);

      // All requirements should be CRITICAL priority for security
      const priorities = requirements.map((req) => req.priority);
      priorities.forEach((priority) => {
        expect(priority).toBe(TEST_PRIORITIES.CRITICAL);
      });

      // Should test multiple user roles
      const userRoleTests = requirements.filter(
        (req) =>
          req.description.includes('role anon') ||
          req.description.includes('role authenticated') ||
          req.description.includes('role service_role')
      );
      expect(userRoleTests.length).toBe(3);
    });

    it('should extract policy details correctly', () => {
      const sql =
        "CREATE POLICY test_policy ON users FOR SELECT TO authenticated, anon USING (auth.uid() = id) WITH CHECK (status = 'active')";
      const details = analyzer._extractPolicyDetails(sql);

      expect(details.commands).toEqual(['SELECT']);
      expect(details.roles).toEqual(['authenticated', 'anon']);
      expect(details.isPermissive).toBe(true);
      expect(details.expression).toBe('auth.uid() = id');
      expect(details.checkExpression).toBe("status = 'active'");
    });

    it('should handle FOR ALL commands', () => {
      const sql = 'CREATE POLICY admin_policy ON users FOR ALL TO admin USING (true)';
      const details = analyzer._extractPolicyDetails(sql);

      expect(details.commands).toEqual(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
      expect(details.roles).toEqual(['admin']);
    });
  });

  describe('ALTER POLICY mapping', () => {
    it('should generate test requirements for ALTER POLICY', async () => {
      const operation = {
        sql: "ALTER POLICY user_policy ON users TO authenticated, admin USING (auth.uid() = id OR auth.role() = 'admin')",
        type: 'WARNING'
      };

      const requirements = await analyzer.determineTestRequirements(operation);

      expect(requirements.length).toBeGreaterThan(2);

      // Should include altered security boundary tests
      const alteredTests = requirements.filter(
        (req) => req.metadata?.testType === 'altered_security_boundary'
      );
      expect(alteredTests.length).toBeGreaterThan(0);
    });
  });

  describe('DROP POLICY mapping', () => {
    it('should generate test requirements for DROP POLICY', async () => {
      const operation = {
        sql: 'DROP POLICY user_policy ON users',
        type: 'DESTRUCTIVE'
      };

      const requirements = await analyzer.determineTestRequirements(operation);

      expect(requirements.length).toBeGreaterThan(1);

      // Should include policy removal tests
      const removalTests = requirements.filter(
        (req) => req.metadata?.testType === 'policy_removal'
      );
      expect(removalTests.length).toBe(1);

      // Should include post-drop security tests
      const postDropTests = requirements.filter(
        (req) => req.metadata?.testType === 'post_drop_security'
      );
      expect(postDropTests.length).toBe(1);
    });
  });

  describe('ENABLE RLS mapping', () => {
    it('should generate test requirements for ENABLE ROW LEVEL SECURITY', async () => {
      const operation = {
        sql: 'ALTER TABLE users ENABLE ROW LEVEL SECURITY',
        type: 'WARNING'
      };

      const requirements = await analyzer.determineTestRequirements(operation);

      expect(requirements.length).toBeGreaterThan(1);

      // Should include is_rls_enabled test
      const rlsEnabledTests = requirements.filter((req) =>
        req.testCases.some((tc) => tc.includes('is_rls_enabled'))
      );
      expect(rlsEnabledTests.length).toBe(1);

      // Should test security impact
      const securityTests = requirements.filter(
        (req) => req.metadata?.testType === 'rls_security_impact'
      );
      expect(securityTests.length).toBe(1);
    });
  });

  describe('DISABLE RLS mapping', () => {
    it('should generate test requirements for DISABLE ROW LEVEL SECURITY', async () => {
      const operation = {
        sql: 'ALTER TABLE posts DISABLE ROW LEVEL SECURITY',
        type: 'WARNING'
      };

      const requirements = await analyzer.determineTestRequirements(operation);

      expect(requirements.length).toBe(2);

      // Should include RLS disablement test
      const disablementTests = requirements.filter(
        (req) => req.metadata?.testType === 'rls_disablement'
      );
      expect(disablementTests.length).toBe(1);

      // Should test security impact with HIGH priority (potential security risk)
      const securityTests = requirements.filter(
        (req) => req.metadata?.testType === 'rls_disable_security_impact'
      );
      expect(securityTests.length).toBe(1);
      expect(securityTests[0].priority).toBe(TEST_PRIORITIES.HIGH);
    });
  });

  describe('Security test scenarios', () => {
    it('should generate appropriate security test scenarios', () => {
      const policyDetails = {
        commands: ['SELECT', 'INSERT'],
        roles: ['authenticated'],
        isPermissive: true,
        expression: 'auth.uid() = user_id'
      };

      const scenarios = analyzer._generateSecurityTestScenarios(policyDetails, 'authenticated');

      expect(scenarios.length).toBeGreaterThan(2);

      // Should include basic operation tests
      const selectScenario = scenarios.find((s) => s.operation === 'SELECT');
      expect(selectScenario).toBeDefined();
      expect(selectScenario.role).toBe('authenticated');

      const insertScenario = scenarios.find((s) => s.operation === 'INSERT');
      expect(insertScenario).toBeDefined();

      // Should include service_role bypass test
      const bypassScenario = scenarios.find((s) => s.role === 'service_role');
      expect(bypassScenario).toBeDefined();
      expect(bypassScenario.shouldAllow).toBe(true);
    });
  });

  describe('Operation categorization', () => {
    it('should correctly categorize RLS operations', () => {
      const testCases = [
        { sql: 'CREATE POLICY test ON users FOR SELECT', expected: 'CREATE_POLICY' },
        { sql: 'ALTER POLICY test ON users TO admin', expected: 'ALTER_POLICY' },
        { sql: 'DROP POLICY test ON users', expected: 'DROP_POLICY' },
        { sql: 'ALTER TABLE users ENABLE ROW LEVEL SECURITY', expected: 'ENABLE_RLS' },
        { sql: 'ALTER TABLE users DISABLE ROW LEVEL SECURITY', expected: 'DISABLE_RLS' }
      ];

      for (const testCase of testCases) {
        const operation = { sql: testCase.sql };
        const category = analyzer._categorizeOperation(operation);
        expect(category).toBe(testCase.expected);
      }
    });
  });

  describe('Target object extraction', () => {
    it('should correctly extract policy names', () => {
      const testCases = [
        { sql: 'CREATE POLICY user_select_policy ON users', expected: 'user_select_policy' },
        { sql: 'ALTER POLICY admin_policy ON posts', expected: 'admin_policy' },
        { sql: 'DROP POLICY old_policy ON comments', expected: 'old_policy' }
      ];

      for (const testCase of testCases) {
        const operation = { sql: testCase.sql };
        const target = analyzer._extractTargetObject(operation);
        expect(target).toBe(testCase.expected);
      }
    });
  });
});
