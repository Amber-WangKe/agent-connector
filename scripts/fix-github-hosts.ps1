[CmdletBinding()]
param(
  [ValidateSet("Test", "Apply", "Revert")]
  [string]$Action = "Test",

  [ValidatePattern("^(\d{1,3}\.){3}\d{1,3}$")]
  [string]$Ip,

  [ValidateRange(500, 10000)]
  [int]$TimeoutMilliseconds = 2500,

  [string[]]$CandidateIp = @(
    "20.6.7.17",
    "20.205.243.166",
    "140.82.112.4",
    "140.82.113.4",
    "140.82.114.4",
    "140.82.116.4"
  )
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

function Get-CandidateIp {
  $candidates = [Collections.Generic.List[string]]::new()
  if ($Ip) { $candidates.Add($Ip) }
  foreach ($server in @("8.8.8.8", "1.1.1.1")) {
    try {
      foreach ($address in (Resolve-DnsName github.com -Type A -Server $server -ErrorAction Stop).IPAddress) {
        if ($address -match "^(\d{1,3}\.){3}\d{1,3}$") { $candidates.Add($address) }
      }
    } catch {}
  }
  foreach ($address in $CandidateIp) {
    if ($address -match "^(\d{1,3}\.){3}\d{1,3}$") { $candidates.Add($address) }
  }
  return @($candidates | Select-Object -Unique)
}

function Test-Tcp443([string]$TargetIp) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $connect = $client.ConnectAsync($TargetIp, 443)
    if (-not $connect.Wait($TimeoutMilliseconds)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Find-ReachableIp {
  foreach ($candidate in Get-CandidateIp) {
    if (Test-Tcp443 $candidate) { return $candidate }
  }
  return $null
}

function Test-Route([string]$TargetIp) {
  [pscustomobject]@{
    Host = "github.com"
    Ip = $TargetIp
    Tcp443 = Test-Tcp443 $TargetIp
    Dns = ((Resolve-DnsName github.com -Type A -ErrorAction SilentlyContinue).IPAddress -join ", ")
  }
}

if ($Action -eq "Test") {
  Get-CandidateIp | ForEach-Object { Test-Route $_ } | Format-Table -AutoSize
  $bounds = Get-ManagedBounds @(Get-Content -LiteralPath $hostsPath)
  "ManagedBlockPresent=$($bounds.First -ge 0)"
  exit 0
}

Assert-Administrator
$original = @(Get-Content -LiteralPath $hostsPath)
$withoutManagedBlock = @(Remove-ManagedBlock $original)

if ($Action -eq "Apply") {
  $targetIp = if ($Ip) { $Ip } else { Find-ReachableIp }
  if (-not $targetIp) { throw "No reachable GitHub frontend IP was found; pass -Ip with a verified address." }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = "$hostsPath.starry-backup-$stamp"
  Copy-Item -LiteralPath $hostsPath -Destination $backupPath

  $managedBlock = @(
    $markerA
    "# Temporary workaround for an unreachable GitHub frontend."
    "# Update or remove this block when GitHub changes IP addresses. Run this script with -Action Revert."
    "$targetIp github.com"
    $markerB
  )
  Set-Content -LiteralPath $hostsPath -Value @($withoutManagedBlock + $managedBlock) -Encoding ASCII
  ipconfig /flushdns | Out-Null
  "Applied=$targetIp"
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
