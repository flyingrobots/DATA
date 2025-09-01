/**
 * FileSystemPort - Interface for file system operations
 * Pure interface definition - no implementation
 * @typedef {Object} FileSystemPort
 * @property {(path: string) => Promise<string>} readFile - Read file contents as UTF-8
 * @property {(path: string, data: string) => Promise<void>} writeFile - Write string to file
 * @property {(path: string) => Promise<boolean>} exists - Check if file/directory exists
 * @property {(path: string) => Promise<void>} mkdirp - Create directory recursively
 * @property {(path: string, opts?: {recursive?: boolean, force?: boolean}) => Promise<void>} rm - Remove file or directory
 * @property {(path: string) => Promise<string[]>} readdir - List directory contents
 * @property {(path: string) => Promise<{isFile: () => boolean, isDirectory: () => boolean, size: number}>} stat - Get file stats
 */

export {};
