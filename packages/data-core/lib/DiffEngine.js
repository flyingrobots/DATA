/**
 * Migration diff calculator for comparing database states and generating changes.
 * Analyzes differences between current database schema and desired SQL state,
 * producing minimal migration operations to transform the database.
 * 
 * @fileoverview Database schema diff calculation and migration planning
 */

import { CryptoPort, validatePort } from '../ports/index.js';

/**
 * Types of database operations for migrations
 * @readonly
 * @enum {number}
 */
export const OperationType = {
  CREATE_TABLE: 0,
  DROP_TABLE: 1,
  ALTER_TABLE: 2,
  CREATE_INDEX: 3,
  DROP_INDEX: 4,
  CREATE_FUNCTION: 5,
  DROP_FUNCTION: 6,
  CREATE_VIEW: 7,
  DROP_VIEW: 8,
  INSERT_DATA: 9,
  UPDATE_DATA: 10,
  DELETE_DATA: 11
};

/**
 * Represents a single migration operation
 */
export class MigrationOperation {
  /**
   * @param {number} type - Operation type from OperationType enum
   * @param {string} objectName - Name of database object being modified
   * @param {string} sql - SQL statement to execute
   * @param {Object} [metadata={}] - Additional operation metadata
   */
  constructor(type, objectName, sql, metadata = {}) {
    this.type = type;
    this.objectName = objectName;
    this.sql = sql;
    this.metadata = metadata;
    this.hash = null;
  }

  /**
   * Generate hash for this operation using provided crypto port
   * @param {CryptoPort} cryptoPort - Crypto adapter
   * @returns {string} Operation hash
   */
  generateHash(cryptoPort) {
    const data = `${this.type}:${this.objectName}:${this.sql}`;
    this.hash = cryptoPort.hash(data);
    return this.hash;
  }

  /**
   * Check if this operation is destructive (drops data)
   * @returns {boolean} True if operation may destroy data
   */
  isDestructive() {
    return [
      OperationType.DROP_TABLE,
      OperationType.DROP_INDEX,
      OperationType.DROP_FUNCTION,
      OperationType.DROP_VIEW,
      OperationType.DELETE_DATA
    ].includes(this.type);
  }

  /**
   * Get operation priority for execution ordering
   * @returns {number} Priority (lower numbers execute first)
   */
  getPriority() {
    const priorities = {
      [OperationType.DROP_VIEW]: 0,
      [OperationType.DROP_FUNCTION]: 1,
      [OperationType.DROP_INDEX]: 2,
      [OperationType.ALTER_TABLE]: 3,
      [OperationType.DROP_TABLE]: 4,
      [OperationType.CREATE_TABLE]: 5,
      [OperationType.CREATE_FUNCTION]: 6,
      [OperationType.CREATE_VIEW]: 7,
      [OperationType.CREATE_INDEX]: 8,
      [OperationType.INSERT_DATA]: 9,
      [OperationType.UPDATE_DATA]: 10,
      [OperationType.DELETE_DATA]: 11
    };
    return priorities[this.type] ?? 50;
  }
}

/**
 * Database schema state representation
 */
export class SchemaState {
  /**
   * @param {Object} [objects={}] - Database objects by type
   * @param {string} [checksum=''] - Schema checksum
   */
  constructor(objects = {}, checksum = '') {
    this.objects = {
      tables: new Map(),
      views: new Map(),
      functions: new Map(),
      indexes: new Map(),
      ...objects
    };
    this.checksum = checksum;
  }

  /**
   * Add database object to schema state
   * @param {string} type - Object type (table, view, function, index)
   * @param {string} name - Object name
   * @param {Object} definition - Object definition
   */
  addObject(type, name, definition) {
    if (!this.objects[type]) {
      this.objects[type] = new Map();
    }
    this.objects[type].set(name, definition);
  }

  /**
   * Get database object definition
   * @param {string} type - Object type
   * @param {string} name - Object name
   * @returns {Object|undefined} Object definition
   */
  getObject(type, name) {
    return this.objects[type]?.get(name);
  }

  /**
   * Check if object exists in schema
   * @param {string} type - Object type
   * @param {string} name - Object name
   * @returns {boolean} True if object exists
   */
  hasObject(type, name) {
    return this.objects[type]?.has(name) ?? false;
  }

  /**
   * Get all object names of specified type
   * @param {string} type - Object type
   * @returns {string[]} Array of object names
   */
  getObjectNames(type) {
    return Array.from(this.objects[type]?.keys() ?? []);
  }

  /**
   * Generate checksum for current state
   * @param {CryptoPort} cryptoPort - Crypto adapter
   * @returns {string} Schema checksum
   */
  generateChecksum(cryptoPort) {
    const serialized = JSON.stringify(this.objects, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    });
    this.checksum = cryptoPort.hash(serialized);
    return this.checksum;
  }
}

/**
 * Migration diff calculator and operation generator
 */
export class DiffEngine {
  /**
   * @param {CryptoPort} cryptoPort - Crypto adapter
   */
  constructor(cryptoPort) {
    validatePort(cryptoPort, CryptoPort);
    this.cryptoPort = cryptoPort;
  }

  /**
   * Calculate diff between current and target schema states
   * @param {SchemaState} currentState - Current database schema
   * @param {SchemaState} targetState - Desired schema state
   * @returns {MigrationOperation[]} Array of migration operations
   */
  calculateDiff(currentState, targetState) {
    const operations = [];

    // Compare each object type
    const objectTypes = ['tables', 'views', 'functions', 'indexes'];
    
    for (const objectType of objectTypes) {
      const currentObjects = currentState.objects[objectType] || new Map();
      const targetObjects = targetState.objects[objectType] || new Map();
      
      // Find objects to drop (exist in current but not in target)
      for (const [name, definition] of currentObjects) {
        if (!targetObjects.has(name)) {
          operations.push(this._createDropOperation(objectType, name, definition));
        }
      }
      
      // Find objects to create or alter
      for (const [name, targetDef] of targetObjects) {
        const currentDef = currentObjects.get(name);
        
        if (!currentDef) {
          // Create new object
          operations.push(this._createCreateOperation(objectType, name, targetDef));
        } else if (!this._areDefinitionsEqual(currentDef, targetDef)) {
          // Alter existing object
          operations.push(this._createAlterOperation(objectType, name, currentDef, targetDef));
        }
      }
    }

    // Sort operations by priority
    operations.sort((a, b) => a.getPriority() - b.getPriority());

    // Generate hashes for all operations
    operations.forEach(op => op.generateHash(this.cryptoPort));

    return operations;
  }

  /**
   * Create drop operation for database object
   * @param {string} objectType - Type of object
   * @param {string} name - Object name
   * @param {Object} definition - Object definition
   * @returns {MigrationOperation} Drop operation
   * @private
   */
  _createDropOperation(objectType, name, definition) {
    const typeMap = {
      tables: OperationType.DROP_TABLE,
      views: OperationType.DROP_VIEW,
      functions: OperationType.DROP_FUNCTION,
      indexes: OperationType.DROP_INDEX
    };

    const sqlMap = {
      tables: `DROP TABLE IF EXISTS ${name}`,
      views: `DROP VIEW IF EXISTS ${name}`,
      functions: `DROP FUNCTION IF EXISTS ${name}`,
      indexes: `DROP INDEX IF EXISTS ${name}`
    };

    return new MigrationOperation(
      typeMap[objectType],
      name,
      sqlMap[objectType],
      { originalDefinition: definition }
    );
  }

  /**
   * Create create operation for database object
   * @param {string} objectType - Type of object
   * @param {string} name - Object name
   * @param {Object} definition - Object definition
   * @returns {MigrationOperation} Create operation
   * @private
   */
  _createCreateOperation(objectType, name, definition) {
    const typeMap = {
      tables: OperationType.CREATE_TABLE,
      views: OperationType.CREATE_VIEW,
      functions: OperationType.CREATE_FUNCTION,
      indexes: OperationType.CREATE_INDEX
    };

    return new MigrationOperation(
      typeMap[objectType],
      name,
      definition.sql || `CREATE ${objectType.slice(0, -1).toUpperCase()} ${name}`,
      { definition }
    );
  }

  /**
   * Create alter operation for database object
   * @param {string} objectType - Type of object
   * @param {string} name - Object name
   * @param {Object} currentDef - Current definition
   * @param {Object} targetDef - Target definition
   * @returns {MigrationOperation} Alter operation
   * @private
   */
  _createAlterOperation(objectType, name, currentDef, targetDef) {
    // For simplicity, most alters are implemented as drop + create
    // In a real implementation, this would generate specific ALTER statements
    const alterSql = targetDef.sql || `-- ALTER ${objectType.slice(0, -1).toUpperCase()} ${name}`;

    return new MigrationOperation(
      OperationType.ALTER_TABLE, // Simplified - would be more specific in real implementation
      name,
      alterSql,
      { 
        currentDefinition: currentDef,
        targetDefinition: targetDef,
        changeType: 'modify'
      }
    );
  }

  /**
   * Compare two object definitions for equality
   * @param {Object} def1 - First definition
   * @param {Object} def2 - Second definition
   * @returns {boolean} True if definitions are equal
   * @private
   */
  _areDefinitionsEqual(def1, def2) {
    // Simple hash-based comparison
    const hash1 = this.cryptoPort.hash(JSON.stringify(def1));
    const hash2 = this.cryptoPort.hash(JSON.stringify(def2));
    return hash1 === hash2;
  }

  /**
   * Optimize operation list by removing redundant operations
   * @param {MigrationOperation[]} operations - Operations to optimize
   * @returns {MigrationOperation[]} Optimized operations
   */
  optimizeOperations(operations) {
    const optimized = [];
    const processedObjects = new Set();

    for (const op of operations) {
      const key = `${op.type}:${op.objectName}`;
      
      // Skip if we've already processed this object with the same operation
      if (processedObjects.has(key)) {
        continue;
      }
      
      processedObjects.add(key);
      optimized.push(op);
    }

    return optimized;
  }
}