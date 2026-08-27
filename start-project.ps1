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

function Get-LanIp {
    $cfg = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object { $null -ne $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
        Select-Object -First 1
    if ($cfg -and $cfg.IPv4Address) {
        return @($cfg.IPv4Address.IPAddress)[0]
    }
    return $null
}

function Set-EnvValue([string]$path, [string]$key, [string]$value) {
    $dir = Split-Path -Parent $path
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
    $lines = @()
    if (Test-Path $path) {
        $lines = @(Get-Content -Path $path)
    }
    $found = $false
    $updated = foreach ($line in $lines) {
        if ($line -match "^$([regex]::Escape($key))=") {
            $found = $true
            "$key=$value"
        } else {
            $line
        }
    }
    if (-not $found) {
        $updated = @($updated) + "$key=$value"
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllLines($path, [string[]]@($updated), $utf8NoBom)
}

$lanIp = Get-LanIp
if ($lanIp) {
    Write-Host "Using LAN IP $lanIp for phone QR codes."
    Set-EnvValue (Join-Path $faceService ".env") "LOCAL_IP" $lanIp
    Set-EnvValue (Join-Path $frontend ".env.local") "NEXT_PUBLIC_LOCAL_IP" $lanIp
} else {
    Write-Host "Could not detect a LAN IP. Phone QR codes may still use 127.0.0.1 until you set LOCAL_IP."
}

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

# Start-Process cannot launch the WindowsApps execution alias for wt.exe
# ("The system cannot find the file specified"). Call wt.exe directly and
# pass each flag as its own argument so titles/commands are not treated as a file.
$wtArgs = @(
    "new-tab", "--title", "Blockchain Node", "-d", $blockchain, "--", "powershell.exe", "-NoExit", "-Command", "npm run node",
    ";",
    "new-tab", "--title", "Blockchain State/Deploy", "-d", $blockchain, "--", "powershell.exe", "-NoExit", "-File", (Join-Path $blockchain "restore-or-deploy.ps1"),
    ";",
    "new-tab", "--title", "Face API", "-d", $faceService, "--", "powershell.exe", "-NoExit", "-Command", "python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload",
    ";",
    "new-tab", "--title", "Backend API", "-d", $backend, "--", "powershell.exe", "-NoExit", "-Command", "node server.js",
    ";",
    "new-tab", "--title", "Frontend", "-d", $frontend, "--", "powershell.exe", "-NoExit", "-Command", "npm run dev"
)

& wt.exe @wtArgs

Write-Host "Started SecureVoting in Windows Terminal tabs."
Write-Host "Open http://localhost:3000 after the frontend finishes compiling."
Write-Host "Before stopping the project, run: .\before-stop.ps1"
