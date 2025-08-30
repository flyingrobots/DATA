# GitHub Issue Format

## Issue Title
Standardize error types across test coverage modules

### Core Information

| Field | Why It Matters |
|-------|---------------|
| **Severity Level** | LOW - Code quality and maintainability |
| **Location** | All files in `src/lib/testing/` |
| **Category** | Architecture/Style |
| **Brief Description** | Inconsistent error handling with generic Error objects |
| **Impact** | Harder to handle specific error cases programmatically |

## Summary

The test coverage enforcement system uses generic Error objects throughout, making it difficult to handle specific error conditions programmatically. Different modules should throw specific error types that can be caught and handled appropriately by calling code.

## Details

### Root Cause

All modules currently throw generic Error objects with message strings, rather than typed errors that can be programmatically identified and handled.

### Example

Current inconsistent approach:
```javascript
// In TestRequirementAnalyzer
throw new Error('Invalid operation structure');

// In CoverageEnforcer  
throw new Error('Coverage requirements not met');

// In pgTAPTestScanner
throw new Error('Failed to parse test file');
```

## Proposed Solution

Create a hierarchy of specific error types:

```javascript
// src/lib/testing/errors/TestCoverageErrors.js

class TestCoverageError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'TestCoverageError';
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends TestCoverageError {
  constructor(message, details) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class CoverageEnforcementError extends TestCoverageError {
  constructor(message, gaps, percentage) {
    super(message, 'COVERAGE_ENFORCEMENT', { gaps, percentage });
    this.name = 'CoverageEnforcementError';
  }
}

class TemplateGenerationError extends TestCoverageError {
  constructor(message, template, cause) {
    super(message, 'TEMPLATE_GENERATION', { template, cause });
    this.name = 'TemplateGenerationError';
  }
}

class ParseError extends TestCoverageError {
  constructor(message, file, line) {
    super(message, 'PARSE_ERROR', { file, line });
    this.name = 'ParseError';
  }
}

module.exports = {
  TestCoverageError,
  ValidationError,
  CoverageEnforcementError,
  TemplateGenerationError,
  ParseError
};
```

Usage:
```javascript
// Now we can handle specific errors
try {
  await coverageEnforcer.enforce(requirements, coverage);
} catch (error) {
  if (error instanceof CoverageEnforcementError) {
    // Handle coverage failure specifically
    console.log(`Coverage: ${error.details.percentage}%`);
    console.log(`Gaps: ${error.details.gaps.length}`);
  } else if (error instanceof ValidationError) {
    // Handle validation differently
    console.log('Invalid input:', error.details);
  } else {
    // Unknown error
    throw error;
  }
}
```

### Known Unknowns

- Should we use error codes or error types?
- How should we handle error serialization for logging?
- Should errors include stack traces in production?

### Unknown Unknowns

- How will custom errors interact with async stack traces?
- Will error instanceof checks work across module boundaries?
- How do custom errors affect error reporting tools?

___

_"Errors are a part of the learning process. Without them, we would never improve." - Data, Star Trek: The Next Generation, "In Theory"_