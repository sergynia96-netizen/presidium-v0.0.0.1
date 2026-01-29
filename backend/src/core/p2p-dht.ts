/**
 * P2P DHT (Distributed Hash Table) for Peer Discovery
 * 
 * Реализует Kademlia DHT для обнаружения пиров в сети
 */

import { createHash, randomBytes } from 'crypto';
import { logger } from '../utils/logger';

const dhtLogger = logger.createChild({ module: 'p2p-dht' });

export interface DHTNode {
  id: string;
  address: string;
  port: number;
  lastSeen: number;
  distance?: number;
}

export interface DHTBucket {
  nodes: DHTNode[];
  lastUpdated: number;
}

/**
 * Kademlia DHT Implementation
 */
export class DHT {
  private nodeId: string;
  private kBucketSize: number = 20; // Kademlia bucket size
  private alpha: number = 3; // Concurrency parameter
  private buckets: Map<number, DHTBucket> = new Map();
  private knownNodes: Map<string, DHTNode> = new Map();
  private bootstrapNodes: DHTNode[] = [];

  constructor(nodeId: string, bootstrapNodes: Array<{ address: string; port: number; id?: string }> = []) {
    this.nodeId = nodeId;
    
    // Initialize bootstrap nodes
    this.bootstrapNodes = bootstrapNodes.map(node => ({
      id: node.id || this.generateNodeId(),
      address: node.address,
      port: node.port,
      lastSeen: Date.now(),
    }));

    // Initialize buckets (160 buckets for 160-bit IDs)
    for (let i = 0; i < 160; i++) {
      this.buckets.set(i, {
        nodes: [],
        lastUpdated: Date.now(),
      });
    }

    dhtLogger.info('DHT initialized', { nodeId, bootstrapNodes: this.bootstrapNodes.length });
  }

  /**
   * Generate node ID from address/port or random
   */
  private generateNodeId(): string {
    return createHash('sha256').update(randomBytes(32)).digest('hex');
  }

  /**
   * Normalize node ID to valid hex string (hash if not valid hex)
   */
  private normalizeNodeId(nodeId: string): string {
    // Check if already valid 64-char hex
    if (/^[a-f0-9]{64}$/i.test(nodeId)) {
      return nodeId.toLowerCase();
    }
    // Hash non-hex IDs to get valid hex
    return createHash('sha256').update(nodeId).digest('hex');
  }

  /**
   * Calculate XOR distance between two node IDs
   */
  private distance(nodeId1: string, nodeId2: string): bigint {
    const id1 = BigInt('0x' + this.normalizeNodeId(nodeId1));
    const id2 = BigInt('0x' + this.normalizeNodeId(nodeId2));
    return id1 ^ id2;
  }

  /**
   * Calculate bucket index for a node ID
   */
  private getBucketIndex(targetId: string): number {
    const dist = this.distance(this.nodeId, targetId);
    if (dist === 0n) return 159; // Same node
    return 159 - dist.toString(2).length + 1;
  }

  /**
   * Add node to routing table
   */
  addNode(node: DHTNode): void {
    if (node.id === this.nodeId) {
      return; // Don't add ourselves
    }

    const bucketIndex = this.getBucketIndex(node.id);
    const bucket = this.buckets.get(bucketIndex);

    if (!bucket) return;

    // Check if node already exists
    const existingIndex = bucket.nodes.findIndex(n => n.id === node.id);
    if (existingIndex >= 0) {
      // Move to end (most recently seen)
      const existing = bucket.nodes[existingIndex];
      existing.lastSeen = Date.now();
      bucket.nodes.splice(existingIndex, 1);
      bucket.nodes.push(existing);
    } else if (bucket.nodes.length < this.kBucketSize) {
      // Add if bucket not full
      node.distance = Number(this.distance(this.nodeId, node.id));
      bucket.nodes.push(node);
      bucket.lastUpdated = Date.now();
    } else {
      // Replace oldest if bucket is full
      const oldestIndex = bucket.nodes.findIndex(n => 
        n.lastSeen === Math.min(...bucket.nodes.map(n => n.lastSeen))
      );
      if (oldestIndex >= 0) {
        const oldest = bucket.nodes[oldestIndex];
        // Only replace if new node was seen recently
        if (Date.now() - oldest.lastSeen > 3600000) { // 1 hour
          bucket.nodes[oldestIndex] = {
            ...node,
            distance: Number(this.distance(this.nodeId, node.id)),
          };
          bucket.lastUpdated = Date.now();
        }
      }
    }

    this.knownNodes.set(node.id, node);
    dhtLogger.debug(`Added node to bucket ${bucketIndex}: ${node.id}`);
  }

  /**
   * Find k closest nodes to target ID
   */
  findClosestNodes(targetId: string, k: number = this.kBucketSize): DHTNode[] {
    const allNodes: DHTNode[] = [];
    
    for (const bucket of this.buckets.values()) {
      allNodes.push(...bucket.nodes);
    }

    // Sort by distance to target
    allNodes.forEach(node => {
      node.distance = Number(this.distance(targetId, node.id));
    });

    return allNodes
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, k)
      .filter(node => node.id !== this.nodeId);
  }

  /**
   * Bootstrap from known nodes
   */
  async bootstrap(): Promise<void> {
    dhtLogger.info('Bootstrapping DHT...', {
      bootstrapNodes: this.bootstrapNodes.length,
      nodeId: this.nodeId.substring(0, 16) + '...',
    });

    // Add bootstrap nodes
    for (const node of this.bootstrapNodes) {
      try {
        this.addNode(node);
      } catch (error) {
        dhtLogger.warn(`Failed to add bootstrap node ${node.id}`, error);
      }
    }

    // Try to discover more nodes from bootstrap nodes
    // In real implementation, would send FIND_NODE requests to discover more peers
    // For now, we just add bootstrap nodes to routing table
    
    const stats = this.getStats();
    dhtLogger.info('✅ DHT bootstrap complete', { 
      nodes: stats.totalNodes,
      buckets: stats.bucketsUsed,
      bootstrapNodes: stats.bootstrapNodes,
    });
  }

  /**
   * Lookup node by ID
   */
  lookupNode(targetId: string): DHTNode | null {
    return this.knownNodes.get(targetId) || null;
  }

  /**
   * Get random nodes for peer discovery
   */
  getRandomNodes(count: number = 10): DHTNode[] {
    const allNodes = Array.from(this.knownNodes.values());
    const shuffled = allNodes.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, allNodes.length));
  }

  /**
   * Remove node
   */
  removeNode(nodeId: string): void {
    const node = this.knownNodes.get(nodeId);
    if (!node) return;

    const bucketIndex = this.getBucketIndex(nodeId);
    const bucket = this.buckets.get(bucketIndex);
    
    if (bucket) {
      bucket.nodes = bucket.nodes.filter(n => n.id !== nodeId);
      bucket.lastUpdated = Date.now();
    }

    this.knownNodes.delete(nodeId);
    dhtLogger.debug(`Removed node: ${nodeId}`);
  }

  /**
   * Get all known nodes
   */
  getAllNodes(): DHTNode[] {
    return Array.from(this.knownNodes.values());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalNodes: number;
    bucketsUsed: number;
    bootstrapNodes: number;
  } {
    return {
      totalNodes: this.knownNodes.size,
      bucketsUsed: Array.from(this.buckets.values()).filter(b => b.nodes.length > 0).length,
      bootstrapNodes: this.bootstrapNodes.length,
    };
  }
}
