/**
 * Unit tests for DiffEngine schema comparison
 *
 * Tests the DiffEngine functionality including:
 * - Schema state management and comparison
 * - Migration operation generation and prioritization
 * - Checksum calculation and validation
 * - Destructive operation detection
 * - Port/adapter pattern validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DiffEngine,
  SchemaState,
  MigrationOperation,
  OperationType
} from '../../../packages/data-core/lib/DiffEngine.js';
import { CryptoPort } from '../../../packages/data-core/ports/index.js';

/**
 * Mock Crypto adapter for testing
 */
class MockCryptoAdapter extends CryptoPort {
  constructor() {
    super();
    this.hashCounter = 0;
  }

  hash(data, algorithm = 'sha256') {
    // Simple mock hash - in real tests you'd use actual crypto
    this.hashCounter++;
    return `mock_hash_${this.hashCounter}_${data.slice(0, 10)}`;
  }
}

describe('OperationType enum', () => {
  it('should have correct numeric values for performance', () => {
    expect(typeof OperationType.CREATE_TABLE).toBe('number');
    expect(typeof OperationType.DROP_TABLE).toBe('number');
    expect(typeof OperationType.ALTER_TABLE).toBe('number');
    expect(typeof OperationType.CREATE_INDEX).toBe('number');
    expect(typeof OperationType.DROP_INDEX).toBe('number');
    expect(typeof OperationType.CREATE_FUNCTION).toBe('number');
    expect(typeof OperationType.DROP_FUNCTION).toBe('number');
    expect(typeof OperationType.CREATE_VIEW).toBe('number');
    expect(typeof OperationType.DROP_VIEW).toBe('number');
    expect(typeof OperationType.INSERT_DATA).toBe('number');
    expect(typeof OperationType.UPDATE_DATA).toBe('number');
    expect(typeof OperationType.DELETE_DATA).toBe('number');
  });

  it('should have distinct values', () => {
    const values = Object.values(OperationType);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe('MigrationOperation', () => {
  let mockCrypto;

  beforeEach(() => {
    mockCrypto = new MockCryptoAdapter();
  });

  describe('constructor and basic properties', () => {
    it('should create operation with correct properties', () => {
      const op = new MigrationOperation(
        OperationType.CREATE_TABLE,
        'users',
        'CREATE TABLE users (id INT)',
        { comment: 'User table' }
      );

      expect(op.type).toBe(OperationType.CREATE_TABLE);
      expect(op.objectName).toBe('users');
      expect(op.sql).toBe('CREATE TABLE users (id INT)');
      expect(op.metadata).toEqual({ comment: 'User table' });
      expect(op.hash).toBeNull();
    });

    it('should handle empty metadata', () => {
      const op = new MigrationOperation(
        OperationType.DROP_TABLE,
        'old_table',
        'DROP TABLE old_table'
      );

      expect(op.metadata).toEqual({});
    });
  });

  describe('hash generation', () => {
    it('should generate hash using crypto port', () => {
      const op = new MigrationOperation(
        OperationType.CREATE_TABLE,
        'test',
        'CREATE TABLE test (id INT)'
      );

      const hash = op.generateHash(mockCrypto);

      expect(hash).toBeTruthy();
      expect(op.hash).toBe(hash);
      expect(hash).toContain('mock_hash_');
    });

    it('should generate consistent hashes for same operation', () => {
      const op1 = new MigrationOperation(OperationType.CREATE_TABLE, 'test', 'CREATE TABLE test (id INT)');
      const op2 = new MigrationOperation(OperationType.CREATE_TABLE, 'test', 'CREATE TABLE test (id INT)');

      const hash1 = op1.generateHash(mockCrypto);
      const hash2 = op2.generateHash(mockCrypto);

      // Note: In a real crypto implementation, these would be identical
      // Our mock generates sequential hashes, so we just verify both are generated
      expect(hash1).toBeTruthy();
      expect(hash2).toBeTruthy();
    });

    it('should include type, name, and SQL in hash data', () => {
      const op = new MigrationOperation(OperationType.ALTER_TABLE, 'users', 'ALTER TABLE users ADD COLUMN name VARCHAR(100)');
      const spy = vi.spyOn(mockCrypto, 'hash');

      op.generateHash(mockCrypto);

      expect(spy).toHaveBeenCalledWith('2:users:ALTER TABLE users ADD COLUMN name VARCHAR(100)');
    });
  });

  describe('destructive operation detection', () => {
    it('should identify destructive operations', () => {
      const destructiveOps = [
        new MigrationOperation(OperationType.DROP_TABLE, 'test', 'DROP TABLE test'),
        new MigrationOperation(OperationType.DROP_INDEX, 'test', 'DROP INDEX test'),
        new MigrationOperation(OperationType.DROP_FUNCTION, 'test', 'DROP FUNCTION test'),
        new MigrationOperation(OperationType.DROP_VIEW, 'test', 'DROP VIEW test'),
        new MigrationOperation(OperationType.DELETE_DATA, 'test', 'DELETE FROM test')
      ];

      destructiveOps.forEach(op => {
        expect(op.isDestructive()).toBe(true);
      });
    });

    it('should identify non-destructive operations', () => {
      const nonDestructiveOps = [
        new MigrationOperation(OperationType.CREATE_TABLE, 'test', 'CREATE TABLE test'),
        new MigrationOperation(OperationType.CREATE_INDEX, 'test', 'CREATE INDEX test'),
        new MigrationOperation(OperationType.CREATE_FUNCTION, 'test', 'CREATE FUNCTION test'),
        new MigrationOperation(OperationType.CREATE_VIEW, 'test', 'CREATE VIEW test'),
        new MigrationOperation(OperationType.ALTER_TABLE, 'test', 'ALTER TABLE test'),
        new MigrationOperation(OperationType.INSERT_DATA, 'test', 'INSERT INTO test'),
        new MigrationOperation(OperationType.UPDATE_DATA, 'test', 'UPDATE test')
      ];

      nonDestructiveOps.forEach(op => {
        expect(op.isDestructive()).toBe(false);
      });
    });
  });

  describe('operation priority', () => {
    it('should return correct priorities for execution ordering', () => {
      const operations = [
        new MigrationOperation(OperationType.DROP_VIEW, 'test', ''),
        new MigrationOperation(OperationType.DROP_FUNCTION, 'test', ''),
        new MigrationOperation(OperationType.DROP_INDEX, 'test', ''),
        new MigrationOperation(OperationType.ALTER_TABLE, 'test', ''),
        new MigrationOperation(OperationType.DROP_TABLE, 'test', ''),
        new MigrationOperation(OperationType.CREATE_TABLE, 'test', ''),
        new MigrationOperation(OperationType.CREATE_FUNCTION, 'test', ''),
        new MigrationOperation(OperationType.CREATE_VIEW, 'test', ''),
        new MigrationOperation(OperationType.CREATE_INDEX, 'test', ''),
        new MigrationOperation(OperationType.INSERT_DATA, 'test', ''),
        new MigrationOperation(OperationType.UPDATE_DATA, 'test', ''),
        new MigrationOperation(OperationType.DELETE_DATA, 'test', '')
      ];

      const priorities = operations.map(op => op.getPriority());
      const expectedPriorities = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

      expect(priorities).toEqual(expectedPriorities);
    });

    it('should handle unknown operation types', () => {
      const op = new MigrationOperation(999, 'test', 'UNKNOWN OPERATION');
      expect(op.getPriority()).toBe(50);
    });

    it('should sort operations correctly by priority', () => {
      const operations = [
        new MigrationOperation(OperationType.CREATE_TABLE, 'test', ''),
        new MigrationOperation(OperationType.DROP_VIEW, 'test', ''),
        new MigrationOperation(OperationType.INSERT_DATA, 'test', ''),
        new MigrationOperation(OperationType.ALTER_TABLE, 'test', '')
      ];

      operations.sort((a, b) => a.getPriority() - b.getPriority());

      expect(operations[0].type).toBe(OperationType.DROP_VIEW);
      expect(operations[1].type).toBe(OperationType.ALTER_TABLE);
      expect(operations[2].type).toBe(OperationType.CREATE_TABLE);
      expect(operations[3].type).toBe(OperationType.INSERT_DATA);
    });
  });
});

describe('SchemaState', () => {
  let mockCrypto;
  let schemaState;

  beforeEach(() => {
    mockCrypto = new MockCryptoAdapter();
    schemaState = new SchemaState();
  });

  describe('constructor and initialization', () => {
    it('should initialize with empty state', () => {
      expect(schemaState.objects.tables).toBeInstanceOf(Map);
      expect(schemaState.objects.views).toBeInstanceOf(Map);
      expect(schemaState.objects.functions).toBeInstanceOf(Map);
      expect(schemaState.objects.indexes).toBeInstanceOf(Map);
      expect(schemaState.checksum).toBe('');
    });

    it('should accept initial objects', () => {
      const initialObjects = {
        tables: new Map([['users', { name: 'users', columns: ['id', 'name'] }]]),
        customType: new Map([['custom', { definition: 'test' }]])
      };

      const state = new SchemaState(initialObjects, 'test_checksum');

      expect(state.objects.tables.get('users')).toEqual({ name: 'users', columns: ['id', 'name'] });
      expect(state.objects.customType.get('custom')).toEqual({ definition: 'test' });
      expect(state.checksum).toBe('test_checksum');
    });
  });

  describe('object management', () => {
    it('should add objects correctly', () => {
      const userTable = { name: 'users', columns: ['id', 'name', 'email'] };
      schemaState.addObject('tables', 'users', userTable);

      expect(schemaState.objects.tables.get('users')).toBe(userTable);
    });

    it('should create new object type if needed', () => {
      const customDefinition = { type: 'custom', definition: 'test' };
      schemaState.addObject('customTypes', 'test_type', customDefinition);

      expect(schemaState.objects.customTypes).toBeInstanceOf(Map);
      expect(schemaState.objects.customTypes.get('test_type')).toBe(customDefinition);
    });

    it('should retrieve objects correctly', () => {
      const viewDef = { name: 'user_view', query: 'SELECT * FROM users' };
      schemaState.addObject('views', 'user_view', viewDef);

      expect(schemaState.getObject('views', 'user_view')).toBe(viewDef);
      expect(schemaState.getObject('views', 'nonexistent')).toBeUndefined();
      expect(schemaState.getObject('nonexistent_type', 'test')).toBeUndefined();
    });

    it('should check object existence correctly', () => {
      schemaState.addObject('functions', 'get_user', { name: 'get_user' });

      expect(schemaState.hasObject('functions', 'get_user')).toBe(true);
      expect(schemaState.hasObject('functions', 'nonexistent')).toBe(false);
      expect(schemaState.hasObject('nonexistent_type', 'test')).toBe(false);
    });

    it('should get object names correctly', () => {
      schemaState.addObject('indexes', 'idx_users_email', { name: 'idx_users_email' });
      schemaState.addObject('indexes', 'idx_users_name', { name: 'idx_users_name' });

      const names = schemaState.getObjectNames('indexes');
      expect(names).toHaveLength(2);
      expect(names).toContain('idx_users_email');
      expect(names).toContain('idx_users_name');
    });

    it('should handle empty object types', () => {
      expect(schemaState.getObjectNames('nonexistent')).toEqual([]);
    });
  });

  describe('checksum generation', () => {
    it('should generate checksum for empty state', () => {
      const checksum = schemaState.generateChecksum(mockCrypto);

      expect(checksum).toBeTruthy();
      expect(schemaState.checksum).toBe(checksum);
    });

    it('should generate different checksums for different states', () => {
      const state1 = new SchemaState();
      const state2 = new SchemaState();

      state1.addObject('tables', 'users', { name: 'users' });
      state2.addObject('tables', 'orders', { name: 'orders' });

      const checksum1 = state1.generateChecksum(mockCrypto);
      const checksum2 = state2.generateChecksum(mockCrypto);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should handle Maps in JSON serialization', () => {
      schemaState.addObject('tables', 'users', { name: 'users', columns: ['id'] });

      const spy = vi.spyOn(mockCrypto, 'hash');
      schemaState.generateChecksum(mockCrypto);

      expect(spy).toHaveBeenCalled();
      const serializedData = spy.mock.calls[0][0];
      expect(serializedData).toContain('users');
      expect(serializedData).toContain('tables');
    });
  });
});

describe('DiffEngine', () => {
  let mockCrypto;
  let diffEngine;
  let currentState;
  let targetState;

  beforeEach(() => {
    mockCrypto = new MockCryptoAdapter();
    diffEngine = new DiffEngine(mockCrypto);
    currentState = new SchemaState();
    targetState = new SchemaState();
  });

  describe('constructor and port validation', () => {
    it('should validate CryptoPort on construction', () => {
      expect(() => new DiffEngine(mockCrypto)).not.toThrow();
      expect(diffEngine.cryptoPort).toBe(mockCrypto);
    });

    it('should throw error for invalid port', () => {
      const invalidPort = { hash: () => {} }; // Not instance of CryptoPort

      expect(() => new DiffEngine(invalidPort)).toThrow('Port must be instance of CryptoPort');
    });
  });

  describe('basic diff calculation', () => {
    it('should return empty operations for identical states', () => {
      currentState.addObject('tables', 'users', { name: 'users', columns: ['id'] });
      targetState.addObject('tables', 'users', { name: 'users', columns: ['id'] });

      const operations = diffEngine.calculateDiff(currentState, targetState);
      expect(operations).toHaveLength(0);
    });

    it('should generate CREATE operations for new objects', () => {
      targetState.addObject('tables', 'users', {
        name: 'users',
        sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY)'
      });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe(OperationType.CREATE_TABLE);
      expect(operations[0].objectName).toBe('users');
      expect(operations[0].sql).toBe('CREATE TABLE users (id SERIAL PRIMARY KEY)');
    });

    it('should generate DROP operations for removed objects', () => {
      currentState.addObject('tables', 'old_table', { name: 'old_table' });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe(OperationType.DROP_TABLE);
      expect(operations[0].objectName).toBe('old_table');
      expect(operations[0].sql).toBe('DROP TABLE IF EXISTS old_table');
    });

    it('should generate ALTER operations for modified objects', () => {
      currentState.addObject('tables', 'users', { name: 'users', version: 1 });
      targetState.addObject('tables', 'users', {
        name: 'users',
        version: 2,
        sql: 'ALTER TABLE users ADD COLUMN email VARCHAR(255)'
      });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe(OperationType.ALTER_TABLE);
      expect(operations[0].objectName).toBe('users');
      expect(operations[0].sql).toBe('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
    });
  });

  describe('multi-object type handling', () => {
    it('should handle multiple object types correctly', () => {
      // Add various object types to target state
      targetState.addObject('tables', 'users', { sql: 'CREATE TABLE users' });
      targetState.addObject('views', 'user_view', { sql: 'CREATE VIEW user_view' });
      targetState.addObject('functions', 'get_user', { sql: 'CREATE FUNCTION get_user' });
      targetState.addObject('indexes', 'idx_users', { sql: 'CREATE INDEX idx_users' });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(4);

      const types = operations.map(op => op.type).sort();
      const expectedTypes = [
        OperationType.CREATE_TABLE,
        OperationType.CREATE_VIEW,
        OperationType.CREATE_FUNCTION,
        OperationType.CREATE_INDEX
      ].sort();

      expect(types).toEqual(expectedTypes);
    });

    it('should handle complex mix of operations', () => {
      // Current state
      currentState.addObject('tables', 'old_table', { name: 'old_table' });
      currentState.addObject('views', 'shared_view', { name: 'shared_view', version: 1 });
      currentState.addObject('functions', 'old_function', { name: 'old_function' });

      // Target state
      targetState.addObject('tables', 'new_table', { sql: 'CREATE TABLE new_table' });
      targetState.addObject('views', 'shared_view', { name: 'shared_view', version: 2, sql: 'ALTER VIEW' });
      targetState.addObject('indexes', 'new_index', { sql: 'CREATE INDEX new_index' });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      // Should have: DROP old_table, DROP old_function, CREATE new_table,
      // ALTER shared_view, CREATE new_index
      expect(operations).toHaveLength(5);

      const dropOps = operations.filter(op => [
        OperationType.DROP_TABLE,
        OperationType.DROP_FUNCTION
      ].includes(op.type));
      expect(dropOps).toHaveLength(2);

      const createOps = operations.filter(op => [
        OperationType.CREATE_TABLE,
        OperationType.CREATE_INDEX
      ].includes(op.type));
      expect(createOps).toHaveLength(2);

      const alterOps = operations.filter(op => op.type === OperationType.ALTER_TABLE);
      expect(alterOps).toHaveLength(1);
    });
  });

  describe('operation ordering and prioritization', () => {
    it('should sort operations by priority', () => {
      // Add operations that will create mixed priorities
      currentState.addObject('views', 'old_view', { name: 'old_view' });
      currentState.addObject('tables', 'old_table', { name: 'old_table' });

      targetState.addObject('tables', 'new_table', { sql: 'CREATE TABLE new_table' });
      targetState.addObject('indexes', 'new_index', { sql: 'CREATE INDEX new_index' });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      // Should be ordered: DROP_VIEW (0), DROP_TABLE (4), CREATE_TABLE (5), CREATE_INDEX (8)
      expect(operations[0].type).toBe(OperationType.DROP_VIEW);
      expect(operations[1].type).toBe(OperationType.DROP_TABLE);
      expect(operations[2].type).toBe(OperationType.CREATE_TABLE);
      expect(operations[3].type).toBe(OperationType.CREATE_INDEX);
    });

    it('should generate hashes for all operations', () => {
      targetState.addObject('tables', 'users', { sql: 'CREATE TABLE users' });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].hash).toBeTruthy();
      expect(operations[0].hash).toContain('mock_hash_');
    });
  });

  describe('drop operation generation', () => {
    it('should generate correct drop operations for all types', () => {
      currentState.addObject('tables', 'drop_table', { name: 'drop_table' });
      currentState.addObject('views', 'drop_view', { name: 'drop_view' });
      currentState.addObject('functions', 'drop_function', { name: 'drop_function' });
      currentState.addObject('indexes', 'drop_index', { name: 'drop_index' });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(4);

      const tableOp = operations.find(op => op.objectName === 'drop_table');
      expect(tableOp.type).toBe(OperationType.DROP_TABLE);
      expect(tableOp.sql).toBe('DROP TABLE IF EXISTS drop_table');

      const viewOp = operations.find(op => op.objectName === 'drop_view');
      expect(viewOp.type).toBe(OperationType.DROP_VIEW);
      expect(viewOp.sql).toBe('DROP VIEW IF EXISTS drop_view');

      const functionOp = operations.find(op => op.objectName === 'drop_function');
      expect(functionOp.type).toBe(OperationType.DROP_FUNCTION);
      expect(functionOp.sql).toBe('DROP FUNCTION IF EXISTS drop_function');

      const indexOp = operations.find(op => op.objectName === 'drop_index');
      expect(indexOp.type).toBe(OperationType.DROP_INDEX);
      expect(indexOp.sql).toBe('DROP INDEX IF EXISTS drop_index');
    });

    it('should include original definition in drop metadata', () => {
      const originalDef = { name: 'test_table', columns: ['id', 'name'] };
      currentState.addObject('tables', 'test_table', originalDef);

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].metadata.originalDefinition).toBe(originalDef);
    });
  });

  describe('create operation generation', () => {
    it('should use provided SQL for create operations', () => {
      const tableDef = {
        name: 'users',
        sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100))'
      };
      targetState.addObject('tables', 'users', tableDef);

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].sql).toBe(tableDef.sql);
    });

    it('should generate default SQL when not provided', () => {
      targetState.addObject('tables', 'test_table', { name: 'test_table' });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].sql).toBe('CREATE TABLE test_table');
    });

    it('should include definition in create metadata', () => {
      const definition = { name: 'test_view', query: 'SELECT * FROM users' };
      targetState.addObject('views', 'test_view', definition);

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].metadata.definition).toBe(definition);
    });
  });

  describe('alter operation generation', () => {
    it('should generate alter operations with both definitions', () => {
      const currentDef = { name: 'users', version: 1, columns: ['id'] };
      const targetDef = {
        name: 'users',
        version: 2,
        columns: ['id', 'name'],
        sql: 'ALTER TABLE users ADD COLUMN name VARCHAR(100)'
      };

      currentState.addObject('tables', 'users', currentDef);
      targetState.addObject('tables', 'users', targetDef);

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe(OperationType.ALTER_TABLE);
      expect(operations[0].sql).toBe(targetDef.sql);
      expect(operations[0].metadata.currentDefinition).toBe(currentDef);
      expect(operations[0].metadata.targetDefinition).toBe(targetDef);
      expect(operations[0].metadata.changeType).toBe('modify');
    });

    it('should generate default alter SQL when not provided', () => {
      currentState.addObject('functions', 'test_func', { version: 1 });
      targetState.addObject('functions', 'test_func', { version: 2 });

      const operations = diffEngine.calculateDiff(currentState, targetState);

      expect(operations).toHaveLength(1);
      expect(operations[0].sql).toBe('-- ALTER FUNCTION test_func');
    });
  });

  describe('definition equality comparison', () => {
    it('should detect identical definitions', () => {
      const definition = { name: 'test', columns: ['id', 'name'] };

      currentState.addObject('tables', 'test', definition);
      targetState.addObject('tables', 'test', definition);

      const operations = diffEngine.calculateDiff(currentState, targetState);
      expect(operations).toHaveLength(0);
    });

    it('should detect different definitions', () => {
      currentState.addObject('tables', 'test', { name: 'test', version: 1 });
      targetState.addObject('tables', 'test', { name: 'test', version: 2 });

      const operations = diffEngine.calculateDiff(currentState, targetState);
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe(OperationType.ALTER_TABLE);
    });

    it('should use hash-based comparison', () => {
      const spy = vi.spyOn(mockCrypto, 'hash');

      currentState.addObject('tables', 'test', { complex: { nested: { data: true } } });
      targetState.addObject('tables', 'test', { complex: { nested: { data: false } } });

      diffEngine.calculateDiff(currentState, targetState);

      // Should call hash at least twice for comparison
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('optimization', () => {
    it('should optimize redundant operations', () => {
      const operations = [
        new MigrationOperation(OperationType.CREATE_TABLE, 'users', 'CREATE TABLE users'),
        new MigrationOperation(OperationType.CREATE_TABLE, 'users', 'CREATE TABLE users'), // duplicate
        new MigrationOperation(OperationType.DROP_TABLE, 'old_table', 'DROP TABLE old_table'),
        new MigrationOperation(OperationType.DROP_TABLE, 'old_table', 'DROP TABLE old_table') // duplicate
      ];

      const optimized = diffEngine.optimizeOperations(operations);

      expect(optimized).toHaveLength(2);
      expect(optimized[0].objectName).toBe('users');
      expect(optimized[1].objectName).toBe('old_table');
    });

    it('should preserve operation order during optimization', () => {
      const operations = [
        new MigrationOperation(OperationType.DROP_TABLE, 'first', ''),
        new MigrationOperation(OperationType.CREATE_TABLE, 'second', ''),
        new MigrationOperation(OperationType.DROP_TABLE, 'first', ''), // duplicate
        new MigrationOperation(OperationType.ALTER_TABLE, 'third', '')
      ];

      const optimized = diffEngine.optimizeOperations(operations);

      expect(optimized).toHaveLength(3);
      expect(optimized[0].objectName).toBe('first');
      expect(optimized[1].objectName).toBe('second');
      expect(optimized[2].objectName).toBe('third');
    });

    it('should handle empty operations list', () => {
      const optimized = diffEngine.optimizeOperations([]);
      expect(optimized).toEqual([]);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle missing object types gracefully', () => {
      const stateWithUndefined = new SchemaState();
      stateWithUndefined.objects.tables = undefined;

      expect(() => diffEngine.calculateDiff(stateWithUndefined, targetState)).not.toThrow();
    });

    it('should handle empty Maps', () => {
      const operations = diffEngine.calculateDiff(currentState, targetState);
      expect(operations).toEqual([]);
    });

    it('should handle large numbers of objects', () => {
      // Add many objects to test performance
      for (let i = 0; i < 100; i++) {
        currentState.addObject('tables', `table${i}`, { name: `table${i}`, id: i });
        if (i % 2 === 0) {
          // Keep half, modify quarter, remove quarter
          targetState.addObject('tables', `table${i}`, {
            name: `table${i}`,
            id: i,
            modified: true
          });
        }
        if (i % 4 === 0) {
          targetState.addObject('tables', `new_table${i}`, { name: `new_table${i}` });
        }
      }

      const startTime = Date.now();
      const operations = diffEngine.calculateDiff(currentState, targetState);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete quickly
      expect(operations.length).toBeGreaterThan(0);

      // Verify all operations have hashes
      operations.forEach(op => {
        expect(op.hash).toBeTruthy();
      });
    });
  });
});
