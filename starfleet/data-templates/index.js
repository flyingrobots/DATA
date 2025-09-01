/**
 * @fileoverview Main entry point for DATA Edge Function templates
 * Provides template generation for Supabase Edge Functions with Deno runtime
 */

import { TemplateEngine } from './lib/TemplateEngine.js';
import { EdgeFunctionGenerator } from './lib/EdgeFunctionGenerator.js';

/**
 * Create a new template engine instance
 * @returns {TemplateEngine} - Template engine instance
 */
export function createTemplateEngine() {
  return new TemplateEngine();
}

/**
 * Create a new Edge Function generator instance
 * @returns {EdgeFunctionGenerator} - Generator instance
 */
export function createEdgeFunctionGenerator() {
  return new EdgeFunctionGenerator();
}

/**
 * Quick generation function for common use cases
 * @param {string} name - Function name
 * @param {string} type - Template type (edge-function, database-function, webhook-handler)
 * @param {Object} [options] - Additional options
 * @returns {Promise<Object>} - Generation result
 */
export function generateEdgeFunction(name, type, options = {}) {
  const generator = new EdgeFunctionGenerator();
  return generator.generate({ name, type, ...options });
}

/**
 * Get available template types
 * @returns {Array<string>} - Available template types
 */
export function getAvailableTemplateTypes() {
  return ['edge-function', 'database-function', 'webhook-handler'];
}

/**
 * Get template configuration schema
 * @returns {Object} - Configuration schema with defaults
 */
export function getTemplateConfigSchema() {
  return {
    runtime: { type: 'string', default: 'deno', options: ['deno'] },
    typescript: { type: 'boolean', default: true },
    cors: { type: 'boolean', default: true },
    corsOrigins: { type: 'array', default: ['*'] },
    jwtVerification: { type: 'boolean', default: false },
    rateLimit: { type: 'boolean', default: false },
    supabaseIntegration: { type: 'boolean', default: true },
    errorHandling: { type: 'boolean', default: true },
    logging: { type: 'boolean', default: true },
    validation: { type: 'boolean', default: true },
    timeout: { type: 'number', default: 30 },
    description: { type: 'string', default: '' },
    author: { type: 'string', default: 'DATA CLI' }
  };
}

/**
 * Validate template configuration
 * @param {Object} config - Configuration to validate
 * @returns {Array<string>} - Validation errors (empty if valid)
 */
export function validateTemplateConfig(config) {
  const errors = [];
  const schema = getTemplateConfigSchema();

  Object.entries(config).forEach(([key, value]) => {
    const fieldSchema = schema[key];
    if (!fieldSchema) {
      errors.push(`Unknown configuration option: ${key}`);
      return;
    }

    if (fieldSchema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${key} must be a boolean, got ${typeof value}`);
    }

    if (fieldSchema.type === 'string' && typeof value !== 'string') {
      errors.push(`${key} must be a string, got ${typeof value}`);
    }

    if (fieldSchema.type === 'number' && typeof value !== 'number') {
      errors.push(`${key} must be a number, got ${typeof value}`);
    }

    if (fieldSchema.type === 'array' && !Array.isArray(value)) {
      errors.push(`${key} must be an array, got ${typeof value}`);
    }

    if (fieldSchema.options && !fieldSchema.options.includes(value)) {
      errors.push(`${key} must be one of: ${fieldSchema.options.join(', ')}`);
    }
  });

  return errors;
}

// Re-export classes for direct use
export { TemplateEngine, EdgeFunctionGenerator };
