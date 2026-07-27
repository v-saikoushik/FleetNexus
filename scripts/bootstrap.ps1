# Bootstrap local development on Windows PowerShell.
$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host 'Created .env from .env.example'
}

pnpm install
pnpm docker:up
pnpm prisma:generate

Write-Host 'FleetNexus foundation is ready.'
Write-Host '  Web:  pnpm dev:web'
Write-Host '  API:  pnpm dev:api'
Write-Host '  Both: pnpm dev'
