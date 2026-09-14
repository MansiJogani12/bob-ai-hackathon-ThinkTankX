$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "src\backend"
$frontend = Join-Path $root "src\frontend"

Set-Location $backend
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    python -m venv .venv
}
& ".venv\Scripts\python.exe" -m pip install -r requirements.txt

Set-Location $frontend
npm install

Write-Host "Setup complete. Run .\start.ps1 from the repository root."