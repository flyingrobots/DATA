#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * AI-powered JSDoc generation script for pure JavaScript files.
 * Generates comprehensive JSDoc comments using Claude AI via command line.
 */
class JSDocGenerator {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      skipExisting: options.skipExisting || true,
      ...options
    };
  }

  /**
   * Analyzes JavaScript code and generates JSDoc comments using AI
   * @param {string} filePath - Path to the JavaScript file
   * @param {string} content - File content to analyze
   * @returns {string} Updated content with JSDoc comments
   */
  generateJSDocForFile(filePath, content) {
    try {
      if (this.options.verbose) {
        process.stdout.write(`🤖 Analyzing ${filePath} for JSDoc generation...\n`);
      }

      // Check if file already has comprehensive JSDoc
      if (this.options.skipExisting && this.hasComprehensiveJSDoc(content)) {
        if (this.options.verbose) {
          process.stdout.write(`⏭️  Skipping ${filePath} - already has comprehensive JSDoc\n`);
        }
        return content;
      }

      // Create a prompt for AI to generate JSDoc
      const prompt = this.createJSDocPrompt(content, filePath);

      // Use Claude Code API or fallback to a simple heuristic-based approach
      const updatedContent = this.callAIForJSDoc(prompt, content, filePath);

      if (this.options.verbose) {
        process.stdout.write(`✅ Generated JSDoc for ${filePath}\n`);
      }

      return updatedContent;
    } catch (error) {
      process.stderr.write(`⚠️  Failed to generate JSDoc for ${filePath}: ${error.message}\n`);
      return content; // Return original content on failure
    }
  }

  /**
   * Creates a comprehensive prompt for AI JSDoc generation
   * @param {string} content - JavaScript file content
   * @param {string} filePath - File path for context
   * @returns {string} AI prompt for JSDoc generation
   */
  createJSDocPrompt(content, filePath) {
    return `Please add comprehensive JSDoc comments to this JavaScript file. Follow these requirements:

1. Add @param annotations for all function parameters with types and descriptions
2. Add @returns annotations for all function return values with types and descriptions  
3. Add @typedef annotations for complex object types and structures
4. Add class-level JSDoc for ES6 classes with @class annotation
5. Add method-level JSDoc for all class methods
6. Add module-level JSDoc at the top if it's a module
7. Use proper JSDoc type annotations (string, number, boolean, Object, Array, etc.)
8. Include @throws annotations for functions that may throw errors
9. Add @example annotations for complex functions
10. Keep existing code functionality unchanged - only add JSDoc comments

File: ${filePath}

\`\`\`javascript
${content}
\`\`\`

Please return only the updated JavaScript code with JSDoc comments added.`;
  }

  /**
   * Calls AI service to generate JSDoc or falls back to heuristic approach
   * @param {string} prompt - The AI prompt
   * @param {string} originalContent - Original file content
   * @param {string} filePath - File path for context
   * @returns {string} Updated content with JSDoc
   */
  callAIForJSDoc(prompt, originalContent, filePath) {
    try {
      // Try to use Claude Code CLI if available
      if (this.isClaudeAvailable()) {
        return this.callClaudeForJSDoc(prompt, originalContent);
      }

      // Fallback to heuristic-based JSDoc generation
      return this.generateHeuristicJSDoc(originalContent, filePath);
    } catch (error) {
      console.warn(
        `⚠️  AI generation failed, falling back to heuristic approach: ${error.message}`
      );
      return this.generateHeuristicJSDoc(originalContent, filePath);
    }
  }

  /**
   * Checks if Claude Code CLI is available
   * @returns {boolean} True if Claude is available
   */
  isClaudeAvailable() {
    try {
      execSync('which claude', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Uses Claude Code CLI to generate JSDoc
   * @param {string} _prompt - The prompt for Claude
   * @param {string} _originalContent - Original file content
   * @returns {string} Updated content
   */
  callClaudeForJSDoc(_prompt, _originalContent) {
    try {
      // For now, disable Claude CLI integration since the API has changed
      // and fallback to heuristic approach
      throw new Error('Claude CLI integration disabled, using heuristic approach');

      // TODO: Update this when Claude CLI API is stable
      // Create temporary file with prompt
      // const tempFile = `/tmp/jsdoc-prompt-${Date.now()}.txt`;
      // await writeFile(tempFile, prompt);

      // Call Claude Code CLI (API may have changed)
      // const result = execSync(`claude chat "${prompt}"`, {
      //   encoding: 'utf8',
      //   timeout: 30000, // 30 second timeout
      //   stdio: ['pipe', 'pipe', 'pipe'] // Avoid EPIPE errors
      // });

      // Extract JavaScript code from Claude's response
      // const codeMatch = result.match(/```javascript\n([\s\S]*?)\n```/);
      // if (codeMatch && codeMatch[1]) {
      //   return codeMatch[1].trim();
      // }

      // throw new Error('No JavaScript code found in Claude response');
    } catch (error) {
      throw new Error(`Claude CLI integration not ready: ${error.message}`);
    }
  }

  /**
   * Generates basic JSDoc using heuristic analysis
   * @param {string} content - File content
   * @param {string} filePath - File path for context
   * @returns {string} Content with basic JSDoc added
   */
  generateHeuristicJSDoc(content, filePath) {
    let updatedContent = content;

    // Add module-level JSDoc if none exists
    if (!content.includes('/**') && !content.includes('/*')) {
      const moduleName = filePath.split('/').pop().replace('.js', '');
      const moduleDoc = `/**
 * ${moduleName} module
 * Auto-generated JSDoc comments
 */\n\n`;
      updatedContent = moduleDoc + updatedContent;
    }

    // Find and document functions
    updatedContent = this.addFunctionJSDoc(updatedContent);

    // Find and document classes
    updatedContent = this.addClassJSDoc(updatedContent);

    return updatedContent;
  }

  /**
   * Adds JSDoc to function declarations and expressions
   * @param {string} content - File content
   * @returns {string} Content with function JSDoc added
   */
  addFunctionJSDoc(content) {
    const lines = content.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line defines a function and doesn't already have JSDoc
      const functionMatch = line.match(
        /^\s*(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)|^\s*(\w+)\s*[:=]\s*(async\s+)?\(?([^)]*)\)?\s*=>/
      );

      if (functionMatch && i > 0 && !lines[i - 1].includes('/**')) {
        const functionName = functionMatch[3] || functionMatch[5];
        const params = (functionMatch[4] || functionMatch[7] || '')
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p);

        // Generate basic JSDoc
        const jsdocLines = ['/**', ` * ${functionName} function`];

        // Add parameter documentation
        for (const param of params) {
          const paramName = param.split('=')[0].trim();
          if (paramName) {
            jsdocLines.push(` * @param {*} ${paramName} - Parameter description`);
          }
        }

        // Add return documentation
        jsdocLines.push(' * @returns {*} Return description');
        jsdocLines.push(' */');

        // Add JSDoc before the function
        for (const docLine of jsdocLines) {
          result.push(' '.repeat(line.length - line.trimStart().length) + docLine);
        }
      }

      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * Adds JSDoc to class declarations
   * @param {string} content - File content
   * @returns {string} Content with class JSDoc added
   */
  addClassJSDoc(content) {
    const lines = content.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line defines a class and doesn't already have JSDoc
      const classMatch = line.match(/^\s*(export\s+)?class\s+(\w+)/);

      if (classMatch && i > 0 && !lines[i - 1].includes('/**')) {
        const className = classMatch[2];

        // Generate basic class JSDoc
        const jsdocLines = ['/**', ` * ${className} class`, ' * @class', ' */'];

        // Add JSDoc before the class
        for (const docLine of jsdocLines) {
          result.push(' '.repeat(line.length - line.trimStart().length) + docLine);
        }
      }

      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * Checks if file already has comprehensive JSDoc coverage
   * @param {string} content - File content to analyze
   * @returns {boolean} True if file has good JSDoc coverage
   */
  hasComprehensiveJSDoc(content) {
    const jsdocBlocks = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
    const functions = (content.match(/function\s+\w+|=>\s*{|\w+\s*[:=]\s*(?:async\s+)?\(/g) || [])
      .length;
    const classes = (content.match(/class\s+\w+/g) || []).length;

    // Consider comprehensive if we have JSDoc for most functions/classes
    const totalItems = functions + classes;
    return totalItems > 0 && jsdocBlocks / totalItems >= 0.5;
  }

  /**
   * Processes a single JavaScript file
   * @param {string} filePath - Path to the file to process
   * @returns {Promise<boolean>} True if file was updated
   */
  async processFile(filePath) {
    try {
      const content = await readFile(filePath, 'utf8');
      const updatedContent = this.generateJSDocForFile(filePath, content);

      if (content !== updatedContent) {
        if (!this.options.dryRun) {
          await writeFile(filePath, updatedContent);
          process.stdout.write(`📝 Updated JSDoc in ${filePath}\n`);
        } else {
          process.stdout.write(`📝 Would update JSDoc in ${filePath} (dry run)\n`);
        }
        return true;
      }

      return false;
    } catch (error) {
      process.stderr.write(`❌ Error processing ${filePath}: ${error.message}\n`);
      return false;
    }
  }

  /**
   * Processes multiple JavaScript files
   * @param {string[]} filePaths - Array of file paths to process
   * @returns {Promise<{updated: number, skipped: number, errors: number}>} Processing results
   */
  async processFiles(filePaths) {
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`🚀 Processing ${filePaths.length} JavaScript files for JSDoc generation...`);

    // Process files sequentially to avoid overwhelming the system
    const processResults = [];
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        const wasUpdated = await this.processFile(filePath);
        processResults.push({ filePath, wasUpdated, error: null });
      } catch (error) {
        processResults.push({ filePath, wasUpdated: false, error });
      }
    }

    // Collect results
    for (const result of processResults) {
      if (result.error) {
        process.stderr.write(`❌ Failed to process ${result.filePath}: ${result.error.message}\n`);
        errors++;
      } else if (result.wasUpdated) {
        updated++;
      } else {
        skipped++;
      }
    }

    return { updated, skipped, errors };
  }
}

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipExisting: !args.includes('--force')
  };

  // Get file paths from arguments or stdin
  const filePaths = args.filter((arg) => !arg.startsWith('--') && !arg.startsWith('-'));

  if (filePaths.length === 0) {
    console.error('Usage: generate-jsdoc.js [options] <file1.js> [file2.js] ...');
    console.error('Options:');
    console.error('  --dry-run      Show what would be changed without making changes');
    console.error('  --verbose, -v  Verbose output');
    console.error('  --force        Process files even if they already have JSDoc');
    process.exit(1);
  }

  const generator = new JSDocGenerator(options);

  generator
    .processFiles(filePaths)
    .then((results) => {
      console.log('\n📊 JSDoc Generation Summary:');
      console.log(`   Updated: ${results.updated} files`);
      console.log(`   Skipped: ${results.skipped} files`);
      console.log(`   Errors:  ${results.errors} files`);

      if (results.errors > 0) {
        process.exit(1);
      }

      return results;
    })
    .catch((error) => {
      process.stderr.write(`❌ JSDoc generation failed: ${error.message}\n`);
      process.exit(1);
    });
}

export { JSDocGenerator };
