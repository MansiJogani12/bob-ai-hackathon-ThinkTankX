$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "src\backend"
$frontend = Join-Path $root "src\frontend"

if (-not (Test-Path (Join-Path $backend ".venv\Scripts\python.exe"))) {
    throw "Backend is not set up. Run .\setup.ps1 first."
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    throw "Frontend is not set up. Run .\setup.ps1 first."
}

Start-Process powershell.exe -WorkingDirectory $backend -ArgumentList @(
    "-NoExit",
    "-Command",
    "& '.\.venv\Scripts\python.exe' -m uvicorn main:app --reload --port 8000"
)

Start-Process powershell.exe -WorkingDirectory $frontend -ArgumentList @(
    "-NoExit",
    "-Command",
    "npm run dev"
)

Write-Host "Backend: http://localhost:8000"
Write-Host "Frontend: http://localhost:3000"