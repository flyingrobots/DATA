/**
 * Test suite for TestRequirementAnalyzer column test mapping functionality
 * Validates the column-specific test requirement generation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TestRequirementAnalyzer,
  TEST_TYPES,
  TEST_PRIORITIES,
} from "../src/lib/testing/TestRequirementAnalyzer.js";

describe("TestRequirementAnalyzer - Column Test Mapping", () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new TestRequirementAnalyzer();
  });

  describe("generateColumnTestRequirements", () => {
    it("should generate test requirements for ADD_COLUMN operation", () => {
      const operation = {
        sql: "ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT 'user@example.com';",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer.generateColumnTestRequirements(
        operation,
        "users",
        "email",
        "ADD_COLUMN",
        TEST_PRIORITIES.HIGH,
      );

      expect(requirements).toHaveLength(1);

      const req = requirements[0];
      expect(req.type).toBe(TEST_TYPES.SCHEMA);
      expect(req.priority).toBe(TEST_PRIORITIES.HIGH);
      expect(req.description).toContain("email added to users");
      expect(req.target).toBe("users.email");
      expect(req.testCases).toContain("has_column()");
      expect(req.testCases).toContain("col_type_is()");
      expect(req.testCases).toContain("col_not_null()");
    });

    it("should generate test requirements for DROP_COLUMN operation", () => {
      const operation = {
        sql: "ALTER TABLE users DROP COLUMN old_field;",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer.generateColumnTestRequirements(
        operation,
        "users",
        "old_field",
        "DROP_COLUMN",
        TEST_PRIORITIES.HIGH,
      );

      expect(requirements).toHaveLength(2); // Drop test + comprehensive validation

      const dropReq = requirements[0];
      expect(dropReq.type).toBe(TEST_TYPES.SCHEMA);
      expect(dropReq.priority).toBe(TEST_PRIORITIES.CRITICAL);
      expect(dropReq.description).toContain("old_field dropped from users");
      expect(dropReq.testCases).toContain("hasnt_column()");
      expect(dropReq.metadata.destructive).toBe(true);
    });

    it("should generate test requirements for ALTER_TYPE operation", () => {
      const operation = {
        sql: "ALTER TABLE users ALTER COLUMN age TYPE INTEGER;",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer.generateColumnTestRequirements(
        operation,
        "users",
        "age",
        "ALTER_TYPE",
        TEST_PRIORITIES.HIGH,
      );

      expect(requirements).toHaveLength(3); // Type change + data migration + comprehensive validation

      const typeReq = requirements[0];
      expect(typeReq.type).toBe(TEST_TYPES.SCHEMA);
      expect(typeReq.description).toContain("age type change in users");
      expect(typeReq.testCases).toContain("col_type_is()");

      const migrationReq = requirements[1];
      expect(migrationReq.type).toBe(TEST_TYPES.DATA);
      expect(migrationReq.priority).toBe(TEST_PRIORITIES.CRITICAL);
      expect(migrationReq.description).toContain("data migration");
    });

    it("should generate test requirements for SET_NOT_NULL operation", () => {
      const operation = {
        sql: "ALTER TABLE users ALTER COLUMN name SET NOT NULL;",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer.generateColumnTestRequirements(
        operation,
        "users",
        "name",
        "SET_NOT_NULL",
        TEST_PRIORITIES.HIGH,
      );

      expect(requirements).toHaveLength(2); // NOT NULL test + comprehensive validation

      const nullReq = requirements[0];
      expect(nullReq.type).toBe(TEST_TYPES.CONSTRAINT);
      expect(nullReq.description).toContain("NOT NULL constraint");
      expect(nullReq.testCases).toContain("col_not_null()");
      expect(nullReq.metadata.constraintType).toBe("NOT NULL");
    });

    it("should generate test requirements for DROP_NOT_NULL operation", () => {
      const operation = {
        sql: "ALTER TABLE users ALTER COLUMN description DROP NOT NULL;",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer.generateColumnTestRequirements(
        operation,
        "users",
        "description",
        "DROP_NOT_NULL",
        TEST_PRIORITIES.MEDIUM,
      );

      expect(requirements).toHaveLength(1);

      const req = requirements[0];
      expect(req.type).toBe(TEST_TYPES.CONSTRAINT);
      expect(req.description).toContain("nullable constraint removed");
      expect(req.testCases).toContain("col_is_null() - column allows nulls");
      expect(req.metadata.constraintRemoved).toBe(true);
    });

    it("should generate test requirements for SET_DEFAULT operation", () => {
      const operation = {
        sql: "ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer.generateColumnTestRequirements(
        operation,
        "users",
        "status",
        "SET_DEFAULT",
        TEST_PRIORITIES.MEDIUM,
      );

      expect(requirements).toHaveLength(1);

      const req = requirements[0];
      expect(req.type).toBe(TEST_TYPES.CONSTRAINT);
      expect(req.description).toContain("default value set");
      expect(req.testCases).toContain("col_has_default()");
      expect(req.testCases).toContain("col_default_is()");
      expect(req.metadata.requiresInsertTest).toBe(true);
    });

    it("should generate test requirements for DROP_DEFAULT operation", () => {
      const operation = {
        sql: "ALTER TABLE users ALTER COLUMN status DROP DEFAULT;",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer.generateColumnTestRequirements(
        operation,
        "users",
        "status",
        "DROP_DEFAULT",
        TEST_PRIORITIES.MEDIUM,
      );

      expect(requirements).toHaveLength(1);

      const req = requirements[0];
      expect(req.type).toBe(TEST_TYPES.CONSTRAINT);
      expect(req.description).toContain("default value removed");
      expect(req.testCases).toContain("col_hasnt_default()");
      expect(req.metadata.defaultRemoved).toBe(true);
    });

    it("should handle unknown column operations gracefully", () => {
      const operation = {
        sql: "ALTER TABLE users ALTER COLUMN some_field SOME_UNKNOWN_OP;",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer.generateColumnTestRequirements(
        operation,
        "users",
        "some_field",
        "UNKNOWN_OP",
        TEST_PRIORITIES.LOW,
      );

      expect(requirements).toHaveLength(1);

      const req = requirements[0];
      expect(req.type).toBe(TEST_TYPES.SCHEMA);
      expect(req.priority).toBe(TEST_PRIORITIES.MEDIUM);
      expect(req.description).toContain("column some_field operation");
      expect(req.testCases).toContain("has_column()");
      expect(req.metadata.operationType).toBe("UNKNOWN_OP");
    });
  });

  describe("_generateConstraintTests", () => {
    it("should generate primary key constraint tests", () => {
      const operation = {
        sql: "ALTER TABLE users ADD CONSTRAINT pk_users PRIMARY KEY (id);",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer._generateConstraintTests(
        operation,
        "users",
        "pk_users",
        TEST_PRIORITIES.HIGH,
      );

      expect(requirements).toHaveLength(1);

      const req = requirements[0];
      expect(req.type).toBe(TEST_TYPES.CONSTRAINT);
      expect(req.priority).toBe(TEST_PRIORITIES.CRITICAL);
      expect(req.description).toContain("primary key constraint");
      expect(req.testCases).toContain("has_pk()");
    });

    it("should generate foreign key constraint tests", () => {
      const operation = {
        sql: "ALTER TABLE posts ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer._generateConstraintTests(
        operation,
        "posts",
        "fk_posts_user",
        TEST_PRIORITIES.HIGH,
      );

      expect(requirements).toHaveLength(1);

      const req = requirements[0];
      expect(req.type).toBe(TEST_TYPES.CONSTRAINT);
      expect(req.priority).toBe(TEST_PRIORITIES.HIGH);
      expect(req.description).toContain("foreign key constraint");
      expect(req.testCases).toContain("has_fk()");
      expect(req.testCases).toContain("fk_ok()");
      expect(req.metadata.referencedTable).toBe("users");
      expect(req.metadata.onDelete).toBe("CASCADE");
    });

    it("should generate check constraint tests", () => {
      const operation = {
        sql: "ALTER TABLE users ADD CONSTRAINT chk_age CHECK (age >= 18);",
        type: "ALTER_TABLE",
      };

      const requirements = analyzer._generateConstraintTests(
        operation,
        "users",
        "chk_age",
        TEST_PRIORITIES.HIGH,
      );

      expect(requirements).toHaveLength(1);

      const req = requirements[0];
      expect(req.type).toBe(TEST_TYPES.CONSTRAINT);
      expect(req.description).toContain("check constraint");
      expect(req.testCases).toContain("has_check()");
      expect(req.testCases).toContain("check_test()");
      expect(req.metadata.checkExpression).toBe("age >= 18");
    });
  });

  describe("Column parsing helpers", () => {
    it("should extract column names correctly", () => {
      expect(
        analyzer._extractColumnName(
          "ADD COLUMN email VARCHAR(255)",
          "ADD COLUMN",
        ),
      ).toBe("email");
      expect(
        analyzer._extractColumnName("DROP COLUMN old_field", "DROP COLUMN"),
      ).toBe("old_field");
      expect(
        analyzer._extractColumnName(
          "ALTER COLUMN name TYPE TEXT",
          "ALTER COLUMN",
        ),
      ).toBe("name");
    });

    it("should parse column definitions correctly", () => {
      const sql =
        "ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT 'user@example.com' UNIQUE";
      const metadata = analyzer._parseColumnConstraints(sql, "email");

      expect(metadata.type).toBe("VARCHAR(255)");
      expect(metadata.notNull).toBe(true);
      expect(metadata.hasDefault).toBe(true);
      expect(metadata.isUnique).toBe(true);
      expect(metadata.defaultValue).toBe("'user@example.com'");
    });

    it("should identify constraint types correctly", () => {
      expect(
        analyzer._identifyConstraintType(
          "ADD CONSTRAINT pk_test PRIMARY KEY (id)",
        ),
      ).toBe("PRIMARY_KEY");
      expect(
        analyzer._identifyConstraintType(
          "ADD CONSTRAINT fk_test FOREIGN KEY (user_id) REFERENCES users(id)",
        ),
      ).toBe("FOREIGN_KEY");
      expect(
        analyzer._identifyConstraintType(
          "ADD CONSTRAINT uk_test UNIQUE (email)",
        ),
      ).toBe("UNIQUE");
      expect(
        analyzer._identifyConstraintType(
          "ADD CONSTRAINT chk_test CHECK (age > 0)",
        ),
      ).toBe("CHECK");
    });
  });
});
