import EventEmitter from 'events';
import DatabaseUtils from './db-utils.js';

/**
 * DiffEngine - Event-driven database schema difference generator
 *
 * Emits events:
 * - 'start': When diff generation begins
 * - 'progress': During processing with step information
 * - 'complete': When diff generation is finished
 * - 'error': When errors occur during processing
 */
class DiffEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    // Configuration with defaults
    this.config = {
      // Diff generation options
      includeData: false,
      excludeSchemas: ['information_schema', 'pg_catalog'],
      includeDropStatements: true,
      sortOutput: true,
      ...config
    };

    // Internal state
    this.isRunning = false;
    this.lastDiff = null;
    this.startTime = null;
    this.endTime = null;

    // Temp database management
    this.dbUtils = new DatabaseUtils();
    this.tempDatabases = new Set(); // Track temp databases for cleanup
  }

  /**
   * Generate schema differences between current and desired database states
   *
   * @param {Object} currentDb - Current database connection/state
   * @param {Object} desiredDb - Desired database connection/state
   * @param {Object} options - Override options for this diff operation
   * @returns {Promise<Object>} Diff result object
   */
  generateDiff(currentDb, desiredDb, options = {}) {
    if (this.isRunning) {
      throw new Error('DiffEngine is already running. Wait for current operation to complete.');
    }

    this.isRunning = true;
    this.startTime = new Date();
    this.lastDiff = null;

    try {
      // Merge runtime options with instance config
      const mergedOptions = { ...this.config, ...options };

      // Emit start event
      this.emit('start', {
        currentDb: this._sanitizeDbInfo(currentDb),
        desiredDb: this._sanitizeDbInfo(desiredDb),
        options: mergedOptions,
        timestamp: this.startTime
      });

      // Emit initial progress
      this.emit('progress', {
        step: 'initializing',
        message: 'Preparing diff generation',
        timestamp: new Date()
      });

      // Validate inputs
      this._validateDatabaseInputs(currentDb, desiredDb);

      this.emit('progress', {
        step: 'validation_complete',
        message: 'Database inputs validated',
        timestamp: new Date()
      });

      // TODO: Actual diff logic will be implemented in P1.T005
      // For now, return a placeholder result

      this.emit('progress', {
        step: 'analysis_complete',
        message: 'Schema analysis completed',
        timestamp: new Date()
      });

      // Placeholder diff result
      const diffResult = {
        hasDifferences: false,
        statements: [],
        metadata: {
          schemasAnalyzed: 0,
          tablesAnalyzed: 0,
          functionsAnalyzed: 0,
          generatedAt: new Date(),
          generationTimeMs: 0
        }
      };

      this.lastDiff = diffResult;
      this.endTime = new Date();
      diffResult.metadata.generationTimeMs = this.endTime - this.startTime;

      // Emit completion
      this.emit('complete', {
        diff: diffResult,
        duration: diffResult.metadata.generationTimeMs,
        timestamp: this.endTime
      });

      return diffResult;

    } catch (error) {
      this.endTime = new Date();

      // Emit error event
      this.emit('error', {
        error,
        message: error.message,
        stack: error.stack,
        duration: this.endTime - this.startTime,
        timestamp: this.endTime
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get the last generated diff result
   * @returns {Object|null} Last diff result or null if none generated
   */
  getLastDiff() {
    return this.lastDiff;
  }

  /**
   * Check if the engine is currently running
   * @returns {boolean} True if currently generating a diff
   */
  isGenerating() {
    return this.isRunning;
  }

  /**
   * Create a temporary database for schema operations
   * @param {string} suffix - Suffix for the database name (optional)
   * @returns {Promise<string>} Connection string for the created temp database
   */
  async createTempDatabase(suffix = 'default') {
    try {
      // Generate unique database name
      const dbName = this.dbUtils.generateTempDatabaseName(suffix);

      this.emit('progress', {
        step: 'temp_db_creating',
        message: `Creating temporary database: ${dbName}`,
        timestamp: new Date()
      });

      // Check if database already exists (shouldn't happen with timestamps, but safety first)
      const exists = await this.dbUtils.databaseExists(dbName);
      if (exists) {
        throw new Error(`Temporary database ${dbName} already exists`);
      }

      // Create the database
      const adminClient = this.dbUtils.createAdminClient();

      try {
        await adminClient.connect();

        // Use identifier to prevent SQL injection
        await adminClient.query(`CREATE DATABASE "${dbName}"`);

        // Track the temp database for cleanup
        this.tempDatabases.add(dbName);

        const connectionString = this.dbUtils.getConnectionString(dbName);

        this.emit('progress', {
          step: 'temp_db_created',
          message: `Temporary database created: ${dbName}`,
          database: dbName,
          connectionString,
          timestamp: new Date()
        });

        return connectionString;

      } finally {
        await adminClient.end();
      }

    } catch (error) {
      this.emit('error', {
        error,
        message: `Failed to create temporary database: ${error.message}`,
        operation: 'createTempDatabase',
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Clean up a temporary database
   * @param {string} dbName - Name of the database to clean up
   * @returns {Promise<boolean>} True if cleanup was successful
   */
  async cleanupTempDatabase(dbName) {
    try {
      this.emit('progress', {
        step: 'temp_db_cleanup',
        message: `Cleaning up temporary database: ${dbName}`,
        database: dbName,
        timestamp: new Date()
      });

      // Check if database exists before attempting cleanup
      const exists = await this.dbUtils.databaseExists(dbName);
      if (!exists) {
        this.emit('progress', {
          step: 'temp_db_not_found',
          message: `Database ${dbName} does not exist, skipping cleanup`,
          database: dbName,
          timestamp: new Date()
        });

        // Remove from tracking set regardless
        this.tempDatabases.delete(dbName);
        return true;
      }

      const adminClient = this.dbUtils.createAdminClient();

      try {
        await adminClient.connect();

        // Terminate all connections to the database first
        await adminClient.query(`
          SELECT pg_terminate_backend(pid) 
          FROM pg_stat_activity 
          WHERE datname = $1 AND pid <> pg_backend_pid()
        `, [dbName]);

        // Drop the database
        await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);

        // Remove from tracking set
        this.tempDatabases.delete(dbName);

        this.emit('progress', {
          step: 'temp_db_cleaned',
          message: `Temporary database cleaned up: ${dbName}`,
          database: dbName,
          timestamp: new Date()
        });

        return true;

      } finally {
        await adminClient.end();
      }

    } catch (error) {
      this.emit('error', {
        error,
        message: `Failed to cleanup temporary database ${dbName}: ${error.message}`,
        operation: 'cleanupTempDatabase',
        database: dbName,
        timestamp: new Date()
      });

      // Don't throw - cleanup should be non-fatal
      return false;
    }
  }

  /**
   * Apply SQL schema to a temporary database
   * @param {string} dbUrl - Database connection URL
   * @param {string} sqlContent - SQL content to apply
   * @returns {Promise<Object>} Result of schema application
   */
  async applySchemaToTemp(dbUrl, sqlContent) {
    if (!sqlContent || typeof sqlContent !== 'string') {
      throw new Error('SQL content must be a non-empty string');
    }

    // Extract database name from URL for logging
    const dbNameMatch = dbUrl.match(/\/([^/?]+)(?:\?|$)/);
    const dbName = dbNameMatch ? dbNameMatch[1] : 'unknown';

    try {
      this.emit('progress', {
        step: 'schema_applying',
        message: `Applying schema to database: ${dbName}`,
        database: dbName,
        sqlLength: sqlContent.length,
        timestamp: new Date()
      });

      // Parse database URL to get connection parameters
      const url = new globalThis.URL(dbUrl);
      const client = this.dbUtils.createDatabaseClient(url.pathname.slice(1));

      try {
        await client.connect();

        // Apply the SQL schema using our utility method
        const result = await this.dbUtils.executeSql(client, sqlContent);

        this.emit('progress', {
          step: 'schema_applied',
          message: `Schema applied successfully to: ${dbName}`,
          database: dbName,
          statementsExecuted: result.statementCount,
          timestamp: new Date()
        });

        return {
          success: true,
          database: dbName,
          statementsExecuted: result.statementCount,
          results: result.results
        };

      } finally {
        await client.end();
      }

    } catch (error) {
      this.emit('error', {
        error,
        message: `Failed to apply schema to ${dbName}: ${error.message}`,
        operation: 'applySchemaToTemp',
        database: dbName,
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Clean up all tracked temporary databases
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanupAllTempDatabases() {
    const summary = {
      attempted: 0,
      successful: 0,
      failed: 0,
      databases: []
    };

    this.emit('progress', {
      step: 'cleanup_all_starting',
      message: `Cleaning up ${this.tempDatabases.size} temporary databases`,
      count: this.tempDatabases.size,
      timestamp: new Date()
    });

    // Convert to array to avoid mutation during iteration
    const databasesToCleanup = Array.from(this.tempDatabases);

    // Process all cleanup operations in parallel
    const cleanupPromises = databasesToCleanup.map(async (dbName) => {
      summary.attempted++;
      summary.databases.push(dbName);

      try {
        const success = await this.cleanupTempDatabase(dbName);
        if (success) {
          summary.successful++;
        } else {
          summary.failed++;
        }
      } catch {
        summary.failed++;
      }
    });

    await Promise.all(cleanupPromises);

    this.emit('progress', {
      step: 'cleanup_all_complete',
      message: `Cleanup complete: ${summary.successful}/${summary.attempted} databases cleaned`,
      summary,
      timestamp: new Date()
    });

    return summary;
  }

  /**
   * Get list of currently tracked temporary databases
   * @returns {string[]} Array of temp database names
   */
  getTrackedTempDatabases() {
    return Array.from(this.tempDatabases);
  }

  /**
   * Validate database input parameters
   * @private
   */
  _validateDatabaseInputs(currentDb, desiredDb) {
    if (!currentDb || typeof currentDb !== 'object') {
      throw new Error('currentDb parameter must be a valid database connection object');
    }

    if (!desiredDb || typeof desiredDb !== 'object') {
      throw new Error('desiredDb parameter must be a valid database connection object');
    }
  }

  /**
   * Sanitize database info for logging (remove sensitive data)
   * @private
   */
  _sanitizeDbInfo(dbInfo) {
    if (!dbInfo) return null;

    return {
      host: dbInfo.host || 'unknown',
      port: dbInfo.port || 'unknown',
      database: dbInfo.database || 'unknown'
      // Never include passwords or sensitive connection info
    };
  }
}

export default DiffEngine;
