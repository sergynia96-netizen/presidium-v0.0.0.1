/**
 * StorageService - File-based persistence for chat history
 * Saves and loads messages from local JSON file
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'server';
  timestamp: string;
}

export class StorageService {
  private static readonly STORAGE_FILE = path.join(process.cwd(), 'chat_history.json');

  /**
   * Ensure storage file exists
   * @private
   */
  private static async ensureFileExists(): Promise<void> {
    try {
      await fs.access(this.STORAGE_FILE);
    } catch {
      // File doesn't exist, create it with empty array
      await fs.writeFile(this.STORAGE_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  /**
   * Save a message to storage
   * @param msg - Message to save
   */
  static async saveMessage(msg: Message): Promise<void> {
    try {
      await this.ensureFileExists();
      
      // Read existing history
      const data = await fs.readFile(this.STORAGE_FILE, 'utf-8');
      const history: Message[] = JSON.parse(data);
      
      // Append new message
      history.push(msg);
      
      // Write back to file
      await fs.writeFile(this.STORAGE_FILE, JSON.stringify(history, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving message to storage:', error);
      throw new Error('Failed to save message');
    }
  }

  /**
   * Get full chat history
   * @returns Promise<Message[]> - Array of all messages
   */
  static async getHistory(): Promise<Message[]> {
    try {
      await this.ensureFileExists();
      
      const data = await fs.readFile(this.STORAGE_FILE, 'utf-8');
      const history: Message[] = JSON.parse(data);
      
      return history;
    } catch (error) {
      console.error('Error reading chat history:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Clear all chat history
   * @returns Promise<void>
   */
  static async clearHistory(): Promise<void> {
    try {
      await fs.writeFile(this.STORAGE_FILE, JSON.stringify([], null, 2), 'utf-8');
    } catch (error) {
      console.error('Error clearing chat history:', error);
      throw new Error('Failed to clear history');
    }
  }

  /**
   * Get storage file path
   * @returns string - Absolute path to storage file
   */
  static getStoragePath(): string {
    return this.STORAGE_FILE;
  }

  /**
   * Get storage statistics
   * @returns Promise<object> - Storage stats
   */
  static async getStats(): Promise<{
    messageCount: number;
    fileSizeBytes: number;
    filePath: string;
  }> {
    try {
      await this.ensureFileExists();
      
      const history = await this.getHistory();
      const stats = await fs.stat(this.STORAGE_FILE);
      
      return {
        messageCount: history.length,
        fileSizeBytes: stats.size,
        filePath: this.STORAGE_FILE
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        messageCount: 0,
        fileSizeBytes: 0,
        filePath: this.STORAGE_FILE
      };
    }
  }
}

