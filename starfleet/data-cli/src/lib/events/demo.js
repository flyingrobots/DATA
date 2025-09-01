#!/usr/bin/env node
/**
 * @fileoverview Runtime Type Safety Demonstration - JavaScript Event Classes
 * 
 * This demonstration shows off the power of runtime instanceof validation
 * in pure JavaScript without TypeScript compilation overhead. Watch as we
 * create, validate, and manipulate events with complete type safety.
 * 
 * Run with: node src/lib/events/demo.js
 * 
 * @author JavaScript Pro (via Claude Code)
 */

'use strict';

import {
  ProgressEvent,
  ErrorEvent,
  MigrationStartEvent,
  TestResultEvent,
  CoverageEvent,
  validateEvent,
  isEventType,
  createTypeGuard,
  getEventHierarchy,
  EventFactory
} from './index.js';

// =============================================================================
// DEMONSTRATION FUNCTIONS
// =============================================================================

/**
 * Demonstrates basic event creation and validation.
 */
function demonstrateBasicEvents() {
  console.log('\n🚀 === BASIC EVENT CREATION AND VALIDATION ===\n');

  try {
    // Create a progress event
    const progress = new ProgressEvent('Processing database migration...', 45.5, {
      phase: 'schema_validation',
      tablesProcessed: 3,
      totalTables: 7
    });

    console.log('✅ Created ProgressEvent:', progress.toString());
    console.log('📊 Progress:', `${progress.percentage}%`);
    console.log('🔄 Is determinate:', progress.isDeterminate());
    console.log('📈 Completion ratio:', progress.getRatio());

    // Runtime instanceof validation - THIS ACTUALLY WORKS!
    if (progress instanceof ProgressEvent) {
      console.log('🎯 Runtime type check PASSED: instanceof ProgressEvent');
    }

    // Create an error event with full context
    const dbError = new Error('Connection timeout');
    dbError.code = 'ETIMEDOUT';
    
    const error = new ErrorEvent(
      'Database connection failed during migration',
      dbError,
      'DB_CONNECTION_FAILED',
      { 
        host: 'localhost',
        port: 5432,
        database: 'test_migrations',
        retryCount: 3
      }
    );

    console.log('❌ Created ErrorEvent:', error.toString());
    console.log('🔍 Has error object:', error.hasErrorObject());
    console.log('📋 Error code:', error.code);
    console.log('🔢 Original error code:', error.error.code);

  } catch (err) {
    console.error('💥 Demonstration failed:', err.message);
  }
}

/**
 * Demonstrates migration-specific events.
 */
function demonstrateMigrationEvents() {
  console.log('\n🗄️ === MIGRATION EVENT LIFECYCLE ===\n');

  try {
    // Migration starts
    const migrationStart = new MigrationStartEvent(
      'Starting migration 004_add_user_preferences',
      {
        migrationId: '004',
        migrationName: 'add_user_preferences',
        version: '1.4.0',
        tables: ['users', 'user_preferences'],
        operations: ['CREATE_TABLE', 'ALTER_TABLE', 'CREATE_INDEX'],
        estimatedDuration: 15000,
        schema: 'public'
      }
    );

    console.log('🎬 Migration started:', migrationStart.toString());
    console.log('🎯 Migration ID:', migrationStart.migrationId);
    console.log('🏗️ Operations:', migrationStart.operations.join(', '));
    console.log('⏰ Estimated completion:', migrationStart.getEstimatedCompletion());
    console.log('📊 Affects user tables:', migrationStart.affectsTables(['users', 'profiles']));

    // Runtime validation of migration event
    validateEvent(migrationStart, MigrationStartEvent);
    console.log('✅ Migration event validation PASSED');

  } catch (err) {
    console.error('💥 Migration demonstration failed:', err.message);
  }
}

/**
 * Demonstrates test execution events.
 */
function demonstrateTestEvents() {
  console.log('\n🧪 === TEST EXECUTION EVENTS ===\n');

  try {
    // Test results
    const testResults = new TestResultEvent(
      'User management test suite completed',
      {
        testSuite: 'user_management',
        totalTests: 42,
        passedTests: 38,
        failedTests: 3,
        skippedTests: 1,
        duration: 2340,
        coverage: 87.5,
        framework: 'pgTAP',
        failures: [
          { test: 'test_user_deletion', reason: 'Foreign key constraint' },
          { test: 'test_email_validation', reason: 'Invalid regex pattern' }
        ]
      }
    );

    console.log('🎯 Test completed:', testResults.toString());
    console.log('📈 Success rate:', `${testResults.getSuccessRate()}%`);
    console.log('✅ All tests passed:', testResults.allTestsPassed());
    
    const metrics = testResults.getMetrics();
    console.log('📊 Test metrics:', {
      total: metrics.total,
      passed: metrics.passed,
      failed: metrics.failed,
      duration: `${metrics.duration}ms`,
      coverage: `${metrics.coverage}%`,
      speed: `${metrics.testsPerSecond} tests/sec`
    });

    console.log('🔥 Failures:', testResults.getFailures().length);

    // Coverage analysis
    const coverage = new CoverageEvent(
      'Code coverage analysis completed',
      {
        linesCovered: 1847,
        totalLines: 2156,
        functionsCovered: 89,
        totalFunctions: 103,
        branchesCovered: 234,
        totalBranches: 267,
        threshold: 80,
        meetsThreshold: true
      }
    );

    console.log('📏 Coverage analysis:', coverage.toString());
    console.log('📈 Line coverage:', `${coverage.getLineCoverage()}%`);
    console.log('🎯 Function coverage:', `${coverage.getFunctionCoverage()}%`);
    console.log('🔀 Branch coverage:', `${coverage.getBranchCoverage()}%`);
    console.log('✅ Meets threshold:', coverage.meetsThreshold());

    const summary = coverage.getSummary();
    console.log('📊 Coverage summary:', {
      overall: `${summary.overall}%`,
      threshold: `${summary.threshold}%`,
      meetsThreshold: summary.meetsThreshold
    });

  } catch (err) {
    console.error('💥 Test demonstration failed:', err.message);
  }
}

/**
 * Demonstrates runtime type checking utilities.
 */
function demonstrateTypeChecking() {
  console.log('\n🔍 === RUNTIME TYPE CHECKING MAGIC ===\n');

  const events = [
    new ProgressEvent('Loading...', 25),
    new ErrorEvent('Something went wrong', new Error('Test error')),
    new MigrationStartEvent('Starting migration', { migrationId: '001' }),
    new TestResultEvent('Tests done', { totalTests: 10, passedTests: 10 })
  ];

  console.log('🎯 Created mixed event array with', events.length, 'events');

  // Type checking with isEventType
  events.forEach((event, index) => {
    console.log(`\n📋 Event ${index + 1}:`);
    console.log('  Type:', event.constructor.name);
    console.log('  Message:', event.message);
    console.log('  Is ProgressEvent:', isEventType(event, ProgressEvent));
    console.log('  Is ErrorEvent:', isEventType(event, ErrorEvent));
    console.log('  Is Migration/Test event:', isEventType(event, [MigrationStartEvent, TestResultEvent]));
  });

  // Type guards in action
  const isProgress = createTypeGuard(ProgressEvent);
  const progressEvents = events.filter(isProgress);
  console.log('\n🎯 Found', progressEvents.length, 'progress events using type guard');

  // Event hierarchy analysis
  events.forEach((event, index) => {
    const hierarchy = getEventHierarchy(event);
    console.log(`\n🏗️ Event ${index + 1} hierarchy:`, hierarchy.join(' → '));
  });
}

/**
 * Demonstrates advanced validation scenarios.
 */
function demonstrateAdvancedValidation() {
  console.log('\n🛡️ === ADVANCED VALIDATION SCENARIOS ===\n');

  try {
    // Valid event
    const validEvent = EventFactory.progress('Processing...', 75, { phase: 'final' });
    console.log('✅ Factory created valid event:', validEvent.constructor.name);

    // Validate with strict mode
    const strictResult = validateEvent(validEvent, ProgressEvent, { 
      strict: true, 
      throwOnError: false 
    });
    console.log('🔍 Strict validation result:', strictResult.valid ? 'PASSED' : 'FAILED');

    // Test invalid percentage
    try {
      new ProgressEvent('Invalid progress', 150); // Over 100%
    } catch (error) {
      console.log('❌ Caught invalid percentage error:', error.message);
    }

    // Test multiple type validation
    const mixedTypes = [ProgressEvent, ErrorEvent];
    const testEvent = new ProgressEvent('Test', 50);
    const multiResult = validateEvent(testEvent, mixedTypes, { throwOnError: false });
    console.log('🎯 Multi-type validation:', multiResult.valid ? 'PASSED' : 'FAILED');

    // Event immutability test
    const immutableEvent = new ProgressEvent('Immutable test', 25);
    console.log('🔒 Event is frozen (immutable):', Object.isFrozen(immutableEvent));
    
    try {
      immutableEvent.message = 'Try to change this'; // Should fail silently or throw
      console.log('🛡️ Immutability preserved - message unchanged:', immutableEvent.message);
    } catch (error) {
      console.log('🔐 Immutability enforced:', error.message);
    }

  } catch (err) {
    console.error('💥 Advanced validation failed:', err.message);
  }
}

/**
 * Demonstrates event serialization and JSON handling.
 */
function demonstrateEventSerialization() {
  console.log('\n📤 === EVENT SERIALIZATION AND JSON ===\n');

  try {
    const event = new MigrationStartEvent(
      'Complex migration with rich data',
      {
        migrationId: '007',
        operations: ['CREATE_TABLE', 'CREATE_INDEX'],
        metadata: { priority: 'high', category: 'schema' }
      }
    );

    // JSON serialization
    const json = event.toJSON();
    console.log('📄 Event JSON:', JSON.stringify(json, null, 2));

    // Verify JSON structure
    console.log('✅ JSON has type:', Boolean(json.type));
    console.log('✅ JSON has message:', Boolean(json.message));
    console.log('✅ JSON has timestamp:', Boolean(json.timestamp));
    console.log('✅ JSON has details:', Boolean(json.details));

    // String representation
    console.log('🔤 String representation:', event.toString());

    // Demonstrate event cloning with new details
    const updatedEvent = event.withDetails({ phase: 'execution', progress: 0.5 });
    console.log('🔄 Cloned event with updates:', updatedEvent.toString());
    console.log('🔒 Original event unchanged:', event.details.phase === undefined);
    console.log('✨ New event has updates:', updatedEvent.details.phase === 'execution');

  } catch (err) {
    console.error('💥 Serialization demonstration failed:', err.message);
  }
}

// =============================================================================
// MAIN DEMONSTRATION
// =============================================================================

function runDemonstration() {
  console.log('🎉 === JAVASCRIPT EVENT CLASSES - RUNTIME TYPE SAFETY DEMO ===');
  console.log('📝 Demonstrating instanceof validation, immutability, and zero-dependency events\n');

  demonstrateBasicEvents();
  demonstrateMigrationEvents();
  demonstrateTestEvents();
  demonstrateTypeChecking();
  demonstrateAdvancedValidation();
  demonstrateEventSerialization();

  console.log('\n🎯 === DEMONSTRATION COMPLETE ===');
  console.log('💪 JavaScript events with runtime type safety - NO TYPESCRIPT REQUIRED!');
  console.log('🚀 Zero build step, zero dependencies, 100% runtime validation');
  console.log('⚡ This is the power of PHENOMENAL JavaScript!\n');
}

// Run demo if this file is executed directly  
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemonstration();
}

export { runDemonstration };