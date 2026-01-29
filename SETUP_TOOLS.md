<<<<<<< HEAD
# Установка инструментов для деплоя

## 🔧 Установка Heroku CLI

### Windows (PowerShell)

```powershell
# Способ 1: Через npm (рекомендуется)
npm install -g heroku

# Способ 2: Через установщик
# Скачай: https://devcenter.heroku.com/articles/heroku-cli
# Или через Chocolatey:
choco install heroku-cli

# Проверь установку
heroku --version
```

### Логин в Heroku

```powershell
heroku login
# Откроется браузер для авторизации
```

---

## 🌐 Установка Vercel CLI

### Windows (PowerShell)

```powershell
# Через npm
npm install -g vercel

# Проверь установку
vercel --version
```

### Логин в Vercel

```powershell
vercel login
# Откроется браузер для авторизации
```

---

## 📝 Быстрая установка всех инструментов

```powershell
# Установи все сразу
npm install -g heroku vercel

# Проверь
heroku --version
vercel --version
```

---

## ✅ После установки

### Heroku Setup

```powershell
# 1. Логин
heroku login

# 2. Создай приложение (из корня проекта)
cd D:\Presidium
heroku create presidium-backend-v0001

# 3. Настрой переменные окружения
heroku config:set NODE_ENV=production -a presidium-backend-v0001
heroku config:set CORS_ORIGINS=https://presidium-frontend.vercel.app,http://localhost:5173 -a presidium-backend-v0001
heroku config:set JWT_SECRET=$(openssl rand -base64 32) -a presidium-backend-v0001
heroku config:set SESSION_SECRET=$(openssl rand -base64 32) -a presidium-backend-v0001

# 4. Добавь Heroku remote
cd backend
heroku git:remote -a presidium-backend-v0001

# 5. Deploy
git push heroku main
```

### Vercel Setup

```powershell
# 1. Логин
vercel login

# 2. Инициализируй проект (из frontend директории)
cd D:\Presidium\frontend
vercel

# 3. Следуй инструкциям:
# - Set up and deploy? Yes
# - Which scope? Выбери свой аккаунт
# - Link to existing project? No
# - Project name? presidium-frontend
# - Directory? ./
# - Override settings? No

# 4. Установи Environment Variable
vercel env add VITE_API_URL production
# Введи: https://presidium-backend-v0001.herokuapp.com

# 5. Deploy в production
vercel --prod
```

---

## 🔑 Альтернатива: Через веб-интерфейсы

Если CLI не работает, можно использовать веб-интерфейсы:

### Heroku
1. Зайди на https://dashboard.heroku.com
2. New → Create new app
3. Settings → Config Vars → добавь переменные
4. Deploy → GitHub → Connect repository

### Vercel
1. Зайди на https://vercel.com
2. New Project → Import Git Repository
3. Настрой проект (root: frontend)
4. Environment Variables → добавь VITE_API_URL
5. Deploy

---

## 🚨 Troubleshooting

### Heroku не найдено

```powershell
# Перезагрузи PowerShell после установки
# Или добавь путь вручную:
$env:PATH += ";C:\Users\YOUR_USERNAME\AppData\Roaming\npm"
```

### Vercel не найдено

```powershell
# Перезагрузи PowerShell
# Или проверь npm global path:
npm config get prefix
# Добавь этот путь в PATH если нужно
```

### Проверь установку npm global packages

```powershell
npm list -g --depth=0
# Должны видеть: heroku, vercel
```

=======
# Установка инструментов для деплоя

## 🔧 Установка Heroku CLI

### Windows (PowerShell)

```powershell
# Способ 1: Через npm (рекомендуется)
npm install -g heroku

# Способ 2: Через установщик
# Скачай: https://devcenter.heroku.com/articles/heroku-cli
# Или через Chocolatey:
choco install heroku-cli

# Проверь установку
heroku --version
```

### Логин в Heroku

```powershell
heroku login
# Откроется браузер для авторизации
```

---

## 🌐 Установка Vercel CLI

### Windows (PowerShell)

```powershell
# Через npm
npm install -g vercel

# Проверь установку
vercel --version
```

### Логин в Vercel

```powershell
vercel login
# Откроется браузер для авторизации
```

---

## 📝 Быстрая установка всех инструментов

```powershell
# Установи все сразу
npm install -g heroku vercel

# Проверь
heroku --version
vercel --version
```

---

## ✅ После установки

### Heroku Setup

```powershell
# 1. Логин
heroku login

# 2. Создай приложение (из корня проекта)
cd D:\Presidium
heroku create presidium-backend-v0001

# 3. Настрой переменные окружения
heroku config:set NODE_ENV=production -a presidium-backend-v0001
heroku config:set CORS_ORIGINS=https://presidium-frontend.vercel.app,http://localhost:5173 -a presidium-backend-v0001
heroku config:set JWT_SECRET=$(openssl rand -base64 32) -a presidium-backend-v0001
heroku config:set SESSION_SECRET=$(openssl rand -base64 32) -a presidium-backend-v0001

# 4. Добавь Heroku remote
cd backend
heroku git:remote -a presidium-backend-v0001

# 5. Deploy
git push heroku main
```

### Vercel Setup

```powershell
# 1. Логин
vercel login

# 2. Инициализируй проект (из frontend директории)
cd D:\Presidium\frontend
vercel

# 3. Следуй инструкциям:
# - Set up and deploy? Yes
# - Which scope? Выбери свой аккаунт
# - Link to existing project? No
# - Project name? presidium-frontend
# - Directory? ./
# - Override settings? No

# 4. Установи Environment Variable
vercel env add VITE_API_URL production
# Введи: https://presidium-backend-v0001.herokuapp.com

# 5. Deploy в production
vercel --prod
```

---

## 🔑 Альтернатива: Через веб-интерфейсы

Если CLI не работает, можно использовать веб-интерфейсы:

### Heroku
1. Зайди на https://dashboard.heroku.com
2. New → Create new app
3. Settings → Config Vars → добавь переменные
4. Deploy → GitHub → Connect repository

### Vercel
1. Зайди на https://vercel.com
2. New Project → Import Git Repository
3. Настрой проект (root: frontend)
4. Environment Variables → добавь VITE_API_URL
5. Deploy

---

## 🚨 Troubleshooting

### Heroku не найдено

```powershell
# Перезагрузи PowerShell после установки
# Или добавь путь вручную:
$env:PATH += ";C:\Users\YOUR_USERNAME\AppData\Roaming\npm"
```

### Vercel не найдено

```powershell
# Перезагрузи PowerShell
# Или проверь npm global path:
npm config get prefix
# Добавь этот путь в PATH если нужно
```

### Проверь установку npm global packages

```powershell
npm list -g --depth=0
# Должны видеть: heroku, vercel
```

>>>>>>> e9252c9a1f1ab9b7c70dc2fdd65e8fa3e9103969
