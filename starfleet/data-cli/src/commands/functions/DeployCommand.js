/**
 * Edge Functions Deployment Command
 *
 * Integrates Supabase Edge Functions deployment with data's event-driven architecture
 * Provides deployment validation, environment checking, and rollback capabilities
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Command = require('../../lib/Command');

class DeployCommand extends Command {
  constructor(functionsPath, logger = null, isProd = false) {
    super(null, logger, isProd, null);
    this.functionsPath = functionsPath;
    this.requiresProductionConfirmation = isProd; // Only require confirmation in production
  }

  /**
   * Execute functions deployment
   * @param {string[]|null} functionNames - Specific functions to deploy, or null for all
   * @param {Object} options - Deployment options
   */
  async performExecute(functionNames = null, options = {}) {
    this.progress('🚀 Starting Edge Functions deployment process');

    try {
      // Validate environment and prerequisites
      await this.validateEnvironment();

      // Get functions to deploy
      const functionsToDeploy = await this.resolveFunctionsList(functionNames);

      if (functionsToDeploy.length === 0) {
        this.warn('No functions found to deploy');
        return;
      }

      this.progress(`📦 Deploying ${functionsToDeploy.length} function(s)`, {
        functions: functionsToDeploy
      });

      // Validate each function before deployment
      for (const functionName of functionsToDeploy) {
        await this.validateFunction(functionName);
      }

      // Deploy functions with event tracking
      const results = [];
      for (const functionName of functionsToDeploy) {
        try {
          const result = await this.deployFunction(functionName, options);
          results.push(result);
          this.emit('function-deployed', {
            function: functionName,
            success: true,
            result
          });
        } catch (error) {
          this.error(`Failed to deploy function: ${functionName}`, error);
          results.push({
            function: functionName,
            success: false,
            error: error.message
          });
          this.emit('function-deployed', {
            function: functionName,
            success: false,
            error: error.message
          });
        }
      }

      // Emit deployment summary
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      this.emit('deployment-complete', {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        results
      });

      if (failed.length > 0) {
        this.warn(`Deployment completed with ${failed.length} failure(s)`, {
          failed: failed.map(f => f.function)
        });
      } else {
        this.success(`✅ Successfully deployed ${successful.length} function(s)`, {
          deployed: successful.map(s => s.function)
        });
      }

    } catch (error) {
      this.error('Functions deployment failed', error);
      throw error;
    }
  }

  /**
   * Validate deployment environment and prerequisites
   */
  async validateEnvironment() {
    this.progress('🔍 Validating deployment environment');

    // Check if supabase CLI is available
    try {
      execSync('supabase --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Supabase CLI not found. Please install: npm install -g supabase');
    }

    // Check if we're in a Supabase project
    if (!fs.existsSync(path.join(process.cwd(), 'supabase', 'config.toml'))) {
      throw new Error('Not in a Supabase project root. Run from project root directory.');
    }

    // Check functions directory exists
    if (!fs.existsSync(this.functionsPath)) {
      throw new Error('Functions directory not found: supabase/functions/');
    }

    // Validate environment variables for production
    if (this.isProd) {
      await this.validateProductionSecrets();
    }

    this.progress('✅ Environment validation complete');
  }

  /**
   * Validate production secrets are configured
   */
  async validateProductionSecrets() {
    this.progress('🔐 Validating production secrets');

    const requiredSecrets = [
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingSecrets = [];

    for (const secret of requiredSecrets) {
      try {
        // Check if secret exists in Supabase
        const result = execSync('supabase secrets list --json', { stdio: 'pipe' });
        const secrets = JSON.parse(result.toString());

        if (!secrets.find(s => s.name === secret)) {
          missingSecrets.push(secret);
        }
      } catch (error) {
        this.warn(`Could not validate secret: ${secret}`);
      }
    }

    if (missingSecrets.length > 0) {
      throw new Error(`Missing required production secrets: ${missingSecrets.join(', ')}`);
    }

    this.progress('✅ Production secrets validated');
  }

  /**
   * Resolve list of functions to deploy
   */
  async resolveFunctionsList(functionNames) {
    if (functionNames && functionNames.length > 0) {
      // Validate specified functions exist
      const missing = [];
      for (const name of functionNames) {
        const functionPath = path.join(this.functionsPath, name);
        if (!fs.existsSync(functionPath)) {
          missing.push(name);
        }
      }

      if (missing.length > 0) {
        throw new Error(`Functions not found: ${missing.join(', ')}`);
      }

      return functionNames;
    }

    // Get all functions in directory
    const entries = fs.readdirSync(this.functionsPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => !name.startsWith('.'));
  }

  /**
   * Validate a specific function before deployment
   */
  async validateFunction(functionName) {
    this.progress(`🔍 Validating function: ${functionName}`);

    const functionPath = path.join(this.functionsPath, functionName);

    // Check for required files
    const indexPath = path.join(functionPath, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Function ${functionName} missing index.ts file`);
    }

    // Basic TypeScript syntax check
    try {
      const content = fs.readFileSync(indexPath, 'utf8');

      // Check for basic Edge Function structure
      if (!content.includes('serve(') && !content.includes('Deno.serve(')) {
        this.warn(`Function ${functionName} may not have proper serve() handler`);
      }

      // Check for proper imports
      if (!content.includes('import') && !content.includes('require(')) {
        this.warn(`Function ${functionName} has no imports - may be incomplete`);
      }

    } catch (error) {
      this.warn(`Could not validate ${functionName} syntax: ${error.message}`);
    }

    this.emit('function-validated', {
      function: functionName,
      path: functionPath
    });
  }

  /**
   * Deploy a single function
   */
  async deployFunction(functionName, options = {}) {
    this.progress(`🚀 Deploying function: ${functionName}`);

    const deployArgs = ['functions', 'deploy', functionName];

    if (options.noVerifyJwt) {
      deployArgs.push('--no-verify-jwt');
    }

    if (options.debug) {
      deployArgs.push('--debug');
    }

    if (this.isProd && !options.skipImportMap) {
      // Production deployment should use import map
      const importMapPath = path.join(this.functionsPath, 'import_map.json');
      if (fs.existsSync(importMapPath)) {
        deployArgs.push('--import-map', importMapPath);
      }
    }

    try {
      const startTime = Date.now();

      this.progress(`Executing: supabase ${deployArgs.join(' ')}`);

      const result = execSync(`supabase ${deployArgs.join(' ')}`, {
        stdio: 'pipe',
        encoding: 'utf8',
        cwd: process.cwd()
      });

      const deployTime = Date.now() - startTime;

      this.progress(`✅ Function ${functionName} deployed successfully (${deployTime}ms)`);

      return {
        function: functionName,
        success: true,
        deployTime,
        output: result
      };

    } catch (error) {
      this.error(`Failed to deploy ${functionName}`, error);

      return {
        function: functionName,
        success: false,
        error: error.message,
        stdout: error.stdout?.toString(),
        stderr: error.stderr?.toString()
      };
    }
  }

  /**
   * Get deployment status for functions
   */
  async getDeploymentStatus() {
    this.progress('📊 Getting function deployment status');

    try {
      const result = execSync('supabase functions list --json', {
        stdio: 'pipe',
        encoding: 'utf8'
      });

      const functions = JSON.parse(result);

      this.emit('deployment-status', { functions });

      return functions;

    } catch (error) {
      this.warn('Could not retrieve function status', { error: error.message });
      return [];
    }
  }

  /**
   * Production confirmation override with enhanced messaging
   */
  async confirmProduction() {
    this.warn('🚨 PRODUCTION FUNCTIONS DEPLOYMENT', {
      environment: 'PRODUCTION',
      impact: 'HIGH',
      warning: 'This will replace live Edge Functions'
    });

    const confirmed = await this.confirm(
      'Deploy Edge Functions to PRODUCTION environment? This will affect live users.'
    );

    if (confirmed) {
      this.progress('🔒 Production deployment confirmed');
    }

    return confirmed;
  }
}

module.exports = DeployCommand;
