$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Out = Join-Path $Root "out"
$LastPortFile = Join-Path $Root "last-port.txt"
$PortWasProvided = -not [string]::IsNullOrWhiteSpace($env:HDL_BACKEND_PORT)

function Get-JavaFeatureVersion {
    # Use cmd to merge stderr into stdout at the OS level, otherwise PowerShell 5.1
    # wraps each stderr line from java.exe as a NativeCommandError ErrorRecord and
    # the script-level $ErrorActionPreference="Stop" aborts before we can parse it.
    $versionOutput = & cmd /c "java -version 2>&1"
    if ($LASTEXITCODE -ne 0) {
        throw "java -version failed. Ensure Java is installed and available on PATH."
    }

    foreach ($line in $versionOutput) {
        if ($line -match 'version "(?<version>[^"]+)"') {
            $rawVersion = $Matches.version
            if ($rawVersion.StartsWith("1.")) {
                return [int]($rawVersion.Split('.')[1])
            }
            return [int]($rawVersion.Split('.')[0])
        }
    }

    throw "Unable to determine Java feature version from java -version output."
}

function Get-ClassFileMajorVersion {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $null
    }

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 8) {
        throw "Class file is too short: $Path"
    }

    return ($bytes[6] -shl 8) -bor $bytes[7]
}

function Test-BackendPort {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(300)) {
            return $false
        }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Test-NeedsBuild {
    $mainClass = Join-Path $Out "com\sunwise\hdlweb\Main.class"
    if (-not (Test-Path $mainClass)) {
        return $true
    }

    $runtimeFeature = Get-JavaFeatureVersion
    $maxSupportedClassMajor = $runtimeFeature + 44
    $compiledClassMajor = Get-ClassFileMajorVersion -Path $mainClass
    if ($compiledClassMajor -gt $maxSupportedClassMajor) {
        Write-Host "Existing classes target Java $($compiledClassMajor - 44), but current runtime is Java $runtimeFeature. Rebuilding..."
        return $true
    }

    $mainClassWriteTime = (Get-Item $mainClass).LastWriteTimeUtc
    $newestSource = Get-ChildItem -Path (Join-Path $Root "src") -Recurse -Filter *.java |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
    if ($newestSource -and $newestSource.LastWriteTimeUtc -gt $mainClassWriteTime) {
        Write-Host "Java sources are newer than compiled output. Rebuilding..."
        return $true
    }

    return $false
}

if (Test-NeedsBuild) {
    & (Join-Path $Root "build.ps1")
}

if (-not $env:HDL_ENGINE_DIR) {
    $env:HDL_ENGINE_DIR = (Resolve-Path (Join-Path $Root "..\hdl-checker20260422")).Path
}

if (-not $env:HDL_WORKSPACE_DIR) {
    $env:HDL_WORKSPACE_DIR = (Join-Path $Root "workspace")
}

if (-not $env:HDL_FRONTEND_DIR) {
    $env:HDL_FRONTEND_DIR = (Resolve-Path (Join-Path $Root "..\demo")).Path
}

if (-not $env:HDL_ENGINE_OUTPUT_ENCODING) {
    $env:HDL_ENGINE_OUTPUT_ENCODING = "GBK"
}

if (-not $env:HDL_BACKEND_PORT) {
    $env:HDL_BACKEND_PORT = "18080"
}

if (Test-BackendPort -Port ([int]$env:HDL_BACKEND_PORT)) {
    if ($PortWasProvided) {
        Write-Host "Port $env:HDL_BACKEND_PORT is already in use."
        Write-Host "Root:   http://localhost:$env:HDL_BACKEND_PORT/"
        Write-Host "Health: http://localhost:$env:HDL_BACKEND_PORT/api/health"
        Write-Host "Stop the existing process or set a different HDL_BACKEND_PORT."
        exit 0
    }

    $FoundPort = $null
    foreach ($Candidate in 18081..18099) {
        if (-not (Test-BackendPort -Port $Candidate)) {
            $FoundPort = $Candidate
            break
        }
    }
    if (-not $FoundPort) {
        throw "Default port 18080 is occupied and no free fallback port was found in 18081-18099."
    }
    Write-Host "Port 18080 is already in use. Starting this backend on $FoundPort instead."
    $env:HDL_BACKEND_PORT = [string]$FoundPort
}

Write-Host "Starting HDL Web Backend..."
Write-Host "Root:   http://localhost:$env:HDL_BACKEND_PORT/"
Write-Host "Health: http://localhost:$env:HDL_BACKEND_PORT/api/health"
Write-Host "Engine: $env:HDL_ENGINE_DIR"
Write-Host "Workspace: $env:HDL_WORKSPACE_DIR"
Write-Host "Frontend: $env:HDL_FRONTEND_DIR"
Write-Host "Engine output encoding: $env:HDL_ENGINE_OUTPUT_ENCODING"
Set-Content -LiteralPath $LastPortFile -Value $env:HDL_BACKEND_PORT -Encoding ASCII

java -cp $Out com.sunwise.hdlweb.Main
