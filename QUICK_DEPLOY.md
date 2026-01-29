<<<<<<< HEAD
# 🚀 Быстрый деплой Presidium

## ✅ Инструменты установлены!

Heroku CLI и Vercel CLI успешно установлены.

## 🎯 Два способа деплоя

### Способ 1: Автоматические скрипты (рекомендуется)

```powershell
# Backend на Heroku
.\deploy-backend.ps1

# Frontend на Vercel
.\deploy-frontend.ps1
```

### Способ 2: Ручной деплой

#### Backend (Heroku)

```powershell
# 1. Перейди в корень проекта
cd D:\Presidium

# 2. Логин (если еще не залогинен)
heroku login

# 3. Перейди в backend и создай приложение
cd backend
heroku create presidium-backend-v0001

# 4. Настрой переменные окружения
heroku config:set NODE_ENV=production -a presidium-backend-v0001
heroku config:set CORS_ORIGINS="https://presidium-frontend.vercel.app,http://localhost:5173" -a presidium-backend-v0001

# Генерируй секретные ключи
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
heroku config:set JWT_SECRET=$jwtSecret -a presidium-backend-v0001
heroku config:set SESSION_SECRET=$sessionSecret -a presidium-backend-v0001

# 5. Настрой git remote
heroku git:remote -a presidium-backend-v0001

# 6. Deploy!
git push heroku main

# 7. Проверь здоровье
heroku logs --tail -a presidium-backend-v0001
curl https://presidium-backend-v0001.herokuapp.com/health
```

#### Frontend (Vercel)

```powershell
# 1. Перейди в frontend
cd D:\Presidium\frontend

# 2. Логин (если еще не залогинен)
vercel login

# 3. Инициализируй проект (первый раз)
vercel
# Следуй инструкциям:
# - Set up and deploy? Y
# - Which scope? Выбери свой аккаунт
# - Link to existing project? N
# - Project name? presidium-frontend
# - Directory? ./
# - Override settings? N

# 4. Установи Environment Variable (важно!)
vercel env add VITE_API_URL production
# Введи: https://presidium-backend-v0001.herokuapp.com
# (замени на свой реальный Heroku URL)

# 5. Deploy в production
vercel --prod

# 6. Запиши URL который даст Vercel
```

## 🔄 После деплоя Frontend

Обнови CORS на Heroku с реальным Vercel URL:

```powershell
# Замени YOUR_VERCEL_URL на реальный URL от Vercel
heroku config:set CORS_ORIGINS="YOUR_VERCEL_URL,http://localhost:5173" -a presidium-backend-v0001

# Перезапусти dyno
heroku dyno:restart -a presidium-backend-v0001
```

## 📝 GitHub Secrets (для автоматического деплоя)

```
GitHub Repository → Settings → Secrets and variables → Actions
```

Добавь:
- `HEROKU_API_KEY` - получи через: `heroku auth:token`
- `HEROKU_EMAIL` - твой email
- `HEROKU_APP_NAME` - `presidium-backend-v0001`
- `VERCEL_TOKEN` - https://vercel.com/account/tokens
- `VERCEL_ORG_ID` - найди в `.vercel/project.json` после `vercel link`
- `VERCEL_PROJECT_ID` - найди в `.vercel/project.json`

## ✅ Проверка после деплоя

### Backend
```powershell
# Health check
curl https://presidium-backend-v0001.herokuapp.com/health

# Логи
heroku logs --tail -a presidium-backend-v0001
```

### Frontend
```powershell
# Открой в браузере URL который дал Vercel
# Проверь что UI загружается
# Проверь Network tab - запросы идут на Heroku
```

## 🆘 Troubleshooting

### Heroku: "fatal: 'heroku' does not appear to be a git repository"

```powershell
# Удали старый remote если есть
git remote remove heroku

# Добавь правильный
heroku git:remote -a presidium-backend-v0001
```

### Vercel: "Link to existing project?"

При первом деплое выбери **N** (No), чтобы создать новый проект.

### CORS errors в браузере

1. Убедись что Vercel URL добавлен в `CORS_ORIGINS` на Heroku
2. Перезапусти dyno: `heroku dyno:restart -a presidium-backend-v0001`
3. Проверь что URL точный (включая https://)

---

## 🎉 Готово!

После успешного деплоя:
- ✅ Backend доступен на Heroku
- ✅ Frontend доступен на Vercel
- ✅ CI/CD настроен для автоматического деплоя при push в main
=======
# 🚀 Быстрый деплой Presidium

## ✅ Инструменты установлены!

Heroku CLI и Vercel CLI успешно установлены.

## 🎯 Два способа деплоя

### Способ 1: Автоматические скрипты (рекомендуется)

```powershell
# Backend на Heroku
.\deploy-backend.ps1

# Frontend на Vercel
.\deploy-frontend.ps1
```

### Способ 2: Ручной деплой

#### Backend (Heroku)

```powershell
# 1. Перейди в корень проекта
cd D:\Presidium

# 2. Логин (если еще не залогинен)
heroku login

# 3. Перейди в backend и создай приложение
cd backend
heroku create presidium-backend-v0001

# 4. Настрой переменные окружения
heroku config:set NODE_ENV=production -a presidium-backend-v0001
heroku config:set CORS_ORIGINS="https://presidium-frontend.vercel.app,http://localhost:5173" -a presidium-backend-v0001

# Генерируй секретные ключи
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
heroku config:set JWT_SECRET=$jwtSecret -a presidium-backend-v0001
heroku config:set SESSION_SECRET=$sessionSecret -a presidium-backend-v0001

# 5. Настрой git remote
heroku git:remote -a presidium-backend-v0001

# 6. Deploy!
git push heroku main

# 7. Проверь здоровье
heroku logs --tail -a presidium-backend-v0001
curl https://presidium-backend-v0001.herokuapp.com/health
```

#### Frontend (Vercel)

```powershell
# 1. Перейди в frontend
cd D:\Presidium\frontend

# 2. Логин (если еще не залогинен)
vercel login

# 3. Инициализируй проект (первый раз)
vercel
# Следуй инструкциям:
# - Set up and deploy? Y
# - Which scope? Выбери свой аккаунт
# - Link to existing project? N
# - Project name? presidium-frontend
# - Directory? ./
# - Override settings? N

# 4. Установи Environment Variable (важно!)
vercel env add VITE_API_URL production
# Введи: https://presidium-backend-v0001.herokuapp.com
# (замени на свой реальный Heroku URL)

# 5. Deploy в production
vercel --prod

# 6. Запиши URL который даст Vercel
```

## 🔄 После деплоя Frontend

Обнови CORS на Heroku с реальным Vercel URL:

```powershell
# Замени YOUR_VERCEL_URL на реальный URL от Vercel
heroku config:set CORS_ORIGINS="YOUR_VERCEL_URL,http://localhost:5173" -a presidium-backend-v0001

# Перезапусти dyno
heroku dyno:restart -a presidium-backend-v0001
```

## 📝 GitHub Secrets (для автоматического деплоя)

```
GitHub Repository → Settings → Secrets and variables → Actions
```

Добавь:
- `HEROKU_API_KEY` - получи через: `heroku auth:token`
- `HEROKU_EMAIL` - твой email
- `HEROKU_APP_NAME` - `presidium-backend-v0001`
- `VERCEL_TOKEN` - https://vercel.com/account/tokens
- `VERCEL_ORG_ID` - найди в `.vercel/project.json` после `vercel link`
- `VERCEL_PROJECT_ID` - найди в `.vercel/project.json`

## ✅ Проверка после деплоя

### Backend
```powershell
# Health check
curl https://presidium-backend-v0001.herokuapp.com/health

# Логи
heroku logs --tail -a presidium-backend-v0001
```

### Frontend
```powershell
# Открой в браузере URL который дал Vercel
# Проверь что UI загружается
# Проверь Network tab - запросы идут на Heroku
```

## 🆘 Troubleshooting

### Heroku: "fatal: 'heroku' does not appear to be a git repository"

```powershell
# Удали старый remote если есть
git remote remove heroku

# Добавь правильный
heroku git:remote -a presidium-backend-v0001
```

### Vercel: "Link to existing project?"

При первом деплое выбери **N** (No), чтобы создать новый проект.

### CORS errors в браузере

1. Убедись что Vercel URL добавлен в `CORS_ORIGINS` на Heroku
2. Перезапусти dyno: `heroku dyno:restart -a presidium-backend-v0001`
3. Проверь что URL точный (включая https://)

---

## 🎉 Готово!

После успешного деплоя:
- ✅ Backend доступен на Heroku
- ✅ Frontend доступен на Vercel
- ✅ CI/CD настроен для автоматического деплоя при push в main
>>>>>>> e9252c9a1f1ab9b7c70dc2fdd65e8fa3e9103969
