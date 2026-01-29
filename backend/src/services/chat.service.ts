/**
 * Chat Service - Manages chat messages and conversations
 */

import { Chat, ChatMessage, ChatFilter } from '../types/system.types';
import { randomUUID } from 'crypto';

export class ChatService {
  private static chats: Map<string, Chat> = new Map();
  private static messages: Map<string, ChatMessage[]> = new Map();

  /**
   * Initialize with default chats
   */
  static initialize() {
    // Presidium AI chat
    const aiChat: Chat = {
      id: 'presidium-ai',
      name: 'Presidium AI',
      type: 'ai',
      lastMessage: 'Привет, Командир. Системы в норме.',
      lastMessageTime: new Date().toISOString(),
      unread: 0,
      encrypted: true
    };
    this.chats.set(aiChat.id, aiChat);
    this.messages.set(aiChat.id, []);

    // Mock scam warning chat
    const scamChat: Chat = {
      id: 'scam-warning',
      name: '⚠️ МОШЕННИЧЕСТВО',
      type: 'secret',
      lastMessage: '[ЗАБЛОКИРОВАНО] Попытка фишинга обнаружена и заблокирована локальным ИИ.',
      lastMessageTime: new Date(Date.now() - 3600000 * 3).toISOString(),
      unread: 1,
      encrypted: true
    };
    this.chats.set(scamChat.id, scamChat);
    this.messages.set(scamChat.id, [
      {
        id: randomUUID(),
        chatId: scamChat.id,
        text: scamChat.lastMessage!,
        sender: 'system',
        senderType: 'system',
        timestamp: scamChat.lastMessageTime!,
        encrypted: true,
        filter: 'secret'
      }
    ]);

    // P2P sync chat
    const p2pChat: Chat = {
      id: 'p2p-sync',
      name: 'КБ "Горизонт-7"',
      type: 'ether',
      lastMessage: 'Протокол P2P синхронизации CRDT успешно применен.',
      lastMessageTime: new Date(Date.now() - 86400000).toISOString(),
      unread: 0,
      encrypted: true
    };
    this.chats.set(p2pChat.id, p2pChat);
    this.messages.set(p2pChat.id, []);
  }

  /**
   * Get all chats with optional filter
   */
  static getChats(filter?: ChatFilter): Chat[] {
    let chats = Array.from(this.chats.values());
    
    if (filter && filter !== 'all') {
      chats = chats.filter(c => c.type === filter);
    }

    return chats.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });
  }

  /**
   * Get chat by ID
   */
  static getChat(chatId: string): Chat | null {
    return this.chats.get(chatId) || null;
  }

  /**
   * Search chats
   */
  static searchChats(query: string): Chat[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.chats.values()).filter(chat =>
      chat.name.toLowerCase().includes(lowerQuery) ||
      chat.lastMessage?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get messages for chat
   */
  static getMessages(chatId: string, limit = 100): ChatMessage[] {
    const messages = this.messages.get(chatId) || [];
    return messages.slice(-limit);
  }

  /**
   * Add message to chat
   */
  static addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const newMessage: ChatMessage = {
      ...message,
      id: randomUUID(),
      timestamp: new Date().toISOString()
    };

    // Add to messages
    if (!this.messages.has(message.chatId)) {
      this.messages.set(message.chatId, []);
    }
    this.messages.get(message.chatId)!.push(newMessage);

    // Update chat
    const chat = this.chats.get(message.chatId);
    if (chat) {
      chat.lastMessage = newMessage.text;
      chat.lastMessageTime = newMessage.timestamp;
      if (message.sender !== 'user') {
        chat.unread++;
      }
    } else {
      // Create new chat
      this.chats.set(message.chatId, {
        id: message.chatId,
        name: message.chatId,
        type: message.filter,
        lastMessage: newMessage.text,
        lastMessageTime: newMessage.timestamp,
        unread: message.sender !== 'user' ? 1 : 0,
        encrypted: message.encrypted
      });
      this.messages.set(message.chatId, [newMessage]);
    }

    return newMessage;
  }

  /**
   * Mark chat as read
   */
  static markAsRead(chatId: string): void {
    const chat = this.chats.get(chatId);
    if (chat) {
      chat.unread = 0;
    }
  }

  /**
   * Create new chat
   */
  static createChat(name: string, type: ChatFilter, encrypted = true): Chat {
    const chat: Chat = {
      id: randomUUID(),
      name,
      type,
      unread: 0,
      encrypted
    };
    this.chats.set(chat.id, chat);
    this.messages.set(chat.id, []);
    return chat;
  }

  /**
   * Delete chat
   */
  static deleteChat(chatId: string): boolean {
    this.messages.delete(chatId);
    return this.chats.delete(chatId);
  }
}

// Initialize on module load
ChatService.initialize();

