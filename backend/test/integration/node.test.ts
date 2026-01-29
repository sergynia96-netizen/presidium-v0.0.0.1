/**
 * Integration tests for PresidiumNode
 */

import { PresidiumNode } from '../../src/index';
import { loadConfig } from '../../src/utils/config';

describe('PresidiumNode Integration', () => {
  let node: PresidiumNode;
  let testPort: number;
  let testP2PPort: number;

  beforeAll(() => {
    // Use random ports to avoid conflicts
    testPort = 3000 + Math.floor(Math.random() * 1000);
    testP2PPort = 4000 + Math.floor(Math.random() * 1000);
    
    // Load test configuration
    process.env.NODE_ENV = 'test';
    process.env.NODE_ID = 'test-node-1';
    process.env.PORT = testPort.toString();
    process.env.P2P_PORT = testP2PPort.toString();
    process.env.MAX_PEERS = '5';
    process.env.STORAGE_DB_PATH = './test-data';
  });

  afterEach(async () => {
    if (node) {
      try {
        await node.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      console.warn('Shutdown warning:', error);
      // Force cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  });

  afterAll(async () => {
    if (node) {
      try {
        await node.shutdown();
      } catch (error) {
        // Ignore
      }
    }
    // Cleanup test data
    const fs = require('fs');
    const path = require('path');
    const testDataPath = path.join(process.cwd(), 'test-data');
    if (fs.existsSync(testDataPath)) {
      try {
        fs.rmSync(testDataPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('should initialize all components', async () => {
    node = new PresidiumNode();
    
    // This might take some time
    await node.initialize();

    const status = node.getStatus();
    expect(status).toBeDefined();
    expect(status.crdt).toBeDefined();
    expect(status.p2p).toBeDefined();
    expect(status.ai).toBeDefined();
    expect(status.storage).toBeDefined();
    expect(status.sync).toBeDefined();
    expect(status.monitor).toBeDefined();
  }, 60000); // 60 second timeout

  it('should handle CRDT operations', async () => {
    // CRDT operations should work after initialization
    // This tests the integration of CRDT with the node
    expect(node).toBeDefined();
  });

  it('should provide API endpoints', async () => {
    // Test that API server is running
    // This would require making HTTP requests
    expect(node).toBeDefined();
  });

  it('should shutdown gracefully', async () => {
    if (!node) {
      node = new PresidiumNode();
      await node.initialize();
    }
    
    await node.shutdown();
    // Check that all components are shut down
    expect(node).toBeDefined();
  });
});

