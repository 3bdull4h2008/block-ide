# G0 Phase-Gate Runner skeleton (B2S discipline, PLAN.md)
# Exit 0 only when every ENFORCED gate passes. Gates join as phases activate.
param(
    [switch]$SkipWasm
)
# Continue (not Stop): PS 5.1 turns native stderr output into error records
# under 'Stop', killing the script on harmless cargo warnings. Verdicts come
# from $LASTEXITCODE only.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$gatesDir = Join-Path $repo 'build\gates'
New-Item -ItemType Directory -Force -Path $gatesDir | Out-Null
$results = [System.Collections.Generic.List[object]]::new()

function Add-Gate {
    param([string]$Id, [bool]$Pass, [hashtable]$Metrics)
    $results.Add([ordered]@{ id = $Id; status = 'enforced'; pass = $Pass; metrics = $Metrics })
    if ($Pass) { Write-Host "[PASS] $Id" -ForegroundColor Green }
    else { Write-Host "[FAIL] $Id" -ForegroundColor Red }
}

# ------------------------------------------------------------- G-BUILD (rust core)
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
Push-Location (Join-Path $repo 'crates\core-parser')
cargo test --quiet 2>&1 | Tee-Object -Variable testOut | Out-Null
Add-Gate -Id 'G-BUILD' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ exitCode = $LASTEXITCODE }
Pop-Location

# --------------------------------------------------------- G-ROUNDTRIP (corpus)
Push-Location $repo
cargo run -q -p core-parser --bin roundtrip_validator 2>&1 | Tee-Object -Variable rtOut | Out-Null
$rtOk = ($LASTEXITCODE -eq 0)
Add-Gate -Id 'G-ROUNDTRIP' -Pass $rtOk -Metrics @{ output = ($rtOut | Select-Object -Last 1) }
Pop-Location

# ------------------------------------------------------- G-SYNC-FUZZ (@P0.5)
# release-only: ~90 s optimized vs many minutes in debug (14k parse+canon rounds)
cargo run -q --release -p core-parser --bin sync_fuzz_validator 2>&1 | Tee-Object -Variable sfOut | Out-Null
Add-Gate -Id 'G-SYNC-FUZZ' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($sfOut | Select-Object -Last 1) }

# ------------------------------------------------------- G-EDIT-E2E (vitest)
Push-Location (Join-Path $repo 'app')
npx vitest run 2>&1 | Tee-Object -Variable e2eOut | Out-Null
Add-Gate -Id 'G-EDIT-E2E' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($e2eOut | Select-Object -Last 1) }
Pop-Location

# -------------------------------------------------------- G-DIAG-MAP (@P2)
cargo run -q -p core-parser --bin diag_map_validator 2>&1 | Tee-Object -Variable dmOut | Out-Null
Add-Gate -Id 'G-DIAG-MAP' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($dmOut | Select-Object -Last 1) }

# -------------------------------------------------- G-SANDBOX-ESCAPE (@P2)
cargo run -q -p runner --bin sandbox_escape_validator 2>&1 | Tee-Object -Variable seOut | Out-Null
Add-Gate -Id 'G-SANDBOX-ESCAPE' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($seOut | Select-Object -Last 1) }

# ------------------------------------------------------ G-RUN-HELLO (@P2)
cargo run -q -p runner --bin run_hello_bench 2>&1 | Tee-Object -Variable rhOut | Out-Null
Add-Gate -Id 'G-RUN-HELLO' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($rhOut | Select-Object -Last 1) }

# ------------------------------------------------------- G-STAGE-DET (@P3)
cargo run -q -p runner --bin stage_determinism_validator 2>&1 | Tee-Object -Variable stOut | Out-Null
Add-Gate -Id 'G-STAGE-DET' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($stOut | Select-Object -Last 1) }

# ------------------------------------------------------ G-STAGE-FPS (@P3)
cargo run -q -p runner --bin stage_fps_validator 2>&1 | Tee-Object -Variable fpOut | Out-Null
Add-Gate -Id 'G-STAGE-FPS' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($fpOut | Select-Object -Last 1) }

# -------------------------------------------------------- G-MEMTRACE (@P3)
cargo run -q -p runner --bin memtrace_soak_validator 2>&1 | Tee-Object -Variable mtOut | Out-Null
Add-Gate -Id 'G-MEMTRACE' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($mtOut | Select-Object -Last 1) }

# ------------------------------------------------------- G-MEMVIEW (@P3)
cargo run -q -p runner --bin memview_validator 2>&1 | Tee-Object -Variable mvOut | Out-Null
Add-Gate -Id 'G-MEMVIEW' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($mvOut | Select-Object -Last 1) }

# ------------------------------------------------------- G-ACADEMY (@P4)
cargo run -q -p runner --bin academy_runner_validator 2>&1 | Tee-Object -Variable acOut | Out-Null
Add-Gate -Id 'G-ACADEMY' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = ($acOut | Select-Object -Last 1) }

# --------------------------------------------------------- G-PERF (@P5)
cargo test -q -p app --test perf 2>&1 | Tee-Object -Variable pfOut | Out-Null
Add-Gate -Id 'G-PERF' -Pass ($LASTEXITCODE -eq 0) -Metrics @{ tail = (($pfOut | Select-String 'G-PERF') | Select-Object -Last 1) }

# ------------------------------------------------------- G-UI-E2E (@P5)
$uiPort = 9339
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$uiPort"
$env:WEBVIEW2_USER_DATA_FOLDER = "$env:TEMP\blockide-uie2e-profile"
$appExe = Join-Path $repo 'target\release\app.exe'
if (-not (Test-Path $appExe)) { $appExe = Join-Path $repo 'target\debug\app.exe' }
$uiProc = Start-Process -FilePath $appExe -PassThru
Start-Sleep -Seconds 8
node (Join-Path $repo 'tools\cdp-uie2e.mjs') $uiPort 2>&1 | Tee-Object -Variable ueOut | Out-Null
$uiExit = $LASTEXITCODE
if (-not $uiProc.HasExited) { Stop-Process -Id $uiProc.Id -Force -ErrorAction SilentlyContinue }
Add-Gate -Id 'G-UI-E2E' -Pass ($uiExit -eq 0) -Metrics @{ tail = ($ueOut | Select-String 'G-UI-E2E'); failures = @($ueOut | Select-String 'FAIL') }

# ------------------------------------------------------------ report + verdict
$report = [ordered]@{
    runAt  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    gates  = $results
}
$outFile = Join-Path $gatesDir ("{0}-gate-report.json" -f (Get-Date -Format 'yyyy-MM-dd'))
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $outFile
Write-Host "report -> $outFile"
if ($results | Where-Object { -not $_.pass }) { exit 1 } else { exit 0 }
