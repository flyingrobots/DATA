import { afterAll, afterEach } from 'vitest';

// Track all connections globally
const globalConnections = new Set();

// Enhanced afterEach cleanup
afterEach(async () => {
  // Close any connections created during the test
  for (const connection of globalConnections) {
    try {
      if (connection && typeof connection.end === 'function') {
        await connection.end();
      }
      if (connection && typeof connection.close === 'function') {
        await connection.close();
      }
    } catch (error) {
      console.warn('Failed to close connection in afterEach:', error.message);
    }
  }
  globalConnections.clear();

  // Clear any remaining timers
  if (typeof global.clearAllTimers === 'function') {
    global.clearAllTimers();
  }
});

// Ensure all database connections are closed after tests
afterAll(async () => {
  try {
    // Close any open database connections
    if (global.dbConnection) {
      await global.dbConnection.end();
    }

    // Close any Supabase clients
    if (global.supabaseClient) {
      global.supabaseClient = null;
    }

    // Close any remaining connections
    for (const connection of globalConnections) {
      try {
        if (connection && typeof connection.end === 'function') {
          await connection.end();
        }
      } catch (error) {
        console.warn('Failed to close connection in afterAll:', error.message);
      }
    }
  } finally {
    // Force exit after longer timeout to prevent hanging
    setTimeout(() => {
      console.warn('Force exiting due to hanging resources');
      process.exit(0);
    }, 2000).unref(); // Use unref() to not keep process alive
  }
});

// Export helper to track connections
export function trackConnection(connection) {
  globalConnections.add(connection);
  return connection;
}
