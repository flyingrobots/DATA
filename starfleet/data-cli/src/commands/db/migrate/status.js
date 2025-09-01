/**
 * Migration Status Command
 */

const Command = require('../../../lib/Command');
const fs = require('fs').promises;
const path = require('path');

/**
 * Show current migration status including staging state and pending migrations
 */
class MigrateStatusCommand extends Command {
  static description = 'Show current migration status';

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Read-only operation
  }

  /**
   * Execute migration status check
   */
  async performExecute() {
    this.emit('start');

    try {
      this.progress('Checking migration status...');

      // Get staging status
      const stagingStatus = await this.getStagingStatus();

      // List pending migrations
      const pendingMigrations = await this.getPendingMigrations();

      // Get last promoted migration
      const lastPromoted = await this.getLastPromotedMigration();

      // Display results
      this.displayMigrationStatus(stagingStatus, pendingMigrations, lastPromoted);

      this.emit('complete', {
        stagingStatus,
        pendingMigrations: pendingMigrations.length,
        lastPromoted
      });

    } catch (error) {
      this.error('Migration status check failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }

  /**
   * Check staging area status
   */
  async getStagingStatus() {
    try {
      const stagingDir = path.resolve('supabase/.staging');
      const stagingExists = await fs.access(stagingDir).then(() => true).catch(() => false);

      if (!stagingExists) {
        return { status: 'clean', files: 0 };
      }

      const files = await fs.readdir(stagingDir);
      return {
        status: files.length > 0 ? 'dirty' : 'clean',
        files: files.length,
        fileList: files
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations() {
    try {
      const migrationsDir = path.resolve('supabase/migrations');
      const migrationsExists = await fs.access(migrationsDir).then(() => true).catch(() => false);

      if (!migrationsExists) {
        return [];
      }

      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files.filter(f => f.endsWith('.sql'));

      return migrationFiles.sort();
    } catch (error) {
      this.warn('Could not read migrations directory', { error: error.message });
      return [];
    }
  }

  /**
   * Get last promoted migration info
   */
  async getLastPromotedMigration() {
    try {
      const historyFile = path.resolve('supabase/.migration_history.json');
      const historyExists = await fs.access(historyFile).then(() => true).catch(() => false);

      if (!historyExists) {
        return null;
      }

      const historyContent = await fs.readFile(historyFile, 'utf8');
      const history = JSON.parse(historyContent);

      // Find most recent promotion
      const promotions = history.filter(entry => entry.action === 'promote');
      return promotions.length > 0 ? promotions[promotions.length - 1] : null;

    } catch (error) {
      this.warn('Could not read migration history', { error: error.message });
      return null;
    }
  }

  /**
   * Display migration status information
   */
  displayMigrationStatus(stagingStatus, pendingMigrations, lastPromoted) {
    console.log('\n🔍 Migration Status Report');
    console.log('═══════════════════════════\n');

    // Staging status
    console.log(`📦 Staging Area: ${stagingStatus.status.toUpperCase()}`);
    if (stagingStatus.status === 'dirty') {
      console.log(`   Files in staging: ${stagingStatus.files}`);
      stagingStatus.fileList?.forEach(file => {
        console.log(`   • ${file}`);
      });
    } else if (stagingStatus.status === 'error') {
      console.log(`   Error: ${stagingStatus.error}`);
    }
    console.log('');

    // Pending migrations
    console.log(`📋 Pending Migrations: ${pendingMigrations.length}`);
    if (pendingMigrations.length > 0) {
      pendingMigrations.slice(0, 5).forEach(migration => {
        console.log(`   • ${migration}`);
      });
      if (pendingMigrations.length > 5) {
        console.log(`   ... and ${pendingMigrations.length - 5} more`);
      }
    }
    console.log('');

    // Last promoted
    console.log('🚀 Last Promoted Migration:');
    if (lastPromoted) {
      console.log(`   Migration: ${lastPromoted.migration || 'Unknown'}`);
      console.log(`   Date: ${new Date(lastPromoted.timestamp).toLocaleString()}`);
      console.log(`   Status: ${lastPromoted.status || 'Unknown'}`);
    } else {
      console.log('   No migrations have been promoted yet');
    }
    console.log('');
  }
}

module.exports = MigrateStatusCommand;
