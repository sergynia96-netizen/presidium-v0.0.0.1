import { messageCache } from "./services/cache";
import type { InboxSummary, Message } from "./types";

export function getMessages(): Message[] {
  return messageCache.getAll();
}

export function addMessage(partial: Omit<Message, "id" | "createdAt" | "status">): Message {
  const message: Message = {
    ...partial,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "received"
  };

  messageCache.add(message);
  return message;
}

export function getInboxSummary(): InboxSummary {
  const messages = messageCache.getAll();
  const byChannel: InboxSummary["byChannel"] = {
    email: 0,
    sms: 0,
    p2p: 0
  };

  for (const msg of messages) {
    byChannel[msg.channel]++;
  }

  return {
    total: messages.length,
    unread: messages.length, // demo only – everything is "unread"
    byChannel
  };
}


