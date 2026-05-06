package com.sunwise.hdlweb;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

final class AnalysisDataService {
    Map<String, Object> readResults(Models.Project project, Map<String, Map<String, Object>> audits, Map<String, Map<String, String>> metadata) {
        return readResults(project, audits, metadata, ResultQuery.all());
    }

    Map<String, Object> readResults(Models.Project project, Map<String, Map<String, Object>> audits, Map<String, Map<String, String>> metadata, ResultQuery query) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("project", project.toJson());
        out.put("summary", Map.of());
        out.put("violations", List.of());

        Path projectRoot = Path.of(project.projectPath);
        Path resultXml = projectRoot.resolve("out").resolve("hdl.xml");
        Path statFile = projectRoot.resolve("analyze-stat.properties");
        Path violationFile = projectRoot.resolve("rule-violations.txt");
        out.put("resultFile", Files.exists(violationFile) ? violationFile.toString() : resultXml.toString());
        if (!Files.exists(resultXml) && !Files.exists(violationFile)) {
            out.put("available", false);
            return out;
        }

        try {
            out.put("available", true);
            List<Map<String, Object>> violations;
            if (Files.exists(violationFile)) {
                out.put("summary", readProperties(statFile));
                violations = applyAudits(readTextViolations(violationFile, metadata), audits);
            } else {
                Document doc = parse(resultXml);
                out.put("summary", readSummary(doc));
                violations = applyAudits(readViolations(doc), audits);
            }
            out.putAll(pageViolations(violations, query));
        } catch (Exception ex) {
            out.put("available", false);
            out.put("error", ex.getMessage());
        }
        return out;
    }

    List<String> matchingViolationIds(Models.Project project, Map<String, Map<String, Object>> audits, Map<String, Map<String, String>> metadata, ResultQuery query) {
        Map<String, Object> data = readResults(project, audits, metadata, query == null ? ResultQuery.all() : query.withAllRows());
        Object rows = data.get("violations");
        if (!(rows instanceof List<?> list)) {
            return List.of();
        }
        List<String> ids = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> row) {
                Object id = row.get("id");
                if (id != null && !String.valueOf(id).isBlank()) {
                    ids.add(String.valueOf(id));
                }
            }
        }
        return ids;
    }

    List<Map<String, Object>> sourceTree(Models.Project project) throws IOException {
        Path root = Path.of(project.sourcePath).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            return List.of();
        }
        List<Map<String, Object>> files = new ArrayList<>();
        try (var walk = Files.walk(root)) {
            walk.filter(path -> !path.equals(root))
                .limit(3000)
                .sorted(Comparator.comparing(Path::toString))
                .forEach(path -> files.add(fileNode(root, path)));
        }
        return files;
    }

    Map<String, Object> sourceStats(Models.Project project) throws IOException {
        Path root = Path.of(project.sourcePath).toAbsolutePath().normalize();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("sourcePath", root.toString());
        stats.put("exists", Files.exists(root));
        stats.put("directory", Files.isDirectory(root));
        stats.put("fileCount", 0);
        stats.put("hdlFileCount", 0);
        stats.put("constraintFileCount", 0);
        stats.put("totalLines", 0);
        stats.put("blankLines", 0);
        stats.put("commentLines", 0);
        stats.put("effectiveLoc", 0);
        stats.put("commentRate", "0.0%");
        stats.put("truncated", false);
        if (!Files.isDirectory(root)) {
            return stats;
        }

        int[] counts = new int[6]; // files, hdl, constraints, total, blank, comment
        int[] effectiveLoc = {0};
        try (var walk = Files.walk(root)) {
            for (Path path : walk.filter(Files::isRegularFile).limit(5001).toList()) {
                counts[0] += 1;
                if (counts[0] > 5000) {
                    stats.put("truncated", true);
                    break;
                }
                if (isConstraintFile(path)) {
                    counts[2] += 1;
                }
                if (isHdlFile(path)) {
                    counts[1] += 1;
                    int[] lineStats = countSourceLines(path);
                    counts[3] += lineStats[0];
                    counts[4] += lineStats[1];
                    counts[5] += lineStats[2];
                    effectiveLoc[0] += lineStats[3];
                }
            }
        }

        stats.put("fileCount", counts[0]);
        stats.put("hdlFileCount", counts[1]);
        stats.put("constraintFileCount", counts[2]);
        stats.put("totalLines", counts[3]);
        stats.put("blankLines", counts[4]);
        stats.put("commentLines", counts[5]);
        stats.put("effectiveLoc", effectiveLoc[0]);
        double rate = counts[3] == 0 ? 0.0 : counts[5] * 100.0 / counts[3];
        stats.put("commentRate", String.format(Locale.ROOT, "%.1f%%", rate));
        return stats;
    }

    Map<String, Object> designSummary(Models.Project project) throws IOException {
        Path root = Path.of(project.sourcePath).toAbsolutePath().normalize();
        Map<String, Map<String, String>> modules = new LinkedHashMap<>();
        List<Map<String, String>> instances = new ArrayList<>();
        if (Files.isDirectory(root)) {
            try (var walk = Files.walk(root)) {
                for (Path path : walk.filter(Files::isRegularFile).filter(AnalysisDataService::isHdlFile).limit(1000).toList()) {
                    readDesignFile(root, path, modules, instances);
                }
            }
        }

        Set<String> instantiatedTypes = new HashSet<>();
        for (Map<String, String> instance : instances) {
            instantiatedTypes.add(instance.getOrDefault("type", ""));
        }

        List<String> hierarchy = new ArrayList<>();
        List<String> topModules = new ArrayList<>();
        for (String name : modules.keySet()) {
            if (!instantiatedTypes.contains(name)) {
                topModules.add(name);
            }
        }
        if (topModules.isEmpty()) {
            topModules.addAll(modules.keySet());
        }
        for (String top : topModules) {
            hierarchy.add(top);
            for (Map<String, String> instance : instances) {
                if (top.equals(instance.get("parent"))) {
                    hierarchy.add("  " + instance.get("type") + " " + instance.get("name"));
                }
            }
        }

        List<Map<String, String>> ips = new ArrayList<>();
        for (Map<String, String> instance : instances) {
            String type = instance.getOrDefault("type", "");
            if (!type.isBlank() && !modules.containsKey(type)) {
                Map<String, String> row = new LinkedHashMap<>();
                row.put("name", instance.getOrDefault("name", type));
                row.put("type", type);
                row.put("status", likelyIp(type) ? "已识别" : "黑盒");
                row.put("source", instance.getOrDefault("file", ""));
                ips.add(row);
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hierarchy", hierarchy);
        out.put("modules", modules.values());
        out.put("instances", instances);
        out.put("ips", ips);
        return out;
    }

    String readSourceFile(Models.Project project, String relativePath) throws IOException {
        Path root = Path.of(project.sourcePath).toAbsolutePath().normalize();
        Path target = root.resolve(relativePath == null ? "" : relativePath).normalize();
        if (!target.startsWith(root)) {
            throw new IOException("Path is outside source root");
        }
        if (!Files.isRegularFile(target)) {
            throw new IOException("File not found: " + relativePath);
        }
        if (Files.size(target) > 2_000_000) {
            throw new IOException("File is too large to preview");
        }
        return Files.readString(target, detectCharset(target));
    }

    String readCircuitFile(Models.Project project, String relativePath) throws IOException {
        Path root = Path.of(project.sourcePath).toAbsolutePath().normalize();
        Path source = root.resolve(relativePath == null ? "" : relativePath).normalize();
        if (!source.startsWith(root)) {
            throw new IOException("Path is outside source root");
        }
        String fileName = source.getFileName().toString();
        int dot = fileName.lastIndexOf('.');
        String jsonName = (dot >= 0 ? fileName.substring(0, dot) : fileName) + ".json";
        Path circuit = source.resolveSibling(jsonName).normalize();
        if (!circuit.startsWith(root) || !Files.isRegularFile(circuit)) {
            throw new IOException("Circuit data not found for: " + relativePath);
        }
        return Files.readString(circuit, StandardCharsets.UTF_8);
    }

    List<Map<String, Object>> reportFiles(Models.Project project) throws IOException {
        Path reportRoot = Path.of(project.projectPath).resolve("report").toAbsolutePath().normalize();
        if (!Files.isDirectory(reportRoot)) {
            return List.of();
        }
        List<Map<String, Object>> files = new ArrayList<>();
        try (var walk = Files.walk(reportRoot)) {
            walk.filter(Files::isRegularFile)
                .limit(200)
                .sorted(Comparator.comparing(Path::toString))
                .forEach(path -> files.add(fileNode(reportRoot, path)));
        }
        return files;
    }

    private static Map<String, Object> pageViolations(List<Map<String, Object>> rows, ResultQuery query) {
        ResultQuery q = query == null ? ResultQuery.all() : query;
        List<Map<String, Object>> filtered = rows.stream()
            .filter(row -> matchesSearch(row, q.search))
            .filter(row -> matchesStatus(row, q.status))
            .sorted(comparator(q.sort, q.dir))
            .toList();

        int total = rows.size();
        int filteredTotal = filtered.size();
        int pageSize = q.pageSize <= 0 ? Math.max(filteredTotal, 1) : q.pageSize;
        int pageCount = Math.max(1, (int) Math.ceil(filteredTotal / (double) pageSize));
        int page = Math.min(Math.max(1, q.page), pageCount);
        int start = Math.min((page - 1) * pageSize, filteredTotal);
        int end = Math.min(start + pageSize, filteredTotal);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("violations", filtered.subList(start, end));
        out.put("auditSummary", Map.of(
            "total", total,
            "audited", auditedCount(rows),
            "unconfirmed", statusCount(rows, "unconfirmed"),
            "violation", statusCount(rows, "violation"),
            "notViolation", statusCount(rows, "not_violation"),
            "filteredTotal", filteredTotal,
            "filteredAudited", auditedCount(filtered),
            "filteredUnconfirmed", statusCount(filtered, "unconfirmed"),
            "filteredViolation", statusCount(filtered, "violation"),
            "filteredNotViolation", statusCount(filtered, "not_violation")
        ));
        out.put("pagination", Map.of(
            "page", page,
            "pageSize", pageSize,
            "pageCount", pageCount,
            "total", total,
            "filteredTotal", filteredTotal,
            "search", q.search,
            "status", q.status,
            "sort", q.sort,
            "dir", q.dir
        ));
        return out;
    }

    private static int auditedCount(List<Map<String, Object>> rows) {
        int count = 0;
        for (Map<String, Object> row : rows) {
            if (!"unconfirmed".equals(statusValue(row))) {
                count++;
            }
        }
        return count;
    }

    private static int statusCount(List<Map<String, Object>> rows, String status) {
        int count = 0;
        for (Map<String, Object> row : rows) {
            if (status.equals(statusValue(row))) {
                count++;
            }
        }
        return count;
    }

    private static String statusValue(Map<String, Object> row) {
        String status = value(row, "status").trim().toLowerCase(Locale.ROOT);
        return switch (status) {
            case "violation", "违反" -> "violation";
            case "not_violation", "not-violation", "pass", "不违反" -> "not_violation";
            default -> "unconfirmed";
        };
    }

    private static boolean matchesSearch(Map<String, Object> row, String search) {
        String keyword = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        if (keyword.isBlank()) {
            return true;
        }
        String haystack = String.join(" ",
            value(row, "rule"),
            value(row, "ruleId"),
            value(row, "ruleName"),
            value(row, "message"),
            value(row, "file"),
            value(row, "category"),
            value(row, "level"),
            value(row, "note")
        ).toLowerCase(Locale.ROOT);
        return haystack.contains(keyword);
    }

    private static boolean matchesStatus(Map<String, Object> row, String status) {
        String value = status == null ? "" : status.trim();
        if (value.isBlank() || "all".equalsIgnoreCase(value)) {
            return true;
        }
        return value.equalsIgnoreCase(value(row, "status"));
    }

    private static Comparator<Map<String, Object>> comparator(String sort, String dir) {
        String key = switch ((sort == null ? "" : sort).toLowerCase(Locale.ROOT)) {
            case "line" -> "line";
            case "conf", "confidence" -> "confidence";
            case "info", "message" -> "message";
            case "note" -> "note";
            case "status" -> "status";
            case "rule" -> "rule";
            case "level", "severity" -> "level";
            case "category", "cat" -> "category";
            default -> "file";
        };
        Comparator<Map<String, Object>> comparator = (a, b) -> {
            if ("line".equals(key) || "confidence".equals(key)) {
                return Integer.compare(asInt(a.get(key)), asInt(b.get(key)));
            }
            return value(a, key).compareToIgnoreCase(value(b, key));
        };
        if ("desc".equalsIgnoreCase(dir)) {
            return comparator.reversed();
        }
        return comparator;
    }

    private static String value(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private static int asInt(Object value) {
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (RuntimeException ex) {
            return 0;
        }
    }

    private static Map<String, Object> readSummary(Document doc) {
        NodeList metrics = doc.getElementsByTagName("metrics");
        if (metrics.getLength() == 0) {
            return Map.of();
        }
        return attrs((Element) metrics.item(0));
    }

    private static List<Map<String, Object>> readViolations(Document doc) {
        List<Map<String, Object>> out = new ArrayList<>();
        NodeList all = doc.getElementsByTagName("*");
        for (int i = 0; i < all.getLength(); i++) {
            Element element = (Element) all.item(i);
            String tag = element.getTagName().toLowerCase();
            if (!tag.contains("violation") || tag.equals("specchecker")) {
                continue;
            }
            Map<String, Object> row = attrs(element);
            row.putIfAbsent("id", stableId(row.toString()));
            row.putIfAbsent("status", "unconfirmed");
            row.putIfAbsent("file", firstAttr(element, "file", "source", "sourceFile", "srcfile", "path"));
            row.putIfAbsent("line", firstAttr(element, "line", "lineNo", "lineno", "startLine"));
            row.putIfAbsent("rule", firstAttr(element, "rule", "ruleId", "checker", "checkerId", "ruleName"));
            row.putIfAbsent("message", firstAttr(element, "message", "msg", "description", "name"));
            if (!element.getTextContent().isBlank()) {
                row.putIfAbsent("text", element.getTextContent().trim());
            }
            out.add(row);
        }
        return out;
    }

    private static Map<String, Object> readProperties(Path path) throws IOException {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!Files.exists(path)) {
            return out;
        }
        Properties props = new Properties();
        try (var reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            props.load(reader);
        }
        for (String key : props.stringPropertyNames()) {
            out.put(key, props.getProperty(key));
        }
        return out;
    }

    private static List<Map<String, Object>> readTextViolations(Path path, Map<String, Map<String, String>> metadata) throws IOException {
        List<Map<String, Object>> out = new ArrayList<>();
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        int index = 1;
        for (String line : lines) {
            if (line.isBlank()) {
                continue;
            }
            String[] parts = line.split("\\|", -1);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", stableId(line));
            row.put("file", valueAt(parts, 0));
            row.put("line", valueAt(parts, 1));
            row.put("confidence", valueAt(parts, 2));
            String levelId = valueAt(parts, 3);
            String categoryId = valueAt(parts, 6);
            row.put("levelId", levelId);
            row.put("level", nameFor(metadata, "levels", levelId));
            row.put("message", valueAt(parts, 4));
            String rule = valueAt(parts, 5);
            row.put("rule", rule);
            row.put("ruleId", metadataValue(metadata, "ruleIds", rule, rule));
            row.put("ruleName", metadataValue(metadata, "ruleNames", rule, ""));
            row.put("ruleMessage", metadataValue(metadata, "ruleMessages", rule, ""));
            row.put("ruleDescription", metadataValue(metadata, "ruleDescriptions", rule, ""));
            row.put("ruleSpecification", metadataValue(metadata, "ruleSpecifications", rule, ""));
            row.put("categoryId", categoryId);
            row.put("category", nameFor(metadata, "categories", categoryId));
            row.put("status", "unconfirmed");
            out.add(row);
        }
        return out;
    }

    private static String nameFor(Map<String, Map<String, String>> metadata, String group, String id) {
        if (id == null || id.isBlank()) {
            return "";
        }
        return metadataValue(metadata, group, id, id);
    }

    private static String metadataValue(Map<String, Map<String, String>> metadata, String group, String id, String fallback) {
        if (id == null || id.isBlank()) {
            return "";
        }
        if (metadata == null) {
            return fallback;
        }
        return metadata.getOrDefault(group, Map.of()).getOrDefault(id, fallback);
    }

    private static String valueAt(String[] values, int index) {
        return index < values.length ? values[index] : "";
    }

    private static List<Map<String, Object>> applyAudits(List<Map<String, Object>> rows, Map<String, Map<String, Object>> audits) {
        if (audits == null || audits.isEmpty()) {
            return rows;
        }
        for (Map<String, Object> row : rows) {
            Map<String, Object> audit = audits.get(String.valueOf(row.get("id")));
            if (audit != null) {
                row.put("status", audit.getOrDefault("status", "unconfirmed"));
                row.put("note", audit.getOrDefault("note", ""));
                row.put("auditUpdatedAt", audit.get("updatedAt"));
            }
        }
        return rows;
    }

    private static String stableId(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder("v-");
            for (int i = 0; i < 8; i++) {
                sb.append(String.format("%02x", bytes[i]));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            return "v-" + Math.abs(value.hashCode());
        }
    }

    private static Map<String, Object> attrs(Element element) {
        Map<String, Object> out = new LinkedHashMap<>();
        NamedNodeMap attrs = element.getAttributes();
        for (int i = 0; i < attrs.getLength(); i++) {
            Node item = attrs.item(i);
            out.put(item.getNodeName(), item.getNodeValue());
        }
        return out;
    }

    private static String firstAttr(Element element, String... names) {
        for (String name : names) {
            if (element.hasAttribute(name)) {
                return element.getAttribute(name);
            }
        }
        return "";
    }

    private static Map<String, Object> fileNode(Path root, Path path) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("path", root.relativize(path).toString().replace('\\', '/'));
        out.put("name", path.getFileName().toString());
        out.put("directory", Files.isDirectory(path));
        out.put("kind", fileKind(path));
        try {
            out.put("size", Files.isDirectory(path) ? 0 : Files.size(path));
        } catch (IOException ex) {
            out.put("size", 0);
        }
        return out;
    }

    private static String fileKind(Path path) {
        if (Files.isDirectory(path)) {
            return "folder";
        }
        if (isHdlFile(path)) {
            return "hdl";
        }
        if (isConstraintFile(path)) {
            return "constraint";
        }
        return "other";
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

    private static boolean isConstraintFile(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        return name.endsWith(".sdc")
            || name.endsWith(".xdc")
            || name.endsWith(".ucf")
            || name.endsWith(".qsf")
            || name.endsWith(".cst");
    }

    private static int[] countSourceLines(Path path) {
        int total = 0;
        int blank = 0;
        int comment = 0;
        int effective = 0;
        boolean inBlock = false;
        try {
            for (String line : Files.readAllLines(path, detectCharset(path))) {
                total += 1;
                String trimmed = line.strip();
                if (trimmed.isEmpty()) {
                    blank += 1;
                    continue;
                }
                StripResult result = stripComments(trimmed, inBlock);
                inBlock = result.inBlock;
                if (result.code.isBlank()) {
                    comment += 1;
                } else {
                    effective += 1;
                }
            }
        } catch (IOException ex) {
            return new int[] {total, blank, comment, effective};
        }
        return new int[] {total, blank, comment, effective};
    }

    private static void readDesignFile(
        Path root,
        Path path,
        Map<String, Map<String, String>> modules,
        List<Map<String, String>> instances
    ) {
        String relative = root.relativize(path).toString().replace('\\', '/');
        String code;
        try {
            code = readCodeWithoutComments(path);
        } catch (IOException ex) {
            return;
        }

        String parent = "";
        Matcher verilogModule = Pattern.compile("(?im)^\\s*module\\s+([A-Za-z_][A-Za-z0-9_$]*)\\b").matcher(code);
        while (verilogModule.find()) {
            parent = addModule(modules, verilogModule.group(1), "Verilog", relative);
        }

        Matcher vhdlEntity = Pattern.compile("(?im)^\\s*entity\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+is\\b").matcher(code);
        while (vhdlEntity.find()) {
            parent = addModule(modules, vhdlEntity.group(1), "VHDL", relative);
        }

        Matcher verilogInstance = Pattern.compile("(?m)^\\s*([A-Za-z_][A-Za-z0-9_$]*)\\s+(?:#\\s*\\([\\s\\S]*?\\)\\s*)?([A-Za-z_][A-Za-z0-9_$]*)\\s*\\(").matcher(code);
        while (verilogInstance.find()) {
            String type = verilogInstance.group(1);
            String name = verilogInstance.group(2);
            if (!isVerilogKeyword(type) && !type.equals(parent)) {
                instances.add(instance(parent, type, name, relative));
            }
        }

        Matcher vhdlInstance = Pattern.compile("(?im)^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*:\\s*(?:entity\\s+[A-Za-z_][A-Za-z0-9_]*\\.)?([A-Za-z_][A-Za-z0-9_]*)\\b").matcher(code);
        while (vhdlInstance.find()) {
            instances.add(instance(parent, vhdlInstance.group(2), vhdlInstance.group(1), relative));
        }
    }

    private static String addModule(Map<String, Map<String, String>> modules, String name, String language, String file) {
        if (!modules.containsKey(name)) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("name", name);
            row.put("language", language);
            row.put("file", file);
            modules.put(name, row);
        }
        return name;
    }

    private static Map<String, String> instance(String parent, String type, String name, String file) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("parent", parent == null ? "" : parent);
        row.put("type", type == null ? "" : type);
        row.put("name", name == null ? "" : name);
        row.put("file", file == null ? "" : file);
        return row;
    }

    private static String readCodeWithoutComments(Path path) throws IOException {
        StringBuilder out = new StringBuilder();
        boolean inBlock = false;
        for (String line : Files.readAllLines(path, detectCharset(path))) {
            StripResult result = stripComments(line, inBlock);
            inBlock = result.inBlock;
            out.append(result.code).append('\n');
        }
        return out.toString();
    }

    private static boolean likelyIp(String type) {
        String value = type.toLowerCase(Locale.ROOT);
        return value.contains("ip")
            || value.contains("pll")
            || value.contains("fifo")
            || value.startsWith("xpm_")
            || value.startsWith("altera_")
            || value.startsWith("xilinx_");
    }

    private static boolean isVerilogKeyword(String value) {
        return Set.of(
            "always", "assign", "begin", "case", "else", "end", "endmodule",
            "for", "function", "generate", "if", "initial", "input", "localparam",
            "module", "output", "parameter", "reg", "wire"
        ).contains(value.toLowerCase(Locale.ROOT));
    }

    private static StripResult stripComments(String text, boolean inBlock) {
        String code = text;
        boolean block = inBlock;
        while (true) {
            if (block) {
                int end = code.indexOf("*/");
                if (end < 0) {
                    return new StripResult("", true);
                }
                code = code.substring(end + 2).stripLeading();
                block = false;
                continue;
            }

            int vhdlComment = code.indexOf("--");
            int verilogComment = code.indexOf("//");
            int lineComment = minPositive(vhdlComment, verilogComment);
            int blockStart = code.indexOf("/*");
            if (lineComment < 0 && blockStart < 0) {
                return new StripResult(code.strip(), false);
            }
            if (lineComment >= 0 && (blockStart < 0 || lineComment < blockStart)) {
                return new StripResult(code.substring(0, lineComment).strip(), false);
            }

            String before = code.substring(0, blockStart);
            int blockEnd = code.indexOf("*/", blockStart + 2);
            if (blockEnd < 0) {
                return new StripResult(before.strip(), true);
            }
            code = (before + " " + code.substring(blockEnd + 2)).strip();
        }
    }

    private static int minPositive(int a, int b) {
        if (a < 0) {
            return b;
        }
        if (b < 0) {
            return a;
        }
        return Math.min(a, b);
    }

    private record StripResult(String code, boolean inBlock) {
    }

    private static Document parse(Path path) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setExpandEntityReferences(false);
        factory.setNamespaceAware(false);
        return factory.newDocumentBuilder().parse(path.toFile());
    }

    private static Charset detectCharset(Path path) {
        try {
            byte[] sample = Files.readAllBytes(path);
            String decoded = new String(sample, StandardCharsets.UTF_8);
            if (!decoded.contains("\uFFFD")) {
                return StandardCharsets.UTF_8;
            }
        } catch (IOException ignored) {
        }
        return Charset.defaultCharset();
    }

    static final class ResultQuery {
        final int page;
        final int pageSize;
        final String search;
        final String status;
        final String sort;
        final String dir;

        ResultQuery(int page, int pageSize, String search, String status, String sort, String dir) {
            this.page = page;
            this.pageSize = pageSize;
            this.search = search == null ? "" : search;
            this.status = status == null ? "all" : status;
            this.sort = sort == null || sort.isBlank() ? "file" : sort;
            this.dir = "desc".equalsIgnoreCase(dir) ? "desc" : "asc";
        }

        static ResultQuery all() {
            return new ResultQuery(1, 0, "", "all", "file", "asc");
        }

        ResultQuery withAllRows() {
            return new ResultQuery(1, 0, search, status, sort, dir);
        }
    }
}
