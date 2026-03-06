# Quick Start Script for Serika.art

Write-Host "🎨 Serika.art - Setup Script" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠️  .env.local not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
    Write-Host "✅ Created .env.local. Please edit it with your actual credentials." -ForegroundColor Green
    Write-Host ""
    Write-Host "Required environment variables:" -ForegroundColor Cyan
    Write-Host "  - ACCOUNTS_URL (Serika Accounts URL)" -ForegroundColor White
    Write-Host "  - ACCOUNTS_INTERNAL_KEY (Internal API key)" -ForegroundColor White
    Write-Host "  - MONGO_URI (MongoDB connection string)" -ForegroundColor White
    Write-Host "  - MONGO_DB (Database name)" -ForegroundColor White
    Write-Host "  - R2_ACCOUNT_ID (Cloudflare account ID)" -ForegroundColor White
    Write-Host "  - R2_ACCESS_KEY_ID (R2 access key)" -ForegroundColor White
    Write-Host "  - R2_SECRET_ACCESS_KEY (R2 secret key)" -ForegroundColor White
    Write-Host "  - R2_BUCKET_NAME (R2 bucket name)" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to open .env.local for editing..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    notepad .env.local
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install dependencies." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Dependencies already installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Make sure MongoDB is running and accessible" -ForegroundColor White
Write-Host "  2. Verify R2 bucket is created and configured" -ForegroundColor White
Write-Host "  3. Ensure Serika Accounts is set up correctly" -ForegroundColor White
Write-Host "  4. Run: npm run dev" -ForegroundColor White
Write-Host "  5. Open: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see README.md and DEPLOYMENT.md" -ForegroundColor Gray
Write-Host ""

$start = Read-Host "Start development server now? (y/n)"
if ($start -eq "y" -or $start -eq "Y") {
    Write-Host ""
    Write-Host "🚀 Starting development server..." -ForegroundColor Cyan
    npm run dev
}
