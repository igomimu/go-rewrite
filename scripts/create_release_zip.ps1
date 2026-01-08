# PowerShell script to create a release ZIP with stable version
# Usage: .\scripts\create_release_zip.ps1
# 
# This script:
# 1. Saves the current development version
# 2. Switches to release version (1.3) in BOTH manifest.json AND App.tsx
# 3. Builds the extension
# 4. Creates a ZIP file
# 5. Automatically restores the development version

$manifestPath = "public\manifest.json"
$appTsxPath = "src\App.tsx"
$releaseVersion = "1.3"
$zipName = "GORewrite-v$releaseVersion.zip"

# 1. Backup current manifest (development version)
Write-Host "📦 Creating Release ZIP..." -ForegroundColor Cyan
Write-Host ""

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$devVersion = $manifest.version
Write-Host "📌 Development version: $devVersion" -ForegroundColor Gray

# 2. Set release version in manifest.json
$manifest.version = $releaseVersion
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8
Write-Host "✅ manifest.json switched to: $releaseVersion" -ForegroundColor Green

# 3. Set release version in App.tsx
$appContent = Get-Content $appTsxPath -Raw -Encoding UTF8
$pattern = '(<span className="text-\[10px\] text-gray-400 font-normal pl-1">)v[0-9.]+(<\/span>)'
if ($appContent -match $pattern) {
    $newContent = $appContent -replace $pattern, "`${1}v$releaseVersion`${2}"
    $newContent | Set-Content $appTsxPath -Encoding UTF8
    Write-Host "✅ App.tsx version display switched to: v$releaseVersion" -ForegroundColor Green
}
else {
    Write-Host "⚠️ Warning: Could not find version span in App.tsx" -ForegroundColor Yellow
}

# 4. Build
Write-Host "🔨 Running npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build Failed! Restoring development version..." -ForegroundColor Red
    git checkout -- $manifestPath
    git checkout -- $appTsxPath
    exit 1
}

# 5. Create ZIP
Write-Host "📦 Creating ZIP: $zipName" -ForegroundColor Cyan
if (Test-Path $zipName) { Remove-Item $zipName }
Compress-Archive -Path dist\* -DestinationPath $zipName -Force
Write-Host "✅ ZIP created: $zipName" -ForegroundColor Green

# 6. Restore development version (AUTOMATIC)
Write-Host ""
Write-Host "🔄 Restoring development version: $devVersion" -ForegroundColor Yellow
git checkout -- $manifestPath
git checkout -- $appTsxPath
Write-Host "✅ Development version restored!" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Release ZIP ready: $zipName" -ForegroundColor Magenta
Write-Host "📌 Both manifest.json and App.tsx are back to development version" -ForegroundColor Gray

