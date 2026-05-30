param(
    [string]$ApiPort = "4000",
    [string]$CloudflareProject = "semantic-cve"
)

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$ApiUrl = "http://localhost:$ApiPort"
$LogFile = Join-Path $env:TEMP "cloudflared_$(Get-Random).log"
$BuildPassed = $false

Write-Host "=== semantic-cve: deploy via tunnel ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check API
Write-Host "[1/6] Checking API at $ApiUrl ..." -ForegroundColor Yellow
$healthy = $false
try {
    $r = Invoke-WebRequest -Uri "$ApiUrl/api/health" -TimeoutSec 5 -UseBasicParsing
    $healthy = $r.StatusCode -eq 200
} catch {}
if (-not $healthy) {
    Write-Host "  API not reachable. Starting api dev server..." -ForegroundColor DarkYellow
    $apiJob = Start-Job -ScriptBlock { param($d, $p) cmd /c "cd /d `"$d`" && bun run --filter @semantic-cve/api dev" } -ArgumentList $RepoRoot, $ApiPort
    Start-Sleep -Seconds 5
    # check again
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        try { $r = Invoke-WebRequest -Uri "$ApiUrl/api/health" -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200) { $healthy = $true; break } } catch {}
    }
}
if (-not $healthy) { Write-Host "  ERROR: API not responding at $ApiUrl" -ForegroundColor Red; exit 1 }
Write-Host "  API OK" -ForegroundColor Green

# 2. Start cloudflared tunnel, capture URL
Write-Host "[2/6] Starting cloudflared tunnel..." -ForegroundColor Yellow
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c cloudflared tunnel --url $ApiUrl > `"$LogFile`" 2>&1"
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $false
$psi.RedirectStandardError = $false
$cf = [System.Diagnostics.Process]::Start($psi)

$tunnelUrl = $null
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Milliseconds 1000
    if (Test-Path $LogFile) {
        $content = Get-Content -Path $LogFile -Raw -ErrorAction SilentlyContinue
        if ($content) {
            $m = [regex]::Match($content, 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($m.Success) { $tunnelUrl = $m.Value; break }
        }
    }
}
if (-not $tunnelUrl) { Write-Host "  ERROR: failed to get tunnel URL (90s timeout)" -ForegroundColor Red; $cf.Kill(); exit 1 }
Write-Host "  Tunnel: $tunnelUrl" -ForegroundColor Green

# 3. Build with env var
Write-Host "[3/6] Building frontend with tunnel URL..." -ForegroundColor Yellow
$env:NEXT_PUBLIC_API_URL = $tunnelUrl
$buildLog = Join-Path $env:TEMP "scve_build_$(Get-Random).log"
cmd /c "cd /d `"$RepoRoot`" && bun run --filter @semantic-cve/web build > `"$buildLog`" 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  BUILD FAILED. Tail of log:" -ForegroundColor Red
    Get-Content -Path $buildLog -Tail 20
    $cf.Kill()
    exit 1
}
$BuildPassed = $true
Write-Host "  Build OK" -ForegroundColor Green
Remove-Item -LiteralPath "env:NEXT_PUBLIC_API_URL" -ErrorAction SilentlyContinue 2>$null

# 4. Deploy to Cloudflare Pages
Write-Host "[4/5] Deploying to Cloudflare Pages ($CloudflareProject)..." -ForegroundColor Yellow
$deployLog = Join-Path $env:TEMP "scve_deploy_$(Get-Random).log"
cmd /c "cd /d `"$RepoRoot\apps\web`" && bunx wrangler pages deploy out --branch production > `"$deployLog`" 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  DEPLOY FAILED. Tail of log:" -ForegroundColor Red
    Get-Content -Path $deployLog -Tail 20
    $cf.Kill()
    exit 1
}
$deployUrl = $null
$deployContent = Get-Content -Path $deployLog -Raw -ErrorAction SilentlyContinue
if ($deployContent) {
    $dm = [regex]::Match($deployContent, 'https://[a-z0-9-]+\.\w+\.pages\.dev')
    if ($dm.Success) { $deployUrl = $dm.Value }
}
Write-Host "  Deploy OK" -ForegroundColor Green
if ($deployUrl) { Write-Host "  Live at: $deployUrl" -ForegroundColor Cyan }

# 6. Push to GitHub
Write-Host "[5/5] Pushing to GitHub..." -ForegroundColor Yellow
$pushLog = cmd /c "cd /d `"$RepoRoot`" && git add -A && git diff --cached --quiet 2>nul"
if ($LASTEXITCODE -eq 1) {
    $commitMsg = "chore: update deploy config"
    cmd /c "cd /d `"$RepoRoot`" && git commit -m `"$commitMsg`" && git push origin main"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Pushed to GitHub" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: push failed (check git status)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  Nothing to push (clean tree)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Tunnel: $tunnelUrl (keep cloudflared running for site to work)" -ForegroundColor Cyan
if ($deployUrl) { Write-Host "Deployed: $deployUrl" -ForegroundColor Cyan }
Write-Host ""

# Keep cloudflared running
Write-Host "cloudflared tunnel is still running. Press Ctrl+C to stop it, or close the hidden process manually." -ForegroundColor DarkYellow
$cf.WaitForExit()
