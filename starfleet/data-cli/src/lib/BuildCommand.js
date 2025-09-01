/**
 * @fileoverview BuildCommand - Base class for compilation/build operations
 *
 * Commands that transform or compile files without database interaction.
 * Provides path resolution and file handling utilities with event-driven
 * progress tracking for build operations.
 *
 * @module BuildCommand
 * @requires Command
 * @requires PathResolver
 * @since 1.0.0
 */

import Command from './Command.js';
import PathResolver from './PathResolver.js';
import {
  BuildProgressEvent,
  BuildStartEvent,
  BuildCompleteEvent,
  BuildFailedEvent
} from './events/CommandEvents.js';

/**
 * BuildCommand - Base class for compilation/build operations
 *
 * Commands that transform or compile files without database interaction.
 * Provides path resolution and file handling utilities.
 */
class BuildCommand extends Command {
  /**
   * Create a BuildCommand instance
   * @param {string} inputDir - Input directory path
   * @param {string} outputDir - Output directory path
   * @param {Object} logger - Logger instance (optional)
   * @param {boolean} isProd - Whether running in production mode
   * @param {PathResolver} pathResolver - Optional PathResolver instance
   */
  constructor(
    inputDir,
    outputDir,
    logger = null,
    isProd = false,
    pathResolver = null
  ) {
    // Call parent with minimal config
    super(null, logger, isProd, null);

    // Store paths
    this.inputDir = inputDir;
    this.outputDir = outputDir;

    // Path resolver for ensuring directories exist
    this.pathResolver = pathResolver || new PathResolver();

    // Build operations typically don't need production confirmation
    this.requiresProductionConfirmation = false;
  }

  /**
   * Ensure input directory exists and is readable
   * @returns {Promise<string>} Resolved input directory path
   */
  getInputDir() {
    return this.pathResolver.resolveDirectoryForRead(this.inputDir);
  }

  /**
   * Ensure output directory exists and is writable
   * @returns {Promise<string>} Resolved output directory path
   */
  getOutputDir() {
    return this.pathResolver.resolveDirectoryForWrite(this.outputDir);
  }

  /**
   * Get a specific input file path
   * @param {string} filename - The filename relative to input dir
   * @returns {Promise<string>} Resolved file path
   */
  async getInputFile(filename) {
    const { join } = await import('path');
    const dir = await this.getInputDir();
    return this.pathResolver.resolveFileForRead(join(dir, filename));
  }

  /**
   * Get a specific output file path
   * @param {string} filename - The filename relative to output dir
   * @returns {Promise<string>} Resolved file path
   */
  async getOutputFile(filename) {
    const { join } = await import('path');
    const dir = await this.getOutputDir();
    return this.pathResolver.resolveFileForWrite(join(dir, filename));
  }

  /**
   * List files in input directory
   * @param {string} pattern - Glob pattern (optional)
   * @returns {Promise<string[]>} List of file paths
   */
  async listInputFiles(pattern = '*') {
    const { glob } = await import('glob');
    const { join } = await import('path');
    const dir = await this.getInputDir();

    const files = await glob(join(dir, pattern));
    return files;
  }

  /**
   * Read a file from input directory
   * @param {string} filename - The filename to read
   * @returns {Promise<string>} File contents
   */
  async readInputFile(filename) {
    const fs = await import('fs/promises');
    const filePath = await this.getInputFile(filename);
    return fs.readFile(filePath, 'utf8');
  }

  /**
   * Write a file to output directory
   * @param {string} filename - The filename to write
   * @param {string} content - The content to write
   * @returns {Promise<void>}
   */
  async writeOutputFile(filename, content) {
    const fs = await import('fs/promises');
    const filePath = await this.getOutputFile(filename);
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Emit build progress events
   * @param {string} stage - Current build stage
   * @param {Object} details - Additional event details
   */
  emitBuildProgress(stage, details = {}) {
    const event = new BuildProgressEvent(stage, this.inputDir, this.outputDir, details);
    this.emit('build:progress', event.toEventData());
  }

  /**
   * Emit build start event
   * @param {string} type - Type of build operation
   * @param {Object} details - Additional event details
   */
  emitBuildStart(type, details = {}) {
    const event = new BuildStartEvent(type, this.inputDir, this.outputDir, details);
    this.emit('build:start', event.toEventData());
  }

  /**
   * Emit build complete event
   * @param {Object} result - Build result details
   * @param {Object} details - Additional event details
   */
  emitBuildComplete(result, details = {}) {
    const event = new BuildCompleteEvent(result, details);
    this.emit('build:complete', event.toEventData());
  }

  /**
   * Emit build failure event
   * @param {Error} error - The error that caused the build to fail
   * @param {Object} details - Additional event details
   */
  emitBuildFailed(error, details = {}) {
    const event = new BuildFailedEvent(error, details);
    this.emit('build:failed', event.toEventData());
  }
}

export { BuildCommand };
export default BuildCommand;
