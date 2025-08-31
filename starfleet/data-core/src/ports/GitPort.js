/**
 * GitPort - Interface for git operations
 * Pure interface definition - no implementation
 * @typedef {Object} GitStatus
 * @property {boolean} clean - Is working tree clean
 * @property {string} branch - Current branch name
 * @property {number} behind - Commits behind remote
 * @property {number} ahead - Commits ahead of remote
 * @property {string[]} modified - Modified files
 * @property {string[]} untracked - Untracked files
 * 
 * @typedef {Object} GitPort
 * @property {() => Promise<GitStatus>} status - Get repository status
 * @property {(name: string, message?: string) => Promise<void>} tag - Create annotated tag
 * @property {(prefix: string) => Promise<string | null>} latestTag - Get latest tag with prefix
 * @property {(ref: string) => Promise<string>} revParse - Resolve reference to commit SHA
 */

export {};