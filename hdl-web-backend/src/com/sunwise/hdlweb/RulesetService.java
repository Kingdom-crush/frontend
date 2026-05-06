package com.sunwise.hdlweb;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

final class RulesetService {
    private final Path engineDir;

    RulesetService(Path engineDir) {
        this.engineDir = engineDir.toAbsolutePath().normalize();
    }

    List<Models.Ruleset> listRulesets() {
        List<Models.Ruleset> out = new ArrayList<>();
        Path rulesetsXml = engineDir.resolve("rulesets").resolve("rulesets.xml");
        Map<String, Models.Ruleset> byId = new LinkedHashMap<>();
        if (!Files.exists(rulesetsXml)) {
            return scanUserRulesets(byId);
        }
        try {
            Document doc = parse(rulesetsXml);
            NodeList nodes = doc.getElementsByTagName("ruleset");
            for (int i = 0; i < nodes.getLength(); i++) {
                Element node = (Element) nodes.item(i);
                String refFile = node.getAttribute("refFile");
                Models.Ruleset ruleset = new Models.Ruleset();
                ruleset.refFile = refFile;
                ruleset.name = node.getAttribute("name");
                ruleset.id = idFromRefFile(refFile);
                Path file = resolveRulesetFile(refFile);
                ruleset.available = Files.exists(file);
                ruleset.ruleCount = ruleset.available ? countRules(file) : 0;
                byId.put(ruleset.id, ruleset);
            }
        } catch (Exception ex) {
            Models.Ruleset error = new Models.Ruleset();
            error.id = "error";
            error.name = ex.getMessage();
            error.refFile = rulesetsXml.toString();
            error.available = false;
            error.ruleCount = 0;
            out.add(error);
        }
        out.addAll(scanUserRulesets(byId));
        return out;
    }

    List<Map<String, Object>> listRules(String rulesetId) throws Exception {
        Path file = resolveRulesetFileById(rulesetId);
        if (!Files.exists(file)) {
            return List.of();
        }
        Document doc = parse(file);
        Map<String, String> categories = attrsById(doc, "category", "name");
        Map<String, String> levels = attrsById(doc, "conLevel", "name");
        List<Map<String, Object>> out = new ArrayList<>();
        NodeList nodes = doc.getElementsByTagName("rule");
        for (int i = 0; i < nodes.getLength(); i++) {
            Element node = (Element) nodes.item(i);
            Map<String, Object> rule = new LinkedHashMap<>();
            String category = node.getAttribute("category");
            String level = node.getAttribute("conLevel");
            rule.put("code", node.getAttribute("id"));
            rule.put("name", node.getAttribute("name"));
            rule.put("categoryId", category);
            rule.put("category", categories.getOrDefault(category, category));
            rule.put("levelId", level);
            rule.put("level", levels.getOrDefault(level, level));
            rule.put("language", textOf(node, "language"));
            rule.put("enabled", !"false".equalsIgnoreCase(node.getAttribute("enable")));
            out.add(rule);
        }
        return out;
    }

    Map<String, Map<String, String>> metadata(String rulesetId) {
        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        out.put("categories", Map.of());
        out.put("levels", Map.of());
        try {
            Path file = resolveRulesetFileById(rulesetId);
            if (!Files.exists(file)) {
                return out;
            }
            Document doc = parse(file);
            out.put("categories", attrsById(doc, "category", "name"));
            out.put("levels", attrsById(doc, "conLevel", "name"));
            out.putAll(ruleMetadata(doc));
            return out;
        } catch (Exception ex) {
            return out;
        }
    }

    Models.Ruleset saveCustomRuleset(String displayName, String baseRulesetId, Set<String> enabledRuleIds, Map<String, String> ruleLevels) throws Exception {
        String name = displayName == null || displayName.isBlank() ? "custom_ruleset" : displayName.trim();
        String baseId = baseRulesetId == null || baseRulesetId.isBlank() ? "new_CAST" : baseRulesetId.trim();
        Path baseFile = resolveRulesetFileById(baseId);
        if (!Files.isRegularFile(baseFile)) {
            throw new IllegalArgumentException("Base ruleset not found: " + baseId);
        }

        String id = customId(name);
        Path userDir = engineDir.resolve("rulesets").resolve("user").toAbsolutePath().normalize();
        Files.createDirectories(userDir);
        Path target = userDir.resolve(id + ".xml").normalize();
        if (!target.startsWith(userDir)) {
            throw new IllegalArgumentException("Invalid ruleset id: " + id);
        }

        Document doc = parse(baseFile);
        Element root = doc.getDocumentElement();
        root.setAttribute("id", id);
        root.setAttribute("name", name);
        root.setAttribute("description", "Created by HDL web backend from " + baseId);

        Set<String> enabled = enabledRuleIds == null ? Set.of() : enabledRuleIds;
        Map<String, String> levelOverrides = ruleLevels == null ? Map.of() : ruleLevels;
        NodeList rules = doc.getElementsByTagName("rule");
        for (int i = 0; i < rules.getLength(); i++) {
            Element rule = (Element) rules.item(i);
            String ruleId = rule.getAttribute("id");
            rule.setAttribute("enable", enabled.contains(ruleId) ? "true" : "false");
            String level = normalizeLevel(levelOverrides.get(ruleId));
            if (!level.isBlank()) {
                rule.setAttribute("conLevel", level);
                rule.setAttribute("priority", "L001".equals(level) ? "P001" : "P002");
            }
        }

        writeXml(doc, target);
        upsertRulesetIndex(id, name);

        Models.Ruleset ruleset = new Models.Ruleset();
        ruleset.id = id;
        ruleset.name = name;
        ruleset.refFile = "user/" + id + ".xml";
        ruleset.available = true;
        ruleset.ruleCount = countRules(target);
        return ruleset;
    }

    boolean deleteCustomRuleset(String id) throws Exception {
        if (id == null || !id.startsWith("custom_")) {
            throw new IllegalArgumentException("Only custom rulesets can be deleted");
        }
        Path userDir = engineDir.resolve("rulesets").resolve("user").toAbsolutePath().normalize();
        Path target = userDir.resolve(id + ".xml").normalize();
        if (!target.startsWith(userDir)) {
            throw new IllegalArgumentException("Invalid ruleset id: " + id);
        }
        boolean deleted = Files.deleteIfExists(target);
        removeRulesetIndex(id);
        return deleted;
    }

    private List<Models.Ruleset> scanUserRulesets(Map<String, Models.Ruleset> byId) {
        Path userDir = engineDir.resolve("rulesets").resolve("user");
        if (!Files.isDirectory(userDir)) {
            return new ArrayList<>(byId.values());
        }
        try (var files = Files.list(userDir)) {
            for (Path file : files.filter(path -> path.getFileName().toString().endsWith(".xml")).toList()) {
                String id = idFromRefFile(file.getFileName().toString());
                if (byId.containsKey(id)) {
                    continue;
                }
                Models.Ruleset ruleset = new Models.Ruleset();
                ruleset.id = id;
                ruleset.refFile = "user/" + file.getFileName();
                ruleset.name = rulesetName(file, id);
                ruleset.available = true;
                ruleset.ruleCount = countRules(file);
                byId.put(id, ruleset);
            }
        } catch (Exception ignored) {
        }
        return new ArrayList<>(byId.values());
    }

    private String customId(String name) {
        String base = slug(name);
        if (!base.startsWith("custom_")) {
            base = "custom_" + base;
        }
        return base;
    }

    private static String normalizeLevel(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String level = value.trim();
        if ("L001".equalsIgnoreCase(level) || level.contains("严重")) {
            return "L001";
        }
        if ("L002".equalsIgnoreCase(level) || level.contains("一般")) {
            return "L002";
        }
        return "";
    }

    private void upsertRulesetIndex(String id, String name) throws Exception {
        Path rulesetsXml = engineDir.resolve("rulesets").resolve("rulesets.xml");
        Document doc;
        if (Files.exists(rulesetsXml)) {
            doc = parse(rulesetsXml);
        } else {
            doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().newDocument();
            doc.appendChild(doc.createElement("rulesets"));
        }
        Element root = doc.getDocumentElement();
        NodeList nodes = doc.getElementsByTagName("ruleset");
        String refFile = "user/" + id + ".xml";
        for (int i = 0; i < nodes.getLength(); i++) {
            Element node = (Element) nodes.item(i);
            if (refFile.equals(node.getAttribute("refFile"))) {
                node.setAttribute("name", name);
                writeXml(doc, rulesetsXml);
                return;
            }
        }
        Element node = doc.createElement("ruleset");
        node.setAttribute("name", name);
        node.setAttribute("refFile", refFile);
        root.appendChild(node);
        writeXml(doc, rulesetsXml);
    }

    private void removeRulesetIndex(String id) throws Exception {
        Path rulesetsXml = engineDir.resolve("rulesets").resolve("rulesets.xml");
        if (!Files.exists(rulesetsXml)) {
            return;
        }
        Document doc = parse(rulesetsXml);
        NodeList nodes = doc.getElementsByTagName("ruleset");
        String refFile = "user/" + id + ".xml";
        for (int i = nodes.getLength() - 1; i >= 0; i--) {
            Element node = (Element) nodes.item(i);
            if (refFile.equals(node.getAttribute("refFile"))) {
                node.getParentNode().removeChild(node);
            }
        }
        writeXml(doc, rulesetsXml);
    }

    private static String rulesetName(Path file, String fallback) {
        try {
            Document doc = parse(file);
            String name = doc.getDocumentElement().getAttribute("name");
            return name.isBlank() ? fallback : name;
        } catch (Exception ex) {
            return fallback;
        }
    }

    private Map<String, Map<String, String>> ruleMetadata(Document rulesetDoc) {
        Map<String, String> names = new LinkedHashMap<>();
        Map<String, String> messages = new LinkedHashMap<>();
        Map<String, String> descriptions = new LinkedHashMap<>();
        Map<String, String> specifications = new LinkedHashMap<>();
        Map<String, String> canonicalIds = new LinkedHashMap<>();

        NodeList rules = rulesetDoc.getElementsByTagName("rule");
        for (int i = 0; i < rules.getLength(); i++) {
            Element rule = (Element) rules.item(i);
            String id = rule.getAttribute("id");
            if (id.isBlank()) {
                continue;
            }
            putRuleDetails(id, id, rule, names, messages, descriptions, specifications, canonicalIds);
        }

        Map<String, List<String>> aliasesByRuleId = aliasesByRuleId();
        for (Map.Entry<String, List<String>> entry : aliasesByRuleId.entrySet()) {
            String id = entry.getKey();
            if (!names.containsKey(id)) {
                continue;
            }
            for (String alias : entry.getValue()) {
                names.put(alias, names.get(id));
                messages.put(alias, messages.getOrDefault(id, ""));
                descriptions.put(alias, descriptions.getOrDefault(id, ""));
                specifications.put(alias, specifications.getOrDefault(id, ""));
                canonicalIds.put(alias, id);
            }
        }

        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        out.put("ruleNames", names);
        out.put("ruleMessages", messages);
        out.put("ruleDescriptions", descriptions);
        out.put("ruleSpecifications", specifications);
        out.put("ruleIds", canonicalIds);
        return out;
    }

    private static void putRuleDetails(
        String key,
        String canonicalId,
        Element rule,
        Map<String, String> names,
        Map<String, String> messages,
        Map<String, String> descriptions,
        Map<String, String> specifications,
        Map<String, String> canonicalIds
    ) {
        names.put(key, rule.getAttribute("name"));
        messages.put(key, textOf(rule, "message"));
        descriptions.put(key, textOf(rule, "description"));
        specifications.put(key, textOf(rule, "specification"));
        canonicalIds.put(key, canonicalId);
    }

    private Map<String, List<String>> aliasesByRuleId() {
        Map<String, List<String>> out = new HashMap<>();
        Path root = engineDir.resolve("toif").resolve("toolcheckers");
        if (!Files.isDirectory(root)) {
            return out;
        }
        try (var files = Files.list(root)) {
            for (Path file : files.filter(path -> path.getFileName().toString().endsWith("Reference.xml")).toList()) {
                Document doc = parse(file);
                NodeList items = doc.getElementsByTagName("item");
                for (int i = 0; i < items.getLength(); i++) {
                    Element item = (Element) items.item(i);
                    String id = item.getAttribute("id");
                    String alias = item.getAttribute("name");
                    if (id.isBlank() || alias.isBlank()) {
                        continue;
                    }
                    out.computeIfAbsent(id, ignored -> new ArrayList<>()).add(alias);
                }
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private static Document parse(Path path) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setExpandEntityReferences(false);
        factory.setNamespaceAware(false);
        return factory.newDocumentBuilder().parse(path.toFile());
    }

    private static int countRules(Path path) {
        try {
            Document doc = parse(path);
            return doc.getElementsByTagName("rule").getLength();
        } catch (Exception ex) {
            return 0;
        }
    }

    private static void writeXml(Document doc, Path path) throws Exception {
        TransformerFactory factory = TransformerFactory.newInstance();
        var transformer = factory.newTransformer();
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        transformer.setOutputProperty(OutputKeys.INDENT, "yes");
        transformer.transform(new DOMSource(doc), new StreamResult(path.toFile()));
    }

    private static String slug(String value) {
        String slug = (value == null ? "ruleset" : value)
            .replaceAll("[^A-Za-z0-9_-]+", "_")
            .replaceAll("_+", "_")
            .replaceAll("^_|_$", "")
            .toLowerCase();
        return slug.isBlank() ? "ruleset" : slug;
    }

    private static String idFromRefFile(String refFile) {
        String value = refFile == null ? "" : refFile.replace('\\', '/');
        int slash = value.lastIndexOf('/');
        if (slash >= 0) {
            value = value.substring(slash + 1);
        }
        if (value.endsWith(".xml")) {
            value = value.substring(0, value.length() - 4);
        }
        if (value.endsWith("规则集")) {
            value = value.substring(0, value.length() - "规则集".length());
        }
        return value.isBlank() ? "unknown" : value;
    }

    private Path resolveRulesetFile(String refFile) {
        String normalized = refFile == null ? "" : refFile.replace('\\', '/');
        Path direct = engineDir.resolve("rulesets").resolve(normalized).normalize();
        if (Files.exists(direct)) {
            return direct;
        }

        String id = idFromRefFile(refFile);
        Path fallback = engineDir.resolve("rulesets").resolve("user").resolve(id + ".xml").normalize();
        if (Files.exists(fallback)) {
            return fallback;
        }
        return direct;
    }

    private Path resolveRulesetFileById(String rulesetId) {
        for (Models.Ruleset ruleset : listRulesets()) {
            if (ruleset.id.equals(rulesetId)) {
                return resolveRulesetFile(ruleset.refFile);
            }
        }
        return engineDir.resolve("rulesets").resolve("user").resolve(rulesetId + ".xml").normalize();
    }

    private static Map<String, String> attrsById(Document doc, String tagName, String valueAttr) {
        Map<String, String> out = new LinkedHashMap<>();
        NodeList nodes = doc.getElementsByTagName(tagName);
        for (int i = 0; i < nodes.getLength(); i++) {
            Element node = (Element) nodes.item(i);
            out.put(node.getAttribute("id"), node.getAttribute(valueAttr));
        }
        return out;
    }

    private static String textOf(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return "";
        }
        return nodes.item(0).getTextContent().trim();
    }
}
