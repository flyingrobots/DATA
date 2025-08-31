/**
 * @supa-data/core - Pure JavaScript Logic Core
 * 
 * This module exports all the pure business logic classes and utilities
 * that have zero I/O dependencies. Perfect for testing, server-side rendering,
 * or any environment where you need the core logic without file system access.
 */

// Core utilities
export { default as PathResolver } from './PathResolver.js';
export { default as DataInputPaths } from './DataInputPaths.js';
export { default as DataOutputPaths } from './DataOutputPaths.js';
export { default as ConfigSchema } from './ConfigSchema.js';

// Error handling
export { default as dataErrorBase } from './ArchyErrorBase.js';

// Migration logic
export { default as MigrationMetadata } from './MigrationMetadata.js';
export { default as GitDeploymentLogic } from './GitDeploymentTracker.js';

// Safety gates
export { default as SafetyGateRules } from './SafetyGates.js';

// Schema definitions
export * from './schemas/DataConfigSchema.js';

// Test utilities
export { default as ResultParser } from './test/ResultParser.js';
export { default as CoverageAnalyzer } from './test/CoverageAnalyzer.js';

// Testing libraries
export { default as TestPatternLibrary } from './testing/TestPatternLibrary.js';
export { default as TestRequirementSchema } from './testing/TestRequirementSchema.js';

// Migration engines (pure logic parts)
export { default as ASTMigrationEngine } from './migration/ASTMigrationEngine.js';
export { default as SchemaDiffAnalyzer } from './migration/SchemaDiffAnalyzer.js';

// Re-export commonly used constants
export const DEPLOYMENT_TAG_PREFIX = 'data-deploy-';