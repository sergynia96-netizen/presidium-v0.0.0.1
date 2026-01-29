/**
 * WebSocket Server
 * 
 * Real-time updates для metrics, peers, sync status, logs
 */

// @ts-ignore - ws types may not be available during build
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketMessage, HealthStatus, SystemMetrics, NetworkStats, SyncState } from '../models/types';
import { logger } from '../utils/logger';

const wsLogger = logger.createChild({ module: 'websocket' });

/**
 * WebSocket Connection Manager
 */
interface WSConnection {
  id: string;
  ws: WebSocket;
  connectedAt: number;
  lastPing: number;
  subscriptions: Set<string>; // 'metrics' | 'peers' | 'sync' | 'logs'
}

/**
 * WebSocket Server Class
 */
export class WebSocketServerManager {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WSConnection> = new Map();
  private port: number;
  private pingInterval: NodeJS.Timeout | null = null;
  private broadcastIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Callbacks for data providers
  private getMetricsCallback?: () => SystemMetrics;
  private getHealthCallback?: () => HealthStatus;
  private getPeersCallback?: () => any[];
  private getSyncStateCallback?: () => SyncState;
  private getNetworkStatsCallback?: () => NetworkStats;

  constructor(port: number = 3001) {
    this.port = port;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: false,
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Start ping interval
    this.startPingInterval();

    wsLogger.info(`WebSocket server initialized on port ${this.port}`);
  }

  /**
   * Handle new connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = randomUUID();
    const connection: WSConnection = {
      id: connectionId,
      ws,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      subscriptions: new Set(),
    };

    this.connections.set(connectionId, connection);

    wsLogger.info(`New WebSocket connection: ${connectionId}`, {
      ip: request.socket.remoteAddress,
    });

    // Send welcome message
    this.send(connectionId, {
      type: 'CONNECTED',
      data: {
        connectionId,
        timestamp: Date.now(),
        message: 'Connected to Presidium Control Center',
      },
      timestamp: Date.now(),
    });

    // Handle messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connectionId, message);
      } catch (error) {
        wsLogger.error('Failed to parse WebSocket message', error);
      }
    });

    // Handle close
    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    // Handle error
    ws.on('error', (error: Error) => {
      wsLogger.error(`WebSocket error for connection ${connectionId}`, error);
      this.handleDisconnection(connectionId);
    });

    // Handle pong
    ws.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.lastPing = Date.now();
      }
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    switch (message.type) {
      case 'SUBSCRIBE':
        this.handleSubscribe(connectionId, message.channels || []);
        break;

      case 'UNSUBSCRIBE':
        this.handleUnsubscribe(connectionId, message.channels || []);
        break;

      case 'PING':
        this.send(connectionId, {
          type: 'PONG',
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
        });
        break;

      default:
        wsLogger.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle subscription
   */
  private handleSubscribe(connectionId: string, channels: string[]): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    for (const channel of channels) {
      if (['metrics', 'peers', 'sync', 'logs'].includes(channel)) {
        connection.subscriptions.add(channel);
        this.startBroadcast(channel);
      }
    }

    wsLogger.debug(`Connection ${connectionId} subscribed to: ${Array.from(connection.subscriptions).join(', ')}`);
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscribe(connectionId: string, channels: string[]): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    for (const channel of channels) {
      connection.subscriptions.delete(channel);
    }

    // Stop broadcast if no subscribers
    this.checkAndStopBroadcasts();
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      for (const [id, connection] of this.connections.entries()) {
        const timeSinceLastPing = Date.now() - connection.lastPing;
        
        if (timeSinceLastPing > 60000) { // 60 seconds
          wsLogger.warn(`Connection ${id} timeout, closing`);
          connection.ws.terminate();
          this.handleDisconnection(id);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start broadcast for a channel
   */
  private startBroadcast(channel: string): void {
    if (this.broadcastIntervals.has(channel)) {
      return; // Already broadcasting
    }

    const interval = setInterval(() => {
      this.broadcastChannel(channel);
    }, this.getBroadcastInterval(channel));

    this.broadcastIntervals.set(channel, interval);
    wsLogger.debug(`Started broadcasting channel: ${channel}`);
  }

  /**
   * Get broadcast interval for channel
   */
  private getBroadcastInterval(channel: string): number {
    switch (channel) {
      case 'metrics': return 500; // Every 500ms
      case 'peers': return 5000; // Every 5s
      case 'sync': return 2000; // Every 2s
      case 'logs': return 1000; // Every 1s
      default: return 5000;
    }
  }

  /**
   * Broadcast channel data
   */
  private broadcastChannel(channel: string): void {
    const subscribers = Array.from(this.connections.values())
      .filter(conn => conn.subscriptions.has(channel));

    if (subscribers.length === 0) {
      this.checkAndStopBroadcasts();
      return;
    }

    let data: any = null;

    switch (channel) {
      case 'metrics':
        data = this.getMetricsCallback?.();
        break;
      case 'peers':
        data = { peers: this.getPeersCallback?.() || [], stats: this.getNetworkStatsCallback?.() };
        break;
      case 'sync':
        data = this.getSyncStateCallback?.();
        break;
      case 'logs':
        // Logs would be streamed differently
        return;
    }

    if (data) {
      const message: WebSocketMessage = {
        type: channel.toUpperCase() as any,
        data,
        timestamp: Date.now(),
      };

      for (const subscriber of subscribers) {
        this.send(subscriber.id, message);
      }
    }
  }

  /**
   * Check and stop broadcasts if no subscribers
   */
  private checkAndStopBroadcasts(): void {
    const channels = Array.from(this.broadcastIntervals.keys());
    
    for (const channel of channels) {
      const hasSubscribers = Array.from(this.connections.values())
        .some(conn => conn.subscriptions.has(channel));

      if (!hasSubscribers) {
        const interval = this.broadcastIntervals.get(channel);
        if (interval) {
          clearInterval(interval);
          this.broadcastIntervals.delete(channel);
          wsLogger.debug(`Stopped broadcasting channel: ${channel}`);
        }
      }
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.ws.terminate();
      this.connections.delete(connectionId);
      this.checkAndStopBroadcasts();

      wsLogger.info(`Connection disconnected: ${connectionId}`, {
        duration: Date.now() - connection.connectedAt,
      });
    }
  }

  /**
   * Send message to connection
   */
  private send(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      wsLogger.error(`Failed to send message to ${connectionId}`, error);
      this.handleDisconnection(connectionId);
    }
  }

  /**
   * Broadcast to all connections
   */
  broadcast(message: WebSocketMessage): void {
    for (const connection of this.connections.values()) {
      this.send(connection.id, message);
    }
  }

  /**
   * Set callbacks for data providers
   */
  setMetricsCallback(callback: () => SystemMetrics): void {
    this.getMetricsCallback = callback;
  }

  setHealthCallback(callback: () => HealthStatus): void {
    this.getHealthCallback = callback;
  }

  setPeersCallback(callback: () => any[]): void {
    this.getPeersCallback = callback;
  }

  setSyncStateCallback(callback: () => SyncState): void {
    this.getSyncStateCallback = callback;
  }

  setNetworkStatsCallback(callback: () => NetworkStats): void {
    this.getNetworkStatsCallback = callback;
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Clear broadcast intervals
    for (const interval of this.broadcastIntervals.values()) {
      clearInterval(interval);
    }
    this.broadcastIntervals.clear();

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close();
    }
    this.connections.clear();

    // Close server
    if (this.wss) {
      this.wss.close();
    }

    wsLogger.info('WebSocket server shutdown');
  }
}

