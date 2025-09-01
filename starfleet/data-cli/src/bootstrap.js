/**
 * Bootstrap - Dependency Injection Container for D.A.T.A. CLI
 *
 * Elegant dependency injection system that wires core ports to host adapters.
 * Supports test doubles, configuration overrides, and clean teardown.
 *
 * @author The JavaScript Pro
 */

import { ensurePort } from '@starfleet/data-core';
import {
  FileSystemAdapter,
  GlobAdapter,
  ClockAdapter,
  EnvironmentAdapter,
  LoggerConsoleAdapter,
  EventBusNodeAdapter,
  GitPortNodeAdapter,
  DbPortNodeAdapter,
  ProcessPortNodeAdapter,
  CryptoPortNodeAdapter
} from '@starfleet/data-host-node';

/**
 * @typedef {Object} DIContainer
 * @property {import('@starfleet/data-core').FileSystemPort} fileSystem
 * @property {import('@starfleet/data-core').GlobPort} glob
 * @property {import('@starfleet/data-core').ClockPort} clock
 * @property {import('@starfleet/data-core').EnvironmentPort} environment
 * @property {import('@starfleet/data-core').LoggerPort} logger
 * @property {import('@starfleet/data-core').EventBusPort} eventBus
 * @property {import('@starfleet/data-core').GitPort} git
 * @property {import('@starfleet/data-core').DbPort} db
 * @property {import('@starfleet/data-core').ProcessPort} process
 * @property {import('@starfleet/data-core').CryptoPort} crypto
 */

/**
 * @typedef {Object} BootstrapConfig
 * @property {boolean} [validatePorts=true] - Whether to validate port implementations
 * @property {Object} [overrides] - Port implementation overrides for testing
 * @property {Object} [adapterOptions] - Configuration options for adapters
 */

/**
 * Default adapter factory functions - pure functions that return configured instances
 */
const defaultFactories = {
  fileSystem: () => FileSystemAdapter,
  glob: () => GlobAdapter,
  clock: () => ClockAdapter,
  environment: () => EnvironmentAdapter,
  logger: () => LoggerConsoleAdapter,
  eventBus: () => EventBusNodeAdapter,
  git: () => GitPortNodeAdapter,
  db: (config) => new DbPortNodeAdapter(config),
  process: () => ProcessPortNodeAdapter,
  crypto: () => CryptoPortNodeAdapter
};

/**
 * Port validation - ensures adapters implement required port interfaces
 * @param {string} portName - Name of the port being validated
 * @param {Object} implementation - The adapter implementation
 * @throws {Error} If port validation fails
 */
function validatePortImplementation(portName, implementation) {
  if (!implementation) {
    throw new Error(`Port '${portName}' has no implementation`);
  }

  // Use ensurePort for runtime validation if available
  if (typeof ensurePort === 'function') {
    try {
      ensurePort(portName, implementation);
    } catch (error) {
      throw new Error(`Port validation failed for '${portName}': ${error.message}`);
    }
  }
}

/**
 * Create a dependency injection container with all ports wired to adapters
 *
 * This is the heart of our DI system - pure dependency injection with no service
 * locator pattern. All dependencies are resolved at container creation time.
 *
 * @param {BootstrapConfig} [config={}] - Bootstrap configuration
 * @returns {Promise<DIContainer>} Configured dependency container
 */
export async function createContainer(config = {}) {
  const { validatePorts = true, overrides = {}, adapterOptions = {} } = config;

  // Create configured adapter instances
  const adaptedPorts = {};

  for (const [portName, factory] of Object.entries(defaultFactories)) {
    try {
      // Use override if provided (for testing), otherwise use default factory
      const implementation = overrides[portName] || factory(adapterOptions[portName]);

      // Validate port implementation if requested
      if (validatePorts && !overrides[portName]) {
        validatePortImplementation(portName, implementation);
      }

      adaptedPorts[portName] = implementation;
    } catch (error) {
      throw new Error(`Failed to create adapter for port '${portName}': ${error.message}`);
    }
  }

  return adaptedPorts;
}

/**
 * Create container with test doubles - convenience method for testing
 *
 * @param {Object} mocks - Mock implementations keyed by port name
 * @returns {Promise<DIContainer>} Container with test doubles
 */
export async function createTestContainer(mocks = {}) {
  return createContainer({
    validatePorts: false, // Don't validate mocks
    overrides: mocks
  });
}

/**
 * Create production container with full validation and real adapters
 *
 * @param {Object} [adapterOptions={}] - Configuration for adapters
 * @returns {Promise<DIContainer>} Production-ready container
 */
export async function createProductionContainer(adapterOptions = {}) {
  return createContainer({
    validatePorts: true,
    adapterOptions
  });
}

/**
 * Singleton container instance - lazy initialized
 * Use sparingly - prefer explicit container passing for better testability
 */
let globalContainer = null;

/**
 * Get or create the global singleton container
 *
 * @param {BootstrapConfig} [config] - Configuration for container creation
 * @returns {Promise<DIContainer>} Global container instance
 */
export async function getGlobalContainer(config) {
  if (!globalContainer) {
    globalContainer = await createContainer(config);
  }
  return globalContainer;
}

/**
 * Reset the global container - useful for testing
 *
 * @returns {void}
 */
export function resetGlobalContainer() {
  globalContainer = null;
}

/**
 * Inject dependencies into a class constructor or function
 *
 * Higher-order function that creates factory functions with dependencies pre-injected.
 * This enables clean dependency injection without service locator pattern.
 *
 * @template T
 * @param {function(...args: any[]): T} ClassOrFunction - Constructor or factory function
 * @param {string[]} portNames - Names of ports to inject as dependencies
 * @returns {function(DIContainer): function(...args: any[]): T} Injected factory
 *
 * @example
 * const DatabaseCommandFactory = inject(DatabaseCommand, ['db', 'logger']);
 * const createCommand = DatabaseCommandFactory(container);
 * const command = createCommand(options);
 */
export function inject(ClassOrFunction, portNames) {
  return (container) => {
    const dependencies = portNames.map((name) => {
      if (!(name in container)) {
        throw new Error(`Dependency '${name}' not found in container`);
      }
      return container[name];
    });

    return (...args) => {
      // If it's a constructor, use 'new', otherwise call directly
      if (ClassOrFunction.prototype && ClassOrFunction.prototype.constructor === ClassOrFunction) {
        return new ClassOrFunction(...dependencies, ...args);
      } else {
        return ClassOrFunction(...dependencies, ...args);
      }
    };
  };
}

/**
 * Async teardown for containers that need cleanup
 *
 * @param {DIContainer} container - Container to tear down
 * @returns {Promise<void>}
 */
export async function teardownContainer(container) {
  // Close database connections
  if (container.db && typeof container.db.close === 'function') {
    await container.db.close();
  }

  // Clean up event bus subscribers
  if (container.eventBus && typeof container.eventBus.removeAllListeners === 'function') {
    container.eventBus.removeAllListeners();
  }

  // Reset global container if this is the global one
  if (container === globalContainer) {
    resetGlobalContainer();
  }
}
