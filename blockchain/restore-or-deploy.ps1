Start-Sleep -Seconds 8

if (Test-Path ".\hardhat-state.json") {
    npm run load-state
    if ($LASTEXITCODE -ne 0) {
        npm run deploy
    }
} else {
    npm run deploy
}

Write-Host ""
Write-Host "Blockchain is ready. Keep this tab open for logs or close it."
