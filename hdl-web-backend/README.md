# HDL Web Backend

This is a lightweight B/S wrapper around the current command-line HDL checker package in `../hdl-checker20260422`.

It intentionally uses only the JDK HTTP server, with no Maven/Gradle or external dependencies, so it can run in the current delivery environment first. The storage layer is file-based and can be replaced with a database later.

## Run

Requirements:

- JDK 17+.
- `../hdl-checker20260422/hdl-checker.bat` exists.

```powershell
cd C:\Users\Administrator\Desktop\前端
.\hdl-web-backend\build.ps1
.\hdl-web-backend\run.ps1
```

For double-click startup on Windows, use:

```text
hdl-web-backend\run-backend.bat
```

The `.bat` launcher keeps the window open when the port is already occupied or startup fails, so the error message can be read.

Run the repeatable smoke test before handing a build to someone else:

```powershell
.\hdl-web-backend\smoke-test.ps1
```

It builds the backend, starts a temporary local server, validates `sample-src`, creates a project, runs analysis, reads parsed results, generates an HTML report, checks task-log encoding, and verifies the frontend is served from `/`.

Default URL:

```text
http://localhost:18080
```

If `18080` is already occupied and `HDL_BACKEND_PORT` was not explicitly set, `run.ps1` automatically tries `18081-18099` and prints the selected port.

The backend serves the frontend from the root URL:

```text
http://localhost:18080/
```

Use this URL for the actual health check:

```text
http://localhost:18080/api/health
```

Environment variables:

- `HDL_BACKEND_PORT`: server port, default `18080`.
- `HDL_ENGINE_DIR`: engine directory, default `../hdl-checker20260422`.
- `HDL_WORKSPACE_DIR`: backend workspace, default `./workspace` under this backend directory.
- `HDL_FRONTEND_DIR`: frontend static directory, default `../demo`.
- `HDL_SOURCE_ROOTS`: semicolon-separated server directories that the frontend is allowed to browse when selecting source code, default current backend directory plus the workspace directory.
- `HDL_ENGINE_OUTPUT_ENCODING`: command-line output encoding from the engine, default `GBK` on Windows and `UTF-8` elsewhere.

Example:

```powershell
$env:HDL_BACKEND_PORT = "18081"
$env:HDL_ENGINE_DIR = "D:\tools\hdl-checker20260422"
$env:HDL_WORKSPACE_DIR = "D:\hdl-workspace"
$env:HDL_FRONTEND_DIR = "D:\hdl-ui\demo"
$env:HDL_SOURCE_ROOTS = "D:\workspace;\\fileserver\hdl-projects"
$env:HDL_ENGINE_OUTPUT_ENCODING = "GBK"
.\hdl-web-backend\run.ps1
```

## API

Health:

```http
GET /api/health
```

Rulesets:

```http
GET /api/rulesets
GET /api/rulesets/{rulesetId}/rules
POST /api/rulesets
DELETE /api/rulesets/{customRulesetId}
```

The current engine package contains these usable ruleset IDs:

- `new_CAST`
- `new_CAST_Verilog`
- `new_CAST_VHDL`

Create or update a custom ruleset:

```http
POST /api/rulesets
Content-Type: application/json

{
  "name": "smoke_ruleset",
  "baseRuleset": "new_CAST_Verilog",
  "enabledRules": "CID9583,CID9419,CID9509",
  "ruleLevels": "CID9583=一般违规,CID9419=严重违规,CID9509=L002"
}
```

The backend writes an independent XML file under `hdl-checker20260422/rulesets/user/` and registers it in `rulesets.xml`. Reusing the same custom name overwrites the same `custom_<name>.xml` file, which keeps smoke tests and repeated saves deterministic. `ruleLevels` is optional and accepts `L001`/`L002` or Chinese labels containing `严重`/`一般`; the backend writes these values to each rule's `conLevel` and matching priority.

Only custom rulesets whose id starts with `custom_` can be deleted through the API.

Validate source directory before creating a project:

```http
POST /api/source/validate
Content-Type: application/json

{
  "sourcePath": "D:\\workspace\\servo_ctrl\\rtl"
}
```

The response includes `absolutePath`, `directory`, `fileCount`, `hdlFileCount`, and sample HDL files. Project creation rejects missing directories and directories with no `.v`, `.sv`, `.vhd`, or `.vhdl` files.

Browse server source directories for B/S project creation:

```http
GET /api/filesystem
GET /api/filesystem?path=D%3A%5Cworkspace%5Cservo_ctrl
```

The endpoint is read-only and only lists paths under `HDL_SOURCE_ROOTS` plus the backend workspace. Without `path`, it returns the configured roots. With `path`, it returns immediate child entries, a parent path when navigation upward is still inside an allowed root, and lightweight file kinds (`folder`, `hdl`, `constraint`, `file`). This is for choosing server-side folders from the web UI; it does not upload local browser files.

Create project:

```http
POST /api/projects
Content-Type: application/json

{
  "name": "servo_ctrl",
  "sourcePath": "D:\\workspace\\servo_ctrl\\rtl",
  "language": "v_vhd",
  "ruleset": "new_CAST_Verilog"
}
```

This starts an async `create` job and returns `{ project, job }`.

List projects:

```http
GET /api/projects
```

Update project metadata:

```http
POST /api/projects/{projectId}
Content-Type: application/json

{
  "name": "servo_ctrl_saved",
  "analyst": "admin",
  "ruleset": "new_CAST_Verilog"
}
```

Changing `sourcePath` on an existing backend project is intentionally rejected because the current engine writes the source path into its project configuration during `create`. Create a new project when the source directory changes.

Run analysis:

```http
POST /api/projects/{projectId}/analyze
Content-Type: application/json

{
  "ruleset": "new_CAST_Verilog"
}
```

Read job:

```http
GET /api/jobs/{jobId}
GET /api/jobs/{jobId}/log
```

Job summaries are persisted in `jobs.tsv` under the backend workspace. Job logs are persisted under `job-logs/`, so the frontend task center can still show historical tasks after a backend restart.

Read results:

```http
GET /api/projects/{projectId}/results
GET /api/projects/{projectId}/results?page=1&pageSize=100&search=R_6_2&status=all&sort=file&dir=asc
```

The backend parses the new engine output files:

- `analyze-stat.properties`
- `rule-violations.txt`

The `results` endpoint remains backward compatible: without query parameters it returns all parsed rows. With `page` and `pageSize`, it returns a `pagination` object containing `total`, `filteredTotal`, `page`, `pageSize`, and `pageCount`. It also returns `auditSummary`, with full-project counts (`total`, `audited`, `unconfirmed`, `violation`, `notViolation`) and matching-filter counts (`filteredTotal`, `filteredAudited`, `filteredUnconfirmed`, `filteredViolation`, `filteredNotViolation`). Supported sort keys are `file`, `line`, `confidence`/`conf`, `message`/`info`, `note`, `status`, `rule`, `level`/`severity`, and `category`/`cat`.

Update violation audit status:

```http
POST /api/projects/{projectId}/violations
Content-Type: application/json

{
  "ids": "v-xxxx,v-yyyy",
  "status": "violation",
  "note": "checked"
}
```

The `ids` field is comma-separated for explicit row updates. Supported status values are not hard-coded; the frontend can use `violation`, `not_violation`, `unconfirmed`, or Chinese labels if needed.

For backend-filtered bulk audit updates:

```http
POST /api/projects/{projectId}/violations
Content-Type: application/json

{
  "allMatching": "true",
  "status": "violation",
  "search": "R_6_2_7_1_4",
  "filterStatus": "all"
}
```

This updates every result matching the same server-side search/status filter used by the paginated result table, not just the currently visible page.

Source tree and source preview:

```http
GET /api/projects/{projectId}/source-tree
GET /api/projects/{projectId}/source-selection
POST /api/projects/{projectId}/source-selection
GET /api/projects/{projectId}/design-summary
GET /api/projects/{projectId}/files?path=top.v
GET /api/projects/{projectId}/circuit?path=top.v
```

The `source-tree` endpoint returns `files` plus `stats`. Each file includes `kind` (`hdl`, `constraint`, `other`, or `folder`), `included`, and `explicitSelection`. `stats` includes `hdlFileCount`, `constraintFileCount`, `totalLines`, `effectiveLoc`, `commentLines`, and `commentRate`, so the frontend overview can show real source metrics before or after analysis.

`source-selection` persists project source include/exclude metadata in `source-selection.tsv`. When any source selection exists, analysis first builds `source-mirrors/{projectId}/` under the backend workspace, copies included HDL/constraint files into that mirror, refreshes the engine project with `hdl-checker.bat create -s source-mirrors/{projectId} ...`, and then runs `analyze`.

```json
{
  "path": "rtl/top.v",
  "included": "false"
}
```

The `design-summary` endpoint performs a lightweight HDL scan and returns detected modules/entities, simple hierarchy lines, instances, and likely IP/black-box rows. It is intentionally best-effort and does not replace a full elaboration engine.

The `circuit` endpoint returns the generated sibling JSON file, for example `top.json` for `top.v`, when the engine has produced it.

Generate report:

```http
GET /api/report-templates?format=html
POST /api/projects/{projectId}/report
Content-Type: application/json

{
  "format": "html",
  "template": "default_html"
}
```

The backend always exposes a built-in `default_html` template and also scans `report-templates/` under the engine directory and backend workspace. The selected template is recorded in the report job log and `report/report-metadata.json`. The current engine package only documents HTML report output, so template selection is recorded server-side but not yet passed to a report-rendering plugin. Word/PDF/Excel/WPS should stay disabled or show "not supported by backend yet" until the engine supports them.

List and open report files:

```http
GET /api/projects/{projectId}/reports
GET /api/projects/{projectId}/reports/file?path=report.html
```

## Current Boundaries

- Browser clients cannot directly pass a local PC path to a remote server unless that path exists on the server. The current UI now supports browsing configured server-side source roots through `HDL_SOURCE_ROOTS`; source upload or a shared workspace convention is still needed when engineers keep code only on their own PC.
- Async progress is currently coarse-grained because the engine only streams log lines, not structured progress events.
- Violation audit state is stored in `violation-audits.tsv` in each project directory. This is enough for a demo and can be migrated to a DB later.
- Report formats other than HTML are blocked intentionally because the provided engine command only documents `-f html`.
