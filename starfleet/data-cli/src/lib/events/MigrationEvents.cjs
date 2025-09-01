/**
 * @fileoverview Migration-Specific Event Classes for Database Operations
 * 
 * Specialized event classes for database migration operations including schema changes,
 * data transformations, rollbacks, and migration lifecycle management.
 * 
 * These events provide detailed context for migration operations with runtime type safety
 * and comprehensive tracking of database state changes.
 * 
 * @module MigrationEvents
 * @requires CommandEvents
 * @since 2.0.0
 * @author JavaScript Pro (via Claude Code)
 */

'use strict';

const {
  CommandEvent,
  ProgressEvent,
  ErrorEvent,
  SuccessEvent,
  WarningEvent
} = require('./CommandEvents.cjs');

// =============================================================================
// MIGRATION LIFECYCLE EVENTS
// =============================================================================

/**
 * @typedef {Object} MigrationDetails
 * @property {string} [migrationId] - Unique migration identifier
 * @property {string} [migrationName] - Human-readable migration name
 * @property {string} [version] - Migration version number
 * @property {string} [schema] - Target database schema
 * @property {Array<string>} [tables] - Tables affected by migration
 * @property {Array<string>} [operations] - List of operations performed
 * @property {number} [estimatedDuration] - Expected duration in milliseconds
 * @property {number} [actualDuration] - Actual duration in milliseconds
 * @property {boolean} [isRollback] - Whether this is a rollback operation
 * @property {string} [rollbackReason] - Reason for rollback if applicable
 * @property {Object} [metadata] - Additional migration metadata
 */

/**
 * Event emitted when a database migration begins execution.
 * 
 * Provides comprehensive context about the migration being executed,
 * including affected tables, operations, and execution environment.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const migration = new MigrationStartEvent('Starting migration 001_create_users', {
 *   migrationId: '001',
 *   migrationName: 'create_users',
 *   tables: ['users'],
 *   operations: ['CREATE_TABLE', 'CREATE_INDEX'],
 *   schema: 'public'
 * });
 */
class MigrationStartEvent extends CommandEvent {
  /**
   * Creates a new MigrationStartEvent instance.
   * 
   * @param {string} message - Migration start message
   * @param {MigrationDetails} [details={}] - Migration context and metadata
   */
  constructor(message, details = {}) {
    super('migration_start', message, details);
    
    Object.defineProperties(this, {
      migrationId: {
        value: details.migrationId || null,
        writable: false,
        enumerable: true,
        configurable: false
      },
      operations: {
        value: Object.freeze([...(details.operations || [])]),
        writable: false,
        enumerable: true,
        configurable: false
      }
    });
    
    this._freeze();
  }

  /**
   * Checks if this migration affects specific tables.
   * 
   * @param {Array<string>} tableNames - Table names to check
   * @returns {boolean} True if migration affects any of the specified tables
   */
  affectsTables(tableNames) {
    const migrationTables = this.details.tables || [];
    return tableNames.some(table => migrationTables.includes(table));
  }

  /**
   * Gets the estimated completion time.
   * 
   * @returns {Date|null} Estimated completion time or null if unknown
   */
  getEstimatedCompletion() {
    if (!this.details.estimatedDuration) return null;
    return new Date(this.timestamp.getTime() + this.details.estimatedDuration);
  }
}

/**
 * Event emitted for individual migration steps or operations.
 * 
 * Provides granular progress tracking for complex migrations with multiple
 * database operations, allowing for detailed monitoring and debugging.
 * 
 * @class
 * @extends ProgressEvent
 * @example
 * const step = new MigrationStepEvent('Creating users table', 25, {
 *   operation: 'CREATE_TABLE',
 *   table: 'users',
 *   sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY...)'
 * });
 */
class MigrationStepEvent extends ProgressEvent {
  /**
   * Creates a new MigrationStepEvent instance.
   * 
   * @param {string} message - Step description
   * @param {number|null} [percentage=null] - Step completion percentage
   * @param {MigrationDetails} [details={}] - Step-specific details
   */
  constructor(message, percentage = null, details = {}) {
    super(message, percentage, details);
    
    Object.defineProperty(this, 'operation', {
      value: details.operation || 'UNKNOWN',
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    this._freeze();
  }

  /**
   * Gets the migration-specific event type.
   * 
   * @returns {string} Migration step event type
   */
  getEventType() {
    return 'migration_step';
  }

  /**
   * Checks if this step is a destructive operation.
   * 
   * @returns {boolean} True if operation can cause data loss
   */
  isDestructive() {
    const destructiveOps = ['DROP_TABLE', 'DROP_COLUMN', 'DROP_INDEX', 'TRUNCATE', 'DELETE'];
    return destructiveOps.includes(this.operation);
  }

  /**
   * Gets the SQL being executed if available.
   * 
   * @returns {string|null} SQL statement or null
   */
  getSQL() {
    return this.details.sql || null;
  }
}

/**
 * Event emitted when a migration completes successfully.
 * 
 * Contains comprehensive results of the migration including tables created,
 * data migrated, indexes built, and performance metrics.
 * 
 * @class
 * @extends SuccessEvent
 * @example
 * const complete = new MigrationCompleteEvent('Migration 001 completed', {
 *   migrationId: '001',
 *   actualDuration: 1250,
 *   tablesCreated: ['users'],
 *   indexesCreated: ['idx_users_email'],
 *   rowsMigrated: 0
 * });
 */
class MigrationCompleteEvent extends SuccessEvent {
  /**
   * Creates a new MigrationCompleteEvent instance.
   * 
   * @param {string} message - Completion message
   * @param {MigrationDetails} [details={}] - Migration results and metrics
   */
  constructor(message, details = {}) {
    super(message, details);
    
    // Migration-specific event type available via getEventType()
    
    this._freeze();
  }

  /**
   * Gets migration performance metrics.
   * 
   * @returns {Object} Performance data
   */
  getMetrics() {
    return {
      duration: this.details.actualDuration || 0,
      tablesCreated: (this.details.tablesCreated || []).length,
      indexesCreated: (this.details.indexesCreated || []).length,
      rowsMigrated: this.details.rowsMigrated || 0,
      estimatedVsActual: this.details.estimatedDuration ? 
        (this.details.actualDuration / this.details.estimatedDuration) : null
    };
  }
}

/**
 * Event emitted when a migration fails.
 * 
 * Provides detailed error context including the failing operation,
 * database state, and recovery suggestions.
 * 
 * @class
 * @extends ErrorEvent
 * @example
 * const failed = new MigrationFailedEvent('Table creation failed', dbError, 'CREATE_TABLE', {
 *   migrationId: '001',
 *   operation: 'CREATE_TABLE',
 *   table: 'users',
 *   sql: 'CREATE TABLE...',
 *   canRollback: true
 * });
 */
class MigrationFailedEvent extends ErrorEvent {
  /**
   * Creates a new MigrationFailedEvent instance.
   * 
   * @param {string} message - Failure message
   * @param {Error|null} [error=null] - The database error
   * @param {string|null} [code=null] - Error code
   * @param {MigrationDetails} [details={}] - Failure context
   */
  constructor(message, error = null, code = null, details = {}) {
    super(message, error, code, details);
    
    // Migration-specific event type available via getEventType()
    
    this._freeze();
  }

  /**
   * Checks if the migration can be safely rolled back.
   * 
   * @returns {boolean} True if rollback is possible
   */
  canRollback() {
    return Boolean(this.details.canRollback);
  }

  /**
   * Gets suggested recovery actions.
   * 
   * @returns {Array<string>} List of recovery suggestions
   */
  getRecoveryActions() {
    return this.details.recoveryActions || [
      'Check database connection',
      'Verify migration syntax',
      'Review database logs',
      'Consider manual rollback'
    ];
  }
}

// =============================================================================
// ROLLBACK EVENTS
// =============================================================================

/**
 * Event emitted when a migration rollback begins.
 * 
 * Provides context about the rollback operation including the reason
 * for rollback and affected database objects.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const rollback = new MigrationRollbackEvent('Rolling back migration 001', {
 *   migrationId: '001',
 *   rollbackReason: 'Deployment failed validation',
 *   affectedTables: ['users'],
 *   rollbackStrategy: 'DROP_TABLES'
 * });
 */
class MigrationRollbackEvent extends CommandEvent {
  /**
   * Creates a new MigrationRollbackEvent instance.
   * 
   * @param {string} message - Rollback message
   * @param {MigrationDetails} [details={}] - Rollback context
   */
  constructor(message, details = {}) {
    super('migration_rollback', message, details);
    
    Object.defineProperty(this, 'rollbackReason', {
      value: details.rollbackReason || 'Unknown',
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    this._freeze();
  }

  /**
   * Checks if rollback is due to a critical failure.
   * 
   * @returns {boolean} True if rollback is due to critical issue
   */
  isCritical() {
    const criticalReasons = ['DATA_LOSS', 'CORRUPTION', 'SECURITY_BREACH'];
    return criticalReasons.some(reason => 
      this.rollbackReason.toUpperCase().includes(reason)
    );
  }
}

// =============================================================================
// VALIDATION AND SAFETY EVENTS
// =============================================================================

/**
 * Event emitted when migration validation detects issues.
 * 
 * Used for pre-migration checks, syntax validation, dependency verification,
 * and production safety warnings.
 * 
 * @class
 * @extends WarningEvent
 * @example
 * const validation = new MigrationValidationEvent('Destructive operation detected', {
 *   validationType: 'SAFETY_CHECK',
 *   severity: 'high',
 *   operation: 'DROP_COLUMN',
 *   table: 'users',
 *   column: 'old_email'
 * });
 */
class MigrationValidationEvent extends WarningEvent {
  /**
   * Creates a new MigrationValidationEvent instance.
   * 
   * @param {string} message - Validation warning message
   * @param {MigrationDetails} [details={}] - Validation context
   */
  constructor(message, details = {}) {
    super(message, details);
    
    // Migration-specific event type available via getEventType()
    
    Object.defineProperty(this, 'validationType', {
      value: details.validationType || 'GENERAL',
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    this._freeze();
  }

  /**
   * Checks if validation should block migration execution.
   * 
   * @returns {boolean} True if migration should be blocked
   */
  shouldBlock() {
    const blockingTypes = ['SYNTAX_ERROR', 'DEPENDENCY_MISSING', 'DATA_LOSS_RISK'];
    const highSeverity = this.getSeverity() === 'high';
    const isBlockingType = blockingTypes.includes(this.validationType);
    
    return highSeverity && isBlockingType;
  }
}

// =============================================================================
// SCHEMA DIFF EVENTS
// =============================================================================

/**
 * Event emitted when schema differences are detected.
 * 
 * Used during migration generation to report differences between
 * current schema and target schema, including structural changes.
 * 
 * @class
 * @extends CommandEvent
 * @example
 * const diff = new SchemaDiffEvent('Schema changes detected', {
 *   additions: ['users.created_at'],
 *   modifications: ['users.email'],
 *   deletions: ['users.old_field'],
 *   impactLevel: 'medium'
 * });
 */
class SchemaDiffEvent extends CommandEvent {
  /**
   * Creates a new SchemaDiffEvent instance.
   * 
   * @param {string} message - Schema diff message
   * @param {Object} [details={}] - Schema change details
   * @param {Array<string>} [details.additions] - New schema objects
   * @param {Array<string>} [details.modifications] - Modified schema objects
   * @param {Array<string>} [details.deletions] - Removed schema objects
   * @param {string} [details.impactLevel] - Change impact level
   */
  constructor(message, details = {}) {
    super('schema_diff', message, details);
    
    Object.defineProperties(this, {
      additions: {
        value: Object.freeze([...(details.additions || [])]),
        writable: false,
        enumerable: true,
        configurable: false
      },
      modifications: {
        value: Object.freeze([...(details.modifications || [])]),
        writable: false,
        enumerable: true,
        configurable: false
      },
      deletions: {
        value: Object.freeze([...(details.deletions || [])]),
        writable: false,
        enumerable: true,
        configurable: false
      }
    });
    
    this._freeze();
  }

  /**
   * Gets total number of changes detected.
   * 
   * @returns {number} Total change count
   */
  getChangeCount() {
    return this.additions.length + this.modifications.length + this.deletions.length;
  }

  /**
   * Checks if changes include destructive operations.
   * 
   * @returns {boolean} True if any destructive changes detected
   */
  hasDestructiveChanges() {
    return this.deletions.length > 0 || 
           this.modifications.some(mod => mod.includes('DROP') || mod.includes('TRUNCATE'));
  }

  /**
   * Gets impact assessment of changes.
   * 
   * @returns {Object} Impact analysis
   */
  getImpactAnalysis() {
    return {
      level: this.details.impactLevel || 'unknown',
      changeCount: this.getChangeCount(),
      hasDestructive: this.hasDestructiveChanges(),
      affectedObjects: [
        ...this.additions,
        ...this.modifications,
        ...this.deletions
      ]
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Lifecycle events
  MigrationStartEvent,
  MigrationStepEvent,
  MigrationCompleteEvent,
  MigrationFailedEvent,
  
  // Rollback events
  MigrationRollbackEvent,
  
  // Validation events
  MigrationValidationEvent,
  
  // Schema events
  SchemaDiffEvent
};

// Export for instanceof checks
module.exports.MigrationStartEvent = MigrationStartEvent;
module.exports.MigrationStepEvent = MigrationStepEvent;
module.exports.MigrationCompleteEvent = MigrationCompleteEvent;
module.exports.MigrationFailedEvent = MigrationFailedEvent;
module.exports.MigrationRollbackEvent = MigrationRollbackEvent;
module.exports.MigrationValidationEvent = MigrationValidationEvent;
module.exports.SchemaDiffEvent = SchemaDiffEvent;