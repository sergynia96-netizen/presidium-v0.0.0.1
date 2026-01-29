/**
 * Central Type Definitions for Presidium Control Center
 */

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

export interface SystemConfig {
  nodeId: string;
  port: number;
  p2p: P2PConfig;
  crdt: CRDTConfig;
  ai: AIConfig;
  storage: StorageConfig;
  api: APIConfig;
  crypto: CryptoConfig;
  monitoring: MonitoringConfig;
}

export interface P2PConfig {
  port: number;
  bootstrapNodes: string[];
  maxPeers: number;
  heartbeatInterval: number; // ms
  reconnectDelay: number; // ms
  maxReconnectAttempts: number;
}

export interface CRDTConfig {
  nodeId: string;
  garbageCollectionInterval: number; // ms
  tombstoneLifetime: number; // ms
  maxOperations: number;
}

export interface AIConfig {
  modelPath: string;
  quantization: '4bit' | '8bit' | 'fp16';
  maxTokens: number;
  temperature: number;
  topP: number;
  device: 'cpu' | 'gpu' | 'auto';
  memoryLimit: number; // GB
}

export interface StorageConfig {
  dbPath: string;
  cacheSize: number; // MB
  maxLocalSize: number; // bytes
  replicationFactor: number;
  compressionEnabled: boolean;
  tierHot: number; // percentage
  tierWarm: number;
  tierCold: number;
}

export interface APIConfig {
  port: number;
  wsPort: number;
  corsOrigins: string[];
  rateLimitWindow: number; // ms
  rateLimitMax: number;
  jwtSecret: string;
  jwtExpiry: number; // seconds
}

export interface CryptoConfig {
  kyberKeySize: number; // 1568 for Kyber1024
  dilithiumKeySize: number; // 2544 for Dilithium5
  aesKeySize: number; // 256
  keyRotationInterval: number; // ms
}

export interface MonitoringConfig {
  updateInterval: number; // ms
  historyRetention: number; // ms
  alertThresholds: {
    cpu: number;
    memory: number;
    disk: number;
    networkLatency: number;
  };
}

// ============================================================================
// NODE CONFIGURATION
// ============================================================================

export interface NodeConfig {
  id: string;
  version: string;
  name: string;
  region?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// CRDT TYPES
// ============================================================================

export interface VectorClock {
  [nodeId: string]: number;
}

export interface CRDTOperation {
  nodeId: string;
  timestamp: number;
  lamportClock: number;
  type: 'set' | 'delete' | 'merge';
  key: string;
  value?: any;
  hash: string;
  vectorClock: VectorClock;
}

export interface CRDTState {
  data: Map<string, CRDTEntry>;
  nodeId: string;
  operations: CRDTOperation[];
  vectorClock: VectorClock;
}

export interface CRDTEntry {
  value: any;
  vectorClock: VectorClock;
  tombstone?: boolean;
  lastModified: number;
  modifiedBy: string;
}

// ============================================================================
// P2P TYPES
// ============================================================================

export interface Peer {
  id: string;
  address: string;
  port: number;
  connected: boolean;
  latency: number;
  lastSeen: number;
  version: string;
  publicKey?: Uint8Array;
}

export interface P2PMessage {
  type: 'HEARTBEAT' | 'SYNC' | 'CRDT_OP' | 'DATA' | 'QUERY' | 'PEER_DISCOVERY';
  fromNodeId: string;
  toNodeId?: string;
  timestamp: number;
  nonce: string;
  data: any;
  signature: string;
  vectorClock?: VectorClock;
}

export interface NetworkStats {
  peersConnected: number;
  peersTotal: number;
  messagesIn: number;
  messagesOut: number;
  bytesIn: number;
  bytesOut: number;
  avgLatency: number;
  uptime: number;
}

// ============================================================================
// PQC CRYPTO TYPES
// ============================================================================

export interface KyberKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface KyberEncapsulation {
  sharedSecret: Uint8Array;
  ciphertext: Uint8Array;
}

export interface DilithiumKeyPair {
  signingKey: Uint8Array;
  verifyKey: Uint8Array;
}

export interface SignedMessage {
  message: any;
  signature: Uint8Array;
  signingNodeId: string;
  timestamp: number;
}

// ============================================================================
// AI TYPES
// ============================================================================

export interface AnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  entities: { type: string; value: string; confidence: number }[];
  intent: string;
  latency: number;
}

export interface GenerationConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
}

export interface ModelStatus {
  loaded: boolean;
  name: string;
  size: number; // bytes
  memoryUsage: number; // bytes
  device: 'cpu' | 'gpu';
}

export interface AIMetrics {
  totalInferences: number;
  avgLatency: number;
  tokensGenerated: number;
  memoryUsage: number;
  uptime: number;
}

// ============================================================================
// STORAGE TYPES
// ============================================================================

export interface StorageOptions {
  ttl?: number; // seconds
  compress?: boolean;
  replicate?: number; // replication factor
  tier?: 'hot' | 'warm' | 'cold';
}

export interface StorageStats {
  localUsed: number; // bytes
  localTotal: number;
  cacheSize: number;
  archiveSize: number;
  distributedSize: number;
  compressionRatio: number;
  fragmentationPercent: number;
}

export interface StorageKey {
  key: string;
  size: number;
  hash: string;
  createdAt: number;
  expiresAt?: number;
  tier: 'hot' | 'warm' | 'cold';
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: number;
  accessedAt: number;
  level: 'L1' | 'L2' | 'L3';
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface SyncState {
  status: 'OK' | 'PENDING' | 'CONFLICT' | 'ERROR';
  lastSync: number;
  changesPending: number;
  conflictCount: number;
  peersInSync: number;
}

export interface SyncOperation {
  type: 'FULL' | 'INCREMENTAL';
  changes: CRDTOperation[];
  vectorClock: VectorClock;
  fromNodeId: string;
}

// ============================================================================
// MONITORING TYPES
// ============================================================================

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number; // 0-100%
    cores: number;
    coreUsages: number[];
  };
  memory: {
    used: number; // bytes
    total: number;
    usage: number; // percentage
    free: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
    ioRead: number; // bytes/sec
    ioWrite: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    latency?: number;
  };
  threads: {
    active: number;
    max: number;
    utilization: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: number;
  alerts: Alert[];
  metrics: SystemMetrics;
}

export interface Alert {
  type: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
  timestamp: number;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: number;
  uptime: number;
  version: string;
}

export interface MetricsResponse {
  cpu: number;
  memory: number;
  disk: number;
  network: { in: number; out: number };
  threads: { active: number; max: number };
  timestamp: number;
}

export interface APIError {
  error: string;
  code: string;
  details?: any;
  timestamp: number;
}

export interface WebSocketMessage {
  type: 'METRICS' | 'PEER_UPDATE' | 'SYNC_STATUS' | 'LOG' | 'ALERT' | 'CONNECTED' | 'PONG';
  data: any;
  timestamp: number;
}

// ============================================================================
// MINI-APPS TYPES
// ============================================================================

export interface MiniApp {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  resources: {
    cpu: number;
    memory: number;
  };
  metadata?: Record<string, any>;
}

