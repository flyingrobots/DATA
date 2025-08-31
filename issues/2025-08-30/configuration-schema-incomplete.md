# GitHub Issue Format

> [!warning]- _Not Started_

## Issue Title

Add coverage enforcement configuration to datarc.schema.json

### Core Information

| Field                 | Why It Matters                                                  |
| --------------------- | --------------------------------------------------------------- |
| **Severity Level**    | HIGH - Runtime configuration errors possible                    |
| **Location**          | `datarc.schema.json`                                            |
| **Category**          | Architecture/Configuration                                      |
| **Brief Description** | Missing coverage-specific configuration properties in schema    |
| **Impact**            | Runtime errors and invalid configurations not caught at startup |

## Summary

The configuration schema (datarc.schema.json) doesn't include definitions for the test coverage enforcement settings. This means invalid coverage configurations won't be caught during validation, potentially causing runtime errors or unexpected behavior during deployment.

## Details

### Root Cause

When the test coverage enforcement system was added, the configuration schema wasn't updated to include the new coverage-related settings that are now being used by the system.

### Example

Current `.datarc.json` might contain:

```json
{
  "test": {
    "coverage": {
      "enforcement_level": "strict",
      "thresholds": {
        "tables": 90,
        "functions": 85
      }
    }
  }
}
```

But the schema doesn't validate these properties, allowing invalid values like:

```json
{
  "test": {
    "coverage": {
      "enforcement_level": "super-strict", // Invalid enum value!
      "thresholds": {
        "tables": "ninety", // Should be number!
        "functions": 150 // Should be 0-100!
      }
    }
  }
}
```

## Proposed Solution

Extend the schema with comprehensive coverage configuration:

```json
{
  "properties": {
    "test": {
      "type": "object",
      "properties": {
        "coverage": {
          "type": "object",
          "description": "Test coverage enforcement configuration",
          "properties": {
            "enforcement_level": {
              "type": "string",
              "enum": ["strict", "normal", "lenient"],
              "default": "normal",
              "description": "Coverage enforcement strictness level"
            },
            "minimum_percentage": {
              "type": "number",
              "minimum": 0,
              "maximum": 100,
              "default": 80,
              "description": "Minimum overall coverage percentage required"
            },
            "thresholds": {
              "type": "object",
              "description": "Coverage thresholds by database object type",
              "properties": {
                "tables": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100,
                  "default": 80
                },
                "columns": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100,
                  "default": 75
                },
                "functions": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100,
                  "default": 85
                },
                "policies": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100,
                  "default": 100
                },
                "indexes": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100,
                  "default": 60
                },
                "triggers": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100,
                  "default": 70
                }
              },
              "additionalProperties": false
            },
            "generate_templates": {
              "type": "boolean",
              "default": true,
              "description": "Automatically generate test templates for gaps"
            },
            "template_output": {
              "type": "string",
              "default": "./tests/generated",
              "description": "Directory for generated test templates"
            },
            "allow_bypass": {
              "type": "boolean",
              "default": false,
              "description": "Allow coverage enforcement bypass with reason"
            },
            "ignore_patterns": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "default": [],
              "description": "Patterns for objects to ignore in coverage checks"
            }
          },
          "additionalProperties": false
        }
      }
    }
  }
}
```

### Known Unknowns

- Should coverage configuration be environment-specific?
- What other coverage settings might users need?
- Should we support regex patterns for ignore lists?

### Unknown Unknowns

- How will this interact with future configuration migrations?
- Are there legacy configurations that need migration?
- Could schema validation performance be impacted?

---

_"The complexity of the humanoid brain is not easily replicated. The positronic matrix of my neural net is quite intricate." - Data, Star Trek: The Next Generation, "The Measure of a Man"_
