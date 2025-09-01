/**
 * @fileoverview Domain types for testing requirements
 * Pure data structures with no dependencies
 */

/**
 * Test requirement types
 * @readonly
 * @enum {string}
 */
export const TEST_TYPES = {
  SCHEMA: 'SCHEMA', // Table structure tests
  DATA: 'DATA', // Data integrity tests
  CONSTRAINT: 'CONSTRAINT', // Constraint validation tests
  INDEX: 'INDEX', // Index existence and performance tests
  FUNCTION: 'FUNCTION', // Function behavior tests
  TRIGGER: 'TRIGGER', // Trigger functionality tests
  RLS: 'RLS', // Row Level Security tests
  VIEW: 'VIEW', // View definition tests
  ENUM: 'ENUM', // Enum type tests
  PERMISSION: 'PERMISSION' // Permission and security tests
};

/**
 * Test priority levels
 * @readonly
 * @enum {string}
 */
export const TEST_PRIORITIES = {
  CRITICAL: 'CRITICAL', // Must have - blocks deployment
  HIGH: 'HIGH', // Should have - important coverage
  MEDIUM: 'MEDIUM', // Nice to have - good practice
  LOW: 'LOW' // Optional - comprehensive coverage
};

/**
 * Test requirement object
 * @typedef {Object} TestRequirement
 * @property {string} type - Test type from TEST_TYPES
 * @property {string} priority - Test priority from TEST_PRIORITIES
 * @property {string} description - Human-readable description
 * @property {string} target - Target object (table, column, function, etc.)
 * @property {Array<string>} testCases - Suggested test cases to implement
 * @property {Object} metadata - Additional context for test generation
 * @property {Object} vars - Variables for pattern rendering
 * @property {string} [reason] - Why this test is required
 * @property {Array<string>} [dependencies] - Other tests this depends on
 */

/**
 * Test analysis result
 * @typedef {Object} TestAnalysis
 * @property {Array<TestRequirement>} requirements - All test requirements
 * @property {Object} summary - Summary statistics
 * @property {Array<string>} suggestions - High-level testing suggestions
 * @property {number} estimatedEffort - Estimated effort in hours
 * @property {Array<string>} riskAreas - Areas requiring extra attention
 */
