/**
 * SQL dependency graph builder for analyzing relationships between SQL files.
 * Builds a directed graph of dependencies by parsing SQL statements for references
 * to tables, views, functions, and other database objects.
 * 
 * @fileoverview SQL dependency analysis and topological sorting
 */

import { FileSystemPort, validatePort } from '../ports/index.js';

/**
 * Represents a node in the SQL dependency graph
 */
/**
 * SqlNode class
 * @class
 */
export class SqlNode {
  /**
   * @param {string} name - Name of the SQL object (table, view, function, etc.)
   * @param {string} type - Type of object (table, view, function, trigger, etc.)
   * @param {string} filePath - Path to the SQL file containing this object
   * @param {string} content - SQL content for this object
   */
  constructor(name, type, filePath, content) {
    this.name = name;
    this.type = type;
    this.filePath = filePath;
    this.content = content;
    this.dependencies = new Set();
    this.dependents = new Set();
  }

  /**
   * Add a dependency to this node
   * @param {SqlNode} node - Node this depends on
   */
  addDependency(node) {
    this.dependencies.add(node);
    node.dependents.add(this);
  }

  /**
   * Remove a dependency from this node
   * @param {SqlNode} node - Node to remove dependency on
   */
  removeDependency(node) {
    this.dependencies.delete(node);
    node.dependents.delete(this);
  }

  /**
   * Check if this node has circular dependencies
   * @param {Set<SqlNode>} visited - Already visited nodes
   * @returns {boolean} True if circular dependency detected
   */
  hasCircularDependency(visited = new Set()) {
    if (visited.has(this)) {
      return true;
    }
    
    visited.add(this);
    for (const dep of this.dependencies) {
      if (dep.hasCircularDependency(visited)) {
        return true;
      }
    }
    visited.delete(this);
    return false;
  }
}

/**
 * SQL dependency graph builder and analyzer
 */
/**
 * SqlGraph class
 * @class
 */
export class SqlGraph {
  /**
   * @param {FileSystemPort} fileSystemPort - File system adapter
   */
  constructor(fileSystemPort) {
    validatePort(fileSystemPort, FileSystemPort);
    this.fileSystemPort = fileSystemPort;
    this.nodes = new Map();
    this.sqlPatterns = {
      // Pattern to match CREATE statements
      create: /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP|TEMPORARY\s+)?(?:TABLE|VIEW|FUNCTION|PROCEDURE|TRIGGER|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?([.\w]+)/gi,
      // Pattern to match references (FROM, JOIN, REFERENCES, etc.)
      reference: /(?:FROM|JOIN|REFERENCES|USING)\s+([.\w]+)/gi,
      // Pattern to match function calls
      functionCall: /([.\w]+)\s*\(/gi
    };
  }

  /**
   * Build dependency graph from SQL files
   * @param {string[]} sqlFiles - Array of SQL file paths
   * @returns {Promise<void>}
   */
  async buildGraph(sqlFiles) {
    // Clear existing graph
    this.nodes.clear();

    // First pass: identify all SQL objects
    for (const filePath of sqlFiles) {
      await this._parseFile(filePath);
    }

    // Second pass: build dependencies
    for (const node of this.nodes.values()) {
      this._analyzeDependencies(node);
    }
  }

  /**
   * Parse a SQL file and extract objects
   * @param {string} filePath - Path to SQL file
   * @private
   */
  async _parseFile(filePath) {
    const content = await this.fileSystemPort.readFile(filePath);
    const createMatches = [...content.matchAll(this.sqlPatterns.create)];

    for (const match of createMatches) {
      const objectName = match[1].toLowerCase();
      const objectType = match[0].match(/(?:TABLE|VIEW|FUNCTION|PROCEDURE|TRIGGER|INDEX)/i)[0].toLowerCase();
      
      const node = new SqlNode(objectName, objectType, filePath, content);
      this.nodes.set(objectName, node);
    }

    // If no CREATE statements found, treat as migration script
    if (createMatches.length === 0) {
      const scriptName = filePath.split('/').pop().replace(/\.sql$/, '');
      const node = new SqlNode(scriptName, 'script', filePath, content);
      this.nodes.set(scriptName, node);
    }
  }

  /**
   * Analyze dependencies for a SQL node
   * @param {SqlNode} node - Node to analyze
   * @private
   */
  _analyzeDependencies(node) {
    const content = node.content.toLowerCase();
    
    // Find table/view references
    const references = [...content.matchAll(this.sqlPatterns.reference)];
    for (const match of references) {
      const referencedName = match[1].toLowerCase();
      const referencedNode = this.nodes.get(referencedName);
      if (referencedNode && referencedNode !== node) {
        node.addDependency(referencedNode);
      }
    }

    // Find function calls
    const functionCalls = [...content.matchAll(this.sqlPatterns.functionCall)];
    for (const match of functionCalls) {
      const functionName = match[1].toLowerCase();
      const functionNode = this.nodes.get(functionName);
      if (functionNode && functionNode.type === 'function' && functionNode !== node) {
        node.addDependency(functionNode);
      }
    }
  }

  /**
   * Get topologically sorted execution order
   * @returns {SqlNode[]} Nodes in dependency order (dependencies first)
   * @throws {Error} If circular dependencies detected
   */
  getExecutionOrder() {
    const result = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (node) => {
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected involving: ${node.name}`);
      }
      
      if (visited.has(node)) {
        return;
      }

      visiting.add(node);
      
      // Visit dependencies first
      for (const dep of node.dependencies) {
        visit(dep);
      }
      
      visiting.delete(node);
      visited.add(node);
      result.push(node);
    };

    // Visit all nodes
    for (const node of this.nodes.values()) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return result;
  }

  /**
   * Find nodes with no dependencies (entry points)
   * @returns {SqlNode[]} Independent nodes
   */
  getIndependentNodes() {
    return Array.from(this.nodes.values())
      .filter(node => node.dependencies.size === 0);
  }

  /**
   * Find nodes with no dependents (terminal nodes)
   * @returns {SqlNode[]} Terminal nodes
   */
  getTerminalNodes() {
    return Array.from(this.nodes.values())
      .filter(node => node.dependents.size === 0);
  }

  /**
   * Get all nodes in the graph
   * @returns {SqlNode[]} All nodes
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Check if graph has circular dependencies
   * @returns {boolean} True if circular dependencies exist
   */
  hasCircularDependencies() {
    for (const node of this.nodes.values()) {
      if (node.hasCircularDependency()) {
        return true;
      }
    }
    return false;
  }
}