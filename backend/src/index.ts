/**
 * Presidium Control Center - Main Entry Point
 * 
 * Интеграция всех компонентов: CRDT, P2P, AI, PQC Crypto, Storage, Monitor, Cache, Sync
 */

import { loadConfig, getConfig } from './utils/config';
import { logger } from './utils/logger';
import { CRDTNode } from './core/crdt';
import { P2PNode } from './core/p2p-network';
import { AIEngine } from './core/ai-engine';
import { PQCCrypto } from './core/pqc-crypto';
import { SystemMonitor } from './systems/system-monitor';
import { StorageManager } from './systems/storage-manager';
import { CacheLayer } from './systems/cache-layer';
import { SyncEngine } from './systems/sync-engine';
import { WebRTCSignalingServer } from './core/p2p-webrtc-signaling';
import { DHT } from './core/p2p-dht';
import express from 'express';
import cors from 'cors';
import apiRoutesV2 from './api/routes-v2';
import { SystemConfig } from './models/types';
import { createServer } from 'http';

const mainLogger = logger.createChild({ module: 'presidium-node' });

/**
 * Presidium Node - Main Class
 * 
 * Инициализирует и управляет всеми компонентами системы
 */
class PresidiumNode {
  private config: SystemConfig | null = null;
  
  // Core components
  private crdt: CRDTNode | null = null;
  private p2p: P2PNode | null = null;
  private ai: AIEngine | null = null;
  private crypto: PQCCrypto | null = null;
  
  // Systems
  private monitor: SystemMonitor | null = null;
  private storage: StorageManager | null = null;
  private cache: CacheLayer | null = null;
  private sync: SyncEngine | null = null;
  
  // API
  private app: express.Application | null = null;
  private server: any = null;
  private signalingServer: WebRTCSignalingServer | null = null;
  private dht: DHT | null = null;

  /**
   * Initialize all components
   */
  async initialize(): Promise<void> {
    mainLogger.info('========================================');
    mainLogger.info('🚀 Presidium Control Center v1.0');
    mainLogger.info('========================================');
    mainLogger.info('Initializing components...');

    try {
      // 1. Load configuration
      this.config = loadConfig();
      mainLogger.info('✅ Configuration loaded', { nodeId: this.config.nodeId });

      // 2. Initialize crypto
      const cryptoConfig = this.config.crypto;
      this.crypto = new PQCCrypto(cryptoConfig);
      await this.crypto.generateNodeKeyPair(this.config.nodeId);
      mainLogger.info('✅ PQC Crypto initialized');

      // 3. Setup storage
      const storageConfig = this.config.storage;
      this.storage = new StorageManager(storageConfig);
      mainLogger.info('✅ Storage Manager initialized');

      // 4. Setup cache
      const cacheSize = this.config.storage.cacheSize;
      this.cache = new CacheLayer(cacheSize, cacheSize * 10);
      mainLogger.info('✅ Cache Layer initialized');

      // 5. Setup CRDT
      const crdtConfig = this.config.crdt;
      this.crdt = new CRDTNode(crdtConfig);
      mainLogger.info('✅ CRDT Node initialized');

      // 6. Setup Sync Engine
      if (!this.crdt) throw new Error('CRDT not initialized');
      this.sync = new SyncEngine(this.crdt);
      mainLogger.info('✅ Sync Engine initialized');

      // 7. Initialize DHT for peer discovery
      const p2pConfig = this.config.p2p;
      const bootstrapNodes = p2pConfig.bootstrapNodes.map(addr => {
        const [host, port] = addr.split(':');
        return { address: host, port: parseInt(port || '4000', 10) };
      });
      this.dht = new DHT(this.config.nodeId, bootstrapNodes);
      await this.dht.bootstrap();
      mainLogger.info('✅ DHT initialized for peer discovery');

      // 8. Start P2P node
      this.p2p = new P2PNode(p2pConfig, this.config.nodeId, this.crypto);
      await this.p2p.initialize();
      mainLogger.info('✅ P2P Node initialized');

      // 9. Load AI models
      const aiConfig = this.config.ai;
      this.ai = new AIEngine(aiConfig);
      await this.ai.initialize();
      mainLogger.info('✅ AI Engine initialized');

      // 10. Start monitor
      this.monitor = new SystemMonitor();
      mainLogger.info('✅ System Monitor initialized');

      // 11. Setup API endpoints
      await this.setupAPI();
      mainLogger.info('✅ API endpoints initialized');

      // 12. Start WebRTC Signaling server with shared DHT
      if (this.server) {
        const wsPort = this.config.api.wsPort || 3001;
        // Use shared DHT instance
        this.signalingServer = new WebRTCSignalingServer(wsPort, this.crypto, [], this.dht || undefined);
        this.signalingServer.initialize(this.server);
        mainLogger.info('✅ WebRTC Signaling server initialized with shared DHT');
      }

      // 13. Report status
      mainLogger.info('========================================');
      mainLogger.info('✅ System Ready');
      mainLogger.info('========================================');
      
      // Report detailed status
      const status = this.getStatus();
      mainLogger.info('📊 System Status:', {
        crypto: {
          initialized: this.crypto ? true : false,
          algorithm: this.crypto?.getStatus()?.algorithm || 'N/A',
        },
        p2p: {
          signaling: this.signalingServer ? true : false,
          dht: this.dht ? true : false,
          dhtNodes: this.dht?.getStats()?.totalNodes || 0,
        },
        storage: status.storage,
        ai: status.ai,
      });
      
      this.reportStatus();

    } catch (error) {
      mainLogger.fatal('Failed to initialize system', error);
      throw error;
    }
  }

  /**
   * Setup REST API
   */
  private async setupAPI(): Promise<void> {
    this.app = express();

    // CORS
    const corsOrigins = this.config!.api.corsOrigins;
    this.app.use(cors({
      origin: corsOrigins.includes('*') ? '*' : corsOrigins,
      credentials: true,
    }));

    // JSON parser
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime() * 1000,
        version: '1.0.0',
      });
    });

    // API v1 routes (attach node instance to routes)
    this.app.use('/api/v1', this.createAPIHandler());

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Presidium Control Center API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          api: '/api/v1',
        },
      });
    });

    // Create HTTP server for WebSocket support
    const port = this.config!.api.port;
    if (!this.app) {
      throw new Error('Express app not initialized');
    }
    
    this.server = createServer(this.app);
    this.server.listen(port, () => {
      mainLogger.info(`📍 API Server listening on http://localhost:${port}`);
    });

    // Handle server errors
    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        mainLogger.error(`Port ${port} is already in use`);
        // Try next port
        const nextPort = port + 1;
        if (this.app) {
          this.server = createServer(this.app);
          this.server.listen(nextPort, () => {
            mainLogger.info(`📍 API Server listening on http://localhost:${nextPort}`);
          });
        }
      } else {
        mainLogger.error('Server error', error);
      }
    });
  }

  /**
   * Create API handler with node instance
   */
  private createAPIHandler(): express.Router {
    const router = express.Router();

    // Health check endpoint with component status
    router.get('/health', (req, res) => {
      try {
        const cryptoStatus = this.crypto?.getStatus();
        const signalingStats = this.signalingServer?.getStats();
        const dhtStats = this.dht?.getStats();
        
        const health = {
          status: 'ok',
          timestamp: Date.now(),
          uptime: process.uptime() * 1000,
          version: '1.0.0',
          components: {
            crypto: {
              initialized: cryptoStatus?.initialized || false,
              algorithm: cryptoStatus?.algorithm || 'N/A',
              keyPairs: cryptoStatus?.keyPairs || 0,
              production: cryptoStatus?.production || false,
            },
            signaling: {
              active: !!this.signalingServer,
              connections: signalingStats?.connections || 0,
              peers: signalingStats?.connectedPeers || 0,
              port: this.config?.api?.wsPort || 3001,
            },
            dht: {
              active: !!this.dht,
              nodes: dhtStats?.totalNodes || 0,
              buckets: dhtStats?.bucketsUsed || 0,
              bootstrapNodes: dhtStats?.bootstrapNodes || 0,
            },
            p2p: {
              active: !!this.p2p,
            },
            storage: {
              active: !!this.storage,
            },
            ai: {
              active: !!this.ai,
            },
          },
        };

        // Check if critical components are initialized
        const isHealthy = 
          (cryptoStatus?.initialized || false) &&
          (this.signalingServer !== null) &&
          (this.dht !== null);

        res.status(isHealthy ? 200 : 503).json(health);
      } catch (error) {
        mainLogger.error('Health check error', error);
        res.status(503).json({
          status: 'error',
          error: 'Health check failed',
          timestamp: Date.now(),
        });
      }
    });

    // Metrics
    router.get('/metrics', (req, res) => {
      try {
        const metrics = this.monitor?.getMetrics();
        if (metrics) {
          res.json({
            cpu: {
              usage: metrics.cpu?.usage || 0,
            },
            memory: {
              usage: metrics.memory?.usage || 0,
              total: metrics.memory?.total || (8 * 1024 * 1024 * 1024), // 8GB in bytes
              used: metrics.memory?.used || (metrics.memory?.usage ? (metrics.memory.usage / 100) * (metrics.memory?.total || 8 * 1024 * 1024 * 1024) : 0),
            },
            disk: {
              usage: metrics.disk?.usage || 0,
            },
            network: {
              in: metrics.network?.bytesIn || 0,
              out: metrics.network?.bytesOut || 0,
            },
            threads: {
              active: metrics.threads?.active || 0,
              max: metrics.threads?.max || 10,
            },
            timestamp: metrics.timestamp || Date.now(),
          });
        } else {
          res.json({
            cpu: { usage: 0 },
            memory: { usage: 0, total: 8 * 1024 * 1024 * 1024, used: 0 },
            disk: { usage: 0 },
            network: { in: 0, out: 0 },
            threads: { active: 0, max: 10 },
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        mainLogger.error('Error getting metrics', error);
        res.status(500).json({
          error: 'Failed to get metrics',
          cpu: { usage: 0 },
          memory: { usage: 0, total: 8 * 1024 * 1024 * 1024, used: 0 },
          disk: { usage: 0 },
          network: { in: 0, out: 0 },
          threads: { active: 0, max: 10 },
          timestamp: Date.now(),
        });
      }
    });

    // Metrics history
    router.get('/metrics/history', (req, res) => {
      const from = req.query.from ? parseInt(req.query.from as string, 10) : Date.now() - 3600000;
      const to = req.query.to ? parseInt(req.query.to as string, 10) : Date.now();
      const history = this.monitor?.getHistory(from, to) || [];
      res.json({ metrics: history, from, to });
    });

    // Detailed metrics for geeks panel
    router.get('/metrics/detailed', (req, res) => {
      try {
        const metrics = this.monitor?.getMetrics();
        const history = this.monitor?.getHistory(Date.now() - 3600000, Date.now()) || [];
        
        // Get process memory info
        const processMemory = process.memoryUsage();
        const systemMemory = metrics?.memory || {};
        
        // Calculate memory breakdown
        const heapUsed = processMemory.heapUsed;
        const heapTotal = processMemory.heapTotal;
        const rss = processMemory.rss;
        const external = processMemory.external;
        const arrayBuffers = processMemory.arrayBuffers || 0;
        
        // Get cache stats
        const cacheStats = this.cache?.getStats();
        
        // Get storage stats
        const storageStats = this.storage?.getStats();
        
        // Get AI memory if available
        const aiMetrics = this.ai?.getMetrics();
        
        // Get thread/process info
        const threadInfo = {
          active: metrics?.threads?.active || 0,
          max: metrics?.threads?.max || 10,
          pid: process.pid,
          uptime: process.uptime(),
        };

        res.json({
          memory: {
            system: {
              total: systemMemory.total || (8 * 1024 * 1024 * 1024),
              used: systemMemory.used || 0,
              free: (systemMemory.total || (8 * 1024 * 1024 * 1024)) - (systemMemory.used || 0),
              usage: systemMemory.usage || 0,
            },
            process: {
              heapUsed,
              heapTotal,
              rss,
              external,
              arrayBuffers,
              heapUsage: heapTotal > 0 ? (heapUsed / heapTotal) * 100 : 0,
            },
            breakdown: {
              nodejs: {
                heap: heapUsed,
                external,
                arrayBuffers,
              },
              ai: {
                models: aiMetrics?.memoryUsage || 0,
                loaded: this.ai?.isLoaded() || false,
              },
              cache: {
                size: (cacheStats?.size || 0) * 1024 * 1024, // Approximate: size entries * 1MB per entry
                maxSize: this.cache ? ((this.cache as any).maxL1Size + (this.cache as any).maxL2Size) * 1024 * 1024 : 0,
                hitRate: cacheStats?.hitRate || 0,
              },
              storage: {
                local: storageStats?.localUsed || 0,
                distributed: storageStats?.distributedSize || 0,
              },
            },
          },
          cpu: {
            usage: metrics?.cpu?.usage || 0,
            cores: require('os').cpus().length,
            loadAverage: require('os').loadavg(),
          },
          network: {
            in: metrics?.network?.bytesIn || 0,
            out: metrics?.network?.bytesOut || 0,
            total: (metrics?.network?.bytesIn || 0) + (metrics?.network?.bytesOut || 0),
          },
          threads: threadInfo,
          history: history.slice(-100), // Last 100 data points
          timestamp: Date.now(),
        });
      } catch (error) {
        mainLogger.error('Error getting detailed metrics', error);
        res.status(500).json({
          error: 'Failed to get detailed metrics',
          timestamp: Date.now(),
        });
      }
    });

    // Peers
    router.get('/peers', (req, res) => {
      try {
        // Get peers from both old P2P node and new WebRTC signaling server
        const oldPeers = this.p2p?.getPeers() || [];
        const oldStats = this.p2p?.getStats();
        const signalingStats = this.signalingServer?.getStats();
        const dhtStats = this.dht?.getStats();
        
        // Combine stats from all systems
        const connectedPeers = (oldStats?.peersConnected || 0) + (signalingStats?.connectedPeers || 0);
        const totalPeers = (oldStats?.peersTotal || 0) + (signalingStats?.peers || 0);
        const dhtNodes = dhtStats?.totalNodes || 0;
        
        res.json({
          connected: connectedPeers,
          total: totalPeers + dhtNodes,
          list: oldPeers,
          signaling: signalingStats || null,
          dht: dhtStats || null,
        });
      } catch (error) {
        mainLogger.error('Error getting peers status', error);
        res.status(500).json({
          error: 'Failed to get peers status',
          connected: 0,
          total: 0,
          list: [],
        });
      }
    });

    // DHT nodes
    router.get('/dht/nodes', (req, res) => {
      try {
        const nodes = this.dht?.getAllNodes() || [];
        const stats = this.dht?.getStats();
        res.json({
          nodes,
          stats: stats || null,
        });
      } catch (error) {
        mainLogger.error('Error getting DHT nodes', error);
        res.status(500).json({
          error: 'Failed to get DHT nodes',
          nodes: [],
          stats: null,
        });
      }
    });

    // PQC Crypto status
    router.get('/crypto/status', (req, res) => {
      try {
        const status = this.crypto?.getStatus() || {
          initialized: false,
          algorithm: 'N/A',
          keyPairs: 0,
          kyberKeySize: 0,
          dilithiumKeySize: 0,
          production: false,
        };
        res.json(status);
      } catch (error) {
        mainLogger.error('Error getting PQC status', error);
        res.status(500).json({
          error: 'Failed to get PQC status',
          initialized: false,
        });
      }
    });

    // CRDT sync
    router.post('/crdt/sync', (req, res) => {
      const { changes, vectorClock } = req.body;
      if (this.crdt && changes) {
        const merged = this.crdt.merge(changes);
        res.json({ success: true, merged });
      } else {
        res.json({ success: false, merged: 0 });
      }
    });

    // Storage stats
    router.get('/storage/stats', (req, res) => {
      const stats = this.storage?.getStats();
      const cacheStats = this.cache?.getStats();
      res.json({
        local: {
          used: stats?.localUsed || 0,
          total: stats?.localTotal || 0,
        },
        cache: {
          used: cacheStats?.size || 0,
          total: cacheStats?.size || 0,
        },
        distributed: {
          used: stats?.distributedSize || 0,
        },
      });
    });

    // AI status
    router.get('/ai/status', (req, res) => {
      const models = this.ai?.getModelStatus() || [];
      const metrics = this.ai?.getMetrics() || { memoryUsage: 0 };
      res.json({
        loaded: this.ai?.isLoaded() || false,
        models: models.length,
        memoryUsage: metrics.memoryUsage,
      });
    });

    // AI analyze
    router.post('/ai/analyze', async (req, res) => {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'text is required', code: 'VALIDATION_ERROR', timestamp: Date.now() });
      }
      if (this.ai) {
        try {
          const result = await this.ai.analyze(text);
          res.json(result);
        } catch (error: any) {
          res.status(500).json({ error: error.message, code: 'AI_ERROR', timestamp: Date.now() });
        }
      } else {
        res.status(503).json({ error: 'AI Engine not available', code: 'AI_NOT_LOADED', timestamp: Date.now() });
      }
    });

    // AI generate
    router.post('/ai/generate', async (req, res) => {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'prompt is required', code: 'VALIDATION_ERROR', timestamp: Date.now() });
      }
      if (this.ai) {
        try {
          const result = await this.ai.generate(prompt);
          res.json(result);
        } catch (error: any) {
          res.status(500).json({ error: error.message, code: 'AI_ERROR', timestamp: Date.now() });
        }
      } else {
        res.status(503).json({ error: 'AI Engine not available', code: 'AI_NOT_LOADED', timestamp: Date.now() });
      }
    });

    // System status
    router.get('/system/status', (req, res) => {
      const health = this.monitor?.getHealthStatus();
      if (health) {
        res.json(health);
      } else {
        res.json({ status: 'unknown', timestamp: Date.now(), alerts: [], metrics: {} });
      }
    });

    return router;
  }

  /**
   * Get system status
   */
  getStatus(): {
    crdt: { operations: number; synced: boolean };
    p2p: { peers: number; status: string };
    ai: { loaded: number; memory: string };
    storage: { local: string; distributed: string };
    sync: string;
    monitor: { cpu: number; mem: number };
  } {
    const crdtOps = this.crdt?.getHistory().length || 0;
    const crdtVectorClock = this.crdt?.getVectorClock() || {};
    const p2pStats = this.p2p?.getStats();
    const aiModels = this.ai?.getModelStatus() || [];
    const aiMetrics = this.ai?.getMetrics() || { memoryUsage: 0 };
    const storageStats = this.storage?.getStats();
    const syncState = this.sync?.getState();
    const metrics = this.monitor?.getMetrics();

    return {
      crdt: {
        operations: crdtOps,
        synced: Object.keys(crdtVectorClock).length > 0,
      },
      p2p: {
        peers: (p2pStats?.peersConnected || 0) + (this.signalingServer?.getStats().connectedPeers || 0),
        status: (p2pStats?.peersConnected || 0) + (this.signalingServer?.getStats().connectedPeers || 0) > 0 ? 'OK' : 'DISCONNECTED',
      },
      ai: {
        loaded: aiModels.length,
        memory: `${(aiMetrics.memoryUsage / 1024 / 1024 / 1024).toFixed(1)}GB`,
      },
      storage: {
        local: storageStats
          ? `${(storageStats.localUsed / 1024 / 1024 / 1024).toFixed(1)}/${(storageStats.localTotal / 1024 / 1024 / 1024).toFixed(0)}GB`
          : '0/0GB',
        distributed: storageStats
          ? `${(storageStats.distributedSize / 1024 / 1024 / 1024).toFixed(1)}GB`
          : '0GB',
      },
      sync: syncState?.status || 'UNKNOWN',
      monitor: {
        cpu: metrics?.cpu.usage || 0,
        mem: metrics?.memory.usage || 0,
      },
    };
  }

  /**
   * Report status
   */
  private reportStatus(): void {
    const status = this.getStatus();
    mainLogger.info('📊 System Status:', status);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    mainLogger.info('Shutting down Presidium Node...');

    // Shutdown components in reverse order
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    if (this.signalingServer) await this.signalingServer.shutdown();
    if (this.sync) await this.sync.shutdown();
    if (this.cache) this.cache.clear();
    if (this.storage) await this.storage.shutdown();
    if (this.p2p) await this.p2p.shutdown();
    if (this.ai) await this.ai.shutdown();
    if (this.crdt) this.crdt.shutdown();
    if (this.monitor) this.monitor.shutdown();

    mainLogger.info('✅ Shutdown complete');
  }
}

// Main execution
async function main() {
  const node = new PresidiumNode();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    mainLogger.info('Received SIGINT, shutting down gracefully...');
    await node.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    mainLogger.info('Received SIGTERM, shutting down gracefully...');
    await node.shutdown();
    process.exit(0);
  });

  // Initialize and start
  try {
    await node.initialize();
  } catch (error) {
    mainLogger.fatal('Failed to start Presidium Node', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

export { PresidiumNode };
export default main;

