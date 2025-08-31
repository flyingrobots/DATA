import Command from './Command.js';

/**
 * DatabaseCommand - Base class for commands that interact with the database
 *
 * This class provides database connection handling for commands that need
 * to execute SQL queries or manage database state.
 */
/**
 * DatabaseCommand class
 * @class
 */
class DatabaseCommand extends Command {
  /**
   * Create a DatabaseCommand instance
   * @param {string} databaseUrl - PostgreSQL connection string
   * @param {string} serviceRoleKey - Supabase service role key (optional)
   * @param {string} anonKey - Supabase anon key (optional)
   * @param {Object} logger - Logger instance (optional)
   * @param {boolean} isProd - Whether running in production mode
   * @param {boolean} requiresConfirmation - Whether to require confirmation in production (default: true)
   */
  constructor(
    databaseUrl,
    serviceRoleKey = null,
    anonKey = null,
    logger = null,
    isProd = false,
    requiresConfirmation = true
  ) {
    // Call parent with minimal config
    super(null, logger, isProd, null);

    // Store database credentials
    this.databaseUrl = databaseUrl;
    this.serviceRoleKey = serviceRoleKey;
    this.anonKey = anonKey;

    // Set confirmation requirement based on params
    this.requiresProductionConfirmation = isProd && requiresConfirmation;

    // Database connection will be created on demand
    this.db = null;
  }

  /**
   * Get database connection (lazy initialization)
   * @returns {Object} Database connection
   */
  async getDatabase() {
    if (!this.db) {
      const { default: DatabaseUtils } = await import('./db-utils.js');
      this.db = await DatabaseUtils.createConnection(this.databaseUrl);
    }
    return this.db;
  }

  /**
   * Execute a SQL query
   * @param {string} sql - The SQL query to execute
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(sql, params = []) {
    const db = await this.getDatabase();
    return db.query(sql, params);
  }

  /**
   * Execute a SQL file
   * @param {string} filePath - Path to the SQL file
   * @returns {Promise<Object>} Query result
   */
  async executeFile(filePath) {
    const { promises: fs } = await import('fs');
    const sql = await fs.readFile(filePath, 'utf8');
    return this.query(sql);
  }

  /**
   * Clean up database connection
   */
  async cleanup() {
    if (this.db) {
      await this.db.end();
      this.db = null;
    }
  }

  /**
   * Override execute to ensure cleanup
   */
  async execute(...args) {
    try {
      return await super.execute(...args);
    } finally {
      await this.cleanup();
    }
  }
}

export { DatabaseCommand };
export default DatabaseCommand;
