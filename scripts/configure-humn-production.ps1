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

function Require-LastExitCode([string]$FailureMessage) {
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
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
        (Get-ObjectValue -Object $item -Names @('role')),
        (Get-ObjectValue -Object $item -Names @('description'))
      ) | Where-Object { $_ }

      $label = ($labelParts -join ' ').ToLowerInvariant()
      if ($label -notlike "*$preferredLabel*") {
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
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Set-VercelEnvironmentVariable {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Value,
    [Parameter(Mandatory)][ValidateSet('production', 'preview', 'development')][string]$Environment,
    [switch]$Sensitive
  )

  $tempPath = [IO.Path]::GetTempFileName()

  try {
    [IO.File]::WriteAllText($tempPath, $Value, [Text.UTF8Encoding]::new($false))

    $arguments = @(
      'vercel', 'env', 'add', $Name, $Environment,
      '--force', '--yes',
      '--cwd', 'apps/web',
      '--scope', $VercelScope
    )

    if ($Sensitive) {
      $arguments += '--sensitive'
    }

    $npxExecutable = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'npx.cmd' } else { 'npx' }
    $process = Start-Process \
      -FilePath $npxExecutable \
      -ArgumentList $arguments \
      -RedirectStandardInput $tempPath \
      -Wait \
      -NoNewWindow \
      -PassThru

    if ($process.ExitCode -ne 0) {
      throw "Could not set $Name for the $Environment environment."
    }
  }
  finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
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
$projectsOutput = & npx --yes supabase@latest projects list --output json 2>&1
Require-LastExitCode 'Supabase CLI is not authenticated. Run: npx supabase login'

$projects = @($projectsOutput | ConvertFrom-Json)
$projectMatch = $projects | Where-Object {
  (Get-ObjectValue -Object $_ -Names @('id', 'ref', 'project_ref')) -eq $SupabaseProjectRef
} | Select-Object -First 1

if (-not $projectMatch) {
  throw "The authenticated Supabase account cannot access project $SupabaseProjectRef."
}

Write-Step 'Retrieving Supabase API keys without printing them'
$apiKeyOutput = & npx --yes supabase@latest projects api-keys --project-ref $SupabaseProjectRef --output json 2>&1
Require-LastExitCode 'Supabase API keys could not be retrieved.'

$apiKeys = @($apiKeyOutput | ConvertFrom-Json)
$publishableKey = Find-ApiKey -Items $apiKeys -PreferredLabels @('publishable', 'anon')
$serverKey = Find-ApiKey -Items $apiKeys -PreferredLabels @('secret', 'service_role', 'service role')

if (-not $publishableKey) {
  throw 'No publishable or legacy anon key was returned by Supabase.'
}

if (-not $serverKey) {
  throw 'No secret or legacy service_role key was returned by Supabase.'
}

$recoverySecret = New-RecoverySecret
$supabaseUrl = "https://$SupabaseProjectRef.supabase.co"

Write-Step 'Checking authenticated Vercel access'
& npx --yes vercel@latest whoami --scope $VercelScope | Out-Null
Require-LastExitCode 'Vercel CLI is not authenticated. Run: npx vercel login'

Write-Step 'Linking the local web workspace to the Humn Vercel project'
& npx --yes vercel@latest link \
  --yes \
  --project $VercelProject \
  --scope $VercelScope \
  --cwd apps/web | Out-Null
Require-LastExitCode 'Could not link apps/web to the humn-web Vercel project.'

$publicVariables = [ordered]@{
  NEXT_PUBLIC_SUPABASE_URL = $supabaseUrl
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $publishableKey
  NEXT_PUBLIC_SITE_URL = $ProductionUrl
}

$serverVariables = [ordered]@{
  SUPABASE_SERVICE_ROLE_KEY = $serverKey
  AUTH_RECOVERY_SECRET = $recoverySecret
}

foreach ($environment in @('production', 'preview', 'development')) {
  Write-Step "Writing public variables to Vercel: $environment"
  foreach ($entry in $publicVariables.GetEnumerator()) {
    Set-VercelEnvironmentVariable \
      -Name $entry.Key \
      -Value ([string]$entry.Value) \
      -Environment $environment
  }

  Write-Step "Writing protected server variables to Vercel: $environment"
  foreach ($entry in $serverVariables.GetEnumerator()) {
    Set-VercelEnvironmentVariable \
      -Name $entry.Key \
      -Value ([string]$entry.Value) \
      -Environment $environment \
      -Sensitive
  }
}

Write-Step 'Deploying Humn to production with the repaired environment'
& npx --yes vercel@latest \
  --prod \
  --yes \
  --cwd apps/web \
  --scope $VercelScope
Require-LastExitCode 'Production deployment failed.'

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
