/**
 * GlobAdapter - Node.js implementation of GlobPort using globby
 */
import { globby } from 'globby';

export const GlobAdapter = {
  find: (patterns, opts = {}) => {
    const { cwd, ignore, dot = false } = opts;
    return globby(patterns, { cwd, ignore, dot });
  }
};