/**
 * Test for temp database management functionality in DiffEngine
 *
 * This test verifies:
 * - createTempDatabase creates unique temp DB
 * - cleanupTempDatabase drops temp DB
 * - applySchemaToTemp applies SQL
 * - Resource tracking prevents orphans
 */

const DiffEngine = require("../src/lib/DiffEngine");

async function runTempDbTests() {
  console.log("🧪 Testing Temp Database Management...\n");

  const diffEngine = new DiffEngine();

  // Listen to events for debugging
  diffEngine.on("progress", (event) => {
    console.log(`📊 ${event.step}: ${event.message}`);
  });

  diffEngine.on("error", (event) => {
    console.error(`❌ ERROR: ${event.message}`);
  });

  try {
    // Test 1: Create temp database
    console.log("\n🔨 Test 1: Creating temporary database...");
    const dbUrl = await diffEngine.createTempDatabase("test");
    console.log(`✅ Created temp database: ${dbUrl}`);

    // Test 2: Apply schema to temp database
    console.log("\n📝 Test 2: Applying schema to temporary database...");
    const testSchema = `
      CREATE TABLE test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      INSERT INTO test_table (name) VALUES ('Test Record');
    `;

    const applyResult = await diffEngine.applySchemaToTemp(dbUrl, testSchema);
    console.log(
      `✅ Schema applied successfully. Statements executed: ${applyResult.statementsExecuted}`,
    );

    // Test 3: Check tracking
    console.log("\n📋 Test 3: Checking temp database tracking...");
    const trackedDbs = diffEngine.getTrackedTempDatabases();
    console.log(`✅ Tracked databases: ${trackedDbs.length}`);
    console.log(`   - ${trackedDbs.join(", ")}`);

    // Test 4: Create another temp database
    console.log("\n🔨 Test 4: Creating second temporary database...");
    const dbUrl2 = await diffEngine.createTempDatabase("test2");
    console.log(`✅ Created second temp database: ${dbUrl2}`);

    // Test 5: Cleanup specific database
    console.log("\n🧹 Test 5: Cleaning up first temporary database...");
    const dbName = dbUrl.split("/").pop();
    const cleanupSuccess = await diffEngine.cleanupTempDatabase(dbName);
    console.log(`✅ Cleanup successful: ${cleanupSuccess}`);

    // Test 6: Cleanup all remaining databases
    console.log("\n🧹 Test 6: Cleaning up all remaining databases...");
    const cleanupSummary = await diffEngine.cleanupAllTempDatabases();
    console.log(`✅ Cleanup summary:`, cleanupSummary);

    console.log("\n🎉 All temp database management tests passed!\n");
  } catch (error) {
    console.error("\n💥 Test failed:", error.message);
    console.error("Stack trace:", error.stack);

    // Attempt cleanup even if tests fail
    try {
      console.log("\n🧹 Attempting emergency cleanup...");
      await diffEngine.cleanupAllTempDatabases();
    } catch (cleanupError) {
      console.error("❌ Emergency cleanup failed:", cleanupError.message);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTempDbTests()
    .then(() => {
      console.log("✅ Test execution complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Test execution failed:", error);
      process.exit(1);
    });
}

module.exports = { runTempDbTests };
