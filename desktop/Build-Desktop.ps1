param(
    [string]$Dotnet = 'dotnet',
    [ValidateSet('win-arm64','win-x64')][string]$Runtime = 'win-arm64',
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'bin\portable')
)
$ErrorActionPreference = 'Stop'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'
$env:DOTNET_CLI_UI_LANGUAGE = 'en'
$project = Join-Path $PSScriptRoot 'TRIScore.Desktop.csproj'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $sourceRoot 'BUILD-MANIFEST.json') -Raw | ConvertFrom-Json
$htmlHash = (Get-FileHash -LiteralPath (Join-Path $sourceRoot 'TRIScore4_3_InfernoLab.html') -Algorithm SHA256).Hash.ToLower()
if ($htmlHash -ne $manifest.htmlSha256) { throw 'HTML differs from the verified build manifest. Rebuild and test the workbench first.' }
& $Dotnet restore $project --locked-mode
if ($LASTEXITCODE -ne 0) { throw 'Dependency restore failed.' }
$packageRoot = (& $Dotnet msbuild $project -nologo -getProperty:NuGetPackageRoot).Trim()
if ($LASTEXITCODE -ne 0 -or -not $packageRoot) { throw 'Could not locate dependency licenses.' }
$noticeFiles = @(
    "microsoft.netcore.app.runtime.$Runtime\10.0.12\LICENSE.TXT",
    "microsoft.netcore.app.runtime.$Runtime\10.0.12\THIRD-PARTY-NOTICES.TXT",
    "microsoft.windowsdesktop.app.runtime.$Runtime\10.0.12\LICENSE",
    'microsoft.web.webview2\1.0.4258.31\LICENSE.txt',
    'microsoft.web.webview2\1.0.4258.31\NOTICE.txt'
)
$notices = "TRIScore 4.3.3 desktop dependency notices`n.NET 10.0.12 and WebView2 SDK 1.0.4258.31`n`n"
foreach ($noticeFile in $noticeFiles) { $notices += [IO.File]::ReadAllText((Join-Path $packageRoot $noticeFile)) + "`n`n" }
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'THIRD-PARTY-NOTICES.txt'), $notices, (New-Object Text.UTF8Encoding($false)))
& $Dotnet publish $project -c Release -r $Runtime --no-restore -o $OutputDirectory
if ($LASTEXITCODE -ne 0) { throw 'Desktop publish failed.' }
$executable = Join-Path $OutputDirectory "TRIScore_4.3.3_$Runtime.exe"
Get-FileHash -LiteralPath $executable -Algorithm SHA256
Write-Output "Ready: $executable"
