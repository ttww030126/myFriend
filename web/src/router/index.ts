import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// 路由表 + /login 守卫
const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
  { path: '/s/:token', name: 'share', component: () => import('@/pages/SharePage.vue'), meta: { public: true } },
  { path: '/r/:token', name: 'report-share', component: () => import('@/pages/ReportSharePage.vue'), meta: { public: true } },
  { path: '/groups/join/:code', name: 'join-group', component: () => import('@/pages/JoinGroupPage.vue') },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/pages/HomePage.vue') },
      { path: 'chat', name: 'chat', component: () => import('@/pages/ChatPage.vue') },
      { path: 'group-chat', name: 'group-chat', component: () => import('@/pages/GroupChatPage.vue') },
      { path: 'research', name: 'research', component: () => import('@/pages/ResearchPage.vue') },
      { path: 'agent-tasks', name: 'agent-tasks', component: () => import('@/pages/AgentTaskPage.vue') },
      { path: 'knowledge', name: 'knowledge', component: () => import('@/pages/KnowledgeBasePage.vue') },
      { path: 'knowledge-bases/:kbId', name: 'kb-detail', component: () => import('@/pages/KnowledgeDetailPage.vue') },
      { path: 'images', name: 'images', component: () => import('@/pages/ImagePage.vue') },
      { path: 'memory', name: 'memory', component: () => import('@/pages/MemoryPage.vue') },
      { path: 'graph', name: 'graph', component: () => import('@/pages/GraphPage.vue') },
      { path: 'music', name: 'music', component: () => import('@/pages/MusicLibraryPage.vue') },
      { path: 'search', name: 'search', component: () => import('@/pages/SearchPage.vue') },
      { path: 'favorites', name: 'favorites', component: () => import('@/pages/FavoritesPage.vue') },
      { path: 'profile', name: 'profile', component: () => import('@/pages/ProfilePage.vue') },
      { path: 'settings/models', name: 'models', component: () => import('@/pages/ModelConfigPage.vue') },
      { path: 'settings/agent', name: 'agent', component: () => import('@/pages/AgentConfigPage.vue') },
      { path: 'settings/skills', name: 'skills', component: () => import('@/pages/SkillPage.vue') },
      { path: 'settings/tools', name: 'tools', component: () => import('@/pages/ToolConfigPage.vue') },
      { path: 'settings/notify', name: 'notify', component: () => import('@/pages/NotifyChannelPage.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// 登录守卫：无 token 且访问非公开页 → 跳登录
router.beforeEach((to) => {
  const authed = !!localStorage.getItem('access_token')
  if (!to.meta.public && !authed) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && authed) return { path: '/' }
  return true
})

export default router
