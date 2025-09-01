/**
 * pgTAPTestScanner Index Assertion Parsing Tests
 *
 * Tests the index assertion parsing capabilities of pgTAPTestScanner
 */

import { describe, it, expect, beforeEach } from 'vitest';
import pgTAPTestScanner from '../src/lib/testing/pgTAPTestScanner.js';

describe('pgTAPTestScanner Index Assertion Parsing', () => {
  let scanner;

  beforeEach(() => {
    scanner = new pgTAPTestScanner();
  });

  describe('Basic index assertion pattern matching', () => {
    it('should parse has_index with table and index', () => {
      const sql = "SELECT has_index('users', 'idx_users_email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('has_index');
      expect(assertions[0].target).toBe('users.idx_users_email');
      expect(assertions[0].parameters).toEqual(['users', 'idx_users_email']);
    });

    it('should parse has_index with schema, table, and index', () => {
      const sql = "SELECT has_index('public', 'users', 'idx_users_email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('has_index');
      expect(assertions[0].target).toBe('public.users.idx_users_email');
      expect(assertions[0].parameters).toEqual(['public', 'users', 'idx_users_email']);
    });

    it('should parse hasnt_index with table and index', () => {
      const sql = "SELECT hasnt_index('temp_table', 'non_existent_idx');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('hasnt_index');
      expect(assertions[0].target).toBe('temp_table.non_existent_idx');
      expect(assertions[0].parameters).toEqual(['temp_table', 'non_existent_idx']);
    });

    it('should parse hasnt_index with schema, table, and index', () => {
      const sql = "SELECT hasnt_index('private', 'sessions', 'idx_sessions_old');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('hasnt_index');
      expect(assertions[0].target).toBe('private.sessions.idx_sessions_old');
      expect(assertions[0].parameters).toEqual(['private', 'sessions', 'idx_sessions_old']);
    });
  });

  describe('index_is_on assertion pattern matching', () => {
    it('should parse index_is_on with table, index, and single column', () => {
      const sql = "SELECT index_is_on('users', 'idx_users_email', ARRAY['email']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('index_is_on');
      expect(assertions[0].target).toBe('users.idx_users_email');
      expect(assertions[0].parameters).toEqual(['users', 'idx_users_email', "'email'"]);
    });

    it('should parse index_is_on with table, index, and multiple columns', () => {
      const sql = "SELECT index_is_on('orders', 'idx_orders_status_date', ARRAY['status', 'created_at']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('index_is_on');
      expect(assertions[0].target).toBe('orders.idx_orders_status_date');
      expect(assertions[0].parameters).toEqual(['orders', 'idx_orders_status_date', "'status', 'created_at'"]);
    });

    it('should parse index_is_on with schema, table, index, and columns', () => {
      const sql = "SELECT index_is_on('public', 'orders', 'idx_orders_status_date', ARRAY['status', 'created_at']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('index_is_on');
      expect(assertions[0].target).toBe('public.orders.idx_orders_status_date');
      expect(assertions[0].parameters).toEqual(['public', 'orders', 'idx_orders_status_date', "'status', 'created_at'"]);
    });
  });

  describe('index_is_type assertion pattern matching', () => {
    it('should parse index_is_type with table, index, and type', () => {
      const sql = "SELECT index_is_type('users', 'idx_users_email', 'btree');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('index_is_type');
      expect(assertions[0].target).toBe('users.idx_users_email');
      expect(assertions[0].parameters).toEqual(['users', 'idx_users_email', 'btree']);
    });

    it('should parse index_is_type with schema, table, index, and type', () => {
      const sql = "SELECT index_is_type('public', 'posts', 'idx_posts_content', 'gin');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('index_is_type');
      expect(assertions[0].target).toBe('public.posts.idx_posts_content');
      expect(assertions[0].parameters).toEqual(['public', 'posts', 'idx_posts_content', 'gin']);
    });
  });

  describe('unique constraint assertion pattern matching', () => {
    it('should parse has_unique with table and constraint', () => {
      const sql = "SELECT has_unique('users', 'uq_users_email');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('has_unique');
      expect(assertions[0].target).toBe('users.uq_users_email');
      expect(assertions[0].parameters).toEqual(['users', 'uq_users_email']);
    });

    it('should parse has_unique with schema, table, and constraint', () => {
      const sql = "SELECT has_unique('public', 'products', 'uq_products_sku');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('has_unique');
      expect(assertions[0].target).toBe('public.products.uq_products_sku');
      expect(assertions[0].parameters).toEqual(['public', 'products', 'uq_products_sku']);
    });

    it('should parse hasnt_unique with table and constraint', () => {
      const sql = "SELECT hasnt_unique('temp_table', 'old_constraint');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('hasnt_unique');
      expect(assertions[0].target).toBe('temp_table.old_constraint');
      expect(assertions[0].parameters).toEqual(['temp_table', 'old_constraint']);
    });
  });

  describe('index_is_primary assertion pattern matching', () => {
    it('should parse index_is_primary with table and index', () => {
      const sql = "SELECT index_is_primary('users', 'idx_users_pkey');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('index_is_primary');
      expect(assertions[0].target).toBe('users.idx_users_pkey');
      expect(assertions[0].parameters).toEqual(['users', 'idx_users_pkey']);
    });

    it('should parse index_is_primary with schema, table, and index', () => {
      const sql = "SELECT index_is_primary('public', 'users', 'users_pkey');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('index_is_primary');
      expect(assertions[0].target).toBe('public.users.users_pkey');
      expect(assertions[0].parameters).toEqual(['public', 'users', 'users_pkey']);
    });
  });

  describe('Index coverage tracking', () => {
    it('should track indexes in coverage map', () => {
      const sql = `
        SELECT has_index('users', 'idx_users_email');
        SELECT index_is_on('users', 'idx_users_email', ARRAY['email']);
        SELECT index_is_type('users', 'idx_users_email', 'btree');
        SELECT has_unique('products', 'uq_products_sku');
      `;

      const assertions = scanner.extractAssertions(sql);

      // Manually build coverage map for testing
      scanner.testFiles = [{
        filePath: '/test/index_test.sql',
        fileName: 'index_test.sql',
        assertions,
        planCount: 4,
        dependencies: [],
        metadata: {}
      }];

      scanner._buildCoverageMap();
      const coverageMap = scanner.getCoverageMap();

      expect(coverageMap.indexes).toBeDefined();
      expect(Object.keys(coverageMap.indexes)).toContain('users.idx_users_email');
      expect(Object.keys(coverageMap.indexes)).toContain('products.uq_products_sku');

      expect(coverageMap.indexes['users.idx_users_email']).toContain('has_index');
      expect(coverageMap.indexes['users.idx_users_email']).toContain('index_is_on');
      expect(coverageMap.indexes['users.idx_users_email']).toContain('index_is_type');
      expect(coverageMap.indexes['products.uq_products_sku']).toContain('has_unique');
    });

    it('should include indexes in statistics', () => {
      const sql = `
        SELECT has_index('users', 'idx_users_email');
        SELECT has_unique('products', 'uq_products_sku');
        SELECT index_is_primary('orders', 'orders_pkey');
      `;

      const assertions = scanner.extractAssertions(sql);

      scanner.testFiles = [{
        filePath: '/test/index_test.sql',
        fileName: 'index_test.sql',
        assertions,
        planCount: 3,
        dependencies: [],
        metadata: {}
      }];

      scanner._buildCoverageMap();
      const stats = scanner.getStatistics();

      expect(stats.coverageStats.indexesWithTests).toBe(3); // 'users.idx_users_email', 'products.uq_products_sku', 'orders.orders_pkey'
    });
  });

  describe('Complex index test scenarios', () => {
    it('should handle mixed index and other assertions', () => {
      const sql = `
        SELECT plan(5);
        SELECT has_table('users');
        SELECT has_index('users', 'idx_users_email');
        SELECT has_column('users', 'email');
        SELECT index_is_on('users', 'idx_users_email', ARRAY['email']);
        SELECT index_is_type('users', 'idx_users_email', 'btree');
      `;

      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(5); // Excludes the plan statement

      const indexAssertions = assertions.filter(a =>
        a.type.includes('index') || a.type.includes('unique')
      );
      expect(indexAssertions).toHaveLength(3);

      const tableColumnAssertions = assertions.filter(a =>
        a.type.includes('table') || a.type.includes('column')
      );
      expect(tableColumnAssertions).toHaveLength(2);
    });

    it('should handle whitespace and formatting variations', () => {
      const sql = `
        SELECT   has_index(  'users',  'idx_users_email'  );
        SELECT index_is_on(
          'public',
          'orders',
          'idx_orders_composite',
          ARRAY['status', 'created_at']
        );
        SELECT index_is_type('users','idx_users_email','btree');
      `;

      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(3);
      expect(assertions[0].type).toBe('has_index');
      expect(assertions[1].type).toBe('index_is_on');
      expect(assertions[2].type).toBe('index_is_type');

      expect(assertions[0].target).toBe('users.idx_users_email');
      expect(assertions[1].target).toBe('public.orders.idx_orders_composite');
      expect(assertions[2].target).toBe('users.idx_users_email');
    });

    it('should handle all index assertion types in one test', () => {
      const sql = `
        SELECT has_index('users', 'idx_users_email');
        SELECT hasnt_index('users', 'old_index');
        SELECT index_is_on('users', 'idx_users_email', ARRAY['email']);
        SELECT index_is_type('users', 'idx_users_email', 'btree');
        SELECT has_unique('users', 'uq_users_email');
        SELECT hasnt_unique('users', 'old_unique');
        SELECT index_is_primary('users', 'users_pkey');
      `;

      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(7);

      const assertionTypes = assertions.map(a => a.type);
      expect(assertionTypes).toContain('has_index');
      expect(assertionTypes).toContain('hasnt_index');
      expect(assertionTypes).toContain('index_is_on');
      expect(assertionTypes).toContain('index_is_type');
      expect(assertionTypes).toContain('has_unique');
      expect(assertionTypes).toContain('hasnt_unique');
      expect(assertionTypes).toContain('index_is_primary');

      // All should be categorized as index assertions
      const indexAssertions = assertions.filter(a =>
        a.type.includes('index') || a.type.includes('unique')
      );
      expect(indexAssertions).toHaveLength(7);
    });
  });
});
