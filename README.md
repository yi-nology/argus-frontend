# Argus 审查工作台（argus-frontend）

**TypeScript + Ant Design 6 + Ant Design X** 重构版 —— 深空科技风工作台。

> 对接 [argus-service](https://github.com/yi-nology/argus-service) 受控变更 API。
> 产品入口：[yi-nology/argus](https://github.com/yi-nology/argus)

## 技术栈

| 层 | 选型 |
|---|---|
| 语言 | TypeScript 5.9（strict） |
| UI | Ant Design **6** + @ant-design/icons **6** |
| AI 面 | **@ant-design/x**（Bubble / Sender / Prompts）+ **x-markdown** |
| 框架 | React **19** + React Router **7** |
| 构建 | Vite **7**（分包 antd / x / react） |
| 字体 | Space Grotesk + JetBrains Mono |

## 视觉

- 深空底 `#070b14` + 星点层 + 径向极光
- 玻璃拟态卡片（backdrop-filter blur）
- 渐变描边统计卡 / 发光主按钮 / 渐变标题字
- 状态光点（含 running 呼吸动画）
- 资格门检查行按 ok/err 着色

## 页面

| 路由 | 能力 |
|---|---|
| `/login` · `/accept-invite` | 会话登录 / 邀请注册 |
| `/dashboard` | 30 天态势统计卡 + 最近任务 |
| `/tasks` · `/tasks/:id` | 发起审查、任务表、报告查看 |
| `/approvals` | 审批票批准 / 拒绝（CAS） |
| `/merges` | 合并资格门七条 + preview → confirm |
| `/fix-push` | 受控推送 preview → confirm |
| `/assistant` | **Ant Design X** 问答（Markdown / 快捷提示） |
| `/invites` · `/me` | 邀请成员 · my_permissions 权限矩阵 |

## 开发

```bash
npm install
npm run dev          # http://127.0.0.1:5177 · /api → argus-service :8899
npm run build        # tsc -b && vite build → dist/
npm run typecheck    # 仅类型检查
```

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `VITE_API_BASE` | `/api` | 后端基路径 |
| `VITE_API_PROXY` | `http://127.0.0.1:8899` | 开发代理目标 |

服务端跨域：`ARGUS_CORS_ALLOW_ORIGINS=http://127.0.0.1:5177`

## 结构

```text
src/
  api/client.ts      # TS API 客户端（类型化响应）
  auth/AuthContext.tsx
  theme/theme.ts     # antd v6 token + palette
  theme/global.css   # 玻璃拟态 / 渐变 / 光点
  components/        # AppLayout · StatCard · StatusDot
  pages/             # Login Dashboard Tasks Approvals Merges FixPush Assistant…
```

## 边界

- 权限：`my_permissions` 服务端投影；前端置灰仅提示，服务端 fail-closed。
- 受控写：审批票 / 推送 confirm / 合并资格门，无自动远端写。
- Assistant 问答当前为交互壳（HTTP 无独立 ask 端点时引导走 MCP `ask_argus`）。
