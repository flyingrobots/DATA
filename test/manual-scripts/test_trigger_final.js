#!/usr/bin/env node

import pgTAPTestScanner from './src/lib/testing/pgTAPTestScanner.js';

console.log('✅ Testing trigger assertion parsing functionality...\n');

const scanner = new pgTAPTestScanner();

// Test different trigger assertion patterns
const testCases = [
  {
    name: 'has_trigger with table and trigger',
    sql: "SELECT has_trigger('users', 'update_timestamp_trigger');",
    expectedTarget: 'public.users.update_timestamp_trigger',
    expectedType: 'has_trigger'
  },
  {
    name: 'has_trigger with schema, table, and trigger',
    sql: "SELECT has_trigger('public', 'posts', 'audit_trigger');",
    expectedTarget: 'public.posts.audit_trigger',
    expectedType: 'has_trigger'
  },
  {
    name: 'trigger_is with function validation',
    sql: "SELECT trigger_is('users', 'update_trigger', 'set_timestamp');",
    expectedTarget: 'public.users.update_trigger',
    expectedType: 'trigger_is'
  },
  {
    name: 'is_trigger_on with events',
    sql: "SELECT is_trigger_on('posts', 'audit_trigger', 'UPDATE');",
    expectedTarget: 'public.posts.audit_trigger',
    expectedType: 'is_trigger_on'
  },
  {
    name: 'trigger_fires_on with timing',
    sql: "SELECT trigger_fires_on('users', 'update_trigger', 'BEFORE');",
    expectedTarget: 'public.users.update_trigger',
    expectedType: 'trigger_fires_on'
  },
  {
    name: 'trigger_is_for with level',
    sql: "SELECT trigger_is_for('users', 'update_trigger', 'ROW');",
    expectedTarget: 'public.users.update_trigger',
    expectedType: 'trigger_is_for'
  },
  {
    name: 'triggers_are with array',
    sql: "SELECT triggers_are('users', ARRAY['trigger1', 'trigger2']);",
    expectedTarget: 'public.users',
    expectedType: 'triggers_are'
  }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  try {
    const assertions = scanner.extractAssertions(testCase.sql);

    if (assertions.length === 1) {
      const assertion = assertions[0];

      if (assertion.type === testCase.expectedType && assertion.target === testCase.expectedTarget) {
        console.log(`✅ Test ${index + 1}: ${testCase.name} - PASSED`);
        console.log(`   Target: ${assertion.target}`);
        console.log(`   Type: ${assertion.type}`);
        passed++;
      } else {
        console.log(`❌ Test ${index + 1}: ${testCase.name} - FAILED`);
        console.log(`   Expected: ${testCase.expectedType} -> ${testCase.expectedTarget}`);
        console.log(`   Got: ${assertion.type} -> ${assertion.target}`);
        failed++;
      }
    } else {
      console.log(`❌ Test ${index + 1}: ${testCase.name} - FAILED`);
      console.log(`   Expected 1 assertion, got ${assertions.length}`);
      failed++;
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Test ${index + 1}: ${testCase.name} - ERROR: ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

// Test coverage map integration
console.log('\n🗺️ Testing coverage map integration...');
const combinedSql = testCases.map(tc => tc.sql).join('\n');
const allAssertions = scanner.extractAssertions(combinedSql);

scanner.testFiles = [{
  filePath: '/test/triggers.sql',
  fileName: 'triggers.sql',
  assertions: allAssertions,
  planCount: allAssertions.length,
  dependencies: [],
  metadata: { size: combinedSql.length, lines: combinedSql.split('\n').length, parsed: new Date() }
}];

scanner._buildCoverageMap();
const coverageMap = scanner.getCoverageMap();

console.log(`Found ${Object.keys(coverageMap.triggers || {}).length} triggers in coverage map:`);
Object.keys(coverageMap.triggers || {}).forEach(trigger => {
  const tests = coverageMap.triggers[trigger];
  console.log(`  - ${trigger}: [${tests.join(', ')}]`);
});

const stats = scanner.getStatistics();
console.log(`\nCoverage stats: ${stats.coverageStats.triggersWithTests} triggers with tests`);

if (failed === 0) {
  console.log('\n🎉 All trigger assertion parsing tests passed!');
} else {
  console.log(`\n⚠️ ${failed} tests failed. Please review the implementation.`);
  process.exit(1);
}
