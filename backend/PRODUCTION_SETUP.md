# Production Setup Guide

## 📦 Production Libraries Integration

### 1. PQC Crypto (liboqs-node)

**Status:** ✅ Production version created in `src/core/pqc-crypto-production.ts`

**Installation:**
```bash
npm install liboqs-node
```

**Usage:**
```typescript
import { PQCCryptoProduction } from './core/pqc-crypto-production';

const crypto = new PQCCryptoProduction(config);

// Check if liboqs is available
if (crypto.isOQSAvailable()) {
  // Use real Kyber1024 and Dilithium5
} else {
  // Falls back to simplified implementation
}
```

**Features:**
- ✅ Real Kyber1024 KEM
- ✅ Real Dilithium5 Signatures
- ✅ Automatic fallback if liboqs-node not available
- ✅ Quantum-resistant cryptography

### 2. AI Engine (@xenova/transformers)

**Status:** ✅ Production version created in `src/core/ai-engine-production.ts`

**Installation:**
```bash
npm install @xenova/transformers
```

**Usage:**
```typescript
import { AIEngineProduction } from './core/ai-engine-production';

const ai = new AIEngineProduction(config);
await ai.initialize();

// Real models will be loaded:
// - Phi-2 for text generation
// - Sentence-transformers for embeddings
// - DistilBERT for NER
```

**Supported Models:**
- Text Generation: `Xenova/phi-2` or `microsoft/phi-2`
- Embeddings: `Xenova/all-MiniLM-L6-v2`
- NER: `Xenova/distilbert-base-uncased-finetuned-conll03-english`

### 3. Storage Manager (RocksDB)

**Status:** ✅ Production version created in `src/systems/storage-manager-production.ts`

**Installation:**
```bash
npm install rocksdb
```

**Usage:**
```typescript
import { StorageManagerProduction } from './systems/storage-manager-production';

const storage = new StorageManagerProduction(config);
await storage.initialize();

// Uses RocksDB for high-performance storage
await storage.put('key', value);
const value = await storage.get('key');
```

**Features:**
- ✅ RocksDB backend (or file-based fallback)
- ✅ Compression support (snappy)
- ✅ High performance reads/writes
- ✅ Tiered storage (hot/warm/cold)

### 4. WebSocket Server

**Status:** ✅ Implemented in `src/api/websocket.ts`

**Features:**
- ✅ Real-time metrics updates (every 500ms)
- ✅ Peer connection updates (every 5s)
- ✅ Sync status updates (every 2s)
- ✅ Connection management with ping/pong
- ✅ Subscription-based channels
- ✅ Automatic cleanup

**Usage:**
```typescript
import { WebSocketServerManager } from './api/websocket';

const wsServer = new WebSocketServerManager(3001);
wsServer.initialize(httpServer);

// Set callbacks for data providers
wsServer.setMetricsCallback(() => monitor.getMetrics());
wsServer.setPeersCallback(() => p2p.getPeers());
wsServer.setSyncStateCallback(() => sync.getState());
```

**Client Example:**
```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

// Subscribe to channels
ws.send(JSON.stringify({
  type: 'SUBSCRIBE',
  channels: ['metrics', 'peers', 'sync']
}));

// Receive updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message.type, message.data);
};
```

## 🧪 Testing

### Unit Tests

**Status:** ✅ Created in `test/unit/crdt.test.ts`

**Run tests:**
```bash
npm test
npm run test:watch
npm run test:coverage
```

**Coverage:**
- CRDT operations
- Merge operations
- Vector clock
- Serialization

### Integration Tests

**Status:** ✅ Created in `test/integration/node.test.ts`

**Run integration tests:**
```bash
npm test -- integration
```

**Coverage:**
- Full node initialization
- Component integration
- API endpoints
- Graceful shutdown

## 🐳 Docker

### Build Image

```bash
cd backend
docker build -t presidium-backend:latest .
```

### Run Container

```bash
docker run -d \
  --name presidium-backend \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 4000:4000 \
  -e NODE_ID=presidium-node-1 \
  -v presidium-data:/app/data \
  presidium-backend:latest
```

### Docker Compose

```bash
docker-compose up -d
```

**Services:**
- `presidium-backend` - Main application
- `redis` - Optional distributed cache

**Volumes:**
- `presidium-data` - RocksDB storage
- `presidium-models` - AI models

## ☸️ Kubernetes

### Prerequisites

- Kubernetes cluster
- kubectl configured
- PersistentVolume provisioner

### Deploy

```bash
# Create namespace
kubectl create namespace presidium

# Deploy PVCs
kubectl apply -f k8s/deployment.yaml

# Deploy services
kubectl apply -f k8s/service.yaml

# Deploy ingress (optional)
kubectl apply -f k8s/ingress.yaml
```

### Scale

```bash
kubectl scale deployment presidium-backend --replicas=3 -n presidium
```

### Monitor

```bash
# Pods
kubectl get pods -n presidium

# Logs
kubectl logs -f deployment/presidium-backend -n presidium

# Status
kubectl describe deployment presidium-backend -n presidium
```

## 📊 Production Checklist

### Before Deployment

- [ ] Install production libraries:
  - [ ] `npm install liboqs-node`
  - [ ] `npm install @xenova/transformers`
  - [ ] `npm install rocksdb`
- [ ] Configure environment variables
- [ ] Set up persistent storage
- [ ] Configure CORS origins
- [ ] Set up monitoring/alerting
- [ ] Configure SSL/TLS
- [ ] Set up backup strategy

### Docker

- [ ] Build Docker image
- [ ] Test container locally
- [ ] Push to container registry
- [ ] Configure health checks
- [ ] Set resource limits

### Kubernetes

- [ ] Create namespace
- [ ] Configure PVCs
- [ ] Deploy application
- [ ] Configure ingress
- [ ] Set up monitoring
- [ ] Configure autoscaling
- [ ] Set up backup/restore

### Security

- [ ] Enable PQC crypto (liboqs-node)
- [ ] Configure JWT secrets
- [ ] Set up rate limiting
- [ ] Configure firewall rules
- [ ] Enable TLS/SSL
- [ ] Set up secret management (K8s secrets)

### Monitoring

- [ ] Set up metrics collection
- [ ] Configure alerts
- [ ] Set up log aggregation
- [ ] Configure APM (Application Performance Monitoring)

## 🚀 Deployment Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Run Tests

```bash
npm test
```

### 4. Build Docker Image

```bash
docker build -t presidium-backend:latest .
```

### 5. Push to Registry

```bash
docker tag presidium-backend:latest your-registry/presidium-backend:latest
docker push your-registry/presidium-backend:latest
```

### 6. Deploy to Kubernetes

```bash
# Update image in deployment.yaml
kubectl apply -f k8s/
```

### 7. Verify

```bash
kubectl get pods -n presidium
kubectl logs -f deployment/presidium-backend -n presidium
curl http://localhost:3000/health
```

## 📝 Environment Variables

### Required

```env
NODE_ID=presidium-node-1
NODE_ENV=production
PORT=3000
```

### Optional

```env
# P2P
P2P_PORT=4000
BOOTSTRAP_NODES=node1.example.com,node2.example.com
MAX_PEERS=12

# Storage
STORAGE_DB_PATH=/app/data/rocksdb
STORAGE_CACHE_SIZE=1024

# AI
AI_MODEL_PATH=/app/models
AI_DEVICE=cpu
AI_MEMORY_LIMIT=8

# CORS
CORS_ORIGINS=https://presidium.example.com,https://app.presidium.example.com
```

## 🔧 Troubleshooting

### liboqs-node Installation Issues

If `liboqs-node` fails to install:
```bash
# Install build tools
sudo apt-get install python3 make g++

# Try again
npm install liboqs-node
```

### RocksDB Build Issues

If RocksDB fails to build:
```bash
# Install dependencies
sudo apt-get install libsnappy-dev libbz2-dev libzstd-dev liblz4-dev

# Rebuild
npm rebuild rocksdb
```

### AI Models Not Loading

Check model path and disk space:
```bash
ls -lh /app/models
df -h
```

### WebSocket Connection Issues

Check firewall and proxy settings:
```bash
# Test WebSocket
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:3001/ws
```

## 📚 Additional Resources

- [liboqs-node Documentation](https://github.com/open-quantum-safe/liboqs-node)
- [@xenova/transformers Documentation](https://huggingface.co/docs/transformers.js)
- [RocksDB Documentation](https://github.com/facebook/rocksdb)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

