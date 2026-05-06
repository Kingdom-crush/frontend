package com.sunwise.hdlweb;

import java.util.ArrayList;
import java.util.List;
import java.nio.file.Path;

final class Config {
    final int port;
    final Path engineDir;
    final Path workspaceDir;
    final Path frontendDir;
    final String engineOutputEncoding;
    final List<Path> sourceRoots;

    private Config(int port, Path engineDir, Path workspaceDir, Path frontendDir, String engineOutputEncoding, List<Path> sourceRoots) {
        this.port = port;
        this.engineDir = engineDir.toAbsolutePath().normalize();
        this.workspaceDir = workspaceDir.toAbsolutePath().normalize();
        this.frontendDir = frontendDir.toAbsolutePath().normalize();
        this.engineOutputEncoding = engineOutputEncoding;
        this.sourceRoots = normalizeRoots(sourceRoots, this.workspaceDir);
    }

    static Config fromEnv() {
        String portValue = valueOrDefault(System.getenv("HDL_BACKEND_PORT"), "18080");
        String engineValue = valueOrDefault(System.getenv("HDL_ENGINE_DIR"), "../hdl-checker20260422");
        String workspaceValue = valueOrDefault(System.getenv("HDL_WORKSPACE_DIR"), "./workspace");
        String frontendValue = valueOrDefault(System.getenv("HDL_FRONTEND_DIR"), "../demo");
        String encodingValue = valueOrDefault(System.getenv("HDL_ENGINE_OUTPUT_ENCODING"), defaultEngineEncoding());
        String sourceRootsValue = valueOrDefault(System.getenv("HDL_SOURCE_ROOTS"), "");

        return new Config(
            Integer.parseInt(portValue),
            Path.of(engineValue),
            Path.of(workspaceValue),
            Path.of(frontendValue),
            encodingValue,
            parseSourceRoots(sourceRootsValue)
        );
    }

    private static String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static List<Path> parseSourceRoots(String value) {
        List<Path> roots = new ArrayList<>();
        if (!value.isBlank()) {
            for (String item : value.split(";")) {
                if (!item.isBlank()) {
                    roots.add(Path.of(item.trim()));
                }
            }
        }
        if (roots.isEmpty()) {
            roots.add(Path.of("."));
        }
        return roots;
    }

    private static List<Path> normalizeRoots(List<Path> roots, Path workspaceDir) {
        List<Path> out = new ArrayList<>();
        for (Path root : roots) {
            addUnique(out, root.toAbsolutePath().normalize());
        }
        addUnique(out, workspaceDir.toAbsolutePath().normalize());
        return List.copyOf(out);
    }

    private static void addUnique(List<Path> roots, Path root) {
        for (Path existing : roots) {
            if (existing.equals(root)) {
                return;
            }
        }
        roots.add(root);
    }

    private static String defaultEngineEncoding() {
        return System.getProperty("os.name").toLowerCase().contains("win") ? "GBK" : "UTF-8";
    }
}
