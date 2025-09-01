/**
 * Test function assertion parsing in pgTAPTestScanner
 */
import { describe, it, expect, beforeEach } from 'vitest';
import pgTAPTestScanner from '../src/lib/testing/pgTAPTestScanner.js';

describe('pgTAPTestScanner Function Assertion Parsing', () => {
  let scanner;

  beforeEach(() => {
    scanner = new pgTAPTestScanner({
      validatePlans: false
    });
  });

  describe('has_function assertion parsing', () => {
    it('should parse has_function with just function name', () => {
      const sql = "SELECT has_function('user_count');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('has_function');
      expect(assertions[0].target).toBe('user_count');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'user_count'
      });
    });

    it('should parse has_function with schema and function name', () => {
      const sql = "SELECT has_function('public', 'user_count');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('has_function');
      expect(assertions[0].target).toBe('public.user_count');
      expect(assertions[0].functionMetadata).toEqual({
        schema: 'public',
        name: 'user_count'
      });
    });

    it('should parse has_function with parameters', () => {
      const sql = "SELECT has_function('user_count', ARRAY['integer', 'text']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('has_function');
      expect(assertions[0].target).toBe('user_count');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'user_count',
        parameters: ['integer', 'text']
      });
    });

    it('should parse has_function with schema, function name and parameters', () => {
      const sql = "SELECT has_function('public', 'user_count', ARRAY['integer', 'text']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('has_function');
      expect(assertions[0].target).toBe('public.user_count');
      expect(assertions[0].functionMetadata).toEqual({
        schema: 'public',
        name: 'user_count',
        parameters: ['integer', 'text']
      });
    });
  });

  describe('function_returns assertion parsing', () => {
    it('should parse function_returns with function name and return type', () => {
      const sql = "SELECT function_returns('user_count', 'integer');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('function_returns');
      expect(assertions[0].target).toBe('user_count');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'user_count',
        returnType: 'integer'
      });
    });

    it('should parse function_returns with schema, function name and return type', () => {
      const sql = "SELECT function_returns('public', 'user_count', 'integer');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('function_returns');
      expect(assertions[0].target).toBe('public.user_count');
      expect(assertions[0].functionMetadata).toEqual({
        schema: 'public',
        name: 'user_count',
        returnType: 'integer'
      });
    });

    it('should parse function_returns with parameters', () => {
      const sql = "SELECT function_returns('user_count', ARRAY['text', 'integer'], 'boolean');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('function_returns');
      expect(assertions[0].target).toBe('user_count');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'user_count',
        parameters: ['text', 'integer'],
        returnType: 'boolean'
      });
    });
  });

  describe('function_lang_is assertion parsing', () => {
    it('should parse function_lang_is', () => {
      const sql = "SELECT function_lang_is('user_count', 'plpgsql');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('function_lang_is');
      expect(assertions[0].target).toBe('user_count');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'user_count',
        language: 'plpgsql'
      });
    });
  });

  describe('is_definer assertion parsing', () => {
    it('should parse is_definer', () => {
      const sql = "SELECT is_definer('secure_function');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('is_definer');
      expect(assertions[0].target).toBe('secure_function');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'secure_function',
        isSecurityDefiner: true
      });
    });

    it('should parse isnt_definer', () => {
      const sql = "SELECT isnt_definer('normal_function');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('isnt_definer');
      expect(assertions[0].target).toBe('normal_function');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'normal_function',
        isSecurityDefiner: false
      });
    });
  });

  describe('volatility_is assertion parsing', () => {
    it('should parse volatility_is', () => {
      const sql = "SELECT volatility_is('pure_function', 'immutable');";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('volatility_is');
      expect(assertions[0].target).toBe('pure_function');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'pure_function',
        volatility: 'immutable'
      });
    });
  });

  describe('function_privs_are assertion parsing', () => {
    it('should parse function_privs_are with basic pattern', () => {
      const sql = "SELECT function_privs_are('calc_func', 'app_user', ARRAY['EXECUTE']);";
      const assertions = scanner.extractAssertions(sql);

      expect(assertions).toHaveLength(1);
      expect(assertions[0].type).toBe('function_privs_are');
      expect(assertions[0].target).toBe('calc_func');
      expect(assertions[0].functionMetadata).toEqual({
        name: 'calc_func',
        role: 'app_user',
        privileges: ['EXECUTE']
      });
    });
  });

  describe('function coverage tracking', () => {
    it('should track function coverage in coverage map', () => {
      const sql = `
        SELECT has_function('public', 'user_count');
        SELECT function_returns('public', 'user_count', 'integer');
        SELECT function_lang_is('public', 'user_count', 'sql');
        SELECT is_definer('public', 'admin_func');
      `;

      const assertions = scanner.extractAssertions(sql);
      expect(assertions).toHaveLength(4);

      // Mock test file structure for coverage map building
      scanner.testFiles = [{
        filePath: '/test/functions.sql',
        fileName: 'functions.sql',
        assertions,
        planCount: 4,
        dependencies: [],
        metadata: {}
      }];

      scanner._buildCoverageMap();

      const coverage = scanner.getCoverageMap();
      expect(coverage.functions).toHaveProperty('public.user_count');
      expect(coverage.functions).toHaveProperty('public.admin_func');
      expect(coverage.functions['public.user_count']).toContain('has_function');
      expect(coverage.functions['public.user_count']).toContain('function_returns');
      expect(coverage.functions['public.user_count']).toContain('function_lang_is');
      expect(coverage.functions['public.admin_func']).toContain('is_definer');
    });
  });
});
