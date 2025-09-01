/**
 * Migration Promotion Command
 * Promotes tested migrations from staging to production with safety checks
 */

import Command from '../../../lib/Command.js';
import MigrationMetadata from '../../../lib/MigrationMetadata.js';
import { promises as fs, statSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Command to promote a tested migration to production
 * @class
 */
class MigratePromoteCommand extends Command {
  static description = 'Promote tested migration to production';
  static requiresConfirmation = true;

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = true;
  }

  /**
   * Execute the promote command
   */
  async performExecute(args = {}) {
    this.emit('start');

    try {
      // Get migration path from arguments
      const migrationName = args.migration || args.m || 'current';
      const stagingPath = this.getStagingPath(migrationName);

      this.progress(`Promoting migration: ${migrationName}`);

      // 1. Verify tests passed in metadata
      await this.verifyTestsPassed(stagingPath);

      // 2. Move from staging to production
      const productionPath = await this.promoteToProduction(stagingPath);

      // 3. Update migration history
      await this.updateHistory(stagingPath, productionPath);

      // 4. Optionally stage in Git
      if (args.git !== false) {
        await this.stageInGit(productionPath);
      }

      this.success(`Migration promoted successfully: ${path.basename(productionPath)}`);
      this.emit('complete', {
        staging: stagingPath,
        production: productionPath,
        migration: migrationName
      });
    } catch (error) {
      this.error('Migration promotion failed', error);
      this.emit('failed', { error, migration: args.migration });
      throw error;
    }
  }

  /**
   * Get staging path for migration
   */
  getStagingPath(migrationName) {
    const supabaseRoot = this.findSupabaseRoot();

    if (migrationName === 'current') {
      return path.join(supabaseRoot, 'migrations-staging', 'current');
    }

    return path.join(supabaseRoot, 'migrations-staging', migrationName);
  }

  /**
   * Verify that tests have passed for this migration
   */
  async verifyTestsPassed(migrationPath) {
    this.progress('Verifying migration tests passed...');

    try {
      // Check if migration directory exists
      const stats = await fs.stat(migrationPath);
      if (!stats.isDirectory()) {
        throw new Error(`Migration path is not a directory: ${migrationPath}`);
      }

      // Load and check metadata
      const metadata = new MigrationMetadata(migrationPath);
      const data = metadata.read();

      // Check if migration has been tested
      if (data.status !== 'tested') {
        throw new Error(
          `Migration must be tested before promotion. Current status: ${data.status}`
        );
      }

      // Check if tests passed
      if (!data.testing || data.testing.tested_at === null) {
        throw new Error('No test results found in migration metadata');
      }

      if (data.testing.tests_failed > 0) {
        throw new Error(
          `Migration has failing tests: ${data.testing.tests_failed} failed, ${data.testing.tests_passed} passed`
        );
      }

      if (data.testing.tests_passed === 0) {
        this.warn('Warning: No tests were run for this migration');
        const proceed = await this.confirm('Proceed with promotion despite no tests?', false);
        if (!proceed) {
          throw new Error('Promotion cancelled - no tests run');
        }
      }

      this.progress(
        `Tests verified: ${data.testing.tests_passed} passed, ${data.testing.tests_failed} failed`
      );
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Migration not found: ${migrationPath}`);
      }
      throw error;
    }
  }

  /**
   * Promote migration from staging to production directory
   */
  async promoteToProduction(stagingPath) {
    this.progress('Moving migration to production directory...');

    const supabaseRoot = this.findSupabaseRoot();
    const migrationFileName = await this.generateMigrationFileName(stagingPath);
    const productionDir = path.join(supabaseRoot, 'migrations');
    const productionPath = path.join(productionDir, migrationFileName);

    // Ensure production directory exists
    try {
      await fs.mkdir(productionDir, { recursive: true });
    } catch (error) {
      // Directory already exists, continue
    }

    // Check if production file already exists
    try {
      await fs.access(productionPath);
      throw new Error(`Production migration already exists: ${migrationFileName}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Copy migration SQL file
    const stagingSqlPath = path.join(stagingPath, 'migration.sql');
    await fs.copyFile(stagingSqlPath, productionPath);

    this.progress(`Migration copied to: ${productionPath}`);
    return productionPath;
  }

  /**
   * Generate timestamped migration filename
   */
  async generateMigrationFileName(stagingPath) {
    // Load metadata to get the migration name
    const metadata = new MigrationMetadata(stagingPath);
    const data = metadata.read();

    // Generate timestamp in YYYYMMDD_HHMMSS format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    const timestamp = `${year}${month}${day}_${hour}${minute}${second}`;
    const safeName = data.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    return `${timestamp}_${safeName}.sql`;
  }

  /**
   * Update migration history with promotion record
   */
  async updateHistory(stagingPath, productionPath) {
    this.progress('Updating migration history...');

    const supabaseRoot = this.findSupabaseRoot();
    const historyPath = path.join(supabaseRoot, 'migrations', 'history.json');

    // Load metadata
    const metadata = new MigrationMetadata(stagingPath);
    const data = metadata.read();

    // Create history entry
    const historyEntry = {
      id: data.id,
      name: data.name,
      generated_at: data.generated,
      tested_at: data.testing.tested_at,
      promoted_at: new Date().toISOString(),
      promoted_by: this.getCurrentUser(),
      file_path: path.basename(productionPath),
      tests_passed: data.testing.tests_passed,
      tests_failed: data.testing.tests_failed
    };

    // Load or create history file
    let history = [];
    try {
      const historyContent = await fs.readFile(historyPath, 'utf8');
      history = JSON.parse(historyContent);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.warn(`Could not read existing history: ${error.message}`);
      }
    }

    // Add new entry and sort by promoted_at
    history.push(historyEntry);
    history.sort((a, b) => new Date(b.promoted_at) - new Date(a.promoted_at));

    // Write updated history
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8');

    // Update staging metadata to promoted status
    metadata.update({
      status: 'promoted',
      promotion: {
        promoted_at: historyEntry.promoted_at,
        promoted_by: historyEntry.promoted_by
      }
    });

    this.progress('Migration history updated');
  }

  /**
   * Stage promoted migration in Git
   */
  async stageInGit(productionPath) {
    this.progress('Staging migration in Git...');

    return new Promise((resolve, _reject) => {
      const git = spawn('git', ['add', productionPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      git.on('close', (code) => {
        if (code === 0) {
          this.progress('Migration staged in Git');
          resolve();
        } else {
          this.warn('Failed to stage migration in Git');
          resolve(); // Don't fail promotion for Git issues
        }
      });

      git.on('error', (error) => {
        this.warn(`Git staging failed: ${error.message}`);
        resolve(); // Don't fail promotion for Git issues
      });
    });
  }

  /**
   * Get current user for promotion tracking
   */
  getCurrentUser() {
    return process.env.USER || process.env.USERNAME || 'unknown';
  }

  /**
   * Find Supabase root directory by walking up from current directory
   */
  findSupabaseRoot() {
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      const supabasePath = path.join(currentDir, 'supabase');
      try {
        statSync(supabasePath);
        return supabasePath;
      } catch {
        currentDir = path.dirname(currentDir);
      }
    }

    throw new Error(
      'Could not find supabase directory. Run this command from within a Supabase project.'
    );
  }

  /**
   * Show help for promote command
   */
  showHelp() {
    console.log('Usage: data db:migrate:promote [options]');
    console.log('');
    console.log('Promote a tested migration to production');
    console.log('');
    console.log('Options:');
    console.log('  --migration, -m <name>  Migration to promote (default: current)');
    console.log('  --no-git               Skip Git staging');
    console.log('  --help                 Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  data db:migrate:promote                    # Promote current migration');
    console.log('  data db:migrate:promote -m migration1     # Promote specific migration');
    console.log('  data db:migrate:promote --no-git          # Promote without Git staging');
    console.log('');
    console.log('Requirements:');
    console.log('  - Migration must have status "tested"');
    console.log('  - All tests must pass (tests_failed = 0)');
    console.log('  - Production directory must not have conflicting file');
  }
}

/**
 * Promote tested migration to production handler
 * @param {Object} args - Command arguments
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @param {boolean} isProd - Production flag
 * @returns {Promise<Object>} Promotion result
 */
export default async function promoteHandler(args, config, logger, isProd) {
  const command = new MigratePromoteCommand(config, logger, isProd);
  return command.performExecute(args);
}

export { MigratePromoteCommand };
