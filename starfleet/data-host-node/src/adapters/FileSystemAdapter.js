/**
 * FileSystemAdapter - Node.js implementation of FileSystemPort
 */
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export const FileSystemAdapter = {
  readFile: (path) => fs.readFile(path, 'utf8'),

  writeFile: (path, data) => fs.writeFile(path, data, 'utf8'),

  exists: async (path) => {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  },

  mkdirp: (path) => fs.mkdir(path, { recursive: true }),

  rm: (path, opts = {}) => {
    const { recursive = false, force = false } = opts;
    return fs.rm(path, { recursive, force });
  },

  readdir: (path) => fs.readdir(path),

  stat: async (path) => {
    const stats = await fs.stat(path);
    return {
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
      size: stats.size
    };
  }
};
