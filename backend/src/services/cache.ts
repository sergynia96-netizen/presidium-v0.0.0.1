import type { Message } from "../types";

// Simple in-memory cache for demo purposes.
// In production this can be replaced with Redis or another store.
class MessageCache {
  private messages: Message[] = [];

  getAll(): Message[] {
    return this.messages;
  }

  add(message: Message): void {
    this.messages.unshift(message);
  }
}

export const messageCache = new MessageCache();


