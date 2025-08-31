# Test Pattern Library

The Test Pattern Library is a comprehensive collection of reusable test patterns for pgTAP test generation in the D.A.T.A. project. It provides common patterns for each test type with best practices and examples to ensure consistency across all generated tests.

## Overview

The TestPatternLibrary aggregates common patterns across 5 main categories:

1. **Data Validation Patterns** - Validating data integrity, constraints, and business rules
2. **Security Testing Patterns** - Testing security features, RLS policies, and access controls
3. **Performance Testing Patterns** - Testing performance characteristics and query efficiency
4. **Error Handling Patterns** - Testing error conditions and exception handling
5. **Multi-User Scenarios** - Testing concurrent access and multi-user interactions

## Architecture

```
TestTemplateGenerator
├── TestPatternLibrary
│   ├── Pattern Categories (5 categories)
│   ├── Individual Patterns (14+ patterns)
│   └── Test Type Mappings
└── Enhanced Template Generation
```

## Usage Examples

### Basic Usage (Existing Functionality)

```javascript
const generator = new TestTemplateGenerator();
const requirement = {
  type: "table",
  name: "users",
  schema: "public",
};
const template = generator.generateTemplate(requirement);
```

### Enhanced Usage with Patterns

```javascript
const generator = new TestTemplateGenerator();
const requirement = {
  type: "rls",
  name: "users",
  schema: "public",
  metadata: {
    policies: [
      { name: "users_select_own", commands: ["SELECT"] },
      { name: "users_update_own", commands: ["UPDATE"] },
    ],
  },
};

// Generate enhanced template with additional patterns
const enhancedTemplate = generator.generateEnhancedTemplate(
  requirement,
  ["privilege_escalation_test"], // Additional patterns beyond recommended ones
);

console.log(
  `Enhanced template uses ${enhancedTemplate.metadata.patternsUsed.length} patterns`,
);
```

### Direct Pattern Access

```javascript
const generator = new TestTemplateGenerator();

// Get recommended patterns for a test type
const rlsPatterns = generator.getRecommendedPatterns("rls");
console.log(`RLS tests use ${rlsPatterns.length} patterns`);

// Get patterns by category
const securityPatterns = generator.getPatternsByCategory("security_testing");

// Render a specific pattern with custom variables
const variables = { schema: "public", tableName: "posts" };
const rendered = generator.renderPattern("table_exists_basic", variables);
```

### Documentation Generation

```javascript
const generator = new TestTemplateGenerator();

// Generate best practices for a test type
const bestPractices = generator.generateBestPracticesDoc("rls");

// Generate complete pattern library documentation
const libraryDoc = generator.generatePatternLibraryDoc();

// Get usage examples
const examples = generator.generateUsageExamples();
```

## Available Patterns

### Data Validation Patterns

- **table_exists_basic** - Basic table existence validation
- **column_structure_validation** - Comprehensive column structure validation
- **foreign_key_relationship** - Foreign key relationship validation with referential integrity
- **constraint_validation** - CHECK constraint validation with boundary testing

### Security Testing Patterns

- **rls_enablement_check** - Row Level Security enablement validation
- **policy_existence_check** - RLS policy existence and configuration validation
- **multi_user_access_test** - Multi-user access pattern testing data isolation
- **privilege_escalation_test** - Test that privilege escalation is properly prevented

### Performance Testing Patterns

- **index_usage_verification** - Verify that indexes are used by query plans
- **function_performance_test** - Function execution time and resource usage validation

### Error Handling Patterns

- **constraint_violation_handling** - Test proper constraint violation error handling
- **function_exception_handling** - Test function exception handling and error recovery

### Multi-User Scenario Patterns

- **concurrent_modification_test** - Test concurrent data modification scenarios
- **data_isolation_verification** - Verify data isolation between different user contexts

## Pattern Categories and Test Type Mappings

### Test Types and Recommended Patterns

| Test Type      | Recommended Patterns                                                  |
| -------------- | --------------------------------------------------------------------- |
| **RPC**        | 5 patterns including multi-user access and privilege escalation tests |
| **RLS**        | 5 patterns focusing on security and data isolation                    |
| **Trigger**    | 4 patterns including error handling and concurrent modification       |
| **Constraint** | 3 patterns focusing on validation and error handling                  |
| **Function**   | 3 patterns including performance and exception handling               |
| **Table**      | 5 patterns covering structure, constraints, and indexes               |
| **Column**     | 3 patterns focusing on structure validation                           |
| **Index**      | 2 patterns covering usage verification and performance                |

## Pattern Structure

Each pattern includes:

- **Name** - Unique identifier
- **Category** - One of the 5 main categories
- **Description** - Human-readable description
- **SQL Template** - SQL template with placeholders
- **Placeholders** - List of variables that can be substituted
- **Metadata** - Additional metadata (complexity, execution time, etc.)
- **Best Practices** - Recommended usage guidelines
- **Examples** - Usage examples
- **Difficulty** - basic, intermediate, or advanced
- **Dependencies** - Required test utilities or setup

## Best Practices

### When to Use Enhanced Templates

- **Complex Requirements**: Use `generateEnhancedTemplate()` for requirements with rich metadata
- **Security-Critical Tests**: Always use enhanced templates for RLS and security tests
- **Performance Tests**: Use enhanced templates for function and index tests
- **Multi-User Scenarios**: Use enhanced templates when testing user isolation

### When to Use Basic Templates

- **Simple Existence Tests**: Use `generateTemplate()` for basic table/column existence
- **Quick Prototyping**: Use basic templates for initial test scaffolding
- **Legacy Compatibility**: Use basic templates to maintain existing test structure

### Pattern Selection Guidelines

1. **Start with Recommended Patterns**: Use `getRecommendedPatterns(testType)` first
2. **Add Category-Specific Patterns**: Use `getPatternsByCategory()` for specialized needs
3. **Consider Difficulty Level**: Match pattern difficulty to your test complexity needs
4. **Check Dependencies**: Ensure required test utilities are available

## Integration with Existing Code

The TestPatternLibrary is designed to be fully backward compatible:

- **Existing Code**: All existing `generateTemplate()` calls continue to work unchanged
- **Gradual Adoption**: You can selectively use enhanced templates where needed
- **No Breaking Changes**: The library extends functionality without modifying existing APIs

## Extension and Customization

### Adding New Patterns

1. Add pattern definition in `TestPatternLibrary.initializePatterns()`
2. Update category assignments
3. Add to test type mappings in `initializeTestTypeMapping()`
4. Update documentation and examples

### Creating Custom Categories

1. Add category in `initializePatternCategories()`
2. Define category metadata and best practices
3. Assign patterns to the new category
4. Update documentation

## Performance Considerations

- **Pattern Rendering**: O(1) lookup, O(n) variable substitution
- **Template Enhancement**: O(k) where k = number of applicable patterns
- **Memory Usage**: ~6KB for pattern library data
- **Caching**: Patterns are cached in memory for fast access

## Future Enhancements

Planned improvements include:

- **Dynamic Pattern Loading**: Load patterns from external configuration
- **Pattern Composition**: Combine multiple patterns into composite templates
- **AI-Assisted Pattern Generation**: Generate patterns based on schema analysis
- **Test Quality Metrics**: Score generated tests for coverage and quality
- **Pattern Versioning**: Version control for pattern evolution

## Debugging and Troubleshooting

### Common Issues

- **Missing Variables**: Ensure all pattern placeholders have corresponding variables
- **Pattern Conflicts**: Check for overlapping patterns in enhanced generation
- **Template Formatting**: Verify pgTAP structure formatting is correct

### Debug Methods

```javascript
const generator = new TestTemplateGenerator();

// Check available patterns
console.log(generator.getAvailablePatterns());

// Verify pattern rendering
try {
  const rendered = generator.renderPattern("pattern_name", variables);
} catch (error) {
  console.log("Pattern rendering failed:", error.message);
}

// Inspect enhanced template metadata
const template = generator.generateEnhancedTemplate(requirement);
console.log("Patterns used:", template.metadata.patternsUsed);
```

## Contributing

When contributing new patterns:

1. Follow existing pattern structure and naming conventions
2. Include comprehensive documentation and examples
3. Test pattern rendering with various variable combinations
4. Update category mappings and test type recommendations
5. Add appropriate unit tests

---

For more information, see the complete pattern library documentation generated by `generatePatternLibraryDoc()`.
