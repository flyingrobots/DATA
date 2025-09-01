import path from 'path';

// Test basic functionality
try {
  console.log('Loading scanner...');
  import pgTAPTestScanner from './src/lib/testing/pgTAPTestScanner.js';

  console.log('Creating scanner instance...');
  const scanner = new pgTAPTestScanner({ validatePlans: false });

  console.log('Testing has_function with parameters...');
  const sql = "SELECT has_function('user_count', ARRAY['integer', 'text']);";
  const assertions = scanner.extractAssertions(sql);

  console.log('Raw parameters:', assertions[0].parameters);
  console.log('Function metadata:', JSON.stringify(assertions[0].functionMetadata, null, 2));

  console.log('✅ Test completed successfully');
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}
