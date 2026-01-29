/**
 * Vault Service - Manages encrypted storage and keys
 */

import { CryptoKey, VaultItem } from '../types/system.types';
import { randomUUID } from 'crypto';

export class VaultService {
  private static keys: Map<string, CryptoKey> = new Map();
  private static vault: Map<string, VaultItem> = new Map();

  /**
   * Initialize vault with default keys
   */
  static initialize() {
    // Master key
    this.keys.set('master', {
      id: 'master-key-1',
      name: 'Master Key',
      type: 'master',
      fingerprint: 'A1:B2:C3:D4:E5:F6:G7:H8',
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      lastUsed: new Date().toISOString(),
      encrypted: true
    });

    // P2P key
    this.keys.set('p2p', {
      id: 'p2p-key-1',
      name: 'P2P Network Key',
      type: 'p2p',
      fingerprint: 'B2:C3:D4:E5:F6:G7:H8:I9',
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      lastUsed: new Date().toISOString(),
      encrypted: true
    });

    // Session keys (3)
    for (let i = 0; i < 3; i++) {
      this.keys.set(`session-${i}`, {
        id: `session-key-${i}`,
        name: `Session Key ${i + 1}`,
        type: 'session',
        fingerprint: `C${i}:D${i+1}:E${i+2}:F${i+3}`,
        createdAt: new Date(Date.now() - 86400000 * (7 - i)).toISOString(),
        lastUsed: new Date(Date.now() - 3600000 * i).toISOString(),
        encrypted: true
      });
    }
  }

  /**
   * Get all keys
   */
  static getKeys(): CryptoKey[] {
    return Array.from(this.keys.values());
  }

  /**
   * Get key by ID
   */
  static getKey(keyId: string): CryptoKey | null {
    return this.keys.get(keyId) || Array.from(this.keys.values()).find(k => k.id === keyId) || null;
  }

  /**
   * Add key
   */
  static addKey(key: Omit<CryptoKey, 'id' | 'createdAt'>): CryptoKey {
    const newKey: CryptoKey = {
      ...key,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.keys.set(newKey.id, newKey);
    return newKey;
  }

  /**
   * Delete key
   */
  static deleteKey(keyId: string): boolean {
    const key = this.getKey(keyId);
    if (key && key.type === 'master') {
      throw new Error('Cannot delete master key');
    }
    return this.keys.delete(keyId) || false;
  }

  /**
   * Update key last used
   */
  static updateKeyUsage(keyId: string): void {
    const key = this.getKey(keyId);
    if (key) {
      key.lastUsed = new Date().toISOString();
    }
  }

  /**
   * Get all vault items
   */
  static getVaultItems(): VaultItem[] {
    return Array.from(this.vault.values());
  }

  /**
   * Add vault item
   */
  static addVaultItem(item: Omit<VaultItem, 'id' | 'createdAt' | 'modifiedAt'>): VaultItem {
    const now = new Date().toISOString();
    const newItem: VaultItem = {
      ...item,
      id: randomUUID(),
      createdAt: now,
      modifiedAt: now
    };
    this.vault.set(newItem.id, newItem);
    return newItem;
  }

  /**
   * Get vault item
   */
  static getVaultItem(itemId: string): VaultItem | null {
    return this.vault.get(itemId) || null;
  }

  /**
   * Delete vault item
   */
  static deleteVaultItem(itemId: string): boolean {
    return this.vault.delete(itemId);
  }

  /**
   * Update vault item
   */
  static updateVaultItem(itemId: string, updates: Partial<VaultItem>): VaultItem | null {
    const item = this.vault.get(itemId);
    if (!item) return null;

    const updated: VaultItem = {
      ...item,
      ...updates,
      modifiedAt: new Date().toISOString()
    };
    this.vault.set(itemId, updated);
    return updated;
  }
}

// Initialize on module load
VaultService.initialize();

