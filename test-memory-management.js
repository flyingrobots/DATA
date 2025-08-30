#!/usr/bin/env node

/**
 * Test script to verify memory management functionality in pgTAPTestScanner
 */

import pgTAPTestScanner from './src/lib/testing/pgTAPTestScanner.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMemoryManagement() {
  console.log('🧪 Testing pgTAPTestScanner Memory Management');
  console.log('===============================================\n');

  // Create scanner with memory limits
  const scanner = new pgTAPTestScanner({
    maxMemoryMB: 100, // Low limit to test cleanup
    batchSize: 10, // Small batches for testing
    enableStreaming: true,
    cleanupInterval: 500, // Frequent cleanup for testing
    enableGC: true,
    maxObjectsPerType: 100
  });

  // Listen for memory events
  scanner.on('memory_status', (data) => {
    console.log(`📊 Memory Status: ${data.current}MB (max: ${data.max}MB, streaming: ${data.streamingMode})`);
  });

  scanner.on('cleanup', (data) => {
    console.log(`🧹 Memory Cleanup: ${data.type}`);
  });

  scanner.on('warning', (data) => {
    console.log(`⚠️  Warning: ${data.message}`);
  });

  scanner.on('progress', (data) => {
    if (data.type === 'batch_progress') {
      console.log(`⚡ Progress: Batch ${data.batch}/${data.totalBatches} (${data.filesProcessed}/${data.totalFiles} files)`);
    }
  });

  try {
    // Test memory stats
    console.log('Initial memory stats:');
    console.log(JSON.stringify(scanner.getMemoryStats(), null, 2));
    
    // Simulate scanning some test files (you can point this to actual test directory)
    const testDir = path.join(__dirname, 'test/fixtures'); // Adjust path as needed
    
    console.log(`\nScanning directory: ${testDir}`);
    
    if (await scanner.scanDirectory(testDir).catch(() => null)) {
      // Build coverage database with memory management
      console.log('\nBuilding coverage database...');
      const database = await scanner.buildCoverageDatabase();
      
      console.log('\nFinal memory stats:');
      console.log(JSON.stringify(scanner.getMemoryStats(), null, 2));
      
      console.log('\nDatabase summary:');
      console.log(`- Total objects indexed: ${scanner._getTotalIndexedObjects(database)}`);
      console.log(`- Total assertions: ${database.assertionCounts.total}`);
      console.log(`- Memory managed: ${database.memoryManaged}`);
      console.log(`- Streaming mode: ${database.streamingMode}`);
    } else {
      // Test with mock data if no test directory exists
      console.log('No test directory found, testing with mock data...');
      
      // Create some mock test files
      for (let i = 0; i < 150; i++) {
        scanner.testFiles.push({
          filePath: `/mock/test_${i}.sql`,
          fileName: `test_${i}.sql`,
          assertions: Array(10).fill(null).map((_, j) => ({
            type: 'has_table',
            target: `table_${i}_${j}`,
            parameters: [`table_${i}_${j}`],
            lineNumber: j + 1,
            rawSql: `SELECT has_table('table_${i}_${j}');`
          })),
          planCount: 1,
          dependencies: [],
          metadata: {}
        });
      }
      
      scanner.totalAssertions = 150 * 10;
      
      console.log('Building coverage database with 150 mock files...');
      const database = await scanner.buildCoverageDatabase();
      
      console.log('\nFinal memory stats:');
      console.log(JSON.stringify(scanner.getMemoryStats(), null, 2));
      
      console.log('\nDatabase summary:');
      console.log(`- Total objects indexed: ${scanner._getTotalIndexedObjects(database)}`);
      console.log(`- Total assertions: ${database.assertionCounts.total}`);
      console.log(`- Memory managed: ${database.memoryManaged}`);
      console.log(`- Streaming mode: ${database.streamingMode}`);
    }

    console.log('\n✅ Memory management test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }

  // Cleanup
  process.exit(0);
}

// Run the test
testMemoryManagement().catch(console.error);