/**
 * GitPortNodeAdapter - Node.js git command implementation of GitPort
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export class GitPortNodeAdapter {
  async status() {
    const [statusResult, branchResult, remoteResult] = await Promise.all([
      exec('git', ['status', '--porcelain']),
      exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
      exec('git', ['rev-list', '--left-right', '--count', 'HEAD...@{u}']).catch(() => ({ stdout: '0\t0' }))
    ]);

    const statusLines = statusResult.stdout.trim().split('\n').filter(Boolean);
    const modified = [];
    const untracked = [];
    
    for (const line of statusLines) {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      if (status === '??') {
        untracked.push(file);
      } else {
        modified.push(file);
      }
    }

    const [behind, ahead] = remoteResult.stdout.trim().split('\t').map(Number);

    return {
      clean: statusLines.length === 0,
      branch: branchResult.stdout.trim(),
      behind,
      ahead,
      modified,
      untracked
    };
  }

  async tag(name, message) {
    const args = ['tag', '-a', name, '-m', message || name];
    await exec('git', args);
  }

  async latestTag(prefix) {
    try {
      const { stdout } = await exec('git', [
        'tag', 
        '--list', 
        `${prefix}*`, 
        '--sort', 
        '-version:refname'
      ]);
      const tags = stdout.trim().split('\n').filter(Boolean);
      return tags[0] || null;
    } catch {
      return null;
    }
  }

  async revParse(ref) {
    const { stdout } = await exec('git', ['rev-parse', ref]);
    return stdout.trim();
  }
}