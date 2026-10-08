param(
    [Parameter(Mandatory = $true)][string]$LayoutPath,
    [Parameter(Mandatory = $true)][string]$ReportDirectory
)
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as administrator using your normal interactive account, then run this script again.'
}
$manifest = Join-Path (Resolve-Path -LiteralPath $LayoutPath).Path 'AppxManifest.xml'
[xml]$xml = Get-Content -LiteralPath $manifest
if ($xml.Package.Identity.Name -ne 'NornsInteractive.realisticminesweeper' -or
    $xml.Package.Identity.Publisher -ne 'CN=57D5F6C5-4C07-4795-B390-4860843E2094') { throw 'Unexpected package identity.' }
Add-AppxPackage -Register $manifest -ForceApplicationShutdown
$package = Get-AppxPackage -Name 'NornsInteractive.realisticminesweeper'
if (!$package) { throw 'Package registration failed. Enable Developer Mode to register the unsigned development layout.' }
$kit = 'C:\Program Files (x86)\Windows Kits\10\App Certification Kit\appcert.exe'
if (!(Test-Path -LiteralPath $kit)) { throw 'Install the Windows App Certification Kit through Windows SDK setup.' }
New-Item -ItemType Directory -Path $ReportDirectory -Force | Out-Null
$report = Join-Path ([IO.Path]::GetFullPath($ReportDirectory)) 'wack-report.xml'
& $kit reset
if ($LASTEXITCODE -ne 0) { throw 'Windows App Certification Kit reset failed.' }
& $kit test -packagefullname $package.PackageFullName -reportoutputpath $report
if ($LASTEXITCODE -ne 0) { throw "Certification tests reported a failure. Review $report and its HTML report." }
Write-Output "Review the certification results: $report"
