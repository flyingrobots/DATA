/**
 * @fileoverview Data validation pgTAP test patterns
 * Pure data structures - no I/O, no dependencies
 */

export const dataPatterns = [
  {
    id: 'table_exists',
    category: 'structure',
    description: 'Verify table exists',
    placeholders: ['schema', 'table'],
    template: `
      SELECT plan(1);
      SELECT has_table('{{schema}}', '{{table}}');
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'column_exists',
    category: 'structure',
    description: 'Verify column exists in table',
    placeholders: ['schema', 'table', 'column'],
    template: `
      SELECT plan(1);
      SELECT has_column('{{schema}}', '{{table}}', '{{column}}');
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'column_type_check',
    category: 'structure',
    description: 'Verify column has correct type',
    placeholders: ['schema', 'table', 'column', 'type'],
    template: `
      SELECT plan(1);
      SELECT col_type_is('{{schema}}', '{{table}}', '{{column}}', '{{type}}');
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'not_null_constraint',
    category: 'constraint',
    description: 'Verify column has NOT NULL constraint',
    placeholders: ['schema', 'table', 'column'],
    template: `
      SELECT plan(1);
      SELECT col_not_null('{{schema}}', '{{table}}', '{{column}}');
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'default_value_check',
    category: 'constraint',
    description: 'Verify column has default value',
    placeholders: ['schema', 'table', 'column', 'default_value'],
    template: `
      SELECT plan(2);
      SELECT col_has_default('{{schema}}', '{{table}}', '{{column}}');
      SELECT col_default_is('{{schema}}', '{{table}}', '{{column}}', {{default_value}});
      SELECT finish();
    `,
    difficulty: 'intermediate'
  },

  {
    id: 'primary_key_check',
    category: 'constraint',
    description: 'Verify primary key exists',
    placeholders: ['schema', 'table', 'columns'],
    template: `
      SELECT plan(2);
      SELECT has_pk('{{schema}}', '{{table}}');
      SELECT col_is_pk('{{schema}}', '{{table}}', ARRAY[{{columns}}]);
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'foreign_key_check',
    category: 'constraint',
    description: 'Verify foreign key relationship',
    placeholders: ['schema', 'table', 'column', 'ref_schema', 'ref_table', 'ref_column'],
    template: `
      SELECT plan(2);
      SELECT has_fk('{{schema}}', '{{table}}', '{{column}}');
      SELECT fk_ok(
        '{{schema}}', '{{table}}', '{{column}}',
        '{{ref_schema}}', '{{ref_table}}', '{{ref_column}}'
      );
      SELECT finish();
    `,
    difficulty: 'intermediate'
  },

  {
    id: 'unique_constraint_check',
    category: 'constraint',
    description: 'Verify unique constraint exists',
    placeholders: ['schema', 'table', 'constraint_name'],
    template: `
      SELECT plan(1);
      SELECT has_unique('{{schema}}', '{{table}}', '{{constraint_name}}');
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'check_constraint_validation',
    category: 'constraint',
    description: 'Verify check constraint exists and works',
    placeholders: ['schema', 'table', 'constraint_name', 'valid_insert', 'invalid_insert'],
    template: `
      SELECT plan(3);
      SELECT has_check('{{schema}}', '{{table}}', '{{constraint_name}}');
      
      -- Test valid data passes
      SELECT lives_ok(
        '{{valid_insert}}',
        'Valid data passes check constraint'
      );
      
      -- Test invalid data fails
      SELECT throws_ok(
        '{{invalid_insert}}',
        '23514',
        'new row for relation',
        'Invalid data violates check constraint'
      );
      
      SELECT finish();
    `,
    difficulty: 'advanced',
    bestPractices: ['Test both valid and invalid cases for constraints']
  },

  {
    id: 'data_type_conversion_test',
    category: 'data',
    description: 'Test data type conversion after ALTER COLUMN TYPE',
    placeholders: ['schema', 'table', 'column', 'old_type', 'new_type'],
    template: `
      SELECT plan(3);
      
      -- Verify new type
      SELECT col_type_is('{{schema}}', '{{table}}', '{{column}}', '{{new_type}}');
      
      -- Test data integrity
      SELECT is(
        (SELECT COUNT(*) FROM {{schema}}.{{table}} WHERE {{column}} IS NOT NULL),
        (SELECT COUNT(*) FROM {{schema}}.{{table}}),
        'No NULL values introduced during type conversion'
      );
      
      -- Test data validity
      SELECT ok(
        NOT EXISTS (
          SELECT 1 FROM {{schema}}.{{table}} 
          WHERE pg_typeof({{column}})::text != '{{new_type}}'
        ),
        'All values successfully converted to {{new_type}}'
      );
      
      SELECT finish();
    `,
    difficulty: 'advanced'
  },

  {
    id: 'cascade_delete_test',
    category: 'data',
    description: 'Test CASCADE delete behavior',
    placeholders: ['parent_table', 'child_table', 'parent_id', 'child_fk_column'],
    template: `
      SELECT plan(2);
      
      -- Insert test data
      INSERT INTO {{parent_table}} (id) VALUES ({{parent_id}});
      INSERT INTO {{child_table}} ({{child_fk_column}}) VALUES ({{parent_id}});
      
      -- Delete parent and verify cascade
      DELETE FROM {{parent_table}} WHERE id = {{parent_id}};
      
      SELECT is(
        (SELECT COUNT(*) FROM {{child_table}} WHERE {{child_fk_column}} = {{parent_id}}),
        0::bigint,
        'Child records deleted via CASCADE'
      );
      
      SELECT finish();
    `,
    difficulty: 'intermediate',
    bestPractices: ['Always test CASCADE behavior with actual data']
  }
];
