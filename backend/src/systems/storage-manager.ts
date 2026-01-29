/**
 * Storage Manager
 * 
 * Управление локальным и распределенным хранилищем
 * 
 * NOTE: Упрощенная реализация. В production используйте RocksDB
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import {
  StorageOptions,
  StorageStats,
  StorageKey,
  StorageConfig,
} from '../models/types';
import { logger } from '../utils/logger';

const storageLogger = logger.createChild({ module: 'storage' });

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

/**
 * Storage Manager Class
 * 
 * Управляет локальным хранилищем с tiered storage (hot/warm/cold)
 */
export class StorageManager {
  private config: StorageConfig;
  private data: Map<string, StorageKey> = new Map();
  private cache: Map<string, any> = new Map(); // L1 Cache
  private dbPath: string;
  private stats: StorageStats;

  constructor(config: StorageConfig) {
    this.config = config;
    this.dbPath = config.dbPath;

    // Initialize stats
    this.stats = {
      localUsed: 0,
      localTotal: config.maxLocalSize,
      cacheSize: 0,
      archiveSize: 0,
      distributedSize: 0,
      compressionRatio: 1.0,
      fragmentationPercent: 0,
    };

    // Ensure directory exists
    this.initialize();
  }

  /**
   * Initialize storage directory
   */
  private async initialize(): Promise<void> {
    try {
      await mkdir(this.dbPath, { recursive: true });
      await mkdir(path.join(this.dbPath, 'hot'), { recursive: true });
      await mkdir(path.join(this.dbPath, 'warm'), { recursive: true });
      await mkdir(path.join(this.dbPath, 'cold'), { recursive: true });

      storageLogger.info('Storage initialized', { dbPath: this.dbPath });
    } catch (error) {
      storageLogger.error('Failed to initialize storage', error);
      throw error;
    }
  }

  /**
   * Generate hash for key
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Determine storage tier based on access patterns
   */
  private determineTier(key: string): 'hot' | 'warm' | 'cold' {
    const entry = this.data.get(key);
    if (!entry) return 'hot'; // New entries are hot

    const age = Date.now() - entry.createdAt;
    const day = 86400000; // 24 hours

    if (age < day) return 'hot';
    if (age < day * 7) return 'warm';
    return 'cold';
  }

  /**
   * Get file path for key
   */
  private getFilePath(key: string, tier: 'hot' | 'warm' | 'cold'): string {
    const hash = this.hashKey(key);
    return path.join(this.dbPath, tier, `${hash}.json`);
  }

  /**
   * Put a value
   */
  async put(key: string, value: any, options: StorageOptions = {}): Promise<StorageKey> {
    const start = Date.now();

    // Serialize value
    const serialized = JSON.stringify(value);
    const size = Buffer.byteLength(serialized, 'utf8');

    // Compress if requested
    let finalData = serialized;
    if (options.compress) {
      // TODO: Implement compression (zlib, lz4, etc.)
      // For now, just use original
    }

    // Determine tier
    const tier = options.tier || this.determineTier(key);

    // Calculate hash
    const hash = createHash('sha256').update(finalData).digest('hex');

    // Create storage key entry
    const storageKey: StorageKey = {
      key,
      size,
      hash,
      createdAt: Date.now(),
      expiresAt: options.ttl ? Date.now() + options.ttl * 1000 : undefined,
      tier,
    };

    // Store in cache (L1)
    this.cache.set(key, value);
    this.data.set(key, storageKey);

    // Write to disk
    const filePath = this.getFilePath(key, tier);
    await writeFile(filePath, finalData, 'utf8');

    // Update stats
    this.stats.localUsed += size;
    this.stats.cacheSize += size;

    const latency = Date.now() - start;
    storageLogger.debug(`Put key "${key}"`, { size, tier, latency });

    return storageKey;
  }

  /**
   * Get a value
   */
  async get(key: string): Promise<any | null> {
    const start = Date.now();

    // Check L1 cache
    if (this.cache.has(key)) {
      const entry = this.data.get(key);
      if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
        const latency = Date.now() - start;
        storageLogger.debug(`Get key "${key}" (cache hit)`, { latency });
        return this.cache.get(key);
      }
    }

    // Check if key exists
    const entry = this.data.get(key);
    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.delete(key);
      return null;
    }

    // Read from disk
    const filePath = this.getFilePath(key, entry.tier);
    try {
      const data = await readFile(filePath, 'utf8');
      const value = JSON.parse(data);

      // Update cache
      this.cache.set(key, value);

      const latency = Date.now() - start;
      storageLogger.debug(`Get key "${key}" (disk read)`, { tier: entry.tier, latency });
      return value;
    } catch (error) {
      storageLogger.error(`Failed to read key "${key}"`, error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.data.get(key);
    if (!entry) {
      return false;
    }

    // Remove from cache
    this.cache.delete(key);
    this.data.delete(key);

    // Delete file
    const filePath = this.getFilePath(key, entry.tier);
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      // File might not exist
    }

    // Update stats
    this.stats.localUsed -= entry.size;
    this.stats.cacheSize -= entry.size;

    storageLogger.debug(`Delete key "${key}"`);
    return true;
  }

  /**
   * Scan keys by prefix
   */
  async scan(prefix: string): Promise<Array<[string, any]>> {
    const results: Array<[string, any]> = [];

    for (const [key, entry] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        const value = await this.get(key);
        if (value !== null) {
          results.push([key, value]);
        }
      }
    }

    return results;
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    // Calculate compression ratio (simplified)
    let totalUncompressed = 0;
    let totalCompressed = 0;

    for (const entry of this.data.values()) {
      totalUncompressed += entry.size;
      totalCompressed += entry.size; // TODO: Calculate actual compressed size
    }

    if (totalUncompressed > 0) {
      this.stats.compressionRatio = totalCompressed / totalUncompressed;
    }

    // Calculate fragmentation (simplified)
    // In real RocksDB, this would be actual fragmentation
    this.stats.fragmentationPercent = Math.min(10, this.data.size / 10000);

    return { ...this.stats };
  }

  /**
   * Clear expired entries
   */
  async clearExpired(): Promise<number> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.data.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      await this.delete(key);
    }

    if (toDelete.length > 0) {
      storageLogger.info(`Cleared ${toDelete.length} expired entries`);
    }

    return toDelete.length;
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    // Clear cache
    this.cache.clear();
    storageLogger.info('Storage manager shutdown');
  }
}

