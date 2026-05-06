package com.sunwise.hdlweb;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class WebServer {
    private final Config config;
    private final ProjectStore store;
    private final ViolationAuditStore auditStore;
    private final SourceSelectionStore sourceSelectionStore;
    private final RulesetService rulesets;
    private final ReportTemplateService reportTemplates;
    private final EngineRunner engine;
    private final AnalysisDataService analysis = new AnalysisDataService();

    WebServer(Config config, ProjectStore store, ViolationAuditStore auditStore, SourceSelectionStore sourceSelectionStore, RulesetService rulesets, ReportTemplateService reportTemplates, EngineRunner engine) {
        this.config = config;
        this.store = store;
        this.auditStore = auditStore;
        this.sourceSelectionStore = sourceSelectionStore;
        this.rulesets = rulesets;
        this.reportTemplates = reportTemplates;
        this.engine = engine;
    }

    void start() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(config.port), 0);
        server.createContext("/", this::handle);
        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.start();
        System.out.println("HDL web backend listening on http://localhost:" + config.port);
        System.out.println("Engine dir: " + config.engineDir);
        System.out.println("Workspace dir: " + config.workspaceDir);
        System.out.println("Frontend dir: " + config.frontendDir);
    }

    private void handle(HttpExchange exchange) throws IOException {
        addCors(exchange);
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        try {
            if (isStaticRequest(exchange)) {
                sendStatic(exchange);
                return;
            }
            Object response = route(exchange);
            sendJson(exchange, 200, response);
        } catch (HttpError error) {
            if (!error.alreadySent) {
                sendJson(exchange, error.status, Map.of("error", error.getMessage()));
            }
        } catch (IllegalArgumentException error) {
            sendJson(exchange, 400, Map.of("error", error.getMessage()));
        } catch (Exception error) {
            sendJson(exchange, 500, Map.of("error", error.getMessage() == null ? error.toString() : error.getMessage()));
        } finally {
            exchange.close();
        }
    }

    private Object route(HttpExchange exchange) throws Exception {
        String method = exchange.getRequestMethod().toUpperCase();
        List<String> parts = segments(exchange.getRequestURI().getPath());

        if (parts.isEmpty()) {
            return Map.of(
                "name", "hdl-web-backend",
                "api", "/api/health"
            );
        }
        if (parts.size() < 2 || !"api".equals(parts.get(0))) {
            throw new HttpError(404, "Not found");
        }

        String resource = parts.get(1);
        if ("health".equals(resource) && parts.size() == 2 && "GET".equals(method)) {
            return health();
        }
        if ("rulesets".equals(resource) && "GET".equals(method)) {
            if (parts.size() == 2) {
                return rulesetList();
            }
            if (parts.size() == 4 && "rules".equals(parts.get(3))) {
                return Map.of("rules", rulesets.listRules(parts.get(2)));
            }
        }
        if ("rulesets".equals(resource) && parts.size() == 3 && "DELETE".equals(method)) {
            return Map.of("deleted", rulesets.deleteCustomRuleset(parts.get(2)));
        }
        if ("rulesets".equals(resource) && parts.size() == 2 && "POST".equals(method)) {
            return saveCustomRuleset(exchange);
        }
        if ("report-templates".equals(resource) && parts.size() == 2 && "GET".equals(method)) {
            return reportTemplateList(exchange);
        }
        if ("filesystem".equals(resource) && parts.size() == 2 && "GET".equals(method)) {
            return filesystem(exchange);
        }
        if ("projects".equals(resource)) {
            return projectRoute(exchange, method, parts);
        }
        if ("source".equals(resource) && parts.size() == 3 && "validate".equals(parts.get(2)) && "POST".equals(method)) {
            return validateSource(exchange);
        }
        if ("jobs".equals(resource)) {
            return jobRoute(exchange, method, parts);
        }
        throw new HttpError(404, "Not found");
    }

    private Object health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("apiVersion", 2);
        out.put("port", config.port);
        out.put("engineDir", config.engineDir.toString());
        out.put("workspaceDir", config.workspaceDir.toString());
        out.put("frontendDir", config.frontendDir.toString());
        out.put("engineOutputEncoding", config.engineOutputEncoding);
        out.put("engineScriptExists", Files.exists(config.engineDir.resolve("hdl-checker.bat")));
        out.put("frontendExists", Files.exists(config.frontendDir.resolve("index.html")));
        out.put("sourceRoots", sourceRootsJson());
        out.put("capabilities", List.of("projects", "rulesets", "ruleset-rules", "custom-rulesets", "source-validation", "filesystem-browser", "source-stats", "source-selection", "design-summary", "analysis-jobs", "report-templates", "html-report", "source-preview", "violation-audit", "circuit-json"));
        return out;
    }

    private Object rulesetList() {
        List<Object> rows = new ArrayList<>();
        for (Models.Ruleset ruleset : rulesets.listRulesets()) {
            rows.add(ruleset.toJson());
        }
        return Map.of("rulesets", rows);
    }

    private Object saveCustomRuleset(HttpExchange exchange) throws Exception {
        Map<String, String> body = Json.parseFlatObject(readBody(exchange));
        String name = required(body, "name");
        String baseRuleset = first(body, "baseRuleset", "base", "baseRulesetId");
        Set<String> enabled = csvSet(first(body, "enabledRules", "enabledRuleIds", "rules"));
        Map<String, String> levels = keyValueMap(first(body, "ruleLevels", "levels", "severityOverrides"));
        if (enabled.isEmpty()) {
            throw new HttpError(400, "At least one enabled rule is required");
        }
        Models.Ruleset ruleset = rulesets.saveCustomRuleset(name, baseRuleset, enabled, levels);
        return Map.of("ruleset", ruleset.toJson(), "rules", rulesets.listRules(ruleset.id));
    }

    private Object reportTemplateList(HttpExchange exchange) {
        String format = query(exchange).getOrDefault("format", "");
        List<Object> rows = new ArrayList<>();
        for (Models.ReportTemplate template : reportTemplates.listTemplates(format)) {
            rows.add(template.toJson());
        }
        return Map.of("templates", rows);
    }

    private Object filesystem(HttpExchange exchange) throws IOException {
        String requested = query(exchange).getOrDefault("path", "").trim();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("roots", sourceRootsJson());
        out.put("maxEntries", 500);

        if (requested.isBlank()) {
            out.put("path", "");
            out.put("parent", "");
            out.put("entries", sourceRootEntries());
            return out;
        }

        Path directory = Path.of(requested).toAbsolutePath().normalize();
        if (!isAllowedSourceBrowsePath(directory)) {
            throw new HttpError(403, "Path is outside configured source roots");
        }
        if (!Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS)) {
            throw new HttpError(404, "Path is not a directory: " + requested);
        }

        out.put("path", directory.toString());
        out.put("parent", browseParent(directory));
        out.put("entries", listFilesystemEntries(directory));
        return out;
    }

    private List<Object> sourceRootsJson() {
        List<Object> rows = new ArrayList<>();
        for (Path root : config.sourceRoots) {
            rows.add(filesystemEntry(root, true));
        }
        return rows;
    }

    private List<Object> sourceRootEntries() {
        List<Object> rows = new ArrayList<>();
        for (Path root : config.sourceRoots) {
            Map<String, Object> row = filesystemEntry(root, true);
            row.put("root", true);
            row.put("selectable", Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS));
            rows.add(row);
        }
        return rows;
    }

    private List<Object> listFilesystemEntries(Path directory) throws IOException {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (var stream = Files.list(directory)) {
            stream
                .limit(501)
                .forEach(path -> rows.add(filesystemEntry(path, false)));
        }
        rows.sort(Comparator
            .comparing((Map<String, Object> row) -> !Boolean.TRUE.equals(row.get("directory")))
            .thenComparing(row -> String.valueOf(row.get("name")).toLowerCase(Locale.ROOT)));
        List<Object> out = new ArrayList<>();
        for (int i = 0; i < rows.size() && i < 500; i += 1) {
            out.add(rows.get(i));
        }
        return out;
    }

    private Map<String, Object> filesystemEntry(Path path, boolean rootEntry) {
        Map<String, Object> row = new LinkedHashMap<>();
        Path normalized = path.toAbsolutePath().normalize();
        boolean directory = Files.isDirectory(normalized, LinkOption.NOFOLLOW_LINKS);
        row.put("name", filesystemName(normalized, rootEntry));
        row.put("path", normalized.toString());
        row.put("directory", directory);
        row.put("kind", directory ? "folder" : fileKind(normalized));
        row.put("selectable", directory);
        row.put("exists", Files.exists(normalized, LinkOption.NOFOLLOW_LINKS));
        row.put("readable", Files.isReadable(normalized));
        if (!directory) {
            try {
                BasicFileAttributes attrs = Files.readAttributes(normalized, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
                row.put("size", attrs.size());
            } catch (IOException ex) {
                row.put("size", 0);
            }
        }
        return row;
    }

    private String filesystemName(Path path, boolean rootEntry) {
        if (rootEntry || path.getFileName() == null) {
            return path.toString();
        }
        return path.getFileName().toString();
    }

    private String browseParent(Path directory) {
        Path parent = directory.getParent();
        if (parent == null) {
            return "";
        }
        for (Path root : config.sourceRoots) {
            if (directory.equals(root)) {
                return "";
            }
            if (parent.startsWith(root)) {
                return parent.toString();
            }
        }
        return "";
    }

    private boolean isAllowedSourceBrowsePath(Path path) {
        for (Path root : config.sourceRoots) {
            if (path.startsWith(root)) {
                return true;
            }
        }
        return false;
    }

    private static String fileKind(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (isHdlFile(path)) {
            return "hdl";
        }
        if (name.endsWith(".sdc") || name.endsWith(".xdc") || name.endsWith(".qsf") || name.endsWith(".ucf")) {
            return "constraint";
        }
        return "file";
    }

    private Object projectRoute(HttpExchange exchange, String method, List<String> parts) throws Exception {
        if (parts.size() == 2) {
            if ("GET".equals(method)) {
                List<Object> rows = new ArrayList<>();
                for (Models.Project project : store.listProjects()) {
                    rows.add(project.toJson());
                }
                return Map.of("projects", rows);
            }
            if ("POST".equals(method)) {
                return createProject(exchange);
            }
        }

        String id = parts.size() >= 3 ? parts.get(2) : "";
        Models.Project project = store.findProject(id).orElseThrow(() -> new HttpError(404, "Project not found: " + id));

        if (parts.size() == 3) {
            if ("GET".equals(method)) {
                return Map.of("project", project.toJson());
            }
            if ("POST".equals(method)) {
                return updateProject(exchange, project);
            }
            if ("DELETE".equals(method)) {
                return Map.of("deleted", store.deleteProject(id));
            }
        }

        if (parts.size() == 4) {
            String action = parts.get(3);
            if ("analyze".equals(action) && "POST".equals(method)) {
                return analyzeProject(exchange, project);
            }
            if ("report".equals(action) && "POST".equals(method)) {
                return reportProject(exchange, project);
            }
            if ("results".equals(action) && "GET".equals(method)) {
                return analysis.readResults(project, auditStore.list(project), rulesets.metadata(project.ruleset), resultQuery(exchange));
            }
            if ("audits".equals(action) && "GET".equals(method)) {
                return Map.of("audits", auditStore.list(project).values());
            }
            if ("source-tree".equals(action) && "GET".equals(method)) {
                return sourceTreePayload(project);
            }
            if ("source-selection".equals(action) && "GET".equals(method)) {
                return sourceSelectionPayload(project);
            }
            if ("source-selection".equals(action) && "POST".equals(method)) {
                return updateSourceSelection(exchange, project);
            }
            if ("design-summary".equals(action) && "GET".equals(method)) {
                return analysis.designSummary(project);
            }
            if ("files".equals(action) && "GET".equals(method)) {
                String path = query(exchange).getOrDefault("path", "");
                return Map.of("path", path, "content", analysis.readSourceFile(project, path));
            }
            if ("circuit".equals(action) && "GET".equals(method)) {
                String path = query(exchange).getOrDefault("path", "");
                return Map.of("path", path, "content", analysis.readCircuitFile(project, path));
            }
            if ("reports".equals(action) && "GET".equals(method)) {
                return Map.of("files", analysis.reportFiles(project));
            }
            if ("violations".equals(action) && "POST".equals(method)) {
                return updateViolationStatus(exchange, project);
            }
        }

        if (parts.size() == 5 && "reports".equals(parts.get(3)) && "file".equals(parts.get(4)) && "GET".equals(method)) {
            sendReportFile(exchange, project, query(exchange).getOrDefault("path", ""));
            throw HttpError.alreadySent();
        }

        throw new HttpError(404, "Not found");
    }

    private Object sourceTreePayload(Models.Project project) throws Exception {
        List<Map<String, Object>> files = analysis.sourceTree(project);
        Map<String, Boolean> selection = sourceSelectionStore.list(project);
        applySourceSelection(files, selection);
        return Map.of("files", files, "stats", analysis.sourceStats(project), "selection", selection);
    }

    private Object sourceSelectionPayload(Models.Project project) throws Exception {
        Map<String, Boolean> selection = sourceSelectionStore.list(project);
        List<Object> rows = new ArrayList<>();
        for (Map.Entry<String, Boolean> entry : selection.entrySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("path", entry.getKey());
            row.put("included", entry.getValue());
            rows.add(row);
        }
        return Map.of("selection", rows);
    }

    private Object updateSourceSelection(HttpExchange exchange, Models.Project project) throws Exception {
        Map<String, String> body = Json.parseFlatObject(readBody(exchange));
        Map<String, Boolean> changes = new LinkedHashMap<>();
        String path = first(body, "path", "sourcePath", "file");
        if (!path.isBlank()) {
            changes.put(path, boolValue(body.getOrDefault("included", "true")));
        }
        for (String item : csvSet(first(body, "include", "includes", "includedPaths"))) {
            changes.put(item, true);
        }
        for (String item : csvSet(first(body, "exclude", "excludes", "excludedPaths"))) {
            changes.put(item, false);
        }
        if (changes.isEmpty()) {
            throw new HttpError(400, "No source selection changes were provided");
        }
        sourceSelectionStore.update(project, changes);
        return sourceTreePayload(project);
    }

    private Object createProject(HttpExchange exchange) throws Exception {
        Map<String, String> body = Json.parseFlatObject(readBody(exchange));
        String name = required(body, "name");
        String sourcePath = first(body, "sourcePath", "source_path", "src");
        if (sourcePath.isBlank()) {
            throw new HttpError(400, "Missing required field: sourcePath");
        }
        Map<String, Object> source = inspectSourcePath(sourcePath);
        if (!Boolean.TRUE.equals(source.get("directory"))) {
            throw new HttpError(400, "sourcePath is not a directory: " + sourcePath);
        }
        if (asInt(source.get("hdlFileCount")) == 0) {
            throw new HttpError(400, "No HDL source files were found under: " + sourcePath);
        }

        Models.Project project = store.createProject(
            name,
            String.valueOf(source.get("absolutePath")),
            body.getOrDefault("language", "v_vhd"),
            body.getOrDefault("ruleset", "new_CAST"),
            body.getOrDefault("analyst", "server")
        );
        Models.Job job = engine.submitCreate(project);
        return Map.of("project", project.toJson(), "job", job.toJson());
    }

    private Object updateProject(HttpExchange exchange, Models.Project project) throws Exception {
        Map<String, String> body = Json.parseFlatObject(readBody(exchange));
        String sourcePath = first(body, "sourcePath", "source_path", "src");
        if (!sourcePath.isBlank()) {
            Path existing = Path.of(project.sourcePath).toAbsolutePath().normalize();
            Path requested = Path.of(sourcePath).toAbsolutePath().normalize();
            if (!existing.equals(requested)) {
                throw new HttpError(400, "Changing sourcePath requires creating a new project");
            }
        }
        String name = body.get("name");
        if (name != null && !name.isBlank()) {
            project.name = name.trim();
        }
        String analyst = body.get("analyst");
        if (analyst != null) {
            project.analyst = analyst.isBlank() ? "server" : analyst.trim();
        }
        String ruleset = body.get("ruleset");
        if (ruleset != null && !ruleset.isBlank()) {
            project.ruleset = ruleset.trim();
        }
        String language = body.get("language");
        if (language != null && !language.isBlank()) {
            project.language = language.trim();
        }
        store.updateProject(project);
        return Map.of("project", project.toJson());
    }

    private Object analyzeProject(HttpExchange exchange, Models.Project project) throws Exception {
        Map<String, String> body = Json.parseFlatObject(readBody(exchange));
        String ruleset = body.getOrDefault("ruleset", project.ruleset);
        Models.Job job = engine.submitAnalyze(project, ruleset);
        return Map.of("job", job.toJson(), "project", project.toJson());
    }

    private Object reportProject(HttpExchange exchange, Models.Project project) throws Exception {
        Map<String, String> body = Json.parseFlatObject(readBody(exchange));
        String format = body.getOrDefault("format", "html").toLowerCase();
        if (!"html".equals(format)) {
            throw new HttpError(400, "Current engine package only documents html report output");
        }
        Models.ReportTemplate template = reportTemplates.findTemplate(first(body, "template", "templateId"), format);
        Models.Job job = engine.submitReport(project, format, template);
        return Map.of("job", job.toJson(), "template", template.toJson());
    }

    private Object updateViolationStatus(HttpExchange exchange, Models.Project project) throws Exception {
        Map<String, String> body = Json.parseFlatObject(readBody(exchange));
        String status = body.getOrDefault("status", "unconfirmed");
        String note = body.getOrDefault("note", "");
        List<String> ids = new ArrayList<>();
        String idsValue = body.getOrDefault("ids", "");
        if (!idsValue.isBlank()) {
            for (String id : idsValue.split(",")) {
                if (!id.isBlank()) {
                    ids.add(id.trim());
                }
            }
        }
        if (ids.isEmpty() && boolValue(body.getOrDefault("allMatching", "false"))) {
            ids = analysis.matchingViolationIds(
                project,
                auditStore.list(project),
                rulesets.metadata(project.ruleset),
                resultQuery(body)
            );
        }
        if (ids.isEmpty()) {
            throw new HttpError(400, "No violations matched the update request");
        }
        Map<String, Map<String, Object>> audits = auditStore.update(project, ids, status, note);
        List<Object> updated = new ArrayList<>();
        for (String id : ids) {
            Map<String, Object> audit = audits.get(id);
            if (audit != null) {
                updated.add(audit);
            }
        }
        return Map.of("updated", ids.size(), "audits", updated);
    }

    private static void applySourceSelection(List<Map<String, Object>> files, Map<String, Boolean> selection) {
        for (Map<String, Object> file : files) {
            String path = String.valueOf(file.getOrDefault("path", ""));
            String kind = String.valueOf(file.getOrDefault("kind", ""));
            file.put("included", selection.getOrDefault(path, SourceSelectionStore.defaultIncluded(kind)));
            file.put("explicitSelection", selection.containsKey(path));
        }
    }

    private static AnalysisDataService.ResultQuery resultQuery(HttpExchange exchange) {
        Map<String, String> params = query(exchange);
        return resultQuery(params);
    }

    private static AnalysisDataService.ResultQuery resultQuery(Map<String, String> params) {
        return new AnalysisDataService.ResultQuery(
            intParam(params, "page", 1),
            intParam(params, "pageSize", intParam(params, "limit", 0)),
            params.getOrDefault("search", params.getOrDefault("q", "")),
            params.getOrDefault("filterStatus", params.getOrDefault("status", "all")),
            params.getOrDefault("sort", "file"),
            params.getOrDefault("dir", "asc")
        );
    }

    private Object validateSource(HttpExchange exchange) throws IOException {
        Map<String, String> body = Json.parseFlatObject(readBody(exchange));
        String sourcePath = first(body, "sourcePath", "source_path", "src", "path");
        if (sourcePath.isBlank()) {
            throw new HttpError(400, "Missing required field: sourcePath");
        }
        return inspectSourcePath(sourcePath);
    }

    private static Map<String, Object> inspectSourcePath(String sourcePath) throws IOException {
        Path root = Path.of(sourcePath).toAbsolutePath().normalize();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sourcePath", sourcePath);
        out.put("absolutePath", root.toString());
        out.put("exists", Files.exists(root));
        out.put("directory", Files.isDirectory(root));
        out.put("fileCount", 0);
        out.put("hdlFileCount", 0);
        out.put("truncated", false);
        out.put("samples", List.of());

        if (!Files.isDirectory(root)) {
            return out;
        }

        int[] fileCount = {0};
        int[] hdlFileCount = {0};
        List<String> samples = new ArrayList<>();
        try (var walk = Files.walk(root)) {
            walk.filter(Files::isRegularFile)
                .limit(10001)
                .forEach(path -> {
                    fileCount[0] += 1;
                    if (fileCount[0] > 10000) {
                        out.put("truncated", true);
                        return;
                    }
                    if (isHdlFile(path)) {
                        hdlFileCount[0] += 1;
                        if (samples.size() < 20) {
                            samples.add(root.relativize(path).toString().replace('\\', '/'));
                        }
                    }
                });
        }

        out.put("fileCount", Math.min(fileCount[0], 10000));
        out.put("hdlFileCount", hdlFileCount[0]);
        out.put("samples", samples);
        return out;
    }

    private static boolean isHdlFile(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        return name.endsWith(".v")
            || name.endsWith(".vh")
            || name.endsWith(".sv")
            || name.endsWith(".svh")
            || name.endsWith(".vhd")
            || name.endsWith(".vhdl");
    }

    private static int asInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (RuntimeException ex) {
            return 0;
        }
    }

    private Object jobRoute(HttpExchange exchange, String method, List<String> parts) throws Exception {
        if (parts.size() == 2 && "GET".equals(method)) {
            List<Object> rows = new ArrayList<>();
            for (Models.Job job : engine.listJobs()) {
                rows.add(jobJson(job));
            }
            return Map.of("jobs", rows);
        }
        if (parts.size() >= 3 && "GET".equals(method)) {
            String id = parts.get(2);
            Models.Job job = engine.getJob(id);
            if (job == null) {
                throw new HttpError(404, "Job not found: " + id);
            }
            if (parts.size() == 3) {
                return Map.of("job", jobJson(job));
            }
            if (parts.size() == 4 && "log".equals(parts.get(3))) {
                sendText(exchange, 200, job.logText());
                throw HttpError.alreadySent();
            }
        }
        throw new HttpError(404, "Not found");
    }

    private Map<String, Object> jobJson(Models.Job job) {
        Map<String, Object> out = new LinkedHashMap<>(job.toJson());
        store.findProject(job.projectId).ifPresent(project -> {
            out.put("projectName", project.name);
            out.put("projectStatus", project.status);
        });
        return out;
    }

    private static void sendReportFile(HttpExchange exchange, Models.Project project, String relativePath) throws IOException {
        Path root = Path.of(project.projectPath).resolve("report").toAbsolutePath().normalize();
        Path file = root.resolve(relativePath == null ? "" : relativePath).normalize();
        if (!file.startsWith(root) || !Files.isRegularFile(file)) {
            throw new HttpError(404, "Report file not found");
        }
        byte[] bytes = Files.readAllBytes(file);
        exchange.getResponseHeaders().set("Content-Type", contentType(file));
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private boolean isStaticRequest(HttpExchange exchange) {
        return "GET".equalsIgnoreCase(exchange.getRequestMethod())
            && !exchange.getRequestURI().getPath().startsWith("/api");
    }

    private void sendStatic(HttpExchange exchange) throws IOException {
        Path root = config.frontendDir.toAbsolutePath().normalize();
        String rawPath = URLDecoder.decode(exchange.getRequestURI().getPath(), StandardCharsets.UTF_8);
        String cleanPath = rawPath.equals("/") ? "index.html" : rawPath.replaceFirst("^/+", "");
        Path file = root.resolve(cleanPath).normalize();
        if (!file.startsWith(root) || !Files.isRegularFile(file)) {
            file = root.resolve("index.html").normalize();
        }
        if (!Files.isRegularFile(file)) {
            sendJson(exchange, 404, Map.of("error", "Frontend index.html not found"));
            return;
        }
        byte[] bytes = Files.readAllBytes(file);
        exchange.getResponseHeaders().set("Content-Type", contentType(file));
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private static String contentType(Path file) {
        String name = file.getFileName().toString().toLowerCase();
        if (name.endsWith(".html") || name.endsWith(".htm")) {
            return "text/html; charset=utf-8";
        }
        if (name.endsWith(".json")) {
            return "application/json; charset=utf-8";
        }
        if (name.endsWith(".css")) {
            return "text/css; charset=utf-8";
        }
        if (name.endsWith(".js")) {
            return "text/javascript; charset=utf-8";
        }
        return "application/octet-stream";
    }

    private static String required(Map<String, String> body, String key) {
        String value = body.get(key);
        if (value == null || value.isBlank()) {
            throw new HttpError(400, "Missing required field: " + key);
        }
        return value;
    }

    private static String first(Map<String, String> body, String... keys) {
        for (String key : keys) {
            String value = body.get(key);
            if (value != null) {
                return value;
            }
        }
        return "";
    }

    private static List<String> segments(String path) {
        List<String> out = new ArrayList<>();
        for (String part : path.split("/")) {
            if (!part.isBlank()) {
                out.add(urlDecode(part));
            }
        }
        return out;
    }

    private static Map<String, String> query(HttpExchange exchange) {
        Map<String, String> out = new LinkedHashMap<>();
        String query = exchange.getRequestURI().getRawQuery();
        if (query == null || query.isBlank()) {
            return out;
        }
        for (String pair : query.split("&")) {
            int index = pair.indexOf('=');
            if (index < 0) {
                out.put(urlDecode(pair), "");
            } else {
                out.put(urlDecode(pair.substring(0, index)), urlDecode(pair.substring(index + 1)));
            }
        }
        return out;
    }

    private static int intParam(Map<String, String> params, String key, int fallback) {
        try {
            return Integer.parseInt(params.getOrDefault(key, String.valueOf(fallback)));
        } catch (RuntimeException ex) {
            return fallback;
        }
    }

    private static Set<String> csvSet(String value) {
        Set<String> out = new HashSet<>();
        if (value == null || value.isBlank()) {
            return out;
        }
        for (String item : value.split(",")) {
            if (!item.isBlank()) {
                out.add(item.trim());
            }
        }
        return out;
    }

    private static Map<String, String> keyValueMap(String value) {
        Map<String, String> out = new LinkedHashMap<>();
        if (value == null || value.isBlank()) {
            return out;
        }
        for (String item : value.split(",")) {
            int index = item.indexOf('=');
            if (index <= 0) {
                continue;
            }
            String key = item.substring(0, index).trim();
            String val = item.substring(index + 1).trim();
            if (!key.isBlank() && !val.isBlank()) {
                out.put(key, val);
            }
        }
        return out;
    }

    private static boolean boolValue(String value) {
        return "true".equalsIgnoreCase(value) || "1".equals(value) || "yes".equalsIgnoreCase(value);
    }

    private static String urlDecode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    private static void addCors(HttpExchange exchange) {
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
    }

    private static void sendJson(HttpExchange exchange, int status, Object body) throws IOException {
        byte[] bytes = Json.stringify(body).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private static void sendText(HttpExchange exchange, int status, String text) throws IOException {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private static final class HttpError extends RuntimeException {
        final int status;
        final boolean alreadySent;

        HttpError(int status, String message) {
            super(message);
            this.status = status;
            this.alreadySent = false;
        }

        private HttpError() {
            super("Response already sent");
            this.status = 200;
            this.alreadySent = true;
        }

        static HttpError alreadySent() {
            return new HttpError();
        }
    }
}
