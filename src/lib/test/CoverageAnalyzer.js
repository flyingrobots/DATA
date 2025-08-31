const chalk = require("chalk");

/**
 * Test Coverage Analyzer
 *
 * Processes test coverage data from database queries and formats results
 * with color coding and statistics.
 */
class CoverageAnalyzer {
  constructor() {
    this.coverageThresholds = {
      good: 80, // Green: >80% coverage
      medium: 50, // Yellow: 50-80%, Red: <50%
    };
  }

  /**
   * Analyze and format RPC function coverage results
   * @param {Array} rpcResults - Results from test.analyze_rpc_coverage()
   * @returns {Object} Formatted RPC coverage analysis
   */
  analyzeRpcCoverage(rpcResults) {
    if (!rpcResults || rpcResults.length === 0) {
      return {
        total: 0,
        tested: 0,
        percentage: 0,
        items: [],
        untested: [],
      };
    }

    const tested = rpcResults.filter((item) => item.has_test);
    const untested = rpcResults.filter((item) => !item.has_test);
    const percentage = Math.round((tested.length / rpcResults.length) * 100);

    // Group by schema
    const bySchema = rpcResults.reduce((acc, item) => {
      if (!acc[item.schema_name]) {
        acc[item.schema_name] = [];
      }
      acc[item.schema_name].push(item);
      return acc;
    }, {});

    return {
      total: rpcResults.length,
      tested: tested.length,
      percentage,
      items: rpcResults,
      untested,
      bySchema,
      colorClass: this.getColorClass(percentage),
    };
  }

  /**
   * Analyze and format RLS policy coverage results
   * @param {Array} policyResults - Results from test.analyze_policy_coverage()
   * @returns {Object} Formatted RLS policy coverage analysis
   */
  analyzePolicyCoverage(policyResults) {
    if (!policyResults || policyResults.length === 0) {
      return {
        total: 0,
        tested: 0,
        percentage: 0,
        items: [],
        untested: [],
      };
    }

    const tested = policyResults.filter((item) => item.has_test);
    const untested = policyResults.filter((item) => !item.has_test);
    const percentage = Math.round((tested.length / policyResults.length) * 100);

    // Group by table
    const byTable = policyResults.reduce((acc, item) => {
      const key = `${item.schema_name}.${item.table_name}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});

    return {
      total: policyResults.length,
      tested: tested.length,
      percentage,
      items: policyResults,
      untested,
      byTable,
      colorClass: this.getColorClass(percentage),
    };
  }

  /**
   * Process overall coverage summary
   * @param {Array} summaryResults - Results from test.get_coverage_summary()
   * @returns {Object} Formatted summary
   */
  processCoverageSummary(summaryResults) {
    if (!summaryResults || summaryResults.length === 0) {
      return {
        rpc: { total: 0, tested: 0, percentage: 0 },
        policies: { total: 0, tested: 0, percentage: 0 },
      };
    }

    const summary = {};
    summaryResults.forEach((item) => {
      if (item.coverage_type === "RPC Functions") {
        summary.rpc = {
          total: item.total_count,
          tested: item.tested_count,
          percentage: parseFloat(item.coverage_percentage),
        };
      } else if (item.coverage_type === "RLS Policies") {
        summary.policies = {
          total: item.total_count,
          tested: item.tested_count,
          percentage: parseFloat(item.coverage_percentage),
        };
      }
    });

    return summary;
  }

  /**
   * Get color class based on coverage percentage
   * @param {number} percentage - Coverage percentage
   * @returns {string} Color class identifier
   */
  getColorClass(percentage) {
    if (percentage >= this.coverageThresholds.good) return "good";
    if (percentage >= this.coverageThresholds.medium) return "medium";
    return "poor";
  }

  /**
   * Apply color to text based on coverage percentage
   * @param {string} text - Text to colorize
   * @param {number} percentage - Coverage percentage
   * @returns {string} Colorized text
   */
  colorizeByPercentage(text, percentage) {
    const colorClass = this.getColorClass(percentage);
    switch (colorClass) {
      case "good":
        return chalk.green(text);
      case "medium":
        return chalk.yellow(text);
      case "poor":
        return chalk.red(text);
      default:
        return text;
    }
  }

  /**
   * Format coverage report for console output
   * @param {Object} rpcAnalysis - RPC coverage analysis
   * @param {Object} policyAnalysis - Policy coverage analysis
   * @param {Object} summary - Coverage summary
   * @returns {string} Formatted report
   */
  formatCoverageReport(rpcAnalysis, policyAnalysis, summary) {
    const output = [];

    // Header
    output.push(chalk.bold.blue("=== Test Coverage Report ===\n"));

    // Overall Summary
    if (summary && (summary.rpc || summary.policies)) {
      output.push(chalk.bold("📊 Overall Coverage Summary:"));

      if (summary.rpc) {
        const rpcText = `RPC Functions: ${summary.rpc.percentage}% (${summary.rpc.tested}/${summary.rpc.total})`;
        output.push(
          `  ${this.colorizeByPercentage(rpcText, summary.rpc.percentage)}`,
        );
      }

      if (summary.policies) {
        const policyText = `RLS Policies: ${summary.policies.percentage}% (${summary.policies.tested}/${summary.policies.total})`;
        output.push(
          `  ${this.colorizeByPercentage(policyText, summary.policies.percentage)}`,
        );
      }

      output.push("");
    }

    // RPC Function Details
    if (rpcAnalysis && rpcAnalysis.total > 0) {
      const rpcTitle = `🔧 RPC Function Coverage: ${rpcAnalysis.percentage}% (${rpcAnalysis.tested}/${rpcAnalysis.total})`;
      output.push(
        chalk.bold(this.colorizeByPercentage(rpcTitle, rpcAnalysis.percentage)),
      );

      // Group by schema
      Object.keys(rpcAnalysis.bySchema)
        .sort()
        .forEach((schema) => {
          output.push(chalk.cyan(`\n  ${schema} schema:`));

          rpcAnalysis.bySchema[schema].forEach((func) => {
            const status = func.has_test ? "✓" : "✗";
            const color = func.has_test ? chalk.green : chalk.red;
            const testInfo = func.has_test
              ? `(${func.test_count} test${func.test_count !== 1 ? "s" : ""})`
              : "(0 tests)";

            output.push(
              `    ${color(status)} ${func.function_name} ${chalk.gray(testInfo)}`,
            );

            // Show test function names if available
            if (
              func.has_test &&
              func.test_function_names &&
              func.test_function_names.length > 0
            ) {
              func.test_function_names.forEach((testName) => {
                output.push(`      ${chalk.gray("↳")} ${chalk.gray(testName)}`);
              });
            }
          });
        });
    }

    // RLS Policy Details
    if (policyAnalysis && policyAnalysis.total > 0) {
      output.push("");
      const policyTitle = `🛡️  RLS Policy Coverage: ${policyAnalysis.percentage}% (${policyAnalysis.tested}/${policyAnalysis.total})`;
      output.push(
        chalk.bold(
          this.colorizeByPercentage(policyTitle, policyAnalysis.percentage),
        ),
      );

      // Group by table
      Object.keys(policyAnalysis.byTable)
        .sort()
        .forEach((table) => {
          output.push(chalk.cyan(`\n  ${table}:`));

          policyAnalysis.byTable[table].forEach((policy) => {
            const status = policy.has_test ? "✓" : "✗";
            const color = policy.has_test ? chalk.green : chalk.red;
            const testInfo =
              policy.has_test && policy.test_evidence
                ? `(${policy.test_evidence.length} test${policy.test_evidence.length !== 1 ? "s" : ""})`
                : "(0 tests)";

            output.push(
              `    ${color(status)} ${policy.policy_name} [${policy.policy_type}] ${chalk.gray(testInfo)}`,
            );

            // Show test evidence if available
            if (
              policy.has_test &&
              policy.test_evidence &&
              policy.test_evidence.length > 0
            ) {
              policy.test_evidence.forEach((testName) => {
                output.push(`      ${chalk.gray("↳")} ${chalk.gray(testName)}`);
              });
            }
          });
        });
    }

    // Untested Items Summary
    const allUntested = [];
    if (rpcAnalysis && rpcAnalysis.untested.length > 0) {
      allUntested.push(
        ...rpcAnalysis.untested.map((item) => ({
          type: "RPC Function",
          name: `${item.schema_name}.${item.function_name}`,
          schema: item.schema_name,
        })),
      );
    }
    if (policyAnalysis && policyAnalysis.untested.length > 0) {
      allUntested.push(
        ...policyAnalysis.untested.map((item) => ({
          type: "RLS Policy",
          name: `${item.schema_name}.${item.table_name}.${item.policy_name}`,
          schema: item.schema_name,
        })),
      );
    }

    if (allUntested.length > 0) {
      output.push("\n" + chalk.bold.red("🚨 Untested Items:"));
      allUntested.forEach((item) => {
        output.push(
          `  ${chalk.red("•")} ${chalk.gray(`[${item.type}]`)} ${item.name}`,
        );
      });
    }

    // No coverage found message
    if (
      (!rpcAnalysis || rpcAnalysis.total === 0) &&
      (!policyAnalysis || policyAnalysis.total === 0)
    ) {
      output.push(
        chalk.yellow(
          "⚠️  No RPC functions or RLS policies found for coverage analysis.",
        ),
      );
      output.push(chalk.gray("   This could mean:"));
      output.push(
        chalk.gray(
          "   • No functions/policies exist in public, private, or security schemas",
        ),
      );
      output.push(chalk.gray("   • Database connection issues"));
      output.push(chalk.gray("   • Test schema is not properly configured"));
    }

    output.push(""); // Final newline
    return output.join("\n");
  }

  /**
   * Generate coverage statistics for programmatic use
   * @param {Object} rpcAnalysis - RPC coverage analysis
   * @param {Object} policyAnalysis - Policy coverage analysis
   * @returns {Object} Coverage statistics
   */
  generateCoverageStats(rpcAnalysis, policyAnalysis) {
    const totalItems = (rpcAnalysis?.total || 0) + (policyAnalysis?.total || 0);
    const totalTested =
      (rpcAnalysis?.tested || 0) + (policyAnalysis?.tested || 0);
    const overallPercentage =
      totalItems > 0 ? Math.round((totalTested / totalItems) * 100) : 0;

    return {
      overall: {
        total: totalItems,
        tested: totalTested,
        percentage: overallPercentage,
        colorClass: this.getColorClass(overallPercentage),
      },
      rpc: rpcAnalysis
        ? {
            total: rpcAnalysis.total,
            tested: rpcAnalysis.tested,
            percentage: rpcAnalysis.percentage,
            colorClass: rpcAnalysis.colorClass,
          }
        : null,
      policies: policyAnalysis
        ? {
            total: policyAnalysis.total,
            tested: policyAnalysis.tested,
            percentage: policyAnalysis.percentage,
            colorClass: policyAnalysis.colorClass,
          }
        : null,
    };
  }
}

module.exports = CoverageAnalyzer;
