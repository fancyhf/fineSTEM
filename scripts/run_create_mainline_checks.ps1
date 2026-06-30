<#
.SYNOPSIS
Run targeted /create regressions.

.DESCRIPTION
Runs backend pytest and frontend Playwright checks for the /create mainline flow.
Maintainer: AI Agent
links: .trae/documents/testing/
#>

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot 'apps\backend'
$frontendTestsDir = Join-Path $projectRoot 'apps\frontend\tests'

$backendApiUrl = 'http://localhost:3200/api/v1'
$frontendBaseUrl = $null
$testDatabaseDirectory = 'D:\data\finestem'
$testDatabasePath = Join-Path $testDatabaseDirectory 'test_finestem.db'

function Write-Step([string]$message) {
    Write-Host ''
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Assert-CommandExists([string]$commandName, [string]$hint) {
    if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        throw "Command not found: $commandName. $hint"
    }
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)]
        [scriptblock]$CommandBlock
    )

    Push-Location $WorkingDirectory
    try {
        & $CommandBlock
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code: $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Test-HttpReady([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -lt 400
    }
    catch {
        return $false
    }
}

if ($BackendOnly -and $FrontendOnly) {
    throw 'Do not use -BackendOnly and -FrontendOnly at the same time.'
}

if (-not $FrontendOnly) {
    Assert-CommandExists 'python' 'Install Python first or add it to PATH.'
}

if (-not $BackendOnly) {
    Assert-CommandExists 'node' 'Install Node.js first or add it to PATH.'
    Push-Location $frontendTestsDir
    try {
        npm exec playwright -- --version | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Playwright is not available in $frontendTestsDir. Run 'npm install' there first."
        }
    }
    finally {
        Pop-Location
    }
}

if (-not $BackendOnly) {
    if (Test-HttpReady 'http://localhost:5184/create') {
        $frontendBaseUrl = 'http://localhost:5184'
    }
    elseif (Test-HttpReady 'http://localhost:5284/create') {
        $frontendBaseUrl = 'http://localhost:5284'
    }
    else {
        throw 'Frontend dev server is not reachable on http://localhost:5184/create or http://localhost:5284/create.'
    }
}

$originalApiUrl = $env:E2E_API_URL
$originalBaseUrl = $env:E2E_BASE_URL
$originalSecretKey = $env:SECRET_KEY
$originalDebug = $env:DEBUG
$originalDatabaseUrl = $env:DATABASE_URL

try {
    if (-not $FrontendOnly) {
        Write-Step "Run backend targeted test: tests/test_projects.py"
        New-Item -ItemType Directory -Path $testDatabaseDirectory -Force | Out-Null
        if (Test-Path $testDatabasePath) {
            Remove-Item $testDatabasePath -Force
        }
        $env:SECRET_KEY = 'test-secret-key-for-automated-testing'
        $env:DEBUG = 'true'
        $env:DATABASE_URL = "sqlite:///$($testDatabasePath -replace '\\', '/')"
        Invoke-CheckedCommand -WorkingDirectory $backendDir -CommandBlock {
            python -m pytest tests/test_projects.py -q
        }
    }

    if (-not $BackendOnly) {
        Write-Step 'Run frontend mainline E2E: create-guided-pbl-mainline.spec.ts'
        $env:E2E_API_URL = $backendApiUrl
        $env:E2E_BASE_URL = $frontendBaseUrl

        Invoke-CheckedCommand -WorkingDirectory $frontendTestsDir -CommandBlock {
            npm exec playwright -- test specs/create-guided-pbl-mainline.spec.ts --project=chromium --reporter=list
        }
    }

    Write-Host ''
    Write-Host 'All targeted checks passed.' -ForegroundColor Green
}
finally {
    $env:E2E_API_URL = $originalApiUrl
    $env:E2E_BASE_URL = $originalBaseUrl
    $env:SECRET_KEY = $originalSecretKey
    $env:DEBUG = $originalDebug
    $env:DATABASE_URL = $originalDatabaseUrl
}
