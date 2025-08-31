const path = require("path");
const fs = require("fs");
const { promisify } = require("util");

/**
 * A utility class for resolving and ensuring the existence of file and directory paths.
 * Distinguishes between read and write access for paths.
 */
class PathResolver {
  /**
   * PathResolver constructor.
   * @param {Object} fileSystem - Optional fs module override for testing
   */
  constructor(fileSystem = null) {
    this.fs = fileSystem || fs;
    // Create promisified versions for async operations
    this.fsAccess = promisify(this.fs.access);
    this.fsMkdir = promisify(this.fs.mkdir);
    this.fsStat = promisify(this.fs.stat);
  }

  /**
   * Resolve a directory path for reading (must exist)
   * @param {string} dirPath - The directory path to resolve
   * @returns {Promise<string>} The absolute path to the existing directory
   * @throws {Error} If the directory does not exist or is not readable
   */
  async resolveDirectoryForRead(dirPath) {
    const absolutePath = path.resolve(dirPath);

    try {
      await this.fsAccess(absolutePath, this.fs.constants.R_OK);
      const stats = await this.fsStat(absolutePath);
      if (!stats.isDirectory()) {
        throw new Error(`Path exists but is not a directory: ${absolutePath}`);
      }
      return absolutePath;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          `Directory does not exist for reading: ${absolutePath}`,
        );
      }
      if (error.code === "EACCES") {
        throw new Error(`Directory is not readable: ${absolutePath}`);
      }
      throw error;
    }
  }

  /**
   * Resolve a directory path for writing (creates if necessary)
   * @param {string} dirPath - The directory path to resolve
   * @returns {Promise<string>} The absolute path to the directory (created if needed)
   * @throws {Error} If the directory cannot be created or written to
   */
  async resolveDirectoryForWrite(dirPath) {
    const absolutePath = path.resolve(dirPath);

    try {
      // Try to create the directory (will succeed if it already exists)
      await this.fsMkdir(absolutePath, { recursive: true });

      // Verify write access
      await this.fsAccess(absolutePath, this.fs.constants.W_OK);
      return absolutePath;
    } catch (error) {
      if (error.code === "EACCES") {
        throw new Error(`Directory is not writable: ${absolutePath}`);
      }
      throw new Error(
        `Failed to create/access directory for writing: ${absolutePath} - ${error.message}`,
      );
    }
  }

  /**
   * Resolve a file path for reading (must exist)
   * @param {string} filePath - The file path to resolve
   * @returns {Promise<string>} The absolute path to the existing file
   * @throws {Error} If the file does not exist or is not readable
   */
  async resolveFileForRead(filePath) {
    const absolutePath = path.resolve(filePath);

    try {
      await this.fsAccess(absolutePath, this.fs.constants.R_OK);
      const stats = await this.fsStat(absolutePath);
      if (!stats.isFile()) {
        throw new Error(`Path exists but is not a file: ${absolutePath}`);
      }
      return absolutePath;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`File does not exist for reading: ${absolutePath}`);
      }
      if (error.code === "EACCES") {
        throw new Error(`File is not readable: ${absolutePath}`);
      }
      throw error;
    }
  }

  /**
   * Resolve a file path for writing (ensures parent directory exists)
   * @param {string} filePath - The file path to resolve
   * @returns {Promise<string>} The absolute path where the file can be written
   * @throws {Error} If the parent directory cannot be created or written to
   */
  async resolveFileForWrite(filePath) {
    const absolutePath = path.resolve(filePath);
    const parentDir = path.dirname(absolutePath);

    // Ensure parent directory exists and is writable
    await this.resolveDirectoryForWrite(parentDir);

    // Check if file exists and is writable, or if parent dir is writable for new file
    try {
      await this.fsAccess(absolutePath, this.fs.constants.W_OK);
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist, that's OK for writing, just check parent dir
        // (already checked above)
      } else if (error.code === "EACCES") {
        throw new Error(`File exists but is not writable: ${absolutePath}`);
      } else {
        throw error;
      }
    }

    return absolutePath;
  }

  /**
   * Check if a path exists (without throwing)
   * @param {string} pathToCheck - The path to check
   * @returns {Promise<boolean>} True if the path exists, false otherwise
   */
  async exists(pathToCheck) {
    try {
      await this.fsAccess(path.resolve(pathToCheck), this.fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Legacy method for backward compatibility - resolves directory for writing
   * @deprecated Use resolveDirectoryForWrite instead
   */
  resolvePathToDirectoryThatExists(dirPath) {
    return this.resolveDirectoryForWrite(dirPath);
  }

  /**
   * Legacy method for backward compatibility - resolves file for reading
   * @deprecated Use resolveFileForRead instead
   */
  resolvePathToFileThatExists(filePath) {
    return this.resolveFileForRead(filePath);
  }
}

module.exports = PathResolver;
