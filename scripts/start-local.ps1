$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
npm.cmd run local
if ($LASTEXITCODE -ne 0) { Write-Host 'Le lancement a echoue. Voir les erreurs ci-dessus.' -ForegroundColor Red }
