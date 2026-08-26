$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$blockchain = Join-Path $root "blockchain"

Write-Host "Saving local Hardhat blockchain state..."
Set-Location $blockchain
npm run save-state

Write-Host ""
Write-Host "Saved. You can now stop the running service tabs with Ctrl+C."
Write-Host "Next time, run .\start-project.ps1. It will restore hardhat-state.json automatically."
