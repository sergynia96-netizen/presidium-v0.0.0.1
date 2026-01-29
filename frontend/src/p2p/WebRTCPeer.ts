/**
 * WebRTC P2P Peer Client
 * 
 * Клиент для прямых P2P соединений через WebRTC DataChannels
 * Использует signaling сервер для обмена SDP/ICE кандидатами
 */

import { PQCCryptoBrowser, EncryptedMessage } from '../crypto/pqc-browser';

export interface P2PMessage {
  id: string;
  type: 'message' | 'file' | 'typing' | 'read-receipt' | 'delivery-receipt' | 'message-ack' | 'retry';
  from: string;
  to: string;
  payload: any;
  timestamp: number;
  encrypted: boolean;
  encryptedData?: EncryptedMessage;
  retryCount?: number;
  messageId?: string; // For delivery receipts
}

export interface PeerStatus {
  id: string;
  connected: boolean;
  latency: number;
  lastSeen: number;
}

export type MessageHandler = (message: P2PMessage) => void;
export type PeerStatusHandler = (status: PeerStatus) => void;

/**
 * WebRTC P2P Peer
 */
export class WebRTCPeer {
  private signalingWs: WebSocket | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localPeerId: string;
  private signalingUrl: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private peerStatusHandlers: Set<PeerStatusHandler> = new Set();
  private pendingMessages: Map<string, P2PMessage> = new Map();
  private acknowledgedMessages: Set<string> = new Set();
  private messageQueue: Map<string, { message: P2PMessage; retries: number; lastAttempt: number }> = new Map();
  private crypto: PQCCryptoBrowser | null = null;
  private peers: Map<string, PeerStatus> = new Map();
  private peerPublicKeys: Map<string, Uint8Array> = new Map();
  private maxRetries: number = 5;
  private retryDelay: number = 1000;
  private retryTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private isConnecting = false;

  // ICE configuration
  private iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Add TURN servers if needed for NAT traversal
      // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
    ],
  };

  constructor(signalingUrl: string, peerId?: string, crypto?: PQCCryptoBrowser) {
    this.signalingUrl = signalingUrl;
    this.localPeerId = peerId || this.generatePeerId();
    this.crypto = crypto || null;
    
    // Initialize crypto if not provided
    if (!this.crypto) {
      this.crypto = new PQCCryptoBrowser();
      this.crypto.generateKeyPair().catch(err => console.error('Failed to generate PQC keys:', err));
    }
    
    // Start retry mechanism
    this.startRetryMechanism();
  }

  /**
   * Connect to signaling server
   */
  async connect(): Promise<void> {
    if (this.signalingWs?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.signalingWs?.readyState === WebSocket.CONNECTING || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      try {
        // Construct WebSocket URL properly
        let wsUrl = this.signalingUrl;
        if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
          // If URL doesn't start with ws:// or wss://, add ws://
          if (wsUrl.startsWith('http://')) {
            wsUrl = wsUrl.replace('http://', 'ws://');
          } else if (wsUrl.startsWith('https://')) {
            wsUrl = wsUrl.replace('https://', 'wss://');
          } else {
            wsUrl = `ws://${wsUrl}`;
          }
        }
        
        console.log(`🔗 Connecting to signaling server: ${wsUrl}`);
        this.signalingWs = new WebSocket(wsUrl);

        this.signalingWs.onopen = () => {
          console.log('✅ Connected to signaling server');
          this.isConnecting = false;
          resolve();
        };

        this.signalingWs.onmessage = (event) => {
          this.handleSignalingMessage(JSON.parse(event.data));
        };

        this.signalingWs.onerror = (error) => {
          console.error('❌ Signaling WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.signalingWs.onclose = () => {
          console.log('🔌 Disconnected from signaling server');
          this.isConnecting = false;
          // Attempt to reconnect
          if (this.shouldReconnect) {
          setTimeout(() => this.connect(), 3000);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle signaling messages
   */
  private handleSignalingMessage(message: any): void {
    switch (message.type) {
      case 'peer-join':
        this.handlePeerJoin(message.data);
        break;
      case 'peer-leave':
        this.handlePeerLeave(message.data);
        break;
      case 'peer-list':
        this.handlePeerList(message.data);
        break;
      case 'offer':
        this.handleOffer(message);
        break;
      case 'answer':
        this.handleAnswer(message);
        break;
      case 'ice-candidate':
        this.handleIceCandidate(message);
        break;
      case 'ping':
        this.sendSignalingMessage({ type: 'pong', from: this.localPeerId, data: {}, timestamp: Date.now() });
        break;
    }
  }

  /**
   * Handle peer join
   */
  private handlePeerJoin(data: any): void {
    const { peerId } = data;
    if (peerId === this.localPeerId) {
      // This is our own join notification, update peer list
      if (data.peers) {
        data.peers.forEach((peer: any) => {
          if (peer.id !== this.localPeerId) {
            this.peers.set(peer.id, {
              id: peer.id,
              connected: false,
              latency: 0,
              lastSeen: Date.now(),
            });
            // Initiate connection
            this.connectToPeer(peer.id);
          }
        });
      }
    } else {
      // Another peer joined, add to list
      this.peers.set(peerId, {
        id: peerId,
        connected: false,
        latency: 0,
        lastSeen: Date.now(),
      });
      // If we haven't connected yet, initiate connection
      if (!this.peerConnections.has(peerId)) {
        this.connectToPeer(peerId);
      }
    }
  }

  /**
   * Handle peer leave
   */
  private handlePeerLeave(data: any): void {
    const { peerId } = data;
    this.disconnectFromPeer(peerId);
  }

  /**
   * Handle peer list
   */
  private handlePeerList(data: any): void {
    const { peers } = data;
    peers.forEach((peer: any) => {
      if (peer.id !== this.localPeerId && !this.peers.has(peer.id)) {
        this.peers.set(peer.id, {
          id: peer.id,
          connected: false,
          latency: 0,
          lastSeen: Date.now(),
        });
        this.connectToPeer(peer.id);
      }
    });
  }

  /**
   * Connect to peer via WebRTC
   */
  private async connectToPeer(peerId: string): Promise<void> {
    if (this.peerConnections.has(peerId)) {
      return; // Already connected or connecting
    }

    console.log(`🔗 Connecting to peer: ${peerId}`);

    const pc = new RTCPeerConnection(this.iceServers);
    this.peerConnections.set(peerId, pc);

    // Create data channel
    const dataChannel = pc.createDataChannel('messages', {
      ordered: true,
    });

    this.setupDataChannel(peerId, dataChannel);
    this.peerConnections.set(peerId, pc);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          from: this.localPeerId,
          to: peerId,
          data: { candidate: event.candidate },
          timestamp: Date.now(),
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`📡 Connection state with ${peerId}: ${state}`);

      const peerStatus = this.peers.get(peerId);
      if (peerStatus) {
        peerStatus.connected = state === 'connected';
        peerStatus.lastSeen = Date.now();
        this.notifyPeerStatus(peerStatus);
      }

      if (state === 'failed' || state === 'disconnected') {
        // Attempt to reconnect
        setTimeout(() => {
          this.peerConnections.delete(peerId);
          this.dataChannels.delete(peerId);
          this.connectToPeer(peerId);
        }, 3000);
      }
    };

    // Create offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: 'offer',
        from: this.localPeerId,
        to: peerId,
        data: { sdp: offer },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`Failed to create offer for ${peerId}:`, error);
    }
  }

  /**
   * Handle offer from peer
   */
  private async handleOffer(message: any): Promise<void> {
    const { from, data } = message;
    const peerId = from;

    if (this.peerConnections.has(peerId)) {
      // Already have connection, might be renegotiation
      return;
    }

    console.log(`📨 Received offer from: ${peerId}`);

    const pc = new RTCPeerConnection(this.iceServers);
    this.peerConnections.set(peerId, pc);

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      const dataChannel = event.channel;
      this.setupDataChannel(peerId, dataChannel);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          from: this.localPeerId,
          to: peerId,
          data: { candidate: event.candidate },
          timestamp: Date.now(),
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`📡 Connection state with ${peerId}: ${state}`);

      const peerStatus = this.peers.get(peerId);
      if (peerStatus) {
        peerStatus.connected = state === 'connected';
        peerStatus.lastSeen = Date.now();
        this.notifyPeerStatus(peerStatus);
      }
    };

    // Set remote description and create answer
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.sendSignalingMessage({
        type: 'answer',
        from: this.localPeerId,
        to: peerId,
        data: { sdp: answer },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`Failed to handle offer from ${peerId}:`, error);
    }
  }

  /**
   * Handle answer from peer
   */
  private async handleAnswer(message: any): Promise<void> {
    const { from, data } = message;
    const peerId = from;
    const pc = this.peerConnections.get(peerId);

    if (!pc) {
      console.warn(`No peer connection found for ${peerId}`);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } catch (error) {
      console.error(`Failed to set remote description for ${peerId}:`, error);
    }
  }

  /**
   * Handle ICE candidate
   */
  private async handleIceCandidate(message: any): Promise<void> {
    const { from, data } = message;
    const peerId = from;
    const pc = this.peerConnections.get(peerId);

    if (!pc || !data.candidate) {
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error(`Failed to add ICE candidate for ${peerId}:`, error);
    }
  }

  /**
   * Setup data channel
   */
  private setupDataChannel(peerId: string, dataChannel: RTCDataChannel): void {
    this.dataChannels.set(peerId, dataChannel);

    dataChannel.onopen = async () => {
      console.log(`✅ Data channel open with ${peerId}`);
      const peerStatus = this.peers.get(peerId);
      if (peerStatus) {
        peerStatus.connected = true;
        peerStatus.lastSeen = Date.now();
        this.notifyPeerStatus(peerStatus);
      }
      
      // Exchange public keys when channel opens
      await this.exchangePublicKey(peerId);
    };

    dataChannel.onmessage = async (event) => {
      try {
        const message: P2PMessage = JSON.parse(event.data);
        await this.handleMessage(peerId, message);
      } catch (error) {
        console.error(`Failed to parse message from ${peerId}:`, error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
    };

    dataChannel.onclose = () => {
      console.log(`🔌 Data channel closed with ${peerId}`);
      this.dataChannels.delete(peerId);
      const peerStatus = this.peers.get(peerId);
      if (peerStatus) {
        peerStatus.connected = false;
        this.notifyPeerStatus(peerStatus);
      }
    };
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(fromPeerId: string, message: P2PMessage): Promise<void> {
    // Decrypt if needed
    if (message.encrypted && message.encryptedData && this.crypto) {
      try {
        // For decryption, we need the sender's public key (which was used to encrypt)
        // But in PQC, the recipient uses their own secret key to decapsulate
        // The encryptedData contains the encapsulated key and ciphertext
        const decryptedPayload = await this.crypto.decrypt(message.encryptedData, new Uint8Array(0));
        message.payload = JSON.parse(decryptedPayload);
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        // If decryption fails, try to process as unencrypted
        if (!message.payload) {
          return;
        }
      }
    }

    // Handle delivery receipt
    if (message.type === 'delivery-receipt' && message.messageId) {
      this.acknowledgedMessages.add(message.messageId);
      this.messageQueue.delete(message.messageId);
      return;
    }

    // Handle message acknowledgment
    if (message.type === 'message-ack') {
      if (message.messageId) {
        this.acknowledgedMessages.add(message.messageId);
        this.messageQueue.delete(message.messageId);
      }
      return;
    }

    // Handle public key exchange
    if (message.type === 'message' && message.payload && message.payload.type === 'public-key-exchange') {
      await this.handlePublicKeyExchange(fromPeerId, message.payload);
      return;
    }

    // Send delivery receipt for regular messages
    if (message.type === 'message' || message.type === 'file') {
      await this.sendDeliveryReceipt(fromPeerId, message.id);
    }

    // Notify handlers
    this.messageHandlers.forEach((handler) => handler(message));
  }

  /**
   * Send message to peer with reliable delivery
   */
  async sendMessage(toPeerId: string, type: string, payload: any, encrypted: boolean = true): Promise<boolean> {
    const dataChannel = this.dataChannels.get(toPeerId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.warn(`Data channel not open with ${toPeerId}`);
      // Queue message for retry
      const messageId = this.generateMessageId();
      const message: P2PMessage = {
        id: messageId,
        type: type as any,
        from: this.localPeerId,
        to: toPeerId,
        payload,
        timestamp: Date.now(),
        encrypted: encrypted && !!this.crypto,
      };
      this.messageQueue.set(messageId, {
        message,
        retries: 0,
        lastAttempt: Date.now(),
      });
      return false;
    }

    const messageId = this.generateMessageId();
    const message: P2PMessage = {
      id: messageId,
      type: type as any,
      from: this.localPeerId,
      to: toPeerId,
      payload,
      timestamp: Date.now(),
      encrypted: encrypted && !!this.crypto,
    };

    // Encrypt if crypto is available
    if (encrypted && this.crypto) {
      try {
        const recipientPublicKey = this.peerPublicKeys.get(toPeerId);
        if (recipientPublicKey && recipientPublicKey.length > 0) {
          const encryptedPayload = JSON.stringify(payload);
          message.encryptedData = await this.crypto.encrypt(encryptedPayload, recipientPublicKey);
          // Don't send plain payload when encrypted
          delete message.payload;
        } else {
          console.warn(`No public key for peer ${toPeerId}, sending unencrypted`);
          message.encrypted = false;
        }
      } catch (error) {
        console.error('Failed to encrypt message:', error);
        message.encrypted = false;
      }
    }

    try {
      dataChannel.send(JSON.stringify(message));
      this.pendingMessages.set(messageId, message);
      
      // Add to queue for reliable delivery
      this.messageQueue.set(messageId, {
        message,
        retries: 0,
        lastAttempt: Date.now(),
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to send message to ${toPeerId}:`, error);
      // Add to queue for retry
      this.messageQueue.set(messageId, {
        message,
        retries: 0,
        lastAttempt: Date.now(),
      });
      return false;
    }
  }

  /**
   * Send delivery receipt
   */
  private async sendDeliveryReceipt(toPeerId: string, messageId: string): Promise<void> {
    await this.sendMessage(toPeerId, 'delivery-receipt', { messageId }, false);
  }

  /**
   * Start retry mechanism for reliable delivery
   */
  private startRetryMechanism(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }

    this.retryTimer = setInterval(() => {
      const now = Date.now();
      
      for (const [messageId, queueItem] of this.messageQueue.entries()) {
        // Skip if already acknowledged
        if (this.acknowledgedMessages.has(messageId)) {
          this.messageQueue.delete(messageId);
          continue;
        }

        // Check if enough time has passed for retry
        const timeSinceLastAttempt = now - queueItem.lastAttempt;
        const delay = this.retryDelay * Math.pow(2, queueItem.retries); // Exponential backoff

        if (timeSinceLastAttempt >= delay) {
          // Retry sending
          if (queueItem.retries < this.maxRetries) {
            this.retrySendMessage(queueItem.message, queueItem.retries + 1);
            queueItem.retries++;
            queueItem.lastAttempt = now;
          } else {
            // Max retries reached, remove from queue
            console.warn(`Max retries reached for message ${messageId}`);
            this.messageQueue.delete(messageId);
          }
        }
      }
    }, 1000); // Check every second
  }

  /**
   * Retry sending message
   */
  private async retrySendMessage(message: P2PMessage, retryCount: number): Promise<void> {
    const dataChannel = this.dataChannels.get(message.to);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.warn(`Cannot retry message ${message.id}, channel not open`);
      return;
    }

    try {
      message.retryCount = retryCount;
      dataChannel.send(JSON.stringify(message));
      console.log(`Retry ${retryCount} for message ${message.id}`);
    } catch (error) {
      console.error(`Failed to retry message ${message.id}:`, error);
    }
  }

  /**
   * Exchange public keys with peer
   */
  async exchangePublicKey(peerId: string): Promise<void> {
    if (!this.crypto) {
      console.warn('Crypto not initialized, cannot exchange keys');
      return;
    }

    const publicKey = this.crypto.getPublicKey();
    if (!publicKey) {
      console.warn('Public key not available');
      return;
    }

    // Send public key to peer
    await this.sendMessage(peerId, 'message', {
      type: 'public-key-exchange',
      publicKey: Array.from(publicKey),
    }, false);
  }

  /**
   * Handle public key exchange
   */
  private async handlePublicKeyExchange(fromPeerId: string, payload: any): Promise<void> {
    if (payload.type === 'public-key-exchange' && payload.publicKey) {
      const publicKey = new Uint8Array(payload.publicKey);
      this.peerPublicKeys.set(fromPeerId, publicKey);
      
      if (this.crypto) {
        this.crypto.setPeerPublicKey(fromPeerId, publicKey);
      }

      console.log(`Received public key from ${fromPeerId}`);
      
      // Send our public key in response
      await this.exchangePublicKey(fromPeerId);
    }
  }

  /**
   * Disconnect from peer
   */
  private disconnectFromPeer(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }

    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }

    this.peers.delete(peerId);
  }

  /**
   * Send signaling message
   */
  private sendSignalingMessage(message: any): void {
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(message));
    }
  }

  /**
   * Add message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Add peer status handler
   */
  onPeerStatus(handler: PeerStatusHandler): () => void {
    this.peerStatusHandlers.add(handler);
    return () => this.peerStatusHandlers.delete(handler);
  }

  /**
   * Notify peer status handlers
   */
  private notifyPeerStatus(status: PeerStatus): void {
    this.peerStatusHandlers.forEach((handler) => handler(status));
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, status]) => status.connected)
      .map(([id]) => id);
  }

  /**
   * Get peer status
   */
  getPeerStatus(peerId: string): PeerStatus | null {
    return this.peers.get(peerId) || null;
  }

  /**
   * Get local peer ID
   */
  getLocalPeerId(): string {
    return this.localPeerId;
  }

  /**
   * Generate peer ID
   */
  private generatePeerId(): string {
    return `peer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.shouldReconnect = false;
    // Stop retry mechanism
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }

    // Close all peer connections
    for (const [peerId, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.dataChannels.clear();

    // Clear queues
    this.messageQueue.clear();
    this.pendingMessages.clear();
    this.acknowledgedMessages.clear();

    // Close signaling connection
    if (this.signalingWs) {
      this.signalingWs.close();
      this.signalingWs = null;
    }
  }

  /**
   * Get message queue status
   */
  getQueueStatus(): { pending: number; acknowledged: number } {
    return {
      pending: this.messageQueue.size,
      acknowledged: this.acknowledgedMessages.size,
    };
  }
}
