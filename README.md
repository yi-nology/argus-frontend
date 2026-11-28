# Argus 审查工作台（argus-frontend）

**TypeScript + Ant Design 6 + Ant Design X** —— 专业的审查运维工作台。

> 对接 [argus-service](https://github.com/yi-nology/argus-service) 受控变更 API。
> 产品入口：[yi-nology/argus](https://github.com/yi-nology/argus)
> 工程差距分析与演进路线：见 `docs/argus-engineering-gap-analysis.md`

## 技术栈

| 层 | 选型 |
|---|---|
| 语言 | TypeScript 5.9（strict + `noUnusedLocals`） |
| 框架 | **Umi 4**（React **19**，配置式路由 + 自动代码分割） |
| 数据层 | Umi `useRequest`（经 `src/hooks/useApi.ts` 收口：错误文案 / last-good / 稳定 run/refresh） |
| UI | Ant Design **6** + @ant-design/icons **6** |
| AI 面 | **@ant-design/x**（Bubble / Sender / Prompts / ThoughtChain / XProvider）+ **x-markdown** |
| 构建 | Umi build（webpack + esbuild，按路由分包） |
| 质量门禁 | ESLint 9（typescript + react-hooks + jsx-a11y）· Prettier · 视觉 token 门禁 |

## 设计语言

**明亮企业风**：浅色为主基调，暗色跟随系统 `prefers-color-scheme`。

- 单一中性表面坡度 + 单一强调蓝 + 语义色（成功/注意/危险 + 五级严重度）
- 实体表面 + 1px 边框分层；**无**毛玻璃 / 渐变 / 光晕 / 粒子 / 呼吸动画
- 排版标尺（12/13/14/16/20/24）+ `tabular-nums` 指标；层级靠排版，不靠透明度
- 严重级 / 裁决 / 状态一律**带文字徽章**，不用色点暗示

**设计 token 单源**是 `src/theme/tokens.ts`：颜色只在该文件出现具体色值，组件一律引用
`t.color.*`（运行时写入 `:root` CSS 变量，自动跟随浅/深主题）。`eslint` 的
`no-restricted-syntax` 封死 TSX 里的裸色值，`npm run check:raw-values` 再封裸
`fontSize` 与 `opacity` 伪层级——两者都是 CI 卡口。

## 页面

| 路由 | 能力 |
|---|---|
| `/login` · `/accept-invite` | 会话登录 / 邀请注册 |
| `/dashboard` | 30 天态势指标 + 回复控制 + 最近任务 |
| `/quality` | 质量运营：裁决分布、token 三账本、按仓巡检 |
| `/tasks` · `/tasks/:id` | 发起审查、任务表、报告与阶段时间线 |
| `/findings` | 意见治理：严重级分布、噪音文件、suppress/restore |
| `/approvals` | 审批票批准 / 拒绝（CAS） |
| `/merges` | 合并资格门七条 + preview → confirm |
| `/fix-push` | 受控推送 preview → confirm（head 绑定） |
| `/assistant` | **Ant Design X** 问答（Markdown / 快捷提示） |
| `/agents` | 插件清单 + 仓库 `.reviewagents.yaml` 生效视图 |
| `/settings/repos` | 按仓回复控制 / 预算 / 报告模板 |
| `/invites` · `/me` | 邀请成员 · 权限矩阵 |

## 开发

```bash
npm install
npm run dev             # http://127.0.0.1:5177 · /api → argus-service :8899
npm run build           # max build → dist/（按路由自动分包）
npm run typecheck       # 仅类型检查（tsc --noEmit）
npm run lint            # ESLint（含裸色值禁令）
npm run format:check    # Prettier
npm run check:raw-values  # 视觉 token 门禁（裸 fontSize / opacity 层级）
```

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `VITE_API_BASE` | `/api` | 后端基路径 |
| `VITE_API_PROXY` | `http://127.0.0.1:8899` | 开发代理目标 |

服务端跨域：`ARGUS_CORS_ALLOW_ORIGINS=http://127.0.0.1:5177`

## 结构

```text
src/
  api/client.ts        # TS API 客户端（信封解包 + camel/snake 归一 + ApiError 收窄）
  auth/AuthContext.tsx # 会话与权限投影（my_permissions）
  theme/tokens.ts      # 设计 token 单源（色/字/间/圆/影/动 + 浅深调色板）
  theme/theme.ts       # antd v6 双主题配置（由 tokens 派生）
  theme/global.css     # 语义 CSS 类（panel / t-* / meta / sev-* / gate-row / report-md）
  components/          # AppLayout · Widgets(StatCard/SeverityBadge/Panel/…) · ErrorBoundary
  hooks/useDeepLink.ts # 治理页深链坐标自动执行（5 页共用）
  pages/               # 15 个页面
```

## 质量门禁（CI）

`lint` → `format:check` → `check:raw-values` → `typecheck` → `build` → docker 冒烟
（SPA index + `/api` 反代 502-not-404 + SPA fallback）→ 多架构镜像。

## 边界

- 权限：`my_permissions` 服务端投影；前端置灰仅提示，服务端 fail-closed。
- 受控写：审批票 / 推送 confirm / 合并资格门，无自动远端写。
- Assistant 问答当前为交互壳（HTTP 无独立 ask 端点时引导走 MCP `ask_argus`）。
- 主题跟随系统，无手动切换器；`prefers-reduced-motion` 时关闭全部动效。
