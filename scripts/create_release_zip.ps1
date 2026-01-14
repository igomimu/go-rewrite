# PowerShell script to create a release ZIP
# Usage: .\scripts\create_release_zip.ps1
# 
# This script:
# 1. Temporarily renames extension to "GORewrite" (removes " (Dev)")
# 2. Builds the extension
# 3. Creates a ZIP file
# 4. Restores the development manifest

$manifestPath = "public\manifest.json"
$releaseVersion = "1.5.0"
$zipName = "GORewrite-v$releaseVersion.zip"

# 1. Backup current manifest (development version)
Write-Host "📦 Creating Release ZIP..." -ForegroundColor Cyan
Write-Host ""

$manifestContent = Get-Content $manifestPath -Raw | ConvertFrom-Json
$originalName = $manifestContent.name
Write-Host "📌 Current Name: $originalName" -ForegroundColor Gray

# 2. Set Production Name in manifest.json
$manifestContent.name = "GORewrite"
# Ensure version is set (though usually synced)
$manifestContent.version = $releaseVersion

$manifestContent | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8
Write-Host "✅ manifest.json switched to Production Name: GORewrite" -ForegroundColor Green

# 3. Build
Write-Host "🔨 Running npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build Failed! Restoring manifest..." -ForegroundColor Red
    git checkout -- $manifestPath
    exit 1
}

# 4. Create ZIP
Write-Host "📦 Creating ZIP: $zipName" -ForegroundColor Cyan
if (Test-Path $zipName) { Remove-Item $zipName }
Compress-Archive -Path dist\* -DestinationPath $zipName -Force
Write-Host "✅ ZIP created: $zipName" -ForegroundColor Green

# 5. Restore development manifest
Write-Host ""
Write-Host "🔄 Restoring development manifest..." -ForegroundColor Yellow
git checkout -- $manifestPath
Write-Host "✅ Restored." -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Release ZIP ready: $zipName" -ForegroundColor Magenta

