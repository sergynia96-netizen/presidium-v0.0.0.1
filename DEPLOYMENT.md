<<<<<<< HEAD
# Presidium Deployment Guide

Полное руководство по деплою Presidium на Heroku (backend) и Vercel (frontend).

## 📋 Содержание

1. [Локальная подготовка](#локальная-подготовка)
2. [GitHub Setup](#github-setup)
3. [Heroku Backend](#heroku-backend)
4. [Vercel Frontend](#vercel-frontend)
5. [Проверка и тестирование](#проверка-и-тестирование)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Мониторинг](#мониторинг)
8. [Troubleshooting](#troubleshooting)

---

## 🔧 ЛОКАЛЬНАЯ ПОДГОТОВКА

### Шаг 1: Клонируй и инициализируй проект

```bash
# Инициализируй git (если еще не сделано)
git init
git config user.name "Your Name"
git config user.email "your.email@gmail.com"
```

### Шаг 2: Структура проекта

Проект уже имеет правильную структуру:

```
presidium/
├── backend/
│   ├── src/
│   ├── Procfile          # ✅ Создан для Heroku
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   ├── vercel.json       # ✅ Создан для Vercel
│   ├── package.json
│   └── vite.config.ts
│
├── .github/
│   └── workflows/
│       └── deploy.yml    # ✅ Обновлен CI/CD
│
└── .gitignore            # ✅ Уже настроен
```

### Шаг 3: Установи зависимости

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## 🔑 GITHUB SETUP

### Шаг 1: Создай репозиторий на GitHub

```bash
# Создай репо на https://github.com/new
# Назови: presidium-v0001 (или свое название)

# Добавь remote
git remote add origin https://github.com/YOUR_USERNAME/presidium-v0001.git

# Первый коммит
git add .
git commit -m "Initial commit: Full Presidium stack with auth system"
git branch -M main
git push -u origin main
```

### Шаг 2: Генерируй токены

#### GitHub Token (для Actions)
```
Settings → Developer settings → Personal access tokens → Tokens (classic)
Scope: repo, workflows, read:packages
```

#### Heroku API Key
```bash
heroku login
heroku auth:token
# Скопируй токен
```

#### Vercel Token
```
https://vercel.com/account/tokens
Create token → Copy
```

#### Vercel Org/Project ID
```bash
cd frontend
vercel login
vercel link  # Создаст .vercel/project.json с ID
cat .vercel/project.json
```

### Шаг 3: Добавь GitHub Secrets

```
Repository → Settings → Secrets and variables → Actions
```

Добавь следующие секреты:

```
HEROKU_API_KEY=your_heroku_token
HEROKU_EMAIL=your@gmail.com
HEROKU_APP_NAME=presidium-backend-v0001  # Или ваше имя приложения
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
```

---

## ☁️ HEROKU BACKEND

### Шаг 1: Создай Heroku app

```bash
# Логин
heroku login

# Создай app
heroku create presidium-backend-v0001

# Проверь
heroku apps
```

### Шаг 2: Установи Environment Variables

```bash
heroku config:set \
  NODE_ENV=production \
  PORT=3000 \
  LOG_LEVEL=info \
  CORS_ORIGINS=https://presidium-frontend.vercel.app,http://localhost:5173 \
  JWT_SECRET=$(openssl rand -base64 32) \
  SESSION_SECRET=$(openssl rand -base64 32) \
  -a presidium-backend-v0001

# Email (опционально)
heroku config:set \
  EMAIL_HOST=imap.gmail.com \
  EMAIL_USER=your.email@gmail.com \
  EMAIL_PASS=your-app-password \
  -a presidium-backend-v0001

# SMS/Twilio (опционально)
heroku config:set \
  TWILIO_SID=your_twilio_sid \
  TWILIO_TOKEN=your_twilio_token \
  TWILIO_PHONE=+1234567890 \
  -a presidium-backend-v0001

# Проверь
heroku config -a presidium-backend-v0001
```

### Шаг 3: Deploy на Heroku

```bash
# Способ 1: Через git push (после настройки remote)
git remote add heroku https://git.heroku.com/presidium-backend-v0001.git
git push heroku main

# Способ 2: Через CLI
heroku git:remote -a presidium-backend-v0001
git push heroku main

# Смотри логи
heroku logs --tail -a presidium-backend-v0001

# Проверь здоровье
curl https://presidium-backend-v0001.herokuapp.com/health
```

### Шаг 4: Обнови Procfile (уже создан)

✅ `backend/Procfile` уже создан:
```
web: npm run build && npm start
```

---

## 🌐 VERCEL FRONTEND

### Шаг 1: Создай Vercel project

```bash
# Логин в Vercel
npm install -g vercel
vercel login

# Инициализируй в frontend директории
cd frontend
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? presidium-frontend
# - Directory? ./
# - Override settings? No
```

### Шаг 2: Обнови Environment Variables в Vercel

```bash
# Через CLI
cd frontend
vercel env add VITE_API_URL production
# Введи: https://presidium-backend-v0001.herokuapp.com

# Или через Dashboard:
# https://vercel.com/YOUR_PROJECT/settings/environment-variables
```

Или добавь в `vercel.json`:

```json
{
  "env": {
    "VITE_API_URL": "https://presidium-backend-v0001.herokuapp.com"
  }
}
```

### Шаг 3: Обнови API endpoint в коде

✅ Уже обновлено в `frontend/src/api/chat.api.ts`:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

### Шаг 4: Deploy

```bash
cd frontend
vercel --prod

# или через git integration:
# Connect GitHub → Vercel → Auto-deploy on push
```

---

## ✅ ПРОВЕРКА И ТЕСТИРОВАНИЕ

### Шаг 1: Здоровье сервисов

```bash
# Backend health
curl https://presidium-backend-v0001.herokuapp.com/health

# Frontend URL
# https://presidium-frontend.vercel.app (или ваше имя)

# Должны видеть:
# Backend: { "status": "ok", "service": "Presidium Backend", ... }
# Frontend: Presidium UI загружается
```

### Шаг 2: Функциональное тестирование

```bash
# Получи дашборд
curl https://presidium-backend-v0001.herokuapp.com/api/dashboard

# Получи чаты
curl https://presidium-backend-v0001.herokuapp.com/api/chats

# Тест аутентификации
curl -X POST https://presidium-backend-v0001.herokuapp.com/api/auth/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+79991234567",
    "deviceFingerprint": "fp_test123",
    "deviceComponents": {
      "userAgent": "Mozilla/5.0...",
      "screenResolution": "1920x1080",
      "timezone": "Europe/Moscow",
      "language": "ru",
      "platform": "Win32"
    }
  }'
```

### Шаг 3: Browser testing

1. Открой `https://presidium-frontend.vercel.app`
2. Проверь, что UI загружается
3. Проверь Network tab - запросы идут на Heroku backend
4. Протестируй функции приложения

---

## 🔄 CI/CD PIPELINE

### GitHub Actions Workflow

✅ Уже создан `.github/workflows/deploy.yml`:

- **Test job**: Собирает backend и frontend
- **Deploy Backend**: Автоматически деплоит на Heroku при push в main
- **Deploy Frontend**: Автоматически деплоит на Vercel при push в main

### Триггеры

- Push в `main` → автоматический деплой
- Pull Request → только тесты (без деплоя)

---

## 📊 МОНИТОРИНГ

### Heroku Logs

```bash
# Real-time logs
heroku logs --tail -a presidium-backend-v0001

# Последние 100 строк
heroku logs -n 100 -a presidium-backend-v0001

# Только ошибки
heroku logs --tail --dyno=web -a presidium-backend-v0001 | grep -i error
```

### Vercel Analytics

```
Dashboard → presidium-frontend → Analytics
- Page views
- Core Web Vitals
- Errors
```

### Custom Monitoring

```bash
# Простой скрипт мониторинга
cat > monitor.sh << 'EOF'
#!/bin/bash
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://presidium-backend-v0001.herokuapp.com/health)
  if [ "$STATUS" = "200" ]; then
    echo "✅ Backend OK - $(date)"
  else
    echo "❌ Backend DOWN ($STATUS) - $(date)"
  fi
  sleep 60
done
EOF

chmod +x monitor.sh
./monitor.sh
```

---

## 🔧 TROUBLESHOOTING

### Backend не запускается

```bash
# Проверь логи
heroku logs --tail -a presidium-backend-v0001

# Перезагрузи dyno
heroku dyno:restart -a presidium-backend-v0001

# Проверь конфиг
heroku config -a presidium-backend-v0001

# Проверь сборку локально
cd backend
npm run build
npm start
```

### Frontend не загружается

```bash
# Проверь деплой статус
vercel list

# Посмотри логи
vercel logs presidium-frontend

# Пересоздай деплой
vercel --prod

# Очисти кеш
vercel --prod --yes
```

### API не отвечает / CORS ошибки

```bash
# Проверь endpoint
curl -i https://presidium-backend-v0001.herokuapp.com/health

# Проверь CORS (должна быть включена)
curl -i -X OPTIONS https://presidium-backend-v0001.herokuapp.com/api/dashboard \
  -H "Origin: https://presidium-frontend.vercel.app" \
  -H "Access-Control-Request-Method: GET"

# Убедись, что VERCEL_URL добавлен в CORS_ORIGINS
heroku config:get CORS_ORIGINS -a presidium-backend-v0001
```

### Environment Variables не работают

```bash
# Backend
heroku config -a presidium-backend-v0001

# Frontend
vercel env ls

# Проверь, что переменные установлены для production
vercel env pull .env.local
cat .env.local
```

---

## 📈 SCALE & PERFORMANCE

### Увеличение Heroku dyno

```bash
# Текущий размер
heroku dyno:type -a presidium-backend-v0001

# Upgrade на Hobby ($7/month - always on)
heroku dyno:type hobby -a presidium-backend-v0001

# Upgrade на Standard ($50/month - production)
heroku dyno:type standard-1x -a presidium-backend-v0001
```

### Добавь Redis Cache (опционально)

```bash
# Установи Redis
heroku addons:create heroku-redis:premium-0 -a presidium-backend-v0001

# Получи URL
heroku config:get REDIS_URL -a presidium-backend-v0001
```

### Добавь Database (PostgreSQL) (опционально)

```bash
# Инициализируй DB
heroku addons:create heroku-postgresql:standard-0 -a presidium-backend-v0001

# Получи URL
heroku config:get DATABASE_URL -a presidium-backend-v0001
```

---

## 🎯 ФИНАЛЬНЫЙ CHECKLIST

- [ ] GitHub repo создан и залит
- [ ] GitHub Secrets настроены
- [ ] Heroku app создан
- [ ] Environment variables установлены на Heroku
- [ ] Backend deployed на Heroku
- [ ] Health check passing
- [ ] Vercel project создан
- [ ] Environment variables установлены на Vercel
- [ ] Frontend deployed на Vercel
- [ ] API endpoints работают
- [ ] CORS настроен правильно
- [ ] CI/CD pipeline работает
- [ ] Мониторинг настроен
- [ ] Логирование работает

---

## 🚀 ДАЛЕЕ

После успешного деплоя:

1. **Week 1: MVP Launch & Testing**
   - 100 beta users
   - Fix bugs
   - Gather feedback

2. **Week 2: Optimizations**
   - Performance tuning
   - Database migration (если нужно)
   - Caching improvements

3. **Week 3: Features**
   - WebAuthn/Passkeys интеграция
   - Better UI/UX
   - Mobile optimization

4. **Month 1: Scale to 10K users**
5. **Month 3: Scale to 100K users**

---

## 📚 Дополнительные ресурсы

- [Heroku Node.js Support](https://devcenter.heroku.com/articles/nodejs-support)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions](https://docs.github.com/en/actions)
- [CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Status: 🚀 PRODUCTION READY**

Все готово к запуску!

=======
# Presidium Deployment Guide

Полное руководство по деплою Presidium на Heroku (backend) и Vercel (frontend).

## 📋 Содержание

1. [Локальная подготовка](#локальная-подготовка)
2. [GitHub Setup](#github-setup)
3. [Heroku Backend](#heroku-backend)
4. [Vercel Frontend](#vercel-frontend)
5. [Проверка и тестирование](#проверка-и-тестирование)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Мониторинг](#мониторинг)
8. [Troubleshooting](#troubleshooting)

---

## 🔧 ЛОКАЛЬНАЯ ПОДГОТОВКА

### Шаг 1: Клонируй и инициализируй проект

```bash
# Инициализируй git (если еще не сделано)
git init
git config user.name "Your Name"
git config user.email "your.email@gmail.com"
```

### Шаг 2: Структура проекта

Проект уже имеет правильную структуру:

```
presidium/
├── backend/
│   ├── src/
│   ├── Procfile          # ✅ Создан для Heroku
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   ├── vercel.json       # ✅ Создан для Vercel
│   ├── package.json
│   └── vite.config.ts
│
├── .github/
│   └── workflows/
│       └── deploy.yml    # ✅ Обновлен CI/CD
│
└── .gitignore            # ✅ Уже настроен
```

### Шаг 3: Установи зависимости

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## 🔑 GITHUB SETUP

### Шаг 1: Создай репозиторий на GitHub

```bash
# Создай репо на https://github.com/new
# Назови: presidium-v0001 (или свое название)

# Добавь remote
git remote add origin https://github.com/YOUR_USERNAME/presidium-v0001.git

# Первый коммит
git add .
git commit -m "Initial commit: Full Presidium stack with auth system"
git branch -M main
git push -u origin main
```

### Шаг 2: Генерируй токены

#### GitHub Token (для Actions)
```
Settings → Developer settings → Personal access tokens → Tokens (classic)
Scope: repo, workflows, read:packages
```

#### Heroku API Key
```bash
heroku login
heroku auth:token
# Скопируй токен
```

#### Vercel Token
```
https://vercel.com/account/tokens
Create token → Copy
```

#### Vercel Org/Project ID
```bash
cd frontend
vercel login
vercel link  # Создаст .vercel/project.json с ID
cat .vercel/project.json
```

### Шаг 3: Добавь GitHub Secrets

```
Repository → Settings → Secrets and variables → Actions
```

Добавь следующие секреты:

```
HEROKU_API_KEY=your_heroku_token
HEROKU_EMAIL=your@gmail.com
HEROKU_APP_NAME=presidium-backend-v0001  # Или ваше имя приложения
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
```

---

## ☁️ HEROKU BACKEND

### Шаг 1: Создай Heroku app

```bash
# Логин
heroku login

# Создай app
heroku create presidium-backend-v0001

# Проверь
heroku apps
```

### Шаг 2: Установи Environment Variables

```bash
heroku config:set \
  NODE_ENV=production \
  PORT=3000 \
  LOG_LEVEL=info \
  CORS_ORIGINS=https://presidium-frontend.vercel.app,http://localhost:5173 \
  JWT_SECRET=$(openssl rand -base64 32) \
  SESSION_SECRET=$(openssl rand -base64 32) \
  -a presidium-backend-v0001

# Email (опционально)
heroku config:set \
  EMAIL_HOST=imap.gmail.com \
  EMAIL_USER=your.email@gmail.com \
  EMAIL_PASS=your-app-password \
  -a presidium-backend-v0001

# SMS/Twilio (опционально)
heroku config:set \
  TWILIO_SID=your_twilio_sid \
  TWILIO_TOKEN=your_twilio_token \
  TWILIO_PHONE=+1234567890 \
  -a presidium-backend-v0001

# Проверь
heroku config -a presidium-backend-v0001
```

### Шаг 3: Deploy на Heroku

```bash
# Способ 1: Через git push (после настройки remote)
git remote add heroku https://git.heroku.com/presidium-backend-v0001.git
git push heroku main

# Способ 2: Через CLI
heroku git:remote -a presidium-backend-v0001
git push heroku main

# Смотри логи
heroku logs --tail -a presidium-backend-v0001

# Проверь здоровье
curl https://presidium-backend-v0001.herokuapp.com/health
```

### Шаг 4: Обнови Procfile (уже создан)

✅ `backend/Procfile` уже создан:
```
web: npm run build && npm start
```

---

## 🌐 VERCEL FRONTEND

### Шаг 1: Создай Vercel project

```bash
# Логин в Vercel
npm install -g vercel
vercel login

# Инициализируй в frontend директории
cd frontend
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? presidium-frontend
# - Directory? ./
# - Override settings? No
```

### Шаг 2: Обнови Environment Variables в Vercel

```bash
# Через CLI
cd frontend
vercel env add VITE_API_URL production
# Введи: https://presidium-backend-v0001.herokuapp.com

# Или через Dashboard:
# https://vercel.com/YOUR_PROJECT/settings/environment-variables
```

Или добавь в `vercel.json`:

```json
{
  "env": {
    "VITE_API_URL": "https://presidium-backend-v0001.herokuapp.com"
  }
}
```

### Шаг 3: Обнови API endpoint в коде

✅ Уже обновлено в `frontend/src/api/chat.api.ts`:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

### Шаг 4: Deploy

```bash
cd frontend
vercel --prod

# или через git integration:
# Connect GitHub → Vercel → Auto-deploy on push
```

---

## ✅ ПРОВЕРКА И ТЕСТИРОВАНИЕ

### Шаг 1: Здоровье сервисов

```bash
# Backend health
curl https://presidium-backend-v0001.herokuapp.com/health

# Frontend URL
# https://presidium-frontend.vercel.app (или ваше имя)

# Должны видеть:
# Backend: { "status": "ok", "service": "Presidium Backend", ... }
# Frontend: Presidium UI загружается
```

### Шаг 2: Функциональное тестирование

```bash
# Получи дашборд
curl https://presidium-backend-v0001.herokuapp.com/api/dashboard

# Получи чаты
curl https://presidium-backend-v0001.herokuapp.com/api/chats

# Тест аутентификации
curl -X POST https://presidium-backend-v0001.herokuapp.com/api/auth/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+79991234567",
    "deviceFingerprint": "fp_test123",
    "deviceComponents": {
      "userAgent": "Mozilla/5.0...",
      "screenResolution": "1920x1080",
      "timezone": "Europe/Moscow",
      "language": "ru",
      "platform": "Win32"
    }
  }'
```

### Шаг 3: Browser testing

1. Открой `https://presidium-frontend.vercel.app`
2. Проверь, что UI загружается
3. Проверь Network tab - запросы идут на Heroku backend
4. Протестируй функции приложения

---

## 🔄 CI/CD PIPELINE

### GitHub Actions Workflow

✅ Уже создан `.github/workflows/deploy.yml`:

- **Test job**: Собирает backend и frontend
- **Deploy Backend**: Автоматически деплоит на Heroku при push в main
- **Deploy Frontend**: Автоматически деплоит на Vercel при push в main

### Триггеры

- Push в `main` → автоматический деплой
- Pull Request → только тесты (без деплоя)

---

## 📊 МОНИТОРИНГ

### Heroku Logs

```bash
# Real-time logs
heroku logs --tail -a presidium-backend-v0001

# Последние 100 строк
heroku logs -n 100 -a presidium-backend-v0001

# Только ошибки
heroku logs --tail --dyno=web -a presidium-backend-v0001 | grep -i error
```

### Vercel Analytics

```
Dashboard → presidium-frontend → Analytics
- Page views
- Core Web Vitals
- Errors
```

### Custom Monitoring

```bash
# Простой скрипт мониторинга
cat > monitor.sh << 'EOF'
#!/bin/bash
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://presidium-backend-v0001.herokuapp.com/health)
  if [ "$STATUS" = "200" ]; then
    echo "✅ Backend OK - $(date)"
  else
    echo "❌ Backend DOWN ($STATUS) - $(date)"
  fi
  sleep 60
done
EOF

chmod +x monitor.sh
./monitor.sh
```

---

## 🔧 TROUBLESHOOTING

### Backend не запускается

```bash
# Проверь логи
heroku logs --tail -a presidium-backend-v0001

# Перезагрузи dyno
heroku dyno:restart -a presidium-backend-v0001

# Проверь конфиг
heroku config -a presidium-backend-v0001

# Проверь сборку локально
cd backend
npm run build
npm start
```

### Frontend не загружается

```bash
# Проверь деплой статус
vercel list

# Посмотри логи
vercel logs presidium-frontend

# Пересоздай деплой
vercel --prod

# Очисти кеш
vercel --prod --yes
```

### API не отвечает / CORS ошибки

```bash
# Проверь endpoint
curl -i https://presidium-backend-v0001.herokuapp.com/health

# Проверь CORS (должна быть включена)
curl -i -X OPTIONS https://presidium-backend-v0001.herokuapp.com/api/dashboard \
  -H "Origin: https://presidium-frontend.vercel.app" \
  -H "Access-Control-Request-Method: GET"

# Убедись, что VERCEL_URL добавлен в CORS_ORIGINS
heroku config:get CORS_ORIGINS -a presidium-backend-v0001
```

### Environment Variables не работают

```bash
# Backend
heroku config -a presidium-backend-v0001

# Frontend
vercel env ls

# Проверь, что переменные установлены для production
vercel env pull .env.local
cat .env.local
```

---

## 📈 SCALE & PERFORMANCE

### Увеличение Heroku dyno

```bash
# Текущий размер
heroku dyno:type -a presidium-backend-v0001

# Upgrade на Hobby ($7/month - always on)
heroku dyno:type hobby -a presidium-backend-v0001

# Upgrade на Standard ($50/month - production)
heroku dyno:type standard-1x -a presidium-backend-v0001
```

### Добавь Redis Cache (опционально)

```bash
# Установи Redis
heroku addons:create heroku-redis:premium-0 -a presidium-backend-v0001

# Получи URL
heroku config:get REDIS_URL -a presidium-backend-v0001
```

### Добавь Database (PostgreSQL) (опционально)

```bash
# Инициализируй DB
heroku addons:create heroku-postgresql:standard-0 -a presidium-backend-v0001

# Получи URL
heroku config:get DATABASE_URL -a presidium-backend-v0001
```

---

## 🎯 ФИНАЛЬНЫЙ CHECKLIST

- [ ] GitHub repo создан и залит
- [ ] GitHub Secrets настроены
- [ ] Heroku app создан
- [ ] Environment variables установлены на Heroku
- [ ] Backend deployed на Heroku
- [ ] Health check passing
- [ ] Vercel project создан
- [ ] Environment variables установлены на Vercel
- [ ] Frontend deployed на Vercel
- [ ] API endpoints работают
- [ ] CORS настроен правильно
- [ ] CI/CD pipeline работает
- [ ] Мониторинг настроен
- [ ] Логирование работает

---

## 🚀 ДАЛЕЕ

После успешного деплоя:

1. **Week 1: MVP Launch & Testing**
   - 100 beta users
   - Fix bugs
   - Gather feedback

2. **Week 2: Optimizations**
   - Performance tuning
   - Database migration (если нужно)
   - Caching improvements

3. **Week 3: Features**
   - WebAuthn/Passkeys интеграция
   - Better UI/UX
   - Mobile optimization

4. **Month 1: Scale to 10K users**
5. **Month 3: Scale to 100K users**

---

## 📚 Дополнительные ресурсы

- [Heroku Node.js Support](https://devcenter.heroku.com/articles/nodejs-support)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions](https://docs.github.com/en/actions)
- [CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Status: 🚀 PRODUCTION READY**

Все готово к запуску!

>>>>>>> e9252c9a1f1ab9b7c70dc2fdd65e8fa3e9103969
