/**
 * @fileoverview Template processing engine for Deno Edge Functions
 * Provides variable substitution and template rendering using only Web APIs
 */

/**
 * Template variable substitution engine
 * Processes templates with {{variable}} placeholders and conditionals
 */
export class TemplateEngine {
  constructor() {
    this.variables = new Map();
    this.conditionals = new Map();
  }

  /**
   * Set template variables for substitution
   * @param {Record<string, any>} vars - Variables to set
   * @returns {TemplateEngine} - Fluent interface
   */
  setVariables(vars) {
    Object.entries(vars).forEach(([key, value]) => {
      this.variables.set(key, value);
    });
    return this;
  }

  /**
   * Set conditional blocks for template processing
   * @param {Record<string, boolean>} conditions - Conditional flags
   * @returns {TemplateEngine} - Fluent interface
   */
  setConditionals(conditions) {
    Object.entries(conditions).forEach(([key, value]) => {
      this.conditionals.set(key, Boolean(value));
    });
    return this;
  }

  /**
   * Process template string with variable substitution and conditionals
   * @param {string} template - Template content to process
   * @returns {string} - Processed template
   */
  process(template) {
    let result = template;

    // Process conditional blocks first
    result = this._processConditionals(result);

    // Then process variable substitutions
    result = this._processVariables(result);

    // Clean up any remaining template syntax
    result = this._cleanupTemplate(result);

    return result;
  }

  /**
   * Process conditional blocks in template
   * Format: {{#if condition}}content{{/if}}
   * @private
   */
  _processConditionals(template) {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(conditionalRegex, (match, condition, content) => {
      const shouldInclude = this.conditionals.get(condition) || false;
      return shouldInclude ? content : '';
    });
  }

  /**
   * Process variable substitutions in template
   * Format: {{variableName}}
   * @private
   */
  _processVariables(template) {
    const variableRegex = /\{\{(\w+)\}\}/g;
    
    return template.replace(variableRegex, (match, varName) => {
      const value = this.variables.get(varName);
      
      if (value === undefined || value === null) {
        return match; // Leave unresolved variables as-is
      }
      
      if (typeof value === 'string') {
        return value;
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      
      return String(value);
    });
  }

  /**
   * Clean up any remaining template artifacts
   * @private
   */
  _cleanupTemplate(template) {
    // Remove empty lines that might be left from conditionals
    return template.replace(/^\s*\n/gm, '');
  }

  /**
   * Load and process a template file
   * Note: In Deno runtime, this would use Deno.readTextFile
   * @param {string} templatePath - Path to template file
   * @returns {Promise<string>} - Processed template content
   */
  async loadAndProcess(templatePath) {
    try {
      // This is a placeholder - actual implementation would depend on runtime
      // In Deno: const content = await Deno.readTextFile(templatePath);
      // In Node: const content = await fs.readFile(templatePath, 'utf8');
      throw new Error('loadAndProcess must be implemented by runtime-specific subclass');
    } catch (error) {
      throw new Error(`Failed to load template from ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Validate template syntax before processing
   * @param {string} template - Template to validate
   * @returns {Array<string>} - Array of validation errors (empty if valid)
   */
  validate(template) {
    const errors = [];
    
    // Check for unmatched conditional blocks
    const ifCount = (template.match(/\{\{#if\s+\w+\}\}/g) || []).length;
    const endifCount = (template.match(/\{\{\/if\}\}/g) || []).length;
    
    if (ifCount !== endifCount) {
      errors.push(`Unmatched conditional blocks: ${ifCount} {{#if}} but ${endifCount} {{/if}}`);
    }
    
    // Check for nested conditionals (not supported)
    const nestedRegex = /\{\{#if\s+\w+\}\}[\s\S]*?\{\{#if\s+\w+\}\}[\s\S]*?\{\{\/if\}\}[\s\S]*?\{\{\/if\}\}/;
    if (nestedRegex.test(template)) {
      errors.push('Nested conditional blocks are not supported');
    }
    
    return errors;
  }
}