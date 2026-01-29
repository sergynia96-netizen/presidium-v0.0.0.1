/**
 * Cache Layer
 * 
 * Распределенный кеш с LRU eviction policy
 */

import { CacheEntry, CacheStats } from '../models/types';
import { logger } from '../utils/logger';

const cacheLogger = logger.createChild({ module: 'cache' });

/**
 * Cache Layer Class
 * 
 * Многоуровневый кеш с LRU eviction
 */
export class CacheLayer {
  private l1: Map<string, CacheEntry> = new Map(); // In-memory (hot)
  private l2: Map<string, CacheEntry> = new Map(); // Storage (warm)
  private l3: Map<string, CacheEntry> = new Map(); // P2P network (distributed)
  private maxL1Size: number;
  private maxL2Size: number;
  private stats: CacheStats;
  private accessOrder: Map<string, number> = new Map();
  private accessCounter: number = 0;

  constructor(maxL1Size: number = 100, maxL2Size: number = 1000) {
    this.maxL1Size = maxL1Size;
    this.maxL2Size = maxL2Size;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
    };

    // Start TTL cleanup
    setInterval(() => this.cleanupExpired(), 60000); // Every minute
  }

  /**
   * Get value from cache
   */
  get(key: string, level?: 'L1' | 'L2' | 'L3'): any | null {
    // Try L1 first
    if (!level || level === 'L1') {
      const entry = this.l1.get(key);
      if (entry && this.isValid(entry)) {
        this.recordAccess(key, entry);
        this.stats.hits++;
        this.updateStats();
        return entry.value;
      }
    }

    // Try L2
    if (!level || level === 'L2') {
      const entry = this.l2.get(key);
      if (entry && this.isValid(entry)) {
        // Promote to L1
        this.promoteToL1(key, entry);
        this.recordAccess(key, entry);
        this.stats.hits++;
        this.updateStats();
        return entry.value;
      }
    }

    // Try L3
    if (!level || level === 'L3') {
      const entry = this.l3.get(key);
      if (entry && this.isValid(entry)) {
        // Promote to L2
        this.promoteToL2(key, entry);
        this.recordAccess(key, entry);
        this.stats.hits++;
        this.updateStats();
        return entry.value;
      }
    }

    this.stats.misses++;
    this.updateStats();
    return null;
  }

  /**
   * Put value in cache
   */
  put(key: string, value: any, ttl: number = 3600000, level: 'L1' | 'L2' | 'L3' = 'L1'): void {
    const entry: CacheEntry = {
      key,
      value,
      ttl,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      level,
    };

    switch (level) {
      case 'L1':
        this.putL1(key, entry);
        break;
      case 'L2':
        this.putL2(key, entry);
        break;
      case 'L3':
        this.putL3(key, entry);
        break;
    }

    this.recordAccess(key, entry);
  }

  /**
   * Put in L1 cache
   */
  private putL1(key: string, entry: CacheEntry): void {
    // Evict if needed
    if (this.l1.size >= this.maxL1Size && !this.l1.has(key)) {
      this.evictL1();
    }

    this.l1.set(key, entry);
  }

  /**
   * Put in L2 cache
   */
  private putL2(key: string, entry: CacheEntry): void {
    if (this.l2.size >= this.maxL2Size && !this.l2.has(key)) {
      this.evictL2();
    }

    this.l2.set(key, entry);
  }

  /**
   * Put in L3 cache
   */
  private putL3(key: string, entry: CacheEntry): void {
    this.l3.set(key, entry);
  }

  /**
   * Evict least recently used from L1
   */
  private evictL1(): void {
    if (this.l1.size === 0) return;

    // Find LRU entry
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.l1.entries()) {
      const accessTime = this.accessOrder.get(key) || 0;
      if (accessTime < lruTime) {
        lruTime = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.l1.get(lruKey);
      if (entry) {
        // Demote to L2
        this.promoteToL2(lruKey, entry);
        this.l1.delete(lruKey);
        this.stats.evictions++;
      }
    }
  }

  /**
   * Evict least recently used from L2
   */
  private evictL2(): void {
    if (this.l2.size === 0) return;

    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.l2.entries()) {
      const accessTime = this.accessOrder.get(key) || 0;
      if (accessTime < lruTime) {
        lruTime = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      // Demote to L3
      const entry = this.l2.get(lruKey);
      if (entry) {
        this.promoteToL3(lruKey, entry);
        this.l2.delete(lruKey);
        this.stats.evictions++;
      }
    }
  }

  /**
   * Promote entry to L1
   */
  private promoteToL1(key: string, entry: CacheEntry): void {
    entry.level = 'L1';
    this.putL1(key, entry);
  }

  /**
   * Promote entry to L2
   */
  private promoteToL2(key: string, entry: CacheEntry): void {
    entry.level = 'L2';
    this.putL2(key, entry);
  }

  /**
   * Promote entry to L3
   */
  private promoteToL3(key: string, entry: CacheEntry): void {
    entry.level = 'L3';
    this.putL3(key, entry);
  }

  /**
   * Check if entry is valid (not expired)
   */
  private isValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.createdAt;
    return age < entry.ttl;
  }

  /**
   * Record access to entry
   */
  private recordAccess(key: string, entry: CacheEntry): void {
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
    entry.accessedAt = Date.now();
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.l1.delete(key);
    this.l2.delete(key);
    this.l3.delete(key);
    this.accessOrder.delete(key);
    cacheLogger.debug(`Invalidated cache key "${key}"`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.l1.clear();
    this.l2.clear();
    this.l3.clear();
    this.accessOrder.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
    };
    cacheLogger.info('Cache cleared');
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpired(): void {
    let cleaned = 0;

    for (const [key, entry] of this.l1.entries()) {
      if (!this.isValid(entry)) {
        this.l1.delete(key);
        cleaned++;
      }
    }

    for (const [key, entry] of this.l2.entries()) {
      if (!this.isValid(entry)) {
        this.l2.delete(key);
        cleaned++;
      }
    }

    for (const [key, entry] of this.l3.entries()) {
      if (!this.isValid(entry)) {
        this.l3.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      cacheLogger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.size = this.l1.size + this.l2.size + this.l3.size;
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get cache size by level
   */
  getSizes(): { l1: number; l2: number; l3: number } {
    return {
      l1: this.l1.size,
      l2: this.l2.size,
      l3: this.l3.size,
    };
  }
}

