'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

/**
 * 全局确认对话框 Hook
 * 替代原生 confirm()，返回 Promise<boolean>
 *
 * @example
 * const { confirm, ConfirmDialog } = useConfirm();
 *
 * const handleDelete = async () => {
 *   const ok = await confirm({ description: '确定要删除吗？' });
 *   if (ok) { ... }
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>删除</Button>
 *     <ConfirmDialog />
 *   </>
 * );
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    description: '',
  });

  const resolveRef = useRef<(value: boolean) => void>();

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const handleClose = useCallback(() => {
    resolveRef.current?.(false);
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  function ConfirmDialog() {
    return (
      <Dialog open={state.open} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{state.title || '确认操作'}</DialogTitle>
            <DialogDescription>{state.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {state.cancelText || '取消'}
            </Button>
            <Button
              variant={state.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirm}
            >
              {state.confirmText || '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return { confirm, ConfirmDialog };
}
