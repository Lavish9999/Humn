param(
  [string]$SupabaseProjectRef = 'bondfumehickzmmbfwoe',
  [string]$VercelProject = 'humn-web',
  [string]$VercelScope = 'robbieyisa-8314s-projects',
  [string]$ProductionUrl = 'https://humn-web.vercel.app'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-NpxExecutable {
  if ($env:OS -eq 'Windows_NT') {
    return 'npx.cmd'
  }

  return 'npx'
}

function Invoke-NpxCommand {
  param(
    [Parameter(Mandatory)][string[]]$Arguments,
    [string]$StandardInputPath,
    [switch]$CaptureOutput,
    [string]$FailureMessage = 'The command failed.'
  )

  $stdoutPath = [IO.Path]::GetTempFileName()
  $stderrPath = [IO.Path]::GetTempFileName()

  try {
    $startParameters = @{
      FilePath = Get-NpxExecutable
      ArgumentList = $Arguments
      Wait = $true
      NoNewWindow = $true
      PassThru = $true
      RedirectStandardOutput = $stdoutPath
      RedirectStandardError = $stderrPath
    }

    if ($StandardInputPath) {
      $startParameters.RedirectStandardInput = $StandardInputPath
    }

    $process = Start-Process @startParameters
    $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { '' }
    $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { '' }

    if ($process.ExitCode -ne 0) {
      $detail = $stderr.Trim()
      if (-not $detail) {
        $detail = $stdout.Trim()
      }

      if ($detail) {
        throw "$FailureMessage`n$detail"
      }

      throw $FailureMessage
    }

    if (-not $CaptureOutput -and $stdout.Trim()) {
      Write-Host $stdout.Trim()
    }

    return $stdout
  }
  finally {
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Convert-CommandJsonToItems {
  param([Parameter(Mandatory)][string]$Json)

  $parsed = $Json | ConvertFrom-Json

  if ($parsed -is [Array]) {
    return @($parsed)
  }

  foreach ($propertyName in @('items', 'projects', 'keys', 'api_keys', 'data')) {
    $property = $parsed.PSObject.Properties[$propertyName]
    if ($null -ne $property -and $null -ne $property.Value) {
      return @($property.Value)
    }
  }

  return @($parsed)
}

function Get-ObjectValue {
  param(
    [Parameter(Mandatory)]$Object,
    [Parameter(Mandatory)][string[]]$Names
  )

  foreach ($name in $Names) {
    $property = $Object.PSObject.Properties[$name]
    if ($null -ne $property -and $null -ne $property.Value) {
      $value = [string]$property.Value
      if (-not [string]::IsNullOrWhiteSpace($value)) {
        return $value
      }
    }
  }

  return $null
}

function Find-ApiKey {
  param(
    [Parameter(Mandatory)][object[]]$Items,
    [Parameter(Mandatory)][string[]]$PreferredLabels
  )

  foreach ($preferredLabel in $PreferredLabels) {
    foreach ($item in $Items) {
      $labelParts = @(
        (Get-ObjectValue -Object $item -Names @('name')),
        (Get-ObjectValue -Object $item -Names @('type')),
        (Get-ObjectValue -Object $item -Names @('role'))
      ) | Where-Object { $_ }

      $normalizedLabels = @($labelParts | ForEach-Object { $_.ToLowerInvariant().Replace('-', '_') })
      $normalizedPreferred = $preferredLabel.ToLowerInvariant().Replace('-', '_')
      $matches = $normalizedLabels | Where-Object {
        $_ -eq $normalizedPreferred -or $_ -like "*$normalizedPreferred*"
      }

      if (-not $matches) {
        continue
      }

      $key = Get-ObjectValue -Object $item -Names @('api_key', 'apiKey', 'key', 'value', 'token')
      if ($key) {
        return $key
      }
    }
  }

  return $null
}

function New-RecoverySecret {
  $bytes = New-Object byte[] 48
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()

  try {
    $rng.GetBytes($bytes)
  }
  finally {
    $rng.Dispose()
  }

  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Set-VercelEnvironmentVariable {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Value,
    [Parameter(Mandatory)][ValidateSet('production', 'preview', 'development')][string]$Environment,
    [switch]$Sensitive
  )

  $inputPath = [IO.Path]::GetTempFileName()

  try {
    [IO.File]::WriteAllText($inputPath, $Value, [Text.UTF8Encoding]::new($false))

    $arguments = @(
      '--yes', 'vercel@latest',
      'env', 'add', $Name, $Environment,
      '--force', '--yes',
      '--scope', $VercelScope
    )

    if ($Sensitive) {
      $arguments += '--sensitive'
    }

    $invokeParameters = @{
      Arguments = $arguments
      StandardInputPath = $inputPath
      FailureMessage = "Could not set $Name for the $Environment environment."
    }

    Invoke-NpxCommand @invokeParameters | Out-Null
  }
  finally {
    Remove-Item -LiteralPath $inputPath -Force -ErrorAction SilentlyContinue
  }
}

$repoRoot = (Get-Location).Path
$requiredPaths = @(
  (Join-Path $repoRoot 'package.json'),
  (Join-Path $repoRoot 'apps/web/package.json'),
  (Join-Path $repoRoot 'supabase/config.toml')
)

foreach ($requiredPath in $requiredPaths) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Run this script from the Humn repository root. Missing: $requiredPath"
  }
}

Write-Step 'Checking authenticated Supabase access'
$projectListParameters = @{
  Arguments = @('--yes', 'supabase@latest', 'projects', 'list', '--output', 'json')
  CaptureOutput = $true
  FailureMessage = 'Supabase CLI is not authenticated. Run: npx supabase login'
}
$projectsJson = Invoke-NpxCommand @projectListParameters
$projects = Convert-CommandJsonToItems -Json $projectsJson
$projectMatch = $projects | Where-Object {
  (Get-ObjectValue -Object $_ -Names @('id', 'ref', 'project_ref')) -eq $SupabaseProjectRef
} | Select-Object -First 1

if (-not $projectMatch) {
  throw "The authenticated Supabase account cannot access project $SupabaseProjectRef."
}

Write-Step 'Retrieving Supabase API keys without printing them'
$apiKeyParameters = @{
  Arguments = @('--yes', 'supabase@latest', 'projects', 'api-keys', '--project-ref', $SupabaseProjectRef, '--output', 'json')
  CaptureOutput = $true
  FailureMessage = 'Supabase API keys could not be retrieved.'
}
$apiKeysJson = Invoke-NpxCommand @apiKeyParameters
$apiKeys = Convert-CommandJsonToItems -Json $apiKeysJson
$publishableKey = Find-ApiKey -Items $apiKeys -PreferredLabels @('publishable', 'anon')
$serverKey = Find-ApiKey -Items $apiKeys -PreferredLabels @('service_role', 'service role', 'secret')

if (-not $publishableKey) {
  throw 'No publishable or legacy anon key was returned by Supabase.'
}

if (-not $serverKey) {
  throw 'No secret or legacy service_role key was returned by Supabase.'
}

$recoverySecret = New-RecoverySecret
$supabaseUrl = "https://$SupabaseProjectRef.supabase.co"

Write-Step 'Checking authenticated Vercel access'
$vercelWhoAmIParameters = @{
  Arguments = @('--yes', 'vercel@latest', 'whoami')
  FailureMessage = 'Vercel CLI is not authenticated. Run: npx vercel login'
}
Invoke-NpxCommand @vercelWhoAmIParameters | Out-Null

Write-Step 'Linking this repository to the Humn Vercel project'
$vercelLinkParameters = @{
  Arguments = @('--yes', 'vercel@latest', 'link', '--yes', '--project', $VercelProject, '--scope', $VercelScope)
  FailureMessage = 'Could not link this repository to the humn-web Vercel project.'
}
Invoke-NpxCommand @vercelLinkParameters | Out-Null

$sharedPublicVariables = [ordered]@{
  NEXT_PUBLIC_SUPABASE_URL = $supabaseUrl
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $publishableKey
}

$serverVariables = [ordered]@{
  SUPABASE_SERVICE_ROLE_KEY = $serverKey
  AUTH_RECOVERY_SECRET = $recoverySecret
}

foreach ($environment in @('production', 'preview', 'development')) {
  Write-Step "Writing public Supabase variables to Vercel: $environment"
  foreach ($entry in $sharedPublicVariables.GetEnumerator()) {
    Set-VercelEnvironmentVariable -Name $entry.Key -Value ([string]$entry.Value) -Environment $environment
  }

  Write-Step "Writing protected server variables to Vercel: $environment"
  foreach ($entry in $serverVariables.GetEnumerator()) {
    Set-VercelEnvironmentVariable -Name $entry.Key -Value ([string]$entry.Value) -Environment $environment -Sensitive
  }
}

Write-Step 'Writing the canonical production URL'
Set-VercelEnvironmentVariable -Name 'NEXT_PUBLIC_SITE_URL' -Value $ProductionUrl -Environment 'production'

Write-Step 'Deploying Humn to production with the repaired environment'
$deployParameters = @{
  Arguments = @('--yes', 'vercel@latest', '--prod', '--yes', '--scope', $VercelScope)
  FailureMessage = 'Production deployment failed.'
}
Invoke-NpxCommand @deployParameters | Out-Null

Write-Step 'Checking the live Discover page'
$discoverUrl = "$($ProductionUrl.TrimEnd('/'))/discover"
$response = Invoke-WebRequest -Uri $discoverUrl -UseBasicParsing

if ($response.StatusCode -ne 200) {
  throw "Discover returned HTTP $($response.StatusCode)."
}

if ($response.Content -match 'Discover could not load|Missing public Supabase environment variables') {
  throw 'Deployment completed, but Discover still reports missing Supabase configuration.'
}

Write-Host "`nHumn production configuration is repaired." -ForegroundColor Green
Write-Host "Live Discover: $discoverUrl" -ForegroundColor Green
Write-Host 'No Supabase or Vercel secret values were printed or committed.' -ForegroundColor DarkGray
