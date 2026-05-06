const PAGES=[["report","分析报告"],["project","项目管理"],["rules","规则集管理"],["state","状态机图"]];
const fill=(lines,total=30)=>{const rows=[...lines];while(rows.length<total)rows.push("");return rows.join("\n");};
const fullPath=(project,relative)=>`${project.path}\\${relative.replace(/\//g,"\\")}`;
const normalize=value=>(value||"").replace(/\\/g,"/").toLowerCase();
const baseName=value=>value.split(/[\\/]/).pop();
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const clone=value=>JSON.parse(JSON.stringify(value));

const RULESETS=[
  {id:"wyl",name:"五院VHDL规则集",type:"builtin",rules:[
    {code:"VHDL_2_1_1_14",name:"数组索引只能使用常数或信号名",cat:"06 语法约束",sev:"严重违规",on:true},
    {code:"VHDL_2_1_1_15",name:"集合只允许使用同类索引",cat:"06 语法约束",sev:"严重违规",on:true},
    {code:"VHDL_2_1_1_19",name:"只能使用 range、length 等属性",cat:"06 语法约束",sev:"一般违规",on:true},
    {code:"VHDL_1_1_1_3",name:"实体名不应使用英文关键字",cat:"01 命名",sev:"一般违规",on:true},
    {code:"VHDL_1_4_1",name:"FPGA 内部不应使用门控时钟",cat:"04 时钟",sev:"严重违规",on:true}
  ]},
  {id:"cast",name:"new_CAST规则集",type:"builtin",rules:[
    {code:"Verilog_1_1_1_1",name:"标识符只能使用字母、数字和下划线",cat:"01 命名",sev:"严重违规",on:true},
    {code:"Verilog_1_3_1_4",name:"if 关键字后建议保留空格",cat:"03 复位",sev:"一般违规",on:true},
    {code:"Verilog_2_2_1_3",name:"时序逻辑建议显式分层",cat:"02 基本设计单元",sev:"严重违规",on:true},
    {code:"CID9588",name:"模块名和文件名宜保持一致",cat:"01 命名",sev:"一般违规",on:true},
    {code:"CID9427",name:"对跨时钟域信号，应采取同步处理措施",cat:"05 异步电路",sev:"严重违规",on:true}
  ]},
  {id:"wyl_custom",name:"五院VHDL规则集_审计版",type:"custom",rules:[
    {code:"VHDL_2_1_1_14",name:"数组索引只能使用常数或信号名",cat:"06 语法约束",sev:"严重违规",on:true},
    {code:"VHDL_2_1_1_15",name:"集合只允许使用同类索引",cat:"06 语法约束",sev:"严重违规",on:true},
    {code:"VHDL_1_1_1_3",name:"实体名不应使用英文关键字",cat:"01 命名",sev:"一般违规",on:true}
  ]}
];

const PROJECTS=[
  {
    id:"test",name:"test",analyst:"liyou",path:"C:\\Users\\liyou\\Desktop\\test",mode:"RTL文件夹 + 工程文件",ruleset:"wyl",
    templates:["五院默认模板","审计报告模板","客户自定义模板"],
    stats:{ce:0,vc:331,loc:5771,fc:120,rc:58,rt:68,start:"2021-04-20 16:30:13.038",end:"2021-04-20 16:31:21.827"},
    treeOrder:["src","out","toif"],
    sources:[
      ["src/test_top.vhd","VHDL","工程文件","已纳入"],
      ["src/math_pkg.vhd","VHDL","源码目录","已纳入"],
      ["src/check_core.vhd","VHDL","源码目录","已纳入"],
      ["src/ctrl_sync.vhd","VHDL","源码目录","已纳入"],
      ["src/array_index.vhd","VHDL","源码目录","已纳入"],
      ["src/tb_test_top.vhd","VHDL","源码目录","已排除"]
    ],
    groups:[
      {id:"g1",label:"01 命名(3种类型，共有5项。)",items:[
        {id:"v1",text:"VHDL_1_1_1_2 不应定义 Verilog-HDL 关键字"},
        {id:"v2",text:"VHDL_1_1_1_3 不应定义英文关键字"}
      ]},
      {id:"g2",label:"02 基本设计单元(2种类型，共有4项。)",items:[
        {id:"v3",text:"VHDL_1_2_1_1 不应在组合逻辑电路中使用时钟"},
        {id:"v4",text:"VHDL_1_2_1_2 不应使用基本单元同步元"}
      ]},
      {id:"g3",label:"06 语法约束(22种类型，共有90项。)",items:[
        {id:"v5",text:"VHDL_2_1_1_14 数组索引只能使用常数或信号名"},
        {id:"v6",text:"VHDL_2_1_1_15 集合只允许使用同类索引"},
        {id:"v7",text:"VHDL_2_1_1_19 只能使用 range、length 等属性"}
      ]}
    ],
    files:[["test_top.vhd",18,"steel"],["math_pkg.vhd",16,"cyan"],["check_core.vhd",15,"purple"],["ctrl_sync.vhd",12,"violet"],["array_index.vhd",11,"steel"]],
    rules:[["VHDL_2_1_1_14",78,"steel"],["VHDL_2_1_1_15",23,"cyan"],["VHDL_2_1_1_19",19,"purple"],["VHDL_1_1_1_4",17,"violet"],["VHDL_1_5_1_1",16,"steel"]],
    vs:[
      {id:"v1",rid:"VHDL_1_1_1_2",tip:"模块名不应使用 Verilog-HDL 关键字",st:"未确认",file:"src/test_top.vhd",line:29,conf:0,info:"entity sample_top 命中了 Verilog-HDL 关键字限制。",note:"",msg:"VHDL 标识符不能与语言关键字冲突，否则会给阅读、综合与转换带来歧义。",ex:"违规样例:\nentity sample is\n...\n建议:\nentity sample_top is",circuit:"sample_top 命名路径"},
      {id:"v2",rid:"VHDL_1_1_1_3",tip:"实体名不应使用英文关键字",st:"违反",file:"src/math_pkg.vhd",line:18,conf:0,info:"函数命名中出现英文关键字 end。",note:"需要统一命名规范",msg:"实体、模块、实例名应当避开语言关键字和保留字。",ex:"违规样例:\nfunction end return integer is\n...\n建议:\nfunction calc_end return integer is",circuit:"math_pkg 命名路径"},
      {id:"v3",rid:"VHDL_1_2_1_1",tip:"组合逻辑中不应使用时钟信号",st:"未确认",file:"src/ctrl_sync.vhd",line:24,conf:0,info:"process 中对 clk 进行了组合判断。",note:"",msg:"组合逻辑过程不应直接把时钟信号纳入条件，否则可能引入隐含锁存与时序歧义。",ex:"bad:\nif clk = '1' then\n  tmp <= din;\nend if;",circuit:"组合逻辑路径"},
      {id:"v4",rid:"VHDL_1_2_1_2",tip:"不应使用基本单元同步元",st:"违反",file:"src/check_core.vhd",line:17,conf:0,info:"同步单元存在与设计约束不一致的实例化方式。",note:"",msg:"同步元建议通过统一封装调用，而不是在业务代码里直接实例化基础单元。",ex:"建议:\n使用 company_sync_cell 统一封装。",circuit:"同步元结构"},
      {id:"v5",rid:"VHDL_2_1_1_14",tip:"数组索引只能使用常数或信号名",st:"未确认",file:"src/array_index.vhd",line:31,conf:0,info:"in_A1(src_samp+2): 数组索引中不应有操作符表达式。",note:"",msg:"数组索引不应有任何操作符表达式，只能使用常数或信号名。",ex:"违规样例:\nin_A1(src_samp+2) <= '1';",circuit:"数组索引路径"},
      {id:"v6",rid:"VHDL_2_1_1_15",tip:"集合只允许使用同类索引",st:"违反",file:"src/check_core.vhd",line:33,conf:0,info:"merrval_reg(kreg-1 downto 0): 数组索引类型不一致。",note:"",msg:"集合与切片访问需要保持索引类型一致，避免隐式转换带来的综合差异。",ex:"good:\narr(idx downto 0)\n\nbad:\narr(to_integer(idx) downto 0)",circuit:"集合索引路径"},
      {id:"v7",rid:"VHDL_2_1_1_19",tip:"只能使用 range、length 等属性",st:"未确认",file:"src/math_pkg.vhd",line:26,conf:0,info:"属性调用方式不符合建议写法。",note:"",msg:"建议只使用规范属性，减少与工具链相关的实现差异。",ex:"推荐:\nfor i in signal_a'range loop\n  ...\nend loop;",circuit:"属性访问路径"}
    ],
    fileContents:[
      ["src/test_top.vhd","VHDL",fill(["library ieee;","use ieee.std_logic_1164.all;","use ieee.numeric_std.all;","","entity sample_top is","  port(","    clk      : in  std_logic;","    rst_n    : in  std_logic;","    data_in  : in  std_logic_vector(7 downto 0);","    data_out : out std_logic_vector(7 downto 0)","  );","end sample_top;","","architecture rtl of sample_top is","  signal sample_reg : std_logic_vector(7 downto 0);","  signal step_cnt   : integer range 0 to 7;","begin","  process(clk, rst_n)","  begin","    if rst_n = '0' then","      sample_reg <= (others => '0');","      step_cnt   <= 0;","    elsif rising_edge(clk) then","      if data_in(0) = '1' then","        sample_reg <= data_in;","      end if;","      step_cnt <= step_cnt + 1;","    end if;","  end process;","","  data_out <= sample_reg;","end rtl;"],38)],
      ["src/math_pkg.vhd","VHDL",fill(["library ieee;","use ieee.std_logic_1164.all;","use ieee.numeric_std.all;","","package math_pkg is","  function calc_end(a : integer; b : integer) return integer;","  function norm_len(a : std_logic_vector) return integer;","end package;","","package body math_pkg is","  function calc_end(a : integer; b : integer) return integer is","  begin","    return a + b;","  end function;","","  function norm_len(a : std_logic_vector) return integer is","  begin","    return a'length;","  end function;","","  function calc_idx(a : integer) return integer is","  begin","    if a < 0 then","      return 0;","    end if;","    return a;","  end function;","end package body;"],34)],
      ["src/check_core.vhd","VHDL",fill(["library ieee;","use ieee.std_logic_1164.all;","use ieee.numeric_std.all;","","entity check_core is","  port(","    clk      : in  std_logic;","    rst_n    : in  std_logic;","    data_bus : in  std_logic_vector(15 downto 0)","  );","end check_core;","","architecture rtl of check_core is","  signal merrval_reg : std_logic_vector(15 downto 0);","  signal kreg        : integer range 0 to 15;","begin","  process(clk, rst_n)","  begin","    if rst_n = '0' then","      merrval_reg <= (others => '0');","    elsif rising_edge(clk) then","      merrval_reg <= data_bus;","      if kreg > 0 then","        merrval_reg(kreg-1 downto 0) <= data_bus(kreg-1 downto 0);","      end if;","    end if;","  end process;","","  assert merrval_reg'length = 16 report \"length ok\" severity note;","end rtl;"],40)],
      ["src/ctrl_sync.vhd","VHDL",fill(["library ieee;","use ieee.std_logic_1164.all;","","entity ctrl_sync is","  port(","    clk  : in std_logic;","    din  : in std_logic;","    dout : out std_logic","  );","end ctrl_sync;","","architecture rtl of ctrl_sync is","  signal tmp : std_logic;","begin","  process(clk, din)","  begin","    if clk = '1' then","      tmp <= din;","    end if;","  end process;","","  dout <= tmp;","end rtl;"],32)],
      ["src/array_index.vhd","VHDL",fill(["library ieee;","use ieee.std_logic_1164.all;","","entity array_index is","end array_index;","","architecture rtl of array_index is","  type arr_t is array(0 to 15) of std_logic;","  signal in_a1    : arr_t;","  signal src_samp : integer;","begin","  process(all)","  begin","    if src_samp < 14 then","      in_a1(src_samp+2) <= '1';","    end if;","  end process;","end rtl;"],36)],
      ["src/tb_test_top.vhd","VHDL",fill(["entity tb_test_top is","end entity;","","architecture sim of tb_test_top is","begin","  -- excluded testbench file","end architecture;"],16)],
      ["analysis.cfg","CFG",["project.name=test","project.language=vhdl","ruleset=wyl","include.dir=src","exclude.file=tb_test_top.vhd","report.output=out/test.xml"].join("\n")],
      ["out/test.xml","XML",["<analysis project=\"test\">","  <summary violations=\"331\" rules=\"58\"/>","  <result id=\"v5\" rule=\"VHDL_2_1_1_14\" line=\"31\"/>","</analysis>"].join("\n")],
      ["out/checker.log","LOG",["[info] loading project test","[info] applying ruleset wyl","[done] collected 331 violations"].join("\n")],
      ["out/report.html","HTML","<html><body><h1>Analysis Report</h1></body></html>"],
      ["toif/rtl_graph.json","JSON","{ \"graph\": \"rtl\" }"],
      ["toif/rule_map.json","JSON","{ \"rule\": \"VHDL_2_1_1_14\" }"]
    ],
    run:{p:"完成",r:"完成",x:"待执行",o:"待执行",pct:0,log:["[ready] 等待在规则集管理页点击“执行检查”。"]}
  },
  {
    id:"servo",name:"servo_ctrl",analyst:"admin",path:"D:\\workspace\\servo_ctrl",mode:"源码目录",ruleset:"cast",
    templates:["CAST 快速模板","项目周报模板"],
    stats:{ce:0,vc:27,loc:2457,fc:76,rc:41,rt:12,start:"2026-04-17 11:45:05.939",end:"2026-04-17 11:45:17.944"},
    treeOrder:["rtl","sim","out"],
    sources:[
      ["rtl/servo_top.v","Verilog","源码目录","已纳入"],
      ["rtl/pwm_core.v","Verilog","源码目录","已纳入"],
      ["rtl/clock_sync.v","Verilog","源码目录","已纳入"],
      ["rtl/fsm_core.v","Verilog","源码目录","已纳入"],
      ["sim/tb_servo_top.v","Verilog","源码目录","已排除"]
    ],
    groups:[
      {id:"s-g1",label:"01 命名(2种类型，共有8项。)",items:[
        {id:"s1",text:"Verilog_1_1_1_1 标识符只能使用字母、数字和下划线"},
        {id:"s2",text:"CID9588 模块名和文件名宜保持一致"}
      ]},
      {id:"s-g2",label:"05 异步电路(1种类型，共有2项。)",items:[
        {id:"s3",text:"CID9427 对跨时钟域信号，应采取同步处理措施"}
      ]}
    ],
    files:[["pwm_core.v",9,"steel"],["clock_sync.v",7,"cyan"],["fsm_core.v",5,"purple"],["servo_top.v",4,"violet"],["data_path.v",2,"steel"]],
    rules:[["Verilog_1_1_1_1",11,"steel"],["CID9588",6,"cyan"],["CID9427",4,"purple"],["Verilog_1_3_1_4",4,"violet"],["Verilog_2_2_1_3",2,"steel"]],
    vs:[
      {id:"s1",rid:"Verilog_1_1_1_1",tip:"标识符只能使用字母、数字和下划线",st:"违反",file:"rtl/pwm_core.v",line:8,conf:0,info:"reg [7:0] Cnt1; 命中命名规则。",note:"",msg:"寄存器、线网和模块名建议统一使用小写字母开头并配合下划线。",ex:"bad : reg [7:0] Cnt1;\ngood: reg [7:0] cnt_1;",circuit:"Cnt1 命名路径"},
      {id:"s2",rid:"CID9588",tip:"模块名和文件名宜保持一致",st:"未确认",file:"rtl/servo_top.v",line:3,conf:0,info:"模块实体与文件名存在不一致。",note:"",msg:"模块名和文件名保持一致能显著提高定位效率。",ex:"good:\nmodule servo_top (...);",circuit:"servo_top 结构"},
      {id:"s3",rid:"CID9427",tip:"对跨时钟域信号，应采取同步处理措施",st:"未确认",file:"rtl/clock_sync.v",line:29,conf:0,info:"data_b <= data_a; 跨时钟域未同步。",note:"",msg:"跨时钟域信号需要同步级或握手机制，否则容易引入亚稳态风险。",ex:"always @(posedge clk_b) begin\n  data_b <= data_a; // 未同步\nend",circuit:"clock_sync CDC 路径"}
    ],
    fileContents:[
      ["rtl/servo_top.v","Verilog",fill(["module servo_top(","  input  wire clk,","  input  wire rst_n,","  input  wire [7:0] pos_in,","  output wire pwm_out",");","","wire [7:0] duty_cfg;","pwm_core u_pwm_core(","  .clk(clk),","  .rst_n(rst_n),","  .duty_cfg(duty_cfg),","  .pwm_out(pwm_out)",");","","endmodule"],28)],
      ["rtl/pwm_core.v","Verilog",fill(["module pwm_core(","  input  wire       clk,","  input  wire       rst_n,","  input  wire [7:0] duty_cfg,","  output reg        pwm_out",");","reg [7:0] Cnt1;","always @(posedge clk or negedge rst_n) begin","  if (!rst_n) begin","    Cnt1 <= 8'd0;","  end else begin","    Cnt1 <= Cnt1 + 1'b1;","  end","end","endmodule"],24)],
      ["rtl/clock_sync.v","Verilog",fill(["module clock_sync(","  input  wire clk_a,","  input  wire clk_b,","  input  wire data_a,","  output reg  data_b",");","always @(posedge clk_b) begin","  data_b <= data_a;","end","endmodule"],36)],
      ["rtl/fsm_core.v","Verilog",fill(["module fsm_core(","  input wire clk,","  input wire rst_n,","  output reg idle",");","always @(posedge clk or negedge rst_n) begin","  if (!rst_n) idle <= 1'b1;","  else idle <= ~idle;","end","endmodule"],24)],
      ["rtl/data_path.v","Verilog",fill(["module data_path(","  input wire [7:0] din,","  output wire [7:0] dout",");","assign dout = din;","endmodule"],18)],
      ["sim/tb_servo_top.v","Verilog",fill(["module tb_servo_top;","  initial begin","    #10;","  end","endmodule"],16)],
      ["analysis.cfg","CFG",["project.name=servo_ctrl","project.language=verilog","ruleset=cast","include.dir=rtl","report.output=out/servo_ctrl.xml"].join("\n")],
      ["out/servo_ctrl.xml","XML",["<analysis project=\"servo_ctrl\">","  <summary violations=\"27\" rules=\"41\"/>","  <result id=\"s1\" rule=\"Verilog_1_1_1_1\" line=\"8\"/>","</analysis>"].join("\n")],
      ["out/checker.log","LOG",["[info] loading project servo_ctrl","[info] applying ruleset cast","[done] collected 27 violations"].join("\n")]
    ],
    run:{p:"完成",r:"完成",x:"待执行",o:"待执行",pct:0,log:["[ready] 当前项目已导入，可以直接执行检查。"]}
  }
];

const S={pid:"test",page:"report",vid:"v5",rsearch:"",qsearch:"",tpl:"",format:"HTML",seed:2,pseed:3,openFiles:[],fileFocus:{},treeOpen:{},resultOpen:{},contextRow:null,resultView:"rule",sortKey:"file",sortDir:"asc",selectedRows:[],lastSelected:null};
const $=id=>document.getElementById(id);
const E={
  projectTabs:$("projectTabs"),workspaceTabs:$("workspaceTabs"),projectTree:$("projectTree"),browserSummary:$("browserSummary"),resultTree:$("resultTree"),
  activeProjectSelect:$("activeProjectSelect"),activeRulesetSelect:$("activeRulesetSelect"),templateSelect:$("templateSelect"),reportFormatSelect:$("reportFormatSelect"),metricCompile:document.querySelector("#metricCompile strong"),metricViolation:document.querySelector("#metricViolation strong"),metricAuditState:$("metricAuditState"),
  metricLoc:document.querySelector("#metricLoc strong"),metricSourceCount:document.querySelector("#metricSourceCount strong"),infoProjectName:$("infoProjectName"),infoAnalyst:$("infoAnalyst"),infoRuleset:$("infoRuleset"),infoRuleCount:$("infoRuleCount"),infoRuntime:$("infoRuntime"),
  infoStartTime:$("infoStartTime"),infoEndTime:$("infoEndTime"),infoAudited:$("infoAudited"),infoEffectiveLoc:$("infoEffectiveLoc"),infoCommentRate:$("infoCommentRate"),infoRulesetTotal:$("infoRulesetTotal"),fileChart:$("fileChart"),ruleChart:$("ruleChart"),hierarchyView:$("hierarchyView"),ipTableBody:$("ipTableBody"),integrationBox:$("integrationBox"),projectNameInput:$("projectNameInput"),analystInput:$("analystInput"),projectPathInput:$("projectPathInput"),
  importModeSelect:$("importModeSelect"),currentRulesetInput:$("currentRulesetInput"),savedProjects:$("savedProjects"),sourcePreviewBody:$("sourcePreviewBody"),constraintTableBody:$("constraintTableBody"),rulesetList:$("rulesetList"),currentRulesetTag:$("currentRulesetTag"),ruleSearchInput:$("ruleSearchInput"),
  baseRulesetSelect:$("baseRulesetSelect"),newRulesetName:$("newRulesetName"),ruleTableBody:$("ruleTableBody"),progressProject:$("progressProject"),progressRules:$("progressRules"),progressRun:$("progressRun"),progressResult:$("progressResult"),progressBar:$("progressBar"),progressText:$("progressText"),
  progressLog:$("progressLog"),auditedSummary:$("auditedSummary"),resultSearchInput:$("resultSearchInput"),resultViewSelect:$("resultViewSelect"),detailTableBody:$("detailTableBody"),helpTip:$("helpTip"),helpRuleId:$("helpRuleId"),helpMessage:$("helpMessage"),helpExample:$("helpExample"),sourcePath:$("sourcePath"),sourceMeta:$("sourceMeta"),
  sourceViewer:$("sourceViewer"),statusText:$("statusText"),statusProject:$("statusProject"),statusRuleset:$("statusRuleset"),circuitModal:$("circuitModal"),detailContextMenu:$("detailContextMenu")
};

const CP=()=>PROJECTS.find(project=>project.id===S.pid);
const CR=()=>RULESETS.find(ruleset=>ruleset.id===CP().ruleset);
const SV=()=>CP().vs.find(item=>item.id===S.vid)||CP().vs[0];
const currentFileKey=()=>S.page.startsWith("file:")?S.page.slice(5):"";
const auditedCount=project=>project.vs.filter(item=>item.st!=="未确认").length;
const statusClass=value=>value==="违反"?"violation":value==="不违反"?"pass":"pending";
const levelLabel=item=>item.level||(/(2_1|CID9427)/.test(item.rid)?"严重违规":"一般违规");
const categoryLabel=item=>{
  if(item.category)return item.category;
  if(/^CID9427/.test(item.rid))return "异步电路";
  if(/^CID9588/.test(item.rid))return "命名";
  if(/_1_1_/.test(item.rid))return "命名";
  if(/_1_2_/.test(item.rid))return "基本设计单元";
  if(/_2_1_/.test(item.rid))return "语法约束";
  return "未分类";
};
const sortValue=(item,key)=>key==="rule"?item.rid:key==="level"?levelLabel(item):key==="category"?categoryLabel(item):item[key];
const runClass=value=>value==="完成"?"done":value==="执行中"?"running":"pending";
const pageLabel=id=>(PAGES.find(item=>item[0]===id)||[id,id])[1];
const rulesetTypeLabel=item=>item.type==="builtin"?"原厂":item.type==="backend"?"后端":item.type==="missing"?"缺失":"自定义";
const fileRecords=project=>project.fileContents.map(([path,language,content])=>({key:path,path,language,content}));
const projectRun=()=>CP().run;
const extraStats=project=>{
  if(project.sourceStats){
    return {
      effectiveLoc:Number(project.sourceStats.effectiveLoc)||0,
      commentRate:project.sourceStats.commentRate||"0.0%",
      rulesetTotal:project.stats.rc
    };
  }
  return {
    effectiveLoc:project.id==="servo"?1986:4521,
    commentRate:project.id==="servo"?"13.4%":"18.7%",
    rulesetTotal:project.stats.rc
  };
};
const constraintRows=project=>project.id==="servo"?[
  ["constraints/servo_ctrl.sdc","通过","缺少 pwm_out 约束","时钟域待补充"],
  ["constraints/pin_map.xdc","通过","通过","通过"]
]:[
  ["constraints/test.sdc","通过","通过","缺少复位约束"],
  ["constraints/io_map.xdc","语法待确认","通过","通过"]
];
const designInfo=project=>project.id==="servo"?{
  hierarchy:["servo_top","  pwm_core","    duty_compare","  clock_sync","  fsm_core"],
  ips:[["pll_sys","PLL","黑盒","约束/工程文件"],["xpm_fifo_axis","FIFO","已识别","rtl/servo_top.v"]]
}:project.designSummary?{
  hierarchy:project.designSummary.hierarchy?.length?project.designSummary.hierarchy:["未识别到层次化实例"],
  ips:project.designSummary.ips?.length?project.designSummary.ips.map(item=>[item.name,item.type,item.status,item.source]):[["未识别","-","无黑盒/IP","后端源码扫描"]]
}:{
  hierarchy:["test_top","  check_core","    merrval_reg","  ctrl_sync","  array_index","  math_pkg"],
  ips:[["clk_gen","Clock IP","黑盒","src/test_top.vhd"],["axi_bridge","Interface IP","已识别","工程文件"]]
};

function filteredViolations(project){
  const keyword=S.rsearch.trim().toLowerCase();
  if(!keyword)return project.vs;
  return project.vs.filter(item=>[item.rid,item.file,item.info,item.note,item.tip,levelLabel(item),categoryLabel(item)].join(" ").toLowerCase().includes(keyword));
}

function filteredRules(ruleset){
  const keyword=S.qsearch.trim().toLowerCase();
  if(!keyword)return ruleset.rules;
  return ruleset.rules.filter(rule=>[rule.code,rule.name,rule.cat].join(" ").toLowerCase().includes(keyword));
}

function status(message){
  E.statusText.textContent=message||"状态信息";
  E.statusProject.textContent=`当前工程: ${CP().name}`;
  E.statusRuleset.textContent=`当前规则集: ${CR().name}`;
}

function renderHeaderControls(){
  E.activeProjectSelect.innerHTML=PROJECTS.map(project=>`<option value="${project.id}">${project.name}</option>`).join("");
  E.activeProjectSelect.value=S.pid;
  E.activeRulesetSelect.innerHTML=RULESETS.map(ruleset=>`<option value="${ruleset.id}">${ruleset.name}</option>`).join("");
  E.activeRulesetSelect.value=CP().ruleset;
}

function buildResources(project){
  const root={id:"root",type:"project",label:project.name,children:[]};
  const folders={};
  (project.treeOrder||[]).forEach(name=>{folders[name]={id:name,type:"folder",label:name,children:[]};root.children.push(folders[name]);});
  fileRecords(project).sort((a,b)=>a.path.localeCompare(b.path,"zh-CN")).forEach(file=>{
    const parts=file.path.split("/");
    if(parts.length===1){
      root.children.push({id:file.path,type:"file",label:file.path==="analysis.cfg"?"分析配置":file.path,fileKey:file.path});
      return;
    }
    const folder=parts[0];
    if(!folders[folder]){
      folders[folder]={id:folder,type:"folder",label:folder,children:[]};
      root.children.push(folders[folder]);
    }
    folders[folder].children.push({id:file.path,type:"file",label:parts.slice(1).join("/"),fileKey:file.path});
  });
  return [root];
}

function treeKey(id){return `${CP().id}:${id}`;}

function ensureTreeState(){
  const walk=(nodes,level=0)=>nodes.forEach(node=>{
    if(node.children&&node.children.length){
      if(!(treeKey(node.id) in S.treeOpen))S.treeOpen[treeKey(node.id)]=level<2;
      walk(node.children,level+1);
    }
  });
  walk(buildResources(CP()));
}

function ensureResultState(){
  CP().groups.forEach(group=>{if(!(treeKey(group.id) in S.resultOpen))S.resultOpen[treeKey(group.id)]=true;});
}

function resolveFile(pathLike){
  const normalized=normalize(pathLike);
  return fileRecords(CP()).find(file=>normalized===normalize(file.path)||normalized===normalize(fullPath(CP(),file.path))||normalized.endsWith(`/${normalize(file.path)}`));
}

function openFile(pathLike,line,message){
  const file=resolveFile(pathLike);
  if(!file){status("当前工程未加载该源文件内容");return;}
  if(!S.openFiles.includes(file.key))S.openFiles.push(file.key);
  if(line)S.fileFocus[file.key]=line;
  S.page=`file:${file.key}`;
  renderTabs();
  renderProjectTree();
  renderSource();
  status(message||`已打开源文件 ${baseName(file.path)}`);
}

function closeFile(key){
  const index=S.openFiles.indexOf(key);
  if(index<0)return;
  S.openFiles.splice(index,1);
  delete S.fileFocus[key];
  if(currentFileKey()===key){
    const next=S.openFiles[index]||S.openFiles[index-1];
    S.page=next?`file:${next}`:"report";
  }
  renderAll(`已关闭源文件 ${baseName(key)}`);
}

function renderTabs(){
  E.projectTabs.innerHTML=PROJECTS.map(project=>`<button class="project-tab ${project.id===S.pid?"active":""}" data-project="${project.id}" type="button"><span class="tab-label">${project.name}</span>${PROJECTS.length>1?`<span class="tab-close" data-close-project="${project.id}">×</span>`:""}</button>`).join("");
  const fileTabs=S.openFiles.map(file=>`<button class="workspace-file-tab ${currentFileKey()===file?"active":""}" data-file="${file}" type="button" title="${file}"><span class="tab-label">${baseName(file)}</span><span class="tab-close" data-close-file="${file}">×</span></button>`);
  const pageTabs=PAGES.map(([id,label])=>`<button class="workspace-page-tab ${S.page===id?"active":""}" data-page="${id}" type="button">${label}</button>`);
  E.workspaceTabs.innerHTML=[...pageTabs,...fileTabs].join("");
  document.querySelectorAll(".workspace-page").forEach(page=>page.classList.remove("active"));
  $(currentFileKey()?"page-source":`page-${S.page}`).classList.add("active");
}

function renderProjectNode(node,depth=0){
  const hasChildren=node.children&&node.children.length;
  const opened=hasChildren?S.treeOpen[treeKey(node.id)]!==false:false;
  const activeFile=node.fileKey&&currentFileKey()===node.fileKey;
  return `<div class="tree-node"><div class="tree-node-row ${activeFile?"active":""}" style="padding-left:${depth*16}px">${hasChildren?`<button class="tree-toggle" data-toggle-tree="${node.id}" type="button">${opened?"▾":"▸"}</button>`:'<span class="tree-spacer"></span>'}<span class="tree-icon ${node.type}"></span>${node.fileKey?`<button class="tree-file-button" data-open-file="${node.fileKey}" type="button" title="${node.fileKey}">${node.label}</button>`:`<span class="tree-label">${node.label}</span>`}</div>${hasChildren&&opened?`<div class="tree-node-children">${node.children.map(child=>renderProjectNode(child,depth+1)).join("")}</div>`:""}</div>`;
}

function renderProjectTree(){
  ensureTreeState();
  E.projectTree.innerHTML=buildResources(CP()).map(node=>renderProjectNode(node)).join("");
}

function renderBrowser(){
  ensureResultState();
  E.resultViewSelect.value=S.resultView;
  E.browserSummary.textContent=`在工程${CP().name}中找到${CP().stats.vc}项规则违反。`;
  let groups=CP().groups;
  if(S.resultView==="file"){
    const map=new Map();
    CP().vs.forEach(item=>{const key=baseName(item.file);if(!map.has(key))map.set(key,[]);map.get(key).push({id:item.id,text:`${item.rid} ${item.tip}`});});
    groups=[...map].map(([label,items],index)=>({id:`file-${index}`,label:`${label}（${items.length}项）`,items}));
  }
  if(S.resultView==="status"){
    const map=new Map();
    CP().vs.forEach(item=>{const key=levelLabel(item);if(!map.has(key))map.set(key,[]);map.get(key).push({id:item.id,text:`${item.rid} ${item.tip}`});});
    groups=[...map].map(([label,items],index)=>({id:`status-${index}`,label:`${label}（${items.length}项）`,items}));
  }
  if(S.resultView==="category"){
    const map=new Map();
    CP().vs.forEach(item=>{const key=categoryLabel(item);if(!map.has(key))map.set(key,[]);map.get(key).push({id:item.id,text:`${item.rid} ${item.tip}`});});
    groups=[...map].map(([label,items],index)=>({id:`category-${index}`,label:`${label}（${items.length}项）`,items}));
  }
  E.resultTree.innerHTML=groups.map(group=>`<div class="tree-node"><div class="tree-node-row"><button class="tree-toggle" data-toggle-result="${group.id}" type="button">${S.resultOpen[treeKey(group.id)]!==false?"▾":"▸"}</button><span class="tree-icon folder"></span><span class="tree-label">${group.label}</span><span class="result-meta">${group.items.length}项</span></div>${S.resultOpen[treeKey(group.id)]!==false?`<div class="tree-node-children">${group.items.map(item=>`<div class="tree-node-row ${item.id===S.vid?"active":""}" style="padding-left:22px"><span class="tree-spacer"></span><span class="tree-icon file"></span><button class="result-link" data-violation="${item.id}" type="button" title="${item.text}">${item.text}</button></div>`).join("")}</div>`:""}</div>`).join("");
}

function renderBars(target,items){
  const max=Math.max(...items.map(item=>item[1]));
  target.innerHTML=items.map(([label,count,tone])=>`<div class="chart-row"><span class="chart-label" title="${label}">${label}</span><div class="chart-track"><div class="chart-bar ${tone}" style="width:${Math.max(14,Math.round(count/max*100))}%"><span>${count}</span></div></div><span class="chart-value">${count}</span></div>`).join("");
}

function renderReport(){
  const project=CP(),ruleset=CR(),audited=auditedCount(project);
  const more=extraStats(project);
  const design=designInfo(project);
  E.metricCompile.textContent=project.stats.ce;
  E.metricViolation.textContent=project.stats.vc;
  E.metricAuditState.textContent=`${audited}/${project.stats.vc} 已审计`;
  E.metricLoc.textContent=project.stats.loc;
  E.metricSourceCount.textContent=project.stats.fc;
  E.infoProjectName.textContent=project.name;
  E.infoAnalyst.textContent=project.analyst;
  E.infoRuleset.textContent=ruleset.name;
  E.infoRuleCount.textContent=`${project.stats.rc} 条`;
  E.infoEffectiveLoc.textContent=`${more.effectiveLoc} 行`;
  E.infoCommentRate.textContent=more.commentRate;
  E.infoRulesetTotal.textContent=`${more.rulesetTotal} 条`;
  E.infoRuntime.textContent=`${project.stats.rt} 秒`;
  E.infoStartTime.textContent=project.stats.start;
  E.infoEndTime.textContent=project.stats.end;
  E.infoAudited.textContent=`${audited} 条`;
  if(!S.tpl||!project.templates.includes(S.tpl))S.tpl=project.templates[0];
  E.templateSelect.innerHTML=project.templates.map(item=>`<option value="${item}">${item}</option>`).join("");
  E.templateSelect.value=S.tpl;
  E.reportFormatSelect.value=S.format;
  renderBars(E.fileChart,project.files);
  renderBars(E.ruleChart,project.rules);
  E.hierarchyView.innerHTML=design.hierarchy.map(item=>`<div class="hierarchy-line" style="padding-left:${(item.length-item.trimStart().length)*10}px"><strong>${item.trim()}</strong></div>`).join("");
  E.ipTableBody.innerHTML=design.ips.map(item=>`<tr><td>${item[0]}</td><td>${item[1]}</td><td>${item[2]}</td><td>${item[3]}</td></tr>`).join("");
}

function renderProject(){
  const project=CP();
  E.projectNameInput.value=project.name;
  E.analystInput.value=project.analyst;
  E.projectPathInput.value=project.path;
  E.importModeSelect.innerHTML=["RTL文件夹 + 工程文件","源码目录","仅工程文件","上传代码包"].map(item=>`<option value="${item}">${item}</option>`).join("");
  E.importModeSelect.value=project.mode;
  E.currentRulesetInput.value=CR().name;
  E.savedProjects.innerHTML=PROJECTS.map(item=>`<div class="saved-project-item"><strong>${item.name}</strong><span>${item.path}</span><button data-open-project="${item.id}" type="button">切换到该工程</button>${PROJECTS.length>1?` <button class="delete-project" data-delete-project="${item.id}" type="button">删除</button>`:""}</div>`).join("");
  E.sourcePreviewBody.innerHTML=project.sources.map(item=>`<tr><td class="path-cell"><button class="table-link" data-open-file="${item[0]}" type="button" title="${item[0]}">${item[0]}</button></td><td>${item[1]}</td><td>${item[2]}</td><td>${item[3]}</td><td>${item[4]||""}</td></tr>`).join("");
  E.constraintTableBody.innerHTML=constraintRows(project).map(item=>`<tr><td>${item[0]}</td><td>${item[1]}</td><td>${item[2]}</td><td>${item[3]}</td></tr>`).join("");
  E.integrationBox.textContent=[
    `hdl-checker.bat create -s ${project.path}\\src -p ${project.path} -l v_vhd`,
    `hdl-checker.bat analyze -r ${CR().name.replace(/规则集$/,"")} -p ${project.path}`,
    `hdl-checker.bat report -p ${project.path} -f html -o ${project.path}\\report`
  ].join("\n");
}

function renderRun(run){
  E.progressProject.textContent=run.p;
  E.progressRules.textContent=run.r;
  E.progressRun.textContent=run.x;
  E.progressResult.textContent=run.o;
  E.progressProject.className=runClass(run.p);
  E.progressRules.className=runClass(run.r);
  E.progressRun.className=runClass(run.x);
  E.progressResult.className=runClass(run.o);
  E.progressBar.style.width=`${run.pct}%`;
  E.progressText.textContent=`${run.pct}%`;
  E.progressLog.textContent=run.log.join("\n");
}

function renderRules(){
  const ruleset=CR();
  E.currentRulesetTag.textContent=`当前规则集: ${ruleset.name}`;
  E.rulesetList.innerHTML=RULESETS.map(item=>`<div class="ruleset-item ${item.id===ruleset.id?"active":""}" data-ruleset="${item.id}"><strong>${item.name}</strong><span>${rulesetTypeLabel(item)}规则集</span></div>`).join("");
  E.baseRulesetSelect.innerHTML=RULESETS.map(item=>`<option value="${item.id}">${item.name}</option>`).join("");
  E.baseRulesetSelect.value=ruleset.id;
  const editable=ruleset.type==="custom";
  const keyword=S.qsearch.trim().toLowerCase();
  const rows=ruleset.rules.map((rule,index)=>({rule,index})).filter(({rule})=>!keyword||[rule.code,rule.name,rule.cat].join(" ").toLowerCase().includes(keyword));
  E.ruleTableBody.innerHTML=rows.map(({rule,index})=>`<tr><td><input type="checkbox" data-rule-toggle="${index}" ${rule.on?"checked":""} ${editable?"":"disabled"}></td><td>${rule.code}</td><td>${rule.name}</td><td>${rule.cat}</td><td><select data-rule-severity="${index}" ${editable?"":"disabled"}><option value="严重违规" ${rule.sev==="严重违规"?"selected":""}>严重违规</option><option value="一般违规" ${rule.sev==="一般违规"?"selected":""}>一般违规</option></select></td></tr>`).join("");
  renderRun(projectRun());
}

function renderDetail(){
  const project=CP();
  const rows=[...filteredViolations(project)].sort((a,b)=>{
    const av=S.sortKey==="line"||S.sortKey==="conf"?Number(sortValue(a,S.sortKey)):String(sortValue(a,S.sortKey)||"");
    const bv=S.sortKey==="line"||S.sortKey==="conf"?Number(sortValue(b,S.sortKey)):String(sortValue(b,S.sortKey)||"");
    const result=typeof av==="number"?av-bv:av.localeCompare(bv,"zh-CN");
    return S.sortDir==="asc"?result:-result;
  });
  E.auditedSummary.textContent=`已审计 ${auditedCount(project)} 条 / 共 ${project.stats.vc} 条`;
  E.detailTableBody.innerHTML=rows.map(item=>`<tr class="${item.id===S.vid?"active":""} ${S.selectedRows.includes(item.id)?"selected":""}" data-row="${item.id}"><td><span class="status-pill ${statusClass(item.st)}">${item.st}</span></td><td>${item.rid}</td><td>${levelLabel(item)}</td><td class="path-cell"><button class="table-link" data-open-violation-file="${item.id}" type="button" title="${fullPath(project,item.file)}">${fullPath(project,item.file)}</button></td><td>${item.line}</td><td>${item.conf}</td><td>${item.info}</td><td>${item.note||"-"}</td></tr>`).join("");
}

function renderHelp(){
  const violation=SV();
  E.helpTip.textContent=violation.tip;
  E.helpRuleId.textContent=`${violation.rid} ${violation.tip}`;
  E.helpMessage.textContent=violation.msg;
  E.helpExample.textContent=violation.ex;
}

function renderSource(){
  if(!currentFileKey())return;
  const file=resolveFile(currentFileKey());
  if(!file)return;
  const line=S.fileFocus[file.key]||0;
  E.sourcePath.textContent=fullPath(CP(),file.path);
  E.sourceMeta.textContent=`${file.language} · ${line?`定位到第 ${line} 行`:"未指定定位行"}`;
  E.sourceViewer.innerHTML=file.content.split("\n").map((row,index)=>`<div class="code-line ${index+1===line?"highlight":""}"><span class="line-no">${index+1}</span><span class="line-text">${(row||" ").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</span></div>`).join("");
  requestAnimationFrame(()=>{const active=E.sourceViewer.querySelector(".code-line.highlight");if(active)active.scrollIntoView({block:"center"});});
}

function renderAll(message){
  renderHeaderControls();
  renderTabs();
  renderProjectTree();
  renderBrowser();
  renderReport();
  renderProject();
  renderRules();
  renderDetail();
  renderHelp();
  renderSource();
  status(message);
}

function switchProject(id,message){
  S.pid=id;
  S.openFiles=[];
  S.fileFocus={};
  S.selectedRows=[];
  S.lastSelected=null;
  if(!CP().vs.some(item=>item.id===S.vid))S.vid=CP().vs[0].id;
  if(currentFileKey())S.page="report";
  S.tpl=CP().templates[0];
  ensureTreeState();
  ensureResultState();
  renderAll(message||`已切换到工程 ${CP().name}`);
}

function switchPage(id,message){
  S.page=id;
  renderTabs();
  renderSource();
  status(message||`当前视图: ${pageLabel(id)}`);
}

function setRuleset(id){
  CP().ruleset=id;
  renderAll(`已切换规则集为 ${CR().name}`);
}

function setViolation(id,message){
  S.vid=id;
  renderBrowser();
  renderDetail();
  renderHelp();
  status(message||`已定位到 ${SV().rid}`);
}

function setStatusValue(id,value){
  const record=CP().vs.find(item=>item.id===id);
  if(record)record.st=value;
}

function setStatus(value,all){
  if(all)filteredViolations(CP()).forEach(item=>{item.st=value;});
  else if(S.selectedRows.length)S.selectedRows.forEach(id=>setStatusValue(id,value));
  else setStatusValue(SV().id,value);
  renderDetail();
  renderReport();
  status(all?`已将筛选结果标记为${value}`:`已将${S.selectedRows.length?`${S.selectedRows.length} 条选中结果`:"当前结果"}标记为${value}`);
}

function openModal(){E.circuitModal.classList.remove("hidden");status(`已打开电路图: ${SV().circuit}`);}
function closeModal(){E.circuitModal.classList.add("hidden");status("已关闭电路图弹窗");}
function closeContextMenu(){E.detailContextMenu.classList.add("hidden");S.contextRow=null;}

function openContextMenu(x,y,violationId){
  setViolation(violationId,`已选中 ${SV().rid}，可继续右键处理`);
  S.contextRow=violationId;
  E.detailContextMenu.classList.remove("hidden");
  const left=Math.min(x,(window.innerWidth-(E.detailContextMenu.offsetWidth||168))-8);
  const top=Math.min(y,(window.innerHeight-(E.detailContextMenu.offsetHeight||196))-8);
  E.detailContextMenu.style.left=`${Math.max(8,left)}px`;
  E.detailContextMenu.style.top=`${Math.max(8,top)}px`;
}

function saveProject(){
  const project=CP();
  project.name=E.projectNameInput.value.trim()||project.name;
  project.analyst=E.analystInput.value.trim()||project.analyst;
  project.path=E.projectPathInput.value.trim()||project.path;
  project.mode=E.importModeSelect.value;
  renderAll(`已保存项目 ${project.name}`);
}

function addProject(){
  const project=clone(CP());
  S.pseed+=1;
  project.id=`demo${S.pseed}`;
  project.name=`new_project_${String(S.pseed).padStart(2,"0")}`;
  project.path=`D:\\workspace\\${project.name}`;
  project.analyst="admin";
  const map={};
  project.vs.forEach((item,index)=>{const nextId=`${project.id}_v${index+1}`;map[item.id]=nextId;item.id=nextId;item.st="未确认";});
  project.groups.forEach(group=>group.items.forEach(item=>{item.id=map[item.id]||item.id;}));
  project.run={p:"完成",r:"完成",x:"待执行",o:"待执行",pct:0,log:["[ready] 新建项目后可继续导入源文件并执行检查。"]};
  PROJECTS.push(project);
  S.vid=project.vs[0].id;
  S.page="project";
  switchProject(project.id,`已新建项目 ${project.name}`);
}

function addRuleset(){
  const base=RULESETS.find(item=>item.id===E.baseRulesetSelect.value)||CR();
  S.seed+=1;
  const name=E.newRulesetName.value.trim()||`自定义规则集_${S.seed}`;
  RULESETS.push({id:`custom_${S.seed}`,name,type:"custom",rules:base.rules.map(rule=>({...rule}))});
  setRuleset(`custom_${S.seed}`);
  switchPage("rules","已创建并打开新的规则集");
}

function openProjectPage(message){switchPage("project",message||"已打开项目管理");}
function openSourceList(message){switchPage("project",message||"已打开源文件列表管理");}
function openRuleset(message){switchPage("rules",message||"请选择规则集后运行检查");}
function openReport(message){switchPage("report",message||"已打开分析报告");}

function loadNextProject(){
  const index=(PROJECTS.findIndex(item=>item.id===S.pid)+1)%PROJECTS.length;
  S.page="project";
  switchProject(PROJECTS[index].id,`已加载项目 ${PROJECTS[index].name}`);
}

function removeProject(id){
  if(PROJECTS.length<=1){status("至少保留一个工程");return;}
  const index=PROJECTS.findIndex(item=>item.id===id);
  if(index<0)return;
  const removed=PROJECTS[index].name;
  PROJECTS.splice(index,1);
  if(S.pid===id){
    const next=PROJECTS[Math.min(index,PROJECTS.length-1)];
    S.pid=next.id;
    S.vid=next.vs[0].id;
    S.openFiles=[];
    S.page="report";
  }
  renderAll(`已删除工程 ${removed}`);
}

function exportReport(kind){S.format=kind||E.reportFormatSelect.value;status(`已准备导出 ${S.format} 报告，模板: ${S.tpl}`);}
function quickStartHint(){status("快速流程: 新建工程 -> 选择服务器源码目录 -> 选择规则集并运行检查 -> 审查结果 -> 生成 HTML 报告");}

function runCheck(){
  const run=projectRun();
  const steps=[[16,"执行中","待执行","[16%] 正在生成分析配置与待测文件列表..."],[42,"执行中","待执行","[42%] 正在调用静态分析引擎..."],[78,"执行中","执行中","[78%] 正在归并 XML 结果并更新审计状态..."],[100,"完成","完成",`[100%] 检查完成，共发现 ${CP().stats.vc} 条结果。`]];
  run.x="执行中";run.o="待执行";run.pct=0;run.log=["[start] 已发起新的检查任务。"];renderRun(run);status("正在执行检查...");
  steps.forEach((step,index)=>setTimeout(()=>{run.pct=step[0];run.x=step[1];run.o=step[2];run.log.push(step[3]);renderRun(run);if(step[0]===100){CP().stats.end="2026-04-29 10:28:41.102";renderReport();openReport("执行检查完成，已自动打开分析报告");}},index*540));
}

function updateRule(target){
  const ruleset=CR();
  if(ruleset.type!=="custom")return;
  if(target.dataset.ruleToggle!==undefined)ruleset.rules[Number(target.dataset.ruleToggle)].on=target.checked;
  if(target.dataset.ruleSeverity!==undefined)ruleset.rules[Number(target.dataset.ruleSeverity)].sev=target.value;
  status(`已更新规则集 ${ruleset.name}`);
}

function initSplitter(handle,onStart){
  handle.addEventListener("mousedown",event=>{
    event.preventDefault();
    closeContextMenu();
    document.body.classList.add("is-resizing");
    const state=onStart(event);
    const move=next=>state.move(next);
    const stop=()=>{document.body.classList.remove("is-resizing");document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",stop);};
    document.addEventListener("mousemove",move);
    document.addEventListener("mouseup",stop);
  });
}

function initSplitters(){
  const style=document.documentElement.style;
  initSplitter($("leftSplitter"),start=>{const width=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-pane-width"));return{move(event){style.setProperty("--left-pane-width",`${clamp(width+event.clientX-start.clientX,240,460)}px`);}};});
  initSplitter($("rightSplitter"),start=>{const width=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-pane-width"));return{move(event){style.setProperty("--right-pane-width",`${clamp(width-(event.clientX-start.clientX),240,420)}px`);}};});
  initSplitter($("detailSplitter"),start=>{const height=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--detail-pane-height"));return{move(event){style.setProperty("--detail-pane-height",`${clamp(height-(event.clientY-start.clientY),220,Math.max(260,document.querySelector(".center-column").clientHeight-180))}px`);}};});
  initSplitter($("leftColumnSplitter"),start=>{const height=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-top-height"));return{move(event){style.setProperty("--left-top-height",`${clamp(height+event.clientY-start.clientY,180,Math.max(220,document.querySelector(".left-column").clientHeight-220))}px`);}};});
}

E.projectTabs.addEventListener("click",event=>{
  const closeButton=event.target.closest("[data-close-project]");
  if(closeButton){event.stopPropagation();return removeProject(closeButton.dataset.closeProject);}
  const button=event.target.closest("[data-project]");
  if(button)switchProject(button.dataset.project);
});
E.workspaceTabs.addEventListener("click",event=>{
  const closeButton=event.target.closest("[data-close-file]");
  if(closeButton)return closeFile(closeButton.dataset.closeFile);
  const fileButton=event.target.closest("[data-file]");
  if(fileButton){S.page=`file:${fileButton.dataset.file}`;renderTabs();renderProjectTree();renderSource();return status(`已切换到源文件 ${baseName(fileButton.dataset.file)}`);}
  const pageButton=event.target.closest("[data-page]");
  if(pageButton)switchPage(pageButton.dataset.page);
});

E.projectTree.addEventListener("click",event=>{
  const toggle=event.target.closest("[data-toggle-tree]");
  if(toggle){S.treeOpen[treeKey(toggle.dataset.toggleTree)]=!S.treeOpen[treeKey(toggle.dataset.toggleTree)];return renderProjectTree();}
  const fileButton=event.target.closest("[data-open-file]");
  if(fileButton)openFile(fileButton.dataset.openFile);
});

E.resultTree.addEventListener("click",event=>{
  const toggle=event.target.closest("[data-toggle-result]");
  if(toggle){S.resultOpen[treeKey(toggle.dataset.toggleResult)]=!S.resultOpen[treeKey(toggle.dataset.toggleResult)];return renderBrowser();}
  const button=event.target.closest("[data-violation]");
  if(button)setViolation(button.dataset.violation);
});

E.detailTableBody.addEventListener("click",event=>{
  const fileButton=event.target.closest("[data-open-violation-file]");
  if(fileButton){const record=CP().vs.find(item=>item.id===fileButton.dataset.openViolationFile);if(record)return openFile(record.file,record.line,`已打开 ${baseName(record.file)}`);}
  const row=event.target.closest("[data-row]");
  if(row){
    const visible=Array.from(E.detailTableBody.querySelectorAll("[data-row]")).map(item=>item.dataset.row);
    if(event.shiftKey&&S.lastSelected){
      const a=visible.indexOf(S.lastSelected),b=visible.indexOf(row.dataset.row);
      if(a>=0&&b>=0)S.selectedRows=visible.slice(Math.min(a,b),Math.max(a,b)+1);
    }else if(event.ctrlKey){
      S.selectedRows=S.selectedRows.includes(row.dataset.row)?S.selectedRows.filter(id=>id!==row.dataset.row):[...S.selectedRows,row.dataset.row];
    }else{
      S.selectedRows=[row.dataset.row];
    }
    S.lastSelected=row.dataset.row;
    setViolation(row.dataset.row);
  }
});
E.detailTableBody.addEventListener("dblclick",event=>{const row=event.target.closest("[data-row]");if(!row)return;const record=CP().vs.find(item=>item.id===row.dataset.row);if(record)openFile(record.file,record.line,`已打开 ${baseName(record.file)} 并定位到第 ${record.line} 行`);});
E.detailTableBody.addEventListener("contextmenu",event=>{const row=event.target.closest("[data-row]");if(!row)return;event.preventDefault();openContextMenu(event.clientX,event.clientY,row.dataset.row);});
document.querySelector(".detail-table thead").addEventListener("click",event=>{
  const th=event.target.closest("[data-sort]");
  if(!th)return;
  if(S.sortKey===th.dataset.sort)S.sortDir=S.sortDir==="asc"?"desc":"asc";
  else{S.sortKey=th.dataset.sort;S.sortDir="asc";}
  renderDetail();
  status(`已按${th.textContent.replace(" ⇅","")}排序`);
});

E.detailContextMenu.addEventListener("click",event=>{
  const action=event.target.closest("[data-action]");
  if(!action||!S.contextRow)return;
  if(action.dataset.action==="focus")setViolation(S.contextRow);
  if(action.dataset.action==="open-source"){const record=CP().vs.find(item=>item.id===S.contextRow);if(record)openFile(record.file,record.line,`已打开 ${baseName(record.file)}`);}
  if(action.dataset.action==="violation")setStatusValue(S.contextRow,"违反");
  if(action.dataset.action==="pass")setStatusValue(S.contextRow,"不违反");
  if(action.dataset.action==="pending")setStatusValue(S.contextRow,"未确认");
  if(["violation","pass","pending"].includes(action.dataset.action)){renderDetail();renderReport();status("已更新当前结果的审计状态");}
  if(action.dataset.action==="circuit"){setViolation(S.contextRow);openModal();}
  closeContextMenu();
});

document.addEventListener("click",event=>{
  if(!event.target.closest(".context-menu"))closeContextMenu();
  if(!event.target.closest(".menu-item")){document.querySelectorAll(".menu-popup").forEach(item=>item.classList.remove("open"));document.querySelectorAll(".menu-trigger").forEach(item=>item.classList.remove("active"));}
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeContextMenu();if(!E.circuitModal.classList.contains("hidden"))closeModal();}});

E.activeProjectSelect.addEventListener("change",event=>switchProject(event.target.value,`已选择工程 ${event.target.options[event.target.selectedIndex].text}`));
E.activeRulesetSelect.addEventListener("change",event=>setRuleset(event.target.value));
$("runSelectedProjectBtn").addEventListener("click",()=>runCheck());
$("reportSelectedProjectBtn").addEventListener("click",()=>openReport(`已打开工程 ${CP().name} 的分析报告`));
E.savedProjects.addEventListener("click",event=>{
  const deleteButton=event.target.closest("[data-delete-project]");
  if(deleteButton)return removeProject(deleteButton.dataset.deleteProject);
  const button=event.target.closest("[data-open-project]");
  if(button)switchProject(button.dataset.openProject,`已切换到工程 ${button.dataset.openProject}`);
});
E.sourcePreviewBody.addEventListener("click",event=>{const button=event.target.closest("[data-open-file]");if(button)openFile(button.dataset.openFile);});
E.rulesetList.addEventListener("click",event=>{const item=event.target.closest("[data-ruleset]");if(item){setRuleset(item.dataset.ruleset);switchPage("rules","已切换规则集");}});
E.ruleSearchInput.addEventListener("input",event=>{S.qsearch=event.target.value;renderRules();status("已按关键字筛选规则");});
E.ruleTableBody.addEventListener("change",event=>updateRule(event.target));
E.resultSearchInput.addEventListener("input",event=>{S.rsearch=event.target.value;renderDetail();});
E.resultViewSelect.addEventListener("change",event=>{S.resultView=event.target.value;renderBrowser();status(`结果浏览已切换为${event.target.options[event.target.selectedIndex].text}`);});
E.templateSelect.addEventListener("change",event=>{S.tpl=event.target.value;status(`已选择报告模板 ${S.tpl}`);});
E.reportFormatSelect.addEventListener("change",event=>{S.format=event.target.value;status(`已选择导出格式 ${S.format}`);});

$("saveProjectBtn").addEventListener("click",saveProject);
$("createRulesetBtn").addEventListener("click",addRuleset);
$("saveRulesetBtn").addEventListener("click",()=>status(CR().type==="custom"?`已保存自定义规则集 ${CR().name}`:`当前是原厂规则集 ${CR().name}，演示中不直接修改`));
$("runCheckBtn").addEventListener("click",runCheck);
$("searchBtn").addEventListener("click",()=>{S.rsearch=E.resultSearchInput.value;renderDetail();status("已执行结果搜索");});
$("clearSearchBtn").addEventListener("click",()=>{S.rsearch="";E.resultSearchInput.value="";renderDetail();status("已清除结果搜索条件");});
$("markViolationBtn").addEventListener("click",()=>setStatus("违反",false));
$("markPassBtn").addEventListener("click",()=>setStatus("不违反",false));
$("markPendingBtn").addEventListener("click",()=>setStatus("未确认",false));
$("markAllViolationBtn").addEventListener("click",()=>setStatus("违反",true));
$("markAllPassBtn").addEventListener("click",()=>setStatus("不违反",true));
$("markAllPendingBtn").addEventListener("click",()=>setStatus("未确认",true));
$("openCircuitBtn").addEventListener("click",openModal);
$("closeCircuitModalBtn").addEventListener("click",closeModal);
E.circuitModal.addEventListener("click",event=>{if(event.target===E.circuitModal)closeModal();});
$("exportReportBtn").addEventListener("click",()=>exportReport());

document.querySelectorAll(".menu-trigger").forEach(button=>button.addEventListener("click",event=>{
  event.stopPropagation();
  const popup=button.nextElementSibling;
  const opened=popup.classList.contains("open");
  document.querySelectorAll(".menu-popup").forEach(item=>item.classList.remove("open"));
  document.querySelectorAll(".menu-trigger").forEach(item=>item.classList.remove("active"));
  if(!opened){popup.classList.add("open");button.classList.add("active");}
}));

$("menuCreateProjectBtn").addEventListener("click",addProject);
$("menuLoadProjectBtn").addEventListener("click",loadNextProject);
$("menuSaveProjectBtn").addEventListener("click",saveProject);
$("menuProjectPageBtn").addEventListener("click",()=>openProjectPage());
$("menuSourceListBtn").addEventListener("click",()=>openSourceList());
$("menuRulesetBtn").addEventListener("click",()=>openRuleset());
$("menuRunCheckBtn").addEventListener("click",runCheck);
$("menuResultViewBtn").addEventListener("click",()=>openReport("已打开结果浏览视图"));
$("menuReportBtn").addEventListener("click",()=>openReport("已打开分析报告"));
$("menuExportHtmlBtn").addEventListener("click",()=>exportReport("HTML"));
$("menuExportDocBtn").addEventListener("click",()=>exportReport("Word"));
$("menuExportPdfBtn").addEventListener("click",()=>exportReport("PDF"));
$("menuExportExcelBtn").addEventListener("click",()=>exportReport("Excel"));
$("menuExportWpsBtn").addEventListener("click",()=>exportReport("WPS"));
$("menuHelpDocBtn").addEventListener("click",()=>status("帮助说明：在结果浏览视图中单击违规项，在详细结果视图审计，并可在分析报告中导出报告"));
$("menuQuickStartBtn").addEventListener("click",quickStartHint);
$("toolCreateProjectBtn").addEventListener("click",addProject);
$("toolLoadProjectBtn").addEventListener("click",loadNextProject);
$("toolSaveProjectBtn").addEventListener("click",saveProject);
$("toolSourceListBtn").addEventListener("click",()=>openSourceList());
$("toolRunCheckBtn").addEventListener("click",runCheck);
$("toolReportBtn").addEventListener("click",()=>openReport("已打开分析报告"));

initSplitters();
ensureTreeState();
ensureResultState();
renderAll("已补齐树结构、布局分隔和源码标签页交互");
