# push-claude-branches.ps1
# One-shot helper to fetch the four claude/* branches from the local bundle and
# push them to origin. After this runs you can open PRs from the GitHub web UI.
#
# Usage (from inside the repo root):
#   .\push-claude-branches.ps1
#
# Requires: git, authenticated to the rikdingus/poe-hvps-controller remote
# (e.g. via GitHub Desktop, gh, or cached credential manager).

$ErrorActionPreference = 'Stop'

$Bundle = Join-Path $PSScriptRoot 'claude-branches.bundle'
if (-not (Test-Path $Bundle)) {
    Write-Error "Bundle not found at $Bundle"
    exit 1
}

git bundle verify $Bundle | Out-Host

$Branches = @(
    'claude/repo-hygiene',
    'claude/audit-env-improvements',
    'claude/server-reboot-poe-cycle',
    'claude/firmware-safe-boot'
)

foreach ($b in $Branches) {
    Write-Host "`n=== Fetching $b from bundle ===" -ForegroundColor Cyan
    git fetch $Bundle "${b}:${b}"
}

Write-Host "`nLocal branches now available:" -ForegroundColor Green
git branch --list "claude/*"

Write-Host "`nReady to push. Pushing each branch..." -ForegroundColor Cyan
foreach ($b in $Branches) {
    Write-Host "`n--- pushing $b ---" -ForegroundColor Yellow
    git push -u origin $b
}

Write-Host "`nDone. Open PRs at:" -ForegroundColor Green
foreach ($b in $Branches) {
    $url = "https://github.com/rikdingus/poe-hvps-controller/compare/main...$b"
    Write-Host "  $b  ->  $url"
}
Write-Host "`nReminder: claude/firmware-safe-boot is [safety]-tagged -- open it as a DRAFT PR per AGENTS.md." -ForegroundColor Magenta
