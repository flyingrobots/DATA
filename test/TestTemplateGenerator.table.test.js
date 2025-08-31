import { describe, it, expect, beforeEach } from "vitest";
import TestTemplateGenerator from "../src/lib/testing/TestTemplateGenerator.js";

describe("TestTemplateGenerator - Table Tests", () => {
  let generator;

  beforeEach(() => {
    generator = new TestTemplateGenerator();
  });

  describe("generateTableTemplate", () => {
    it("should generate basic table template with minimal configuration", () => {
      const requirement = {
        type: "table",
        name: "users",
        schema: "public",
      };

      const template = generator.generateTemplate(requirement);

      expect(template).toBeDefined();
      expect(template.type).toBe("table");
      expect(template.filename).toBe("users.test.sql");
      expect(template.directory).toBe("001_table_tests");
      expect(template.content).toContain(
        "CREATE OR REPLACE FUNCTION test.run_users_table_tests()",
      );
      expect(template.content).toContain("has_table");
      expect(template.content).toContain("hasnt_view");
    });

    it("should generate comprehensive table template with full metadata", () => {
      const requirement = {
        type: "table",
        name: "users",
        schema: "public",
        description: "User management table",
        metadata: {
          columns: [
            {
              targetName: "id",
              metadata: {
                expectedType: "uuid",
                expectedNotNull: true,
                isPrimaryKey: true,
                expectedHasDefault: true,
                expectedDefaultValue: "gen_random_uuid()",
              },
            },
            {
              targetName: "email",
              metadata: {
                expectedType: "text",
                expectedNotNull: true,
                isUnique: true,
              },
            },
          ],
          indexes: [
            {
              targetName: "users_pkey",
              metadata: {
                indexedColumns: ["id"],
                isUnique: true,
                isPrimaryKey: true,
              },
            },
          ],
          expectedConstraints: ["users_email_check"],
          requiresRowLevelSecurity: true,
        },
      };

      const template = generator.generateTemplate(requirement);

      // Basic template structure
      expect(template.content).toContain("run_users_table_tests");
      expect(template.content).toContain("User management table");

      // Column tests
      expect(template.content).toContain("has_column");
      expect(template.content).toContain("col_type_is");
      expect(template.content).toContain("col_not_null");
      expect(template.content).toContain("col_has_default");
      expect(template.content).toContain("col_default_is");
      expect(template.content).toContain("col_is_pk");
      expect(template.content).toContain("has_unique");

      // Index tests
      expect(template.content).toContain("has_index");
      expect(template.content).toContain("index_is_unique");
      expect(template.content).toContain("has_pk");

      // Constraint tests
      expect(template.content).toContain("has_check");
      expect(template.content).toContain("users_email_check");

      // RLS tests
      expect(template.content).toContain("rowsecurity = true");
      expect(template.content).toContain("pg_policies");

      // Privilege tests
      expect(template.content).toContain("has_table_privilege");
      expect(template.content).toContain("service_role");
      expect(template.content).toContain("anon");
    });

    it("should handle foreign key relationships", () => {
      const requirement = {
        type: "table",
        name: "posts",
        metadata: {
          columns: [
            {
              targetName: "user_id",
              metadata: {
                expectedType: "uuid",
                isForeignKey: true,
                referencedTable: "users",
                referencedColumn: "id",
              },
            },
          ],
        },
      };

      const template = generator.generateTemplate(requirement);

      expect(template.content).toContain("fk_ok");
      expect(template.content).toContain("users");
      expect(template.content).toContain("user_id");
      expect(template.content).toContain(
        "Foreign key user_id references users.id",
      );
    });

    it("should calculate appropriate plan count for complex tables", () => {
      const requirement = {
        type: "table",
        name: "complex_table",
        metadata: {
          columns: [
            { targetName: "id", metadata: {} },
            { targetName: "name", metadata: {} },
            { targetName: "email", metadata: {} },
          ],
          indexes: [
            { targetName: "idx1", metadata: {} },
            { targetName: "idx2", metadata: {} },
          ],
          expectedConstraints: ["constraint1", "constraint2"],
          requiresRowLevelSecurity: true,
        },
      };

      const template = generator.generateTemplate(requirement);

      // Base count (12) + columns (3*2=6) + constraints (2*2=4) + indexes (2*2=4) + RLS (3) = 29
      expect(template.content).toContain("tap.plan(29)");
    });

    it("should handle tables without optional metadata gracefully", () => {
      const requirement = {
        type: "table",
        name: "simple_table",
      };

      const template = generator.generateTemplate(requirement);

      expect(template.content).toContain("run_simple_table_table_tests");
      expect(template.content).toContain("TODO: Add specific column tests");
      expect(template.content).toContain(
        "TODO: Add constraint validation tests",
      );
      expect(template.content).toContain("has_pk"); // Should still check for primary key
      expect(template.content).not.toContain("ROW LEVEL SECURITY TESTS");
    });

    it("should generate proper SQL formatting", () => {
      const requirement = {
        type: "table",
        name: "test_table",
      };

      const template = generator.generateTemplate(requirement);

      // Check proper pgTAP structure
      expect(template.content).toContain("LANGUAGE plpgsql");
      expect(template.content).toContain("SECURITY DEFINER");
      expect(template.content).toContain(
        "SET search_path = test, public, security",
      );
      expect(template.content).toContain("RETURN NEXT tap.plan(");
      expect(template.content).toContain("RETURN NEXT tap.finish();");
      expect(template.content).toContain("GRANT EXECUTE ON FUNCTION");
      expect(template.content).toContain("COMMENT ON FUNCTION");
    });
  });

  describe("generateBatch", () => {
    it("should handle batch table template generation", () => {
      const requirements = [
        {
          type: "table",
          name: "users",
        },
        {
          type: "table",
          name: "posts",
        },
      ];

      const result = generator.generateBatch(requirements);

      expect(result.totalGenerated).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.table).toBe(2);
      expect(result.templates).toHaveLength(2);
      expect(result.templates[0].filename).toBe("users.test.sql");
      expect(result.templates[1].filename).toBe("posts.test.sql");
    });
  });

  describe("validation", () => {
    it("should validate table requirements correctly", () => {
      const validRequirement = {
        type: "table",
        name: "valid_table",
      };

      expect(() => generator.generateTemplate(validRequirement)).not.toThrow();
    });

    it("should reject invalid table names", () => {
      const invalidRequirement = {
        type: "table",
        name: "invalid-table-name",
      };

      expect(() => generator.generateTemplate(invalidRequirement)).toThrow(
        "Name must contain only letters, numbers, and underscores",
      );
    });
  });
});
