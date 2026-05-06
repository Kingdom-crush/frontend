package com.sunwise.hdlweb;

import java.nio.file.Files;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) throws Exception {
        Config config = Config.fromEnv();
        Files.createDirectories(config.workspaceDir);

        ProjectStore store = new ProjectStore(config.workspaceDir);
        ViolationAuditStore auditStore = new ViolationAuditStore();
        SourceSelectionStore sourceSelectionStore = new SourceSelectionStore();
        RulesetService rulesets = new RulesetService(config.engineDir);
        ReportTemplateService reportTemplates = new ReportTemplateService(config.engineDir, config.workspaceDir);
        EngineRunner engine = new EngineRunner(config, store, sourceSelectionStore);
        WebServer server = new WebServer(config, store, auditStore, sourceSelectionStore, rulesets, reportTemplates, engine);
        server.start();
        Thread.currentThread().join();
    }
}
