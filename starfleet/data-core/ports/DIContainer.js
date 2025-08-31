/**
 * Dependency Injection Container for data-core package.
 * Manages service registration, resolution, and lifecycle.
 * Supports constructor injection with automatic wiring.
 * 
 * @fileoverview Lightweight DI container with circular dependency detection
 */

/**
 * Service registration configuration
 * @typedef {Object} ServiceConfig
 * @property {boolean} singleton - Whether to create single instance (default: false)
 * @property {Array<string>} dependencies - Manual dependency specification
 * @property {Function} factory - Custom factory function
 * @property {Object} config - Configuration to pass to constructor
 */

/**
 * Dependency injection container with automatic wiring capabilities.
 * Manages service lifecycles and resolves constructor dependencies.
 */
export class DIContainer {
  constructor() {
    /** @type {Map<string, ServiceConfig & {constructor: Function, instance?: any}>} */
    this._services = new Map();
    
    /** @type {Set<string>} Currently resolving services for circular dependency detection */
    this._resolving = new Set();
    
    /** @type {Map<string, any>} Singleton instances cache */
    this._singletons = new Map();
  }

  /**
   * Register a service with the container.
   * 
   * @param {string} name - Service name/key
   * @param {Function} constructor - Service constructor function
   * @param {ServiceConfig} [config={}] - Registration configuration
   * @returns {DIContainer} This container for chaining
   * 
   * @example
   * ```javascript
   * container
   *   .register('fileSystem', FileSystemAdapter, { singleton: true })
   *   .register('dataCore', DataCore, { 
   *     dependencies: ['fileSystem', 'crypto', 'process', 'environment'] 
   *   });
   * ```
   */
  register(name, constructor, config = {}) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Service name must be a non-empty string');
    }
    
    // Allow null constructor if factory is provided
    if (!config.factory && typeof constructor !== 'function') {
      throw new Error('Service constructor must be a function');
    }

    this._services.set(name, {
      constructor,
      singleton: config.singleton || false,
      dependencies: config.dependencies || null,
      factory: config.factory || null,
      config: config.config || {}
    });

    return this;
  }

  /**
   * Register a singleton service (convenience method).
   * 
   * @param {string} name - Service name
   * @param {Function} constructor - Service constructor
   * @param {Object} [config={}] - Additional configuration
   * @returns {DIContainer} This container for chaining
   */
  registerSingleton(name, constructor, config = {}) {
    return this.register(name, constructor, { ...config, singleton: true });
  }

  /**
   * Register a factory function for creating services.
   * 
   * @param {string} name - Service name
   * @param {Function} factory - Factory function that returns service instance
   * @param {Object} [config={}] - Additional configuration
   * @returns {DIContainer} This container for chaining
   * 
   * @example
   * ```javascript
   * container.registerFactory('database', (container) => {
   *   const config = container.resolve('config');
   *   return new DatabaseConnection(config.connectionString);
   * });
   * ```
   */
  registerFactory(name, factory, config = {}) {
    if (typeof factory !== 'function') {
      throw new Error('Factory must be a function');
    }

    return this.register(name, null, { ...config, factory });
  }

  /**
   * Register an existing instance as a singleton.
   * 
   * @param {string} name - Service name
   * @param {any} instance - Service instance
   * @returns {DIContainer} This container for chaining
   */
  registerInstance(name, instance) {
    this._singletons.set(name, instance);
    return this;
  }

  /**
   * Resolve a service by name with automatic dependency injection.
   * 
   * @param {string} name - Service name to resolve
   * @returns {any} Service instance
   * @throws {Error} If service not found or circular dependency detected
   * 
   * @example
   * ```javascript
   * const dataCore = container.resolve('dataCore');
   * // All dependencies automatically injected
   * ```
   */
  resolve(name) {
    if (typeof name !== 'string') {
      throw new Error('Service name must be a string');
    }

    // Check for existing singleton instance
    if (this._singletons.has(name)) {
      return this._singletons.get(name);
    }

    // Check for circular dependency
    if (this._resolving.has(name)) {
      const resolvingArray = Array.from(this._resolving);
      throw new Error(`Circular dependency detected: ${resolvingArray.join(' -> ')} -> ${name}`);
    }

    // Get service configuration
    const service = this._services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not registered`);
    }

    // Track this service as currently resolving
    this._resolving.add(name);

    try {
      let instance;

      if (service.factory) {
        // Use custom factory
        instance = service.factory(this);
      } else {
        // Resolve constructor dependencies
        const dependencies = this._resolveDependencies(service);
        
        // Add config to dependencies if it exists and no explicit dependencies were specified
        if (service.config && Object.keys(service.config).length > 0 && dependencies.length === 0) {
          dependencies.push(service.config);
        }
        
        // Create instance with dependencies
        instance = new service.constructor(...dependencies);
      }

      // Cache singleton instances
      if (service.singleton) {
        this._singletons.set(name, instance);
      }

      return instance;
    } finally {
      // Remove from resolving set
      this._resolving.delete(name);
    }
  }

  /**
   * Resolve multiple services at once.
   * 
   * @param {string[]} names - Service names to resolve
   * @returns {Object} Object with resolved services keyed by name
   * 
   * @example
   * ```javascript
   * const { fileSystem, process, environment } = container.resolveMultiple([
   *   'fileSystem', 'process', 'environment'
   * ]);
   * ```
   */
  resolveMultiple(names) {
    if (!Array.isArray(names)) {
      throw new Error('Names must be an array');
    }

    const resolved = {};
    for (const name of names) {
      resolved[name] = this.resolve(name);
    }
    return resolved;
  }

  /**
   * Check if a service is registered.
   * 
   * @param {string} name - Service name
   * @returns {boolean} True if service is registered
   */
  has(name) {
    return this._services.has(name) || this._singletons.has(name);
  }

  /**
   * Create a child container that inherits from this container.
   * Useful for scoping services or creating test containers.
   * 
   * @returns {DIContainer} Child container
   */
  createChildContainer() {
    const child = new DIContainer();
    
    // Copy parent services (not instances)
    for (const [name, service] of this._services) {
      child._services.set(name, { ...service });
    }
    
    // Reference to parent for fallback resolution
    child._parent = this;
    
    return child;
  }

  /**
   * Auto-wire a constructor by analyzing its parameter names.
   * This is a convenience method for simple dependency injection scenarios.
   * 
   * @param {Function} constructor - Constructor to analyze and wire
   * @param {Object} [overrides={}] - Manual dependency overrides
   * @returns {any} New instance with dependencies injected
   * 
   * @example
   * ```javascript
   * class MyService {
   *   constructor(fileSystem, process) { ... }
   * }
   * 
   * const instance = container.autoWire(MyService);
   * // fileSystem and process automatically resolved and injected
   * ```
   */
  autoWire(constructor, overrides = {}) {
    if (typeof constructor !== 'function') {
      throw new Error('Constructor must be a function');
    }

    const dependencies = this._extractParameterNames(constructor);
    const resolvedDependencies = dependencies.map(name => {
      if (overrides.hasOwnProperty(name)) {
        return overrides[name];
      }
      return this.resolve(name);
    });

    return new constructor(...resolvedDependencies);
  }

  /**
   * Clear all services and singletons.
   * Useful for testing or container cleanup.
   */
  clear() {
    this._services.clear();
    this._singletons.clear();
    this._resolving.clear();
  }

  /**
   * Get container statistics for debugging.
   * 
   * @returns {Object} Container statistics
   */
  getStats() {
    return {
      totalServices: this._services.size,
      singletonInstances: this._singletons.size,
      currentlyResolving: this._resolving.size,
      services: Array.from(this._services.keys()).sort(),
      singletons: Array.from(this._singletons.keys()).sort()
    };
  }

  /**
   * Resolve dependencies for a service based on its configuration.
   * 
   * @private
   * @param {Object} service - Service configuration
   * @returns {Array} Resolved dependency instances
   */
  _resolveDependencies(service) {
    if (service.dependencies) {
      // Use explicitly specified dependencies
      return service.dependencies.map(dep => this.resolve(dep));
    } else {
      // Try to auto-wire constructor parameters
      const paramNames = this._extractParameterNames(service.constructor);
      return paramNames.map(name => {
        try {
          return this.resolve(name);
        } catch (error) {
          throw new Error(`Failed to resolve dependency '${name}' for service: ${error.message}`);
        }
      });
    }
  }

  /**
   * Extract parameter names from a function for auto-wiring.
   * Uses function.toString() to parse parameter names.
   * 
   * @private
   * @param {Function} func - Function to analyze
   * @returns {string[]} Parameter names
   */
  _extractParameterNames(func) {
    const funcStr = func.toString();
    
    // Match constructor parameters
    const match = funcStr.match(/constructor\s*\(([^)]*)\)/);
    if (!match || !match[1].trim()) {
      return [];
    }

    return match[1]
      .split(',')
      .map(param => {
        // Handle default parameters: name = 'default' -> name
        const cleaned = param.trim().split('=')[0].trim();
        return cleaned.split(/\s+/)[0]; // Remove type annotations
      })
      .filter(param => param && param !== '...' && !param.startsWith('{')); // Filter out rest params and destructuring
  }
}