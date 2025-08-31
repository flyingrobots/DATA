/**
 * Test Watch Command - P1.T006
 * 
 * Watches test/ directory for changes and automatically:
 * 1. Compiles tests using TestCompileCommand
 * 2. Runs tests using TestRunCommand 
 * 3. Debounces rapid changes
 * 4. Clears console between runs
 */

const chokidar = require('chokidar');
const path = require('path');
const chalk = require('chalk').default || require('chalk');
const TestCommand = require('../../lib/TestCommand');
const CompileCommand = require('./CompileCommand');
const RunCommand = require('./RunCommand');
const Config = require('../../lib/config');

/**
 * Watch for test file changes and auto-run tests
 */
class WatchCommand extends TestCommand {
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
    
    // Watch configuration
    this.debounceMs = 1000; // Default debounce delay
    this.isRunning = false;
    this.pendingTimeout = null;
    this.watcher = null;
    this.initialScanComplete = false;
    
    // Commands for auto-compilation and running
    this.compileCommand = null;
    this.runCommand = null;
  }

  /**
   * Execute test watch mode
   */
  async performExecute(options = {}) {
    this.emit('watch:start', { 
      isProd: this.isProd, 
      testsDir: this.testsDir,
      outputDir: this.outputDir,
      options 
    });
    
    try {
      // Load test configuration
      const testConfig = await this._getTestConfig();
      
      // Configure debounce delay from options or config
      this.debounceMs = options.debounce || testConfig.debounce_delay || 1000;
      this.autoCompile = options.autoCompile !== undefined ? options.autoCompile : testConfig.auto_compile;
      
      this.progress('Starting test watch mode...');
      
      // Initialize compilation and run commands
      await this._initializeCommands(options);
      
      // Ensure test directory exists
      const watchDir = await this.getTestsDir();
      this.success(`Watching for changes in: ${watchDir}`);
      
      // Setup file watcher
      await this._setupWatcher(watchDir, options);
      
      // Run initial test cycle
      await this._runTestCycle('Initial run');
      
      this.progress(chalk.cyan('\n🔍 Watching for test file changes...'));
      this.progress(chalk.gray('Press Ctrl+C to stop watching\n'));
      
      // Keep the process alive and listen for signals
      await this._waitForInterrupt();
      
      this.emit('watch:complete', { message: 'Test watch stopped' });
      return { success: true, message: 'Test watch stopped' };
      
    } catch (error) {
      this.error('Failed to start test watcher', error);
      this.emit('watch:failed', { error });
      throw error;
    } finally {
      await this._cleanup();
    }
  }

  /**
   * Initialize compilation and run commands
   * @private
   */
  async _initializeCommands(options) {
    this.progress('Initializing test commands...');
    
    // Create compile command instance
    this.compileCommand = new CompileCommand(
      this.testsDir,
      this.outputDir, 
      this.logger,
      this.isProd
    );
    
    // Create run command instance
    this.runCommand = new RunCommand(
      this.databaseUrl,
      this.serviceRoleKey,
      this.testsDir,
      this.outputDir,
      this.logger,
      this.isProd
    );
    
    // Forward events from child commands
    this._forwardCommandEvents();
  }

  /**
   * Setup file watcher with chokidar
   * @private
   */
  async _setupWatcher(watchDir, options) {
    const watchPattern = path.join(watchDir, '**/*.sql');
    
    this.watcher = chokidar.watch(watchPattern, {
      ignored: /[\/\\]\./,  // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false,
      depth: 3  // reasonable depth limit
    });
    
    // Handle file events
    this.watcher
      .on('ready', () => {
        this.initialScanComplete = true;
        this.logger.debug('File watcher ready');
      })
      .on('add', (filePath) => {
        if (this.initialScanComplete) {
          this._handleFileChange('added', filePath);
        }
      })
      .on('change', (filePath) => {
        this._handleFileChange('changed', filePath);
      })
      .on('unlink', (filePath) => {
        this._handleFileChange('removed', filePath);
      })
      .on('error', (error) => {
        this.error('File watcher error', error);
      });
  }

  /**
   * Handle file change events with debouncing
   * @private
   */
  _handleFileChange(eventType, filePath) {
    const relativePath = path.relative(this.testsDir, filePath);
    
    this.emit('watch:file_change', {
      eventType,
      file: relativePath,
      fullPath: filePath,
      timestamp: new Date().toISOString()
    });
    
    this.progress(chalk.blue(`📄 ${eventType}: ${relativePath}`));
    
    // Clear existing timeout
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
    }
    
    // Debounce the test run
    this.pendingTimeout = setTimeout(async () => {
      await this._runTestCycle(`File ${eventType}: ${relativePath}`);
      this.pendingTimeout = null;
    }, this.debounceMs);
  }

  /**
   * Run the complete test cycle (compile + run)
   * @private
   */
  async _runTestCycle(trigger) {
    if (this.isRunning) {
      this.logger.debug('Test cycle already running, skipping');
      return;
    }
    
    this.isRunning = true;
    
    try {
      // Clear console for clean output
      this._clearConsole();
      
      this.emit('watch:cycle_start', {
        trigger,
        timestamp: new Date().toISOString()
      });
      
      const cycleStartTime = Date.now();
      this.progress(chalk.yellow(`🔄 ${trigger} - Running test cycle...`));
      
      // Step 1: Compile tests (if auto_compile is enabled)
      let compileResult = null;
      if (this.autoCompile) {
        this.progress('📦 Compiling tests...');
        compileResult = await this.compileCommand.performExecute();
        
        if (!compileResult.success) {
          throw new Error('Test compilation failed');
        }
        
        this.success(`✓ Compilation complete: ${compileResult.stats.filesProcessed} files`);
      } else {
        this.progress('⏭️  Skipping compilation (auto_compile disabled)');
        compileResult = { success: true, stats: { filesProcessed: 0 } };
      }
      
      // Step 2: Run tests  
      this.progress('🧪 Running tests...');
      const runResult = await this.runCommand.performExecute();
      
      const cycleEndTime = Date.now();
      const cycleDuration = cycleEndTime - cycleStartTime;
      
      // Display summary
      this._displayCycleSummary(runResult, cycleDuration);
      
      this.emit('watch:cycle_complete', {
        trigger,
        compileResult,
        runResult,
        duration: cycleDuration,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      this.error('Test cycle failed', error);
      
      this.emit('watch:cycle_failed', {
        trigger,
        error,
        timestamp: new Date().toISOString()
      });
    } finally {
      this.isRunning = false;
      
      // Separator for next cycle
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.cyan('🔍 Watching for changes...'));
    }
  }

  /**
   * Clear console output for clean test runs
   * @private
   */
  _clearConsole() {
    // Clear console but preserve some context
    process.stdout.write('\x1Bc'); // Clear screen
    
    // Re-display header
    console.log(chalk.bold.cyan('⛰️  data Test Watcher'));
    console.log(chalk.gray(`Watching: ${this.testsDir}`));
    console.log(chalk.gray(`Output: ${this.outputDir}`));
    console.log('');
  }

  /**
   * Display cycle summary with colored output
   * @private
   */
  _displayCycleSummary(runResult, duration) {
    const { total, passed, failed, skipped } = runResult;
    
    console.log('');
    console.log(chalk.bold('📊 Test Results Summary:'));
    
    if (failed > 0) {
      console.log(chalk.red(`  ✗ ${failed}/${total} tests failed`));
    } else if (skipped > 0) {
      console.log(chalk.yellow(`  ⚠ ${passed}/${total} tests passed (${skipped} skipped)`));
    } else if (total > 0) {
      console.log(chalk.green(`  ✓ All ${passed}/${total} tests passed`));
    } else {
      console.log(chalk.gray('  No tests executed'));
    }
    
    console.log(chalk.gray(`  ⏱ Completed in ${duration}ms`));
    console.log('');
  }

  /**
   * Forward events from child commands
   * @private
   */
  _forwardCommandEvents() {
    if (this.compileCommand) {
      this.compileCommand.on('compilation:start', (data) => {
        this.emit('watch:compilation_start', data);
      });
      
      this.compileCommand.on('compilation:complete', (data) => {
        this.emit('watch:compilation_complete', data);
      });
      
      this.compileCommand.on('compilation:failed', (data) => {
        this.emit('watch:compilation_failed', data);
      });
    }
    
    if (this.runCommand) {
      this.runCommand.on('start', (data) => {
        this.emit('watch:run_start', data);
      });
      
      this.runCommand.on('complete', (data) => {
        this.emit('watch:run_complete', data);
      });
      
      this.runCommand.on('failed', (data) => {
        this.emit('watch:run_failed', data);
      });
    }
  }

  /**
   * Wait for process interrupt (Ctrl+C)
   * @private
   */
  async _waitForInterrupt() {
    return new Promise((resolve) => {
      const handleSignal = () => {
        console.log(chalk.yellow('\n⏹  Stopping test watcher...'));
        resolve();
      };
      
      process.on('SIGINT', handleSignal);
      process.on('SIGTERM', handleSignal);
    });
  }

  /**
   * Cleanup resources on exit
   * @private
   */
  async _cleanup() {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    
    this.logger.debug('Test watcher cleanup complete');
  }

  /**
   * Set debounce delay
   * @param {number} ms - Milliseconds to debounce
   */
  setDebounceDelay(ms) {
    if (typeof ms !== 'number' || ms < 0) {
      throw new Error('Debounce delay must be a non-negative number');
    }
    this.debounceMs = ms;
  }

  /**
   * Get current watch status
   * @returns {object} Watch status information
   */
  getWatchStatus() {
    return {
      isWatching: !!this.watcher,
      isRunning: this.isRunning,
      debounceMs: this.debounceMs,
      testsDir: this.testsDir,
      outputDir: this.outputDir,
      hasPendingChanges: !!this.pendingTimeout
    };
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

module.exports = WatchCommand;