# 🚀 Presidium v0.0.0.1 - Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- Git installed

---

## 1. Install Dependencies

```bash
cd D:/Presidium
npm install
```

This will install dependencies for:
- Root workspace
- Backend (Express + TypeScript)
- Frontend (React + Vite)

---

## 2. Start Development Servers

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend:** http://localhost:3000
- **Frontend:** http://localhost:5173

---

## 3. Test the Chat

1. Open browser: http://localhost:5173
2. Type a message:
   - `hello` → AI greeting
   - `crypto` → Secure enclave message
   - `audit` → Security scan message
   - Any other text → Generic AI response

3. Watch for:
   - Animated typing indicator (3 dots)
   - "Presidium AI is thinking..." text
   - AI response after ~1.5 seconds

---

## 4. Available Commands

### Root Level

```bash
npm run dev              # Start both backend + frontend
npm run build            # Build both projects
npm run start            # Start production backend
npm run test             # Run tests (all workspaces)
npm run lint             # Lint all code
npm run clean            # Remove node_modules and dist
npm run docker:up        # Start with Docker Compose
npm run docker:down      # Stop Docker containers
```

### Backend Only

```bash
cd backend
npm run dev              # Start backend dev server
npm run build            # Build TypeScript
npm run start            # Start production server
npm test                 # Run tests
npm run lint             # Lint backend code
```

### Frontend Only

```bash
cd frontend
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm test                 # Run tests
npm run lint             # Lint frontend code
```

---

## 5. Project Structure

```
D:/Presidium/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Express server + routes
│   │   ├── services/
│   │   │   └── ai.service.ts      # Mock AI v1
│   │   ├── adapters/              # Email/SMS adapters
│   │   └── ...
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Main chat UI
│   │   ├── App.module.css         # Styles + animations
│   │   ├── components/
│   │   │   ├── MessageList.tsx
│   │   │   └── Composer.tsx
│   │   └── ...
│   └── package.json
│
├── package.json                   # Root workspace config
├── docker-compose.yml             # Docker setup
├── SETUP_GUIDE.md                 # Full setup instructions
├── AI_UPGRADE_v1.md               # AI upgrade documentation
└── QUICKSTART.md                  # This file
```

---

## 6. API Endpoints

### POST /api/chat

Send a message to Presidium AI.

**Request:**
```json
{
  "message": "hello"
}
```

**Response:**
```json
{
  "reply": "👋 Presidium v0.1 Online. Neural interface active. Waiting for command.",
  "timestamp": "2025-12-19T02:34:08.123Z"
}
```

---

## 7. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

**Required Variables:**
- `PORT` - Backend port (default: 3000)
- `NODE_ENV` - Environment (development/production)

**Optional (for future features):**
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` - Email integration
- `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_PHONE` - SMS integration
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis cache

---

## 8. Troubleshooting

### Backend won't start

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Frontend won't start

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Port already in use

**Backend (3000):**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

**Frontend (5173):**
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5173 | xargs kill -9
```

### TypeScript errors

```bash
# Backend
cd backend
npx tsc --noEmit

# Frontend
cd frontend
npx tsc --noEmit
```

---

## 9. Testing AI Responses

### Test Pattern Matching

Open http://localhost:5173 and try:

1. **Crypto Query:**
   ```
   Tell me about crypto tokens
   ```
   Expected: 🔒 Secure enclave message

2. **Greeting:**
   ```
   hello
   ```
   Expected: 👋 Presidium online

3. **Security Audit:**
   ```
   Run security audit
   ```
   Expected: 🔍 Scanning message

4. **Generic:**
   ```
   What is the weather?
   ```
   Expected: 🤖 Analysis complete

### Watch for:
- ✅ Typing indicator appears immediately
- ✅ 3 animated dots bounce
- ✅ "Presidium AI is thinking..." text
- ✅ Response appears after ~1.5 seconds
- ✅ Smooth animations

---

## 10. Next Steps

1. ✅ Start servers (`npm run dev`)
2. ✅ Test chat functionality
3. ✅ Explore code structure
4. 📝 Read `AI_UPGRADE_v1.md` for technical details
5. 📝 Read `SETUP_GUIDE.md` for deployment
6. 🚀 Deploy to Heroku (backend) + Vercel (frontend)

---

## 📚 Documentation

- `README.md` - Project overview
- `SETUP_GUIDE.md` - Full setup instructions
- `AI_UPGRADE_v1.md` - AI implementation details
- `QUICKSTART.md` - This file

---

## 🆘 Support

- **Issues:** https://github.com/sergynia96-netizen/presidium-v0.0.0.1/issues
- **Docs:** See markdown files in project root
- **Status:** Backend and Frontend running successfully ✅

---

**Last Updated:** December 19, 2025  
**Version:** 0.0.0.1  
**Status:** 🚀 Ready for Development

