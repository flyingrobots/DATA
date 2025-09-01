/**
 * ProcessPort - Interface for process/child process operations
 * Pure interface definition - no implementation
 *
 * @typedef {Object} SpawnOptions
 * @property {string} [cwd] - Working directory
 * @property {Record<string, string>} [env] - Environment variables
 * @property {boolean} [shell] - Use shell
 * @property {number} [timeout] - Timeout in milliseconds
 *
 * @typedef {Object} SpawnResult
 * @property {string} stdout - Standard output
 * @property {string} stderr - Standard error
 * @property {number} code - Exit code
 * @property {string | null} signal - Termination signal
 *
 * @typedef {Object} ProcessPort
 * @property {(command: string, args?: string[], options?: SpawnOptions) => Promise<SpawnResult>} spawn - Spawn child process
 * @property {(command: string, options?: SpawnOptions) => Promise<SpawnResult>} exec - Execute command in shell
 * @property {(code?: number) => void} exit - Exit current process
 * @property {() => string} cwd - Get current working directory
 * @property {(dir: string) => void} chdir - Change working directory
 * @property {(command: string) => Promise<string | null>} which - Find command in PATH
 */

export {};
