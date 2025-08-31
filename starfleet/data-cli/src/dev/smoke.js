#!/usr/bin/env node
/**
 * Smoke test - Verify DI container and basic use-cases work
 * Run with: node packages/data-cli/src/dev/smoke.js
 */

import { buildServices } from '../container/buildServices.js';

console.log('🔥 Running smoke test...\n');

try {
  // Build the DI container
  console.log('1. Building services container...');
  const services = buildServices();
  console.log('   ✅ Container built successfully');

  // Verify all ports are wired
  console.log('\n2. Verifying ports...');
  const portNames = Object.keys(services.ports);
  console.log(`   ✅ ${portNames.length} ports available: ${portNames.join(', ')}`);

  // Verify use-cases are wired
  console.log('\n3. Verifying use-cases...');
  const useCaseNames = Object.keys(services.useCases);
  console.log(`   ✅ ${useCaseNames.length} use-cases available: ${useCaseNames.join(', ')}`);

  // Test a simple use-case with fake data
  console.log('\n4. Testing generateMigrationPlan with mock SQL directory...');
  
  // Create a temporary test directory
  const testDir = '/tmp/smoke-test-sql';
  await services.ports.fs.mkdirp(testDir);
  await services.ports.fs.writeFile(
    `${testDir}/001_test.sql`,
    'CREATE TABLE test_table (id serial PRIMARY KEY);'
  );

  const plan = await services.useCases.generateMigrationPlan.execute({
    sqlRoot: testDir
  });

  console.log(`   ✅ Generated plan with ${plan.steps.length} step(s)`);
  console.log(`   📄 Plan checksum: ${plan.checksum}`);

  // Test safety gates with current repo
  console.log('\n5. Testing verifySafetyGates...');
  const safetyResult = await services.useCases.verifySafetyGates.execute({
    requireClean: false, // Don't require clean for smoke test
    allowedBranches: [], // Allow any branch for smoke test
    requireTests: false  // Don't run tests for smoke test
  });

  console.log(`   ✅ Safety gates checked: ${safetyResult.passed ? 'PASSED' : 'FAILED'}`);
  if (safetyResult.failures.length > 0) {
    console.log(`   ⚠️  Failures: ${safetyResult.failures.join(', ')}`);
  }

  // Test event bus
  console.log('\n6. Testing event bus...');
  let eventReceived = false;
  const unsubscribe = services.ports.bus.on('test.event', () => {
    eventReceived = true;
  });
  services.ports.bus.emit('test.event', { test: true });
  
  if (eventReceived) {
    console.log('   ✅ Event bus working');
  } else {
    throw new Error('Event bus not working');
  }
  
  // Test unsubscribe
  unsubscribe();

  // Cleanup
  console.log('\n7. Cleaning up...');
  await services.ports.fs.rm(testDir, { recursive: true, force: true });
  await services.shutdown();
  console.log('   ✅ Cleanup complete');

  console.log('\n✅ All smoke tests passed!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Smoke test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}