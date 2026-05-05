# ===================================================================
#  HVPS Project -- Windows Toolchain Setup
#  Installs everything Cowork-Claude AND Google Antigravity need to
#  collaborate on github.com/rikdingus/poe-hvps-controller.
#
#  USAGE (PowerShell, as your normal user -- NOT admin):
#     cd C:\Users\theon\Documents\Claude\Projects\HVPS
#     powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
#
#  Idempotent: each tool is only installed if missing. Re-run anytime.
# ===================================================================

$ErrorActionPreference = 'Continue'  # don't bail on a single failure
$RepoUrl  = 'https://github.com/rikdingus/poe-hvps-controller.git'
$RepoDir  = 'C:\Users\theon\Documents\Claude\Projects\HVPS'

# ----- helpers ------------------------------------------------------
function Test-Cmd($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Install-Pkg($id, $cmd, $label) {
    if (Test-Cmd $cmd) {
        Write-Host "  [OK]   $label already installed ($cmd)" -ForegroundColor Green
        return
    }
    Write-Host "  [...]  Installing $label via winget ($id)" -ForegroundColor Yellow
    winget install --id $id --silent --accept-source-agreements --accept-package-agreements --scope user 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK]   $label installed" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] winget exit $LASTEXITCODE for $label -- may need manual install" -ForegroundColor Red
    }
}

function Header($t) {
    Write-Host ''
    Write-Host "===== $t =====" -ForegroundColor Cyan
}

# ----- preflight ----------------------------------------------------
Header 'Preflight'
if (-not (Test-Cmd winget)) {
    Write-Host '  [FAIL] winget not found. Install "App Installer" from the Microsoft Store first.' -ForegroundColor Red
    exit 1
}
Write-Host "  [OK]   winget present ($(winget --version))" -ForegroundColor Green

# ----- core tools ---------------------------------------------------
Header 'Core: Git + GitHub CLI'
Install-Pkg 'Git.Git'              'git' 'Git'
Install-Pkg 'GitHub.cli'           'gh'  'GitHub CLI'

Header 'Python 3 + uv'
Install-Pkg 'Python.Python.3.12'   'python' 'Python 3.12'
Install-Pkg 'astral-sh.uv'         'uv'     'uv (fast Python pkg manager)'

Header 'Node.js + pnpm'
Install-Pkg 'OpenJS.NodeJS.LTS'    'node'  'Node.js LTS'
Install-Pkg 'pnpm.pnpm'            'pnpm'  'pnpm'

Header 'Docker Desktop'
if (Test-Cmd docker) {
    Write-Host '  [OK]   docker already installed' -ForegroundColor Green
} else {
    Write-Host '  [...]  Installing Docker Desktop (large download -- may take a while)' -ForegroundColor Yellow
    winget install --id Docker.DockerDesktop --silent --accept-source-agreements --accept-package-agreements 2>&1 | Out-Null
    Write-Host '  [NOTE] Docker Desktop requires a one-time launch + WSL2 setup. Open it from the Start Menu after this script finishes.' -ForegroundColor Yellow
}

Header 'PlatformIO Core (ESP32 toolchain)'
# Refresh PATH so we see python/pip from this same shell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
if (Test-Cmd pio) {
    Write-Host '  [OK]   PlatformIO Core already installed' -ForegroundColor Green
} elseif (Test-Cmd python) {
    Write-Host '  [...]  Installing PlatformIO via pip --user' -ForegroundColor Yellow
    python -m pip install --user --upgrade platformio 2>&1 | Out-Null
    Write-Host '  [NOTE] Add this to your PATH if "pio" is not found:' -ForegroundColor Yellow
    Write-Host '         %APPDATA%\Python\Python312\Scripts' -ForegroundColor Yellow
} else {
    Write-Host '  [SKIP] python not on PATH yet -- open a new terminal and re-run this script' -ForegroundColor Red
}

# ----- antigravity-friendly nice-to-haves --------------------------
Header 'Nice-to-haves'
Install-Pkg 'jqlang.jq'            'jq'        'jq (JSON CLI)'
Install-Pkg 'sharkdp.bat'          'bat'       'bat (cat++)'
Install-Pkg 'BurntSushi.ripgrep.MSVC' 'rg'     'ripgrep'
Install-Pkg 'sharkdp.fd'           'fd'        'fd (find++)'

# ----- repo -----------------------------------------------------------
Header "Repository: $RepoUrl"
if (-not (Test-Cmd git)) {
    Write-Host '  [SKIP] git not on PATH yet -- open a NEW PowerShell window and re-run this script for the clone step' -ForegroundColor Red
} elseif (Test-Path (Join-Path $RepoDir '.git\HEAD')) {
    Write-Host "  [OK]   Repo already initialised at $RepoDir" -ForegroundColor Green
    Push-Location $RepoDir
    git fetch --all 2>&1 | Out-Null
    git status -sb
    Pop-Location
} else {
    # Some sandboxed processes left a broken .git dir behind -- nuke it first.
    if (Test-Path (Join-Path $RepoDir '.git')) {
        Write-Host '  [...]  Removing partial .git/ from previous setup attempt' -ForegroundColor Yellow
        Remove-Item -Recurse -Force (Join-Path $RepoDir '.git') -ErrorAction SilentlyContinue
    }
    Write-Host "  [...]  Cloning into $RepoDir" -ForegroundColor Yellow
    # Clone into a temp dir then move contents in (so we don't fight with
    # files we already wrote: AGENTS.md, .antigravity/, etc.)
    $tmp = Join-Path $env:TEMP "hvps-clone-$(Get-Random)"
    git clone $RepoUrl $tmp
    if ($LASTEXITCODE -eq 0) {
        # Move .git over
        Move-Item (Join-Path $tmp '.git') (Join-Path $RepoDir '.git')
        # Copy any files from the clone that don't already exist locally
        Get-ChildItem -Path $tmp -Force | ForEach-Object {
            $dest = Join-Path $RepoDir $_.Name
            if (-not (Test-Path $dest)) {
                Move-Item $_.FullName $dest
            }
        }
        Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
        Push-Location $RepoDir
        Write-Host '  [OK]   Clone complete. Local files we pre-wrote are preserved as untracked changes:' -ForegroundColor Green
        git status -sb
        Pop-Location
    } else {
        Write-Host "  [FAIL] git clone exited $LASTEXITCODE" -ForegroundColor Red
    }
}

# ----- summary --------------------------------------------------------
Header 'Summary'
$tools = @(
    @{cmd='git';    name='Git'},
    @{cmd='gh';     name='GitHub CLI'},
    @{cmd='python'; name='Python'},
    @{cmd='uv';     name='uv'},
    @{cmd='node';   name='Node'},
    @{cmd='pnpm';   name='pnpm'},
    @{cmd='docker'; name='Docker'},
    @{cmd='pio';    name='PlatformIO'},
    @{cmd='jq';     name='jq'},
    @{cmd='rg';     name='ripgrep'}
)
foreach ($t in $tools) {
    $status = if (Test-Cmd $t.cmd) { '[OK]  ' } else { '[MISS]' }
    $color  = if (Test-Cmd $t.cmd) { 'Green' } else { 'Red' }
    Write-Host ("  {0} {1}" -f $status, $t.name) -ForegroundColor $color
}

Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Cyan
Write-Host '  1. Open a NEW PowerShell window so PATH updates take effect.'
Write-Host '  2. Run:  gh auth login        (one-time GitHub auth for both agents)'
Write-Host '  3. Open the repo folder in Antigravity:  antigravity .'
Write-Host '  4. Antigravity will auto-load AGENTS.md + .antigravity/rules.md.'
Write-Host ''
