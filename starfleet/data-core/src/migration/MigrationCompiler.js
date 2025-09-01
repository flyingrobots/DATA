/**
 * MigrationCompiler - Compiles Golden SQL from numbered directories
 *
 * Following Supa Fleet Directive 34.1 section 3 subsection 12:
 * SQL directories MUST follow strict numerical naming convention
 * to control compilation order (extensions first, etc.)
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Expected directory structure with internal ordering:
 * /sql/
 *   extensions/   -- PostgreSQL extensions (processed first)
 *   schemas/      -- Schema definitions
 *   types/        -- Custom types and enums
 *   tables/       -- Table definitions
 *   functions/    -- Stored procedures
 *   views/        -- Views and materialized views
 *   policies/     -- RLS policies
 *   triggers/     -- Triggers
 *   indexes/      -- Indexes
 *   data/         -- Seed data (processed last)
 */

// Internal processing order - ensures dependencies are resolved
const DIRECTORY_ORDER = [
  'extensions',
  'schemas',
  'types',
  'tables',
  'functions',
  'views',
  'policies',
  'triggers',
  'indexes',
  'data'
];
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

      // Process directories in dependency-resolved order
      const directories = await this.getOrderedDirectories();

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
   * Get directories in dependency-resolved order
   */
  async getOrderedDirectories() {
    const entries = await fs.readdir(this.config.sqlDir, { withFileTypes: true });

    // Get all directories
    const availableDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    // Order directories according to DIRECTORY_ORDER
    const orderedDirs = [];
    for (const dirName of DIRECTORY_ORDER) {
      if (availableDirs.includes(dirName)) {
        orderedDirs.push(dirName);
      }
    }

    // Add any directories not in our standard list (for custom directories)
    const customDirs = availableDirs.filter((dir) => !DIRECTORY_ORDER.includes(dir));
    if (customDirs.length > 0) {
      this.emit('warning', {
        message: `Found non-standard directories: ${customDirs.join(', ')}. These will be processed last.`,
        timestamp: new Date()
      });
      orderedDirs.push(...customDirs.sort());
    }

    if (orderedDirs.length === 0) {
      this.emit('warning', {
        message: 'No directories found. Looking for SQL files in root.',
        timestamp: new Date()
      });
      return ['']; // Process root directory
    }

    this.emit('progress', {
      message: `Processing ${orderedDirs.length} directories in order`,
      directories: orderedDirs,
      timestamp: new Date()
    });

    return orderedDirs;
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

export { MigrationCompiler };
