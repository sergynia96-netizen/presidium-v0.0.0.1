import type { Message } from "../types";

// Stub for SMS integration. Replace with real Twilio (or other) SDK later.
export async function fetchSmsMessages(): Promise<Message[]> {
  return [];
}

export async function sendSms(message: Message): Promise<void> {
  void message;
}


