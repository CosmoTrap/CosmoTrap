$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$phpDir = Join-Path $projectRoot '.tools/php'
New-Item -ItemType Directory -Force -Path $phpDir | Out-Null
$releases = Invoke-RestMethod 'https://windows.php.net/downloads/releases/releases.json'
$release = $releases.'8.4'.'nts-vs17-x64'.zip
if (-not $release.path -or -not $release.sha256) { throw 'Publication PHP 8.4 Windows introuvable.' }
$archive = Join-Path $phpDir 'php.zip'
Invoke-WebRequest "https://windows.php.net/downloads/releases/$($release.path)" -OutFile $archive
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower() -ne $release.sha256.ToLower()) {
  throw 'Le SHA256 de PHP ne correspond pas : archive non executee.'
}
Expand-Archive -LiteralPath $archive -DestinationPath $phpDir -Force
$ini = @'
[PHP]
extension_dir="ext"
extension=pdo_sqlite
extension=sqlite3
extension=mbstring
extension=openssl
extension=curl
date.timezone=Europe/Paris
display_errors=Off
log_errors=On
'@
$ini | Set-Content -LiteralPath (Join-Path $phpDir 'php.ini') -Encoding ascii
Remove-Item -LiteralPath $archive
& (Join-Path $phpDir 'php.exe') --version
if ($LASTEXITCODE -ne 0) { throw 'PHP ne demarre pas.' }
Write-Output 'PHP portable installe dans .tools/php (aucune modification du PATH systeme).'
