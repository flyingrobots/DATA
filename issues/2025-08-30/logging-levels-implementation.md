# GitHub Issue Format

## Issue Title
Replace console methods with proper logging levels

### Core Information

| Field | Why It Matters |
|-------|---------------|
| **Severity Level** | LOW - Code quality improvement |
| **Location** | Multiple files using console.log, console.error, console.warn |
| **Category** | Architecture/Style |
| **Brief Description** | Direct console usage instead of structured logging |
| **Impact** | Cannot control log verbosity or redirect logs properly |

## Summary

The test coverage system uses direct console methods (console.log, console.error, console.warn) instead of a proper logging framework. This makes it impossible to control log levels, filter output, or redirect logs to files or external services.

## Details

### Root Cause

Quick implementation used console methods directly rather than establishing a logging abstraction layer from the start.

### Example

Current scattered logging:
```javascript
// In TestTemplateGenerator.js
console.error(`Failed to render pattern ${patternName}:`, error);

// In TestCoverageOrchestrator.js  
this.logger = options.logger || console.log;

// In pgTAPTestScanner.js
console.warn('Invalid assertion pattern:', line);
```

## Proposed Solution

Implement a proper logging abstraction:

```javascript
// src/lib/logging/Logger.js

class Logger {
  static LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
  };

  constructor(options = {}) {
    this.level = options.level || Logger.LEVELS.INFO;
    this.name = options.name || 'D.A.T.A.';
    this.output = options.output || console;
    this.format = options.format || this.defaultFormat;
  }

  defaultFormat(level, message, meta) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}] [${level}]`;
    
    if (meta && Object.keys(meta).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(meta)}`;
    }
    return `${prefix} ${message}`;
  }

  log(level, message, meta = {}) {
    if (level <= this.level) {
      const formatted = this.format(
        Object.keys(Logger.LEVELS).find(k => Logger.LEVELS[k] === level),
        message,
        meta
      );
      
      switch (level) {
        case Logger.LEVELS.ERROR:
          this.output.error(formatted);
          break;
        case Logger.LEVELS.WARN:
          this.output.warn(formatted);
          break;
        default:
          this.output.log(formatted);
      }
    }
  }

  error(message, meta) { this.log(Logger.LEVELS.ERROR, message, meta); }
  warn(message, meta) { this.log(Logger.LEVELS.WARN, message, meta); }
  info(message, meta) { this.log(Logger.LEVELS.INFO, message, meta); }
  debug(message, meta) { this.log(Logger.LEVELS.DEBUG, message, meta); }
  trace(message, meta) { this.log(Logger.LEVELS.TRACE, message, meta); }

  child(name) {
    return new Logger({
      level: this.level,
      name: `${this.name}:${name}`,
      output: this.output,
      format: this.format
    });
  }
}

// Usage in modules
class TestRequirementAnalyzer {
  constructor(options = {}) {
    this.logger = options.logger || new Logger({ name: 'Analyzer' });
  }

  analyzeOperations(operations) {
    this.logger.debug('Analyzing operations', { count: operations.length });
    
    try {
      // ... analysis logic
      this.logger.info('Analysis complete', { 
        requirements: result.requirements.length 
      });
    } catch (error) {
      this.logger.error('Analysis failed', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }
}
```

Configuration via .datarc.json:
```json
{
  "logging": {
    "level": "INFO",
    "format": "json",
    "output": "stdout"
  }
}
```

### Known Unknowns

- Should we use an existing logging library like winston or pino?
- How should we handle log rotation and archival?
- Should different modules have different log levels?

### Unknown Unknowns

- How will logging affect performance with high verbosity?
- How should we handle sensitive data in logs?
- Will structured logging work with existing monitoring tools?

___

_"The complexity of the universe is beyond measure, yet we must still attempt to understand it through observation and analysis." - Data, Star Trek: The Next Generation, "The Ensigns of Command"_