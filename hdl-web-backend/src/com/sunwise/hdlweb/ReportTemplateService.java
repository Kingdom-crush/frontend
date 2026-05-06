package com.sunwise.hdlweb;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

final class ReportTemplateService {
    private final Path engineDir;
    private final Path workspaceDir;

    ReportTemplateService(Path engineDir, Path workspaceDir) {
        this.engineDir = engineDir.toAbsolutePath().normalize();
        this.workspaceDir = workspaceDir.toAbsolutePath().normalize();
    }

    List<Models.ReportTemplate> listTemplates(String format) {
        String wanted = normalizeFormat(format);
        List<Models.ReportTemplate> out = new ArrayList<>();
        out.add(defaultHtmlTemplate());
        scanDirectory(engineDir.resolve("report-templates"), "engine", out);
        scanDirectory(workspaceDir.resolve("report-templates"), "workspace", out);
        return out.stream()
            .filter(template -> wanted.isBlank() || wanted.equals(template.format))
            .sorted(Comparator.comparing(template -> template.name.toLowerCase(Locale.ROOT)))
            .toList();
    }

    Models.ReportTemplate findTemplate(String id, String format) {
        String wanted = normalizeFormat(format);
        String requested = id == null || id.isBlank() ? "default_html" : id.trim();
        for (Models.ReportTemplate template : listTemplates(wanted)) {
            if (template.id.equals(requested)) {
                return template;
            }
        }
        if ("default_html".equals(requested) && ("html".equals(wanted) || wanted.isBlank())) {
            return defaultHtmlTemplate();
        }
        throw new IllegalArgumentException("Report template not found: " + requested);
    }

    private void scanDirectory(Path root, String source, List<Models.ReportTemplate> out) {
        if (!Files.isDirectory(root)) {
            return;
        }
        try (var walk = Files.walk(root, 2)) {
            for (Path path : walk.filter(Files::isRegularFile).toList()) {
                String format = formatFromFile(path);
                if (format.isBlank()) {
                    continue;
                }
                Models.ReportTemplate template = new Models.ReportTemplate();
                template.id = source + "_" + slug(root.relativize(path).toString());
                template.name = nameFromFile(path);
                template.format = format;
                template.source = source;
                template.path = path.toAbsolutePath().normalize().toString();
                template.available = true;
                out.add(template);
            }
        } catch (IOException ignored) {
        }
    }

    private static Models.ReportTemplate defaultHtmlTemplate() {
        Models.ReportTemplate template = new Models.ReportTemplate();
        template.id = "default_html";
        template.name = "默认 HTML 报告模板";
        template.format = "html";
        template.source = "builtin";
        template.path = "";
        template.available = true;
        return template;
    }

    private static String normalizeFormat(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String format = value.trim().toLowerCase(Locale.ROOT);
        return switch (format) {
            case "htm" -> "html";
            case "doc", "docx", "word" -> "word";
            case "xls", "xlsx", "excel" -> "excel";
            default -> format;
        };
    }

    private static String formatFromFile(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".html") || name.endsWith(".htm")) {
            return "html";
        }
        if (name.endsWith(".doc") || name.endsWith(".docx")) {
            return "word";
        }
        if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
            return "excel";
        }
        if (name.endsWith(".wps")) {
            return "wps";
        }
        if (name.endsWith(".txt") || name.endsWith(".md")) {
            return "txt";
        }
        return "";
    }

    private static String nameFromFile(Path path) {
        String name = path.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String slug(String value) {
        String slug = value.replace('\\', '_')
            .replace('/', '_')
            .replaceAll("[^A-Za-z0-9_-]+", "_")
            .replaceAll("_+", "_")
            .replaceAll("^_|_$", "")
            .toLowerCase(Locale.ROOT);
        return slug.isBlank() ? "template" : slug;
    }
}
