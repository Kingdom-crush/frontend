package com.sunwise.hdlweb;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class EngineRunner {
    private final Config config;
    private final ProjectStore store;
    private final SourceSelectionStore sourceSelectionStore;
    private final Path jobsFile;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final Map<String, Models.Job> jobs = new ConcurrentHashMap<>();

    EngineRunner(Config config, ProjectStore store, SourceSelectionStore sourceSelectionStore) throws IOException {
        this.config = config;
        this.store = store;
        this.sourceSelectionStore = sourceSelectionStore;
        this.jobsFile = store.workspaceDir().resolve("jobs.tsv");
        Files.createDirectories(store.workspaceDir().resolve("job-logs"));
        loadJobs();
    }

    List<Models.Job> listJobs() {
        return new ArrayList<>(jobs.values());
    }

    Models.Job getJob(String id) {
        return jobs.get(id);
    }

    Models.Job submitCreate(Models.Project project) throws IOException {
        Models.Job job = newJob("create", project.id);
        executor.submit(() -> {
            try {
                store.setStatus(project.id, "creating");
                run(job, "create", "-s", project.sourcePath, "-p", project.projectPath, "-l", project.language);
                store.setStatus(project.id, job.exitCode != null && job.exitCode == 0 ? "ready" : "error");
            } catch (Exception ex) {
                fail(job, ex);
                safeSetStatus(project.id, "error");
            }
        });
        return job;
    }

    Models.Job submitAnalyze(Models.Project project, String ruleset) throws IOException {
        if (ruleset != null && !ruleset.isBlank()) {
            project.ruleset = ruleset;
            store.updateProject(project);
        }
        Models.Job job = newJob("analyze", project.id);
        executor.submit(() -> {
            try {
                store.setStatus(project.id, "analyzing");
                Path selectedSource = sourceSelectionStore.prepareSelectedSource(project);
                if (selectedSource != null) {
                    appendPersisted(job, "[source-selection] Refreshing engine project with selected source mirror: " + selectedSource);
                    run(job, "create", "-s", selectedSource.toString(), "-p", project.projectPath, "-l", project.language);
                    if (job.exitCode == null || job.exitCode != 0) {
                        throw new IOException("Selected source project refresh failed");
                    }
                }
                run(job, "analyze", "-r", project.ruleset, "-p", project.projectPath);
                store.setStatus(project.id, job.exitCode != null && job.exitCode == 0 ? "analyzed" : "error");
            } catch (Exception ex) {
                fail(job, ex);
                safeSetStatus(project.id, "error");
            }
        });
        return job;
    }

    Models.Job submitReport(Models.Project project, String format, Models.ReportTemplate template) throws IOException {
        String normalized = format == null || format.isBlank() ? "html" : format.toLowerCase();
        Models.Job job = newJob("report", project.id);
        executor.submit(() -> {
            try {
                Path reportDir = Path.of(project.projectPath).resolve("report");
                Files.createDirectories(reportDir);
                appendPersisted(job, "[report-template] " + template.id + " / " + template.name);
                writeReportMetadata(project, reportDir, normalized, template);
                run(job, "report", "-p", project.projectPath, "-f", normalized, "-o", reportDir.toString());
            } catch (Exception ex) {
                fail(job, ex);
            }
        });
        return job;
    }

    private static void writeReportMetadata(Models.Project project, Path reportDir, String format, Models.ReportTemplate template) throws IOException {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("projectId", project.id);
        meta.put("projectName", project.name);
        meta.put("format", format);
        meta.put("template", template.toJson());
        meta.put("createdAt", Instant.now().toString());
        Files.writeString(
            reportDir.resolve("report-metadata.json"),
            Json.stringify(meta),
            StandardCharsets.UTF_8,
            StandardOpenOption.CREATE,
            StandardOpenOption.TRUNCATE_EXISTING
        );
    }

    private Models.Job newJob(String type, String projectId) throws IOException {
        Path logs = store.workspaceDir().resolve("job-logs");
        Files.createDirectories(logs);
        String id = UUID.randomUUID().toString();
        Models.Job job = new Models.Job(id, type, projectId, logs.resolve(id + ".log"));
        jobs.put(id, job);
        saveJobs();
        return job;
    }

    private void run(Models.Job job, String... args) throws IOException, InterruptedException {
        job.status = "running";
        job.progress = 10;
        job.startedAt = Instant.now().toString();
        saveJobs();
        appendPersisted(job, "$ " + String.join(" ", commandForDisplay(args)));

        List<String> command = command(args);
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(config.engineDir.toFile());
        builder.redirectErrorStream(true);

        Process process = builder.start();
        Charset charset = Charset.forName(config.engineOutputEncoding);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), charset))) {
            String line;
            while ((line = reader.readLine()) != null) {
                appendPersisted(job, line);
                if (job.progress < 90) {
                    job.progress += 1;
                }
            }
            int exit = process.waitFor();
            job.exitCode = exit;
            job.progress = 100;
            job.finishedAt = Instant.now().toString();
            job.status = exit == 0 ? "succeeded" : "failed";
            job.message = exit == 0 ? "Command completed" : "Command failed with exit code " + exit;
            appendPersisted(job, job.message);
            saveJobs();
        }
    }

    private void fail(Models.Job job, Exception ex) {
        job.status = "failed";
        job.progress = 100;
        job.finishedAt = Instant.now().toString();
        job.message = ex.getMessage();
        appendPersisted(job, "ERROR: " + ex.getMessage());
        try {
            saveJobs();
        } catch (IOException ignored) {
        }
    }

    private void append(Models.Job job, String line) {
        job.append(line == null ? "" : line);
    }

    private void appendPersisted(Models.Job job, String line) {
        String value = line == null ? "" : line;
        append(job, value);
        try {
            Files.writeString(
                Path.of(job.logPath),
                value + System.lineSeparator(),
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND
            );
        } catch (IOException ignored) {
        }
    }

    private void safeSetStatus(String projectId, String status) {
        try {
            store.setStatus(projectId, status);
        } catch (IOException ignored) {
            // The job already records the failure; status persistence is best effort.
        }
    }

    private synchronized void loadJobs() throws IOException {
        if (!Files.exists(jobsFile)) {
            return;
        }
        for (String line : Files.readAllLines(jobsFile, StandardCharsets.UTF_8)) {
            if (line.isBlank()) {
                continue;
            }
            Models.Job job = Models.Job.fromLine(line);
            if ("queued".equals(job.status) || "running".equals(job.status)) {
                job.status = "failed";
                job.progress = 100;
                job.finishedAt = Instant.now().toString();
                job.message = "Backend restarted before task completed";
            }
            loadJobLog(job);
            jobs.put(job.id, job);
        }
        saveJobs();
    }

    private synchronized void saveJobs() throws IOException {
        List<String> lines = new ArrayList<>();
        for (Models.Job job : jobs.values()) {
            lines.add(job.toLine());
        }
        Files.write(jobsFile, lines, StandardCharsets.UTF_8);
    }

    private void loadJobLog(Models.Job job) {
        Path path = Path.of(job.logPath);
        if (!Files.exists(path)) {
            return;
        }
        try {
            List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            int start = Math.max(0, lines.size() - 1000);
            for (int i = start; i < lines.size(); i++) {
                job.append(lines.get(i));
            }
        } catch (IOException ignored) {
        }
    }

    private List<String> command(String[] args) {
        Path script = config.engineDir.resolve("hdl-checker.bat").toAbsolutePath().normalize();
        List<String> command = new ArrayList<>();
        if (isWindows()) {
            command.add("cmd.exe");
            command.add("/c");
        }
        command.add(script.toString());
        command.addAll(Arrays.asList(args));
        return command;
    }

    private List<String> commandForDisplay(String[] args) {
        List<String> out = new ArrayList<>();
        out.add("hdl-checker.bat");
        out.addAll(Arrays.asList(args));
        return out;
    }

    private static boolean isWindows() {
        return System.getProperty("os.name").toLowerCase().contains("win");
    }
}
