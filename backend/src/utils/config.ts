/**
 * Configuration Management
 */

import dotenv from 'dotenv';
import path from 'path';
import { SystemConfig, NodeConfig } from '../models/types';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

let config: SystemConfig | null = null;
const configWatchers: Map<string, Array<(value: any) => void>> = new Map();

/**
 * Load configuration from environment variables
 */
export function loadConfig(envFile: string = '.env'): SystemConfig {
  // Load .env file
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    console.warn(`⚠️  .env file not found at ${envPath}, using defaults`);
  }

  const nodeId = process.env.NODE_ID || randomUUID();

  config = {
    nodeId,
    port: parseInt(process.env.PORT || '3000', 10),
    p2p: {
      port: parseInt(process.env.P2P_PORT || '4000', 10),
      bootstrapNodes: process.env.BOOTSTRAP_NODES?.split(',') || [],
      maxPeers: parseInt(process.env.MAX_PEERS || '12', 10),
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
      reconnectDelay: parseInt(process.env.RECONNECT_DELAY || '5000', 10),
      maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '5', 10),
    },
    crdt: {
      nodeId,
      garbageCollectionInterval: parseInt(process.env.CRDT_GC_INTERVAL || '3600000', 10), // 1 hour
      tombstoneLifetime: parseInt(process.env.CRDT_TOMBSTONE_LIFETIME || '86400000', 10), // 24 hours
      maxOperations: parseInt(process.env.CRDT_MAX_OPERATIONS || '100000', 10),
    },
    ai: {
      modelPath: process.env.AI_MODEL_PATH || './models',
      quantization: (process.env.AI_QUANTIZATION as '4bit' | '8bit' | 'fp16') || '4bit',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      topP: parseFloat(process.env.AI_TOP_P || '0.9'),
      device: (process.env.AI_DEVICE as 'cpu' | 'gpu' | 'auto') || 'auto',
      memoryLimit: parseInt(process.env.AI_MEMORY_LIMIT || '8', 10), // GB
    },
    storage: {
      dbPath: process.env.STORAGE_DB_PATH || './data/rocksdb',
      cacheSize: parseInt(process.env.STORAGE_CACHE_SIZE || '1024', 10), // MB
      maxLocalSize: parseInt(process.env.STORAGE_MAX_SIZE || '68719476736', 10), // 64 GB
      replicationFactor: parseInt(process.env.STORAGE_REPLICATION || '3', 10),
      compressionEnabled: process.env.STORAGE_COMPRESSION !== 'false',
      tierHot: parseInt(process.env.STORAGE_TIER_HOT || '10', 10), // 10%
      tierWarm: parseInt(process.env.STORAGE_TIER_WARM || '30', 10), // 30%
      tierCold: parseInt(process.env.STORAGE_TIER_COLD || '60', 10), // 60%
    },
    api: {
      port: parseInt(process.env.API_PORT || '3000', 10),
      wsPort: parseInt(process.env.WS_PORT || '3001', 10),
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      jwtSecret: process.env.JWT_SECRET || randomUUID(),
      jwtExpiry: parseInt(process.env.JWT_EXPIRY || '86400', 10), // 24 hours
    },
    crypto: {
      kyberKeySize: 1568, // Kyber1024
      dilithiumKeySize: 2544, // Dilithium5
      aesKeySize: 256,
      keyRotationInterval: parseInt(process.env.KEY_ROTATION_INTERVAL || '86400000', 10), // 24 hours
    },
    monitoring: {
      updateInterval: parseInt(process.env.MONITOR_INTERVAL || '500', 10),
      historyRetention: parseInt(process.env.MONITOR_RETENTION || '3600000', 10), // 1 hour
      alertThresholds: {
        cpu: parseFloat(process.env.ALERT_CPU || '90'),
        memory: parseFloat(process.env.ALERT_MEMORY || '80'),
        disk: parseFloat(process.env.ALERT_DISK || '85'),
        networkLatency: parseFloat(process.env.ALERT_NETWORK || '500'),
      },
    },
  };

  console.log(`✅ Configuration loaded for node: ${nodeId}`);
  return config;
}

/**
 * Get configuration value by key (dot notation)
 */
export function getConfig(key: string): any {
  if (!config) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }

  const keys = key.split('.');
  let value: any = config;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Set configuration value at runtime
 */
export function setConfig(key: string, value: any): void {
  if (!config) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }

  const keys = key.split('.');
  const lastKey = keys.pop()!;
  let target: any = config;

  for (const k of keys) {
    if (!target[k] || typeof target[k] !== 'object') {
      target[k] = {};
    }
    target = target[k];
  }

  target[lastKey] = value;

  // Notify watchers
  const watchers = configWatchers.get(key) || [];
  watchers.forEach(watcher => watcher(value));
}

/**
 * Watch for configuration changes
 */
export function watchConfig(key: string, callback: (value: any) => void): () => void {
  if (!configWatchers.has(key)) {
    configWatchers.set(key, []);
  }
  configWatchers.get(key)!.push(callback);

  // Return unsubscribe function
  return () => {
    const watchers = configWatchers.get(key);
    if (watchers) {
      const index = watchers.indexOf(callback);
      if (index > -1) {
        watchers.splice(index, 1);
      }
    }
  };
}

/**
 * Get full configuration
 */
export function getConfigObject(): SystemConfig {
  if (!config) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return config;
}

/**
 * Create node configuration
 */
export function createNodeConfig(): NodeConfig {
  return {
    id: config?.nodeId || randomUUID(),
    version: process.env.npm_package_version || '1.0.0',
    name: process.env.NODE_NAME || 'Presidium Node',
    region: process.env.REGION,
    metadata: {},
  };
}

