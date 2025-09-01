/**
 * Git Deployment Tracker Interfaces and Business Logic
 *
 * Pure interfaces and business logic for git-based deployment tracking.
 * No process, filesystem, or I/O dependencies - only data structures and validation.
 */

/**
 * Git deployment tag prefix for D.A.T.A. deployments
 */
export const DEPLOYMENT_TAG_PREFIX = 'data-deploy-';

/**
 * Deployment metadata structure
 * @typedef {Object} DeploymentMetadata
 * @property {string} migrationId - Unique migration identifier
 * @property {number} operations - Number of operations executed
 * @property {string} timestamp - ISO timestamp of deployment
 * @property {string} environment - Environment (production/development)
 * @property {string} [rollbackFrom] - Previous deployment tag if this is a rollback
 */

/**
 * Git working tree status structure
 * @typedef {Object} WorkingTreeStatus
 * @property {string[]} modified - Modified files
 * @property {string[]} untracked - Untracked files
 * @property {string[]} staged - Staged files
 * @property {string[]} deleted - Deleted files
 */

/**
 * Git deployment business logic and validation
 */
export class GitDeploymentLogic {
  /**
   * Validate deployment metadata
   * @param {DeploymentMetadata} metadata - Metadata to validate
   * @returns {Object} Validation result
   */
  validateDeploymentMetadata(metadata) {
    const errors = [];

    if (!metadata || typeof metadata !== 'object') {
      return {
        valid: false,
        errors: ['Deployment metadata must be an object']
      };
    }

    // Required fields
    if (!metadata.migrationId || typeof metadata.migrationId !== 'string') {
      errors.push('migrationId is required and must be a string');
    }

    if (typeof metadata.operations !== 'number' || metadata.operations < 0) {
      errors.push('operations must be a non-negative number');
    }

    if (!metadata.timestamp || typeof metadata.timestamp !== 'string') {
      errors.push('timestamp is required and must be a string');
    } else if (!this._isValidISO8601(metadata.timestamp)) {
      errors.push('timestamp must be a valid ISO 8601 date string');
    }

    if (!metadata.environment || typeof metadata.environment !== 'string') {
      errors.push('environment is required and must be a string');
    }

    // Optional rollbackFrom validation
    if (
      metadata.rollbackFrom !== undefined &&
      (typeof metadata.rollbackFrom !== 'string' || metadata.rollbackFrom.trim() === '')
    ) {
      errors.push('rollbackFrom must be a non-empty string if provided');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate deployment tag name
   * @param {string} environment - Environment name
   * @param {string} migrationId - Migration identifier
   * @param {string} timestamp - Optional timestamp (defaults to now)
   * @returns {string} Generated tag name
   */
  generateDeploymentTag(environment, migrationId, timestamp = null) {
    if (!environment || typeof environment !== 'string') {
      throw new Error('Environment is required and must be a string');
    }

    if (!migrationId || typeof migrationId !== 'string') {
      throw new Error('Migration ID is required and must be a string');
    }

    const tagTimestamp = timestamp || new Date().toISOString().replace(/[:.]/g, '-');

    return `${DEPLOYMENT_TAG_PREFIX}${environment}-${migrationId}-${tagTimestamp}`;
  }

  /**
   * Parse deployment tag to extract metadata
   * @param {string} tagName - Tag name to parse
   * @returns {Object} Parsed tag information
   */
  parseDeploymentTag(tagName) {
    if (!tagName || typeof tagName !== 'string') {
      return {
        valid: false,
        error: 'Tag name is required and must be a string'
      };
    }

    if (!tagName.startsWith(DEPLOYMENT_TAG_PREFIX)) {
      return {
        valid: false,
        error: `Tag does not start with expected prefix: ${DEPLOYMENT_TAG_PREFIX}`
      };
    }

    const tagContent = tagName.substring(DEPLOYMENT_TAG_PREFIX.length);
    const parts = tagContent.split('-');

    if (parts.length < 3) {
      return {
        valid: false,
        error:
          'Tag format is invalid - expected format: data-deploy-{environment}-{migrationId}-{timestamp}'
      };
    }

    const environment = parts[0];
    const migrationId = parts[1];
    const timestampParts = parts.slice(2);
    const timestamp = timestampParts.join('-');

    return {
      valid: true,
      environment,
      migrationId,
      timestamp,
      fullTag: tagName
    };
  }

  /**
   * Validate working tree status for deployment readiness
   * @param {WorkingTreeStatus} status - Working tree status
   * @returns {Object} Validation result
   */
  validateWorkingTreeStatus(status) {
    if (!status || typeof status !== 'object') {
      return {
        ready: false,
        issues: ['Working tree status is required']
      };
    }

    const issues = [];

    // Check for uncommitted changes
    const modifiedCount = (status.modified || []).length;
    const untracked = (status.untracked || []).length;
    const staged = (status.staged || []).length;
    const deleted = (status.deleted || []).length;

    if (modifiedCount > 0) {
      issues.push(`${modifiedCount} modified files need to be committed`);
    }

    if (untracked > 0) {
      issues.push(`${untracked} untracked files should be committed or ignored`);
    }

    if (staged > 0) {
      issues.push(`${staged} staged files need to be committed`);
    }

    if (deleted > 0) {
      issues.push(`${deleted} deleted files need to be committed`);
    }

    return {
      ready: issues.length === 0,
      issues,
      summary: {
        totalChanges: modifiedCount + untracked + staged + deleted,
        modified: modifiedCount,
        untracked,
        staged,
        deleted
      }
    };
  }

  /**
   * Create deployment metadata object
   * @param {string} migrationId - Migration identifier
   * @param {string} environment - Environment name
   * @param {number} operations - Number of operations
   * @param {string} rollbackFrom - Previous deployment tag (optional)
   * @returns {DeploymentMetadata} Deployment metadata
   */
  createDeploymentMetadata(migrationId, environment, operations = 0, rollbackFrom = null) {
    const metadata = {
      migrationId,
      operations,
      timestamp: new Date().toISOString(),
      environment
    };

    if (rollbackFrom) {
      metadata.rollbackFrom = rollbackFrom;
    }

    const validation = this.validateDeploymentMetadata(metadata);
    if (!validation.valid) {
      throw new Error(`Invalid deployment metadata: ${validation.errors.join(', ')}`);
    }

    return metadata;
  }

  /**
   * Compare two deployment tags chronologically
   * @param {string} tagA - First tag
   * @param {string} tagB - Second tag
   * @returns {number} -1 if tagA is older, 1 if newer, 0 if equal
   */
  compareDeploymentTags(tagA, tagB) {
    const parsedA = this.parseDeploymentTag(tagA);
    const parsedB = this.parseDeploymentTag(tagB);

    if (!parsedA.valid || !parsedB.valid) {
      throw new Error('Cannot compare invalid deployment tags');
    }

    // Convert timestamp back to Date for comparison
    const dateA = new Date(parsedA.timestamp.replace(/-/g, ':'));
    const dateB = new Date(parsedB.timestamp.replace(/-/g, ':'));

    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    return 0;
  }

  /**
   * Filter deployment tags by environment
   * @param {string[]} tags - Array of tag names
   * @param {string} environment - Environment to filter by
   * @returns {Object[]} Filtered and parsed tags for the environment
   */
  filterTagsByEnvironment(tags, environment) {
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }

    return tags
      .map((tag) => this.parseDeploymentTag(tag))
      .filter((parsed) => parsed.valid && parsed.environment === environment)
      .sort((a, b) => this.compareDeploymentTags(a.fullTag, b.fullTag));
  }

  /**
   * Get rollback information for a deployment
   * @param {DeploymentMetadata} metadata - Current deployment metadata
   * @param {string[]} availableTags - Available deployment tags
   * @returns {Object} Rollback information
   */
  getRollbackInfo(metadata, availableTags) {
    if (metadata.rollbackFrom) {
      return {
        isRollback: true,
        rollbackFrom: metadata.rollbackFrom,
        reason: 'Explicit rollback deployment'
      };
    }

    // Check if this looks like a rollback based on available tags
    const environmentTags = this.filterTagsByEnvironment(availableTags, metadata.environment);

    if (environmentTags.length <= 1) {
      return {
        isRollback: false,
        reason: 'First deployment or insufficient history'
      };
    }

    // Find if there's a newer tag with the same migration ID
    const thisTagData = environmentTags.find((tag) => tag.migrationId === metadata.migrationId);
    const newerTags = environmentTags.filter(
      (tag) => this.compareDeploymentTags(tag.fullTag, thisTagData?.fullTag || '') > 0
    );

    return {
      isRollback: newerTags.length > 0,
      possibleRollbackFrom: newerTags.length > 0 ? newerTags[newerTags.length - 1].fullTag : null,
      reason:
        newerTags.length > 0 ? 'Deploying older migration after newer ones' : 'Standard deployment'
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
}

export default GitDeploymentLogic;
