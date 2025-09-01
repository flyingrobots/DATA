# AI-Powered JSDoc Generation Pipeline 🤖

Automated JSDoc generation system that integrates seamlessly with git pre-commit hooks for the D.A.T.A. CLI project.

## Overview

This pipeline follows the **"JSDoc + AI Revolution"** philosophy from our architectural decisions, providing comprehensive type documentation without TypeScript's build overhead.

## Features

✅ **Automatic Detection** - Analyzes code structure and identifies missing JSDoc  
✅ **Git Integration** - Runs automatically on pre-commit for staged JS files  
✅ **Smart Analysis** - Generates context-aware prompts for AI enhancement  
✅ **Coverage Tracking** - Skips files with >80% JSDoc coverage  
✅ **Safe Operation** - Non-destructive demo mode for testing  

## Usage

### Automatic (Pre-commit Hook)
```bash
# JSDoc generation happens automatically when you commit JS files
git add src/MyComponent.js
git commit -m "Add new component"
# 🤖 AI JSDoc analysis runs automatically
```

### Manual Commands
```bash
# Analyze staged files only
npm run jsdoc:staged

# Analyze specific files
npm run jsdoc:ai file1.js file2.js

# Analyze all JS files in project
npm run jsdoc:all

# Analyze only starfleet workspace
npm run jsdoc:starfleet
```

### Direct Script Usage
```bash
# Process specific files
node scripts/jsdoc-ai.js src/commands/MyCommand.js

# Process all staged files
node scripts/jsdoc-ai.js
```

## How It Works

1. **File Detection**: Identifies staged JavaScript files via git
2. **Code Analysis**: Parses imports, classes, functions, and methods
3. **Coverage Check**: Calculates existing JSDoc coverage ratio
4. **Prompt Generation**: Creates AI-optimized analysis prompts
5. **AI Processing**: Ready for Claude API or local AI integration
6. **File Enhancement**: Updates files with comprehensive JSDoc

## Example Analysis Output

```
📝 Analysis for src/commands/CompileCommand.js:
Classes found: CompileCommand
Functions found: performExecute, validatePaths
Dependencies: @starfleet/data-core, path

Generate JSDoc with:
- @fileoverview for file header
- @param with accurate types for all parameters
- @returns with specific return types
- @throws for error conditions
- @example for complex functions
- @since version tags
- @module declarations

IMPORTANT: Only add JSDoc where missing. Preserve existing JSDoc comments.
```

## Integration Points

### Pre-commit Hook (.husky/pre-commit)
- Automatically triggers on JavaScript file commits
- Non-blocking - continues commit even if JSDoc generation fails
- Integrates with existing ESLint workflow

### Package.json Scripts
- `jsdoc:staged` - Process staged files
- `jsdoc:ai` - Direct script invocation  
- `jsdoc:all` - Process entire codebase
- `jsdoc:starfleet` - Process workspace files

## Configuration

The script intelligently detects:
- **Classes** with inheritance patterns
- **Functions** including async/await
- **Method definitions** in classes
- **Import/export statements**
- **Existing JSDoc coverage**

## Production Setup

To enable actual file modification (currently in demo mode):

1. Set up Claude API or local AI endpoint
2. Uncomment the file writing logic in `generateJSDocForFile()`
3. Add error handling for AI service failures
4. Configure timeout and retry logic

## File Structure

```
scripts/
├── jsdoc-ai.js           # Main generation script (102 LoC)
└── README-jsdoc-ai.md    # This documentation

.husky/
└── pre-commit            # Enhanced with JSDoc generation

package.json              # Added jsdoc:* scripts
```

## Benefits

🚀 **Zero Build Time** - Pure JavaScript, no transpilation  
🧠 **AI-Enhanced** - Context-aware documentation generation  
⚡ **Seamless DX** - Automatic on commit, manual when needed  
📊 **Smart Coverage** - Skips well-documented code  
🛡️ **Safe by Default** - Demo mode prevents accidental overwrites  

---

*"Ship JavaScript. Skip the costume party."* - Anti-TypeScript Manifesto