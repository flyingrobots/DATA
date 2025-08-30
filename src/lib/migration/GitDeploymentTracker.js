/**
 * Git Deployment Tracker for D.A.T.A.
 * 
 * Manages git-based deployment tracking using tags and commit history.
 * Provides deployment state management and SQL retrieval from git history.
 * 
 * @module GitDeploymentTracker
 */

const { EventEmitter } = require('events');
const ChildProcessWrapper = require('../ChildProcessWrapper');
const path = require('path');
const fs = require('fs').promises;

/**
 * Git deployment tag prefix for D.A.T.A. deployments
 */
const DEPLOYMENT_TAG_PREFIX = 'data-deploy-';

/**
 * Deployment metadata structure
 * @typedef {Object} DeploymentMetadata
 * @property {string} migrationId - Unique migration identifier
 * @property {number} operations - Number of operations executed
 * @property {string} timestamp - ISO timestamp of deployment
 * @property {string} environment - Environment (production/development)
 * @property {string} [rollbackFrom] - Previous deployment tag if this is a rollback
 */

class GitDeploymentTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.childProcess = options.childProcess || new ChildProcessWrapper();
    this.gitDir = options.gitDir || process.cwd();
    this.sqlDir = options.sqlDir || process.env.ARCHY_SQL_DIR || './sql';
  }
  
  /**
   * Check if working tree is clean (no uncommitted changes)
   * @returns {Promise<boolean>} True if working tree is clean
   */
  async isWorkingTreeClean() {
    try {
      const result = await this.childProcess.execute('git', ['status', '--porcelain'], {
        cwd: this.gitDir,
        timeout: 10000
      });
      
      return result.stdout.trim() === '';
    } catch (error) {
      this.emit('error', {
        message: 'Failed to check git status',
        error
      });
      throw new Error(`Git status check failed: ${error.message}`);
    }
  }
  
  /**
   * Get detailed working tree status
   * @returns {Promise<Object>} Status with modified, untracked, and staged files
   */
  async getWorkingTreeStatus() {
    try {
      const result = await this.childProcess.execute('git', ['status', '--porcelain'], {
        cwd: this.gitDir,
        timeout: 10000
      });
      
      const lines = result.stdout.trim().split('\n').filter(Boolean);
      const status = {
        modified: [],
        untracked: [],
        staged: [],
        deleted: []
      };
      
      for (const line of lines) {
        const statusCode = line.substring(0, 2);
        const file = line.substring(3);
        
        if (statusCode.includes('M')) status.modified.push(file);
        if (statusCode.includes('A')) status.staged.push(file);
        if (statusCode.includes('D')) status.deleted.push(file);
        if (statusCode.includes('?')) status.untracked.push(file);
      }
      
      return status;
    } catch (error) {
      throw new Error(`Failed to get git status: ${error.message}`);
    }
  }
  
  /**
   * Get current git branch name
   * @returns {Promise<string>} Current branch name
   */
  async getCurrentBranch() {
    try {
      const result = await this.childProcess.execute('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.gitDir,
        timeout: 10000
      });
      
      return result.stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }
  
  /**
   * Get current git commit hash
   * @returns {Promise<string>} Current commit hash
   */
  async getCurrentCommit() {
    try {
      const result = await this.childProcess.execute('git', ['rev-parse', 'HEAD'], {
        cwd: this.gitDir,
        timeout: 10000
      });
      
      return result.stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get current commit: ${error.message}`);
    }
  }
  
  /**
   * Comprehensive git state validation for deployment safety
   * Ensures:
   * 1. Working tree is clean (no uncommitted changes)
   * 2. On main/master branch
   * 3. Branch is up-to-date with origin (not ahead, not behind)
   * 
   * @returns {Promise<Object>} Validation result with errors and warnings
   */
  async validateDeploymentReadiness() {
    const errors = [];
    const warnings = [];
    
    try {
      // 1. Check working tree is clean
      const isClean = await this.isWorkingTreeClean();
      if (!isClean) {
        const status = await this.getWorkingTreeStatus();
        errors.push('Working tree is not clean. Commit or stash changes first.');
        
        if (status.modified.length > 0) {
          warnings.push(`Modified files: ${status.modified.join(', ')}`);
        }
        if (status.untracked.length > 0) {
          warnings.push(`Untracked files: ${status.untracked.join(', ')}`);
        }
        if (status.staged.length > 0) {
          warnings.push(`Staged files: ${status.staged.join(', ')}`);
        }
      }
      
      // 2. Check on main/master branch
      const currentBranch = await this.getCurrentBranch();
      const allowedBranches = ['main', 'master'];
      
      if (!allowedBranches.includes(currentBranch)) {
        errors.push(`Must be on main or master branch. Currently on: ${currentBranch}`);
      }
      
      // 3. Check synchronization with origin
      if (allowedBranches.includes(currentBranch)) {
        try {
          // Fetch latest refs from origin (lightweight)
          await this.childProcess.execute('git', ['fetch', 'origin', currentBranch], {
            cwd: this.gitDir,
            timeout: 30000
          });
          
          // Get local and remote HEAD commits
          const localHead = await this.getCurrentCommit();
          const remoteResult = await this.childProcess.execute(
            'git', 
            ['rev-parse', `origin/${currentBranch}`],
            { cwd: this.gitDir, timeout: 10000 }
          );
          const remoteHead = remoteResult.stdout.trim();
          
          if (localHead !== remoteHead) {
            // Check if ahead, behind, or diverged
            const aheadResult = await this.childProcess.execute(
              'git',
              ['rev-list', '--count', `origin/${currentBranch}..HEAD`],
              { cwd: this.gitDir, timeout: 10000 }
            );
            const aheadCount = parseInt(aheadResult.stdout.trim());
            
            const behindResult = await this.childProcess.execute(
              'git',
              ['rev-list', '--count', `HEAD..origin/${currentBranch}`],
              { cwd: this.gitDir, timeout: 10000 }
            );
            const behindCount = parseInt(behindResult.stdout.trim());
            
            if (behindCount > 0 && aheadCount > 0) {
              errors.push(
                `Branch has diverged from origin/${currentBranch}. ` +
                `${aheadCount} commits ahead, ${behindCount} commits behind. ` +
                `Resolve conflicts and synchronize first.`
              );
            } else if (behindCount > 0) {
              errors.push(
                `Branch is ${behindCount} commits behind origin/${currentBranch}. ` +
                `Pull latest changes: git pull origin ${currentBranch}`
              );
            } else if (aheadCount > 0) {
              errors.push(
                `Branch is ${aheadCount} commits ahead of origin/${currentBranch}. ` +
                `Push your changes first: git push origin ${currentBranch}`
              );
            }
          }
        } catch (error) {
          if (error.message.includes('unknown revision')) {
            warnings.push(
              'No remote origin configured. This is unusual for production deployments.'
            );
          } else if (error.message.includes('Could not resolve host')) {
            errors.push('Cannot connect to remote repository. Check network connection.');
          } else {
            errors.push(`Failed to check remote synchronization: ${error.message}`);
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        branch: currentBranch,
        clean: isClean
      };
      
    } catch (error) {
      this.emit('error', {
        message: 'Git validation failed',
        error
      });
      
      return {
        valid: false,
        errors: [`Git validation failed: ${error.message}`],
        warnings
      };
    }
  }
  
  /**
   * Get the last deployment tag and its metadata
   * @returns {Promise<Object|null>} Last deployment tag info or null if none
   */
  async getLastDeploymentTag() {
    try {
      // Get all deployment tags sorted by version (most recent first)
      const result = await this.childProcess.execute('git', [
        'tag', '-l', `${DEPLOYMENT_TAG_PREFIX}*`,
        '--sort=-version:refname'
      ], {
        cwd: this.gitDir,
        timeout: 10000
      });
      
      const tags = result.stdout.trim().split('\n').filter(Boolean);
      if (tags.length === 0) {
        this.emit('progress', { message: 'No deployment tags found' });
        return null;
      }
      
      const latestTag = tags[0];
      
      // Get the commit hash for this tag
      const hashResult = await this.childProcess.execute('git', [
        'rev-list', '-n', '1', latestTag
      ], {
        cwd: this.gitDir,
        timeout: 10000
      });
      
      const hash = hashResult.stdout.trim();
      
      // Get tag metadata (if any)
      let metadata = {};
      try {
        const messageResult = await this.childProcess.execute('git', [
          'tag', '-l', '--format=%(contents)', latestTag
        ], {
          cwd: this.gitDir,
          timeout: 10000
        });
        
        const message = messageResult.stdout.trim();
        if (message && message.startsWith('{')) {
          metadata = JSON.parse(message);
        }
      } catch {
        // Ignore metadata parsing errors
      }
      
      this.emit('progress', {
        message: `Found last deployment: ${latestTag}`,
        tag: latestTag,
        hash
      });
      
      return {
        tag: latestTag,
        hash,
        metadata
      };
      
    } catch (error) {
      throw new Error(`Failed to get deployment tags: ${error.message}`);
    }
  }
  
  /**
   * Get all deployment tags with their metadata
   * @returns {Promise<Array>} Array of deployment tag objects
   */
  async getDeploymentHistory(limit = 10) {
    try {
      const result = await this.childProcess.execute('git', [
        'tag', '-l', `${DEPLOYMENT_TAG_PREFIX}*`,
        '--sort=-version:refname'
      ], {
        cwd: this.gitDir,
        timeout: 15000
      });
      
      const tags = result.stdout.trim().split('\n').filter(Boolean).slice(0, limit);
      const history = [];
      
      for (const tag of tags) {
        // Get commit hash
        const hashResult = await this.childProcess.execute('git', [
          'rev-list', '-n', '1', tag
        ], {
          cwd: this.gitDir,
          timeout: 10000
        });
        
        const hash = hashResult.stdout.trim();
        
        // Get commit timestamp
        const timestampResult = await this.childProcess.execute('git', [
          'log', '-1', '--format=%ct', hash
        ], {
          cwd: this.gitDir,
          timeout: 10000
        });
        
        const timestamp = new Date(parseInt(timestampResult.stdout.trim()) * 1000);
        
        // Get tag metadata
        let metadata = {};
        try {
          const messageResult = await this.childProcess.execute('git', [
            'tag', '-l', '--format=%(contents)', tag
          ], {
            cwd: this.gitDir,
            timeout: 10000
          });
          
          const message = messageResult.stdout.trim();
          if (message && message.startsWith('{')) {
            metadata = JSON.parse(message);
          }
        } catch {
          // Ignore metadata parsing errors
        }
        
        history.push({
          tag,
          hash,
          timestamp,
          metadata
        });
      }
      
      return history;
      
    } catch (error) {
      throw new Error(`Failed to get deployment history: ${error.message}`);
    }
  }
  
  /**
   * Get SQL content at a specific git commit
   * @param {string} commitHash - Git commit hash
   * @returns {Promise<string>} Combined SQL content
   */
  async getSQLAtCommit(commitHash) {
    this.emit('progress', {
      message: `Retrieving SQL at commit ${commitHash.substring(0, 8)}`
    });
    
    try {
      // Get list of SQL files at the commit
      const listResult = await this.childProcess.execute('git', [
        'ls-tree', '-r', '--name-only', commitHash, '--', this.sqlDir
      ], {
        cwd: this.gitDir,
        timeout: 15000
      });
      
      const sqlFiles = listResult.stdout
        .trim()
        .split('\n')
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      if (sqlFiles.length === 0) {
        this.emit('progress', { message: 'No SQL files found at commit' });
        return '';
      }
      
      let combinedSQL = '';
      
      for (const file of sqlFiles) {
        try {
          const fileResult = await this.childProcess.execute('git', [
            'show', `${commitHash}:${file}`
          ], {
            cwd: this.gitDir,
            timeout: 30000
          });
          
          combinedSQL += `-- File: ${file}\n`;
          combinedSQL += fileResult.stdout + '\n\n';
        } catch (error) {
          // File might not exist at this commit, skip it
          this.emit('progress', {
            message: `Skipping ${file} (not found at commit ${commitHash.substring(0, 8)})`
          });
        }
      }
      
      this.emit('progress', {
        message: `Retrieved SQL from ${sqlFiles.length} files`,
        files: sqlFiles.length,
        size: combinedSQL.length
      });
      
      return combinedSQL;
      
    } catch (error) {
      throw new Error(`Failed to get SQL at commit ${commitHash}: ${error.message}`);
    }
  }
  
  /**
   * Create a new deployment tag with metadata
   * @param {string} tag - Tag name (without prefix)
   * @param {DeploymentMetadata} metadata - Deployment metadata
   * @returns {Promise<string>} Full tag name created
   */
  async createDeploymentTag(tag, metadata) {
    const fullTag = tag.startsWith(DEPLOYMENT_TAG_PREFIX) ? tag : `${DEPLOYMENT_TAG_PREFIX}${tag}`;
    
    this.emit('progress', { message: `Creating deployment tag: ${fullTag}` });
    
    try {
      // Create annotated tag with metadata as JSON
      const metadataJson = JSON.stringify(metadata, null, 2);
      
      await this.childProcess.execute('git', [
        'tag', '-a', fullTag, '-m', metadataJson
      ], {
        cwd: this.gitDir,
        timeout: 15000
      });
      
      this.emit('progress', {
        message: `Created deployment tag: ${fullTag}`,
        tag: fullTag,
        metadata
      });
      
      return fullTag;
      
    } catch (error) {
      throw new Error(`Failed to create deployment tag: ${error.message}`);
    }
  }
  
  /**
   * Delete a deployment tag
   * @param {string} tag - Tag name to delete
   */
  async deleteDeploymentTag(tag) {
    const fullTag = tag.startsWith(DEPLOYMENT_TAG_PREFIX) ? tag : `${DEPLOYMENT_TAG_PREFIX}${tag}`;
    
    try {
      await this.childProcess.execute('git', ['tag', '-d', fullTag], {
        cwd: this.gitDir,
        timeout: 10000
      });
      
      this.emit('progress', { message: `Deleted tag: ${fullTag}` });
      
    } catch (error) {
      throw new Error(`Failed to delete tag ${fullTag}: ${error.message}`);
    }
  }
  
  /**
   * Get changes between two commits
   * @param {string} fromCommit - Starting commit hash
   * @param {string} toCommit - Ending commit hash (default: HEAD)
   * @returns {Promise<Object>} Changes summary
   */
  async getChangesBetweenCommits(fromCommit, toCommit = 'HEAD') {
    try {
      // Get diff stat
      const statResult = await this.childProcess.execute('git', [
        'diff', '--stat', `${fromCommit}..${toCommit}`, '--', this.sqlDir
      ], {
        cwd: this.gitDir,
        timeout: 15000
      });
      
      // Get list of changed files
      const filesResult = await this.childProcess.execute('git', [
        'diff', '--name-status', `${fromCommit}..${toCommit}`, '--', this.sqlDir
      ], {
        cwd: this.gitDir,
        timeout: 15000
      });
      
      const changes = {
        summary: statResult.stdout.trim(),
        files: [],
        additions: 0,
        deletions: 0
      };
      
      const fileLines = filesResult.stdout.trim().split('\n').filter(Boolean);
      for (const line of fileLines) {
        const [status, file] = line.split('\t');
        changes.files.push({ status, file });
      }
      
      // Extract additions and deletions from summary
      const summaryMatch = changes.summary.match(/(\d+) insertions?\(\+\), (\d+) deletions?\(-\)/);
      if (summaryMatch) {
        changes.additions = parseInt(summaryMatch[1]);
        changes.deletions = parseInt(summaryMatch[2]);
      }
      
      return changes;
      
    } catch (error) {
      throw new Error(`Failed to get changes between commits: ${error.message}`);
    }
  }
  
  /**
   * Check if a tag exists
   * @param {string} tag - Tag name to check
   * @returns {Promise<boolean>} True if tag exists
   */
  async tagExists(tag) {
    try {
      await this.childProcess.execute('git', ['rev-parse', `refs/tags/${tag}`], {
        cwd: this.gitDir,
        timeout: 10000
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Push deployment tags to remote
   * @param {string} remote - Remote name (default: origin)
   */
  async pushDeploymentTags(remote = 'origin') {
    try {
      await this.childProcess.execute('git', [
        'push', remote, `refs/tags/${DEPLOYMENT_TAG_PREFIX}*`
      ], {
        cwd: this.gitDir,
        timeout: 30000
      });
      
      this.emit('progress', { message: `Pushed deployment tags to ${remote}` });
      
    } catch (error) {
      // Don't fail the deployment if tag push fails
      this.emit('progress', { 
        message: `Failed to push tags to ${remote}: ${error.message}` 
      });
    }
  }
}

module.exports = GitDeploymentTracker;