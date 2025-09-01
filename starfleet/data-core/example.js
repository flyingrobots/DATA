/**
 * Example usage demonstrating dependency injection with data-core package
 * This file shows how to implement port adapters and use the core logic
 */

import { 
  DataCore, 
  FileSystemPort, 
  CryptoPort, 
  ProcessPort, 
  EnvironmentPort,
  SchemaState 
} from './index.js';

// Example adapter implementations for Node.js environment
// These would typically be in separate adapter packages

class NodeFileSystemAdapter extends FileSystemPort {
  async readFile(path) {
    const fs = await import('fs/promises');
    return fs.readFile(path, 'utf8');
  }

  async glob(patterns, cwd = process.cwd()) {
    const glob = await import('glob');
    const results = [];
    for (const pattern of patterns) {
      const matches = await glob.glob(pattern, { cwd });
      results.push(...matches);
    }
    return results;
  }
}

class NodeCryptoAdapter extends CryptoPort {
  hash(data, algorithm = 'sha256') {
    const crypto = await import('crypto');
    return crypto.createHash(algorithm).update(data).digest('hex');
  }
}

class NodeProcessAdapter extends ProcessPort {
  async spawn(command, args = [], options = {}) {
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    
    return new Promise((resolve, _reject) => {
      const child = spawn(command, args, options);
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => stdout += data.toString());
      child.stderr?.on('data', (data) => stderr += data.toString());
      
      child.on('close', (exitCode) => {
        resolve({ stdout, stderr, exitCode });
      });
      
      child.on('error', _reject);
    });
  }
}

class NodeEnvironmentAdapter extends EnvironmentPort {
  get(key, defaultValue) {
    return process.env[key] ?? defaultValue;
  }
  
  has(key) {
    return key in process.env;
  }
}

// Example usage function
export async function demonstrateCoreUsage() {
  console.log('🚀 D.A.T.A. Core Package Demonstration');
  console.log('=====================================\n');

  // 1. Create adapter instances (dependency injection)
  const fileSystemPort = new NodeFileSystemAdapter();
  const cryptoPort = new NodeCryptoAdapter();
  const processPort = new NodeProcessAdapter();
  const environmentPort = new NodeEnvironmentAdapter();

  // 2. Initialize DataCore with injected dependencies
  const dataCore = new DataCore(
    fileSystemPort,
    cryptoPort,
    processPort,
    environmentPort
  );

  console.log('✅ DataCore initialized with injected adapters\n');

  // 3. Display package information
  const packageInfo = dataCore.getPackageInfo();
  console.log('📦 Package Information:');
  console.log(`   Name: ${packageInfo.name}`);
  console.log(`   Version: ${packageInfo.version}`);
  console.log(`   Type: ${packageInfo.type}`);
  console.log(`   I/O Dependencies: ${packageInfo.ioDepencencies}`);
  console.log(`   Port Interfaces: ${packageInfo.portInterfaces.join(', ')}`);
  console.log(`   Core Engines: ${packageInfo.coreEngines.join(', ')}\n`);

  // 4. Demonstrate schema state creation
  console.log('🏗️  Creating sample schema states...');
  const currentSchema = dataCore.createSampleSchema('current');
  const targetSchema = dataCore.createSampleSchema('target');
  
  // Modify target schema to demonstrate diff calculation
  targetSchema.addObject('tables', 'comments', {
    columns: ['id', 'post_id', 'content', 'created_at'],
    sql: 'CREATE TABLE comments (id SERIAL PRIMARY KEY, post_id INTEGER REFERENCES posts(id), content TEXT, created_at TIMESTAMP)'
  });
  
  targetSchema.addObject('indexes', 'idx_comments_post_id', {
    table: 'comments', 
    columns: ['post_id'],
    sql: 'CREATE INDEX idx_comments_post_id ON comments(post_id)'
  });

  console.log(`   Current schema checksum: ${currentSchema.checksum}`);
  console.log(`   Target schema checksum: ${targetSchema.checksum}\n`);

  // 5. Generate migration plan
  console.log('🔄 Generating migration plan...');
  const migrationResult = dataCore.generateMigrationPlan(currentSchema, targetSchema, {
    enableRollback: true,
    parallelExecution: false
  });

  console.log(`   Operations generated: ${migrationResult.operations.length}`);
  console.log(`   Execution steps: ${migrationResult.executionPlan.stepCount}`);
  console.log(`   Estimated time: ${Math.round(migrationResult.executionPlan.estimatedTime / 1000)}s`);
  console.log(`   Plan valid: ${migrationResult.validation.valid}`);
  
  if (migrationResult.validation.warnings.length > 0) {
    console.log(`   Warnings: ${migrationResult.validation.warnings.length}`);
  }

  if (migrationResult.rollbackPlan) {
    console.log(`   Rollback steps: ${migrationResult.rollbackPlan.stepCount}`);
  }

  console.log('\n📋 Migration Operations:');
  migrationResult.operations.forEach((op, index) => {
    const destructiveFlag = op.isDestructive ? '⚠️ ' : '✅ ';
    console.log(`   ${index + 1}. ${destructiveFlag}${op.objectName}: ${op.sql.substring(0, 60)}...`);
  });

  console.log('\n🎯 Example demonstrates:');
  console.log('   ✓ Pure JavaScript implementation (zero I/O dependencies)');
  console.log('   ✓ Dependency injection via port/adapter pattern');
  console.log('   ✓ Runtime validation using instanceof checks');
  console.log('   ✓ Comprehensive JSDoc annotations');
  console.log('   ✓ ESM exports with clean API surface');
  console.log('   ✓ Business logic separation from I/O concerns\n');

  return migrationResult;
}

// Export individual adapters for reuse
export {
  NodeFileSystemAdapter,
  NodeCryptoAdapter, 
  NodeProcessAdapter,
  NodeEnvironmentAdapter
};