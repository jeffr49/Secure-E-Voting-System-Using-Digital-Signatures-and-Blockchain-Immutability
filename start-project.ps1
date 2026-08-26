param(
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$blockchain = Join-Path $root "blockchain"
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$faceService = Join-Path $root "face-verification-service"

function Assert-Command($name, $installHint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name was not found. $installHint"
    }
}

Assert-Command "wt.exe" "Install Windows Terminal or run each command manually in separate PowerShell windows."
Assert-Command "node.exe" "Install Node.js."
Assert-Command "npm.cmd" "Install Node.js/npm."
Assert-Command "python.exe" "Install Python 3.10+."

if ($Install) {
    Write-Host "Installing blockchain dependencies..."
    Push-Location $blockchain
    npm install
    Pop-Location

    Write-Host "Installing backend dependencies..."
    Push-Location $backend
    npm install
    Pop-Location

    Write-Host "Installing frontend dependencies..."
    Push-Location $frontend
    npm install
    Pop-Location

    Write-Host "Installing face-verification dependencies..."
    Push-Location $faceService
    python -m pip install -r requirements.txt
    Pop-Location
}

$tabs = @(
    "new-tab --title `"Blockchain Node`" powershell -NoExit -Command `"Set-Location '$blockchain'; npm run node`"",
    "new-tab --title `"Blockchain State/Deploy`" powershell -NoExit -Command `"Start-Sleep -Seconds 8; Set-Location '$blockchain'; if (Test-Path '.\hardhat-state.json') { npm run load-state } else { npm run deploy }; Write-Host ''; Write-Host 'Blockchain is ready. Keep this tab open for logs or close it.'`"",
    "new-tab --title `"Face API`" powershell -NoExit -Command `"Set-Location '$faceService'; python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload`"",
    "new-tab --title `"Backend API`" powershell -NoExit -Command `"Set-Location '$backend'; node server.js`"",
    "new-tab --title `"Frontend`" powershell -NoExit -Command `"Set-Location '$frontend'; npm run dev`""
)

Start-Process wt.exe -ArgumentList ($tabs -join " ; ")

Write-Host "Started SecureVoting in Windows Terminal tabs."
Write-Host "Open http://localhost:3000 after the frontend finishes compiling."
Write-Host "Before stopping the project, run: .\before-stop.ps1"
