package com.sunwise.hdlweb;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class ViolationAuditStore {
    Map<String, Map<String, Object>> list(Models.Project project) throws IOException {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        Path file = auditFile(project);
        if (!Files.exists(file)) {
            return out;
        }
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
            if (line.isBlank()) {
                continue;
            }
            String[] parts = line.split("\t", -1);
            if (parts.length < 4) {
                continue;
            }
            Map<String, Object> audit = new LinkedHashMap<>();
            audit.put("id", dec(parts[0]));
            audit.put("status", dec(parts[1]));
            audit.put("note", dec(parts[2]));
            audit.put("updatedAt", dec(parts[3]));
            out.put(String.valueOf(audit.get("id")), audit);
        }
        return out;
    }

    Map<String, Map<String, Object>> update(Models.Project project, List<String> ids, String status, String note) throws IOException {
        Map<String, Map<String, Object>> audits = list(project);
        String now = Instant.now().toString();
        for (String id : ids) {
            if (id == null || id.isBlank()) {
                continue;
            }
            Map<String, Object> audit = new LinkedHashMap<>();
            audit.put("id", id.trim());
            audit.put("status", status == null || status.isBlank() ? "unconfirmed" : status);
            audit.put("note", note == null ? "" : note);
            audit.put("updatedAt", now);
            audits.put(id.trim(), audit);
        }
        save(project, audits);
        return audits;
    }

    private void save(Models.Project project, Map<String, Map<String, Object>> audits) throws IOException {
        Path file = auditFile(project);
        Files.createDirectories(file.getParent());
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> audit : audits.values()) {
            lines.add(String.join("\t",
                enc(String.valueOf(audit.get("id"))),
                enc(String.valueOf(audit.get("status"))),
                enc(String.valueOf(audit.get("note"))),
                enc(String.valueOf(audit.get("updatedAt")))
            ));
        }
        Files.write(file, lines, StandardCharsets.UTF_8);
    }

    private static Path auditFile(Models.Project project) {
        return Path.of(project.projectPath).resolve("violation-audits.tsv");
    }

    private static String enc(String value) {
        return Base64.getUrlEncoder().withoutPadding()
            .encodeToString((value == null ? "" : value).getBytes(StandardCharsets.UTF_8));
    }

    private static String dec(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
    }
}
