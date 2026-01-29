# PowerShell script для деплоя backend на Heroku
# Usage: .\deploy-backend.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Presidium Backend Deploy to Heroku" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переход в backend директорию
$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Host "❌ Backend directory not found!" -ForegroundColor Red
    exit 1
}

Set-Location $backendPath
Write-Host "📁 Working directory: $backendPath" -ForegroundColor Green
Write-Host ""

# Проверка heroku CLI
Write-Host "🔍 Checking Heroku CLI..." -ForegroundColor Yellow
$herokuVersion = heroku --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Heroku CLI not found! Install: npm install -g heroku" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Heroku CLI found: $herokuVersion" -ForegroundColor Green
Write-Host ""

# Проверка логина
Write-Host "🔐 Checking Heroku login..." -ForegroundColor Yellow
$herokuWhoami = heroku auth:whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not logged in. Logging in..." -ForegroundColor Yellow
    heroku login
} else {
    Write-Host "✅ Logged in as: $herokuWhoami" -ForegroundColor Green
}
Write-Host ""

# Имя приложения
$appName = "presidium-backend-v0001"
Write-Host "📱 App name: $appName" -ForegroundColor Cyan
Write-Host ""

# Проверка существования app
Write-Host "🔍 Checking if app exists..." -ForegroundColor Yellow
$appExists = heroku apps:info -a $appName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  App doesn't exist. Creating..." -ForegroundColor Yellow
    heroku create $appName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create app!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ App created: $appName" -ForegroundColor Green
} else {
    Write-Host "✅ App exists: $appName" -ForegroundColor Green
}
Write-Host ""

# Настройка переменных окружения
Write-Host "⚙️  Setting environment variables..." -ForegroundColor Yellow

# Генерация секретных ключей
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

heroku config:set NODE_ENV=production -a $appName
heroku config:set CORS_ORIGINS="https://presidium-frontend.vercel.app,http://localhost:5173" -a $appName
heroku config:set JWT_SECRET=$jwtSecret -a $appName
heroku config:set SESSION_SECRET=$sessionSecret -a $appName

Write-Host "✅ Environment variables set" -ForegroundColor Green
Write-Host ""

# Настройка git remote
Write-Host "🔗 Setting up Heroku git remote..." -ForegroundColor Yellow
heroku git:remote -a $appName
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Failed to set remote, trying to add manually..." -ForegroundColor Yellow
    git remote remove heroku 2>&1 | Out-Null
    git remote add heroku "https://git.heroku.com/$appName.git"
}
Write-Host "✅ Heroku remote configured" -ForegroundColor Green
Write-Host ""

# Проверка сборки
Write-Host "🔨 Building backend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

# Deploy
Write-Host "🚀 Deploying to Heroku..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray
git push heroku main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy failed! Check logs: heroku logs --tail -a $appName" -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host ""

# Проверка health
Write-Host "🏥 Checking health..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$healthUrl = "https://$appName.herokuapp.com/health"
try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend is healthy!" -ForegroundColor Green
        Write-Host "📍 URL: $healthUrl" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️  Health check failed, but deploy may still be in progress" -ForegroundColor Yellow
    Write-Host "   Check logs: heroku logs --tail -a $appName" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Backend deployment complete!" -ForegroundColor Green
Write-Host "📍 URL: https://$appName.herokuapp.com" -ForegroundColor Cyan
Write-Host "📊 Logs: heroku logs --tail -a $appName" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

