/**
 * pgTAP Test Scanner for D.A.T.A. CLI
 * 
 * This module provides functionality to scan pgTAP test files and extract test coverage
 * information. It identifies pgTAP assertions, builds coverage maps, and tracks what
 * database objects and functionality are being tested.
 * 
 * @fileoverview pgTAP test file scanner for coverage analysis
 * @author D.A.T.A. Engineering Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { minimatch } from 'minimatch';
import {
  ProgressEvent,
  DirectoryEvent,
  ErrorEvent,
  SuccessEvent,
  WarningEvent
} from '../events/CommandEvents.js';
import MemoryMonitor from './MemoryMonitor.js';
import StreamingCoverageDatabase from './StreamingCoverageDatabase.js';
import BatchProcessor from './BatchProcessor.js';

/**
 * @typedef {Object} TestAssertion
 * @property {string} type - Type of pgTAP assertion (e.g., 'has_table', 'has_column')
 * @property {string} target - Target object being tested (e.g., table name, column name)
 * @property {string[]} parameters - Parameters passed to the assertion
 * @property {number} lineNumber - Line number where assertion was found
 * @property {string} rawSql - Raw SQL text of the assertion
 * @property {string} [schema] - Schema name (for table assertions)
 * @property {string} [tableName] - Table name (for table assertions)
 * @property {string} [description] - Test description (if provided)
 * @property {Object} [functionMetadata] - Function-specific metadata for function assertions
 * @property {string} [functionMetadata.schema] - Function schema
 * @property {string} [functionMetadata.name] - Function name
 * @property {string[]} [functionMetadata.parameters] - Function parameter types
 * @property {string} [functionMetadata.returnType] - Function return type
 * @property {string} [functionMetadata.language] - Function language (sql, plpgsql, etc.)
 * @property {boolean} [functionMetadata.isSecurityDefiner] - Whether function is SECURITY DEFINER
 * @property {string} [functionMetadata.volatility] - Function volatility (volatile, stable, immutable)
 * @property {string[]} [functionMetadata.privileges] - Function privileges being tested
 * @property {string} [functionMetadata.role] - Role for privilege testing
 * @property {Object} [policyMetadata] - RLS policy-specific metadata for policy assertions
 * @property {string} [policyMetadata.schema] - Schema containing the table with policies
 * @property {string} [policyMetadata.tableName] - Table name for RLS policies
 * @property {string} [policyMetadata.policyName] - Name of the specific policy being tested
 * @property {string} [policyMetadata.command] - SQL command for policy (SELECT, INSERT, UPDATE, DELETE, ALL)
 * @property {string[]} [policyMetadata.roles] - Roles that the policy applies to
 * @property {string[]} [policyMetadata.policies] - List of policies (for policies_are assertion)
 * @property {string} [policyMetadata.description] - Description for policies_are assertion
 */

/**
 * @typedef {Object} TestFile
 * @property {string} filePath - Absolute path to the test file
 * @property {string} fileName - Name of the test file
 * @property {TestAssertion[]} assertions - Array of pgTAP assertions found
 * @property {number} planCount - Expected number of tests from SELECT plan() 
 * @property {string[]} dependencies - Any dependencies or includes found
 * @property {Object} metadata - Additional file metadata
 */

/**
 * @typedef {Object} CoverageMap
 * @property {Object.<string, string[]>} tables - Tables and their tested aspects
 * @property {Object.<string, string[]>} columns - Columns and their tests
 * @property {Object.<string, string[]>} functions - Functions and their tests
 * @property {Object.<string, string[]>} schemas - Schemas and their tests
 * @property {Object.<string, string[]>} policies - RLS policies and their tests
 * @property {Object.<string, string[]>} indexes - Indexes and their tests
 * @property {Object.<string, string[]>} triggers - Triggers and their tests
 * @property {Object.<string, TestFile[]>} filesByTarget - Files that test each target
 */

/**
 * pgTAP Test Scanner Class
 * 
 * Scans directories of pgTAP test files (.sql) and extracts test coverage information.
 * Identifies pgTAP assertions, builds coverage maps, and provides insights into what
 * database objects are being tested.
 * 
 * @extends EventEmitter
 */
class pgTAPTestScanner extends EventEmitter {
  /**
   * Create a new pgTAP test scanner
   * 
   * @param {Object} [options={}] - Scanner configuration options
   * @param {boolean} [options.includeCommented=false] - Include commented-out tests
   * @param {string[]} [options.fileExtensions=['.sql']] - File extensions to scan
   * @param {string[]} [options.includePatterns] - Glob patterns for files to include
   * @param {string[]} [options.excludePatterns] - Glob patterns for files to exclude
   * @param {RegExp[]} [options.ignorePatterns=[]] - RegExp patterns for files to ignore (legacy)
   * @param {boolean} [options.validatePlans=true] - Validate SELECT plan() counts
   * @param {boolean} [options.followSymlinks=false] - Follow symbolic links during traversal
   * @param {number} [options.maxDepth=10] - Maximum directory depth to traverse
   */
  constructor(options = {}) {
    super();
    
    /**
     * @type {Object} Scanner configuration
     */
    this.options = {
      includeCommented: false,
      fileExtensions: ['.sql'],
      includePatterns: ['**/*'],
      excludePatterns: ['**/node_modules/**', '**/.git/**', '**/.*'],
      ignorePatterns: [], // Legacy RegExp patterns
      validatePlans: true,
      followSymlinks: false,
      maxDepth: 10,
      // Memory management options
      maxMemoryMB: 500, // Maximum memory usage in MB
      batchSize: 100, // Files to process in each batch
      enableStreaming: true, // Enable streaming mode for large datasets
      cleanupInterval: 1000, // Cleanup interval in ms
      maxObjectsPerType: 10000, // Maximum objects per coverage type
      enableGC: true, // Enable garbage collection hints
      enableCompression: false, // Enable data compression (experimental)
      ...options
    };
    
    /**
     * @type {TestFile[]} Array of scanned test files
     */
    this.testFiles = [];
    
    /**
     * @type {CoverageMap} Coverage analysis results
     */
    this.coverageMap = {
      tables: {},
      columns: {},
      functions: {},
      schemas: {},
      policies: {},
      indexes: {},
      triggers: {},
      filesByTarget: {}
    };
    
    /**
     * @type {Object} Memory management state
     */
    this.memoryState = {
      currentUsageMB: 0,
      maxUsageMB: 0,
      lastCleanup: Date.now(),
      gcCount: 0,
      batchesProcessed: 0,
      objectsProcessed: 0,
      streamingMode: false
    };
    
    /**
     * @type {WeakMap} Weak references for cleanup
     */
    this.weakRefs = new WeakMap();
    
    /**
     * @type {AbortController} For cancelling operations
     */
    this.abortController = new AbortController();
    
    /**
     * @type {StreamingCoverageDatabase} Memory-aware coverage database
     */
    this.streamingDB = null;
    
    /**
     * @type {BatchProcessor} Batch processing utility
     */
    this.batchProcessor = null;
    
    /**
     * @type {Map<string, RegExp>} pgTAP assertion patterns
     */
    this.assertionPatterns = this._initializeAssertionPatterns();
    
    /**
     * @type {RegExp} Pattern for SELECT plan() statements
     */
    this.planPattern = /SELECT\s+plan\s*\(\s*(\d+)\s*\)\s*;?/gi;
    
    /**
     * @type {RegExp} Pattern for SQL comments
     */
    this.commentPattern = /--.*$/gm;
    
    /**
     * @type {number} Total files processed
     */
    this.filesProcessed = 0;
    
    /**
     * @type {number} Total assertions found
     */
    this.totalAssertions = 0;
    
    // Initialize memory monitoring
    this._initializeMemoryMonitoring();
  }
  
  /**
   * Initialize pgTAP assertion patterns
   * 
   * @returns {Map<string, RegExp>} Map of assertion types to regex patterns
   * @private
   */
  _initializeAssertionPatterns() {
    const patterns = new Map();
    
    // Schema testing
    patterns.set('has_schema', /SELECT\s+has_schema\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('hasnt_schema', /SELECT\s+hasnt_schema\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    
    // Table testing - Enhanced patterns to handle more variations
    // Pattern for SELECT has_table(...) with optional schema, table name, and description
    patterns.set('has_table_select', /SELECT\s+has_table\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('hasnt_table_select', /SELECT\s+hasnt_table\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // Pattern for ok(has_table(...), 'description') format
    patterns.set('has_table_ok', /ok\s*\(\s*has_table\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)\s*(?:,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('hasnt_table_ok', /ok\s*\(\s*hasnt_table\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)\s*(?:,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // Table privilege testing
    // table_privs_are('table', 'role', ARRAY['privs']) or table_privs_are('schema', 'table', 'role', ARRAY['privs'])
    patterns.set('table_privs_are', /SELECT\s+table_privs_are\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*ARRAY\s*\[\s*(.*?)\s*\](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // Table ownership testing
    // table_owner_is('table', 'owner') or table_owner_is('schema', 'table', 'owner')
    patterns.set('table_owner_is', /SELECT\s+table_owner_is\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // Table enumeration testing
    // tables_are('schema', ARRAY['table1', 'table2']) or tables_are(ARRAY['table1', 'table2'])
    patterns.set('tables_are', /SELECT\s+tables_are\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?ARRAY\s*\[\s*(.*?)\s*\](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // Column testing
    patterns.set('has_column', /SELECT\s+has_column\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('hasnt_column', /SELECT\s+hasnt_column\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('col_type_is', /SELECT\s+col_type_is\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('col_not_null', /SELECT\s+col_not_null\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('col_is_null', /SELECT\s+col_is_null\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('col_has_default', /SELECT\s+col_has_default\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('col_hasnt_default', /SELECT\s+col_hasnt_default\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('col_default_is', /SELECT\s+col_default_is\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*((?:[^'"`(),]|['"`][^'"`]*['"`]|\([^)]*\))+)\s*\)/gi);
    patterns.set('col_is_pk', /SELECT\s+col_is_pk\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('col_isnt_pk', /SELECT\s+col_isnt_pk\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    
    // Primary key testing
    patterns.set('has_pk', /SELECT\s+has_pk\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('hasnt_pk', /SELECT\s+hasnt_pk\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*\)/gi);
    
    // Foreign key testing
    patterns.set('has_fk', /SELECT\s+has_fk\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    patterns.set('hasnt_fk', /SELECT\s+hasnt_fk\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    
    // Index testing - Enhanced patterns for comprehensive index coverage
    // has_index('table', 'index_name') or has_index('schema', 'table', 'index_name')
    patterns.set('has_index', /SELECT\s+has_index\s*\(\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?(?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    patterns.set('hasnt_index', /SELECT\s+hasnt_index\s*\(\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?(?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    
    // index_is_on('table', 'index', ARRAY['column']) - tests what columns an index covers
    patterns.set('index_is_on', /SELECT\s+index_is_on\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*ARRAY\s*\[\s*(.*?)\s*\]\s*\)/gi);
    
    // index_is_type('table', 'index', 'type') - tests index type (btree, gin, etc.)
    patterns.set('index_is_type', /SELECT\s+index_is_type\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    
    // has_unique('table', 'constraint_name') - tests unique constraints
    patterns.set('has_unique', /SELECT\s+has_unique\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    patterns.set('hasnt_unique', /SELECT\s+hasnt_unique\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    
    // index_is_primary('table', 'index') - tests if index is primary key
    patterns.set('index_is_primary', /SELECT\s+index_is_primary\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    
    // Function testing
    patterns.set('has_function', /SELECT\s+has_function\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*ARRAY\[(.*?)\])?\s*(?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('hasnt_function', /SELECT\s+hasnt_function\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*ARRAY\[(.*?)\])?\s*(?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('function_returns', /SELECT\s+function_returns\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*ARRAY\[(.*?)\])?\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('function_lang_is', /SELECT\s+function_lang_is\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*ARRAY\[(.*?)\])?\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('is_definer', /SELECT\s+is_definer\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*ARRAY\[(.*?)\])?\s*(?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('isnt_definer', /SELECT\s+isnt_definer\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*ARRAY\[(.*?)\])?\s*(?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('volatility_is', /SELECT\s+volatility_is\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*ARRAY\[(.*?)\])?\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('function_privs_are', /SELECT\s+function_privs_are\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*ARRAY\[(.*?)\])?\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*ARRAY\[(.*?)\](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // View testing
    patterns.set('has_view', /SELECT\s+has_view\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('hasnt_view', /SELECT\s+hasnt_view\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*\)/gi);
    
    // Type testing
    patterns.set('has_type', /SELECT\s+has_type\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('hasnt_type', /SELECT\s+hasnt_type\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*\)/gi);
    
    // Result testing
    patterns.set('results_eq', /SELECT\s+results_eq\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    patterns.set('results_ne', /SELECT\s+results_ne\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    
    // RLS (Row Level Security) policy testing
    patterns.set('is_rls_enabled', /SELECT\s+is_rls_enabled\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('policy_exists', /SELECT\s+policy_exists\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('policy_cmd_is', /SELECT\s+policy_cmd_is\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi);
    patterns.set('policy_roles_are', /SELECT\s+policy_roles_are\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*ARRAY\[(.*?)\]\s*\)/gi);
    patterns.set('policies_are', /SELECT\s+policies_are\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*ARRAY\[(.*?)\](?:\s*,\s*['"`]([^'"`]+)['"`])?\s*\)/gi);
    
    // Trigger testing
    // has_trigger('table', 'trigger_name') or has_trigger('schema', 'table', 'trigger_name')
    // Also supports optional description: has_trigger('table', 'trigger', 'description')
    patterns.set('has_trigger', /SELECT\s+has_trigger\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?(?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    patterns.set('hasnt_trigger', /SELECT\s+hasnt_trigger\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]+)['"`])?(?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // trigger_is('table', 'trigger', 'function') or trigger_is('schema', 'table', 'trigger', 'func_schema', 'function')
    patterns.set('trigger_is', /SELECT\s+trigger_is\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // is_trigger_on('table', 'trigger', 'events') - tests trigger events (INSERT, UPDATE, DELETE)
    patterns.set('is_trigger_on', /SELECT\s+is_trigger_on\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // trigger_fires_on('table', 'trigger', 'timing') - tests trigger timing (BEFORE, AFTER, INSTEAD OF)
    patterns.set('trigger_fires_on', /SELECT\s+trigger_fires_on\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // trigger_is_for('table', 'trigger', 'level') - tests trigger level (ROW, STATEMENT)
    patterns.set('trigger_is_for', /SELECT\s+trigger_is_for\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    // triggers_are('table', ARRAY['trigger_names']) - tests all triggers on a table
    patterns.set('triggers_are', /SELECT\s+triggers_are\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*ARRAY\s*\[\s*(.*?)\s*\](?:\s*,\s*['"`]([^'"`]*)['"`])?\s*\)/gi);
    
    return patterns;
  }
  
  /**
   * Scan a directory for pgTAP test files
   * 
   * @param {string} testsDir - Directory to scan for test files
   * @returns {Promise<TestFile[]>} Array of parsed test files
   * @throws {Error} If directory doesn't exist or is not accessible
   */
  async scanDirectory(testsDir) {
    const startTime = Date.now();
    
    try {
      // Emit directory scanning event
      const dirEvent = DirectoryEvent.scan(testsDir);
      this.emit('directory', {
        message: dirEvent.message,
        data: dirEvent.details,
        timestamp: dirEvent.timestamp,
        type: dirEvent.type
      });
      
      // Check if directory exists
      const stat = await fs.stat(testsDir);
      if (!stat.isDirectory()) {
        throw new Error(`Path is not a directory: ${testsDir}`);
      }
      
      // Find all test files
      const testFiles = await this._findTestFiles(testsDir);
      
      if (testFiles.length === 0) {
        this.emit('warning', {
          message: 'No test files found',
          data: { testsDir, extensions: this.options.fileExtensions },
          timestamp: new Date(),
          type: 'warning'
        });
        return [];
      }
      
      // Process each test file
      this.testFiles = [];
      this.filesProcessed = 0;
      this.totalAssertions = 0;
      
      for (let i = 0; i < testFiles.length; i++) {
        const filePath = testFiles[i];
        
        this.emit('progress', {
          message: `Parsing test file: ${path.basename(filePath)}`,
          data: { 
            filePath,
            filesProcessed: i,
            totalFiles: testFiles.length
          },
          timestamp: new Date(),
          type: 'progress',
          percentage: Math.round((i / testFiles.length) * 100)
        });
        
        try {
          const testFile = await this.parseTestFile(filePath);
          this.testFiles.push(testFile);
          this.totalAssertions += testFile.assertions.length;
        } catch (error) {
          const errorEvent = ErrorEvent.fromError(error, `Failed to parse test file: ${filePath}`);
          this.emit('error', {
            message: errorEvent.message,
            error: errorEvent.error,
            data: { filePath, ...errorEvent.details },
            timestamp: errorEvent.timestamp,
            type: errorEvent.type
          });
        }
      }
      
      // Build coverage map
      this._buildCoverageMap();
      
      const duration = Date.now() - startTime;
      const successEvent = new SuccessEvent(
        `Scanned ${this.filesProcessed} test files and found ${this.totalAssertions} assertions`,
        { testsDir, filesProcessed: this.filesProcessed, totalAssertions: this.totalAssertions },
        duration
      );
      
      this.emit('success', {
        message: successEvent.message,
        data: successEvent.details,
        timestamp: successEvent.timestamp,
        type: successEvent.type
      });
      
      return this.testFiles;
      
    } catch (error) {
      const errorEvent = ErrorEvent.fromError(error, `Failed to scan tests directory: ${testsDir}`);
      this.emit('error', {
        message: errorEvent.message,
        error: errorEvent.error,
        data: errorEvent.details,
        timestamp: errorEvent.timestamp,
        type: errorEvent.type
      });
      throw error;
    }
  }
  
  /**
   * Parse an individual test file
   * 
   * @param {string} filePath - Path to the test file to parse
   * @returns {Promise<TestFile>} Parsed test file information
   * @throws {Error} If file cannot be read or parsed
   */
  async parseTestFile(filePath) {
    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf8');
      
      // Extract test plan
      const planCount = this._extractPlan(content);
      
      // Extract assertions
      const assertions = this.extractAssertions(content);
      
      // Extract dependencies (basic implementation)
      const dependencies = this._extractDependencies(content);
      
      // Validate plan count if enabled
      if (this.options.validatePlans && planCount !== null && planCount !== assertions.length) {
        this.emit('warning', {
          message: `Plan count mismatch in ${path.basename(filePath)}`,
          data: { 
            filePath, 
            plannedTests: planCount, 
            foundAssertions: assertions.length 
          },
          timestamp: new Date(),
          type: 'warning'
        });
      }
      
      this.filesProcessed++;
      
      const testFile = {
        filePath,
        fileName: path.basename(filePath),
        assertions,
        planCount,
        dependencies,
        metadata: {
          size: content.length,
          lines: content.split('\n').length,
          parsed: new Date()
        }
      };
      
      return testFile;
      
    } catch (error) {
      throw new Error(`Failed to parse test file ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Extract pgTAP assertions from SQL content
   * 
   * @param {string} sql - SQL content to analyze
   * @returns {TestAssertion[]} Array of extracted assertions
   */
  extractAssertions(sql) {
    const assertions = [];
    
    // Remove comments if not including commented tests
    let processedSql = sql;
    if (!this.options.includeCommented) {
      processedSql = sql.replace(this.commentPattern, '');
    }
    
    // Split into lines for line number tracking
    const lines = processedSql.split('\n');
    
    // Search for each assertion pattern
    for (const [assertionType, pattern] of this.assertionPatterns) {
      let match;
      
      // Reset regex state
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(processedSql)) !== null) {
        // Find line number
        const beforeMatch = processedSql.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        
        // Extract parameters (filter out undefined captures)
        const parameters = match.slice(1).filter(param => param !== undefined);
        
        // Clean parameters for specific assertion types
        this._cleanParameters(assertionType, parameters);
        
        // Determine target based on assertion type
        const target = this._determineTarget(assertionType, parameters);
        
        const assertion = {
          type: assertionType,
          target,
          parameters,
          lineNumber,
          rawSql: match[0].trim()
        };
        
        // Add function metadata for function-related assertions
        if (assertionType.includes('function') || assertionType.includes('definer') || assertionType === 'volatility_is') {
          assertion.functionMetadata = this._extractFunctionMetadata(assertionType, parameters);
        }
        
        // Add table metadata for table-related assertions
        if (assertionType.includes('table')) {
          const metadata = this._extractAssertionMetadata(assertionType, parameters);
          Object.assign(assertion, metadata);
        }
        
        // Add RLS policy metadata for policy-related assertions
        if (assertionType.includes('policy') || assertionType.includes('policies') || assertionType === 'is_rls_enabled') {
          assertion.policyMetadata = this._extractPolicyMetadata(assertionType, parameters);
        }
        
        assertions.push(assertion);
      }
    }
    
    return assertions.sort((a, b) => a.lineNumber - b.lineNumber);
  }
  
  /**
   * Get the current coverage map
   * 
   * @returns {CoverageMap} Coverage analysis results
   */
  getCoverageMap() {
    return { ...this.coverageMap };
  }
  
  /**
   * Get statistics about the scanned tests
   * 
   * @returns {Object} Test statistics
   */
  getStatistics() {
    return {
      filesScanned: this.filesProcessed,
      totalAssertions: this.totalAssertions,
      assertionTypes: this._getAssertionTypeStats(),
      coverageStats: this._getCoverageStats()
    };
  }
  
  /**
   * Reset scanner state
   */
  reset() {
    this.testFiles = [];
    this.coverageMap = {
      tables: {},
      columns: {},
      functions: {},
      schemas: {},
      policies: {},
      indexes: {},
      triggers: {},
      filesByTarget: {}
    };
    this.filesProcessed = 0;
    this.totalAssertions = 0;
  }
  
  // Private methods
  
  /**
   * Find all test files in directory recursively
   * 
   * @param {string} dir - Directory to search
   * @param {number} [depth=0] - Current recursion depth
   * @returns {Promise<string[]>} Array of test file paths
   * @private
   */
  async _findTestFiles(dir, depth = 0) {
    const files = [];
    const startTime = Date.now();
    
    // Check depth limit
    if (depth > this.options.maxDepth) {
      this.emit('warning', {
        message: `Maximum depth ${this.options.maxDepth} reached, skipping: ${dir}`,
        data: { dir, depth, maxDepth: this.options.maxDepth },
        timestamp: new Date(),
        type: 'warning'
      });
      return files;
    }
    
    try {
      // Emit progress for directory scanning
      this.emit('progress', {
        message: `Scanning directory: ${path.relative(process.cwd(), dir)}`,
        data: { dir, depth },
        timestamp: new Date(),
        type: 'progress'
      });
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      // Process entries in sorted order for consistency
      const sortedEntries = entries.sort((a, b) => {
        // Directories first, then files, alphabetically within each group
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });
      
      for (const entry of sortedEntries) {
        const fullPath = path.join(dir, entry.name);
        // Use relative path from the original tests directory being scanned
        const testsRootDir = arguments.length > 1 ? arguments[2] : dir; // Pass root as 3rd param in recursion
        const relativePath = path.relative(testsRootDir, fullPath);
        
        try {
          // Skip hidden files and directories unless explicitly included
          if (entry.name.startsWith('.') && !this._shouldIncludeHidden(relativePath)) {
            continue;
          }
          
          // Check exclude patterns first (more efficient)
          if (this._isExcluded(relativePath)) {
            continue;
          }
          
          if (entry.isDirectory()) {
            // Recursively search subdirectories, passing the root directory
            const subFiles = await this._findTestFiles(fullPath, depth + 1, testsRootDir);
            files.push(...subFiles);
            
          } else if (entry.isFile()) {
            // Check if file should be included
            if (await this._shouldIncludeFile(fullPath, relativePath)) {
              files.push(fullPath);
            }
            
          } else if (entry.isSymbolicLink() && this.options.followSymlinks) {
            // Handle symbolic links if enabled
            await this._handleSymlink(fullPath, relativePath, files, depth, testsRootDir);
          }
          
        } catch (error) {
          // Handle permission errors gracefully
          if (error.code === 'EACCES' || error.code === 'EPERM') {
            this.emit('warning', {
              message: `Permission denied accessing: ${relativePath}`,
              data: { path: fullPath, error: error.code },
              timestamp: new Date(),
              type: 'warning'
            });
          } else {
            // Re-throw unexpected errors
            throw error;
          }
        }
      }
      
      // Emit progress for completed directory
      const duration = Date.now() - startTime;
      this.emit('progress', {
        message: `Completed scanning: ${path.relative(process.cwd(), dir)} (${files.length} files, ${duration}ms)`,
        data: { dir, filesFound: files.length, duration, depth },
        timestamp: new Date(),
        type: 'progress'
      });
      
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        this.emit('warning', {
          message: `Permission denied reading directory: ${dir}`,
          data: { dir, error: error.code },
          timestamp: new Date(),
          type: 'warning'
        });
      } else {
        throw new Error(`Failed to read directory ${dir}: ${error.message}`);
      }
    }
    
    return files.sort(); // Ensure consistent ordering
  }
  
  /**
   * Check if a file should be included based on patterns and extensions
   * 
   * @param {string} fullPath - Full file path
   * @param {string} relativePath - Relative file path
   * @returns {Promise<boolean>} True if file should be included
   * @private
   */
  async _shouldIncludeFile(fullPath, relativePath) {
    // Check file extension
    const ext = path.extname(fullPath);
    if (!this.options.fileExtensions.includes(ext)) {
      return false;
    }
    
    // Check include patterns using minimatch for consistency
    const matchesInclude = this.options.includePatterns.some(pattern => 
      minimatch(relativePath, pattern, { dot: true })
    );
    
    if (!matchesInclude) {
      return false;
    }
    
    // Check legacy RegExp patterns
    if (this.options.ignorePatterns.some(pattern => pattern.test(fullPath))) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if a path should be excluded based on exclude patterns
   * 
   * @param {string} relativePath - Relative path to check
   * @returns {boolean} True if path should be excluded
   * @private
   */
  _isExcluded(relativePath) {
    return this.options.excludePatterns.some(pattern => 
      minimatch(relativePath, pattern, { dot: true })
    );
  }
  
  /**
   * Check if hidden files should be included for this specific path
   * 
   * @param {string} relativePath - Relative path to check
   * @returns {boolean} True if hidden file should be included
   * @private
   */
  _shouldIncludeHidden(relativePath) {
    // Check if any include pattern explicitly matches this hidden path
    return this.options.includePatterns.some(pattern => {
      // Only include hidden files if they're explicitly matched by an include pattern
      return pattern.includes('.') && this._matchesPattern(relativePath, pattern);
    });
  }
  
  /**
   * Handle symbolic links during file discovery
   * 
   * @param {string} fullPath - Full path to the symlink
   * @param {string} relativePath - Relative path to the symlink
   * @param {string[]} files - Array to collect file paths
   * @param {number} depth - Current recursion depth
   * @param {string} testsRootDir - Root directory for tests (for calculating relative paths)
   * @returns {Promise<void>}
   * @private
   */
  async _handleSymlink(fullPath, relativePath, files, depth, testsRootDir) {
    try {
      const realPath = await fs.realpath(fullPath);
      const stat = await fs.stat(realPath);
      
      // Prevent infinite loops by checking if we've seen this real path before
      // This is a simple check - a more robust solution would track visited inodes
      const realpathRelative = path.relative(testsRootDir, realPath);
      
      if (stat.isDirectory()) {
        // Recursively process symlinked directory
        this.emit('progress', {
          message: `Following symlink to directory: ${realpathRelative}`,
          data: { symlinkPath: relativePath, targetPath: realpathRelative },
          timestamp: new Date(),
          type: 'progress'
        });
        
        const subFiles = await this._findTestFiles(realPath, depth + 1, testsRootDir);
        files.push(...subFiles);
        
      } else if (stat.isFile()) {
        // Process symlinked file
        if (await this._shouldIncludeFile(realPath, realpathRelative)) {
          files.push(realPath); // Use the real path, not the symlink path
        }
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.emit('warning', {
          message: `Broken symlink: ${relativePath}`,
          data: { symlinkPath: fullPath },
          timestamp: new Date(),
          type: 'warning'
        });
      } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        this.emit('warning', {
          message: `Permission denied following symlink: ${relativePath}`,
          data: { symlinkPath: fullPath, error: error.code },
          timestamp: new Date(),
          type: 'warning'
        });
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Simple glob pattern matching without external dependencies
   * Supports basic patterns like *, **, and literal strings
   * 
   * @param {string} filePath - File path to test
   * @param {string} pattern - Glob pattern
   * @returns {boolean} True if path matches pattern
   * @private
   */
  _matchesPattern(filePath, pattern) {
    // Normalize paths to use forward slashes
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');
    
    // Handle exact matches
    if (normalizedPattern === normalizedPath) {
      return true;
    }
    
    // Handle universal wildcard patterns
    if (normalizedPattern === '**/*' || normalizedPattern === '**') {
      return true;
    }
    
    // Convert glob pattern to regex with special handling for leading **
    let regexPattern = normalizedPattern;
    
    // Handle leading ** patterns specially
    if (regexPattern.startsWith('**/')) {
      regexPattern = regexPattern.substring(3); // Remove leading **/
      // Add optional prefix matcher - either nothing or any path with /
      regexPattern = '(?:.*/)?' + regexPattern;
    }
    
    // Handle glob patterns BEFORE escaping special regex chars
    regexPattern = regexPattern
      .replace(/\*\*/g, '__DOUBLESTAR__')    // Temporarily mark **
      .replace(/\*/g, '__SINGLESTAR__')      // Temporarily mark *
      .replace(/\?/g, '__QUESTION__');       // Temporarily mark ?
    
    // Now escape special regex characters
    regexPattern = regexPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
    // Convert back to regex patterns
    regexPattern = regexPattern
      .replace(/__LEADINGMATCH__/g, '')      // Remove the leading match marker
      .replace(/__DOUBLESTAR__/g, '.*')      // ** matches any chars including /
      .replace(/__SINGLESTAR__/g, '[^/]*')   // * matches any chars except /
      .replace(/__QUESTION__/g, '[^/]');     // ? matches single char except /
    
    try {
      const regex = new RegExp('^' + regexPattern + '$');
      const result = regex.test(normalizedPath);
      
      // Debug logging (enable when needed)
      if (process.env.DEBUG_PATTERNS) {
        console.log(`Pattern: '${normalizedPattern}' => Regex: '^${regexPattern}$', Path: '${normalizedPath}', Result: ${result}`);
      }
      
      return result;
    } catch (error) {
      // If regex is invalid, fall back to simple string matching
      console.warn(`Invalid regex pattern generated from ${normalizedPattern}: ${error.message}`);
      return normalizedPattern === normalizedPath;
    }
  }

  /**
   * Extract test plan count from SQL
   * 
   * @param {string} sql - SQL content
   * @returns {number|null} Plan count or null if not found
   * @private
   */
  _extractPlan(sql) {
    const match = this.planPattern.exec(sql);
    return match ? parseInt(match[1], 10) : null;
  }
  
  /**
   * Extract dependencies from SQL content
   * 
   * @param {string} sql - SQL content
   * @returns {string[]} Array of dependencies found
   * @private
   */
  _extractDependencies(sql) {
    const dependencies = [];
    
    // Look for common dependency patterns
    const includePattern = /\\i\s+['"`]([^'"`]+)['"`]/gi;
    let match;
    
    while ((match = includePattern.exec(sql)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }
  
  /**
   * Determine target object from assertion parameters
   * 
   * @param {string} assertionType - Type of assertion
   * @param {string[]} parameters - Assertion parameters
   * @returns {string} Target object identifier
   * @private
   */
  _determineTarget(assertionType, parameters) {
    // Default logic - can be extended for specific assertion types
    if (parameters.length === 0) return '';
    
    // For schema assertions, first parameter is schema name
    if (assertionType.includes('schema')) {
      return parameters[0];
    }
    
    // For table assertions - Enhanced logic for new patterns
    if (assertionType.includes('table')) {
      if (assertionType.includes('_select')) {
        // SELECT has_table(...) patterns
        // Parameters can be: [table] or [schema, table] or [table, description] or [schema, table, description]
        if (parameters.length === 1) {
          // Single parameter: just table name
          return `public.${parameters[0]}`;
        } else if (parameters.length === 2) {
          // Two parameters: could be [schema, table] or [table, description]
          // Heuristic: if second param looks like a description (long text or empty), treat first as table
          if (parameters[1].length === 0 || parameters[1].length > 30 || parameters[1].includes(' ')) {
            // Likely [table, description] (including empty description)
            return `public.${parameters[0]}`;
          } else {
            // Likely [schema, table]
            return `${parameters[0]}.${parameters[1]}`;
          }
        } else if (parameters.length === 3) {
          // Three parameters: [schema, table, description]
          return `${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType.includes('_ok')) {
        // ok(has_table(...), 'description') patterns
        // Parameters captured: [table] or [schema, table] plus optional outer description
        if (parameters.length === 1) {
          // Single parameter: just table name
          return `public.${parameters[0]}`;
        } else if (parameters.length === 2) {
          // Two parameters: could be [table, outer_desc] or [schema, table]
          // Check if second param looks like description
          if (parameters[1].length === 0 || parameters[1].length > 30 || parameters[1].includes(' ')) {
            // Likely [table, outer_description] (including empty description)
            return `public.${parameters[0]}`;
          } else {
            // Likely [schema, table]
            return `${parameters[0]}.${parameters[1]}`;
          }
        } else if (parameters.length >= 3) {
          // Three or more parameters: [schema, table, ...] or [table, inner_desc, outer_desc]
          // Check if first two look like schema.table pattern
          if (parameters[0].length < 20 && parameters[1].length < 20 && !parameters[0].includes(' ') && !parameters[1].includes(' ')) {
            // Likely [schema, table, ...]
            return `${parameters[0]}.${parameters[1]}`;
          } else {
            // Likely [table, descriptions...]
            return `public.${parameters[0]}`;
          }
        }
      } else if (assertionType === 'table_privs_are') {
        // table_privs_are('table', 'role', ARRAY['privs']) or table_privs_are('schema', 'table', 'role', ARRAY['privs'])
        if (parameters.length >= 4) {
          // Schema, table, role, privileges pattern
          return `${parameters[0]}.${parameters[1]}`;
        } else if (parameters.length >= 3) {
          // Table, role, privileges pattern (assume public schema)
          return `public.${parameters[0]}`;
        }
      } else if (assertionType === 'table_owner_is') {
        // table_owner_is('table', 'owner') or table_owner_is('schema', 'table', 'owner')
        if (parameters.length >= 3) {
          // Schema, table, owner pattern
          return `${parameters[0]}.${parameters[1]}`;
        } else if (parameters.length >= 2) {
          // Table, owner pattern (assume public schema)
          return `public.${parameters[0]}`;
        }
      } else if (assertionType === 'tables_are') {
        // tables_are('schema', ARRAY['table1', 'table2']) or tables_are(ARRAY['table1', 'table2'])
        if (parameters.length >= 2) {
          // Schema and table list pattern - return schema as the target
          return parameters[0];
        } else if (parameters.length === 1) {
          // Just table list pattern - assume public schema
          return 'public';
        }
      } else {
        // Legacy table patterns
        return parameters.length > 1 ? `${parameters[0]}.${parameters[1]}` : `public.${parameters[0]}`;
      }
    }
    
    // For column assertions, handle different patterns
    if (assertionType.includes('column') || assertionType.startsWith('col_')) {
      // col_type_is, col_default_is have schema, table, column, type/value
      if (assertionType === 'col_type_is' || assertionType === 'col_default_is') {
        if (parameters.length >= 4) {
          // schema.table.column pattern
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length >= 3) {
          // table.column pattern (no schema)
          return `${parameters[0]}.${parameters[1]}`;
        }
      }
      // Other column assertions: has_column, col_not_null, etc.
      else {
        if (parameters.length >= 3) {
          // schema.table.column pattern
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length >= 2) {
          // table.column pattern (no schema)
          return `${parameters[0]}.${parameters[1]}`;
        }
      }
    }
    
    // For function assertions - handle specific function testing patterns
    if (assertionType.includes('function') || assertionType.includes('definer') || assertionType === 'volatility_is') {
      // Extract function name and schema for different assertion patterns
      
      // Handle has_function, hasnt_function patterns:
      // has_function('function_name')
      // has_function('schema', 'function_name') 
      // has_function('function_name', ARRAY['type1', 'type2'])
      // has_function('schema', 'function_name', ARRAY['type1', 'type2'])
      if (assertionType === 'has_function' || assertionType === 'hasnt_function') {
        if (parameters.length >= 2 && !parameters[1].includes("'")) {
          // Schema and function name provided
          return `${parameters[0]}.${parameters[1]}`;
        } else {
          // Only function name provided
          return parameters[0];
        }
      }
      
      // Handle function_returns patterns:
      // function_returns('function_name', 'return_type')
      // function_returns('schema', 'function_name', 'return_type')
      // function_returns('function_name', ARRAY['type1', 'type2'], 'return_type')
      // function_returns('schema', 'function_name', ARRAY['type1', 'type2'], 'return_type')
      else if (assertionType === 'function_returns') {
        // Check for patterns based on parameter structure
        if (parameters.length >= 4) {
          // Four parameters: schema, function, args, return_type
          return `${parameters[0]}.${parameters[1]}`;
        } else if (parameters.length === 3) {
          // Three parameters could be:
          // 1. function, args, return_type (parameters[1] contains quotes from ARRAY)
          // 2. schema, function, return_type (parameters[2] is return type)
          if (parameters[1] && parameters[1].includes("'")) {
            // function, args, return_type pattern
            return parameters[0];
          } else {
            // schema, function, return_type pattern  
            return `${parameters[0]}.${parameters[1]}`;
          }
        } else if (parameters.length === 2) {
          // function, return_type pattern
          return parameters[0];
        }
      }
      
      // Handle function_lang_is patterns:
      // function_lang_is('function_name', 'language')
      // function_lang_is('schema', 'function_name', 'language')
      // function_lang_is('function_name', ARRAY['type1'], 'language')
      else if (assertionType === 'function_lang_is') {
        if (parameters.length >= 3 && !parameters[2].includes("'")) {
          // Schema, function, language pattern
          return `${parameters[0]}.${parameters[1]}`;
        } else {
          // Function, language pattern
          return parameters[0];
        }
      }
      
      // Handle is_definer, isnt_definer patterns:
      // is_definer('function_name')
      // is_definer('schema', 'function_name')
      // is_definer('function_name', ARRAY['type1', 'type2'])
      else if (assertionType === 'is_definer' || assertionType === 'isnt_definer') {
        if (parameters.length >= 2 && !parameters[1].includes("'")) {
          // Schema and function name provided
          return `${parameters[0]}.${parameters[1]}`;
        } else {
          // Only function name provided
          return parameters[0];
        }
      }
      
      // Handle volatility_is patterns:
      // volatility_is('function_name', 'volatility')
      // volatility_is('schema', 'function_name', 'volatility')
      // volatility_is('function_name', ARRAY['type1'], 'volatility')
      else if (assertionType === 'volatility_is') {
        if (parameters.length >= 3 && !parameters[2].includes("'")) {
          // Schema, function, volatility pattern
          return `${parameters[0]}.${parameters[1]}`;
        } else {
          // Function, volatility pattern
          return parameters[0];
        }
      }
      
      // Handle function_privs_are patterns:
      // function_privs_are('schema', 'function', ARRAY['type1'], 'role', ARRAY['privs'])
      // function_privs_are('function', ARRAY['type1'], 'role', ARRAY['privs'])
      else if (assertionType === 'function_privs_are') {
        if (parameters.length >= 4 && !parameters[3].includes("'")) {
          // Schema, function, args, role, privs pattern
          return `${parameters[0]}.${parameters[1]}`;
        } else {
          // Function, args, role, privs pattern
          return parameters[0];
        }
      }
      
      // Fallback for any other function assertions
      else {
        return parameters.length > 1 ? `${parameters[0]}.${parameters[1]}` : parameters[0];
      }
    }
    
    // For index-related assertions
    if (assertionType.includes('index') || assertionType.includes('unique')) {
      // Handle different index assertion patterns
      if (assertionType === 'has_index' || assertionType === 'hasnt_index') {
        // has_index('table', 'index') or has_index('schema', 'table', 'index')
        if (parameters.length === 3) {
          // Schema, table, index
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length === 2) {
          // Table, index
          return `${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType === 'index_is_on') {
        // index_is_on('table', 'index', ARRAY['columns']) or index_is_on('schema', 'table', 'index', ARRAY['columns'])
        if (parameters.length >= 4) {
          // Schema, table, index, columns
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length >= 3) {
          // Table, index, columns
          return `${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType === 'index_is_type') {
        // index_is_type('table', 'index', 'type') or index_is_type('schema', 'table', 'index', 'type')
        if (parameters.length === 4) {
          // Schema, table, index, type
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length === 3) {
          // Table, index, type
          return `${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType === 'has_unique' || assertionType === 'hasnt_unique') {
        // has_unique('table', 'constraint') or has_unique('schema', 'table', 'constraint')
        if (parameters.length === 3) {
          // Schema, table, constraint
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length === 2) {
          // Table, constraint
          return `${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType === 'index_is_primary') {
        // index_is_primary('table', 'index') or index_is_primary('schema', 'table', 'index')
        if (parameters.length === 3) {
          // Schema, table, index
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length === 2) {
          // Table, index
          return `${parameters[0]}.${parameters[1]}`;
        }
      }
    }
    
    // For RLS policy assertions
    if (assertionType.includes('policy') || assertionType.includes('policies') || assertionType === 'is_rls_enabled') {
      if (assertionType === 'is_rls_enabled') {
        // is_rls_enabled('table') or is_rls_enabled('schema', 'table')
        return parameters.length > 1 ? `${parameters[0]}.${parameters[1]}` : parameters[0];
      } else if (assertionType === 'policy_exists') {
        // policy_exists('table', 'policy_name') or policy_exists('schema', 'table', 'policy_name')
        if (parameters.length >= 3) {
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length === 2) {
          return `${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType === 'policy_cmd_is') {
        // policy_cmd_is('table', 'policy', 'SELECT') or policy_cmd_is('schema', 'table', 'policy', 'SELECT')
        if (parameters.length >= 4) {
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length >= 3) {
          return `${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType === 'policy_roles_are') {
        // policy_roles_are('table', 'policy', ARRAY['role']) or policy_roles_are('schema', 'table', 'policy', ARRAY['role'])
        if (parameters.length >= 4) {
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length >= 3) {
          return `${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType === 'policies_are') {
        // policies_are('table', ARRAY['policy1', 'policy2']) or policies_are('schema', 'table', ARRAY['policy1', 'policy2'])
        // The ARRAY[...] parameter is captured as a single parameter, so:
        // ['users', "'policy1', 'policy2'"] has length 2 -> target should be 'users'
        // ['public', 'users', "'policy1', 'policy2'"] has length 3 -> target should be 'public.users'  
        // ['public', 'users', "'policy1', 'policy2'", 'description'] has length 4 -> target should be 'public.users'
        if (parameters.length >= 4) {
          return `${parameters[0]}.${parameters[1]}`;
        } else if (parameters.length === 3) {
          return `${parameters[0]}.${parameters[1]}`;
        } else if (parameters.length === 2) {
          return parameters[0];
        }
      }
    }
    
    // For trigger assertions
    if (assertionType.includes('trigger')) {
      if (assertionType === 'has_trigger' || assertionType === 'hasnt_trigger') {
        // has_trigger('table', 'trigger_name') or has_trigger('schema', 'table', 'trigger_name')
        // Also: has_trigger('table', 'trigger', 'description') or has_trigger('schema', 'table', 'trigger', 'description')
        if (parameters.length === 2) {
          // Table, trigger_name (default to public schema)
          return `public.${parameters[0]}.${parameters[1]}`;
        } else if (parameters.length === 3) {
          // Could be: schema, table, trigger OR table, trigger, description
          // Heuristic: if 3rd param looks like a description (contains spaces, is very long, or contains descriptive words), treat as table, trigger, description
          if (parameters[2].length > 50 || parameters[2].includes(' ') || 
              (parameters[2].toLowerCase().includes('trigger') && parameters[2].length > 20)) {
            // Table, trigger, description
            return `public.${parameters[0]}.${parameters[1]}`;
          } else {
            // Schema, table, trigger
            return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
          }
        } else if (parameters.length >= 4) {
          // Schema, table, trigger, description
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        }
      } else if (assertionType === 'trigger_is') {
        // trigger_is('table', 'trigger', 'function') or trigger_is('schema', 'table', 'trigger', 'func_schema', 'function')
        if (parameters.length >= 5) {
          // Schema, table, trigger, func_schema, function
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length >= 3) {
          // Table, trigger, function (or schema, table, trigger)
          if (parameters.length === 3) {
            // Assume table, trigger, function
            return `public.${parameters[0]}.${parameters[1]}`;
          } else {
            // Schema, table, trigger, function
            return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
          }
        }
      } else if (assertionType === 'is_trigger_on' || assertionType === 'trigger_fires_on' || assertionType === 'trigger_is_for') {
        // is_trigger_on('table', 'trigger', 'events') or is_trigger_on('schema', 'table', 'trigger', 'events')
        // trigger_fires_on('table', 'trigger', 'timing') or trigger_fires_on('schema', 'table', 'trigger', 'timing')
        // trigger_is_for('table', 'trigger', 'level') or trigger_is_for('schema', 'table', 'trigger', 'level')
        if (parameters.length >= 4) {
          // Schema, table, trigger, property
          return `${parameters[0]}.${parameters[1]}.${parameters[2]}`;
        } else if (parameters.length >= 3) {
          // Table, trigger, property
          return `public.${parameters[0]}.${parameters[1]}`;
        }
      } else if (assertionType === 'triggers_are') {
        // triggers_are('table', ARRAY['trigger_names']) or triggers_are('schema', 'table', ARRAY['trigger_names'])
        if (parameters.length >= 3) {
          // Schema, table, trigger_array
          return `${parameters[0]}.${parameters[1]}`;
        } else if (parameters.length === 2) {
          // Table, trigger_array
          return `public.${parameters[0]}`;
        }
      }
    }
    
    // Default: join non-empty parameters
    return parameters.filter(p => p).join('.');
  }
  
  /**
   * Clean parameters for specific assertion types
   * 
   * @param {string} assertionType - Type of assertion
   * @param {string[]} parameters - Parameters array to clean in-place
   * @private
   */
  _cleanParameters(assertionType, parameters) {
    // Clean quotes from default values in col_default_is
    if (assertionType === 'col_default_is' && parameters.length > 0) {
      const lastIndex = parameters.length - 1;
      let value = parameters[lastIndex];
      
      // Remove surrounding quotes if present, but preserve inner content
      if (value && typeof value === 'string') {
        value = value.trim();
        
        // Handle single quotes
        if (value.startsWith("'") && value.endsWith("'") && value.length > 1) {
          parameters[lastIndex] = value.slice(1, -1);
        }
        // Handle double quotes
        else if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
          parameters[lastIndex] = value.slice(1, -1);
        }
        // Handle backticks
        else if (value.startsWith("`") && value.endsWith("`") && value.length > 1) {
          parameters[lastIndex] = value.slice(1, -1);
        }
      }
    }
  }

  /**
   * Extract additional metadata from assertion parameters
   * 
   * @param {string} assertionType - Type of assertion
   * @param {string[]} parameters - Assertion parameters
   * @returns {Object} Additional metadata for the assertion
   * @private
   */
  _extractAssertionMetadata(assertionType, parameters) {
    const metadata = {};
    
    // Extract metadata for table assertions
    if (assertionType.includes('table')) {
      if (assertionType.includes('_select')) {
        // SELECT has_table(...) patterns
        if (parameters.length === 1) {
          // [table]
          metadata.schema = 'public';
          metadata.tableName = parameters[0];
        } else if (parameters.length === 2) {
          // [schema, table] or [table, description]
          if (parameters[1].length === 0 || parameters[1].length > 30 || parameters[1].includes(' ')) {
            // [table, description] (including empty description)
            metadata.schema = 'public';
            metadata.tableName = parameters[0];
            if (parameters[1].length > 0) {
              metadata.description = parameters[1];
            }
          } else {
            // [schema, table]
            metadata.schema = parameters[0];
            metadata.tableName = parameters[1];
          }
        } else if (parameters.length === 3) {
          // [schema, table, description]
          metadata.schema = parameters[0];
          metadata.tableName = parameters[1];
          metadata.description = parameters[2];
        }
      } else if (assertionType.includes('_ok')) {
        // ok(has_table(...), 'outer_description') patterns
        if (parameters.length === 1) {
          // [table]
          metadata.schema = 'public';
          metadata.tableName = parameters[0];
        } else if (parameters.length === 2) {
          // [table, outer_desc] or [schema, table]
          if (parameters[1].length === 0 || parameters[1].length > 30 || parameters[1].includes(' ')) {
            // [table, outer_description] (including empty description)
            metadata.schema = 'public';
            metadata.tableName = parameters[0];
            if (parameters[1].length > 0) {
              metadata.description = parameters[1];
            }
          } else {
            // [schema, table]
            metadata.schema = parameters[0];
            metadata.tableName = parameters[1];
          }
        } else if (parameters.length >= 3) {
          // [schema, table, outer_desc] or [table, inner_desc, outer_desc]
          if (parameters[0].length < 20 && parameters[1].length < 20 && !parameters[0].includes(' ') && !parameters[1].includes(' ')) {
            // [schema, table, outer_desc]
            metadata.schema = parameters[0];
            metadata.tableName = parameters[1];
            metadata.description = parameters[parameters.length - 1]; // Last param is outer description
          } else {
            // [table, inner_desc, outer_desc]
            metadata.schema = 'public';
            metadata.tableName = parameters[0];
            metadata.description = parameters[parameters.length - 1]; // Last param is outer description
          }
        }
      } else if (assertionType === 'table_privs_are') {
        // table_privs_are('table', 'role', ARRAY['privs']) or table_privs_are('schema', 'table', 'role', ARRAY['privs'])
        if (parameters.length >= 4) {
          // Schema, table, role, privileges pattern
          metadata.schema = parameters[0];
          metadata.tableName = parameters[1];
          metadata.role = parameters[2];
          // Parse ARRAY['privilege1', 'privilege2'] from parameters[3]
          const privilegeStr = parameters[3];
          metadata.privileges = this._parseArrayParameter(privilegeStr);
          if (parameters.length >= 5) {
            metadata.description = parameters[4];
          }
        } else if (parameters.length >= 3) {
          // Table, role, privileges pattern (assume public schema)
          metadata.schema = 'public';
          metadata.tableName = parameters[0];
          metadata.role = parameters[1];
          metadata.privileges = this._parseArrayParameter(parameters[2]);
          if (parameters.length >= 4) {
            metadata.description = parameters[3];
          }
        }
      } else if (assertionType === 'table_owner_is') {
        // table_owner_is('table', 'owner') or table_owner_is('schema', 'table', 'owner')
        if (parameters.length >= 3) {
          // Schema, table, owner pattern
          metadata.schema = parameters[0];
          metadata.tableName = parameters[1];
          metadata.owner = parameters[2];
          if (parameters.length >= 4) {
            metadata.description = parameters[3];
          }
        } else if (parameters.length >= 2) {
          // Table, owner pattern (assume public schema)
          metadata.schema = 'public';
          metadata.tableName = parameters[0];
          metadata.owner = parameters[1];
          if (parameters.length >= 3) {
            metadata.description = parameters[2];
          }
        }
      } else if (assertionType === 'tables_are') {
        // tables_are('schema', ARRAY['table1', 'table2']) or tables_are(ARRAY['table1', 'table2'])
        if (parameters.length >= 2) {
          // Schema and table list pattern
          metadata.schema = parameters[0];
          metadata.tableList = this._parseArrayParameter(parameters[1]);
          if (parameters.length >= 3) {
            metadata.description = parameters[2];
          }
        } else if (parameters.length === 1) {
          // Just table list pattern - assume public schema
          metadata.schema = 'public';
          metadata.tableList = this._parseArrayParameter(parameters[0]);
        }
      }
    }
    
    return metadata;
  }
  
  /**
   * Build coverage map from parsed test files
   * 
   * @private
   */
  _buildCoverageMap() {
    // Reset coverage map
    this.coverageMap = {
      tables: {},
      columns: {},
      functions: {},
      schemas: {},
      policies: {},
      indexes: {},
      triggers: {},
      filesByTarget: {}
    };
    
    for (const testFile of this.testFiles) {
      for (const assertion of testFile.assertions) {
        const { type, target } = assertion;
        
        // Categorize by assertion type
        if (type.includes('schema')) {
          this._addToCoverageMap('schemas', target, type, testFile);
        } else if (type.includes('table')) {
          this._addToCoverageMap('tables', target, type, testFile, assertion);
        } else if (type.includes('column') || type.startsWith('col_')) {
          this._addToCoverageMap('columns', target, type, testFile);
        } else if (type.includes('function') || type.includes('definer') || type === 'volatility_is') {
          this._addToCoverageMap('functions', target, type, testFile);
        } else if (type.includes('policy') || type.includes('policies') || type === 'is_rls_enabled') {
          this._addToCoverageMap('policies', target, type, testFile);
        } else if (type.includes('index') || type.includes('unique')) {
          this._addToCoverageMap('indexes', target, type, testFile);
        } else if (type.includes('trigger')) {
          this._addToCoverageMap('triggers', target, type, testFile);
        }
        
        // Track files by target
        if (!this.coverageMap.filesByTarget[target]) {
          this.coverageMap.filesByTarget[target] = [];
        }
        
        if (!this.coverageMap.filesByTarget[target].includes(testFile)) {
          this.coverageMap.filesByTarget[target].push(testFile);
        }
      }
    }
  }
  
  /**
   * Add entry to coverage map
   * 
   * @param {string} category - Coverage category
   * @param {string} target - Target object
   * @param {string} assertionType - Type of assertion
   * @param {TestFile} testFile - Test file containing the assertion
   * @param {Object} [assertion] - Optional full assertion object for enhanced table tracking
   * @private
   */
  _addToCoverageMap(category, target, assertionType, testFile, assertion = null) {
    if (!this.coverageMap[category][target]) {
      if (category === 'tables' && assertion) {
        // Enhanced table coverage tracking
        this.coverageMap[category][target] = {
          assertionTypes: [],
          schema: assertion.schema || 'public',
          tableName: assertion.tableName || target.split('.').pop(),
          descriptions: [],
          testFiles: []
        };
      } else {
        // Standard coverage tracking for other categories
        this.coverageMap[category][target] = [];
      }
    }
    
    if (category === 'tables' && assertion) {
      // Enhanced table coverage handling
      const tableInfo = this.coverageMap[category][target];
      if (!tableInfo.assertionTypes.includes(assertionType)) {
        tableInfo.assertionTypes.push(assertionType);
      }
      if (assertion.description && !tableInfo.descriptions.includes(assertion.description)) {
        tableInfo.descriptions.push(assertion.description);
      }
      if (!tableInfo.testFiles.includes(testFile.fileName)) {
        tableInfo.testFiles.push(testFile.fileName);
      }
    } else {
      // Standard handling for other categories
      const entries = this.coverageMap[category][target];
      if (Array.isArray(entries) && !entries.includes(assertionType)) {
        entries.push(assertionType);
      }
    }
  }
  
  /**
   * Get assertion type statistics
   * 
   * @returns {Object.<string, number>} Count by assertion type
   * @private
   */
  _getAssertionTypeStats() {
    const stats = {};
    
    for (const testFile of this.testFiles) {
      for (const assertion of testFile.assertions) {
        stats[assertion.type] = (stats[assertion.type] || 0) + 1;
      }
    }
    
    return stats;
  }
  
  /**
   * Get coverage statistics
   * 
   * @returns {Object} Coverage statistics
   * @private
   */
  _getCoverageStats() {
    // Calculate enhanced table statistics
    const tableStats = Object.values(this.coverageMap.tables);
    const tablesWithDescriptions = tableStats.filter(table => 
      typeof table === 'object' && table.descriptions && table.descriptions.length > 0
    ).length;
    
    return {
      schemasWithTests: Object.keys(this.coverageMap.schemas).length,
      tablesWithTests: Object.keys(this.coverageMap.tables).length,
      tablesWithDescriptions,
      columnsWithTests: Object.keys(this.coverageMap.columns).length,
      functionsWithTests: Object.keys(this.coverageMap.functions).length,
      policiesWithTests: Object.keys(this.coverageMap.policies || {}).length,
      indexesWithTests: Object.keys(this.coverageMap.indexes || {}).length,
      triggersWithTests: Object.keys(this.coverageMap.triggers || {}).length,
      uniqueTargets: Object.keys(this.coverageMap.filesByTarget).length
    };
  }
  
  /**
   * Parse ARRAY['item1', 'item2'] parameter into array of strings
   * 
   * @param {string} arrayStr - Array parameter string like "'item1', 'item2'"
   * @returns {string[]} Array of parsed items
   * @private
   */
  _parseArrayParameter(arrayStr) {
    if (!arrayStr || !arrayStr.includes("'")) return [];
    // Handle both ARRAY['item1', 'item2'] and just 'item1', 'item2' formats
    const matches = arrayStr.match(/'([^']*)'/g);
    return matches ? matches.map(m => m.slice(1, -1)) : [];
  }

  /**
   * Extract function metadata from assertion parameters
   * 
   * @param {string} assertionType - Type of assertion
   * @param {string[]} parameters - Assertion parameters
   * @returns {Object} Function metadata object
   * @private
   */
  _extractFunctionMetadata(assertionType, parameters) {
    const metadata = {};
    
    // Helper function to determine if a parameter is likely a schema vs function name
    const isLikelySchema = (param, nextParam) => {
      if (!nextParam) return false;
      // Common schema names
      const commonSchemas = ['public', 'auth', 'storage', 'extensions', 'pg_catalog', 'information_schema'];
      return commonSchemas.includes(param.toLowerCase()) || param.includes('_schema') || param.includes('_db');
    };
    
    if (parameters.length === 0) return metadata;
    
    switch (assertionType) {
      case 'has_function':
      case 'hasnt_function':
        // Patterns:
        // has_function('function_name')
        // has_function('schema', 'function_name') 
        // has_function('function_name', ARRAY['type1', 'type2'])
        // has_function('schema', 'function_name', ARRAY['type1', 'type2'])
        
        if (parameters.length >= 2 && !parameters[1].includes("'")) {
          // Schema and function name provided (parameters[1] doesn't contain quotes)
          metadata.schema = parameters[0];
          metadata.name = parameters[1];
          
          if (parameters.length >= 3) {
            metadata.parameters = this._parseArrayParameter(parameters[2]);
          }
        } else {
          // Only function name provided, or function name with parameters
          metadata.name = parameters[0];
          
          if (parameters.length >= 2) {
            metadata.parameters = this._parseArrayParameter(parameters[1]);
          }
        }
        break;
        
      case 'function_returns':
        // Patterns:
        // function_returns('function_name', 'return_type')
        // function_returns('schema', 'function_name', 'return_type')
        // function_returns('function_name', ARRAY['type1', 'type2'], 'return_type')
        // function_returns('schema', 'function_name', ARRAY['type1', 'type2'], 'return_type')
        
        if (parameters.length >= 4) {
          // Four parameters: schema, function, args, return_type
          metadata.schema = parameters[0];
          metadata.name = parameters[1];
          metadata.parameters = this._parseArrayParameter(parameters[2]);
          metadata.returnType = parameters[3];
        } else if (parameters.length === 3) {
          // Three parameters could be:
          // 1. function, args, return_type (parameters[1] contains quotes from ARRAY)
          // 2. schema, function, return_type (no ARRAY parameter)
          if (parameters[1] && parameters[1].includes("'")) {
            // function, args, return_type pattern
            metadata.name = parameters[0];
            metadata.parameters = this._parseArrayParameter(parameters[1]);
            metadata.returnType = parameters[2];
          } else {
            // schema, function, return_type pattern  
            metadata.schema = parameters[0];
            metadata.name = parameters[1];
            metadata.returnType = parameters[2];
          }
        } else if (parameters.length >= 2) {
          // Function, return_type pattern
          metadata.name = parameters[0];
          metadata.returnType = parameters[1];
        }
        break;
        
      case 'function_lang_is':
        // Patterns similar to function_returns but last param is language
        if (parameters.length >= 3 && !parameters[1].startsWith('ARRAY') && !parameters[2].startsWith('ARRAY')) {
          // Schema, function, language pattern
          metadata.schema = parameters[0];
          metadata.name = parameters[1];
          metadata.language = parameters[2];
        } else if (parameters.length >= 4 && parameters[2].startsWith('ARRAY')) {
          // Schema, function, args, language pattern
          metadata.schema = parameters[0];
          metadata.name = parameters[1];
          metadata.parameters = this._parseArrayParameter(parameters[2]);
          metadata.language = parameters[3];
        } else if (parameters.length >= 3 && parameters[1].startsWith('ARRAY')) {
          // Function, args, language pattern
          metadata.name = parameters[0];
          metadata.parameters = this._parseArrayParameter(parameters[1]);
          metadata.language = parameters[2];
        } else if (parameters.length >= 2) {
          // Function, language pattern
          metadata.name = parameters[0];
          metadata.language = parameters[1];
        }
        break;
        
      case 'is_definer':
      case 'isnt_definer':
        // Similar patterns to has_function
        if (parameters.length >= 2 && !parameters[1].includes("'") && !parameters[1].startsWith('ARRAY')) {
          metadata.schema = parameters[0];
          metadata.name = parameters[1];
          
          if (parameters.length >= 3 && parameters[2].startsWith('ARRAY')) {
            metadata.parameters = this._parseArrayParameter(parameters[2]);
          }
        } else {
          metadata.name = parameters[0];
          
          if (parameters.length >= 2 && parameters[1].startsWith('ARRAY')) {
            metadata.parameters = this._parseArrayParameter(parameters[1]);
          }
        }
        
        metadata.isSecurityDefiner = assertionType === 'is_definer';
        break;
        
      case 'volatility_is':
        // Similar patterns to function_lang_is but last param is volatility
        if (parameters.length >= 3 && !parameters[1].startsWith('ARRAY') && !parameters[2].startsWith('ARRAY')) {
          // Schema, function, volatility pattern
          metadata.schema = parameters[0];
          metadata.name = parameters[1];
          metadata.volatility = parameters[2];
        } else if (parameters.length >= 4 && parameters[2].startsWith('ARRAY')) {
          // Schema, function, args, volatility pattern
          metadata.schema = parameters[0];
          metadata.name = parameters[1];
          metadata.parameters = this._parseArrayParameter(parameters[2]);
          metadata.volatility = parameters[3];
        } else if (parameters.length >= 3 && parameters[1].startsWith('ARRAY')) {
          // Function, args, volatility pattern
          metadata.name = parameters[0];
          metadata.parameters = this._parseArrayParameter(parameters[1]);
          metadata.volatility = parameters[2];
        } else if (parameters.length >= 2) {
          // Function, volatility pattern
          metadata.name = parameters[0];
          metadata.volatility = parameters[1];
        }
        break;
        
      case 'function_privs_are':
        // Patterns:
        // function_privs_are('schema', 'function', ARRAY['type1'], 'role', ARRAY['privs'])
        // function_privs_are('function', ARRAY['type1'], 'role', ARRAY['privs'])
        // function_privs_are('schema', 'function', 'role', ARRAY['privs'])
        // function_privs_are('function', 'role', ARRAY['privs'])
        
        if (parameters.length >= 5) {
          // Full pattern with schema, function, args, role, privs
          metadata.schema = parameters[0];
          metadata.name = parameters[1];
          if (parameters[2].startsWith('ARRAY')) {
            metadata.parameters = this._parseArrayParameter(parameters[2]);
            metadata.role = parameters[3];
            metadata.privileges = this._parseArrayParameter(parameters[4]);
          }
        } else if (parameters.length >= 4) {
          // Could be: schema, function, role, privs OR function, args, role, privs
          if (parameters[1].startsWith('ARRAY')) {
            // Function, args, role, privs
            metadata.name = parameters[0];
            metadata.parameters = this._parseArrayParameter(parameters[1]);
            metadata.role = parameters[2];
            metadata.privileges = this._parseArrayParameter(parameters[3]);
          } else {
            // Schema, function, role, privs
            metadata.schema = parameters[0];
            metadata.name = parameters[1];
            metadata.role = parameters[2];
            metadata.privileges = this._parseArrayParameter(parameters[3]);
          }
        } else if (parameters.length >= 3) {
          // Function, role, privs
          metadata.name = parameters[0];
          metadata.role = parameters[1];
          metadata.privileges = this._parseArrayParameter(parameters[2]);
        }
        break;
    }
    
    return metadata;
  }

  /**
   * Extract RLS policy metadata from assertion parameters
   * 
   * @param {string} assertionType - Type of assertion
   * @param {string[]} parameters - Assertion parameters
   * @returns {Object} Policy metadata object
   * @private
   */
  _extractPolicyMetadata(assertionType, parameters) {
    const metadata = {};
    
    // Helper function to parse array parameters like ARRAY['role1', 'role2'] or ARRAY['policy1', 'policy2']
    const parseArrayParameter = (arrayStr) => {
      if (!arrayStr || !arrayStr.includes("'")) return [];
      // Extract quoted items from array string
      const matches = arrayStr.match(/'([^']*)'/g);
      return matches ? matches.map(m => m.slice(1, -1)) : [];
    };
    
    if (parameters.length === 0) return metadata;
    
    switch (assertionType) {
      case 'is_rls_enabled':
        // is_rls_enabled('table') or is_rls_enabled('schema', 'table')
        if (parameters.length >= 2) {
          metadata.schema = parameters[0];
          metadata.tableName = parameters[1];
        } else {
          metadata.schema = 'public'; // Default schema
          metadata.tableName = parameters[0];
        }
        break;
        
      case 'policy_exists':
        // policy_exists('table', 'policy_name') or policy_exists('schema', 'table', 'policy_name')
        if (parameters.length >= 3) {
          metadata.schema = parameters[0];
          metadata.tableName = parameters[1];
          metadata.policyName = parameters[2];
        } else if (parameters.length === 2) {
          metadata.schema = 'public';
          metadata.tableName = parameters[0];
          metadata.policyName = parameters[1];
        }
        break;
        
      case 'policy_cmd_is':
        // policy_cmd_is('table', 'policy', 'SELECT') or policy_cmd_is('schema', 'table', 'policy', 'SELECT')
        if (parameters.length >= 4) {
          metadata.schema = parameters[0];
          metadata.tableName = parameters[1];
          metadata.policyName = parameters[2];
          metadata.command = parameters[3];
        } else if (parameters.length >= 3) {
          metadata.schema = 'public';
          metadata.tableName = parameters[0];
          metadata.policyName = parameters[1];
          metadata.command = parameters[2];
        }
        break;
        
      case 'policy_roles_are':
        // policy_roles_are('table', 'policy', ARRAY['role']) or policy_roles_are('schema', 'table', 'policy', ARRAY['role'])
        if (parameters.length >= 4) {
          metadata.schema = parameters[0];
          metadata.tableName = parameters[1];
          metadata.policyName = parameters[2];
          metadata.roles = parseArrayParameter(parameters[3]);
        } else if (parameters.length >= 3) {
          metadata.schema = 'public';
          metadata.tableName = parameters[0];
          metadata.policyName = parameters[1];
          metadata.roles = parseArrayParameter(parameters[2]);
        }
        break;
        
      case 'policies_are':
        // policies_are('table', ARRAY['policy1', 'policy2']) or policies_are('schema', 'table', ARRAY['policy1', 'policy2'])
        if (parameters.length >= 3) {
          metadata.schema = parameters[0];
          metadata.tableName = parameters[1];
          metadata.policies = parseArrayParameter(parameters[2]);
          if (parameters.length >= 4) {
            metadata.description = parameters[3];
          }
        } else if (parameters.length >= 2) {
          metadata.schema = 'public';
          metadata.tableName = parameters[0];
          metadata.policies = parseArrayParameter(parameters[1]);
          if (parameters.length >= 3) {
            metadata.description = parameters[2];
          }
        }
        break;
    }
    
    return metadata;
  }

  /**
   * Build a comprehensive coverage database from all scanned test files
   * 
   * This method processes all test files and builds an enhanced coverage database
   * that indexes coverage by object type and name, tracks assertion counts,
   * and enables efficient querying for coverage analysis.
   * 
   * @returns {Object} Enhanced coverage database
   * @public
   */
  async buildCoverageDatabase() {
    this.emit('progress', new ProgressEvent('Building coverage database with memory management...'));
    
    // Check if we should use streaming mode based on file count and memory
    const initialMemory = MemoryMonitor.getMemoryUsage();
    const shouldStream = this.options.enableStreaming && 
                        (this.testFiles.length > this.options.batchSize || 
                         initialMemory.heapUsed > (this.options.maxMemoryMB * 0.5));
    
    if (shouldStream) {
      return await this._buildCoverageDatabaseBatched();
    } else {
      return this._buildCoverageDatabaseStandard();
    }
  }

  /**
   * Build coverage database using standard approach
   * @private
   */
  _buildCoverageDatabaseStandard() {
    const database = this._createEmptyDatabase();
    
    // Process files with periodic memory checks
    for (let i = 0; i < this.testFiles.length; i++) {
      const testFile = this.testFiles[i];
      
      // Check memory every 10 files
      if (i % 10 === 0) {
        const memUsage = MemoryMonitor.getMemoryUsage();
        if (MemoryMonitor.shouldTriggerCleanup(memUsage.heapUsed, this.options.maxMemoryMB)) {
          this._performMemoryCleanup();
        }
      }

      this._processFileForDatabase(testFile, database);
    }

    this._identifyCoverageGaps(database);
    this.coverageDatabase = database;
    
    this.emit('success', new SuccessEvent('Coverage database built successfully', {
      totalObjects: this._getTotalIndexedObjects(database),
      totalAssertions: database.assertionCounts.total,
      coverage: this._calculateOverallCoverage(database),
      memoryStats: this.getMemoryStats()
    }));

    return database;
  }

  /**
   * Build coverage database using batched approach for large datasets
   * @private
   */
  async _buildCoverageDatabaseBatched() {
    this.memoryState.streamingMode = true;
    const database = this._createEmptyDatabase();
    
    // Use BatchProcessor for memory-managed processing
    await this.batchProcessor.processBatches(
      this.testFiles,
      async (batch, batchIndex) => {
        // Check if streaming DB should limit objects
        if (this.streamingDB) {
          for (const testFile of batch) {
            if (!this.streamingDB.addObject('files', testFile.filePath, testFile)) {
              this.emit('warning', {
                type: 'memory_limit',
                message: `File processing limit reached at batch ${batchIndex}`
              });
              break;
            }
          }
        }
        
        // Process batch files
        for (const testFile of batch) {
          this._processFileForDatabase(testFile, database);
        }
        
        this.memoryState.batchesProcessed++;
        
        return batch.map(f => f.filePath);
      }
    );

    this._identifyCoverageGaps(database);
    this.coverageDatabase = database;
    
    this.emit('success', new SuccessEvent('Batched coverage database built successfully', {
      totalObjects: this._getTotalIndexedObjects(database),
      totalAssertions: database.assertionCounts.total,
      coverage: this._calculateOverallCoverage(database),
      memoryStats: this.getMemoryStats()
    }));

    return database;
  }

  /**
   * Create empty database structure with memory management metadata
   * @private
   */
  _createEmptyDatabase() {
    return {
      objects: {
        tables: new Map(),
        columns: new Map(),
        functions: new Map(),
        schemas: new Map(),
        policies: new Map(),
        indexes: new Map(),
        triggers: new Map()
      },
      assertionCounts: {
        total: 0,
        byType: new Map(),
        byObject: new Map()
      },
      gaps: {
        uncoveredObjects: new Set(),
        partialCoverage: new Set()
      },
      fileIndex: new Map(),
      buildTimestamp: new Date().toISOString(),
      totalFiles: this.testFiles.length,
      totalAssertions: this.totalAssertions,
      memoryManaged: true,
      streamingMode: this.memoryState.streamingMode
    };
  }

  /**
   * Process a single file for database building with memory limits
   * @private
   */
  _processFileForDatabase(testFile, database) {
    // Skip if we've hit object limits
    const fileCount = database.fileIndex.size;
    if (fileCount > this.options.maxObjectsPerType) {
      this.emit('warning', {
        type: 'file_limit',
        message: `Skipping file ${testFile.fileName} - reached file limit`
      });
      return;
    }

    // Index file for traceability
    database.fileIndex.set(testFile.filePath, {
      fileName: testFile.fileName,
      assertions: testFile.assertions.length,
      planCount: testFile.planCount,
      dependencies: testFile.dependencies,
      metadata: testFile.metadata
    });

    // Process each assertion in the file
    for (const assertion of testFile.assertions) {
      database.assertionCounts.total++;
      this.memoryState.objectsProcessed++;
      
      // Track assertion types
      const typeCount = database.assertionCounts.byType.get(assertion.type) || 0;
      database.assertionCounts.byType.set(assertion.type, typeCount + 1);

      // Process based on assertion type and extract object information
      this._indexAssertionInDatabase(database, assertion, testFile);
    }
  }

  /**
   * Get coverage information for a specific database object
   * 
   * @param {string} objectType - Type of object (table, column, function, etc.)
   * @param {string} objectName - Name/identifier of the object
   * @returns {Object|null} Coverage information for the object
   * @public
   */
  getCoverageByObject(objectType, objectName) {
    if (!this.coverageDatabase) {
      this.buildCoverageDatabase();
    }

    const normalizedType = objectType.toLowerCase();
    const objectMap = this.coverageDatabase.objects[normalizedType];
    
    if (!objectMap || !objectMap.has(objectName)) {
      return null;
    }

    const objectCoverage = objectMap.get(objectName);
    
    // Calculate coverage percentage for this object
    const totalPossibleAssertions = this._estimateMaxAssertions(normalizedType, objectName);
    const coveragePercentage = totalPossibleAssertions > 0 
      ? Math.round((objectCoverage.assertions.length / totalPossibleAssertions) * 100)
      : 100;

    return {
      objectType: normalizedType,
      objectName,
      assertionCount: objectCoverage.assertions.length,
      assertionTypes: [...objectCoverage.assertionTypes],
      testFiles: [...objectCoverage.testFiles].map(f => f.fileName),
      metadata: objectCoverage.metadata,
      coveragePercentage,
      lastTested: objectCoverage.lastTested,
      assertions: objectCoverage.assertions.map(a => ({
        type: a.type,
        testFile: a.testFile.fileName,
        lineNumber: a.lineNumber,
        description: a.description
      }))
    };
  }

  /**
   * Get comprehensive coverage statistics with percentages and analysis
   * 
   * @returns {Object} Detailed coverage statistics
   * @public
   */
  getCoverageStatistics() {
    if (!this.coverageDatabase) {
      this.buildCoverageDatabase();
    }

    const db = this.coverageDatabase;
    const stats = {
      // Overall statistics
      totalFiles: db.totalFiles,
      totalAssertions: db.totalAssertions,
      buildTimestamp: db.buildTimestamp,

      // Object coverage counts
      objectCounts: {
        schemas: db.objects.schemas.size,
        tables: db.objects.tables.size,
        columns: db.objects.columns.size,
        functions: db.objects.functions.size,
        policies: db.objects.policies.size,
        indexes: db.objects.indexes.size,
        triggers: db.objects.triggers.size
      },

      // Assertion type distribution
      assertionTypes: Object.fromEntries(db.assertionCounts.byType),

      // Coverage percentages by object type
      coveragePercentages: {
        schemas: this._calculateTypesCoverage('schemas'),
        tables: this._calculateTypesCoverage('tables'),
        columns: this._calculateTypesCoverage('columns'),
        functions: this._calculateTypesCoverage('functions'),
        policies: this._calculateTypesCoverage('policies'),
        indexes: this._calculateTypesCoverage('indexes'),
        triggers: this._calculateTypesCoverage('triggers')
      },

      // Coverage quality metrics
      quality: {
        averageAssertionsPerObject: db.totalAssertions / this._getTotalIndexedObjects(db),
        filesWithHighCoverage: this._countHighCoverageFiles(),
        objectsWithMultipleTests: this._countMultiTestedObjects(),
        assertionDiversity: db.assertionCounts.byType.size
      },

      // Coverage gaps analysis
      gaps: {
        totalUncovered: db.gaps.uncoveredObjects.size,
        partialCoverage: db.gaps.partialCoverage.size,
        uncoveredByType: this._categorizeUncoveredObjects(),
        recommendedTests: this._generateTestRecommendations()
      },

      // Top tested objects
      topTested: this._getTopTestedObjects(10)
    };

    return stats;
  }

  /**
   * Export coverage report in various formats
   * 
   * @param {Object} [options={}] - Export options
   * @param {string} [options.format='json'] - Export format (json, csv, html, markdown)
   * @param {boolean} [options.includeGaps=true] - Include coverage gaps in report
   * @param {boolean} [options.includeDetails=false] - Include detailed assertion info
   * @param {string[]} [options.objectTypes] - Limit to specific object types
   * @returns {string} Formatted coverage report
   * @public
   */
  exportCoverageReport(options = {}) {
    const {
      format = 'json',
      includeGaps = true,
      includeDetails = false,
      objectTypes = null
    } = options;

    if (!this.coverageDatabase) {
      this.buildCoverageDatabase();
    }

    const stats = this.getCoverageStatistics();
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        scanner: 'pgTAPTestScanner',
        version: '1.0.0'
      },
      summary: {
        totalFiles: stats.totalFiles,
        totalAssertions: stats.totalAssertions,
        objectCounts: stats.objectCounts,
        overallCoverage: this._calculateOverallCoverage(this.coverageDatabase)
      },
      coverage: this._buildCoverageReport(objectTypes, includeDetails),
      statistics: stats
    };

    if (includeGaps) {
      report.gaps = stats.gaps;
    }

    // Format the report based on requested format
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'csv':
        return this._formatReportAsCsv(report);
        
      case 'html':
        return this._formatReportAsHtml(report);
        
      case 'markdown':
        return this._formatReportAsMarkdown(report);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private methods for coverage database functionality

  /**
   * Index a single assertion in the coverage database
   * 
   * @param {Object} database - Coverage database being built
   * @param {TestAssertion} assertion - Assertion to index
   * @param {TestFile} testFile - Test file containing the assertion
   * @private
   */
  _indexAssertionInDatabase(database, assertion, testFile) {
    const { type, target } = assertion;
    
    // Determine object type and name from assertion
    const objectInfo = this._parseObjectFromTarget(type, target);
    if (!objectInfo) return;

    const { objectType, objectName } = objectInfo;
    const objectMap = database.objects[objectType];
    
    if (!objectMap) return;

    // Get or create object entry
    if (!objectMap.has(objectName)) {
      objectMap.set(objectName, {
        assertions: [],
        assertionTypes: new Set(),
        testFiles: new Set(),
        metadata: {},
        lastTested: null
      });
    }

    const objectEntry = objectMap.get(objectName);
    
    // Add assertion to object entry
    objectEntry.assertions.push({
      type,
      target,
      testFile,
      lineNumber: assertion.lineNumber,
      description: assertion.description,
      parameters: assertion.parameters
    });
    
    objectEntry.assertionTypes.add(type);
    objectEntry.testFiles.add(testFile);
    objectEntry.lastTested = new Date().toISOString();
    
    // Store additional metadata based on assertion type
    if (assertion.functionMetadata) {
      objectEntry.metadata.function = { ...objectEntry.metadata.function, ...assertion.functionMetadata };
    }
    if (assertion.policyMetadata) {
      objectEntry.metadata.policy = { ...objectEntry.metadata.policy, ...assertion.policyMetadata };
    }

    // Track assertion count by object
    const objectKey = `${objectType}:${objectName}`;
    const objectCount = database.assertionCounts.byObject.get(objectKey) || 0;
    database.assertionCounts.byObject.set(objectKey, objectCount + 1);
  }

  /**
   * Parse object type and name from assertion target
   * 
   * @param {string} assertionType - Type of assertion
   * @param {string} target - Target string from assertion
   * @returns {Object|null} Object type and name
   * @private
   */
  _parseObjectFromTarget(assertionType, target) {
    if (!target) return null;

    // Determine object type based on assertion type
    let objectType;
    if (assertionType.includes('table') || assertionType.includes('rls')) {
      objectType = 'tables';
    } else if (assertionType.includes('column') || assertionType.includes('col_')) {
      objectType = 'columns';
    } else if (assertionType.includes('function')) {
      objectType = 'functions';
    } else if (assertionType.includes('schema')) {
      objectType = 'schemas';
    } else if (assertionType.includes('policy') || assertionType.includes('policies')) {
      objectType = 'policies';
    } else if (assertionType.includes('index')) {
      objectType = 'indexes';
    } else if (assertionType.includes('trigger')) {
      objectType = 'triggers';
    } else {
      // Try to infer from target format
      const parts = target.split('.');
      if (parts.length === 1) {
        objectType = 'schemas'; // Likely a schema-level test
      } else if (parts.length === 2) {
        objectType = 'tables'; // Likely schema.table
      } else {
        objectType = 'columns'; // Likely schema.table.column
      }
    }

    return {
      objectType,
      objectName: target
    };
  }

  /**
   * Identify coverage gaps in the database
   * 
   * @param {Object} database - Coverage database
   * @private
   */
  _identifyCoverageGaps(database) {
    // This is a simplified implementation - in practice, you'd want to 
    // compare against actual database schema to find truly uncovered objects
    
    for (const [objectType, objectMap] of Object.entries(database.objects)) {
      for (const [objectName, objectData] of objectMap.entries()) {
        const assertionCount = objectData.assertions.length;
        
        // Consider objects with very few assertions as having coverage gaps
        if (assertionCount === 0) {
          database.gaps.uncoveredObjects.add(`${objectType}:${objectName}`);
        } else if (assertionCount < this._getMinimumAssertionThreshold(objectType)) {
          database.gaps.partialCoverage.add(`${objectType}:${objectName}`);
        }
      }
    }
  }

  /**
   * Calculate overall coverage percentage
   * 
   * @param {Object} database - Coverage database
   * @returns {number} Coverage percentage
   * @private
   */
  _calculateOverallCoverage(database) {
    const totalObjects = this._getTotalIndexedObjects(database);
    const uncoveredObjects = database.gaps.uncoveredObjects.size;
    
    if (totalObjects === 0) return 100;
    
    const coveredObjects = totalObjects - uncoveredObjects;
    return Math.round((coveredObjects / totalObjects) * 100);
  }

  /**
   * Get total number of indexed objects across all types
   * 
   * @param {Object} database - Coverage database
   * @returns {number} Total object count
   * @private
   */
  _getTotalIndexedObjects(database) {
    return Object.values(database.objects)
      .reduce((total, objectMap) => total + objectMap.size, 0);
  }

  /**
   * Calculate coverage percentage for a specific object type
   * 
   * @param {string} objectType - Type of object
   * @returns {number} Coverage percentage
   * @private
   */
  _calculateTypesCoverage(objectType) {
    if (!this.coverageDatabase) return 0;
    
    const objectMap = this.coverageDatabase.objects[objectType];
    if (!objectMap || objectMap.size === 0) return 0;
    
    let coveredCount = 0;
    for (const [, objectData] of objectMap.entries()) {
      if (objectData.assertions.length > 0) {
        coveredCount++;
      }
    }
    
    return Math.round((coveredCount / objectMap.size) * 100);
  }

  /**
   * Estimate maximum possible assertions for an object type
   * 
   * @param {string} objectType - Type of object
   * @param {string} objectName - Name of object
   * @returns {number} Estimated maximum assertions
   * @private
   */
  _estimateMaxAssertions(objectType, objectName) {
    // These are rough estimates - could be enhanced with actual schema introspection
    switch (objectType) {
      case 'tables':
        return 8; // has_table, table_privs, columns, constraints, etc.
      case 'columns': 
        return 4; // has_column, col_type_is, col_default_is, col_not_null
      case 'functions':
        return 6; // has_function, function_returns, function_lang, etc.
      case 'indexes':
        return 3; // has_index, index_is_unique, index_is_primary
      case 'triggers':
        return 4; // has_trigger, trigger_is, etc.
      case 'policies':
        return 3; // policy_is, policy_cmd, etc.
      case 'schemas':
        return 2; // has_schema, schema_owner
      default:
        return 3;
    }
  }

  /**
   * Get minimum assertion threshold for object type
   * 
   * @param {string} objectType - Type of object
   * @returns {number} Minimum assertion threshold
   * @private
   */
  _getMinimumAssertionThreshold(objectType) {
    switch (objectType) {
      case 'tables':
        return 2; // At minimum should test existence and basic properties
      case 'functions':
        return 2; // Should test existence and return type
      case 'columns':
        return 1; // At minimum test type
      default:
        return 1;
    }
  }

  /**
   * Count files with high coverage (multiple assertions per object)
   * 
   * @returns {number} Count of high coverage files
   * @private
   */
  _countHighCoverageFiles() {
    let highCoverageCount = 0;
    
    for (const testFile of this.testFiles) {
      if (testFile.assertions.length >= 5) { // Arbitrary threshold
        highCoverageCount++;
      }
    }
    
    return highCoverageCount;
  }

  /**
   * Count objects that have multiple test types
   * 
   * @returns {number} Count of multi-tested objects
   * @private
   */
  _countMultiTestedObjects() {
    if (!this.coverageDatabase) return 0;
    
    let multiTestedCount = 0;
    
    for (const objectMap of Object.values(this.coverageDatabase.objects)) {
      for (const [, objectData] of objectMap.entries()) {
        if (objectData.assertionTypes.size >= 3) { // Multiple assertion types
          multiTestedCount++;
        }
      }
    }
    
    return multiTestedCount;
  }

  /**
   * Categorize uncovered objects by type
   * 
   * @returns {Object} Uncovered objects by category
   * @private
   */
  _categorizeUncoveredObjects() {
    if (!this.coverageDatabase) return {};
    
    const categorized = {};
    
    for (const objectRef of this.coverageDatabase.gaps.uncoveredObjects) {
      const [objectType] = objectRef.split(':');
      if (!categorized[objectType]) {
        categorized[objectType] = [];
      }
      categorized[objectType].push(objectRef);
    }
    
    return categorized;
  }

  /**
   * Generate test recommendations based on coverage gaps
   * 
   * @returns {string[]} Array of test recommendations
   * @private
   */
  _generateTestRecommendations() {
    const recommendations = [];
    
    if (!this.coverageDatabase) return recommendations;
    
    // Analyze gaps and suggest specific tests
    for (const objectRef of this.coverageDatabase.gaps.uncoveredObjects) {
      const [objectType, objectName] = objectRef.split(':', 2);
      
      switch (objectType) {
        case 'tables':
          recommendations.push(`Add has_table test for ${objectName}`);
          break;
        case 'functions':
          recommendations.push(`Add has_function test for ${objectName}`);
          break;
        case 'columns':
          recommendations.push(`Add column type test for ${objectName}`);
          break;
        default:
          recommendations.push(`Add test coverage for ${objectType}: ${objectName}`);
      }
    }
    
    return recommendations.slice(0, 20); // Limit recommendations
  }

  /**
   * Get top tested objects
   * 
   * @param {number} limit - Maximum number to return
   * @returns {Array} Array of top tested objects
   * @private
   */
  _getTopTestedObjects(limit = 10) {
    if (!this.coverageDatabase) return [];
    
    const objectStats = [];
    
    for (const [objectType, objectMap] of Object.entries(this.coverageDatabase.objects)) {
      for (const [objectName, objectData] of objectMap.entries()) {
        objectStats.push({
          objectType,
          objectName,
          assertionCount: objectData.assertions.length,
          assertionTypes: objectData.assertionTypes.size,
          testFiles: objectData.testFiles.size
        });
      }
    }
    
    return objectStats
      .sort((a, b) => b.assertionCount - a.assertionCount)
      .slice(0, limit);
  }

  /**
   * Build detailed coverage report data
   * 
   * @param {string[]} objectTypes - Object types to include
   * @param {boolean} includeDetails - Include detailed assertion info
   * @returns {Object} Coverage report data
   * @private
   */
  _buildCoverageReport(objectTypes, includeDetails) {
    const report = {};
    
    if (!this.coverageDatabase) return report;
    
    const typesToInclude = objectTypes || Object.keys(this.coverageDatabase.objects);
    
    for (const objectType of typesToInclude) {
      const objectMap = this.coverageDatabase.objects[objectType];
      if (!objectMap) continue;
      
      report[objectType] = {};
      
      for (const [objectName, objectData] of objectMap.entries()) {
        const objectReport = {
          assertionCount: objectData.assertions.length,
          assertionTypes: [...objectData.assertionTypes],
          testFileCount: objectData.testFiles.size,
          lastTested: objectData.lastTested
        };
        
        if (includeDetails) {
          objectReport.assertions = objectData.assertions.map(a => ({
            type: a.type,
            testFile: a.testFile.fileName,
            lineNumber: a.lineNumber,
            description: a.description
          }));
        }
        
        report[objectType][objectName] = objectReport;
      }
    }
    
    return report;
  }

  /**
   * Format report as CSV
   * 
   * @param {Object} report - Report data
   * @returns {string} CSV formatted report
   * @private
   */
  _formatReportAsCsv(report) {
    const lines = ['Object Type,Object Name,Assertion Count,Assertion Types,Test Files,Coverage %'];
    
    for (const [objectType, objects] of Object.entries(report.coverage)) {
      for (const [objectName, data] of Object.entries(objects)) {
        const maxAssertions = this._estimateMaxAssertions(objectType, objectName);
        const coverage = maxAssertions > 0 
          ? Math.round((data.assertionCount / maxAssertions) * 100)
          : 100;
        
        lines.push([
          objectType,
          objectName,
          data.assertionCount,
          data.assertionTypes.length,
          data.testFileCount,
          coverage
        ].join(','));
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format report as HTML
   * 
   * @param {Object} report - Report data
   * @returns {string} HTML formatted report
   * @private
   */
  _formatReportAsHtml(report) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>pgTAP Coverage Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .high-coverage { background-color: #d4edda; }
    .medium-coverage { background-color: #fff3cd; }
    .low-coverage { background-color: #f8d7da; }
  </style>
</head>
<body>
  <h1>pgTAP Test Coverage Report</h1>
  <p>Generated: ${report.metadata.generatedAt}</p>
  
  <h2>Summary</h2>
  <ul>
    <li>Total Files: ${report.summary.totalFiles}</li>
    <li>Total Assertions: ${report.summary.totalAssertions}</li>
    <li>Overall Coverage: ${report.summary.overallCoverage}%</li>
  </ul>
  
  <h2>Object Coverage</h2>
  <table>
    <tr>
      <th>Object Type</th>
      <th>Object Name</th>
      <th>Assertions</th>
      <th>Types</th>
      <th>Files</th>
      <th>Coverage</th>
    </tr>
    ${this._generateHtmlTableRows(report.coverage)}
  </table>
</body>
</html>`;
  }

  /**
   * Format report as Markdown
   * 
   * @param {Object} report - Report data
   * @returns {string} Markdown formatted report
   * @private
   */
  _formatReportAsMarkdown(report) {
    const lines = [
      '# pgTAP Test Coverage Report',
      '',
      `Generated: ${report.metadata.generatedAt}`,
      '',
      '## Summary',
      '',
      `- **Total Files:** ${report.summary.totalFiles}`,
      `- **Total Assertions:** ${report.summary.totalAssertions}`,
      `- **Overall Coverage:** ${report.summary.overallCoverage}%`,
      '',
      '## Coverage by Object Type',
      ''
    ];
    
    for (const [objectType, objects] of Object.entries(report.coverage)) {
      lines.push(`### ${objectType.charAt(0).toUpperCase() + objectType.slice(1)}`);
      lines.push('');
      lines.push('| Object Name | Assertions | Types | Files | Coverage |');
      lines.push('|-------------|------------|-------|-------|----------|');
      
      for (const [objectName, data] of Object.entries(objects)) {
        const maxAssertions = this._estimateMaxAssertions(objectType, objectName);
        const coverage = maxAssertions > 0 
          ? Math.round((data.assertionCount / maxAssertions) * 100)
          : 100;
        
        lines.push(`| ${objectName} | ${data.assertionCount} | ${data.assertionTypes.length} | ${data.testFileCount} | ${coverage}% |`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Generate HTML table rows for coverage report
   * 
   * @param {Object} coverage - Coverage data
   * @returns {string} HTML table rows
   * @private
   */
  _generateHtmlTableRows(coverage) {
    const rows = [];
    
    for (const [objectType, objects] of Object.entries(coverage)) {
      for (const [objectName, data] of Object.entries(objects)) {
        const maxAssertions = this._estimateMaxAssertions(objectType, objectName);
        const coverage = maxAssertions > 0 
          ? Math.round((data.assertionCount / maxAssertions) * 100)
          : 100;
        
        const coverageClass = coverage >= 80 ? 'high-coverage' : 
                             coverage >= 50 ? 'medium-coverage' : 'low-coverage';
        
        rows.push(`    <tr class="${coverageClass}">
      <td>${objectType}</td>
      <td>${objectName}</td>
      <td>${data.assertionCount}</td>
      <td>${data.assertionTypes.length}</td>
      <td>${data.testFileCount}</td>
      <td>${coverage}%</td>
    </tr>`);
      }
    }
    
    return rows.join('\n');
  }
  
  // Memory Management Methods
  
  /**
   * Initialize memory monitoring and management
   * @private
   */
  _initializeMemoryMonitoring() {
    // Initialize streaming database and batch processor
    this.streamingDB = new StreamingCoverageDatabase(this.options);
    this.batchProcessor = new BatchProcessor(this, this.options);
    
    // Set up periodic memory monitoring
    if (this.options.cleanupInterval > 0) {
      this.memoryMonitoringInterval = setInterval(() => {
        this._checkMemoryUsage();
      }, this.options.cleanupInterval);
    }
    
    // Listen for process events
    process.once('exit', () => this._cleanup());
    process.once('SIGINT', () => this._cleanup());
    process.once('SIGTERM', () => this._cleanup());
  }

  /**
   * Check current memory usage and trigger cleanup if needed
   * @private
   */
  _checkMemoryUsage() {
    const usage = MemoryMonitor.getMemoryUsage();
    this.memoryState.currentUsageMB = usage.heapUsed;
    this.memoryState.maxUsageMB = Math.max(this.memoryState.maxUsageMB, usage.heapUsed);

    if (MemoryMonitor.shouldTriggerCleanup(usage.heapUsed, this.options.maxMemoryMB)) {
      this._performMemoryCleanup();
    }

    // Emit memory status
    this.emit('memory_status', {
      current: usage.heapUsed,
      max: this.memoryState.maxUsageMB,
      threshold: this.options.maxMemoryMB * 0.8,
      streamingMode: this.memoryState.streamingMode
    });
  }


  /**
   * Perform memory cleanup operations
   * @private
   */
  _performMemoryCleanup() {
    // Switch to streaming mode if not already
    if (!this.memoryState.streamingMode && this.options.enableStreaming) {
      this.memoryState.streamingMode = true;
      this.emit('warning', {
        type: 'memory_threshold',
        message: 'Switching to streaming mode due to high memory usage'
      });
    }

    // Clear weak references
    this.weakRefs = new WeakMap();

    // Limit object accumulation
    this._limitObjectAccumulation();

    // Force garbage collection if enabled
    if (this.options.enableGC) {
      const gcResult = MemoryMonitor.forceGC();
      if (gcResult) {
        this.memoryState.gcCount++;
      }
    }

    this.memoryState.lastCleanup = Date.now();
    
    this.emit('cleanup', {
      type: 'memory_cleanup',
      memoryUsage: MemoryMonitor.getMemoryUsage(),
      gcPerformed: this.options.enableGC && MemoryMonitor.forceGC()
    });
  }

  /**
   * Limit object accumulation to prevent OOM
   * @private
   */
  _limitObjectAccumulation() {
    // Limit coverage map sizes
    Object.keys(this.coverageMap).forEach(type => {
      if (type === 'filesByTarget') return;
      
      const objects = this.coverageMap[type];
      const objectKeys = Object.keys(objects);
      
      if (objectKeys.length > this.options.maxObjectsPerType) {
        // Keep only the most recent objects
        const toKeep = objectKeys.slice(-Math.floor(this.options.maxObjectsPerType * 0.8));
        const newObjects = {};
        
        toKeep.forEach(key => {
          newObjects[key] = objects[key];
        });
        
        this.coverageMap[type] = newObjects;
        
        this.emit('warning', {
          type: 'object_limit',
          message: `Limited ${type} objects to ${toKeep.length} items`
        });
      }
    });
  }


  /**
   * Cleanup resources
   * @private
   */
  _cleanup() {
    if (this.memoryMonitoringInterval) {
      clearInterval(this.memoryMonitoringInterval);
      this.memoryMonitoringInterval = null;
    }
    
    if (this.abortController) {
      this.abortController.abort();
    }

    this.emit('cleanup', { type: 'shutdown' });
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage stats
   * @public
   */
  getMemoryStats() {
    return {
      ...this.memoryState,
      currentUsage: MemoryMonitor.getMemoryUsage(),
      streamingDBStats: this.streamingDB?.getStats() || null,
      options: {
        maxMemoryMB: this.options.maxMemoryMB,
        batchSize: this.options.batchSize,
        enableStreaming: this.options.enableStreaming,
        enableGC: this.options.enableGC
      }
    };
  }
}

export default pgTAPTestScanner;