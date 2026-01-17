# PowerShell script to create a release ZIP
# Usage: .\scripts\create_release_zip.ps1
# 
# This script:
# 1. Updates APP_VERSION in constants.ts to match release version
# 2. Temporarily renames extension to "GORewrite" (removes " (Dev)")
# 3. Builds the extension
# 4. Creates a ZIP file
# 5. Restores development versions of both files

$manifestPath = "public\manifest.json"
$constantsPath = "src\constants.ts"
$releaseVersion = "2.0.1"
$zipName = "GORewrite-v$releaseVersion.zip"

Write-Host "📦 Creating Release ZIP for v$releaseVersion..." -ForegroundColor Cyan
Write-Host ""

# 1. Update constants.ts - APP_VERSION
Write-Host "📌 Updating constants.ts APP_VERSION to $releaseVersion..." -ForegroundColor Gray
$constantsContent = Get-Content $constantsPath -Raw
$constantsContent = $constantsContent -replace 'APP_VERSION = "[^"]+"', "APP_VERSION = `"$releaseVersion`""
$constantsContent | Set-Content $constantsPath -Encoding UTF8 -NoNewline
Write-Host "✅ constants.ts updated" -ForegroundColor Green

# 2. Update manifest.json
$manifestContent = Get-Content $manifestPath -Raw | ConvertFrom-Json
$originalName = $manifestContent.name
Write-Host "📌 Current Name: $originalName" -ForegroundColor Gray

$manifestContent.name = "GORewrite"
$manifestContent.version = $releaseVersion

$manifestContent | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8
Write-Host "✅ manifest.json switched to Production (Name: GORewrite, Version: $releaseVersion)" -ForegroundColor Green

# 3. Build
Write-Host ""
Write-Host "🔨 Running npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build Failed! Restoring files..." -ForegroundColor Red
    git checkout -- $manifestPath $constantsPath
    exit 1
}

# 4. Create ZIP
Write-Host "📦 Creating ZIP: $zipName" -ForegroundColor Cyan
if (Test-Path $zipName) { Remove-Item $zipName }
Compress-Archive -Path dist\* -DestinationPath $zipName -Force
Write-Host "✅ ZIP created: $zipName" -ForegroundColor Green

# 5. Restore development versions
Write-Host ""
Write-Host "🔄 Restoring development files..." -ForegroundColor Yellow
git checkout -- $manifestPath $constantsPath
Write-Host "✅ Restored constants.ts and manifest.json to development versions." -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Release ZIP ready: $zipName" -ForegroundColor Magenta
Write-Host ""
Write-Host "⚠️  Next: Update `$releaseVersion in this script for the next release!" -ForegroundColor Yellow

