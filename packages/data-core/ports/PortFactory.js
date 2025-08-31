/**
 * Factory for creating and configuring port instances.
 * Provides standardized ways to create data-core ports with proper validation.
 * Integrates with DIContainer for automatic dependency resolution.
 * 
 * @fileoverview Port factory with configuration support and validation
 */

import { 
  FileSystemPort, 
  CryptoPort, 
  ProcessPort, 
  EnvironmentPort, 
  validatePort 
} from './index.js';

/**
 * Port configuration options
 * @typedef {Object} PortConfig
 * @property {string} [type] - Port type identifier
 * @property {Object} [config] - Port-specific configuration
 * @property {boolean} [validate=true] - Whether to validate port implementation
 * @property {string[]} [requiredMethods] - Custom method validation list
 */

/**
 * Factory for creating and managing port instances.
 * Handles port creation, configuration, and validation in a standardized way.
 */
export class PortFactory {
  constructor() {
    /** @type {Map<string, Function>} Registered port constructors */
    this._portConstructors = new Map();
    
    /** @type {Map<string, Function>} Registered port classes for validation */
    this._portClasses = new Map();
    
    /** @type {Map<string, Object>} Default configurations by port type */
    this._defaultConfigs = new Map();

    // Register built-in port types
    this._registerBuiltinPorts();
  }

  /**
   * Register a port constructor with the factory.
   * 
   * @param {string} type - Port type identifier
   * @param {Function} constructor - Port constructor function
   * @param {Function} portClass - Port interface class for validation
   * @param {Object} [defaultConfig={}] - Default configuration
   * @returns {PortFactory} This factory for chaining
   * 
   * @example
   * ```javascript
   * factory.registerPort('fileSystem', FileSystemAdapter, FileSystemPort, {
   *   encoding: 'utf8',
   *   mode: 0o644
   * });
   * ```
   */
  registerPort(type, constructor, portClass, defaultConfig = {}) {
    if (typeof type !== 'string' || !type.trim()) {
      throw new Error('Port type must be a non-empty string');
    }
    
    if (typeof constructor !== 'function') {
      throw new Error('Port constructor must be a function');
    }
    
    if (typeof portClass !== 'function') {
      throw new Error('Port class must be a function');
    }

    this._portConstructors.set(type, constructor);
    this._portClasses.set(type, portClass);
    this._defaultConfigs.set(type, defaultConfig);

    return this;
  }

  /**
   * Create a port instance of the specified type.
   * 
   * @param {string} type - Port type to create
   * @param {Object} [config={}] - Port configuration
   * @param {PortConfig} [options={}] - Creation options
   * @returns {Object} Created port instance
   * @throws {Error} If port type not registered or validation fails
   * 
   * @example
   * ```javascript
   * const fileSystem = factory.createPort('fileSystem', {
   *   encoding: 'utf8',
   *   baseDir: '/app/data'
   * });
   * ```
   */
  createPort(type, config = {}, options = {}) {
    const constructor = this._portConstructors.get(type);
    if (!constructor) {
      throw new Error(`Port type '${type}' not registered`);
    }

    // Merge with default configuration
    const defaultConfig = this._defaultConfigs.get(type) || {};
    const finalConfig = { ...defaultConfig, ...config };

    // Create port instance
    const port = new constructor(finalConfig);

    // Validate port implementation if requested
    if (options.validate !== false) {
      this._validatePort(port, type, options);
    }

    return port;
  }

  /**
   * Create multiple ports at once.
   * 
   * @param {Object<string, Object>} portConfigs - Map of port type to config
   * @param {PortConfig} [options={}] - Global creation options
   * @returns {Object<string, Object>} Map of port type to instance
   * 
   * @example
   * ```javascript
   * const ports = factory.createPorts({
   *   fileSystem: { encoding: 'utf8' },
   *   process: { timeout: 30000 },
   *   environment: { prefix: 'DATA_' }
   * });
   * ```
   */
  createPorts(portConfigs, options = {}) {
    if (typeof portConfigs !== 'object' || portConfigs === null) {
      throw new Error('Port configs must be an object');
    }

    const ports = {};
    for (const [type, config] of Object.entries(portConfigs)) {
      ports[type] = this.createPort(type, config, options);
    }
    return ports;
  }

  /**
   * Create a complete set of data-core compatible ports.
   * Creates all required ports for DataCore with sensible defaults.
   * 
   * @param {Object} [configs={}] - Port-specific configurations
   * @param {Object} [configs.fileSystem] - FileSystem port config
   * @param {Object} [configs.crypto] - Crypto port config  
   * @param {Object} [configs.process] - Process port config
   * @param {Object} [configs.environment] - Environment port config
   * @param {PortConfig} [options={}] - Creation options
   * @returns {Object} Complete set of data-core ports
   * 
   * @example
   * ```javascript
   * const ports = factory.createDataCorePorts({
   *   fileSystem: { encoding: 'utf8' },
   *   process: { timeout: 30000 }
   * });
   * 
   * const dataCore = new DataCore(
   *   ports.fileSystem,
   *   ports.crypto,
   *   ports.process,
   *   ports.environment
   * );
   * ```
   */
  createDataCorePorts(configs = {}, options = {}) {
    const requiredPorts = ['fileSystem', 'crypto', 'process', 'environment'];
    
    // Ensure all required ports are registered
    for (const portType of requiredPorts) {
      if (!this._portConstructors.has(portType)) {
        throw new Error(`Required port type '${portType}' not registered`);
      }
    }

    return this.createPorts({
      fileSystem: configs.fileSystem || {},
      crypto: configs.crypto || {},
      process: configs.process || {},
      environment: configs.environment || {}
    }, options);
  }

  /**
   * Register ports with a DI container.
   * Convenience method for integrating with dependency injection.
   * 
   * @param {DIContainer} container - DI container to register with
   * @param {Object} [portConfigs={}] - Port configurations
   * @param {Object} [registrationOptions={}] - DI registration options
   * @param {boolean} [registrationOptions.singleton=true] - Register as singletons
   * @returns {PortFactory} This factory for chaining
   * 
   * @example
   * ```javascript
   * const container = new DIContainer();
   * factory.registerWithContainer(container, {
   *   fileSystem: { encoding: 'utf8' },
   *   process: { timeout: 30000 }
   * });
   * 
   * // Now can resolve ports from container
   * const fileSystem = container.resolve('fileSystem');
   * ```
   */
  registerWithContainer(container, portConfigs = {}, registrationOptions = {}) {
    const singleton = registrationOptions.singleton !== false;
    
    for (const [type, constructor] of this._portConstructors) {
      const config = portConfigs[type] || {};
      
      container.registerFactory(type, () => {
        return this.createPort(type, config);
      }, { singleton });
    }

    return this;
  }

  /**
   * Get information about registered port types.
   * 
   * @returns {Object} Port factory information
   */
  getPortInfo() {
    const portInfo = {};
    
    for (const type of this._portConstructors.keys()) {
      const constructor = this._portConstructors.get(type);
      const portClass = this._portClasses.get(type);
      const defaultConfig = this._defaultConfigs.get(type);
      
      portInfo[type] = {
        constructorName: constructor.name,
        interfaceClass: portClass.name,
        defaultConfig: { ...defaultConfig },
        requiredMethods: this._getRequiredMethods(portClass)
      };
    }
    
    return {
      registeredPorts: Object.keys(portInfo).sort(),
      portDetails: portInfo
    };
  }

  /**
   * Validate that a port implements the required interface.
   * 
   * @private
   * @param {Object} port - Port instance to validate
   * @param {string} type - Port type
   * @param {PortConfig} options - Validation options
   * @throws {Error} If validation fails
   */
  _validatePort(port, type, options) {
    const portClass = this._portClasses.get(type);
    if (!portClass) {
      return; // No validation class registered
    }

    // Use built-in validation
    validatePort(port, portClass);

    // Additional method validation if specified
    if (options.requiredMethods) {
      for (const method of options.requiredMethods) {
        if (typeof port[method] !== 'function') {
          throw new Error(`Port '${type}' missing required method: ${method}`);
        }
      }
    }
  }

  /**
   * Get required method names from a port class.
   * 
   * @private
   * @param {Function} portClass - Port class to analyze
   * @returns {string[]} Required method names
   */
  _getRequiredMethods(portClass) {
    const methods = [];
    const proto = portClass.prototype;
    
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor' && typeof proto[name] === 'function') {
        methods.push(name);
      }
    }
    
    return methods.sort();
  }

  /**
   * Register built-in port types that come with data-core.
   * 
   * @private
   */
  _registerBuiltinPorts() {
    // These are just the interface classes - actual implementations
    // will be registered by the host packages (like data-host-node)
    this._portClasses.set('fileSystem', FileSystemPort);
    this._portClasses.set('crypto', CryptoPort);
    this._portClasses.set('process', ProcessPort);
    this._portClasses.set('environment', EnvironmentPort);
  }
}

/**
 * Create a pre-configured port factory instance.
 * 
 * @param {Object} [options={}] - Factory configuration options
 * @returns {PortFactory} Configured port factory
 */
export function createPortFactory(options = {}) {
  return new PortFactory();
}

/**
 * Convenience function to create ports and wire them with a DataCore instance.
 * 
 * @param {Function} DataCore - DataCore constructor
 * @param {Object} adapters - Map of adapter constructors by type
 * @param {Object} [configs={}] - Port configurations
 * @returns {Object} Object with both ports and wired DataCore instance
 * 
 * @example
 * ```javascript
 * import { DataCore } from 'data-core';
 * import { FileSystemAdapter, ProcessAdapter } from 'data-host-node';
 * 
 * const { ports, dataCore } = wireDataCore(DataCore, {
 *   fileSystem: FileSystemAdapter,
 *   process: ProcessAdapter,
 *   // ... other adapters
 * });
 * ```
 */
export function wireDataCore(DataCore, adapters, configs = {}) {
  const factory = createPortFactory();
  
  // Register adapters with factory
  for (const [type, adapter] of Object.entries(adapters)) {
    const portClass = factory._portClasses.get(type);
    if (portClass) {
      factory.registerPort(type, adapter, portClass, configs[type] || {});
    }
  }
  
  // Create all required ports
  const ports = factory.createDataCorePorts(configs);
  
  // Create DataCore instance with wired ports
  const dataCore = new DataCore(
    ports.fileSystem,
    ports.crypto, 
    ports.process,
    ports.environment
  );
  
  return { ports, dataCore, factory };
}