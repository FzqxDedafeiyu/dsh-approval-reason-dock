# Roll back dsh-approval-reason-dock to the known-good 0.1.0 build.
#
# Why: the 0.1.1 session-tracking experiment crashed the DSH web boot on
# 0.2.2. This script restores the published 0.1.0 files, keeps a backup of the
# current state, and (unless -NoEnable) re-adds the bundle to the profile so
# the panel works again after a restart.
#
# Write rules (AGENTS.md section 10):
#   - never use Set-Content -Encoding UTF8 (PowerShell 5.1 writes a BOM and
#     Node's JSON.parse rejects it; that caused the 2026-11-09 boot crash);
#   - always write with [IO.File]::WriteAllText + UTF8Encoding($false) into a
#     temp file, then Move-Item -Force for an atomic replace;
#   - after every write verify: no EF BB BF prefix, Node JSON.parse passes,
#     and the expected bundle count changed exactly once.
#
# Run it with pwsh (PowerShell 7), from a normal terminal (not through the DSH
# agent sandbox, which cannot write into the .dsh data directory):
#
#   pwsh -NoProfile -File rollback-0.1.0.ps1 -SelfTest
#   pwsh -NoProfile -File rollback-0.1.0.ps1 -DryRun
#   pwsh -NoProfile -File rollback-0.1.0.ps1
#   pwsh -NoProfile -File rollback-0.1.0.ps1 -Disable
#
# After a real run: restart DSH, then enable "dsh-approval-reason-dock" in the
# plugin page if it is not enabled automatically.

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$NoEnable,
    [switch]$Disable,
    [switch]$SelfTest,
    [string]$Source,
    [switch]$List
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- guard
# Refuse to run under Windows PowerShell 5.1: relaunch ourselves under pwsh 7
# and forward the original parameters. 5.1 differs in encoding, JSON and
# syntax defaults and already caused a BOM boot crash once.
if ($PSVersionTable.PSVersion.Major -lt 7) {
    $pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
    if ([string]::IsNullOrWhiteSpace($pwsh)) {
        throw 'PowerShell 7 (pwsh) is required. Install PowerShell 7 or run this script with pwsh / runps.'
    }
    Write-Host "detected Windows PowerShell $($PSVersionTable.PSVersion) - relaunching with $pwsh" -ForegroundColor Yellow
    $forward = @()
    foreach ($key in $PSBoundParameters.Keys) {
        $value = $PSBoundParameters[$key]
        if ($value -is [switch]) {
            if ($value.IsPresent) { $forward += "-$key" }
        } elseif ($null -ne $value) {
            $forward += @("-$key", [string]$value)
        }
    }
    $arguments = @('-NoProfile', '-File', $PSCommandPath) + $forward
    $process = Start-Process -FilePath $pwsh -NoNewWindow -Wait -PassThru -ArgumentList $arguments
    exit $process.ExitCode
}

$BundleName = 'dsh-approval-reason-dock'
$ExpectedVersion = '0.1.0'
$DshHome = Join-Path $env:USERPROFILE '.dsh'
$PluginsRoot = Join-Path $DshHome 'plugins'
$PluginDir = Join-Path $PluginsRoot $BundleName
$ProfileFile = Join-Path $DshHome 'profiles\desktop\package.json'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Payload = @(
    'index.js',
    'client.js',
    'cordis.patch.yml',
    'package.json',
    'icon.svg',
    'README.md',
    'README.zh.md',
    'CHANGELOG.md',
    'LICENSE',
    'locale\en.json',
    'locale\zh.json'
)

# ---------------------------------------------------------------- utilities

function Read-JsonFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "missing file: $Path" }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
}

function Find-Node {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $command) { return $command.Source }
    $bundled = Join-Path $DshHome 'dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundled) { return $bundled }
    throw 'node executable not found (needed for JSON validation); install Node.js or pass it on PATH'
}

function Test-NoBom([string]$Path) {
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        return $false
    }
    return $true
}

function Test-JsonWithNode([string]$Path) {
    $node = Find-Node
    $js = 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));'
    & $node -e $js $Path 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Write-JsonNoBom([string]$Path, $Object) {
    $json = $Object | ConvertTo-Json -Depth 20
    $tmp = "$Path.tmp-$Stamp"
    [IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
    if (-not (Test-NoBom $tmp)) {
        Remove-Item -LiteralPath $tmp -Force
        throw "refusing to write BOM-prefixed JSON: $tmp"
    }
    Move-Item -LiteralPath $tmp -Destination $Path -Force
    if (-not (Test-NoBom $Path)) { throw "BOM detected after writing $Path" }
    if (-not (Test-JsonWithNode $Path)) { throw "Node JSON.parse failed after writing $Path" }
}

function Test-GoodSource([string]$Dir) {
    $pkgPath = Join-Path $Dir 'package.json'
    $clientPath = Join-Path $Dir 'client.js'
    if (-not (Test-Path -LiteralPath $pkgPath) -or -not (Test-Path -LiteralPath $clientPath)) { return $false }
    try {
        $pkg = Read-JsonFile $pkgPath
    } catch {
        return $false
    }
    if ($pkg.version -ne $ExpectedVersion) { return $false }
    $source = Get-Content -LiteralPath $clientPath -Raw
    if ($source -match 'ActiveSessionTracker' -or $source -match 'conversation\.header') { return $false }
    if ($source -notmatch 'SUCCESS_HIDE_MS') { return $false }
    return $true
}

function Find-GoodSource {
    $candidates = @()
    if (Test-Path -LiteralPath $PluginsRoot) {
        $candidates = Get-ChildItem -LiteralPath $PluginsRoot -Directory -Filter "$BundleName.bak-*" |
            Sort-Object LastWriteTime -Descending
    }
    foreach ($candidate in $candidates) {
        if (Test-GoodSource $candidate.FullName) { return $candidate.FullName }
    }
    return $null
}

function Write-Header([string]$Text) {
    Write-Host ''
    Write-Host "== $Text ==" -ForegroundColor Cyan
}

# ---------------------------------------------------------------- self test

if ($SelfTest) {
    Write-Host 'Self test: write a temporary JSON the same way the profile is written.'
    $probe = Join-Path $env:TEMP "rollback-selftest-$Stamp.json"
    $sample = [pscustomobject]@{
        name = 'rollback-self-test'
        dsh  = [pscustomobject]@{ profile = [pscustomobject]@{ bundles = @('a', 'b') } }
    }
    Write-JsonNoBom $probe $sample
    $bom = if (Test-NoBom $probe) { 'no' } else { 'YES' }
    $parsed = if (Test-JsonWithNode $probe) { 'ok' } else { 'FAILED' }
    $relative = Join-Path $env:TEMP ('rollback-' + [guid]::NewGuid().ToString('N'))
    Write-Host "  probe       : $probe"
    Write-Host "  BOM prefix  : $bom"
    Write-Host "  Node parse  : $parsed"
    $ok = ($bom -eq 'no' -and $parsed -eq 'ok')
    if (-not $ok) { throw 'self test failed' }
    Remove-Item -LiteralPath $probe -Force
    Write-Host 'Self test passed: BOM-free, Node-parseable, atomic write path works.' -ForegroundColor Green
    exit 0
}

Write-Host "dsh-approval-reason-dock rollback -> $ExpectedVersion"
Write-Host "  plugin dir : $PluginDir"
Write-Host "  profile    : $ProfileFile"
Write-Host "  powershell : $($PSVersionTable.PSVersion) ($($PSVersionTable.PSEdition))"
if ($DryRun) { Write-Host '  mode       : DRY RUN (nothing will be written)' -ForegroundColor Yellow }
if ($Disable) { Write-Host '  mode       : remove from bundles (recovery)' -ForegroundColor Yellow }

Write-Header 'candidate sources'
$backups = @()
if (Test-Path -LiteralPath $PluginsRoot) {
    $backups = Get-ChildItem -LiteralPath $PluginsRoot -Directory -Filter "$BundleName.bak-*" |
        Sort-Object LastWriteTime -Descending
}
foreach ($backup in $backups) {
    $ok = Test-GoodSource $backup.FullName
    $mark = if ($ok) { 'OK  ' } else { 'skip' }
    Write-Host ("  [{0}] {1}  {2}" -f $mark, $backup.LastWriteTime.ToString('yyyy-MM-dd HH:mm'), $backup.FullName)
}
if ($List) { exit 0 }

$sourceDir = $Source
if ([string]::IsNullOrWhiteSpace($sourceDir)) { $sourceDir = Find-GoodSource }
if ([string]::IsNullOrWhiteSpace($sourceDir)) {
    throw "no $ExpectedVersion source found; pass -Source <dir> pointing at a good build"
}
if (-not (Test-GoodSource $sourceDir)) { throw "not a good $ExpectedVersion source: $sourceDir" }
Write-Header 'using source'
Write-Host "  $sourceDir"

Write-Header 'backup current plugin dir'
if (Test-Path -LiteralPath $PluginDir) {
    $backupDir = "$PluginDir.bak-rollback-$Stamp"
    if ($DryRun) {
        Write-Host "  would copy to $backupDir"
    } else {
        Copy-Item -LiteralPath $PluginDir -Destination $backupDir -Recurse -Force
        Write-Host "  copied to $backupDir"
    }
} else {
    Write-Host '  plugin dir absent; nothing to back up'
}

Write-Header 'restore files'
foreach ($relative in $Payload) {
    $from = Join-Path $sourceDir $relative
    $to = Join-Path $PluginDir $relative
    if (-not (Test-Path -LiteralPath $from)) {
        Write-Host "  skip (missing in source): $relative" -ForegroundColor DarkYellow
        continue
    }
    if ($DryRun) {
        Write-Host "  would copy $relative"
    } else {
        $toDir = Split-Path -Parent $to
        if (-not (Test-Path -LiteralPath $toDir)) { New-Item -ItemType Directory -Path $toDir -Force | Out-Null }
        Copy-Item -LiteralPath $from -Destination $to -Force
        Write-Host "  copied $relative"
    }
}

Write-Header 'verify installed payload'
if ($DryRun) {
    Write-Host '  skipped in dry run'
} else {
    if (-not (Test-GoodSource $PluginDir)) {
        throw "restore verification failed: $PluginDir is not a good $ExpectedVersion build"
    }
    Write-Host '  OK: version 0.1.0, no session tracker, SUCCESS_HIDE_MS present' -ForegroundColor Green
}

Write-Header 'profile bundle'
$profile = Read-JsonFile $ProfileFile
$bundles = @($profile.dsh.profile.bundles)
$beforeCount = $bundles.Count
$hasBundle = $bundles -contains $BundleName

if ($Disable) {
    if (-not $hasBundle) {
        Write-Host '  already absent from dsh.profile.bundles'
    } elseif ($DryRun) {
        Write-Host "  would remove $BundleName from dsh.profile.bundles"
    } else {
        Copy-Item -LiteralPath $ProfileFile -Destination "$ProfileFile.bak-rollback-$Stamp" -Force
        $profile.dsh.profile.bundles = @($bundles | Where-Object { $_ -ne $BundleName })
        Write-JsonNoBom $ProfileFile $profile
        $after = @((Read-JsonFile $ProfileFile).dsh.profile.bundles)
        if ($after.Count -ne $beforeCount - 1 -or $after -contains $BundleName) {
            Copy-Item -LiteralPath "$ProfileFile.bak-rollback-$Stamp" -Destination $ProfileFile -Force
            throw 'profile validation failed after removing the bundle; restored the backup'
        }
        Write-Host "  removed $BundleName from dsh.profile.bundles ($beforeCount -> $($after.Count))"
    }
} elseif ($NoEnable) {
    Write-Host '  skipped (-NoEnable)'
} elseif ($hasBundle) {
    Write-Host '  already present in dsh.profile.bundles'
} elseif ($DryRun) {
    Write-Host "  would add $BundleName to dsh.profile.bundles"
} else {
    Copy-Item -LiteralPath $ProfileFile -Destination "$ProfileFile.bak-rollback-$Stamp" -Force
    $profile.dsh.profile.bundles = @($bundles) + $BundleName
    Write-JsonNoBom $ProfileFile $profile
    $after = @((Read-JsonFile $ProfileFile).dsh.profile.bundles)
    if ($after.Count -ne $beforeCount + 1 -or ($after -notcontains $BundleName)) {
        Copy-Item -LiteralPath "$ProfileFile.bak-rollback-$Stamp" -Destination $ProfileFile -Force
        throw 'profile validation failed after adding the bundle; restored the backup'
    }
    Write-Host "  added $BundleName to dsh.profile.bundles ($beforeCount -> $($after.Count))"
}

Write-Header 'next steps'
Write-Host '  1. Restart DSH.'
Write-Host '  2. Open the plugin page and confirm dsh-approval-reason-dock shows 0.1.0.'
Write-Host '  3. Trigger one approval and check the reason panel.'
if ($DryRun) {
    Write-Host ''
    Write-Host 'Dry run finished; rerun without -DryRun to apply.' -ForegroundColor Yellow
}