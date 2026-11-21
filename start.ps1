[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
        throw "Node.js 20+ is required."
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw "npm is required. Install Node.js 20 or newer."
    }
    $nodeMajor = [int](& node.exe -p "process.versions.node.split('.')[0]")
    if ($nodeMajor -lt 20) { throw "Node.js 20+ is required. Current major version: $nodeMajor" }
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "node_modules") -PathType Container)) {
        npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
    }

    $envFile = Join-Path $PSScriptRoot ".env"
    if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
        Write-Host "No .env found. Opening the local setup page first." -ForegroundColor Yellow
        npm run setup
        if (Test-Path -LiteralPath $envFile -PathType Leaf) {
            Write-Host "Configuration saved. Close the setup window, then run .\start.ps1 again." -ForegroundColor Green
            exit 0
        }
        throw "Setup was not completed."
    }
    $envText = Get-Content -LiteralPath $envFile -Raw -Encoding UTF8
    if ($envText -match 'AGENT_CONNECTOR_FEISHU_APP_ID=(cli_replace_me|)\s*$' -or $envText -match 'AGENT_CONNECTOR_FEISHU_APP_SECRET=(replace_me|)\s*$') {
        throw "Feishu credentials are not configured. Run .\setup.ps1."
    }

    npm run check
    if ($LASTEXITCODE -ne 0) { throw "Connector configuration is invalid." }

    Write-Host ""
    Write-Host "Starting agent-connector. Stop the Hermes Gateway first if it uses the same Feishu app." -ForegroundColor Yellow
    npm start
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
