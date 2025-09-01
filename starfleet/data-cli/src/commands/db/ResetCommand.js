/**
 * Database Reset Command
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import DatabaseCommand from '../../lib/DatabaseCommand.js';

const execAsync = promisify(exec);

/**
 * Reset database command
 * @class
 */
class ResetCommand extends DatabaseCommand {
  constructor(databaseUrl, serviceRoleKey = null, anonKey = null, logger = null, isProd = false) {
    // Reset command is destructive, always requires confirmation
    super(databaseUrl, serviceRoleKey, anonKey, logger, isProd, true);
  }

  /**
   * Override production confirmation for database reset (needs double confirmation)
   */
  async confirmProduction() {
    this.warn('Production database reset requested!', {
      actions: [
        'Drop all existing data',
        'Recreate schema from migrations',
        'Run seed files (if any)'
      ]
    });

    // First confirmation
    const confirm = await this.confirm(
      'Are you absolutely sure you want to reset the PRODUCTION database?'
    );

    if (!confirm) {
      return false;
    }

    // Double confirmation for production
    const doubleConfirm = await this.input(
      'Type "RESET PRODUCTION" to confirm:',
      {
        validate: (input) => {
          return input === 'RESET PRODUCTION' ? true : 'Please type exactly: RESET PRODUCTION';
        }
      }
    );

    return doubleConfirm === 'RESET PRODUCTION';
  }

  /**
   * Perform the actual database reset
   */
  async performExecute() {
    this.emit('start', { isProd: this.isProd });

    try {
      this.progress('Resetting database...');

      // Change to supabase directory
      const supabaseDir = this.outputConfig.supabaseDir;

      // Run the reset command
      const { stdout, stderr } = await execAsync('npm run reset', {
        cwd: supabaseDir,
        env: {
          ...process.env,  // Use process.env if config.envVars is not available
          ...(this.config?.envVars || {}),
          NODE_ENV: this.isProd ? 'production' : 'development'
        }
      });

      // Process output
      if (stderr && !stderr.includes('warning')) {
        this.warn('Reset command produced stderr output', { stderr });
      }

      if (stdout) {
        this.emit('output', { stdout });
        this.logger.debug({ stdout }, 'Reset command output');
      }

      this.success('Database reset complete');
      this.emit('complete', { isProd: this.isProd });
    } catch (error) {
      this.error('Database reset failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }
}

export { ResetCommand };
export default ResetCommand;
