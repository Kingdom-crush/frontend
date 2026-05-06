package com.sunwise.hdlweb;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class SourceSelectionStore {
    Map<String, Boolean> list(Models.Project project) throws IOException {
        Map<String, Boolean> out = new LinkedHashMap<>();
        Path file = selectionFile(project);
        if (!Files.exists(file)) {
            return out;
        }
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
            if (line.isBlank()) {
                continue;
            }
            String[] parts = line.split("\t", -1);
            if (parts.length < 2) {
                continue;
            }
            out.put(normalizePath(dec(parts[0])), Boolean.parseBoolean(dec(parts[1])));
        }
        return out;
    }

    Map<String, Boolean> update(Models.Project project, Map<String, Boolean> changes) throws IOException {
        Map<String, Boolean> selection = list(project);
        for (Map.Entry<String, Boolean> entry : changes.entrySet()) {
            String path = normalizePath(entry.getKey());
            if (!path.isBlank()) {
                selection.put(path, Boolean.TRUE.equals(entry.getValue()));
            }
        }
        save(project, selection);
        return selection;
    }

    private static void save(Models.Project project, Map<String, Boolean> selection) throws IOException {
        Path file = selectionFile(project);
        Files.createDirectories(file.getParent());
        List<String> lines = new ArrayList<>();
        for (Map.Entry<String, Boolean> entry : selection.entrySet()) {
            lines.add(enc(normalizePath(entry.getKey())) + "\t" + enc(Boolean.toString(entry.getValue())));
        }
        Files.write(file, lines, StandardCharsets.UTF_8);
    }

    Path prepareSelectedSource(Models.Project project) throws IOException {
        Map<String, Boolean> selection = list(project);
        if (selection.isEmpty()) {
            return null;
        }

        Path sourceRoot = Path.of(project.sourcePath).toAbsolutePath().normalize();
        if (!Files.isDirectory(sourceRoot)) {
            throw new IOException("Source root is not available: " + sourceRoot);
        }

        Path projectRoot = Path.of(project.projectPath).toAbsolutePath().normalize();
        Path workspaceRoot = projectRoot.getParent();
        if (workspaceRoot == null) {
            throw new IOException("Project root has no workspace parent");
        }
        Path targetRoot = workspaceRoot.resolve("source-mirrors").resolve(project.id).normalize();
        if (!targetRoot.startsWith(workspaceRoot)) {
            throw new IOException("Selected source directory escaped workspace root");
        }
        deleteRecursively(targetRoot);
        Files.createDirectories(targetRoot);

        int copiedHdl = 0;
        try (var walk = Files.walk(sourceRoot)) {
            for (Path path : walk.filter(Files::isRegularFile).limit(10000).toList()) {
                String relative = sourceRoot.relativize(path).toString().replace('\\', '/');
                String kind = fileKind(path);
                boolean included = selection.getOrDefault(relative, defaultIncluded(kind));
                if (!included) {
                    continue;
                }
                Path target = targetRoot.resolve(relative).normalize();
                if (!target.startsWith(targetRoot)) {
                    continue;
                }
                Files.createDirectories(target.getParent());
                Files.copy(path, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.COPY_ATTRIBUTES);
                if ("hdl".equals(kind)) {
                    copiedHdl += 1;
                }
            }
        }
        if (copiedHdl == 0) {
            throw new IOException("No selected HDL files remain after source selection");
        }
        return targetRoot;
    }

    static boolean defaultIncluded(String kind) {
        return "hdl".equals(kind) || "constraint".equals(kind) || "folder".equals(kind);
    }

    private static void deleteRecursively(Path target) throws IOException {
        if (!Files.exists(target)) {
            return;
        }
        try (var walk = Files.walk(target)) {
            List<Path> paths = walk.sorted(Comparator.reverseOrder()).toList();
            for (Path path : paths) {
                Files.deleteIfExists(path);
            }
        }
    }

    private static String fileKind(Path path) {
        String name = path.getFileName().toString().toLowerCase(java.util.Locale.ROOT);
        if (name.endsWith(".v")
            || name.endsWith(".vh")
            || name.endsWith(".sv")
            || name.endsWith(".svh")
            || name.endsWith(".vhd")
            || name.endsWith(".vhdl")) {
            return "hdl";
        }
        if (name.endsWith(".sdc")
            || name.endsWith(".xdc")
            || name.endsWith(".ucf")
            || name.endsWith(".qsf")
            || name.endsWith(".cst")) {
            return "constraint";
        }
        return "other";
    }

    private static Path selectionFile(Models.Project project) {
        return Path.of(project.projectPath).resolve("source-selection.tsv");
    }

    private static String normalizePath(String value) {
        String normalized = value == null ? "" : value.replace('\\', '/').trim();
        if (normalized.startsWith("/") || normalized.matches("^[A-Za-z]:.*")) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        for (String part : normalized.split("/+")) {
            if (part.isBlank() || ".".equals(part)) {
                continue;
            }
            if ("..".equals(part)) {
                return "";
            }
            parts.add(part);
        }
        return String.join("/", parts);
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
