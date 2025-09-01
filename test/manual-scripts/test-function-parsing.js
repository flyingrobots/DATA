#!/usr/bin/env node
/**
 * Simple test script to verify function parsing works correctly
 */

import pgTAPTestScanner from './src/lib/testing/pgTAPTestScanner.js';

function runTest(name, testFn) {
  try {
    console.log(`\n--- Running: ${name} ---`);
    testFn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`
    );
  }
}

const scanner = new pgTAPTestScanner({ validatePlans: false });

// Test basic has_function parsing
runTest('has_function with function name only', () => {
  const sql = "SELECT has_function('user_count');";
  const assertions = scanner.extractAssertions(sql);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'has_function', 'Should be has_function type');
  assertEquals(assertions[0].target, 'user_count', 'Should have correct target');
  assertEquals(assertions[0].functionMetadata.name, 'user_count', 'Should extract function name');
});

// Test has_function with schema
runTest('has_function with schema and function name', () => {
  const sql = "SELECT has_function('public', 'user_count');";
  const assertions = scanner.extractAssertions(sql);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'has_function', 'Should be has_function type');
  assertEquals(assertions[0].target, 'public.user_count', 'Should have correct target');
  assertEquals(assertions[0].functionMetadata.schema, 'public', 'Should extract schema');
  assertEquals(assertions[0].functionMetadata.name, 'user_count', 'Should extract function name');
});

// Test has_function with parameters
runTest('has_function with parameters', () => {
  const sql = "SELECT has_function('user_count', ARRAY['integer', 'text']);";
  const assertions = scanner.extractAssertions(sql);

  console.log('DEBUG - Parameters:', assertions[0].parameters);
  console.log('DEBUG - Function metadata:', assertions[0].functionMetadata);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'has_function', 'Should be has_function type');
  assertEquals(assertions[0].target, 'user_count', 'Should have correct target');
  assertEquals(assertions[0].functionMetadata.name, 'user_count', 'Should extract function name');
  assertEquals(
    assertions[0].functionMetadata.parameters,
    ['integer', 'text'],
    'Should extract parameters'
  );
});

// Test function_returns
runTest('function_returns parsing', () => {
  const sql = "SELECT function_returns('user_count', 'integer');";
  const assertions = scanner.extractAssertions(sql);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'function_returns', 'Should be function_returns type');
  assertEquals(assertions[0].target, 'user_count', 'Should have correct target');
  assertEquals(assertions[0].functionMetadata.name, 'user_count', 'Should extract function name');
  assertEquals(assertions[0].functionMetadata.returnType, 'integer', 'Should extract return type');
});

// Test function_lang_is
runTest('function_lang_is parsing', () => {
  const sql = "SELECT function_lang_is('user_count', 'plpgsql');";
  const assertions = scanner.extractAssertions(sql);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'function_lang_is', 'Should be function_lang_is type');
  assertEquals(assertions[0].target, 'user_count', 'Should have correct target');
  assertEquals(assertions[0].functionMetadata.name, 'user_count', 'Should extract function name');
  assertEquals(assertions[0].functionMetadata.language, 'plpgsql', 'Should extract language');
});

// Test is_definer
runTest('is_definer parsing', () => {
  const sql = "SELECT is_definer('secure_function');";
  const assertions = scanner.extractAssertions(sql);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'is_definer', 'Should be is_definer type');
  assertEquals(assertions[0].target, 'secure_function', 'Should have correct target');
  assertEquals(
    assertions[0].functionMetadata.name,
    'secure_function',
    'Should extract function name'
  );
  assertEquals(
    assertions[0].functionMetadata.isSecurityDefiner,
    true,
    'Should mark as security definer'
  );
});

// Test volatility_is
runTest('volatility_is parsing', () => {
  const sql = "SELECT volatility_is('pure_function', 'immutable');";
  const assertions = scanner.extractAssertions(sql);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'volatility_is', 'Should be volatility_is type');
  assertEquals(assertions[0].target, 'pure_function', 'Should have correct target');
  assertEquals(
    assertions[0].functionMetadata.name,
    'pure_function',
    'Should extract function name'
  );
  assertEquals(assertions[0].functionMetadata.volatility, 'immutable', 'Should extract volatility');
});

// Test function_privs_are
runTest('function_privs_are parsing', () => {
  const sql = "SELECT function_privs_are('calc_func', 'app_user', ARRAY['EXECUTE']);";
  const assertions = scanner.extractAssertions(sql);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'function_privs_are', 'Should be function_privs_are type');
  assertEquals(assertions[0].target, 'calc_func', 'Should have correct target');
  assertEquals(assertions[0].functionMetadata.name, 'calc_func', 'Should extract function name');
  assertEquals(assertions[0].functionMetadata.role, 'app_user', 'Should extract role');
  assertEquals(assertions[0].functionMetadata.privileges, ['EXECUTE'], 'Should extract privileges');
});

// Test complex function example
runTest('complex function parsing', () => {
  const sql =
    "SELECT function_returns('public', 'complex_func', ARRAY['text', 'integer'], 'boolean');";
  const assertions = scanner.extractAssertions(sql);

  assertEquals(assertions.length, 1, 'Should have 1 assertion');
  assertEquals(assertions[0].type, 'function_returns', 'Should be function_returns type');
  assertEquals(assertions[0].target, 'public.complex_func', 'Should have correct target');
  assertEquals(assertions[0].functionMetadata.schema, 'public', 'Should extract schema');
  assertEquals(assertions[0].functionMetadata.name, 'complex_func', 'Should extract function name');
  assertEquals(
    assertions[0].functionMetadata.parameters,
    ['text', 'integer'],
    'Should extract parameters'
  );
  assertEquals(assertions[0].functionMetadata.returnType, 'boolean', 'Should extract return type');
});

console.log('\n🎯 Function parsing tests completed!');
