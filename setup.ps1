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
    npm run setup
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
