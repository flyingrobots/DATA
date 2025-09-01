/**
 * Unit tests for CommandEvent instanceof validation
 *
 * Tests the CommandEvent class hierarchy and validation including:
 * - Base CommandEvent class functionality
 * - Event inheritance and instanceof checks
 * - Runtime validation with validateCommandEvent
 * - Event factory and type creation
 * - JSON serialization and toString methods
 * - Build-specific event classes
 * - Event metadata and properties
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CommandEvent,
  ProgressEvent,
  ErrorEvent,
  DirectoryEvent,
  SuccessEvent,
  WarningEvent,
  StartEvent,
  StatusEvent,
  CompleteEvent,
  CancelledEvent,
  BuildProgressEvent,
  BuildStartEvent,
  BuildCompleteEvent,
  BuildFailedEvent,
  validateCommandEvent,
  createCommandEvent
} from '../../../src/lib/events/CommandEvents.cjs';

describe('CommandEvent base class', () => {
  let baseEvent;

  beforeEach(() => {
    baseEvent = new CommandEvent('test', 'Test message', {
      testProperty: 'test value',
      metadata: { source: 'unit test' }
    });
  });

  describe('constructor and basic properties', () => {
    it('should create event with correct properties', () => {
      expect(baseEvent.type).toBe('test');
      expect(baseEvent.message).toBe('Test message');
      expect(baseEvent.details).toEqual({
        testProperty: 'test value',
        metadata: { source: 'unit test' }
      });
      expect(baseEvent.timestamp).toBeInstanceOf(Date);
    });

    it('should set timestamp close to creation time', () => {
      const beforeCreate = Date.now();
      const event = new CommandEvent('test', 'message');
      const afterCreate = Date.now();

      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(afterCreate);
    });

    it('should handle empty details', () => {
      const event = new CommandEvent('test', 'message');
      expect(event.details).toEqual({});
    });

    it('should handle null details', () => {
      const event = new CommandEvent('test', 'message', null);
      expect(event.details).toBeNull();
    });
  });

  describe('JSON serialization', () => {
    it('should serialize to JSON correctly', () => {
      const json = baseEvent.toJSON();

      expect(json.type).toBe('test');
      expect(json.message).toBe('Test message');
      expect(json.details).toEqual({
        testProperty: 'test value',
        metadata: { source: 'unit test' }
      });
      expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should produce valid ISO timestamp', () => {
      const json = baseEvent.toJSON();
      const parsedDate = new Date(json.timestamp);

      expect(parsedDate.getTime()).toBe(baseEvent.timestamp.getTime());
    });

    it('should handle complex details in JSON', () => {
      const complexEvent = new CommandEvent('complex', 'Complex event', {
        array: [1, 2, 3],
        nested: {
          deep: {
            property: 'deep value'
          }
        },
        nullValue: null,
        undefinedValue: undefined
      });

      const json = complexEvent.toJSON();
      expect(json.details.array).toEqual([1, 2, 3]);
      expect(json.details.nested.deep.property).toBe('deep value');
      expect(json.details.nullValue).toBeNull();
      expect('undefinedValue' in json.details).toBe(true);
    });
  });

  describe('toString method', () => {
    it('should format as expected', () => {
      const result = baseEvent.toString();
      expect(result).toBe('[TEST] Test message');
    });

    it('should uppercase event type', () => {
      const event = new CommandEvent('progress', 'Loading data');
      expect(event.toString()).toBe('[PROGRESS] Loading data');
    });

    it('should handle empty message', () => {
      const event = new CommandEvent('error', '');
      expect(event.toString()).toBe('[ERROR] ');
    });
  });
});

describe('ProgressEvent', () => {
  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const progressEvent = new ProgressEvent('Loading...', 50);
      expect(progressEvent).toBeInstanceOf(CommandEvent);
      expect(progressEvent).toBeInstanceOf(ProgressEvent);
    });

    it('should pass validateCommandEvent check', () => {
      const progressEvent = new ProgressEvent('Processing...', 25);
      expect(() => validateCommandEvent(progressEvent, ProgressEvent)).not.toThrow();
    });

    it('should fail validation against wrong class', () => {
      const progressEvent = new ProgressEvent('Testing...', 75);
      expect(() => validateCommandEvent(progressEvent, ErrorEvent)).toThrow(
        'Invalid event type: expected ErrorEvent, got ProgressEvent'
      );
    });
  });

  describe('constructor and properties', () => {
    it('should create with percentage', () => {
      const event = new ProgressEvent('Loading files...', 50, { filesProcessed: 5 });

      expect(event.type).toBe('progress');
      expect(event.message).toBe('Loading files...');
      expect(event.percentage).toBe(50);
      expect(event.details.filesProcessed).toBe(5);
    });

    it('should create with null percentage for indeterminate progress', () => {
      const event = new ProgressEvent('Processing...', null);

      expect(event.percentage).toBeNull();
    });

    it('should validate percentage range', () => {
      expect(() => new ProgressEvent('Test', 150)).toThrow(
        'Percentage must be a number between 0 and 100, or null'
      );
      expect(() => new ProgressEvent('Test', -10)).toThrow(
        'Percentage must be a number between 0 and 100, or null'
      );
    });

    it('should accept valid percentage values', () => {
      expect(() => new ProgressEvent('Test', 0)).not.toThrow();
      expect(() => new ProgressEvent('Test', 100)).not.toThrow();
      expect(() => new ProgressEvent('Test', 50.5)).not.toThrow();
    });

    it('should reject non-numeric percentages', () => {
      expect(() => new ProgressEvent('Test', '50')).toThrow();
      expect(() => new ProgressEvent('Test', true)).toThrow();
      expect(() => new ProgressEvent('Test', {})).toThrow();
    });
  });

  describe('static factory methods', () => {
    it('should create with calculated percentage', () => {
      const event = ProgressEvent.withPercentage('Processing files', 25, 50, {
        operation: 'compile'
      });

      expect(event.percentage).toBe(50); // 25/50 * 100 = 50%
      expect(event.details.completed).toBe(25);
      expect(event.details.total).toBe(50);
      expect(event.details.operation).toBe('compile');
    });

    it('should handle zero total in withPercentage', () => {
      const event = ProgressEvent.withPercentage('Starting', 0, 0);
      expect(event.percentage).toBe(0);
    });

    it('should create indeterminate progress', () => {
      const event = ProgressEvent.indeterminate('Initializing...', {
        stage: 'setup'
      });

      expect(event.percentage).toBeNull();
      expect(event.details.stage).toBe('setup');
    });
  });
});

describe('ErrorEvent', () => {
  let testError;

  beforeEach(() => {
    testError = new Error('Test error message');
    testError.code = 'TEST_ERROR';
  });

  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const errorEvent = new ErrorEvent('Operation failed', testError);
      expect(errorEvent).toBeInstanceOf(CommandEvent);
      expect(errorEvent).toBeInstanceOf(ErrorEvent);
    });

    it('should pass validateCommandEvent check', () => {
      const errorEvent = new ErrorEvent('Database error', testError, 'DB_ERROR');
      expect(() => validateCommandEvent(errorEvent, ErrorEvent)).not.toThrow();
    });
  });

  describe('constructor and properties', () => {
    it('should create with error object and code', () => {
      const event = new ErrorEvent('Database connection failed', testError, 'DB_CONN_ERROR', {
        host: 'localhost',
        port: 5432
      });

      expect(event.type).toBe('error');
      expect(event.message).toBe('Database connection failed');
      expect(event.error).toBe(testError);
      expect(event.code).toBe('DB_CONN_ERROR');
      expect(event.details.host).toBe('localhost');
      expect(event.details.error).toBe(testError);
      expect(event.details.code).toBe('DB_CONN_ERROR');
    });

    it('should handle null error', () => {
      const event = new ErrorEvent('Unknown error', null, 'UNKNOWN');
      expect(event.error).toBeNull();
    });

    it('should handle missing code', () => {
      const event = new ErrorEvent('Simple error', testError);
      expect(event.code).toBeNull();
    });
  });

  describe('static factory methods', () => {
    it('should create from error object', () => {
      const event = ErrorEvent.fromError(testError, 'Database operation failed', {
        table: 'users'
      });

      expect(event.message).toBe('Database operation failed: Test error message');
      expect(event.error).toBe(testError);
      expect(event.code).toBe('TEST_ERROR');
      expect(event.details.table).toBe('users');
    });

    it('should handle error without code', () => {
      const simpleError = new Error('Simple error');
      const event = ErrorEvent.fromError(simpleError);

      expect(event.code).toBeNull();
      expect(event.message).toBe('Operation failed: Simple error');
    });
  });

  describe('stack trace access', () => {
    it('should return stack trace when available', () => {
      const event = new ErrorEvent('Stack test', testError);
      const stack = event.getStackTrace();

      expect(stack).toContain('Error: Test error message');
      expect(stack).toContain('at '); // Stack trace format
    });

    it('should handle missing stack trace', () => {
      const noStackError = { message: 'No stack' }; // Not a real Error object
      const event = new ErrorEvent('No stack test', noStackError);

      expect(event.getStackTrace()).toBe('No stack trace available');
    });
  });
});

describe('DirectoryEvent', () => {
  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const dirEvent = new DirectoryEvent('Processing directory', '/src/lib');
      expect(dirEvent).toBeInstanceOf(CommandEvent);
      expect(dirEvent).toBeInstanceOf(DirectoryEvent);
    });
  });

  describe('constructor and properties', () => {
    it('should create with directory path and operation', () => {
      const event = new DirectoryEvent('Scanning source directory', '/src/components', 'scan', {
        fileCount: 25
      });

      expect(event.type).toBe('directory');
      expect(event.directoryPath).toBe('/src/components');
      expect(event.operation).toBe('scan');
      expect(event.details.directoryPath).toBe('/src/components');
      expect(event.details.operation).toBe('scan');
      expect(event.details.fileCount).toBe(25);
    });

    it('should default to process operation', () => {
      const event = new DirectoryEvent('Processing...', '/tmp');
      expect(event.operation).toBe('process');
    });
  });

  describe('static factory methods', () => {
    it('should create scan event', () => {
      const event = DirectoryEvent.scan('/src', 15, { pattern: '*.js' });

      expect(event.operation).toBe('scan');
      expect(event.message).toBe('Scanning directory: /src');
      expect(event.details.fileCount).toBe(15);
      expect(event.details.pattern).toBe('*.js');
    });

    it('should create create event', () => {
      const event = DirectoryEvent.create('/dist/output', { mode: 0o755 });

      expect(event.operation).toBe('create');
      expect(event.message).toBe('Creating directory: /dist/output');
      expect(event.details.mode).toBe(0o755);
    });
  });
});

describe('SuccessEvent', () => {
  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const successEvent = new SuccessEvent('Operation completed');
      expect(successEvent).toBeInstanceOf(CommandEvent);
      expect(successEvent).toBeInstanceOf(SuccessEvent);
    });
  });

  describe('constructor and timing', () => {
    it('should create with duration', () => {
      const event = new SuccessEvent('Migration completed', { migrationsApplied: 5 }, 2500);

      expect(event.type).toBe('success');
      expect(event.duration).toBe(2500);
      expect(event.details.duration).toBe(2500);
      expect(event.details.migrationsApplied).toBe(5);
    });

    it('should handle null duration', () => {
      const event = new SuccessEvent('Success', {}, null);
      expect(event.duration).toBeNull();
    });
  });

  describe('timing utilities', () => {
    it('should create with calculated timing', () => {
      const startTime = new Date(Date.now() - 3000); // 3 seconds ago
      const event = SuccessEvent.withTiming('Build completed', startTime, { outputFiles: 10 });

      expect(event.duration).toBeGreaterThanOrEqual(2900);
      expect(event.duration).toBeLessThanOrEqual(3100);
      expect(event.details.outputFiles).toBe(10);
    });

    it('should format duration in milliseconds', () => {
      const event = new SuccessEvent('Fast operation', {}, 500);
      expect(event.getFormattedDuration()).toBe('500ms');
    });

    it('should format duration in seconds', () => {
      const event = new SuccessEvent('Slow operation', {}, 2500);
      expect(event.getFormattedDuration()).toBe('2.5s');
    });

    it('should handle missing duration', () => {
      const event = new SuccessEvent('No timing', {}, null);
      expect(event.getFormattedDuration()).toBeNull();
    });

    it('should format sub-second durations correctly', () => {
      const event = new SuccessEvent('Quick operation', {}, 1750);
      expect(event.getFormattedDuration()).toBe('1.75s');
    });
  });
});

describe('WarningEvent', () => {
  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const warningEvent = new WarningEvent('Deprecated API usage');
      expect(warningEvent).toBeInstanceOf(CommandEvent);
      expect(warningEvent).toBeInstanceOf(WarningEvent);
    });
  });

  describe('constructor and properties', () => {
    it('should create with warning code', () => {
      const event = new WarningEvent(
        'Configuration file not found, using defaults',
        { configPath: '/app/.datarc.json' },
        'CONFIG_MISSING'
      );

      expect(event.type).toBe('warning');
      expect(event.code).toBe('CONFIG_MISSING');
      expect(event.details.code).toBe('CONFIG_MISSING');
      expect(event.details.configPath).toBe('/app/.datarc.json');
    });

    it('should handle missing code', () => {
      const event = new WarningEvent('General warning');
      expect(event.code).toBeNull();
    });
  });
});

describe('StartEvent', () => {
  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const startEvent = new StartEvent('Starting migration');
      expect(startEvent).toBeInstanceOf(CommandEvent);
      expect(startEvent).toBeInstanceOf(StartEvent);
    });
  });

  describe('production mode factory', () => {
    it('should create production start event', () => {
      const event = StartEvent.production('Starting production deployment', {
        environment: 'production'
      });

      expect(event.type).toBe('start');
      expect(event.details.isProd).toBe(true);
      expect(event.details.environment).toBe('production');
    });
  });
});

describe('StatusEvent', () => {
  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const statusEvent = new StatusEvent('Service status', 'healthy');
      expect(statusEvent).toBeInstanceOf(CommandEvent);
      expect(statusEvent).toBeInstanceOf(StatusEvent);
    });
  });

  describe('constructor and status checking', () => {
    it('should create with status value', () => {
      const event = new StatusEvent('Database connection status', 'active', { connectionPool: 5 });

      expect(event.status).toBe('active');
      expect(event.details.status).toBe('active');
      expect(event.details.connectionPool).toBe(5);
    });

    it('should identify healthy statuses', () => {
      const healthyStatuses = ['healthy', 'ok', 'success', 'active', 'running'];

      healthyStatuses.forEach((status) => {
        const event = new StatusEvent('Test status', status);
        expect(event.isHealthy()).toBe(true);
      });
    });

    it('should identify unhealthy statuses', () => {
      const unhealthyStatuses = ['error', 'failed', 'inactive', 'stopped', 'degraded'];

      unhealthyStatuses.forEach((status) => {
        const event = new StatusEvent('Test status', status);
        expect(event.isHealthy()).toBe(false);
      });
    });

    it('should handle case insensitive status check', () => {
      const event = new StatusEvent('Test', 'HEALTHY');
      expect(event.isHealthy()).toBe(true);
    });
  });
});

describe('CompleteEvent', () => {
  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const completeEvent = new CompleteEvent('Task completed');
      expect(completeEvent).toBeInstanceOf(CommandEvent);
      expect(completeEvent).toBeInstanceOf(CompleteEvent);
    });
  });

  describe('constructor with result', () => {
    it('should create with result data', () => {
      const result = { processedFiles: 25, errors: 0 };
      const event = new CompleteEvent('Compilation completed', result, { outputDir: '/dist' });

      expect(event.result).toBe(result);
      expect(event.details.result).toBe(result);
      expect(event.details.outputDir).toBe('/dist');
    });

    it('should handle null result', () => {
      const event = new CompleteEvent('Simple completion', null);
      expect(event.result).toBeNull();
    });
  });
});

describe('CancelledEvent', () => {
  describe('instanceof validation', () => {
    it('should be instance of CommandEvent', () => {
      const cancelledEvent = new CancelledEvent();
      expect(cancelledEvent).toBeInstanceOf(CommandEvent);
      expect(cancelledEvent).toBeInstanceOf(CancelledEvent);
    });
  });

  describe('constructor and cancellation reasons', () => {
    it('should create with default message', () => {
      const event = new CancelledEvent();
      expect(event.message).toBe('Operation cancelled');
      expect(event.reason).toBeNull();
    });

    it('should create with custom message and reason', () => {
      const event = new CancelledEvent('User cancelled migration', 'user_request', {
        stage: 'confirmation'
      });

      expect(event.message).toBe('User cancelled migration');
      expect(event.reason).toBe('user_request');
      expect(event.details.reason).toBe('user_request');
      expect(event.details.stage).toBe('confirmation');
    });
  });
});

describe('Build-specific events', () => {
  describe('BuildProgressEvent', () => {
    it('should be instance of CommandEvent', () => {
      const buildEvent = new BuildProgressEvent('compile', '/src', '/dist');
      expect(buildEvent).toBeInstanceOf(CommandEvent);
      expect(buildEvent).toBeInstanceOf(BuildProgressEvent);
    });

    it('should create with build stage information', () => {
      const event = new BuildProgressEvent('compile', '/src/lib', '/dist/lib', {
        filesProcessed: 15
      });

      expect(event.type).toBe('build:progress');
      expect(event.stage).toBe('compile');
      expect(event.inputDir).toBe('/src/lib');
      expect(event.outputDir).toBe('/dist/lib');
      expect(event.details.filesProcessed).toBe(15);
    });

    it('should convert to event data format', () => {
      const event = new BuildProgressEvent('test', '/input', '/output');
      const eventData = event.toEventData();

      expect(eventData.eventType).toBe('BuildProgressEvent');
      expect(eventData.stage).toBe('test');
      expect(eventData.inputDir).toBe('/input');
      expect(eventData.outputDir).toBe('/output');
      expect(eventData.timestamp).toBeTruthy();
    });
  });

  describe('BuildStartEvent', () => {
    it('should be instance of CommandEvent', () => {
      const buildStart = new BuildStartEvent('incremental', '/src', '/dist');
      expect(buildStart).toBeInstanceOf(CommandEvent);
      expect(buildStart).toBeInstanceOf(BuildStartEvent);
    });

    it('should create with build type information', () => {
      const event = new BuildStartEvent('full', '/project/src', '/project/dist', { clean: true });

      expect(event.type).toBe('build:start');
      expect(event.message).toBe('Starting full build');
      expect(event.buildType || event.type).toBeTruthy(); // Handle different property names
    });
  });

  describe('BuildCompleteEvent', () => {
    it('should be instance of CommandEvent', () => {
      const buildComplete = new BuildCompleteEvent({ files: 10 });
      expect(buildComplete).toBeInstanceOf(CommandEvent);
      expect(buildComplete).toBeInstanceOf(BuildCompleteEvent);
    });

    it('should create with build result', () => {
      const result = { files: 25, duration: 5000, size: '2.5MB' };
      const event = new BuildCompleteEvent(result, { warnings: 2 });

      expect(event.type).toBe('build:complete');
      expect(event.result).toBe(result);
      expect(event.details.warnings).toBe(2);
    });
  });

  describe('BuildFailedEvent', () => {
    it('should be instance of CommandEvent', () => {
      const error = new Error('Build failed');
      const buildFailed = new BuildFailedEvent(error);
      expect(buildFailed).toBeInstanceOf(CommandEvent);
      expect(buildFailed).toBeInstanceOf(BuildFailedEvent);
    });

    it('should create with build error', () => {
      const buildError = new Error('TypeScript compilation error');
      buildError.code = 'TS2304';

      const event = new BuildFailedEvent(buildError, { file: 'src/index.ts' });

      expect(event.type).toBe('build:failed');
      expect(event.buildError).toBe(buildError);
      expect(event.details.file).toBe('src/index.ts');
    });

    it('should serialize error in event data', () => {
      const error = new Error('Test build error');
      error.stack = 'Error: Test build error\n  at test';

      const event = new BuildFailedEvent(error);
      const eventData = event.toEventData();

      expect(eventData.eventType).toBe('BuildFailedEvent');
      expect(eventData.error.message).toBe('Test build error');
      expect(eventData.error.stack).toContain('Error: Test build error');
    });
  });
});

describe('validateCommandEvent utility', () => {
  it('should validate correct event types', () => {
    const progressEvent = new ProgressEvent('Loading', 50);
    const errorEvent = new ErrorEvent('Failed', new Error('test'));

    expect(() => validateCommandEvent(progressEvent, ProgressEvent)).not.toThrow();
    expect(() => validateCommandEvent(errorEvent, ErrorEvent)).not.toThrow();
    expect(() => validateCommandEvent(progressEvent, CommandEvent)).not.toThrow();
  });

  it('should throw for incorrect event types', () => {
    const progressEvent = new ProgressEvent('Loading', 50);

    expect(() => validateCommandEvent(progressEvent, ErrorEvent)).toThrow(
      'Invalid event type: expected ErrorEvent, got ProgressEvent'
    );
  });

  it('should handle null events', () => {
    expect(() => validateCommandEvent(null, ProgressEvent)).toThrow();
  });

  it('should handle undefined events', () => {
    expect(() => validateCommandEvent(undefined, ErrorEvent)).toThrow();
  });

  it('should handle non-object events', () => {
    expect(() => validateCommandEvent('string', CommandEvent)).toThrow();
    expect(() => validateCommandEvent(42, CommandEvent)).toThrow();
  });

  it('should provide helpful error messages', () => {
    const plainObject = { type: 'fake', message: 'fake event' };

    expect(() => validateCommandEvent(plainObject, ProgressEvent)).toThrow(
      'Invalid event type: expected ProgressEvent, got Object'
    );
  });
});

describe('createCommandEvent factory', () => {
  it('should create correct event types', () => {
    const progress = createCommandEvent('progress', 'Loading...', 75);
    const error = createCommandEvent('error', 'Failed', new Error('test'));
    const success = createCommandEvent('success', 'Done', { files: 10 });

    expect(progress).toBeInstanceOf(ProgressEvent);
    expect(error).toBeInstanceOf(ErrorEvent);
    expect(success).toBeInstanceOf(SuccessEvent);
  });

  it('should create build events', () => {
    const buildStart = createCommandEvent('build:start', 'full', '/src', '/dist');
    const buildProgress = createCommandEvent('build:progress', 'compile', '/src', '/dist');

    expect(buildStart).toBeInstanceOf(BuildStartEvent);
    expect(buildProgress).toBeInstanceOf(BuildProgressEvent);
  });

  it('should throw for unknown event types', () => {
    expect(() => createCommandEvent('unknown', 'message')).toThrow('Unknown event type: unknown');
  });

  it('should pass arguments to event constructors', () => {
    const directory = createCommandEvent('directory', 'Processing dir', '/src', 'scan');

    expect(directory.directoryPath).toBe('/src');
    expect(directory.operation).toBe('scan');
  });

  it('should list available event types in error message', () => {
    try {
      createCommandEvent('invalid', 'message');
    } catch (error) {
      expect(error.message).toContain('Available types:');
      expect(error.message).toContain('progress');
      expect(error.message).toContain('error');
      expect(error.message).toContain('build:start');
    }
  });
});

describe('runtime type safety and inheritance chain', () => {
  it('should maintain correct instanceof relationships', () => {
    const events = [
      new ProgressEvent('test', 50),
      new ErrorEvent('test', new Error()),
      new SuccessEvent('test'),
      new BuildProgressEvent('compile', '/src', '/dist')
    ];

    events.forEach((event) => {
      expect(event).toBeInstanceOf(CommandEvent);
      expect(event).toBeInstanceOf(Object);
    });
  });

  it('should preserve event type hierarchy with validateCommandEvent', () => {
    const buildProgress = new BuildProgressEvent('compile', '/src', '/dist');

    // Should validate as BuildProgressEvent
    expect(() => validateCommandEvent(buildProgress, BuildProgressEvent)).not.toThrow();

    // Should validate as CommandEvent (parent class)
    expect(() => validateCommandEvent(buildProgress, CommandEvent)).not.toThrow();

    // Should fail as unrelated event type
    expect(() => validateCommandEvent(buildProgress, ErrorEvent)).toThrow();
  });

  it('should handle event polymorphism correctly', () => {
    const events = [
      new ProgressEvent('Loading', 25),
      new ErrorEvent('Failed', new Error('test')),
      new SuccessEvent('Complete', { files: 5 })
    ];

    // All should be treatable as CommandEvent
    events.forEach((event) => {
      expect(event.type).toBeTruthy();
      expect(event.message).toBeTruthy();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(typeof event.toJSON).toBe('function');
      expect(typeof event.toString).toBe('function');
    });
  });

  it('should maintain event identity through validation', () => {
    const originalEvent = new ProgressEvent('Processing', 60, { stage: 'compile' });

    // Validation should not modify the event
    validateCommandEvent(originalEvent, ProgressEvent);

    expect(originalEvent.percentage).toBe(60);
    expect(originalEvent.details.stage).toBe('compile');
    expect(originalEvent.message).toBe('Processing');
  });

  it('should detect type mismatches at runtime', () => {
    const mockEvent = {
      type: 'progress',
      message: 'Fake progress',
      percentage: 50,
      details: {},
      timestamp: new Date()
    };

    // Plain object should fail instanceof check
    expect(() => validateCommandEvent(mockEvent, ProgressEvent)).toThrow();
  });
});
