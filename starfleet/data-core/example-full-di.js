#!/usr/bin/env node

/**
 * Complete example showing dependency injection system integration.
 * Demonstrates wiring data-core with data-host-node adapters.
 */

import { DIContainer, PortFactory, wireDataCore, DataCore } from './index.js';

// Import Node.js adapters
import { FileSystemAdapter } from '../data-host-node/adapters/FileSystemAdapter.js';
import { CryptoAdapter } from '../data-host-node/adapters/CryptoAdapter.js';
import { ProcessAdapter } from '../data-host-node/adapters/ProcessAdapter.js';
import { EnvironmentAdapter } from '../data-host-node/adapters/EnvironmentAdapter.js';

console.log('🚀 Complete Dependency Injection Integration Demo\n');

// === Method 1: Manual DI Container Setup ===
console.log('📦 Method 1: Manual DIContainer Setup');

const container = new DIContainer();

// Register all Node.js adapters as singletons with no dependencies (they only take config objects)
container
  .registerSingleton('fileSystem', FileSystemAdapter, {
    dependencies: [], // No DI dependencies, just config
    config: { encoding: 'utf8', mode: 0o644 }
  })
  .registerSingleton('crypto', CryptoAdapter, {
    dependencies: [],
    config: { defaultAlgorithm: 'sha256', encoding: 'hex' }
  })
  .registerSingleton('process', ProcessAdapter, {
    dependencies: [],
    config: { timeout: 30000, shell: '/bin/bash' }
  })
  .registerSingleton('environment', EnvironmentAdapter, {
    dependencies: [],
    config: { prefix: 'DATA_' }
  });

// Register DataCore with automatic dependency injection
container.register('dataCore', DataCore, {
  dependencies: ['fileSystem', 'crypto', 'process', 'environment']
});

// Resolve DataCore with all dependencies wired
const dataCore1 = container.resolve('dataCore');
console.log('✅ DataCore resolved from DIContainer');
console.log('   Ports injected: fileSystem, crypto, process, environment');

// Test functionality
const packageInfo1 = dataCore1.getPackageInfo();
console.log(`   Package: ${packageInfo1.name} v${packageInfo1.version}`);
console.log(`   Capabilities: ${Object.keys(packageInfo1.capabilities).length} features`);

console.log('\n---\n');

// === Method 2: PortFactory Approach ===
console.log('🏭 Method 2: PortFactory Approach');

const factory = new PortFactory();

// Register adapters with factory (note: using the base classes for validation)
factory
  .registerPort('fileSystem', FileSystemAdapter, FileSystemAdapter)
  .registerPort('crypto', CryptoAdapter, CryptoAdapter)
  .registerPort('process', ProcessAdapter, ProcessAdapter)
  .registerPort('environment', EnvironmentAdapter, EnvironmentAdapter);

// Create configured ports
const ports = factory.createDataCorePorts({
  fileSystem: { encoding: 'utf8', mode: 0o644 },
  crypto: { defaultAlgorithm: 'sha256' },
  process: { timeout: 30000, shell: '/bin/bash' },
  environment: { prefix: 'DATA_' }
});

// Wire DataCore manually
const dataCore2 = new DataCore(ports.fileSystem, ports.crypto, ports.process, ports.environment);

console.log('✅ DataCore created with PortFactory');
console.log(`   Generated ports: ${Object.keys(ports).join(', ')}`);

// Test functionality
const sampleSchema = dataCore2.createSampleSchema('factory-test');
console.log('   Sample schema created successfully');

console.log('\n---\n');

// === Method 3: wireDataCore Convenience Function ===
console.log('⚡ Method 3: wireDataCore Convenience Function');

const {
  ports: wireports,
  dataCore: dataCore3,
  factory: wirefactory
} = wireDataCore(
  DataCore,
  {
    fileSystem: FileSystemAdapter,
    crypto: CryptoAdapter,
    process: ProcessAdapter,
    environment: EnvironmentAdapter
  },
  {
    fileSystem: { encoding: 'utf8' },
    crypto: { defaultAlgorithm: 'sha256' },
    process: { timeout: 30000 },
    environment: { prefix: 'DATA_' }
  }
);

console.log('✅ DataCore wired with convenience function');
console.log(`   Auto-wired ports: ${Object.keys(wireports).join(', ')}`);

console.log('\n---\n');

// === Method 4: Factory + Container Integration ===
console.log('🔄 Method 4: Factory + Container Integration');

const integrationContainer = new DIContainer();
const integrationFactory = new PortFactory();

// Register adapters with factory
integrationFactory
  .registerPort('fileSystem', FileSystemAdapter, FileSystemAdapter)
  .registerPort('crypto', CryptoAdapter, CryptoAdapter)
  .registerPort('process', ProcessAdapter, ProcessAdapter)
  .registerPort('environment', EnvironmentAdapter, EnvironmentAdapter);

// Register factory ports with container as singletons
integrationFactory.registerWithContainer(integrationContainer, {
  fileSystem: { encoding: 'utf8' },
  crypto: { defaultAlgorithm: 'sha256' },
  process: { timeout: 30000 },
  environment: { prefix: 'DATA_' }
});

// Register DataCore for automatic resolution
integrationContainer.register('dataCore', DataCore, {
  dependencies: ['fileSystem', 'crypto', 'process', 'environment']
});

// Resolve everything
const dataCore4 = integrationContainer.resolve('dataCore');
console.log('✅ DataCore resolved from integrated Factory + Container');

// Show container statistics
const stats = integrationContainer.getStats();
console.log(
  `   Container: ${stats.totalServices} services, ${stats.singletonInstances} singletons`
);

console.log('\n---\n');

// === Demonstrate DataCore Functionality ===
console.log('🎯 Testing DataCore Functionality');

try {
  // Test with one of our DataCore instances
  const testDataCore = dataCore1;

  // Get package information
  const info = testDataCore.getPackageInfo();
  console.log(`📋 Package: ${info.name} v${info.version}`);
  console.log(`🔌 Port interfaces: ${info.portInterfaces.join(', ')}`);
  console.log(`⚙️  Core engines: ${info.coreEngines.join(', ')}`);

  // Create sample schema
  const schema = testDataCore.createSampleSchema('integration-test');
  console.log('📊 Sample schema created');

  // Show capabilities
  console.log('🎪 Capabilities:');
  for (const [capability, enabled] of Object.entries(info.capabilities)) {
    console.log(`   • ${capability}: ${enabled ? '✅' : '❌'}`);
  }

  console.log('\n🎉 All integration methods working successfully!');

  console.log('\n📋 Summary:');
  console.log('  1. DIContainer: Manual registration with full control');
  console.log('  2. PortFactory: Type-safe port creation with validation');
  console.log('  3. wireDataCore: One-liner convenience for simple cases');
  console.log('  4. Factory+Container: Best of both worlds for complex apps');

  console.log('\n🔑 Key Benefits:');
  console.log('  • Constructor injection with automatic dependency resolution');
  console.log('  • Singleton lifecycle management for shared resources');
  console.log('  • Configuration injection for customizable behavior');
  console.log('  • Circular dependency detection prevents infinite loops');
  console.log('  • Port interface validation ensures contract compliance');
  console.log('  • Factory pattern enables reusable, configured instances');
  console.log('  • Multiple integration approaches for different use cases');
} catch (error) {
  console.error('❌ Error testing DataCore functionality:', error.message);
  console.error(error.stack);
  process.exit(1);
}
