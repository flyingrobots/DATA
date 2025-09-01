/**
 * Unit tests for SqlGraph dependency resolution
 *
 * Tests the SqlGraph class functionality including:
 * - SQL object parsing and identification
 * - Dependency resolution between SQL objects
 * - Topological sorting of execution order
 * - Circular dependency detection
 * - Port/adapter pattern validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SqlGraph, SqlNode } from '../../../packages/data-core/lib/SqlGraph.js';
import { FileSystemPort } from '../../../packages/data-core/ports/index.js';

/**
 * Mock FileSystem adapter for testing
 */
class MockFileSystemAdapter extends FileSystemPort {
  constructor() {
    super();
    this.files = new Map();
  }

  setFile(path, content) {
    this.files.set(path, content);
  }

  async readFile(path) {
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    return this.files.get(path);
  }

  async glob(patterns, cwd) {
    // Simple mock implementation
    return Array.from(this.files.keys()).filter(path =>
      patterns.some(pattern => path.includes(pattern.replace('*', '')))
    );
  }
}

describe('SqlNode', () => {
  let node1, node2, node3;

  beforeEach(() => {
    node1 = new SqlNode('users', 'table', '/sql/users.sql', 'CREATE TABLE users...');
    node2 = new SqlNode('orders', 'table', '/sql/orders.sql', 'CREATE TABLE orders...');
    node3 = new SqlNode('get_user_orders', 'function', '/sql/functions.sql', 'CREATE FUNCTION...');
  });

  it('should create a SqlNode with correct properties', () => {
    expect(node1.name).toBe('users');
    expect(node1.type).toBe('table');
    expect(node1.filePath).toBe('/sql/users.sql');
    expect(node1.content).toBe('CREATE TABLE users...');
    expect(node1.dependencies).toBeInstanceOf(Set);
    expect(node1.dependents).toBeInstanceOf(Set);
    expect(node1.dependencies.size).toBe(0);
    expect(node1.dependents.size).toBe(0);
  });

  it('should add dependencies correctly', () => {
    node2.addDependency(node1);

    expect(node2.dependencies.has(node1)).toBe(true);
    expect(node1.dependents.has(node2)).toBe(true);
    expect(node2.dependencies.size).toBe(1);
    expect(node1.dependents.size).toBe(1);
  });

  it('should remove dependencies correctly', () => {
    node2.addDependency(node1);
    node2.removeDependency(node1);

    expect(node2.dependencies.has(node1)).toBe(false);
    expect(node1.dependents.has(node2)).toBe(false);
    expect(node2.dependencies.size).toBe(0);
    expect(node1.dependents.size).toBe(0);
  });

  it('should detect circular dependencies', () => {
    // Create circular dependency: node1 -> node2 -> node3 -> node1
    node1.addDependency(node2);
    node2.addDependency(node3);
    node3.addDependency(node1);

    expect(node1.hasCircularDependency()).toBe(true);
    expect(node2.hasCircularDependency()).toBe(true);
    expect(node3.hasCircularDependency()).toBe(true);
  });

  it('should not detect circular dependencies in linear chains', () => {
    // Linear dependency: node1 -> node2 -> node3
    node1.addDependency(node2);
    node2.addDependency(node3);

    expect(node1.hasCircularDependency()).toBe(false);
    expect(node2.hasCircularDependency()).toBe(false);
    expect(node3.hasCircularDependency()).toBe(false);
  });

  it('should handle self-dependency detection', () => {
    const visited = new Set();
    expect(node1.hasCircularDependency(visited)).toBe(false);

    // Add self-dependency
    node1.addDependency(node1);
    expect(node1.hasCircularDependency()).toBe(true);
  });
});

describe('SqlGraph', () => {
  let mockFileSystem;
  let sqlGraph;

  beforeEach(() => {
    mockFileSystem = new MockFileSystemAdapter();
    sqlGraph = new SqlGraph(mockFileSystem);
  });

  describe('constructor and port validation', () => {
    it('should validate FileSystemPort on construction', () => {
      expect(() => new SqlGraph(mockFileSystem)).not.toThrow();
      expect(sqlGraph.fileSystemPort).toBe(mockFileSystem);
    });

    it('should throw error for invalid port', () => {
      const invalidPort = { readFile: () => {} }; // Not instance of FileSystemPort

      expect(() => new SqlGraph(invalidPort)).toThrow('Port must be instance of FileSystemPort');
    });

    it('should have correct initial state', () => {
      expect(sqlGraph.nodes).toBeInstanceOf(Map);
      expect(sqlGraph.nodes.size).toBe(0);
      expect(sqlGraph.sqlPatterns).toBeDefined();
      expect(sqlGraph.sqlPatterns.create).toBeInstanceOf(RegExp);
      expect(sqlGraph.sqlPatterns.reference).toBeInstanceOf(RegExp);
      expect(sqlGraph.sqlPatterns.functionCall).toBeInstanceOf(RegExp);
    });
  });

  describe('SQL parsing and object identification', () => {
    beforeEach(() => {
      mockFileSystem.setFile('/sql/users.sql', `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(255) UNIQUE
        );
      `);

      mockFileSystem.setFile('/sql/orders.sql', `
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          total DECIMAL(10,2)
        );
      `);

      mockFileSystem.setFile('/sql/functions.sql', `
        CREATE OR REPLACE FUNCTION get_user_orders(user_id INT)
        RETURNS TABLE(order_id INT, total DECIMAL) AS $$
        BEGIN
          RETURN QUERY
          SELECT id, total FROM orders WHERE orders.user_id = $1;
        END;
        $$ LANGUAGE plpgsql;
      `);

      mockFileSystem.setFile('/sql/views.sql', `
        CREATE VIEW user_order_summary AS
        SELECT u.name, COUNT(o.id) as order_count, SUM(o.total) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id, u.name;
      `);

      mockFileSystem.setFile('/sql/migration.sql', `
        INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com');
        UPDATE orders SET total = total * 1.1 WHERE created_at < '2024-01-01';
      `);
    });

    it('should identify CREATE TABLE statements', async () => {
      await sqlGraph.buildGraph(['/sql/users.sql']);

      expect(sqlGraph.nodes.has('users')).toBe(true);
      const userNode = sqlGraph.nodes.get('users');
      expect(userNode.type).toBe('table');
      expect(userNode.name).toBe('users');
      expect(userNode.filePath).toBe('/sql/users.sql');
    });

    it('should identify CREATE FUNCTION statements', async () => {
      await sqlGraph.buildGraph(['/sql/functions.sql']);

      expect(sqlGraph.nodes.has('get_user_orders')).toBe(true);
      const functionNode = sqlGraph.nodes.get('get_user_orders');
      expect(functionNode.type).toBe('function');
      expect(functionNode.name).toBe('get_user_orders');
    });

    it('should identify CREATE VIEW statements', async () => {
      await sqlGraph.buildGraph(['/sql/views.sql']);

      expect(sqlGraph.nodes.has('user_order_summary')).toBe(true);
      const viewNode = sqlGraph.nodes.get('user_order_summary');
      expect(viewNode.type).toBe('view');
      expect(viewNode.name).toBe('user_order_summary');
    });

    it('should handle files without CREATE statements as migration scripts', async () => {
      await sqlGraph.buildGraph(['/sql/migration.sql']);

      expect(sqlGraph.nodes.has('migration')).toBe(true);
      const scriptNode = sqlGraph.nodes.get('migration');
      expect(scriptNode.type).toBe('script');
      expect(scriptNode.name).toBe('migration');
    });

    it('should handle OR REPLACE syntax', async () => {
      mockFileSystem.setFile('/sql/replace.sql', 'CREATE OR REPLACE VIEW test_view AS SELECT 1;');
      await sqlGraph.buildGraph(['/sql/replace.sql']);

      expect(sqlGraph.nodes.has('test_view')).toBe(true);
      const node = sqlGraph.nodes.get('test_view');
      expect(node.type).toBe('view');
    });

    it('should handle IF NOT EXISTS syntax', async () => {
      mockFileSystem.setFile('/sql/conditional.sql', 'CREATE TABLE IF NOT EXISTS test_table (id INT);');
      await sqlGraph.buildGraph(['/sql/conditional.sql']);

      expect(sqlGraph.nodes.has('test_table')).toBe(true);
      const node = sqlGraph.nodes.get('test_table');
      expect(node.type).toBe('table');
    });
  });

  describe('dependency analysis', () => {
    beforeEach(async () => {
      // Set up complex dependency scenario
      mockFileSystem.setFile('/sql/users.sql', 'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100));');
      mockFileSystem.setFile('/sql/orders.sql', 'CREATE TABLE orders (id SERIAL, user_id INTEGER REFERENCES users(id));');
      mockFileSystem.setFile('/sql/products.sql', 'CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(100));');
      mockFileSystem.setFile('/sql/order_items.sql', `
        CREATE TABLE order_items (
          order_id INTEGER REFERENCES orders(id),
          product_id INTEGER REFERENCES products(id)
        );
      `);
      mockFileSystem.setFile('/sql/functions.sql', `
        CREATE FUNCTION get_order_total(order_id INT) RETURNS DECIMAL AS $$
        SELECT SUM(p.price) FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1;
        $$ LANGUAGE SQL;
      `);
      mockFileSystem.setFile('/sql/views.sql', `
        CREATE VIEW order_summary AS
        SELECT o.id, u.name as customer, get_order_total(o.id) as total
        FROM orders o
        JOIN users u ON o.user_id = u.id;
      `);

      await sqlGraph.buildGraph([
        '/sql/users.sql',
        '/sql/orders.sql',
        '/sql/products.sql',
        '/sql/order_items.sql',
        '/sql/functions.sql',
        '/sql/views.sql'
      ]);
    });

    it('should identify REFERENCES dependencies', () => {
      const ordersNode = sqlGraph.nodes.get('orders');
      const usersNode = sqlGraph.nodes.get('users');

      expect(ordersNode.dependencies.has(usersNode)).toBe(true);
      expect(usersNode.dependents.has(ordersNode)).toBe(true);
    });

    it('should identify JOIN dependencies', () => {
      const viewNode = sqlGraph.nodes.get('order_summary');
      const ordersNode = sqlGraph.nodes.get('orders');
      const usersNode = sqlGraph.nodes.get('users');

      expect(viewNode.dependencies.has(ordersNode)).toBe(true);
      expect(viewNode.dependencies.has(usersNode)).toBe(true);
    });

    it('should identify function call dependencies', () => {
      const viewNode = sqlGraph.nodes.get('order_summary');
      const functionNode = sqlGraph.nodes.get('get_order_total');

      expect(viewNode.dependencies.has(functionNode)).toBe(true);
    });

    it('should handle multiple dependencies correctly', () => {
      const orderItemsNode = sqlGraph.nodes.get('order_items');
      const ordersNode = sqlGraph.nodes.get('orders');
      const productsNode = sqlGraph.nodes.get('products');

      expect(orderItemsNode.dependencies.size).toBe(2);
      expect(orderItemsNode.dependencies.has(ordersNode)).toBe(true);
      expect(orderItemsNode.dependencies.has(productsNode)).toBe(true);
    });

    it('should not create self-dependencies', () => {
      for (const node of sqlGraph.nodes.values()) {
        expect(node.dependencies.has(node)).toBe(false);
      }
    });
  });

  describe('topological sorting and execution order', () => {
    it('should return correct execution order for simple chain', async () => {
      mockFileSystem.setFile('/sql/a.sql', 'CREATE TABLE a (id INT);');
      mockFileSystem.setFile('/sql/b.sql', 'CREATE TABLE b (a_id INT REFERENCES a(id));');
      mockFileSystem.setFile('/sql/c.sql', 'CREATE TABLE c (b_id INT REFERENCES b(id));');

      await sqlGraph.buildGraph(['/sql/a.sql', '/sql/b.sql', '/sql/c.sql']);
      const executionOrder = sqlGraph.getExecutionOrder();

      expect(executionOrder.length).toBe(3);
      expect(executionOrder[0].name).toBe('a');
      expect(executionOrder[1].name).toBe('b');
      expect(executionOrder[2].name).toBe('c');
    });

    it('should handle diamond dependency pattern', async () => {
      mockFileSystem.setFile('/sql/base.sql', 'CREATE TABLE base (id INT);');
      mockFileSystem.setFile('/sql/left.sql', 'CREATE TABLE left_table (base_id INT REFERENCES base(id));');
      mockFileSystem.setFile('/sql/right.sql', 'CREATE TABLE right_table (base_id INT REFERENCES base(id));');
      mockFileSystem.setFile('/sql/top.sql', `
        CREATE TABLE top_table (
          left_id INT REFERENCES left_table(id),
          right_id INT REFERENCES right_table(id)
        );
      `);

      await sqlGraph.buildGraph(['/sql/base.sql', '/sql/left.sql', '/sql/right.sql', '/sql/top.sql']);
      const executionOrder = sqlGraph.getExecutionOrder();

      expect(executionOrder.length).toBe(4);
      expect(executionOrder[0].name).toBe('base');
      expect(executionOrder[3].name).toBe('top_table');
      // left_table and right_table can be in either order
      const middleNames = [executionOrder[1].name, executionOrder[2].name].sort();
      expect(middleNames).toEqual(['left_table', 'right_table']);
    });

    it('should detect circular dependencies and throw error', async () => {
      mockFileSystem.setFile('/sql/a.sql', 'CREATE TABLE a (b_id INT REFERENCES b(id));');
      mockFileSystem.setFile('/sql/b.sql', 'CREATE TABLE b (c_id INT REFERENCES c(id));');
      mockFileSystem.setFile('/sql/c.sql', 'CREATE TABLE c (a_id INT REFERENCES a(id));');

      await sqlGraph.buildGraph(['/sql/a.sql', '/sql/b.sql', '/sql/c.sql']);

      expect(() => sqlGraph.getExecutionOrder()).toThrow('Circular dependency detected involving:');
    });

    it('should handle independent nodes correctly', async () => {
      mockFileSystem.setFile('/sql/independent1.sql', 'CREATE TABLE independent1 (id INT);');
      mockFileSystem.setFile('/sql/independent2.sql', 'CREATE TABLE independent2 (id INT);');
      mockFileSystem.setFile('/sql/dependent.sql', `
        CREATE TABLE dependent (
          id1 INT REFERENCES independent1(id),
          id2 INT REFERENCES independent2(id)
        );
      `);

      await sqlGraph.buildGraph(['/sql/independent1.sql', '/sql/independent2.sql', '/sql/dependent.sql']);
      const executionOrder = sqlGraph.getExecutionOrder();

      expect(executionOrder.length).toBe(3);
      expect(executionOrder[2].name).toBe('dependent');
      // First two can be in any order
      const independentNames = [executionOrder[0].name, executionOrder[1].name].sort();
      expect(independentNames).toEqual(['independent1', 'independent2']);
    });
  });

  describe('graph analysis utilities', () => {
    beforeEach(async () => {
      mockFileSystem.setFile('/sql/root1.sql', 'CREATE TABLE root1 (id INT);');
      mockFileSystem.setFile('/sql/root2.sql', 'CREATE TABLE root2 (id INT);');
      mockFileSystem.setFile('/sql/child1.sql', 'CREATE TABLE child1 (root1_id INT REFERENCES root1(id));');
      mockFileSystem.setFile('/sql/child2.sql', 'CREATE TABLE child2 (root2_id INT REFERENCES root2(id));');
      mockFileSystem.setFile('/sql/leaf.sql', `
        CREATE TABLE leaf (
          child1_id INT REFERENCES child1(id),
          child2_id INT REFERENCES child2(id)
        );
      `);

      await sqlGraph.buildGraph([
        '/sql/root1.sql',
        '/sql/root2.sql',
        '/sql/child1.sql',
        '/sql/child2.sql',
        '/sql/leaf.sql'
      ]);
    });

    it('should identify independent nodes (no dependencies)', () => {
      const independentNodes = sqlGraph.getIndependentNodes();

      expect(independentNodes.length).toBe(2);
      const names = independentNodes.map(node => node.name).sort();
      expect(names).toEqual(['root1', 'root2']);
    });

    it('should identify terminal nodes (no dependents)', () => {
      const terminalNodes = sqlGraph.getTerminalNodes();

      expect(terminalNodes.length).toBe(1);
      expect(terminalNodes[0].name).toBe('leaf');
    });

    it('should return all nodes', () => {
      const allNodes = sqlGraph.getAllNodes();

      expect(allNodes.length).toBe(5);
      const names = allNodes.map(node => node.name).sort();
      expect(names).toEqual(['child1', 'child2', 'leaf', 'root1', 'root2']);
    });

    it('should detect absence of circular dependencies in valid graph', () => {
      expect(sqlGraph.hasCircularDependencies()).toBe(false);
    });

    it('should detect presence of circular dependencies', async () => {
      // Add circular dependency
      mockFileSystem.setFile('/sql/circular.sql', 'CREATE TABLE circular (leaf_id INT REFERENCES leaf(id));');
      const leafNode = sqlGraph.nodes.get('leaf');
      const circularNode = new SqlNode('circular', 'table', '/sql/circular.sql', 'CREATE TABLE...');
      sqlGraph.nodes.set('circular', circularNode);

      // Create circular dependency: leaf -> circular -> leaf
      circularNode.addDependency(leafNode);
      leafNode.addDependency(circularNode);

      expect(sqlGraph.hasCircularDependencies()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const fileSystem = new MockFileSystemAdapter();
      const graph = new SqlGraph(fileSystem);

      await expect(graph.buildGraph(['/nonexistent.sql'])).rejects.toThrow('File not found');
    });

    it('should clear existing graph on rebuild', async () => {
      mockFileSystem.setFile('/sql/test1.sql', 'CREATE TABLE test1 (id INT);');
      await sqlGraph.buildGraph(['/sql/test1.sql']);
      expect(sqlGraph.nodes.size).toBe(1);

      mockFileSystem.setFile('/sql/test2.sql', 'CREATE TABLE test2 (id INT);');
      await sqlGraph.buildGraph(['/sql/test2.sql']);
      expect(sqlGraph.nodes.size).toBe(1);
      expect(sqlGraph.nodes.has('test2')).toBe(true);
      expect(sqlGraph.nodes.has('test1')).toBe(false);
    });

    it('should handle empty SQL files', async () => {
      mockFileSystem.setFile('/sql/empty.sql', '   \n\n  ');
      await sqlGraph.buildGraph(['/sql/empty.sql']);

      expect(sqlGraph.nodes.has('empty')).toBe(true);
      const node = sqlGraph.nodes.get('empty');
      expect(node.type).toBe('script');
    });

    it('should handle SQL with comments and whitespace', async () => {
      mockFileSystem.setFile('/sql/commented.sql', `
        -- This is a comment
        /* Multi-line
           comment */
        CREATE TABLE commented_table (
          id SERIAL PRIMARY KEY,
          /* inline comment */ name VARCHAR(100)
        );
      `);

      await sqlGraph.buildGraph(['/sql/commented.sql']);
      expect(sqlGraph.nodes.has('commented_table')).toBe(true);
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large number of nodes efficiently', async () => {
      const nodeCount = 100;
      const files = [];

      // Create chain of dependencies
      for (let i = 0; i < nodeCount; i++) {
        const fileName = `/sql/table${i}.sql`;
        let sql = `CREATE TABLE table${i} (id SERIAL PRIMARY KEY`;
        if (i > 0) {
          sql += `, ref INT REFERENCES table${i-1}(id)`;
        }
        sql += ');';

        mockFileSystem.setFile(fileName, sql);
        files.push(fileName);
      }

      const startTime = Date.now();
      await sqlGraph.buildGraph(files);
      const buildTime = Date.now() - startTime;

      expect(buildTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(sqlGraph.nodes.size).toBe(nodeCount);

      const execOrderStartTime = Date.now();
      const executionOrder = sqlGraph.getExecutionOrder();
      const execOrderTime = Date.now() - execOrderStartTime;

      expect(execOrderTime).toBeLessThan(1000); // Topological sort should be fast
      expect(executionOrder.length).toBe(nodeCount);
    });

    it('should handle nodes with same name but different types', async () => {
      // PostgreSQL allows same names for different object types
      mockFileSystem.setFile('/sql/same_name.sql', `
        CREATE TABLE user_stats (id INT);
        CREATE VIEW user_stats AS SELECT * FROM user_stats;
      `);

      await sqlGraph.buildGraph(['/sql/same_name.sql']);

      // Last one wins in our simple implementation
      expect(sqlGraph.nodes.size).toBe(1);
      expect(sqlGraph.nodes.get('user_stats').type).toBe('view');
    });

    it('should handle complex schema names with dots', async () => {
      mockFileSystem.setFile('/sql/schema.sql', 'CREATE TABLE public.users (id INT);');
      await sqlGraph.buildGraph(['/sql/schema.sql']);

      expect(sqlGraph.nodes.has('public.users')).toBe(true);
    });
  });
});
