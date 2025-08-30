# GitHub Issue Format

> [!success] __This issuse has been fixed__

## Issue Title

Fix coverage key generation edge cases in CoverageEnforcer

### Core Information

| Field | Why It Matters |
|-------|---------------|
| **Severity Level** | HIGH - Could cause false positives/negatives |
| **Location** | `src/lib/testing/CoverageEnforcer.js` lines 217-255 |
| **Category** | Bug |
| **Brief Description** | Coverage key generation doesn't handle edge cases properly |
| **Impact** | False positives/negatives in coverage detection affecting deployment decisions |

## Summary

The coverage comparison logic in CoverageEnforcer uses a simplistic key generation strategy that doesn't handle null/undefined schemas, special characters in names, or case sensitivity issues. This could lead to incorrect coverage calculations where tests exist but aren't matched, or where different objects are incorrectly considered the same.

## Details

### Root Cause

The key generation uses simple string concatenation without normalization or validation:

```javascript
const key = `${item.schema}.${item.name}.${item.type}`;
```

### Example

```mermaid
graph TD
    A[Coverage Item] --> B{Has Schema?}
    B -->|Yes| C[Use Schema]
    B -->|No| D[Schema = undefined]
    D --> E[Key = "undefined.table.type"]
    C --> F[Key = "schema.table.type"]
    E --> G[Map Lookup]
    F --> G
    G --> H{Match Found?}
    H -->|No due to undefined| I[False Negative]
    H -->|Yes| J[Coverage Detected]
```

Problem scenarios:

```javascript
// These should match but won't:
item1 = { schema: null, name: 'users', type: 'table' }
item2 = { schema: 'public', name: 'users', type: 'table' }
key1 = 'null.users.table'
key2 = 'public.users.table'  // Different keys!

// These shouldn't match but might:
item3 = { schema: 'public', name: 'user.posts', type: 'table' }
item4 = { schema: 'public.user', name: 'posts', type: 'table' }
key3 = 'public.user.posts.table'
key4 = 'public.user.posts.table'  // Same key!
```

## Proposed Solution

Implement robust key normalization with proper escaping:

```javascript
generateCoverageKey(item) {
  // Normalize schema (default to 'public' per PostgreSQL convention)
  const schema = (item.schema || 'public').toLowerCase().trim();
  
  // Normalize name and type
  const name = item.name.toLowerCase().trim();
  const type = item.type.toLowerCase().trim();
  
  // Use separator that won't appear in identifiers
  const separator = '::';
  
  // Escape any separator sequences in the components
  const escapedSchema = schema.replace(/::/g, '\\:\\:');
  const escapedName = name.replace(/::/g, '\\:\\:');
  const escapedType = type.replace(/::/g, '\\:\\:');
  
  return `${escapedSchema}${separator}${escapedName}${separator}${escapedType}`;
}

// Update comparison method
compareCoverage(requirements, coverage) {
  const coverageLookup = new Map();
  coverage.forEach(item => {
    const key = this.generateCoverageKey(item);
    if (!coverageLookup.has(key)) {
      coverageLookup.set(key, []);
    }
    coverageLookup.get(key).push(item);
  });
  
  // ... rest of comparison logic
}
```

### Known Unknowns

- Should we handle case-sensitive vs case-insensitive matching?
- How should quoted identifiers be handled?
- What about schema-qualified names in the name field itself?

### Unknown Unknowns

- Are there PostgreSQL identifier edge cases we haven't considered?
- How do different collations affect string comparison?
- Could Unicode characters in identifiers cause issues?

___

_"One of the most difficult concepts to accept is the existence of randomness. The human mind seeks patterns, even where none exist." - Data, Star Trek: The Next Generation, "Peak Performance"_
