/**
 * SupabaseCommand - Base class for commands that use Supabase API
 *
 * Replaces raw PostgreSQL connections with Supabase client
 * Provides automatic connection management and cleanup
 */

const Command = require("./Command");
const { createClient } = require("@supabase/supabase-js");

class SupabaseCommand extends Command {
  /**
   * Create a SupabaseCommand instance
   * @param {string} supabaseUrl - Supabase project URL (optional, uses env var)
   * @param {string} serviceRoleKey - Service role key for admin operations (optional, uses env var)
   * @param {Object} logger - Logger instance (optional)
   * @param {boolean} isProd - Whether running in production mode
   * @param {boolean} requiresConfirmation - Whether to require confirmation in production (default: true)
   */
  constructor(
    supabaseUrl = null,
    serviceRoleKey = null,
    logger = null,
    isProd = false,
    requiresConfirmation = true,
  ) {
    super(null, logger, isProd, null);

    // Get Supabase credentials from params or environment
    this.supabaseUrl =
      supabaseUrl || process.env.SUPABASE_URL || "http://localhost:54321";
    this.serviceRoleKey =
      serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.anonKey = process.env.SUPABASE_ANON_KEY;

    // Validate we have necessary credentials
    if (!this.serviceRoleKey && !this.anonKey) {
      throw new Error(
        "Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required",
      );
    }

    // Set confirmation requirement
    this.requiresProductionConfirmation = isProd && requiresConfirmation;

    // Supabase client will be created on demand
    this.supabase = null;
  }

  /**
   * Get Supabase client (lazy initialization)
   * @param {boolean} useServiceRole - Use service role key (default: true)
   * @returns {Object} Supabase client
   */
  getSupabase(useServiceRole = true) {
    if (!this.supabase) {
      const key = useServiceRole ? this.serviceRoleKey : this.anonKey;

      if (!key) {
        throw new Error(
          `${useServiceRole ? "Service role" : "Anon"} key not configured`,
        );
      }

      this.supabase = createClient(this.supabaseUrl, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: "public",
        },
      });

      this.progress("Supabase client initialized");
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

    const { data, error } = await supabase.rpc("exec_sql", { sql });

    if (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }

    if (data && !data.success) {
      throw new Error(`SQL error: ${data.error}`);
    }

    return data;
  }

  /**
   * Call an RPC function
   * @param {string} functionName - Name of the RPC function
   * @param {Object} params - Parameters to pass to the function
   * @param {boolean} useServiceRole - Use service role key (default: false for RPC)
   * @returns {Promise<Object>} RPC result
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

        this.progress("Supabase client cleaned up");
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
    const cascadeClause = cascade ? "CASCADE" : "";

    await this.executeSql(
      `DROP SCHEMA IF EXISTS ${schemaName} ${cascadeClause}`,
    );
    this.success(`Dropped schema: ${schemaName}`);
  }

  /**
   * Check if we have exec_sql function available
   * @returns {Promise<boolean>} True if exec_sql exists
   */
  async hasExecSqlFunction() {
    try {
      const supabase = this.getSupabase(true);
      const { error } = await supabase.rpc("exec_sql", {
        sql: "SELECT 1",
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

    this.warn(
      "exec_sql function not found. You need to add it to your migrations:",
    );
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

    throw new Error("exec_sql function required for DDL operations");
  }
}

module.exports = SupabaseCommand;
