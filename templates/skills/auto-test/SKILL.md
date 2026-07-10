---
name: "auto-test"
description: "原型自动化检查。每当生成或修改了 HTML/JS 原型后，自动运行静态规则检查 + 运行时冒烟测试，把失败项贴出并修复，直到全绿再交付。Invoke after generating or editing any prototype page, or when user says 跑检查/测一下/有没有bug/交付前自检."
---

# 原型自动化检查

## 触发场景

满足任一即激活：
- 你刚生成或修改了任何 `product/**/*.html` 或页面级 `*.js`（**生成后必跑，不要等用户问**）
- 用户说「跑一下检查」「测一下」「有没有 bug」「交付前自检」「上传前过一遍」

## 它查什么（两层）

**第一层 · 静态规则（零依赖，秒级）** — `scripts/check/static-check.js`
对应 AGENTS.md §2.3 七条红线 与 `CONVENTIONS.md`：
- 脚本加载顺序（base-manager → constants → mock-data → data → common → menu → prd-content → page）
- 禁用 Google Fonts（红线 5 字体系统栈）
- 页面级直接 `localStorage.getItem/setItem`（红线 2，必须走 BaseDataManager）
- `<option>` 硬编码状态文案（红线 3，状态下拉须由 SearchRenderer 从 constants 生成）
- JS 里状态文案字面量（软提示，建议改用 `STATUS_LABELS[...]`）

**第二层 · 运行时冒烟（无头 Chromium）** — `scripts/check/smoke-test.js`
- 真实打开每个页面，抓未捕获异常 / `console.error`
- 抓资源加载失败（404 等，WARN）
- `_form` / `_detail` 页加 `?mode=view`，校验输入框与增删改按钮**物理隐藏**（红线 4）
- 失败页面在 `scripts/check/_screenshots/` 留截图

## 怎么跑

**默认：只查本次改动的页面**（最快，AI 生成后用这个）：

```bash
npm run check:changed
```

指定范围 / 全量 / 只跑静态层：

```bash
node scripts/check/run-checks.js product/demo/pc/活动/某模块   # 指定目录
npm run check                                                      # 全量
node scripts/check/run-checks.js --changed --static-only           # 跳过浏览器层（没装 chromium 时）
```

> 首次使用需在仓库根目录执行一次环境准备：`npm install && npx playwright install chromium`。
> 没装 chromium 时，运行时层会自动跳过、只跑静态层，不会报错。

## 你的工作循环（强制）

1. 生成 / 改完原型 → **立即** `npm run check:changed`。
2. 读报告：
   - **❌ 必须修复**：逐条改。改完**重新跑**，直到这部分清零。
   - **⚠️ 建议修复**：列给 PM，由他决定是否处理，不擅自大改（遵守 §4.3 外科手术式修改）。
3. 报告里给出的行号 `文件:行` 直接定位，**只动命中那一处**，不顺手重构。
4. 回复 PM 时附上验收点：贴最终 `0 ERROR` 的结论，或列出仍需他确认的 WARN。

## 红线（别犯）

- **不要为了让检查通过去删检查项或放宽规则**。检查脚本本身不在本次改动范围内。
- 静态层报的 `localStorage` / `<option>` 硬编码是真问题，按规范改源头，不要用注释绕过。
- 修完务必重跑确认，不要凭记忆判断"应该好了"。
