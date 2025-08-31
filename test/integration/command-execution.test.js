/**
 * Integration tests for Command execution flow
 * 
 * Tests the complete command execution system including:
 * - Command class inheritance and event emission
 * - Production safety gates and confirmation
 * - Event-driven architecture with real listeners
 * - Command router and execution pipeline
 * - Error handling and cleanup
 * - ESM imports and dependency injection
 * - Real command implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { Command } from '../../packages/data-cli/src/lib/Command.js';
import {
  ProgressEvent,
  ErrorEvent,
  SuccessEvent,
  StartEvent,
  CompleteEvent,
  CancelledEvent,
  validateCommandEvent
} from '../../src/lib/events/CommandEvents.cjs';

// Mock configuration class for testing
class MockConfig {
  constructor(data = {}) {
    this.data = data;
  }

  get(key, defaultValue) {
    const keys = key.split('.');
    let value = this.data;
    for (const k of keys) {
      value = value?.[k];
    }
    return value !== undefined ? value : defaultValue;
  }

  has(key) {
    return this.get(key) !== undefined;
  }
}

// Mock output configuration class
class MockOutputConfig {
  constructor(paths = {}) {
    this.paths = paths;
  }

  getSqlDir() {
    return this.paths.sqlDir || './sql';
  }

  getTestsDir() {
    return this.paths.testsDir || './tests';
  }

  getMigrationsDir() {
    return this.paths.migrationsDir || './migrations';
  }
}

// Test command implementations
class TestCommand extends Command {
  constructor(config, logger, isProd, outputConfig, options = {}) {
    super(config, logger, isProd, outputConfig);
    this.options = options;
    this.executeCount = 0;
    this.shouldFail = options.shouldFail || false;
    this.shouldThrow = options.shouldThrow || false;
  }

  async performExecute(...args) {
    this.executeCount++;
    this.progress('Starting test command');
    
    if (this.shouldThrow) {
      throw new Error('Test command failed');
    }
    
    if (this.shouldFail) {
      this.error('Command failed', null, { code: 'TEST_FAILURE' });
      return null;
    }
    
    await this.simulateWork();
    this.success('Test command completed', { args });
    
    return { success: true, args };
  }

  async simulateWork() {
    // Simulate some async work with progress updates
    for (let i = 0; i < 5; i++) {
      this.progress(`Processing step ${i + 1}`, { step: i + 1, total: 5 });
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

class ProductionCommand extends Command {
  constructor(config, logger, isProd, outputConfig) {
    super(config, logger, isProd, outputConfig);
    this.requiresProductionConfirmation = true;
  }

  async performExecute() {
    this.progress('Starting production operation');
    this.warn('This operation affects production data');
    this.success('Production operation completed');
    
    return { environment: 'production' };
  }
}

class InteractiveCommand extends Command {
  constructor(config, logger, isProd, outputConfig) {
    super(config, logger, isProd, outputConfig);
    this.userResponses = new Map();
  }

  setUserResponse(type, response) {
    this.userResponses.set(type, response);
  }

  async performExecute() {
    const name = await this.input('Enter your name:');
    const confirmed = await this.confirm('Proceed with operation?');
    
    return { name, confirmed };
  }

  // Override prompt to provide test responses
  prompt(type, options) {
    // Emit the event before resolving for consistency with base class
    return new Promise((resolve) => {
      this.emit('prompt', { type, options, resolve: (response) => {
        resolve(this.userResponses.get(type) || response || false);
      }});
    });
  }
}

class EventValidationCommand extends Command {
  constructor(config, logger, isProd, outputConfig) {
    super(config, logger, isProd, outputConfig);
    this.validationResults = [];
  }

  async performExecute() {
    // Test various event types
    const progressEvent = new ProgressEvent('Testing progress', 50);
    const validation1 = this.validateEvent(progressEvent, ProgressEvent);
    this.validationResults.push(validation1);

    const errorEvent = new ErrorEvent('Test error', new Error('test'));
    const validation2 = this.validateEvent(errorEvent, ErrorEvent);
    this.validationResults.push(validation2);

    // Test invalid validation
    const validation3 = this.validateEvent(progressEvent, ErrorEvent);
    this.validationResults.push(validation3);

    return { validationResults: this.validationResults };
  }
}

describe('Command execution integration', () => {
  let mockConfig;
  let mockOutputConfig;
  let mockLogger;
  let eventLog;

  beforeEach(() => {
    mockConfig = new MockConfig({
      logging: { level: 'info' },
      test: { timeout: 5000 }
    });
    
    mockOutputConfig = new MockOutputConfig({
      sqlDir: '/test/sql',
      testsDir: '/test/tests',
      migrationsDir: '/test/migrations'
    });

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn()
    };

    eventLog = [];
  });

  afterEach(() => {
    eventLog.length = 0;
  });

  function captureEvents(command) {
    const events = ['start', 'progress', 'warning', 'error', 'success', 'complete', 'cancelled'];
    
    events.forEach(eventType => {
      command.on(eventType, (data) => {
        eventLog.push({
          type: eventType,
          data: { ...data },
          timestamp: data.timestamp
        });
      });
    });
  }

  describe('basic command execution', () => {
    it('should execute command with complete event flow', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      captureEvents(command);
      
      const result = await command.execute('arg1', 'arg2');
      
      expect(result).toEqual({ success: true, args: ['arg1', 'arg2'] });
      expect(command.executeCount).toBe(1);
      
      // Verify event flow
      const eventTypes = eventLog.map(e => e.type);
      expect(eventTypes).toContain('start');
      expect(eventTypes).toContain('progress');
      expect(eventTypes).toContain('success');
      expect(eventTypes).toContain('complete');
      
      // Verify start event
      const startEvent = eventLog.find(e => e.type === 'start');
      expect(startEvent.data.message).toBe('Starting TestCommand');
      expect(startEvent.data.isProd).toBe(false);
      
      // Verify complete event
      const completeEvent = eventLog.find(e => e.type === 'complete');
      expect(completeEvent.data.message).toBe('TestCommand completed successfully');
      expect(completeEvent.data.result).toEqual({ success: true, args: ['arg1', 'arg2'] });
    });

    it('should handle command execution errors', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig, {
        shouldThrow: true
      });
      captureEvents(command);
      
      await expect(command.execute()).rejects.toThrow('Test command failed');
      
      const eventTypes = eventLog.map(e => e.type);
      expect(eventTypes).toContain('start');
      expect(eventTypes).toContain('error');
      expect(eventTypes).not.toContain('complete');
    });

    it('should emit progress events during execution', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      captureEvents(command);
      
      await command.execute();
      
      const progressEvents = eventLog.filter(e => e.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(1);
      
      // Verify first progress event
      const firstProgress = progressEvents.find(e => 
        e.data.message === 'Starting test command'
      );
      expect(firstProgress).toBeDefined();
      
      // Verify step progress events
      const stepEvents = progressEvents.filter(e => 
        e.data.message.startsWith('Processing step')
      );
      expect(stepEvents).toHaveLength(5);
    });

    it('should handle multiple command executions', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      
      const result1 = await command.execute('test1');
      const result2 = await command.execute('test2');
      
      expect(result1.args).toEqual(['test1']);
      expect(result2.args).toEqual(['test2']);
      expect(command.executeCount).toBe(2);
    });
  });

  describe('production safety and confirmation', () => {
    it('should skip confirmation for non-production commands', async () => {
      const command = new ProductionCommand(mockConfig, mockLogger, false, mockOutputConfig);
      captureEvents(command);
      
      const result = await command.execute();
      
      expect(result.environment).toBe('production');
      
      // Should not have cancelled event
      const eventTypes = eventLog.map(e => e.type);
      expect(eventTypes).not.toContain('cancelled');
    });

    it('should request confirmation for production commands', async () => {
      const command = new ProductionCommand(mockConfig, mockLogger, true, mockOutputConfig);
      
      // Mock confirmation response
      let confirmationPrompt = null;
      command.on('prompt', (data) => {
        confirmationPrompt = data;
        data.resolve(true); // User confirms
      });
      
      const result = await command.execute();
      
      expect(confirmationPrompt).toBeDefined();
      expect(confirmationPrompt.type).toBe('confirm');
      expect(confirmationPrompt.options.message).toContain('PRODUCTION');
      expect(result.environment).toBe('production');
    });

    it('should cancel on production confirmation decline', async () => {
      const command = new ProductionCommand(mockConfig, mockLogger, true, mockOutputConfig);
      captureEvents(command);
      
      // Mock confirmation response
      command.on('prompt', (data) => {
        data.resolve(false); // User declines
      });
      
      const result = await command.execute();
      
      expect(result).toBeUndefined(); // Cancelled commands return undefined
      
      const eventTypes = eventLog.map(e => e.type);
      expect(eventTypes).toContain('cancelled');
      
      const cancelledEvent = eventLog.find(e => e.type === 'cancelled');
      expect(cancelledEvent.data.message).toBe('Operation cancelled');
    });

    it('should emit warning events for production operations', async () => {
      const command = new ProductionCommand(mockConfig, mockLogger, true, mockOutputConfig);
      captureEvents(command);
      
      command.on('prompt', (data) => data.resolve(true));
      
      await command.execute();
      
      const warningEvents = eventLog.filter(e => e.type === 'warning');
      expect(warningEvents.length).toBeGreaterThan(0);
      
      const prodWarning = warningEvents.find(e => 
        e.data.message === 'Production operation requested!'
      );
      expect(prodWarning).toBeDefined();
      expect(prodWarning.data.data.environment).toBe('PRODUCTION');
    });
  });

  describe('interactive commands and prompts', () => {
    it('should handle input prompts', async () => {
      const command = new InteractiveCommand(mockConfig, mockLogger, false, mockOutputConfig);
      command.setUserResponse('input', 'John Doe');
      command.setUserResponse('confirm', true);
      
      const result = await command.execute();
      
      expect(result.name).toBe('John Doe');
      expect(result.confirmed).toBe(true);
    });

    it('should handle confirmation prompts', async () => {
      const command = new InteractiveCommand(mockConfig, mockLogger, false, mockOutputConfig);
      command.setUserResponse('input', 'Test User');
      command.setUserResponse('confirm', false);
      
      const result = await command.execute();
      
      expect(result.confirmed).toBe(false);
    });

    it('should emit prompt events', async () => {
      const command = new InteractiveCommand(mockConfig, mockLogger, false, mockOutputConfig);
      const prompts = [];
      
      command.on('prompt', (data) => {
        prompts.push(data);
        data.resolve('mocked response');
      });
      
      await command.execute();
      
      expect(prompts).toHaveLength(2);
      expect(prompts[0].type).toBe('input');
      expect(prompts[1].type).toBe('confirm');
    });
  });

  describe('event validation and type safety', () => {
    it('should validate events with instanceof checks', async () => {
      const command = new EventValidationCommand(mockConfig, mockLogger, false, mockOutputConfig);
      
      const result = await command.execute();
      
      expect(result.validationResults).toHaveLength(3);
      
      // Valid validations should pass
      expect(result.validationResults[0].success).toBe(true);
      expect(result.validationResults[1].success).toBe(true);
      
      // Invalid validation should fail
      expect(result.validationResults[2].success).toBe(false);
      expect(result.validationResults[2].error).toContain('expected ErrorEvent, got ProgressEvent');
    });

    it('should maintain event type information', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      captureEvents(command);
      
      await command.execute();
      
      eventLog.forEach(event => {
        expect(event.type).toBeTruthy();
        expect(event.data).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should emit typed events with proper structure', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      const typedEvents = [];
      
      command.on('progress', (data) => {
        // Verify event structure matches expected format
        expect(data.message).toBeDefined();
        expect(data.timestamp).toBeInstanceOf(Date);
        expect(data.type).toBe('progress');
        typedEvents.push(data);
      });
      
      await command.execute();
      
      expect(typedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('logging integration', () => {
    it('should log events to provided logger', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      
      await command.execute();
      
      expect(mockLogger.info).toHaveBeenCalled();
      
      // Verify specific log calls
      const infoCalls = mockLogger.info.mock.calls;
      const progressLogs = infoCalls.filter(call => 
        call[1]?.includes('Starting test command')
      );
      expect(progressLogs.length).toBeGreaterThan(0);
    });

    it('should log errors appropriately', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig, {
        shouldFail: true
      });
      
      await command.execute();
      
      expect(mockLogger.error).toHaveBeenCalled();
      
      const errorCalls = mockLogger.error.mock.calls;
      const errorLog = errorCalls.find(call => 
        call[1]?.includes('Command failed')
      );
      expect(errorLog).toBeDefined();
    });

    it('should use configuration for logger setup', () => {
      const customConfig = new MockConfig({
        logging: { level: 'debug' }
      });
      
      const command = new TestCommand(customConfig, null, false, mockOutputConfig);
      
      // Command should create default logger when none provided
      expect(command.logger).toBeDefined();
      expect(typeof command.logger.info).toBe('function');
    });
  });

  describe('configuration integration', () => {
    it('should use provided configuration', () => {
      const customConfig = new MockConfig({
        test: { value: 'custom' }
      });
      
      const command = new TestCommand(customConfig, mockLogger, false, mockOutputConfig);
      
      expect(command.config).toBe(customConfig);
      expect(command.config.get('test.value')).toBe('custom');
    });

    it('should use output configuration for paths', () => {
      const customOutputConfig = new MockOutputConfig({
        sqlDir: '/custom/sql',
        testsDir: '/custom/tests'
      });
      
      const command = new TestCommand(mockConfig, mockLogger, false, customOutputConfig);
      
      expect(command.outputConfig).toBe(customOutputConfig);
      expect(command.outputConfig.getSqlDir()).toBe('/custom/sql');
    });

    it('should handle missing configuration gracefully', () => {
      const command = new TestCommand(null, mockLogger, false, null);
      
      expect(command.config).toBeNull();
      expect(command.outputConfig).toBeNull();
      expect(command.logger).toBeDefined(); // Should create default logger
    });
  });

  describe('error handling and cleanup', () => {
    it('should handle constructor errors', () => {
      class FailingCommand extends Command {
        constructor() {
          throw new Error('Constructor failed');
        }
      }
      
      expect(() => new FailingCommand()).toThrow('Constructor failed');
    });

    it('should handle async errors in performExecute', async () => {
      class AsyncFailingCommand extends Command {
        async performExecute() {
          await Promise.resolve();
          throw new Error('Async failure');
        }
      }
      
      const command = new AsyncFailingCommand(mockConfig, mockLogger, false, mockOutputConfig);
      
      await expect(command.execute()).rejects.toThrow('Async failure');
    });

    it('should clean up resources after execution', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      captureEvents(command);
      
      await command.execute();
      
      // Verify no resources are left in resolving state
      expect(command.isProd).toBeDefined();
      expect(command.logger).toBeDefined();
      
      // Events should have been emitted and completed
      const completeEvent = eventLog.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
    });

    it('should handle memory leaks from event listeners', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      
      // Add many listeners
      for (let i = 0; i < 100; i++) {
        command.on('progress', () => {});
      }
      
      expect(command.listenerCount('progress')).toBe(100);
      
      await command.execute();
      
      // Command should still execute normally
      expect(command.executeCount).toBe(1);
    });
  });

  describe('ESM imports and module integration', () => {
    it('should import Command class correctly', () => {
      expect(Command).toBeDefined();
      expect(typeof Command).toBe('function');
      expect(Command.prototype.execute).toBeDefined();
      expect(Command.prototype.performExecute).toBeDefined();
    });

    it('should import event classes correctly', () => {
      const events = [
        ProgressEvent,
        ErrorEvent,
        SuccessEvent,
        StartEvent,
        CompleteEvent,
        CancelledEvent
      ];
      
      events.forEach(EventClass => {
        expect(EventClass).toBeDefined();
        expect(typeof EventClass).toBe('function');
        
        const instance = new EventClass('test message');
        expect(instance).toBeInstanceOf(EventClass);
      });
    });

    it('should maintain instanceof relationships across modules', async () => {
      const command = new TestCommand(mockConfig, mockLogger, false, mockOutputConfig);
      
      expect(command).toBeInstanceOf(Command);
      expect(command).toBeInstanceOf(EventEmitter);
    });

    it('should support dynamic imports', async () => {
      // Test that modules can be imported dynamically
      const commandModule = await import('../../packages/data-cli/src/lib/Command.js');
      const eventsModule = await import('../../src/lib/events/CommandEvents.cjs');
      
      expect(commandModule.Command).toBe(Command);
      expect(eventsModule.ProgressEvent).toBe(ProgressEvent);
    });
  });

  describe('real-world command patterns', () => {
    it('should support command chaining', async () => {
      const results = [];
      
      class ChainableCommand extends Command {
        constructor(config, logger, isProd, outputConfig, step) {
          super(config, logger, isProd, outputConfig);
          this.step = step;
        }

        async performExecute() {
          this.progress(`Executing step ${this.step}`);
          results.push(this.step);
          return { step: this.step };
        }
      }
      
      const commands = [
        new ChainableCommand(mockConfig, mockLogger, false, mockOutputConfig, 1),
        new ChainableCommand(mockConfig, mockLogger, false, mockOutputConfig, 2),
        new ChainableCommand(mockConfig, mockLogger, false, mockOutputConfig, 3)
      ];
      
      for (const command of commands) {
        await command.execute();
      }
      
      expect(results).toEqual([1, 2, 3]);
    });

    it('should support parallel command execution', async () => {
      const startTimes = [];
      
      class ParallelCommand extends Command {
        constructor(config, logger, isProd, outputConfig, id) {
          super(config, logger, isProd, outputConfig);
          this.id = id;
        }

        async performExecute() {
          startTimes.push({ id: this.id, time: Date.now() });
          await new Promise(resolve => setTimeout(resolve, 50));
          return { id: this.id };
        }
      }
      
      const commands = [
        new ParallelCommand(mockConfig, mockLogger, false, mockOutputConfig, 'A'),
        new ParallelCommand(mockConfig, mockLogger, false, mockOutputConfig, 'B'),
        new ParallelCommand(mockConfig, mockLogger, false, mockOutputConfig, 'C')
      ];
      
      const results = await Promise.all(
        commands.map(command => command.execute())
      );
      
      expect(results).toHaveLength(3);
      expect(results.map(r => r.id).sort()).toEqual(['A', 'B', 'C']);
      
      // Verify they started roughly at the same time (within 100ms)
      const times = startTimes.map(s => s.time);
      const maxDiff = Math.max(...times) - Math.min(...times);
      expect(maxDiff).toBeLessThan(100);
    });

    it('should handle command failure gracefully in pipelines', async () => {
      const executionLog = [];
      
      class PipelineCommand extends Command {
        constructor(config, logger, isProd, outputConfig, id, shouldFail = false) {
          super(config, logger, isProd, outputConfig);
          this.id = id;
          this.shouldFail = shouldFail;
        }

        async performExecute() {
          executionLog.push(`${this.id}: started`);
          
          if (this.shouldFail) {
            executionLog.push(`${this.id}: failed`);
            throw new Error(`Command ${this.id} failed`);
          }
          
          executionLog.push(`${this.id}: completed`);
          return { id: this.id };
        }
      }
      
      const commands = [
        new PipelineCommand(mockConfig, mockLogger, false, mockOutputConfig, 'step1'),
        new PipelineCommand(mockConfig, mockLogger, false, mockOutputConfig, 'step2', true), // This fails
        new PipelineCommand(mockConfig, mockLogger, false, mockOutputConfig, 'step3')
      ];
      
      // Execute sequentially with error handling
      const results = [];
      for (const command of commands) {
        try {
          const result = await command.execute();
          results.push(result);
        } catch (error) {
          results.push({ error: error.message });
          break; // Stop pipeline on error
        }
      }
      
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('step1');
      expect(results[1].error).toContain('Command step2 failed');
      
      expect(executionLog).toEqual([
        'step1: started',
        'step1: completed',
        'step2: started',
        'step2: failed'
      ]);
    });
  });
});