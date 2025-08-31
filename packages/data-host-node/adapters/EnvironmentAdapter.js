import { EnvironmentPort } from '../../data-core/ports/index.js';

/**
 * Node.js implementation of the Environment port.
 * Wraps process.env and related APIs to provide standardized environment access.
 * 
 * @class EnvironmentAdapter
 */
export class EnvironmentAdapter extends EnvironmentPort {
  /**
   * Create a new EnvironmentAdapter instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.defaults={}] - Default environment variables
   * @param {string} [options.prefix=''] - Prefix for scoped variable access
   * @param {boolean} [options.caseSensitive=true] - Case sensitive variable names
   */
  constructor(options = {}) {
    super();
    this.defaults = options.defaults || {};
    this.prefix = options.prefix || '';
    this.caseSensitive = options.caseSensitive !== false;
    this._cache = new Map();
  }

  /**
   * Get an environment variable value.
   * 
   * @param {string} key - Environment variable name
   * @param {string} [defaultValue] - Default value if not found
   * @returns {string|undefined} Environment variable value
   */
  get(key, defaultValue) {
    const normalizedKey = this._normalizeKey(key);
    const cacheKey = `get:${normalizedKey}`;
    
    if (this._cache.has(cacheKey)) {
      const cached = this._cache.get(cacheKey);
      return cached !== undefined ? cached : defaultValue;
    }

    const value = process.env[normalizedKey] || this.defaults[key] || this.defaults[normalizedKey];
    this._cache.set(cacheKey, value);
    
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set an environment variable value.
   * 
   * @param {string} key - Environment variable name
   * @param {string} value - Value to set
   * @returns {boolean} True if value was set successfully
   */
  set(key, value) {
    try {
      const normalizedKey = this._normalizeKey(key);
      process.env[normalizedKey] = String(value);
      
      // Clear cache for this key
      this._cache.delete(`get:${normalizedKey}`);
      this._cache.delete(`has:${normalizedKey}`);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if an environment variable exists.
   * 
   * @param {string} key - Environment variable name
   * @returns {boolean} True if variable exists
   */
  has(key) {
    const normalizedKey = this._normalizeKey(key);
    const cacheKey = `has:${normalizedKey}`;
    
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const exists = normalizedKey in process.env || 
                   key in this.defaults || 
                   normalizedKey in this.defaults;
    
    this._cache.set(cacheKey, exists);
    return exists;
  }

  /**
   * Delete an environment variable.
   * 
   * @param {string} key - Environment variable name
   * @returns {boolean} True if variable was deleted
   */
  delete(key) {
    try {
      const normalizedKey = this._normalizeKey(key);
      const existed = normalizedKey in process.env;
      
      delete process.env[normalizedKey];
      
      // Clear cache for this key
      this._cache.delete(`get:${normalizedKey}`);
      this._cache.delete(`has:${normalizedKey}`);
      
      return existed;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all environment variables with optional prefix filtering.
   * 
   * @param {string} [prefix] - Filter by prefix (uses instance prefix if not provided)
   * @returns {Object} Object containing matching environment variables
   */
  getAll(prefix) {
    const filterPrefix = prefix !== undefined ? prefix : this.prefix;
    const result = {};
    
    // Get from process.env
    for (const [key, value] of Object.entries(process.env)) {
      if (!filterPrefix || key.startsWith(filterPrefix)) {
        const displayKey = filterPrefix ? key.slice(filterPrefix.length) : key;
        result[displayKey] = value;
      }
    }
    
    // Merge defaults
    for (const [key, value] of Object.entries(this.defaults)) {
      const prefixedKey = filterPrefix ? `${filterPrefix}${key}` : key;
      const displayKey = filterPrefix && key.startsWith(filterPrefix) ? key.slice(filterPrefix.length) : key;
      
      if (!filterPrefix || prefixedKey.startsWith(filterPrefix)) {
        if (!(prefixedKey in process.env)) {
          result[displayKey] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Get environment variable as specific type.
   * 
   * @param {string} key - Environment variable name
   * @param {'string'|'number'|'boolean'|'json'} type - Target type
   * @param {*} [defaultValue] - Default value if not found or conversion fails
   * @returns {*} Typed environment variable value
   * @throws {EnvironmentError} When type conversion fails and no default provided
   */
  getTyped(key, type, defaultValue) {
    const value = this.get(key);
    
    if (value === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      throw this._createError(`Environment variable "${key}" not found`, key);
    }

    try {
      switch (type) {
        case 'string':
          return String(value);
          
        case 'number': {
          const num = Number(value);
          if (isNaN(num)) throw new Error(`Cannot convert "${value}" to number`);
          return num;
        }
        
        case 'boolean': {
          const lower = String(value).toLowerCase();
          if (['true', '1', 'yes', 'on'].includes(lower)) return true;
          if (['false', '0', 'no', 'off', ''].includes(lower)) return false;
          throw new Error(`Cannot convert "${value}" to boolean`);
        }
        
        case 'json':
          return JSON.parse(value);
          
        default:
          throw new Error(`Unsupported type: ${type}`);
      }
    } catch (error) {
      if (defaultValue !== undefined) return defaultValue;
      throw this._createError(
        `Failed to convert environment variable "${key}" to ${type}: ${error.message}`,
        key,
        error
      );
    }
  }

  /**
   * Get required environment variable (throws if not found).
   * 
   * @param {string} key - Environment variable name
   * @param {'string'|'number'|'boolean'|'json'} [type='string'] - Target type
   * @returns {*} Environment variable value
   * @throws {EnvironmentError} When variable not found or conversion fails
   */
  getRequired(key, type = 'string') {
    if (!this.has(key)) {
      throw this._createError(`Required environment variable "${key}" not found`, key);
    }
    
    return this.getTyped(key, type);
  }

  /**
   * Expand environment variables in a string (${VAR} or $VAR syntax).
   * 
   * @param {string} template - Template string with variables
   * @param {Object} [options] - Expansion options
   * @param {boolean} [options.throwOnMissing=false] - Throw if variable not found
   * @returns {string} Expanded string
   * @throws {EnvironmentError} When variable not found and throwOnMissing is true
   */
  expand(template, options = {}) {
    const throwOnMissing = options.throwOnMissing || false;
    
    return String(template).replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, braced, unbraced) => {
      const varName = braced || unbraced;
      const value = this.get(varName);
      
      if (value === undefined) {
        if (throwOnMissing) {
          throw this._createError(`Environment variable "${varName}" not found during expansion`, varName);
        }
        return match; // Return original if not found and not throwing
      }
      
      return value;
    });
  }

  /**
   * Clear internal cache.
   * 
   * @returns {number} Number of cached items cleared
   */
  clearCache() {
    const size = this._cache.size;
    this._cache.clear();
    return size;
  }

  /**
   * Get current platform information.
   * 
   * @returns {PlatformInfo} Platform and process information
   */
  getPlatformInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      execPath: process.execPath,
      nodeEnv: this.get('NODE_ENV', 'development'),
      isProduction: this.get('NODE_ENV') === 'production',
      isDevelopment: this.get('NODE_ENV') === 'development',
      isTest: this.get('NODE_ENV') === 'test'
    };
  }

  /**
   * Normalize environment variable key based on configuration.
   * 
   * @private
   * @param {string} key - Original key
   * @returns {string} Normalized key
   */
  _normalizeKey(key) {
    let normalized = this.prefix ? `${this.prefix}${key}` : key;
    
    if (!this.caseSensitive) {
      normalized = normalized.toUpperCase();
    }
    
    return normalized;
  }

  /**
   * Create normalized environment error.
   * 
   * @private
   * @param {string} message - Error message
   * @param {string} key - Environment variable key
   * @param {Error} [originalError] - Original error if any
   * @returns {EnvironmentError} Normalized error
   */
  _createError(message, key, originalError = null) {
    const error = new Error(message);
    error.name = 'EnvironmentError';
    error.key = key;
    error.originalError = originalError;
    
    return error;
  }
}