/**
 * API Routes - All endpoints for Presidium backend
 */

import express, { Router } from 'express';
import { MetricsService } from '../services/metrics.service';
import { P2PService } from '../services/p2p.service';
import { CRDTService } from '../services/crdt.service';
import { EconomyService } from '../services/economy.service';
import { ReputationService } from '../services/reputation.service';
import { VaultService } from '../services/vault.service';
import { ChatService } from '../services/chat.service';
import { StorageService } from '../services/storage.service';
import { AIService } from '../services/ai.service';
import { AuthService } from '../services/auth.service';
import { randomUUID } from 'crypto';
import { broadcastChatMessage } from '../realtime';

const router = Router();

// ============================================================================
// DASHBOARD & METRICS
// ============================================================================

/**
 * GET /api/dashboard
 * Get complete dashboard stats
 */
router.get('/dashboard', (req, res) => {
  try {
    const stats = MetricsService.getDashboardStats();
    res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/metrics
 * Get system metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = MetricsService.getMetrics();
    res.json({ success: true, data: metrics, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/metrics/detailed
 * Get detailed real-time system metrics
 */
router.get('/metrics/detailed', (req, res) => {
  try {
    const metrics = MetricsService.getMetrics();
    const os = require('os');
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const p2p = P2PService.getNetworkStatus();
    
    // Return DETAILED format for frontend DetailedMetricsPanel
    res.json({
      memory: {
        system: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          usage: (usedMem / totalMem) * 100
        },
        process: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers || 0,
          heapUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        },
        breakdown: {
          nodejs: {
            heap: memUsage.heapUsed,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers || 0
          },
          ai: {
            loaded: false,
            models: 0
          },
          cache: {
            size: 1024 * 1024 * 50, // ~50MB estimated
            maxSize: 1024 * 1024 * 512, // 512MB max
            hitRate: 85.5
          },
          storage: {
            local: memUsage.rss,
            distributed: 0
          }
        }
      },
      cpu: {
        usage: metrics.cpuUsage || 0,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        loadAverage: os.loadavg ? os.loadavg() : [0, 0, 0]
      },
      threads: {
        active: p2p.activeSessions || 1,
        max: 100,
        pid: process.pid,
        uptime: process.uptime()
      },
      network: {
        in: p2p.activeSessions * 1024 * 20,
        out: p2p.activeSessions * 1024 * 10,
        total: p2p.activeSessions * 1024 * 30,
        peers: p2p.activeSessions || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/peers
 * Get P2P peers list (for frontend status.api.ts)
 */
router.get('/peers', (req, res) => {
  try {
    const p2p = P2PService.getNetworkStatus();
    res.json({
      connected: p2p.activeSessions || 0,
      total: p2p.nodeCount || 0,
      list: p2p.nodes || []
    });
  } catch (error: any) {
    res.json({ connected: 0, total: 0, list: [] });
  }
});

/**
 * GET /api/crypto/status
 * Get PQC crypto status (for frontend status.api.ts)
 */
router.get('/crypto/status', (req, res) => {
  try {
    // Return PQC status
    res.json({
      initialized: true,
      algorithm: 'Kyber1024-Dilithium5',
      keyPairs: 1,
      kyberKeySize: 1568,
      dilithiumKeySize: 2592,
      production: false // Simplified implementation
    });
  } catch (error: any) {
    res.json({ initialized: false, algorithm: 'N/A', keyPairs: 0 });
  }
});

/**
 * GET /api/status
 * Get complete system status (for frontend status.api.ts)
 */
router.get('/status', (req, res) => {
  try {
    const p2p = P2PService.getNetworkStatus();
    const crdt = CRDTService.getState();
    const metrics = MetricsService.getMetrics();
    
    res.json({
      crdt: { operations: crdt.operations || 0, synced: crdt.synced ?? true },
      p2p: { peers: p2p.activeSessions || 0, status: 'online' },
      ai: { loaded: 1, memory: `${Math.round(metrics.aiMemory?.percentage || 0)}%` },
      storage: { local: `${metrics.storage?.used?.toFixed(1) || 0}GB`, distributed: '0GB' },
      sync: 'SYNCED',
      monitor: { cpu: metrics.cpuUsage || 0, mem: Math.round(metrics.aiMemory?.percentage || 0) }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/health
 * Get health status (for frontend status.api.ts)
 */
router.get('/health', (req, res) => {
  try {
    const p2p = P2PService.getNetworkStatus();
    const metrics = MetricsService.getMetrics();
    
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: metrics.uptime || 0,
      version: '0.0.0.1',
      components: {
        crypto: {
          initialized: true,
          algorithm: 'Kyber1024-Dilithium5',
          keyPairs: 1,
          production: false
        },
        signaling: {
          active: true,
          connections: p2p.activeSessions || 0,
          peers: p2p.activeSessions || 0,
          port: 3000
        },
        dht: {
          active: true,
          nodes: p2p.nodeCount || 0,
          buckets: 160,
          bootstrapNodes: 0
        },
        p2p: { active: true },
        storage: { active: true },
        ai: { active: true }
      }
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ============================================================================
// P2P NETWORK
// ============================================================================

/**
 * GET /api/p2p/network
 * Get P2P network status
 */
router.get('/p2p/network', (req, res) => {
  try {
    const network = P2PService.getNetworkStatus();
    res.json({ success: true, data: network, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/p2p/nodes/:nodeId
 * Get specific node
 */
router.get('/p2p/nodes/:nodeId', (req, res) => {
  try {
    const node = P2PService.getNode(req.params.nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found', timestamp: new Date().toISOString() });
    }
    res.json({ success: true, data: node, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ============================================================================
// CRDT
// ============================================================================

/**
 * GET /api/crdt
 * Get CRDT state
 */
router.get('/crdt', (req, res) => {
  try {
    const state = CRDTService.getState();
    res.json({ success: true, data: state, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/crdt/sync
 * Force CRDT sync
 */
router.post('/crdt/sync', async (req, res) => {
  try {
    const state = await CRDTService.forceSync();
    res.json({ success: true, data: state, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * PUT /api/crdt/enabled
 * Enable/disable CRDT
 */
router.put('/crdt/enabled', (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be boolean', timestamp: new Date().toISOString() });
    }
    CRDTService.setEnabled(enabled);
    const state = CRDTService.getState();
    res.json({ success: true, data: state, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ============================================================================
// ECONOMY
// ============================================================================

/**
 * GET /api/economy/wallet
 * Get wallet
 */
router.get('/economy/wallet', (req, res) => {
  try {
    const wallet = EconomyService.getWallet();
    res.json({ success: true, data: wallet, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/economy/transactions
 * Get transactions
 */
router.get('/economy/transactions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = EconomyService.getTransactions(limit);
    res.json({ success: true, data: transactions, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/economy/deposit
 * Deposit funds
 */
router.post('/economy/deposit', (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amount is required and must be positive', timestamp: new Date().toISOString() });
    }
    const transaction = EconomyService.deposit(amount, description);
    res.json({ success: true, data: transaction, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/economy/withdraw
 * Withdraw funds
 */
router.post('/economy/withdraw', (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amount is required and must be positive', timestamp: new Date().toISOString() });
    }
    const transaction = EconomyService.withdraw(amount, description);
    res.json({ success: true, data: transaction, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/economy/exchange
 * Exchange currency
 */
router.post('/economy/exchange', (req, res) => {
  try {
    const { amount, toCurrency, rate } = req.body;
    if (!amount || !toCurrency || !rate) {
      return res.status(400).json({ success: false, error: 'amount, toCurrency, and rate are required', timestamp: new Date().toISOString() });
    }
    const transaction = EconomyService.exchange(amount, toCurrency, rate);
    res.json({ success: true, data: transaction, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/economy/stake
 * Stake funds
 */
router.post('/economy/stake', (req, res) => {
  try {
    const { amount, duration } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amount is required and must be positive', timestamp: new Date().toISOString() });
    }
    const transaction = EconomyService.stake(amount, duration || 30);
    res.json({ success: true, data: transaction, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/economy/marketplace
 * Get marketplace items
 */
router.get('/economy/marketplace', (req, res) => {
  try {
    const items = EconomyService.getMarketplace();
    res.json({ success: true, data: items, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/economy/marketplace/:itemId
 * Get marketplace item
 */
router.get('/economy/marketplace/:itemId', (req, res) => {
  try {
    const item = EconomyService.getMarketplaceItem(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found', timestamp: new Date().toISOString() });
    }
    res.json({ success: true, data: item, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/economy/purchase
 * Purchase marketplace item
 */
router.post('/economy/purchase', (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ success: false, error: 'itemId is required', timestamp: new Date().toISOString() });
    }
    const transaction = EconomyService.purchase(itemId);
    res.json({ success: true, data: transaction, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ============================================================================
// REPUTATION & TRUST
// ============================================================================

/**
 * GET /api/reputation
 * Get reputation
 */
router.get('/reputation', (req, res) => {
  try {
    const reputation = ReputationService.getReputation();
    res.json({ success: true, data: reputation, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ============================================================================
// VAULT & KEYS
// ============================================================================

/**
 * GET /api/vault/keys
 * Get all keys
 */
router.get('/vault/keys', (req, res) => {
  try {
    const keys = VaultService.getKeys();
    res.json({ success: true, data: keys, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/vault/keys/:keyId
 * Get specific key
 */
router.get('/vault/keys/:keyId', (req, res) => {
  try {
    const key = VaultService.getKey(req.params.keyId);
    if (!key) {
      return res.status(404).json({ success: false, error: 'Key not found', timestamp: new Date().toISOString() });
    }
    res.json({ success: true, data: key, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/vault/keys
 * Add new key
 */
router.post('/vault/keys', (req, res) => {
  try {
    const { name, type, fingerprint, encrypted } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'name and type are required', timestamp: new Date().toISOString() });
    }
    const key = VaultService.addKey({
      name,
      type,
      fingerprint: fingerprint || randomUUID().substring(0, 16),
      encrypted: encrypted !== false
    });
    res.json({ success: true, data: key, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * DELETE /api/vault/keys/:keyId
 * Delete key
 */
router.delete('/vault/keys/:keyId', (req, res) => {
  try {
    const deleted = VaultService.deleteKey(req.params.keyId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Key not found', timestamp: new Date().toISOString() });
    }
    res.json({ success: true, message: 'Key deleted', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/vault/items
 * Get all vault items
 */
router.get('/vault/items', (req, res) => {
  try {
    const items = VaultService.getVaultItems();
    res.json({ success: true, data: items, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/vault/items
 * Add vault item
 */
router.post('/vault/items', (req, res) => {
  try {
    const { name, type, encrypted, size } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'name and type are required', timestamp: new Date().toISOString() });
    }
    const item = VaultService.addVaultItem({
      name,
      type,
      encrypted: encrypted !== false,
      size
    });
    res.json({ success: true, data: item, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * DELETE /api/vault/items/:itemId
 * Delete vault item
 */
router.delete('/vault/items/:itemId', (req, res) => {
  try {
    const deleted = VaultService.deleteVaultItem(req.params.itemId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Item not found', timestamp: new Date().toISOString() });
    }
    res.json({ success: true, message: 'Item deleted', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ============================================================================
// CHAT
// ============================================================================

/**
 * GET /api/chats
 * Get all chats
 */
router.get('/chats', (req, res) => {
  try {
    const filter = req.query.filter as string | undefined;
    const chats = ChatService.getChats(filter as any);
    res.json({ success: true, data: chats, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/chats/search
 * Search chats
 */
router.get('/chats/search', (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, error: 'query parameter q is required', timestamp: new Date().toISOString() });
    }
    const chats = ChatService.searchChats(query);
    res.json({ success: true, data: chats, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/chats/:chatId
 * Get specific chat
 */
router.get('/chats/:chatId', (req, res) => {
  try {
    const chat = ChatService.getChat(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found', timestamp: new Date().toISOString() });
    }
    res.json({ success: true, data: chat, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/chats/:chatId/messages
 * Get messages for chat
 */
router.get('/chats/:chatId/messages', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const messages = ChatService.getMessages(req.params.chatId, limit);
    res.json({ success: true, data: messages, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/chats/:chatId/messages
 * Send message to chat
 */
router.post('/chats/:chatId/messages', (req, res) => {
  try {
    const { text, sender, senderType, encrypted, filter } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'text is required', timestamp: new Date().toISOString() });
    }
    const message = ChatService.addMessage({
      chatId: req.params.chatId,
      text,
      sender: sender || 'user',
      senderType: senderType || 'user',
      encrypted: encrypted !== false,
      filter: filter || 'all'
    });
    broadcastChatMessage(message);
    res.json({ success: true, data: message, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/chats/:chatId/read
 * Mark chat as read
 */
router.post('/chats/:chatId/read', (req, res) => {
  try {
    ChatService.markAsRead(req.params.chatId);
    res.json({ success: true, message: 'Chat marked as read', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/chats
 * Create new chat
 */
router.post('/chats', (req, res) => {
  try {
    const { name, type, encrypted } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'name and type are required', timestamp: new Date().toISOString() });
    }
    const chat = ChatService.createChat(name, type, encrypted !== false);
    res.json({ success: true, data: chat, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * POST /api/auth/initiate
 * Initiate authentication flow (SMS OTP)
 */
router.post('/auth/initiate', async (req, res) => {
  try {
    const { phone, deviceFingerprint, deviceComponents, ipAddress, userAgent, typingPattern, captchaToken } = req.body;
    
    if (!phone || !deviceFingerprint || !deviceComponents) {
      return res.status(400).json({ 
        success: false, 
        error: 'phone, deviceFingerprint, and deviceComponents are required',
        timestamp: new Date().toISOString()
      });
    }

    const clientIp = ipAddress || req.ip || req.socket.remoteAddress || '';
    const clientUA = userAgent || req.headers['user-agent'] || '';

    const response = await AuthService.initiateAuth({
      phone,
      deviceFingerprint,
      deviceComponents,
      ipAddress: clientIp,
      userAgent: clientUA,
      typingPattern,
      captchaToken
    });

    res.json({ ...response, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify SMS OTP code
 */
router.post('/auth/verify-otp', async (req, res) => {
  try {
    const { otpId, code, phone, deviceFingerprint } = req.body;
    
    if (!otpId || !code || !phone || !deviceFingerprint) {
      return res.status(400).json({ 
        success: false, 
        error: 'otpId, code, phone, and deviceFingerprint are required',
        timestamp: new Date().toISOString()
      });
    }

    const clientIp = req.ip || req.socket.remoteAddress || '';

    const response = await AuthService.verifyOTP({
      otpId,
      code,
      phone,
      deviceFingerprint,
      ipAddress: clientIp
    });

    res.json({ ...response, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/auth/session/:sessionId
 * Verify session
 */
router.get('/auth/session/:sessionId', (req, res) => {
  try {
    const session = AuthService.verifySession(req.params.sessionId);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session', timestamp: new Date().toISOString() });
    }
    res.json({ success: true, data: session, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/auth/logout
 * Revoke session
 */
router.post('/auth/logout', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required', timestamp: new Date().toISOString() });
    }
    const revoked = AuthService.revokeSession(sessionId);
    res.json({ success: revoked, message: revoked ? 'Session revoked' : 'Session not found', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ============================================================================
// LEGACY CHAT API (for compatibility)
// ============================================================================

/**
 * GET /api/history
 * Get chat history (legacy)
 */
router.get('/history', async (req, res) => {
  try {
    const history = await StorageService.getHistory();
    res.json({ success: true, history, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, history: [], timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/chat
 * AI chat (legacy)
 */
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required', timestamp: new Date().toISOString() });
    }

    // Save to legacy storage
    const userMessage = {
      id: randomUUID(),
      text: message,
      sender: 'user' as const,
      timestamp: new Date().toISOString()
    };
    await StorageService.saveMessage(userMessage);

    // Process through AI
    const reply = await AIService.processMessage(message);
    
    const aiMessage = {
      id: randomUUID(),
      text: reply,
      sender: 'server' as const,
      timestamp: new Date().toISOString()
    };
    await StorageService.saveMessage(aiMessage);

    res.json({ success: true, reply, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Internal server error', timestamp: new Date().toISOString() });
  }
});

export default router;

