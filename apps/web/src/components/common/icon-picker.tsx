'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GLOBAL_ICON_MAP } from './dynamic-icon';
import { cn } from '@/lib/utils';

// 从全局图标映射表构造列表，保证与系统所有图标消费方 100% 同步
const ICON_LIST = Object.entries(GLOBAL_ICON_MAP).map(([name, icon]) => ({
  name,
  icon,
}));

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = ICON_LIST.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const SelectedIcon = (value && GLOBAL_ICON_MAP[value]) ? GLOBAL_ICON_MAP[value] : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          {SelectedIcon ? (
            <SelectedIcon className="h-4 w-4" />
          ) : (
            <span className="h-4 w-4" />
          )}
          <span className="flex-1 text-left">{value || '选择图标'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <Input
            placeholder="搜索图标..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="grid grid-cols-8 gap-1 p-2 max-h-60 overflow-y-auto">
          {filteredIcons.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  onChange(item.name);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'flex items-center justify-center rounded-md p-2 hover:bg-accent transition-colors',
                  value === item.name && 'bg-primary text-primary-foreground',
                )}
                title={item.name}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
          {filteredIcons.length === 0 && (
            <div className="col-span-8 py-4 text-center text-sm text-muted-foreground">
              未找到图标
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
