import type { Message } from "../types";

// Stub for email integration. Replace with real IMAP/SMTP logic later.
export async function fetchEmailMessages(): Promise<Message[]> {
  return [];
}

export async function sendEmail(message: Message): Promise<void> {
  // In real implementation you would send via SMTP / provider SDK.
  void message;
}


