export type Channel = "email" | "sms" | "p2p";

export interface Message {
  id: string;
  channel: Channel;
  from: string;
  to: string;
  subject?: string;
  body: string;
  createdAt: string;
  status: "received" | "sent" | "queued" | "failed";
}

export interface NewMessageInput {
  channel: Channel;
  from: string;
  to: string;
  subject?: string;
  body: string;
}


