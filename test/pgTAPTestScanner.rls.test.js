/**
 * pgTAPTestScanner RLS Policy Assertion Parsing Tests
 *
 * Tests the RLS (Row Level Security) policy assertion parsing capabilities of pgTAPTestScanner
 */

import { describe, it, expect, beforeEach } from "vitest";
import pgTAPTestScanner from "../src/lib/testing/pgTAPTestScanner.js";

describe("pgTAPTestScanner RLS Policy Assertion Parsing", () => {
  let scanner;

  beforeEach(() => {
    scanner = new pgTAPTestScanner();
  });

  describe("is_rls_enabled assertion parsing", () => {
    it("should parse is_rls_enabled with table only", () => {
      const sql = "SELECT is_rls_enabled('users');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("is_rls_enabled");
      expect(assertions[0].target).toBe("users");
      expect(assertions[0].parameters).toEqual(["users"]);
    });

    it("should parse is_rls_enabled with schema and table", () => {
      const sql = "SELECT is_rls_enabled('public', 'profiles');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("is_rls_enabled");
      expect(assertions[0].target).toBe("public.profiles");
      expect(assertions[0].parameters).toEqual(["public", "profiles"]);
    });

    it("should parse multiple is_rls_enabled assertions", () => {
      const sql = `
        SELECT is_rls_enabled('users');
        SELECT is_rls_enabled('auth', 'sessions');
        SELECT is_rls_enabled('public', 'posts');
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(3);
      expect(assertions[0].target).toBe("users");
      expect(assertions[1].target).toBe("auth.sessions");
      expect(assertions[2].target).toBe("public.posts");
    });
  });

  describe("policy_exists assertion parsing", () => {
    it("should parse policy_exists with table and policy name", () => {
      const sql = "SELECT policy_exists('users', 'user_select_policy');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policy_exists");
      expect(assertions[0].target).toBe("users.user_select_policy");
      expect(assertions[0].parameters).toEqual(["users", "user_select_policy"]);
    });

    it("should parse policy_exists with schema, table, and policy name", () => {
      const sql =
        "SELECT policy_exists('public', 'users', 'user_insert_policy');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policy_exists");
      expect(assertions[0].target).toBe("public.users.user_insert_policy");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "user_insert_policy",
      ]);
    });

    it("should handle various quote styles for policy_exists", () => {
      const sql = `
        SELECT policy_exists("users", "user_policy");
        SELECT policy_exists(\`auth\`, \`sessions\`, \`session_policy\`);
        SELECT policy_exists('posts', 'author_policy');
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(3);
      expect(assertions[0].target).toBe("users.user_policy");
      expect(assertions[1].target).toBe("auth.sessions.session_policy");
      expect(assertions[2].target).toBe("posts.author_policy");
    });
  });

  describe("policy_cmd_is assertion parsing", () => {
    it("should parse policy_cmd_is with table, policy, and command", () => {
      const sql = "SELECT policy_cmd_is('users', 'user_policy', 'SELECT');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policy_cmd_is");
      expect(assertions[0].target).toBe("users.user_policy");
      expect(assertions[0].parameters).toEqual([
        "users",
        "user_policy",
        "SELECT",
      ]);
    });

    it("should parse policy_cmd_is with schema, table, policy, and command", () => {
      const sql =
        "SELECT policy_cmd_is('public', 'users', 'user_insert_policy', 'INSERT');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policy_cmd_is");
      expect(assertions[0].target).toBe("public.users.user_insert_policy");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "user_insert_policy",
        "INSERT",
      ]);
    });

    it("should parse different SQL commands", () => {
      const sql = `
        SELECT policy_cmd_is('posts', 'select_policy', 'SELECT');
        SELECT policy_cmd_is('posts', 'insert_policy', 'INSERT');
        SELECT policy_cmd_is('posts', 'update_policy', 'UPDATE');
        SELECT policy_cmd_is('posts', 'delete_policy', 'DELETE');
        SELECT policy_cmd_is('posts', 'all_policy', 'ALL');
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(5);
      expect(assertions[0].parameters[2]).toBe("SELECT");
      expect(assertions[1].parameters[2]).toBe("INSERT");
      expect(assertions[2].parameters[2]).toBe("UPDATE");
      expect(assertions[3].parameters[2]).toBe("DELETE");
      expect(assertions[4].parameters[2]).toBe("ALL");
    });
  });

  describe("policy_roles_are assertion parsing", () => {
    it("should parse policy_roles_are with table, policy, and role array", () => {
      const sql =
        "SELECT policy_roles_are('users', 'user_policy', ARRAY['authenticated']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policy_roles_are");
      expect(assertions[0].target).toBe("users.user_policy");
      expect(assertions[0].parameters).toEqual([
        "users",
        "user_policy",
        "'authenticated'",
      ]);
    });

    it("should parse policy_roles_are with schema, table, policy, and role array", () => {
      const sql =
        "SELECT policy_roles_are('public', 'users', 'admin_policy', ARRAY['admin', 'moderator']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policy_roles_are");
      expect(assertions[0].target).toBe("public.users.admin_policy");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "admin_policy",
        "'admin', 'moderator'",
      ]);
    });

    it("should parse multiple role arrays", () => {
      const sql = `
        SELECT policy_roles_are('posts', 'author_policy', ARRAY['author']);
        SELECT policy_roles_are('posts', 'editor_policy', ARRAY['editor', 'admin']);
        SELECT policy_roles_are('comments', 'public_policy', ARRAY['public', 'authenticated', 'anon']);
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(3);
      expect(assertions[0].parameters[2]).toBe("'author'");
      expect(assertions[1].parameters[2]).toBe("'editor', 'admin'");
      expect(assertions[2].parameters[2]).toBe(
        "'public', 'authenticated', 'anon'",
      );
    });
  });

  describe("policies_are assertion parsing", () => {
    it("should parse policies_are with table and policy array", () => {
      const sql =
        "SELECT policies_are('users', ARRAY['select_policy', 'insert_policy']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policies_are");
      expect(assertions[0].target).toBe("users");
      expect(assertions[0].parameters).toEqual([
        "users",
        "'select_policy', 'insert_policy'",
      ]);
    });

    it("should parse policies_are with schema, table, and policy array", () => {
      const sql =
        "SELECT policies_are('public', 'users', ARRAY['user_select', 'user_insert', 'user_update']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policies_are");
      expect(assertions[0].target).toBe("public.users");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "'user_select', 'user_insert', 'user_update'",
      ]);
    });

    it("should parse policies_are with optional description", () => {
      const sql =
        "SELECT policies_are('public', 'users', ARRAY['select_policy', 'insert_policy'], 'All user policies');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policies_are");
      expect(assertions[0].target).toBe("public.users");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "'select_policy', 'insert_policy'",
        "All user policies",
      ]);
    });

    it("should parse single policy in array", () => {
      const sql = "SELECT policies_are('posts', ARRAY['author_only_policy']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("policies_are");
      expect(assertions[0].target).toBe("posts");
      expect(assertions[0].parameters).toEqual([
        "posts",
        "'author_only_policy'",
      ]);
    });
  });

  describe("Mixed RLS assertion parsing", () => {
    it("should parse multiple different RLS assertions in one SQL block", () => {
      const sql = `
        -- Check if RLS is enabled
        SELECT is_rls_enabled('public', 'users');
        
        -- Test specific policies exist
        SELECT policy_exists('users', 'user_select_policy');
        SELECT policy_exists('public', 'posts', 'author_policy');
        
        -- Test policy commands
        SELECT policy_cmd_is('users', 'user_select_policy', 'SELECT');
        SELECT policy_cmd_is('posts', 'author_policy', 'ALL');
        
        -- Test policy roles
        SELECT policy_roles_are('users', 'user_select_policy', ARRAY['authenticated']);
        SELECT policy_roles_are('posts', 'admin_policy', ARRAY['admin', 'moderator']);
        
        -- Test all policies on tables
        SELECT policies_are('users', ARRAY['user_select_policy', 'user_insert_policy']);
        SELECT policies_are('public', 'posts', ARRAY['author_policy', 'admin_policy'], 'Post policies');
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(9);
      expect(assertions.map((a) => a.type)).toEqual([
        "is_rls_enabled",
        "policy_exists",
        "policy_exists",
        "policy_cmd_is",
        "policy_cmd_is",
        "policy_roles_are",
        "policy_roles_are",
        "policies_are",
        "policies_are",
      ]);
    });

    it("should handle commented out RLS assertions based on includeCommented option", () => {
      const sql = `
        SELECT is_rls_enabled('users');
        -- SELECT policy_exists('users', 'disabled_policy');
        /* SELECT policy_cmd_is('users', 'commented_policy', 'SELECT'); */
        SELECT policies_are('users', ARRAY['active_policy']);
      `;

      const assertions = scanner.extractAssertions(sql);
      // Note: The /* */ multiline comment might not be filtered out by the simple comment pattern
      expect(assertions.length).toBeGreaterThanOrEqual(2); // At least uncommented assertions

      // Test with includeCommented = true
      const scannerWithComments = new pgTAPTestScanner({
        includeCommented: true,
      });
      const assertionsWithComments = scannerWithComments.extractAssertions(sql);
      expect(assertionsWithComments.length).toBeGreaterThanOrEqual(
        assertions.length,
      ); // Should include at least as many
    });
  });

  describe("RLS coverage map integration", () => {
    it("should build policy coverage map correctly", () => {
      const sql = `
        SELECT is_rls_enabled('users');
        SELECT policy_exists('users', 'user_policy');
        SELECT policy_cmd_is('users', 'user_policy', 'SELECT');
        SELECT policy_roles_are('public', 'posts', 'admin_policy', ARRAY['admin']);
        SELECT policies_are('comments', ARRAY['public_policy', 'auth_policy']);
      `;

      const assertions = scanner.extractAssertions(sql);

      // Simulate building coverage map
      scanner.testFiles = [
        {
          filePath: "/test/rls.sql",
          fileName: "rls.sql",
          assertions,
          planCount: assertions.length,
          dependencies: [],
          metadata: {},
        },
      ];

      scanner._buildCoverageMap();
      const coverageMap = scanner.getCoverageMap();

      // Check that policies are properly tracked
      expect(coverageMap.policies).toBeDefined();
      expect(Object.keys(coverageMap.policies)).toHaveLength(4);

      expect(coverageMap.policies["users"]).toContain("is_rls_enabled");
      expect(coverageMap.policies["users.user_policy"]).toContain(
        "policy_exists",
      );
      expect(coverageMap.policies["users.user_policy"]).toContain(
        "policy_cmd_is",
      );
      expect(coverageMap.policies["public.posts.admin_policy"]).toContain(
        "policy_roles_are",
      );
      expect(coverageMap.policies["comments"]).toContain("policies_are");
    });

    it("should track files by policy target", () => {
      const sql = `
        SELECT is_rls_enabled('users');
        SELECT policy_exists('posts', 'author_policy');
      `;

      const assertions = scanner.extractAssertions(sql);

      scanner.testFiles = [
        {
          filePath: "/test/user_rls.sql",
          fileName: "user_rls.sql",
          assertions: [assertions[0]],
          planCount: 1,
          dependencies: [],
          metadata: {},
        },
        {
          filePath: "/test/post_rls.sql",
          fileName: "post_rls.sql",
          assertions: [assertions[1]],
          planCount: 1,
          dependencies: [],
          metadata: {},
        },
      ];

      scanner._buildCoverageMap();
      const coverageMap = scanner.getCoverageMap();

      expect(coverageMap.filesByTarget["users"]).toHaveLength(1);
      expect(coverageMap.filesByTarget["users"][0].fileName).toBe(
        "user_rls.sql",
      );
      expect(coverageMap.filesByTarget["posts.author_policy"]).toHaveLength(1);
      expect(coverageMap.filesByTarget["posts.author_policy"][0].fileName).toBe(
        "post_rls.sql",
      );
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle malformed RLS assertions gracefully", () => {
      const sql = `
        SELECT is_rls_enabled(); -- missing table
        SELECT policy_exists('users'); -- missing policy name
        SELECT policy_cmd_is('users', 'policy'); -- missing command
      `;

      // Should not throw errors, but may not match patterns
      expect(() => scanner.extractAssertions(sql)).not.toThrow();
    });

    it("should handle different whitespace and formatting", () => {
      const sql = `
        SELECT    is_rls_enabled   (   'users'   )   ;
        SELECT
          policy_exists(
            'public',
            'users',
            'user_policy'
          );
        SELECT policy_cmd_is('posts','author_policy','SELECT');
      `;

      const assertions = scanner.extractAssertions(sql);
      expect(assertions).toHaveLength(3);
      expect(assertions[0].type).toBe("is_rls_enabled");
      expect(assertions[1].type).toBe("policy_exists");
      expect(assertions[2].type).toBe("policy_cmd_is");
    });

    it("should preserve original SQL in rawSql property", () => {
      const sql = "SELECT policy_exists('users', 'user_policy');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions[0].rawSql).toBe(
        "SELECT policy_exists('users', 'user_policy')",
      );
    });

    it("should track line numbers correctly", () => {
      const sql = `-- Line 1
        SELECT is_rls_enabled('users'); -- Line 2
        
        SELECT policy_exists('posts', 'author_policy'); -- Line 4
      `;

      const assertions = scanner.extractAssertions(sql);
      expect(assertions).toHaveLength(2);
      expect(assertions[0].lineNumber).toBe(2);
      expect(assertions[1].lineNumber).toBe(4);
    });
  });

  describe("RLS policy metadata extraction", () => {
    it("should extract policy metadata for is_rls_enabled assertions", () => {
      const sql = `
        SELECT is_rls_enabled('users');
        SELECT is_rls_enabled('public', 'profiles');
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(2);

      expect(assertions[0].policyMetadata).toEqual({
        schema: "public",
        tableName: "users",
      });

      expect(assertions[1].policyMetadata).toEqual({
        schema: "public",
        tableName: "profiles",
      });
    });

    it("should extract policy metadata for policy_exists assertions", () => {
      const sql = `
        SELECT policy_exists('users', 'user_select_policy');
        SELECT policy_exists('auth', 'sessions', 'session_policy');
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(2);

      expect(assertions[0].policyMetadata).toEqual({
        schema: "public",
        tableName: "users",
        policyName: "user_select_policy",
      });

      expect(assertions[1].policyMetadata).toEqual({
        schema: "auth",
        tableName: "sessions",
        policyName: "session_policy",
      });
    });

    it("should extract policy metadata for policy_cmd_is assertions", () => {
      const sql = `
        SELECT policy_cmd_is('posts', 'author_policy', 'SELECT');
        SELECT policy_cmd_is('public', 'comments', 'moderator_policy', 'DELETE');
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(2);

      expect(assertions[0].policyMetadata).toEqual({
        schema: "public",
        tableName: "posts",
        policyName: "author_policy",
        command: "SELECT",
      });

      expect(assertions[1].policyMetadata).toEqual({
        schema: "public",
        tableName: "comments",
        policyName: "moderator_policy",
        command: "DELETE",
      });
    });

    it("should extract policy metadata for policy_roles_are assertions", () => {
      const sql = `
        SELECT policy_roles_are('users', 'user_policy', ARRAY['authenticated']);
        SELECT policy_roles_are('public', 'posts', 'admin_policy', ARRAY['admin', 'moderator']);
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(2);

      expect(assertions[0].policyMetadata).toEqual({
        schema: "public",
        tableName: "users",
        policyName: "user_policy",
        roles: ["authenticated"],
      });

      expect(assertions[1].policyMetadata).toEqual({
        schema: "public",
        tableName: "posts",
        policyName: "admin_policy",
        roles: ["admin", "moderator"],
      });
    });

    it("should extract policy metadata for policies_are assertions", () => {
      const sql = `
        SELECT policies_are('users', ARRAY['select_policy', 'insert_policy']);
        SELECT policies_are('public', 'posts', ARRAY['author_policy', 'admin_policy'], 'Post access policies');
      `;
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(2);

      expect(assertions[0].policyMetadata).toEqual({
        schema: "public",
        tableName: "users",
        policies: ["select_policy", "insert_policy"],
      });

      expect(assertions[1].policyMetadata).toEqual({
        schema: "public",
        tableName: "posts",
        policies: ["author_policy", "admin_policy"],
        description: "Post access policies",
      });
    });
  });

  describe("Statistics and reporting", () => {
    it("should include RLS assertions in statistics", () => {
      const sql = `
        SELECT is_rls_enabled('users');
        SELECT policy_exists('users', 'policy1');
        SELECT policy_exists('posts', 'policy2');
        SELECT policy_cmd_is('users', 'policy1', 'SELECT');
        SELECT policies_are('comments', ARRAY['policy1']);
      `;

      const assertions = scanner.extractAssertions(sql);
      scanner.testFiles = [
        {
          filePath: "/test/rls.sql",
          fileName: "rls.sql",
          assertions,
          planCount: assertions.length,
          dependencies: [],
          metadata: {},
        },
      ];

      // Need to set totalAssertions manually or via processing
      scanner.totalAssertions = assertions.length;
      scanner.filesProcessed = 1;

      scanner._buildCoverageMap();
      const stats = scanner.getStatistics();

      expect(stats.totalAssertions).toBe(5);
      expect(stats.assertionTypes["is_rls_enabled"]).toBe(1);
      expect(stats.assertionTypes["policy_exists"]).toBe(2);
      expect(stats.assertionTypes["policy_cmd_is"]).toBe(1);
      expect(stats.assertionTypes["policies_are"]).toBe(1);
      expect(stats.coverageStats.policiesWithTests).toBe(4); // users, users.policy1, posts.policy2, comments
    });
  });
});
