/**
 * Migration Verify Command
 */

import Command from '../../../lib/Command.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Verify migration integrity including file hashes and metadata validation
 */
/**
 * @class
 */
class MigrateVerifyCommand extends Command {
  static description = 'Verify migration integrity';

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Read-only verification
  }

  /**
   * Execute migration verification
   */
  async performExecute(args = {}) {
    this.emit('start');

    try {
      const fix = args.fix || args.f || false;
      const verbose = args.verbose || args.v || false;

      this.progress('Starting migration integrity verification...');

      let totalChecks = 0;
      let passedChecks = 0;
      let failedChecks = 0;
      const issues = [];

      // Check file hashes
      const hashResult = await this.verifyFileHashes(verbose);
      totalChecks += hashResult.total;
      passedChecks += hashResult.passed;
      failedChecks += hashResult.failed;
      issues.push(...hashResult.issues);

      // Validate metadata
      const metadataResult = await this.validateMetadata(verbose);
      totalChecks += metadataResult.total;
      passedChecks += metadataResult.passed;
      failedChecks += metadataResult.failed;
      issues.push(...metadataResult.issues);

      // Check migration dependencies
      const depResult = await this.checkDependencies(verbose);
      totalChecks += depResult.total;
      passedChecks += depResult.passed;
      failedChecks += depResult.failed;
      issues.push(...depResult.issues);

      // Check SQL syntax
      const sqlResult = await this.verifySqlSyntax(verbose);
      totalChecks += sqlResult.total;
      passedChecks += sqlResult.passed;
      failedChecks += sqlResult.failed;
      issues.push(...sqlResult.issues);

      // Fix issues if requested
      if (fix && issues.length > 0) {
        await this.fixIssues(issues);
      }

      // Display results
      this.displayVerificationResults(totalChecks, passedChecks, failedChecks, issues);

      this.emit('complete', {
        totalChecks,
        passedChecks,
        failedChecks,
        issues: issues.length
      });
    } catch (error) {
      this.error('Migration verification failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }

  /**
   * Verify file hashes against stored checksums
   */
  async verifyFileHashes(verbose) {
    let total = 0;
    let passed = 0;
    let failed = 0;
    const issues = [];

    try {
      const migrationsDir = path.resolve('supabase/migrations');
      const checksumFile = path.resolve('supabase/.migration_checksums.json');

      // Check if migrations directory exists
      const migrationsExists = await fs
        .access(migrationsDir)
        .then(() => true)
        .catch(() => false);
      if (!migrationsExists) {
        issues.push({ type: 'missing_directory', path: migrationsDir });
        return { total, passed, failed, issues };
      }

      // Load stored checksums
      let storedChecksums = {};
      const checksumExists = await fs
        .access(checksumFile)
        .then(() => true)
        .catch(() => false);
      if (checksumExists) {
        const checksumContent = await fs.readFile(checksumFile, 'utf8');
        storedChecksums = JSON.parse(checksumContent);
      }

      // Get all migration files
      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files.filter((f) => f.endsWith('.sql'));

      for (const file of migrationFiles) {
        total++;
        const filePath = path.join(migrationsDir, file);

        // Calculate current hash
        const content = await fs.readFile(filePath, 'utf8');
        const currentHash = crypto.createHash('sha256').update(content).digest('hex');

        // Compare with stored hash
        const storedHash = storedChecksums[file];

        if (!storedHash) {
          issues.push({
            type: 'missing_checksum',
            file,
            currentHash
          });
          failed++;
          if (verbose) this.warn(`Missing checksum for: ${file}`);
        } else if (storedHash !== currentHash) {
          issues.push({
            type: 'checksum_mismatch',
            file,
            storedHash,
            currentHash
          });
          failed++;
          if (verbose) this.warn(`Checksum mismatch for: ${file}`);
        } else {
          passed++;
          if (verbose) this.progress(`Hash verified: ${file}`);
        }
      }
    } catch (error) {
      issues.push({ type: 'hash_verification_error', error: error.message });
    }

    return { total, passed, failed, issues };
  }

  /**
   * Validate migration metadata
   */
  async validateMetadata(verbose) {
    let total = 0;
    let passed = 0;
    let failed = 0;
    const issues = [];

    try {
      const historyFile = path.resolve('supabase/.migration_history.json');
      const historyExists = await fs
        .access(historyFile)
        .then(() => true)
        .catch(() => false);

      if (!historyExists) {
        issues.push({ type: 'missing_history_file', path: historyFile });
        return { total, passed, failed, issues };
      }

      const historyContent = await fs.readFile(historyFile, 'utf8');
      let history;

      // Validate JSON structure
      total++;
      try {
        history = JSON.parse(historyContent);
        passed++;
        if (verbose) this.progress('History JSON is valid');
      } catch (parseError) {
        issues.push({ type: 'invalid_json', file: historyFile, error: parseError.message });
        failed++;
        return { total, passed, failed, issues };
      }

      // Validate each history entry
      for (const [index, entry] of history.entries()) {
        total++;

        const requiredFields = ['action', 'timestamp'];
        const missingFields = requiredFields.filter((field) => !entry[field]);

        if (missingFields.length > 0) {
          issues.push({
            type: 'missing_required_fields',
            entry: index,
            missingFields
          });
          failed++;
        } else {
          // Validate timestamp format
          if (isNaN(new Date(entry.timestamp).getTime())) {
            issues.push({
              type: 'invalid_timestamp',
              entry: index,
              timestamp: entry.timestamp
            });
            failed++;
          } else {
            passed++;
            if (verbose) this.progress(`Entry ${index} is valid`);
          }
        }
      }
    } catch (error) {
      issues.push({ type: 'metadata_validation_error', error: error.message });
    }

    return { total, passed, failed, issues };
  }

  /**
   * Check migration dependencies
   */
  async checkDependencies(verbose) {
    let total = 0;
    let passed = 0;
    let failed = 0;
    const issues = [];

    try {
      const migrationsDir = path.resolve('supabase/migrations');
      const migrationsExists = await fs
        .access(migrationsDir)
        .then(() => true)
        .catch(() => false);

      if (!migrationsExists) {
        return { total, passed, failed, issues };
      }

      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

      for (let i = 0; i < migrationFiles.length; i++) {
        total++;
        const file = migrationFiles[i];
        const filePath = path.join(migrationsDir, file);

        // Check if migration follows naming convention
        const timestampMatch = file.match(/^(\d{14})_/);
        if (!timestampMatch) {
          issues.push({
            type: 'invalid_naming_convention',
            file,
            expected: 'YYYYMMDDHHMMSS_description.sql'
          });
          failed++;
          continue;
        }

        // Check chronological order
        if (i > 0) {
          const prevFile = migrationFiles[i - 1];
          const prevTimestamp = prevFile.match(/^(\d{14})_/)?.[1];
          const currentTimestamp = timestampMatch[1];

          if (currentTimestamp <= prevTimestamp) {
            issues.push({
              type: 'chronological_order_violation',
              file,
              prevFile,
              currentTimestamp,
              prevTimestamp
            });
            failed++;
          } else {
            passed++;
            if (verbose) this.progress(`Dependency check passed: ${file}`);
          }
        } else {
          passed++;
        }
      }
    } catch (error) {
      issues.push({ type: 'dependency_check_error', error: error.message });
    }

    return { total, passed, failed, issues };
  }

  /**
   * Verify SQL syntax (basic check)
   */
  async verifySqlSyntax(verbose) {
    let total = 0;
    let passed = 0;
    let failed = 0;
    const issues = [];

    try {
      const migrationsDir = path.resolve('supabase/migrations');
      const migrationsExists = await fs
        .access(migrationsDir)
        .then(() => true)
        .catch(() => false);

      if (!migrationsExists) {
        return { total, passed, failed, issues };
      }

      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files.filter((f) => f.endsWith('.sql'));

      for (const file of migrationFiles) {
        total++;
        const filePath = path.join(migrationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');

        // Basic SQL syntax checks
        const syntaxIssues = this.checkBasicSqlSyntax(content, file);

        if (syntaxIssues.length > 0) {
          issues.push(...syntaxIssues);
          failed++;
          if (verbose) this.warn(`SQL syntax issues in: ${file}`);
        } else {
          passed++;
          if (verbose) this.progress(`SQL syntax OK: ${file}`);
        }
      }
    } catch (error) {
      issues.push({ type: 'sql_syntax_error', error: error.message });
    }

    return { total, passed, failed, issues };
  }

  /**
   * Basic SQL syntax checking
   */
  checkBasicSqlSyntax(content, filename) {
    const issues = [];

    // Check for common SQL issues
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for unterminated statements (basic check)
      if (
        line.trim().length > 0 &&
        !line.trim().startsWith('--') &&
        !line.includes(';') &&
        lineNum === lines.length
      ) {
        issues.push({
          type: 'unterminated_statement',
          file: filename,
          line: lineNum,
          content: line.trim()
        });
      }

      // Check for potentially dangerous operations without transactions
      const dangerousOps = ['DROP TABLE', 'TRUNCATE', 'DELETE FROM'];
      const upperLine = line.toUpperCase();

      dangerousOps.forEach((op) => {
        if (
          upperLine.includes(op) &&
          !content.toUpperCase().includes('BEGIN') &&
          !content.toUpperCase().includes('TRANSACTION')
        ) {
          issues.push({
            type: 'dangerous_operation_without_transaction',
            file: filename,
            line: lineNum,
            operation: op
          });
        }
      });
    });

    return issues;
  }

  /**
   * Fix detected issues
   */
  async fixIssues(issues) {
    this.progress('Attempting to fix detected issues...');

    for (const issue of issues) {
      try {
        switch (issue.type) {
        case 'missing_checksum':
          await this.fixMissingChecksum(issue);
          break;
        case 'checksum_mismatch':
          this.warn(
            `Cannot auto-fix checksum mismatch for ${issue.file} - manual review required`
          );
          break;
        default:
          this.warn(`Cannot auto-fix issue type: ${issue.type}`);
        }
      } catch (error) {
        this.warn(`Failed to fix issue: ${issue.type}`, { error: error.message });
      }
    }
  }

  /**
   * Fix missing checksum by generating it
   */
  async fixMissingChecksum(issue) {
    const checksumFile = path.resolve('supabase/.migration_checksums.json');

    let checksums = {};
    const checksumExists = await fs
      .access(checksumFile)
      .then(() => true)
      .catch(() => false);
    if (checksumExists) {
      const content = await fs.readFile(checksumFile, 'utf8');
      checksums = JSON.parse(content);
    }

    checksums[issue.file] = issue.currentHash;

    await fs.writeFile(checksumFile, JSON.stringify(checksums, null, 2));
    this.progress(`Generated checksum for: ${issue.file}`);
  }

  /**
   * Display verification results
   */
  displayVerificationResults(totalChecks, passedChecks, failedChecks, issues) {
    console.log('\n🔍 Migration Verification Results');
    console.log('═══════════════════════════════════\n');

    console.log(`Total checks: ${totalChecks}`);
    console.log(`Passed: ${passedChecks} ✅`);
    console.log(`Failed: ${failedChecks} ❌`);
    console.log('');

    if (issues.length > 0) {
      console.log('Issues found:');
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.type}: ${issue.file || 'N/A'}`);
        if (issue.error) {
          console.log(`   Error: ${issue.error}`);
        }
      });
      console.log('');
    }

    if (failedChecks === 0) {
      console.log('✅ All verification checks passed!');
    } else {
      console.log(`⚠️  ${failedChecks} checks failed - review issues above`);
    }
    console.log('');
  }
}

/**
 * Migration verify handler
 * @param {Object} args - Command arguments
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @param {boolean} isProd - Production flag
 * @returns {Promise<Object>} Verify result
 */
export default async function verifyHandler(args, config, logger, isProd) {
  const command = new MigrateVerifyCommand(config, logger, isProd);
  return command.performExecute(args);
}

export { MigrateVerifyCommand };
