/**
 * CRDT (Conflict-free Replicated Data Type) Synchronization
 * 
 * Реализация CRDT для синхронизации состояния без конфликтов между узлами
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import {
  CRDTOperation,
  CRDTState,
  CRDTEntry,
  VectorClock,
  CRDTConfig,
} from '../models/types';
import { logger } from '../utils/logger';

const crdtLogger = logger.createChild({ module: 'crdt' });

/**
 * CRDT Node - основной класс для CRDT синхронизации
 */
export class CRDTNode {
  private state: CRDTState;
  private config: CRDTConfig;
  private lamportClock: number = 0;
  private garbageCollectionInterval: NodeJS.Timeout | null = null;

  constructor(config: CRDTConfig) {
    this.config = config;
    this.state = {
      data: new Map<string, CRDTEntry>(),
      nodeId: config.nodeId,
      operations: [],
      vectorClock: {},
    };

    // Initialize vector clock for this node
    this.state.vectorClock[config.nodeId] = 0;

    // Start garbage collection
    this.startGarbageCollection();
  }

  /**
   * Increment Lamport clock
   */
  private tick(): number {
    this.lamportClock++;
    this.state.vectorClock[this.config.nodeId] = this.lamportClock;
    return this.lamportClock;
  }

  /**
   * Update vector clock from remote operation
   */
  private updateVectorClock(remoteVectorClock: VectorClock): void {
    Object.entries(remoteVectorClock).forEach(([nodeId, clock]) => {
      const currentClock = this.state.vectorClock[nodeId] || 0;
      this.state.vectorClock[nodeId] = Math.max(currentClock, clock);
    });
  }

  /**
   * Compare vector clocks (happens-before relation)
   */
  private compareVectorClocks(vc1: VectorClock, vc2: VectorClock): 'before' | 'after' | 'concurrent' {
    let vc1Less = false;
    let vc2Less = false;

    const allNodes = new Set([...Object.keys(vc1), ...Object.keys(vc2)]);

    for (const nodeId of allNodes) {
      const c1 = vc1[nodeId] || 0;
      const c2 = vc2[nodeId] || 0;

      if (c1 < c2) vc1Less = true;
      if (c2 < c1) vc2Less = true;
    }

    if (vc1Less && !vc2Less) return 'before';
    if (vc2Less && !vc1Less) return 'after';
    return 'concurrent';
  }

  /**
   * Generate hash for operation
   */
  private hashOperation(operation: Omit<CRDTOperation, 'hash'>): string {
    const str = JSON.stringify({
      nodeId: operation.nodeId,
      timestamp: operation.timestamp,
      lamportClock: operation.lamportClock,
      type: operation.type,
      key: operation.key,
      value: operation.value,
    });
    return createHash('sha256').update(str).digest('hex');
  }

  /**
   * Set a value in CRDT Map
   */
  set(key: string, value: any): CRDTOperation {
    const lamportClock = this.tick();
    const timestamp = Date.now();

    const operation: Omit<CRDTOperation, 'hash'> = {
      nodeId: this.config.nodeId,
      timestamp,
      lamportClock,
      type: 'set',
      key,
      value,
      vectorClock: { ...this.state.vectorClock },
    };

    const hash = this.hashOperation(operation);
    const fullOperation: CRDTOperation = { ...operation, hash };

    // Apply operation locally
    this.applyOperation(fullOperation);

    // Store operation
    this.state.operations.push(fullOperation);
    if (this.state.operations.length > this.config.maxOperations) {
      this.state.operations.shift(); // Remove oldest
    }

    crdtLogger.debug(`Set key "${key}"`, { lamportClock, hash: hash.substring(0, 8) });
    return fullOperation;
  }

  /**
   * Get a value from CRDT Map
   */
  get(key: string): any | null {
    const entry = this.state.data.get(key);
    if (!entry || entry.tombstone) {
      return null;
    }
    return entry.value;
  }

  /**
   * Delete a value (tombstone marking)
   */
  delete(key: string): CRDTOperation {
    const lamportClock = this.tick();
    const timestamp = Date.now();

    const operation: Omit<CRDTOperation, 'hash'> = {
      nodeId: this.config.nodeId,
      timestamp,
      lamportClock,
      type: 'delete',
      key,
      vectorClock: { ...this.state.vectorClock },
    };

    const hash = this.hashOperation(operation);
    const fullOperation: CRDTOperation = { ...operation, hash };

    // Apply operation locally
    this.applyOperation(fullOperation);

    // Store operation
    this.state.operations.push(fullOperation);
    if (this.state.operations.length > this.config.maxOperations) {
      this.state.operations.shift();
    }

    crdtLogger.debug(`Delete key "${key}"`, { lamportClock, hash: hash.substring(0, 8) });
    return fullOperation;
  }

  /**
   * Apply an operation to local state
   */
  private applyOperation(operation: CRDTOperation): void {
    // Update vector clock
    this.updateVectorClock(operation.vectorClock);

    const existing = this.state.data.get(operation.key);

    if (operation.type === 'delete') {
      if (existing) {
        // Mark as tombstone if remote clock is after or concurrent
        const comparison = existing.vectorClock
          ? this.compareVectorClocks(existing.vectorClock, operation.vectorClock)
          : 'before';

        if (comparison === 'before' || comparison === 'concurrent') {
          existing.tombstone = true;
          existing.lastModified = operation.timestamp;
          existing.modifiedBy = operation.nodeId;
          existing.vectorClock = { ...operation.vectorClock };
        }
      } else {
        // Create tombstone entry
        this.state.data.set(operation.key, {
          value: null,
          vectorClock: { ...operation.vectorClock },
          tombstone: true,
          lastModified: operation.timestamp,
          modifiedBy: operation.nodeId,
        });
      }
    } else if (operation.type === 'set') {
      if (!existing) {
        // New entry
        this.state.data.set(operation.key, {
          value: operation.value,
          vectorClock: { ...operation.vectorClock },
          tombstone: false,
          lastModified: operation.timestamp,
          modifiedBy: operation.nodeId,
        });
      } else {
        // Conflict resolution: choose based on vector clock
        const comparison = existing.vectorClock
          ? this.compareVectorClocks(existing.vectorClock, operation.vectorClock)
          : 'before';

        if (comparison === 'before' || comparison === 'concurrent') {
          // Deterministic conflict resolution:
          // 1. Higher lamport clock wins
          // 2. If equal, lexicographically smaller nodeId wins (deterministic)
          const existingLamport = existing.vectorClock?.[existing.modifiedBy] || 0;
          const shouldUpdate = 
            operation.lamportClock > existingLamport ||
            (operation.lamportClock === existingLamport && 
             operation.nodeId < existing.modifiedBy); // Lexicographic comparison for determinism
          
          if (shouldUpdate) {
            existing.value = operation.value;
            existing.vectorClock = { ...operation.vectorClock };
            existing.lastModified = operation.timestamp;
            existing.modifiedBy = operation.nodeId;
            existing.tombstone = false;
          }
        }
      }
    }
  }

  /**
   * Merge remote operations
   */
  merge(remoteOperations: CRDTOperation[]): number {
    let mergedCount = 0;

    for (const operation of remoteOperations) {
      // Verify hash
      const expectedHash = this.hashOperation(operation);
      if (operation.hash !== expectedHash) {
        crdtLogger.warn('Invalid operation hash', { hash: operation.hash.substring(0, 8) });
        continue;
      }

      // Check if we already have this operation
      const exists = this.state.operations.some(op => op.hash === operation.hash);
      if (exists) {
        continue; // Skip duplicate
      }

      // Apply operation
      this.applyOperation(operation);

      // Store operation
      this.state.operations.push(operation);
      mergedCount++;
    }

    // Trim operations if needed
    if (this.state.operations.length > this.config.maxOperations) {
      const excess = this.state.operations.length - this.config.maxOperations;
      this.state.operations.splice(0, excess);
    }

    crdtLogger.info(`Merged ${mergedCount} operations`, { total: this.state.operations.length });
    return mergedCount;
  }

  /**
   * Get changes since last vector clock
   */
  getChangesSince(lastVectorClock: VectorClock): CRDTOperation[] {
    const changes: CRDTOperation[] = [];

    for (const operation of this.state.operations) {
      // Check if operation is newer than last vector clock
      const comparison = this.compareVectorClocks(lastVectorClock, operation.vectorClock);
      if (comparison === 'before' || comparison === 'concurrent') {
        changes.push(operation);
      }
    }

    return changes;
  }

  /**
   * Apply remote changes
   */
  applyRemoteChanges(changes: CRDTOperation[]): void {
    this.merge(changes);
  }

  /**
   * Get full operation history
   */
  getHistory(): CRDTOperation[] {
    return [...this.state.operations];
  }

  /**
   * Get current state snapshot
   */
  getState(): CRDTState {
    return {
      data: new Map(this.state.data),
      nodeId: this.state.nodeId,
      operations: [...this.state.operations],
      vectorClock: { ...this.state.vectorClock },
    };
  }

  /**
   * Get current vector clock
   */
  getVectorClock(): VectorClock {
    return { ...this.state.vectorClock };
  }

  /**
   * Start garbage collection for tombstones
   */
  private startGarbageCollection(): void {
    this.garbageCollectionInterval = setInterval(() => {
      this.collectGarbage();
    }, this.config.garbageCollectionInterval);
  }

  /**
   * Remove old tombstones
   */
  private collectGarbage(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.state.data.entries()) {
      if (entry.tombstone && entry.lastModified) {
        const age = now - entry.lastModified;
        if (age > this.config.tombstoneLifetime) {
          toDelete.push(key);
        }
      }
    }

    for (const key of toDelete) {
      this.state.data.delete(key);
    }

    if (toDelete.length > 0) {
      crdtLogger.info(`Garbage collected ${toDelete.length} tombstones`);
    }
  }

  /**
   * Serialize state for transmission
   */
  serialize(): string {
    const serializable = {
      data: Array.from(this.state.data.entries()).map(([key, entry]) => [
        key,
        {
          value: entry.value,
          vectorClock: entry.vectorClock,
          tombstone: entry.tombstone || false,
          lastModified: entry.lastModified,
          modifiedBy: entry.modifiedBy,
        },
      ]),
      nodeId: this.state.nodeId,
      operations: this.state.operations,
      vectorClock: this.state.vectorClock,
    };
    return JSON.stringify(serializable);
  }

  /**
   * Deserialize state from transmission
   */
  static deserialize(data: string, config: CRDTConfig): CRDTNode {
    const parsed = JSON.parse(data);
    const node = new CRDTNode(config);

    // Restore data
    for (const [key, entry] of parsed.data) {
      node.state.data.set(key, entry as CRDTEntry);
    }

    // Restore operations
    node.state.operations = parsed.operations as CRDTOperation[];

    // Restore vector clock
    node.state.vectorClock = parsed.vectorClock as VectorClock;

    // Restore lamport clock
    node.lamportClock = parsed.vectorClock[config.nodeId] || 0;

    return node;
  }

  /**
   * Check if node is synced with another node
   */
  isSyncedWith(otherVectorClock: VectorClock): boolean {
    for (const [nodeId, clock] of Object.entries(otherVectorClock)) {
      const ourClock = this.state.vectorClock[nodeId] || 0;
      if (ourClock < clock) {
        return false;
      }
    }
    return true;
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.garbageCollectionInterval) {
      clearInterval(this.garbageCollectionInterval);
      this.garbageCollectionInterval = null;
    }
    crdtLogger.info('CRDT node shutdown');
  }
}

