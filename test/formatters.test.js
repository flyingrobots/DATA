/**
 * Test the new formatters (JUnit XML and JSON)
 */

import { describe, it, expect } from "vitest";
import {
  JUnitFormatter,
  JSONFormatter,
} from "../src/lib/test/formatters/index.js";

describe("Test Result Formatters", () => {
  const mockResults = {
    total: 3,
    passed: 2,
    failed: 1,
    skipped: 0,
    tests: [
      {
        description: "test_get_pets: Should return available pets",
        status: "pass",
        function: "run_pet_tests",
        number: 1,
      },
      {
        description: "test_create_application: Should create application",
        status: "fail",
        function: "run_application_tests",
        number: 2,
      },
      {
        description: "test_donation: Should process donation",
        status: "pass",
        function: "run_payment_tests",
        number: 3,
      },
    ],
    diagnostics: ["Database connection successful"],
    testFunctions: [
      {
        name: "run_pet_tests",
        passed: 1,
        failed: 0,
        skipped: 0,
        total: 1,
        success: true,
      },
      {
        name: "run_application_tests",
        passed: 0,
        failed: 1,
        skipped: 0,
        total: 1,
        success: false,
      },
      {
        name: "run_payment_tests",
        passed: 1,
        failed: 0,
        skipped: 0,
        total: 1,
        success: true,
      },
    ],
  };

  describe("JUnitFormatter", () => {
    it("should format results as valid JUnit XML", () => {
      const formatter = new JUnitFormatter();
      const xml = formatter.format(mockResults);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain("<testsuites>");
      expect(xml).toContain(
        '<testsuite name="pgTAP Tests" tests="3" failures="1" skipped="0"',
      );
      expect(xml).toContain(
        '<testcase name="test_get_pets: Should return available pets"',
      );
      expect(xml).toContain('<failure message="Test failed"/>');
      expect(xml).toContain("</testsuites>");
    });

    it("should escape XML special characters", () => {
      const resultsWithSpecialChars = {
        ...mockResults,
        tests: [
          {
            description: 'test with <special> & "characters"',
            status: "pass",
            function: "test_func",
            number: 1,
          },
        ],
        total: 1,
        passed: 1,
        failed: 0,
        testFunctions: [],
      };

      const formatter = new JUnitFormatter();
      const xml = formatter.format(resultsWithSpecialChars);

      expect(xml).toContain("&lt;special&gt; &amp; &quot;characters&quot;");
    });

    it("should return .xml file extension", () => {
      const formatter = new JUnitFormatter();
      expect(formatter.getFileExtension()).toBe(".xml");
    });
  });

  describe("JSONFormatter", () => {
    it("should format results as valid JSON", () => {
      const formatter = new JSONFormatter();
      const jsonString = formatter.format(mockResults);

      const parsed = JSON.parse(jsonString);

      expect(parsed.stats.total).toBe(3);
      expect(parsed.stats.passed).toBe(2);
      expect(parsed.stats.failed).toBe(1);
      expect(parsed.stats.success).toBe(false);
      expect(parsed.tests).toHaveLength(3);
      expect(parsed.testFunctions).toHaveLength(3);
    });

    it("should include metadata", () => {
      const formatter = new JSONFormatter();
      const jsonString = formatter.format(mockResults);
      const parsed = JSON.parse(jsonString);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.format).toBe("json");
      expect(parsed.metadata.version).toBe("1.0");
      expect(parsed.metadata.timestamp).toBeDefined();
      expect(parsed.metadata.duration).toBeDefined();
    });

    it("should calculate pass rates", () => {
      const formatter = new JSONFormatter();
      const jsonString = formatter.format(mockResults);
      const parsed = JSON.parse(jsonString);

      expect(parsed.summary.passRate).toBe("66.7"); // 2/3 * 100
      expect(parsed.summary.failRate).toBe("33.3"); // 1/3 * 100
      expect(parsed.summary.skipRate).toBe("0.0"); // 0/3 * 100
    });

    it("should return .json file extension", () => {
      const formatter = new JSONFormatter();
      expect(formatter.getFileExtension()).toBe(".json");
    });
  });
});
