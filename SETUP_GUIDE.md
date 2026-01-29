# Presidium v0.0.0.1 - Local Setup Guide

## Repository Information
- **GitHub URL**: https://github.com/sergynia96-netizen/presidium-v0.0.0.1
- **Clone URL**: https://github.com/sergynia96-netizen/presidium-v0.0.0.1.git
- **Local Path**: D:/Presidium

---

## Step 1: Initialize Local Git Repository

Open Command Prompt or PowerShell and navigate to your project directory:

```bash
cd D:/Presidium

# Initialize git repository
git init

# Set main branch
git branch -M main

# Add remote origin
git remote add origin https://github.com/sergynia96-netizen/presidium-v0.0.0.1.git

# Verify remote
git remote -v
```

---

## Step 2: Pull Initial Files from GitHub

```bash
# Pull the initial commit (README, LICENSE, .gitignore)
git pull origin main

# If there are conflicts, use:
git pull origin main --allow-unrelated-histories
```

---

## Step 3: Create Project Structure

Create all directories and files:

```bash
# Create backend structure
mkdir -p backend/src/adapters backend/src/services

# Create frontend structure
mkdir -p frontend/src/components

# Create GitHub workflows
mkdir -p .github/workflows

# Create all necessary files
touch backend/src/server.ts
touch backend/src/inbox.ts
touch backend/src/ai.ts
touch backend/src/types.ts
touch backend/src/config.ts
touch backend/src/adapters/email.ts
touch backend/src/adapters/sms.ts
touch backend/src/services/cache.ts
touch backend/src/services/logger.ts
touch backend/package.json
touch backend/tsconfig.json
touch backend/.env.example

touch frontend/src/App.tsx
touch frontend/src/App.module.css
touch frontend/src/types.ts
touch frontend/src/components/MessageList.tsx
touch frontend/src/components/MessageList.module.css
touch frontend/src/components/Composer.tsx
touch frontend/src/components/Composer.module.css
touch frontend/index.html
touch frontend/package.json
touch frontend/tsconfig.json
touch frontend/vite.config.ts

touch .github/workflows/deploy.yml
touch docker-compose.yml
touch Dockerfile.backend
touch .env.example
touch package.json
```

**For Windows (PowerShell):**
```powershell
# Create directories
New-Item -ItemType Directory -Force -Path backend/src/adapters, backend/src/services, frontend/src/components, .github/workflows

# Create files
New-Item -ItemType File -Force -Path backend/src/server.ts, backend/src/inbox.ts, backend/src/ai.ts, backend/src/types.ts, backend/src/config.ts
New-Item -ItemType File -Force -Path backend/src/adapters/email.ts, backend/src/adapters/sms.ts
New-Item -ItemType File -Force -Path backend/src/services/cache.ts, backend/src/services/logger.ts
New-Item -ItemType File -Force -Path backend/package.json, backend/tsconfig.json, backend/.env.example
New-Item -ItemType File -Force -Path frontend/src/App.tsx, frontend/src/App.module.css, frontend/src/types.ts
New-Item -ItemType File -Force -Path frontend/src/components/MessageList.tsx, frontend/src/components/MessageList.module.css
New-Item -ItemType File -Force -Path frontend/src/components/Composer.tsx, frontend/src/components/Composer.module.css
New-Item -ItemType File -Force -Path frontend/index.html, frontend/package.json, frontend/tsconfig.json, frontend/vite.config.ts
New-Item -ItemType File -Force -Path .github/workflows/deploy.yml, docker-compose.yml, Dockerfile.backend, .env.example, package.json
```

---

## Step 4: Add File Contents

All file contents will be added in separate commits. See the individual files for complete implementations.

### Key Files to Populate:

1. **Root package.json** - Monorepo workspace configuration
2. **backend/package.json** - Backend dependencies
3. **frontend/package.json** - Frontend dependencies  
4. **docker-compose.yml** - Local development setup
5. **Dockerfile.backend** - Backend container
6. **.github/workflows/deploy.yml** - CI/CD pipeline
7. **.env.example** - Environment variables template

---

## Step 5: Commit and Push

```bash
# Stage all files
git add .

# Commit
git commit -m "feat: Initial project structure for Presidium v0.0.0.1

- Backend: Express + TypeScript with unified inbox
- Frontend: React + TypeScript with Vite
- Docker: Multi-container setup
- CI/CD: GitHub Actions for Heroku + Vercel
- Env: Templates for all required variables"

# Push to GitHub
git push -u origin main
```

---

## Step 6: Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies  
cd frontend
npm install
cd ..
```

---

## Step 7: Configure Environment Variables

### Root .env
Copy and configure:
```bash
cp .env.example .env
```

### Backend .env
Copy and configure:
```bash
cp backend/.env.example backend/.env
```

Edit the files with your actual API keys and credentials.

---

## Step 8: Development Workflow

### Run with Docker Compose:
```bash
docker-compose up --build
```

### Run Locally:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## Step 9: Deployment

### Heroku (Backend)
```bash
# Login to Heroku
heroku login

# Create app
heroku create presidium-backend-staging

# Add buildpack
heroku buildpacks:set heroku/nodejs

# Set environment variables
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Vercel (Frontend)
```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod
```

---

## Project Structure

```
presidium-v0.0.0.1/
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express app (127 lines)
│   │   ├── inbox.ts           # Unified inbox (89 lines)
│   │   ├── ai.ts              # AI/NLP engine (56 lines)
│   │   ├── types.ts           # TypeScript types (78 lines)
│   │   ├── config.ts          # Configuration (43 lines)
│   │   ├── adapters/
│   │   │   ├── email.ts       # Email integration (58 lines)
│   │   │   └── sms.ts         # SMS integration (41 lines)
│   │   └── services/
│   │       ├── cache.ts       # Redis cache (24 lines)
│   │       └── logger.ts      # Winston logger (28 lines)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Main app (89 lines)
│   │   ├── App.module.css     # Styles (124 lines)
│   │   ├── types.ts           # Types (38 lines)
│   │   └── components/
│   │       ├── MessageList.tsx
│   │       ├── MessageList.module.css
│   │       ├── Composer.tsx
│   │       └── Composer.module.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD pipeline
│
├── docker-compose.yml
├── Dockerfile.backend
├── .gitignore                 # Already created
├── .env.example
├── LICENSE                    # MIT - Already created
├── README.md                  # Already created
└── package.json               # Root workspace
```

---

## Next Steps

1. ✅ Repository created on GitHub
2. ⏳ Initialize local repository
3. ⏳ Create project structure
4. ⏳ Add file contents
5. ⏳ Configure environment variables
6. ⏳ Test locally
7. ⏳ Deploy to staging

---

## Useful Commands

```bash
# Check git status
git status

# View commit history
git log --oneline

# Create new branch
git checkout -b feature/your-feature

# Switch branches
git checkout main

# Pull latest changes
git pull origin main

# View remote URLs
git remote -v

# Clean Docker
docker-compose down -v
docker system prune -a
```

---

## Support & Resources

- **GitHub Repo**: https://github.com/sergynia96-netizen/presidium-v0.0.0.1
- **Heroku Docs**: https://devcenter.heroku.com/
- **Vercel Docs**: https://vercel.com/docs
- **Docker Docs**: https://docs.docker.com/

---

**Created**: December 19, 2025
**Version**: 0.0.0.1
**Status**: Initial Setup
