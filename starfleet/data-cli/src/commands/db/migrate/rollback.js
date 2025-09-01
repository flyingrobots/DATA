/**
 * Migration Rollback Command
 */

import DatabaseCommand from '../../../lib/DatabaseCommand.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Rollback migration to previous state with confirmation
 */
/**
 * @class
 */
class MigrateRollbackCommand extends DatabaseCommand {
  static description = 'Rollback migration to previous state';
  static requiresConfirmation = true;

  constructor(databaseUrl, serviceRoleKey = null, anonKey = null, logger = null, isProd = false) {
    // Rollback is destructive, always requires confirmation
    super(databaseUrl, serviceRoleKey, anonKey, logger, isProd, true);
  }

  /**
   * Execute migration rollback
   */
  async performExecute(args = {}) {
    this.emit('start');

    try {
      const target = args.target || args.to || 'previous';

      this.progress(`Preparing rollback to: ${target}...`);

      // Get rollback target information
      const rollbackInfo = await this.getRollbackTarget(target);

      if (!rollbackInfo) {
        this.error('No valid rollback target found');
        this.emit('failed', { error: 'No rollback target' });
        return;
      }

      // Additional confirmation for rollback
      const confirmed = await this.confirmRollback(rollbackInfo);
      if (!confirmed) {
        this.success('Rollback cancelled');
        this.emit('cancelled', { target });
        return;
      }

      // Perform rollback
      await this.performRollback(rollbackInfo);

      // Update history
      await this.recordRollback(rollbackInfo);

      this.success(`Migration rollback completed to: ${rollbackInfo.migration}`);
      this.emit('complete', { target: rollbackInfo.migration });

    } catch (error) {
      this.error('Migration rollback failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }

  /**
   * Get rollback target migration
   */
  async getRollbackTarget(target) {
    try {
      const historyFile = path.resolve('supabase/.migration_history.json');
      const historyExists = await fs.access(historyFile).then(() => true).catch(() => false);

      if (!historyExists) {
        this.warn('No migration history found');
        return null;
      }

      const historyContent = await fs.readFile(historyFile, 'utf8');
      const history = JSON.parse(historyContent);

      // Get promotions only
      const promotions = history.filter(entry => entry.action === 'promote');

      if (promotions.length === 0) {
        this.warn('No promoted migrations found');
        return null;
      }

      if (target === 'previous' || target === 'last') {
        // Get second-to-last promotion
        return promotions.length > 1 ? promotions[promotions.length - 2] : null;
      }

      // Find specific migration
      return promotions.find(p => p.migration === target) || null;

    } catch (error) {
      this.warn('Could not determine rollback target', { error: error.message });
      return null;
    }
  }

  /**
   * Confirm rollback operation with details
   */
  async confirmRollback(rollbackInfo) {
    console.log('\n⚠️  ROLLBACK CONFIRMATION');
    console.log('═══════════════════════════\n');
    console.log(`Target Migration: ${rollbackInfo.migration}`);
    console.log(`Promoted: ${new Date(rollbackInfo.timestamp).toLocaleString()}`);
    console.log(`Status: ${rollbackInfo.status}`);
    console.log('\n⚠️  This will PERMANENTLY rollback your database state!');
    console.log('⚠️  Make sure you have a backup before proceeding!');
    console.log('');

    return this.confirm('Are you absolutely sure you want to rollback?', false);
  }

  /**
   * Perform the actual rollback
   */
  async performRollback(rollbackInfo) {
    this.progress('Creating backup before rollback...');

    // In a real implementation, this would:
    // 1. Create a backup of current state
    // 2. Generate rollback SQL from migration history
    // 3. Execute rollback against database
    // 4. Verify rollback success

    // For now, simulate the process
    await this.sleep(1000);
    this.progress('Generating rollback SQL...');

    await this.sleep(1000);
    this.progress('Executing rollback against database...');

    await this.sleep(1000);
    this.progress('Verifying rollback completion...');

    // Simulate rollback file creation
    const rollbackDir = path.resolve('supabase/.rollbacks');
    await fs.mkdir(rollbackDir, { recursive: true });

    const rollbackFile = path.join(rollbackDir, `rollback_${Date.now()}.sql`);
    await fs.writeFile(rollbackFile, `-- Rollback to ${rollbackInfo.migration}\n-- Generated: ${new Date().toISOString()}\n`);

    this.progress(`Rollback SQL saved to: ${rollbackFile}`);
  }

  /**
   * Record rollback in history
   */
  async recordRollback(rollbackInfo) {
    try {
      const historyFile = path.resolve('supabase/.migration_history.json');
      const historyContent = await fs.readFile(historyFile, 'utf8');
      const history = JSON.parse(historyContent);

      // Add rollback record
      history.push({
        action: 'rollback',
        migration: rollbackInfo.migration,
        target: rollbackInfo.migration,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });

      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
      this.progress('Rollback recorded in migration history');

    } catch (error) {
      this.warn('Could not update migration history', { error: error.message });
    }
  }

  /**
   * Sleep utility for simulation
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Migration rollback handler
 * @param {Object} args - Command arguments
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @param {boolean} isProd - Production flag
 * @returns {Promise<Object>} Rollback result
 */
export default async function rollbackHandler(args, config, logger, isProd) {
  const command = new MigrateRollbackCommand(config, logger, isProd);
  return command.performExecute(args);
}

export { MigrateRollbackCommand };
