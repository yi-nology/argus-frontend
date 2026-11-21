# Argus 审查工作台（argus-frontend）

自托管多用户 PR 审查与受控变更工作台前端。对接 **argus-service**（Go 服务）的
登录/任务/审批/合并/推送 API；设计纪律对齐 MergePilot Console（密集工程看板：
状态「图标+文字+颜色」三元组、无渐变无阴影堆叠、等宽仅用于 id/sha/时间）。

## 能力页

| 页面 | API | 说明 |
|---|---|---|
| 登录 / 接受邀请 | `POST /auth/login` · `POST /auth/accept-invite` | 会话 token；邀请永不授予 admin |
| 总览 | `GET /stats/overview` · `GET /tasks` | 30 天裁决分布 + 最近任务 |
| 任务 / 详情 | `GET /tasks` · `GET /tasks/:id` | 发起审查、报告预览 |
| 修复审批 | `GET /fix-approvals` · `POST /fix-approvals/decide` | critical/high 具名批准门 |
| 合并 | `GET /merges/eligibility` · `preview/confirm/reconcile` | 七条 fail-closed + 绑定 head |
| 修复推送 | `GET /fix-push/preview` · `POST /fix-push/confirm` | `ARGUS_FIX_PUSH=confirm` 两阶段 |
| 邀请 | `POST /auth/invites` | admin 角色生成一次性 token |
| 我的权限 | `GET /auth/me` | my_permissions 投影 |

## 开发

```bash
npm install
npm run dev          # http://127.0.0.1:5177，/api 代理到 argus-service :8899
```

生产构建：

```bash
npm run build        # dist/ 由 Nginx/argus-service 静态托管
```

环境变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_API_BASE` | `/api` | 后端基路径（生产反代时改为 `https://argus.example.com`） |
| `VITE_API_PROXY` | `http://127.0.0.1:8899` | 仅开发代理目标 |

服务端需放行跨域（若分离域部署）：`ARGUS_CORS_ALLOW_ORIGINS=http://127.0.0.1:5177`。

## 与 argus-service 的边界

- **权限**：`my_permissions` 服务端投影；前端按钮置灰仅作提示，服务端 fail-closed。
- **受控写**：合并/推送/审批全部 preview→confirm 或票据门；前端不自动写远端。
- **状态色**：绿/红/琥珀/蓝只用于生命状态，禁装饰。

## 结构

```text
src/
  api.js          # fetch 客户端 + Bearer 会话
  auth.jsx        # AuthProvider / useAuth / can(perm)
  components/Layout.jsx
  pages/          # Login Overview Tasks TaskDetail Approvals Merges FixPush Invites Me
  styles.css      # 密集工程控制台样式
```
