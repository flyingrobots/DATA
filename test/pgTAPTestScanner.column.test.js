/**
 * pgTAPTestScanner Column Assertion Parsing Tests
 *
 * Tests the column assertion parsing capabilities of pgTAPTestScanner
 */

import { describe, it, expect, beforeEach } from "vitest";
import pgTAPTestScanner from "../src/lib/testing/pgTAPTestScanner.js";

describe("pgTAPTestScanner Column Assertion Parsing", () => {
  let scanner;

  beforeEach(() => {
    scanner = new pgTAPTestScanner();
  });

  describe("has_column assertion pattern matching", () => {
    it("should parse has_column with table and column", () => {
      const sql = "SELECT has_column('users', 'email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("has_column");
      expect(assertions[0].target).toBe("users.email");
      expect(assertions[0].parameters).toEqual(["users", "email"]);
    });

    it("should parse has_column with schema, table, and column", () => {
      const sql = "SELECT has_column('public', 'users', 'email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("has_column");
      expect(assertions[0].target).toBe("public.users.email");
      expect(assertions[0].parameters).toEqual(["public", "users", "email"]);
    });

    it("should parse hasnt_column with table and column", () => {
      const sql = "SELECT hasnt_column('users', 'old_field');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("hasnt_column");
      expect(assertions[0].target).toBe("users.old_field");
      expect(assertions[0].parameters).toEqual(["users", "old_field"]);
    });

    it("should parse hasnt_column with schema, table, and column", () => {
      const sql =
        "SELECT hasnt_column('private', 'sessions', 'deprecated_field');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("hasnt_column");
      expect(assertions[0].target).toBe("private.sessions.deprecated_field");
      expect(assertions[0].parameters).toEqual([
        "private",
        "sessions",
        "deprecated_field",
      ]);
    });
  });

  describe("col_type_is assertion pattern matching", () => {
    it("should parse col_type_is with table, column, and type", () => {
      const sql = "SELECT col_type_is('users', 'email', 'character varying');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_type_is");
      expect(assertions[0].target).toBe("users.email");
      expect(assertions[0].parameters).toEqual([
        "users",
        "email",
        "character varying",
      ]);
    });

    it("should parse col_type_is with schema, table, column, and type", () => {
      const sql = "SELECT col_type_is('public', 'users', 'age', 'integer');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_type_is");
      expect(assertions[0].target).toBe("public.users.age");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "age",
        "integer",
      ]);
    });
  });

  describe("col_not_null and col_is_null assertion pattern matching", () => {
    it("should parse col_not_null with table and column", () => {
      const sql = "SELECT col_not_null('users', 'email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_not_null");
      expect(assertions[0].target).toBe("users.email");
      expect(assertions[0].parameters).toEqual(["users", "email"]);
    });

    it("should parse col_not_null with schema, table, and column", () => {
      const sql = "SELECT col_not_null('public', 'users', 'email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_not_null");
      expect(assertions[0].target).toBe("public.users.email");
      expect(assertions[0].parameters).toEqual(["public", "users", "email"]);
    });

    it("should parse col_is_null with table and column", () => {
      const sql = "SELECT col_is_null('users', 'description');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_is_null");
      expect(assertions[0].target).toBe("users.description");
      expect(assertions[0].parameters).toEqual(["users", "description"]);
    });

    it("should parse col_is_null with schema, table, and column", () => {
      const sql = "SELECT col_is_null('public', 'users', 'description');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_is_null");
      expect(assertions[0].target).toBe("public.users.description");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "description",
      ]);
    });
  });

  describe("col_has_default and col_hasnt_default assertion pattern matching", () => {
    it("should parse col_has_default with table and column", () => {
      const sql = "SELECT col_has_default('users', 'status');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_has_default");
      expect(assertions[0].target).toBe("users.status");
      expect(assertions[0].parameters).toEqual(["users", "status"]);
    });

    it("should parse col_has_default with schema, table, and column", () => {
      const sql = "SELECT col_has_default('public', 'users', 'status');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_has_default");
      expect(assertions[0].target).toBe("public.users.status");
      expect(assertions[0].parameters).toEqual(["public", "users", "status"]);
    });

    it("should parse col_hasnt_default with table and column", () => {
      const sql = "SELECT col_hasnt_default('users', 'temp_field');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_hasnt_default");
      expect(assertions[0].target).toBe("users.temp_field");
      expect(assertions[0].parameters).toEqual(["users", "temp_field"]);
    });

    it("should parse col_hasnt_default with schema, table, and column", () => {
      const sql = "SELECT col_hasnt_default('public', 'users', 'temp_field');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_hasnt_default");
      expect(assertions[0].target).toBe("public.users.temp_field");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "temp_field",
      ]);
    });
  });

  describe("col_default_is assertion pattern matching", () => {
    it("should parse col_default_is with table, column, and default value", () => {
      const sql = "SELECT col_default_is('users', 'status', 'active');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_default_is");
      expect(assertions[0].target).toBe("users.status");
      expect(assertions[0].parameters).toEqual(["users", "status", "active"]);
    });

    it("should parse col_default_is with schema, table, column, and default value", () => {
      const sql =
        "SELECT col_default_is('public', 'users', 'status', 'pending');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_default_is");
      expect(assertions[0].target).toBe("public.users.status");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "status",
        "pending",
      ]);
    });

    it("should parse col_default_is with quoted string default values", () => {
      const sql =
        "SELECT col_default_is('users', 'email', ''user@example.com''::text);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_default_is");
      expect(assertions[0].target).toBe("users.email");
      expect(assertions[0].parameters).toEqual([
        "users",
        "email",
        "''user@example.com''::text",
      ]);
    });

    it("should parse col_default_is with function default values", () => {
      const sql = "SELECT col_default_is('users', 'created_at', 'now()');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_default_is");
      expect(assertions[0].target).toBe("users.created_at");
      expect(assertions[0].parameters).toEqual([
        "users",
        "created_at",
        "now()",
      ]);
    });
  });

  describe("col_is_pk and col_isnt_pk assertion pattern matching", () => {
    it("should parse col_is_pk with table and column", () => {
      const sql = "SELECT col_is_pk('users', 'id');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_is_pk");
      expect(assertions[0].target).toBe("users.id");
      expect(assertions[0].parameters).toEqual(["users", "id"]);
    });

    it("should parse col_is_pk with schema, table, and column", () => {
      const sql = "SELECT col_is_pk('public', 'users', 'id');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_is_pk");
      expect(assertions[0].target).toBe("public.users.id");
      expect(assertions[0].parameters).toEqual(["public", "users", "id"]);
    });

    it("should parse col_isnt_pk with table and column", () => {
      const sql = "SELECT col_isnt_pk('users', 'email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_isnt_pk");
      expect(assertions[0].target).toBe("users.email");
      expect(assertions[0].parameters).toEqual(["users", "email"]);
    });

    it("should parse col_isnt_pk with schema, table, and column", () => {
      const sql = "SELECT col_isnt_pk('public', 'users', 'email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_isnt_pk");
      expect(assertions[0].target).toBe("public.users.email");
      expect(assertions[0].parameters).toEqual(["public", "users", "email"]);
    });
  });

  describe("Column coverage tracking", () => {
    it("should track columns in coverage map", () => {
      const sql = `
        SELECT has_column('users', 'email');
        SELECT col_type_is('users', 'email', 'character varying');
        SELECT col_not_null('users', 'email');
        SELECT col_has_default('users', 'status');
        SELECT col_is_pk('users', 'id');
      `;

      const assertions = scanner.extractAssertions(sql);

      // Manually build coverage map for testing
      scanner.testFiles = [
        {
          filePath: "/test/column_test.sql",
          fileName: "column_test.sql",
          assertions,
          planCount: 5,
          dependencies: [],
          metadata: {},
        },
      ];

      scanner._buildCoverageMap();
      const coverageMap = scanner.getCoverageMap();

      expect(coverageMap.columns).toBeDefined();
      expect(Object.keys(coverageMap.columns)).toContain("users.email");
      expect(Object.keys(coverageMap.columns)).toContain("users.status");
      expect(Object.keys(coverageMap.columns)).toContain("users.id");

      expect(coverageMap.columns["users.email"]).toContain("has_column");
      expect(coverageMap.columns["users.email"]).toContain("col_type_is");
      expect(coverageMap.columns["users.email"]).toContain("col_not_null");
      expect(coverageMap.columns["users.status"]).toContain("col_has_default");
      expect(coverageMap.columns["users.id"]).toContain("col_is_pk");
    });

    it("should include columns in statistics", () => {
      const sql = `
        SELECT has_column('users', 'email');
        SELECT has_column('posts', 'title');
        SELECT col_is_pk('orders', 'id');
      `;

      const assertions = scanner.extractAssertions(sql);

      scanner.testFiles = [
        {
          filePath: "/test/column_test.sql",
          fileName: "column_test.sql",
          assertions,
          planCount: 3,
          dependencies: [],
          metadata: {},
        },
      ];

      scanner._buildCoverageMap();
      const stats = scanner.getStatistics();

      expect(stats.coverageStats.columnsWithTests).toBe(3); // 'users.email', 'posts.title', 'orders.id'
    });
  });

  describe("Complex column test scenarios", () => {
    it("should handle mixed column and other assertions", () => {
      const sql = `
        SELECT plan(6);
        SELECT has_table('users');
        SELECT has_column('users', 'email');
        SELECT col_type_is('users', 'email', 'character varying');
        SELECT col_not_null('users', 'email');
        SELECT has_index('users', 'idx_users_email');
        SELECT col_is_pk('users', 'id');
      `;

      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(6); // Excludes the plan statement

      const columnAssertions = assertions.filter(
        (a) => a.type.includes("column") || a.type.startsWith("col_"),
      );
      expect(columnAssertions).toHaveLength(4);

      const otherAssertions = assertions.filter(
        (a) => !a.type.includes("column") && !a.type.startsWith("col_"),
      );
      expect(otherAssertions).toHaveLength(2);
    });

    it("should handle whitespace and formatting variations", () => {
      const sql = `
        SELECT   has_column(  'users',  'email'  );
        SELECT col_type_is(
          'public',
          'users',
          'description',
          'text'
        );
        SELECT col_not_null('users','email');
      `;

      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(3);
      expect(assertions[0].type).toBe("has_column");
      expect(assertions[1].type).toBe("col_type_is");
      expect(assertions[2].type).toBe("col_not_null");

      expect(assertions[0].target).toBe("users.email");
      expect(assertions[1].target).toBe("public.users.description");
      expect(assertions[2].target).toBe("users.email");
    });

    it("should handle all column assertion types in one test", () => {
      const sql = `
        SELECT has_column('users', 'email');
        SELECT hasnt_column('users', 'old_field');
        SELECT col_type_is('users', 'email', 'character varying');
        SELECT col_not_null('users', 'email');
        SELECT col_is_null('users', 'description');
        SELECT col_has_default('users', 'status');
        SELECT col_hasnt_default('users', 'temp_field');
        SELECT col_default_is('users', 'status', 'active');
        SELECT col_is_pk('users', 'id');
        SELECT col_isnt_pk('users', 'email');
      `;

      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(10);

      const assertionTypes = assertions.map((a) => a.type);
      expect(assertionTypes).toContain("has_column");
      expect(assertionTypes).toContain("hasnt_column");
      expect(assertionTypes).toContain("col_type_is");
      expect(assertionTypes).toContain("col_not_null");
      expect(assertionTypes).toContain("col_is_null");
      expect(assertionTypes).toContain("col_has_default");
      expect(assertionTypes).toContain("col_hasnt_default");
      expect(assertionTypes).toContain("col_default_is");
      expect(assertionTypes).toContain("col_is_pk");
      expect(assertionTypes).toContain("col_isnt_pk");

      // All should be categorized as column assertions
      const columnAssertions = assertions.filter(
        (a) => a.type.includes("column") || a.type.startsWith("col_"),
      );
      expect(columnAssertions).toHaveLength(10);
    });
  });

  describe("Edge cases and special scenarios", () => {
    it("should handle quoted column names", () => {
      const sql = 'SELECT has_column("users", "user-email");';
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("has_column");
      expect(assertions[0].target).toBe("users.user-email");
      expect(assertions[0].parameters).toEqual(["users", "user-email"]);
    });

    it("should handle backtick quoted column names", () => {
      const sql = "SELECT has_column(`users`, `user_email`);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("has_column");
      expect(assertions[0].target).toBe("users.user_email");
      expect(assertions[0].parameters).toEqual(["users", "user_email"]);
    });

    it("should handle complex default values in col_default_is", () => {
      const sql =
        "SELECT col_default_is('users', 'settings', '{\"theme\": \"dark\", \"notifications\": true}');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_default_is");
      expect(assertions[0].target).toBe("users.settings");
      expect(assertions[0].parameters).toEqual([
        "users",
        "settings",
        '{"theme": "dark", "notifications": true}',
      ]);
    });

    it("should handle numeric default values", () => {
      const sql = "SELECT col_default_is('users', 'score', 0);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_default_is");
      expect(assertions[0].target).toBe("users.score");
      expect(assertions[0].parameters).toEqual(["users", "score", "0"]);
    });

    it("should handle boolean default values", () => {
      const sql = "SELECT col_default_is('users', 'is_active', true);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("col_default_is");
      expect(assertions[0].target).toBe("users.is_active");
      expect(assertions[0].parameters).toEqual(["users", "is_active", "true"]);
    });
  });
});
