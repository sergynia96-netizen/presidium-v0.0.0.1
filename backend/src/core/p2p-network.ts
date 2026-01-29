/**
 * P2P Network Protocol
 * 
 * Децентрализованный P2P протокол для синхронизации между узлами
 */

import * as dgram from 'dgram';
import * as net from 'net';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { Peer, P2PMessage, NetworkStats, P2PConfig } from '../models/types';
import { logger } from '../utils/logger';
import { PQCCrypto } from './pqc-crypto';
import { getConfig } from '../utils/config';

const p2pLogger = logger.createChild({ module: 'p2p' });

/**
 * P2P Node Class
 */
export class P2PNode {
  private config: P2PConfig;
  private nodeId: string;
  private peers: Map<string, Peer> = new Map();
  private udpSocket: dgram.Socket | null = null;
  private tcpServer: net.Server | null = null;
  private tcpConnections: Map<string, net.Socket> = new Map();
  private stats: NetworkStats;
  private crypto: PQCCrypto | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: P2PConfig, nodeId: string, crypto?: PQCCrypto) {
    this.config = config;
    this.nodeId = nodeId;
    this.crypto = crypto || null;

    this.stats = {
      peersConnected: 0,
      peersTotal: 0,
      messagesIn: 0,
      messagesOut: 0,
      bytesIn: 0,
      bytesOut: 0,
      avgLatency: 0,
      uptime: 0,
    };

    this.startTime = Date.now();
  }

  private startTime: number = 0;

  /**
   * Initialize P2P node
   */
  async initialize(): Promise<void> {
    // Start UDP socket for peer discovery
    this.udpSocket = dgram.createSocket('udp4');
    this.udpSocket.on('message', (msg, rinfo) => this.handleUDPMessage(msg, rinfo));
    this.udpSocket.bind(this.config.port);

    // Start TCP server for reliable connections
    this.tcpServer = net.createServer((socket) => this.handleTCPConnection(socket));
    this.tcpServer.listen(this.config.port + 1);

    // Connect to bootstrap nodes
    for (const bootstrapNode of this.config.bootstrapNodes) {
      await this.connectToPeer(bootstrapNode, bootstrapNode, this.config.port);
    }

    // Start heartbeat
    this.startHeartbeat();

    p2pLogger.info(`P2P node initialized`, { nodeId: this.nodeId, port: this.config.port });
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(peerId: string, address: string, port: number): Promise<boolean> {
    if (this.peers.has(peerId)) {
      return true; // Already connected
    }

    if (this.peers.size >= this.config.maxPeers) {
      p2pLogger.warn(`Max peers reached (${this.config.maxPeers})`);
      return false;
    }

    try {
      const socket = new net.Socket();
      
      await new Promise<void>((resolve, reject) => {
        socket.connect(port + 1, address, () => {
          this.tcpConnections.set(peerId, socket);
          const peer: Peer = {
            id: peerId,
            address,
            port,
            connected: true,
            latency: 0,
            lastSeen: Date.now(),
            version: '1.0.0',
          };
          this.peers.set(peerId, peer);
          this.stats.peersConnected = this.peers.size;
          this.stats.peersTotal = this.peers.size;

          socket.on('data', (data) => this.handleTCPMessage(peerId, data));
          socket.on('close', () => this.handleDisconnection(peerId));
          socket.on('error', (error) => {
            p2pLogger.error(`Peer connection error: ${peerId}`, error);
            this.handleDisconnection(peerId);
          });

          p2pLogger.info(`Connected to peer ${peerId}`, { address, port });
          resolve();
        });

        socket.on('error', reject);
        socket.setTimeout(5000, () => reject(new Error('Connection timeout')));
      });

      return true;
    } catch (error) {
      p2pLogger.error(`Failed to connect to peer ${peerId}`, error);
      this.scheduleReconnect(peerId, address, port);
      return false;
    }
  }

  /**
   * Handle TCP connection
   */
  private handleTCPConnection(socket: net.Socket): void {
    // Identify peer when connection is established
    socket.once('data', (data) => {
      try {
        const message: P2PMessage = JSON.parse(data.toString());
        const peerId = message.fromNodeId;

        if (peerId && !this.peers.has(peerId)) {
          const peer: Peer = {
            id: peerId,
            address: socket.remoteAddress || 'unknown',
            port: socket.remotePort || 0,
            connected: true,
            latency: 0,
            lastSeen: Date.now(),
            version: '1.0.0',
          };
          this.peers.set(peerId, peer);
          this.tcpConnections.set(peerId, socket);
          this.stats.peersConnected = this.peers.size;
        }

        // Handle the message
        this.handleTCPMessage(peerId, data);
      } catch (error) {
        p2pLogger.error('Failed to parse TCP message', error);
      }
    });

    socket.on('data', (data) => {
      // Handle subsequent messages
      const peerId = Array.from(this.tcpConnections.entries()).find(([_, s]) => s === socket)?.[0];
      if (peerId) {
        this.handleTCPMessage(peerId, data);
      }
    });
  }

  /**
   * Handle TCP message
   */
  private handleTCPMessage(peerId: string, data: Buffer): void {
    try {
      const message: P2PMessage = JSON.parse(data.toString());
      this.processMessage(message, peerId);
    } catch (error) {
      p2pLogger.error('Failed to parse TCP message', error);
    }
  }

  /**
   * Handle UDP message
   */
  private handleUDPMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const message: P2PMessage = JSON.parse(msg.toString());
      this.processMessage(message, message.fromNodeId);
    } catch (error) {
      p2pLogger.error('Failed to parse UDP message', error);
    }
  }

  /**
   * Process incoming message
   */
  private processMessage(message: P2PMessage, peerId: string): void {
    // Update peer stats
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
    }

    // Update stats
    this.stats.messagesIn++;
    this.stats.bytesIn += JSON.stringify(message).length;

    // Handle message types
    switch (message.type) {
      case 'HEARTBEAT':
        this.handleHeartbeat(message, peerId);
        break;
      case 'SYNC':
        this.handleSync(message, peerId);
        break;
      case 'CRDT_OP':
        this.handleCRDTOperation(message, peerId);
        break;
      case 'DATA':
        this.handleData(message, peerId);
        break;
      case 'QUERY':
        this.handleQuery(message, peerId);
        break;
      case 'PEER_DISCOVERY':
        this.handlePeerDiscovery(message, peerId);
        break;
    }
  }

  /**
   * Send message to peer
   */
  async sendMessage(peerId: string, message: Omit<P2PMessage, 'fromNodeId' | 'timestamp' | 'nonce' | 'signature'>): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.connected) {
      return false;
    }

    const fullMessage: P2PMessage = {
      ...message,
      fromNodeId: this.nodeId,
      timestamp: Date.now(),
      nonce: randomUUID(),
      signature: '', // TODO: Sign with Dilithium
    };

    // Sign message if crypto is available
    if (this.crypto && this.crypto.getNodeKeyPair(this.nodeId)) {
      const signed = await this.crypto.signMessage(fullMessage, this.nodeId);
      fullMessage.signature = Buffer.from(signed.signature).toString('base64');
    }

    const socket = this.tcpConnections.get(peerId);
    if (!socket) {
      return false;
    }

    try {
      const data = JSON.stringify(fullMessage);
      socket.write(data);
      
      this.stats.messagesOut++;
      this.stats.bytesOut += data.length;
      return true;
    } catch (error) {
      p2pLogger.error(`Failed to send message to ${peerId}`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all peers
   */
  async broadcast(message: Omit<P2PMessage, 'fromNodeId' | 'timestamp' | 'nonce' | 'signature'>): Promise<number> {
    let sent = 0;
    for (const peerId of this.peers.keys()) {
      if (await this.sendMessage(peerId, message)) {
        sent++;
      }
    }
    return sent;
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(message: P2PMessage, peerId: string): void {
    // Respond with pong
    this.sendMessage(peerId, {
      type: 'HEARTBEAT',
      data: { pong: true },
    });

    // Update latency
    const peer = this.peers.get(peerId);
    if (peer && message.data?.timestamp) {
      const latency = Date.now() - message.data.timestamp;
      peer.latency = latency;
      this.updateAverageLatency();
    }
  }

  /**
   * Handle sync request
   */
  private handleSync(message: P2PMessage, peerId: string): void {
    // TODO: Send CRDT changes
    p2pLogger.debug(`Sync request from ${peerId}`);
  }

  /**
   * Handle CRDT operation
   */
  private handleCRDTOperation(message: P2PMessage, peerId: string): void {
    // TODO: Apply CRDT operation
    p2pLogger.debug(`CRDT operation from ${peerId}`, { data: message.data });
  }

  /**
   * Handle data message
   */
  private handleData(message: P2PMessage, peerId: string): void {
    // TODO: Handle data
    p2pLogger.debug(`Data message from ${peerId}`);
  }

  /**
   * Handle query
   */
  private handleQuery(message: P2PMessage, peerId: string): void {
    // TODO: Handle query
    p2pLogger.debug(`Query from ${peerId}`);
  }

  /**
   * Handle peer discovery
   */
  private handlePeerDiscovery(message: P2PMessage, peerId: string): void {
    // TODO: Share peer list
    p2pLogger.debug(`Peer discovery from ${peerId}`);
  }

  /**
   * Start heartbeat loop
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({
        type: 'HEARTBEAT',
        data: { timestamp: Date.now() },
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connected = false;
      this.tcpConnections.delete(peerId);
      this.stats.peersConnected = Array.from(this.peers.values()).filter(p => p.connected).length;
      
      p2pLogger.warn(`Peer disconnected: ${peerId}`);
      
      // Schedule reconnect
      this.scheduleReconnect(peerId, peer.address, peer.port);
    }
  }

  /**
   * Schedule reconnect with exponential backoff
   */
  private scheduleReconnect(peerId: string, address: string, port: number): void {
    // Clear existing timer
    const existingTimer = this.reconnectTimers.get(peerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate backoff (simplified)
    const attempts = this.peers.get(peerId)?.lastSeen || 0;
    const delay = Math.min(this.config.reconnectDelay * Math.pow(2, attempts), 60000); // Max 60s

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(peerId);
      await this.connectToPeer(peerId, address, port);
    }, delay);

    this.reconnectTimers.set(peerId, timer);
  }

  /**
   * Update average latency
   */
  private updateAverageLatency(): void {
    const connectedPeers = Array.from(this.peers.values()).filter(p => p.connected && p.latency > 0);
    if (connectedPeers.length > 0) {
      const totalLatency = connectedPeers.reduce((sum, p) => sum + p.latency, 0);
      this.stats.avgLatency = totalLatency / connectedPeers.length;
    }
  }

  /**
   * Get peer list
   */
  getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): Peer | null {
    return this.peers.get(peerId) || null;
  }

  /**
   * Get network statistics
   */
  getStats(): NetworkStats {
    this.stats.uptime = Date.now() - this.startTime;
    return { ...this.stats };
  }

  /**
   * Disconnect from peer
   */
  disconnectPeer(peerId: string): void {
    const socket = this.tcpConnections.get(peerId);
    if (socket) {
      socket.end();
      this.tcpConnections.delete(peerId);
    }

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connected = false;
      this.stats.peersConnected = Array.from(this.peers.values()).filter(p => p.connected).length;
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Clear reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }

    // Close all connections
    for (const socket of this.tcpConnections.values()) {
      socket.end();
    }

    // Close UDP socket
    if (this.udpSocket) {
      try {
        this.udpSocket.close();
      } catch (error) {
        // Socket might already be closed
        p2pLogger.debug('UDP socket already closed or error closing', error);
      }
    }

    // Close TCP server
    if (this.tcpServer) {
      await new Promise<void>((resolve) => {
        this.tcpServer!.close(() => resolve());
      });
    }

    p2pLogger.info('P2P node shutdown');
  }
}

