import { promises as fs, constants } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Node.js implementation of the FileSystem port.
 * Wraps fs/promises APIs to provide standardized file system operations.
 * 
 * @class FileSystemAdapter
 */
export class FileSystemAdapter {
  /**
   * Create a new FileSystemAdapter instance.
   * 
   * @param {Object} options - Configuration options
   * @param {string} [options.encoding='utf8'] - Default file encoding
   * @param {number} [options.mode=0o644] - Default file creation mode
   */
  constructor(options = {}) {
    this.encoding = options.encoding || 'utf8';
    this.defaultMode = options.mode || 0o644;
  }

  /**
   * Read file contents as text.
   * 
   * @param {string} filePath - Path to the file
   * @param {Object} [options] - Read options
   * @param {string} [options.encoding] - File encoding override
   * @returns {Promise<string>} File contents
   * @throws {FileSystemError} When file cannot be read
   */
  async readFile(filePath, options = {}) {
    try {
      const encoding = options.encoding || this.encoding;
      return await fs.readFile(resolve(filePath), { encoding });
    } catch (error) {
      throw this._normalizeError(error, 'readFile', filePath);
    }
  }

  /**
   * Write text content to file.
   * 
   * @param {string} filePath - Path to the file
   * @param {string} content - Content to write
   * @param {Object} [options] - Write options
   * @param {string} [options.encoding] - File encoding override
   * @param {number} [options.mode] - File creation mode override
   * @returns {Promise<void>}
   * @throws {FileSystemError} When file cannot be written
   */
  async writeFile(filePath, content, options = {}) {
    try {
      const encoding = options.encoding || this.encoding;
      const mode = options.mode || this.defaultMode;
      
      // Ensure directory exists
      await this.ensureDir(dirname(filePath));
      
      return await fs.writeFile(resolve(filePath), content, { encoding, mode });
    } catch (error) {
      throw this._normalizeError(error, 'writeFile', filePath);
    }
  }

  /**
   * Check if file or directory exists.
   * 
   * @param {string} path - Path to check
   * @returns {Promise<boolean>} True if path exists
   */
  async exists(path) {
    try {
      await fs.access(resolve(path), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file or directory stats.
   * 
   * @param {string} path - Path to stat
   * @returns {Promise<Object>} Stat information with normalized properties
   * @throws {FileSystemError} When path cannot be accessed
   */
  async stat(path) {
    try {
      const stats = await fs.stat(resolve(path));
      return {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        mode: stats.mode
      };
    } catch (error) {
      throw this._normalizeError(error, 'stat', path);
    }
  }

  /**
   * Create directory recursively.
   * 
   * @param {string} dirPath - Directory path to create
   * @param {Object} [options] - Creation options
   * @param {number} [options.mode] - Directory creation mode
   * @returns {Promise<void>}
   * @throws {FileSystemError} When directory cannot be created
   */
  async ensureDir(dirPath, options = {}) {
    try {
      const mode = options.mode || 0o755;
      await fs.mkdir(resolve(dirPath), { recursive: true, mode });
    } catch (error) {
      throw this._normalizeError(error, 'ensureDir', dirPath);
    }
  }

  /**
   * Remove file or directory.
   * 
   * @param {string} path - Path to remove
   * @param {Object} [options] - Removal options
   * @param {boolean} [options.recursive=false] - Remove directories recursively
   * @returns {Promise<void>}
   * @throws {FileSystemError} When path cannot be removed
   */
  async remove(path, options = {}) {
    try {
      const resolvedPath = resolve(path);
      const stats = await this.stat(resolvedPath);
      
      if (stats.isDirectory) {
        if (options.recursive) {
          await fs.rm(resolvedPath, { recursive: true, force: true });
        } else {
          await fs.rmdir(resolvedPath);
        }
      } else {
        await fs.unlink(resolvedPath);
      }
    } catch (error) {
      throw this._normalizeError(error, 'remove', path);
    }
  }

  /**
   * List directory contents.
   * 
   * @param {string} dirPath - Directory path
   * @param {Object} [options] - List options
   * @param {boolean} [options.withFileTypes=false] - Return file type info
   * @returns {Promise<Array<string|Object>>} Directory entries
   * @throws {FileSystemError} When directory cannot be read
   */
  async readDir(dirPath, options = {}) {
    try {
      const resolvedPath = resolve(dirPath);
      
      if (options.withFileTypes) {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        return entries.map(entry => ({
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory()
        }));
      } else {
        return await fs.readdir(resolvedPath);
      }
    } catch (error) {
      throw this._normalizeError(error, 'readDir', dirPath);
    }
  }

  /**
   * Copy file or directory.
   * 
   * @param {string} src - Source path
   * @param {string} dest - Destination path
   * @param {Object} [options] - Copy options
   * @param {boolean} [options.recursive=false] - Copy directories recursively
   * @returns {Promise<void>}
   * @throws {FileSystemError} When copy operation fails
   */
  async copy(src, dest, options = {}) {
    try {
      const srcPath = resolve(src);
      const destPath = resolve(dest);
      
      await fs.cp(srcPath, destPath, {
        recursive: options.recursive || false,
        force: true,
        preserveTimestamps: true
      });
    } catch (error) {
      throw this._normalizeError(error, 'copy', `${src} -> ${dest}`);
    }
  }

  /**
   * Normalize file system errors into consistent format.
   * 
   * @private
   * @param {Error} error - Original error
   * @param {string} operation - Operation that failed
   * @param {string} path - Path involved in operation
   * @returns {FileSystemError} Normalized error
   */
  _normalizeError(error, operation, path) {
    const normalizedError = new Error(
      `FileSystem ${operation} failed for "${path}": ${error.message}`
    );
    normalizedError.name = 'FileSystemError';
    normalizedError.code = error.code;
    normalizedError.operation = operation;
    normalizedError.path = path;
    normalizedError.originalError = error;
    
    return normalizedError;
  }
}