import { describe, it, expect, vi, beforeEach } from 'vitest';
import Command from '../packages/data-cli/src/lib/Command.js';
import {
  ProgressEvent,
  WarningEvent,
  ErrorEvent,
  SuccessEvent,
  StartEvent,
  CompleteEvent,
  CancelledEvent
} from '../src/lib/events/CommandEvents.js';

describe('Command Integration Tests', () => {
  let command;

  beforeEach(() => {
    command = new Command();
    // Override performExecute for testing
    command.performExecute = vi.fn().mockResolvedValue('test-result');
    command.requiresProductionConfirmation = false; // Skip confirmations for tests
  });

  describe('Typed Events', () => {
    it('should emit typed progress events with correct structure', async () => {
      const progressSpy = vi.fn();
      command.on('progress', progressSpy);
      
      command.progress('Test progress', { step: 1 });
      
      expect(progressSpy).toHaveBeenCalledTimes(1);
      const emittedEvent = progressSpy.mock.calls[0][0];
      
      expect(emittedEvent).toHaveProperty('type', 'progress');
      expect(emittedEvent).toHaveProperty('message', 'Test progress');
      expect(emittedEvent).toHaveProperty('data', { step: 1 });
      expect(emittedEvent).toHaveProperty('timestamp');
      expect(emittedEvent.timestamp).toBeInstanceOf(Date);
      expect(emittedEvent).toHaveProperty('percentage', null); // null for indeterminate
    });

    it('should emit typed warning events with correct structure', async () => {
      const warnSpy = vi.fn();
      command.on('warning', warnSpy);
      
      command.warn('Test warning', { severity: 'low' });
      
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const emittedEvent = warnSpy.mock.calls[0][0];
      
      expect(emittedEvent).toHaveProperty('type', 'warning');
      expect(emittedEvent).toHaveProperty('message', 'Test warning');
      expect(emittedEvent.data).toMatchObject({ severity: 'low' }); // May have additional properties like code: null
      expect(emittedEvent).toHaveProperty('timestamp');
      expect(emittedEvent.timestamp).toBeInstanceOf(Date);
    });

    it('should emit typed error events with correct structure', async () => {
      const errorSpy = vi.fn();
      command.on('error', errorSpy);
      
      const testError = new Error('Test error');
      command.error('Test error message', testError, { code: 'E001' });
      
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const emittedEvent = errorSpy.mock.calls[0][0];
      
      expect(emittedEvent).toHaveProperty('type', 'error');
      expect(emittedEvent).toHaveProperty('message', 'Test error message');
      expect(emittedEvent).toHaveProperty('error', testError);
      expect(emittedEvent).toHaveProperty('data');
      expect(emittedEvent.data).toMatchObject({ code: 'E001' });
      expect(emittedEvent).toHaveProperty('timestamp');
      expect(emittedEvent.timestamp).toBeInstanceOf(Date);
    });

    it('should emit typed success events with correct structure', async () => {
      const successSpy = vi.fn();
      command.on('success', successSpy);
      
      command.success('Test success', { result: 'OK' });
      
      expect(successSpy).toHaveBeenCalledTimes(1);
      const emittedEvent = successSpy.mock.calls[0][0];
      
      expect(emittedEvent).toHaveProperty('type', 'success');
      expect(emittedEvent).toHaveProperty('message', 'Test success');
      expect(emittedEvent.data).toMatchObject({ result: 'OK' }); // May have additional properties like duration: null
      expect(emittedEvent).toHaveProperty('timestamp');
      expect(emittedEvent.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Command Execution Events', () => {
    it('should emit start and complete events during execution', async () => {
      const startSpy = vi.fn();
      const completeSpy = vi.fn();
      
      command.on('start', startSpy);
      command.on('complete', completeSpy);
      
      const result = await command.execute();
      
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledTimes(1);
      
      const startEvent = startSpy.mock.calls[0][0];
      expect(startEvent).toHaveProperty('type', 'start');
      expect(startEvent.message).toContain('Command');
      expect(startEvent).toHaveProperty('isProd', false);
      
      const completeEvent = completeSpy.mock.calls[0][0];
      expect(completeEvent).toHaveProperty('type', 'complete');
      expect(completeEvent.message).toContain('completed successfully');
      expect(completeEvent).toHaveProperty('result', 'test-result');
      
      expect(result).toBe('test-result');
    });

    it('should emit error events when execution fails', async () => {
      const startSpy = vi.fn();
      const errorSpy = vi.fn();
      const completeSpy = vi.fn();
      
      command.on('start', startSpy);
      command.on('error', errorSpy);
      command.on('complete', completeSpy);
      
      const testError = new Error('Execution failed');
      command.performExecute = vi.fn().mockRejectedValue(testError);
      
      await expect(command.execute()).rejects.toThrow('Execution failed');
      
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).not.toHaveBeenCalled(); // Should not emit complete on error
      
      const errorEvent = errorSpy.mock.calls[0][0];
      expect(errorEvent).toHaveProperty('type', 'error');
      expect(errorEvent.message).toContain('failed');
      expect(errorEvent).toHaveProperty('error', testError);
    });
  });

  describe('Event Validation', () => {
    it('should validate events correctly with basic structure check', () => {
      const validEvent = { type: 'progress', message: 'Test', timestamp: new Date(), data: {} };
      const invalidEvent = { type: 'invalid-type' }; // Missing required fields
      
      const validResult = command.validateEvent(validEvent);
      const invalidResult = command.validateEvent(invalidEvent);
      
      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });

    it('should validate events against specific class types', () => {
      const progressEventInstance = new ProgressEvent('Test progress', null, {});
      const errorEventInstance = new ErrorEvent('Test error', new Error(), null, {});
      
      const validProgressResult = command.validateEvent(progressEventInstance, ProgressEvent);
      const invalidResult = command.validateEvent(errorEventInstance, ProgressEvent);
      
      expect(validProgressResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });

    it('should emit typed events with validation via emitTypedEvent', () => {
      const testSpy = vi.fn();
      command.on('test-event', testSpy);
      
      const validEvent = new ProgressEvent('Test progress', null, {});
      
      command.emitTypedEvent('test-event', validEvent, ProgressEvent);
      
      expect(testSpy).toHaveBeenCalledTimes(1);
      const emittedEvent = testSpy.mock.calls[0][0];
      expect(emittedEvent).toHaveProperty('message', 'Test progress');
      expect(emittedEvent).toHaveProperty('type', 'progress');
      expect(emittedEvent).toHaveProperty('data');
      expect(emittedEvent).toHaveProperty('timestamp');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain the same event structure for existing listeners', () => {
      // This test ensures that existing code listening for events will still work
      const legacyListenerSpy = vi.fn();
      
      // Simulate how existing code might listen for events
      command.on('progress', (eventData) => {
        legacyListenerSpy({
          message: eventData.message,
          data: eventData.data,
          hasTimestamp: 'timestamp' in eventData,
          hasType: 'type' in eventData
        });
      });
      
      command.progress('Legacy test', { oldField: 'value' });
      
      expect(legacyListenerSpy).toHaveBeenCalledWith({
        message: 'Legacy test',
        data: { oldField: 'value' },
        hasTimestamp: true,
        hasType: true
      });
    });

    it('should maintain existing event object properties', () => {
      const eventSpy = vi.fn();
      command.on('success', eventSpy);
      
      command.success('Test message', { custom: 'data' });
      
      expect(eventSpy).toHaveBeenCalledTimes(1);
      const event = eventSpy.mock.calls[0][0];
      
      // Check all expected properties are present
      expect(event).toHaveProperty('message', 'Test message');
      expect(event.data).toMatchObject({ custom: 'data' }); // May have additional properties
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('type', 'success');
      
      // Ensure timestamp is a Date object (not string)
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });
});