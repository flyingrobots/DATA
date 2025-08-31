/**
 * Warning Event Class for D.A.T.A. CLI
 * 
 * This module provides the WarningEvent class for representing warnings,
 * non-critical issues, and situations that require attention but don't
 * prevent operation completion.
 * 
 * @fileoverview Warning event class with severity levels and categorization
 * @author Supa Base 12 Engineering Team
 * @version 1.0.0
 */

import CommandEvent from './CommandEvent.js';

/**
 * Warning event for non-fatal issues
 * 
 * Represents warnings, non-critical issues, or situations that require
 * attention but don't prevent operation completion. Supports categorization
 * and severity levels for better warning management.
 * 
 * @extends CommandEvent
 */
class WarningEvent extends CommandEvent {
  /**
   * Create a new warning event
   * 
   * @param {string} message - Warning message
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional warning details
   * @param {string|null} [code=null] - Warning code for categorization
   */
  constructor(message, details = {}, code = null) {
    super('warning', message, { ...details, code });
    
    /**
     * @type {string|null} Warning code for categorization
     */
    this.code = code;
  }

  /**
   * Create a deprecation warning
   * 
   * Factory method for creating standardized deprecation warnings with
   * consistent messaging and categorization.
   * 
   * @param {string} feature - The deprecated feature
   * @param {string} replacement - The recommended replacement
   * @param {string} [version='next major version'] - When feature will be removed
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {WarningEvent} New deprecation warning event
   * 
   * @example
   * const warning = WarningEvent.deprecation(
   *   'legacyConfig.get()',
   *   'config.getValue()',
   *   'v2.0.0'
   * );
   */
  static deprecation(feature, replacement, version = 'next major version', details = {}) {
    return new WarningEvent(
      `${feature} is deprecated and will be removed in ${version}. Use ${replacement} instead.`,
      {
        ...details,
        feature,
        replacement,
        version,
        category: 'deprecation'
      },
      'DEPRECATION_WARNING'
    );
  }

  /**
   * Create a configuration warning
   * 
   * Factory method for configuration-related warnings such as missing
   * optional settings or suboptimal configurations.
   * 
   * @param {string} message - Configuration warning message
   * @param {string} setting - The configuration setting involved
   * @param {*} [currentValue=null] - Current value of the setting
   * @param {*} [recommendedValue=null] - Recommended value
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {WarningEvent} New configuration warning event
   */
  static configuration(message, setting, currentValue = null, recommendedValue = null, details = {}) {
    return new WarningEvent(
      message,
      {
        ...details,
        setting,
        currentValue,
        recommendedValue,
        category: 'configuration'
      },
      'CONFIG_WARNING'
    );
  }

  /**
   * Create a performance warning
   * 
   * Factory method for performance-related warnings such as slow operations
   * or resource usage concerns.
   * 
   * @param {string} message - Performance warning message
   * @param {string} operation - The operation with performance concerns
   * @param {number} [duration=null] - Operation duration in milliseconds
   * @param {string} [recommendation=null] - Performance improvement suggestion
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {WarningEvent} New performance warning event
   */
  static performance(message, operation, duration = null, recommendation = null, details = {}) {
    return new WarningEvent(
      message,
      {
        ...details,
        operation,
        duration,
        recommendation,
        category: 'performance'
      },
      'PERFORMANCE_WARNING'
    );
  }

  /**
   * Create a security warning
   * 
   * Factory method for security-related warnings that don't rise to the level
   * of errors but indicate potential security concerns.
   * 
   * @param {string} message - Security warning message
   * @param {string} concern - The specific security concern
   * @param {string} [mitigation=null] - Suggested mitigation
   * @param {import('./CommandEvent').EventDetails} [details={}] - Additional details
   * @returns {WarningEvent} New security warning event
   */
  static security(message, concern, mitigation = null, details = {}) {
    return new WarningEvent(
      message,
      {
        ...details,
        concern,
        mitigation,
        category: 'security'
      },
      'SECURITY_WARNING'
    );
  }

  /**
   * Get warning severity level
   * 
   * Determines warning severity based on warning type and category.
   * 
   * @returns {string} Severity level: 'high', 'medium', 'low'
   */
  getSeverity() {
    if (this.code === 'SECURITY_WARNING') {
      return 'high';
    }
    
    if (this.code === 'PERFORMANCE_WARNING') {
      return 'medium';
    }
    
    if (this.code === 'DEPRECATION_WARNING') {
      return 'medium';
    }
    
    if (this.code === 'CONFIG_WARNING') {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Check if this is a deprecation warning
   * 
   * @returns {boolean} True if this is a deprecation warning
   */
  isDeprecationWarning() {
    return this.code === 'DEPRECATION_WARNING' || this.details.category === 'deprecation';
  }

  /**
   * Check if this is a configuration warning
   * 
   * @returns {boolean} True if this is a configuration warning
   */
  isConfigurationWarning() {
    return this.code === 'CONFIG_WARNING' || this.details.category === 'configuration';
  }

  /**
   * Check if this is a performance warning
   * 
   * @returns {boolean} True if this is a performance warning
   */
  isPerformanceWarning() {
    return this.code === 'PERFORMANCE_WARNING' || this.details.category === 'performance';
  }

  /**
   * Check if this is a security warning
   * 
   * @returns {boolean} True if this is a security warning
   */
  isSecurityWarning() {
    return this.code === 'SECURITY_WARNING' || this.details.category === 'security';
  }

  /**
   * Check if this warning requires immediate attention
   * 
   * @returns {boolean} True if warning is high severity
   */
  requiresImmediateAttention() {
    return this.getSeverity() === 'high';
  }

  /**
   * Convert to event data format expected by emit()
   * 
   * Extends the base toEventData method to include warning-specific information
   * for backward compatibility with existing warning event listeners.
   * 
   * @returns {Object} Event data in the format expected by emit()
   */
  toEventData() {
    return {
      ...super.toEventData(),
      code: this.code,
      severity: this.getSeverity(),
      category: this.details.category
    };
  }

  /**
   * Get formatted warning message with severity indicator
   * 
   * @returns {string} Formatted warning message
   */
  getFormattedMessage() {
    const severity = this.getSeverity().toUpperCase();
    return `[${severity} WARNING] ${this.message}`;
  }
}

export { WarningEvent };
export default WarningEvent;