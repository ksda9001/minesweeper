param(
    [Parameter(Mandatory = $true)][string]$RuntimePath,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$runtime = (Resolve-Path -LiteralPath $RuntimePath).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
$sdk = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Directory |
    Where-Object { $_.Name -match '^10\.0\.\d+\.0$' -and (Test-Path (Join-Path $_.FullName 'x64\makeappx.exe')) } |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (!$sdk) { throw 'Install the Windows SDK (MakeAppx) first.' }
$runtimeExe = Join-Path $runtime 'msedgewebview2.exe'
if (!(Test-Path -LiteralPath $runtimeExe)) { throw 'RuntimePath must contain the extracted x64 Fixed Version msedgewebview2.exe.' }
$signature = Get-AuthenticodeSignature -LiteralPath $runtimeExe
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') {
    throw 'WebView2 must have a valid Microsoft Authenticode signature.'
}
New-Item -ItemType Directory -Path $output -Force | Out-Null
$stage = Join-Path $output 'package-layout'
if (Test-Path -LiteralPath $stage) { throw 'Use a fresh OutputDirectory; package-layout already exists.' }
$junction = Join-Path $project 'apps\desktop\src-tauri\WebView2'
if (Test-Path -LiteralPath $junction) {
    $link = Get-Item -LiteralPath $junction -Force
    if ($link.LinkType -ne 'Junction' -or @($link.Target)[0] -ne $runtime) { throw 'Existing WebView2 path does not match this runtime; leaving it untouched.' }
} else {
    New-Item -ItemType Junction -Path $junction -Target $runtime | Out-Null
}
Push-Location $project
try {
    & pnpm --dir apps/desktop exec tauri build --no-bundle --config ../../store/tauri.store.conf.json
    if ($LASTEXITCODE -ne 0) { throw 'Tauri Store build failed.' }
    $target = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $project 'apps\desktop\src-tauri\target' }
    $exe = Join-Path $target 'release\realistic-minesweeper.exe'
    New-Item -ItemType Directory -Path (Join-Path $stage 'App'), (Join-Path $stage 'Assets') -Force | Out-Null
    Copy-Item -LiteralPath $exe -Destination (Join-Path $stage 'App\realistic-minesweeper.exe')
    Copy-Item -LiteralPath $runtime -Destination (Join-Path $stage 'App\WebView2') -Recurse
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'AppxManifest.xml') -Destination $stage
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'privacy.md') -Destination (Join-Path $stage 'App\Privacy.md')
    Copy-Item -LiteralPath (Join-Path $project 'ASSETS.md') -Destination (Join-Path $stage 'App\AssetCredits.md')
    Copy-Item -LiteralPath (Join-Path $project 'THIRD_PARTY_LICENSES') -Destination (Join-Path $stage 'App\ThirdPartyLicenses') -Recurse
    & python (Join-Path $PSScriptRoot 'store-assets.py') --package-assets (Join-Path $stage 'Assets')
    if ($LASTEXITCODE -ne 0) { throw 'Store icon export failed.' }
    [xml]$manifest = Get-Content -LiteralPath (Join-Path $stage 'AppxManifest.xml')
    $package = Join-Path $output "realistic-minesweeper-$($manifest.Package.Identity.Version)-x64.msix"
    & (Join-Path $sdk.FullName 'x64\makeappx.exe') pack /d $stage /p $package /h SHA256 /o
    if ($LASTEXITCODE -ne 0) { throw 'MakeAppx validation/packaging failed.' }
    & python (Join-Path $PSScriptRoot 'verify-msix.py') $package
    if ($LASTEXITCODE -ne 0) { throw 'MSIX content verification failed.' }
    Get-FileHash -Algorithm SHA256 -LiteralPath $package | Format-List
} finally {
    Pop-Location
    # The ignored junction is retained as the fixed-runtime build cache.
}
