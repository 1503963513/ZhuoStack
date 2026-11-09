---
name: i18n
description: Guide and standard workflows for using, developing, and extending internationalization (i18n) across frontend UI, menus, tabs, and backend error messages in ZhuoStack.
---

# i18n Skill for ZhuoStack

本 Skill 规范了在 ZhuoStack 项目中进行国际化（i18n）的使用、开发与新业务扩展标准。

## 核心架构与设计原则

1. **统一状态与持久化**：
   - 国际化状态维护在 `apps/web/src/stores/i18n-store.ts`，支持 LocalStorage 持久化同步。
   - 切换语言时自动更新 `document.documentElement.lang`。
2. **两级键值字典规范**：
   - 语言包存放在 `apps/web/src/locales/{locale}/`（目前支持 `zh-CN`、`en-US`）。
   - 常用命名空间：
     - `common.*`：确认、取消、保存、删除、状态、操作等通用 UI 词汇。
     - `menu.*`：侧边栏菜单与页签路由映射（支持路由路径 key 如 `menu./system/user` 与数据库菜单名 key 如 `menu.用户管理`）。
     - `auth.*`：登录、注册、找回密码等认证相关词汇。
     - `{module}.*`：具体业务模块的独立命名空间（如 `role.*`, `dict.*`, `config.*`）。

---

## 常用开发工作流

### 1. 在 React 组件中使用多语言

在任何客户端组件（`'use client'`）中引入 `useI18n`：

```tsx
'use client';

import { useI18n } from '@/hooks/use-i18n';

export function MyComponent() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div>
      {/* 基础用法：带默认兜底文本 */}
      <button>{t('common.confirm', '确定')}</button>

      {/* 提示文案 */}
      <p>{t('auth.loginDesc', '请输入您的账号信息登录')}</p>
    </div>
  );
}
```

### 2. 为新页面/新菜单添加国际化

新增一个后台业务页面时，请同时更新两个语言文件：

1. **更新中文包**：`apps/web/src/locales/zh-CN/common.ts`
   ```typescript
   export const zhCN = {
     menu: {
       '/your/path': '页面名称',
       '页面名称': '页面名称',
     },
     // 新模块专属词条
     yourModule: {
       title: '标题',
       createBtn: '新增记录',
     },
   };
   ```

2. **更新英文包**：`apps/web/src/locales/en-US/common.ts`
   ```typescript
   export const enUS = {
     menu: {
       '/your/path': 'Page Name',
       '页面名称': 'Page Name',
     },
     yourModule: {
       title: 'Title',
       createBtn: 'New Record',
     },
   };
   ```

3. **侧边栏与多页签自动联动**：
   - 侧边栏（`sidebar.tsx`）和多页签（`page-tabs.tsx`）已内置多语言解析器，只要在 `menu` 命名空间中配置了对应路由路径或菜单名，语言切换时会自动平滑刷新，无需额外写代码。

### 3. 支持新语种扩展（如日语 ja-JP、繁体中文 zh-TW）

1. 在 `apps/web/src/locales/` 下新建对应语言目录及文件（如 `ja-JP/common.ts`）；
2. 在 `apps/web/src/stores/i18n-store.ts` 中：
   - 将新语言代码加入 `type Locale`；
   - 在 `LOCALES` 数组中添加显示标签（如 `{ code: 'ja-JP', label: '日本語' }`）；
   - 将新语言包引入并注册到 `MESSAGES` 字典中；
3. 顶栏的 `LanguageToggle` 下拉菜单会自动展示新语言选项。

---

## 质量要求与校验

- **编译检查**：每次修改语言包或组件后，执行 `pnpm --filter web typecheck` 确保 TypeScript 类型安全。
- **兜底保障**：调用 `t(key, fallback)` 时建议始终传入第 2 个参数作为默认文本，防止键名未定义时直接暴露原始 key。
