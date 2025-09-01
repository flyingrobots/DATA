/**
 * DbPort - Interface for database operations
 * Pure interface definition - no implementation
 *
 * @typedef {Object} PgTapResult
 * @property {number} passed - Number of passed tests
 * @property {number} failed - Number of failed tests
 * @property {number} total - Total number of tests
 * @property {string[]} failures - Failed test descriptions
 *
 * @typedef {Object} DbPort
 * @property {(sqlText: string) => Promise<void>} apply - Apply SQL migration
 * @property {(sqlText: string, params?: any[]) => Promise<any>} query - Execute query with params
 * @property {(paths: string[]) => Promise<PgTapResult>} runPgTap - Run pgTAP tests
 * @property {<T>(fn: (tx: {apply: (sql: string) => Promise<void>, query: (sql: string, p?: any[]) => Promise<any>}) => Promise<T>) => Promise<T>} withTransaction - Run function in transaction
 */

export {};
