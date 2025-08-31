/**
 * DiffEngine - Git-based migration diff generator
 * 
 * Generates incremental migrations by comparing Golden SQL
 * between git commits/tags (not full database introspection)
 */

const { EventEmitter } = require('events');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class DiffEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Git-related config
      gitRoot: config.gitRoot || process.cwd(),
      sqlDir: config.sqlDir || './sql',
      
      // Diff behavior
      includeData: config.includeData || false,
      includeDropStatements: config.includeDropStatements !== false,
      sortOutput: config.sortOutput !== false,
      excludeSchemas: config.excludeSchemas || ['pg_catalog', 'information_schema'],
      
      // Custom options preserved
      ...config
    };
    
    // State management
    this.isRunning = false;
    this.lastDiff = null;
  }

  /**
   * Generate diff between two points in git history
   * @param {Object} currentDb - Current state (can be HEAD, branch, or tag)
   * @param {Object} desiredDb - Desired state (can be HEAD, branch, or tag)
   */
  async generateDiff(currentDb, desiredDb) {
    if (this.isRunning) {
      throw new Error('Diff generation already running');
    }
    
    if (!currentDb || !desiredDb) {
      const error = new Error('Both current and desired states must be provided');
      this.emit('error', {
        error,
        message: error.message,
        timestamp: new Date()
      });
      throw error;
    }
    
    this.isRunning = true;
    const startTime = new Date();
    
    this.emit('start', {
      currentDb,
      desiredDb,
      timestamp: startTime
    });
    
    try {
      // Step 1: Initialize
      this.emit('progress', {
        step: 'initializing',
        message: 'Initializing diff engine',
        timestamp: new Date()
      });
      
      // Validate git repository
      await this.validateGitRepository();
      
      // Step 2: Get git refs
      const currentRef = this.resolveGitRef(currentDb);
      const desiredRef = this.resolveGitRef(desiredDb);
      
      this.emit('progress', {
        step: 'refs_resolved',
        message: `Comparing ${currentRef} to ${desiredRef}`,
        currentRef,
        desiredRef,
        timestamp: new Date()
      });
      
      // Step 3: Generate SQL diffs
      const sqlDiff = await this.generateSqlDiff(currentRef, desiredRef);
      
      // Step 4: Parse and analyze changes
      const migration = await this.analyzeDiff(sqlDiff);
      
      // Step 5: Generate migration SQL
      const migrationSql = await this.generateMigrationSql(migration);
      
      // Complete
      const endTime = new Date();
      const duration = endTime - startTime;
      
      const result = {
        diff: migrationSql,
        stats: {
          duration,
          currentRef,
          desiredRef,
          changes: migration.changes.length,
          additions: migration.additions.length,
          deletions: migration.deletions.length,
          modifications: migration.modifications.length
        },
        timestamp: endTime
      };
      
      this.lastDiff = result;
      
      this.emit('complete', {
        diff: result.diff,
        duration,
        timestamp: endTime
      });
      
      return result;
      
    } catch (error) {
      this.emit('error', {
        error,
        message: error.message,
        timestamp: new Date()
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Validate we're in a git repository
   */
  async validateGitRepository() {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: this.config.gitRoot,
        stdio: 'pipe'
      });
    } catch (error) {
      throw new Error('Not in a git repository');
    }
  }

  /**
   * Resolve git reference from config object
   */
  resolveGitRef(dbConfig) {
    // Handle different input formats
    if (typeof dbConfig === 'string') {
      return dbConfig; // Already a git ref
    }
    
    if (dbConfig.tag) {
      return dbConfig.tag;
    }
    
    if (dbConfig.branch) {
      return dbConfig.branch;
    }
    
    if (dbConfig.commit) {
      return dbConfig.commit;
    }
    
    // Default to HEAD for current database
    if (dbConfig.database === 'current' || dbConfig.host === 'localhost') {
      return 'HEAD';
    }
    
    // Look for last deployment tag
    if (dbConfig.database === 'production' || dbConfig.database === 'test_desired') {
      return this.getLastDeploymentTag();
    }
    
    return 'HEAD';
  }

  /**
   * Get last deployment tag from git
   */
  getLastDeploymentTag() {
    try {
      const tag = execSync('git describe --tags --abbrev=0 --match="data/prod/*"', {
        cwd: this.config.gitRoot,
        stdio: 'pipe'
      }).toString().trim();
      
      return tag || 'HEAD';
    } catch (error) {
      // No tags found, use HEAD
      return 'HEAD';
    }
  }

  /**
   * Generate SQL diff between two git refs
   */
  async generateSqlDiff(fromRef, toRef) {
    this.emit('progress', {
      step: 'generating_diff',
      message: 'Generating SQL diff from git',
      timestamp: new Date()
    });
    
    try {
      // Get the diff of SQL files between two refs
      const diff = execSync(
        `git diff ${fromRef}...${toRef} -- ${this.config.sqlDir}/`,
        {
          cwd: this.config.gitRoot,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          stdio: 'pipe'
        }
      ).toString();
      
      return diff;
    } catch (error) {
      throw new Error(`Failed to generate git diff: ${error.message}`);
    }
  }

  /**
   * Analyze the git diff to extract SQL changes
   */
  async analyzeDiff(gitDiff) {
    this.emit('progress', {
      step: 'analyzing',
      message: 'Analyzing SQL changes',
      timestamp: new Date()
    });
    
    const migration = {
      additions: [],
      deletions: [],
      modifications: [],
      changes: []
    };
    
    if (!gitDiff || gitDiff.trim().length === 0) {
      return migration;
    }
    
    // Parse git diff output
    const lines = gitDiff.split('\n');
    let currentFile = null;
    let inSqlBlock = false;
    let sqlBuffer = [];
    let changeType = null;
    
    for (const line of lines) {
      // File header
      if (line.startsWith('diff --git')) {
        if (sqlBuffer.length > 0 && currentFile) {
          this.processSqlBuffer(migration, sqlBuffer, changeType, currentFile);
          sqlBuffer = [];
        }
        const match = line.match(/b\/(.+)$/);
        currentFile = match ? match[1] : null;
        continue;
      }
      
      // New file
      if (line.startsWith('new file')) {
        changeType = 'addition';
        continue;
      }
      
      // Deleted file
      if (line.startsWith('deleted file')) {
        changeType = 'deletion';
        continue;
      }
      
      // Modified file
      if (line.startsWith('index ')) {
        changeType = 'modification';
        continue;
      }
      
      // Added lines
      if (line.startsWith('+') && !line.startsWith('+++')) {
        sqlBuffer.push({
          type: 'add',
          content: line.substring(1)
        });
      }
      
      // Removed lines
      if (line.startsWith('-') && !line.startsWith('---')) {
        sqlBuffer.push({
          type: 'remove',
          content: line.substring(1)
        });
      }
    }
    
    // Process final buffer
    if (sqlBuffer.length > 0 && currentFile) {
      this.processSqlBuffer(migration, sqlBuffer, changeType, currentFile);
    }
    
    return migration;
  }

  /**
   * Process SQL buffer and categorize changes
   */
  processSqlBuffer(migration, buffer, changeType, file) {
    const added = buffer.filter(b => b.type === 'add').map(b => b.content).join('\n');
    const removed = buffer.filter(b => b.type === 'remove').map(b => b.content).join('\n');
    
    const change = {
      file,
      type: changeType,
      added,
      removed
    };
    
    migration.changes.push(change);
    
    if (changeType === 'addition') {
      migration.additions.push(change);
    } else if (changeType === 'deletion') {
      migration.deletions.push(change);
    } else {
      migration.modifications.push(change);
    }
  }

  /**
   * Generate migration SQL from analyzed changes
   */
  async generateMigrationSql(migration) {
    this.emit('progress', {
      step: 'generating_sql',
      message: 'Generating migration SQL',
      timestamp: new Date()
    });
    
    const sections = [];
    
    // Header
    sections.push(`-- ═══════════════════════════════════════════════════════════════════════════
-- INCREMENTAL MIGRATION
-- Generated by D.A.T.A. DiffEngine
-- ${new Date().toISOString()}
-- ═══════════════════════════════════════════════════════════════════════════

`);
    
    // Process additions
    if (migration.additions.length > 0) {
      sections.push('-- ADDITIONS\n');
      for (const add of migration.additions) {
        sections.push(`-- File: ${add.file}\n`);
        sections.push(add.added + '\n\n');
      }
    }
    
    // Process modifications
    if (migration.modifications.length > 0) {
      sections.push('-- MODIFICATIONS\n');
      for (const mod of migration.modifications) {
        sections.push(`-- File: ${mod.file}\n`);
        
        // Try to intelligently generate ALTER statements
        const alterStatements = this.generateAlterStatements(mod);
        if (alterStatements) {
          sections.push(alterStatements + '\n\n');
        } else {
          // Fallback to showing raw changes
          if (mod.removed) {
            sections.push('-- Removed:\n-- ' + mod.removed.replace(/\n/g, '\n-- ') + '\n');
          }
          if (mod.added) {
            sections.push('-- Added:\n' + mod.added + '\n\n');
          }
        }
      }
    }
    
    // Process deletions
    if (migration.deletions.length > 0 && this.config.includeDropStatements) {
      sections.push('-- DELETIONS\n');
      for (const del of migration.deletions) {
        sections.push(`-- File: ${del.file}\n`);
        sections.push(`-- WARNING: Manual review required for DROP statements\n`);
        sections.push(`-- ${del.removed.replace(/\n/g, '\n-- ')}\n\n`);
      }
    }
    
    // Footer
    sections.push(`-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- Total changes: ${migration.changes.length}
-- ═══════════════════════════════════════════════════════════════════════════
`);
    
    return sections.join('');
  }

  /**
   * Try to generate ALTER statements from modifications
   * This is a simplified version - real implementation would need SQL parsing
   */
  generateAlterStatements(modification) {
    const added = modification.added;
    const removed = modification.removed;
    
    // Look for table modifications
    if (added.includes('ALTER TABLE') || removed.includes('CREATE TABLE')) {
      // Already has ALTER statements
      return added;
    }
    
    // Look for column additions
    const columnMatch = added.match(/^\s+(\w+)\s+(\w+.*),?$/m);
    if (columnMatch) {
      const tableMatch = modification.file.match(/(\w+)\.sql$/);
      if (tableMatch) {
        return `ALTER TABLE ${tableMatch[1]} ADD COLUMN ${columnMatch[1]} ${columnMatch[2]};`;
      }
    }
    
    // For complex changes, return null to use fallback
    return null;
  }

  /**
   * Get the last generated diff
   */
  getLastDiff() {
    return this.lastDiff;
  }

  /**
   * Check if diff generation is running
   */
  isGenerating() {
    return this.isRunning;
  }
}

module.exports = DiffEngine;