'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Send,
  Building,
  ShieldCheck,
  BellRing,
  Settings2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  configControllerFindAll,
  configControllerCreate,
  configControllerUpdate,
  configControllerRemove,
} from '@/api/generated/endpoints/system-config/system-config';
import type { ConfigItemDto, CreateConfigDto, UpdateConfigDto } from '@/api/generated/models';
import { useConfigStore } from '@/stores/config-store';
import { alertControllerSendTestAlert } from '@/api/generated/endpoints/system-alert/system-alert';
import { cn } from '@/lib/utils';


interface PresetConfigMeta {
  name: string;
  group: string;
  type: string;
  isPublic: boolean;
  defaultValue: string;
}

const PRESET_CONFIG_METAS: Record<string, PresetConfigMeta> = {
  "sys.app.name": { name: "系统名称", group: "basic", type: "string", isPublic: true, defaultValue: "ZhuoStack" },
  "sys.app.copyright": { name: "版权声明", group: "basic", type: "string", isPublic: true, defaultValue: "© 2026 ZhuoStack. All rights reserved." },
  "sys.app.default_theme": { name: "默认显示模式", group: "basic", type: "string", isPublic: true, defaultValue: "system" },
  "sys.security.register_enabled": { name: "开放自主注册", group: "security", type: "boolean", isPublic: true, defaultValue: "true" },
  "sys.security.captcha_enabled": { name: "登录图形验证码", group: "security", type: "boolean", isPublic: true, defaultValue: "false" },
  "sys.security.single_login": { name: "单设备登录限制", group: "security", type: "boolean", isPublic: false, defaultValue: "false" },
  "sys.security.default_password": { name: "初始密码", group: "security", type: "string", isPublic: false, defaultValue: "Admin@123456" },
  "sys.alert.enabled": { name: "异常告警总开关", group: "system", type: "boolean", isPublic: false, defaultValue: "false" },
  "sys.alert.platform": { name: "告警推送平台", group: "system", type: "string", isPublic: false, defaultValue: "wecom" },
  "sys.alert.webhook_url": { name: "机器人 Webhook 地址", group: "system", type: "string", isPublic: false, defaultValue: "" },
  "sys.alert.min_status": { name: "告警最低触发状态码", group: "system", type: "number", isPublic: false, defaultValue: "500" },
  "sys.alert.throttle_seconds": { name: "告警防轰炸节流秒数", group: "system", type: "number", isPublic: false, defaultValue: "300" },
  "sys.alert.secret": { name: "告警加签密钥", group: "system", type: "string", isPublic: false, defaultValue: "" },
};

type ActiveTab = 'basic' | 'security' | 'alert' | 'advanced';

const TABS: { id: ActiveTab; label: string; icon: typeof Building }[] = [
  { id: 'basic', label: '常规与品牌', icon: Building },
  { id: 'security', label: '登录与安全', icon: ShieldCheck },
  { id: 'alert', label: '异常与告警', icon: BellRing },
  { id: 'advanced', label: '全部参数', icon: Settings2 },
];

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('basic');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isTestingAlert, setIsTestingAlert] = useState(false);
  const [isSavingCards, setIsSavingCards] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItemDto | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const fetchPublicConfigs = useConfigStore((s) => s.fetchPublicConfigs);

  // 1. 获取全量参数列表（用于快捷面板状态回填）
  const {
    data: allConfigResponse,
    isLoading: isLoadingAll,
    refetch: refetchAll,
  } = useQuery({
    queryKey: ['system-configs-all'],
    queryFn: () => configControllerFindAll({ page: 1, pageSize: 100 }),
  });

  // 2. 表格视图分页查询
  const queryParams = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
  };

  const {
    data: tableResponse,
    isLoading: isLoadingTable,
    refetch: refetchTable,
  } = useQuery({
    queryKey: ['system-configs-table', page, pageSize, debouncedSearch],
    queryFn: () => configControllerFindAll(queryParams),
    enabled: activeTab === 'advanced',
  });

  const allConfigsList = allConfigResponse?.data?.data || [];
  const configMap = useMemo(() => {
    const map = new Map<string, ConfigItemDto>();
    for (const item of allConfigsList) {
      map.set(item.key, item);
    }
    return map;
  }, [allConfigsList]);

  // 本地表单草稿状态（用于常规、安全、告警三大卡片）
  const [cardForm, setCardForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (configMap.size > 0) {
      const draft: Record<string, string> = {};
      configMap.forEach((v, k) => {
        draft[k] = v.value;
      });
      setCardForm(draft);
    }
  }, [configMap]);

  // 高级模式：弹窗表单状态
  const [formData, setFormData] = useState<CreateConfigDto>({
    name: '',
    key: '',
    value: '',
    group: 'basic',
    type: 'string',
    isPublic: false,
    status: 'ACTIVE',
    remark: '',
  });

  const resetDialogForm = () => {
    setFormData({
      name: '',
      key: '',
      value: '',
      group: 'basic',
      type: 'string',
      isPublic: false,
      status: 'ACTIVE',
      remark: '',
    });
    setEditingConfig(null);
  };

  const handleOpenCreate = () => {
    resetDialogForm();
    setDialogOpen(true);
  };

  const handleEdit = (item: ConfigItemDto) => {
    setEditingConfig(item);
    setFormData({
      name: item.name,
      key: item.key,
      value: item.value,
      group: item.group,
      type: item.type,
      isPublic: item.isPublic,
      status: item.status,
      remark: item.remark || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (item: ConfigItemDto) => {
    const ok = await confirm({
      title: '删除配置',
      description: `确定要删除参数「${item.name} (${item.key})」吗？删除后可能影响系统运行。`,
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await configControllerRemove(item.id);
      toast.success('删除成功');
      refetchTable();
      refetchAll();
      fetchPublicConfigs();
    } catch {
      toast.error('删除失败');
    }
  };

  // 保存卡片分组的设置项（支持已存在项更新与缺失预设项自动创建）
  const handleSaveGroup = async (keys: string[]): Promise<boolean> => {
    setIsSavingCards(true);
    let successCount = 0;

    try {
      for (const key of keys) {
        const item = configMap.get(key);
        const newValue = cardForm[key];

        if (item) {
          // 已存在配置：比对变更并更新
          if (newValue !== undefined && newValue !== item.value) {
            await configControllerUpdate(item.id, { value: newValue });
            successCount++;
          }
        } else {
          // 数据库中尚无此 key：自动按照预设元数据创建
          const meta = PRESET_CONFIG_METAS[key];
          const valToCreate = newValue !== undefined ? newValue : meta?.defaultValue ?? "";
          if (meta) {
            await configControllerCreate({
              name: meta.name,
              key,
              value: valToCreate,
              group: meta.group,
              type: meta.type,
              isPublic: meta.isPublic,
              status: "ACTIVE",
            });
            successCount++;
          }
        }
      }

      toast.success(successCount > 0 ? "设置保存成功" : "配置无变更");
      refetchAll();
      fetchPublicConfigs();
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "保存失败");
      return false;
    } finally {
      setIsSavingCards(false);
    }
  };

  // 高级表格：弹窗提交
  const handleDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingConfig) {
        await configControllerUpdate(editingConfig.id, formData as UpdateConfigDto);
        toast.success('修改成功');
      } else {
        await configControllerCreate(formData);
        toast.success('创建成功');
      }
      setDialogOpen(false);
      resetDialogForm();
      refetchTable();
      refetchAll();
      fetchPublicConfigs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const paginatedData = tableResponse?.data;
  const tableList = Array.isArray(paginatedData?.data) ? paginatedData.data : [];
  const total = paginatedData?.pagination?.total || 0;
  const totalPages = paginatedData?.pagination?.totalPages || 0;

  const columns: Column<ConfigItemDto>[] = [
    {
      label: '参数名称',
      span: 2,
      render: (item) => (
        <div>
          <p className="font-medium text-foreground">{item.name}</p>
          <p className="text-xs font-mono text-muted-foreground">{item.key}</p>
        </div>
      ),
    },
    {
      label: '分组',
      span: 1,
      render: (item) => (
        <Badge variant="outline" className="text-xs font-normal">
          {item.group}
        </Badge>
      ),
    },
    {
      label: '参数键值',
      span: 3,
      render: (item) => {
        if (item.type === 'boolean') {
          const isTrue = item.value === 'true' || item.value === '1';
          return (
            <Badge variant={isTrue ? 'default' : 'secondary'} className="text-xs font-mono">
              {isTrue ? 'true (开启)' : 'false (关闭)'}
            </Badge>
          );
        }
        return (
          <span className="line-clamp-2 text-xs font-mono bg-muted/50 rounded px-1.5 py-0.5 break-all">
            {item.value}
          </span>
        );
      },
    },
    {
      label: '可见范围',
      span: 1,
      render: (item) => (
        <Badge variant={item.isPublic ? 'secondary' : 'outline'} className="text-xs">
          {item.isPublic ? '前端公开' : '内部保密'}
        </Badge>
      ),
    },
    {
      label: '更新时间',
      span: 2,
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {new Date(item.updatedAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="管理系统全局运行参数、外观品牌、安全策略与异常告警"
      />

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <div
          role="tablist"
          aria-label="系统设置分区"
          className="flex gap-1 overflow-x-auto border-b pb-1 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                id={`config-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`config-panel-${tab.id}`}
                tabIndex={0}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors lg:w-full',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={`config-panel-${activeTab}`}
          aria-labelledby={`config-tab-${activeTab}`}
          className="min-w-0"
        >

      {/* 1. 常规与品牌设置卡片 */}
      {activeTab === 'basic' && (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              基础信息与品牌
            </CardTitle>
            <CardDescription>配置系统的品牌名称、底部版权文案及新用户默认显示外观</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="app-name">系统名称 (sys.app.name)</Label>
              <Input
                id="app-name"
                value={cardForm['sys.app.name'] ?? ''}
                onChange={(e) => setCardForm({ ...cardForm, 'sys.app.name': e.target.value })}
                placeholder="例如：ZhuoStack"
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">展示在浏览器标签页、登录页与侧边栏顶部</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="app-copyright">版权信息 (sys.app.copyright)</Label>
              <Input
                id="app-copyright"
                value={cardForm['sys.app.copyright'] ?? ''}
                onChange={(e) => setCardForm({ ...cardForm, 'sys.app.copyright': e.target.value })}
                placeholder="例如：© 2026 ZhuoStack. All rights reserved."
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">展示在登录页与系统底部的版权声明文案</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="app-theme">默认显示模式 (sys.app.default_theme)</Label>
              <Select
                value={cardForm['sys.app.default_theme'] ?? 'system'}
                onValueChange={(val) => setCardForm({ ...cardForm, 'sys.app.default_theme': val })}
              >
                <SelectTrigger id="app-theme" className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">跟随系统 (推荐)</SelectItem>
                  <SelectItem value="light">日间模式 (Light)</SelectItem>
                  <SelectItem value="dark">夜间模式 (Dark)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">新用户初次访问系统时默认采用的外观主题</p>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <Button
                disabled={isSavingCards || isLoadingAll}
                onClick={() => handleSaveGroup(['sys.app.name', 'sys.app.copyright', 'sys.app.default_theme'])}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSavingCards ? '保存中...' : '保存更改'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. 登录与安全卡片 */}
      {activeTab === 'security' && (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              账号与安全策略
            </CardTitle>
            <CardDescription>配置用户注册准入机制、安全认证防护与会话限制</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">开放自主注册 (sys.security.register_enabled)</p>
                <p className="text-xs text-muted-foreground">
                  关闭后登录页隐藏“立即注册”链接，仅允许管理员手动分配账号
                </p>
              </div>
              <Switch
                disabled={isLoadingAll || isSavingCards}
                checked={cardForm['sys.security.register_enabled'] === 'true'}
                onCheckedChange={(checked) =>
                  setCardForm({ ...cardForm, 'sys.security.register_enabled': checked ? 'true' : 'false' })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">登录图形验证码 (sys.security.captcha_enabled)</p>
                <p className="text-xs text-muted-foreground">
                  开启后用户登录时必须输入 SVG 动态验证码，有效防御暴力撞库攻击
                </p>
              </div>
              <Switch
                disabled={isLoadingAll || isSavingCards}
                checked={cardForm['sys.security.captcha_enabled'] === 'true'}
                onCheckedChange={(checked) =>
                  setCardForm({ ...cardForm, 'sys.security.captcha_enabled': checked ? 'true' : 'false' })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">单设备登录限制 (sys.security.single_login)</p>
                <p className="text-xs text-muted-foreground">
                  开启后账号仅允许单设备在线，后登录设备将自动使旧会话失效并提示下线
                </p>
              </div>
              <Switch
                disabled={isLoadingAll || isSavingCards}
                checked={cardForm['sys.security.single_login'] === 'true'}
                onCheckedChange={(checked) =>
                  setCardForm({ ...cardForm, 'sys.security.single_login': checked ? 'true' : 'false' })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="default-password">初始密码 (sys.security.default_password)</Label>
              <Input
                id="default-password"
                value={cardForm['sys.security.default_password'] ?? ''}
                onChange={(e) => setCardForm({ ...cardForm, 'sys.security.default_password': e.target.value })}
                placeholder="例如：Admin@123456"
                className="max-w-md font-mono"
              />
              <p className="text-xs text-muted-foreground">管理员在用户管理中新建用户或重置密码时默认填充的初始密码</p>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <Button
                disabled={isSavingCards}
                onClick={() =>
                  handleSaveGroup([
                    'sys.security.register_enabled',
                    'sys.security.captcha_enabled',
                    'sys.security.single_login',
                    'sys.security.default_password',
                  ])
                }
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSavingCards ? '保存中...' : '保存更改'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. 异常与告警卡片 */}
      {activeTab === 'alert' && (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              接口与异常告警 (Webhook)
            </CardTitle>
            <CardDescription>当系统发生 5xx 严重异常时，通过群机器人实时推送通知，内置 Redis 错误降噪</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">异常告警总开关 (sys.alert.enabled)</p>
                <p className="text-xs text-muted-foreground">
                  开启后服务端全局异常过滤器（HttpExceptionFilter）捕获到严重错误将自动发送消息
                </p>
              </div>
              <Switch
                disabled={isLoadingAll || isSavingCards}
                checked={cardForm['sys.alert.enabled'] === 'true'}
                onCheckedChange={(checked) =>
                  setCardForm({ ...cardForm, 'sys.alert.enabled': checked ? 'true' : 'false' })
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="alert-platform">告警平台 (sys.alert.platform)</Label>
                <Select
                  value={cardForm['sys.alert.platform'] ?? 'wecom'}
                  onValueChange={(val) => setCardForm({ ...cardForm, 'sys.alert.platform': val })}
                >
                  <SelectTrigger id="alert-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wecom">企业微信群机器人 (WeCom)</SelectItem>
                    <SelectItem value="feishu">飞书群卡片机器人 (Feishu)</SelectItem>
                    <SelectItem value="dingtalk">钉钉群机器人 (DingTalk)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="alert-status">最低触发状态码 (sys.alert.min_status)</Label>
                <Input
                  id="alert-status"
                  type="number"
                  value={cardForm['sys.alert.min_status'] ?? '500'}
                  onChange={(e) => setCardForm({ ...cardForm, 'sys.alert.min_status': e.target.value })}
                  placeholder="500"
                />
                <p className="text-xs text-muted-foreground">默认 500（仅严重服务故障），避免 400 等业务拦截误报</p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-webhook">机器人 Webhook 地址 (sys.alert.webhook_url)</Label>
              <div className="flex gap-2">
                <Input
                  id="alert-webhook"
                  value={cardForm['sys.alert.webhook_url'] ?? ''}
                  onChange={(e) => setCardForm({ ...cardForm, 'sys.alert.webhook_url': e.target.value })}
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  className="font-mono text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isTestingAlert || isSavingCards || isLoadingAll || !cardForm['sys.alert.webhook_url']}
                  onClick={async () => {
                    setIsTestingAlert(true);
                    try {
                      const saved = await handleSaveGroup([
                        'sys.alert.enabled',
                        'sys.alert.platform',
                        'sys.alert.webhook_url',
                        'sys.alert.min_status',
                        'sys.alert.throttle_seconds',
                        'sys.alert.secret',
                      ]);
                      if (!saved) return;
                      const res = await alertControllerSendTestAlert();
                      toast.success(res.data?.message || '测试告警已发送');
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : '发送失败，请检查 Webhook 配置');
                    } finally {
                      setIsTestingAlert(false);
                    }
                  }}
                  className="gap-1.5 shrink-0"
                >
                  <Send className="h-4 w-4" />
                  {isTestingAlert ? '发送中...' : '测试连通性'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">在企业微信群或飞书群添加自定义机器人，复制 Webhook 地址粘贴在此处</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="alert-throttle">Redis 防轰炸冷却 (秒) (sys.alert.throttle_seconds)</Label>
                <Input
                  id="alert-throttle"
                  type="number"
                  value={cardForm['sys.alert.throttle_seconds'] ?? '300'}
                  onChange={(e) => setCardForm({ ...cardForm, 'sys.alert.throttle_seconds': e.target.value })}
                  placeholder="300"
                />
                <p className="text-xs text-muted-foreground">相同错误指纹在此期间内仅发送一次，避免重复刷屏</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="alert-secret">加签密钥 (可选) (sys.alert.secret)</Label>
                <Input
                  id="alert-secret"
                  value={cardForm['sys.alert.secret'] ?? ''}
                  onChange={(e) => setCardForm({ ...cardForm, 'sys.alert.secret': e.target.value })}
                  placeholder="留空即无需加签"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">部分平台开启安全校验时所需的加签 Secret</p>
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <Button
                disabled={isSavingCards || isLoadingAll}
                onClick={() =>
                  handleSaveGroup([
                    'sys.alert.enabled',
                    'sys.alert.platform',
                    'sys.alert.webhook_url',
                    'sys.alert.min_status',
                    'sys.alert.throttle_seconds',
                    'sys.alert.secret',
                  ])
                }
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSavingCards ? '保存中...' : '保存更改'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. 高级开发者数据表视图 */}
      {activeTab === 'advanced' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder="快速搜索键名或名称..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full sm:max-w-72"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
                <Plus className="h-4 w-4" />
                新增自定义参数
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchTable()} className="gap-1.5">
                <RefreshCw className="h-4 w-4" />
                刷新
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={tableList}
            isLoading={isLoadingTable}
            emptyText="暂无配置参数"
            actions={(item) => (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleEdit(item)}
                  title="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item)}
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          />

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* 高级新增/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingConfig ? '编辑系统参数' : '新增系统参数'}</DialogTitle>
            <DialogDescription>配置全局底层键值，非必要无需改动系统级保留键。</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDialogSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cfg-name">参数名称 *</Label>
              <Input
                id="cfg-name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cfg-key">参数键名 *</Label>
              <Input
                id="cfg-key"
                required
                disabled={!!editingConfig}
                className="font-mono"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>分组 *</Label>
                <Select
                  value={formData.group}
                  onValueChange={(val) => setFormData({ ...formData, group: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">常规设置 (basic)</SelectItem>
                    <SelectItem value="security">安全登录 (security)</SelectItem>
                    <SelectItem value="system">系统运维 (system)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>类型 *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => {
                    let nextVal = formData.value;
                    if (val === 'boolean' && nextVal !== 'true' && nextVal !== 'false') {
                      nextVal = 'false';
                    }
                    setFormData({ ...formData, type: val, value: nextVal });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">文本 (string)</SelectItem>
                    <SelectItem value="boolean">开关 (boolean)</SelectItem>
                    <SelectItem value="number">数值 (number)</SelectItem>
                    <SelectItem value="json">JSON 结构体</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cfg-value">参数键值 *</Label>
              {formData.type === 'boolean' ? (
                <div className="flex items-center justify-between rounded-md border p-3 bg-muted/20">
                  <span className="text-sm font-medium">
                    {formData.value === 'true' ? '开启 (true)' : '关闭 (false)'}
                  </span>
                  <Switch
                    checked={formData.value === 'true'}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, value: checked ? 'true' : 'false' })
                    }
                  />
                </div>
              ) : formData.type === 'number' ? (
                <Input
                  id="cfg-value"
                  type="number"
                  required
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              ) : (
                <Textarea
                  id="cfg-value"
                  required
                  rows={3}
                  className="font-mono text-xs"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="cfg-public" className="text-sm font-medium">
                  前端公开访问
                </Label>
                <p className="text-xs text-muted-foreground">开启后免登录前端可直接读取</p>
              </div>
              <Switch
                id="cfg-public"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cfg-remark">备注（选填）</Label>
              <Input
                id="cfg-remark"
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        </div>
      </div>

      <ConfirmDialog />
    </div>
  );
}
