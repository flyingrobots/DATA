/**
 * @fileoverview Performance testing pgTAP patterns
 * Pure data structures - no I/O, no dependencies
 */

export const performancePatterns = [
  {
    id: 'index_exists',
    category: 'performance',
    description: 'Verify index exists on table',
    placeholders: ['schema', 'table', 'index_name'],
    template: `
      SELECT plan(1);
      SELECT has_index('{{schema}}', '{{table}}', '{{index_name}}');
      SELECT finish();
    `,
    difficulty: 'basic'
  },

  {
    id: 'index_type_check',
    category: 'performance',
    description: 'Verify index has correct type',
    placeholders: ['schema', 'table', 'index_name', 'index_type'],
    template: `
      SELECT plan(1);
      SELECT index_is_type('{{schema}}', '{{table}}', '{{index_name}}', '{{index_type}}');
      SELECT finish();
    `,
    difficulty: 'intermediate'
  },

  {
    id: 'query_plan_uses_index',
    category: 'performance',
    description: 'Verify query uses specific index',
    placeholders: ['query', 'index_name'],
    template: `
      SELECT plan(1);
      
      -- Get execution plan
      CREATE TEMP TABLE plan_output AS
      EXPLAIN (FORMAT JSON) {{query}};
      
      -- Check for index usage
      SELECT ok(
        EXISTS (
          SELECT 1 FROM plan_output,
          json_array_elements(plan_output::json -> 0 -> 'Plan' -> 'Plans') as subplan
          WHERE subplan::text LIKE '%{{index_name}}%'
        ),
        'Query uses index {{index_name}}'
      );
      
      DROP TABLE plan_output;
      SELECT finish();
    `,
    difficulty: 'advanced',
    bestPractices: ['Always clean up temp tables', 'Consider ANALYZE before testing plans']
  },

  {
    id: 'execution_time_threshold',
    category: 'performance',
    description: 'Verify query executes within time threshold',
    placeholders: ['query', 'max_ms'],
    template: `
      SELECT plan(1);
      
      DO $$
      DECLARE
        start_time timestamp;
        end_time timestamp;
        exec_time_ms numeric;
      BEGIN
        start_time := clock_timestamp();
        EXECUTE '{{query}}';
        end_time := clock_timestamp();
        
        exec_time_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time));
        
        PERFORM ok(
          exec_time_ms < {{max_ms}},
          format('Query executes in < {{max_ms}}ms (actual: %sms)', exec_time_ms)
        );
      END $$;
      
      SELECT finish();
    `,
    difficulty: 'advanced',
    bestPractices: ['Run multiple times to account for caching', 'Use realistic data volumes']
  },

  {
    id: 'table_size_check',
    category: 'performance',
    description: 'Monitor table size for performance implications',
    placeholders: ['schema', 'table', 'max_size_mb'],
    template: `
      SELECT plan(1);
      
      SELECT ok(
        pg_relation_size('{{schema}}.{{table}}') / 1024 / 1024 < {{max_size_mb}},
        format('Table {{table}} is under {{max_size_mb}}MB (actual: %sMB)',
          pg_relation_size('{{schema}}.{{table}}') / 1024 / 1024)
      );
      
      SELECT finish();
    `,
    difficulty: 'intermediate'
  },

  {
    id: 'vacuum_analyze_status',
    category: 'performance',
    description: 'Check table vacuum and analyze status',
    placeholders: ['schema', 'table', 'max_days_old'],
    template: `
      SELECT plan(2);
      
      -- Check last vacuum
      SELECT ok(
        COALESCE(
          EXTRACT(DAYS FROM (now() - last_vacuum)) < {{max_days_old}},
          false
        ),
        'Table vacuumed within {{max_days_old}} days'
      )
      FROM pg_stat_user_tables
      WHERE schemaname = '{{schema}}' AND tablename = '{{table}}';
      
      -- Check last analyze
      SELECT ok(
        COALESCE(
          EXTRACT(DAYS FROM (now() - last_analyze)) < {{max_days_old}},
          false
        ),
        'Table analyzed within {{max_days_old}} days'
      )
      FROM pg_stat_user_tables
      WHERE schemaname = '{{schema}}' AND tablename = '{{table}}';
      
      SELECT finish();
    `,
    difficulty: 'intermediate',
    bestPractices: ['Regular VACUUM and ANALYZE are critical for performance']
  },

  {
    id: 'concurrent_access_test',
    category: 'performance',
    description: 'Test performance under concurrent access',
    placeholders: ['schema', 'table', 'operation', 'concurrent_sessions'],
    template: `
      SELECT plan(1);
      
      -- Note: This is a simplified pattern. Real concurrent testing 
      -- typically requires external tooling like pgbench
      
      SELECT ok(
        true,
        'Concurrent access test placeholder - use pgbench for real testing'
      );
      
      -- Suggested pgbench command:
      -- pgbench -c {{concurrent_sessions}} -t 100 -f script.sql
      
      SELECT finish();
    `,
    difficulty: 'advanced',
    bestPractices: ['Use pgbench or similar for real concurrent testing']
  },

  {
    id: 'index_bloat_check',
    category: 'performance',
    description: 'Check for index bloat',
    placeholders: ['schema', 'index_name', 'max_bloat_ratio'],
    template: `
      SELECT plan(1);
      
      WITH index_bloat AS (
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_relation_size(indexrelid) AS index_size,
          pg_relation_size(indexrelid) - pg_relation_size(indexrelid, 'main') AS bloat_size
        FROM pg_stat_user_indexes
        WHERE schemaname = '{{schema}}' AND indexname = '{{index_name}}'
      )
      SELECT ok(
        COALESCE(bloat_size::numeric / NULLIF(index_size, 0) < {{max_bloat_ratio}}, true),
        format('Index bloat under {{max_bloat_ratio}} (actual: %s)',
          ROUND(bloat_size::numeric / NULLIF(index_size, 0), 2))
      )
      FROM index_bloat;
      
      SELECT finish();
    `,
    difficulty: 'advanced'
  }
];
