# Manchengo Smart ERP - Windows Build Script
# Builds MSI installer for Windows distribution

param(
    [switch]$Release,
    [switch]$Sign
)

$ErrorActionPreference = "Stop"

Write-Host "=== Manchengo Smart ERP Windows Build ===" -ForegroundColor Cyan

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "Rust/Cargo not found. Install from https://rustup.rs"
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js/npm not found. Install from https://nodejs.org"
    exit 1
}

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
Push-Location "../web"
npm run build
npm run export
Pop-Location

# Build Tauri app
Write-Host "Building Tauri application..." -ForegroundColor Yellow

if ($Release) {
    cargo tauri build
} else {
    cargo tauri build --debug
}

# Sign if requested
if ($Sign) {
    Write-Host "Signing MSI installer..." -ForegroundColor Yellow
    
    $msiPath = "target/release/bundle/msi/Manchengo ERP_1.0.0_x64_en-US.msi"
    
    if (Test-Path $msiPath) {
        # Sign with Windows SDK signtool
        # Requires code signing certificate
        signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $msiPath
        Write-Host "MSI signed successfully" -ForegroundColor Green
    }
}

# Output location
$bundlePath = if ($Release) { "target/release/bundle" } else { "target/debug/bundle" }

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host "Installers available at: $bundlePath" -ForegroundColor Cyan
Write-Host "  - MSI: $bundlePath/msi/"
Write-Host "  - NSIS: $bundlePath/nsis/"
