-- pgTAP test for users table
BEGIN;
SELECT plan(3);

-- Test table exists
SELECT has_table('users');

-- Test columns exist
SELECT has_column('users', 'id');
SELECT has_column('users', 'email');

SELECT * FROM finish();
ROLLBACK;