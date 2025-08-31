/**
 * Generate Template Command
 * 
 * Generate pgTAP test templates using TestTemplateGenerator and TestRequirementAnalyzer.
 * Supports generating from migration files, specific test types, and custom requirements.
 */

const fs = require('fs').promises;
const path = require('path');
const TestCommand = require('../../lib/TestCommand');
const TestTemplateGenerator = require('../../lib/testing/TestTemplateGenerator');
const { TestRequirementAnalyzer } = require('../../lib/testing/TestRequirementAnalyzer');

/**
 * Generate pgTAP test templates with advanced analysis capabilities
 */
class GenerateTemplateCommand extends TestCommand {
  constructor(
    testsDir,
    outputDir,
    logger = null,
    isProd = false
  ) {
    super(null, null, testsDir, outputDir, logger, isProd);
    
    // Template generation doesn't require database access or production confirmation
    this.requiresProductionConfirmation = false;
    
    // Initialize generators
    this.templateGenerator = new TestTemplateGenerator();
    this.requirementAnalyzer = new TestRequirementAnalyzer();
  }

  /**
   * Execute test template generation
   * @param {Object} options - Generation options
   * @param {string} [options.migration] - Path to migration file for analysis
   * @param {string} [options.type] - Specific test type to generate
   * @param {string} [options.name] - Name of entity to generate tests for
   * @param {string} [options.output] - Output file path (default: stdout)
   * @param {string} [options.schema] - Schema name (default: public)
   * @param {Array<string>} [options.parameters] - Function parameters for RPC tests
   * @param {string} [options.returnType] - Expected return type for functions
   * @param {string} [options.description] - Description for the test
   * @returns {Promise<Object>} Generation result
   */
  async performExecute(options = {}) {
    this.emit('template:generation:start', { 
      migration: options.migration,
      type: options.type, 
      name: options.name 
    });
    
    try {
      // Validate options
      this.validateGenerationOptions(options);
      
      // Generate requirements based on input
      let requirements;
      if (options.migration) {
        requirements = await this.analyzeRequirementsFromMigration(options.migration);
        
        // Filter by type if specified
        if (options.type) {
          requirements = this.filterRequirementsByType(requirements, options.type);
        }
      } else {
        // Generate single requirement from options
        requirements = [this.createRequirementFromOptions(options)];
      }
      
      if (requirements.length === 0) {
        throw new Error('No test requirements found. Check migration file or provide --type and --name options.');
      }
      
      // Generate templates
      const result = this.templateGenerator.generateBatch(requirements);
      
      if (result.errors.length > 0) {
        this.warn(`Generated ${result.totalGenerated} templates with ${result.errors.length} errors`);
        result.errors.forEach(error => {
          this.error(`Error generating template for ${error.requirement?.name}: ${error.error}`);
        });
      }
      
      // Output templates
      await this.outputTemplates(result.templates, options.output);
      
      const summaryText = this.formatGenerationSummary(result);
      this.success(`Test template generation completed\n${summaryText}`);
      
      this.emit('template:generation:complete', {
        totalGenerated: result.totalGenerated,
        summary: result.summary,
        errors: result.errors
      });
      
      return {
        templates: result.templates,
        summary: result.summary,
        totalGenerated: result.totalGenerated,
        errors: result.errors
      };
      
    } catch (error) {
      this.error('Test template generation failed', error);
      this.emit('template:generation:failed', { 
        error, 
        migration: options.migration,
        type: options.type, 
        name: options.name 
      });
      throw error;
    }
  }

  /**
   * Validate generation options
   * @param {Object} options - Options to validate
   */
  validateGenerationOptions(options) {
    // Either migration file OR type+name must be provided
    if (!options.migration && (!options.type || !options.name)) {
      throw new Error('Either --migration <file> or both --type and --name must be provided');
    }
    
    // If migration file specified, check if it exists
    if (options.migration && !fs.access(options.migration).catch(() => false)) {
      // We'll validate file existence in analyzeRequirementsFromMigration
    }
    
    // Validate test type if specified
    if (options.type) {
      const validTypes = ['rpc', 'rls', 'trigger', 'constraint', 'function'];
      if (!validTypes.includes(options.type)) {
        throw new Error(`Invalid test type: ${options.type}. Must be one of: ${validTypes.join(', ')}`);
      }
    }
    
    // Validate name format if specified
    if (options.name && !/^[a-zA-Z0-9_]+$/.test(options.name)) {
      throw new Error('Name must contain only letters, numbers, and underscores');
    }
    
    // Validate output path if specified
    if (options.output && !path.isAbsolute(options.output)) {
      // Convert to absolute path relative to current working directory
      options.output = path.resolve(process.cwd(), options.output);
    }
  }

  /**
   * Analyze requirements from a migration file
   * @param {string} migrationPath - Path to migration file
   * @returns {Promise<Array<Object>>} Test requirements
   */
  async analyzeRequirementsFromMigration(migrationPath) {
    try {
      // Check if file exists
      await fs.access(migrationPath);
      
      this.progress(`Analyzing migration file: ${migrationPath}`);
      
      // Read migration file
      const migrationContent = await fs.readFile(migrationPath, 'utf8');
      
      // Parse migration content to AST operations
      const operations = await this.parseMigrationToOperations(migrationContent);
      
      // Analyze operations to determine test requirements
      const analysis = await this.requirementAnalyzer.analyzeOperations(operations);
      
      // Convert analysis results to template requirements
      return this.convertAnalysisToRequirements(analysis.requirements);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }
      throw new Error(`Failed to analyze migration: ${error.message}`);
    }
  }

  /**
   * Parse migration content to operation objects
   * @param {string} migrationContent - Raw migration SQL
   * @returns {Promise<Array<Object>>} Parsed operations
   */
  async parseMigrationToOperations(migrationContent) {
    // Simple SQL parsing for common operations
    // In a more complete implementation, you might use a proper SQL AST parser
    
    const operations = [];
    const lines = migrationContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim().toUpperCase();
      
      // Create table operations
      if (trimmed.startsWith('CREATE TABLE')) {
        const match = line.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+\.)?(\w+)/i);
        if (match) {
          operations.push({
            type: 'CREATE_TABLE',
            table: match[2],
            schema: match[1] ? match[1].replace('.', '') : 'public'
          });
        }
      }
      
      // Create function operations
      else if (trimmed.startsWith('CREATE OR REPLACE FUNCTION') || trimmed.startsWith('CREATE FUNCTION')) {
        const match = line.match(/CREATE (?:OR REPLACE )?FUNCTION\s+(?:(\w+)\.)?(\w+)\s*\(/i);
        if (match) {
          operations.push({
            type: 'CREATE_FUNCTION',
            function: match[2],
            schema: match[1] || 'public'
          });
        }
      }
      
      // RLS enable operations
      else if (trimmed.includes('ROW LEVEL SECURITY') || trimmed.includes('ENABLE RLS')) {
        const match = line.match(/ALTER TABLE\s+(?:(\w+)\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
        if (match) {
          operations.push({
            type: 'ENABLE_RLS',
            table: match[2],
            schema: match[1] || 'public'
          });
        }
      }
      
      // Trigger operations
      else if (trimmed.startsWith('CREATE TRIGGER')) {
        const match = line.match(/CREATE TRIGGER\s+(\w+)\s+.*ON\s+(?:(\w+)\.)?(\w+)/i);
        if (match) {
          operations.push({
            type: 'CREATE_TRIGGER',
            trigger: match[1],
            table: match[3],
            schema: match[2] || 'public'
          });
        }
      }
      
      // Constraint operations
      else if (trimmed.includes('ADD CONSTRAINT')) {
        const match = line.match(/ADD CONSTRAINT\s+(\w+)/i);
        if (match) {
          operations.push({
            type: 'ADD_CONSTRAINT',
            constraint: match[1]
          });
        }
      }
    }
    
    return operations;
  }

  /**
   * Convert analysis requirements to template requirements
   * @param {Array<Object>} analysisRequirements - Requirements from analyzer
   * @returns {Array<Object>} Template requirements
   */
  convertAnalysisToRequirements(analysisRequirements) {
    return analysisRequirements.map(req => {
      // Map analyzer requirement types to template types
      const typeMapping = {
        'FUNCTION': 'rpc',
        'RLS': 'rls', 
        'TRIGGER': 'trigger',
        'CONSTRAINT': 'constraint',
        'SCHEMA': 'function'
      };
      
      return {
        type: typeMapping[req.type] || 'function',
        name: req.target,
        schema: req.metadata?.schema || 'public',
        description: req.description,
        metadata: req.metadata
      };
    });
  }

  /**
   * Create a single requirement from command options
   * @param {Object} options - Command options
   * @returns {Object} Test requirement
   */
  createRequirementFromOptions(options) {
    return {
      type: options.type,
      name: options.name,
      schema: options.schema || 'public',
      description: options.description,
      parameters: options.parameters ? options.parameters.split(',') : undefined,
      returnType: options.returnType,
      metadata: {
        generatedFromCli: true
      }
    };
  }

  /**
   * Filter requirements by test type
   * @param {Array<Object>} requirements - All requirements
   * @param {string} type - Type to filter by
   * @returns {Array<Object>} Filtered requirements
   */
  filterRequirementsByType(requirements, type) {
    return requirements.filter(req => req.type === type);
  }

  /**
   * Output generated templates
   * @param {Array<Object>} templates - Generated templates
   * @param {string} outputPath - Output file path (optional)
   */
  async outputTemplates(templates, outputPath) {
    if (outputPath) {
      // Output to file
      const combinedContent = templates.map(template => {
        return `-- =========================================================================\n` +
               `-- Generated Template: ${template.metadata.name} (${template.type})\n` +
               `-- File: ${template.filename}\n` +
               `-- Directory: ${template.directory}\n` +
               `-- Generated: ${template.metadata.generatedAt}\n` +
               `-- =========================================================================\n\n` +
               template.content;
      }).join('\n\n');
      
      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Write to file
      await fs.writeFile(outputPath, combinedContent, 'utf8');
      
      this.progress(`Templates written to: ${outputPath}`);
    } else {
      // Output to stdout
      templates.forEach(template => {
        console.log(`-- Generated Template: ${template.metadata.name} (${template.type})`);
        console.log(`-- Suggested path: ${path.join(template.directory, template.filename)}\n`);
        console.log(template.content);
        console.log('\n' + '='.repeat(80) + '\n');
      });
    }
    
    // Also suggest individual file creation
    if (templates.length > 1 && !outputPath) {
      this.info('\nTo save individual template files, you can use:');
      templates.forEach(template => {
        const fullPath = path.join('tests', template.directory, template.filename);
        console.log(`  data test generate-template --type ${template.type} --name ${template.metadata.name} --output ${fullPath}`);
      });
    }
  }

  /**
   * Format generation summary for display
   * @param {Object} result - Generation result
   * @returns {string} Formatted summary
   */
  formatGenerationSummary(result) {
    const lines = [
      `Total templates generated: ${result.totalGenerated}`
    ];
    
    if (Object.keys(result.summary).length > 0) {
      lines.push('Templates by type:');
      Object.entries(result.summary).forEach(([type, count]) => {
        lines.push(`  ${type}: ${count}`);
      });
    }
    
    if (result.errors.length > 0) {
      lines.push(`Errors encountered: ${result.errors.length}`);
    }
    
    return lines.join('\n');
  }
}

module.exports = GenerateTemplateCommand;