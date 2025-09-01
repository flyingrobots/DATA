/**
 * @fileoverview SupabaseCommand - Base class for commands that use Supabase API
 *
 * Replaces raw PostgreSQL connections with Supabase client for better
 * integration with modern PostgreSQL/Supabase ecosystems. Provides
 * automatic connection management, cleanup, and schema utilities.
 *
 * @module SupabaseCommand
 * @requires Command
 * @requires @supabase/supabase-js
 * @since 1.0.0
 */

import Command from './Command.js';
import { createClient } from '@supabase/supabase-js';

/**
 * @typedef {Object} SqlExecutionResult
 * @property {boolean} success - Whether SQL execution succeeded
 * @property {string} [error] - Error message if execution failed
 * @property {number} [rows_affected] - Number of rows affected by the operation
 */

/**
 * @typedef {Object} SchemaOperationOptions
 * @property {boolean} [cascade=true] - Whether to use CASCADE when dropping objects
 * @property {string} [schemaName] - Custom schema name for operations
 */

/**
 * Base class for commands that interact with Supabase/PostgreSQL databases.
 *
 * Extends the Command class with Supabase-specific functionality including
 * client management, RPC execution, schema operations, and automatic cleanup.
 * Uses lazy initialization for optimal resource usage.
 *
 * @class
 * @extends Command
 * @example
 * class MyDatabaseCommand extends SupabaseCommand {
 *   async performExecute() {
 *     const supabase = this.getSupabase();
 *     const { data } = await supabase.from('users').select('*');
 *     return data;
 *   }
 * }
 */
class SupabaseCommand extends Command {
  /**
   * Creates a new SupabaseCommand instance with credentials and configuration.
   *
   * Initializes Supabase connection parameters with fallback to environment variables.
   * Validates that at least one authentication key is available before proceeding.
   *
   * @param {string|null} [supabaseUrl=null] - Supabase project URL (falls back to SUPABASE_URL env var or localhost)
   * @param {string|null} [serviceRoleKey=null] - Service role key for admin operations (falls back to env var)
   * @param {Object|null} [logger=null] - Pino logger instance (optional)
   * @param {boolean} [isProd=false] - Whether running in production mode
   * @param {boolean} [requiresConfirmation=true] - Whether to require user confirmation in production
   * @throws {Error} When neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is available
   */
  constructor(
    supabaseUrl = null,
    serviceRoleKey = null,
    logger = null,
    isProd = false,
    requiresConfirmation = true
  ) {
    super(null, logger, isProd, null);

    // Get Supabase credentials from params or environment
    this.supabaseUrl = supabaseUrl || process.env.SUPABASE_URL || 'http://localhost:54321';
    this.serviceRoleKey = serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.anonKey = process.env.SUPABASE_ANON_KEY;

    // Validate we have necessary credentials
    if (!this.serviceRoleKey && !this.anonKey) {
      throw new Error('Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required');
    }

    // Set confirmation requirement
    this.requiresProductionConfirmation = isProd && requiresConfirmation;

    // Supabase client will be created on demand
    this.supabase = null;
  }

  /**
   * Gets or creates a Supabase client with lazy initialization.
   *
   * Creates the Supabase client on first access with appropriate authentication
   * key based on the useServiceRole parameter. Configures client for optimal
   * CLI usage with disabled session persistence and auto-refresh.
   *
   * @param {boolean} [useServiceRole=true] - Whether to use service role key (admin) or anon key (read-only)
   * @returns {Object} Configured Supabase client instance
   * @throws {Error} When required authentication key is not configured
   * @example
   * // Get admin client for DDL operations
   * const supabase = this.getSupabase(true);
   *
   * // Get read-only client for queries
   * const supabase = this.getSupabase(false);
   */
  getSupabase(useServiceRole = true) {
    if (!this.supabase) {
      const key = useServiceRole ? this.serviceRoleKey : this.anonKey;

      if (!key) {
        throw new Error(`${useServiceRole ? 'Service role' : 'Anon'} key not configured`);
      }

      this.supabase = createClient(this.supabaseUrl, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        db: {
          schema: 'public'
        }
      });

      this.progress('Supabase client initialized');
    }
    return this.supabase;
  }

  /**
   * Execute arbitrary SQL using Supabase RPC
   * Requires an exec_sql function in your database:
   *
   * CREATE OR REPLACE FUNCTION exec_sql(sql text)
   * RETURNS json
   * LANGUAGE plpgsql
   * SECURITY DEFINER
   * AS $$
   * DECLARE
   *   result json;
   * BEGIN
   *   EXECUTE sql;
   *   GET DIAGNOSTICS result = ROW_COUNT;
   *   RETURN json_build_object('success', true, 'rows_affected', result);
   * EXCEPTION
   *   WHEN OTHERS THEN
   *     RETURN json_build_object('success', false, 'error', SQLERRM);
   * END;
   * $$;
   */
  async executeSql(sql) {
    const supabase = this.getSupabase(true); // Need service role for DDL

    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }

    if (data && !data.success) {
      throw new Error(`SQL error: ${data.error}`);
    }

    return data;
  }

  /**
   * Executes a PostgreSQL RPC (Remote Procedure Call) function.
   *
   * Calls a stored procedure or function in the database through Supabase RPC interface.
   * Automatically handles authentication and error processing.
   *
   * @param {string} functionName - Name of the PostgreSQL function to call
   * @param {Object} [params={}] - Parameters to pass to the function as key-value pairs
   * @param {boolean} [useServiceRole=false] - Whether to use service role for admin functions
   * @returns {Promise<*>} Function return value (type depends on the PostgreSQL function)
   * @throws {Error} When RPC call fails or function returns error
   * @example
   * // Call a custom function with parameters
   * const result = await this.rpc('get_user_stats', { user_id: 123 });
   *
   * // Call admin function with service role
   * const result = await this.rpc('admin_cleanup', {}, true);
   */
  async rpc(functionName, params = {}, useServiceRole = false) {
    const supabase = this.getSupabase(useServiceRole);

    const { data, error } = await supabase.rpc(functionName, params);

    if (error) {
      throw new Error(`RPC ${functionName} failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Query a table using Supabase client
   * @param {string} table - Table name
   * @returns {Object} Supabase query builder
   */
  from(table) {
    const supabase = this.getSupabase();
    return supabase.from(table);
  }

  /**
   * Clean up Supabase connection
   */
  async cleanup() {
    if (this.supabase) {
      try {
        // Sign out if authenticated
        await this.supabase.auth.signOut();

        // Remove all realtime channels
        this.supabase.removeAllChannels();

        this.progress('Supabase client cleaned up');
      } catch (error) {
        this.warn(`Cleanup warning: ${error.message}`);
      }

      this.supabase = null;
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

  /**
   * Helper to create a temporary schema for testing
   * @param {string} schemaName - Name for the schema (optional)
   * @returns {Promise<string>} Created schema name
   */
  async createTempSchema(schemaName = null) {
    const name = schemaName || `"@data.temp.${Math.floor(Date.now() / 1000)}"`;

    await this.executeSql(`CREATE SCHEMA IF NOT EXISTS ${name}`);
    this.success(`Created temporary schema: ${name}`);

    return name;
  }

  /**
   * Helper to drop a schema
   * @param {string} schemaName - Name of schema to drop
   * @param {boolean} cascade - Use CASCADE (default: true)
   */
  async dropSchema(schemaName, cascade = true) {
    const cascadeClause = cascade ? 'CASCADE' : '';

    await this.executeSql(`DROP SCHEMA IF EXISTS ${schemaName} ${cascadeClause}`);
    this.success(`Dropped schema: ${schemaName}`);
  }

  /**
   * Check if we have exec_sql function available
   * @returns {Promise<boolean>} True if exec_sql exists
   */
  async hasExecSqlFunction() {
    try {
      const supabase = this.getSupabase(true);
      const { error } = await supabase.rpc('exec_sql', {
        sql: 'SELECT 1'
      });

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Install exec_sql function if needed
   * This allows arbitrary SQL execution via RPC
   */
  async ensureExecSqlFunction() {
    if (await this.hasExecSqlFunction()) {
      return;
    }

    this.warn('exec_sql function not found. You need to add it to your migrations:');
    this.warn(`
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_json json;
BEGIN
  EXECUTE sql;
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
    `);

    throw new Error('exec_sql function required for DDL operations');
  }
}

export { SupabaseCommand };
export default SupabaseCommand;
