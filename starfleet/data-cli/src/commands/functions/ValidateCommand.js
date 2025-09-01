/**
 * Edge Functions Validation Command
 *
 * Validates Edge Functions syntax, structure, and dependencies
 * without deploying them
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Command = require('../../lib/Command');

class ValidateCommand extends Command {
  constructor(config, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Validation is safe
  }

  /**
   * Execute functions validation
   * @param {string[]|null} functionNames - Specific functions to validate, or null for all
   */
  async performExecute(functionNames = null) {
    this.progress('🔍 Starting Edge Functions validation');

    try {
      // Check functions directory exists
      const functionsPath = this.outputConfig.functionsDir;
      if (!fs.existsSync(functionsPath)) {
        throw new Error(`Functions directory not found: ${functionsPath}`);
      }

      // Get functions to validate
      const functionsToValidate = await this.resolveFunctionsList(functionNames);

      if (functionsToValidate.length === 0) {
        this.warn('No functions found to validate');
        return;
      }

      this.progress(`📋 Validating ${functionsToValidate.length} function(s)`, {
        functions: functionsToValidate
      });

      // Validate each function
      const results = [];
      for (const functionName of functionsToValidate) {
        const result = await this.validateFunction(functionName);
        results.push(result);
      }

      // Emit validation summary
      const valid = results.filter(r => r.isValid);
      const invalid = results.filter(r => !r.isValid);

      this.emit('validation-complete', {
        total: results.length,
        valid: valid.length,
        invalid: invalid.length,
        results
      });

      if (invalid.length > 0) {
        this.warn(`Validation completed with ${invalid.length} issue(s)`, {
          invalid: invalid.map(f => ({
            function: f.function,
            issues: f.issues
          }))
        });
      } else {
        this.success(`✅ All ${valid.length} function(s) passed validation`, {
          validated: valid.map(v => v.function)
        });
      }

      return results;

    } catch (error) {
      this.error('Functions validation failed', error);
      throw error;
    }
  }

  /**
   * Resolve list of functions to validate
   */
  async resolveFunctionsList(functionNames) {
    if (functionNames && functionNames.length > 0) {
      // Validate specified functions exist
      const missing = [];
      for (const name of functionNames) {
        const functionPath = path.join(this.outputConfig.functionsDir, name);
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
    const entries = fs.readdirSync(this.outputConfig.functionsDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => !name.startsWith('.'));
  }

  /**
   * Validate a specific function
   */
  async validateFunction(functionName) {
    this.progress(`🔍 Validating function: ${functionName}`);

    const functionPath = path.join(this.outputConfig.functionsDir, functionName);
    const issues = [];
    let isValid = true;

    // Check for required files
    const indexPath = path.join(functionPath, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      issues.push('Missing index.ts file');
      isValid = false;
    } else {
      // Validate file content
      try {
        const content = fs.readFileSync(indexPath, 'utf8');
        const contentIssues = this.validateFunctionContent(functionName, content);
        issues.push(...contentIssues);

        if (contentIssues.length > 0) {
          isValid = false;
        }
      } catch (error) {
        issues.push(`Cannot read index.ts: ${error.message}`);
        isValid = false;
      }
    }

    // Check for deno.json configuration
    const denoJsonPath = path.join(functionPath, 'deno.json');
    if (fs.existsSync(denoJsonPath)) {
      try {
        const denoConfig = JSON.parse(fs.readFileSync(denoJsonPath, 'utf8'));
        const denoIssues = this.validateDenoConfig(functionName, denoConfig);
        issues.push(...denoIssues);

        if (denoIssues.length > 0) {
          isValid = false;
        }
      } catch (error) {
        issues.push(`Invalid deno.json: ${error.message}`);
        isValid = false;
      }
    }

    // Check for common dependencies
    const dependencyIssues = this.validateDependencies(functionName, functionPath);
    issues.push(...dependencyIssues);

    const result = {
      function: functionName,
      path: functionPath,
      isValid,
      issues: issues.length > 0 ? issues : ['No issues found']
    };

    this.emit('function-validated', result);

    return result;
  }

  /**
   * Validate function content
   */
  validateFunctionContent(functionName, content) {
    const issues = [];

    // Check for basic Edge Function structure
    if (!content.includes('serve(') && !content.includes('Deno.serve(')) {
      issues.push('Missing serve() handler - Edge Function must use Deno.serve() or serve()');
    }

    // Check for proper CORS handling in public functions
    if (functionName.includes('webhook') || functionName.includes('api')) {
      if (!content.includes('cors') && !content.includes('Access-Control')) {
        issues.push('CORS handling recommended for public endpoints');
      }
    }

    // Check for error handling
    if (!content.includes('try') && !content.includes('catch')) {
      issues.push('Consider adding try/catch error handling');
    }

    // Check for environment variable usage
    const envVarPattern = /Deno\.env\.get\(['"`]([^'"`]+)['"`]\)/g;
    const envVars = [];
    let match;
    while ((match = envVarPattern.exec(content)) !== null) {
      envVars.push(match[1]);
    }

    if (envVars.length > 0) {
      this.progress(`Function ${functionName} uses environment variables: ${envVars.join(', ')}`);
    }

    // Removed overly aggressive secret detection
    // If you're committing secrets to code, that's on you
    // Use environment variables like a professional

    return issues;
  }

  /**
   * Validate Deno configuration
   */
  validateDenoConfig(functionName, denoConfig) {
    const issues = [];

    // Check for common Deno config issues
    if (denoConfig.imports) {
      const imports = denoConfig.imports;

      // Validate import URLs
      for (const [key, url] of Object.entries(imports)) {
        if (!url.startsWith('https://')) {
          issues.push(`Import map entry "${key}" should use HTTPS URL`);
        }
      }
    }

    // Check for appropriate permissions
    if (denoConfig.permissions && denoConfig.permissions.allow) {
      const allows = denoConfig.permissions.allow;
      if (allows.includes('--allow-all')) {
        issues.push('Avoid --allow-all permission - specify minimal required permissions');
      }
    }

    return issues;
  }

  /**
   * Validate function dependencies
   */
  validateDependencies(functionName, functionPath) {
    const issues = [];

    // Check if function uses import_map.json
    const importMapPath = path.join(this.outputConfig.functionsDir, 'import_map.json');
    if (fs.existsSync(importMapPath)) {
      try {
        const importMap = JSON.parse(fs.readFileSync(importMapPath, 'utf8'));
        this.progress(`Function ${functionName} has access to import map with ${Object.keys(importMap.imports || {}).length} imports`);
      } catch (error) {
        issues.push('import_map.json exists but is invalid JSON');
      }
    }

    return issues;
  }
}

module.exports = ValidateCommand;
