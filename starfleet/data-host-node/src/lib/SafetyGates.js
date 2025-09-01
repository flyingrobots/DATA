/**
 * SafetyGates.js - Production Safety Gate System
 *
 * Implements safety checks to prevent accidental production damage during
 * migrations and deployments. Like D.A.T.A.'s positronic safety protocols,
 * these gates prevent harm to production systems.
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { promisify } from 'util';
import { createInterface } from 'readline';
import path from 'path';
// CoverageEnforcer import removed - we'll implement basic coverage parsing inline

/**
 * Safety gate system for production operations
 */
export class SafetyGates {
  constructor(logger = null, options = {}) {
    this.logger = logger || console;
    this.auditLog = [];
    this.options = {
      gitEnabled: true,
      branchValidation: true,
      testValidation: true,
      confirmationRequired: true,
      coverageThreshold: 80,
      ...options
    };
  }

  /**
   * Run all safety gates for a production operation
   * @param {Object} config - Gate configuration
   * @param {boolean} force - Force bypass gates (EMERGENCY ONLY)
   * @returns {Promise<boolean>} True if all gates pass
   */
  async runAllGates(config = {}, force = false) {
    const gateConfig = {
      operation: 'production-deployment',
      expectedBranch: 'main',
      coverageThreshold: this.options.coverageThreshold,
      confirmationMessage: 'PROCEED WITH PRODUCTION OPERATION',
      ...config
    };

    this.log('info', 'Starting production safety gate validation', {
      operation: gateConfig.operation,
      force,
      timestamp: new Date().toISOString()
    });

    if (force) {
      this.log('warn', 'FORCE flag detected - BYPASSING ALL SAFETY GATES!', {
        operator: this.getCurrentUser(),
        timestamp: new Date().toISOString(),
        danger_level: 'CRITICAL'
      });

      const confirmed = await this.requireForceConfirmation();
      if (!confirmed) {
        this.log('info', 'Force bypass cancelled by operator');
        return false;
      }

      this.log('warn', 'All safety gates BYPASSED via force flag');
      return true;
    }

    try {
      // Gate 1: Git repository validation
      if (this.options.gitEnabled) {
        await this.validateGitClean();
      }

      // Gate 2: Branch verification
      if (this.options.branchValidation && gateConfig.expectedBranch) {
        await this.validateBranch(gateConfig.expectedBranch);
      }

      // Gate 3: Test validation
      if (this.options.testValidation) {
        await this.validateTests(gateConfig.coverageThreshold);
      }

      // Gate 4: Production confirmation
      if (this.options.confirmationRequired) {
        const confirmed = await this.requireConfirmation(
          `Type "${gateConfig.confirmationMessage}" to proceed with ${gateConfig.operation}`,
          gateConfig.confirmationMessage
        );

        if (!confirmed) {
          this.log('info', 'Production operation cancelled by operator');
          return false;
        }
      }

      this.log('info', 'All safety gates PASSED', {
        operation: gateConfig.operation,
        gates_passed: this.getPassedGatesCount(),
        timestamp: new Date().toISOString()
      });

      return true;

    } catch (error) {
      this.log('error', 'Safety gate FAILED', {
        error: error.message,
        operation: gateConfig.operation,
        gate: this.getCurrentGate(),
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Validate git repository is in clean state
   * @returns {Promise<void>}
   */
  async validateGitClean() {
    this.setCurrentGate('git-clean-check');
    this.log('info', 'Validating git repository state...');

    try {
      // Check if we're in a git repository
      await this.execGitCommand(['rev-parse', '--git-dir']);

      // Check for uncommitted changes
      const statusOutput = await this.execGitCommand(['status', '--porcelain']);

      if (statusOutput.trim()) {
        const files = statusOutput.split('\n').filter(line => line.trim());
        this.log('audit', 'Git repository has uncommitted changes', {
          uncommitted_files: files,
          file_count: files.length
        });

        throw new Error(`Git repository has ${files.length} uncommitted changes. Please commit or stash changes before proceeding.`);
      }

      // Check for unpushed commits
      try {
        const unpushedOutput = await this.execGitCommand(['log', '@{u}..HEAD', '--oneline']);
        if (unpushedOutput.trim()) {
          const commits = unpushedOutput.split('\n').filter(line => line.trim());
          this.log('warn', 'Git repository has unpushed commits', {
            unpushed_commits: commits,
            commit_count: commits.length
          });

          // Warning only - don't fail the gate for unpushed commits
        }
      } catch (error) {
        // No upstream branch or other issue - continue
        this.log('debug', 'Could not check for unpushed commits', { error: error.message });
      }

      this.log('audit', 'Git clean validation PASSED');

    } catch (error) {
      if (error.message.includes('not a git repository')) {
        this.log('warn', 'Not in a git repository - skipping git validation');
        return;
      }
      throw error;
    }
  }

  /**
   * Validate current branch matches expected
   * @param {string} expectedBranch - Expected branch name
   * @returns {Promise<void>}
   */
  async validateBranch(expectedBranch) {
    this.setCurrentGate('branch-validation');
    this.log('info', `Validating current branch is ${expectedBranch}...`);

    try {
      const currentBranch = await this.execGitCommand(['rev-parse', '--abbrev-ref', 'HEAD']);
      const branch = currentBranch.trim();

      if (branch !== expectedBranch) {
        this.log('audit', 'Branch validation FAILED', {
          current_branch: branch,
          expected_branch: expectedBranch
        });

        throw new Error(`Current branch is "${branch}" but expected "${expectedBranch}". Please switch to the correct branch.`);
      }

      this.log('audit', 'Branch validation PASSED', {
        branch
      });

    } catch (error) {
      if (error.message.includes('not a git repository')) {
        this.log('warn', 'Not in a git repository - skipping branch validation');
        return;
      }
      throw error;
    }
  }

  /**
   * Validate tests pass with minimum coverage
   * @param {number} coverageThreshold - Minimum coverage percentage
   * @returns {Promise<void>}
   */
  async validateTests(coverageThreshold = 80) {
    this.setCurrentGate('test-validation');
    this.log('info', `Validating tests pass with ${coverageThreshold}% coverage...`);

    try {
      // Check if we have a test command available
      const hasVitestConfig = await this.fileExists('vitest.config.js') ||
                               await this.fileExists('vite.config.js');
      const hasPackageJson = await this.fileExists('package.json');

      if (!hasVitestConfig && !hasPackageJson) {
        this.log('warn', 'No test configuration found - skipping test validation');
        return;
      }

      // Try to run tests with coverage
      let testResult;
      try {
        testResult = await this.runTestsWithCoverage();
      } catch (error) {
        this.log('audit', 'Test execution FAILED', {
          error: error.message,
          coverage_threshold: coverageThreshold
        });
        throw new Error(`Tests failed to run: ${error.message}`);
      }

      // Validate coverage if enforcer is available
      if (testResult.coverage && testResult.coverage.total < coverageThreshold) {
        this.log('audit', 'Coverage threshold FAILED', {
          actual_coverage: testResult.coverage.total,
          required_coverage: coverageThreshold
        });

        throw new Error(`Test coverage ${testResult.coverage.total}% is below required ${coverageThreshold}%`);
      }

      // Check for test failures
      if (testResult.failed > 0) {
        this.log('audit', 'Test validation FAILED', {
          tests_passed: testResult.passed,
          tests_failed: testResult.failed,
          coverage: testResult.coverage?.total
        });

        throw new Error(`${testResult.failed} tests failed. All tests must pass before production deployment.`);
      }

      this.log('audit', 'Test validation PASSED', {
        tests_passed: testResult.passed,
        tests_failed: testResult.failed,
        coverage: testResult.coverage?.total
      });

    } catch (error) {
      // Re-throw with context
      throw error;
    }
  }

  /**
   * Require typed confirmation for production operations
   * @param {string} message - Confirmation prompt message
   * @param {string} expectedInput - Expected confirmation text
   * @returns {Promise<boolean>} True if confirmation matches
   */
  async requireConfirmation(message, expectedInput) {
    this.setCurrentGate('production-confirmation');
    this.log('info', 'Requesting production operation confirmation...');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const userInput = await new Promise((resolve) => {
        rl.question(`\n⚠️  PRODUCTION SAFETY GATE ⚠️\n\n${message}: `, resolve);
      });

      const confirmed = userInput.trim() === expectedInput;

      this.log('audit', 'Production confirmation attempted', {
        expected: expectedInput,
        provided_length: userInput.trim().length,
        confirmed,
        operator: this.getCurrentUser(),
        timestamp: new Date().toISOString()
      });

      if (!confirmed) {
        this.log('info', 'Confirmation text did not match - operation cancelled');
      }

      return confirmed;

    } finally {
      rl.close();
    }
  }

  /**
   * Require force confirmation (double safety for --force flag)
   * @returns {Promise<boolean>} True if force operation confirmed
   */
  async requireForceConfirmation() {
    const message = 'FORCE MODE BYPASSES ALL SAFETY GATES!\n\nThis is EXTREMELY DANGEROUS and should only be used in emergencies.\nType "I UNDERSTAND THE RISKS" to continue';

    return this.requireConfirmation(message, 'I UNDERSTAND THE RISKS');
  }

  /**
   * Execute git command
   * @param {string[]} args - Git command arguments
   * @returns {Promise<string>} Command output
   */
  async execGitCommand(args) {
    return new Promise((resolve, _reject) => {
      const git = spawn('git', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed (exit ${code}): ${stderr.trim() || 'Unknown error'}`));
        }
      });

      git.on('error', (error) => {
        reject(new Error(`Failed to execute git: ${error.message}`));
      });
    });
  }

  /**
   * Run tests with coverage
   * @returns {Promise<Object>} Test results
   */
  async runTestsWithCoverage() {
    // Try npm test first (most common)
    try {
      const result = await this.execCommand('npm', ['test', '--', '--coverage']);
      return this.parseTestOutput(result);
    } catch (error) {
      // Try vitest directly
      try {
        const result = await this.execCommand('npx', ['vitest', 'run', '--coverage']);
        return this.parseTestOutput(result);
      } catch (vitestError) {
        throw new Error(`Test execution failed: ${error.message}`);
      }
    }
  }

  /**
   * Execute system command
   * @param {string} command - Command to execute
   * @param {string[]} args - Command arguments
   * @returns {Promise<string>} Command output
   */
  async execCommand(command, args) {
    return new Promise((resolve, _reject) => {
      const proc = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed (exit ${code}): ${stderr.trim() || stdout.trim() || 'Unknown error'}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to execute ${command}: ${error.message}`));
      });
    });
  }

  /**
   * Parse test output for results
   * @param {string} output - Test command output
   * @returns {Object} Parsed test results
   */
  parseTestOutput(output) {
    const result = {
      passed: 0,
      failed: 0,
      coverage: null
    };

    // Parse test counts (vitest format)
    const testSummaryMatch = output.match(/Tests\s+(\d+)\s+passed[^|]*\|\s*(\d+)\s+failed/i);
    if (testSummaryMatch) {
      result.passed = parseInt(testSummaryMatch[1], 10);
      result.failed = parseInt(testSummaryMatch[2], 10);
    }

    // Parse coverage (look for percentage)
    const coverageMatch = output.match(/All files[^|]*\|\s*([0-9.]+)/);
    if (coverageMatch) {
      result.coverage = {
        total: parseFloat(coverageMatch[1])
      };
    }

    return result;
  }

  /**
   * Check if file exists
   * @param {string} filename - File to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filename) {
    try {
      await readFile(filename);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current system user
   * @returns {string} Current user name
   */
  getCurrentUser() {
    return process.env.USER || process.env.USERNAME || 'unknown';
  }

  /**
   * Set current gate for audit logging
   * @param {string} gate - Gate name
   */
  setCurrentGate(gate) {
    this.currentGate = gate;
  }

  /**
   * Get current gate
   * @returns {string} Current gate name
   */
  getCurrentGate() {
    return this.currentGate || 'unknown';
  }

  /**
   * Get count of passed gates
   * @returns {number} Number of gates passed
   */
  getPassedGatesCount() {
    return this.auditLog.filter(entry => entry.level === 'audit' && entry.message.includes('PASSED')).length;
  }

  /**
   * Log message with audit trail
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    const logEntry = {
      level,
      message,
      gate: this.currentGate,
      timestamp: new Date().toISOString(),
      ...data
    };

    this.auditLog.push(logEntry);

    // Log to provided logger
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message, data);
    } else if (this.logger && typeof this.logger.log === 'function') {
      this.logger.log(`[${level.toUpperCase()}] ${message}`, data);
    } else {
      // Fallback to console
      console.log(`[${level.toUpperCase()}] [${this.currentGate || 'SafetyGates'}] ${message}`, data);
    }
  }

  /**
   * Get complete audit log
   * @returns {Array} Audit log entries
   */
  getAuditLog() {
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog() {
    this.auditLog = [];
  }
}

export default SafetyGates;
