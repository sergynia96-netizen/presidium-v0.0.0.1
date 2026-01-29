<<<<<<< HEAD
# Presidium v0.0.0.1

Unified messaging platform. Email + SMS + P2P. Quantum-ready PQC encryption. CRDT offline-first. AI-powered chat with emotion detection.

## 🚀 Quick Start

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev
# Runs on http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### Production Deployment

См. [DEPLOYMENT.md](./DEPLOYMENT.md) для полного гайда по деплою на Heroku (backend) и Vercel (frontend).

## 📚 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Полное руководство по деплою
- [backend/API.md](./backend/API.md) - Backend API документация
- [backend/AUTH_ARCHITECTURE.md](./backend/AUTH_ARCHITECTURE.md) - Архитектура аутентификации

## 🔐 Features

### Multi-Factor Authentication
- ✅ SMS-OTP как первичный фактор
- ✅ Device Fingerprinting
- ✅ Behavioral Analysis (Typing Entropy, Velocity Checks)
- ✅ Risk Scoring (0-100)
- ✅ Rate Limiting
- 🔄 Roadmap: WebAuthn/Passkeys, TOTP, Биометрия

### AI & Chat
- ✅ Локальный ИИ (Llama-3.2-1B) через WebGPU/WASM
- ✅ Чат с фильтрами (Все, Личные, Секрет, Эфир, AI)
- ✅ Поиск чатов
- ✅ История сообщений

### Economy
- ✅ Кошелек и транзакции
- ✅ Маркетплейс (Mesh-Роутер, Дозиметр)
- ✅ Стейкинг
- ✅ Обмен валют

### P2P & Network
- ✅ P2P сеть (12 узлов)
- ✅ CRDT синхронизация
- ✅ Управление сессиями

### Security & Privacy
- ✅ Криптосейф (Vault)
- ✅ Управление ключами
- ✅ Репутация и доверие
- ✅ Security Events logging

## 🏗️ Architecture

### Backend
- **Framework**: Express.js + TypeScript
- **Deployment**: Heroku
- **Port**: 3000 (production via Heroku PORT env)

### Frontend
- **Framework**: React + TypeScript + Vite
- **UI**: Framer Motion + Tailwind CSS
- **AI**: @mlc-ai/web-llm (WebGPU/WASM)
- **Deployment**: Vercel

## 📦 Project Structure

```
presidium/
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   │   ├── auth.service.ts      # MFA Authentication
│   │   │   ├── device.service.ts    # Device Fingerprinting
│   │   │   ├── behavioral.service.ts # Typing Analysis
│   │   │   ├── ratelimit.service.ts  # Rate Limiting
│   │   │   ├── security.service.ts   # Security Events
│   │   │   ├── p2p.service.ts        # P2P Network
│   │   │   ├── crdt.service.ts       # CRDT Sync
│   │   │   ├── economy.service.ts    # Wallet & Transactions
│   │   │   ├── reputation.service.ts # Trust & Reputation
│   │   │   ├── vault.service.ts      # Crypto Vault
│   │   │   ├── metrics.service.ts    # System Metrics
│   │   │   └── chat.service.ts       # Chat Management
│   │   ├── types/           # TypeScript types
│   │   └── server.ts        # Express server
│   ├── Procfile             # Heroku config
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main app (LocalAIEngine)
│   │   ├── api/             # API client
│   │   └── components/      # React components
│   ├── public/
│   │   └── models/          # AI model files
│   ├── vercel.json          # Vercel config
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── deploy.yml       # CI/CD Pipeline
│
└── DEPLOYMENT.md            # Deployment guide
```

## 🔑 Environment Variables

### Backend (.env)

```env
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://presidium-frontend.vercel.app,http://localhost:5173
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
```

### Frontend (.env)

```env
VITE_API_URL=https://presidium-backend.herokuapp.com
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/initiate` - Initiate SMS-OTP auth
- `POST /api/auth/verify-otp` - Verify OTP code
- `GET /api/auth/session/:sessionId` - Verify session
- `POST /api/auth/logout` - Revoke session

### Dashboard & Metrics
- `GET /api/dashboard` - Complete dashboard stats
- `GET /api/metrics` - System metrics

### P2P & Network
- `GET /api/p2p/network` - P2P network status
- `GET /api/p2p/nodes/:nodeId` - Get node info

### CRDT
- `GET /api/crdt` - CRDT state
- `POST /api/crdt/sync` - Force sync
- `PUT /api/crdt/enabled` - Enable/disable CRDT

### Economy
- `GET /api/economy/wallet` - Get wallet
- `GET /api/economy/transactions` - Get transactions
- `POST /api/economy/deposit` - Deposit funds
- `POST /api/economy/withdraw` - Withdraw funds
- `POST /api/economy/purchase` - Purchase item
- `GET /api/economy/marketplace` - Get marketplace

### Reputation
- `GET /api/reputation` - Get reputation

### Vault & Keys
- `GET /api/vault/keys` - Get all keys
- `POST /api/vault/keys` - Create key
- `DELETE /api/vault/keys/:keyId` - Delete key

### Chat
- `GET /api/chats` - Get all chats
- `GET /api/chats/search?q=query` - Search chats
- `POST /api/chats/:chatId/messages` - Send message
- `GET /api/chats/:chatId/messages` - Get messages

Полная документация: [backend/API.md](./backend/API.md)

## 🧪 Testing

```bash
# Backend tests (when configured)
cd backend
npm test

# Frontend tests (when configured)
cd frontend
npm test
```

## 🔄 CI/CD

Автоматический деплой через GitHub Actions:
- **Push to main** → Deploy to Heroku (backend) + Vercel (frontend)
- **Pull Request** → Run tests only

См. [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

## 📊 Monitoring

- **Heroku Logs**: `heroku logs --tail -a presidium-backend-v0001`
- **Vercel Analytics**: Dashboard → Analytics
- **Health Check**: `curl https://presidium-backend-v0001.herokuapp.com/health`

## 🛠️ Development

### Adding New Features

1. Backend: Add service in `backend/src/services/`
2. Backend: Add route in `backend/src/routes/index.ts`
3. Frontend: Add API client in `frontend/src/api/`
4. Frontend: Add UI component in `frontend/src/components/`

### Model Files

AI model files находятся в `frontend/public/models/llama/resolve/main/`:
- `mlc-chat-config.json`
- `ndarray-cache.json`
- `tensor-cache.json` (копия ndarray-cache.json)
- `tokenizer.json`
- `params_shard_*.bin` (22 файла)
- `model.wasm` (в `frontend/public/models/`)

## 📝 License

Private project

## 🤝 Contributing

Это private проект. Для участия свяжитесь с владельцем.

---

**Status**: 🚀 Production Ready

**Version**: 0.0.0.1

**Last Updated**: 2024
=======
# Presidium v0.0.0.1

Unified messaging platform. Email + SMS + P2P. Quantum-ready PQC encryption. CRDT offline-first. AI-powered chat with emotion detection.

## 🚀 Quick Start

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev
# Runs on http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### Production Deployment

См. [DEPLOYMENT.md](./DEPLOYMENT.md) для полного гайда по деплою на Heroku (backend) и Vercel (frontend).

## 📚 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Полное руководство по деплою
- [backend/API.md](./backend/API.md) - Backend API документация
- [backend/AUTH_ARCHITECTURE.md](./backend/AUTH_ARCHITECTURE.md) - Архитектура аутентификации

## 🔐 Features

### Multi-Factor Authentication
- ✅ SMS-OTP как первичный фактор
- ✅ Device Fingerprinting
- ✅ Behavioral Analysis (Typing Entropy, Velocity Checks)
- ✅ Risk Scoring (0-100)
- ✅ Rate Limiting
- 🔄 Roadmap: WebAuthn/Passkeys, TOTP, Биометрия

### AI & Chat
- ✅ Локальный ИИ (Llama-3.2-1B) через WebGPU/WASM
- ✅ Чат с фильтрами (Все, Личные, Секрет, Эфир, AI)
- ✅ Поиск чатов
- ✅ История сообщений

### Economy
- ✅ Кошелек и транзакции
- ✅ Маркетплейс (Mesh-Роутер, Дозиметр)
- ✅ Стейкинг
- ✅ Обмен валют

### P2P & Network
- ✅ P2P сеть (12 узлов)
- ✅ CRDT синхронизация
- ✅ Управление сессиями

### Security & Privacy
- ✅ Криптосейф (Vault)
- ✅ Управление ключами
- ✅ Репутация и доверие
- ✅ Security Events logging

## 🏗️ Architecture

### Backend
- **Framework**: Express.js + TypeScript
- **Deployment**: Heroku
- **Port**: 3000 (production via Heroku PORT env)

### Frontend
- **Framework**: React + TypeScript + Vite
- **UI**: Framer Motion + Tailwind CSS
- **AI**: @mlc-ai/web-llm (WebGPU/WASM)
- **Deployment**: Vercel

## 📦 Project Structure

```
presidium/
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   │   ├── auth.service.ts      # MFA Authentication
│   │   │   ├── device.service.ts    # Device Fingerprinting
│   │   │   ├── behavioral.service.ts # Typing Analysis
│   │   │   ├── ratelimit.service.ts  # Rate Limiting
│   │   │   ├── security.service.ts   # Security Events
│   │   │   ├── p2p.service.ts        # P2P Network
│   │   │   ├── crdt.service.ts       # CRDT Sync
│   │   │   ├── economy.service.ts    # Wallet & Transactions
│   │   │   ├── reputation.service.ts # Trust & Reputation
│   │   │   ├── vault.service.ts      # Crypto Vault
│   │   │   ├── metrics.service.ts    # System Metrics
│   │   │   └── chat.service.ts       # Chat Management
│   │   ├── types/           # TypeScript types
│   │   └── server.ts        # Express server
│   ├── Procfile             # Heroku config
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main app (LocalAIEngine)
│   │   ├── api/             # API client
│   │   └── components/      # React components
│   ├── public/
│   │   └── models/          # AI model files
│   ├── vercel.json          # Vercel config
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── deploy.yml       # CI/CD Pipeline
│
└── DEPLOYMENT.md            # Deployment guide
```

## 🔑 Environment Variables

### Backend (.env)

```env
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://presidium-frontend.vercel.app,http://localhost:5173
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
```

### Frontend (.env)

```env
VITE_API_URL=https://presidium-backend.herokuapp.com
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/initiate` - Initiate SMS-OTP auth
- `POST /api/auth/verify-otp` - Verify OTP code
- `GET /api/auth/session/:sessionId` - Verify session
- `POST /api/auth/logout` - Revoke session

### Dashboard & Metrics
- `GET /api/dashboard` - Complete dashboard stats
- `GET /api/metrics` - System metrics

### P2P & Network
- `GET /api/p2p/network` - P2P network status
- `GET /api/p2p/nodes/:nodeId` - Get node info

### CRDT
- `GET /api/crdt` - CRDT state
- `POST /api/crdt/sync` - Force sync
- `PUT /api/crdt/enabled` - Enable/disable CRDT

### Economy
- `GET /api/economy/wallet` - Get wallet
- `GET /api/economy/transactions` - Get transactions
- `POST /api/economy/deposit` - Deposit funds
- `POST /api/economy/withdraw` - Withdraw funds
- `POST /api/economy/purchase` - Purchase item
- `GET /api/economy/marketplace` - Get marketplace

### Reputation
- `GET /api/reputation` - Get reputation

### Vault & Keys
- `GET /api/vault/keys` - Get all keys
- `POST /api/vault/keys` - Create key
- `DELETE /api/vault/keys/:keyId` - Delete key

### Chat
- `GET /api/chats` - Get all chats
- `GET /api/chats/search?q=query` - Search chats
- `POST /api/chats/:chatId/messages` - Send message
- `GET /api/chats/:chatId/messages` - Get messages

Полная документация: [backend/API.md](./backend/API.md)

## 🧪 Testing

```bash
# Backend tests (when configured)
cd backend
npm test

# Frontend tests (when configured)
cd frontend
npm test
```

## 🔄 CI/CD

Автоматический деплой через GitHub Actions:
- **Push to main** → Deploy to Heroku (backend) + Vercel (frontend)
- **Pull Request** → Run tests only

См. [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

## 📊 Monitoring

- **Heroku Logs**: `heroku logs --tail -a presidium-backend-v0001`
- **Vercel Analytics**: Dashboard → Analytics
- **Health Check**: `curl https://presidium-backend-v0001.herokuapp.com/health`

## 🛠️ Development

### Adding New Features

1. Backend: Add service in `backend/src/services/`
2. Backend: Add route in `backend/src/routes/index.ts`
3. Frontend: Add API client in `frontend/src/api/`
4. Frontend: Add UI component in `frontend/src/components/`

### Model Files

AI model files находятся в `frontend/public/models/llama/resolve/main/`:
- `mlc-chat-config.json`
- `ndarray-cache.json`
- `tensor-cache.json` (копия ndarray-cache.json)
- `tokenizer.json`
- `params_shard_*.bin` (22 файла)
- `model.wasm` (в `frontend/public/models/`)

## 📝 License

Private project

## 🤝 Contributing

Это private проект. Для участия свяжитесь с владельцем.

---

**Status**: 🚀 Production Ready

**Version**: 0.0.0.1

**Last Updated**: 2024
>>>>>>> e9252c9a1f1ab9b7c70dc2fdd65e8fa3e9103969
