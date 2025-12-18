import { promises as fs } from "fs";
import path from "path";

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "server";
  timestamp: string;
}

export class StorageService {
  private static readonly STORAGE_FILE = path.join(process.cwd(), "chat_history.json");

  /**
   * Ensures the storage file exists, creates it if it doesn't
   */
  private static async ensureFileExists(): Promise<void> {
    try {
      await fs.access(this.STORAGE_FILE);
    } catch {
      // File doesn't exist, create it with an empty array
      await fs.writeFile(this.STORAGE_FILE, JSON.stringify([], null, 2), "utf-8");
    }
  }

  /**
   * Saves a message to the chat history file
   */
  static async saveMessage(msg: ChatMessage): Promise<void> {
    await this.ensureFileExists();

    try {
      // Read existing history
      const data = await fs.readFile(this.STORAGE_FILE, "utf-8");
      const history: ChatMessage[] = JSON.parse(data);

      // Append new message
      history.push(msg);

      // Write back to file
      await fs.writeFile(this.STORAGE_FILE, JSON.stringify(history, null, 2), "utf-8");
    } catch (error) {
      console.error("Error saving message:", error);
      throw error;
    }
  }

  /**
   * Retrieves all messages from the chat history file
   */
  static async getHistory(): Promise<ChatMessage[]> {
    await this.ensureFileExists();

    try {
      const data = await fs.readFile(this.STORAGE_FILE, "utf-8");
      return JSON.parse(data) as ChatMessage[];
    } catch (error) {
      console.error("Error reading history:", error);
      return [];
    }
  }
}
