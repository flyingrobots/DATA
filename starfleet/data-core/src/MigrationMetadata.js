/**
 * Migration metadata validation and processing (pure logic)
 * Handles validation, creation, and manipulation of migration metadata
 * No filesystem dependencies - data is passed in/out
 */

/**
 * Migration metadata management class (pure logic version)
 * Handles parsing, validation, and manipulation of migration metadata
 */
export class MigrationMetadata {
  constructor() {
    this.schema = this._getSchema();
  }
  
  /**
   * Validate metadata against schema
   * @param {Object} metadata - Metadata object to validate
   * @returns {Object} Validation result
   */
  validate(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return {
        valid: false,
        errors: ['Metadata must be an object']
      };
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
        if (metadata.testing.tested_at !== null && 
            (!metadata.testing.tested_at || !this._isValidISO8601(metadata.testing.tested_at))) {
          errors.push('testing.tested_at must be null or valid ISO 8601 date string');
        }
        
        if (metadata.testing.tests_passed !== undefined && 
            (!Number.isInteger(metadata.testing.tests_passed) || metadata.testing.tests_passed < 0)) {
          errors.push('testing.tests_passed must be a non-negative integer');
        }
        
        if (metadata.testing.tests_failed !== undefined && 
            (!Number.isInteger(metadata.testing.tests_failed) || metadata.testing.tests_failed < 0)) {
          errors.push('testing.tests_failed must be a non-negative integer');
        }
      }
    }
    
    // Promotion object validation
    if (metadata.promotion) {
      if (typeof metadata.promotion !== 'object') {
        errors.push('promotion must be an object');
      } else {
        if (metadata.promotion.promoted_at !== null && 
            (!metadata.promotion.promoted_at || !this._isValidISO8601(metadata.promotion.promoted_at))) {
          errors.push('promotion.promoted_at must be null or valid ISO 8601 date string');
        }
        
        if (metadata.promotion.promoted_by !== null && 
            (!metadata.promotion.promoted_by || typeof metadata.promotion.promoted_by !== 'string')) {
          errors.push('promotion.promoted_by must be null or a non-empty string');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Partially update metadata with new values
   * @param {Object} existing - Existing metadata
   * @param {Object} updates - Object containing fields to update
   * @returns {Object} Updated metadata object
   */
  update(existing, updates) {
    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }
    
    if (!existing || typeof existing !== 'object') {
      throw new Error('Existing metadata must be an object');
    }
    
    // Deep merge updates
    const updated = this._deepMerge(existing, updates);
    
    // Validate updated metadata
    const validation = this.validate(updated);
    if (!validation.valid) {
      throw new Error(`Metadata validation failed:\n${validation.errors.join('\n')}`);
    }
    
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
   * Update test results in metadata
   * @param {Object} metadata - Existing metadata
   * @param {Object} testResults - Test results to update
   * @returns {Object} Updated metadata
   */
  updateTestResults(metadata, testResults) {
    const updates = {
      status: testResults.failed === 0 ? 'tested' : 'pending',
      testing: {
        tested_at: new Date().toISOString(),
        tests_passed: testResults.passed || 0,
        tests_failed: testResults.failed || 0
      }
    };

    return this.update(metadata, updates);
  }

  /**
   * Update promotion information in metadata
   * @param {Object} metadata - Existing metadata
   * @param {string} promotedBy - Who promoted the migration
   * @returns {Object} Updated metadata
   */
  updatePromotion(metadata, promotedBy) {
    const updates = {
      status: 'promoted',
      promotion: {
        promoted_at: new Date().toISOString(),
        promoted_by: promotedBy
      }
    };

    return this.update(metadata, updates);
  }

  /**
   * Check if metadata indicates migration is ready for promotion
   * @param {Object} metadata - Metadata to check
   * @returns {Object} Readiness check result
   */
  checkPromotionReadiness(metadata) {
    const validation = this.validate(metadata);
    if (!validation.valid) {
      return {
        ready: false,
        reason: 'Metadata is invalid',
        errors: validation.errors
      };
    }

    if (metadata.status !== 'tested') {
      return {
        ready: false,
        reason: `Migration status is '${metadata.status}', must be 'tested'`
      };
    }

    if (!metadata.testing?.tested_at) {
      return {
        ready: false,
        reason: 'Migration has not been tested'
      };
    }

    if (metadata.testing.tests_failed > 0) {
      return {
        ready: false,
        reason: `Migration has ${metadata.testing.tests_failed} failing tests`
      };
    }

    return {
      ready: true,
      reason: 'Migration is ready for promotion'
    };
  }

  /**
   * Generate summary information from metadata
   * @param {Object} metadata - Metadata to summarize
   * @returns {Object} Summary information
   */
  generateSummary(metadata) {
    const validation = this.validate(metadata);
    
    return {
      id: metadata.id,
      name: metadata.name,
      status: metadata.status,
      generated: metadata.generated,
      valid: validation.valid,
      errors: validation.errors || [],
      testingSummary: metadata.testing ? {
        tested: metadata.testing.tested_at !== null,
        testedAt: metadata.testing.tested_at,
        passed: metadata.testing.tests_passed || 0,
        failed: metadata.testing.tests_failed || 0,
        total: (metadata.testing.tests_passed || 0) + (metadata.testing.tests_failed || 0)
      } : null,
      promotionSummary: metadata.promotion ? {
        promoted: metadata.promotion.promoted_at !== null,
        promotedAt: metadata.promotion.promoted_at,
        promotedBy: metadata.promotion.promoted_by
      } : null
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
    return date instanceof Date && !isNaN(date.getTime()) && 
           dateString === date.toISOString();
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