const views = document.querySelectorAll(".view");
const navItems = document.querySelectorAll(".nav-item");

function showView(viewId) {
  views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

const commandPreview = document.getElementById("commandPreview");
const commandByPlatform = {
  windows:
    "spec-hdl.exe D:\\Projects\\rtl\\fd29.v\njava -jar vhdl-checker.jar -checks D:\\Projects\\rtl\\R6_2_4_1_3.vhd",
  linux:
    "./spec-hdl /opt/hdl-review/rtl/fd29.v\njava -jar vhdl-checker.jar -checks /opt/hdl-review/rtl/R6_2_4_1_3.vhd",
  kylin:
    "./spec-hdl-arm64 /home/kylin/hdl-review/rtl/fd29.v\njava -jar vhdl-checker.jar -checks /home/kylin/hdl-review/rtl/R6_2_4_1_3.vhd",
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    commandPreview.textContent = commandByPlatform[tab.dataset.platform];
  });
});

const ruleSearch = document.getElementById("ruleSearch");
const rulesBody = document.getElementById("rulesBody");

if (ruleSearch && rulesBody) {
  ruleSearch.addEventListener("input", () => {
    const keyword = ruleSearch.value.trim().toLowerCase();
    rulesBody.querySelectorAll("tr").forEach((row) => {
      row.style.display = row.dataset.key.toLowerCase().includes(keyword) ? "" : "none";
    });
  });
}

document.querySelectorAll(".severity").forEach((select) => {
  select.addEventListener("change", () => {
    select.closest("tr").animate(
      [
        { backgroundColor: "rgba(199, 131, 34, 0.24)" },
        { backgroundColor: "transparent" },
      ],
      { duration: 520, easing: "ease-out" }
    );
  });
});

const runDemo = document.getElementById("runDemo");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const logPanel = document.getElementById("logPanel");
const jobSpec = document.getElementById("jobSpec");
const jobVhdl = document.getElementById("jobVhdl");
const jobDb = document.getElementById("jobDb");

if (runDemo) {
  runDemo.addEventListener("click", () => {
    const steps = [
      [18, "正在读取 project.json 与 analysis.conf...", "执行中", "等待", "等待"],
      [42, "调用 spec-hdl，解析 Verilog 文件...", "完成", "等待", "等待"],
      [68, "调用 vhdl-checker.jar，解析 VHDL 文件...", "完成", "执行中", "等待"],
      [86, "标准化引擎输出，写入 finding 表...", "完成", "完成", "执行中"],
      [100, "检查完成：发现 675 条结果，0 条引擎错误。", "完成", "完成", "完成"],
    ];
    logPanel.innerHTML = "";
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
    runDemo.disabled = true;

    steps.forEach((step, index) => {
      window.setTimeout(() => {
        const [progress, message, specState, vhdlState, dbState] = step;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        jobSpec.textContent = specState;
        jobVhdl.textContent = vhdlState;
        jobDb.textContent = dbState;
        logPanel.insertAdjacentHTML("beforeend", `<p>[${progress}%] ${message}</p>`);
        logPanel.scrollTop = logPanel.scrollHeight;
        if (progress === 100) runDemo.disabled = false;
      }, index * 620);
    });
  });
}

const helpRule = document.getElementById("helpRule");
const helpTitle = document.getElementById("helpTitle");
const codePreview = document.getElementById("codePreview");

document.querySelectorAll(".finding-row").forEach((row) => {
  row.addEventListener("click", () => {
    document.querySelectorAll(".finding-row").forEach((item) => item.classList.remove("active"));
    row.classList.add("active");
    helpRule.textContent = row.dataset.rule;
    helpTitle.textContent = row.dataset.message;
    codePreview.textContent =
      row.dataset.rule === "CID9038"
        ? "24  process(clk, set)\n25  begin\n26    if clk'event then"
        : "29  always @(posedge clk_b) begin\n30    data_b <= data_a;\n31  end";
  });
});

let reviewed = 256;
const reviewedCount = document.getElementById("reviewedCount");
const reviewRate = document.getElementById("reviewRate");

function markAudit(button, label, className) {
  const row = button.closest("tr");
  const pill = row.querySelector(".pill");
  const wasUnreviewed = pill.textContent === "未审计";
  pill.textContent = label;
  pill.className = `pill ${className}`;
  if (wasUnreviewed) reviewed += 1;
  reviewedCount.textContent = reviewed;
  reviewRate.textContent = `${Math.round((reviewed / 675) * 100)}%`;
}

document.querySelectorAll(".audit-ok").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    markAudit(button, "违规", "ok");
  });
});

document.querySelectorAll(".audit-no").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    markAudit(button, "不违规", "warn");
  });
});

const bulkAudit = document.getElementById("bulkAudit");
if (bulkAudit) {
  bulkAudit.addEventListener("click", () => {
    document.querySelectorAll(".audit-table tbody tr").forEach((row) => {
      const pill = row.querySelector(".pill");
      if (pill.textContent === "未审计") {
        pill.textContent = "违规";
        pill.className = "pill ok";
        reviewed += 1;
      }
    });
    reviewedCount.textContent = reviewed;
    reviewRate.textContent = `${Math.round((reviewed / 675) * 100)}%`;
  });
}
