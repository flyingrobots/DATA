/**
 * MigrationCompiler - Compiles Golden SQL from numbered directories
 * 
 * Following Supa Fleet Directive 34.1 section 3 subsection 12:
 * SQL directories MUST follow strict numerical naming convention
 * to control compilation order (extensions first, etc.)
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

/**
 * Expected directory structure (from USS Purrfect Paws spec):
 * /sql/
 *   001_extensions/   -- PostgreSQL extensions
 *   002_schemas/      -- Schema definitions  
 *   003_types/        -- Custom types and enums
 *   004_tables/       -- Table definitions
 *   005_functions/    -- Stored procedures
 *   006_views/        -- Views and materialized views
 *   007_policies/     -- RLS policies
 *   008_triggers/     -- Triggers
 *   009_indexes/      -- Indexes
 *   010_data/         -- Seed data
 */
class MigrationCompiler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      sqlDir: config.sqlDir || './sql',
      outputDir: config.outputDir || './migrations',
      verbose: config.verbose || false,
      validateSql: config.validateSql !== false,
      includeComments: config.includeComments !== false,
      timestamp: config.timestamp || new Date()
    };
    
    // Statistics tracking
    this.stats = {
      filesProcessed: 0,
      linesWritten: 0,
      startTime: null,
      endTime: null,
      directories: []
    };
    
    // State management
    this.isRunning = false;
    this.lastCompilation = null;
  }

  /**
   * Main compilation entry point
   */
  async compile() {
    if (this.isRunning) {
      throw new Error('Compilation already in progress');
    }
    
    this.isRunning = true;
    this.stats.startTime = new Date();
    
    this.emit('start', {
      timestamp: this.stats.startTime,
      config: this.config
    });
    
    try {
      // Validate SQL directory exists
      await this.validateSqlDirectory();
      
      // Ensure output directory exists
      await fs.mkdir(this.config.outputDir, { recursive: true });
      
      // Generate output filename
      const outputFile = this.generateOutputFilename();
      
      // Write header
      await this.writeHeader(outputFile);
      
      // Process numbered directories in order
      const directories = await this.getNumberedDirectories();
      
      for (const dir of directories) {
        await this.processDirectory(dir, outputFile);
      }
      
      // Write footer
      await this.writeFooter(outputFile);
      
      // Complete
      this.stats.endTime = new Date();
      const duration = this.stats.endTime - this.stats.startTime;
      
      const result = {
        success: true,
        outputFile,
        stats: this.stats,
        duration
      };
      
      this.lastCompilation = result;
      
      this.emit('complete', {
        result,
        timestamp: this.stats.endTime
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
   * Validate that SQL directory exists and has proper structure
   */
  async validateSqlDirectory() {
    try {
      const stat = await fs.stat(this.config.sqlDir);
      if (!stat.isDirectory()) {
        throw new Error(`SQL path is not a directory: ${this.config.sqlDir}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`SQL directory not found: ${this.config.sqlDir}`);
      }
      throw error;
    }
  }

  /**
   * Get numbered directories in order
   */
  async getNumberedDirectories() {
    const entries = await fs.readdir(this.config.sqlDir, { withFileTypes: true });
    
    // Filter for directories that match pattern: 001_name, 002_name, etc.
    const numberedDirs = entries
      .filter(entry => entry.isDirectory())
      .filter(entry => /^\d{3}_/.test(entry.name))
      .map(entry => entry.name)
      .sort(); // Alphabetical sort works for 001, 002, etc.
    
    if (numberedDirs.length === 0) {
      this.emit('warning', {
        message: 'No numbered directories found. Looking for SQL files in root.',
        timestamp: new Date()
      });
      return ['']; // Process root directory
    }
    
    this.emit('progress', {
      message: `Found ${numberedDirs.length} numbered directories`,
      directories: numberedDirs,
      timestamp: new Date()
    });
    
    return numberedDirs;
  }

  /**
   * Process a single directory
   */
  async processDirectory(dirName, outputFile) {
    const fullPath = path.join(this.config.sqlDir, dirName);
    
    this.emit('directory:start', {
      directory: dirName || 'root',
      path: fullPath,
      timestamp: new Date()
    });
    
    // Find all SQL files in directory
    const pattern = path.join(fullPath, '**/*.sql');
    const sqlFiles = await glob(pattern);
    
    if (sqlFiles.length === 0) {
      this.emit('directory:skip', {
        directory: dirName,
        reason: 'No SQL files found',
        timestamp: new Date()
      });
      return;
    }
    
    // Sort files for consistent ordering
    sqlFiles.sort();
    
    // Write directory section header
    if (dirName) {
      const sectionHeader = `
-- ═══════════════════════════════════════════════════════════════════════════
-- Directory: ${dirName}
-- ═══════════════════════════════════════════════════════════════════════════

`;
      await fs.appendFile(outputFile, sectionHeader);
      this.stats.linesWritten += sectionHeader.split('\n').length;
    }
    
    // Process each SQL file
    for (const sqlFile of sqlFiles) {
      await this.processFile(sqlFile, outputFile);
    }
    
    this.stats.directories.push(dirName);
    
    this.emit('directory:complete', {
      directory: dirName,
      filesProcessed: sqlFiles.length,
      timestamp: new Date()
    });
  }

  /**
   * Process a single SQL file
   */
  async processFile(filePath, outputFile) {
    const relativePath = path.relative(this.config.sqlDir, filePath);
    
    this.emit('file:process', {
      file: relativePath,
      timestamp: new Date()
    });
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Write file header comment
      if (this.config.includeComments) {
        const fileHeader = `-- ───────────────────────────────────────────────────────────────────────────
-- File: ${relativePath}
-- ───────────────────────────────────────────────────────────────────────────
`;
        await fs.appendFile(outputFile, fileHeader);
        this.stats.linesWritten += fileHeader.split('\n').length;
      }
      
      // Write file content
      await fs.appendFile(outputFile, content);
      if (!content.endsWith('\n')) {
        await fs.appendFile(outputFile, '\n');
      }
      await fs.appendFile(outputFile, '\n'); // Extra newline between files
      
      this.stats.linesWritten += lines.length + 1;
      this.stats.filesProcessed++;
      
      this.emit('file:complete', {
        file: relativePath,
        lineCount: lines.length,
        timestamp: new Date()
      });
      
    } catch (error) {
      this.emit('file:error', {
        file: relativePath,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Generate output filename with timestamp
   */
  generateOutputFilename() {
    const timestamp = this.config.timestamp
      .toISOString()
      .replace(/[T:]/g, '')
      .replace(/\..+/, '')
      .replace(/-/g, '')
      .slice(0, 14);
    
    return path.join(this.config.outputDir, `${timestamp}_compiled.sql`);
  }

  /**
   * Write migration header
   */
  async writeHeader(outputFile) {
    const header = `-- ═══════════════════════════════════════════════════════════════════════════
-- GOLDEN SQL COMPILATION
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- 🖖 Generated by D.A.T.A. (Database Automation, Testing, and Alignment)
-- Following Supa Fleet Directive 34.1 section 3 subsection 12
-- 
-- DO NOT EDIT THIS FILE DIRECTLY
-- Edit source files in ${this.config.sqlDir}/ and recompile
-- 
-- Generated: ${new Date().toISOString()}
-- Source: Golden SQL from ${this.config.sqlDir}
-- ═══════════════════════════════════════════════════════════════════════════

`;
    
    await fs.writeFile(outputFile, header);
    this.stats.linesWritten += header.split('\n').length;
    
    this.emit('header:written', {
      outputFile,
      timestamp: new Date()
    });
  }

  /**
   * Write migration footer
   */
  async writeFooter(outputFile) {
    const footer = `
-- ═══════════════════════════════════════════════════════════════════════════
-- END OF COMPILATION
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Statistics:
-- Files processed: ${this.stats.filesProcessed}
-- Lines written: ${this.stats.linesWritten}
-- Directories: ${this.stats.directories.join(', ') || 'root'}
-- 
-- "The compilation is complete, Captain." - Lt. Commander Data
-- ═══════════════════════════════════════════════════════════════════════════
`;
    
    await fs.appendFile(outputFile, footer);
    this.stats.linesWritten += footer.split('\n').length;
    
    this.emit('footer:written', {
      timestamp: new Date()
    });
  }

  /**
   * Get last compilation result
   */
  getLastCompilation() {
    return this.lastCompilation;
  }

  /**
   * Check if compilation is running
   */
  isCompiling() {
    return this.isRunning;
  }
}

module.exports = MigrationCompiler;