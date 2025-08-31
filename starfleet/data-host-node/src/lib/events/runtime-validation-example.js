#!/usr/bin/env node

/**
 * Runtime Validation Example for D.A.T.A. Event System
 * 
 * This example demonstrates the runtime validation capabilities of the
 * JavaScript Event Classes and how they integrate with the existing
 * Command class architecture.
 * 
 * Run with: node src/lib/events/runtime-validation-example.js
 */

const { EventEmitter } = require('events');
const {
  CommandEvent,
  ProgressEvent,
  ErrorEvent,
  WarningEvent,
  SuccessEvent,
  validateCommandEvent,
  validateEventSafely,
  createCommandEvent,
  createValidatedListener,
  EventTypeGuards
} = require('./index.cjs');

/**
 * Example Command class that demonstrates event system usage
 */
class ExampleCommand extends EventEmitter {
  constructor() {
    super();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Example 1: Runtime validation using instanceof checks
    this.on('progress', (eventData) => {
      // Check if we received an actual ProgressEvent instance
      if (eventData instanceof ProgressEvent) {
        console.log(`✅ Valid ProgressEvent: ${eventData.getFormattedProgress()}`);
        console.log(`   Message: ${eventData.message}`);
        console.log(`   Timestamp: ${eventData.timestamp.toISOString()}`);
      } else {
        console.log('❌ Received non-ProgressEvent data:', typeof eventData);
      }
    });

    // Example 2: Using type guard functions
    this.on('error', (eventData) => {
      if (EventTypeGuards.isErrorEvent(eventData)) {
        console.log(`✅ Valid ErrorEvent: ${eventData.message}`);
        console.log(`   Severity: ${eventData.getSeverity()}`);
        console.log(`   Code: ${eventData.code || 'No code'}`);
      } else {
        console.log('❌ Received non-ErrorEvent data');
      }
    });

    // Example 3: Using validated listener wrapper
    const safeWarningListener = createValidatedListener(
      (event) => {
        console.log(`✅ Validated WarningEvent: ${event.getFormattedMessage()}`);
        console.log(`   Severity: ${event.getSeverity()}`);
        console.log(`   Requires attention: ${event.requiresImmediateAttention()}`);
      },
      WarningEvent,
      false // Non-strict mode for demonstration
    );
    this.on('warning', safeWarningListener);

    // Example 4: Manual validation with error handling
    this.on('success', (eventData) => {
      try {
        validateCommandEvent(eventData, SuccessEvent);
        console.log(`✅ Valid SuccessEvent: ${eventData.message}`);
        console.log(`   Duration: ${eventData.getFormattedDuration() || 'Unknown'}`);
        console.log(`   Has result: ${eventData.hasResult()}`);
      } catch (error) {
        console.log(`❌ Validation failed: ${error.message}`);
      }
    });

    // Example 5: Safe validation that doesn't throw
    this.on('generic', (eventData) => {
      const validation = validateEventSafely(eventData, CommandEvent);
      if (validation.success) {
        console.log(`✅ Valid CommandEvent: ${eventData.toString()}`);
      } else {
        console.log(`❌ Validation failed: ${validation.error}`);
        console.log(`   Expected: ${validation.expectedType}, Got: ${validation.actualType}`);
      }
    });
  }

  /**
   * Demonstrate proper event emission with typed events
   */
  async runDemonstration() {
    console.log('\n=== D.A.T.A. Event System Runtime Validation Demo ===\n');

    // 1. Emit a proper ProgressEvent
    console.log('1. Emitting ProgressEvent:');
    const progressEvent = ProgressEvent.withPercentage('Processing files', 50, 100, {
      operation: 'file-processing',
      stage: 'validation'
    });
    this.emit('progress', progressEvent);

    // 2. Emit a proper ErrorEvent
    console.log('\n2. Emitting ErrorEvent:');
    const errorEvent = ErrorEvent.fromError(
      new Error('Database connection timeout'),
      'Connection failed',
      { database: 'postgresql', timeout: 5000 }
    );
    this.emit('error', errorEvent);

    // 3. Emit a proper WarningEvent
    console.log('\n3. Emitting WarningEvent:');
    const warningEvent = WarningEvent.deprecation(
      'legacyMethod()',
      'newMethod()',
      'v2.0.0',
      { component: 'DataProcessor' }
    );
    this.emit('warning', warningEvent);

    // 4. Emit a proper SuccessEvent
    console.log('\n4. Emitting SuccessEvent:');
    const startTime = new Date(Date.now() - 1500); // Simulate 1.5s operation
    const successEvent = SuccessEvent.withTiming('Operation completed successfully', startTime, {
      filesProcessed: 42,
      migrationsApplied: 3
    });
    this.emit('success', successEvent);

    // 5. Emit using factory function
    console.log('\n5. Emitting event created with factory:');
    const factoryEvent = createCommandEvent('progress', 'Factory-created progress', 75, {
      source: 'factory-method'
    });
    this.emit('progress', factoryEvent);

    // 6. Demonstrate validation failure with wrong type
    console.log('\n6. Demonstrating validation failure:');
    this.emit('progress', { message: 'Not a real ProgressEvent', percentage: 50 });

    // 7. Demonstrate validation with plain objects (backward compatibility)
    console.log('\n7. Testing backward compatibility:');
    this.emit('generic', new CommandEvent('test', 'Valid CommandEvent instance'));
    this.emit('generic', { message: 'Plain object', type: 'test' }); // Should fail validation

    console.log('\n=== Demo Complete ===\n');
  }

  /**
   * Demonstrate Command class integration
   */
  demonstrateCommandIntegration() {
    console.log('\n=== Command Class Integration Example ===\n');

    // Show how the event system integrates with existing Command patterns
    const Command = require('../Command');
    
    // Create a mock command to show integration
    class MockCommand extends Command {
      constructor() {
        super();
        console.log('MockCommand created - events will be typed!');
      }

      async performExecute() {
        // The Command class already uses typed events internally
        this.progress('Starting mock operation', { step: 1 });
        
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.warn('This is a test warning', { level: 'info' });
        this.success('Mock operation completed', { result: 'success' });
        
        return { status: 'completed' };
      }
    }

    // Set up listeners that use runtime validation
    const mockCommand = new MockCommand();
    
    mockCommand.on('progress', (eventData) => {
      // eventData will be in the format emitted by Command.js
      console.log(`Command progress: ${eventData.message}`);
      console.log(`  Type: ${eventData.type}`);
      console.log(`  Timestamp: ${eventData.timestamp}`);
    });

    mockCommand.on('warning', (eventData) => {
      console.log(`Command warning: ${eventData.message}`);
      console.log(`  Data: ${JSON.stringify(eventData.data)}`);
    });

    mockCommand.on('success', (eventData) => {
      console.log(`Command success: ${eventData.message}`);
      console.log(`  Data: ${JSON.stringify(eventData.data)}`);
    });

    // Execute the command
    return mockCommand.execute();
  }
}

/**
 * Run the demonstration
 */
async function runDemo() {
  try {
    const example = new ExampleCommand();
    await example.runDemonstration();
    await example.demonstrateCommandIntegration();
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { ExampleCommand, runDemo };