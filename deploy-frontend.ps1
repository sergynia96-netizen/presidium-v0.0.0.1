# PowerShell script для деплоя frontend на Vercel
# Usage: .\deploy-frontend.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🌐 Presidium Frontend Deploy to Vercel" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переход в frontend директорию
$frontendPath = Join-Path $PSScriptRoot "frontend"
if (-not (Test-Path $frontendPath)) {
    Write-Host "❌ Frontend directory not found!" -ForegroundColor Red
    exit 1
}

Set-Location $frontendPath
Write-Host "📁 Working directory: $frontendPath" -ForegroundColor Green
Write-Host ""

# Проверка vercel CLI
Write-Host "🔍 Checking Vercel CLI..." -ForegroundColor Yellow
$vercelVersion = vercel --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Vercel CLI not found! Install: npm install -g vercel" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Vercel CLI found: $vercelVersion" -ForegroundColor Green
Write-Host ""

# Проверка логина
Write-Host "🔐 Checking Vercel login..." -ForegroundColor Yellow
$vercelWhoami = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not logged in. Logging in..." -ForegroundColor Yellow
    vercel login
} else {
    Write-Host "✅ Logged in as: $vercelWhoami" -ForegroundColor Green
}
Write-Host ""

# Запрос API URL
$backendUrl = Read-Host "Enter backend Heroku URL (e.g., https://presidium-backend-v0001.herokuapp.com)"
if ([string]::IsNullOrWhiteSpace($backendUrl)) {
    Write-Host "⚠️  No URL provided, using default..." -ForegroundColor Yellow
    $backendUrl = "https://presidium-backend-v0001.herokuapp.com"
}

Write-Host ""
Write-Host "🔗 Backend URL: $backendUrl" -ForegroundColor Cyan
Write-Host ""

# Установка Environment Variable
Write-Host "⚙️  Setting environment variable VITE_API_URL..." -ForegroundColor Yellow
vercel env add VITE_API_URL production $backendUrl
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Failed to set env variable. You may need to set it manually in Vercel dashboard." -ForegroundColor Yellow
}
Write-Host "✅ Environment variable set" -ForegroundColor Green
Write-Host ""

# Проверка сборки
Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

# Deploy
Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray
vercel --prod --yes
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy failed! Check logs: vercel logs" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Frontend deployment complete!" -ForegroundColor Green
Write-Host "📊 Logs: vercel logs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

