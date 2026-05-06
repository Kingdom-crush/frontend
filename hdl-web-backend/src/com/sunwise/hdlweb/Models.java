package com.sunwise.hdlweb;

import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class Models {
    private Models() {
    }

    static final class Project {
        String id;
        String name;
        String sourcePath;
        String projectPath;
        String language;
        String ruleset;
        String analyst;
        String status;
        String createdAt;
        String updatedAt;

        Map<String, Object> toJson() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", id);
            out.put("name", name);
            out.put("sourcePath", sourcePath);
            out.put("projectPath", projectPath);
            out.put("language", language);
            out.put("ruleset", ruleset);
            out.put("analyst", analyst);
            out.put("status", status);
            out.put("createdAt", createdAt);
            out.put("updatedAt", updatedAt);
            return out;
        }

        String toLine() {
            return String.join("\t",
                enc(id),
                enc(name),
                enc(sourcePath),
                enc(projectPath),
                enc(language),
                enc(ruleset),
                enc(analyst),
                enc(status),
                enc(createdAt),
                enc(updatedAt)
            );
        }

        static Project fromLine(String line) {
            String[] parts = line.split("\t", -1);
            if (parts.length < 9) {
                throw new IllegalArgumentException("Invalid project record");
            }
            Project p = new Project();
            p.id = dec(parts[0]);
            p.name = dec(parts[1]);
            p.sourcePath = dec(parts[2]);
            p.projectPath = dec(parts[3]);
            p.language = dec(parts[4]);
            p.ruleset = dec(parts[5]);
            if (parts.length >= 10) {
                p.analyst = dec(parts[6]);
                p.status = dec(parts[7]);
                p.createdAt = dec(parts[8]);
                p.updatedAt = dec(parts[9]);
            } else {
                p.analyst = "server";
                p.status = dec(parts[6]);
                p.createdAt = dec(parts[7]);
                p.updatedAt = dec(parts[8]);
            }
            return p;
        }
    }

    static final class Job {
        String id;
        String type;
        String projectId;
        String status;
        int progress;
        Integer exitCode;
        String message;
        String logPath;
        String createdAt;
        String startedAt;
        String finishedAt;
        final List<String> logLines = new ArrayList<>();

        Job(String id, String type, String projectId, Path logPath) {
            this.id = id;
            this.type = type;
            this.projectId = projectId;
            this.status = "queued";
            this.progress = 0;
            this.message = "";
            this.logPath = logPath.toString();
            this.createdAt = Instant.now().toString();
        }

        synchronized void append(String line) {
            logLines.add(line);
            if (logLines.size() > 1000) {
                logLines.remove(0);
            }
        }

        synchronized Map<String, Object> toJson() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", id);
            out.put("type", type);
            out.put("projectId", projectId);
            out.put("status", status);
            out.put("progress", progress);
            out.put("exitCode", exitCode);
            out.put("message", message);
            out.put("logPath", logPath);
            out.put("createdAt", createdAt);
            out.put("startedAt", startedAt);
            out.put("finishedAt", finishedAt);
            return out;
        }

        synchronized String logText() {
            return String.join(System.lineSeparator(), logLines);
        }

        synchronized String toLine() {
            return String.join("\t",
                enc(id),
                enc(type),
                enc(projectId),
                enc(status),
                Integer.toString(progress),
                exitCode == null ? "" : Integer.toString(exitCode),
                enc(message),
                enc(logPath),
                enc(createdAt),
                enc(startedAt),
                enc(finishedAt)
            );
        }

        static Job fromLine(String line) {
            String[] parts = line.split("\t", -1);
            if (parts.length < 11) {
                throw new IllegalArgumentException("Invalid job record");
            }
            Job job = new Job(dec(parts[0]), dec(parts[1]), dec(parts[2]), Path.of(dec(parts[7])));
            job.status = dec(parts[3]);
            job.progress = parseInt(parts[4], 0);
            job.exitCode = parts[5].isBlank() ? null : parseInt(parts[5], 0);
            job.message = dec(parts[6]);
            job.createdAt = dec(parts[8]);
            job.startedAt = dec(parts[9]);
            job.finishedAt = dec(parts[10]);
            return job;
        }
    }

    static final class Ruleset {
        String id;
        String name;
        String refFile;
        boolean available;
        int ruleCount;

        Map<String, Object> toJson() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", id);
            out.put("name", name);
            out.put("refFile", refFile);
            out.put("available", available);
            out.put("ruleCount", ruleCount);
            return out;
        }
    }

    static final class ReportTemplate {
        String id;
        String name;
        String format;
        String source;
        String path;
        boolean available;

        Map<String, Object> toJson() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", id);
            out.put("name", name);
            out.put("format", format);
            out.put("source", source);
            out.put("path", path);
            out.put("available", available);
            return out;
        }
    }

    private static String enc(String value) {
        String safe = value == null ? "" : value;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(safe.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static String dec(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return new String(Base64.getUrlDecoder().decode(value), java.nio.charset.StandardCharsets.UTF_8);
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value);
        } catch (RuntimeException ex) {
            return fallback;
        }
    }
}
