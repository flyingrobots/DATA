/**
 * Test Dev-Cycle Command
 *
 * Orchestrates the full development cycle: Compile → Reset → Test
 * Provides rapid feedback for database test development workflow
 */

import TestCommand from '../../lib/TestCommand.js';
import CompileCommand from './CompileCommand.js';
import RunCommand from './RunCommand.js';
import ResetCommand from '../db/ResetCommand.js';
import Config from '../../lib/config.js';

/**
 * Development cycle command that orchestrates compile → reset → test workflow
 */
class DevCycleCommand extends TestCommand {
  constructor(
    databaseUrl,
    serviceRoleKey = null,
    testsDir,
    outputDir,
    logger = null,
    isProd = false,
    pathResolver = null
  ) {
    super(databaseUrl, serviceRoleKey, testsDir, outputDir, logger, isProd, pathResolver);

    // Dev-cycle never requires production confirmation - it's a development tool
    this.requiresProductionConfirmation = false;

    // Track timing for performance reporting
    this.timings = {};
  }

  /**
   * Execute the full development cycle
   */
  async performExecute(options = {}) {
    const startTime = new Date();

    this.emit('dev-cycle:start', {
      isProd: this.isProd,
      testsDir: this.testsDir,
      outputDir: this.outputDir,
      options
    });

    try {
      // Load test configuration to respect settings
      const testConfig = await this._getTestConfig();

      this.progress('Starting development cycle: Compile → Reset → Test');

      // Step 1: Compile tests
      await this._executeCompileStep();

      // Step 2: Reset database
      await this._executeResetStep();

      // Step 3: Run tests
      const testResults = await this._executeTestStep(options);

      // Calculate total execution time
      const totalTime = new Date() - startTime;
      this.timings.total = totalTime;

      // Report completion
      this._reportCycleCompletion(testResults, totalTime);

      this.emit('dev-cycle:complete', {
        results: testResults,
        timings: this.timings,
        success: testResults.failed === 0
      });

      return testResults;
    } catch (error) {
      const totalTime = new Date() - startTime;
      this.error(`Development cycle failed after ${this._formatDuration(totalTime)}`, error);
      this.emit('dev-cycle:failed', { error, timings: this.timings });
      throw error;
    }
  }

  /**
   * Execute the test compilation step
   * @private
   */
  async _executeCompileStep() {
    const stepStart = new Date();
    this.progress('Step 1/3: Compiling tests...');
    this.emit('dev-cycle:step', { step: 1, name: 'compile', status: 'running' });

    try {
      // Create compile command using migration_output resource exclusively
      const compileCommand = new CompileCommand(
        this.testsDir,
        this.outputDir,
        this.logger,
        this.isProd
      );

      // Attach progress listeners
      compileCommand.on('compilation:progress', (progress) => {
        this.emit('dev-cycle:compile-progress', progress);
      });

      // Execute compilation
      const result = await compileCommand.execute();

      const stepTime = new Date() - stepStart;
      this.timings.compile = stepTime;

      this.success(`✓ Compilation complete (${this._formatDuration(stepTime)})`);
      this.emit('dev-cycle:step', {
        step: 1,
        name: 'compile',
        status: 'complete',
        duration: stepTime,
        result
      });

      return result;
    } catch (error) {
      const stepTime = new Date() - stepStart;
      this.timings.compile = stepTime;
      this.emit('dev-cycle:step', {
        step: 1,
        name: 'compile',
        status: 'failed',
        duration: stepTime,
        error
      });
      throw new Error(`Compilation failed: ${error.message}`);
    }
  }

  /**
   * Execute the database reset step
   * @private
   */
  async _executeResetStep() {
    const stepStart = new Date();
    this.progress('Step 2/3: Resetting database...');
    this.emit('dev-cycle:step', { step: 2, name: 'reset', status: 'running' });

    try {
      // Create reset command - ResetCommand only takes specific parameters
      const resetCommand = new ResetCommand(
        this.databaseUrl,
        this.serviceRoleKey,
        null, // anonKey
        this.logger,
        this.isProd
      );

      // The ResetCommand needs access to outputConfig for supabase directory
      // We'll create a simple OutputConfig for this purpose
      const { default: OutputConfig } = await import('../../lib/OutputConfig.js');
      resetCommand.outputConfig = new OutputConfig();

      // Attach progress listeners
      resetCommand.on('output', (output) => {
        this.emit('dev-cycle:reset-output', output);
      });

      // Execute reset
      await resetCommand.execute();

      const stepTime = new Date() - stepStart;
      this.timings.reset = stepTime;

      this.success(`✓ Database reset complete (${this._formatDuration(stepTime)})`);
      this.emit('dev-cycle:step', {
        step: 2,
        name: 'reset',
        status: 'complete',
        duration: stepTime
      });
    } catch (error) {
      const stepTime = new Date() - stepStart;
      this.timings.reset = stepTime;
      this.emit('dev-cycle:step', {
        step: 2,
        name: 'reset',
        status: 'failed',
        duration: stepTime,
        error
      });
      throw new Error(`Database reset failed: ${error.message}`);
    }
  }

  /**
   * Execute the test run step
   * @private
   */
  async _executeTestStep(options = {}) {
    const stepStart = new Date();
    this.progress('Step 3/3: Running tests...');
    this.emit('dev-cycle:step', { step: 3, name: 'test', status: 'running' });

    try {
      // Create run command
      const runCommand = new RunCommand(
        this.databaseUrl,
        this.serviceRoleKey,
        this.testsDir,
        this.outputDir,
        this.logger,
        this.isProd
      );

      // Attach progress listeners
      runCommand.on('start', (event) => {
        this.emit('dev-cycle:test-start', event);
      });

      runCommand.on('complete', (event) => {
        this.emit('dev-cycle:test-complete', event);
      });

      // Execute tests with passed options
      const testResults = await runCommand.execute(options);

      const stepTime = new Date() - stepStart;
      this.timings.test = stepTime;

      // Success message depends on test results
      if (testResults.failed === 0) {
        this.success(`✓ All tests passed (${this._formatDuration(stepTime)})`);
      } else {
        this.warn(
          `✗ ${testResults.failed}/${testResults.total} tests failed (${this._formatDuration(stepTime)})`
        );
      }

      this.emit('dev-cycle:step', {
        step: 3,
        name: 'test',
        status: 'complete',
        duration: stepTime,
        results: testResults
      });

      return testResults;
    } catch (error) {
      const stepTime = new Date() - stepStart;
      this.timings.test = stepTime;
      this.emit('dev-cycle:step', {
        step: 3,
        name: 'test',
        status: 'failed',
        duration: stepTime,
        error
      });
      throw new Error(`Test execution failed: ${error.message}`);
    }
  }

  /**
   * Report cycle completion with summary
   * @private
   */
  _reportCycleCompletion(testResults, totalTime) {
    console.log(''); // Empty line for spacing
    console.log('═'.repeat(60));
    console.log('🔄 DEV-CYCLE COMPLETE');
    console.log('═'.repeat(60));

    // Step timing breakdown
    console.log('\nStep Timings:');
    console.log(`  Compile: ${this._formatDuration(this.timings.compile || 0)}`);
    console.log(`  Reset:   ${this._formatDuration(this.timings.reset || 0)}`);
    console.log(`  Test:    ${this._formatDuration(this.timings.test || 0)}`);
    console.log(`  Total:   ${this._formatDuration(totalTime)}`);

    // Test results summary
    console.log('\nTest Results:');
    if (testResults.total === 0) {
      console.log('  No tests executed');
    } else {
      console.log(`  Total:   ${testResults.total} tests`);
      console.log(`  Passed:  ${testResults.passed}`);
      console.log(`  Failed:  ${testResults.failed}`);
      if (testResults.skipped > 0) {
        console.log(`  Skipped: ${testResults.skipped}`);
      }
    }

    // Overall status
    if (testResults.failed === 0 && testResults.total > 0) {
      console.log('\n✅ Cycle successful - All tests passed!');
    } else if (testResults.failed > 0) {
      console.log('\n❌ Cycle completed with test failures');
    } else {
      console.log('\n⚠️  Cycle completed - No tests found');
    }

    console.log('═'.repeat(60));
  }

  /**
   * Format duration in human-readable format
   * @private
   */
  _formatDuration(milliseconds) {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Get exit code based on test results
   * @param {object} results - Test results
   * @returns {number} Exit code (0 for success, 1 for test failures)
   */
  getExitCode(results) {
    return results && results.failed > 0 ? 1 : 0;
  }

  /**
   * Get test configuration from config object or load from file
   * @private
   */
  async _getTestConfig() {
    try {
      const config = await Config.load();
      return config.getTestConfig();
    } catch (error) {
      this.logger.debug('Could not load config file, using defaults');
      const defaultConfig = new Config();
      return defaultConfig.getTestConfig();
    }
  }
}

export default DevCycleCommand;
