[CmdletBinding()]
param(
    [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
$packageRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $packageRoot "dist"
}
$packageJson = Get-Content -LiteralPath (Join-Path $packageRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$archiveName = "agent-connector-$($packageJson.version)-win-x64.zip"
$archivePath = Join-Path ([System.IO.Path]::GetFullPath($OutputDirectory)) $archiveName

$tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$staging = [System.IO.Path]::GetFullPath((Join-Path $tempBase ("agent-connector-package-" + [guid]::NewGuid().ToString("N"))))
if (-not $staging.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe temporary package path."
}

$items = @(
    "src",
    "package.json",
    "package-lock.json",
    "agents.example.json",
    ".env.example",
    "start.ps1",
    "setup.ps1",
    "LICENSE",
    "CHANGELOG.md",
    "SECURITY.md",
    "SUPPORT.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "README.md",
    "README.en.md",
    "PRODUCTIZATION.md",
    "QUICKSTART.md",
    "docs",
    "scripts"
)

try {
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    foreach ($item in $items) {
        $source = Join-Path $packageRoot $item
        if (-not (Test-Path -LiteralPath $source)) { throw "Missing package input: $item" }
        Copy-Item -LiteralPath $source -Destination $staging -Recurse
    }

    Push-Location $staging
    try {
        npm ci --omit=dev
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed while building the package." }
    }
    finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $archivePath) -Force | Out-Null
    Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $archivePath -CompressionLevel Optimal -Force
    Write-Host "Package ready: $archivePath" -ForegroundColor Green
}
finally {
    if ((Test-Path -LiteralPath $staging) -and $staging.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
}
