/**
 * ProcessPortNodeAdapter - Node.js implementation of ProcessPort
 */
import { spawn, exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import process from 'node:process';

const execPromise = promisify(execCallback);

export class ProcessPortNodeAdapter {
  async spawn(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const { cwd, env, shell, timeout } = options;
      
      const child = spawn(command, args, {
        cwd,
        env: env || process.env,
        shell,
        timeout
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code, signal) => {
        resolve({ stdout, stderr, code, signal });
      });
    });
  }

  async exec(command, options = {}) {
    const { cwd, env, timeout } = options;
    
    try {
      const { stdout, stderr } = await execPromise(command, {
        cwd,
        env: env || process.env,
        timeout
      });
      
      return { stdout, stderr, code: 0, signal: null };
    } catch (error) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        code: error.code || 1,
        signal: error.signal || null
      };
    }
  }

  exit(code = 0) {
    process.exit(code);
  }

  cwd() {
    return process.cwd();
  }

  chdir(dir) {
    process.chdir(dir);
  }

  async which(command) {
    const isWindows = process.platform === 'win32';
    const checkCommand = isWindows ? `where ${command}` : `command -v ${command}`;
    
    try {
      const { stdout } = await execPromise(checkCommand, { shell: true });
      const paths = stdout.trim().split(/\r?\n/);
      return paths[0] || null;
    } catch {
      return null;
    }
  }
}