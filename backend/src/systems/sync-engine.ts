/**
 * Sync Engine
 * 
 * Движок синхронизации для CRDT операций
 */

import { CRDTNode } from '../core/crdt';
import { SyncState, SyncOperation, CRDTOperation, VectorClock } from '../models/types';
import { logger } from '../utils/logger';

const syncLogger = logger.createChild({ module: 'sync' });

/**
 * Sync Engine Class
 * 
 * Управляет синхронизацией CRDT операций между узлами
 */
export class SyncEngine {
  private crdt: CRDTNode;
  private state: SyncState;
  private pendingChanges: CRDTOperation[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  private syncCallbacks: Array<(state: SyncState) => void> = [];

  constructor(crdt: CRDTNode) {
    this.crdt = crdt;
    this.state = {
      status: 'OK',
      lastSync: Date.now(),
      changesPending: 0,
      conflictCount: 0,
      peersInSync: 0,
    };

    // Start sync loop
    this.startSyncLoop();
  }

  /**
   * Start sync loop (incremental sync every 5 seconds)
   */
  private startSyncLoop(): void {
    this.syncInterval = setInterval(() => {
      this.performIncrementalSync();
    }, 5000); // 5 seconds
  }

  /**
   * Track a change
   */
  trackChange(operation: CRDTOperation): void {
    this.pendingChanges.push(operation);
    this.state.changesPending = this.pendingChanges.length;
    this.state.status = 'PENDING';
    this.notifyCallbacks();
    syncLogger.debug('Change tracked', { key: operation.key, type: operation.type });
  }

  /**
   * Broadcast changes to peers
   * 
   * NOTE: В реальной реализации это будет отправлено через P2P сеть
   */
  broadcastChanges(peerIds: string[]): CRDTOperation[] {
    const changes = [...this.pendingChanges];
    this.pendingChanges = [];
    this.state.changesPending = 0;

    if (changes.length > 0) {
      syncLogger.info(`Broadcasting ${changes.length} changes to ${peerIds.length} peers`);
    }

    return changes;
  }

  /**
   * Apply remote changes
   */
  applyRemoteChanges(changes: CRDTOperation[], fromNodeId: string): void {
    if (changes.length === 0) return;

    const beforeVectorClock = this.crdt.getVectorClock();
    const mergedCount = this.crdt.merge(changes);
    const afterVectorClock = this.crdt.getVectorClock();

    // Check for conflicts
    let conflicts = 0;
    for (const change of changes) {
      const comparison = this.compareVectorClocks(beforeVectorClock, change.vectorClock);
      if (comparison === 'concurrent') {
        conflicts++;
      }
    }

    if (conflicts > 0) {
      this.state.status = 'CONFLICT';
      this.state.conflictCount += conflicts;
      syncLogger.warn(`Applied ${mergedCount} changes with ${conflicts} conflicts from ${fromNodeId}`);
    } else {
      this.state.status = 'OK';
      syncLogger.info(`Applied ${mergedCount} changes from ${fromNodeId}`);
    }

    this.state.lastSync = Date.now();
    this.notifyCallbacks();
  }

  /**
   * Compare vector clocks
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
   * Perform incremental sync
   */
  private performIncrementalSync(): void {
    if (this.pendingChanges.length === 0) {
      if (this.state.status !== 'OK') {
        this.state.status = 'OK';
        this.notifyCallbacks();
      }
      return;
    }

    // In real implementation, this would sync with peers
    // For now, just mark as pending
    this.state.status = 'PENDING';
    this.notifyCallbacks();
  }

  /**
   * Get sync state
   */
  getState(): SyncState {
    this.state.changesPending = this.pendingChanges.length;
    this.state.lastSync = this.lastSyncTime || Date.now();
    return { ...this.state };
  }

  /**
   * Get changes since last sync
   */
  getChangesSince(lastVectorClock: VectorClock): CRDTOperation[] {
    return this.crdt.getChangesSince(lastVectorClock);
  }

  /**
   * Force full sync
   */
  async forceFullSync(peerIds: string[]): Promise<void> {
    syncLogger.info(`Forcing full sync with ${peerIds.length} peers`);

    const currentVectorClock = this.crdt.getVectorClock();
    const changes = this.crdt.getChangesSince({});

    // Broadcast all changes
    if (changes.length > 0) {
      this.broadcastChanges(peerIds);
    }

    this.state.status = 'OK';
    this.state.lastSync = Date.now();
    this.notifyCallbacks();
  }

  /**
   * Subscribe to sync state changes
   */
  onSyncStateChange(callback: (state: SyncState) => void): () => void {
    this.syncCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.syncCallbacks.indexOf(callback);
      if (index > -1) {
        this.syncCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify callbacks
   */
  private notifyCallbacks(): void {
    const state = this.getState();
    this.syncCallbacks.forEach(callback => callback(state));
  }

  /**
   * Update peers in sync count
   */
  updatePeersInSync(count: number): void {
    this.state.peersInSync = count;
    this.notifyCallbacks();
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.syncCallbacks = [];
    syncLogger.info('Sync engine shutdown');
  }
}

