/**
 * Migration Clean Command
 */

import Command from '../../../lib/Command.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Clean up temporary migration files and staging directories
 */
/**
 * @class
 */
class MigrateCleanCommand extends Command {
  static description = 'Clean up temporary migration files';

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Safe cleanup operation
  }

  /**
   * Execute migration cleanup
   */
  async performExecute(args = {}) {
    this.emit('start');

    try {
      const force = args.force || args.f || false;
      const verbose = args.verbose || args.v || false;

      this.progress('Starting migration cleanup...');

      let cleanedItems = 0;
      let totalSize = 0;

      // Clean staging directories
      const stagingResult = await this.cleanStagingDirectory(force, verbose);
      cleanedItems += stagingResult.items;
      totalSize += stagingResult.size;

      // Clean temporary databases
      const tempDbResult = await this.cleanTemporaryDatabases(force, verbose);
      cleanedItems += tempDbResult.items;
      totalSize += tempDbResult.size;

      // Clean backup files (older than 30 days)
      const backupResult = await this.cleanOldBackups(force, verbose);
      cleanedItems += backupResult.items;
      totalSize += backupResult.size;

      // Clean log files
      const logResult = await this.cleanLogFiles(force, verbose);
      cleanedItems += logResult.items;
      totalSize += logResult.size;

      // Display results
      this.displayCleanupResults(cleanedItems, totalSize);

      this.emit('complete', {
        cleanedItems,
        totalSize: this.formatBytes(totalSize)
      });

    } catch (error) {
      this.error('Migration cleanup failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }

  /**
   * Clean staging directory
   */
  async cleanStagingDirectory(force, verbose) {
    let items = 0;
    let size = 0;

    try {
      const stagingDir = path.resolve('supabase/.staging');
      const stagingExists = await fs.access(stagingDir).then(() => true).catch(() => false);

      if (!stagingExists) {
        if (verbose) this.progress('Staging directory not found, skipping...');
        return { items, size };
      }

      const files = await fs.readdir(stagingDir);

      await Promise.all(files.map(async file => {
        const filePath = path.join(stagingDir, file);
        const stats = await fs.stat(filePath);

        if (force || await this.shouldCleanFile(filePath, stats)) {
          size += stats.size;
          await fs.unlink(filePath);
          items++;

          if (verbose) {
            this.progress(`Cleaned: ${file} (${this.formatBytes(stats.size)})`);
          }
        }
      }));

      // Remove directory if empty
      const remainingFiles = await fs.readdir(stagingDir);
      if (remainingFiles.length === 0) {
        await fs.rmdir(stagingDir);
        if (verbose) this.progress('Removed empty staging directory');
      }

    } catch (error) {
      this.warn('Could not clean staging directory', { error: error.message });
    }

    return { items, size };
  }

  /**
   * Clean temporary databases
   */
  async cleanTemporaryDatabases(force, verbose) {
    let items = 0;
    let size = 0;

    try {
      const tempDbDir = path.resolve('supabase/.temp_dbs');
      const tempDbExists = await fs.access(tempDbDir).then(() => true).catch(() => false);

      if (!tempDbExists) {
        if (verbose) this.progress('Temp databases directory not found, skipping...');
        return { items, size };
      }

      const files = await fs.readdir(tempDbDir);

      for (const file of files) {
        if (file.startsWith('test_') || file.startsWith('temp_')) {
          const filePath = path.join(tempDbDir, file);
          const stats = await fs.stat(filePath);

          size += stats.size;
          await fs.unlink(filePath);
          items++;

          if (verbose) {
            this.progress(`Cleaned temp DB: ${file} (${this.formatBytes(stats.size)})`);
          }
        }
      }

    } catch (error) {
      this.warn('Could not clean temporary databases', { error: error.message });
    }

    return { items, size };
  }

  /**
   * Clean old backup files
   */
  async cleanOldBackups(force, verbose) {
    let items = 0;
    let size = 0;

    try {
      const backupDir = path.resolve('supabase/.rollbacks');
      const backupExists = await fs.access(backupDir).then(() => true).catch(() => false);

      if (!backupExists) {
        if (verbose) this.progress('Backup directory not found, skipping...');
        return { items, size };
      }

      const files = await fs.readdir(backupDir);
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);

        if (force || stats.mtime.getTime() < thirtyDaysAgo) {
          size += stats.size;
          await fs.unlink(filePath);
          items++;

          if (verbose) {
            this.progress(`Cleaned old backup: ${file} (${this.formatBytes(stats.size)})`);
          }
        }
      }

    } catch (error) {
      this.warn('Could not clean backup files', { error: error.message });
    }

    return { items, size };
  }

  /**
   * Clean log files
   */
  async cleanLogFiles(force, verbose) {
    let items = 0;
    let size = 0;

    try {
      const logPatterns = [
        'supabase/.logs/**/*.log',
        'supabase/logs/**/*.log',
        '*.log'
      ];

      // This is a simplified implementation
      // In a real system, would use glob patterns to find log files
      const possibleLogFiles = [
        'supabase/migration.log',
        'supabase/error.log',
        'data.log'
      ];

      for (const logFile of possibleLogFiles) {
        try {
          const filePath = path.resolve(logFile);
          const stats = await fs.stat(filePath);

          if (force || stats.size > 10 * 1024 * 1024) { // > 10MB
            size += stats.size;
            await fs.unlink(filePath);
            items++;

            if (verbose) {
              this.progress(`Cleaned log: ${logFile} (${this.formatBytes(stats.size)})`);
            }
          }
        } catch (error) {
          // File doesn't exist, skip
        }
      }

    } catch (error) {
      this.warn('Could not clean log files', { error: error.message });
    }

    return { items, size };
  }

  /**
   * Check if file should be cleaned based on age and other criteria
   */
  async shouldCleanFile(filePath, stats) {
    // Clean files older than 24 hours
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    return stats.mtime.getTime() < twentyFourHoursAgo;
  }

  /**
   * Display cleanup results
   */
  displayCleanupResults(cleanedItems, totalSize) {
    console.log('\n🧹 Migration Cleanup Results');
    console.log('═══════════════════════════\n');
    console.log(`Files cleaned: ${cleanedItems}`);
    console.log(`Space freed: ${this.formatBytes(totalSize)}`);

    if (cleanedItems === 0) {
      console.log('\n✨ Nothing to clean - your migration workspace is already tidy!');
    } else {
      console.log('\n✅ Cleanup completed successfully');
    }
    console.log('');
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Migration clean handler
 * @param {Object} args - Command arguments
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @param {boolean} isProd - Production flag
 * @returns {Promise<Object>} Clean result
 */
export default async function cleanHandler(args, config, logger, isProd) {
  const command = new MigrateCleanCommand(config, logger, isProd);
  return await command.performExecute(args);
}

export { MigrateCleanCommand };
