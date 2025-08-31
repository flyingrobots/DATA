/**
 * Execution plan compiler for orchestrating migration operations.
 * Compiles migration operations into executable plans with dependency resolution,
 * rollback strategies, and execution phases.
 * 
 * @fileoverview Migration execution planning and compilation
 */

import { ProcessPort, EnvironmentPort, validatePort } from '../ports/index.js';

/**
 * Execution phases for migration operations
 * @readonly
 * @enum {number}
 */
export const ExecutionPhase = {
  PRE_MIGRATION: 0,
  SCHEMA_DROP: 1,
  SCHEMA_CREATE: 2,
  DATA_MIGRATION: 3,
  POST_MIGRATION: 4,
  VALIDATION: 5
};

/**
 * Represents a single execution step in a migration plan
 */
export class ExecutionStep {
  /**
   * @param {string} id - Unique step identifier
   * @param {string} description - Human-readable step description
   * @param {string[]} sql - SQL statements to execute
   * @param {number} phase - Execution phase
   * @param {Object} [options={}] - Step execution options
   */
  constructor(id, description, sql, phase, options = {}) {
    this.id = id;
    this.description = description;
    this.sql = Array.isArray(sql) ? sql : [sql];
    this.phase = phase;
    this.options = {
      canRollback: true,
      timeout: 30000,
      retryCount: 0,
      continueOnError: false,
      ...options
    };
    this.dependencies = new Set();
    this.rollbackSql = [];
    this.executed = false;
    this.result = null;
  }

  /**
   * Add dependency to this step
   * @param {ExecutionStep} step - Step this depends on
   */
  addDependency(step) {
    this.dependencies.add(step);
  }

  /**
   * Set rollback SQL for this step
   * @param {string[]} sql - Rollback SQL statements
   */
  setRollbackSql(sql) {
    this.rollbackSql = Array.isArray(sql) ? sql : [sql];
  }

  /**
   * Check if step is ready for execution (all dependencies completed)
   * @returns {boolean} True if ready to execute
   */
  isReady() {
    return Array.from(this.dependencies).every(dep => dep.executed);
  }

  /**
   * Get estimated execution time in milliseconds
   * @returns {number} Estimated execution time
   */
  getEstimatedTime() {
    // Simple heuristic based on SQL statement count and complexity
    const baseTime = 1000; // 1 second base
    const sqlComplexity = this.sql.reduce((total, statement) => {
      const keywords = (statement.match(/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/gi) || []).length;
      const tables = (statement.match(/\b(FROM|JOIN|INTO|TABLE)\s+\w+/gi) || []).length;
      return total + keywords * 500 + tables * 200;
    }, 0);
    
    return baseTime + sqlComplexity;
  }
}

/**
 * Represents a complete migration execution plan
 */
export class ExecutionPlan {
  /**
   * @param {string} id - Unique plan identifier
   * @param {string} name - Plan name/description
   */
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.steps = [];
    this.phases = new Map();
    this.metadata = {};
    this.compiled = false;
  }

  /**
   * Add execution step to the plan
   * @param {ExecutionStep} step - Step to add
   */
  addStep(step) {
    this.steps.push(step);
    
    // Group by phase
    if (!this.phases.has(step.phase)) {
      this.phases.set(step.phase, []);
    }
    this.phases.get(step.phase).push(step);
    
    this.compiled = false;
  }

  /**
   * Get steps in execution order
   * @returns {ExecutionStep[]} Steps sorted by dependencies and phase
   */
  getExecutionOrder() {
    const sortedSteps = [...this.steps];
    
    // Sort by phase first, then by dependencies
    sortedSteps.sort((a, b) => {
      if (a.phase !== b.phase) {
        return a.phase - b.phase;
      }
      
      // Within same phase, dependencies determine order
      if (a.dependencies.has(b)) return 1;
      if (b.dependencies.has(a)) return -1;
      return 0;
    });
    
    return sortedSteps;
  }

  /**
   * Get total estimated execution time
   * @returns {number} Total estimated time in milliseconds
   */
  getTotalEstimatedTime() {
    return this.steps.reduce((total, step) => total + step.getEstimatedTime(), 0);
  }

  /**
   * Check if plan has circular dependencies
   * @returns {boolean} True if circular dependencies exist
   */
  hasCircularDependencies() {
    const visited = new Set();
    const visiting = new Set();
    
    const visit = (step) => {
      if (visiting.has(step)) return true;
      if (visited.has(step)) return false;
      
      visiting.add(step);
      for (const dep of step.dependencies) {
        if (visit(dep)) return true;
      }
      visiting.delete(step);
      visited.add(step);
      return false;
    };
    
    return this.steps.some(step => visit(step));
  }

  /**
   * Generate rollback plan
   * @returns {ExecutionPlan} Rollback execution plan
   */
  generateRollbackPlan() {
    const rollbackPlan = new ExecutionPlan(`${this.id}_rollback`, `Rollback: ${this.name}`);
    
    // Create rollback steps in reverse order
    const executedSteps = this.steps.filter(step => step.executed && step.options.canRollback);
    executedSteps.reverse();
    
    for (const [index, step] of executedSteps.entries()) {
      if (step.rollbackSql.length > 0) {
        const rollbackStep = new ExecutionStep(
          `rollback_${step.id}`,
          `Rollback: ${step.description}`,
          step.rollbackSql,
          ExecutionPhase.SCHEMA_DROP,
          { canRollback: false, timeout: step.options.timeout }
        );
        rollbackPlan.addStep(rollbackStep);
      }
    }
    
    return rollbackPlan;
  }
}

/**
 * Migration execution plan compiler
 */
export class PlanCompiler {
  /**
   * @param {ProcessPort} processPort - Process adapter
   * @param {EnvironmentPort} environmentPort - Environment adapter
   */
  constructor(processPort, environmentPort) {
    validatePort(processPort, ProcessPort);
    validatePort(environmentPort, EnvironmentPort);
    this.processPort = processPort;
    this.environmentPort = environmentPort;
  }

  /**
   * Compile migration operations into execution plan
   * @param {MigrationOperation[]} operations - Migration operations
   * @param {Object} [options={}] - Compilation options
   * @returns {ExecutionPlan} Compiled execution plan
   */
  compilePlan(operations, options = {}) {
    const {
      planId = `plan_${Date.now()}`,
      planName = 'Migration Plan',
      enableRollback = true,
      parallelExecution = false
    } = options;
    
    const plan = new ExecutionPlan(planId, planName);
    plan.metadata = { enableRollback, parallelExecution, createdAt: new Date().toISOString() };
    
    // Group operations by phase
    const phaseGroups = this._groupOperationsByPhase(operations);
    
    // Create execution steps for each phase
    for (const [phase, phaseOps] of phaseGroups) {
      this._createPhaseSteps(plan, phase, phaseOps, enableRollback);
    }
    
    // Add validation steps
    this._addValidationSteps(plan, operations);
    
    // Resolve dependencies
    this._resolveDependencies(plan);
    
    plan.compiled = true;
    return plan;
  }

  /**
   * Group operations by execution phase
   * @param {MigrationOperation[]} operations - Operations to group
   * @returns {Map<number, MigrationOperation[]>} Operations grouped by phase
   * @private
   */
  _groupOperationsByPhase(operations) {
    const phaseMap = new Map();
    
    for (const op of operations) {
      const phase = this._getOperationPhase(op);
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, []);
      }
      phaseMap.get(phase).push(op);
    }
    
    return phaseMap;
  }

  /**
   * Determine execution phase for operation
   * @param {MigrationOperation} operation - Operation to analyze
   * @returns {number} Execution phase
   * @private
   */
  _getOperationPhase(operation) {
    if (operation.isDestructive()) {
      return ExecutionPhase.SCHEMA_DROP;
    }
    
    if (operation.type <= 8) { // Schema operations
      return ExecutionPhase.SCHEMA_CREATE;
    }
    
    return ExecutionPhase.DATA_MIGRATION;
  }

  /**
   * Create execution steps for a phase
   * @param {ExecutionPlan} plan - Plan to add steps to
   * @param {number} phase - Execution phase
   * @param {MigrationOperation[]} operations - Phase operations
   * @param {boolean} enableRollback - Whether to generate rollback SQL
   * @private
   */
  _createPhaseSteps(plan, phase, operations, enableRollback) {
    for (const op of operations) {
      const step = new ExecutionStep(
        `step_${op.objectName}_${op.type}`,
        `${this._getOperationDescription(op.type)} ${op.objectName}`,
        [op.sql],
        phase,
        {
          canRollback: enableRollback && !op.isDestructive(),
          timeout: this._getOperationTimeout(op),
          continueOnError: false
        }
      );
      
      if (enableRollback) {
        step.setRollbackSql(this._generateRollbackSql(op));
      }
      
      plan.addStep(step);
    }
  }

  /**
   * Get human-readable description for operation type
   * @param {number} operationType - Operation type
   * @returns {string} Operation description
   * @private
   */
  _getOperationDescription(operationType) {
    const descriptions = {
      0: 'Create table',
      1: 'Drop table',
      2: 'Alter table',
      3: 'Create index',
      4: 'Drop index',
      5: 'Create function',
      6: 'Drop function',
      7: 'Create view',
      8: 'Drop view',
      9: 'Insert data',
      10: 'Update data',
      11: 'Delete data'
    };
    return descriptions[operationType] || 'Execute';
  }

  /**
   * Get timeout for operation type
   * @param {MigrationOperation} operation - Operation
   * @returns {number} Timeout in milliseconds
   * @private
   */
  _getOperationTimeout(operation) {
    const timeouts = {
      0: 60000,  // CREATE TABLE
      1: 30000,  // DROP TABLE
      2: 120000, // ALTER TABLE
      3: 30000,  // CREATE INDEX
      4: 15000,  // DROP INDEX
      9: 300000, // INSERT DATA
      10: 300000 // UPDATE DATA
    };
    return timeouts[operation.type] || 60000;
  }

  /**
   * Generate rollback SQL for operation
   * @param {MigrationOperation} operation - Operation
   * @returns {string[]} Rollback SQL statements
   * @private
   */
  _generateRollbackSql(operation) {
    // Simple rollback generation - in practice this would be more sophisticated
    const rollbacks = {
      0: [`DROP TABLE IF EXISTS ${operation.objectName}`], // CREATE TABLE
      3: [`DROP INDEX IF EXISTS ${operation.objectName}`], // CREATE INDEX
      5: [`DROP FUNCTION IF EXISTS ${operation.objectName}`], // CREATE FUNCTION
      7: [`DROP VIEW IF EXISTS ${operation.objectName}`]  // CREATE VIEW
    };
    return rollbacks[operation.type] || [];
  }

  /**
   * Add validation steps to plan
   * @param {ExecutionPlan} plan - Plan to add validation to
   * @param {MigrationOperation[]} operations - Operations to validate
   * @private
   */
  _addValidationSteps(plan, operations) {
    const validationStep = new ExecutionStep(
      'validation',
      'Validate migration results',
      ['-- Validation queries would go here'],
      ExecutionPhase.VALIDATION,
      { canRollback: false, continueOnError: true }
    );
    
    plan.addStep(validationStep);
  }

  /**
   * Resolve step dependencies within plan
   * @param {ExecutionPlan} plan - Plan to resolve dependencies for
   * @private
   */
  _resolveDependencies(plan) {
    const stepsByPhase = plan.phases;
    const phaseOrder = Array.from(stepsByPhase.keys()).sort((a, b) => a - b);
    
    // Add inter-phase dependencies
    for (let i = 1; i < phaseOrder.length; i++) {
      const currentPhaseSteps = stepsByPhase.get(phaseOrder[i]);
      const previousPhaseSteps = stepsByPhase.get(phaseOrder[i - 1]);
      
      for (const currentStep of currentPhaseSteps) {
        for (const previousStep of previousPhaseSteps) {
          currentStep.addDependency(previousStep);
        }
      }
    }
  }

  /**
   * Validate compiled execution plan
   * @param {ExecutionPlan} plan - Plan to validate
   * @returns {Object} Validation result with issues
   */
  validatePlan(plan) {
    const issues = [];
    const warnings = [];
    
    if (!plan.compiled) {
      issues.push('Plan has not been compiled');
    }
    
    if (plan.hasCircularDependencies()) {
      issues.push('Plan contains circular dependencies');
    }
    
    if (plan.steps.length === 0) {
      warnings.push('Plan contains no execution steps');
    }
    
    const totalTime = plan.getTotalEstimatedTime();
    if (totalTime > 3600000) { // 1 hour
      warnings.push(`Plan has long estimated execution time: ${Math.round(totalTime / 60000)} minutes`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      warnings,
      estimatedTime: totalTime,
      stepCount: plan.steps.length
    };
  }
}