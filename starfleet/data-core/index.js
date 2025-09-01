/**
 * @fileoverview Main entry point for data-core package
 *
 * Pure JavaScript logic core for D.A.T.A. with zero I/O dependencies.
 * This package contains only business logic that accepts injected ports
 * for all external operations following the ports/adapters pattern.
 *
 * Key Features:
 * - SQL dependency graph analysis
 * - Migration diff calculation
 * - Execution plan compilation
 * - Comprehensive runtime validation
 * - ESM module exports
 */

// Export all port interfaces and dependency injection system
export {
  FileSystemPort,
  CryptoPort,
  ProcessPort,
  EnvironmentPort,
  validatePort,
  DIContainer,
  PortFactory,
  wireDataCore,
  createPortFactory
} from './ports/index.js';

// Export SQL dependency graph functionality
export {
  SqlNode,
  SqlGraph
} from './src/migration/SqlGraph.js';

// Export migration diff engine
export {
  OperationType,
  MigrationOperation,
  SchemaState,
  DiffEngine
} from './src/migration/DiffEngine.js';

// Export execution plan compiler
export {
  ExecutionPhase,
  ExecutionStep,
  ExecutionPlan,
  PlanCompiler
} from './src/migration/PlanCompiler.js';

// Export migration compiler
export {
  MigrationCompiler
} from './src/migration/MigrationCompiler.js';

// Export migration metadata
export {
  MigrationMetadata
} from './src/domain/MigrationMetadata.js';

// Export output configuration
export { default as OutputConfig } from './src/config/OutputConfig.js';

// Export testing domain types
export { TEST_TYPES, TEST_PRIORITIES } from './src/domain/testingTypes.js';

// Export test pattern library
export { PATTERNS, getPatternsByCategory, getPatternById } from './src/testing/patterns/index.js';

// Export pattern rendering
export {
  renderPattern,
  getRecommendedPatterns,
  generateEnhancedTemplate
} from './src/testing/render/renderPattern.js';

// Export test requirement analyzer
export {
  makeAnalyzeTestRequirements,
  AnalysisEvents
} from './src/application/makeAnalyzeTestRequirements.js';

/**
 * Package version information
 */
export const VERSION = '0.1.0';

// Import validatePort and port classes for use in DataCore
import {
  validatePort as validate,
  FileSystemPort,
  CryptoPort,
  ProcessPort,
  EnvironmentPort
} from './ports/index.js';

// Import core classes for DataCore
import { SqlGraph } from './src/migration/SqlGraph.js';
import { DiffEngine, SchemaState } from './src/migration/DiffEngine.js';
import { PlanCompiler } from './src/migration/PlanCompiler.js';

/**
 * Core migration workflow orchestrator
 * Demonstrates the complete migration pipeline using dependency injection
 */
export class DataCore {
  /**
   * @param {FileSystemPort} fileSystemPort - File system operations
   * @param {CryptoPort} cryptoPort - Cryptographic operations
   * @param {ProcessPort} processPort - Process execution
   * @param {EnvironmentPort} environmentPort - Environment access
   */
  constructor(fileSystemPort, cryptoPort, processPort, environmentPort) {
    validate(fileSystemPort, FileSystemPort);
    validate(cryptoPort, CryptoPort);
    validate(processPort, ProcessPort);
    validate(environmentPort, EnvironmentPort);

    this.fileSystemPort = fileSystemPort;
    this.cryptoPort = cryptoPort;
    this.processPort = processPort;
    this.environmentPort = environmentPort;

    // Initialize core engines with injected dependencies
    this.sqlGraph = new SqlGraph(fileSystemPort);
    this.diffEngine = new DiffEngine(cryptoPort);
    this.planCompiler = new PlanCompiler(processPort, environmentPort);
  }

  /**
   * Analyze SQL dependencies in a directory
   * @param {string} sqlDirectory - Directory containing SQL files
   * @returns {Promise<Object>} Dependency analysis results
   */
  async analyzeDependencies(sqlDirectory) {
    // Find all SQL files
    const sqlFiles = await this.fileSystemPort.glob(['**/*.sql'], sqlDirectory);

    // Build dependency graph
    await this.sqlGraph.buildGraph(sqlFiles);

    // Analyze the graph
    const executionOrder = this.sqlGraph.getExecutionOrder();
    const independentNodes = this.sqlGraph.getIndependentNodes();
    const terminalNodes = this.sqlGraph.getTerminalNodes();
    const hasCircularDeps = this.sqlGraph.hasCircularDependencies();

    return {
      totalFiles: sqlFiles.length,
      executionOrder: executionOrder.map(node => ({
        name: node.name,
        type: node.type,
        filePath: node.filePath,
        dependencies: Array.from(node.dependencies).map(dep => dep.name)
      })),
      independentNodes: independentNodes.map(node => node.name),
      terminalNodes: terminalNodes.map(node => node.name),
      hasCircularDependencies: hasCircularDeps
    };
  }

  /**
   * Generate migration plan from schema differences
   * @param {SchemaState} currentState - Current database schema
   * @param {SchemaState} targetState - Target database schema
   * @param {Object} [options={}] - Migration options
   * @returns {Object} Migration plan and analysis
   */
  generateMigrationPlan(currentState, targetState, options = {}) {
    // Calculate schema differences
    const operations = this.diffEngine.calculateDiff(currentState, targetState);

    // Optimize operations
    const optimizedOperations = this.diffEngine.optimizeOperations(operations);

    // Compile execution plan
    const executionPlan = this.planCompiler.compilePlan(optimizedOperations, {
      planId: `migration_${Date.now()}`,
      planName: 'Schema Migration',
      enableRollback: options.enableRollback ?? true,
      parallelExecution: options.parallelExecution ?? false
    });

    // Validate the plan
    const validation = this.planCompiler.validatePlan(executionPlan);

    return {
      operations: optimizedOperations.map(op => ({
        type: op.type,
        objectName: op.objectName,
        sql: op.sql,
        isDestructive: op.isDestructive(),
        hash: op.hash
      })),
      executionPlan: {
        id: executionPlan.id,
        name: executionPlan.name,
        stepCount: executionPlan.steps.length,
        estimatedTime: executionPlan.getTotalEstimatedTime(),
        phases: Array.from(executionPlan.phases.keys()).sort()
      },
      validation,
      rollbackPlan: validation.valid ? {
        id: `${executionPlan.id}_rollback`,
        stepCount: executionPlan.generateRollbackPlan().steps.length
      } : null
    };
  }

  /**
   * Create sample schema state for testing
   * @param {string} [name='sample'] - Schema name
   * @returns {SchemaState} Sample schema state
   */
  createSampleSchema(name = 'sample') {
    const schema = new SchemaState();

    // Add sample tables
    schema.addObject('tables', 'users', {
      columns: ['id', 'email', 'created_at'],
      sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255), created_at TIMESTAMP)'
    });

    schema.addObject('tables', 'posts', {
      columns: ['id', 'user_id', 'title', 'content'],
      sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title VARCHAR(255), content TEXT)'
    });

    // Add sample views
    schema.addObject('views', 'user_posts', {
      sql: 'CREATE VIEW user_posts AS SELECT u.email, p.title FROM users u JOIN posts p ON u.id = p.user_id'
    });

    // Add sample indexes
    schema.addObject('indexes', 'idx_posts_user_id', {
      table: 'posts',
      columns: ['user_id'],
      sql: 'CREATE INDEX idx_posts_user_id ON posts(user_id)'
    });

    // Generate checksum
    schema.generateChecksum(this.cryptoPort);

    return schema;
  }

  /**
   * Get package information and capabilities
   * @returns {Object} Package metadata and capabilities
   */
  getPackageInfo() {
    return {
      name: '@data/core',
      version: VERSION,
      type: 'pure-javascript',
      ioDepencencies: 'none',
      capabilities: {
        sqlDependencyAnalysis: true,
        migrationDiffCalculation: true,
        executionPlanCompilation: true,
        rollbackPlanGeneration: true,
        circularDependencyDetection: true,
        operationOptimization: true
      },
      portInterfaces: [
        'FileSystemPort',
        'CryptoPort',
        'ProcessPort',
        'EnvironmentPort'
      ],
      coreEngines: [
        'SqlGraph',
        'DiffEngine',
        'PlanCompiler'
      ]
    };
  }
}
