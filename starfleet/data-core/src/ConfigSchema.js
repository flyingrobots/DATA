/**
 * Configuration schema definitions and validation logic
 * Pure configuration structure definitions without environment variable reads
 */

import { safeParsedataConfig, mergeConfigs } from './schemas/DataConfigSchema.js';

/**
 * Configuration schema and validation utilities
 * Does not read environment variables - that's handled by the host layer
 */
export class ConfigSchema {
  constructor() {
    // Default configuration structure (no env vars)
    this.defaultStructure = {
      environments: {
        local: {
          db: 'postgresql://postgres:postgres@127.0.0.1:54332/postgres',
          supabase_url: null,
          supabase_anon_key: null,
          supabase_service_role_key: null
        }
      },
      paths: {
        sql_dir: './sql',
        tests_dir: './tests',
        migrations_dir: './migrations',
        functions_dir: './functions',
        schemas_dir: './schemas'
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
  }

  /**
   * Get default configuration structure
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Default configuration with overrides applied
   */
  getDefaultConfig(overrides = {}) {
    return this.merge(this.defaultStructure, overrides);
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validate(config) {
    const result = safeParsedataConfig(config);
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return { valid: true, data: result.data };
  }

  /**
   * Deep merge configuration objects
   * @param {Object} base - Base configuration
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Merged configuration
   */
  merge(base, overrides) {
    if (!overrides || typeof overrides !== 'object') {
      return { ...base };
    }

    const result = { ...base };

    for (const key in overrides) {
      if (typeof overrides[key] === 'object' &&
          !Array.isArray(overrides[key]) &&
          overrides[key] !== null) {
        result[key] = this.merge(base[key] || {}, overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }

    return result;
  }

  /**
   * Extract configuration value by path
   * @param {Object} config - Configuration object
   * @param {string} path - Dot-separated path (e.g., 'test.minimum_coverage')
   * @returns {*} Configuration value or undefined
   */
  getValue(config, path) {
    if (!config || !path) return undefined;

    const keys = path.split('.');
    let value = config;

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
   * Set configuration value by path
   * @param {Object} config - Configuration object to modify
   * @param {string} path - Dot-separated path
   * @param {*} value - Value to set
   * @returns {Object} Modified configuration object
   */
  setValue(config, path, value) {
    if (!config || !path) return config;

    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = config;

    // Navigate to the parent object
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    target[lastKey] = value;
    return config;
  }

  /**
   * Get test configuration from full config
   * @param {Object} config - Full configuration object
   * @returns {Object} Test configuration section
   */
  getTestConfig(config) {
    return this.getValue(config, 'test') || this.defaultStructure.test;
  }

  /**
   * Get environment configuration
   * @param {Object} config - Full configuration object
   * @param {string} environmentName - Environment name (e.g., 'local', 'prod')
   * @returns {Object} Environment configuration
   */
  getEnvironmentConfig(config, environmentName = 'local') {
    const envs = this.getValue(config, 'environments') || {};
    return envs[environmentName] || this.defaultStructure.environments.local;
  }

  /**
   * Get paths configuration
   * @param {Object} config - Full configuration object
   * @returns {Object} Paths configuration
   */
  getPathsConfig(config) {
    return this.getValue(config, 'paths') || this.defaultStructure.paths;
  }

  /**
   * Get safety configuration
   * @param {Object} config - Full configuration object
   * @returns {Object} Safety configuration
   */
  getSafetyConfig(config) {
    return this.getValue(config, 'safety') || this.defaultStructure.safety;
  }

  /**
   * Validate and merge configurations using schema
   * @param {Object} baseConfig - Base configuration
   * @param {Object} overrideConfig - Override configuration
   * @returns {Object} Merged and validated configuration
   */
  mergeAndValidate(baseConfig, overrideConfig) {
    try {
      return mergeConfigs(baseConfig, overrideConfig);
    } catch (error) {
      throw new Error(`Configuration merge failed: ${error.message}`);
    }
  }

  /**
   * Create configuration template
   * @param {Object} customValues - Custom values to include
   * @returns {Object} Configuration template
   */
  createTemplate(customValues = {}) {
    const template = {
      $schema: './datarc.schema.json',
      ...this.getDefaultConfig(customValues)
    };

    // Add helpful comments structure
    template._comments = {
      environments: 'Database connection settings for different environments',
      paths: 'File system paths for SQL, tests, migrations, etc.',
      test: 'Test execution and coverage settings',
      safety: 'Production safety gate configurations'
    };

    return template;
  }

  /**
   * Check if configuration has required fields
   * @param {Object} config - Configuration to check
   * @returns {Object} Check result with missing fields
   */
  checkRequiredFields(config) {
    const required = [
      'environments',
      'paths'
    ];

    const missing = [];

    for (const field of required) {
      if (!this.getValue(config, field)) {
        missing.push(field);
      }
    }

    // Check for at least one environment
    const envs = this.getValue(config, 'environments');
    if (envs && Object.keys(envs).length === 0) {
      missing.push('environments (at least one environment required)');
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}

export default ConfigSchema;
