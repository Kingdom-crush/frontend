$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Out = Join-Path $Root "out"
$Workspace = Join-Path $Root "workspace-smoke-run"
$Engine = (Resolve-Path (Join-Path $Root "..\hdl-checker20260422")).Path
$Frontend = (Resolve-Path (Join-Path $Root "..\demo")).Path

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

function Wait-Http {
    param([string]$Url)
    for ($i = 0; $i -lt 30; $i++) {
        try {
            return Invoke-RestMethod $Url -TimeoutSec 2
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Backend did not become ready: $Url"
}

function Wait-BackendJob {
    param([string]$BaseUrl, [string]$JobId)
    for ($i = 0; $i -lt 240; $i++) {
        $job = (Invoke-RestMethod "$BaseUrl/api/jobs/$JobId").job
        if ($job.status -eq "succeeded" -or $job.status -eq "failed") {
            return $job
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Job timed out: $JobId"
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

& (Join-Path $Root "build.ps1")

$Port = $null
foreach ($Candidate in 18120..18139) {
    if (-not (Test-BackendPort -Port $Candidate)) {
        $Port = $Candidate
        break
    }
}
if (-not $Port) {
    throw "No free smoke-test port found in 18120-18139."
}

$serverJob = Start-Job -ScriptBlock {
    param($RootPath, $OutPath, $EnginePath, $WorkspacePath, $FrontendPath, $PortValue)
    $env:HDL_ENGINE_DIR = $EnginePath
    $env:HDL_WORKSPACE_DIR = $WorkspacePath
    $env:HDL_FRONTEND_DIR = $FrontendPath
    $env:HDL_SOURCE_ROOTS = $RootPath
    $env:HDL_ENGINE_OUTPUT_ENCODING = "GBK"
    $env:HDL_BACKEND_PORT = [string]$PortValue
    Set-Location $RootPath
    java -cp $OutPath com.sunwise.hdlweb.Main
} -ArgumentList $Root, $Out, $Engine, $Workspace, $Frontend, $Port

$BaseUrl = "http://localhost:$Port"
$SmokeRulesetId = $null

try {
    $health = Wait-Http "$BaseUrl/api/health"
    Assert-True ($health.ok -eq $true) "Health check failed."
    Assert-True ($health.frontendExists -eq $true) "Frontend directory is not available."
    Assert-True ($health.engineScriptExists -eq $true) "Engine script is not available."
    Assert-True (@($health.capabilities | Where-Object { $_ -eq "report-templates" }).Count -eq 1) "Report template capability is missing."
    Assert-True (@($health.capabilities | Where-Object { $_ -eq "filesystem-browser" }).Count -eq 1) "Filesystem browser capability is missing."
    Assert-True (@($health.sourceRoots).Count -gt 0) "Source browse roots were not reported."

    $filesystemRoots = Invoke-RestMethod "$BaseUrl/api/filesystem"
    Assert-True (@($filesystemRoots.entries | Where-Object { $_.directory -eq $true }).Count -gt 0) "Filesystem roots were not listed."
    $samplePath = Join-Path $Root "sample-src"
    $encodedSamplePath = [System.Uri]::EscapeDataString($samplePath)
    $sampleBrowse = Invoke-RestMethod "$BaseUrl/api/filesystem?path=$encodedSamplePath"
    Assert-True (@($sampleBrowse.entries | Where-Object { $_.name -eq "top.v" -and $_.kind -eq "hdl" }).Count -eq 1) "Filesystem browser did not list sample HDL file."
    Assert-True ([string]$sampleBrowse.parent -ne "") "Filesystem browser did not return a parent path."

    $templates = Invoke-RestMethod "$BaseUrl/api/report-templates?format=html"
    $defaultTemplate = @($templates.templates | Where-Object { $_.id -eq "default_html" })[0]
    Assert-True ($null -ne $defaultTemplate) "Default HTML report template was not listed."

    $validate = Invoke-RestMethod "$BaseUrl/api/source/validate" -Method Post -ContentType "application/json" -Body '{"sourcePath":"sample-src"}'
    Assert-True ([int]$validate.hdlFileCount -gt 0) "No HDL files were detected in sample-src."

    $rulesetBody = @{
        name = "smoke_ruleset"
        baseRuleset = "new_CAST_Verilog"
        enabledRules = "CID9583,CID9419,CID9509"
        ruleLevels = "CID9583=L002,CID9419=L001,CID9509=L002"
    } | ConvertTo-Json
    $customRuleset = Invoke-RestMethod "$BaseUrl/api/rulesets" -Method Post -ContentType "application/json" -Body $rulesetBody
    $SmokeRulesetId = $customRuleset.ruleset.id
    Assert-True ($customRuleset.ruleset.id -eq "custom_smoke_ruleset") "Custom ruleset id was not created as expected."
    Assert-True (@($customRuleset.rules | Where-Object { $_.enabled -eq $true }).Count -eq 3) "Custom ruleset enabled rule count is incorrect."
    $cid9583 = @($customRuleset.rules | Where-Object { $_.code -eq "CID9583" })[0]
    Assert-True ([string]$cid9583.levelId -eq "L002") "Custom ruleset level override was not persisted."

    $createBody = @{
        name = "smoke_project"
        sourcePath = "sample-src"
        language = "v_vhd"
        ruleset = $customRuleset.ruleset.id
    } | ConvertTo-Json
    $created = Invoke-RestMethod "$BaseUrl/api/projects" -Method Post -ContentType "application/json" -Body $createBody
    $createJob = Wait-BackendJob $BaseUrl $created.job.id
    Assert-True ($createJob.status -eq "succeeded") "Create project failed: $($createJob.message)"

    $sourceTree = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/source-tree"
    Assert-True (@($sourceTree.files | Where-Object { $_.kind -eq "hdl" }).Count -gt 0) "Source tree did not classify HDL files."
    Assert-True ([int]$sourceTree.stats.hdlFileCount -gt 0) "Source stats did not count HDL files."
    Assert-True ([int]$sourceTree.stats.effectiveLoc -gt 0) "Source stats did not count effective LOC."
    Assert-True ([string]$sourceTree.stats.commentRate -match "%$") "Source stats comment rate is missing."
    $firstHdlPath = (@($sourceTree.files | Where-Object { $_.kind -eq "hdl" })[0]).path
    $excludeBody = @{ path = $firstHdlPath; included = "false" } | ConvertTo-Json
    $excludedTree = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/source-selection" -Method Post -ContentType "application/json" -Body $excludeBody
    Assert-True ((@($excludedTree.files | Where-Object { $_.path -eq $firstHdlPath })[0]).included -eq $false) "Source selection exclude was not persisted."
    $includeBody = @{ path = $firstHdlPath; included = "true" } | ConvertTo-Json
    $includedTree = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/source-selection" -Method Post -ContentType "application/json" -Body $includeBody
    Assert-True ((@($includedTree.files | Where-Object { $_.path -eq $firstHdlPath })[0]).included -eq $true) "Source selection include was not persisted."

    $design = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/design-summary"
    Assert-True (@($design.modules).Count -gt 0) "Design summary did not detect modules/entities."
    Assert-True (@($design.hierarchy | Where-Object { $_ -eq "top" }).Count -gt 0) "Design hierarchy did not include top module."

    $updateBody = @{
        name = "smoke_project_saved"
        analyst = "smoke"
        ruleset = $customRuleset.ruleset.id
    } | ConvertTo-Json
    $updated = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)" -Method Post -ContentType "application/json" -Body $updateBody
    Assert-True ($updated.project.name -eq "smoke_project_saved") "Project name update failed."
    Assert-True ($updated.project.analyst -eq "smoke") "Project analyst update failed."

    $analyzeBody = @{ ruleset = $customRuleset.ruleset.id } | ConvertTo-Json
    $analyzed = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/analyze" -Method Post -ContentType "application/json" -Body $analyzeBody
    $analyzeJob = Wait-BackendJob $BaseUrl $analyzed.job.id
    Assert-True ($analyzeJob.status -eq "succeeded") "Analyze failed: $($analyzeJob.message)"
    $analyzeLog = Invoke-RestMethod "$BaseUrl/api/jobs/$($analyzeJob.id)/log"
    Assert-True ($analyzeLog.Contains("source-mirrors")) "Analyze did not refresh project with selected source mirror."

    $results = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/results"
    $violations = @($results.violations)
    Assert-True ($results.available -eq $true) "Results are not available."
    Assert-True ($violations.Count -gt 0) "No violations were parsed."
    Assert-True ([string]$violations[0].category -ne [string]$violations[0].categoryId) "Rule category metadata was not resolved."
    Assert-True ([string]$violations[0].ruleName -ne "") "Rule detail metadata was not resolved."
    Assert-True ([string]$violations[0].ruleId -ne [string]$violations[0].rule) "Rule reference alias was not resolved."
    Assert-True ($results.auditSummary.total -eq $violations.Count) "Audit summary total is incorrect."
    Assert-True ($results.auditSummary.audited -eq 0) "Initial audit summary should be unreviewed."
    Assert-True ($results.auditSummary.unconfirmed -eq $violations.Count) "Initial unconfirmed audit summary is incorrect."

    $pagedResults = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/results?page=1&pageSize=2&sort=line&dir=desc"
    $pagedViolations = @($pagedResults.violations)
    Assert-True ($pagedResults.pagination.pageSize -eq 2) "Result pagination page size was not applied."
    Assert-True ($pagedViolations.Count -eq 2) "Result pagination did not limit rows."
    Assert-True ($pagedResults.pagination.total -eq $violations.Count) "Result pagination total is incorrect."
    Assert-True ($pagedResults.auditSummary.total -eq $violations.Count) "Paged audit summary should keep full total."

    $levelSortedResults = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/results?page=1&pageSize=2&sort=level&dir=asc"
    Assert-True ($levelSortedResults.pagination.sort -eq "level") "Result level sort key was not preserved."
    $categorySortedResults = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/results?page=1&pageSize=2&sort=category&dir=asc"
    Assert-True ($categorySortedResults.pagination.sort -eq "category") "Result category sort key was not preserved."

    $searchedResults = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/results?page=1&pageSize=50&search=R_6_2_7_1_4"
    Assert-True ($searchedResults.pagination.filteredTotal -gt 0) "Result backend search did not match expected rule."
    Assert-True ($searchedResults.auditSummary.filteredTotal -eq $searchedResults.pagination.filteredTotal) "Filtered audit summary total is incorrect."

    $bulkAuditBody = @{
        allMatching = "true"
        status = "violation"
        search = "R_6_2_7_1_4"
        filterStatus = "all"
    } | ConvertTo-Json
    $bulkAudit = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/violations" -Method Post -ContentType "application/json" -Body $bulkAuditBody
    Assert-True ($bulkAudit.updated -eq $searchedResults.pagination.filteredTotal) "Bulk filtered audit update count is incorrect."

    $auditedSearch = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/results?page=1&pageSize=50&search=R_6_2_7_1_4"
    Assert-True (@($auditedSearch.violations | Where-Object { $_.status -eq "violation" }).Count -eq $bulkAudit.updated) "Bulk filtered audit status was not applied."
    Assert-True ($auditedSearch.auditSummary.audited -eq $bulkAudit.updated) "Full audit summary was not updated after bulk audit."
    Assert-True ($auditedSearch.auditSummary.violation -eq $bulkAudit.updated) "Full violation audit summary was not updated after bulk audit."
    Assert-True ($auditedSearch.auditSummary.filteredAudited -eq $bulkAudit.updated) "Filtered audit summary was not updated after bulk audit."
    Assert-True ($auditedSearch.auditSummary.filteredViolation -eq $bulkAudit.updated) "Filtered violation audit summary was not updated after bulk audit."

    $reportBody = @{ format = "html"; template = $defaultTemplate.id } | ConvertTo-Json
    $reported = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/report" -Method Post -ContentType "application/json" -Body $reportBody
    $reportJob = Wait-BackendJob $BaseUrl $reported.job.id
    Assert-True ($reportJob.status -eq "succeeded") "Report generation failed: $($reportJob.message)"
    Assert-True ($reported.template.id -eq $defaultTemplate.id) "Report template response is incorrect."

    $reports = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)/reports"
    $htmlReports = @($reports.files | Where-Object { $_.path -match "\.html?$" })
    Assert-True ($htmlReports.Count -gt 0) "HTML report was not generated."
    Assert-True (@($reports.files | Where-Object { $_.path -eq "report-metadata.json" }).Count -eq 1) "Report metadata file was not generated."

    $reportLog = Invoke-RestMethod "$BaseUrl/api/jobs/$($reportJob.id)/log"
    Assert-True ($reportLog.Contains('$ hdl-checker.bat report')) "Job command line was not persisted."
    Assert-True ($reportLog.Contains("[report-template] default_html")) "Report template was not recorded in job log."
    Assert-True ($reportLog.Contains("Command completed")) "Job completion line was not persisted."
    if ($health.engineDir.Contains("前端")) {
        Assert-True ($reportLog.Contains("前端")) "Engine output encoding check failed."
    }
    Assert-True (-not $reportLog.Contains("ǰ��")) "Job log contains mojibake."
    Assert-True (-not $reportLog.Contains([char]0xfffd)) "Job log contains Unicode replacement characters."

    $rootPage = Invoke-WebRequest "$BaseUrl/" -UseBasicParsing
    Assert-True ($rootPage.Content.Contains("SunwiseHDLChecker Web Demo")) "Static frontend root did not load."

    $reportFileCount = @($reports.files).Count
    $mirrorPath = Join-Path (Join-Path $Workspace "source-mirrors") $created.project.id
    Assert-True (Test-Path $mirrorPath) "Selected source mirror was not created."
    $deletedProject = Invoke-RestMethod "$BaseUrl/api/projects/$($created.project.id)" -Method Delete
    Assert-True ($deletedProject.deleted -eq $true) "Project deletion failed."
    Assert-True (-not (Test-Path $created.project.projectPath)) "Project directory was not removed."
    Assert-True (-not (Test-Path $mirrorPath)) "Selected source mirror was not removed."

    [pscustomobject]@{
        ok = $true
        port = $Port
        projectId = $created.project.id
        violations = $violations.Count
        reportFiles = $reportFileCount
    } | ConvertTo-Json -Depth 5
} finally {
    if ($SmokeRulesetId) {
        try {
            Invoke-RestMethod "$BaseUrl/api/rulesets/$SmokeRulesetId" -Method Delete | Out-Null
        } catch {
        }
    }
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
}
