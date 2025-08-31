const test = require("node:test");
const assert = require("node:assert");
const DiffEngine = require("../build/lib/DiffEngine");

test("DiffEngine - Class Structure and Instantiation", async (t) => {
  await t.test("should instantiate DiffEngine successfully", () => {
    const engine = new DiffEngine();
    assert(engine instanceof DiffEngine, "Should be instance of DiffEngine");
    assert(
      typeof engine.generateDiff === "function",
      "Should have generateDiff method",
    );
    assert(
      typeof engine.getLastDiff === "function",
      "Should have getLastDiff method",
    );
    assert(
      typeof engine.isGenerating === "function",
      "Should have isGenerating method",
    );
  });

  await t.test("should accept configuration in constructor", () => {
    const config = {
      includeData: true,
      excludeSchemas: ["test_schema"],
      customOption: "test",
    };
    const engine = new DiffEngine(config);

    assert(
      engine.config.includeData === true,
      "Should accept includeData config",
    );
    assert(
      Array.isArray(engine.config.excludeSchemas),
      "Should have excludeSchemas array",
    );
    assert(
      engine.config.excludeSchemas.includes("test_schema"),
      "Should include custom schema",
    );
    assert(
      engine.config.customOption === "test",
      "Should accept custom options",
    );
  });

  await t.test("should have default configuration values", () => {
    const engine = new DiffEngine();

    assert(
      engine.config.includeData === false,
      "Default includeData should be false",
    );
    assert(
      Array.isArray(engine.config.excludeSchemas),
      "Should have default excludeSchemas",
    );
    assert(
      engine.config.includeDropStatements === true,
      "Default includeDropStatements should be true",
    );
    assert(
      engine.config.sortOutput === true,
      "Default sortOutput should be true",
    );
  });
});

test("DiffEngine - EventEmitter Functionality", async (t) => {
  await t.test("should emit start event when generateDiff begins", async () => {
    const engine = new DiffEngine();
    let startEventReceived = false;
    let startEventData = null;

    engine.on("start", (data) => {
      startEventReceived = true;
      startEventData = data;
    });

    const mockCurrentDb = { host: "localhost", database: "test_current" };
    const mockDesiredDb = { host: "localhost", database: "test_desired" };

    try {
      await engine.generateDiff(mockCurrentDb, mockDesiredDb);
    } catch (error) {
      // Expected to complete without actual diff logic
    }

    assert(startEventReceived, "Start event should be emitted");
    assert(startEventData !== null, "Start event should include data");
    assert(
      startEventData.currentDb !== null,
      "Start event should include currentDb info",
    );
    assert(
      startEventData.desiredDb !== null,
      "Start event should include desiredDb info",
    );
    assert(
      startEventData.timestamp instanceof Date,
      "Start event should include timestamp",
    );
  });

  await t.test("should emit progress events during processing", async () => {
    const engine = new DiffEngine();
    const progressEvents = [];

    engine.on("progress", (data) => {
      progressEvents.push(data);
    });

    const mockCurrentDb = { host: "localhost", database: "test_current" };
    const mockDesiredDb = { host: "localhost", database: "test_desired" };

    await engine.generateDiff(mockCurrentDb, mockDesiredDb);

    assert(
      progressEvents.length > 0,
      "Should emit at least one progress event",
    );

    const initEvent = progressEvents.find((e) => e.step === "initializing");
    assert(initEvent !== undefined, "Should emit initializing progress event");
    assert(
      typeof initEvent.message === "string",
      "Progress event should include message",
    );
    assert(
      initEvent.timestamp instanceof Date,
      "Progress event should include timestamp",
    );
  });

  await t.test(
    "should emit complete event when generateDiff finishes",
    async () => {
      const engine = new DiffEngine();
      let completeEventReceived = false;
      let completeEventData = null;

      engine.on("complete", (data) => {
        completeEventReceived = true;
        completeEventData = data;
      });

      const mockCurrentDb = { host: "localhost", database: "test_current" };
      const mockDesiredDb = { host: "localhost", database: "test_desired" };

      await engine.generateDiff(mockCurrentDb, mockDesiredDb);

      assert(completeEventReceived, "Complete event should be emitted");
      assert(
        completeEventData.diff !== null,
        "Complete event should include diff result",
      );
      assert(
        typeof completeEventData.duration === "number",
        "Complete event should include duration",
      );
      assert(
        completeEventData.timestamp instanceof Date,
        "Complete event should include timestamp",
      );
    },
  );

  await t.test("should emit error event on validation failures", async () => {
    const engine = new DiffEngine();
    let errorEventReceived = false;
    let errorEventData = null;

    engine.on("error", (data) => {
      errorEventReceived = true;
      errorEventData = data;
    });

    try {
      await engine.generateDiff(null, null);
      assert.fail("Should have thrown an error");
    } catch (error) {
      // Expected error
    }

    assert(errorEventReceived, "Error event should be emitted");
    assert(
      errorEventData.error instanceof Error,
      "Error event should include error object",
    );
    assert(
      typeof errorEventData.message === "string",
      "Error event should include message",
    );
    assert(
      errorEventData.timestamp instanceof Date,
      "Error event should include timestamp",
    );
  });
});

test("DiffEngine - State Management", async (t) => {
  await t.test("should track running state correctly", async () => {
    const engine = new DiffEngine();

    assert(engine.isGenerating() === false, "Should not be running initially");

    const mockCurrentDb = { host: "localhost", database: "test_current" };
    const mockDesiredDb = { host: "localhost", database: "test_desired" };

    const diffPromise = engine.generateDiff(mockCurrentDb, mockDesiredDb);

    // Note: Due to async nature, we can't reliably test isRunning === true
    // in the middle of execution, but we can test the final state

    await diffPromise;
    assert(
      engine.isGenerating() === false,
      "Should not be running after completion",
    );
  });

  await t.test("should prevent concurrent diff generation", async () => {
    const engine = new DiffEngine();

    const mockCurrentDb = { host: "localhost", database: "test_current" };
    const mockDesiredDb = { host: "localhost", database: "test_desired" };

    // Manually set isRunning to simulate a running diff
    engine.isRunning = true;

    let secondDiffError = null;
    try {
      await engine.generateDiff(mockCurrentDb, mockDesiredDb);
      assert.fail("Should have thrown an error for concurrent execution");
    } catch (error) {
      secondDiffError = error;
    }

    // Reset the running state
    engine.isRunning = false;

    // Verify the concurrent execution was prevented
    assert(secondDiffError !== null, "Should have caught an error");
    assert(
      secondDiffError.message.includes("already running"),
      "Should indicate engine is already running",
    );
  });

  await t.test("should store and return last diff result", async () => {
    const engine = new DiffEngine();

    assert(engine.getLastDiff() === null, "Should return null initially");

    const mockCurrentDb = { host: "localhost", database: "test_current" };
    const mockDesiredDb = { host: "localhost", database: "test_desired" };

    const result = await engine.generateDiff(mockCurrentDb, mockDesiredDb);

    assert(engine.getLastDiff() !== null, "Should store last diff result");
    assert.deepStrictEqual(
      engine.getLastDiff(),
      result,
      "Should return the same result object",
    );
  });
});
