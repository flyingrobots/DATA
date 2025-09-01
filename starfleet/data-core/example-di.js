#!/usr/bin/env node

/**
 * Example demonstrating the dependency injection system.
 * Shows how to wire data-core with data-host-node adapters using DI.
 *
 * Run with: node packages/data-core/example-di.js
 */

import { DIContainer } from './ports/DIContainer.js';
import { PortFactory, wireDataCore } from './ports/PortFactory.js';
import { DataCore } from './index.js';

// Import Node.js adapters
import {
  FileSystemAdapter,
  CryptoAdapter,
  ProcessAdapter,
  EnvironmentAdapter
} from '../data-host-node/index.js';

console.log('🔗 Dependency Injection System Demo\n');

// === Method 1: Using DIContainer directly ===
console.log('📦 Method 1: Using DIContainer directly');

const container = new DIContainer();

// Register all adapters as singletons
container
  .registerSingleton('fileSystem', FileSystemAdapter, {
    config: { encoding: 'utf8' }
  })
  .registerSingleton('crypto', CryptoAdapter, {
    config: { defaultAlgorithm: 'sha256' }
  })
  .registerSingleton('process', ProcessAdapter, {
    config: { timeout: 30000, shell: '/bin/bash' }
  })
  .registerSingleton('environment', EnvironmentAdapter, {
    config: { prefix: 'DATA_' }
  });

// Register DataCore with automatic dependency injection
container.register('dataCore', DataCore);

// Resolve DataCore - all dependencies automatically injected
const dataCore1 = container.resolve('dataCore');
console.log(
  `✅ DataCore resolved with ports: ${Object.keys(dataCore1)
    .filter((k) => k.endsWith('Port'))
    .join(', ')}`
);
console.log('📊 Container stats:', container.getStats());

console.log('\n---\n');

// === Method 2: Using PortFactory ===
console.log('🏭 Method 2: Using PortFactory');

const factory = new PortFactory();

// Register adapters with factory
factory
  .registerPort('fileSystem', FileSystemAdapter, FileSystemAdapter, { encoding: 'utf8' })
  .registerPort('crypto', CryptoAdapter, CryptoAdapter, { defaultAlgorithm: 'sha256' })
  .registerPort('process', ProcessAdapter, ProcessAdapter, { timeout: 30000 })
  .registerPort('environment', EnvironmentAdapter, EnvironmentAdapter, { prefix: 'DATA_' });

// Create all data-core compatible ports
const ports = factory.createDataCorePorts({
  fileSystem: { encoding: 'utf8', mode: 0o644 },
  crypto: { defaultAlgorithm: 'sha256' },
  process: { timeout: 30000, shell: '/bin/bash' },
  environment: { prefix: 'DATA_', caseSensitive: true }
});

// Create DataCore with ports
const dataCore2 = new DataCore(ports.fileSystem, ports.crypto, ports.process, ports.environment);

console.log('✅ DataCore created with factory-generated ports');
console.log('📊 Factory info:', factory.getPortInfo());

console.log('\n---\n');

// === Method 3: Using convenience wireDataCore function ===
console.log('⚡ Method 3: Using wireDataCore convenience function');

const {
  ports: wirePorts,
  dataCore: dataCore3,
  factory: wireFactory
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

console.log('✅ DataCore wired using convenience function');
console.log('🔌 Wired ports:', Object.keys(wirePorts));

console.log('\n---\n');

// === Method 4: Factory + Container integration ===
console.log('🔄 Method 4: Factory + Container integration');

const integratedContainer = new DIContainer();
const integratedFactory = new PortFactory();

// Register adapters with factory
integratedFactory
  .registerPort('fileSystem', FileSystemAdapter, FileSystemAdapter)
  .registerPort('crypto', CryptoAdapter, CryptoAdapter)
  .registerPort('process', ProcessAdapter, ProcessAdapter)
  .registerPort('environment', EnvironmentAdapter, EnvironmentAdapter);

// Register factory-created ports with container
integratedFactory.registerWithContainer(integratedContainer, {
  fileSystem: { encoding: 'utf8' },
  crypto: { defaultAlgorithm: 'sha256' },
  process: { timeout: 30000 },
  environment: { prefix: 'DATA_' }
});

// Register DataCore
integratedContainer.registerSingleton('dataCore', DataCore);

// Resolve everything
const integratedDataCore = integratedContainer.resolve('dataCore');
console.log('✅ DataCore resolved from integrated Factory + Container');

console.log('\n---\n');

// === Demonstrate DataCore functionality ===
console.log('🚀 Testing DataCore functionality');

try {
  // Test package info
  const packageInfo = dataCore1.getPackageInfo();
  console.log(`📋 Package: ${packageInfo.name} v${packageInfo.version}`);
  console.log(`🔌 Port interfaces: ${packageInfo.portInterfaces.join(', ')}`);
  console.log(`⚙️ Core engines: ${packageInfo.coreEngines.join(', ')}`);

  // Test sample schema creation
  const sampleSchema = dataCore1.createSampleSchema('demo');
  console.log('📊 Sample schema created with checksum capability');

  console.log('\n✅ All dependency injection methods working correctly!');
  console.log('\n🎯 Key Benefits:');
  console.log('  • Automatic dependency resolution');
  console.log('  • Circular dependency detection');
  console.log('  • Singleton lifecycle management');
  console.log('  • Configuration injection');
  console.log('  • Factory pattern for reusability');
  console.log('  • Multiple integration approaches');
} catch (error) {
  console.error('❌ Error testing DataCore:', error.message);
  process.exit(1);
}
