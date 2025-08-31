const { Client } = require("pg");

/**
 * Database utility functions for temp database management
 */
class DatabaseUtils {
  constructor(baseConfig = {}) {
    this.baseConfig = {
      host: "localhost",
      port: 54332,
      user: "postgres",
      password: "postgres",
      ...baseConfig,
    };
  }

  /**
   * Create a PostgreSQL client for admin operations (no specific database)
   * @returns {Client} PostgreSQL client instance
   */
  createAdminClient() {
    return new Client({
      ...this.baseConfig,
      database: "postgres", // Connect to default postgres database
    });
  }

  /**
   * Create a PostgreSQL client for a specific database
   * @param {string} databaseName - Name of database to connect to
   * @returns {Client} PostgreSQL client instance
   */
  createDatabaseClient(databaseName) {
    return new Client({
      ...this.baseConfig,
      database: databaseName,
    });
  }

  /**
   * Generate unique temp database name
   * @param {string} suffix - Optional suffix for the database name
   * @returns {string} Unique database name
   */
  generateTempDatabaseName(suffix = "default") {
    const timestamp = Date.now();
    const cleanSuffix = suffix.replace(/[^a-zA-Z0-9_]/g, "_");
    return `temp_migra_${timestamp}_${cleanSuffix}`;
  }

  /**
   * Check if database exists
   * @param {string} databaseName - Name of database to check
   * @returns {Promise<boolean>} True if database exists
   */
  async databaseExists(databaseName) {
    const client = this.createAdminClient();

    try {
      await client.connect();

      const result = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [databaseName],
      );

      return result.rows.length > 0;
    } finally {
      await client.end();
    }
  }

  /**
   * Get connection string for a database
   * @param {string} databaseName - Name of the database
   * @returns {string} PostgreSQL connection string
   */
  getConnectionString(databaseName) {
    return `postgresql://${this.baseConfig.user}:${this.baseConfig.password}@${this.baseConfig.host}:${this.baseConfig.port}/${databaseName}`;
  }

  /**
   * Execute SQL safely on a database connection
   * @param {Client} client - PostgreSQL client
   * @param {string} sql - SQL to execute
   * @returns {Promise<Object>} Query result
   */
  async executeSql(client, sql) {
    // Split SQL into individual statements for better error handling
    const statements = this._splitSqlStatements(sql);
    const results = [];

    const queryPromises = statements
      .filter((statement) => statement.trim())
      .map((statement) => client.query(statement));

    const queryResults = await Promise.all(queryPromises);
    results.push(...queryResults);

    return {
      success: true,
      results,
      statementCount: queryResults.length,
    };
  }

  /**
   * Split SQL content into individual statements
   * @private
   * @param {string} sql - SQL content
   * @returns {string[]} Array of SQL statements
   */
  _splitSqlStatements(sql) {
    // Basic SQL statement splitting - handles most common cases
    // More sophisticated parsing could be added if needed
    return sql
      .split(/;\s*\n/)
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)
      .map((stmt) => (stmt.endsWith(";") ? stmt : stmt + ";"));
  }
}

module.exports = DatabaseUtils;
