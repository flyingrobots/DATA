#!/usr/bin/env node

/**
 * @fileoverview AI-Powered JSDoc Generation Script
 *
 * Automatically generates comprehensive JSDoc comments for JavaScript files
 * using AI analysis. Integrates with git pre-commit hooks for seamless
 * developer experience.
 *
 * @module JSDocAI
 * @since 1.0.0
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get staged JavaScript files from git
 * @returns {string[]} Array of staged .js file paths
 */
function getStagedJSFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: join(__dirname, '..')
    });

    return output
      .split('\n')
      .filter((file) => file.trim() && file.endsWith('.js'))
      .map((file) => file.trim());
  } catch (error) {
    console.log('No staged files found or not in git repository');
    return [];
  }
}

/**
 * Analyze JavaScript code structure to generate JSDoc prompt
 * @param {string} code - JavaScript source code
 * @returns {string} Generated analysis prompt for AI
 */
function analyzeCodeStructure(code) {
  const patterns = {
    classes: /class\s+(\w+)(?:\s+extends\s+(\w+))?/g,
    functions: /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
    methods: /(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g,
    exports: /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
    imports: /import\s+.*?from\s+['"`]([^'"`]+)['"`]/g
  };

  let analysis = 'Analyze this JavaScript code and generate comprehensive JSDoc comments:\n\n';

  // Detect patterns
  const classes = [...code.matchAll(patterns.classes)];
  const functions = [...code.matchAll(patterns.functions)];
  const imports = [...code.matchAll(patterns.imports)];

  if (classes.length > 0) {
    analysis += `Classes found: ${classes.map((m) => m[1]).join(', ')}\n`;
  }

  if (functions.length > 0) {
    analysis += `Functions found: ${functions.map((m) => m[1]).join(', ')}\n`;
  }

  if (imports.length > 0) {
    analysis += `Dependencies: ${imports.map((m) => m[1]).join(', ')}\n`;
  }

  analysis += '\nGenerate JSDoc with:\n';
  analysis += '- @fileoverview for file header\n';
  analysis += '- @param with accurate types for all parameters\n';
  analysis += '- @returns with specific return types\n';
  analysis += '- @throws for error conditions\n';
  analysis += '- @example for complex functions\n';
  analysis += '- @since version tags\n';
  analysis += '- @module declarations\n\n';
  analysis += 'IMPORTANT: Only add JSDoc where missing. Preserve existing JSDoc comments.\n';

  return analysis;
}

/**
 * Generate JSDoc using AI analysis
 * @param {string} filePath - Path to JavaScript file
 * @returns {Promise<boolean>} True if file was modified
 */
async function generateJSDocForFile(filePath) {
  try {
    const absolutePath = join(process.cwd(), filePath);
    const code = readFileSync(absolutePath, 'utf8');

    // Skip if already has comprehensive JSDoc
    const jsdocCount = (code.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
    const functionsCount = (code.match(/(?:function|class|\w+\s*\([^)]*\)\s*{)/g) || []).length;

    if (jsdocCount >= functionsCount * 0.8) {
      console.log(`✓ ${filePath} already has good JSDoc coverage`);
      return false;
    }

    const prompt = analyzeCodeStructure(code);
    console.log(`📝 Analysis for ${filePath}:`);
    console.log(prompt);

    // For demo purposes, just indicate what would be done
    // In production, this would call Claude API or use local AI
    console.log(`\n🤖 AI JSDoc generation would be applied to ${filePath}`);
    console.log(`   Found ${functionsCount} functions/classes, ${jsdocCount} have JSDoc`);
    console.log('   📋 Prompt ready for AI processing');

    // For safety in demo, don't modify files
    // Uncomment below to enable actual file modification:
    // writeFileSync(absolutePath, enhancedCode);

    return false; // Return true when actually modifying files
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main execution function
 * @param {string[]} [targetFiles] - Optional specific files to process
 * @returns {Promise<void>}
 */
async function main(targetFiles = null) {
  const files = targetFiles || getStagedJSFiles();

  if (files.length === 0) {
    console.log('No JavaScript files to process');
    return;
  }

  console.log(`🤖 Processing ${files.length} JavaScript files for JSDoc enhancement...`);

  let modifiedCount = 0;

  for (const file of files) {
    const wasModified = await generateJSDocForFile(file);
    if (wasModified) {
      modifiedCount++;
      // Stage the modified file
      try {
        execSync(`git add "${file}"`, { cwd: process.cwd() });
      } catch (addError) {
        console.warn(`⚠ Could not stage ${file}:`, addError.message);
      }
    }
  }

  console.log(`🚀 Enhanced ${modifiedCount}/${files.length} files with AI-generated JSDoc`);
}

// Handle CLI usage
if (process.argv[1] === __filename) {
  const targetFiles = process.argv.slice(2);
  main(targetFiles.length > 0 ? targetFiles : null).catch(console.error);
}

export { main, generateJSDocForFile, analyzeCodeStructure, getStagedJSFiles };
