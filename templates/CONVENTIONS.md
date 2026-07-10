# CONVENTIONS.md — 原型页面约定

> 这份文件说明 **`prototype-agent check` 静态检查器实际强制的红线**，以及配套的写法约定。
> 它和运行时（`scripts/check/` + `shared/` 引擎）耦合，改动检查器时同步改这里。
> 你团队自己的 PRD 模板、业务规范、术语，请另建 `rules/` 放，不必写进本文件。

---

## 检查器强制项（违反 = `check` 报 ERROR）

1. **脚本加载顺序**
   页面里出现的核心脚本必须按此相对先后：
   `base-manager.js → constants.js → mock-data.js → data.js → common.js → menu.js → prd-content.js → 页面脚本`

2. **数据走 BaseDataManager**
   页面级 JS / 内联脚本**禁止**直接 `localStorage.getItem/setItem/removeItem`。
   所有读写通过继承 `BaseDataManager` 的 Manager（见 `shared/base-manager.js`）。

3. **状态值常量化**
   `<option>` **禁止**硬编码状态文案（如「已审核」「待提交」）。状态下拉由 Renderer 从
   `shared/constants/status.js` 的 `STATUS_LABELS` 生成。

4. **字体系统栈，禁止 Google Fonts**
   不得引用 `fonts.googleapis.com` / `fonts.gstatic.com`。统一用：
   `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif`

## 冒烟测试项（`check` 的运行时部分，Playwright）

5. **`?mode=view` 物理隐藏**
   URL 带 `?mode=view` 时，所有 input / textarea / 删除 / 编辑 / 提交按钮必须
   `display:none`（**物理隐藏**），不是 `disabled`。

6. **无 console 报错**
   每个页面打开时不得抛未捕获异常或 `console.error`。

---

## 配套写法约定（不强制，但建议）

- **零内联**：HTML 只放容器（`#searchForm` / `#tableContainer` 等），按钮、下拉、操作列经
  `shared/common.js` 的 Renderer 渲染，别写死在 HTML 里。
- **表单栅格**：上下布局，Label 在控件上方左对齐；普通项三栏，textarea 占满一行。
- **查询区按钮聚拢**：「查询 / 重置 / 新增」左对齐放在同一个 `.search-actions`。

---

## 怎么跑检查

```bash
prototype-agent check            # 扫全部产品页面
prototype-agent check --changed  # 只扫 git 改动的页面
```

生成或修改任何原型页面后立即跑一次，把 ERROR 全部修掉再交付（`auto-test` skill 会提醒 AI 这么做）。
