/**
 * Tests for MigrateCommand with CommandRouter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MigrateCommand', () => {
  let MigrateCommand;
  let command;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(async () => {
    // Reset modules to ensure clean mocks
    vi.resetModules();

    // Mock console to prevent output during tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock all subcommand modules before importing MigrateCommand
    vi.doMock('../src/commands/db/migrate/generate.js', () => {
      return {
        default: class MockGenerateCommand {
          constructor() {
            this.on = vi.fn();
          }
          async execute(args) {
            return { generated: true, args };
          }
        }
      };
    });

    vi.doMock('../src/commands/db/migrate/test-v2.js', () => {
      return {
        default: class MockTestCommand {
          constructor() {
            this.on = vi.fn();
          }
          async execute(args) {
            return { tested: true, args };
          }
        }
      };
    });

    vi.doMock('../src/commands/db/migrate/status.js', () => {
      return {
        default: class MockStatusCommand {
          constructor() {
            this.on = vi.fn();
          }
          async execute(args) {
            return { status: 'ready', args };
          }
        }
      };
    });

    vi.doMock('../src/commands/db/migrate/squash.js', () => {
      return {
        default: class MockSquashCommand {
          constructor() {
            this.on = vi.fn();
          }
          async execute(args) {
            return { squashed: true, args };
          }
        }
      };
    });

    // Mock other subcommands
    const otherCommands = ['promote', 'rollback', 'clean', 'history', 'verify'];
    for (const cmd of otherCommands) {
      vi.doMock(`../src/commands/db/migrate/${cmd}.js`, () => {
        return {
          default: class MockCommand {
            constructor() {
              this.on = vi.fn();
            }
            async execute(args) {
              return { command: cmd, executed: true, args };
            }
          }
        };
      });
    }

    // Now import MigrateCommand after all mocks are set up
    const module = await import('../packages/data-cli/src/commands/db/MigrateCommand.js');
    MigrateCommand = module.default;
    command = new MigrateCommand();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Router Integration', () => {
    it('should initialize router with all subcommands', () => {
      const routes = command.router.getRoutes();
      const subcommands = routes.map((r) => r.path.split('/')[1]);

      expect(subcommands).toContain('generate');
      expect(subcommands).toContain('test');
      expect(subcommands).toContain('status');
      expect(subcommands).toContain('promote');
      expect(subcommands).toContain('rollback');
      expect(subcommands).toContain('clean');
      expect(subcommands).toContain('history');
      expect(subcommands).toContain('verify');
      expect(subcommands).toContain('squash');
    });

    it('should have schemas for all subcommands', () => {
      const routes = command.router.getRoutes();

      routes.forEach((route) => {
        expect(route.hasSchema).toBe(true);
        expect(route.description).toBeTruthy();
      });
    });
  });

  describe('Command Execution', () => {
    it('should route to generate subcommand', async () => {
      const result = await command.execute({
        _: ['generate'],
        name: 'test-migration'
      });

      expect(result).toEqual({
        generated: true,
        args: expect.objectContaining({
          name: 'test-migration'
        })
      });
    });

    it('should route to status subcommand', async () => {
      const result = await command.execute({
        _: ['status'],
        detailed: true
      });

      expect(result).toEqual({
        status: 'ready',
        args: expect.objectContaining({
          detailed: true
        })
      });
    });
  });

  describe('Help System', () => {
    it('should show general help when no subcommand provided', async () => {
      await command.execute({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: data db migrate <command>')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    });

    it('should show subcommand help with --help flag', async () => {
      const result = await command.execute({
        _: ['generate'],
        '--help': true
      });

      expect(result).toEqual({ help: true });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: data migrate generate')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown subcommands gracefully', async () => {
      await expect(
        command.execute({
          _: ['unknown-command']
        })
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown migration command: unknown-command')
      );
    });
  });
});
