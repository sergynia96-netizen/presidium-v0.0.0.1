/**
 * System Types - All types for Presidium backend
 */

// ============================================================================
// P2P & NETWORK
// ============================================================================

export interface P2PNode {
  id: string;
  address: string;
  port: number;
  publicKey: string;
  lastSeen: string;
  status: 'online' | 'offline' | 'syncing';
  latency?: number;
  version: string;
}

export interface P2PNetwork {
  totalNodes: number;
  connectedNodes: number;
  activeSessions: number;
  maxSlots: number;
  nodes: P2PNode[];
}

// ============================================================================
// CRDT
// ============================================================================

export interface CRDTState {
  enabled: boolean;
  lastSync: string;
  conflicts: number;
  merged: number;
  status: 'synced' | 'syncing' | 'conflict' | 'error';
}

// ============================================================================
// ECONOMY
// ============================================================================

export interface Wallet {
  capital: number;
  currency: string;
  transactions: Transaction[];
  balance: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'exchange' | 'staking' | 'purchase';
  amount: number;
  currency: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  description?: string;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  category: 'hardware' | 'software' | 'service';
  description: string;
  available: boolean;
}

// ============================================================================
// REPUTATION & TRUST
// ============================================================================

export interface Reputation {
  trust: number; // 0-100%
  reputation: number; // 0-1000 points
  uptime: number; // seconds
  transactions: number;
  rating: number; // 1-5
  lastUpdate: string;
}

// ============================================================================
// VAULT & KEYS
// ============================================================================

export interface CryptoKey {
  id: string;
  name: string;
  type: 'master' | 'session' | 'p2p' | 'vault';
  fingerprint: string;
  createdAt: string;
  lastUsed?: string;
  encrypted: boolean;
}

export interface VaultItem {
  id: string;
  name: string;
  type: 'key' | 'file' | 'secret' | 'credential';
  encrypted: boolean;
  size?: number;
  createdAt: string;
  modifiedAt: string;
}

// ============================================================================
// CHAT & MESSAGES
// ============================================================================

export type ChatFilter = 'all' | 'personal' | 'secret' | 'ether' | 'ai';

export interface ChatMessage {
  id: string;
  chatId: string;
  text: string;
  sender: string;
  senderType: 'user' | 'ai' | 'system';
  timestamp: string;
  encrypted: boolean;
  filter: ChatFilter;
}

export interface Chat {
  id: string;
  name: string;
  type: ChatFilter;
  lastMessage?: string;
  lastMessageTime?: string;
  unread: number;
  encrypted: boolean;
}

// ============================================================================
// SYSTEM METRICS
// ============================================================================

export interface SystemMetrics {
  aiMemory: {
    used: number; // GB
    total: number; // GB
    percentage: number;
  };
  storage: {
    used: number; // GB
    total: number; // GB
    percentage: number;
  };
  activeThreads: number;
  activeSessions: number;
  maxSessions: number;
  cpuUsage?: number;
  networkUsage?: {
    upload: number; // bytes/sec
    download: number; // bytes/sec
  };
}

export interface DashboardStats {
  crdt: CRDTState;
  p2p: P2PNetwork;
  metrics: SystemMetrics;
  reputation: Reputation;
  timestamp: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

