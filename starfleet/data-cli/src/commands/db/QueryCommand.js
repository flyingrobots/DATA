/**
 * Database Query Command
 */

import { promises as fs } from 'fs';
import { Client } from 'pg';
import DatabaseCommand from '../../lib/DatabaseCommand.js';

/**
 * Execute SQL queries against the database
 * @class
 */
class QueryCommand extends DatabaseCommand {
  constructor(databaseUrl, serviceRoleKey = null, anonKey = null, logger = null, isProd = false) {
    // Query command modifies data, so requires confirmation
    super(databaseUrl, serviceRoleKey, anonKey, logger, isProd, true);
    this.sql = null;
    this.isFile = false;
  }

  /**
   * Override production confirmation for destructive queries
   */
  async confirmProduction() {
    // Get SQL content first
    const sqlContent = await this.getSqlContent(this.sql, this.isFile);

    // If not destructive, skip confirmation
    if (!this.isDestructive(sqlContent)) {
      return true;
    }

    // Show warning for destructive query
    this.warn('Potentially destructive query detected in production!', {
      query: sqlContent.substring(0, 200) + (sqlContent.length > 200 ? '...' : '')
    });

    return this.confirm(
      'Are you sure you want to execute this query in PRODUCTION?'
    );
  }

  /**
   * Execute a SQL query
   */
  async performExecute(sql, isFile = false) {
    this.sql = sql;
    this.isFile = isFile;
    this.emit('start', { isProd: this.isProd, isFile });

    try {
      // Get SQL content
      const sqlContent = await this.getSqlContent(sql, isFile);

      // Execute query
      const result = await this.executeQuery(sqlContent);
      this.emit('result', { result });
      this.success(`Query executed successfully (${result.rowCount} rows affected)`);
      this.emit('complete', { result });
      return result;
    } catch (error) {
      this.error('Query execution failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }

  /**
   * Get SQL content from string or file
   */
  async getSqlContent(sql, isFile) {
    if (isFile) {
      this.progress(`Reading SQL from file: ${sql}`);
      return fs.readFile(sql, 'utf8');
    }
    return sql;
  }

  /**
   * Check if SQL is potentially destructive
   */
  isDestructive(sql) {
    const destructivePatterns = [
      /\bDROP\s+/i,
      /\bDELETE\s+FROM/i,
      /\bTRUNCATE\s+/i,
      /\bALTER\s+TABLE\s+.*\s+DROP/i,
      /\bUPDATE\s+.*\s+SET/i
    ];

    return destructivePatterns.some(pattern => pattern.test(sql));
  }

  /**
   * Execute the SQL query
   */
  async executeQuery(sql) {
    const env = this.config.getEnvironment(this.isProd);

    if (!env.db) {
      throw new Error(`Database connection string not configured for ${this.isProd ? 'production' : 'local'} environment`);
    }

    const client = new Client({
      connectionString: env.db
    });

    try {
      this.progress('Connecting to database...');
      await client.connect();

      this.progress('Executing query...');
      const result = await client.query(sql);

      // Log result details
      this.logger.debug({
        rowCount: result.rowCount,
        fields: result.fields?.map(f => f.name),
        command: result.command
      }, 'Query executed');

      return result;
    } finally {
      await client.end();
    }
  }
}

export { QueryCommand };
export default QueryCommand;
