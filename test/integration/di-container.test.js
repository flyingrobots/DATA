/**
 * Integration tests for DI Container functionality
 *
 * Tests the complete dependency injection system including:
 * - Service registration and resolution
 * - Singleton lifecycle management
 * - Circular dependency detection
 * - Auto-wiring with parameter detection
 * - Factory function support
 * - Child container inheritance
 * - Real-world integration patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DIContainer } from '../../packages/data-core/ports/DIContainer.js';
import {
  FileSystemPort,
  CryptoPort,
  ProcessPort,
  EnvironmentPort,
  validatePort
} from '../../packages/data-core/ports/index.js';

// Mock implementations for testing
class MockFileSystemAdapter extends FileSystemPort {
  constructor(config = {}) {
    super();
    this.config = config;
    this.readFileCallCount = 0;
  }

  async readFile(path) {
    this.readFileCallCount++;
    return `mock content for ${path}`;
  }

  async glob(patterns, cwd) {
    return patterns.map((pattern) => `${cwd}/${pattern}`);
  }
}

class MockCryptoAdapter extends CryptoPort {
  constructor(config = {}) {
    super();
    this.config = config;
    this.hashCallCount = 0;
  }

  hash(data, algorithm = 'sha256') {
    this.hashCallCount++;
    return `mock_hash_${algorithm}_${data.slice(0, 10)}`;
  }
}

class MockProcessAdapter extends ProcessPort {
  constructor(config = {}) {
    super();
    this.config = config;
    this.spawnCallCount = 0;
  }

  async spawn(command, args = [], options = {}) {
    this.spawnCallCount++;
    return {
      stdout: `mock output for ${command}`,
      stderr: '',
      exitCode: 0
    };
  }
}

class MockEnvironmentAdapter extends EnvironmentPort {
  constructor(config = {}) {
    super();
    this.config = config;
    this.env = new Map();
  }

  get(key, defaultValue) {
    return this.env.get(key) || defaultValue;
  }

  has(key) {
    return this.env.has(key);
  }

  set(key, value) {
    this.env.set(key, value);
    return true;
  }
}

// Test service classes
class SimpleService {
  constructor() {
    this.id = Math.random();
  }
}

class ServiceWithDependencies {
  constructor(fileSystem, crypto) {
    this.fileSystem = fileSystem;
    this.crypto = crypto;
    this.id = Math.random();
  }
}

class ServiceWithConfig {
  constructor(config) {
    this.config = config;
    this.id = Math.random();
  }
}

class ComplexService {
  constructor(fileSystem, crypto, process, environment, config) {
    this.fileSystem = fileSystem;
    this.crypto = crypto;
    this.process = process;
    this.environment = environment;
    this.config = config;
    this.id = Math.random();
  }
}

class CircularDependencyA {
  constructor(serviceB) {
    this.serviceB = serviceB;
  }
}

class CircularDependencyB {
  constructor(serviceA) {
    this.serviceA = serviceA;
  }
}

describe('DIContainer', () => {
  let container;

  beforeEach(() => {
    container = new DIContainer();
  });

  afterEach(() => {
    container.clear();
  });

  describe('basic registration and resolution', () => {
    it('should register and resolve simple services', () => {
      container.register('simple', SimpleService);

      const instance = container.resolve('simple');

      expect(instance).toBeInstanceOf(SimpleService);
      expect(instance.id).toBeDefined();
    });

    it('should create new instances for non-singleton services', () => {
      container.register('simple', SimpleService);

      const instance1 = container.resolve('simple');
      const instance2 = container.resolve('simple');

      expect(instance1).toBeInstanceOf(SimpleService);
      expect(instance2).toBeInstanceOf(SimpleService);
      expect(instance1.id).not.toBe(instance2.id);
    });

    it('should return same instance for singleton services', () => {
      container.registerSingleton('simple', SimpleService);

      const instance1 = container.resolve('simple');
      const instance2 = container.resolve('simple');

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    it('should support explicit singleton registration', () => {
      container.register('simple', SimpleService, { singleton: true });

      const instance1 = container.resolve('simple');
      const instance2 = container.resolve('simple');

      expect(instance1).toBe(instance2);
    });
  });

  describe('dependency injection', () => {
    beforeEach(() => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.registerSingleton('crypto', MockCryptoAdapter);
      container.registerSingleton('process', MockProcessAdapter);
      container.registerSingleton('environment', MockEnvironmentAdapter);
    });

    it('should inject dependencies automatically', () => {
      container.register('serviceWithDeps', ServiceWithDependencies);

      const instance = container.resolve('serviceWithDeps');

      expect(instance.fileSystem).toBeInstanceOf(MockFileSystemAdapter);
      expect(instance.crypto).toBeInstanceOf(MockCryptoAdapter);
    });

    it('should inject complex dependency graphs', () => {
      container.register('complex', ComplexService);

      const instance = container.resolve('complex');

      expect(instance.fileSystem).toBeInstanceOf(MockFileSystemAdapter);
      expect(instance.crypto).toBeInstanceOf(MockCryptoAdapter);
      expect(instance.process).toBeInstanceOf(MockProcessAdapter);
      expect(instance.environment).toBeInstanceOf(MockEnvironmentAdapter);
    });

    it('should support explicit dependency specification', () => {
      container.register('explicit', ServiceWithDependencies, {
        dependencies: ['crypto', 'fileSystem'] // Reversed order
      });

      const instance = container.resolve('explicit');

      // First parameter should be crypto, second should be fileSystem
      expect(instance.fileSystem).toBeInstanceOf(MockCryptoAdapter);
      expect(instance.crypto).toBeInstanceOf(MockFileSystemAdapter);
    });

    it('should validate port implementations', () => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);

      const fileSystem = container.resolve('fileSystem');

      expect(() => validatePort(fileSystem, FileSystemPort)).not.toThrow();
    });

    it('should pass configuration to constructors', () => {
      const config = { debug: true, timeout: 5000 };
      container.register('withConfig', ServiceWithConfig, {
        config
      });

      const instance = container.resolve('withConfig');

      expect(instance.config).toBe(config);
    });
  });

  describe('factory functions', () => {
    beforeEach(() => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.registerSingleton('crypto', MockCryptoAdapter);
    });

    it('should support factory registration', () => {
      container.registerFactory('customService', (container) => {
        const fileSystem = container.resolve('fileSystem');
        const crypto = container.resolve('crypto');

        return {
          fileSystem,
          crypto,
          custom: 'factory created',
          id: Math.random()
        };
      });

      const instance = container.resolve('customService');

      expect(instance.custom).toBe('factory created');
      expect(instance.fileSystem).toBeInstanceOf(MockFileSystemAdapter);
      expect(instance.crypto).toBeInstanceOf(MockCryptoAdapter);
    });

    it('should support singleton factories', () => {
      container.registerFactory(
        'singletonFactory',
        () => ({
          id: Math.random(),
          type: 'singleton'
        }),
        { singleton: true }
      );

      const instance1 = container.resolve('singletonFactory');
      const instance2 = container.resolve('singletonFactory');

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    it('should handle factory errors gracefully', () => {
      container.registerFactory('failingFactory', () => {
        throw new Error('Factory failed');
      });

      expect(() => container.resolve('failingFactory')).toThrow('Factory failed');
    });
  });

  describe('instance registration', () => {
    it('should register and resolve existing instances', () => {
      const existingInstance = new SimpleService();

      container.registerInstance('existing', existingInstance);

      const resolved = container.resolve('existing');
      expect(resolved).toBe(existingInstance);
    });

    it('should prioritize instances over constructors', () => {
      const existingInstance = { type: 'existing' };

      container.register('service', SimpleService);
      container.registerInstance('service', existingInstance);

      const resolved = container.resolve('service');
      expect(resolved).toBe(existingInstance);
    });
  });

  describe('circular dependency detection', () => {
    it('should detect direct circular dependencies', () => {
      container.register('serviceA', CircularDependencyA, {
        dependencies: ['serviceB']
      });
      container.register('serviceB', CircularDependencyB, {
        dependencies: ['serviceA']
      });

      expect(() => container.resolve('serviceA')).toThrow(
        'Circular dependency detected: serviceA -> serviceB -> serviceA'
      );
    });

    it('should detect indirect circular dependencies', () => {
      class ServiceC {
        constructor(serviceA) {
          this.serviceA = serviceA;
        }
      }

      container.register('serviceA', CircularDependencyA, {
        dependencies: ['serviceB']
      });
      container.register('serviceB', CircularDependencyB, {
        dependencies: ['serviceC']
      });
      container.register('serviceC', ServiceC, {
        dependencies: ['serviceA']
      });

      expect(() => container.resolve('serviceA')).toThrow('Circular dependency detected:');
    });

    it('should allow self-contained dependency trees', () => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.registerSingleton('crypto', MockCryptoAdapter);
      container.register('service', ServiceWithDependencies);

      expect(() => container.resolve('service')).not.toThrow();
    });
  });

  describe('multiple service resolution', () => {
    beforeEach(() => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.registerSingleton('crypto', MockCryptoAdapter);
      container.registerSingleton('process', MockProcessAdapter);
    });

    it('should resolve multiple services at once', () => {
      const resolved = container.resolveMultiple(['fileSystem', 'crypto', 'process']);

      expect(resolved.fileSystem).toBeInstanceOf(MockFileSystemAdapter);
      expect(resolved.crypto).toBeInstanceOf(MockCryptoAdapter);
      expect(resolved.process).toBeInstanceOf(MockProcessAdapter);
    });

    it('should handle empty array', () => {
      const resolved = container.resolveMultiple([]);
      expect(resolved).toEqual({});
    });

    it('should throw for invalid service in array', () => {
      expect(() => container.resolveMultiple(['fileSystem', 'nonexistent'])).toThrow(
        "Service 'nonexistent' not registered"
      );
    });
  });

  describe('auto-wiring', () => {
    beforeEach(() => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.registerSingleton('crypto', MockCryptoAdapter);
    });

    it('should auto-wire constructor dependencies', () => {
      const instance = container.autoWire(ServiceWithDependencies);

      expect(instance).toBeInstanceOf(ServiceWithDependencies);
      expect(instance.fileSystem).toBeInstanceOf(MockFileSystemAdapter);
      expect(instance.crypto).toBeInstanceOf(MockCryptoAdapter);
    });

    it('should support manual overrides in auto-wiring', () => {
      const customCrypto = new MockCryptoAdapter({ custom: true });

      const instance = container.autoWire(ServiceWithDependencies, {
        crypto: customCrypto
      });

      expect(instance.crypto).toBe(customCrypto);
      expect(instance.fileSystem).toBeInstanceOf(MockFileSystemAdapter);
    });

    it('should handle constructors with no parameters', () => {
      const instance = container.autoWire(SimpleService);

      expect(instance).toBeInstanceOf(SimpleService);
    });

    it('should throw for constructors requiring unregistered services', () => {
      class ServiceWithUnknownDependency {
        constructor(unknownService) {
          this.unknownService = unknownService;
        }
      }

      expect(() => container.autoWire(ServiceWithUnknownDependency)).toThrow(
        "Service 'unknownService' not registered"
      );
    });
  });

  describe('child containers', () => {
    beforeEach(() => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.registerSingleton('crypto', MockCryptoAdapter);
    });

    it('should create child containers with inherited services', () => {
      const child = container.createChildContainer();

      expect(child.has('fileSystem')).toBe(true);
      expect(child.has('crypto')).toBe(true);
    });

    it('should allow child containers to override parent services', () => {
      const child = container.createChildContainer();
      const customCrypto = new MockCryptoAdapter({ child: true });

      child.registerInstance('crypto', customCrypto);

      const parentCrypto = container.resolve('crypto');
      const childCrypto = child.resolve('crypto');

      expect(parentCrypto).not.toBe(customCrypto);
      expect(childCrypto).toBe(customCrypto);
    });

    it('should allow child-specific service registration', () => {
      const child = container.createChildContainer();

      child.register('childOnly', SimpleService);

      expect(child.has('childOnly')).toBe(true);
      expect(container.has('childOnly')).toBe(false);
    });
  });

  describe('container introspection and statistics', () => {
    beforeEach(() => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.register('crypto', MockCryptoAdapter);
      container.registerInstance('existing', { type: 'instance' });
    });

    it('should provide container statistics', () => {
      // Resolve one service to create singleton instance
      container.resolve('fileSystem');

      const stats = container.getStats();

      expect(stats.totalServices).toBe(2); // fileSystem and crypto
      expect(stats.singletonInstances).toBe(2); // fileSystem instance + existing instance
      expect(stats.currentlyResolving).toBe(0);
      expect(stats.services).toEqual(['crypto', 'fileSystem']);
      expect(stats.singletons).toEqual(['existing', 'fileSystem']);
    });

    it('should check service existence correctly', () => {
      expect(container.has('fileSystem')).toBe(true);
      expect(container.has('crypto')).toBe(true);
      expect(container.has('existing')).toBe(true);
      expect(container.has('nonexistent')).toBe(false);
    });

    it('should track resolving services during resolution', async () => {
      let resolvingDuringFactory = 0;

      container.registerFactory('trackingService', (container) => {
        resolvingDuringFactory = container.getStats().currentlyResolving;
        return { tracked: true };
      });

      container.resolve('trackingService');

      expect(resolvingDuringFactory).toBe(1); // trackingService was being resolved
    });
  });

  describe('error handling', () => {
    it('should throw for invalid service names', () => {
      expect(() => container.register('', SimpleService)).toThrow(
        'Service name must be a non-empty string'
      );
      expect(() => container.register(null, SimpleService)).toThrow(
        'Service name must be a non-empty string'
      );
      expect(() => container.register(123, SimpleService)).toThrow(
        'Service name must be a non-empty string'
      );
    });

    it('should throw for invalid constructors', () => {
      expect(() => container.register('invalid', 'not a function')).toThrow(
        'Service constructor must be a function'
      );
      expect(() => container.register('invalid', null)).toThrow(
        'Service constructor must be a function'
      );
    });

    it('should throw for unregistered services', () => {
      expect(() => container.resolve('nonexistent')).toThrow(
        "Service 'nonexistent' not registered"
      );
    });

    it('should throw for invalid resolution parameters', () => {
      expect(() => container.resolve(123)).toThrow('Service name must be a string');
      expect(() => container.resolve(null)).toThrow('Service name must be a string');
    });

    it('should throw for invalid factory functions', () => {
      expect(() => container.registerFactory('invalid', 'not a function')).toThrow(
        'Factory must be a function'
      );
    });

    it('should throw for invalid auto-wire constructors', () => {
      expect(() => container.autoWire('not a function')).toThrow('Constructor must be a function');
    });

    it('should handle constructor errors gracefully', () => {
      class FailingService {
        constructor() {
          throw new Error('Constructor failed');
        }
      }

      container.register('failing', FailingService);

      expect(() => container.resolve('failing')).toThrow('Constructor failed');
    });
  });

  describe('real-world integration patterns', () => {
    it('should wire complete adapter ecosystem', () => {
      // Register all adapters
      container.registerSingleton('fileSystem', MockFileSystemAdapter, {
        config: { encoding: 'utf8', mode: 0o644 }
      });

      container.registerSingleton('crypto', MockCryptoAdapter, {
        config: { defaultAlgorithm: 'sha256' }
      });

      container.registerSingleton('process', MockProcessAdapter, {
        config: { timeout: 30000 }
      });

      container.registerSingleton('environment', MockEnvironmentAdapter, {
        config: { prefix: 'DATA_' }
      });

      // Register core services that depend on adapters
      container.register('dataCore', ComplexService);

      const dataCore = container.resolve('dataCore');

      // Verify all adapters are correctly injected
      expect(dataCore.fileSystem).toBeInstanceOf(MockFileSystemAdapter);
      expect(dataCore.crypto).toBeInstanceOf(MockCryptoAdapter);
      expect(dataCore.process).toBeInstanceOf(MockProcessAdapter);
      expect(dataCore.environment).toBeInstanceOf(MockEnvironmentAdapter);

      // Verify configuration was passed
      expect(dataCore.fileSystem.config.encoding).toBe('utf8');
      expect(dataCore.crypto.config.defaultAlgorithm).toBe('sha256');
    });

    it('should support complex factory patterns', () => {
      container.registerSingleton('environment', MockEnvironmentAdapter);

      // Factory that creates different instances based on environment
      container.registerFactory('configuredService', (container) => {
        const env = container.resolve('environment');
        env.set('NODE_ENV', 'test');

        const isTest = env.get('NODE_ENV') === 'test';

        if (isTest) {
          return new MockFileSystemAdapter({ test: true });
        } else {
          return new MockFileSystemAdapter({ production: true });
        }
      });

      const service = container.resolve('configuredService');

      expect(service).toBeInstanceOf(MockFileSystemAdapter);
      expect(service.config.test).toBe(true);
    });

    it('should handle testing scenarios with mocks', () => {
      // Production services
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.registerSingleton('crypto', MockCryptoAdapter);

      // Service under test
      container.register('serviceUnderTest', ServiceWithDependencies);

      // Test scenario with spy
      const fileSystemSpy = vi.fn();
      const mockFileSystem = {
        ...new MockFileSystemAdapter(),
        readFile: fileSystemSpy
      };

      // Override with test double
      container.registerInstance('fileSystem', mockFileSystem);

      const service = container.resolve('serviceUnderTest');

      // Use the service (would normally be done in actual test)
      expect(service.fileSystem).toBe(mockFileSystem);
      expect(typeof service.fileSystem.readFile).toBe('function');
    });

    it('should demonstrate performance characteristics', () => {
      // Register many services
      for (let i = 0; i < 100; i++) {
        container.register(`service${i}`, SimpleService);
      }

      const startTime = Date.now();

      // Resolve all services
      const resolvedServices = [];
      for (let i = 0; i < 100; i++) {
        resolvedServices.push(container.resolve(`service${i}`));
      }

      const duration = Date.now() - startTime;

      expect(resolvedServices).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should be fast

      // All should be different instances (non-singleton)
      const ids = resolvedServices.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });

    it('should support configuration-driven service registration', () => {
      const serviceConfig = {
        services: [
          {
            name: 'fileSystem',
            constructor: MockFileSystemAdapter,
            singleton: true,
            config: { timeout: 5000 }
          },
          {
            name: 'crypto',
            constructor: MockCryptoAdapter,
            singleton: true,
            config: { algorithm: 'sha512' }
          },
          {
            name: 'mainService',
            constructor: ServiceWithDependencies,
            dependencies: ['fileSystem', 'crypto']
          }
        ]
      };

      // Register services from configuration
      serviceConfig.services.forEach((service) => {
        container.register(service.name, service.constructor, {
          singleton: service.singleton,
          dependencies: service.dependencies,
          config: service.config
        });
      });

      const mainService = container.resolve('mainService');

      expect(mainService).toBeInstanceOf(ServiceWithDependencies);
      expect(mainService.fileSystem.config.timeout).toBe(5000);
      expect(mainService.crypto.config.algorithm).toBe('sha512');
    });
  });

  describe('cleanup and lifecycle', () => {
    it('should clear all services and instances', () => {
      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.register('service', SimpleService);
      container.registerInstance('instance', { test: true });

      // Resolve to create singleton
      container.resolve('fileSystem');

      expect(container.getStats().totalServices).toBe(2);
      expect(container.getStats().singletonInstances).toBe(2);

      container.clear();

      const stats = container.getStats();
      expect(stats.totalServices).toBe(0);
      expect(stats.singletonInstances).toBe(0);
      expect(stats.currentlyResolving).toBe(0);
    });

    it('should handle concurrent resolution correctly', async () => {
      let constructorCallCount = 0;

      class ConcurrentService {
        constructor(fileSystem) {
          constructorCallCount++;
          this.fileSystem = fileSystem;
          this.id = Math.random();
        }
      }

      container.registerSingleton('fileSystem', MockFileSystemAdapter);
      container.registerSingleton('concurrent', ConcurrentService);

      // Resolve concurrently
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(container.resolve('concurrent'))
      );

      const instances = await Promise.all(promises);

      // All should be the same instance (singleton)
      const firstInstance = instances[0];
      instances.forEach((instance) => {
        expect(instance).toBe(firstInstance);
      });

      // Constructor should only be called once
      expect(constructorCallCount).toBe(1);
    });
  });
});
