/**
 * End-to-End Integration Tests for Test Coverage Enforcement System
 * 
 * These tests verify the complete workflow from migration analysis through
 * coverage checking to deployment blocking, ensuring all components work
 * together correctly.
 */

const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const MigrationOrchestrator = require('../../src/lib/migration/MigrationOrchestrator');
const TestCoverageOrchestrator = require('../../src/lib/testing/TestCoverageOrchestrator');
const TestRequirementAnalyzer = require('../../src/lib/testing/TestRequirementAnalyzer');
const pgTAPTestScanner = require('../../src/lib/testing/pgTAPTestScanner');
const TestTemplateGenerator = require('../../src/lib/testing/TestTemplateGenerator');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Test Coverage Enforcement - End-to-End Integration', () => {
  let tempDir;
  let orchestrator;
  let coverageOrchestrator;
  
  beforeEach(async () => {
    // Create temp directory structure for testing
    tempDir = path.join(os.tmpdir(), `data-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(path.join(tempDir, 'sql'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'migrations'), { recursive: true });
    
    // Initialize orchestrators with test configuration
    orchestrator = new MigrationOrchestrator({
      sqlDir: path.join(tempDir, 'sql'),
      testsDir: path.join(tempDir, 'tests'),
      migrationsDir: path.join(tempDir, 'migrations'),
      skipTests: true, // Skip unit tests, focus on coverage
      skipCoverage: false,
      coverageEnforcementLevel: 'strict',
      coverageBypassReason: null,
      isProd: false
    });
    
    coverageOrchestrator = new TestCoverageOrchestrator({
      testsDir: path.join(tempDir, 'tests'),
      sqlDir: path.join(tempDir, 'sql'),
      enforcementLevel: 'strict',
      generateTemplates: true
    });
  });
  
  afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Deployment Blocking with Critical Issues Fixed', () => {
    it('should block deployment when coverage is insufficient', async () => {
      // Create SQL changes without tests
      await fs.writeFile(
        path.join(tempDir, 'sql', 'tables.sql'),
        `
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX idx_users_email ON users(email);
        
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY users_select_own ON users 
          FOR SELECT 
          USING (auth.uid() = id);
        `
      );
      
      // Create insufficient test coverage (missing RLS and index tests)
      await fs.writeFile(
        path.join(tempDir, 'tests', 'users.test.sql'),
        `
        BEGIN;
        SELECT plan(3);
        
        SELECT has_table('public', 'users');
        SELECT has_column('users', 'id');
        SELECT has_column('users', 'email');
        
        SELECT finish();
        ROLLBACK;
        `
      );
      
      // Mock the migration operations that would come from AST analysis
      const operations = [
        {
          sql: 'CREATE TABLE users...',
          type: 'SAFE',
          description: 'Create users table'
        },
        {
          sql: 'CREATE INDEX idx_users_email...',
          type: 'SAFE',
          description: 'Create email index'
        },
        {
          sql: 'CREATE POLICY users_select_own...',
          type: 'WARNING',
          description: 'Create RLS policy'
        }
      ];
      
      // Test that coverage check fails
      const result = await coverageOrchestrator.checkCoverage(operations);
      
      expect(result.passed).toBe(false);
      expect(result.gaps).toHaveLength(3); // Missing index, RLS, and policy tests
      expect(result.coveragePercentage).toBeLessThan(50);
      
      // Verify deployment would be blocked
      await expect(orchestrator.checkTestCoverage(operations))
        .rejects.toThrow(/Test coverage requirements not met/);
    });
    
    it('should allow deployment when coverage is sufficient', async () => {
      // Create SQL changes
      await fs.writeFile(
        path.join(tempDir, 'sql', 'simple.sql'),
        `
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL
        );
        `
      );
      
      // Create comprehensive test coverage
      await fs.writeFile(
        path.join(tempDir, 'tests', 'posts.test.sql'),
        `
        BEGIN;
        SELECT plan(5);
        
        SELECT has_table('public', 'posts');
        SELECT has_column('posts', 'id');
        SELECT has_column('posts', 'title');
        SELECT col_type_is('posts', 'id', 'integer');
        SELECT col_not_null('posts', 'title');
        
        SELECT finish();
        ROLLBACK;
        `
      );
      
      const operations = [
        {
          sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, title TEXT NOT NULL);',
          type: 'SAFE',
          description: 'Create posts table'
        }
      ];
      
      const result = await coverageOrchestrator.checkCoverage(operations);
      
      expect(result.passed).toBe(true);
      expect(result.gaps).toHaveLength(0);
      expect(result.coveragePercentage).toBeGreaterThan(80);
    });
  });
  
  describe('Coverage Bypass Mechanism with Fix', () => {
    it('should require explicit bypass reason for technical failures', async () => {
      // Simulate a technical failure in coverage checking
      const brokenOrchestrator = new MigrationOrchestrator({
        sqlDir: path.join(tempDir, 'sql'),
        testsDir: '/nonexistent/path', // This will cause scanner to fail
        coverageEnforcementLevel: 'strict',
        coverageBypassReason: null, // No bypass reason
        isProd: false
      });
      
      const operations = [{ sql: 'CREATE TABLE test();', type: 'SAFE' }];
      
      // After our fix, this should throw instead of silently passing
      await expect(brokenOrchestrator.checkTestCoverage(operations))
        .rejects.toThrow(/Use --coverage-bypass-reason/);
    });
    
    it('should allow bypass with explicit reason', async () => {
      const bypassOrchestrator = new MigrationOrchestrator({
        sqlDir: path.join(tempDir, 'sql'),
        testsDir: '/nonexistent/path',
        coverageEnforcementLevel: 'strict',
        coverageBypassReason: 'Emergency hotfix #123',
        isProd: false
      });
      
      const operations = [{ sql: 'CREATE TABLE test();', type: 'SAFE' }];
      
      const result = await bypassOrchestrator.checkTestCoverage(operations);
      
      expect(result.passed).toBe(true);
      expect(result.bypassReason).toBe('Emergency hotfix #123');
      expect(result.technicalFailure).toBe(true);
    });
  });
  
  describe('AST Operation Validation with Fix', () => {
    it('should validate operation structure before processing', async () => {
      const analyzer = new TestRequirementAnalyzer();
      
      // Test with invalid operation (missing sql property)
      const invalidOp = { type: 'SAFE' };
      
      await expect(analyzer.determineTestRequirements(invalidOp))
        .rejects.toThrow(/missing or invalid 'sql' property/);
      
      // Test with valid operation
      const validOp = {
        sql: 'CREATE TABLE users (id INT);',
        type: 'SAFE',
        description: 'Create users table'
      };
      
      const requirements = await analyzer.determineTestRequirements(validOp);
      expect(requirements).toBeInstanceOf(Array);
    });
    
    it('should handle malformed SQL gracefully', async () => {
      const analyzer = new TestRequirementAnalyzer();
      
      // Test with empty SQL
      const emptyOp = { sql: '', type: 'SAFE' };
      await expect(analyzer.determineTestRequirements(emptyOp))
        .rejects.toThrow(/SQL cannot be empty/);
      
      // Test with oversized SQL
      const hugeOp = { 
        sql: 'A'.repeat(100001), 
        type: 'SAFE' 
      };
      await expect(analyzer.determineTestRequirements(hugeOp))
        .rejects.toThrow(/SQL exceeds maximum length/);
    });
  });
  
  describe('Memory Management with Fix', () => {
    it('should handle large test suites without OOM', async () => {
      // Create many test files
      const testCount = 100;
      for (let i = 0; i < testCount; i++) {
        await fs.writeFile(
          path.join(tempDir, 'tests', `test_${i}.sql`),
          `
          BEGIN;
          SELECT plan(3);
          SELECT has_table('table_${i}');
          SELECT has_column('table_${i}', 'id');
          SELECT has_column('table_${i}', 'name');
          SELECT finish();
          ROLLBACK;
          `
        );
      }
      
      // Scanner with memory limits
      const scanner = new pgTAPTestScanner({
        maxMemoryMB: 50, // Low memory limit to test management
        enableStreaming: true,
        batchSize: 10
      });
      
      let memoryWarningEmitted = false;
      scanner.on('memory_warning', () => {
        memoryWarningEmitted = true;
      });
      
      // Should complete without throwing OOM
      const database = await scanner.buildCoverageDatabase();
      
      expect(database).toBeDefined();
      expect(scanner.statistics.filesScanned).toBe(testCount);
      
      // Verify memory management kicked in if needed
      if (memoryWarningEmitted) {
        expect(scanner.statistics.memoryWarnings).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Coverage Key Generation with Fix', () => {
    it('should handle edge cases in coverage keys', async () => {
      const enforcer = require('../../src/lib/testing/CoverageEnforcer');
      const instance = new enforcer();
      
      // Test null schema normalization
      const item1 = { schema: null, name: 'users', type: 'table' };
      const item2 = { schema: 'public', name: 'users', type: 'table' };
      
      const key1 = instance._generateCoverageKey(item1);
      const key2 = instance._generateCoverageKey(item2);
      
      expect(key1).toBe(key2); // Should normalize to same key
      expect(key1).toBe('public::users::table');
      
      // Test case normalization
      const item3 = { schema: 'PUBLIC', name: 'USERS', type: 'TABLE' };
      const key3 = instance._generateCoverageKey(item3);
      
      expect(key3).toBe(key1); // Should normalize case
      
      // Test special character handling
      const item4 = { schema: 'public', name: 'user::posts', type: 'table' };
      const key4 = instance._generateCoverageKey(item4);
      
      expect(key4).toContain('\\:\\:'); // Should escape separator
    });
  });
  
  describe('Pattern Error Recovery with Fix', () => {
    it('should recover from pattern rendering failures', async () => {
      const generator = new TestTemplateGenerator();
      
      // Create requirement that might cause pattern issues
      const requirement = {
        type: 'rls',
        name: 'users',
        schema: 'public',
        description: 'Test RLS policies'
      };
      
      // Try to use non-existent pattern
      const result = generator.generateEnhancedTemplate(
        requirement,
        ['non_existent_pattern', 'another_bad_pattern']
      );
      
      // Should still return valid template
      expect(result).toBeDefined();
      expect(result.content).toContain('CREATE OR REPLACE FUNCTION');
      expect(result.metadata.warnings).toContain("Pattern 'non_existent_pattern' not found");
      
      // Verify template is valid
      const validation = generator._validateTemplate(result.content);
      expect(validation.valid).toBe(true);
    });
    
    it('should validate templates before returning', async () => {
      const generator = new TestTemplateGenerator();
      
      // Test validation catches missing structure
      const invalidTemplate = 'SELECT 1;'; // Not a valid pgTAP test
      const validation = generator._validateTemplate(invalidTemplate);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing function declaration');
      expect(validation.errors).toContain('Missing test plan declaration');
    });
  });
  
  describe('Template Generation for Coverage Gaps', () => {
    it('should generate templates for missing coverage', async () => {
      // Analyze operations
      const operations = [
        {
          sql: 'CREATE TABLE products (id INT PRIMARY KEY, name TEXT);',
          type: 'SAFE',
          description: 'Create products table'
        },
        {
          sql: 'CREATE FUNCTION get_product(p_id INT) RETURNS TEXT AS $$ SELECT name FROM products WHERE id = p_id $$ LANGUAGE SQL;',
          type: 'SAFE',
          description: 'Create get_product function'
        }
      ];
      
      // No existing tests
      const result = await coverageOrchestrator.checkCoverage(operations);
      
      expect(result.passed).toBe(false);
      expect(result.templates).toBeDefined();
      expect(result.templates.length).toBeGreaterThan(0);
      
      // Verify templates are valid
      const generator = new TestTemplateGenerator();
      for (const template of result.templates) {
        const validation = generator._validateTemplate(template.template);
        expect(validation.valid).toBe(true);
      }
    });
  });
  
  describe('Full Workflow Integration', () => {
    it('should handle complete deployment workflow with coverage', async () => {
      // Setup SQL and tests
      await fs.writeFile(
        path.join(tempDir, 'sql', 'schema.sql'),
        `
        CREATE TABLE articles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          content TEXT,
          author_id UUID NOT NULL,
          published BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX idx_articles_author ON articles(author_id);
        CREATE INDEX idx_articles_published ON articles(published) WHERE published = true;
        `
      );
      
      await fs.writeFile(
        path.join(tempDir, 'tests', 'articles.test.sql'),
        `
        BEGIN;
        SELECT plan(10);
        
        -- Table tests
        SELECT has_table('public', 'articles');
        SELECT has_column('articles', 'id');
        SELECT has_column('articles', 'title');
        SELECT has_column('articles', 'content');
        SELECT has_column('articles', 'author_id');
        SELECT has_column('articles', 'published');
        
        -- Type tests
        SELECT col_type_is('articles', 'id', 'uuid');
        SELECT col_not_null('articles', 'title');
        
        -- Index tests
        SELECT has_index('articles', 'idx_articles_author');
        SELECT has_index('articles', 'idx_articles_published');
        
        SELECT finish();
        ROLLBACK;
        `
      );
      
      // Create operations
      const operations = [
        {
          sql: 'CREATE TABLE articles...',
          type: 'SAFE',
          description: 'Create articles table'
        },
        {
          sql: 'CREATE INDEX idx_articles_author...',
          type: 'SAFE',
          description: 'Create author index'
        },
        {
          sql: 'CREATE INDEX idx_articles_published...',
          type: 'SAFE',
          description: 'Create published partial index'
        }
      ];
      
      // Run full coverage check
      const coverageResult = await orchestrator.checkTestCoverage(operations);
      
      expect(coverageResult.passed).toBe(true);
      expect(coverageResult.coveragePercentage).toBeGreaterThan(70);
      
      // Verify all components worked together
      expect(orchestrator.coverageOrchestrator).toBeDefined();
      expect(coverageResult.gaps).toBeDefined();
      expect(coverageResult.suggestions).toBeDefined();
    });
  });
});