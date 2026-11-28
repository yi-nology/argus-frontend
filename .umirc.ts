import { defineConfig } from '@umijs/max'

/**
 * Argus 审查工作台 · Umi 4 配置。
 *
 * - 路由：配置式（URL 契约与 v8.x 一致，含 /tasks/:taskId 参数段与深链）。
 * - request 插件仅取 useRequest；dataField: '' 让 formatResult 恒等——
 *   api/client.ts 已解包 {code,data,message} 信封，不能再剥一层 .data。
 * - 视觉纪律见 src/theme/tokens.ts（token 单源，禁裸色值）。
 */
export default defineConfig({
  request: { dataField: '' },
  hash: true,
  // esbuild 压缩的 helper 可能跨 chunk 重名，IIFE 包裹后互不干扰。
  esbuildMinifyIIFE: true,
  // MFSU 的 vendor 预构建会把 React context 拆成双实例（AuthProvider 消费端
  // 拿到另一个 createContext），运行时报 useAuth 脱离 Provider——关闭。
  mfsu: false,
  title: 'Argus · 审查工作台',
  favicons: ['/favicon.svg'],
  metas: [{ name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
  mountElementId: 'root',
  // 构建期注入 API 基址：生产默认同源 /api（nginx 反代），可用 VITE_API_BASE 覆盖。
  // 注意：umi 会对 define 的值自动 JSON.stringify，这里传裸字符串即可。
  define: {
    __ARGUS_API_BASE__: process.env.VITE_API_BASE || '/api',
  },
  // 开发代理：/api/<path> → argus-service/<path>（剥前缀，与 nginx 生产语义一致）。
  proxy: {
    '/api': {
      target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8899',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    },
  },
  routes: [
    { path: '/login', component: '@/pages/Login' },
    { path: '/accept-invite', component: '@/pages/AcceptInvite' },
    {
      path: '/',
      component: '@/layouts/ConsoleLayout',
      routes: [
        { path: '/', redirect: '/dashboard' },
        { path: 'dashboard', component: '@/pages/Dashboard' },
        { path: 'quality', component: '@/pages/Quality' },
        { path: 'tasks', component: '@/pages/Tasks' },
        { path: 'tasks/:taskId', component: '@/pages/TaskDetail' },
        { path: 'findings', component: '@/pages/Findings' },
        { path: 'approvals', component: '@/pages/Approvals' },
        { path: 'merges', component: '@/pages/Merges' },
        { path: 'fix-push', component: '@/pages/FixPush' },
        { path: 'assistant', component: '@/pages/Assistant' },
        { path: 'agents', component: '@/pages/Agents' },
        { path: 'settings/repos', component: '@/pages/RepoSettings' },
        { path: 'invites', component: '@/pages/Invites' },
        { path: 'me', component: '@/pages/Me' },
      ],
    },
    { path: '*', redirect: '/dashboard' },
  ],
  npmClient: 'npm',
})
