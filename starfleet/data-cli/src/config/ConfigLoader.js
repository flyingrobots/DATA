/**
 * Configuration management for data CLI
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { safeParsedataConfig, mergeConfigs } from './schemas/dataConfigSchema.js';

/**
 * Configuration class for data CLI
 */
class Config {
  constructor(data = null, envVars = null) {
    // Use provided environment variables or process.env as fallback
    this.envVars = envVars || process.env;
    // Use provided data or defaults
    this.data = data || this.getDefaultConfig();
  }

  /**
   * Get default configuration with environment variables
   */
  getDefaultConfig() {
    // Build config with environment variable defaults
    const config = {
      environments: {
        local: {
          db:
            this.envVars.DATABASE_URL ||
            this.envVars.data_DATABASE_URL ||
            'postgresql://postgres:postgres@127.0.0.1:54332/postgres',
          supabase_url: this.envVars.SUPABASE_URL || this.envVars.data_SUPABASE_URL,
          supabase_anon_key: this.envVars.SUPABASE_ANON_KEY || this.envVars.data_ANON_KEY,
          supabase_service_role_key:
            this.envVars.SUPABASE_SERVICE_ROLE_KEY || this.envVars.data_SERVICE_ROLE_KEY
        }
      },
      paths: {
        sql_dir: this.envVars.data_SQL_DIR || './sql',
        tests_dir: this.envVars.data_TESTS_DIR || './tests',
        migrations_dir: this.envVars.data_MIGRATIONS_DIR || './migrations',
        functions_dir: this.envVars.data_FUNCTIONS_DIR || './functions',
        schemas_dir: this.envVars.data_SCHEMAS_DIR || './schemas'
      },
      test: {
        minimum_coverage: 80,
        test_timeout: 300,
        output_formats: ['console', 'json']
      },
      safety: {
        require_prod_flag: true,
        require_confirmation: true
      }
    };

    // Add prod environment if variables are present
    if (this.envVars.PROD_DATABASE_URL || this.envVars.PROD_SUPABASE_URL) {
      config.environments.prod = {
        db: this.envVars.PROD_DATABASE_URL || '',
        supabase_url: this.envVars.PROD_SUPABASE_URL,
        supabase_anon_key: this.envVars.PROD_SUPABASE_ANON_KEY,
        supabase_service_role_key: this.envVars.PROD_SUPABASE_SERVICE_ROLE_KEY
      };
    }

    return config;
  }

  /**
   * Load configuration from file or defaults
   */
  static async load(configPath = null, envVars = null) {
    // Determine config file paths to check
    const paths = [
      configPath,
      path.join(process.cwd(), '.datarc.json'),
      path.join(process.cwd(), '.datarc'),
      path.join(os.homedir(), '.datarc.json'),
      path.join(os.homedir(), '.datarc')
    ].filter(Boolean);

    // Try to load config from each path
    const configPromises = paths.map(async (configFile) => {
      try {
        const content = await fs.readFile(configFile, 'utf8');
        const rawConfig = JSON.parse(content);

        // Create new Config with defaults
        const config = new Config(null, envVars);
        const defaults = config.getDefaultConfig();

        // Validate and merge with Zod
        const parseResult = safeParsedataConfig(rawConfig);
        if (parseResult.success) {
          // Merge validated config with defaults
          config.data = mergeConfigs(defaults, parseResult.data);
        } else {
          // Log validation errors but use what we can
          console.warn(`Configuration validation warnings in ${configFile}:`);
          parseResult.error.errors.forEach((err) => {
            console.warn(`  - ${err.path.join('.')}: ${err.message}`);
          });
          // Fall back to manual merge for partial configs
          config.data = config.merge(defaults, rawConfig);
        }

        return config;
      } catch {
        // Continue to next path
        return null;
      }
    });

    const configs = await Promise.all(configPromises);
    const validConfig = configs.find((config) => config !== null);

    if (validConfig) {
      return validConfig;
    }

    // Return default config if no file found
    return new Config(null, envVars);
  }

  /**
   * Deep merge configuration objects (fallback for invalid configs)
   */
  merge(defaults, overrides) {
    const result = { ...defaults };

    for (const key in overrides) {
      if (
        typeof overrides[key] === 'object' &&
        !Array.isArray(overrides[key]) &&
        overrides[key] !== null
      ) {
        result[key] = this.merge(defaults[key] || {}, overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }

    return result;
  }

  /**
   * Get environment configuration
   */
  getEnvironment(isProd = false) {
    return isProd ? this.data.environments.prod : this.data.environments.local;
  }

  /**
   * Save configuration to file
   */
  async save(configPath = null) {
    const filePath = configPath || path.join(process.cwd(), '.datarc.json');

    // Validate before saving
    const parseResult = safeParsedataConfig(this.data);
    if (!parseResult.success) {
      throw new Error(`Cannot save invalid configuration: ${parseResult.error.message}`);
    }

    // Add schema reference for IDE support
    const configWithSchema = {
      $schema: './datarc.schema.json',
      ...parseResult.data
    };

    const content = JSON.stringify(configWithSchema, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Get a configuration value by path
   */
  get(path) {
    const keys = path.split('.');
    let value = this.data;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a configuration value by path
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.data;

    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    target[lastKey] = value;
  }

  /**
   * Get test configuration
   */
  getTestConfig() {
    return this.get('test') || {};
  }

  /**
   * Validate entire configuration
   */
  validate() {
    const result = safeParsedataConfig(this.data);
    if (!result.success) {
      return { valid: false, errors: result.error.errors };
    }
    return { valid: true, data: result.data };
  }
}

export default Config;
