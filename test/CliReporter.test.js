/**
 * CLI Reporter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { EventEmitter } from 'events';

const require = createRequire(import.meta.url);
const CliReporter = require('../src/reporters/CliReporter');
const { CommandEvent, ProgressEvent, ErrorEvent, SuccessEvent, WarningEvent } = require('../src/lib/events/CommandEvents');

describe('CliReporter', () => {
  let reporter;
  let mockCommand;
  let consoleLogSpy;
  let consoleErrorSpy;
  
  beforeEach(() => {
    reporter = new CliReporter(false); // Not silent
    mockCommand = new EventEmitter();
    
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    reporter.attach(mockCommand);
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Legacy Event Handling', () => {
    it('should handle legacy progress events', () => {
      mockCommand.emit('progress', { message: 'Legacy progress' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Legacy progress')
      );
    });

    it('should handle legacy warning events', () => {
      mockCommand.emit('warning', { 
        message: 'Legacy warning',
        data: { actions: ['Action 1', 'Action 2'] }
      });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  WARNING: Legacy warning')
      );
    });

    it('should handle legacy error events', () => {
      const testError = new Error('Test error');
      mockCommand.emit('error', { 
        message: 'Legacy error',
        error: testError
      });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Legacy error')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
    });

    it('should handle legacy success events', () => {
      mockCommand.emit('success', { message: 'Legacy success' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Legacy success')
      );
    });

    it('should handle legacy start events with isProd', () => {
      mockCommand.emit('start', { isProd: true });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 PRODUCTION MODE 🚨')
      );
    });
  });

  describe('Typed Event Handling', () => {
    it('should handle typed progress events', () => {
      const progressEvent = new ProgressEvent('Typed progress');
      mockCommand.emit('progress', progressEvent);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Typed progress')
      );
    });

    it('should handle typed warning events', () => {
      const warningEvent = new WarningEvent('Typed warning', {
        actions: ['Action 1', 'Action 2']
      });
      mockCommand.emit('warning', warningEvent);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  WARNING: Typed warning')
      );
    });

    it('should handle typed error events', () => {
      const testError = new Error('Typed error');
      const errorEvent = new ErrorEvent('Typed error message', testError);
      mockCommand.emit('error', errorEvent);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Typed error message')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Typed error')
      );
    });

    it('should handle typed success events', () => {
      const successEvent = new SuccessEvent('Typed success');
      mockCommand.emit('success', successEvent);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓ Typed success')
      );
    });

    it('should handle typed start events with isProd', () => {
      // Create a CommandEvent with isProd property
      const startEvent = new CommandEvent();
      startEvent.isProd = true;
      mockCommand.emit('start', startEvent);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 PRODUCTION MODE 🚨')
      );
    });
  });

  describe('Undefined Value Handling', () => {
    it('should handle undefined message gracefully', () => {
      mockCommand.emit('progress', { message: undefined });
      
      // Should not log anything for undefined message
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle null event data gracefully', () => {
      mockCommand.emit('progress', null);
      
      // Should not log anything for null data
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle missing error object gracefully', () => {
      mockCommand.emit('error', { message: 'Error without error object' });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Error without error object')
      );
      // Should not try to log undefined error message
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Silent Mode', () => {
    it('should not log in silent mode', () => {
      const silentReporter = new CliReporter(true);
      const silentCommand = new EventEmitter();
      silentReporter.attach(silentCommand);
      
      silentCommand.emit('progress', { message: 'Silent progress' });
      silentCommand.emit('success', { message: 'Silent success' });
      silentCommand.emit('error', { message: 'Silent error' });
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Mixed Event Types', () => {
    it('should handle both legacy and typed events in the same session', () => {
      // Legacy event
      mockCommand.emit('progress', { message: 'Legacy progress' });
      
      // Typed event
      const typedEvent = new ProgressEvent('Typed progress');
      mockCommand.emit('progress', typedEvent);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Legacy progress')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Typed progress')
      );
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });
});