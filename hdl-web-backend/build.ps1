$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Src = Join-Path $Root "src"
$Out = Join-Path $Root "out"

if (Test-Path $Out) {
    Remove-Item -LiteralPath $Out -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$Sources = Get-ChildItem -Path $Src -Recurse -Filter *.java | ForEach-Object { $_.FullName }
if (-not $Sources) {
    throw "No Java sources found under $Src"
}

javac -encoding UTF-8 -d $Out $Sources
Write-Host "Build completed: $Out"
