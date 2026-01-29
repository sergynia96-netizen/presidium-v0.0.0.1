/**
 * P2P WebRTC Signaling Server
 * 
 * Signaling сервер для обмена SDP/ICE кандидатами между пирами
 * Поддерживает прямой обмен сообщениями через WebRTC DataChannels
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { randomUUID, createHash } from 'crypto';
import { logger } from '../utils/logger';
import { PQCCrypto } from './pqc-crypto';
import { DHT, DHTNode } from './p2p-dht';

const signalingLogger = logger.createChild({ module: 'p2p-signaling' });

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-join' | 'peer-leave' | 'peer-list' | 'ping' | 'pong';
  from: string;
  to?: string;
  data: any;
  timestamp: number;
}

export interface PeerInfo {
  id: string;
  publicKey?: string;
  connected: boolean;
  lastSeen: number;
}

export interface PeerConnection {
  id: string;
  ws: WebSocket;
  peerId: string;
  publicKey?: string;
  connectedAt: number;
  lastPing: number;
}

/**
 * WebRTC Signaling Server
 */
export class WebRTCSignalingServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, PeerConnection> = new Map();
  private peerRegistry: Map<string, PeerInfo> = new Map();
  private port: number;
  private pingInterval: NodeJS.Timeout | null = null;
  private crypto: PQCCrypto | null = null;
  private dht: DHT | null = null;
  private nodeId: string;
  private dhtBootstrapInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3001, crypto?: PQCCrypto, bootstrapNodes: Array<{ address: string; port: number; id?: string }> = [], sharedDHT?: DHT) {
    this.port = port;
    this.crypto = crypto || null;
    this.nodeId = this.generateNodeId();
    
    // Use shared DHT if provided, otherwise create new one
    if (sharedDHT) {
      this.dht = sharedDHT;
      signalingLogger.info('Using shared DHT instance');
    } else {
      // Initialize DHT
      this.dht = new DHT(this.nodeId, bootstrapNodes);
      this.dht.bootstrap().catch(err => {
        signalingLogger.error('DHT bootstrap failed:', err);
      });
    }
  }

  /**
   * Initialize signaling server
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({
      server,
      path: '/p2p-signaling',
      perMessageDeflate: false,
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Start ping interval to keep connections alive
    this.startPingInterval();

    // Start DHT bootstrap interval
    this.startDHTBootstrap();

    signalingLogger.info(`WebRTC Signaling server initialized on port ${this.port}`, {
      nodeId: this.nodeId,
      dhtNodes: this.dht?.getStats().totalNodes || 0,
    });
  }

  /**
   * Handle new connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = randomUUID();
    const peerId = this.generatePeerId();
    const clientAddress = request.socket.remoteAddress || 'unknown';

    const connection: PeerConnection = {
      id: connectionId,
      ws,
      peerId,
      connectedAt: Date.now(),
      lastPing: Date.now(),
    };

    this.connections.set(connectionId, connection);

    // Register peer
    const peerInfo: PeerInfo = {
      id: peerId,
      connected: true,
      lastSeen: Date.now(),
    };
    this.peerRegistry.set(peerId, peerInfo);

    // Add to DHT
    if (this.dht && clientAddress !== 'unknown') {
      const dhtNode: DHTNode = {
        id: peerId,
        address: clientAddress,
        port: this.port,
        lastSeen: Date.now(),
      };
      this.dht.addNode(dhtNode);
    }

    signalingLogger.info(`New peer connected: ${peerId}`, {
      connectionId,
      ip: request.socket.remoteAddress,
    });

    // Send welcome message with peer ID
    this.sendToPeer(connectionId, {
      type: 'peer-join',
      from: 'signaling-server',
      data: {
        peerId,
        timestamp: Date.now(),
        peers: this.getPeerList(),
      },
      timestamp: Date.now(),
    });

    // Notify other peers about new peer
    this.broadcastToOthers(connectionId, {
      type: 'peer-join',
      from: 'signaling-server',
      data: {
        peerId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    // Send peer list to new connection
    this.sendPeerList(connectionId);

    // Register peer in DHT
    if (this.dht) {
      try {
        // Extract IP address from connection if available
        const remoteAddress = (ws as any)._socket?.remoteAddress || 'localhost';
        const dhtNode: DHTNode = {
          id: peerId,
          address: remoteAddress,
          port: this.port,
          lastSeen: Date.now(),
        };
        this.dht.addNode(dhtNode);
        signalingLogger.debug(`Registered peer ${peerId} in DHT`);
      } catch (error) {
        signalingLogger.error(`Failed to register peer in DHT: ${peerId}`, error);
      }
    }

    // Handle messages
    ws.on('message', (data: Buffer) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        this.handleMessage(connectionId, message);
      } catch (error) {
        signalingLogger.error('Failed to parse signaling message', error);
      }
    });

    // Handle close
    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    // Handle error
    ws.on('error', (error) => {
      signalingLogger.error(`WebSocket error for peer ${peerId}`, error);
      this.handleDisconnection(connectionId);
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, message: SignalingMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastPing = Date.now();

    // Update peer registry
    const peerInfo = this.peerRegistry.get(connection.peerId);
    if (peerInfo) {
      peerInfo.lastSeen = Date.now();
    }

    switch (message.type) {
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // Forward signaling messages to target peer
        this.forwardToPeer(message.to!, message);
        break;

      case 'ping':
        // Respond to ping
        this.sendToPeer(connectionId, {
          type: 'pong',
          from: 'signaling-server',
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
        });
        break;

      case 'peer-list':
        // Send peer list
        this.sendPeerList(connectionId);
        break;

      default:
        signalingLogger.debug(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Forward message to specific peer
   */
  private forwardToPeer(targetPeerId: string, message: SignalingMessage): void {
    const targetConnection = Array.from(this.connections.values()).find(
      (conn) => conn.peerId === targetPeerId
    );

    if (targetConnection) {
      this.sendToConnection(targetConnection.id, message);
    } else {
      signalingLogger.warn(`Target peer not found: ${targetPeerId}`);
    }
  }

  /**
   * Send peer list to connection
   */
  private sendPeerList(connectionId: string): void {
    const peers = this.getPeerList();
    
    // Get additional peers from DHT for peer discovery
    let dhtPeers: PeerInfo[] = [];
    if (this.dht) {
      const dhtNodes = this.dht.getRandomNodes(10);
      dhtPeers = dhtNodes.map(node => ({
        id: node.id,
        connected: false,
        lastSeen: node.lastSeen,
      }));
    }
    
    // Combine peers from registry and DHT (avoid duplicates)
    const allPeers = [...peers, ...dhtPeers.filter(p => !peers.find(ep => ep.id === p.id))];
    
    this.sendToPeer(connectionId, {
      type: 'peer-list',
      from: 'signaling-server',
      data: { peers: allPeers },
      timestamp: Date.now(),
    });
  }

  /**
   * Get list of connected peers
   */
  private getPeerList(): PeerInfo[] {
    return Array.from(this.peerRegistry.values()).filter((p) => p.connected);
  }

  /**
   * Broadcast message to all other peers
   */
  private broadcastToOthers(excludeConnectionId: string, message: SignalingMessage): void {
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connectionId !== excludeConnectionId && connection.ws.readyState === WebSocket.OPEN) {
        this.sendToConnection(connectionId, message);
      }
    }
  }

  /**
   * Send message to peer by connection ID
   */
  private sendToPeer(connectionId: string, message: SignalingMessage): void {
    this.sendToConnection(connectionId, message);
  }

  /**
   * Send message to connection
   */
  private sendToConnection(connectionId: string, message: SignalingMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      signalingLogger.error(`Failed to send message to ${connectionId}`, error);
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const peerId = connection.peerId;

    // Mark peer as disconnected
    const peerInfo = this.peerRegistry.get(peerId);
    if (peerInfo) {
      peerInfo.connected = false;
    }

    // Remove connection
    this.connections.delete(connectionId);

    signalingLogger.info(`Peer disconnected: ${peerId}`);

    // Notify other peers
    this.broadcastToOthers(connectionId, {
      type: 'peer-leave',
      from: 'signaling-server',
      data: {
        peerId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds

      for (const [connectionId, connection] of this.connections.entries()) {
        if (now - connection.lastPing > timeout) {
          signalingLogger.warn(`Peer ${connection.peerId} timeout, closing connection`);
          connection.ws.close();
          this.handleDisconnection(connectionId);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping
          this.sendToConnection(connectionId, {
            type: 'ping',
            from: 'signaling-server',
            data: { timestamp: now },
            timestamp: now,
          });
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Generate unique peer ID
   */
  private generatePeerId(): string {
    return `peer-${randomUUID()}`;
  }

  /**
   * Generate node ID for DHT
   */
  private generateNodeId(): string {
    return createHash('sha256').update(`${Date.now()}-${randomUUID()}`).digest('hex');
  }

  /**
   * Start DHT bootstrap interval
   */
  private startDHTBootstrap(): void {
    this.dhtBootstrapInterval = setInterval(() => {
      if (this.dht) {
        // Periodically bootstrap DHT
        this.dht.bootstrap().catch(err => {
          signalingLogger.error('DHT bootstrap error:', err);
        });

        // Update DHT with current connected peers
        for (const [peerId, peerInfo] of this.peerRegistry.entries()) {
          if (peerInfo.connected) {
            const connection = Array.from(this.connections.values()).find(c => c.peerId === peerId);
            if (connection) {
              const dhtNode: DHTNode = {
                id: peerId,
                address: 'local', // Will be updated when we get actual address
                port: this.port,
                lastSeen: peerInfo.lastSeen,
              };
              this.dht.addNode(dhtNode);
            }
          }
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Get stats
   */
  getStats(): {
    connections: number;
    peers: number;
    connectedPeers: number;
    dhtNodes?: number;
    dhtBuckets?: number;
  } {
    const dhtStats = this.dht?.getStats();
    return {
      connections: this.connections.size,
      peers: this.peerRegistry.size,
      connectedPeers: Array.from(this.peerRegistry.values()).filter((p) => p.connected).length,
      dhtNodes: dhtStats?.totalNodes || 0,
      dhtBuckets: dhtStats?.bucketsUsed || 0,
    };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    if (this.dhtBootstrapInterval) {
      clearInterval(this.dhtBootstrapInterval);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
    }

    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
    }

    signalingLogger.info('WebRTC Signaling server shutdown');
  }
}
