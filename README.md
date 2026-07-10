# prototype-agent-kit

本地**原型工作台**脚手架：左侧树形导航 + 中间原型预览 + 右侧 AI Agent（接 [OpenCode](https://opencode.ai)）。
面向产品经理把「业务需求 → PRD → HTML/JS 原型」跑通，并让 AI 在原型旁边直接改页面、对齐 PRD。

```
┌──────────────┬───────────────────────────┬──────────────┐
│  树形导航     │      原型预览 (iframe)      │   AI Agent   │
│  nav-tree     │   product/<id>/pc/*.html   │  OpenCode    │
└──────────────┴───────────────────────────┴──────────────┘
```

---

## 快速开始

### 场景 ①：从零建项目

```bash
npx prototype-agent-kit create myapp     # 或：npx prototype-agent create myapp
cd myapp
npm install
npm run serve
# 打开 http://localhost:8082/product/demo/pc/index.html
```

### 场景 ②：植入已有项目（非破坏式）

```bash
cd 你的项目
npx prototype-agent init        # 只补缺失文件，合并 package.json 脚本，不覆盖你已有内容
npx prototype-agent add-product shop   # 建第一个产品壳
npm run serve
```

> 未发布到公网 npm 时，可用 `npm i github:<your-org>/prototype-agent-kit` 安装。

---

## 右侧 AI Agent（OpenCode）

Agent 面板依赖本机安装 **OpenCode** 并配好一个大模型（provider + API key）。先体检：

```bash
npx prototype-agent doctor
```

- **安装 OpenCode**：见 https://opencode.ai 。装好后确认在 PATH：
  - macOS / Linux：`which opencode`
  - Windows：`where opencode`
- **配模型 / API key**：由 OpenCode 自己管理（`opencode auth`）。本工具只负责把面板消息转发给本机 OpenCode。
- **路径不在 PATH**：在 `proto-kit.config.json` 的 `opencode.bin` 写绝对路径即可。

没装 OpenCode 也能用——导航 + 原型预览正常工作，只是右侧面板不可用。

---

## 命令

| 命令 | 作用 |
|------|------|
| `prototype-agent create <dir>` | 从零创建新项目（含可运行 demo） |
| `prototype-agent init` | 把框架植入当前已有项目（非破坏式） |
| `prototype-agent add-product <id>` | 新增一个产品壳（默认 pc） |
| `prototype-agent serve` | 启动本地服务器 |
| `prototype-agent check [--changed]` | 自动化检查（静态红线 + 冒烟测试） |
| `prototype-agent nav:sync` | 扫描产品目录重建 `nav-tree.json` |
| `prototype-agent doctor` | 体检：Node / OpenCode / 配置 / Playwright |
| `prototype-agent update` | 如何更新框架 |

---

## 目录结构与分层

```
你的项目/
  proto-kit.config.json      # 端口 / OpenCode / 产品列表（唯一配置入口）
  AGENTS.md                  # 给 AI 的协作规范（你拥有，可改）
  rules/ prompts/ workflow/  # 规范与提示词模板（你拥有，可改）
  product/<id>/pc/
    index.html               # 导航壳（薄，引用 /_kit 运行时）
    nav-tree.json            # 页面清单（nav:sync 自动生成）
    ...你的原型页面与 PRD.md
```

三层分离，决定谁负责更新：

| 层 | 内容 | 归属 | 更新 |
|----|------|------|------|
| **运行时** | 服务器 / shared 引擎 / Agent 面板 / 检查脚本 | npm 包内（挂在 `/_kit/`） | `npm update` |
| **可编辑资产** | `rules/` `prompts/` `workflow/` `AGENTS.md` | 你拥有 | `prototype-agent update` 对比后按需合并 |
| **业务内容** | 你的产品 PRD / 原型 / 数据 | 你拥有 | 你自己维护 |

---

## 配置 `proto-kit.config.json`

```json
{
  "port": 8082,
  "opencode": {
    "bin": "auto",                       // 'auto' 自动探测；也可写绝对路径
    "model": "deepseek/deepseek-v4-flash",
    "agent": "build",
    "host": "127.0.0.1",
    "port": 4097
  },
  "products": [
    { "id": "demo", "roots": ["pc"] }
  ]
}
```

环境变量可临时覆盖：`PROTO_KIT_PORT`、`OPENCODE_BIN`、`OPENCODE_MODEL`、`OPENCODE_PORT`。

---

## 更新

- **运行时**（服务器 / 引擎 / Agent 面板 / 检查）随包升级：`npm update prototype-agent-kit`。
- **可编辑资产** 由你拥有，不会被自动覆盖；想同步最新模板时对比
  `node_modules/prototype-agent-kit/templates/docs/` 后按需合并（建议先 git commit 再 diff）。

---

## 现状与边界

- ✅ PC 端（`pc`）导航 + 预览 + Agent 面板已就绪。
- 🚧 **H5 端**（`h5`）规划中，`add-product --h5` 暂未开放。
- 🚧 内置的完整「页面壳（顶栏 + 菜单 + 设计系统）」页面架构仍与原始产品耦合，
  当前 demo 采用**自包含**示例页展示导航能力；把整套页面壳做成产品无关的 `PageShell`
  是下一步里程碑。
- Agent 面板需要本机 OpenCode；仅从 `127.0.0.1` 访问。

## License

MIT
