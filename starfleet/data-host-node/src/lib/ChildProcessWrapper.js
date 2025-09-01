/**
 * ChildProcessWrapper - Safe child process management with proper cleanup
 *
 * Features:
 * - Automatic process cleanup on timeout
 * - Command injection prevention via whitelist validation
 * - Proper signal handling (SIGTERM, SIGKILL)
 * - Resource tracking to prevent zombie processes
 * - Safe argument sanitization
 */

import { spawn } from 'child_process';
import EventEmitter from 'events';

class ChildProcessWrapper extends EventEmitter {
  constructor(logger = console) {
    super();
    this.logger = logger;
    this.activeProcesses = new Map();

    // Whitelist of allowed commands
    this.allowedCommands = new Set([
      'node',
      'npm',
      'npx',
      'pnpm',
      'yarn',
      'supabase',
      'psql',
      'pg_dump',
      'pg_restore',
      'docker',
      'git',
      'deno'
    ]);

    // Setup cleanup on process exit
    process.on('exit', () => this.cleanupAll());
    process.on('SIGINT', () => this.cleanupAll());
    process.on('SIGTERM', () => this.cleanupAll());
  }

  /**
   * Validate command against whitelist
   */
  validateCommand(command) {
    const baseCommand = command.split(' ')[0].split('/').pop();

    if (!this.allowedCommands.has(baseCommand)) {
      throw new Error(`Command '${baseCommand}' is not in the allowed command whitelist`);
    }

    return true;
  }

  /**
   * Sanitize arguments to prevent injection
   */
  sanitizeArgs(args) {
    return args.map(arg => {
      // Remove dangerous characters that could break out of arguments
      const sanitized = String(arg)
        .replace(/[;&|`$(){}[\]<>]/g, '') // Remove shell metacharacters
        .replace(/\n|\r/g, ' '); // Replace newlines with spaces

      // Warn if sanitization changed the argument
      if (sanitized !== String(arg)) {
        this.logger.warn(`Argument sanitized: "${arg}" -> "${sanitized}"`);
      }

      return sanitized;
    });
  }

  /**
   * Execute a command with proper timeout and cleanup
   */
  execute(command, args = [], options = {}) {
    // Validate command
    this.validateCommand(command);

    // Sanitize arguments
    const safeArgs = this.sanitizeArgs(args);

    // Default options
    const execOptions = {
      timeout: 30000, // 30 seconds default
      shell: false, // Never use shell to prevent injection
      ...options,
      // Force some security options
      windowsHide: true
    };

    return new Promise((resolve, _reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let timeoutHandle = null;

      // Spawn the process
      const child = spawn(command, safeArgs, execOptions);
      const pid = child.pid;

      // Track the process
      this.activeProcesses.set(pid, {
        process: child,
        command: `${command} ${safeArgs.join(' ')}`,
        startTime
      });

      // Setup timeout
      if (execOptions.timeout > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          this.logger.warn(`Process ${pid} timed out after ${execOptions.timeout}ms`);
          this.killProcess(pid, 'SIGTERM');

          // Give it 5 seconds to die gracefully, then force kill
          setTimeout(() => {
            if (this.activeProcesses.has(pid)) {
              this.logger.warn(`Process ${pid} didn't respond to SIGTERM, sending SIGKILL`);
              this.killProcess(pid, 'SIGKILL');
            }
          }, 5000);
        }, execOptions.timeout);
      }

      // Capture stdout
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      // Capture stderr
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      // Handle process completion
      child.on('close', (code, signal) => {
        // Clear timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        // Remove from active processes
        this.activeProcesses.delete(pid);

        const duration = Date.now() - startTime;

        if (timedOut) {
          reject(new Error(`Process timed out after ${execOptions.timeout}ms`));
        } else if (code !== 0) {
          const error = new Error(`Process exited with code ${code}`);
          error.code = code;
          error.signal = signal;
          error.stdout = stdout;
          error.stderr = stderr;
          error.duration = duration;
          reject(error);
        } else {
          resolve({
            stdout,
            stderr,
            code,
            signal,
            duration
          });
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        // Clear timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        // Remove from active processes
        this.activeProcesses.delete(pid);

        reject(error);
      });
    });
  }

  /**
   * Execute a command and stream output in real-time
   */
  stream(command, args = [], options = {}) {
    // Validate command
    this.validateCommand(command);

    // Sanitize arguments
    const safeArgs = this.sanitizeArgs(args);

    // Default options
    const execOptions = {
      timeout: 0, // No timeout for streaming by default
      shell: false,
      stdio: 'pipe',
      ...options
    };

    const startTime = Date.now();
    const child = spawn(command, safeArgs, execOptions);
    const pid = child.pid;

    // Track the process
    this.activeProcesses.set(pid, {
      process: child,
      command: `${command} ${safeArgs.join(' ')}`,
      startTime
    });

    // Setup timeout if specified
    let timeoutHandle = null;
    if (execOptions.timeout > 0) {
      timeoutHandle = setTimeout(() => {
        this.logger.warn(`Streaming process ${pid} timed out after ${execOptions.timeout}ms`);
        this.killProcess(pid, 'SIGTERM');

        setTimeout(() => {
          if (this.activeProcesses.has(pid)) {
            this.killProcess(pid, 'SIGKILL');
          }
        }, 5000);
      }, execOptions.timeout);
    }

    // Emit events for streaming
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        this.emit('stdout', data.toString());
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        this.emit('stderr', data.toString());
      });
    }

    // Cleanup on completion
    child.on('close', (code, signal) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      this.activeProcesses.delete(pid);
      this.emit('close', { code, signal, duration: Date.now() - startTime });
    });

    child.on('error', (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      this.activeProcesses.delete(pid);
      this.emit('error', error);
    });

    return child;
  }

  /**
   * Kill a specific process
   */
  killProcess(pid, signal = 'SIGTERM') {
    const processInfo = this.activeProcesses.get(pid);
    if (processInfo && processInfo.process) {
      try {
        processInfo.process.kill(signal);

        // On Windows, we need to use taskkill for proper cleanup
        if (process.platform === 'win32' && signal === 'SIGKILL') {
          spawn('taskkill', ['/F', '/T', '/PID', pid.toString()], {
            detached: true,
            stdio: 'ignore'
          });
        }
      } catch (error) {
        this.logger.error(`Failed to kill process ${pid}: ${error.message}`);
      }
    }
  }

  /**
   * Clean up all active processes
   */
  cleanupAll() {
    for (const [pid, info] of this.activeProcesses) {
      this.logger.warn(`Cleaning up process ${pid}: ${info.command}`);
      this.killProcess(pid, 'SIGTERM');
    }

    // Give them a moment to die gracefully
    setTimeout(() => {
      for (const [pid] of this.activeProcesses) {
        this.logger.warn(`Force killing process ${pid}`);
        this.killProcess(pid, 'SIGKILL');
      }
    }, 1000);
  }

  /**
   * Get list of active processes
   */
  getActiveProcesses() {
    return Array.from(this.activeProcesses.entries()).map(([pid, info]) => ({
      pid,
      command: info.command,
      uptime: Date.now() - info.startTime
    }));
  }

  /**
   * Add a command to the whitelist
   */
  allowCommand(command) {
    this.allowedCommands.add(command);
  }

  /**
   * Remove a command from the whitelist
   */
  disallowCommand(command) {
    this.allowedCommands.delete(command);
  }
}

export default ChildProcessWrapper;
