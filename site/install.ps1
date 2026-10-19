# gitmoire installer for Windows (x64).
#
#   irm https://gitmoire.dev/install.ps1 | iex
#
# Env: $env:GITMOIRE_VERSION = '0.10.1'   pin a version (default: latest published release)
#      $env:GITMOIRE_DRY_RUN = '1'        print what would happen, change nothing
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # the progress bar makes Windows PowerShell 5.1 downloads crawl
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$repo = 'dark-magic-studios/gitmoire-releases'
$dry = $env:GITMOIRE_DRY_RUN -eq '1'

if (-not [Environment]::Is64BitOperatingSystem) { throw 'Only x64 Windows builds are published.' }

$api = if ($env:GITMOIRE_VERSION) { "https://api.github.com/repos/$repo/releases/tags/v$($env:GITMOIRE_VERSION.TrimStart('v'))" }
       else { "https://api.github.com/repos/$repo/releases/latest" }
$release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'gitmoire-install' }
$version = $release.tag_name.TrimStart('v')
Write-Host "==> gitmoire v$version"

$name = "gitmoire_${version}_x64-setup.exe"
$asset = $release.assets | Where-Object name -eq $name
if (-not $asset) { throw "$name is not part of release v$version." }

$file = Join-Path $env:TEMP $name
Write-Host "==> downloading $name"
if ($dry) { Write-Host "[dry-run] $($asset.browser_download_url) -> $file"; return }

Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $file -UseBasicParsing
if ($asset.digest -match '^sha256:(.+)$') {
  if ((Get-FileHash $file -Algorithm SHA256).Hash -ne $Matches[1]) { Remove-Item $file; throw "Checksum mismatch for $name." }
} else {
  Write-Host 'warning: no published checksum, skipping verification'
}

Write-Host '==> running the installer'
Start-Process -FilePath $file -Wait
Remove-Item $file -ErrorAction SilentlyContinue
Write-Host "==> done. Run 'gitmoire' in a repository (short alias: 'gitmo')."
