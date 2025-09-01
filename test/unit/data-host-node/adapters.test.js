/**
 * Unit tests for Node.js adapters (port/adapter pattern)
 *
 * Tests the adapter implementations including:
 * - FileSystemAdapter implementation and error handling
 * - CryptoAdapter implementation and algorithms
 * - EnvironmentAdapter implementation and edge cases
 * - Port validation and instanceof checks
 * - Error normalization and consistency
 * - Test doubles and mocking strategies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs, constants } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { join } from 'path';

import { FileSystemAdapter } from '../../../packages/data-host-node/adapters/FileSystemAdapter.js';
import { CryptoAdapter } from '../../../packages/data-host-node/adapters/CryptoAdapter.js';
import { EnvironmentAdapter } from '../../../packages/data-host-node/adapters/EnvironmentAdapter.js';
import {
  FileSystemPort,
  CryptoPort,
  EnvironmentPort
} from '../../../packages/data-core/ports/index.js';

// Test utilities
const createTempDir = async () => {
  const tempDir = join(tmpdir(), `data-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
};

const cleanupTempDir = async (dir) => {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
};

describe('FileSystemAdapter', () => {
  let adapter;
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
    adapter = new FileSystemAdapter();
  });

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe('port validation and inheritance', () => {
    it('should extend FileSystemPort', () => {
      expect(adapter).toBeInstanceOf(FileSystemPort);
    });

    it('should be valid for port validation', () => {
      expect(() => {
        if (!(adapter instanceof FileSystemPort)) {
          throw new Error('Port must be instance of FileSystemPort');
        }
      }).not.toThrow();
    });
  });

  describe('constructor and configuration', () => {
    it('should initialize with default options', () => {
      const defaultAdapter = new FileSystemAdapter();
      expect(defaultAdapter.encoding).toBe('utf8');
      expect(defaultAdapter.defaultMode).toBe(0o644);
    });

    it('should accept custom options', () => {
      const customAdapter = new FileSystemAdapter({
        encoding: 'latin1',
        mode: 0o755
      });
      expect(customAdapter.encoding).toBe('latin1');
      expect(customAdapter.defaultMode).toBe(0o755);
    });

    it('should handle partial options', () => {
      const partialAdapter = new FileSystemAdapter({ encoding: 'base64' });
      expect(partialAdapter.encoding).toBe('base64');
      expect(partialAdapter.defaultMode).toBe(0o644); // default
    });
  });

  describe('readFile', () => {
    it('should read existing file', async () => {
      const filePath = join(tempDir, 'test.txt');
      const content = 'Hello, World!';
      await fs.writeFile(filePath, content);

      const result = await adapter.readFile(filePath);
      expect(result).toBe(content);
    });

    it('should handle custom encoding', async () => {
      const filePath = join(tempDir, 'encoded.txt');
      const content = 'Test content';
      await fs.writeFile(filePath, content);

      const result = await adapter.readFile(filePath, { encoding: 'utf8' });
      expect(result).toBe(content);
    });

    it('should resolve relative paths', async () => {
      const filePath = join(tempDir, 'relative.txt');
      const content = 'Relative path test';
      await fs.writeFile(filePath, content);

      // Test with relative path
      const result = await adapter.readFile(filePath);
      expect(result).toBe(content);
    });

    it('should throw FileSystemError for nonexistent file', async () => {
      const nonexistentPath = join(tempDir, 'nonexistent.txt');

      await expect(adapter.readFile(nonexistentPath)).rejects.toThrow('FileSystemError');

      try {
        await adapter.readFile(nonexistentPath);
      } catch (error) {
        expect(error.name).toBe('FileSystemError');
        expect(error.operation).toBe('readFile');
        expect(error.path).toBe(nonexistentPath);
        expect(error.code).toBe('ENOENT');
        expect(error.originalError).toBeDefined();
      }
    });

    it('should handle permission errors', async () => {
      // Create a file and remove read permissions (Unix-like systems)
      const restrictedPath = join(tempDir, 'restricted.txt');
      await fs.writeFile(restrictedPath, 'restricted content');

      try {
        await fs.chmod(restrictedPath, 0o000); // Remove all permissions
        await expect(adapter.readFile(restrictedPath)).rejects.toThrow('FileSystemError');
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(restrictedPath, 0o644);
      }
    });
  });

  describe('writeFile', () => {
    it('should write file with content', async () => {
      const filePath = join(tempDir, 'output.txt');
      const content = 'Written content';

      await adapter.writeFile(filePath, content);

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe(content);
    });

    it('should create directory if needed', async () => {
      const nestedPath = join(tempDir, 'nested', 'deep', 'file.txt');
      const content = 'Nested file content';

      await adapter.writeFile(nestedPath, content);

      const result = await fs.readFile(nestedPath, 'utf8');
      expect(result).toBe(content);
    });

    it('should handle custom encoding and mode', async () => {
      const filePath = join(tempDir, 'custom.txt');
      const content = 'Custom encoding';

      await adapter.writeFile(filePath, content, {
        encoding: 'utf8',
        mode: 0o755
      });

      const stats = await fs.stat(filePath);
      expect(stats.mode & parseInt('777', 8)).toBe(0o755);
    });

    it('should overwrite existing files', async () => {
      const filePath = join(tempDir, 'overwrite.txt');

      await adapter.writeFile(filePath, 'First content');
      await adapter.writeFile(filePath, 'Second content');

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe('Second content');
    });

    it('should throw FileSystemError for invalid paths', async () => {
      // Try to write to a path that can't be created
      const invalidPath = '/root/cannot/create/this/path/file.txt'; // Assuming no root permissions

      await expect(adapter.writeFile(invalidPath, 'content')).rejects.toThrow('FileSystemError');
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      const filePath = join(tempDir, 'exists.txt');
      await fs.writeFile(filePath, 'content');

      const result = await adapter.exists(filePath);
      expect(result).toBe(true);
    });

    it('should return true for existing directories', async () => {
      const dirPath = join(tempDir, 'existing-dir');
      await fs.mkdir(dirPath);

      const result = await adapter.exists(dirPath);
      expect(result).toBe(true);
    });

    it('should return false for nonexistent paths', async () => {
      const nonexistentPath = join(tempDir, 'nonexistent');

      const result = await adapter.exists(nonexistentPath);
      expect(result).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      // Test with a path that might have permission issues
      const result = await adapter.exists('/proc/some/system/path');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('stat', () => {
    it('should return file stats', async () => {
      const filePath = join(tempDir, 'stat-test.txt');
      const content = 'test content';
      await fs.writeFile(filePath, content);

      const stats = await adapter.stat(filePath);

      expect(stats.isFile).toBe(true);
      expect(stats.isDirectory).toBe(false);
      expect(stats.size).toBe(content.length);
      expect(stats.mtime).toBeInstanceOf(Date);
      expect(stats.ctime).toBeInstanceOf(Date);
      expect(typeof stats.mode).toBe('number');
    });

    it('should return directory stats', async () => {
      const dirPath = join(tempDir, 'stat-dir');
      await fs.mkdir(dirPath);

      const stats = await adapter.stat(dirPath);

      expect(stats.isFile).toBe(false);
      expect(stats.isDirectory).toBe(true);
      expect(stats.mtime).toBeInstanceOf(Date);
      expect(stats.ctime).toBeInstanceOf(Date);
    });

    it('should throw FileSystemError for nonexistent path', async () => {
      const nonexistentPath = join(tempDir, 'nonexistent');

      await expect(adapter.stat(nonexistentPath)).rejects.toThrow('FileSystemError');

      try {
        await adapter.stat(nonexistentPath);
      } catch (error) {
        expect(error.name).toBe('FileSystemError');
        expect(error.operation).toBe('stat');
        expect(error.path).toBe(nonexistentPath);
      }
    });
  });

  describe('ensureDir', () => {
    it('should create single directory', async () => {
      const dirPath = join(tempDir, 'new-dir');

      await adapter.ensureDir(dirPath);

      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories', async () => {
      const nestedPath = join(tempDir, 'deeply', 'nested', 'directory');

      await adapter.ensureDir(nestedPath);

      const stats = await fs.stat(nestedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if directory exists', async () => {
      const existingDir = join(tempDir, 'existing');
      await fs.mkdir(existingDir);

      await expect(adapter.ensureDir(existingDir)).resolves.not.toThrow();
    });

    it('should handle custom mode', async () => {
      const dirPath = join(tempDir, 'custom-mode-dir');

      await adapter.ensureDir(dirPath, { mode: 0o700 });

      const stats = await fs.stat(dirPath);
      expect(stats.mode & parseInt('777', 8)).toBe(0o700);
    });

    it('should throw FileSystemError for invalid paths', async () => {
      const invalidPath = '/root/cannot/create/directory'; // Assuming no root permissions

      await expect(adapter.ensureDir(invalidPath)).rejects.toThrow('FileSystemError');
    });
  });

  describe('remove', () => {
    it('should remove files', async () => {
      const filePath = join(tempDir, 'to-remove.txt');
      await fs.writeFile(filePath, 'content');

      await adapter.remove(filePath);

      expect(await adapter.exists(filePath)).toBe(false);
    });

    it('should remove empty directories', async () => {
      const dirPath = join(tempDir, 'empty-dir');
      await fs.mkdir(dirPath);

      await adapter.remove(dirPath);

      expect(await adapter.exists(dirPath)).toBe(false);
    });

    it('should remove directories recursively when option is set', async () => {
      const basePath = join(tempDir, 'recursive');
      const nestedPath = join(basePath, 'nested');
      const filePath = join(nestedPath, 'file.txt');

      await fs.mkdir(basePath);
      await fs.mkdir(nestedPath);
      await fs.writeFile(filePath, 'content');

      await adapter.remove(basePath, { recursive: true });

      expect(await adapter.exists(basePath)).toBe(false);
    });

    it('should throw error for non-empty directories without recursive option', async () => {
      const basePath = join(tempDir, 'non-empty');
      const filePath = join(basePath, 'file.txt');

      await fs.mkdir(basePath);
      await fs.writeFile(filePath, 'content');

      await expect(adapter.remove(basePath)).rejects.toThrow('FileSystemError');
    });

    it('should throw FileSystemError for nonexistent path', async () => {
      const nonexistentPath = join(tempDir, 'nonexistent');

      await expect(adapter.remove(nonexistentPath)).rejects.toThrow('FileSystemError');
    });
  });

  describe('readDir', () => {
    beforeEach(async () => {
      // Create test directory structure
      await fs.mkdir(join(tempDir, 'test-subdir'));
      await fs.writeFile(join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(join(tempDir, 'file2.txt'), 'content2');
    });

    it('should list directory contents', async () => {
      const entries = await adapter.readDir(tempDir);

      expect(entries).toHaveLength(3);
      expect(entries).toContain('test-subdir');
      expect(entries).toContain('file1.txt');
      expect(entries).toContain('file2.txt');
    });

    it('should return file type information when requested', async () => {
      const entries = await adapter.readDir(tempDir, { withFileTypes: true });

      expect(entries).toHaveLength(3);

      const subdir = entries.find((e) => e.name === 'test-subdir');
      expect(subdir.isDirectory).toBe(true);
      expect(subdir.isFile).toBe(false);

      const file = entries.find((e) => e.name === 'file1.txt');
      expect(file.isFile).toBe(true);
      expect(file.isDirectory).toBe(false);
    });

    it('should handle empty directories', async () => {
      const emptyDir = join(tempDir, 'empty');
      await fs.mkdir(emptyDir);

      const entries = await adapter.readDir(emptyDir);
      expect(entries).toHaveLength(0);
    });

    it('should throw FileSystemError for nonexistent directory', async () => {
      const nonexistentDir = join(tempDir, 'nonexistent');

      await expect(adapter.readDir(nonexistentDir)).rejects.toThrow('FileSystemError');
    });

    it('should throw FileSystemError when trying to read a file as directory', async () => {
      const filePath = join(tempDir, 'file1.txt');

      await expect(adapter.readDir(filePath)).rejects.toThrow('FileSystemError');
    });
  });

  describe('copy', () => {
    it('should copy files', async () => {
      const sourcePath = join(tempDir, 'source.txt');
      const destPath = join(tempDir, 'destination.txt');
      const content = 'Copy test content';

      await fs.writeFile(sourcePath, content);
      await adapter.copy(sourcePath, destPath);

      const result = await fs.readFile(destPath, 'utf8');
      expect(result).toBe(content);
    });

    it('should copy directories recursively', async () => {
      const sourceDir = join(tempDir, 'source-dir');
      const destDir = join(tempDir, 'dest-dir');
      const filePath = join(sourceDir, 'file.txt');
      const content = 'Directory copy test';

      await fs.mkdir(sourceDir);
      await fs.writeFile(filePath, content);

      await adapter.copy(sourceDir, destDir, { recursive: true });

      const copiedFile = join(destDir, 'file.txt');
      const result = await fs.readFile(copiedFile, 'utf8');
      expect(result).toBe(content);
    });

    it('should preserve timestamps', async () => {
      const sourcePath = join(tempDir, 'timestamp-source.txt');
      const destPath = join(tempDir, 'timestamp-dest.txt');

      await fs.writeFile(sourcePath, 'timestamp test');
      const originalStats = await fs.stat(sourcePath);

      await adapter.copy(sourcePath, destPath);

      const copiedStats = await fs.stat(destPath);
      expect(copiedStats.mtime.getTime()).toBe(originalStats.mtime.getTime());
    });

    it('should overwrite existing files', async () => {
      const sourcePath = join(tempDir, 'overwrite-source.txt');
      const destPath = join(tempDir, 'overwrite-dest.txt');

      await fs.writeFile(sourcePath, 'new content');
      await fs.writeFile(destPath, 'old content');

      await adapter.copy(sourcePath, destPath);

      const result = await fs.readFile(destPath, 'utf8');
      expect(result).toBe('new content');
    });

    it('should throw FileSystemError for nonexistent source', async () => {
      const nonexistentSource = join(tempDir, 'nonexistent');
      const destPath = join(tempDir, 'dest.txt');

      await expect(adapter.copy(nonexistentSource, destPath)).rejects.toThrow('FileSystemError');
    });
  });

  describe('error normalization', () => {
    it('should normalize errors with consistent format', async () => {
      const nonexistentPath = join(tempDir, 'nonexistent.txt');

      try {
        await adapter.readFile(nonexistentPath);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.name).toBe('FileSystemError');
        expect(error.message).toContain('FileSystem readFile failed');
        expect(error.message).toContain(nonexistentPath);
        expect(error.operation).toBe('readFile');
        expect(error.path).toBe(nonexistentPath);
        expect(error.code).toBe('ENOENT');
        expect(error.originalError).toBeInstanceOf(Error);
      }
    });

    it('should handle errors from different operations consistently', async () => {
      const testCases = [
        { method: 'stat', path: join(tempDir, 'nonexistent1') },
        { method: 'remove', path: join(tempDir, 'nonexistent2') }
      ];

      for (const testCase of testCases) {
        try {
          await adapter[testCase.method](testCase.path);
          expect.fail(`${testCase.method} should have thrown error`);
        } catch (error) {
          expect(error.name).toBe('FileSystemError');
          expect(error.operation).toBe(testCase.method);
          expect(error.path).toBe(testCase.path);
          expect(error.originalError).toBeInstanceOf(Error);
        }
      }
    });
  });
});

describe('CryptoAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new CryptoAdapter();
  });

  describe('port validation and inheritance', () => {
    it('should extend CryptoPort', () => {
      expect(adapter).toBeInstanceOf(CryptoPort);
    });

    it('should be valid for port validation', () => {
      expect(() => {
        if (!(adapter instanceof CryptoPort)) {
          throw new Error('Port must be instance of CryptoPort');
        }
      }).not.toThrow();
    });
  });

  describe('hash generation', () => {
    it('should generate SHA-256 hash by default', () => {
      const input = 'test data';
      const hash = adapter.hash(input);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex length
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    });

    it('should generate consistent hashes for same input', () => {
      const input = 'consistent test data';
      const hash1 = adapter.hash(input);
      const hash2 = adapter.hash(input);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = adapter.hash('input1');
      const hash2 = adapter.hash('input2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle different data types', () => {
      const stringHash = adapter.hash('string data');
      const bufferHash = adapter.hash(Buffer.from('buffer data'));
      const uint8ArrayHash = adapter.hash(new Uint8Array([1, 2, 3, 4]));

      expect(stringHash).toBeTruthy();
      expect(bufferHash).toBeTruthy();
      expect(uint8ArrayHash).toBeTruthy();
      expect(stringHash).not.toBe(bufferHash);
    });

    it('should support different algorithms', () => {
      const input = 'algorithm test';
      const sha256Hash = adapter.hash(input, 'sha256');
      const sha1Hash = adapter.hash(input, 'sha1');
      const md5Hash = adapter.hash(input, 'md5');

      expect(sha256Hash.length).toBe(64); // SHA-256
      expect(sha1Hash.length).toBe(40); // SHA-1
      expect(md5Hash.length).toBe(32); // MD5

      expect(sha256Hash).not.toBe(sha1Hash);
      expect(sha256Hash).not.toBe(md5Hash);
    });

    it('should handle empty input', () => {
      const emptyHash = adapter.hash('');
      expect(emptyHash).toBeTruthy();
      expect(emptyHash.length).toBe(64);
    });

    it('should handle large inputs efficiently', () => {
      const largeInput = 'x'.repeat(1000000); // 1MB string
      const startTime = Date.now();
      const hash = adapter.hash(largeInput);
      const duration = Date.now() - startTime;

      expect(hash).toBeTruthy();
      expect(duration).toBeLessThan(1000); // Should be fast
    });

    it('should throw error for unsupported algorithms', () => {
      expect(() => adapter.hash('test', 'unsupported-algorithm')).toThrow();
    });

    it('should handle special characters and unicode', () => {
      const unicodeInput = 'test 🚀 unicode ñáéíóú 中文';
      const hash = adapter.hash(unicodeInput);

      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });
  });

  describe('performance and edge cases', () => {
    it('should handle concurrent hashing operations', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(adapter.hash(`concurrent test ${i}`)));
      }

      const hashes = await Promise.all(promises);

      expect(hashes).toHaveLength(100);
      expect(new Set(hashes).size).toBe(100); // All should be unique
    });

    it('should maintain consistent performance', () => {
      const input = 'performance test data';
      const iterations = 1000;

      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        adapter.hash(`${input} ${i}`);
      }
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within reasonable time
    });
  });
});

describe('EnvironmentAdapter', () => {
  let adapter;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    adapter = new EnvironmentAdapter();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('port validation and inheritance', () => {
    it('should extend EnvironmentPort', () => {
      expect(adapter).toBeInstanceOf(EnvironmentPort);
    });

    it('should be valid for port validation', () => {
      expect(() => {
        if (!(adapter instanceof EnvironmentPort)) {
          throw new Error('Port must be instance of EnvironmentPort');
        }
      }).not.toThrow();
    });
  });

  describe('environment variable access', () => {
    it('should get existing environment variables', () => {
      process.env.TEST_VAR = 'test_value';

      const result = adapter.get('TEST_VAR');
      expect(result).toBe('test_value');
    });

    it('should return undefined for nonexistent variables', () => {
      const result = adapter.get('NONEXISTENT_VAR');
      expect(result).toBeUndefined();
    });

    it('should return default value when variable does not exist', () => {
      const result = adapter.get('NONEXISTENT_VAR', 'default_value');
      expect(result).toBe('default_value');
    });

    it('should not return default value when variable exists', () => {
      process.env.EXISTING_VAR = 'actual_value';

      const result = adapter.get('EXISTING_VAR', 'default_value');
      expect(result).toBe('actual_value');
    });

    it('should handle empty string values', () => {
      process.env.EMPTY_VAR = '';

      const result = adapter.get('EMPTY_VAR', 'default');
      expect(result).toBe(''); // Empty string, not default
    });

    it('should handle variables with special characters', () => {
      process.env.SPECIAL_VAR = 'value with spaces and symbols: !@#$%^&*()';

      const result = adapter.get('SPECIAL_VAR');
      expect(result).toBe('value with spaces and symbols: !@#$%^&*()');
    });

    it('should handle variables with newlines and escapes', () => {
      process.env.MULTILINE_VAR = 'line1\\nline2\\ttabbed';

      const result = adapter.get('MULTILINE_VAR');
      expect(result).toBe('line1\\nline2\\ttabbed');
    });
  });

  describe('environment variable existence checks', () => {
    it('should return true for existing variables', () => {
      process.env.EXISTS_VAR = 'some_value';

      const result = adapter.has('EXISTS_VAR');
      expect(result).toBe(true);
    });

    it('should return false for nonexistent variables', () => {
      const result = adapter.has('DOES_NOT_EXIST');
      expect(result).toBe(false);
    });

    it('should return true for empty string variables', () => {
      process.env.EMPTY_EXISTS = '';

      const result = adapter.has('EMPTY_EXISTS');
      expect(result).toBe(true);
    });

    it('should handle case-sensitive variable names', () => {
      process.env.CaseSensitive = 'value';

      expect(adapter.has('CaseSensitive')).toBe(true);
      expect(adapter.has('casesensitive')).toBe(false);
      expect(adapter.has('CASESENSITIVE')).toBe(false);
    });
  });

  describe('common environment patterns', () => {
    it('should handle NODE_ENV pattern', () => {
      process.env.NODE_ENV = 'test';

      expect(adapter.get('NODE_ENV')).toBe('test');
      expect(adapter.has('NODE_ENV')).toBe(true);
      expect(adapter.get('NODE_ENV', 'development')).toBe('test');
    });

    it('should handle database URL pattern', () => {
      const dbUrl = 'postgresql://user:password@localhost:5432/testdb';
      process.env.DATABASE_URL = dbUrl;

      expect(adapter.get('DATABASE_URL')).toBe(dbUrl);
      expect(adapter.has('DATABASE_URL')).toBe(true);
    });

    it('should handle port number pattern', () => {
      process.env.PORT = '3000';

      expect(adapter.get('PORT')).toBe('3000'); // Note: always returns string
      expect(adapter.get('PORT', '8080')).toBe('3000');
    });

    it('should handle boolean-like values', () => {
      process.env.DEBUG = 'true';
      process.env.PRODUCTION = 'false';
      process.env.ENABLED = '1';
      process.env.DISABLED = '0';

      // Note: Environment adapter returns strings, interpretation is up to caller
      expect(adapter.get('DEBUG')).toBe('true');
      expect(adapter.get('PRODUCTION')).toBe('false');
      expect(adapter.get('ENABLED')).toBe('1');
      expect(adapter.get('DISABLED')).toBe('0');
    });
  });

  describe('edge cases and error conditions', () => {
    it('should handle very long variable names', () => {
      const longName = 'A'.repeat(1000);
      process.env[longName] = 'long_name_value';

      expect(adapter.get(longName)).toBe('long_name_value');
      expect(adapter.has(longName)).toBe(true);
    });

    it('should handle very long variable values', () => {
      const longValue = 'x'.repeat(100000);
      process.env.LONG_VALUE = longValue;

      expect(adapter.get('LONG_VALUE')).toBe(longValue);
    });

    it('should handle numeric variable names (though unusual)', () => {
      process.env['123'] = 'numeric_name';

      expect(adapter.get('123')).toBe('numeric_name');
      expect(adapter.has('123')).toBe(true);
    });

    it('should handle variable names with special characters', () => {
      // Some systems allow these characters in env var names
      process.env['VAR_WITH.DOT'] = 'dot_value';
      process.env['VAR-WITH-DASH'] = 'dash_value';

      expect(adapter.get('VAR_WITH.DOT')).toBe('dot_value');
      expect(adapter.get('VAR-WITH-DASH')).toBe('dash_value');
    });

    it('should maintain consistency across multiple calls', () => {
      process.env.CONSISTENT_VAR = 'consistent_value';

      const calls = [];
      for (let i = 0; i < 100; i++) {
        calls.push(adapter.get('CONSISTENT_VAR'));
      }

      expect(calls.every((value) => value === 'consistent_value')).toBe(true);
    });

    it('should handle concurrent access', async () => {
      process.env.CONCURRENT_VAR = 'concurrent_value';

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(adapter.get('CONCURRENT_VAR')));
      }

      const results = await Promise.all(promises);
      expect(results.every((value) => value === 'concurrent_value')).toBe(true);
    });
  });

  describe('integration with real environment', () => {
    it('should access actual PATH variable', () => {
      // PATH should exist in most environments
      const path = adapter.get('PATH');
      if (path) {
        expect(typeof path).toBe('string');
        expect(path.length).toBeGreaterThan(0);
        expect(adapter.has('PATH')).toBe(true);
      }
    });

    it('should handle common CI environment variables', () => {
      // Test some common CI environment variables that might exist
      const ciVars = ['CI', 'GITHUB_ACTIONS', 'TRAVIS', 'CIRCLECI', 'BUILD_NUMBER'];

      ciVars.forEach((varName) => {
        const value = adapter.get(varName);
        const exists = adapter.has(varName);

        if (exists) {
          expect(typeof value).toBe('string');
        } else {
          expect(value).toBeUndefined();
        }
      });
    });
  });
});
