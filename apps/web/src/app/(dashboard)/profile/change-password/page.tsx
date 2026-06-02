'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

export default function ChangePasswordPage() {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.oldPassword || !formData.newPassword || !formData.confirmPassword) {
      toast.error('请填写所有字段');
      return;
    }
    if (formData.newPassword.length < 6) {
      toast.error('新密码至少需要 6 个字符');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      const { post } = await import('@/lib/api-client');
      await post('/api/user/change-password', {
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      });
      toast.success('密码修改成功');
      setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error('密码修改失败', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">修改密码</h1>
        <p className="text-muted-foreground">修改您的登录密码</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            密码修改
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>旧密码</Label>
              <Input
                type="password"
                value={formData.oldPassword}
                onChange={(e) => setFormData({ ...formData, oldPassword: e.target.value })}
                placeholder="请输入旧密码"
              />
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="请输入新密码（至少 6 个字符）"
              />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="请再次输入新密码"
              />
            </div>
            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? '提交中...' : '修改密码'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
