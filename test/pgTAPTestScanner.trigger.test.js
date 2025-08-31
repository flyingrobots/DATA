/**
 * Tests for pgTAPTestScanner trigger assertion parsing functionality
 * @fileoverview Test coverage for trigger-related pgTAP assertions
 */

import { describe, it, expect, beforeEach } from "vitest";
import pgTAPTestScanner from "../src/lib/testing/pgTAPTestScanner.js";

describe("pgTAPTestScanner Trigger Assertion Parsing", () => {
  let scanner;

  beforeEach(() => {
    scanner = new pgTAPTestScanner();
  });

  describe("has_trigger assertion parsing", () => {
    it("should parse has_trigger with table and trigger name", () => {
      const sql = "SELECT has_trigger('users', 'update_timestamp_trigger');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("has_trigger");
      expect(assertions[0].target).toBe(
        "public.users.update_timestamp_trigger",
      );
      expect(assertions[0].parameters).toEqual([
        "users",
        "update_timestamp_trigger",
      ]);
    });

    it("should parse has_trigger with schema, table, and trigger name", () => {
      const sql = "SELECT has_trigger('public', 'posts', 'audit_trigger');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("has_trigger");
      expect(assertions[0].target).toBe("public.posts.audit_trigger");
      expect(assertions[0].parameters).toEqual([
        "public",
        "posts",
        "audit_trigger",
      ]);
    });
  });

  describe("hasnt_trigger assertion parsing", () => {
    it("should parse hasnt_trigger with table and trigger name", () => {
      const sql = "SELECT hasnt_trigger('temp_table', 'old_trigger');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("hasnt_trigger");
      expect(assertions[0].target).toBe("public.temp_table.old_trigger");
      expect(assertions[0].parameters).toEqual(["temp_table", "old_trigger"]);
    });
  });

  describe("trigger_is assertion parsing", () => {
    it("should parse trigger_is with table, trigger, and function", () => {
      const sql =
        "SELECT trigger_is('users', 'update_trigger', 'set_timestamp');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("trigger_is");
      expect(assertions[0].target).toBe("public.users.update_trigger");
      expect(assertions[0].parameters).toEqual([
        "users",
        "update_trigger",
        "set_timestamp",
      ]);
    });

    it("should parse trigger_is with schema, table, trigger, func_schema, and function", () => {
      const sql =
        "SELECT trigger_is('public', 'posts', 'audit_trigger', 'audit', 'log_changes');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("trigger_is");
      expect(assertions[0].target).toBe("public.posts.audit_trigger");
      expect(assertions[0].parameters).toEqual([
        "public",
        "posts",
        "audit_trigger",
        "audit",
        "log_changes",
      ]);
    });
  });

  describe("is_trigger_on assertion parsing", () => {
    it("should parse is_trigger_on with table, trigger, and events", () => {
      const sql = "SELECT is_trigger_on('posts', 'audit_trigger', 'UPDATE');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("is_trigger_on");
      expect(assertions[0].target).toBe("public.posts.audit_trigger");
      expect(assertions[0].parameters).toEqual([
        "posts",
        "audit_trigger",
        "UPDATE",
      ]);
    });

    it("should parse is_trigger_on with schema, table, trigger, and events", () => {
      const sql =
        "SELECT is_trigger_on('public', 'users', 'validation_trigger', 'INSERT');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("is_trigger_on");
      expect(assertions[0].target).toBe("public.users.validation_trigger");
      expect(assertions[0].parameters).toEqual([
        "public",
        "users",
        "validation_trigger",
        "INSERT",
      ]);
    });
  });

  describe("trigger_fires_on assertion parsing", () => {
    it("should parse trigger_fires_on with timing", () => {
      const sql =
        "SELECT trigger_fires_on('users', 'update_trigger', 'BEFORE');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("trigger_fires_on");
      expect(assertions[0].target).toBe("public.users.update_trigger");
      expect(assertions[0].parameters).toEqual([
        "users",
        "update_trigger",
        "BEFORE",
      ]);
    });
  });

  describe("trigger_is_for assertion parsing", () => {
    it("should parse trigger_is_for with level", () => {
      const sql = "SELECT trigger_is_for('users', 'update_trigger', 'ROW');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("trigger_is_for");
      expect(assertions[0].target).toBe("public.users.update_trigger");
      expect(assertions[0].parameters).toEqual([
        "users",
        "update_trigger",
        "ROW",
      ]);
    });
  });

  describe("triggers_are assertion parsing", () => {
    it("should parse triggers_are with table and trigger array", () => {
      const sql =
        "SELECT triggers_are('users', ARRAY['update_trigger', 'validation_trigger']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("triggers_are");
      expect(assertions[0].target).toBe("public.users");
      expect(assertions[0].parameters).toEqual([
        "users",
        "'update_trigger', 'validation_trigger'",
      ]);
    });

    it("should parse triggers_are with schema, table, and trigger array", () => {
      const sql =
        "SELECT triggers_are('public', 'posts', ARRAY['audit_trigger', 'notify_trigger']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe("triggers_are");
      expect(assertions[0].target).toBe("public.posts");
      expect(assertions[0].parameters).toEqual([
        "public",
        "posts",
        "'audit_trigger', 'notify_trigger'",
      ]);
    });
  });

  describe("trigger coverage tracking", () => {
    it("should track trigger coverage in coverage map", () => {
      const sql = `
        SELECT has_trigger('users', 'update_trigger');
        SELECT trigger_is('users', 'update_trigger', 'set_timestamp');
        SELECT trigger_fires_on('users', 'update_trigger', 'BEFORE');
        SELECT is_trigger_on('posts', 'audit_trigger', 'INSERT');
      `;

      const assertions = scanner.extractAssertions(sql);

      // Mock test file structure
      scanner.testFiles = [
        {
          filePath: "/test/triggers.sql",
          fileName: "triggers.sql",
          assertions,
          planCount: assertions.length,
          dependencies: [],
          metadata: {
            size: sql.length,
            lines: sql.split("\n").length,
            parsed: new Date(),
          },
        },
      ];

      scanner._buildCoverageMap();
      const coverageMap = scanner.getCoverageMap();

      expect(coverageMap.triggers).toBeDefined();
      expect(Object.keys(coverageMap.triggers)).toContain(
        "public.users.update_trigger",
      );
      expect(Object.keys(coverageMap.triggers)).toContain(
        "public.posts.audit_trigger",
      );

      expect(coverageMap.triggers["public.users.update_trigger"]).toEqual([
        "has_trigger",
        "trigger_is",
        "trigger_fires_on",
      ]);

      expect(coverageMap.triggers["public.posts.audit_trigger"]).toEqual([
        "is_trigger_on",
      ]);
    });

    it("should include trigger statistics in coverage stats", () => {
      const sql = `
        SELECT has_trigger('users', 'update_trigger');
        SELECT has_trigger('posts', 'audit_trigger');
      `;

      const assertions = scanner.extractAssertions(sql);

      scanner.testFiles = [
        {
          filePath: "/test/triggers.sql",
          fileName: "triggers.sql",
          assertions,
          planCount: assertions.length,
          dependencies: [],
          metadata: {
            size: sql.length,
            lines: sql.split("\n").length,
            parsed: new Date(),
          },
        },
      ];

      scanner._buildCoverageMap();
      const stats = scanner.getStatistics();

      expect(stats.coverageStats.triggersWithTests).toBe(2);
    });
  });

  describe("complex trigger assertion patterns", () => {
    it("should handle multiple trigger assertions in one file", () => {
      const sql = `
        -- Test trigger existence and properties
        SELECT has_trigger('users', 'update_timestamp_trigger', 'Update timestamp trigger exists');
        SELECT trigger_is('users', 'update_timestamp_trigger', 'set_updated_at');
        SELECT trigger_fires_on('users', 'update_timestamp_trigger', 'BEFORE');
        SELECT is_trigger_on('users', 'update_timestamp_trigger', 'UPDATE');
        SELECT trigger_is_for('users', 'update_timestamp_trigger', 'ROW');
        
        -- Test another trigger
        SELECT has_trigger('posts', 'audit_trigger');
        SELECT trigger_is('posts', 'audit_trigger', 'audit_changes');
      `;

      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(7);

      // Verify all assertions are properly categorized
      const triggerAssertions = assertions.filter((a) =>
        a.type.includes("trigger"),
      );
      expect(triggerAssertions).toHaveLength(7);

      // Verify target extraction works correctly
      const updateTriggerAssertions = assertions.filter(
        (a) => a.target === "public.users.update_timestamp_trigger",
      );
      expect(updateTriggerAssertions).toHaveLength(5);

      const auditTriggerAssertions = assertions.filter(
        (a) => a.target === "public.posts.audit_trigger",
      );
      expect(auditTriggerAssertions).toHaveLength(2);
    });
  });
});
