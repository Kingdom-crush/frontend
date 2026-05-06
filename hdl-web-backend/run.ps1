$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Out = Join-Path $Root "out"
$LastPortFile = Join-Path $Root "last-port.txt"
$PortWasProvided = -not [string]::IsNullOrWhiteSpace($env:HDL_BACKEND_PORT)

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

if (-not (Test-Path (Join-Path $Out "com\sunwise\hdlweb\Main.class"))) {
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
