/**
 * Database Migration Compile Command
 */

const path = require('path');
const BuildCommand = require('../../lib/BuildCommand');

/**
 * Compile SQL sources into migration file
 * Enhanced with optional functions deployment integration
 */
class CompileCommand extends BuildCommand {
  constructor(
    inputDir,
    outputDir,
    logger = null,
    isProd = false
  ) {
    super(inputDir, outputDir, logger, isProd);
    
    // Paths will be validated when performExecute is called
    // Don't throw in constructor as it prevents proper error handling
  }

  /**
   * Execute migration compilation with optional functions deployment
   * @param {Object} options - Compilation options
   * @param {boolean} options.deployFunctions - Whether to deploy functions after compilation
   * @param {string[]} options.functionsToDeploy - Specific functions to deploy
   * @param {boolean} options.skipFunctionValidation - Skip function validation
   */
  async performExecute(options = {}) {
    this.emit('start', { isProd: this.isProd });
    
    try {
      // Validate paths are provided
      if (!this.inputDir || !this.outputDir) {
        throw new Error('CompileCommand requires input and output directories. Use --sql-dir and --migrations-dir options.');
      }
      
      // TODO: Implement native migration compilation
      // The legacy build system has been removed. This command needs to be reimplemented
      // using the native MigrationCompiler from src/lib/MigrationCompiler.js
      throw new Error('Migration compilation not yet implemented. Legacy build system has been removed.');

      // Deploy functions if requested
      if (options.deployFunctions) {
        await this.deployFunctions(options);
      }
      
      return result;
    } catch (error) {
      this.error('Migration compilation failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }

  /**
   * Deploy functions as part of migration workflow
   */
  async deployFunctions(options) {
    this.progress('🚀 Starting Edge Functions deployment as part of migration');

    try {
      // Import the DeployCommand
      const { DeployCommand } = require('../functions');
      
      // Create a functions deployment command
      // Note: This will need to be refactored when functions are separated
      const deployCommand = new DeployCommand(
        path.join(this.inputDir, '../functions'),
        this.logger,
        this.isProd
      );
      
      // Forward events from the deploy command
      deployCommand.on('progress', (event) => {
        this.progress(`[Functions] ${event.message}`, event.data);
      });
      
      deployCommand.on('function-deployed', (event) => {
        this.emit('function-deployed', event);
      });
      
      deployCommand.on('deployment-complete', (event) => {
        this.emit('functions-deployment-complete', event);
      });

      // Execute functions deployment
      const deployOptions = {
        skipImportMap: options.skipImportMap || false,
        debug: options.debug || false
      };

      await deployCommand.execute(options.functionsToDeploy, deployOptions);
      
      this.success('✅ Functions deployment completed as part of migration');

    } catch (error) {
      this.error('Functions deployment failed during migration', error);
      
      // Don't fail the entire migration for function deployment issues
      this.warn('Migration compilation succeeded but function deployment failed');
      this.emit('functions-deployment-failed', { error });
    }
  }

  /**
   * Attach event listeners to the compiler
   * TODO: Re-implement when native compiler is added
   */
  attachCompilerEvents(compiler) {
    // Placeholder for future implementation
  }
}

module.exports = CompileCommand;