param(
    [ValidateSet('dev', 'release', 'check', 'test', 'clean')]
    [string]$Mode = 'dev',
    [switch]$NoTcc
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$app = Join-Path $root 'app'

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Error $msg; exit 1 }

Push-Location $app
try {
    switch ($Mode) {
        'check' {
            Write-Step 'Typechecking TypeScript...'
            npm run typecheck
            Write-Host 'Typecheck passed.' -ForegroundColor Green
        }

        'test' {
            Write-Step 'Running tests...'
            npm run test
        }

        'clean' {
            Write-Step 'Cleaning build artifacts...'
            if (Test-Path 'dist') { Remove-Item -Recurse -Force 'dist' }
            cargo clean --manifest-path src-tauri/Cargo.toml
            Write-Host 'Clean done.' -ForegroundColor Green
        }

        'dev' {
            Write-Step 'Typechecking...'
            npm run typecheck

            if (-not $NoTcc) {
                Write-Step 'Copying TCC...'
                npm run copytcc
            }

            Write-Step 'Starting dev build + Tauri...'
            npx tauri dev
        }

        'release' {
            Write-Step 'Typechecking...'
            npm run typecheck

            Write-Step 'Running tests...'
            npm run test

            if (-not $NoTcc) {
                Write-Step 'Copying TCC...'
                npm run copytcc
            }

            Write-Step 'Building release installer (NSIS)...'
            npx tauri build --bundles nsis
            Write-Host "`nRelease build complete. Installer in src-tauri/gen/..." -ForegroundColor Green
        }
    }
} finally {
    Pop-Location
}
