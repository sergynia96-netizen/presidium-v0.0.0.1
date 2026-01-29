/**
 * Storage Manager - Production Implementation with RocksDB
 * 
 * Использует RocksDB для высокопроизводительного хранилища
 */

import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { promisify } from 'util';
import {
  StorageOptions,
  StorageStats,
  StorageKey,
  StorageConfig,
} from '../models/types';
import { logger } from '../utils/logger';

const storageLogger = logger.createChild({ module: 'storage-production' });

const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

// Try to import RocksDB
let RocksDB: any = null;
try {
  RocksDB = require('rocksdb');
  storageLogger.info('RocksDB loaded successfully');
} catch (error) {
  storageLogger.warn('RocksDB not available, using fallback implementation');
  storageLogger.warn('For production, install: npm install rocksdb');
}

/**
 * Storage Manager - Production Implementation with RocksDB
 */
export class StorageManagerProduction {
  private config: StorageConfig;
  private db: any = null;
  private data: Map<string, StorageKey> = new Map();
  private cache: Map<string, any> = new Map(); // L1 Cache
  private dbPath: string;
  private stats: StorageStats;
  private rocksDBAvailable: boolean = false;

  constructor(config: StorageConfig) {
    this.config = config;
    this.dbPath = config.dbPath;
    this.rocksDBAvailable = RocksDB !== null;

    this.stats = {
      localUsed: 0,
      localTotal: config.maxLocalSize,
      cacheSize: 0,
      archiveSize: 0,
      distributedSize: 0,
      compressionRatio: 1.0,
      fragmentationPercent: 0,
    };
  }

  /**
   * Initialize storage with RocksDB
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.dbPath, { recursive: true });
      await mkdir(path.join(this.dbPath, 'hot'), { recursive: true });
      await mkdir(path.join(this.dbPath, 'warm'), { recursive: true });
      await mkdir(path.join(this.dbPath, 'cold'), { recursive: true });

      if (this.rocksDBAvailable && RocksDB) {
        // Open RocksDB instance
        const dbPath = path.join(this.dbPath, 'rocksdb');
        await mkdir(dbPath, { recursive: true });

        this.db = RocksDB(dbPath);
        
        return new Promise<void>((resolve, reject) => {
          this.db.open((err: Error | null) => {
            if (err) {
              storageLogger.error('Failed to open RocksDB', err);
              reject(err);
              return;
            }

            storageLogger.info('RocksDB opened successfully', { dbPath });
            
            // Set options
            this.db.setOptions({
              compression: this.config.compressionEnabled ? 'snappy' : 'none',
            }, (err: Error | null) => {
              if (err) {
                storageLogger.warn('Failed to set RocksDB options', err);
              }
              resolve();
            });
          });
        });
      } else {
        storageLogger.warn('Using fallback storage implementation (file-based)');
        storageLogger.info('Storage initialized (fallback)', { dbPath: this.dbPath });
      }
    } catch (error) {
      storageLogger.error('Failed to initialize storage', error);
      throw error;
    }
  }

  /**
   * Hash key
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Determine storage tier
   */
  private determineTier(key: string): 'hot' | 'warm' | 'cold' {
    const entry = this.data.get(key);
    if (!entry) return 'hot';

    const age = Date.now() - entry.createdAt;
    const day = 86400000;

    if (age < day) return 'hot';
    if (age < day * 7) return 'warm';
    return 'cold';
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
    if (options.compress && this.config.compressionEnabled) {
      // TODO: Add compression (zlib, lz4, etc.)
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

    // Store in cache
    this.cache.set(key, value);
    this.data.set(key, storageKey);

    // Write to RocksDB or file system
    if (this.rocksDBAvailable && this.db) {
      await this.putRocksDB(key, finalData);
    } else {
      await this.putFileSystem(key, finalData, tier);
    }

    // Update stats
    this.stats.localUsed += size;
    this.stats.cacheSize += size;

    const latency = Date.now() - start;
    storageLogger.debug(`Put key "${key}"`, { size, tier, latency, rocksdb: this.rocksDBAvailable });

    return storageKey;
  }

  /**
   * Put to RocksDB
   */
  private async putRocksDB(key: string, data: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const keyBuffer = Buffer.from(key, 'utf8');
      const valueBuffer = Buffer.from(data, 'utf8');

      this.db.put(keyBuffer, valueBuffer, (err: Error | null) => {
        if (err) {
          storageLogger.error(`Failed to put to RocksDB: ${key}`, err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Put to file system (fallback)
   */
  private async putFileSystem(key: string, data: string, tier: 'hot' | 'warm' | 'cold'): Promise<void> {
    const hash = this.hashKey(key);
    const filePath = path.join(this.dbPath, tier, `${hash}.json`);
    await fs.promises.writeFile(filePath, data, 'utf8');
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

    // Read from RocksDB or file system
    let data: string | null = null;
    if (this.rocksDBAvailable && this.db) {
      data = await this.getRocksDB(key);
    } else {
      data = await this.getFileSystem(key, entry.tier);
    }

    if (!data) {
      return null;
    }

    try {
      const value = JSON.parse(data);

      // Update cache
      this.cache.set(key, value);

      const latency = Date.now() - start;
      storageLogger.debug(`Get key "${key}" (storage read)`, { tier: entry.tier, latency, rocksdb: this.rocksDBAvailable });
      return value;
    } catch (error) {
      storageLogger.error(`Failed to parse key "${key}"`, error);
      return null;
    }
  }

  /**
   * Get from RocksDB
   */
  private async getRocksDB(key: string): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      const keyBuffer = Buffer.from(key, 'utf8');

      this.db.get(keyBuffer, { fillCache: true }, (err: Error | null, value: Buffer | undefined) => {
        if (err) {
          if (err.name === 'NotFoundError') {
            resolve(null);
            return;
          }
          storageLogger.error(`Failed to get from RocksDB: ${key}`, err);
          reject(err);
          return;
        }

        if (!value) {
          resolve(null);
          return;
        }

        resolve(value.toString('utf8'));
      });
    });
  }

  /**
   * Get from file system (fallback)
   */
  private async getFileSystem(key: string, tier: 'hot' | 'warm' | 'cold'): Promise<string | null> {
    const hash = this.hashKey(key);
    const filePath = path.join(this.dbPath, tier, `${hash}.json`);

    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return data;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw error;
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

    // Delete from RocksDB or file system
    if (this.rocksDBAvailable && this.db) {
      await this.deleteRocksDB(key);
    } else {
      await this.deleteFileSystem(key, entry.tier);
    }

    // Update stats
    this.stats.localUsed -= entry.size;
    this.stats.cacheSize -= entry.size;

    storageLogger.debug(`Delete key "${key}"`);
    return true;
  }

  /**
   * Delete from RocksDB
   */
  private async deleteRocksDB(key: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const keyBuffer = Buffer.from(key, 'utf8');

      this.db.del(keyBuffer, (err: Error | null) => {
        if (err) {
          storageLogger.error(`Failed to delete from RocksDB: ${key}`, err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Delete from file system (fallback)
   */
  private async deleteFileSystem(key: string, tier: 'hot' | 'warm' | 'cold'): Promise<void> {
    const hash = this.hashKey(key);
    const filePath = path.join(this.dbPath, tier, `${hash}.json`);

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      // File might not exist
    }
  }

  /**
   * Scan keys by prefix
   */
  async scan(prefix: string): Promise<Array<[string, any]>> {
    const results: Array<[string, any]> = [];

    if (this.rocksDBAvailable && this.db) {
      // Use RocksDB iterator
      const iterator = this.db.iterator();
      
      return new Promise<Array<[string, any]>>((resolve, reject) => {
        const keys: string[] = [];

        iterator.seek(Buffer.from(prefix, 'utf8'));
        iterator.on('data', (data: { key: Buffer; value: Buffer }) => {
          const key = data.key.toString('utf8');
          if (key.startsWith(prefix)) {
            keys.push(key);
          } else {
            iterator.end();
          }
        });

        iterator.on('end', async () => {
          for (const key of keys) {
            const value = await this.get(key);
            if (value !== null) {
              results.push([key, value]);
            }
          }
          resolve(results);
        });

        iterator.on('error', (err: Error) => {
          storageLogger.error('RocksDB iterator error', err);
          reject(err);
        });
      });
    } else {
      // Fallback: scan in-memory data
      for (const [key, entry] of this.data.entries()) {
        if (key.startsWith(prefix)) {
          const value = await this.get(key);
          if (value !== null) {
            results.push([key, value]);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    // Calculate compression ratio
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

    // Close RocksDB
    if (this.rocksDBAvailable && this.db) {
      return new Promise<void>((resolve, reject) => {
        this.db.close((err: Error | null) => {
          if (err) {
            storageLogger.error('Failed to close RocksDB', err);
            reject(err);
            return;
          }
          storageLogger.info('RocksDB closed');
          resolve();
        });
      });
    }

    storageLogger.info('Storage manager shutdown');
  }
}

