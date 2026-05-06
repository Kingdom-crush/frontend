package com.sunwise.hdlweb;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

final class ProjectStore {
    private final Path workspaceDir;
    private final Path projectsFile;
    private final Map<String, Models.Project> projects = new LinkedHashMap<>();

    ProjectStore(Path workspaceDir) throws IOException {
        this.workspaceDir = workspaceDir.toAbsolutePath().normalize();
        this.projectsFile = this.workspaceDir.resolve("projects.tsv");
        Files.createDirectories(this.workspaceDir);
        load();
    }

    synchronized List<Models.Project> listProjects() {
        return new ArrayList<>(projects.values());
    }

    synchronized Optional<Models.Project> findProject(String id) {
        return Optional.ofNullable(projects.get(id));
    }

    synchronized Models.Project createProject(String name, String sourcePath, String language, String ruleset, String analyst) throws IOException {
        String now = Instant.now().toString();
        String id = uniqueId(name);
        Path projectPath = workspaceDir.resolve(id).normalize();
        ensureInsideWorkspace(projectPath);
        Files.createDirectories(projectPath);

        Models.Project p = new Models.Project();
        p.id = id;
        p.name = name;
        p.sourcePath = Path.of(sourcePath).toAbsolutePath().normalize().toString();
        p.projectPath = projectPath.toString();
        p.language = language == null || language.isBlank() ? "v_vhd" : language;
        p.ruleset = ruleset == null || ruleset.isBlank() ? "new_CAST" : ruleset;
        p.analyst = analyst == null || analyst.isBlank() ? "server" : analyst;
        p.status = "created";
        p.createdAt = now;
        p.updatedAt = now;
        projects.put(p.id, p);
        save();
        return p;
    }

    synchronized void updateProject(Models.Project project) throws IOException {
        project.updatedAt = Instant.now().toString();
        projects.put(project.id, project);
        save();
    }

    synchronized void setStatus(String id, String status) throws IOException {
        Models.Project p = projects.get(id);
        if (p != null) {
            p.status = status;
            p.updatedAt = Instant.now().toString();
            save();
        }
    }

    synchronized boolean deleteProject(String id) throws IOException {
        Models.Project removed = projects.remove(id);
        if (removed == null) {
            return false;
        }
        save();
        Path target = Path.of(removed.projectPath).toAbsolutePath().normalize();
        ensureInsideWorkspace(target);
        deleteRecursively(target);
        Path mirror = workspaceDir.resolve("source-mirrors").resolve(id).toAbsolutePath().normalize();
        ensureInsideWorkspace(mirror);
        deleteRecursively(mirror);
        return true;
    }

    Path workspaceDir() {
        return workspaceDir;
    }

    private void load() throws IOException {
        if (!Files.exists(projectsFile)) {
            return;
        }
        for (String line : Files.readAllLines(projectsFile, StandardCharsets.UTF_8)) {
            if (line.isBlank()) {
                continue;
            }
            Models.Project p = Models.Project.fromLine(line);
            projects.put(p.id, p);
        }
    }

    private void save() throws IOException {
        List<String> lines = new ArrayList<>();
        for (Models.Project p : projects.values()) {
            lines.add(p.toLine());
        }
        Files.write(projectsFile, lines, StandardCharsets.UTF_8);
    }

    private String uniqueId(String name) {
        String base = slug(name);
        String suffix = Long.toString(System.currentTimeMillis(), 36);
        String id = base + "-" + suffix;
        int index = 2;
        while (projects.containsKey(id)) {
            id = base + "-" + suffix + "-" + index++;
        }
        return id;
    }

    private static String slug(String value) {
        String normalized = Normalizer.normalize(value == null ? "project" : value, Normalizer.Form.NFKD);
        String slug = normalized.replaceAll("[^A-Za-z0-9_-]+", "-")
            .replaceAll("-+", "-")
            .replaceAll("^-|-$", "")
            .toLowerCase();
        return slug.isBlank() ? "project" : slug;
    }

    private void ensureInsideWorkspace(Path path) throws IOException {
        Path root = workspaceDir.toAbsolutePath().normalize();
        Path target = path.toAbsolutePath().normalize();
        if (!target.startsWith(root)) {
            throw new IOException("Path is outside workspace: " + target);
        }
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
}
