import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Node.js implementation of the Process port.
 * Wraps child_process APIs to provide standardized process execution.
 * 
 * @class ProcessAdapter
 */
export class ProcessAdapter {
  /**
   * Create a new ProcessAdapter instance.
   * 
   * @param {Object} options - Configuration options
   * @param {string} [options.shell='/bin/sh'] - Default shell to use
   * @param {number} [options.timeout=30000] - Default timeout in milliseconds
   * @param {string} [options.encoding='utf8'] - Default output encoding
   */
  constructor(options = {}) {
    this.defaultShell = options.shell || '/bin/sh';
    this.defaultTimeout = options.timeout || 30000;
    this.encoding = options.encoding || 'utf8';
  }

  /**
   * Execute a command and return the result.
   * 
   * @param {string} command - Command to execute
   * @param {Object} [options] - Execution options
   * @param {string} [options.cwd] - Working directory
   * @param {Object} [options.env] - Environment variables
   * @param {number} [options.timeout] - Timeout in milliseconds
   * @param {string} [options.encoding] - Output encoding
   * @param {boolean} [options.shell=true] - Run in shell
   * @returns {Promise<ProcessResult>} Process execution result
   * @throws {ProcessError} When process execution fails
   */
  async execute(command, options = {}) {
    try {
      const execOptions = {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        timeout: options.timeout || this.defaultTimeout,
        encoding: options.encoding || this.encoding,
        shell: options.shell !== false
      };

      const { stdout, stderr } = await execAsync(command, execOptions);
      
      return {
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        command,
        success: true
      };
    } catch (error) {
      // Handle timeout and other exec errors
      const result = {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1,
        command,
        success: false,
        signal: error.signal,
        timedOut: error.killed && error.signal === 'SIGTERM'
      };

      if (options.throwOnError !== false) {
        throw this._normalizeError(error, command, result);
      }
      
      return result;
    }
  }

  /**
   * Spawn a process with streaming support.
   * 
   * @param {string} command - Command to spawn
   * @param {Array<string>} [args=[]] - Command arguments
   * @param {Object} [options] - Spawn options
   * @param {string} [options.cwd] - Working directory
   * @param {Object} [options.env] - Environment variables
   * @param {boolean} [options.shell=false] - Run in shell
   * @param {'pipe'|'inherit'|'ignore'} [options.stdio='pipe'] - Stdio configuration
   * @returns {Promise<ProcessStream>} Process stream interface
   */
  async spawn(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const spawnOptions = {
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...options.env },
          shell: options.shell || false,
          stdio: options.stdio || 'pipe'
        };

        const child = spawn(command, args, spawnOptions);
        
        let stdout = '';
        let stderr = '';

        if (child.stdout) {
          child.stdout.setEncoding(this.encoding);
          child.stdout.on('data', (data) => {
            stdout += data;
          });
        }

        if (child.stderr) {
          child.stderr.setEncoding(this.encoding);
          child.stderr.on('data', (data) => {
            stderr += data;
          });
        }

        child.on('error', (error) => {
          reject(this._normalizeError(error, `${command} ${args.join(' ')}`));
        });

        child.on('close', (exitCode, signal) => {
          resolve({
            process: child,
            stdout,
            stderr,
            exitCode,
            signal,
            success: exitCode === 0,
            pid: child.pid
          });
        });

        // Return stream interface immediately
        resolve({
          process: child,
          stdout: child.stdout,
          stderr: child.stderr,
          stdin: child.stdin,
          pid: child.pid,
          kill: (signal = 'SIGTERM') => child.kill(signal),
          wait: () => new Promise((res, rej) => {
            child.on('close', (code, sig) => res({ exitCode: code, signal: sig }));
            child.on('error', rej);
          })
        });
      } catch (error) {
        reject(this._normalizeError(error, `${command} ${args.join(' ')}`));
      }
    });
  }

  /**
   * Execute a command in a specific shell.
   * 
   * @param {string} script - Shell script to execute
   * @param {Object} [options] - Execution options
   * @param {string} [options.shell] - Shell to use
   * @param {string} [options.cwd] - Working directory
   * @param {Object} [options.env] - Environment variables
   * @param {number} [options.timeout] - Timeout in milliseconds
   * @returns {Promise<ProcessResult>} Process execution result
   * @throws {ProcessError} When shell execution fails
   */
  async shell(script, options = {}) {
    const shell = options.shell || this.defaultShell;
    const shellArgs = shell.endsWith('sh') ? ['-c'] : ['/c'];
    
    return this.execute(`${shell} ${shellArgs.join(' ')} "${script.replace(/"/g, '\\"')}"`, {
      ...options,
      shell: false // We're handling shell ourselves
    });
  }

  /**
   * Get current process information.
   * 
   * @returns {ProcessInfo} Current process information
   */
  getProcessInfo() {
    return {
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      cwd: process.cwd(),
      execPath: process.execPath,
      argv: [...process.argv],
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  /**
   * Kill a process by PID.
   * 
   * @param {number} pid - Process ID to kill
   * @param {string} [signal='SIGTERM'] - Signal to send
   * @returns {Promise<boolean>} True if process was killed successfully
   * @throws {ProcessError} When process cannot be killed
   */
  async kill(pid, signal = 'SIGTERM') {
    try {
      process.kill(pid, signal);
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') {
        // Process doesn't exist
        return false;
      }
      throw this._normalizeError(error, `kill ${pid} ${signal}`);
    }
  }

  /**
   * Check if a process is running.
   * 
   * @param {number} pid - Process ID to check
   * @returns {Promise<boolean>} True if process is running
   */
  async isRunning(pid) {
    try {
      process.kill(pid, 0); // Signal 0 checks existence without killing
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') {
        return false;
      }
      // EPERM means process exists but we can't signal it
      return error.code === 'EPERM';
    }
  }

  /**
   * Normalize process errors into consistent format.
   * 
   * @private
   * @param {Error} error - Original error
   * @param {string} command - Command that failed
   * @param {Object} [result] - Process result if available
   * @returns {ProcessError} Normalized error
   */
  _normalizeError(error, command, result = null) {
    const normalizedError = new Error(
      `Process execution failed for "${command}": ${error.message}`
    );
    normalizedError.name = 'ProcessError';
    normalizedError.code = error.code;
    normalizedError.command = command;
    normalizedError.signal = error.signal;
    normalizedError.killed = error.killed;
    normalizedError.originalError = error;
    
    if (result) {
      normalizedError.stdout = result.stdout;
      normalizedError.stderr = result.stderr;
      normalizedError.exitCode = result.exitCode;
    }
    
    return normalizedError;
  }
}