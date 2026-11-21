[CmdletBinding()]
param(
  [ValidateSet("Test", "Apply", "Revert")]
  [string]$Action = "Test",

  [ValidatePattern("^(\d{1,3}\.){3}\d{1,3}$")]
  [string]$Ip = "20.169.109.160"
)

$ErrorActionPreference = "Stop"
$hostsPath = Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
$markerA = "# Starry GitHub routing start"
$markerB = "# Starry GitHub routing end"

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "This action requires an elevated PowerShell window."
  }
}

function Get-ManagedBounds([string[]]$Lines) {
  $first = [Array]::IndexOf($Lines, $markerA)
  $last = [Array]::IndexOf($Lines, $markerB)
  if (($first -lt 0) -ne ($last -lt 0) -or ($first -ge 0 -and $last -lt $first)) {
    throw "The managed hosts block is incomplete. Repair the hosts file manually before retrying."
  }
  return [pscustomobject]@{ First = $first; Last = $last }
}

function Remove-ManagedBlock([string[]]$Lines) {
  $bounds = Get-ManagedBounds $Lines
  if ($bounds.First -lt 0) { return @($Lines) }
  if ($bounds.First -eq 0) {
    if ($bounds.Last + 1 -ge $Lines.Count) { return @() }
    return @($Lines[($bounds.Last + 1)..($Lines.Count - 1)])
  }
  if ($bounds.Last + 1 -ge $Lines.Count) { return @($Lines[0..($bounds.First - 1)]) }
  return @($Lines[0..($bounds.First - 1)] + $Lines[($bounds.Last + 1)..($Lines.Count - 1)])
}

function Test-Route {
  $tcp = Test-NetConnection -ComputerName $Ip -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
  [pscustomobject]@{
    Host = "github.com"
    Ip = $Ip
    Tcp443 = $tcp
    Dns = ((Resolve-DnsName github.com -Type A -ErrorAction SilentlyContinue).IPAddress -join ", ")
  }
}

if ($Action -eq "Test") {
  Test-Route | Format-Table -AutoSize
  $bounds = Get-ManagedBounds @(Get-Content -LiteralPath $hostsPath)
  "ManagedBlockPresent=$($bounds.First -ge 0)"
  exit 0
}

Assert-Administrator
$original = @(Get-Content -LiteralPath $hostsPath)
$withoutManagedBlock = @(Remove-ManagedBlock $original)

if ($Action -eq "Apply") {
  if (-not (Test-NetConnection -ComputerName $Ip -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue)) {
    throw "TCP 443 is not reachable at $Ip; choose another GitHub frontend IP."
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = "$hostsPath.starry-backup-$stamp"
  Copy-Item -LiteralPath $hostsPath -Destination $backupPath

  $managedBlock = @(
    $markerA
    "# Temporary workaround for an unreachable GitHub frontend."
    "# Update or remove this block when GitHub changes IP addresses. Run this script with -Action Revert."
    "$Ip github.com"
    $markerB
  )
  Set-Content -LiteralPath $hostsPath -Value @($withoutManagedBlock + $managedBlock) -Encoding ASCII
  ipconfig /flushdns | Out-Null
  "Applied=$Ip"
  "Backup=$backupPath"
} elseif ($Action -eq "Revert") {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = "$hostsPath.starry-before-revert-$stamp"
  Copy-Item -LiteralPath $hostsPath -Destination $backupPath
  Set-Content -LiteralPath $hostsPath -Value $withoutManagedBlock -Encoding ASCII
  ipconfig /flushdns | Out-Null
  "Reverted"
  "Backup=$backupPath"
}

$response = Invoke-WebRequest -Uri "https://github.com/" -Method Head -UseBasicParsing -TimeoutSec 20
"VerifyStatus=$($response.StatusCode)"
