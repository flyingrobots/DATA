/**
 * @fileoverview Pure pattern rendering functions
 * No I/O, no side effects - just string manipulation
 */

/**
 * Render a pattern template with variables
 * @param {string} patternId - Pattern identifier
 * @param {Object} vars - Variables to interpolate
 * @param {Array} registry - Pattern registry (defaults to PATTERNS)
 * @returns {string} Rendered SQL
 * @throws {Error} If pattern not found or missing variables
 */
export function renderPattern(patternId, vars, registry) {
  const pattern = registry.find(p => p.id === patternId);

  if (!pattern) {
    throw new Error(`Unknown pattern: ${patternId}`);
  }

  // Check all required placeholders are provided
  for (const placeholder of pattern.placeholders || []) {
    if (!(placeholder in vars)) {
      throw new Error(`Missing variable for pattern ${patternId}: ${placeholder}`);
    }
  }

  // Replace placeholders with values
  return (pattern.template || '').replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in vars) {
      return String(vars[key]);
    }
    // If not in vars but also not in placeholders, leave as-is
    return match;
  });
}

/**
 * Get recommended patterns for a test type
 * @param {string} testType - Type from TEST_TYPES
 * @returns {Array<string>} Pattern IDs
 */
export function getRecommendedPatterns(testType) {
  const recommendations = {
    'SCHEMA': ['table_exists', 'column_exists', 'column_type_check'],
    'CONSTRAINT': ['not_null_constraint', 'primary_key_check', 'foreign_key_check', 'unique_constraint_check'],
    'INDEX': ['index_exists', 'index_type_check', 'query_plan_uses_index'],
    'RLS': ['rls_enablement_check', 'policy_exists', 'role_based_access'],
    'PERMISSION': ['role_based_access', 'privilege_escalation_test', 'multi_role_data_isolation'],
    'FUNCTION': ['security_definer_validation'],
    'DATA': ['data_type_conversion_test', 'cascade_delete_test'],
    'VIEW': ['table_exists'], // Views can reuse table existence pattern
    'TRIGGER': [], // No specific patterns yet
    'ENUM': [] // No specific patterns yet
  };

  return recommendations[testType] || [];
}

/**
 * Generate enhanced template with recommended patterns
 * @param {Object} requirement - Test requirement object
 * @param {Array<string>} extraPatternIds - Additional pattern IDs to include
 * @param {Array} registry - Pattern registry
 * @returns {Object} { sql: string, metadata: Object }
 */
export function generateEnhancedTemplate(requirement, extraPatternIds = [], registry) {
  const recommendedIds = getRecommendedPatterns(requirement.type);
  const allIds = [...new Set([...recommendedIds, ...extraPatternIds])];

  const chunks = [];
  const usedPatterns = [];

  for (const patternId of allIds) {
    try {
      const rendered = renderPattern(patternId, requirement.vars || {}, registry);
      chunks.push(`-- Pattern: ${patternId}\n${rendered}`);
      usedPatterns.push(patternId);
    } catch (error) {
      // Skip patterns that can't be rendered (missing vars)
      console.warn(`Skipping pattern ${patternId}: ${error.message}`);
    }
  }

  return {
    sql: chunks.join('\n\n'),
    metadata: {
      patternsUsed: usedPatterns,
      testType: requirement.type,
      target: requirement.target
    }
  };
}

/**
 * Validate pattern structure
 * @param {Object} pattern - Pattern to validate
 * @returns {Array<string>} Validation errors (empty if valid)
 */
export function validatePattern(pattern) {
  const errors = [];

  if (!pattern.id) {
    errors.push('Pattern missing required field: id');
  }

  if (!pattern.category) {
    errors.push('Pattern missing required field: category');
  }

  if (!pattern.template) {
    errors.push('Pattern missing required field: template');
  }

  if (!pattern.difficulty) {
    errors.push('Pattern missing required field: difficulty');
  }

  const validDifficulties = ['basic', 'intermediate', 'advanced'];
  if (pattern.difficulty && !validDifficulties.includes(pattern.difficulty)) {
    errors.push(`Invalid difficulty: ${pattern.difficulty}. Must be one of: ${validDifficulties.join(', ')}`);
  }

  // Check that placeholders in template match declared placeholders
  if (pattern.template && pattern.placeholders) {
    const templateVars = new Set();
    const regex = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = regex.exec(pattern.template)) !== null) {
      templateVars.add(match[1]);
    }

    for (const declared of pattern.placeholders) {
      if (!templateVars.has(declared)) {
        errors.push(`Declared placeholder '${declared}' not used in template`);
      }
    }

    for (const used of templateVars) {
      if (!pattern.placeholders.includes(used)) {
        errors.push(`Template uses undeclared placeholder '${used}'`);
      }
    }
  }

  return errors;
}
