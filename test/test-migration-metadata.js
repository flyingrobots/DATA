#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MigrationMetadata from '../src/lib/MigrationMetadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test suite for MigrationMetadata class
 */
class MigrationMetadataTests {
  constructor() {
    this.testDir = path.join(__dirname, 'test-migrations');
    this.passCount = 0;
    this.failCount = 0;
  }

  setup() {
    // Clean up any existing test directory
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true });
    }
    fs.mkdirSync(this.testDir, { recursive: true });
  }

  cleanup() {
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true });
    }
  }

  assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      this.passCount++;
    } else {
      console.log(`❌ FAIL: ${message}`);
      this.failCount++;
    }
  }

  assertThrows(fn, expectedMessage, testMessage) {
    try {
      fn();
      console.log(`❌ FAIL: ${testMessage} (expected error but none thrown)`);
      this.failCount++;
    } catch (error) {
      if (expectedMessage && !error.message.includes(expectedMessage)) {
        console.log(`❌ FAIL: ${testMessage} (wrong error: ${error.message})`);
        this.failCount++;
      } else {
        console.log(`✅ PASS: ${testMessage}`);
        this.passCount++;
      }
    }
  }

  testConstructor() {
    console.log('\n🧪 Testing constructor...');

    // Valid constructor
    const migrationPath = path.join(this.testDir, 'migration1');
    const metadata = new MigrationMetadata(migrationPath);
    this.assert(metadata.migrationPath === migrationPath, 'Constructor sets migration path');

    // Invalid constructors
    this.assertThrows(
      () => new MigrationMetadata(),
      'migrationPath is required',
      'Constructor requires migrationPath'
    );

    this.assertThrows(
      () => new MigrationMetadata(123),
      'must be a string',
      'Constructor validates string type'
    );
  }

  testCreateDefault() {
    console.log('\n🧪 Testing createDefault...');

    const id = '20250828_123456';
    const name = 'test_migration';
    const metadata = MigrationMetadata.createDefault(id, name);

    this.assert(metadata.id === id, 'createDefault sets ID');
    this.assert(metadata.name === name, 'createDefault sets name');
    this.assert(metadata.status === 'pending', 'createDefault sets pending status');
    this.assert(metadata.testing.tested_at === null, 'createDefault initializes testing');
    this.assert(metadata.promotion.promoted_at === null, 'createDefault initializes promotion');
    this.assert(typeof metadata.generated === 'string', 'createDefault sets generated timestamp');

    // Test validation of created metadata
    const migrationPath = path.join(this.testDir, 'migration2');
    const metadataManager = new MigrationMetadata(migrationPath);
    metadataManager.validate(metadata); // Should not throw
    this.assert(true, 'createDefault produces valid metadata');

    // Invalid parameters
    this.assertThrows(
      () => MigrationMetadata.createDefault(),
      'id is required',
      'createDefault requires id'
    );

    this.assertThrows(
      () => MigrationMetadata.createDefault('test', 123),
      'name is required and must be a string',
      'createDefault validates name type'
    );
  }

  testValidation() {
    console.log('\n🧪 Testing validation...');

    const migrationPath = path.join(this.testDir, 'migration3');
    const metadata = new MigrationMetadata(migrationPath);

    // Valid metadata
    const validData = {
      id: '20250828_123456',
      name: 'test_migration',
      generated: '2025-08-28T12:34:56.000Z',
      status: 'pending',
      testing: {
        tested_at: null,
        tests_passed: 0,
        tests_failed: 0
      },
      promotion: {
        promoted_at: null,
        promoted_by: null
      }
    };

    metadata.validate(validData); // Should not throw
    this.assert(true, 'Valid metadata passes validation');

    // Test required fields
    this.assertThrows(
      () => metadata.validate({}),
      'id is required',
      'Validation catches missing id'
    );

    this.assertThrows(
      () => metadata.validate({ id: '123' }),
      'name is required',
      'Validation catches missing name'
    );

    this.assertThrows(
      () => metadata.validate({ id: '123', name: 'test' }),
      'generated is required',
      'Validation catches missing generated'
    );

    // Test status validation
    this.assertThrows(
      () => metadata.validate({
        id: '123',
        name: 'test',
        generated: '2025-08-28T12:34:56.000Z',
        status: 'invalid'
      }),
      'status must be one of',
      'Validation catches invalid status'
    );

    // Test date format validation
    this.assertThrows(
      () => metadata.validate({
        id: '123',
        name: 'test',
        generated: 'invalid-date',
        status: 'pending'
      }),
      'generated must be a valid ISO 8601',
      'Validation catches invalid date format'
    );

    // Test testing object validation
    this.assertThrows(
      () => metadata.validate({
        ...validData,
        testing: {
          tested_at: 'invalid-date'
        }
      }),
      'testing.tested_at must be null or valid ISO 8601',
      'Validation catches invalid testing.tested_at'
    );

    this.assertThrows(
      () => metadata.validate({
        ...validData,
        testing: {
          tests_passed: -1
        }
      }),
      'testing.tests_passed must be a non-negative integer',
      'Validation catches negative tests_passed'
    );
  }

  testReadWrite() {
    console.log('\n🧪 Testing read/write operations...');

    const migrationPath = path.join(this.testDir, 'migration4');
    const metadata = new MigrationMetadata(migrationPath);

    const testData = MigrationMetadata.createDefault('20250828_123456', 'test_migration');

    // Test write
    metadata.write(testData);
    this.assert(fs.existsSync(metadata.metadataFile), 'Write creates metadata file');

    // Test read
    const readData = metadata.read();
    this.assert(readData.id === testData.id, 'Read returns correct id');
    this.assert(readData.name === testData.name, 'Read returns correct name');
    this.assert(readData.status === testData.status, 'Read returns correct status');

    // Test reading non-existent file
    const nonExistentPath = path.join(this.testDir, 'nonexistent');
    const nonExistentMetadata = new MigrationMetadata(nonExistentPath);
    this.assertThrows(
      () => nonExistentMetadata.read(),
      'Metadata file not found',
      'Read throws on missing file'
    );

    // Test reading invalid JSON
    const invalidJsonPath = path.join(this.testDir, 'invalid-json');
    fs.mkdirSync(invalidJsonPath, { recursive: true });
    fs.writeFileSync(path.join(invalidJsonPath, 'metadata.json'), '{ invalid json }');

    const invalidJsonMetadata = new MigrationMetadata(invalidJsonPath);
    this.assertThrows(
      () => invalidJsonMetadata.read(),
      'Invalid JSON in metadata file',
      'Read throws on invalid JSON'
    );
  }

  testUpdate() {
    console.log('\n🧪 Testing update operations...');

    const migrationPath = path.join(this.testDir, 'migration5');
    const metadata = new MigrationMetadata(migrationPath);

    // Create initial metadata
    const initial = MigrationMetadata.createDefault('20250828_123456', 'test_migration');
    metadata.write(initial);

    // Test simple update
    const updated = metadata.update({ status: 'tested' });
    this.assert(updated.status === 'tested', 'Update changes status');
    this.assert(updated.id === initial.id, 'Update preserves other fields');

    // Test nested update
    const nestedUpdate = metadata.update({
      testing: {
        tested_at: '2025-08-28T13:00:00.000Z',
        tests_passed: 5
      }
    });

    this.assert(nestedUpdate.testing.tested_at === '2025-08-28T13:00:00.000Z', 'Update handles nested objects');
    this.assert(nestedUpdate.testing.tests_failed === 0, 'Update preserves nested fields');

    // Test invalid update
    this.assertThrows(
      () => metadata.update({ status: 'invalid' }),
      'status must be one of',
      'Update validates changes'
    );

    this.assertThrows(
      () => metadata.update(),
      'Updates must be an object',
      'Update requires object parameter'
    );
  }

  testLifecycle() {
    console.log('\n🧪 Testing full lifecycle...');

    const migrationPath = path.join(this.testDir, 'migration6');
    const metadata = new MigrationMetadata(migrationPath);

    // 1. Create new migration
    const initial = MigrationMetadata.createDefault('20250828_140000', 'user_authentication');
    metadata.write(initial);

    // 2. Update to tested status
    metadata.update({
      status: 'tested',
      testing: {
        tested_at: '2025-08-28T14:30:00.000Z',
        tests_passed: 12,
        tests_failed: 0
      }
    });

    // 3. Promote to production
    const final = metadata.update({
      status: 'promoted',
      promotion: {
        promoted_at: '2025-08-28T15:00:00.000Z',
        promoted_by: 'admin@example.com'
      }
    });

    this.assert(final.status === 'promoted', 'Lifecycle reaches promoted status');
    this.assert(final.testing.tests_passed === 12, 'Lifecycle preserves test results');
    this.assert(final.promotion.promoted_by === 'admin@example.com', 'Lifecycle tracks promotion');

    // Verify file persistence
    const reread = metadata.read();
    this.assert(reread.status === 'promoted', 'Lifecycle changes persist to disk');
  }

  /**
   * Validate ISO 8601 date format
   * @param {string} dateString
   * @returns {boolean}
   * @private
   */
  _isValidISO8601(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) &&
           dateString === date.toISOString();
  }

  /**
   * Deep merge helper for nested object updates
   * @param {Object} target
   * @param {Object} source
   * @returns {Object}
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this._deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  run() {
    console.log('🚀 Running MigrationMetadata tests...\n');

    this.setup();

    try {
      this.testConstructor();
      this.testCreateDefault();
      this.testValidation();
      this.testReadWrite();
      this.testUpdate();
      this.testLifecycle();

      console.log(`\n📊 Test Results: ${this.passCount} passed, ${this.failCount} failed`);

      if (this.failCount === 0) {
        console.log('🎉 All tests passed!');
        process.exit(0);
      } else {
        console.log('💥 Some tests failed!');
        process.exit(1);
      }
    } finally {
      this.cleanup();
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new MigrationMetadataTests();
  tests.run();
}

export default MigrationMetadataTests;
