# PowerShell script to update extension version and build
# Usage: .\scripts\update_extension.ps1

$manifestPath = "public\manifest.json"
$appTsxPath = "src\App.tsx"

# 1. Read Manifest
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

# 2. Increment Version (Simple patch increment)
$versionParts = $manifest.version.Split('.')
if ($versionParts.Count -lt 3) { $versionParts += "0" } # Ensure at least x.y.z
$versionParts[-1] = [int]$versionParts[-1] + 1
$newVersion = $versionParts -join '.'

$manifest.version = $newVersion
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8

Write-Host "✅ Manifest version updated to: $newVersion" -ForegroundColor Green

# 3. Update App.tsx version display
# Looking for pattern: <span className="text-[10px] text-gray-400 font-normal pl-1">v39.1</span>
# We will use regex to replace just the version part.
$appContent = Get-Content $appTsxPath -Raw -Encoding UTF8
$pattern = '(<span className="text-\[10px\] text-gray-400 font-normal pl-1">)v[0-9.]+(</span>)'
if ($appContent -match $pattern) {
    $parts = $appContent -split $pattern
    
    $newContent = $appContent -replace $pattern, "${1}v$newVersion${2}"
    $newContent | Set-Content $appTsxPath -Encoding UTF8
    Write-Host "✅ App.tsx version display updated to: v$newVersion" -ForegroundColor Green
}
else {
    Write-Host "⚠️ Warning: Could not find version span in App.tsx. Skipping display update." -ForegroundColor Yellow
}

# 4. Build
Write-Host "🔨 Running npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉 Build Complete! Version: v$newVersion" -ForegroundColor Green
    Write-Host "🔔 Please click 'Update' in Chrome Extensions page!" -ForegroundColor Magenta
}
else {
    Write-Host "❌ Build Failed!" -ForegroundColor Red
}
