/**
 * Unit tests for CRDT
 */

import { CRDTNode } from '../../src/core/crdt';
import { CRDTConfig } from '../../src/models/types';
import { randomUUID } from 'crypto';

describe('CRDT', () => {
  let crdt: CRDTNode;
  let config: CRDTConfig;

  beforeEach(() => {
    config = {
      nodeId: randomUUID(),
      garbageCollectionInterval: 10000,
      tombstoneLifetime: 10000,
      maxOperations: 1000,
    };
    crdt = new CRDTNode(config);
  });

  afterEach(() => {
    crdt.shutdown();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', () => {
      const operation = crdt.set('key1', 'value1');
      expect(operation).toBeDefined();
      expect(operation.key).toBe('key1');
      expect(operation.type).toBe('set');

      const value = crdt.get('key1');
      expect(value).toBe('value1');
    });

    it('should delete a value', () => {
      crdt.set('key1', 'value1');
      const deleteOp = crdt.delete('key1');
      expect(deleteOp.type).toBe('delete');

      const value = crdt.get('key1');
      expect(value).toBeNull();
    });

    it('should handle multiple keys', () => {
      crdt.set('key1', 'value1');
      crdt.set('key2', 'value2');
      crdt.set('key3', 'value3');

      expect(crdt.get('key1')).toBe('value1');
      expect(crdt.get('key2')).toBe('value2');
      expect(crdt.get('key3')).toBe('value3');
    });
  });

  describe('Merge Operations', () => {
    it('should merge operations from another node', () => {
      // Create second CRDT node
      const config2: CRDTConfig = {
        nodeId: randomUUID(),
        garbageCollectionInterval: 10000,
        tombstoneLifetime: 10000,
        maxOperations: 1000,
      };
      const crdt2 = new CRDTNode(config2);

      // Set value in crdt2
      const operation = crdt2.set('key1', 'value1');

      // Merge into crdt
      const merged = crdt.merge([operation]);
      expect(merged).toBe(1);

      // Check value is merged
      expect(crdt.get('key1')).toBe('value1');

      crdt2.shutdown();
    });

    it('should handle concurrent writes deterministically', () => {
      const config2: CRDTConfig = {
        nodeId: randomUUID(),
        garbageCollectionInterval: 10000,
        tombstoneLifetime: 10000,
        maxOperations: 1000,
      };
      const crdt2 = new CRDTNode(config2);

      // Concurrent writes
      const op1 = crdt.set('key1', 'value1');
      const op2 = crdt2.set('key1', 'value2');

      // Merge both operations
      crdt.merge([op2]);
      crdt2.merge([op1]);

      // Both should have same value (deterministic merge)
      const value1 = crdt.get('key1');
      const value2 = crdt2.get('key1');
      
      // The value with higher lamport clock wins
      expect(value1).toBe(value2);

      crdt2.shutdown();
    });

    it('should not lose data during merge', () => {
      const config2: CRDTConfig = {
        nodeId: randomUUID(),
        garbageCollectionInterval: 10000,
        tombstoneLifetime: 10000,
        maxOperations: 1000,
      };
      const crdt2 = new CRDTNode(config2);

      // Set different keys in both nodes
      crdt.set('key1', 'value1');
      crdt.set('key2', 'value2');
      crdt2.set('key3', 'value3');
      crdt2.set('key4', 'value4');

      // Get all operations
      const ops1 = crdt.getHistory();
      const ops2 = crdt2.getHistory();

      // Merge both ways
      crdt.merge(ops2);
      crdt2.merge(ops1);

      // All values should exist
      expect(crdt.get('key1')).toBe('value1');
      expect(crdt.get('key2')).toBe('value2');
      expect(crdt.get('key3')).toBe('value3');
      expect(crdt.get('key4')).toBe('value4');

      crdt2.shutdown();
    });
  });

  describe('Vector Clock', () => {
    it('should maintain vector clock', () => {
      const vectorClock = crdt.getVectorClock();
      expect(vectorClock[config.nodeId]).toBeDefined();
      expect(vectorClock[config.nodeId]).toBeGreaterThanOrEqual(0);
    });

    it('should increment vector clock on operations', () => {
      const initialClock = crdt.getVectorClock()[config.nodeId];
      crdt.set('key1', 'value1');
      const newClock = crdt.getVectorClock()[config.nodeId];
      expect(newClock).toBeGreaterThan(initialClock);
    });
  });

  describe('Get Changes Since', () => {
    it('should return changes since vector clock', () => {
      // Set some values
      crdt.set('key1', 'value1');
      crdt.set('key2', 'value2');

      const vectorClock = crdt.getVectorClock();

      // Set more values
      crdt.set('key3', 'value3');

      // Get changes since vector clock
      const changes = crdt.getChangesSince(vectorClock);
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some(op => op.key === 'key3')).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize state', () => {
      crdt.set('key1', 'value1');
      crdt.set('key2', 'value2');

      const serialized = crdt.serialize();
      expect(serialized).toBeDefined();
      expect(typeof serialized).toBe('string');

      const deserialized = CRDTNode.deserialize(serialized, config);
      expect(deserialized.get('key1')).toBe('value1');
      expect(deserialized.get('key2')).toBe('value2');

      deserialized.shutdown();
    });
  });
});

