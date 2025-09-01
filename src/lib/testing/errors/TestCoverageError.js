// src/lib/testing/errors/TestCoverageErrors.js
class TestCoverageError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "TestCoverageError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

class ValidationError extends TestCoverageError {
  constructor(message, details) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

class CoverageEnforcementError extends TestCoverageError {
  constructor(message, gaps, percentage) {
    super(message, "COVERAGE_ENFORCEMENT", { gaps, percentage });
    this.name = "CoverageEnforcementError";
  }
}

class ParsingError extends TestCoverageError {
  constructor(message, file, line) {
    super(message, "PARSING_ERROR", { file, line });
    this.name = "ParsingError";
  }
}

module.exports = {
  TestCoverageError,
  ValidationError,
  CoverageEnforcementError,
  ParsingError,
};
