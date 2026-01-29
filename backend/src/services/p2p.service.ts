/**
 * P2P Service - Manages P2P network connections and nodes
 */

import { P2PNode, P2PNetwork } from '../types/system.types';
import { randomUUID } from 'crypto';

export class P2PService {
  private static nodes: Map<string, P2PNode> = new Map();
  private static readonly MAX_SLOTS = 10;

  /**
   * Initialize P2P service with mock nodes
   */
  static initialize() {
    // Create 12 mock P2P nodes
    const mockNodes: P2PNode[] = [];
    for (let i = 1; i <= 12; i++) {
      mockNodes.push({
        id: randomUUID(),
        address: `192.168.1.${100 + i}`,
        port: 4000 + i,
        publicKey: `pubkey_${i}_${Date.now()}`,
        lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        status: Math.random() > 0.3 ? 'online' : 'offline',
        latency: Math.random() * 100 + 10,
        version: '1.0.0'
      });
    }
    mockNodes.forEach(node => this.nodes.set(node.id, node));
  }

  /**
   * Get P2P network status
   */
  static getNetworkStatus(): P2PNetwork {
    const allNodes = Array.from(this.nodes.values());
    const connectedNodes = allNodes.filter(n => n.status === 'online');
    const activeSessions = Math.floor(Math.random() * 7) + 5;

    return {
      totalNodes: allNodes.length,
      connectedNodes: connectedNodes.length,
      activeSessions: activeSessions,
      maxSlots: this.MAX_SLOTS,
      nodes: allNodes.slice(0, 12) // Return up to 12 nodes
    };
  }

  /**
   * Get specific node by ID
   */
  static getNode(nodeId: string): P2PNode | null {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Add or update node
   */
  static upsertNode(node: P2PNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Remove node
   */
  static removeNode(nodeId: string): boolean {
    return this.nodes.delete(nodeId);
  }

  /**
   * Get connected nodes count
   */
  static getConnectedCount(): number {
    return Array.from(this.nodes.values()).filter(n => n.status === 'online').length;
  }
}

// Initialize on module load
P2PService.initialize();

