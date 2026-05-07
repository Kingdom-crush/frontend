(() => {
  const sameOriginApi = location.protocol.startsWith("http") ? `${location.origin}/api` : "http://localhost:18080/api";
  let API_BASE = localStorage.getItem("hdlBackendUrl") || sameOriginApi;
  const BACKEND = { connected: false, health: null, loading: false, reportTemplates: [] };
  const TASK_CENTER = { selectedId: null, timer: null, jobs: [] };
  const DIR_BROWSER = { path: "", parent: "", loaded: false };
  const DEFAULT_RESULT_PAGE_SIZE = Number(localStorage.getItem("hdlResultPageSize") || 100);
  const originals = {
    addProject,
    loadNextProject,
    runCheck,
    exportReport,
    openFile,
    openModal,
    setStatus,
    setStatusValue,
    removeProject,
    saveProject,
    openProjectReport,
    renderDetail,
    addRuleset
  };

  function isBackendProject(project = CP()) {
    return Boolean(project && project.backendId);
  }

  function backendUrl(path) {
    return `${API_BASE}${path}`;
  }

  async function api(path, options = {}) {
    const init = { ...options, headers: { ...(options.headers || {}) } };
    if (init.body && typeof init.body !== "string") {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(init.body);
    }
    const response = await fetch(backendUrl(path), init);
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        message = JSON.parse(text).error || message;
      } catch {
        // Keep the raw response text.
      }
      throw new Error(message || `HTTP ${response.status}`);
    }
    return text ? JSON.parse(text) : null;
  }

  async function apiText(path) {
    const response = await fetch(backendUrl(path));
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `HTTP ${response.status}`);
    }
    return text;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function ensureBackendControls() {
    if ($("backendStatus")) return;
    const host = document.querySelector(".toolbar-meta");
    const statusNode = document.createElement("span");
    statusNode.id = "backendStatus";
    statusNode.className = "backend-pill probing";
    statusNode.textContent = "后端: 连接中";
    const refreshButton = document.createElement("button");
    refreshButton.id = "backendRefreshBtn";
    refreshButton.className = "backend-action";
    refreshButton.type = "button";
    refreshButton.textContent = "刷新后端";
    refreshButton.addEventListener("click", () => initializeBackend(true));
    const taskButton = document.createElement("button");
    taskButton.id = "backendTasksBtn";
    taskButton.className = "backend-action";
    taskButton.type = "button";
    taskButton.textContent = "任务中心";
    taskButton.addEventListener("click", () => openTaskCenter());
    host.prepend(taskButton);
    host.prepend(refreshButton);
    host.prepend(statusNode);
  }

  function setBackendStatus(kind, text) {
    const node = $("backendStatus");
    if (!node) return;
    node.className = `backend-pill ${kind}`;
    node.textContent = text;
  }

  function syncReportFormatAvailability() {
    const select = E.reportFormatSelect;
    if (!select) return;
    [...select.options].forEach(option => {
      option.dataset.originalLabel ||= option.textContent;
      const isHtml = option.value.toUpperCase() === "HTML";
      option.disabled = BACKEND.connected && !isHtml;
      option.textContent = option.disabled
        ? `${option.dataset.originalLabel}（后端暂不支持）`
        : option.dataset.originalLabel;
    });
    if (BACKEND.connected && select.value.toUpperCase() !== "HTML") {
      select.value = "HTML";
      S.format = "HTML";
    }
  }

  function mergeRuleset(raw, rules) {
    const mapped = {
      id: raw.id,
      name: raw.name || raw.id,
      type: raw.available ? "backend" : "missing",
      available: raw.available,
      ruleCount: raw.ruleCount || 0,
      rules: (rules || []).map(rule => ({
        code: rule.code || "-",
        name: rule.name || "-",
        cat: rule.category || "-",
        sev: levelToSeverity(rule.level),
        on: rule.enabled !== false
      }))
    };
    const index = RULESETS.findIndex(item => item.id === mapped.id);
    if (index >= 0) Object.assign(RULESETS[index], mapped);
    else RULESETS.push(mapped);
  }

  function levelToSeverity(level) {
    return String(level || "").includes("严重") ? "严重违规" : "一般违规";
  }

  async function loadRulesets() {
    const data = await api("/rulesets");
    const available = (data.rulesets || []).filter(item => item.available);
    await Promise.all(available.map(async item => {
      let rules = [];
      try {
        const detail = await api(`/rulesets/${encodeURIComponent(item.id)}/rules`);
        rules = detail.rules || [];
      } catch {
        rules = [{
          code: item.id,
          name: `后端规则集，共 ${item.ruleCount || 0} 条规则`,
          category: "规则集",
          level: "一般错误",
          enabled: true
        }];
      }
      mergeRuleset(item, rules);
    }));
    return available;
  }

  async function loadReportTemplates() {
    const data = await api("/report-templates?format=html");
    BACKEND.reportTemplates = data.templates || [];
    if (!BACKEND.reportTemplates.length) {
      BACKEND.reportTemplates = [{ id: "default_html", name: "默认 HTML 报告模板", format: "html" }];
    }
    for (const project of PROJECTS.filter(isBackendProject)) {
      applyReportTemplates(project);
    }
    return BACKEND.reportTemplates;
  }

  function applyReportTemplates(project) {
    project.templates = BACKEND.reportTemplates.map(template => template.name);
    project.backendTemplateIds = Object.fromEntries(BACKEND.reportTemplates.map(template => [template.name, template.id]));
    if (!project.templates.length) {
      project.templates = ["默认 HTML 报告模板"];
      project.backendTemplateIds = { "默认 HTML 报告模板": "default_html" };
    }
  }

  async function loadProjects(preferBackend = false) {
    const data = await api("/projects");
    const rawProjects = data.projects || [];
    const knownIds = new Set(rawProjects.map(item => `backend:${item.id}`));
    for (let i = PROJECTS.length - 1; i >= 0; i -= 1) {
      if (PROJECTS[i].backendId && !knownIds.has(PROJECTS[i].id)) {
        PROJECTS.splice(i, 1);
      }
    }

    const mapped = [];
    for (const raw of rawProjects) {
      mapped.push(await mapProject(raw));
    }

    if (mapped.length && (preferBackend || !isBackendProject(CP()))) {
      S.pid = mapped[0].id;
      S.vid = mapped[0].vs[0]?.id || "";
      S.page = "report";
      S.openFiles = [];
      S.selectedRows = [];
      S.lastSelected = null;
    }
    if (mapped.length) {
      renderAll(`已从后端刷新工程列表：${mapped.length} 个工程。当前工程：${CP().name}`);
    } else {
      renderAll("已连接后端，尚未创建后端工程");
    }
  }

  async function mapProject(raw) {
    const id = `backend:${raw.id}`;
    let project = PROJECTS.find(item => item.id === id);
    if (!project) {
      project = {};
      PROJECTS.push(project);
    }

    Object.assign(project, {
      id,
      backendId: raw.id,
      name: raw.name || raw.id,
      analyst: raw.analyst || "server",
      path: raw.sourcePath || raw.projectPath,
      backendProjectPath: raw.projectPath,
      mode: "服务器源码目录",
      ruleset: ensureRuleset(raw.ruleset),
      templates: [],
      stats: { ce: 0, vc: 0, loc: 0, fc: 0, rc: ruleCount(raw.ruleset), rt: 0, start: "-", end: "-" },
      treeOrder: [],
      sources: [],
      groups: [],
      files: [["暂无数据", 1, "steel"]],
      rules: [["暂无数据", 1, "steel"]],
      vs: [emptyViolation()],
      fileContents: [],
      run: runFromStatus(raw.status)
    });
    applyReportTemplates(project);

    await hydrateSources(project);
    await hydrateResults(project);
    return project;
  }

  function ensureRuleset(id) {
    if (RULESETS.some(item => item.id === id)) return id;
    RULESETS.push({ id, name: id, type: "backend", available: true, ruleCount: 0, rules: [] });
    return id;
  }

  function ruleCount(id) {
    return RULESETS.find(item => item.id === id)?.ruleCount || RULESETS.find(item => item.id === id)?.rules?.length || 0;
  }

  function runFromStatus(rawStatus) {
    const statusValue = rawStatus || "ready";
    return {
      p: "完成",
      r: "完成",
      x: statusValue === "analyzing" ? "执行中" : "待执行",
      o: statusValue === "analyzed" ? "完成" : "待执行",
      pct: statusValue === "analyzed" ? 100 : 0,
      log: [`[backend] 工程状态: ${statusValue}`]
    };
  }

  async function hydrateSources(project) {
    try {
      const data = await api(`/projects/${encodeURIComponent(project.backendId)}/source-tree`);
      const files = (data.files || []).filter(item => !item.directory);
      project.sourceStats = data.stats || null;
      project.sources = files.map(item => [
        item.path,
        languageOf(item.path),
        sourceKindLabel(item.kind),
        sourceStatusLabel(item),
        sourceActionButton(item)
      ]);
      project.fileContents = files.map(item => {
        const old = project.fileContents?.find(file => file[0] === item.path);
        return old || [item.path, languageOf(item.path), "点击源文件后从后端读取内容。"];
      });
      project.treeOrder = [...new Set(files.map(item => item.path.split("/")[0]).filter(Boolean))];
      if (project.sourceStats) {
        project.stats.fc = number(project.sourceStats.hdlFileCount, files.length);
        project.stats.loc = number(project.sourceStats.totalLines, project.stats.loc);
      }
      try {
        project.designSummary = await api(`/projects/${encodeURIComponent(project.backendId)}/design-summary`);
      } catch (error) {
        project.designSummary = null;
        project.run.log.push(`[design-summary] ${error.message}`);
      }
    } catch (error) {
      project.sources = [];
      project.fileContents = [];
      project.run.log.push(`[source-tree] ${error.message}`);
    }
  }

  function sourceKindLabel(kind) {
    if (kind === "hdl") return "HDL 源码";
    if (kind === "constraint") return "约束文件";
    if (kind === "folder") return "目录";
    return "附属文件";
  }

  function sourceStatusLabel(item) {
    if (item.kind === "other") return "可查看";
    return item.included === false ? "已排除" : "已纳入";
  }

  function sourceActionButton(item) {
    if (item.kind === "other") return "";
    const next = item.included === false ? "true" : "false";
    return `<button data-toggle-source="${escapeAttr(item.path)}" data-include="${next}" type="button">${next === "true" ? "纳入" : "排除"}</button>`;
  }

  async function toggleSourceSelection(path, included) {
    const project = CP();
    if (!BACKEND.connected || !isBackendProject(project)) return false;
    try {
      await api(`/projects/${encodeURIComponent(project.backendId)}/source-selection`, {
        method: "POST",
        body: { path, included: included ? "true" : "false" }
      });
      await hydrateSources(project);
      renderProjectTree();
      renderProject();
      renderReport();
      status(`${included ? "已纳入" : "已排除"}源文件 ${path}`);
      return true;
    } catch (error) {
      status(`更新源文件选择失败: ${error.message}`);
      return false;
    }
  }

  async function hydrateResults(project, overrides = {}) {
    try {
      const query = resultQuery(project, overrides);
      const params = new URLSearchParams({
        page: String(query.page),
        pageSize: String(query.pageSize),
        search: query.search,
        status: query.status,
        sort: query.sort,
        dir: query.dir
      });
      const data = await api(`/projects/${encodeURIComponent(project.backendId)}/results?${params}`);
      if (!data.available) return;
      const summary = data.summary || {};
      const violations = (data.violations || []).map(item => mapViolation(project, item));
      project.backendPagination = data.pagination || null;
      project.backendAuditSummary = data.auditSummary || null;
      if (project.backendPagination) {
        query.page = project.backendPagination.page || query.page;
        query.pageSize = project.backendPagination.pageSize || query.pageSize;
      }
      project.backendResultQuery = query;
      project.stats = {
        ce: number(summary["error.num"]),
        vc: number(summary["vio.num"], project.backendPagination?.total || violations.length),
        loc: number(summary.loc, number(project.sourceStats?.totalLines)),
        fc: number(summary["file.count"], number(project.sourceStats?.hdlFileCount, project.sources.length)),
        rc: ruleCount(project.ruleset),
        rt: runtimeSeconds(summary["start.time"], summary["end.time"]),
        start: summary["start.time"] || "-",
        end: summary["end.time"] || "-"
      };
      project.vs = violations.length ? violations : [emptyViolation()];
      project.groups = groupViolations(project.vs, project.stats.vc);
      project.files = topCounts(project.vs, item => baseName(item.file));
      project.rules = topCounts(project.vs, item => item.rid);
      if (S.pid === project.id && !project.vs.some(item => item.id === S.vid)) {
        S.vid = project.vs[0].id;
      }
    } catch (error) {
      project.run.log.push(`[results] ${error.message}`);
    }
  }

  function resultQuery(project, overrides = {}) {
    const previous = project.backendResultQuery || {};
    return {
      page: number(overrides.page, number(previous.page, 1)) || 1,
      pageSize: number(overrides.pageSize, number(previous.pageSize, DEFAULT_RESULT_PAGE_SIZE)) || DEFAULT_RESULT_PAGE_SIZE,
      search: overrides.search !== undefined ? String(overrides.search) : (previous.search ?? S.rsearch ?? ""),
      status: overrides.status !== undefined ? String(overrides.status) : (previous.status || "all"),
      sort: overrides.sort || previous.sort || S.sortKey || "file",
      dir: overrides.dir || previous.dir || S.sortDir || "asc"
    };
  }

  function mapViolation(project, raw) {
    const file = relativeToSource(project, raw.file || "");
    const rule = raw.rule || "-";
    const message = raw.message || raw.text || "-";
    const ruleTitle = raw.ruleName || message;
    const ruleMessage = raw.ruleMessage || message;
    const ruleDescription = raw.ruleDescription || "";
    const ruleSpecification = raw.ruleSpecification || "";
    const level = raw.levelName || raw.level || raw.levelId || "-";
    const category = raw.categoryName || raw.category || raw.categoryId || "-";
    const detail = [
      `规则: ${rule}${raw.ruleId && raw.ruleId !== rule ? ` (${raw.ruleId})` : ""}`,
      `等级: ${level}${raw.levelId && raw.levelId !== level ? ` (${raw.levelId})` : ""}`,
      `分类: ${category}${raw.categoryId && raw.categoryId !== category ? ` (${raw.categoryId})` : ""}`,
      ruleDescription ? `说明: ${ruleDescription}` : "",
      ruleSpecification ? `示例:\n${ruleSpecification}` : ""
    ].filter(Boolean).join("\n");
    return {
      id: raw.id,
      rid: rule,
      tip: ruleTitle,
      st: toUiStatus(raw.status),
      file,
      line: number(raw.line),
      conf: number(raw.confidence),
      level,
      category,
      info: message,
      note: raw.note || "",
      msg: ruleMessage,
      ex: detail,
      circuit: file ? `${baseName(file)} 电路结构` : "电路结构"
    };
  }

  function relativeToSource(project, value) {
    const normalized = normalize(value);
    const root = normalize(project.path || "");
    if (root && normalized.startsWith(root)) {
      return normalized.slice(root.length).replace(/^\/+/, "");
    }
    return value.replace(/\\/g, "/");
  }

  function emptyViolation() {
    return {
      id: "empty",
      rid: "-",
      tip: "暂无检查结果",
      st: "未确认",
      file: "",
      line: "",
      conf: "",
      info: "运行检查后显示后端返回的结果。",
      note: "",
      msg: "当前工程还没有可展示的检查结果。",
      ex: "点击“运行检查”后刷新。",
      circuit: "暂无电路图"
    };
  }

  function groupViolations(rows, total) {
    if (!total) return [{ id: "empty-group", label: "暂无检查结果", items: [{ id: "empty", text: "运行检查后显示结果" }] }];
    const map = new Map();
    rows.forEach(row => {
      const label = row.ex.match(/分类: (.*)/)?.[1] || "未分类";
      if (!map.has(label)) map.set(label, []);
      map.get(label).push({ id: row.id, text: `${row.rid} ${row.tip}` });
    });
    return [...map].map(([label, items], index) => ({
      id: `backend-group-${index}`,
      label: `${label}（${items.length}项）`,
      items
    }));
  }

  function topCounts(rows, getter) {
    const valid = rows.filter(item => item.id !== "empty");
    if (!valid.length) return [["暂无数据", 1, "steel"]];
    const tones = ["steel", "cyan", "purple", "violet", "steel"];
    const map = new Map();
    valid.forEach(item => {
      const key = getter(item) || "-";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count], index) => [label, count, tones[index] || "steel"]);
  }

  function languageOf(path) {
    const name = path.toLowerCase();
    if (name.endsWith(".vhd") || name.endsWith(".vhdl")) return "VHDL";
    if (name.endsWith(".v") || name.endsWith(".sv")) return "Verilog";
    if (name.endsWith(".json")) return "JSON";
    if (name.endsWith(".html") || name.endsWith(".htm")) return "HTML";
    return "Text";
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function runtimeSeconds(start, end) {
    if (!start || !end) return 0;
    const startDate = Date.parse(start.replace(" ", "T"));
    const endDate = Date.parse(end.replace(" ", "T"));
    if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) return 0;
    return Math.max(0, Math.round((endDate - startDate) / 1000));
  }

  function toUiStatus(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "violation" || normalized === "违反") return "违反";
    if (normalized === "not_violation" || normalized === "pass" || normalized === "不违反") return "不违反";
    return "未确认";
  }

  function toBackendStatus(value) {
    if (value === "违反") return "violation";
    if (value === "不违反") return "not_violation";
    return "unconfirmed";
  }

  async function reportFiles(project) {
    const data = await api(`/projects/${encodeURIComponent(project.backendId)}/reports`);
    return data.files || [];
  }

  function reportFileUrl(project, path = "report.html") {
    return backendUrl(`/projects/${encodeURIComponent(project.backendId)}/reports/file?path=${encodeURIComponent(path)}`);
  }

  async function openGeneratedReport(generateIfMissing = true) {
    const project = CP();
    if (!BACKEND.connected || !isBackendProject(project)) {
      openReport(`已打开工程 ${CP().name} 的分析报告`);
      return;
    }
    const popup = window.open("", "_blank");
    try {
      status("正在检查后端 HTML 报告...");
      const files = await reportFiles(project);
      const html = files.find(file => file.path === "report.html") || files.find(file => /\.html?$/i.test(file.path));
      if (html) {
        if (popup) popup.location.href = reportFileUrl(project, html.path);
        else window.open(reportFileUrl(project, html.path), "_blank");
        status(`已打开 HTML 报告: ${html.path}`);
        return;
      }
      if (!generateIfMissing) {
        if (popup) popup.close();
        status("当前工程还没有 HTML 报告，请先生成报告");
        return;
      }
      await generateHtmlReport(project, popup);
    } catch (error) {
      if (popup) popup.close();
      status(`打开报告失败: ${error.message}`);
    }
  }

  openProjectReport = async function openBackendProjectReport() {
    const project = CP();
    if (!BACKEND.connected || !isBackendProject(project)) {
      return originals.openProjectReport();
    }
    return openGeneratedReport(true);
  };

  async function generateHtmlReport(project, popup) {
    status("正在生成后端 HTML 报告...");
    const templateId = project.backendTemplateIds?.[S.tpl] || BACKEND.reportTemplates[0]?.id || "default_html";
    const created = await api(`/projects/${encodeURIComponent(project.backendId)}/report`, {
      method: "POST",
      body: { format: "html", template: templateId }
    });
    if (isTaskCenterOpen()) refreshTaskCenter(false);
    const job = await pollJob(created.job.id);
    if (isTaskCenterOpen()) refreshTaskCenter(false);
    if (job.status !== "succeeded") {
      const log = await apiText(`/jobs/${encodeURIComponent(job.id)}/log`).catch(() => "");
      throw new Error(log || job.message || "生成报告失败");
    }
    if (popup) popup.location.href = reportFileUrl(project);
    else window.open(reportFileUrl(project), "_blank");
    status("HTML 报告已生成并打开");
  }

  async function pollJob(jobId, onUpdate) {
    let latest = null;
    for (let i = 0; i < 360; i += 1) {
      const data = await api(`/jobs/${encodeURIComponent(jobId)}`);
      latest = data.job;
      onUpdate?.(latest);
      if (["succeeded", "failed"].includes(latest.status)) return latest;
      await sleep(700);
    }
    throw new Error("任务超时");
  }

  function updateRunFromJob(run, job) {
    run.x = job.status === "running" ? "执行中" : job.status === "succeeded" ? "完成" : "待执行";
    run.o = job.status === "succeeded" ? "完成" : "待执行";
    run.pct = job.progress || 0;
    run.log.push(`[${job.type}] ${job.status} ${job.progress || 0}% ${job.message || ""}`.trim());
    renderRun(run);
    if (isTaskCenterOpen()) refreshTaskCenter(false);
  }

  async function refreshOneProject(backendId) {
    const data = await api("/projects");
    const raw = (data.projects || []).find(item => item.id === backendId);
    if (!raw) throw new Error("后端工程不存在");
    return mapProject(raw);
  }

  async function refreshBackendResults(overrides = {}, message = "已刷新后端结果分页") {
    const project = CP();
    if (!BACKEND.connected || !isBackendProject(project)) return false;
    await hydrateResults(project, overrides);
    if (!project.vs.some(item => item.id === S.vid)) {
      S.vid = project.vs[0]?.id || "";
    }
    S.selectedRows = [];
    S.lastSelected = null;
    renderBrowser();
    renderReport();
    renderDetail();
    renderHelp();
    status(message);
    return true;
  }

  function renderBackendPager() {
    const pager = $("backendResultPager");
    if (!pager) return;
    const project = CP();
    if (!BACKEND.connected || !isBackendProject(project) || !project.backendPagination) {
      pager.classList.add("hidden");
      return;
    }
    const page = project.backendPagination;
    const audit = project.backendAuditSummary;
    pager.classList.remove("hidden");
    $("backendResultPagerInfo").textContent = audit
      ? `已审计 ${audit.audited}/${audit.total} 条，筛选 ${page.filteredTotal} 条，第 ${page.page}/${page.pageCount} 页`
      : `共 ${page.total} 条，筛选 ${page.filteredTotal} 条，第 ${page.page}/${page.pageCount} 页`;
    $("backendResultPageInput").value = page.page;
    $("backendResultPageInput").max = page.pageCount;
    $("backendResultPageSizeSelect").value = String(page.pageSize);
    $("backendResultPrevBtn").disabled = page.page <= 1;
    $("backendResultNextBtn").disabled = page.page >= page.pageCount;
    if (audit) {
      E.auditedSummary.textContent = `已审计 ${audit.audited}/${audit.total} 条，违反 ${audit.violation} 条，不违反 ${audit.notViolation} 条，未确认 ${audit.unconfirmed} 条`;
      E.metricAuditState.textContent = `${audit.audited}/${audit.total} 已审计`;
      E.infoAudited.textContent = `${audit.audited} 条`;
    } else {
      E.auditedSummary.textContent = `共 ${page.total} 条，筛选 ${page.filteredTotal} 条，第 ${page.page}/${page.pageCount} 页`;
    }
  }

  async function persistAudit(ids, statusValue, note = "") {
    const project = CP();
    const validIds = ids.filter(id => id && id !== "empty");
    if (!BACKEND.connected || !isBackendProject(project) || !validIds.length) return;
    await api(`/projects/${encodeURIComponent(project.backendId)}/violations`, {
      method: "POST",
      body: { ids: validIds.join(","), status: toBackendStatus(statusValue), note }
    });
  }

  async function persistFilteredAudit(statusValue, note = "") {
    const project = CP();
    if (!BACKEND.connected || !isBackendProject(project)) return 0;
    const query = project.backendResultQuery || {};
    const result = await api(`/projects/${encodeURIComponent(project.backendId)}/violations`, {
      method: "POST",
      body: {
        allMatching: "true",
        status: toBackendStatus(statusValue),
        note,
        search: query.search || S.rsearch || "",
        filterStatus: query.status || "all",
        sort: query.sort || S.sortKey || "file",
        dir: query.dir || S.sortDir || "asc"
      }
    });
    return result.updated || 0;
  }

  function taskStatusLabel(statusValue) {
    const labels = {
      queued: "排队中",
      running: "执行中",
      succeeded: "成功",
      failed: "失败"
    };
    return labels[statusValue] || statusValue || "-";
  }

  function taskTypeLabel(type) {
    const labels = {
      create: "创建工程",
      analyze: "运行检查",
      report: "生成报告"
    };
    return labels[type] || type || "-";
  }

  function taskTime(job) {
    return job.finishedAt || job.startedAt || job.createdAt || "";
  }

  function formatTaskTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function isTaskCenterOpen() {
    return !$("backendTaskModal")?.classList.contains("hidden");
  }

  async function openTaskCenter() {
    if (!BACKEND.connected) {
      status("后端未连接，无法打开任务中心");
      return;
    }
    $("backendTaskModal")?.classList.remove("hidden");
    await refreshTaskCenter();
    clearInterval(TASK_CENTER.timer);
    TASK_CENTER.timer = setInterval(() => {
      if (isTaskCenterOpen()) refreshTaskCenter(false);
    }, 2500);
  }

  function closeTaskCenter() {
    $("backendTaskModal")?.classList.add("hidden");
    clearInterval(TASK_CENTER.timer);
    TASK_CENTER.timer = null;
  }

  async function refreshTaskCenter(showLoading = true) {
    if (!BACKEND.connected) return;
    const summary = $("backendTaskSummary");
    if (showLoading && summary) summary.textContent = "正在加载任务...";
    try {
      const data = await api("/jobs");
      TASK_CENTER.jobs = (data.jobs || []).sort((a, b) => String(taskTime(b)).localeCompare(String(taskTime(a))));
      if (!TASK_CENTER.selectedId || !TASK_CENTER.jobs.some(job => job.id === TASK_CENTER.selectedId)) {
        TASK_CENTER.selectedId = TASK_CENTER.jobs[0]?.id || null;
      }
      renderTaskList();
      if (TASK_CENTER.selectedId) await renderTaskLog(TASK_CENTER.selectedId);
      else renderEmptyTaskLog("暂无任务");
    } catch (error) {
      if (summary) summary.textContent = `任务加载失败: ${error.message}`;
      renderEmptyTaskLog(error.message);
    }
  }

  function renderTaskList() {
    const list = $("backendTaskList");
    const summary = $("backendTaskSummary");
    if (!list) return;
    if (summary) {
      const running = TASK_CENTER.jobs.filter(job => ["queued", "running"].includes(job.status)).length;
      summary.textContent = `共 ${TASK_CENTER.jobs.length} 个任务，${running} 个未完成`;
    }
    if (!TASK_CENTER.jobs.length) {
      list.innerHTML = `<div class="task-item"><strong>暂无任务</strong><span>创建工程、运行检查或生成报告后会出现在这里。</span></div>`;
      return;
    }
    list.innerHTML = TASK_CENTER.jobs.map(job => `
      <div class="task-item ${job.id === TASK_CENTER.selectedId ? "active" : ""}" data-task-id="${job.id}" role="button" tabindex="0">
        <strong>${taskTypeLabel(job.type)} · ${job.progress || 0}%</strong>
        <span class="task-status ${job.status}">${taskStatusLabel(job.status)}</span>
        <span>工程: ${job.projectName || job.projectId || "-"}</span>
        <span>${formatTaskTime(taskTime(job))}</span>
        <span>${job.message || ""}</span>
        ${retryableTask(job) ? `<button class="task-retry" data-retry-task="${job.id}" type="button">重试</button>` : ""}
      </div>
    `).join("");
  }

  async function renderTaskLog(jobId) {
    const job = TASK_CENTER.jobs.find(item => item.id === jobId);
    const title = $("backendTaskLogTitle");
    const log = $("backendTaskLog");
    if (title) title.textContent = job ? `${taskTypeLabel(job.type)} · ${taskStatusLabel(job.status)} · ${job.id}` : jobId;
    if (log) log.textContent = "正在读取日志...";
    try {
      const text = await apiText(`/jobs/${encodeURIComponent(jobId)}/log`);
      if (log) log.textContent = text || "该任务暂无日志。";
    } catch (error) {
      if (log) log.textContent = `读取日志失败: ${error.message}`;
    }
  }

  function renderEmptyTaskLog(message) {
    const title = $("backendTaskLogTitle");
    const log = $("backendTaskLog");
    if (title) title.textContent = "请选择任务";
    if (log) log.textContent = message || "";
  }

  async function selectTask(jobId) {
    TASK_CENTER.selectedId = jobId;
    renderTaskList();
    await renderTaskLog(jobId);
  }

  function retryableTask(job) {
    return job?.status === "failed" && ["analyze", "report"].includes(job.type) && job.projectId;
  }

  async function retryTask(jobId) {
    const job = TASK_CENTER.jobs.find(item => item.id === jobId);
    if (!retryableTask(job)) {
      status("该任务暂不支持重试");
      return;
    }
    try {
      status(`正在重试任务: ${taskTypeLabel(job.type)}`);
      const projectData = await api(`/projects/${encodeURIComponent(job.projectId)}`);
      const project = projectData.project;
      const created = job.type === "analyze"
        ? await api(`/projects/${encodeURIComponent(job.projectId)}/analyze`, {
          method: "POST",
          body: { ruleset: project.ruleset || "new_CAST" }
        })
        : await api(`/projects/${encodeURIComponent(job.projectId)}/report`, {
          method: "POST",
          body: { format: "html" }
        });
      await refreshTaskCenter(false);
      TASK_CENTER.selectedId = created.job.id;
      renderTaskList();
      await renderTaskLog(created.job.id);
      const retried = await pollJob(created.job.id, () => {
        if (isTaskCenterOpen()) refreshTaskCenter(false);
      });
      await refreshTaskCenter(false);
      if (retried.status === "succeeded") {
        await loadProjects(true);
        status(`任务重试成功: ${taskTypeLabel(job.type)}`);
      } else {
        status(`任务重试失败: ${retried.message || "请查看日志"}`);
      }
    } catch (error) {
      status(`任务重试失败: ${error.message}`);
      await refreshTaskCenter(false).catch(() => {});
    }
  }

  function backendRulesetOptions() {
    const options = RULESETS.filter(item => item.type === "backend" && item.available !== false);
    return options.length ? options : RULESETS.filter(item => item.id.startsWith("new_"));
  }

  function suggestedProjectName(sourcePath) {
    const clean = String(sourcePath || "").replace(/[\\/]+$/, "");
    return baseName(clean) || `project_${Date.now()}`;
  }

  function setProjectDialogError(message) {
    const box = $("backendProjectError");
    if (!box) return;
    box.textContent = message || "";
    box.classList.toggle("hidden", !message);
  }

  async function validateSourcePath(sourcePath) {
    const info = await api("/source/validate", {
      method: "POST",
      body: { sourcePath }
    });
    if (!info.directory) {
      throw new Error(`源码目录不存在或不是文件夹: ${sourcePath}`);
    }
    if (!Number(info.hdlFileCount || 0)) {
      throw new Error(`源码目录中没有发现 HDL 文件: ${sourcePath}`);
    }
    status(`源码目录校验通过: ${info.hdlFileCount} 个 HDL 文件 / ${info.fileCount} 个文件`);
    return info;
  }

  function supportsDirectoryBrowser() {
    return Array.isArray(BACKEND.health?.capabilities)
      && BACKEND.health.capabilities.includes("filesystem-browser");
  }

  function setDirectoryBrowserVisible(visible) {
    $("backendDirectoryBrowser")?.classList.toggle("hidden", !visible);
  }

  async function loadDirectoryBrowser(path = "", fallbackToRoots = false) {
    if (!supportsDirectoryBrowser()) {
      setProjectDialogError("当前后端未提供服务器目录浏览能力，请手动填写源码目录。");
      return;
    }
    setDirectoryBrowserVisible(true);
    const list = $("backendDirectoryList");
    if (list) list.innerHTML = `<div class="server-browser-empty">正在读取服务器目录...</div>`;
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : "";
      const data = await api(`/filesystem${query}`);
      renderDirectoryBrowser(data);
      DIR_BROWSER.loaded = true;
    } catch (error) {
      if (fallbackToRoots && path) {
        await loadDirectoryBrowser("", false);
        setProjectDialogError(`当前路径不可浏览，已返回可选根目录: ${error.message}`);
        return;
      }
      if (list) list.innerHTML = `<div class="server-browser-empty">${escapeHtml(error.message)}</div>`;
      setProjectDialogError(`读取服务器目录失败: ${error.message}`);
    }
  }

  function renderDirectoryBrowser(data) {
    DIR_BROWSER.path = data.path || "";
    DIR_BROWSER.parent = data.parent || "";
    const pathNode = $("backendDirectoryPath");
    const upButton = $("backendDirectoryUpBtn");
    const list = $("backendDirectoryList");
    if (pathNode) pathNode.textContent = DIR_BROWSER.path || "可选根目录";
    if (upButton) upButton.disabled = !DIR_BROWSER.parent;
    if (!list) return;
    const entries = data.entries || [];
    if (!entries.length) {
      list.innerHTML = `<div class="server-browser-empty">当前目录没有可显示的子项。</div>`;
      return;
    }
    list.innerHTML = entries.map(entry => {
      const directory = entry.directory === true;
      const readable = entry.readable !== false && entry.exists !== false;
      const icon = directory ? "▸" : "·";
      return `
        <div class="server-browser-row" title="${escapeAttr(entry.path || "")}">
          <span>${icon}</span>
          <span class="name">${escapeHtml(entry.name || entry.path || "-")}</span>
          <span class="kind">${directory ? "目录" : sourceBrowserKind(entry.kind)}</span>
          <button data-browse-dir="${escapeAttr(entry.path || "")}" type="button" ${directory && readable ? "" : "disabled"}>进入</button>
          <button data-select-dir="${escapeAttr(entry.path || "")}" type="button" ${directory && readable ? "" : "disabled"}>选择</button>
        </div>`;
    }).join("");
  }

  function sourceBrowserKind(kind) {
    if (kind === "hdl") return "HDL";
    if (kind === "constraint") return "约束";
    return "文件";
  }

  function selectServerSourceDirectory(path) {
    const input = $("backendSourcePathInput");
    const nameInput = $("backendProjectNameInput");
    const previousSuggested = suggestedProjectName(input.value);
    input.value = path;
    if (!nameInput.value.trim() || nameInput.value.trim() === previousSuggested) {
      nameInput.value = suggestedProjectName(path);
    }
    localStorage.setItem("hdlLastBrowsePath", path);
    setProjectDialogError("");
    status(`已选择服务器源码目录: ${path}`);
  }

  function fillProjectDialogRulesets(selected) {
    const select = $("backendProjectRulesetSelect");
    if (!select) return;
    const options = backendRulesetOptions();
    select.innerHTML = options.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
    select.value = selected && options.some(item => item.id === selected)
      ? selected
      : (options[0]?.id || "new_CAST");
  }

  function openProjectDialog() {
    const modal = $("backendProjectModal");
    if (!modal) return;
    const sourceInput = $("backendSourcePathInput");
    const nameInput = $("backendProjectNameInput");
    const languageSelect = $("backendLanguageSelect");
    const apiInput = $("backendApiUrlInput");
    const lastSource = localStorage.getItem("hdlLastSourcePath") || "sample-src";
    sourceInput.value = lastSource;
    nameInput.value = localStorage.getItem("hdlLastProjectName") || suggestedProjectName(lastSource);
    languageSelect.value = localStorage.getItem("hdlLastLanguage") || "v_vhd";
    apiInput.value = API_BASE;
    fillProjectDialogRulesets(isBackendProject(CP()) ? CP().ruleset : localStorage.getItem("hdlLastRuleset"));
    const browseButton = $("backendBrowseSourceBtn");
    if (browseButton) browseButton.disabled = !supportsDirectoryBrowser();
    setDirectoryBrowserVisible(false);
    setProjectDialogError("");
    modal.classList.remove("hidden");
    setTimeout(() => sourceInput.focus(), 0);
  }

  function closeProjectDialog() {
    $("backendProjectModal")?.classList.add("hidden");
    setDirectoryBrowserVisible(false);
    setProjectDialogError("");
  }

  async function submitProjectDialog() {
    const sourcePath = $("backendSourcePathInput").value.trim();
    const name = ($("backendProjectNameInput").value.trim() || suggestedProjectName(sourcePath)).trim();
    const language = $("backendLanguageSelect").value;
    const ruleset = $("backendProjectRulesetSelect").value;
    const submit = $("backendProjectSubmitBtn");
    if (!sourcePath) {
      setProjectDialogError("请填写后端服务器可访问的源码目录。");
      $("backendSourcePathInput").focus();
      return;
    }
    if (!name) {
      setProjectDialogError("请填写工程名称。");
      $("backendProjectNameInput").focus();
      return;
    }
    status("正在请求后端创建工程...");
    submit.disabled = true;
    submit.textContent = "创建中...";
    try {
      await validateSourcePath(sourcePath);
      const created = await api("/projects", {
        method: "POST",
        body: { name, sourcePath, language, ruleset }
      });
      localStorage.setItem("hdlLastSourcePath", sourcePath);
      localStorage.setItem("hdlLastProjectName", name);
      localStorage.setItem("hdlLastLanguage", language);
      localStorage.setItem("hdlLastRuleset", ruleset);
      closeProjectDialog();
      const run = { p: "执行中", r: "完成", x: "待执行", o: "待执行", pct: 0, log: ["[create] 已提交工程创建任务"] };
      const tempProject = mapTempProject(created.project, run);
      PROJECTS.push(tempProject);
      S.pid = tempProject.id;
      S.page = "project";
      renderAll("正在创建后端工程...");
      await pollJob(created.job.id, job => updateRunFromJob(run, job));
      await loadProjects(true);
    } catch (error) {
      setProjectDialogError(error.message);
      status(`创建工程失败: ${error.message}`);
    } finally {
      submit.disabled = false;
      submit.textContent = "创建工程";
    }
  }

  addProject = async function addBackendProject() {
    if (!BACKEND.connected) return originals.addProject();
    openProjectDialog();
  };

  function mapTempProject(raw, run) {
    const project = {
      id: `backend:${raw.id}`,
      backendId: raw.id,
      name: raw.name,
      analyst: raw.analyst || "server",
      path: raw.sourcePath,
      backendProjectPath: raw.projectPath,
      mode: "服务器源码目录",
      ruleset: ensureRuleset(raw.ruleset),
      templates: ["后端 HTML 报告模板"],
      stats: { ce: 0, vc: 0, loc: 0, fc: 0, rc: ruleCount(raw.ruleset), rt: 0, start: "-", end: "-" },
      treeOrder: [],
      sources: [],
      groups: [{ id: "empty-group", label: "暂无检查结果", items: [{ id: "empty", text: "运行检查后显示结果" }] }],
      files: [["暂无数据", 1, "steel"]],
      rules: [["暂无数据", 1, "steel"]],
      vs: [emptyViolation()],
      fileContents: [],
      run
    };
    applyReportTemplates(project);
    return project;
  }

  loadNextProject = async function loadBackendProject() {
    if (!BACKEND.connected) return originals.loadNextProject();
    status("正在从后端刷新工程列表...");
    try {
      await loadProjects(true);
      status(`刷新完成：当前后端工程 ${CP().name}`);
    } catch (error) {
      status(`加载后端工程失败: ${error.message}`);
    }
  };

  runCheck = async function runBackendCheck() {
    const project = CP();
    if (!BACKEND.connected || !isBackendProject(project)) return originals.runCheck();
    const run = project.run;
    run.p = "完成";
    run.r = "完成";
    run.x = "执行中";
    run.o = "待执行";
    run.pct = 0;
    run.log = ["[analyze] 已提交后端检查任务"];
    switchPage("report", "正在执行后端检查...");
    renderRun(run);
    try {
      const created = await api(`/projects/${encodeURIComponent(project.backendId)}/analyze`, {
        method: "POST",
        body: { ruleset: project.ruleset }
      });
      const job = await pollJob(created.job.id, latest => updateRunFromJob(run, latest));
      if (job.status !== "succeeded") {
        const log = await apiText(`/jobs/${encodeURIComponent(job.id)}/log`).catch(() => "");
        run.log.push(log || job.message || "检查失败");
        renderRun(run);
        status("后端检查失败，请查看任务日志");
        return;
      }
      const refreshed = await refreshOneProject(project.backendId);
      S.pid = refreshed.id;
      S.vid = refreshed.vs[0]?.id || "";
      S.selectedRows = [];
      S.lastSelected = null;
      renderAll("后端检查完成，已刷新结果");
      openReport("后端检查完成，已打开分析报告");
    } catch (error) {
      run.x = "待执行";
      run.log.push(`[error] ${error.message}`);
      renderRun(run);
      status(`运行检查失败: ${error.message}`);
    }
  };

  exportReport = async function exportBackendReport(kind) {
    const project = CP();
    const format = kind || E.reportFormatSelect.value;
    if (!BACKEND.connected || !isBackendProject(project)) return originals.exportReport(kind);
    if (format.toUpperCase() !== "HTML") {
      status("当前后端包只支持 HTML 报告，Word/PDF/Excel/WPS 待引擎支持后接入");
      return;
    }
    const popup = window.open("", "_blank");
    try {
      await generateHtmlReport(project, popup);
    } catch (error) {
      if (popup) popup.close();
      status(`生成报告失败: ${error.message}`);
    }
  };

  openFile = async function openBackendFile(pathLike, line, message) {
    const project = CP();
    if (!BACKEND.connected || !isBackendProject(project)) return originals.openFile(pathLike, line, message);
    const relative = relativeToSource(project, pathLike);
    const record = project.fileContents.find(item => item[0] === relative);
    if (!record || record[2] === "点击源文件后从后端读取内容。") {
      try {
        const data = await api(`/projects/${encodeURIComponent(project.backendId)}/files?path=${encodeURIComponent(relative)}`);
        upsertFileContent(project, relative, languageOf(relative), data.content || "");
      } catch (error) {
        status(`读取源码失败: ${error.message}`);
      }
    }
    return originals.openFile(relative, line, message);
  };

  function upsertFileContent(project, path, language, content) {
    const existing = project.fileContents.find(item => item[0] === path);
    if (existing) {
      existing[1] = language;
      existing[2] = content;
    } else {
      project.fileContents.push([path, language, content]);
    }
  }

  openModal = async function openBackendModal() {
    const project = CP();
    if (BACKEND.connected && isBackendProject(project)) {
      const violation = SV();
      const note = document.querySelector(".modal-note");
      try {
        const relative = relativeToSource(project, violation.file);
        const data = await api(`/projects/${encodeURIComponent(project.backendId)}/circuit?path=${encodeURIComponent(relative)}`);
        const parsed = JSON.parse(data.content);
        note.innerHTML = `<p>已读取后端生成的电路图 JSON。</p><p>器件数: ${parsed.devices?.length || 0}，连线数: ${parsed.lines?.length || 0}</p><pre>${escapeHtml(data.content.slice(0, 1200))}</pre>`;
      } catch (error) {
        note.innerHTML = `<p>当前文件暂无可用电路图 JSON。</p><p>${escapeHtml(error.message)}</p>`;
      }
    }
    return originals.openModal();
  };

  setStatusValue = function setBackendStatusValue(id, value) {
    originals.setStatusValue(id, value);
    persistAudit([id], value).catch(error => status(`保存审查状态失败: ${error.message}`));
  };

  setStatus = async function setBackendAuditStatus(value, all) {
    const project = CP();
    if (BACKEND.connected && isBackendProject(project) && all) {
      try {
        status(`正在将后端筛选结果批量标记为${value}...`);
        const updated = await persistFilteredAudit(value);
        await refreshBackendResults({}, `已将后端筛选结果 ${updated} 条标记为${value}`);
      } catch (error) {
        status(`批量保存审查状态失败: ${error.message}`);
      }
      return;
    }
    const ids = all
      ? filteredViolations(CP()).map(item => item.id)
      : S.selectedRows.length ? [...S.selectedRows] : [SV().id];
    ids.forEach(id => originals.setStatusValue(id, value));
    renderDetail();
    renderReport();
    status(all ? `已将筛选结果标记为${value}` : `已将${ids.length > 1 ? `${ids.length} 条选中结果` : "当前结果"}标记为${value}`);
    persistAudit(ids, value).catch(error => status(`保存审查状态失败: ${error.message}`));
  };

  removeProject = async function removeBackendProject(id) {
    const project = PROJECTS.find(item => item.id === id);
    if (!project || !project.backendId) return originals.removeProject(id);
    if (!confirm(`确认删除后端工程 ${project.name}？`)) return;
    try {
      await api(`/projects/${encodeURIComponent(project.backendId)}`, { method: "DELETE" });
      await loadProjects(true);
    } catch (error) {
      status(`删除工程失败: ${error.message}`);
    }
  };

  saveProject = async function saveBackendProject() {
    const project = CP();
    if (isBackendProject(project)) {
      const name = E.projectNameInput.value.trim() || project.name;
      const analyst = E.analystInput.value.trim() || "server";
      const sourcePath = E.projectPathInput.value.trim();
      if (sourcePath && normalize(sourcePath) !== normalize(project.path)) {
        E.projectPathInput.value = project.path;
        status("后端工程源码目录已写入引擎配置；如需更换源码目录，请新建工程");
        return;
      }
      try {
        const data = await api(`/projects/${encodeURIComponent(project.backendId)}`, {
          method: "POST",
          body: { name, analyst, ruleset: project.ruleset }
        });
        Object.assign(project, {
          name: data.project.name,
          analyst: data.project.analyst || "server",
          ruleset: ensureRuleset(data.project.ruleset)
        });
        renderAll(`已保存工程属性：${project.name}，分析人 ${project.analyst}，规则集 ${CR().name}`);
      } catch (error) {
        status(`保存后端工程失败: ${error.message}`);
      }
      return;
    }
    return originals.saveProject();
  };

  addRuleset = function addBackendRuleset() {
    if (!BACKEND.connected) return originals.addRuleset();
    const base = RULESETS.find(item => item.id === E.baseRulesetSelect.value) || CR();
    S.seed += 1;
    const name = E.newRulesetName.value.trim() || `自定义规则集_${S.seed}`;
    const id = `custom_${S.seed}`;
    RULESETS.push({
      id,
      name,
      type: "custom",
      backendBaseRuleset: base.id,
      backendUnsaved: true,
      rules: base.rules.map(rule => ({ ...rule }))
    });
    setRuleset(id);
    switchPage("rules", "已创建本地自定义规则集，请保存后用于后端检查");
  };

  async function saveBackendRuleset() {
    const ruleset = CR();
    if (!BACKEND.connected) {
      status(ruleset.type === "custom" ? `已保存自定义规则集 ${ruleset.name}` : `当前是原厂规则集 ${ruleset.name}，演示中不直接修改`);
      return;
    }
    if (ruleset.type !== "custom" && ruleset.type !== "backend") {
      status(`当前规则集 ${ruleset.name} 是只读规则集，请先新建自定义规则集`);
      return;
    }
    const enabled = (ruleset.rules || []).filter(rule => rule.on !== false).map(rule => rule.code).filter(Boolean);
    const levelOverrides = (ruleset.rules || [])
      .filter(rule => rule.code)
      .map(rule => `${rule.code}=${rule.sev || "一般违规"}`);
    if (!enabled.length) {
      status("至少需要保留一条启用规则");
      return;
    }
    try {
      status("正在保存后端自定义规则集...");
      const saved = await api("/rulesets", {
        method: "POST",
        body: {
          name: ruleset.name,
          baseRuleset: ruleset.backendBaseRuleset || ruleset.id,
          enabledRules: enabled.join(","),
          ruleLevels: levelOverrides.join(",")
        }
      });
      mergeRuleset(saved.ruleset, saved.rules || []);
      const savedRuleset = RULESETS.find(item => item.id === saved.ruleset.id);
      if (savedRuleset) {
        savedRuleset.type = "backend";
        savedRuleset.backendBaseRuleset = ruleset.backendBaseRuleset || ruleset.id;
      }
      const oldId = ruleset.id;
      if (oldId !== saved.ruleset.id) {
        const oldIndex = RULESETS.findIndex(item => item.id === oldId);
        if (oldIndex >= 0) RULESETS.splice(oldIndex, 1);
      }
      CP().ruleset = saved.ruleset.id;
      S.qsearch = "";
      renderAll(`已保存后端自定义规则集 ${saved.ruleset.name}`);
    } catch (error) {
      status(`保存后端规则集失败: ${error.message}`);
    }
  }

  renderDetail = function renderBackendAwareDetail() {
    originals.renderDetail();
    renderBackendPager();
  };

  function interceptClick(id, handler) {
    const element = $(id);
    if (!element) return;
    element.addEventListener("click", event => {
      if (!BACKEND.connected) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, true);
  }

  function installBackendEventInterceptors() {
    interceptClick("toolCreateProjectBtn", () => addProject());
    interceptClick("toolLoadProjectBtn", () => loadNextProject());
    interceptClick("toolSaveProjectBtn", () => saveProject());
    interceptClick("saveProjectBtn", () => saveProject());
    interceptClick("openCircuitBtn", () => openModal());
    interceptClick("toolRunCheckBtn", () => guideProjectAction("run"));
    interceptClick("runCheckBtn", () => guideProjectAction("run"));
    interceptClick("toolReportBtn", () => guideProjectAction("report"));
    interceptClick("openGeneratedReportBtn", () => openGeneratedReport());
    interceptClick("exportReportBtn", () => exportReport());
    interceptClick("createRulesetBtn", () => addRuleset());
    interceptClick("saveRulesetBtn", () => saveBackendRuleset());

    const handleSourceToggle = event => {
      if (!BACKEND.connected || !isBackendProject(CP())) return;
      const button = event.target.closest("[data-toggle-source]");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleSourceSelection(button.dataset.toggleSource, button.dataset.include === "true");
    };
    E.sourcePreviewBody?.addEventListener("click", handleSourceToggle, true);
    E.resultFilterList?.addEventListener("click", handleSourceToggle, true);

    $("searchBtn")?.addEventListener("click", event => {
      if (!BACKEND.connected || !isBackendProject(CP())) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      S.rsearch = E.resultSearchInput.value.trim();
      refreshBackendResults({ page: 1, search: S.rsearch }, S.rsearch ? `已按关键字搜索: ${S.rsearch}` : "已刷新全部结果");
    }, true);
    $("clearSearchBtn")?.addEventListener("click", event => {
      if (!BACKEND.connected || !isBackendProject(CP())) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      S.rsearch = "";
      E.resultSearchInput.value = "";
      refreshBackendResults({ page: 1, search: "" }, "已清除后端搜索条件");
    }, true);
    E.resultSearchInput?.addEventListener("keydown", event => {
      if (event.key !== "Enter" || !BACKEND.connected || !isBackendProject(CP())) return;
      event.preventDefault();
      S.rsearch = E.resultSearchInput.value.trim();
      refreshBackendResults({ page: 1, search: S.rsearch }, S.rsearch ? `已按关键字搜索: ${S.rsearch}` : "已刷新全部结果");
    });
    document.querySelector(".detail-table thead")?.addEventListener("click", event => {
      if (!BACKEND.connected || !isBackendProject(CP())) return;
      const th = event.target.closest("[data-sort]");
      if (!th) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (S.sortKey === th.dataset.sort) S.sortDir = S.sortDir === "asc" ? "desc" : "asc";
      else { S.sortKey = th.dataset.sort; S.sortDir = "asc"; }
      refreshBackendResults({ page: 1, sort: S.sortKey, dir: S.sortDir }, `已按${th.textContent.replace(" ⇅", "")}排序`);
    }, true);
    $("backendResultPrevBtn")?.addEventListener("click", () => {
      const page = CP().backendPagination?.page || 1;
      refreshBackendResults({ page: page - 1 }, "已切换到上一页结果");
    });
    $("backendResultNextBtn")?.addEventListener("click", () => {
      const page = CP().backendPagination?.page || 1;
      refreshBackendResults({ page: page + 1 }, "已切换到下一页结果");
    });
    $("backendResultPageInput")?.addEventListener("change", event => {
      refreshBackendResults({ page: Number(event.target.value) || 1 }, "已跳转到指定结果页");
    });
    $("backendResultPageInput")?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      refreshBackendResults({ page: Number(event.target.value) || 1 }, "已跳转到指定结果页");
    });
    $("backendResultPageSizeSelect")?.addEventListener("change", event => {
      const pageSize = Number(event.target.value) || DEFAULT_RESULT_PAGE_SIZE;
      localStorage.setItem("hdlResultPageSize", String(pageSize));
      refreshBackendResults({ page: 1, pageSize }, `已切换每页 ${pageSize} 条`);
    });

    $("backendTasksBtn")?.addEventListener("click", openTaskCenter);
    $("backendTaskCloseBtn")?.addEventListener("click", closeTaskCenter);
    $("backendTaskCloseTopBtn")?.addEventListener("click", closeTaskCenter);
    $("backendTaskRefreshBtn")?.addEventListener("click", () => refreshTaskCenter());
    $("backendTaskModal")?.addEventListener("click", event => {
      if (event.target === $("backendTaskModal")) closeTaskCenter();
    });
    $("backendTaskList")?.addEventListener("click", event => {
      const retry = event.target.closest("[data-retry-task]");
      if (retry) {
        event.preventDefault();
        event.stopPropagation();
        retryTask(retry.dataset.retryTask);
        return;
      }
      const item = event.target.closest("[data-task-id]");
      if (item) selectTask(item.dataset.taskId);
    });
    $("backendProjectCancelBtn")?.addEventListener("click", closeProjectDialog);
    $("backendProjectCancelTopBtn")?.addEventListener("click", closeProjectDialog);
    $("backendProjectSubmitBtn")?.addEventListener("click", submitProjectDialog);
    $("backendBrowseSourceBtn")?.addEventListener("click", () => {
      const path = $("backendSourcePathInput")?.value.trim() || localStorage.getItem("hdlLastBrowsePath") || "";
      loadDirectoryBrowser(path, true);
    });
    $("backendDirectoryUpBtn")?.addEventListener("click", () => {
      if (DIR_BROWSER.parent) loadDirectoryBrowser(DIR_BROWSER.parent);
    });
    $("backendDirectoryRefreshBtn")?.addEventListener("click", () => {
      loadDirectoryBrowser(DIR_BROWSER.path || "");
    });
    $("backendDirectoryList")?.addEventListener("click", event => {
      const browse = event.target.closest("[data-browse-dir]");
      if (browse) {
        loadDirectoryBrowser(browse.dataset.browseDir);
        return;
      }
      const select = event.target.closest("[data-select-dir]");
      if (select) {
        selectServerSourceDirectory(select.dataset.selectDir);
      }
    });
    $("backendProjectModal")?.addEventListener("click", event => {
      if (event.target === $("backendProjectModal")) closeProjectDialog();
    });
    $("backendSourcePathInput")?.addEventListener("input", () => {
      const nameInput = $("backendProjectNameInput");
      if (!nameInput.value.trim()) {
        nameInput.value = suggestedProjectName($("backendSourcePathInput").value);
      }
    });
    $("backendSourcePathInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter") $("backendProjectNameInput")?.focus();
    });
    $("backendProjectNameInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter") submitProjectDialog();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !$("backendProjectModal")?.classList.contains("hidden")) {
        closeProjectDialog();
      }
      if (event.key === "Escape" && !$("backendTaskModal")?.classList.contains("hidden")) {
        closeTaskCenter();
      }
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  async function initializeBackend(force = false) {
    if (BACKEND.loading && !force) return;
    BACKEND.loading = true;
    ensureBackendControls();
    setBackendStatus("probing", "后端: 连接中");
    try {
      const selected = await selectBackendBase();
      API_BASE = selected.base;
      BACKEND.health = selected.health;
      BACKEND.connected = true;
      syncReportFormatAvailability();
      setBackendStatus("online", `后端: 已连接 ${API_BASE.replace(/^https?:\/\//, "")}`);
      status("后端已连接，正在加载规则集和工程数据...");
      await loadRulesets();
      await loadReportTemplates();
      await loadProjects(force);
    } catch (error) {
      BACKEND.connected = false;
      syncReportFormatAvailability();
      setBackendStatus("offline", "后端: 未连接");
      status(`后端未连接，继续使用演示数据: ${error.message}`);
    } finally {
      BACKEND.loading = false;
    }
  }

  async function selectBackendBase() {
    const configured = localStorage.getItem("hdlBackendUrl");
    const candidates = [
      configured,
      sameOriginApi,
      "http://localhost:18080/api",
      ...Array.from({ length: 19 }, (_, index) => `http://localhost:${18081 + index}/api`)
    ].filter(Boolean);
    const unique = [...new Set(candidates)];
    const preferred = unique.slice(0, 3);
    const checked = new Set();
    for (const base of preferred) {
      checked.add(base);
      const healthy = await fetchHealth(base, 900);
      if (healthy) return healthy;
    }
    const rest = unique.filter(base => !checked.has(base));
    const healthy = (await Promise.all(rest.map(base => fetchHealth(base, 900)))).filter(Boolean);
    if (!healthy.length) throw new Error("未发现可用后端");
    healthy.sort((a, b) => Number(b.health.apiVersion || 1) - Number(a.health.apiVersion || 1));
    return healthy[0];
  }

  async function fetchHealth(base, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${base}/health`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) return null;
      return { base, health: await response.json() };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  window.HDL_BACKEND = { initializeBackend, get apiBase() { return API_BASE; } };
  installBackendEventInterceptors();
  initializeBackend();
})();
