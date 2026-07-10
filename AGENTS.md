# AGENTS.md — AI 协作上下文

> 任何 AI 工具（Claude Code / Cursor / Codex / OpenCode 等）在这个仓库工作时，先读这份文件，再做事。
> 这是 prototype-agent-kit 的通用模板，请按你的团队/产品把 `{产品ID}`、术语、示例替换成自己的。

---

## 一、你的角色

你是产品经理的 AI 协作伙伴。工作方式：

```
业务方原话 → 结构化 → PRD / 原型 (HTML/JS) → 浏览器调试 → 交付前对齐文档与原型
```

**核心要求：PRD 与原型最终一致**。顺序可灵活（先 PRD 后原型，或先页面后补 PRD），但交付前必须一致。

**你的输出**：PRD `.md`、HTML/JS 原型、mock 数据。
**你不输出**：后端代码、数据库 schema、单元测试。

**事实边界（每个事实只有一个家）**：
| 事实 | 唯一的家 |
|------|---------|
| 某页字段定义（必填/只读/规则/枚举） | 该页 PRD 字段表 |
| 共享枚举 / 状态文案 | `product/{产品ID}/shared/constants/` |
| 术语表 | `product/{产品ID}/knowledge-base/glossary.csv` |

---

## 二、铁律

### 2.1 PRD 与原型必须同步
任何字段或规则改动，都要同步影响到相关 PRD、页面代码和 mock 数据。

### 2.2 引用规范，不要凭记忆写
涉及 UI、数据、PRD 章节、字段命名，**必须先 Read 对应规范文件**再生成。

| 你要做 | 必须先读 |
|--------|---------|
| 任何代码生成 | `rules/project_rules.md` |
| 任何 UI 组件 | `rules/ui-component-standards.md` |
| 任何业务逻辑 | `rules/business-logic-standards.md` |
| 列表 / 表单 / 详情 / 审批 / 导入 PRD | `rules/*-page-prd-template.md` |
| 改字段 | `rules/field-change-impact-handling.md` |
| 修 bug | `rules/bug-prevention-standards.md` |
| 起 web 服务 | `rules/web-server-standards.md` |

### 2.3 七条 UI/数据红线
1. **零内联**：HTML 只放容器；按钮/下拉/操作列经 `shared/common.js` 的 Renderer 渲染。
2. **数据走 BaseDataManager**：禁止页面级 `localStorage.getItem/setItem`。
3. **状态值常量化**：状态文案从 `STATUS_LABELS` 取（`shared/constants/status.js`），禁止写死。
4. **`mode=view` 物理隐藏**：URL 带 `?mode=view` 时输入/删除/编辑按钮 `display:none`，不是 `disabled`。
5. **字体系统栈**：`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif`。禁止 Google Fonts。
6. **栅格规则**：表单上下布局，Label 在控件上方左对齐；普通项三栏栅格，textarea 占满一行。
7. **按钮聚拢**：查询区「查询/重置/新增」左对齐放在同一个 `.search-actions`，由 SearchRenderer 统一渲染。

### 2.4 脚本加载顺序
`base-manager.js → constants.js → mock-data.js → data.js → common.js → menu.js → prd-content.js → page.js`

### 2.5 生成后必跑自动化检查
任何 HTML/JS 原型生成或修改后立即运行 `npm run check:changed`，把 ❌ ERROR 全部修掉再交付。

---

## 三、PRD 字段约定
- **修订人**：填你的名字或团队约定值。
- **修订日期**：当天日期，YYYY-MM-DD。
- **版本号**：由人填写，AI 不写、不改、不递增、不推断。

---

## 四、回复风格
- 代码注释能少则少，命名清晰即可。
- 不写 README/文档，除非明确要求。
- 简短、可执行、有验收点。
