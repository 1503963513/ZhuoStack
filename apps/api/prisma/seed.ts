import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, Status, MenuType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

function createPrismaAdapter(): PrismaMariaDb | PrismaPg {
  const databaseUrl = process.env.DATABASE_URL;
  const configuredType = process.env.DB_TYPE ?? 'postgres';
  const dbType = configuredType === 'postgresql' ? 'postgres' : configuredType;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize Prisma');
  }

  if (dbType === 'mysql') {
    return new PrismaMariaDb(databaseUrl);
  }

  if (dbType === 'postgres') {
    return new PrismaPg({ connectionString: databaseUrl });
  }

  throw new Error(`DB_TYPE must be postgres or mysql, received: ${configuredType}`);
}

const rootPrisma = new PrismaClient({ adapter: createPrismaAdapter() });
let prisma = rootPrisma;
const isAdminBootstrap = process.argv.includes('--bootstrap-admin');

async function validateAdminBootstrap(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('管理员引导命令只允许在 NODE_ENV=production 下执行');
  }
  if (process.env.ADMIN_BOOTSTRAP_CONFIRM !== 'CREATE_FIRST_ADMIN') {
    throw new Error('请设置 ADMIN_BOOTSTRAP_CONFIRM=CREATE_FIRST_ADMIN 明确确认初始化');
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('必须通过环境变量提供 BOOTSTRAP_ADMIN_EMAIL 和 BOOTSTRAP_ADMIN_PASSWORD');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL 必须是有效邮箱地址');
  }
  if (password.length < 12) {
    throw new Error('管理员密码至少需要 12 个字符');
  }
  if (email === 'admin@example.com' || password === 'Admin@123456') {
    throw new Error('不能使用仓库中的演示管理员凭据');
  }

  const [users, menus, roles, dictionaries, departments, posts] = await Promise.all([
    prisma.user.count(),
    prisma.sysMenu.count(),
    prisma.sysRole.count(),
    prisma.sysDict.count(),
    prisma.sysDept.count(),
    prisma.sysPost.count(),
  ]);
  if (users + menus + roles + dictionaries + departments + posts > 0) {
    throw new Error(
      '数据库已有用户或系统基础数据，拒绝初始化。该命令只适用于已完成迁移的全新空库。',
    );
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !isAdminBootstrap) {
    throw new Error('生产环境禁止执行会清空业务数据的 Seed');
  }
  if (!isAdminBootstrap && process.env.SEED_ALLOW_DESTRUCTIVE !== 'true') {
    throw new Error('Seed 会清空现有业务数据；请通过 pnpm db:seed/db:setup 执行并确认数据可丢弃');
  }

  if (isAdminBootstrap) {
    await rootPrisma.$transaction(
      async (transaction) => {
        prisma = transaction as unknown as PrismaClient;
        await validateAdminBootstrap();
        await seedData();
      },
      { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 },
    );
    return;
  }

  await seedData();
}

async function seedData(): Promise<void> {
  console.log(isAdminBootstrap ? 'Initializing production system and first administrator...' : 'Seeding database...');

  if (!isAdminBootstrap) {
    // Clean existing data（仅限已显式确认的非生产环境）
    await prisma.sysDictData.deleteMany({});
    await prisma.sysDict.deleteMany({});
    await prisma.sysMenu.deleteMany({});
    await prisma.sysRole.deleteMany({});
    await prisma.sysPost.deleteMany({});
    await prisma.sysDept.deleteMany({});
    await prisma.user.deleteMany({});
  }

  let deptTechId: string | null = null;
  let deptProductId: string | null = null;
  let deptFrontendId: string | null = null;
  let deptBackendId: string | null = null;
  let postDevId: string | null = null;
  let postPmId: string | null = null;

  if (!isAdminBootstrap) {
    // 示例组织架构仅用于开发和测试 seed。
    console.log('Creating departments...');
    const deptRoot = await prisma.sysDept.create({
      data: { name: '总公司', sort: 0, status: Status.ACTIVE },
    });
    const deptTech = await prisma.sysDept.create({
      data: { name: '技术部', parentId: deptRoot.id, sort: 1, status: Status.ACTIVE },
    });
    deptTechId = deptTech.id;
    deptProductId = (
      await prisma.sysDept.create({
        data: { name: '产品部', parentId: deptRoot.id, sort: 2, status: Status.ACTIVE },
      })
    ).id;
    await prisma.sysDept.create({
      data: { name: '运维部', parentId: deptRoot.id, sort: 3, status: Status.ACTIVE },
    });
    deptFrontendId = (
      await prisma.sysDept.create({
        data: { name: '前端组', parentId: deptTech.id, sort: 1, status: Status.ACTIVE },
      })
    ).id;
    deptBackendId = (
      await prisma.sysDept.create({
        data: { name: '后端组', parentId: deptTech.id, sort: 2, status: Status.ACTIVE },
      })
    ).id;

    console.log('Creating posts...');
    postDevId = (
      await prisma.sysPost.create({
        data: { name: '开发工程师', code: 'dev', sort: 1, status: Status.ACTIVE },
      })
    ).id;
    postPmId = (
      await prisma.sysPost.create({
        data: { name: '产品经理', code: 'pm', sort: 2, status: Status.ACTIVE },
      })
    ).id;
    await prisma.sysPost.create({
      data: { name: '运维工程师', code: 'ops', sort: 3, status: Status.ACTIVE },
    });
    console.log('Development departments and posts created');
  }

  // ========== 菜单管理（内置系统菜单） ==========
  console.log('Creating menus...');

  // 一级菜单：系统管理
  const menuSystem = await prisma.sysMenu.create({
    data: {
      name: '系统管理',
      type: MenuType.DIRECTORY,
      path: '/system',
      icon: 'Settings',
      sort: 1,
      status: Status.ACTIVE,
    },
  });

  // 二级菜单：系统管理子菜单
  const menuDept = await prisma.sysMenu.create({
    data: {
      name: '部门管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/dept',
      component: 'system/dept/index',
      icon: 'Building2',
      sort: 1,
      status: Status.ACTIVE,
    },
  });

  const menuPost = await prisma.sysMenu.create({
    data: {
      name: '岗位管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/post',
      component: 'system/post/index',
      icon: 'Briefcase',
      sort: 2,
      status: Status.ACTIVE,
    },
  });

  const menuRole = await prisma.sysMenu.create({
    data: {
      name: '角色管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/role',
      component: 'system/role/index',
      icon: 'Shield',
      sort: 3,
      status: Status.ACTIVE,
    },
  });

  const menuMenu = await prisma.sysMenu.create({
    data: {
      name: '菜单管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/menu',
      component: 'system/menu/index',
      icon: 'Menu',
      sort: 4,
      status: Status.ACTIVE,
    },
  });

  const menuDict = await prisma.sysMenu.create({
    data: {
      name: '字典管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/dict',
      component: 'system/dict/index',
      icon: 'BookOpen',
      sort: 5,
      status: Status.ACTIVE,
    },
  });

  const menuUser = await prisma.sysMenu.create({
    data: {
      name: '用户管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/user',
      component: 'system/user/index',
      icon: 'Users',
      sort: 6,
      status: Status.ACTIVE,
    },
  });

  const menuOperLog = await prisma.sysMenu.create({
    data: {
      name: '操作日志',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/oper-log',
      component: 'system/oper-log/index',
      icon: 'FileText',
      sort: 7,
      status: Status.ACTIVE,
    },
  });

  const menuLoginLog = await prisma.sysMenu.create({
    data: {
      name: '登录日志',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/login-log',
      component: 'system/login-log/index',
      icon: 'FileText',
      sort: 8,
      status: Status.ACTIVE,
    },
  });

  const menuFile = await prisma.sysMenu.create({
    data: {
      name: '文件管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/file',
      component: 'system/file/index',
      icon: 'FolderOpen',
      sort: 9,
      status: Status.ACTIVE,
    },
  });

  const menuNotification = await prisma.sysMenu.create({
    data: {
      name: '通知中心',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/notifications',
      component: 'notifications/index',
      icon: 'Bell',
      sort: 10,
      status: Status.ACTIVE,
    },
  });


  // 三级菜单：按钮权限（部门管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '部门新增',
        parentId: menuDept.id,
        type: MenuType.BUTTON,
        perms: 'system:dept:add',
        sort: 1,
        status: Status.ACTIVE,
      },
      {
        name: '部门编辑',
        parentId: menuDept.id,
        type: MenuType.BUTTON,
        perms: 'system:dept:edit',
        sort: 2,
        status: Status.ACTIVE,
      },
      {
        name: '部门删除',
        parentId: menuDept.id,
        type: MenuType.BUTTON,
        perms: 'system:dept:delete',
        sort: 3,
        status: Status.ACTIVE,
      },
    ],
  });

  // 三级菜单：按钮权限（角色管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '角色新增',
        parentId: menuRole.id,
        type: MenuType.BUTTON,
        perms: 'system:role:add',
        sort: 1,
        status: Status.ACTIVE,
      },
      {
        name: '角色编辑',
        parentId: menuRole.id,
        type: MenuType.BUTTON,
        perms: 'system:role:edit',
        sort: 2,
        status: Status.ACTIVE,
      },
      {
        name: '角色删除',
        parentId: menuRole.id,
        type: MenuType.BUTTON,
        perms: 'system:role:delete',
        sort: 3,
        status: Status.ACTIVE,
      },
    ],
  });

  // 三级菜单：按钮权限（岗位管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '岗位新增',
        parentId: menuPost.id,
        type: MenuType.BUTTON,
        perms: 'system:post:add',
        sort: 1,
        status: Status.ACTIVE,
      },
      {
        name: '岗位编辑',
        parentId: menuPost.id,
        type: MenuType.BUTTON,
        perms: 'system:post:edit',
        sort: 2,
        status: Status.ACTIVE,
      },
      {
        name: '岗位删除',
        parentId: menuPost.id,
        type: MenuType.BUTTON,
        perms: 'system:post:delete',
        sort: 3,
        status: Status.ACTIVE,
      },
    ],
  });

  // 三级菜单：按钮权限（菜单管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '菜单新增',
        parentId: menuMenu.id,
        type: MenuType.BUTTON,
        perms: 'system:menu:add',
        sort: 1,
        status: Status.ACTIVE,
      },
      {
        name: '菜单编辑',
        parentId: menuMenu.id,
        type: MenuType.BUTTON,
        perms: 'system:menu:edit',
        sort: 2,
        status: Status.ACTIVE,
      },
      {
        name: '菜单删除',
        parentId: menuMenu.id,
        type: MenuType.BUTTON,
        perms: 'system:menu:delete',
        sort: 3,
        status: Status.ACTIVE,
      },
    ],
  });

  // 三级菜单：按钮权限（字典管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '字典新增',
        parentId: menuDict.id,
        type: MenuType.BUTTON,
        perms: 'system:dict:add',
        sort: 1,
        status: Status.ACTIVE,
      },
      {
        name: '字典编辑',
        parentId: menuDict.id,
        type: MenuType.BUTTON,
        perms: 'system:dict:edit',
        sort: 2,
        status: Status.ACTIVE,
      },
      {
        name: '字典删除',
        parentId: menuDict.id,
        type: MenuType.BUTTON,
        perms: 'system:dict:delete',
        sort: 3,
        status: Status.ACTIVE,
      },
      {
        name: '字典数据',
        parentId: menuDict.id,
        type: MenuType.BUTTON,
        perms: 'system:dict:data',
        sort: 4,
        status: Status.ACTIVE,
      },
    ],
  });

  // 三级菜单：按钮权限（用户管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '用户新增',
        parentId: menuUser.id,
        type: MenuType.BUTTON,
        perms: 'system:user:add',
        sort: 1,
        status: Status.ACTIVE,
      },
      {
        name: '用户编辑',
        parentId: menuUser.id,
        type: MenuType.BUTTON,
        perms: 'system:user:edit',
        sort: 2,
        status: Status.ACTIVE,
      },
      {
        name: '用户删除',
        parentId: menuUser.id,
        type: MenuType.BUTTON,
        perms: 'system:user:delete',
        sort: 3,
        status: Status.ACTIVE,
      },
    ],
  });

  // 三级菜单：按钮权限（操作日志下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '操作日志删除',
        parentId: menuOperLog.id,
        type: MenuType.BUTTON,
        perms: 'log:oper:delete',
        sort: 1,
        status: Status.ACTIVE,
      },
    ],
  });

  // 三级菜单：按钮权限（登录日志下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '登录日志删除',
        parentId: menuLoginLog.id,
        type: MenuType.BUTTON,
        perms: 'log:login:delete',
        sort: 1,
        status: Status.ACTIVE,
      },
    ],
  });

  // 三级菜单：按钮权限（文件管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      {
        name: '文件上传',
        parentId: menuFile.id,
        type: MenuType.BUTTON,
        perms: 'file:upload',
        sort: 1,
        status: Status.ACTIVE,
      },
      {
        name: '文件下载',
        parentId: menuFile.id,
        type: MenuType.BUTTON,
        perms: 'file:download',
        sort: 2,
        status: Status.ACTIVE,
      },
      {
        name: '文件删除',
        parentId: menuFile.id,
        type: MenuType.BUTTON,
        perms: 'file:delete',
        sort: 3,
        status: Status.ACTIVE,
      },
      {
        name: '文件编辑',
        parentId: menuFile.id,
        type: MenuType.BUTTON,
        perms: 'file:edit',
        sort: 4,
        status: Status.ACTIVE,
      },
      {
        name: '发送通知',
        parentId: menuNotification.id,
        type: MenuType.BUTTON,
        perms: 'system:notification:send',
        sort: 1,
        status: Status.ACTIVE,
      },
      {
        name: '发布公告',
        parentId: menuNotification.id,
        type: MenuType.BUTTON,
        perms: 'system:notification:announcement',
        sort: 2,
        status: Status.ACTIVE,
      },
    ],
  });

  // 一级菜单：仪表盘
  await prisma.sysMenu.create({
    data: {
      name: '仪表盘',
      type: MenuType.MENU,
      path: '/dashboard',
      component: 'dashboard/index',
      icon: 'LayoutDashboard',
      sort: 0,
      status: Status.ACTIVE,
    },
  });

  // 一级目录：系统监控
  const menuMonitor = await prisma.sysMenu.create({
    data: {
      name: '系统监控',
      type: MenuType.DIRECTORY,
      path: '/monitor',
      icon: 'Monitor',
      sort: 2,
      status: Status.ACTIVE,
    },
  });

  // 系统监控子菜单
  await prisma.sysMenu.create({
    data: {
      name: '缓存列表',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/cache',
      component: 'monitor/cache/index',
      icon: 'Database',
      sort: 1,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '在线用户',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/online',
      component: 'monitor/online/index',
      icon: 'Users',
      sort: 2,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '定时任务',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/jobs',
      component: 'monitor/jobs/index',
      icon: 'Timer',
      sort: 3,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '接口文档',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/swagger',
      component: 'monitor/swagger/index',
      icon: 'FileText',
      sort: 4,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '服务器信息',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/server',
      component: 'monitor/server/index',
      icon: 'Server',
      sort: 5,
      status: Status.ACTIVE,
    },
  });

  // 一级菜单：个人中心（默认隐藏，排序放在最后）
  await prisma.sysMenu.create({
    data: {
      name: '个人中心',
      type: MenuType.MENU,
      path: '/profile',
      component: 'profile/index',
      icon: 'User',
      sort: 99,
      status: Status.ACTIVE,
      hidden: true,
    },
  });

  console.log('Menus created');

  // ========== 角色管理 ==========
  console.log('Creating roles...');

  // 查询所有 BUTTON 类型的菜单（权限按钮）
  const buttonMenus = await prisma.sysMenu.findMany({
    where: { type: MenuType.BUTTON },
  });

  const roleAdmin = await prisma.sysRole.create({
    data: {
      name: '超级管理员',
      code: 'admin',
      sort: 1,
      status: Status.ACTIVE,
      remark: '拥有所有权限',
      menus: {
        connect: [
          // 目录和菜单
          { id: menuSystem.id },
          { id: menuDept.id },
          { id: menuPost.id },
          { id: menuRole.id },
          { id: menuMenu.id },
          { id: menuDict.id },
          { id: menuUser.id },
          { id: menuOperLog.id },
          { id: menuLoginLog.id },
          { id: menuFile.id },
          { id: menuNotification.id },
          // 所有按钮权限
          ...buttonMenus.map((m) => ({ id: m.id })),
        ],
      },
    },
  });

  const roleUser = await prisma.sysRole.create({
    data: {
      name: '普通用户',
      code: 'user',
      sort: 2,
      status: Status.ACTIVE,
      remark: '基础权限',
    },
  });
  console.log('Roles created');

  // ========== 字典管理 ==========
  console.log('Creating dictionaries...');
  const dictGender = await prisma.sysDict.create({
    data: {
      name: '用户性别',
      code: 'sys_user_gender',
      status: Status.ACTIVE,
    },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictGender.id, label: '男', value: 'male', sort: 1, status: Status.ACTIVE },
      { dictId: dictGender.id, label: '女', value: 'female', sort: 2, status: Status.ACTIVE },
      { dictId: dictGender.id, label: '未知', value: 'unknown', sort: 3, status: Status.ACTIVE },
    ],
  });

  const dictStatus = await prisma.sysDict.create({
    data: {
      name: '系统状态',
      code: 'sys_status',
      status: Status.ACTIVE,
    },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictStatus.id, label: '启用', value: 'ACTIVE', sort: 1, status: Status.ACTIVE },
      { dictId: dictStatus.id, label: '停用', value: 'INACTIVE', sort: 2, status: Status.ACTIVE },
    ],
  });

  const dictYesNo = await prisma.sysDict.create({
    data: {
      name: '是否',
      code: 'sys_yes_no',
      status: Status.ACTIVE,
    },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictYesNo.id, label: '是', value: '1', sort: 1, status: Status.ACTIVE },
      { dictId: dictYesNo.id, label: '否', value: '0', sort: 2, status: Status.ACTIVE },
    ],
  });

  // 角色类型
  const dictRoleType = await prisma.sysDict.create({
    data: { name: '角色类型', code: 'sys_role_type', status: Status.ACTIVE },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictRoleType.id, label: '管理员', value: 'ADMIN', sort: 1, status: Status.ACTIVE },
      { dictId: dictRoleType.id, label: '普通用户', value: 'USER', sort: 2, status: Status.ACTIVE },
    ],
  });

  // 菜单类型
  const dictMenuType = await prisma.sysDict.create({
    data: { name: '菜单类型', code: 'sys_menu_type', status: Status.ACTIVE },
  });
  await prisma.sysDictData.createMany({
    data: [
      {
        dictId: dictMenuType.id,
        label: '目录',
        value: 'DIRECTORY',
        sort: 1,
        status: Status.ACTIVE,
      },
      { dictId: dictMenuType.id, label: '菜单', value: 'MENU', sort: 2, status: Status.ACTIVE },
      { dictId: dictMenuType.id, label: '按钮', value: 'BUTTON', sort: 3, status: Status.ACTIVE },
    ],
  });

  // 业务操作类型
  const dictBusinessType = await prisma.sysDict.create({
    data: { name: '业务操作类型', code: 'sys_business_type', status: Status.ACTIVE },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictBusinessType.id, label: '其他', value: '0', sort: 1, status: Status.ACTIVE },
      { dictId: dictBusinessType.id, label: '新增', value: '1', sort: 2, status: Status.ACTIVE },
      { dictId: dictBusinessType.id, label: '修改', value: '2', sort: 3, status: Status.ACTIVE },
      { dictId: dictBusinessType.id, label: '删除', value: '3', sort: 4, status: Status.ACTIVE },
      { dictId: dictBusinessType.id, label: '导出', value: '4', sort: 5, status: Status.ACTIVE },
    ],
  });

  // 操作状态
  const dictOperStatus = await prisma.sysDict.create({
    data: { name: '操作状态', code: 'sys_oper_status', status: Status.ACTIVE },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictOperStatus.id, label: '成功', value: '1', sort: 1, status: Status.ACTIVE },
      { dictId: dictOperStatus.id, label: '失败', value: '0', sort: 2, status: Status.ACTIVE },
    ],
  });

  // 隐藏状态
  const dictHidden = await prisma.sysDict.create({
    data: { name: '隐藏状态', code: 'sys_hidden', status: Status.ACTIVE },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictHidden.id, label: '显示', value: '0', sort: 1, status: Status.ACTIVE },
      { dictId: dictHidden.id, label: '隐藏', value: '1', sort: 2, status: Status.ACTIVE },
    ],
  });
  console.log('Dictionaries created');

  // ========== 用户管理 ==========
  console.log('Creating users...');

  // Create the first administrator or development seed account.
  const adminEmail = isAdminBootstrap
    ? process.env.BOOTSTRAP_ADMIN_EMAIL!.trim()
    : process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = isAdminBootstrap
    ? process.env.BOOTSTRAP_ADMIN_PASSWORD!
    : process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Admin User',
      password: await bcrypt.hash(adminPassword, 12),
      role: Role.ADMIN,
      avatar: null,
      deptId: deptTechId,
      roles: { connect: [{ id: roleAdmin.id }] },
      ...(postDevId ? { posts: { connect: [{ id: postDevId }] } } : {}),
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create test users only in development/test seed.
  const testUsers = isAdminBootstrap ? [] : [
    {
      email: 'user1@example.com',
      name: 'Test User 1',
      deptId: deptFrontendId!,
      postId: postDevId!,
    },
    {
      email: 'user2@example.com',
      name: 'Test User 2',
      deptId: deptBackendId!,
      postId: postDevId!,
    },
    {
      email: 'user3@example.com',
      name: 'Test User 3',
      deptId: deptProductId!,
      postId: postPmId!,
    },
  ];

  for (const u of testUsers) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password: await bcrypt.hash('Password@123', 12),
        role: Role.USER,
        avatar: null,
        deptId: u.deptId,
        roles: { connect: [{ id: roleUser.id }] },
        posts: { connect: [{ id: u.postId }] },
      },
    });
    console.log(`Created user: ${user.email}`);
  }

  console.log('Seeding completed!');
  console.log(isAdminBootstrap ? `Initialized first administrator: ${adminEmail}` : `Development admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await rootPrisma.$disconnect();
  });
