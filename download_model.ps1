# PowerShell script to download Llama-3.2-1B-Instruct-q4f16_1-MLC model files
# Usage: .\download_model.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Presidium AI Model Downloader" -ForegroundColor Cyan
Write-Host "Llama-3.2-1B-Instruct-q4f16_1-MLC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Base URLs
$huggingfaceBaseUrl = "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/"
$wasmUrl = "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm"

# Create model directory (matching web-llm v0.2.80 expectation: it appends /resolve/main/ unless already present)
# We host files under: frontend/public/models/llama/resolve/main/
$modelDirRoot = "frontend\public\models\llama"
$modelDir = Join-Path $modelDirRoot "resolve\\main"
$wasmDir = "frontend\public\models"

Write-Host "Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
New-Item -ItemType Directory -Force -Path $modelDirRoot | Out-Null
New-Item -ItemType Directory -Force -Path $wasmDir | Out-Null
Write-Host "✓ Directories created" -ForegroundColor Green
Write-Host ""

# List of model files to download
# Based on ndarray-cache.json, we need 22 shards (params_shard_0.bin through params_shard_21.bin)
$modelFiles = @(
    "ndarray-cache.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "mlc-chat-config.json"
)

# Add all 22 shard files (0-21)
for ($i = 0; $i -le 21; $i++) {
    $modelFiles += "params_shard_$i.bin"
}

Write-Host "Downloading model files from HuggingFace..." -ForegroundColor Yellow
Write-Host ""

$downloadedCount = 0
$failedFiles = @()

function Get-ExpectedContentLength {
    param(
        [Parameter(Mandatory=$true)][string]$Url
    )
    try {
        $head = Invoke-WebRequest -Method Head -Uri $Url -UseBasicParsing -TimeoutSec 60
        $cl = $head.Headers['Content-Length']
        # Some servers return an array; normalize to string.
        if ($cl -is [System.Array]) { $cl = $cl[0] }
        if ([string]::IsNullOrWhiteSpace($cl)) { return $null }
        if ($cl -match '^\d+$') {
            $n = [int64]$cl
            if ($n -gt 0) { return $n }
        }
        return $null
    } catch {
        return $null
    }
}

function Test-JsonLooksOk {
    param(
        [Parameter(Mandatory=$true)][string]$Path
    )
    try {
        if (!(Test-Path $Path)) { return $false }
        $sample = Get-Content -Path $Path -TotalCount 5 -ErrorAction Stop | Out-String
        if ([string]::IsNullOrWhiteSpace($sample)) { return $false }
        $trim = $sample.TrimStart()
        if ($trim.StartsWith("<")) { return $false } # likely HTML
        if ($trim.StartsWith("{") -or $trim.StartsWith("[")) { return $true }
        return $false
    } catch {
        return $false
    }
}

function Download-FileRobust {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [Parameter(Mandatory=$true)][string]$OutFile,
        [int64]$ExpectedSize = $null,
        [int]$MaxRetries = 5,
        [switch]$PreferBITS
    )
    $retry = 0
    while ($retry -lt $MaxRetries) {
        try {
            if (Test-Path $OutFile) { Remove-Item -Force $OutFile -ErrorAction SilentlyContinue }

            if ($PreferBITS -and (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue)) {
                # BITS is much more reliable for large files; it can resume internally.
                # IMPORTANT: Some environments enforce a minimum RetryInterval; avoid overriding these unless needed.
                Start-BitsTransfer -Source $Url -Destination $OutFile -Priority Foreground -ErrorAction Stop | Out-Null
            } else {
                $ProgressPreference = 'SilentlyContinue'
                Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 600 -ErrorAction Stop
            }

            $actual = (Get-Item $OutFile).Length
            if ($actual -le 0) { throw "Downloaded file is empty" }
            if ($ExpectedSize -ne $null -and $actual -ne $ExpectedSize) {
                throw "Downloaded size mismatch: got $actual bytes, expected $ExpectedSize bytes"
            }
            return $true
        } catch {
            $retry++
            if ($retry -ge $MaxRetries) { throw }
            Start-Sleep -Seconds ([Math]::Min(10, 2 * $retry))
        }
    }
}

foreach ($file in $modelFiles) {
    $url = $huggingfaceBaseUrl + $file
    $outputPath = Join-Path $modelDir $file
    
    # Determine expected size (Content-Length) so we can detect truncated/partial downloads.
    $expectedSize = Get-ExpectedContentLength -Url $url
    
    # Skip only if file exists AND size matches expected size (when known).
    if (Test-Path $outputPath) {
        $existingFile = Get-Item $outputPath
        if ($existingFile.Length -gt 0) {
            if ($expectedSize -ne $null -and $existingFile.Length -eq $expectedSize) {
                Write-Host "Skipping: $file (already exists, size OK)" -ForegroundColor Gray
                $downloadedCount++
                continue
            } elseif ($expectedSize -eq $null -and $file.EndsWith('.json') -and (Test-JsonLooksOk -Path $outputPath)) {
                Write-Host "Skipping: $file (already exists, looks OK)" -ForegroundColor Gray
                $downloadedCount++
                continue
            } elseif ($expectedSize -ne $null) {
                Write-Host "Re-downloading: $file (local size $($existingFile.Length) != expected $expectedSize)" -ForegroundColor Yellow
            } else {
                Write-Host "Re-downloading: $file (cannot verify expected size)" -ForegroundColor Yellow
            }
        }
    }
    
    try {
        $preferBits = $false
        if ($file.EndsWith('.bin')) { $preferBits = $true }
        Write-Host "Downloading: $file" -ForegroundColor Cyan -NoNewline
        Write-Host " ... " -NoNewline
        Download-FileRobust -Url $url -OutFile $outputPath -ExpectedSize $expectedSize -MaxRetries 5 -PreferBITS:([bool]$preferBits) | Out-Null
        $fileSizeMB = ((Get-Item $outputPath).Length / 1MB)
        Write-Host "✓ ($([math]::Round($fileSizeMB, 2)) MB)" -ForegroundColor Green
        $downloadedCount++
    } catch {
        Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
        $failedFiles += $file
    }
}

Write-Host ""
Write-Host "Downloading WASM binary..." -ForegroundColor Yellow

# Define WASM file name and output path
$wasmFileName = "model.wasm"
$wasmOutputPath = Join-Path $wasmDir $wasmFileName

try {
    Write-Host "Downloading: $wasmFileName" -ForegroundColor Cyan -NoNewline
    Write-Host " ... " -NoNewline
    
    $expectedWasmSize = Get-ExpectedContentLength -Url $wasmUrl
    # IMPORTANT: parenthesize Test-Path; otherwise "-and" is parsed as a cmdlet parameter ("parameter name 'and'").
    if ((Test-Path $wasmOutputPath) -and ($expectedWasmSize -ne $null) -and ((Get-Item $wasmOutputPath).Length -eq $expectedWasmSize)) {
        $wasmSize = ((Get-Item $wasmOutputPath).Length / 1MB)
        Write-Host "✓ (already exists, $([math]::Round($wasmSize, 2)) MB)" -ForegroundColor Green
    } else {
        Download-FileRobust -Url $wasmUrl -OutFile $wasmOutputPath -ExpectedSize $expectedWasmSize -MaxRetries 5 -PreferBITS | Out-Null
        $wasmSize = ((Get-Item $wasmOutputPath).Length / 1MB)
        Write-Host "✓ ($([math]::Round($wasmSize, 2)) MB)" -ForegroundColor Green
    }
}
catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    $failedFiles += $wasmFileName
}

Write-Host ""
Write-Host "Optional migration (old layout -> new layout)..." -ForegroundColor Yellow
Write-Host "From: $modelDirRoot" -ForegroundColor Gray
Write-Host "To:   $modelDir" -ForegroundColor Gray

# If user previously downloaded files into frontend/public/models/llama/, copy them into resolve/main/
$migrated = 0
foreach ($file in $modelFiles) {
    $oldPath = Join-Path $modelDirRoot $file
    $newPath = Join-Path $modelDir $file
    if ((Test-Path $oldPath) -and !(Test-Path $newPath)) {
        try {
            Copy-Item -Path $oldPath -Destination $newPath -Force
            $migrated++
        } catch {
            # ignore
        }
    }
}
if ($migrated -gt 0) {
    Write-Host "✓ Migrated $migrated files into resolve/main/ layout" -ForegroundColor Green
} else {
    Write-Host "✓ Nothing to migrate" -ForegroundColor Green
}

Write-Host ""
Write-Host "Creating tensor-cache.json (required by web-llm)..." -ForegroundColor Yellow
$ndarrayCachePath = Join-Path $modelDir "ndarray-cache.json"
$tensorCachePath = Join-Path $modelDir "tensor-cache.json"
if (Test-Path $ndarrayCachePath) {
    try {
        Copy-Item -Path $ndarrayCachePath -Destination $tensorCachePath -Force
        Write-Host "✓ Created tensor-cache.json from ndarray-cache.json" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to create tensor-cache.json: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ Warning: ndarray-cache.json not found, tensor-cache.json will be missing" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Download Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successfully downloaded: $downloadedCount/$($modelFiles.Count) model files" -ForegroundColor Green

if ($failedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed files:" -ForegroundColor Red
    foreach ($file in $failedFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Note: Some files may be optional or have different names." -ForegroundColor Yellow
    Write-Host "Check the HuggingFace repository for the complete file list." -ForegroundColor Yellow
}
else {
    Write-Host "✓ All files downloaded successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Model location: $modelDir" -ForegroundColor Cyan
Write-Host "WASM location: $wasmOutputPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now use the model in your application!" -ForegroundColor Green

