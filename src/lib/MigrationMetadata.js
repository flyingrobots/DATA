import fs from 'fs';
import path from 'path';

/**
 * Migration metadata management class
 * Handles reading, writing, and validating migration metadata.json files
 */
class MigrationMetadata {
  constructor(migrationPath) {
    if (!migrationPath || typeof migrationPath !== 'string') {
      throw new Error('migrationPath is required and must be a string');
    }

    this.migrationPath = migrationPath;
    this.metadataFile = path.join(migrationPath, 'metadata.json');
    this.schema = this._getSchema();
  }

  /**
   * Read metadata from metadata.json file
   * @returns {Object} Parsed metadata object
   */
  read() {
    if (!fs.existsSync(this.metadataFile)) {
      throw new Error(`Metadata file not found: ${this.metadataFile}`);
    }

    try {
      const content = fs.readFileSync(this.metadataFile, 'utf8');
      const metadata = JSON.parse(content);

      // Validate the loaded metadata
      this.validate(metadata);

      return metadata;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in metadata file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Write metadata to metadata.json file with validation
   * @param {Object} metadata - Metadata object to write
   */
  write(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Metadata must be an object');
    }

    // Validate before writing
    this.validate(metadata);

    // Ensure migration directory exists
    if (!fs.existsSync(this.migrationPath)) {
      fs.mkdirSync(this.migrationPath, { recursive: true });
    }

    try {
      const content = JSON.stringify(metadata, null, 2);
      fs.writeFileSync(this.metadataFile, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write metadata file: ${error.message}`);
    }
  }

  /**
   * Validate metadata against schema
   * @param {Object} metadata - Metadata object to validate
   */
  validate(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Metadata must be an object');
    }

    const errors = [];

    // Required fields
    if (!metadata.id || typeof metadata.id !== 'string') {
      errors.push('id is required and must be a string');
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      errors.push('name is required and must be a string');
    }

    if (!metadata.generated || typeof metadata.generated !== 'string') {
      errors.push('generated is required and must be a string');
    } else if (!this._isValidISO8601(metadata.generated)) {
      errors.push('generated must be a valid ISO 8601 date string');
    }

    // Status validation
    const validStatuses = ['pending', 'tested', 'promoted'];
    if (!metadata.status || !validStatuses.includes(metadata.status)) {
      errors.push(`status must be one of: ${validStatuses.join(', ')}`);
    }

    // Testing object validation
    if (metadata.testing) {
      if (typeof metadata.testing !== 'object') {
        errors.push('testing must be an object');
      } else {
        if (
          metadata.testing.tested_at !== null &&
          (!metadata.testing.tested_at || !this._isValidISO8601(metadata.testing.tested_at))
        ) {
          errors.push('testing.tested_at must be null or valid ISO 8601 date string');
        }

        if (
          metadata.testing.tests_passed !== undefined &&
          (!Number.isInteger(metadata.testing.tests_passed) || metadata.testing.tests_passed < 0)
        ) {
          errors.push('testing.tests_passed must be a non-negative integer');
        }

        if (
          metadata.testing.tests_failed !== undefined &&
          (!Number.isInteger(metadata.testing.tests_failed) || metadata.testing.tests_failed < 0)
        ) {
          errors.push('testing.tests_failed must be a non-negative integer');
        }
      }
    }

    // Promotion object validation
    if (metadata.promotion) {
      if (typeof metadata.promotion !== 'object') {
        errors.push('promotion must be an object');
      } else {
        if (
          metadata.promotion.promoted_at !== null &&
          (!metadata.promotion.promoted_at || !this._isValidISO8601(metadata.promotion.promoted_at))
        ) {
          errors.push('promotion.promoted_at must be null or valid ISO 8601 date string');
        }

        if (
          metadata.promotion.promoted_by !== null &&
          (!metadata.promotion.promoted_by || typeof metadata.promotion.promoted_by !== 'string')
        ) {
          errors.push('promotion.promoted_by must be null or a non-empty string');
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Metadata validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Partially update metadata with new values
   * @param {Object} updates - Object containing fields to update
   * @returns {Object} Updated metadata object
   */
  update(updates) {
    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }

    // Read existing metadata
    const existing = this.read();

    // Deep merge updates
    const updated = this._deepMerge(existing, updates);

    // Validate and write updated metadata
    this.validate(updated);
    this.write(updated);

    return updated;
  }

  /**
   * Create a new metadata object with default values
   * @param {string} id - Migration ID
   * @param {string} name - Migration name
   * @returns {Object} New metadata object
   */
  static createDefault(id, name) {
    if (!id || typeof id !== 'string') {
      throw new Error('id is required and must be a string');
    }

    if (!name || typeof name !== 'string') {
      throw new Error('name is required and must be a string');
    }

    return {
      id,
      name,
      generated: new Date().toISOString(),
      status: 'pending',
      testing: {
        tested_at: null,
        tests_passed: 0,
        tests_failed: 0
      },
      promotion: {
        promoted_at: null,
        promoted_by: null
      }
    };
  }

  /**
   * Get the metadata schema definition
   * @returns {Object} Schema object
   * @private
   */
  _getSchema() {
    return {
      type: 'object',
      required: ['id', 'name', 'generated', 'status'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        generated: { type: 'string', format: 'date-time' },
        status: { enum: ['pending', 'tested', 'promoted'] },
        testing: {
          type: 'object',
          properties: {
            tested_at: { type: ['string', 'null'], format: 'date-time' },
            tests_passed: { type: 'integer', minimum: 0 },
            tests_failed: { type: 'integer', minimum: 0 }
          }
        },
        promotion: {
          type: 'object',
          properties: {
            promoted_at: { type: ['string', 'null'], format: 'date-time' },
            promoted_by: { type: ['string', 'null'] }
          }
        }
      }
    };
  }

  /**
   * Validate ISO 8601 date string
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid ISO 8601
   * @private
   */
  _isValidISO8601(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString();
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this._deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }
}

export default MigrationMetadata;
