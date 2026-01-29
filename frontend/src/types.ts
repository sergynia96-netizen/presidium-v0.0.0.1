export type Channel = "email" | "sms" | "p2p";

export type AttachmentType =
  | "image"
  | "video"
  | "voice"
  | "document"
  | "location"
  | "video-circle"
  | "vanishing-video";

export interface Attachment {
  id: string;
  type: AttachmentType;
  url?: string;
  name?: string;
  size?: number;
  duration?: number;
  latitude?: number;
  longitude?: number;
  label?: string;
  expiresAt?: string;
}

export interface Message {
  id: string;
  channel: Channel;
  from: string;
  to: string;
  subject?: string;
  body: string;
  createdAt: string;
  status: "received" | "sent" | "queued" | "failed";
  attachments?: Attachment[];
}

export interface NewMessageInput {
  channel: Channel;
  from: string;
  to: string;
  subject?: string;
  body: string;
  attachments?: Attachment[];
}

