/**
 * P2P Messaging Service
 * 
 * Сервис для обмена сообщениями между пользователями через P2P
 */

import { WebRTCPeer, P2PMessage } from '../p2p/WebRTCPeer';

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  delivered: boolean;
  read: boolean;
  encrypted: boolean;
}

export type ChatMessageHandler = (message: ChatMessage) => void;

/**
 * P2P Messaging Service
 */
export class P2PMessagingService {
  private peer: WebRTCPeer | null = null;
  private messages: Map<string, ChatMessage> = new Map();
  private messageHandlers: Set<ChatMessageHandler> = new Set();

  constructor(peer: WebRTCPeer) {
    this.peer = peer;
    this.setupMessageHandlers();
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    if (!this.peer) return;

    this.peer.onMessage((p2pMessage: P2PMessage) => {
      if (p2pMessage.type === 'message' && p2pMessage.payload) {
        const chatMessage: ChatMessage = {
          id: p2pMessage.id,
          from: p2pMessage.from,
          to: p2pMessage.to,
          text: typeof p2pMessage.payload === 'string' 
            ? p2pMessage.payload 
            : p2pMessage.payload.text || '',
          timestamp: p2pMessage.timestamp,
          delivered: true,
          read: false,
          encrypted: p2pMessage.encrypted,
        };

        this.messages.set(chatMessage.id, chatMessage);
        this.notifyHandlers(chatMessage);
      }
    });
  }

  /**
   * Send message to peer
   */
  async sendMessage(toPeerId: string, text: string): Promise<boolean> {
    if (!this.peer) {
      console.error('P2P peer not initialized');
      return false;
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create chat message
    const chatMessage: ChatMessage = {
      id: messageId,
      from: this.peer.getLocalPeerId(),
      to: toPeerId,
      text,
      timestamp: Date.now(),
      delivered: false,
      read: false,
      encrypted: true,
    };

    this.messages.set(messageId, chatMessage);

    // Send via P2P
    const success = await this.peer.sendMessage(toPeerId, 'message', {
      text,
      messageId,
    }, true);

    if (success) {
      chatMessage.delivered = true;
      this.messages.set(messageId, chatMessage);
      this.notifyHandlers(chatMessage);
    }

    return success;
  }

  /**
   * Get messages for peer
   */
  getMessages(peerId: string): ChatMessage[] {
    return Array.from(this.messages.values())
      .filter(msg => msg.from === peerId || msg.to === peerId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get all messages
   */
  getAllMessages(): ChatMessage[] {
    return Array.from(this.messages.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): void {
    const message = this.messages.get(messageId);
    if (message) {
      message.read = true;
      this.messages.set(messageId, message);
      this.notifyHandlers(message);
    }
  }

  /**
   * Add message handler
   */
  onMessage(handler: ChatMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Notify handlers
   */
  private notifyHandlers(message: ChatMessage): void {
    this.messageHandlers.forEach(handler => handler(message));
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): string[] {
    return this.peer ? this.peer.getConnectedPeers() : [];
  }
}
